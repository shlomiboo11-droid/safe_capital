/**
 * Guards the fix for "the research always dies on exactly 5 findings".
 *
 * Three runs in a row (31/05, 23/06, 30/07) stopped on 5 of 8 findings after
 * 217-239s, while healthy runs took 425-491s — so it was never a time limit.
 * The cause was arithmetic, in two places:
 *
 *   1. claude-client clamped EVERY retry wait to 30s, including a wait
 *      Anthropic had explicitly asked for ("reset in 45s"). The retry therefore
 *      fired while still blocked, all retries burned, query dead.
 *   2. the research loop measured nothing — not the elapsed run time, not the
 *      remaining quota — so it could neither slow down before the block nor
 *      stop in time to salvage a summary from what it had gathered.
 *
 * Everything below is pure arithmetic on purpose: no network, no database, no
 * API key, no waiting. Run: cd admin && npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');

const {
  computeRetryWaitMs,
  parseRateLimitHeaders,
  applyWebSearchMaxUses,
  NATIVE_WEB_SEARCH,
  LIMITS
} = require('../server/services/claude-client');

const {
  readRunBudgetMs,
  estimateQueryMs,
  estimateNextInputTokens,
  shouldStopForBudget,
  decidePacing,
  BUDGET
} = require('../server/services/whatsapp/research-budget');

// ── 1. Honour the wait the API asked for ─────────────────────────────

test('a retry-after of 45s is waited in full, not clamped to 30s', () => {
  // THE bug. If this ever asserts 30_000 again, the 5-findings death is back.
  const { waitMs, source } = computeRetryWaitMs({ retryAfter: '45', attempt: 0 });
  assert.strictEqual(source, 'header');
  assert.ok(waitMs >= 45_000, `expected >= 45s, got ${waitMs}ms`);
  assert.ok(waitMs > LIMITS.MAX_WAIT_MS_PER_RETRY,
    'a header wait must be allowed to exceed the backoff ceiling');
});

test('an ISO reset timestamp is honoured as an absolute moment', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const resetHeader = new Date(now + 40_000).toISOString();
  const { waitMs, source } = computeRetryWaitMs({ resetHeader, attempt: 0, now });
  assert.strictEqual(source, 'header');
  // 40s plus the small overshoot that keeps us off the exact edge.
  assert.ok(waitMs >= 40_000 && waitMs <= 41_000, `got ${waitMs}ms`);
});

test('the token-reset header wins over retry-after', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const { waitMs } = computeRetryWaitMs({
    resetHeader: new Date(now + 50_000).toISOString(),
    retryAfter: '5',
    attempt: 0,
    now
  });
  assert.ok(waitMs >= 50_000, `expected the reset header to win, got ${waitMs}ms`);
});

test('an absurd header value is capped at the sanity ceiling', () => {
  const { waitMs, source } = computeRetryWaitMs({ retryAfter: '3600', attempt: 0 });
  assert.strictEqual(source, 'header');
  assert.strictEqual(waitMs, LIMITS.MAX_HEADER_WAIT_MS);
});

test('a reset that already passed still waits a beat, never a negative wait', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const { waitMs } = computeRetryWaitMs({
    resetHeader: new Date(now - 30_000).toISOString(),
    attempt: 0,
    now
  });
  assert.ok(waitMs >= 1_000 && waitMs <= 2_000, `got ${waitMs}ms`);
});

test('with no header we fall back to bounded exponential backoff', () => {
  const a = computeRetryWaitMs({ attempt: 0 });
  const b = computeRetryWaitMs({ attempt: 1 });
  const c = computeRetryWaitMs({ attempt: 3 });
  assert.strictEqual(a.source, 'backoff');
  assert.ok(b.waitMs > a.waitMs, 'backoff must grow');
  // A wait we invented ourselves stays capped — only the API gets to ask for more.
  for (const r of [a, b, c]) {
    assert.ok(r.waitMs <= LIMITS.MAX_WAIT_MS_PER_RETRY, `${r.waitMs}ms exceeds the backoff ceiling`);
  }
});

test('garbage headers degrade to backoff instead of throwing', () => {
  for (const bad of ['', '   ', 'soon', null, undefined]) {
    const { source } = computeRetryWaitMs({ resetHeader: bad, retryAfter: bad, attempt: 0 });
    assert.strictEqual(source, 'backoff', `header ${JSON.stringify(bad)} should not parse`);
  }
});

// ── 2. Read the quota on success, not only on 429 ────────────────────

test('rate-limit headers are read from a successful response', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const rl = parseRateLimitHeaders({
    'anthropic-ratelimit-input-tokens-remaining': '4200',
    'anthropic-ratelimit-input-tokens-limit': '30000',
    'anthropic-ratelimit-input-tokens-reset': new Date(now + 20_000).toISOString(),
    'anthropic-ratelimit-requests-remaining': '48'
  }, now);
  assert.strictEqual(rl.inputTokensRemaining, 4200);
  assert.strictEqual(rl.inputTokensLimit, 30000);
  assert.strictEqual(rl.requestsRemaining, 48);
  assert.strictEqual(rl.resetAtMs, now + 20_000);
});

test('header lookup is case-insensitive and works with a fetch Headers object', () => {
  const h = new Headers({ 'Anthropic-RateLimit-Input-Tokens-Remaining': '900' });
  assert.strictEqual(parseRateLimitHeaders(h).inputTokensRemaining, 900);
});

test('missing headers give null — never a fabricated zero quota', () => {
  // A zero would make the pacer wait for a reset that was never announced.
  assert.strictEqual(parseRateLimitHeaders({}), null);
  assert.strictEqual(parseRateLimitHeaders({ 'content-type': 'application/json' }), null);
});

// ── 3. Bound the web search ──────────────────────────────────────────

test('the shared web_search tool carries a default ceiling', () => {
  assert.ok(Number.isFinite(NATIVE_WEB_SEARCH.max_uses) && NATIVE_WEB_SEARCH.max_uses > 0,
    'an uncapped web_search can loop through unbounded searches, and every result ' +
    'is re-sent as input tokens on the next turn — that is what triggers the 429s');
  assert.strictEqual(NATIVE_WEB_SEARCH.max_uses, 5);
});

test('web_search_max_uses is actually applied (it used to be JSDoc only)', () => {
  const out = applyWebSearchMaxUses([{ ...NATIVE_WEB_SEARCH }], 2);
  assert.strictEqual(out[0].max_uses, 2);
});

test('applying the cap does not mutate the shared tool template', () => {
  const before = NATIVE_WEB_SEARCH.max_uses;
  applyWebSearchMaxUses([NATIVE_WEB_SEARCH], 2);
  assert.strictEqual(NATIVE_WEB_SEARCH.max_uses, before);
});

test('callers that pass no cap are left exactly as they were', () => {
  // The article bot and writing-service spell max_uses out on the tool itself
  // and never pass the option — their tool list must come through untouched.
  const tools = [{ ...NATIVE_WEB_SEARCH, max_uses: 3 }];
  for (const noCap of [undefined, null, 0, -1, 'many']) {
    assert.deepStrictEqual(applyWebSearchMaxUses(tools, noCap), tools);
  }
});

test('non-web_search tools are never touched', () => {
  const tools = [{ type: 'custom_tool', name: 'x' }, { ...NATIVE_WEB_SEARCH }];
  const out = applyWebSearchMaxUses(tools, 4);
  assert.deepStrictEqual(out[0], tools[0]);
  assert.strictEqual(out[1].max_uses, 4);
});

// ── 4. Stop in time to summarize ─────────────────────────────────────

const RESERVE = BUDGET.DEFAULT_SUMMARY_RESERVE_MS;

test('a query that fits, runs', () => {
  assert.strictEqual(shouldStopForBudget({
    elapsedMs: 120_000, budgetMs: 700_000, reserveMs: RESERVE, nextSlotMs: 85_000
  }), false);
});

test('a query that would eat the summary reserve does not run', () => {
  // 610s spent + 85s for the next query = 695s, leaving 5s for a summary that
  // needs ~90s. Running it strands every finding gathered so far.
  assert.strictEqual(shouldStopForBudget({
    elapsedMs: 610_000, budgetMs: 700_000, reserveMs: RESERVE, nextSlotMs: 85_000
  }), true);
});

test('a long rate-limit wait can exhaust the budget on its own', () => {
  const fits    = { elapsedMs: 500_000, budgetMs: 700_000, reserveMs: RESERVE, nextSlotMs: 25_000 + 60_000 };
  const doesNot = { elapsedMs: 500_000, budgetMs: 700_000, reserveMs: RESERVE, nextSlotMs: 90_000 + 60_000 };
  assert.strictEqual(shouldStopForBudget(fits), false);
  assert.strictEqual(shouldStopForBudget(doesNot), true);
});

/** Replay a measured healthy run — 8 queries, ~35s each, 25s gaps — against a
 *  budget, and report how many queries it let through and where it stopped. */
function replayHealthyRun(budgetMs) {
  let elapsed = 0, ran = 0;
  for (let i = 1; i <= 8; i++) {
    const gap = i === 1 ? 0 : 25_000;
    const nextSlotMs = gap + estimateQueryMs(60_000, 35_000);
    if (shouldStopForBudget({ elapsedMs: elapsed, budgetMs, reserveMs: RESERVE, nextSlotMs })) break;
    elapsed += gap + 35_000;
    ran++;
  }
  return { ran, elapsed };
}

test('the default budget never cuts a healthy 8-query run short', () => {
  // The measured shape of a run that succeeded in production: 8 findings,
  // 425-491s from first finding to last. The budget is a safety net against a
  // wedged query — if it fires here it is the bug, not the fix. A run stopped
  // on purpose after 3 queries is worse than the 5 production already managed.
  const { ran, elapsed } = replayHealthyRun(BUDGET.DEFAULT_RUN_BUDGET_MS);
  assert.strictEqual(ran, 8,
    `the default budget stopped a healthy run after ${ran} of 8 queries — it was ` +
    `calibrated below the 425-491s that real successful runs measured`);
  assert.ok(elapsed + RESERVE < BUDGET.DEFAULT_RUN_BUDGET_MS,
    `run+summary ${elapsed + RESERVE}ms must fit in ${BUDGET.DEFAULT_RUN_BUDGET_MS}ms`);
});

test('the budget does stop a pathological run, with the summary reserve intact', () => {
  // What the net is actually for: queries that wedge and run far longer than
  // any healthy one. The loop must stop while there is still time to summarize,
  // so the findings already gathered are not stranded — that is the ~$1.73 of
  // paid-for research sitting unusable in production right now.
  const budgetMs = BUDGET.DEFAULT_RUN_BUDGET_MS;
  let elapsed = 0, ran = 0;
  for (let i = 1; i <= 8; i++) {
    const gap = i === 1 ? 0 : 25_000;
    const slow = 200_000;                    // a query 5x the healthy 35-40s
    const nextSlotMs = gap + estimateQueryMs(60_000, slow);
    if (shouldStopForBudget({ elapsedMs: elapsed, budgetMs, reserveMs: RESERVE, nextSlotMs })) break;
    elapsed += gap + slow;
    ran++;
  }
  assert.ok(ran > 0, 'the budget must still let real queries run');
  assert.ok(ran < 8, `a run of 200s queries should have been stopped, ${ran} ran`);
  assert.ok(elapsed + RESERVE <= budgetMs,
    `stopped at ${elapsed}ms with ${RESERVE}ms of summary reserve — must fit in ${budgetMs}ms`);
});

test('the query estimate rises to the slowest query seen, never falls below the seed', () => {
  assert.strictEqual(estimateQueryMs(60_000, 0), 60_000);
  assert.strictEqual(estimateQueryMs(60_000, 35_000), 60_000);
  assert.strictEqual(estimateQueryMs(60_000, 140_000), 140_000);
});

test('the run budget is env-overridable, and nonsense is ignored', () => {
  assert.strictEqual(readRunBudgetMs({}), BUDGET.DEFAULT_RUN_BUDGET_MS);
  assert.strictEqual(readRunBudgetMs({ WHATSAPP_RESEARCH_BUDGET_MS: '300000' }), 300_000);
  for (const junk of ['abc', '-5', '1000', '']) {
    // 1000ms is below the summary reserve: it would stop the loop before the
    // first query ever ran, so it is a misconfiguration, not a budget.
    assert.strictEqual(readRunBudgetMs({ WHATSAPP_RESEARCH_BUDGET_MS: junk }),
      BUDGET.DEFAULT_RUN_BUDGET_MS, `junk value ${JSON.stringify(junk)} should be ignored`);
  }
});

// ── 5. Slow down before the block, not after ─────────────────────────

const GAP = 25_000;

test('no rate-limit information → the old fixed gap, unchanged', () => {
  const d = decidePacing({ rateLimit: null, estimatedInputTokens: 12_000, defaultGapMs: GAP });
  assert.deepStrictEqual(d, { waitMs: GAP, waitingFor: 'gap' });
});

test('plenty of quota left → the old fixed gap, unchanged', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const d = decidePacing({
    rateLimit: { inputTokensRemaining: 25_000, resetAtMs: now + 50_000 },
    estimatedInputTokens: 12_000,
    defaultGapMs: GAP,
    now
  });
  assert.deepStrictEqual(d, { waitMs: GAP, waitingFor: 'gap' });
});

test('quota too small for the next query → wait for the actual reset', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const d = decidePacing({
    rateLimit: { inputTokensRemaining: 3_000, resetAtMs: now + 48_000 },
    estimatedInputTokens: 12_000,
    defaultGapMs: GAP,
    now
  });
  assert.strictEqual(d.waitingFor, 'rate_limit');
  assert.ok(d.waitMs > 48_000 && d.waitMs <= 50_000, `got ${d.waitMs}ms`);
});

test('a reset closer than the gap needs no special wait', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const d = decidePacing({
    rateLimit: { inputTokensRemaining: 100, resetAtMs: now + 8_000 },
    estimatedInputTokens: 12_000,
    defaultGapMs: GAP,
    now
  });
  assert.deepStrictEqual(d, { waitMs: GAP, waitingFor: 'gap' });
});

test('a rate-limit wait is capped, so a broken header cannot park the run', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0);
  const d = decidePacing({
    rateLimit: { inputTokensRemaining: 0, resetAtMs: now + 3_600_000 },
    estimatedInputTokens: 12_000,
    defaultGapMs: GAP,
    now
  });
  assert.strictEqual(d.waitMs, BUDGET.MAX_RATE_LIMIT_WAIT_MS);
});

test('low quota with no reset time → fixed gap, not a guess', () => {
  const d = decidePacing({
    rateLimit: { inputTokensRemaining: 10, resetAtMs: null },
    estimatedInputTokens: 12_000,
    defaultGapMs: GAP
  });
  assert.deepStrictEqual(d, { waitMs: GAP, waitingFor: 'gap' });
});

test('the next-query token estimate is padded and floored', () => {
  // Before query 1 nothing has been measured; assuming "cheap" would make the
  // check useless exactly when it matters.
  assert.strictEqual(estimateNextInputTokens(0), BUDGET.MIN_INPUT_TOKEN_ESTIMATE);
  assert.strictEqual(estimateNextInputTokens(), BUDGET.MIN_INPUT_TOKEN_ESTIMATE);
  // web_search results make the next call hungrier than the last one.
  assert.ok(estimateNextInputTokens(20_000) > 20_000);
});

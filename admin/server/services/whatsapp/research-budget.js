/**
 * Budget + pacing arithmetic for a research run.
 *
 * Pure functions, no I/O, no clock of their own — every one of them takes the
 * numbers it needs and returns a decision. That is deliberate: this is the
 * logic that decides whether a run stops with a partial summary or dies, and
 * it has to be testable without a database, an API key, or a 10-minute wait.
 *
 * Why it exists at all:
 *   Three runs in a row died on exactly 5 of 8 findings. The queries were fired
 *   on a fixed 25s/35s metronome that had no idea what the real quota was, and
 *   the loop measured no elapsed time at all — so it could neither slow down
 *   before hitting the limit nor stop in time to salvage a summary.
 */

// ── Budget ───────────────────────────────────────────────────────────
//
// DEFAULT_RUN_BUDGET_MS — total wall clock for one research run, queries AND
//   the closing summary.
//
//   This is a SAFETY NET against a wedged query, not a throttle. It must never
//   fire on a healthy run, because firing early is itself the bug it exists to
//   prevent: a run that stops on purpose after 3 queries is worse than the 5
//   production was already managing.
//
//   Calibrated from measured production runs, not from a theory:
//     succeeded — 8 findings, 425/423/475/491s spanning first to last finding,
//                 plus ~143s before the first one → roughly 570-640s end to end
//     failed    — 5 findings, span 217/228/239s, then silence
//   A hard 300s ceiling is ruled out by those numbers twice over: it would have
//   killed every successful run, and the failures died well short of it. The
//   5-finding wall is a rate limit (see claude-client.js — an explicit
//   `anthropic-ratelimit-*-reset` wait used to be clamped to 30s, so all three
//   retries fired while still blocked), which is fixed there, not here.
//
//   700s therefore sits above the worst healthy run measured and below any
//   plausible platform ceiling. If the platform does kill the invocation first,
//   this budget simply never fires — no worse than before, and the rate-limit
//   fix still applies. Override with WHATSAPP_RESEARCH_BUDGET_MS.
//
//   ⚠️ Do not lower this to "match maxDuration" without evidence. Note that
//   admin/vercel.json declares maxDuration 800 under `builds[0].config`, which
//   Vercel does NOT enforce (only a top-level `functions` block would, and it
//   cannot coexist with `builds`). That config line is inert — but the fix for
//   it is a vercel.json migration, an open decision, not a smaller budget here.
//
// DEFAULT_SUMMARY_RESERVE_MS — carved out of the budget and never spent on
//   queries. The summary is a single Sonnet call with no web search (~15-30s),
//   plus room for one rate-limit retry. Without this reserve the run spends its
//   last second on a query and the findings are stranded with no summary —
//   which is exactly the ~$1.73 of paid-for research sitting unusable in
//   production right now.
const DEFAULT_RUN_BUDGET_MS = 700_000;
const DEFAULT_SUMMARY_RESERVE_MS = 90_000;

// ── Pacing ───────────────────────────────────────────────────────────
//
// RATE_LIMIT_BUFFER_MS — come back just after the bucket refills, not on the
//   exact edge, where clock skew turns a legal call into another 429.
//
// MAX_RATE_LIMIT_WAIT_MS — sanity ceiling on a header-derived wait, same 90s
//   reasoning as claude-client: Anthropic's token buckets refill on a rolling
//   60s window, so anything beyond this is a broken header, not a real reset.
//
// MIN_INPUT_TOKEN_ESTIMATE — floor for "how many input tokens will the next
//   query cost". Before the first query there is nothing measured yet, and a
//   research call always carries the business-context system block, so
//   assuming a small number would make the pacing check useless exactly when
//   it matters most.
//
// INPUT_TOKEN_SAFETY_FACTOR — the next call is usually a bit hungrier than the
//   last one: web_search results from the previous turn inflate the prompt.
//   25% padding beats being 5% short and eating a 429.
const RATE_LIMIT_BUFFER_MS = 1_500;
const MAX_RATE_LIMIT_WAIT_MS = 90_000;
const MIN_INPUT_TOKEN_ESTIMATE = 8_000;
const INPUT_TOKEN_SAFETY_FACTOR = 1.25;

/**
 * Read the run budget from the environment, falling back to the default.
 * @param {Object} [env=process.env]
 */
function readRunBudgetMs(env = process.env) {
  const raw = Number(env.WHATSAPP_RESEARCH_BUDGET_MS);
  // A budget smaller than the summary reserve would stop the loop before the
  // first query — treat anything that small as a misconfiguration and ignore it.
  if (Number.isFinite(raw) && raw > DEFAULT_SUMMARY_RESERVE_MS) return raw;
  return DEFAULT_RUN_BUDGET_MS;
}

/**
 * How long the next query is likely to take. Starts from a seed (we have no
 * measurement before query 1) and rises to the slowest query observed so far —
 * max, not average, because the decision protects the summary and being
 * optimistic here is what strands the findings.
 */
function estimateQueryMs(seedMs, maxObservedMs = 0) {
  return Math.max(Number(seedMs) || 0, Number(maxObservedMs) || 0);
}

/** How many input tokens the next query will likely consume. */
function estimateNextInputTokens(lastInputTokens = 0) {
  const last = Number(lastInputTokens) || 0;
  return Math.max(MIN_INPUT_TOKEN_ESTIMATE, Math.ceil(last * INPUT_TOKEN_SAFETY_FACTOR));
}

/**
 * Should the query loop stop now and go summarize what it has?
 *
 * @param {Object} args
 * @param {number} args.elapsedMs   time spent since the run started
 * @param {number} args.budgetMs    total budget for the run (queries + summary)
 * @param {number} args.reserveMs   slice reserved for the summary
 * @param {number} args.nextSlotMs  wait before the next query + the query itself
 * @returns {boolean}
 */
function shouldStopForBudget({ elapsedMs, budgetMs, reserveMs, nextSlotMs }) {
  return (elapsedMs + nextSlotMs + reserveMs) > budgetMs;
}

/**
 * How long to wait before the next query.
 *
 * Default behaviour is preserved exactly: with no rate-limit information (older
 * gateway, proxy stripping headers, first query) this returns the caller's
 * fixed gap and reports `waiting_for: 'gap'`. Only when the API has told us the
 * remaining quota AND that quota is too small for the next query do we switch
 * to waiting for the actual reset.
 *
 * @param {Object} args
 * @param {Object|null} args.rateLimit  from claude-client's parseRateLimitHeaders
 * @param {number} args.estimatedInputTokens
 * @param {number} args.defaultGapMs
 * @param {number} [args.now]
 * @returns {{ waitMs: number, waitingFor: 'gap'|'rate_limit' }}
 */
function decidePacing({ rateLimit, estimatedInputTokens, defaultGapMs, now = Date.now() }) {
  const gap = { waitMs: defaultGapMs, waitingFor: 'gap' };
  if (!rateLimit) return gap;

  const { inputTokensRemaining, resetAtMs } = rateLimit;
  if (inputTokensRemaining === null || inputTokensRemaining === undefined) return gap;
  if (inputTokensRemaining >= estimatedInputTokens) return gap;
  if (!resetAtMs) return gap;   // quota is low but we don't know when it refills

  const untilReset = resetAtMs - now + RATE_LIMIT_BUFFER_MS;
  // The reset already passed (or is closer than the gap we would have taken
  // anyway) — the fixed gap covers it, no reason to report a rate-limit wait.
  if (untilReset <= defaultGapMs) return gap;

  return {
    waitMs: Math.min(untilReset, MAX_RATE_LIMIT_WAIT_MS),
    waitingFor: 'rate_limit'
  };
}

module.exports = {
  readRunBudgetMs,
  estimateQueryMs,
  estimateNextInputTokens,
  shouldStopForBudget,
  decidePacing,
  BUDGET: {
    DEFAULT_RUN_BUDGET_MS,
    DEFAULT_SUMMARY_RESERVE_MS,
    MAX_RATE_LIMIT_WAIT_MS,
    MIN_INPUT_TOKEN_ESTIMATE,
    INPUT_TOKEN_SAFETY_FACTOR,
    RATE_LIMIT_BUFFER_MS
  }
};

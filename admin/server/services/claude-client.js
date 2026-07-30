/**
 * Generic Anthropic Messages API client.
 * Thin wrapper around fetch — matches the pattern article-bot.js already uses,
 * but extracted so new code (whatsapp updates) and existing code can share it.
 *
 * Intentionally no SDK dependency to keep the bundle small and the surface
 * area predictable for serverless cold-starts.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const NATIVE_WEB_SEARCH = {
  type: 'web_search_20250305',
  name: 'web_search',
  // Default ceiling on searches within a single call. Without one, a call may
  // loop through as many searches as the model feels like, and every result it
  // reads is re-sent as input tokens on the next turn — that is what pushes a
  // run over the org's input-tokens-per-minute limit and into 429s.
  // 5 is enough to cross-check the 2 sources the research prompt demands and
  // still leave room for a refinement or a dead link. Call sites that want a
  // different ceiling override it (`{ ...NATIVE_WEB_SEARCH, max_uses: N }`),
  // which is what every existing caller already does — so this default only
  // changes behaviour for callers that specify nothing.
  max_uses: 5
};

// ── Timing constants ────────────────────────────────────────────────
//
// Every number here is a deliberate choice, not a round number:
//
// MAX_WAIT_MS_PER_RETRY — cap for backoff we *invented* ourselves (no header).
//   A guess should never park the run for long; 30s is two doublings.
//
// MAX_HEADER_WAIT_MS — cap for a wait the API *asked* for. Anthropic's token
//   buckets refill on a rolling 60s window, so a legitimate reset is at most
//   ~60s away; 90s covers that plus clock skew and a slow response, while
//   still bounding an absurd value (a proxy answering `retry-after: 3600`).
//   Honouring the header up to this ceiling is the fix for the root bug: the
//   old code clamped an explicit "wait 45s" down to 30s, retried while still
//   blocked, burned all its retries and killed the query.
//
// MAX_RETRIES stays at 3 (= 4 attempts). Raising it was considered and
//   rejected: the failures were never "we ran out of attempts", they were
//   "every attempt was fired too early". Once the wait is honoured, an attempt
//   starts on a refilled bucket, so extra attempts buy almost nothing and each
//   one can now cost up to 90s of a run budget that is itself finite.
//
// DEFAULT_MAX_TOTAL_MS — absolute ceiling for one logical call, including all
//   retries and all waiting. Previously unbounded in practice: 4 attempts x
//   (240s fetch timeout + 30s wait) ~= 1,050s, i.e. a single wedged query
//   could eat an entire research run. 300s still admits the worst *healthy*
//   429 storm (3 header waits of 90s + short 429 responses ~= 280s), so it
//   rejects only genuine pathology.
const MAX_RETRIES = 3;
const MAX_WAIT_MS_PER_RETRY = 30_000;
const MAX_HEADER_WAIT_MS = 90_000;
const MIN_RETRY_WAIT_MS = 1_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 240_000;
const DEFAULT_MAX_TOTAL_MS = 300_000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Read a header case-insensitively from a fetch `Headers` or a plain object. */
function headerGetter(headers) {
  if (!headers) return () => null;
  if (typeof headers.get === 'function') return (name) => headers.get(name);
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[String(k).toLowerCase()] = v;
  return (name) => {
    const v = lower[String(name).toLowerCase()];
    return v === undefined ? null : v;
  };
}

/**
 * A rate-limit header value is either seconds-to-wait (`retry-after: 45`) or an
 * RFC-3339 timestamp (`anthropic-ratelimit-input-tokens-reset`).
 * @returns {number|null} absolute epoch-ms the bucket refills at, or null.
 */
function parseResetAtMs(raw, now = Date.now()) {
  if (raw === null || raw === undefined || raw === '') return null;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && String(raw).trim() !== '') return now + asNum * 1000;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * How long to wait before the next attempt.
 *
 * A wait that came from a header is honoured in full (up to MAX_HEADER_WAIT_MS)
 * — the API knows when its bucket refills and we do not. Only a wait we made up
 * ourselves is squeezed into MAX_WAIT_MS_PER_RETRY.
 *
 * @param {Object} args
 * @param {string|null} [args.resetHeader]  anthropic-ratelimit-input-tokens-reset
 * @param {string|null} [args.retryAfter]   retry-after
 * @param {number} args.attempt             0-based attempt index
 * @param {number} [args.now]
 * @returns {{ waitMs: number, source: 'header'|'backoff' }}
 */
function computeRetryWaitMs({ resetHeader, retryAfter, attempt = 0, now = Date.now() }) {
  const resetAt = parseResetAtMs(resetHeader, now) ?? parseResetAtMs(retryAfter, now);
  if (resetAt !== null) {
    // +500ms so we come back just after the refill, never a hair before it.
    const raw = resetAt - now + 500;
    return {
      waitMs: Math.min(MAX_HEADER_WAIT_MS, Math.max(MIN_RETRY_WAIT_MS, raw)),
      source: 'header'
    };
  }
  return {
    waitMs: Math.min(MAX_WAIT_MS_PER_RETRY, 5_000 * Math.pow(2, attempt)),
    source: 'backoff'
  };
}

/**
 * Rate-limit state as reported on a **successful** response. Anthropic sends
 * these on every 200, not only on 429 — reading them is what lets a caller slow
 * down *before* it gets blocked instead of after.
 *
 * @returns {{inputTokensRemaining:number|null, inputTokensLimit:number|null,
 *           requestsRemaining:number|null, resetAtMs:number|null, retrievedAt:number}|null}
 *          null when the headers are absent (older gateway, proxy that strips
 *          them) — callers must treat null as "no information", not as "zero".
 */
function parseRateLimitHeaders(headers, now = Date.now()) {
  const get = headerGetter(headers);
  const num = (raw) => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const inputTokensRemaining = num(get('anthropic-ratelimit-input-tokens-remaining'));
  const inputTokensLimit     = num(get('anthropic-ratelimit-input-tokens-limit'));
  const requestsRemaining    = num(get('anthropic-ratelimit-requests-remaining'));
  const resetAtMs            = parseResetAtMs(get('anthropic-ratelimit-input-tokens-reset'), now);

  if (inputTokensRemaining === null && inputTokensLimit === null
      && requestsRemaining === null && resetAtMs === null) {
    return null;
  }
  return { inputTokensRemaining, inputTokensLimit, requestsRemaining, resetAtMs, retrievedAt: now };
}

/** Is this a native web_search tool definition? */
function isWebSearchTool(tool) {
  return !!tool && typeof tool.type === 'string' && tool.type.startsWith('web_search');
}

/**
 * Apply `opts.web_search_max_uses` to every web_search tool in the list.
 * The per-call option wins over the tool template's default, because it is the
 * more specific statement of intent. Absent/invalid option → list untouched, so
 * callers that spell `max_uses` out on the tool itself are unaffected.
 */
function applyWebSearchMaxUses(tools, maxUses) {
  if (!Array.isArray(tools)) return tools;
  const cap = Number(maxUses);
  if (!Number.isFinite(cap) || cap <= 0) return tools;
  return tools.map(t => (isWebSearchTool(t) ? { ...t, max_uses: Math.floor(cap) } : t));
}

/**
 * Call Claude with a (system, user) pair. Returns parsed response with
 * concatenated text, raw content blocks, tool_use blocks, usage, stop_reason
 * and `rateLimit` (see parseRateLimitHeaders — may be null).
 *
 * @param {Object} opts
 * @param {string} opts.model              e.g. 'claude-sonnet-4-6', 'claude-opus-4-7'
 * @param {string} [opts.system]           system prompt text
 * @param {Array}  opts.messages           [{ role, content }]
 * @param {number} [opts.max_tokens=4096]
 * @param {Array}  [opts.tools]            tool definitions (e.g. web_search)
 * @param {number} [opts.web_search_max_uses]  ceiling on searches per call
 * @param {number} [opts.timeout_ms=240000]    hard timeout for ONE attempt
 * @param {number} [opts.max_total_ms=300000]  ceiling for the whole call incl. retries
 * @param {Object} [opts.thinking]         { type: 'enabled', budget_tokens } for extended thinking
 */

async function callClaude(opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: opts.model,
    max_tokens: opts.max_tokens || 4096,
    messages: opts.messages
  };
  // `system` may be a plain string OR an array of content blocks
  // (used for prompt caching: { type:'text', text, cache_control: { type:'ephemeral' } })
  if (opts.system)   body.system = opts.system;
  if (opts.tools)    body.tools = applyWebSearchMaxUses(opts.tools, opts.web_search_max_uses);
  if (opts.thinking) body.thinking = opts.thinking;

  // Retry on 429 (rate-limit) and 5xx. A wait the API asked for is honoured in
  // full; a wait we invented is kept short. The whole call — attempts plus
  // waiting — is bounded by an absolute deadline so one wedged query can never
  // swallow the caller's entire budget. Failed queries are still reported via
  // SSE and the run continues with what it managed to gather.
  const startedAt = Date.now();
  const attemptTimeoutMs = (Number.isFinite(opts.timeout_ms) && opts.timeout_ms > 0)
    ? opts.timeout_ms : DEFAULT_ATTEMPT_TIMEOUT_MS;
  const maxTotalMs = (Number.isFinite(opts.max_total_ms) && opts.max_total_ms > 0)
    ? opts.max_total_ms : DEFAULT_MAX_TOTAL_MS;
  const deadlineAt = startedAt + maxTotalMs;

  const budgetError = (why) => {
    const spent = Math.round((Date.now() - startedAt) / 1000);
    const e = new Error(
      `Claude API call gave up after ${spent}s (budget ${Math.round(maxTotalMs / 1000)}s): ${why}`
    );
    return e;
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      throw budgetError(lastErr ? lastErr.message : 'no time left for another attempt');
    }

    let resp;
    try {
      resp = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify(body),
        // Per-attempt hard timeout, never longer than the time this call has
        // left overall. Caller can still abort externally.
        signal: AbortSignal.timeout(Math.min(attemptTimeoutMs, remainingMs))
      });
    } catch (netErr) {
      lastErr = netErr;
      if (attempt < MAX_RETRIES) {
        const wait = 2000 * Math.pow(2, attempt);
        if (Date.now() + wait >= deadlineAt) throw budgetError(netErr.message);
        console.warn(`Claude network error (attempt ${attempt + 1}): ${netErr.message}. Retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw netErr;
    }

    if (resp.ok) {
      const data = await resp.json();
      const content = data.content || [];
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      const toolUses = content.filter(b => b.type === 'tool_use');
      const webSearches = content.filter(b => b.type === 'web_search_tool_result' || b.type === 'server_tool_use');

      return {
        text,
        content,
        toolUses,
        webSearches,
        usage: data.usage || {},
        stop_reason: data.stop_reason,
        // Additive field — existing callers ignore it. Lets a caller pace the
        // NEXT call on what the quota actually is instead of a fixed guess.
        rateLimit: parseRateLimitHeaders(resp.headers)
      };
    }

    // Retryable: 429 (rate limit) and 5xx (server errors). 4xx (other) is fatal.
    const isRetryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
    const errBody = await resp.text();
    lastErr = new Error(`Claude API ${resp.status}: ${errBody.slice(0, 800)}`);

    if (!isRetryable || attempt >= MAX_RETRIES) {
      throw lastErr;
    }

    // How long to wait. When Anthropic tells us when its bucket refills we obey
    // that number — clamping it to our own 30s ceiling (the old behaviour) meant
    // retrying while still blocked, which burned every retry and killed the
    // query. Only a wait we computed ourselves is clamped.
    const { waitMs, source } = computeRetryWaitMs({
      resetHeader: resp.headers.get('anthropic-ratelimit-input-tokens-reset'),
      retryAfter:  resp.headers.get('retry-after'),
      attempt
    });

    if (Date.now() + waitMs >= deadlineAt) {
      throw budgetError(`waiting ${Math.round(waitMs / 1000)}s for the rate limit would exceed it — ${lastErr.message}`);
    }

    console.warn(`Claude ${resp.status} (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${Math.round(waitMs / 1000)}s (${source}) before retry.`);
    await sleep(waitMs);
  }
  throw lastErr || new Error('Claude API call failed');
}

/**
 * Scan `text` for every brace/bracket-balanced block, in order of appearance.
 * String- and escape-aware, so braces inside JSON strings never break nesting.
 * A block that never closes is skipped (we advance one char and keep looking),
 * which is what lets a valid answer survive an unbalanced brace in the preamble.
 */
function scanBalancedBlocks(text) {
  const blocks = [];
  let i = 0;
  let starts = 0;
  while (i < text.length && starts < 200) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') { i++; continue; }
    starts++;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) { i++; continue; }   // unterminated — keep scanning inward
    blocks.push({ text: text.slice(i, end + 1), isObject: ch === '{' });
    i = end + 1;
  }
  return blocks;
}

/**
 * Try to extract the first JSON object/array from a model response.
 * Handles fenced ```json``` blocks as well as bare JSON.
 *
 * A2#2 — the previous version used greedy /\{[\s\S]*\}/ plus /\[[\s\S]*\]/ and
 * failed on three separate shapes, one of which happens even when Claude answers
 * perfectly:
 *   1. a truncated answer (max_tokens) → no closing brace → null
 *   2. prose containing a brace + a list → the object match spanned from the
 *      FIRST brace in the prose to the LAST brace of the answer (unparsable),
 *      and the array fallback then returned the inner ARRAY, so callers read
 *      `.topics` / `.queries` off an array and silently got an empty list
 *   3. a polite preamble containing a brace followed by a completely valid
 *      answer → same greedy span → same silent empty list
 * Balanced scanning fixes 2 and 3 at the root; 1 is unrecoverable here and is
 * reported by the callers instead of being swallowed as "success with 0 items".
 *
 * A real object always wins over a bare array: both callers in this project read
 * a named key off a wrapper object, so a stray parsable array in the prose must
 * never be mistaken for the answer.
 */
function extractJson(text) {
  if (!text) return null;
  const candidates = [];

  // Fenced blocks first — an explicit delimiter is the strongest signal.
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    const inner = (m[1] || '').trim();
    if (inner) candidates.push({ text: inner, isObject: inner[0] === '{' });
  }
  for (const b of scanBalancedBlocks(text)) candidates.push(b);

  let firstArray = null;
  for (const c of candidates) {
    let parsed;
    try { parsed = JSON.parse(c.text); } catch (_) { continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    if (!Array.isArray(parsed)) return parsed;
    if (!firstArray) firstArray = parsed;
  }
  return firstArray;
}

// ── Pricing (USD per 1M tokens, rough est. — refreshable) ───────────
// Used by cost-tracker for transparent display only.
const PRICING = {
  'claude-sonnet-4-6': { input: 3,  output: 15 },
  'claude-opus-4-7':   { input: 15, output: 75 }
};

function estimateCost(model, usage) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const inTok  = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  return (inTok / 1e6) * p.input + (outTok / 1e6) * p.output;
}

module.exports = {
  callClaude,
  extractJson,
  estimateCost,
  // Pure helpers — exported so admin/test can pin the retry/pacing arithmetic
  // without touching the network.
  computeRetryWaitMs,
  parseRateLimitHeaders,
  applyWebSearchMaxUses,
  LIMITS: {
    MAX_RETRIES,
    MAX_WAIT_MS_PER_RETRY,
    MAX_HEADER_WAIT_MS,
    DEFAULT_ATTEMPT_TIMEOUT_MS,
    DEFAULT_MAX_TOTAL_MS
  },
  NATIVE_WEB_SEARCH,
  MODELS: {
    SONNET: 'claude-sonnet-4-6',
    OPUS:   'claude-opus-4-7'
  }
};

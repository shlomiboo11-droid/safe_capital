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
  name: 'web_search'
};

/**
 * Call Claude with a (system, user) pair. Returns parsed response with
 * concatenated text, raw content blocks, tool_use blocks, usage and stop_reason.
 *
 * @param {Object} opts
 * @param {string} opts.model              e.g. 'claude-sonnet-4-6', 'claude-opus-4-7'
 * @param {string} [opts.system]           system prompt text
 * @param {Array}  opts.messages           [{ role, content }]
 * @param {number} [opts.max_tokens=4096]
 * @param {Array}  [opts.tools]            tool definitions (e.g. web_search)
 * @param {number} [opts.web_search_max_uses]
 * @param {Object} [opts.thinking]         { type: 'enabled', budget_tokens } for extended thinking
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  if (opts.tools)    body.tools = opts.tools;
  if (opts.thinking) body.thinking = opts.thinking;

  // Retry on 429 (rate-limit) and 5xx with bounded exponential backoff.
  // We cap total time per call so a wedged rate-limit doesn't stall the run
  // for tens of minutes — failed queries are still reported via SSE and the
  // run can continue with what it managed to gather.
  const MAX_RETRIES = 3;
  const MAX_WAIT_MS_PER_RETRY = 30_000;
  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        // 4 minute hard timeout per call — caller can still abort externally.
        signal: AbortSignal.timeout(240_000)
      });
    } catch (netErr) {
      lastErr = netErr;
      if (attempt < MAX_RETRIES) {
        const wait = 2000 * Math.pow(2, attempt);
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
        stop_reason: data.stop_reason
      };
    }

    // Retryable: 429 (rate limit) and 5xx (server errors). 4xx (other) is fatal.
    const isRetryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
    const errBody = await resp.text();
    lastErr = new Error(`Claude API ${resp.status}: ${errBody.slice(0, 800)}`);

    if (!isRetryable || attempt >= MAX_RETRIES) {
      throw lastErr;
    }

    // Compute backoff. For 429, prefer the explicit reset header if present.
    let waitMs;
    const resetHeader =
      resp.headers.get('anthropic-ratelimit-input-tokens-reset')
      || resp.headers.get('retry-after');
    if (resetHeader) {
      // The reset header may be either an ISO timestamp or seconds-to-wait.
      const asNum = Number(resetHeader);
      if (!Number.isNaN(asNum)) {
        waitMs = Math.max(1000, asNum * 1000);
      } else {
        const resetAt = Date.parse(resetHeader);
        if (!Number.isNaN(resetAt)) {
          waitMs = Math.max(1000, resetAt - Date.now() + 500);
        }
      }
    }
    if (!waitMs) waitMs = Math.min(MAX_WAIT_MS_PER_RETRY, 5_000 * Math.pow(2, attempt));
    waitMs = Math.min(waitMs, MAX_WAIT_MS_PER_RETRY);

    console.warn(`Claude ${resp.status} (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${Math.round(waitMs / 1000)}s before retry.`);
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
  NATIVE_WEB_SEARCH,
  MODELS: {
    SONNET: 'claude-sonnet-4-6',
    OPUS:   'claude-opus-4-7'
  }
};

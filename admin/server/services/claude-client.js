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
 * Try to extract the first JSON object/array from a model response.
 * Handles fenced ```json``` blocks as well as bare JSON.
 */
function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  const obj = text.match(/\{[\s\S]*\}/);
  const arr = text.match(/\[[\s\S]*\]/);
  if (obj) candidates.push(obj[0]);
  if (arr) candidates.push(arr[0]);
  for (const c of candidates) {
    try { return JSON.parse(c); } catch (_) { /* try next */ }
  }
  return null;
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

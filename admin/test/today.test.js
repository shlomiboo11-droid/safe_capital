/**
 * Guards the fix for the "2025 in a 2026 prompt" bug.
 *
 * A research query generated in July 2026 asked for forecasts about 2025 — a
 * year that had already ended. Cause: five of the six prompt builders shipped
 * no date at all, so the model dated its output from its training cutoff. The
 * web_search that followed then went hunting for year-old news, and the post
 * that reached the investor group would have been built on it.
 *
 * Two things have to keep holding, and each is easy to break by accident:
 *   1. the date is read at call time, not frozen when the module loads
 *   2. every prompt that reasons about "now" still carries it
 *
 * Run: cd admin && npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { todayLine, todayBlock } = require('../server/services/whatsapp/today');

const WA = path.join(__dirname, '..', 'server', 'services', 'whatsapp');
const read = f => fs.readFileSync(path.join(WA, f), 'utf8');

// ── The date itself ──────────────────────────────────────────────────

test('todayLine reflects the date it is given', () => {
  const line = todayLine(new Date(2026, 6, 27));   // month is 0-based
  assert.match(line, /27/);
  assert.match(line, /יולי/);
  assert.match(line, /2026/);
});

test('todayBlock states the year as the present and forbids dead-year forecasts', () => {
  const block = todayBlock(new Date(2026, 6, 27));
  assert.match(block, /השנה הנוכחית היא 2026/);
  assert.match(block, /שנה שכבר הסתיימה/);
  // One date sentence, not two — an earlier version double-printed the prefix.
  assert.strictEqual((block.match(/תאריך היום/g) || []).length, 1);
});

test('the clock is read per call, not captured at module load', () => {
  // The module has already been required above. If it had frozen the date at
  // load time, these two would be equal.
  const a = todayLine(new Date(2026, 0, 15));
  const b = todayLine(new Date(2031, 0, 15));
  assert.notStrictEqual(a, b);
  assert.match(a, /2026/);
  assert.match(b, /2031/);
});

test('no argument falls back to the real clock', () => {
  assert.match(todayLine(), new RegExp(String(new Date().getFullYear())));
});

// ── Every prompt still carries it ────────────────────────────────────
//
// Source-level on purpose: requiring the providers would pull in the database
// pool, and this has to run with no Postgres and no API key.

const DATE_TOKEN = /todayBlock\(\)|todayLine\(\)|\$\{todayStr\}/;

/** Slice out one function body by name, brace-counting from its opening line. */
function functionBody(src, header) {
  const start = src.indexOf(header);
  assert.notStrictEqual(start, -1, `not found in source: ${header}`);
  let depth = 0, i = src.indexOf('{', start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(from, i + 1);
  }
  assert.fail(`unbalanced braces after: ${header}`);
}

const PROMPT_SITES = [
  ['claude-research-provider.js', 'function buildProposeQueriesPrompt', 'הצעת שאילתות מחקר'],
  ['claude-research-provider.js', 'function buildResearchSystemPrompt', 'ביצוע החיפוש'],
  ['claude-research-provider.js', 'function buildSummarizeSystemPrompt', 'סיכום המחקר'],
  ['claude-research-provider.js', 'async function discoverTopics', 'גילוי נושאים'],
  ['writing-service.js', 'function buildContextUserPrompt', 'כתיבת הפוסט'],
];

for (const [file, header, label] of PROMPT_SITES) {
  test(`prompt carries the current date — ${label}`, () => {
    const body = functionBody(read(file), header);
    assert.match(body, DATE_TOKEN,
      `${label} builds a prompt with no date. The model will date its answer ` +
      `from its training cutoff — that is the 2025-in-2026 bug. Add todayBlock() ` +
      `for prompts that drive a web search, todayLine() otherwise.`);
  });
}

test('buildProposeQueriesPrompt covers BOTH branches', () => {
  // It returns from two places: auto-picked topic and manual topic. The first
  // fix landed on one branch only and the other kept shipping undated prompts.
  const body = functionBody(read('claude-research-provider.js'), 'function buildProposeQueriesPrompt');
  const hits = (body.match(/todayBlock\(\)|todayLine\(\)/g) || []).length;
  assert.ok(hits >= 2, `expected a date in both return branches, found ${hits}`);
});

test('there is exactly one source of truth for "now"', () => {
  // A second local toLocaleDateString is how this drifted the first time.
  for (const f of ['claude-research-provider.js', 'writing-service.js']) {
    const src = read(f).replace(/^.*\bnew Date\(.*(created|updated|expiry|token).*$/gim, '');
    assert.doesNotMatch(src, /toLocaleDateString\(['"]he-IL/,
      `${f} formats its own date. Use ./today.js instead so all prompts agree.`);
  }
});

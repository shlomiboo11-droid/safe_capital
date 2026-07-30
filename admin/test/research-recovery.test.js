/**
 * Guards the rescue paths for a research run that stopped before it finished.
 *
 * Background: a killed run leaves paid-for findings in the database, no summary,
 * and no trace anywhere on screen that three of eight queries never ran. Three
 * production sessions (~$1.73) sat like that. The three things below have to
 * keep holding:
 *
 *   1. the "what never ran" calculation stays client-side and honest
 *   2. POST /research/start keeps its exact old behaviour without only_missing
 *   3. the browser still listens for budget_exhausted
 *
 * No database and no API key: everything here is either a pure function or a
 * source-level assertion.
 *
 * Run: cd admin && npm test
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CLIENT = path.join(__dirname, '..', 'public', 'js', 'whatsapp-updates');
const SERVER = path.join(__dirname, '..', 'server');
const readClient = f => fs.readFileSync(path.join(CLIENT, f), 'utf8');

// ── 1. missingQueries — the honest gap between asked and answered ─────

const stateModule = import(pathToFileURL(path.join(CLIENT, 'state.js')).href);

function makeState(queries, findings) {
  return { session: { proposed_queries: queries }, findings };
}

test('missingQueries reports the queries that produced no finding', async () => {
  const { missingQueries } = await stateModule;
  const state = makeState(
    [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
    [{ query: 'a' }, { query: 'c' }]
  );
  assert.deepStrictEqual(missingQueries(state).map(q => q.text), ['b']);
});

test('missingQueries ignores queries the user unchecked', async () => {
  const { missingQueries } = await stateModule;
  // 'b' never ran, but the user disabled it — it was never meant to run, so
  // saying "1 query did not run" about it would be a false alarm.
  const state = makeState(
    [{ text: 'a' }, { text: 'b', enabled: false }],
    [{ query: 'a' }]
  );
  assert.deepStrictEqual(missingQueries(state), []);
});

test('missingQueries returns nothing when every query answered', async () => {
  const { missingQueries } = await stateModule;
  const state = makeState([{ text: 'a' }, { text: 'b' }], [{ query: 'b' }, { query: 'a' }]);
  assert.deepStrictEqual(missingQueries(state), []);
});

test('missingQueries survives a session with no queries or no findings', async () => {
  const { missingQueries } = await stateModule;
  // These shapes really occur: a fresh session (no proposed_queries at all) and
  // a run that died before the first finding landed. Throwing here would take
  // the whole research panel down with it.
  assert.deepStrictEqual(missingQueries({ session: {}, findings: [] }), []);
  assert.deepStrictEqual(missingQueries({ session: null, findings: [] }), []);
  assert.deepStrictEqual(
    missingQueries(makeState([{ text: 'a' }], [])).map(q => q.text),
    ['a']
  );
});

test('a finding with no query text does not silence its own query', async () => {
  const { missingQueries } = await stateModule;
  // Older rows can carry a null query. Treating null as "matches everything"
  // would hide every gap — the failure mode this whole line exists to prevent.
  const state = makeState([{ text: 'a' }], [{ query: null }]);
  assert.deepStrictEqual(missingQueries(state).map(q => q.text), ['a']);
});

// ── 2. The server routes ─────────────────────────────────────────────

const routeSrc = fs.readFileSync(path.join(SERVER, 'routes', 'whatsapp.js'), 'utf8');

/** Slice out one route handler by its path literal, brace-counting. */
function routeBody(src, marker) {
  const start = src.indexOf(marker);
  assert.notStrictEqual(start, -1, `route not found in source: ${marker}`);
  let depth = 0, i = src.indexOf('{', start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(from, i + 1);
  }
  assert.fail(`unbalanced braces after: ${marker}`);
}

test('the summarize-existing route exists and runs no query', () => {
  const body = routeBody(routeSrc, `'/sessions/:id/research/summarize'`);
  assert.match(body, /summarizeResearch\(session\)/,
    'the rescue route must call summarizeResearch on the findings already stored');
  // Strip comments first: the route explains itself by NAMING runResearchAsync,
  // and matching on the bare word would fail on prose while still missing a real
  // call written as `researchProvider . executeResearch`.
  const code = body.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\bexecuteResearch\s*\(|\brunResearchAsync\s*\(/,
    'the whole point of this route is that it does NOT re-run (and re-pay for) queries');
});

test('summarize-existing refuses to run over a live run, a later stage, or an existing summary', () => {
  const body = routeBody(routeSrc, `'/sessions/:id/research/summarize'`);
  // Each of these three guards protects something the user cannot get back:
  // a run in flight, a post already being written, a hand-edited summary.
  assert.match(body, /status === 'researching'[\s\S]*?409/,
    'must 409 while the session is still researching');
  assert.match(body, /'writing', 'done', 'archived'[\s\S]*?409/,
    'must 409 once the session moved past research — summarizeResearch resets the status');
  assert.match(body, /research_summary[\s\S]*?409/,
    'must 409 when a summary already exists — a second one overwrites hand edits');
  assert.match(body, /COUNT\(\*\)[\s\S]*?whatsapp_research_findings[\s\S]*?400/,
    'must 400 when there is nothing to summarize');
});

test('summarize-existing takes the run lock while it works', () => {
  const body = routeBody(routeSrc, `'/sessions/:id/research/summarize'`);
  // For the ~40s this call takes, the status stays 'research_review', so the
  // status guard in /research/start would happily let a second tab launch a full
  // run on top of it. Same lock, same reason runResearchAsync holds it across
  // summarize rather than only across the query loop.
  assert.match(body, /runningSessions\.add\(/, 'must claim the lock before summarizing');
  assert.match(body, /finally\s*\{[\s\S]*?runningSessions\.delete\(/,
    'must release it in a finally — a thrown summarize would otherwise lock the ' +
    'session out of research for as long as the process lives');
});

test('only_missing changes nothing unless it is explicitly true', () => {
  const body = routeBody(routeSrc, `'/sessions/:id/research/start'`);
  assert.match(body, /req\.body\s*&&\s*req\.body\.only_missing === true/,
    'the filter must be gated on an explicit true — a truthy body must not narrow ' +
    'the query list, or a normal start silently runs fewer queries than the user chose');
  assert.match(body, /SELECT DISTINCT query FROM whatsapp_research_findings/,
    'missing = enabled queries with no finding row');
  assert.match(body, /'No enabled queries to run'/,
    'the pre-existing empty-selection guard must stay, and stay ahead of the filter');
  // The old guard has to run BEFORE the new filter, otherwise a session with
  // nothing enabled answers the new error instead of the old one.
  assert.ok(
    body.indexOf(`'No enabled queries to run'`) < body.indexOf('only_missing === true'),
    'the original empty-selection check must still come first'
  );
});

// ── 3. The browser still hears the event ─────────────────────────────

test('budget_exhausted is registered on the SSE client', () => {
  // The bus publishes by name; an event missing from this list is dropped
  // without a trace — exactly how `pacing` and `stopped` were lost before.
  assert.match(readClient('sse-client.js'), /'budget_exhausted'/);
});

test('budget_exhausted is reported through the notice bubble, not an alert', () => {
  const src = readClient('index.js');
  const start = src.indexOf('budget_exhausted:');
  assert.notStrictEqual(start, -1, 'no budget_exhausted handler in index.js');
  const body = src.slice(start, start + 1200);
  assert.match(body, /Store\.setError\(/, 'must go through the shared notice bubble');
  assert.doesNotMatch(body.slice(0, body.indexOf('},')), /\balert\(/,
    'a partial result is not a collapse — it must not pop a dialog');
});

test('the failed-query counter is reset per run, not per page load', () => {
  const src = readClient('index.js');
  assert.match(src, /function resetFailedQueries\(\)/);
  // Two call sites are the fix: attachStreamFor covers a fresh stream, and the
  // status transition covers a run that started while an old stream was still
  // open — the case that produced "13 failed" on a session with 8 queries.
  const calls = (src.match(/resetFailedQueries\(\)/g) || []).length;
  assert.ok(calls >= 3, `expected the declaration plus at least two call sites, found ${calls}`);
  assert.match(src, /status === 'researching'\)\s*resetFailedQueries\(\)/,
    'the reset must also hang off the transition into researching');
});

// ── 4. The live finding event speaks the same key ────────────────────

const providerSrc = fs.readFileSync(
  path.join(SERVER, 'services', 'whatsapp', 'claude-research-provider.js'), 'utf8');

test("the live `finding` event carries the query text missingQueries matches on", () => {
  const start = providerSrc.indexOf(`sseBus.publish(session.id, 'finding'`);
  assert.notStrictEqual(start, -1, "no 'finding' publish in the research provider");
  const payload = providerSrc.slice(start, providerSrc.indexOf('});', start));
  assert.match(payload, /\bquery:\s*q\.text\b/,
    'a finding arriving over SSE is kept in the browser exactly as sent. Without the ' +
    'query text, missingQueries() reads every query as never-run and a fully ' +
    'successful run announces "8 of 8 queries did not run"');
});

test('missingQueries agrees on both finding shapes — live SSE payload and DB row', async () => {
  const { missingQueries } = await stateModule;
  const queries = [{ text: 'a' }, { text: 'b' }];
  // Shape 1 — the row GET /sessions/:id returns (SELECT *).
  assert.deepStrictEqual(missingQueries(makeState(queries, [{ query: 'a' }, { query: 'b' }])), []);
  // Shape 2 — what the browser holds during and right after a live run.
  const sse = [
    { finding_id: 11, query_id: 'q1', query: 'a', source_url: null, source_name: null, hebrew_note: '…' },
    { finding_id: 12, query_id: 'q2', query: 'b', source_url: null, source_name: null, hebrew_note: '…' }
  ];
  assert.deepStrictEqual(missingQueries(makeState(queries, sse)), [],
    'a run where everything succeeded must report nothing missing');
});

/**
 * Claude-based research provider for WhatsApp Updates.
 *
 *   proposeQueries  → suggests 5–8 research questions from the topic brief.
 *   executeResearch → runs each accepted query against the Anthropic native
 *                     web_search tool, streaming findings + token usage via SSE.
 *   summarize       → composes a Hebrew research summary from findings.
 *
 * Models:
 *   Normal depth → Sonnet 4.6
 *   Deep depth   → Opus 4.7 + extended thinking
 *
 * Output language: Hebrew (search may be in he or en).
 */

const pool = require('../../db');
const { callClaude, extractJson, estimateCost, NATIVE_WEB_SEARCH, MODELS } = require('../claude-client');
const { getBusinessSystemBlocks, loadBusinessContext } = require('./business-context-loader');
const sseBus = require('./sse-bus');
const { locateSelection, spliceAt } = require('./selection-splice');
const { todayLine, todayBlock } = require('./today');
const {
  readRunBudgetMs,
  estimateQueryMs,
  estimateNextInputTokens,
  shouldStopForBudget,
  decidePacing,
  BUDGET
} = require('./research-budget');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Prompts ─────────────────────────────────────────────────────────

// COMPANY_CONTEXT is the **short** summary embedded inline in user-facing
// prompts. The full business-context.md is loaded separately as a cached
// system block so the model always has the deep context too.
const COMPANY_CONTEXT = `Safe Capital היא חברת fix-and-flip ישראלית שפועלת בבירמינגהאם, אלבמה. המשקיעים שלה ישראלים, מינימום השקעה $50K, יעד תשואה ~20% שנתי, מבנה LLC, תקופת אחזקה 3-12 חודשים. המשקיעים מקבלים עדכונים בקבוצת וואטסאפ סגורה. (ההקשר העסקי המלא נמצא ב-system prompt למעלה — השתמש בו לזיהוי שכונות, סוגי דילים, ועלויות.)`;

function buildProposeQueriesPrompt(topic, autoTopic, focusNotes) {
  const focusBlock = (focusNotes && focusNotes.trim())
    ? `

# התמקדויות שהמשתמש ביקש (חובה לכלול בשאילתות)
"""
${focusNotes.trim()}
"""

כל שאילתה צריכה להתחבר לפחות לאחת מהנקודות האלה, או לתת ערך משלים שעוזר לבסס אותן.`
    : '';

  // CRITICAL: `text` is what the user SEES — it must always be in Hebrew.
  // `lang` only tells the executor which language to use when actually
  // performing the web_search (the executor will translate the Hebrew text
  // into English search terms when lang='en').
  const queryFormatExplanation =
`לכל שאילתה:
- id: מזהה קצר (q1, q2, ...)
- **text: ניסוח השאילתה בעברית בלבד, גם אם החיפוש יבוצע באנגלית** — זה מה שהמשתמש רואה. ניסוח ברור, ספציפי, קצר.
- lang: 'he' או 'en' — באיזו שפה לחפש בפועל (תרגום פנימי לאנגלית במידת הצורך). למאקרו אמריקאי בחר 'en'; לישראל בחר 'he'.
- rationale: שורה אחת בעברית — מה זה בודק

⚠️ **חובה**: השדה text חייב להיות בעברית בלבד. אסור לשלוח טקסט באנגלית בשדה text.`;

  if (autoTopic) {
    return `אתה עוזר לצוות Safe Capital לבחור נושא לפוסט וואטסאפ למשקיעים.

# הקשר
${COMPANY_CONTEXT}

# המשימה
1. בחר נושא ספציפי מהשבוע-שבועיים האחרונים שמעניין משקיע ישראלי בנדל"ן אמריקאי.
2. תן לסשן **כותרת קצרה** בעברית (2-4 מילים) שמתארת את הנושא שבחרת.
3. הצע 5-8 **שאילתות מחקר**:

${queryFormatExplanation}
${focusBlock}

# פלט
${todayBlock()}

JSON בלבד (ללא markdown, ללא טקסט נוסף):
{
  "title": "כותרת קצרה בעברית (2-4 מילים)",
  "queries": [
    { "id": "q1", "text": "ניסוח השאילתה בעברית", "lang": "en", "rationale": "..." }
  ]
}`;
  }

  return `אתה עוזר לצוות Safe Capital לחקור נושא לפוסט וואטסאפ למשקיעים.

# הקשר
${COMPANY_CONTEXT}

# הנושא שהמשתמש מבקש לחקור
"""
${topic}
"""
${focusBlock}

# המשימה
1. תן לסשן **כותרת קצרה** בעברית (2-4 מילים) שתופסת את לב הנושא.
2. פרק את הנושא ל-5-8 **שאילתות מחקר ספציפיות** שיניבו מידע איכותי ב-web search. תכסה:
   - נתון ראשוני / מספרי (מקור מוסמך)
   - הקשר היסטורי או מגמה
   - דעה חולקת או נתון סותר (אם רלוונטי)
   - זווית רלוונטית למשקיע ישראלי

${queryFormatExplanation}

# פלט
${todayBlock()}

JSON בלבד (ללא markdown, ללא טקסט נוסף):
{
  "title": "כותרת קצרה בעברית (2-4 מילים)",
  "queries": [
    { "id": "q1", "text": "ניסוח השאילתה בעברית", "lang": "en", "rationale": "..." }
  ]
}`;
}

function buildResearchSystemPrompt() {
  return `אתה חוקר כלכלי-עיתונאי של Safe Capital — חברת fix-and-flip בבירמינגהאם, אלבמה. אתה מבצע מחקר עומק לטובת פוסט וואטסאפ למשקיעים.

# מתודה
1. השתמש ב-web_search לאמת נתונים ממקור ראשוני (Fed, BLS, Census, NAR, BoI, למ"ס, Bloomberg, WSJ, Reuters, al.com, bizjournals, Globes, TheMarker, Calcalist).
2. הצלב לפחות 2 מקורות.
3. אם יש דעה חולקת או נתון סותר — הזכר אותה.
4. ציין מספרים מדויקים עם תאריך/תקופה.
5. ציין URL מלא של כל מקור בתוך הטקסט (לא ברשימה נפרדת).

# פלט (חובה)
החזר ממצא בעברית, ישר וקצר (3-6 משפטים). **התחל מיד מהממצא — בלי הקדמות, בלי "להלן…", "הנה…", "כפי שביקשת", "תקציר ממצאים…".**

⚠️ אסור:
- שורות מפרידות (---, ***)
- כותרות markdown מרובות
- קלישאות AI ("במציאות הדינמית", "כידוע")
- שפה תאגידית
- רשימת מקורות בסוף (המקורות מצוטטים בטקסט)

${todayBlock()}`;
}

/**
 * Strip preamble / framing chatter that Claude sometimes adds despite the
 * prompt forbidding it. Defensive belt-and-suspenders.
 */
function cleanFindingText(text) {
  if (!text) return '';
  let s = String(text);
  // Drop preamble lines (Hebrew) that match common framing patterns.
  const preamblePatterns = [
    /^[ \t]*להלן[^.\n]*[:.]\s*\n+/m,
    /^[ \t]*הנה[^.\n]*[:.]\s*\n+/m,
    /^[ \t]*כפי שביקשת[^.\n]*[:.]\s*\n+/m,
    /^[ \t]*תקציר ממצאים[^.\n]*[:.]\s*\n+/m,
    /^[ \t]*להלן הממצא[^.\n]*[:.]\s*\n+/m
  ];
  for (const re of preamblePatterns) s = s.replace(re, '');
  // Strip stand-alone horizontal-rule lines (--- *** ___).
  s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');
  // Collapse 3+ blank lines to 2.
  s = s.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');
  return s.trim();
}

function buildSummarizeSystemPrompt() {
  return `אתה עוזר לצוות Safe Capital לסכם מחקר. הקלט: רשימת ממצאים שכבר נאספו. הפלט: סיכום מחקר בעברית, שיוכל לשמש כבסיס לפוסט וואטסאפ למשקיעים.

# כללים
- **כותרת קצרה** (שורה אחת).
- **3-6 פסקאות קצרות** בעברית. כל פסקה = רעיון אחד.
- **מספרים מדויקים** עם תאריכים. ניתן לציין מקור בתוך השוטף ("לפי Bloomberg", "מנתוני בנק ישראל") אבל **בלי URLs ובלי רשימת מקורות בסוף** — המקורות מוצגים בנפרד בפאנל הצדדי.
- **בלי קלישאות AI** ("בעולם של היום", "במציאות הדינמית").
- **בלי המלצות**. רק תיאור עובדתי.

${todayLine()}`;
}

// ── 0. Discover trending topics (auto-topic flow) ───────────────────

/**
 * Search the web for the hottest topics from the past week that are
 * relevant to Safe Capital's investor community. Returns a list of
 * topic candidates the user can pick from.
 *
 * Uses Claude Sonnet 4.6 + native web_search across these umbrellas:
 *   - גיאופוליטיקה
 *   - כלכלה ושוק ההון בישראל
 *   - נדל"ן בישראל
 *   - חדשות עירוניות מבירמינגהאם, אלבמה
 *   - מאקרו אמריקאי שמשפיע על משקיעי נדל"ן זרים
 */
async function discoverTopics(session) {
  const depth = session.research_depth || 'normal';
  const maxUses = depth === 'deep' ? 10 : 6;

  // Single source of truth for "now" — see ./today.js. Was a local
  // toLocaleDateString here, which left the other four prompt builders with no
  // date at all and let the model date its output from its training cutoff.
  const todayStr = todayBlock();

  const systemPrompt = `אתה מסייע לצוות Safe Capital לזהות נושאים חמים מהשבוע האחרון לפוסט וואטסאפ למשקיעים. השתמש בהקשר העסקי המלא שלמעלה (שכונות, סוגי דילים, פרופיל משקיעים) כדי לבחור נושאים שבאמת רלוונטיים אלינו.

# הקהל
${COMPANY_CONTEXT}

# מתודה
1. השתמש ב-web_search כדי לאסוף 5-8 נושאים שהיו על השולחן בשבוע-שבועיים האחרונים. תכסה:
   - **גיאופוליטיקה** (מלחמות, סנקציות, ארה"ב-איראן, ארה"ב-סין, ישראל)
   - **כלכלה ושוק ההון בישראל** (ריבית בנק ישראל, שקל-דולר, אינפלציה, ביצועי תל-אביב 35)
   - **נדל"ן בישראל** (יזמות, רגולציה, אכלוס מחיר למשתכן)
   - **בירמינגהאם, אלבמה** (פיתוח עירוני, תעסוקה, פרויקטים חדשים, שכונות מתפתחות)
   - **מאקרו אמריקאי** (Fed, אינפלציה, שוק הדיור, ביצועי S&P)
2. כל נושא חייב להיות **ספציפי וקונקרטי** (לא "כלכלה" אלא "ירידת שכר הדולר ב-X% מאז ינואר 2026").
3. ודא שהנושא **רלוונטי לקבוצה** של משקיעי נדל"ן ישראלים בארה"ב — שיש לו זווית כספית/אסטרטגית/מעשית.
4. שלב נושאים מ-2-3 קטגוריות שונות כדי לתת לי מבחר.

${todayStr}

# פלט
JSON בלבד (ללא markdown, ללא טקסט נוסף).
{
  "topics": [
    {
      "id": "t1",
      "title": "כותרת קצרה (3-7 מילים)",
      "description": "הסבר קצר של 1-2 משפטים — מה קרה ולמה זה מעניין למשקיע ישראלי בנדל\\"ן אמריקאי",
      "category": "אחת מ: geopolitics, israel_economy, israel_real_estate, birmingham, us_macro"
    },
    ...
  ]
}`;

  const userPrompt = `מצא 5-8 נושאים חמים מהשבוע האחרון בקטגוריות שצוינו. החזר JSON.`;

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 4096,
    system: getBusinessSystemBlocks(systemPrompt),
    tools: [{ ...NATIVE_WEB_SEARCH, max_uses: maxUses }],
    messages: [{ role: 'user', content: userPrompt }]
  });

  // A2#2 — a truncated answer can't be parsed and used to come back as an empty
  // list that looked like "success". Surfaced to the route so it can say why.
  const truncated = resp.stop_reason === 'max_tokens';
  if (truncated) {
    console.warn(`[whatsapp] discoverTopics: Claude stopped at max_tokens (session ${session.id}) — answer may be cut off.`);
  }

  const parsed = extractJson(resp.text);
  const rawTopics = (parsed && Array.isArray(parsed.topics)) ? parsed.topics : [];

  const capped = rawTopics.slice(0, 10);
  const topics = capped.map((t, i) => ({
    id: t.id || ('t' + (i + 1)),
    title: String(t.title || '').trim().slice(0, 120),
    description: String(t.description || '').trim().slice(0, 400),
    category: String(t.category || 'other').trim()
  })).filter(t => t.title && t.description);

  // A2#12 — a topic that came back without a title or description is dropped on
  // purpose (a card with no text is broken), but it used to vanish without a
  // trace, so "4 cards instead of 6" was indistinguishable from "only 4 found".
  if (capped.length > topics.length) {
    console.warn(`[whatsapp] discoverTopics: dropped ${capped.length - topics.length} of ${capped.length} topics (missing title/description), ${topics.length} shown.`);
  }

  const cost = estimateCost(MODELS.SONNET, resp.usage);
  return { topics, usage: resp.usage, cost, truncated };
}

// ── 1. Propose queries ──────────────────────────────────────────────

async function proposeQueries(session) {
  const isAuto = !session.topic_brief;
  const prompt = buildProposeQueriesPrompt(
    session.topic_brief || '',
    isAuto,
    session.focus_notes || ''
  );

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 2048,
    system: getBusinessSystemBlocks(COMPANY_CONTEXT),
    messages: [{ role: 'user', content: prompt }]
  });

  // A2#2 — same dead-screen mechanism as discoverTopics: this step used to
  // return "success" with an empty query list and the chat showed nothing.
  const truncated = resp.stop_reason === 'max_tokens';
  if (truncated) {
    console.warn(`[whatsapp] proposeQueries: Claude stopped at max_tokens (session ${session.id}) — answer may be cut off.`);
  }

  const parsed = extractJson(resp.text);
  const rawQueries = (parsed && Array.isArray(parsed.queries)) ? parsed.queries : [];

  const queries = rawQueries.slice(0, 10).map((q, i) => ({
    id: q.id || ('q' + (i + 1)),
    text: String(q.text || '').trim(),
    lang: (q.lang === 'he' || q.lang === 'en') ? q.lang : 'en',
    rationale: String(q.rationale || '').trim(),
    enabled: true
  })).filter(q => q.text);

  // Short Hebrew title — falls back to a date stamp if Claude didn't return one.
  let title = parsed && typeof parsed.title === 'string' ? parsed.title.trim() : '';
  if (title.length > 60) title = title.slice(0, 60);

  const cost = estimateCost(MODELS.SONNET, resp.usage);
  return {
    title,
    queries,
    usage: resp.usage,
    cost,
    truncated
  };
}

// ── 2. Execute research ─────────────────────────────────────────────

/**
 * Run all enabled queries via Claude + native web_search.
 * Streams events via SSE: query_started, finding, tokens, query_done, error.
 * Persists each finding to whatsapp_research_findings.
 *
 * Returns total cost + findings count.
 */
// Concurrency lock — one research run per session to avoid duplicate runs
// competing for the same rate-limit quota.
const activeRuns = new Set();

async function executeResearch(session, queries, depthOverride) {
  if (activeRuns.has(session.id)) {
    console.warn(`Research already running for session ${session.id}; skipping.`);
    return { totalTokens: 0, totalCost: 0, totalFindings: 0, skipped: true };
  }
  activeRuns.add(session.id);

  try {
    return await executeResearchInner(session, queries, depthOverride);
  } finally {
    activeRuns.delete(session.id);
  }
}

async function executeResearchInner(session, queries, depthOverride) {
  const depth = depthOverride || session.research_depth || 'normal';
  const model = depth === 'deep' ? MODELS.OPUS : MODELS.SONNET;
  // Tight bounds keep per-call input tokens low so we stay under Anthropic's
  // 30K input-tokens-per-minute org limit. Deliberately below the shared
  // NATIVE_WEB_SEARCH default of 5: a research run fires 5-8 of these calls
  // back to back, so the per-call ceiling has to be tighter than what a
  // one-off call (topic discovery, a verify) can afford.
  const maxUses = depth === 'deep' ? 4 : 2;

  // Pacing floor: ~30K input-tokens-per-minute means roughly 1 query every
  // 25-35s is the safe ceiling once you account for web_search results piling
  // in. This stays the fallback — when the API reports the real remaining
  // quota (see decidePacing) that measurement wins over this guess.
  const GAP_MS_BETWEEN_QUERIES = depth === 'deep' ? 35_000 : 25_000;

  // ── Run budget ────────────────────────────────────────────────────
  // The loop now measures itself. Before each query it asks whether the query
  // still fits alongside the summary reserve; if not it stops on purpose and
  // lets the caller summarize what was gathered, instead of running until
  // something outside kills it and leaves the findings stranded.
  const runStartedAt = Date.now();
  const budgetMs  = readRunBudgetMs();
  const reserveMs = BUDGET.DEFAULT_SUMMARY_RESERVE_MS;
  // Seed estimate for one query, until a real measurement replaces it.
  // Measured: a healthy 8-query normal run spends ~35s per query end-to-end;
  // deep adds Opus + 2K thinking tokens + twice the searches. Seeds are padded
  // above the measurement so the first budget check errs toward stopping.
  const SEED_QUERY_MS = depth === 'deep' ? 90_000 : 60_000;
  // Absolute ceiling for one query's call, retries and rate-limit waits
  // included. Without it a single wedged query could burn ~1,050s — more than
  // the whole run budget. 3x the seed leaves room for one honoured rate-limit
  // wait plus a slow web search, and nothing beyond that.
  const PER_QUERY_MAX_MS = SEED_QUERY_MS * 3;

  const enabled = queries.filter(q => q.enabled !== false);
  let totalTokens = 0;
  let totalCost   = 0;
  let totalFindings = 0;
  let qIndex = 0;
  let maxObservedQueryMs = 0;
  let lastRateLimit = null;      // from the previous successful call, may be null
  let lastInputTokens = 0;
  let stopReason = null;         // 'time' | 'rate_limit' when we stopped early

  // The runner checks DB status before each query — if /research/stop ran or
  // the session was archived, exit cleanly.
  async function shouldAbort() {
    const r = await pool.query(`SELECT status FROM whatsapp_sessions WHERE id = $1`, [session.id]);
    return r.rows.length === 0 || r.rows[0].status !== 'researching';
  }

  for (const q of enabled) {
    qIndex++;
    if (await shouldAbort()) {
      sseBus.publish(session.id, 'stopped', { reason: 'status_changed' });
      break;
    }

    // How long we would wait before this query: the fixed gap normally, or the
    // real reset time when the API told us the remaining quota is too small.
    const pacing = qIndex > 1
      ? decidePacing({
          rateLimit: lastRateLimit,
          estimatedInputTokens: estimateNextInputTokens(lastInputTokens),
          defaultGapMs: GAP_MS_BETWEEN_QUERIES
        })
      : { waitMs: 0, waitingFor: 'gap' };

    // Does wait + query + the summary reserve still fit in the budget?
    const nextSlotMs = pacing.waitMs + estimateQueryMs(SEED_QUERY_MS, maxObservedQueryMs);
    if (shouldStopForBudget({
      elapsedMs: Date.now() - runStartedAt,
      budgetMs,
      reserveMs,
      nextSlotMs
    })) {
      // queries_done counts the loop iterations that finished (successfully or
      // not) — this one never started.
      stopReason = pacing.waitingFor === 'rate_limit' ? 'rate_limit' : 'time';
      console.warn(`[whatsapp] research stopped early (${stopReason}) for session ${session.id}: ${qIndex - 1}/${enabled.length} queries in ${Math.round((Date.now() - runStartedAt) / 1000)}s.`);
      sseBus.publish(session.id, 'budget_exhausted', {
        reason: stopReason,
        queries_done: qIndex - 1,
        queries_total: enabled.length
      });
      break;
    }

    if (pacing.waitMs > 0) {
      sseBus.publish(session.id, 'pacing', {
        gap_ms: pacing.waitMs,
        next_query_index: qIndex,
        of: enabled.length,
        waiting_for: pacing.waitingFor
      });
      await sleep(pacing.waitMs);
    }
    if (await shouldAbort()) {
      sseBus.publish(session.id, 'stopped', { reason: 'status_changed' });
      break;
    }
    sseBus.publish(session.id, 'query_started', { query_id: q.id, text: q.text });

    try {
      // The ceiling is stated once, via web_search_max_uses on the call below.
      const tools = [NATIVE_WEB_SEARCH];

      const focusBlock = (session.focus_notes && session.focus_notes.trim())
        ? `\n\nהמשתמש ביקש להתמקד גם ב:\n"""\n${session.focus_notes.trim()}\n"""\nאם יש זווית מהממצא שלך שעוזרת לבסס את ההתמקדויות האלה — הדגש אותה.`
        : '';

      // The query text is always in Hebrew (for the user's UI). If the
      // preferred search language is English, the model should translate the
      // intent into accurate English search terms BEFORE invoking web_search.
      const langInstruction = q.lang === 'en'
        ? `**שפת החיפוש: אנגלית.** ה-text של השאילתה הוא בעברית להבנת הכוונה — תרגם את הכוונה למונחי חיפוש מדויקים באנגלית לפני שאתה קורא ל-web_search.`
        : `**שפת החיפוש: עברית.** בצע web_search על השאילתה כפי שהיא.`;

      const userPrompt = `שאלת המחקר: "${q.text}"

${langInstruction}${focusBlock}

הצלב לפחות 2 מקורות, ותחזיר ממצא בעברית עם מקורות מצוטטים (URLs מלאים).`;

      // Never let one query outlive its share of the run: whichever is smaller,
      // the per-query ceiling or the time actually left after the summary
      // reserve. The floor keeps a degenerate value (a nearly spent budget)
      // from asking for a call with no time at all.
      const timeLeftForQueryMs = Math.max(
        30_000,
        Math.min(PER_QUERY_MAX_MS, budgetMs - (Date.now() - runStartedAt) - reserveMs)
      );

      const callOpts = {
        model,
        // Smaller output budgets to keep total tokens-per-minute within the
        // 30K Anthropic org limit. Quality of findings stays good because
        // the system prompt is concise and we only need 1-2 paragraphs back.
        max_tokens: depth === 'deep' ? 3000 : 1800,
        system: getBusinessSystemBlocks(buildResearchSystemPrompt()),
        tools,
        web_search_max_uses: maxUses,
        max_total_ms: timeLeftForQueryMs,
        messages: [{ role: 'user', content: userPrompt }]
      };
      if (depth === 'deep') {
        callOpts.thinking = { type: 'enabled', budget_tokens: 2000 };
      }

      const queryStartedAt = Date.now();
      const resp = await callClaude(callOpts);
      // Measured cost of a real query, used by the next budget check. Includes
      // the retries and rate-limit waits that happened inside callClaude —
      // which is the point: those are what make a query expensive.
      maxObservedQueryMs = Math.max(maxObservedQueryMs, Date.now() - queryStartedAt);
      // Quota as of this response. null when the headers are missing, and
      // decidePacing then falls back to the fixed gap — same as before.
      lastRateLimit = resp.rateLimit || null;

      // Extract source URLs from the response text (best-effort regex pass)
      // and from any web_search_tool_result blocks in the content.
      const sourceUrls = extractSources(resp);
      const hebrewNote = cleanFindingText(resp.text);

      // ONE finding per query (was: one per URL, which produced N identical
      // copy-paste rows — the same hebrew_note repeated for each cited URL).
      // The primary source URL is stored on the row; other URLs remain
      // cited inline within hebrew_note for the model + the user to see.
      const primaryUrl = sourceUrls[0] || null;
      const extraSources = sourceUrls.slice(1, 6);   // keep up to 5 extras
      const ins = await pool.query(
        `INSERT INTO whatsapp_research_findings
           (session_id, query, query_lang, source_url, source_name, raw_excerpt, hebrew_note, provider, relevance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, source_url, source_name`,
        [
          session.id,
          q.text,
          q.lang,
          primaryUrl,
          primaryUrl ? hostnameOf(primaryUrl) : null,
          // raw_excerpt now holds the list of extra source URLs (JSON-encoded)
          // so the UI / future code can render them as a "more sources" chip.
          extraSources.length ? JSON.stringify(extraSources) : null,
          hebrewNote.slice(0, 8000),
          'anthropic_web',
          null
        ]
      );
      totalFindings++;
      sseBus.publish(session.id, 'finding', {
        finding_id: ins.rows[0].id,
        query_id: q.id,
        // The query TEXT, not just its id: the browser keeps live findings in
        // memory exactly as they arrive here, and missingQueries() (state.js)
        // decides "which query never ran" by matching this field against
        // proposed_queries[].text — the same key the DB row is written with
        // above. Without it every finding from a live run looks query-less and
        // a fully successful run reports "8 of 8 queries never ran".
        query: q.text,
        source_url: ins.rows[0].source_url,
        source_name: ins.rows[0].source_name,
        extra_sources: extraSources,
        hebrew_note: hebrewNote.slice(0, 2000)
      });

      const inTok  = (resp.usage.input_tokens || 0) + (resp.usage.cache_read_input_tokens || 0);
      const outTok = resp.usage.output_tokens || 0;
      // What the NEXT query is likely to charge against the input-token quota.
      // Counts cache reads and cache writes as well as fresh input — the
      // deliberately conservative reading. Over-estimating costs at most one
      // extra wait-for-reset (<=90s); under-estimating costs a 429 and up to
      // three honoured retries, which is far more expensive. If the pacer ever
      // looks too eager, the knob to turn is dropping cache_read from here.
      lastInputTokens = inTok + (resp.usage.cache_creation_input_tokens || 0);
      const queryTokens = inTok + outTok;
      const queryCost   = estimateCost(model, resp.usage);
      totalTokens += queryTokens;
      totalCost   += queryCost;

      // Incremental DB update — so the polling fallback (which reads
      // tokens_used / estimated_cost_usd straight from the DB) sees the same
      // numbers SSE is broadcasting. Without this, setSession from polling
      // would overwrite the live SSE values with stale 0 every 15s.
      await pool.query(
        `UPDATE whatsapp_sessions
           SET tokens_used = COALESCE(tokens_used, 0) + $1,
               estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
               updated_at = NOW()
         WHERE id = $3`,
        [queryTokens, queryCost, session.id]
      );

      sseBus.publish(session.id, 'tokens', {
        used: totalTokens,
        cost_usd: Number(totalCost.toFixed(4))
      });
      sseBus.publish(session.id, 'query_done', { query_id: q.id });
    } catch (err) {
      console.error('Query failed:', q.text, err.message);
      // The quota snapshot we were holding belongs to a call that is now old
      // news. Drop it rather than pace the next query on stale numbers — with
      // null, decidePacing falls back to the fixed gap.
      lastRateLimit = null;
      // Fatal errors that affect the whole account, not just this query — stop
      // the whole run so the user gets an immediate, actionable message.
      const fatalPatterns = [
        /credit balance is too low/i,
        /invalid x-api-key/i,
        /authentication_error/i,
        /api_key/i
      ];
      const isFatal = fatalPatterns.some(re => re.test(err.message));
      sseBus.publish(session.id, 'error', {
        message: err.message,
        query_id: q.id,
        recoverable: !isFatal
      });
      if (isFatal) {
        // Mark the session as research_review so the UI exits the spinner state.
        try {
          await pool.query(
            `UPDATE whatsapp_sessions SET status = 'research_review', updated_at = NOW() WHERE id = $1`,
            [session.id]
          );
        } catch (_) { /* best-effort */ }
        break;
      }
    }
  }

  // NOTE: totals are NOT persisted here. The per-query UPDATE inside the loop
  // above already added each query's tokens/cost to the session row, and
  // totalTokens/totalCost are just the running sum of those same deltas —
  // adding them again stored exactly 2x the real cost. The in-loop update must
  // stay (it keeps the 15s polling fallback from overwriting the live SSE
  // numbers with a stale 0) and it also survives a mid-run stop or fatal error.
  //
  // Returning normally after an early stop is the whole point: the caller goes
  // straight on to summarizeResearch, so a run that ran out of budget still
  // produces a summary of what it did gather instead of nothing.
  return {
    totalTokens,
    totalCost,
    totalFindings,
    stoppedEarly: stopReason !== null,
    stopReason,
    queriesDone: qIndex - (stopReason === null ? 0 : 1),
    queriesTotal: enabled.length
  };
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return null; }
}

function extractSources(resp) {
  const urls = new Set();
  // 1. From web_search tool_result blocks
  for (const block of resp.content || []) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.url) urls.add(r.url);
      }
    }
  }
  // 2. From the text response (URLs the model cited)
  const m = (resp.text || '').match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
  for (const u of m) urls.add(u.replace(/[.,)\]]+$/, ''));
  return Array.from(urls).slice(0, 8);
}

// ── 3. Summarize ────────────────────────────────────────────────────

async function summarizeResearch(session) {
  const findings = await pool.query(
    `SELECT query, source_url, source_name, hebrew_note
     FROM whatsapp_research_findings
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [session.id]
  );

  if (findings.rows.length === 0) {
    // A1#1 ≡ A3#1 — this early return used to skip BOTH writes at the bottom of
    // this function, so a zero-findings run left the row on 'researching' with
    // no research_summary. The message only ever reached the browser over SSE;
    // the 15s poll (or any refresh) read the DB back and put the spinner up
    // again, forever. Persist the same two fields the normal path persists —
    // no cost is added because no model call was made on this branch.
    const emptySummary = 'לא נמצאו ממצאים. נסה לבחור שאילתות אחרות או להעמיק את החיפוש.';
    await pool.query(
      `UPDATE whatsapp_sessions
          SET research_summary = $1,
              status = 'research_review',
              updated_at = NOW()
        WHERE id = $2`,
      [emptySummary, session.id]
    );
    return { summary: emptySummary, usage: {}, cost: 0 };
  }

  const findingsBlock = findings.rows.map((f, i) => {
    return `### ממצא ${i + 1}\nשאלה: ${f.query}\nמקור: ${f.source_url || '(לא צויין)'}\nתוכן:\n${f.hebrew_note || ''}`;
  }).join('\n\n');

  const userPrompt = `הנה ממצאי המחקר. סכם אותם בעברית כפי שהוגדר במערכת.

הנושא: ${session.topic_brief || '(לא צוין — בחירת הסוכן)'}

ממצאים:
${findingsBlock}`;

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 4000,
    system: getBusinessSystemBlocks(buildSummarizeSystemPrompt()),
    messages: [{ role: 'user', content: userPrompt }]
  });

  const cost = estimateCost(MODELS.SONNET, resp.usage);

  // Save draft
  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, content, tokens_used)
     VALUES ($1, 'research_summary', $2, $3)
     RETURNING id`,
    [
      session.id,
      resp.text,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  // Save to session.research_summary for quick access
  await pool.query(
    `UPDATE whatsapp_sessions
       SET research_summary = $1,
           status = 'research_review',
           estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
           updated_at = NOW()
     WHERE id = $3`,
    [resp.text, cost, session.id]
  );

  return {
    summary: resp.text,
    draft_id: ins.rows[0].id,
    usage: resp.usage,
    cost
  };
}

// ── 4. Revise a selected portion of the summary (Phase 3) ───────────

const REVISE_ACTIONS = {
  verify:        'אמת מחקרית את הקטע — בדוק במקורות אם הנתונים נכונים, תקן אם יש טעות. אם הכל תקין השאר. אם דרוש חיפוש — השתמש ב-web_search.',
  rephrase:      'נסח את הקטע מחדש — אותה משמעות, ניסוח טבעי יותר ובהיר. אל תוסיף מידע חדש.',
  expand:        'הרחב את הקטע — הוסף הקשר, נתון תומך, או דוגמה. אל תמציא נתונים.',
  shorten:       'קצר את הקטע למחצית האורך תוך שמירה על כל הנתונים החשובים.',
  delete:        'מחק את הקטע. החזר מחרוזת ריקה.',
  explain:       'הסבר את הקטע — מה הוא אומר, ולמה הוא חשוב.',
  freeform:      ''  // user's free-text instruction is used directly
};

/**
 * Revise a specific portion of the research summary in place.
 *
 * @param {Object} session
 * @param {Object} args
 * @param {string} args.selection_text  — exact text the user selected
 * @param {string} args.action          — one of REVISE_ACTIONS keys
 * @param {string} [args.instruction]   — user's free-text instruction
 * @returns {Promise<{ old_text, new_text, full_summary, draft_id, cost }>}
 */
async function reviseSelection(session, args) {
  const fullSummary = session.research_summary || '';
  const selection = (args.selection_text || '').trim();
  if (!selection) throw new Error('selection_text is required');

  // A3#8 / A4#4 — same fix as the post path (writing-service.js): trust the
  // index the client measured, never a blind search. Searching failed every
  // time the selection crossed a `#`/`*` marker, and otherwise hit the first
  // occurrence instead of the marked one.
  const selStart = locateSelection(fullSummary, selection, args.selection_start);
  if (selStart < 0) {
    throw new Error('הקטע שסומן כבר לא תואם לטקסט השמור. רענן את הדף ונסה שוב.');
  }

  const action = args.action || 'freeform';
  const baseInstr = REVISE_ACTIONS[action] ?? '';
  const userInstr = (args.instruction || '').trim();
  const instruction = [baseInstr, userInstr].filter(Boolean).join(' ');

  if (!instruction) throw new Error('No instruction provided');

  // For 'verify' (the only action that may need new sources), enable web_search.
  const tools = action === 'verify' ? [{ ...NATIVE_WEB_SEARCH, max_uses: 3 }] : undefined;

  const system = `אתה עורך שמתקן חלקים בסיכום מחקר עברי. אתה עורך **רק את הקטע שמצוטט**, לא את שאר הטקסט. החזר **רק** את הניסוח החדש של הקטע, ללא הקדמות, ללא markdown, ללא הסברים. אם הוראת המשתמש דורשת מחיקה — החזר מחרוזת ריקה.

# כללי כתיבה
- עברית טבעית, בלי קלישאות AI
- שמור על מספרים מדויקים מהמקור
- אם הוספת מידע חדש — וודא שיש לו בסיס במקורות (web_search אם צריך)`;

  const userPrompt = `הקשר — הסיכום המלא (להתמצאות בלבד, אל תערוך אותו):
"""
${fullSummary}
"""

הקטע שיש לערוך (המופיע בתוך הסיכום לעיל):
"""
${selection}
"""

הוראה: ${instruction}

החזר רק את הניסוח החדש של הקטע, ללא הקדמות, ללא ציטוטים, ללא markdown.`;

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 2048,
    system,
    tools,
    messages: [{ role: 'user', content: userPrompt }]
  });

  // Clean up: remove leading/trailing quotes and code fences if model returned any.
  let newText = (resp.text || '').trim();
  newText = newText.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
  newText = newText.replace(/^["“'״]+|["”'״]+$/g, '').trim();

  // A4#14 — splice at the known index. String.replace would hit the first
  // occurrence and interpret `$&` / `` $` `` inside the model's answer.
  const newFull = spliceAt(fullSummary, selStart, selection.length, newText);

  // Save as a new draft with parent pointing to the most recent research_summary draft.
  const parent = await pool.query(
    `SELECT id FROM whatsapp_drafts
     WHERE session_id = $1 AND kind = 'research_summary'
     ORDER BY created_at DESC LIMIT 1`,
    [session.id]
  );

  const cost = estimateCost(MODELS.SONNET, resp.usage);
  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, content, parent_id, edit_reason, tokens_used)
     VALUES ($1, 'research_summary', $2, $3, $4, $5)
     RETURNING id`,
    [
      session.id,
      newFull,
      parent.rows[0]?.id || null,
      action + (userInstr ? ': ' + userInstr.slice(0, 200) : ''),
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  await pool.query(
    `UPDATE whatsapp_sessions
       SET research_summary = $1,
           estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
           updated_at = NOW()
     WHERE id = $3`,
    [newFull, cost, session.id]
  );

  return {
    old_text: selection,
    new_text: newText,
    full_summary: newFull,
    draft_id: ins.rows[0].id,
    cost
  };
}

/**
 * Overwrite the research summary with manually-edited text from the user.
 * No AI call. Stores a new draft with edit_reason='manual'.
 */
async function manualEditSummary(session, newFull) {
  if (typeof newFull !== 'string') throw new Error('content (string) required');
  const parent = await pool.query(
    `SELECT id FROM whatsapp_drafts
     WHERE session_id = $1 AND kind = 'research_summary'
     ORDER BY created_at DESC LIMIT 1`,
    [session.id]
  );
  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, content, parent_id, edit_reason)
     VALUES ($1, 'research_summary', $2, $3, 'manual')
     RETURNING id`,
    [session.id, newFull, parent.rows[0]?.id || null]
  );
  await pool.query(
    `UPDATE whatsapp_sessions SET research_summary = $1, updated_at = NOW() WHERE id = $2`,
    [newFull, session.id]
  );
  return { draft_id: ins.rows[0].id, full_summary: newFull };
}

module.exports = {
  discoverTopics,
  proposeQueries,
  executeResearch,
  summarizeResearch,
  reviseSelection,
  manualEditSummary
};

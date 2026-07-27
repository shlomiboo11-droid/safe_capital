/**
 * Writing service — Phase 4.
 *
 * Generates and edits WhatsApp posts in Hebrew using Claude Opus 4.7 with the
 * voice-guide.md system prompt (prompt-cached for ~90% token discount).
 *
 *   generatePost(session, length)
 *   generateAlternatives(session, length, count)
 *   applyQuickAction(session, draftId, action)
 *   reviseSelection(session, draftId, args)
 *   manualEditPost(session, content)
 *   finalize(session, draftId)
 *
 * All drafts are persisted in `whatsapp_drafts` with kind='post' or 'alternative'
 * and parent_id linking to the previous version (history chain for undo).
 */

const pool = require('../../db');
const { callClaude, estimateCost, NATIVE_WEB_SEARCH, MODELS } = require('../claude-client');
const { getCachedSystemBlocks } = require('./voice-guide-loader');
const { locateSelection, spliceAt } = require('./selection-splice');
const { todayLine } = require('./today');

// ── Length targets ──────────────────────────────────────────────────

const LENGTH_TARGETS = {
  short:  { min: 70,  max: 110, label: 'קצר (30 שניות, ~70-100 מילים)' },
  medium: { min: 140, max: 210, label: 'בינוני (60 שניות, ~150-200 מילים)' },
  long:   { min: 220, max: 320, label: 'ארוך (90 שניות, ~230-300 מילים)' }
};

const UPDATE_TYPE_LABELS = {
  progress:    'עדכון פרוגרס על דיל ספציפי',
  new_deal:    'חשיפת דיל חדש',
  exit:        'דיל שנסגר (Exit)',
  macro:       'עדכון שוק / מאקרו',
  educational: 'חינוכי / מקצועי',
  event:       'אירוע / פגישה / כנס',
  holiday:     'חגים / ברכות',
  memorial:    'יום זיכרון / רגעי כובד',
  other:       'אחר'
};

// ── final_post sync ─────────────────────────────────────────────────

/**
 * A4#11 — "שמור כסופי" MARKS, it does not lock (product decision, 26.07.2026).
 * Every edit path therefore has to carry the final version along with it, or
 * the archived copy keeps text the user already replaced: drive-sync.js exports
 * `session.final_post`, not the newest draft.
 *
 * This used to be an inline block in manualEditPost only, which is why the
 * other edit paths (quick action, selection revise, alternative) silently left
 * `final_post` behind.
 *
 * FIVE call sites, and that is the complete list — verified by grepping every
 * `INSERT INTO whatsapp_drafts` in the server: the only ones that write
 * kind='post'/'alternative' are generatePost, generateAlternative,
 * applyQuickAction, reviseSelection and manualEditPost, all in this file.
 * (claude-research-provider.js also inserts drafts, but only kind =
 * 'research_summary', which never becomes the post.) finalizePost writes
 * `final_post` itself. Any new path that produces post text must call this too.
 *
 * The condition is deliberately unchanged from the original inline version:
 * `status === 'done'` covers the normal finalized session, and `final_post`
 * covers a session that was finalized and then moved on. Before finalizing,
 * both are falsy and nothing is written.
 */
async function syncFinalPost(session, content) {
  if (!(session.status === 'done' || session.final_post)) return;
  await pool.query(
    `UPDATE whatsapp_sessions SET final_post = $1, updated_at = NOW() WHERE id = $2`,
    [content, session.id]
  );
}

// ── Builders ────────────────────────────────────────────────────────

function buildContextUserPrompt(session, lengthKey, mode) {
  const length = LENGTH_TARGETS[lengthKey] || LENGTH_TARGETS.medium;
  const summary = session.research_summary || '(אין סיכום מחקר זמין — כתוב על בסיס הקשר כללי)';

  const formalityLabel =
    session.formality === 'casual_warm' ? 'חם וקליל' :
    session.formality === 'professional_dry' ? 'מקצועי-יבש' :
    'מקצועי-חם';

  // Editorial direction — the user's POV / spin on top of the cold research.
  // This is what turns "generic news rewrite" into "Safe Capital's take".
  const angle    = (session.editorial_angle    || '').trim();
  const points   = (session.editorial_points   || '').trim();
  const takeaway = (session.editorial_takeaway || '').trim();

  let editorialBlock = '';
  if (angle || points || takeaway) {
    editorialBlock = `

# כיוון עריכתי (חובה לפעול לפיו — זה ה-POV של Safe Capital)`;
    if (angle) {
      editorialBlock += `\n\n## הזווית / השאלה המרכזית של הפוסט\n${angle}`;
    }
    if (points) {
      editorialBlock += `\n\n## נקודות שחובה לכלול ולפתח בפוסט\n${points}`;
    }
    if (takeaway) {
      editorialBlock += `\n\n## המסר / המסקנה שהמשקיעים צריכים לקחת איתם\n${takeaway}`;
    }
    editorialBlock += `\n\n**אל תהפוך את הפוסט לסיכום ניטרלי של החדשות.** הוא חייב להתמקם בנקודת המבט של Safe Capital כפי שהוגדרה לעיל — להיות רלוונטי, נוקט עמדה, ומחבר את המידע למה שמשנה למשקיעים שלנו.`;
  } else {
    editorialBlock = `\n\n# כיוון עריכתי
המשתמש לא ציין זווית ספציפית. בחר זווית רלוונטית למשקיעי Safe Capital — מה זה אומר עליהם, איך זה משפיע על דילים בבירמינגהאם, מה היתרון או הסיכון הספציפי. **אל תכתוב סיכום ניטרלי של החדשות.**`;
  }

  const head = mode === 'alternative'
    ? 'כתוב גרסה נוספת, **שונה במבנה ובפתיחה** מהקודמת, של פוסט וואטסאפ — אבל באותה הזווית העריכתית.'
    : 'כתוב טיוטה ראשונה של פוסט וואטסאפ למשקיעי Safe Capital.';

  return `${head}

# הגדרות הפוסט
- **אורך**: ${length.label}
- **רמת רשמיות**: ${formalityLabel}
${editorialBlock}

# סיכום המחקר (מקור עובדתי בלעדי — אסור להמציא מספרים נוספים)
"""
${summary}
"""

# הוראה
${todayLine()}

בהתבסס על הכיוון העריכתי שלמעלה ועל ה-Hard rules של ה-voice guide, כתוב את הפוסט. הטון, האמוג׳ים והאנרגיה צריכים להיגזר מהקונטקסט של הזווית והמסר (פוסט שואל-פרובוקטיבי דורש hook חזק; פוסט רגיש דורש שקט; וכו׳).

החזר **רק את הפוסט** בעברית, מוכן להעתקה לוואטסאפ. ללא הקדמות, ללא הסברים, ללא markdown.`;
}

// ── 1. Generate first draft ─────────────────────────────────────────

async function generatePost(session, lengthKey) {
  if (!LENGTH_TARGETS[lengthKey]) lengthKey = session.length_pref || 'medium';

  const resp = await callClaude({
    model: MODELS.OPUS,
    max_tokens: 2000,
    system: getCachedSystemBlocks('אתה כותב פוסטים לקבוצת הוואטסאפ של משקיעי Safe Capital. עכשיו תכתוב פוסט חדש על-פי המפרט שמופיע בהודעת המשתמש.'),
    messages: [{ role: 'user', content: buildContextUserPrompt(session, lengthKey, 'generate') }]
  });

  const content = (resp.text || '').trim();
  const wordCount = countWords(content);
  const cost = estimateCost(MODELS.OPUS, resp.usage);

  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, length_pref, content, edit_reason, tokens_used)
     VALUES ($1, 'post', $2, $3, 'initial', $4)
     RETURNING id, created_at`,
    [
      session.id,
      lengthKey,
      content,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  await pool.query(
    `UPDATE whatsapp_sessions
       SET length_pref = $1,
           estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
           tokens_used = COALESCE(tokens_used, 0) + $3,
           updated_at = NOW()
     WHERE id = $4`,
    [
      lengthKey,
      cost,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0),
      session.id
    ]
  );

  // A4#11 — the fifth path, and the least obvious one. "ערוך הגדרות וכתוב
  // מחדש" (writing-view.js) and the length switcher both POST to
  // /sessions/:id/write, which lands here — with no status gate, so it is
  // reachable on a session that is already 'done'. The screen and the draft
  // list then hold the new text while `final_post` still held the replaced
  // one, and drive-sync.js archives `final_post`. Same condition as the other
  // four call sites: before finalizing, this writes nothing.
  await syncFinalPost(session, content);

  return {
    draft_id: ins.rows[0].id,
    content,
    word_count: wordCount,
    length_pref: lengthKey,
    target_range: LENGTH_TARGETS[lengthKey],
    cost
  };
}

// ── 2. Alternative versions ─────────────────────────────────────────

async function generateAlternative(session, lengthKey) {
  if (!LENGTH_TARGETS[lengthKey]) lengthKey = session.length_pref || 'medium';

  // Read up to 2 prior drafts so the model knows what NOT to repeat.
  const prior = await pool.query(
    `SELECT content FROM whatsapp_drafts
     WHERE session_id = $1 AND kind IN ('post', 'alternative')
     ORDER BY created_at DESC LIMIT 2`,
    [session.id]
  );
  const priorBlock = prior.rows.length
    ? '\n\n# גרסאות קודמות — אל תחזור עליהן\n' + prior.rows.map((r, i) => `## גרסה ${i + 1}\n${r.content}`).join('\n\n')
    : '';

  const basePrompt = buildContextUserPrompt(session, lengthKey, 'alternative');
  const resp = await callClaude({
    model: MODELS.OPUS,
    max_tokens: 2000,
    system: getCachedSystemBlocks('אתה כותב גרסה אלטרנטיבית לפוסט וואטסאפ — שונה במבנה, בפתיחה ובסגירה מהגרסאות הקיימות.'),
    messages: [{ role: 'user', content: basePrompt + priorBlock }]
  });

  const content = (resp.text || '').trim();
  const cost = estimateCost(MODELS.OPUS, resp.usage);

  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, length_pref, content, edit_reason, tokens_used)
     VALUES ($1, 'alternative', $2, $3, 'alternative', $4)
     RETURNING id`,
    [
      session.id,
      lengthKey,
      content,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  await pool.query(
    `UPDATE whatsapp_sessions
       SET estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $1,
           tokens_used = COALESCE(tokens_used, 0) + $2,
           updated_at = NOW()
     WHERE id = $3`,
    [
      cost,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0),
      session.id
    ]
  );

  // A4#11 — an alternative generated after "שמור כסופי" becomes the post on
  // screen, so the archived copy has to move with it.
  await syncFinalPost(session, content);

  return {
    draft_id: ins.rows[0].id,
    content,
    word_count: countWords(content),
    length_pref: lengthKey,
    cost
  };
}

// ── 3. Quick actions on an existing draft ───────────────────────────

const QUICK_ACTION_INSTRUCTIONS = {
  shorten_30:        'קצר את הפוסט ב-30% ושמור על המסר המרכזי. הסר משפטים שאינם הכרחיים.',
  add_cta:           'הוסף שורת CTA קצרה ומדויקת בסוף — בקש פעולה ספציפית מהקורא (למשל "שלחו לי הודעה", "תרשמו לקבוצה הסגורה", "תישארו מעודכנים").',
  add_emoji:         'הוסף 2-3 אמוג׳ים נוספים, אך **רק בסוף שורות**, רק במקומות שמתאימים רגשית. אל תהפוך לדקורטיבי.',
  remove_emoji:      'הסר את כל האמוג׳ים מהפוסט. שמור על שאר הטקסט.',
  strengthen_open:   'חזק את הפתיחה — הפוך אותה לפרובוקטיבית או חדה יותר. שמור על האורך.',
  strengthen_close:  'חזק את הסגירה — הוסף טוויסט, שאלה רטורית, או CTA חזק. שמור על האורך.'
};

async function applyQuickAction(session, draftId, action) {
  const instruction = QUICK_ACTION_INSTRUCTIONS[action];
  if (!instruction) throw new Error('Unknown quick action: ' + action);

  const cur = await pool.query(
    `SELECT id, content, length_pref FROM whatsapp_drafts WHERE id = $1 AND session_id = $2`,
    [draftId, session.id]
  );
  if (cur.rows.length === 0) throw new Error('Draft not found');
  const draft = cur.rows[0];

  const userPrompt = `הפוסט הנוכחי:
"""
${draft.content}
"""

הוראה: ${instruction}

החזר **רק** את הפוסט המעודכן בעברית, ללא הסברים, ללא markdown.`;

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 2000,
    system: getCachedSystemBlocks('אתה עורך פוסטים. תיקון נקודתי לפוסט קיים, על-פי ההוראה.'),
    messages: [{ role: 'user', content: userPrompt }]
  });

  const content = (resp.text || '').trim();
  const cost = estimateCost(MODELS.SONNET, resp.usage);

  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, length_pref, content, parent_id, edit_reason, tokens_used)
     VALUES ($1, 'post', $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      session.id,
      draft.length_pref,
      content,
      draft.id,
      'quick:' + action,
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  await pool.query(
    `UPDATE whatsapp_sessions
       SET estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $1,
           tokens_used = COALESCE(tokens_used, 0) + $2,
           updated_at = NOW()
     WHERE id = $3`,
    [cost, (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0), session.id]
  );

  // A4#11 — a quick action after "שמור כסופי" replaces the post on screen, so
  // it has to replace the archived copy too.
  await syncFinalPost(session, content);

  return {
    draft_id: ins.rows[0].id,
    content,
    word_count: countWords(content),
    cost
  };
}

// ── 4. Selection-edit on the post (mirrors research reviseSelection) ─

const SELECTION_ACTIONS = {
  verify:    'אמת את הקטע — וודא שהנתונים בו נכונים על-פי המקורות. תקן אם יש טעות, אחרת השאר.',
  rephrase:  'נסח את הקטע מחדש — אותה משמעות, ניסוח טבעי יותר, בקול של Safe Capital.',
  expand:    'הרחב מעט את הקטע — הוסף קונטקסט/דוגמה. אל תמציא נתונים.',
  shorten:   'קצר את הקטע למחצית האורך תוך שמירה על המסר.',
  delete:    'מחק את הקטע — החזר מחרוזת ריקה.',
  explain:   'הסבר את הקטע באופן ברור יותר.',
  freeform:  ''
};

async function reviseSelection(session, draftId, args) {
  const cur = await pool.query(
    `SELECT id, content, length_pref FROM whatsapp_drafts WHERE id = $1 AND session_id = $2`,
    [draftId, session.id]
  );
  if (cur.rows.length === 0) throw new Error('Draft not found');
  const draft = cur.rows[0];

  const selection = (args.selection_text || '').trim();
  if (!selection) throw new Error('selection_text is required');

  // A4#3 / A4#4 — locate the selection by the exact index the client measured
  // against this very text, not by searching for it. Searching used to fail
  // outright whenever the selection crossed a `*bold*` marker, and when it did
  // match it hit the FIRST occurrence rather than the one the user marked.
  const selStart = locateSelection(draft.content, selection, args.selection_start);
  if (selStart < 0) {
    throw new Error('הקטע שסומן כבר לא תואם לטקסט השמור. רענן את הדף ונסה שוב.');
  }

  const action = args.action || 'freeform';
  const baseInstr = SELECTION_ACTIONS[action] ?? '';
  const userInstr = (args.instruction || '').trim();
  const instruction = [baseInstr, userInstr].filter(Boolean).join(' ');
  if (!instruction) throw new Error('No instruction provided');

  const tools = action === 'verify' ? [{ ...NATIVE_WEB_SEARCH, max_uses: 3 }] : undefined;

  const userPrompt = `הפוסט המלא:
"""
${draft.content}
"""

הקטע שיש לערוך:
"""
${selection}
"""

הוראה: ${instruction}

החזר **רק** את הניסוח החדש של הקטע, ללא הקדמות, ללא ציטוטים, ללא markdown.`;

  const resp = await callClaude({
    model: MODELS.SONNET,
    max_tokens: 1500,
    system: getCachedSystemBlocks('אתה עורך קטע ספציפי בתוך פוסט וואטסאפ. אל תערוך את שאר הטקסט.'),
    tools,
    messages: [{ role: 'user', content: userPrompt }]
  });

  let newText = (resp.text || '').trim();
  newText = newText.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
  newText = newText.replace(/^["“'״]+|["”'״]+$/g, '').trim();

  // A4#14 — slice+concat, never String.replace: `replace` with a string argument
  // interprets `$&` / `` $` `` in the replacement and would splice half the post
  // back into itself.
  const newFull = spliceAt(draft.content, selStart, selection.length, newText);
  const cost = estimateCost(MODELS.SONNET, resp.usage);

  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, length_pref, content, parent_id, edit_reason, tokens_used)
     VALUES ($1, 'post', $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      session.id,
      draft.length_pref,
      newFull,
      draft.id,
      'selection:' + action + (userInstr ? ': ' + userInstr.slice(0, 200) : ''),
      (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
    ]
  );

  await pool.query(
    `UPDATE whatsapp_sessions
       SET estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $1,
           tokens_used = COALESCE(tokens_used, 0) + $2,
           updated_at = NOW()
     WHERE id = $3`,
    [cost, (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0), session.id]
  );

  // A4#11 — same reason as the quick-action path: the spliced text is what the
  // user now sees, so it must also be what gets archived.
  await syncFinalPost(session, newFull);

  return {
    draft_id: ins.rows[0].id,
    old_text: selection,
    new_text: newText,
    full_content: newFull,
    word_count: countWords(newFull),
    cost
  };
}

// ── 5. Manual edit (no AI) ──────────────────────────────────────────

async function manualEditPost(session, draftId, content) {
  if (typeof content !== 'string') throw new Error('content (string) required');
  const cur = await pool.query(
    `SELECT length_pref FROM whatsapp_drafts WHERE id = $1 AND session_id = $2`,
    [draftId, session.id]
  );
  if (cur.rows.length === 0) throw new Error('Draft not found');

  const ins = await pool.query(
    `INSERT INTO whatsapp_drafts (session_id, kind, length_pref, content, parent_id, edit_reason)
     VALUES ($1, 'post', $2, $3, $4, 'manual')
     RETURNING id`,
    [session.id, cur.rows[0].length_pref, content, draftId]
  );

  await syncFinalPost(session, content);

  return {
    draft_id: ins.rows[0].id,
    content,
    word_count: countWords(content)
  };
}

// ── 6. Finalize ─────────────────────────────────────────────────────

async function finalizePost(session, draftId) {
  const cur = await pool.query(
    `SELECT content FROM whatsapp_drafts WHERE id = $1 AND session_id = $2`,
    [draftId, session.id]
  );
  if (cur.rows.length === 0) throw new Error('Draft not found');

  await pool.query(
    `UPDATE whatsapp_sessions
       SET final_post = $1, status = 'done', updated_at = NOW()
     WHERE id = $2`,
    [cur.rows[0].content, session.id]
  );
  return { final_post: cur.rows[0].content };
}

// ── helpers ─────────────────────────────────────────────────────────

function countWords(text) {
  if (!text) return 0;
  // Hebrew + English word counter: split on whitespace + punctuation
  return text.trim().split(/\s+/).filter(w => /\S/.test(w)).length;
}

module.exports = {
  generatePost,
  generateAlternative,
  applyQuickAction,
  reviseSelection,
  manualEditPost,
  finalizePost,
  LENGTH_TARGETS,
  countWords
};

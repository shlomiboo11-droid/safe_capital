/**
 * leads.js — קליטת ליד מהאתר
 *
 * שלושה טפסים באתר מגיעים לכאן, ולכולם אותה כתובת אחת
 * (‏POST /api/public/leads):
 *
 *   contact-page   · טופס הפנייה בעמוד צור קשר      → kind=contact
 *   join-dialog    · החלון הצף "הרשמה לרשימה"        → kind=waitlist
 *   fitcheck-quiz  · שאלון בדיקת ההתאמה (/quiz)      → kind=waitlist
 *
 * ── למה kind מגיע במפורש ולא נגזר מהשדות ──
 * טופס הפנייה שולח first_name/last_name/email והטפסים של הרשימה שולחים
 * first/last/mail. מפתה לגזור מזה את הסוג — וזה נשבר בשקט ביום ששדה
 * משנה שם. הסוג מגיע כערך משלו ונבדק מול רשימה סגורה; סובלנות לאיות
 * שמור לערכים, לא להחלטות.
 */

const pool = require('../db');

const KINDS = ['contact', 'waitlist'];

/** חלון "לחיצה כפולה". הגשה זהה בתוכו נחשבת לאותה הגשה. */
const DEDUPE_WINDOW_MINUTES = 5;

/** מה שנשמר לכל שדה. מעבר לזה — חתיכה ארוכה חשודה, לא תוכן אמיתי. */
const MAX = { name: 80, email: 254, phone: 40, choice: 120, message: 4000, url: 500 };

function firstOf(body, ...keys) {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function clamp(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/* אותה בדיקה רופפת שרצה בדפדפן (website/assets/forms.js). מכוונת לא
   לפסול כתובת אמיתית — רק שליחת מייל באמת מוכיחה כתובת. */
function looksLikeEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v);
}

/**
 * ממפה גוף בקשה גולמי לשורה. מקבל את שני האיותים של כל שדה, כדי ששלושת
 * הטפסים יוכלו להישאר עם שמות השדות שיש להם היום.
 */
function normalize(body) {
  return {
    kind: firstOf(body, 'kind'),
    first_name: clamp(firstOf(body, 'first_name', 'first', 'firstName'), MAX.name),
    last_name: clamp(firstOf(body, 'last_name', 'last', 'lastName'), MAX.name),
    email: clamp(firstOf(body, 'email', 'mail'), MAX.email),
    phone: clamp(firstOf(body, 'phone', 'tel'), MAX.phone),
    capital: clamp(firstOf(body, 'capital'), MAX.choice),
    liquid: clamp(firstOf(body, 'liquid'), MAX.choice),
    wants_contact: clamp(firstOf(body, 'wants_contact', 'contact'), MAX.choice),
    message: clamp(firstOf(body, 'message', 'note'), MAX.message),
    source: clamp(firstOf(body, 'source'), MAX.choice),
    page_url: clamp(firstOf(body, 'page_url', 'pageUrl'), MAX.url),
    consent: body.consent === true || body.consent === 'true' ||
             body.ok === true || body.ok === 'true' || body.ok === 'on'
  };
}

/** שגיאת קלט — הראוט מתרגם אותה ל-400 ולא ל-500. */
class LeadInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeadInputError';
    this.status = 400;
  }
}

function validate(lead) {
  if (!KINDS.includes(lead.kind)) {
    throw new LeadInputError('kind must be one of: ' + KINDS.join(', '));
  }
  if (!lead.first_name) throw new LeadInputError('חסר שם');
  if (!looksLikeEmail(lead.email)) throw new LeadInputError('כתובת מייל לא תקינה');
}

/* ה-JSONB שנשמר ב-raw. מוציא את מלכודת הספאם ואת השדות שכבר יש להם
   עמודה משלהם — מה שנשאר הוא בדיוק מה שאין לו מקום אחר (תשובות
   השאלון, שדה שנוסף לטופס ועוד לא נוסף לסכימה). */
const RAW_SKIP = new Set(['company', 'consent', 'ok', 'utm', 'page_url', 'pageUrl']);

function buildRaw(body) {
  const raw = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (RAW_SKIP.has(k)) continue;
    if (v === '' || v == null) continue;
    raw[k] = typeof v === 'string' ? v.slice(0, MAX.message) : v;
  }
  return Object.keys(raw).length ? raw : null;
}

function buildUtm(body) {
  const utm = body && body.utm;
  if (!utm || typeof utm !== 'object' || Array.isArray(utm)) return null;
  const out = {};
  for (const [k, v] of Object.entries(utm)) {
    if (typeof v === 'string' && v.trim()) out[k.slice(0, 40)] = v.trim().slice(0, MAX.url);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * מחזיר ליד קיים אם הגיעה עכשיו אותה הגשה בדיוק — אצבע כפולה על
 * "שליחה", או ניסיון חוזר של הדפדפן. בלי זה כל לחיצה כפולה מייצרת
 * שורה שנייה ומייל תודה שני.
 */
async function findRecentDuplicate(kind, email) {
  const { rows } = await pool.query(
    `SELECT id, created_at
       FROM leads
      WHERE kind = $1
        AND lower(email) = lower($2)
        AND created_at > NOW() - ($3 || ' minutes')::interval
      ORDER BY created_at DESC
      LIMIT 1`,
    [kind, email, String(DEDUPE_WINDOW_MINUTES)]
  );
  return rows[0] || null;
}

/**
 * שומר ליד. מחזיר { lead, duplicate } — ‏duplicate=true אומר שלא נוצרה
 * שורה חדשה ושאין להריץ שוב את האוטומציות.
 *
 * ‏meta: { ip, user_agent } מגיעים מהראוט, לא מגוף הבקשה.
 */
async function createLead(body, meta = {}) {
  const lead = normalize(body || {});
  validate(lead);

  const existing = await findRecentDuplicate(lead.kind, lead.email);
  if (existing) return { lead: existing, duplicate: true };

  const { rows } = await pool.query(
    `INSERT INTO leads (
       kind, first_name, last_name, email, phone,
       capital, liquid, wants_contact, message,
       source, page_url, utm, raw, consent, ip, user_agent
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      lead.kind, lead.first_name, lead.last_name, lead.email, lead.phone,
      lead.capital, lead.liquid, lead.wants_contact, lead.message,
      lead.source, lead.page_url,
      buildUtm(body), buildRaw(body),
      lead.consent,
      clamp(meta.ip, 64), clamp(meta.user_agent, MAX.url)
    ]
  );

  return { lead: rows[0], duplicate: false };
}

/** מסמן מה עלה בגורל שתי האוטומציות. לעולם לא זורק. */
async function recordAutomationResult(id, { emailSent, emailError, pushSent }) {
  try {
    await pool.query(
      `UPDATE leads
          SET email_sent_at = COALESCE($2, email_sent_at),
              email_error   = $3,
              push_sent_at  = COALESCE($4, push_sent_at),
              updated_at    = NOW()
        WHERE id = $1`,
      [
        id,
        emailSent ? new Date() : null,
        emailError ? String(emailError).slice(0, 500) : null,
        pushSent ? new Date() : null
      ]
    );
  } catch (err) {
    console.error('[leads] failed to record automation result:', err.message);
  }
}

/** מלכודת ספאם: שדה נסתר שאדם לא רואה ולכן לא ממלא. */
function isHoneypotTripped(body) {
  const v = body && body.company;
  return typeof v === 'string' && v.trim() !== '';
}

module.exports = {
  createLead,
  recordAutomationResult,
  isHoneypotTripped,
  LeadInputError,
  KINDS
};

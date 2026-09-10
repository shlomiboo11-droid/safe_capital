/**
 * push.js — התראות דחיפה לאדמין פאנל
 *
 * מי מקבל: כל מכשיר שנרשם דרך /api/push/subscribe — כלומר מנהל שהתקין
 * את הפאנל על הטלפון ואישר התראות. מנוי אחד לכל דפדפן/מכשיר.
 *
 * ── מפתחות VAPID ──
 * ‏VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT ב-.env, ובאותה
 * מידה במשתני הסביבה של Vercel. בלעדיהם השירות מדווח "לא מוגדר" ולא
 * מפיל שום בקשה — בדיוק כמו services/email.js.
 * החלפת המפתחות מנתקת כל מנוי קיים. לא להחליף.
 *
 * ── ניקוי מנויים מתים ──
 * ‏404/410 מהשרת של הדפדפן = המנוי בוטל (הוסר מסך הבית, נמחקו נתוני
 * האתר). מוחקים את השורה מיד; אחרת הטבלה מתמלאת בכתובות שלעולם לא
 * יענו, וכל שליחה נהיית איטית יותר.
 */

const webpush = require('web-push');
const pool = require('../db');

let _configured = null;

function isConfigured() {
  if (_configured !== null) return _configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('[push] VAPID keys not set — push notifications will be skipped.');
    _configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:safecapital2024@gmail.com',
    pub,
    priv
  );
  _configured = true;
  return true;
}

function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/** שומר מנוי. הרשמה חוזרת מאותו דפדפן מעדכנת שורה קיימת. */
async function saveSubscription(userId, subscription, userAgent) {
  const endpoint = subscription && subscription.endpoint;
  const keys = (subscription && subscription.keys) || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    const err = new Error('subscription must have endpoint and keys.p256dh / keys.auth');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id       = EXCLUDED.user_id,
           p256dh        = EXCLUDED.p256dh,
           auth          = EXCLUDED.auth,
           user_agent    = EXCLUDED.user_agent,
           failure_count = 0,
           last_seen_at  = NOW()
     RETURNING id, created_at`,
    [userId || null, endpoint, keys.p256dh, keys.auth, (userAgent || '').slice(0, 500)]
  );
  return rows[0];
}

async function removeSubscription(endpoint) {
  if (!endpoint) return 0;
  const { rowCount } = await pool.query(
    'DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]
  );
  return rowCount;
}

async function countSubscriptions(userId) {
  const { rows } = await pool.query(
    userId
      ? 'SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1'
      : 'SELECT COUNT(*)::int AS n FROM push_subscriptions',
    userId ? [userId] : []
  );
  return rows[0].n;
}

/** האם המכשיר הזה כבר רשום. */
async function hasSubscription(endpoint) {
  if (!endpoint) return false;
  const { rows } = await pool.query(
    'SELECT 1 FROM push_subscriptions WHERE endpoint = $1 LIMIT 1', [endpoint]
  );
  return rows.length > 0;
}

/**
 * שולח לכל המנויים (או רק לאלה של משתמש מסוים).
 * לעולם לא זורק. מחזיר { sent, failed, removed, skipped? }.
 *
 * ‏payload: { title, body, url, tag }
 */
async function sendToAll(payload, { userId = null } = {}) {
  if (!isConfigured()) return { sent: 0, failed: 0, removed: 0, skipped: true };

  let rows;
  try {
    const res = await pool.query(
      userId
        ? 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1'
        : 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions',
      userId ? [userId] : []
    );
    rows = res.rows;
  } catch (err) {
    console.error('[push] could not read subscriptions:', err.message);
    return { sent: 0, failed: 0, removed: 0, error: err.message };
  }

  if (!rows.length) return { sent: 0, failed: 0, removed: 0, skipped: true, reason: 'no subscriptions' };

  const body = JSON.stringify({
    title: payload.title || 'Safe Capital',
    body: payload.body || '',
    url: payload.url || '/leads',
    tag: payload.tag || 'safe-capital'
  });

  const dead = [];
  const results = await Promise.allSettled(rows.map(row =>
    webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      body,
      { TTL: 60 * 60 * 24 }
    ).catch(err => {
      // 404/410 — המנוי בוטל בצד הדפדפן. כל קוד אחר הוא תקלה חולפת.
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(row.endpoint);
      throw err;
    })
  ));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  if (dead.length) {
    try {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1)', [dead]);
    } catch (err) {
      console.error('[push] failed to prune dead subscriptions:', err.message);
    }
  }

  if (failed) console.warn(`[push] ${sent} sent, ${failed} failed, ${dead.length} pruned`);
  return { sent, failed, removed: dead.length };
}

/**
 * ההתראה על ליד חדש.
 *
 * ── מה לא נכנס לגוף ההודעה ──
 * שם מלא, טלפון ומייל. ההתראה מופיעה על מסך נעול, לעיני מי שמסתכל על
 * הטלפון. מספיק להגיד שהגיע ליד ומאיזה טופס; השאר נמצא בעמוד הלידים.
 */
async function notifyNewLead(lead) {
  const isWaitlist = lead.kind === 'waitlist';
  return sendToAll({
    title: isWaitlist ? 'הרשמה חדשה לרשימת ההמתנה' : 'פנייה חדשה בצור קשר',
    body: isWaitlist ? 'מישהו הצטרף לרשימה' : 'מישהו השאיר פרטים',
    url: '/leads',
    tag: 'lead-' + lead.kind
  });
}

module.exports = {
  isConfigured,
  publicKey,
  saveSubscription,
  removeSubscription,
  countSubscriptions,
  hasSubscription,
  sendToAll,
  notifyNewLead
};

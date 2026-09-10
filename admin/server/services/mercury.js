/**
 * mercury.js — חיבור קריאה-בלבד ל-API של Mercury (הבנק העסקי).
 *
 * ב-Mercury טוקן API הוא ברמת הארגון (Organization), ולסייף קפיטל יש כמה ארגונים,
 * כל אחד עם החשבונות שלו. לכן יש טוקן לכל ארגון, ב-.env בתבנית:
 *
 *   MERCURY_API_TOKEN_HARUV=secret-token:...   → org "haruv"  (element haruv investments llc)
 *   MERCURY_API_TOKEN_EAS=secret-token:...     → org "eas"    (E.A.S ELEMENT INVESTMENTS LLC)
 *
 * הסיומת אחרי MERCURY_API_TOKEN_ היא מפתח הארגון (באותיות קטנות). להוסיף ארגון = להוסיף
 * שורה ב-.env, בלי לגעת בקוד. MERCURY_API_TOKEN בלי סיומת נתמך גם, כארגון "default".
 *
 * כל הטוקנים Read Only. השירות הזה לא מזיז כסף ולא יודע לעשות זאת: אין כאן אף
 * קריאת POST, וגם טוקן Read Only לא היה מאפשר אותה.
 *
 * מוסכמות של Mercury שחשוב לזכור:
 *  - הבסיס: https://api.mercury.com/api/v1, אימות Bearer.
 *  - סכומים בדולרים (לא סנטים). זיכוי חיובי, חיוב שלילי.
 *  - עימוד לפי cursor: page.nextPage הוא ה-ID של הרשומה הבאה, ומועבר כ-start_at.
 *  - לרשימת כל התנועות: /transactions. לחשבון בודד: /account/{id}/transactions (יחיד!).
 */

'use strict';

const BASE_URL = 'https://api.mercury.com/api/v1';
const PAGE_LIMIT = 1000; // המקסימום שהשרת מרשה
const ENV_PREFIX = 'MERCURY_API_TOKEN';

/**
 * רשימת הארגונים שיש להם טוקן ב-.env: [{ key: 'haruv', token: '...' }, ...]
 */
function orgs() {
  const found = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith(ENV_PREFIX)) continue;
    const token = (value || '').trim();
    if (!token) continue;
    const suffix = name.slice(ENV_PREFIX.length).replace(/^_/, '');
    found.push({ key: suffix ? suffix.toLowerCase() : 'default', token });
  }
  return found.sort((a, b) => a.key.localeCompare(b.key));
}

function orgKeys() {
  return orgs().map(o => o.key);
}

function isConfigured() {
  return orgs().length > 0;
}

function tokenFor(orgKey) {
  const org = orgs().find(o => o.key === orgKey);
  if (!org) {
    const known = orgKeys().join(', ') || 'אין';
    throw new Error(`ארגון Mercury לא מוכר: "${orgKey}". ארגונים מוגדרים ב-.env: ${known}`);
  }
  return org.token;
}

/**
 * קריאת GET אחת ל-Mercury עבור ארגון נתון. מחזירה JSON או זורקת שגיאה עם קוד ה-HTTP.
 */
async function get(orgKey, path, params = {}) {
  const token = tokenFor(orgKey);

  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Mercury (${orgKey}) החזיר ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * כל החשבונות של ארגון אחד. כל חשבון מקבל שדה org.
 */
async function getAccounts(orgKey) {
  const data = await get(orgKey, '/accounts', { limit: 100 });
  return (data.accounts || []).map(a => ({ ...a, org: orgKey }));
}

/**
 * תנועות מכל החשבונות של ארגון אחד, עם כל העמודים. מסננים לפי תאריך יצירה
 * (start/end, YYYY-MM-DD), סטטוס (pending/sent/cancelled/failed), חשבון (accountId)
 * וחיפוש חופשי (search). maxPages מגן מפני משיכה אינסופית: 10 עמודים = עד 10,000 תנועות.
 */
async function getTransactions(orgKey, filters = {}, { maxPages = 10 } = {}) {
  const { start, end, status, accountId, search, order = 'desc' } = filters;
  const all = [];
  let cursor;

  for (let page = 0; page < maxPages; page++) {
    const data = await get(orgKey, '/transactions', {
      start, end, status, accountId, search, order,
      limit: PAGE_LIMIT,
      start_at: cursor
    });
    const batch = data.transactions || [];
    all.push(...batch.map(t => ({ ...t, org: orgKey })));

    cursor = data.page && data.page.nextPage;
    if (!cursor || batch.length < PAGE_LIMIT) break;
  }
  return all;
}

/**
 * תנועה בודדת לפי ID, כולל קבצים מצורפים.
 */
async function getTransaction(orgKey, id) {
  const tx = await get(orgKey, `/transactions/${encodeURIComponent(id)}`);
  return { ...tx, org: orgKey };
}

/**
 * מריץ פונקציה על ארגון אחד (אם orgKey נתון) או על כולם, ומאחד את התוצאות לרשימה אחת.
 */
async function acrossOrgs(orgKey, fn) {
  const keys = orgKey ? [orgKey] : orgKeys();
  const results = await Promise.all(keys.map(k => fn(k)));
  return results.flat();
}

/**
 * סיכום תזרים: לכל חודש, כניסות / יציאות / נטו, ולכל חשבון בנפרד (עם הארגון שלו).
 * מבוסס על postedAt (מה שמופיע בדשבורד של Mercury), ואם אין — על createdAt.
 * תנועות שבוטלו או נכשלו לא נספרות.
 */
function summarizeCashflow(transactions) {
  const months = {};
  const accounts = {};

  for (const tx of transactions) {
    if (tx.status === 'cancelled' || tx.status === 'failed') continue;
    const amount = Number(tx.amount) || 0;
    const when = tx.postedAt || tx.createdAt || '';
    const month = when.slice(0, 7); // YYYY-MM
    if (!month) continue;

    const m = months[month] || (months[month] = { month, inflow: 0, outflow: 0, net: 0, count: 0 });
    const a = accounts[tx.accountId] || (accounts[tx.accountId] = {
      accountId: tx.accountId, org: tx.org || null, inflow: 0, outflow: 0, net: 0, count: 0
    });

    for (const bucket of [m, a]) {
      if (amount >= 0) bucket.inflow += amount; else bucket.outflow += -amount;
      bucket.net += amount;
      bucket.count += 1;
    }
  }

  const round = (n) => Math.round(n * 100) / 100;
  const finish = (b) => ({ ...b, inflow: round(b.inflow), outflow: round(b.outflow), net: round(b.net) });

  return {
    months: Object.values(months).sort((x, y) => x.month.localeCompare(y.month)).map(finish),
    accounts: Object.values(accounts).map(finish)
  };
}

module.exports = {
  isConfigured, orgKeys, acrossOrgs,
  getAccounts, getTransactions, getTransaction, summarizeCashflow
};

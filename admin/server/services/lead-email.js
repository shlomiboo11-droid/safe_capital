/**
 * lead-email.js — מייל התודה שיוצא ללקוח אחרי שהוא משאיר פרטים
 *
 * שני נוסחים, תבנית אחת:
 *   waitlist · "אתה ברשימה"        — ההבטחה היא עדכון ראשון על עסקה חדשה
 *   contact  · "הפנייה שלך התקבלה" — ההבטחה היא שיחה חוזרת
 *
 * ── כללי הברזל של מייל HTML ──
 * ‏1. טבלאות, לא flex/grid. אאוטלוק מרנדר במנוע של Word.
 * ‏2. סגנון inline בלבד — רוב הלקוחות מוחקים <style>.
 * ‏3. ‏background-image לא קיים. כל תמונה היא <img> עם alt.
 * ‏4. המייל חייב להיקרא מצוין **בלי תמונות** — זו ברירת המחדל אצל
 *    חלק גדול מהנמענים. לכן שום מידע לא חי רק בתוך תמונה.
 * ‏5. ‏webp לא נתמך באאוטלוק. תמונות הנכסים מסוננות ל-jpg/png בלבד.
 */

const pool = require('../db');
const { sendMail, escapeHtml } = require('./email');

const ADMIN_HOST = (process.env.PUBLIC_ADMIN_URL || 'https://admin.safecapital.co.il')
  .replace(/\/+$/, '');
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://safecapital.co.il')
  .replace(/\/+$/, '');

/* ── פלטה ──────────────────────────────────────────────────────────────
   אותם צבעים של האתר ושל מייל ההרשמה לערב משקיעים. */
const C = {
  navy:    '#022445',
  navyDim: '#1e3a5c',
  wine:    '#984349',
  bone:    '#fbf9f6',
  panel:   '#f5f3f0',
  line:    '#e7e2da',
  ink:     '#1b1c1a',
  muted:   '#43474e',
  white:   '#ffffff'
};

const SANS = "'Heebo','Segoe UI',Arial,sans-serif";
const LATIN = "'Inter','Segoe UI',Arial,sans-serif";

/* ── הנוסחים ───────────────────────────────────────────────────────────
   השלבים ממוספרים כי הם באמת רצף — קודם שיחה, אחר כך עסקה, ורק אז
   החלטה. מספור שלא מתאר סדר אמיתי הוא קישוט, וכאן הוא לא. */
const COPY = {
  waitlist: {
    subject: 'נרשמת לרשימת ההמתנה · Safe Capital',
    preheader: 'קיבלנו את הפרטים שלך. מכאן אתה מקבל את העסקה הבאה לפני כולם.',
    kicker: 'רשימת ההמתנה',
    title: 'אתה ברשימה',
    lede: 'קיבלנו את הפרטים שלך. מהרגע הזה אתה ברשימת ההמתנה שלנו — וזו הרשימה שממנה יוצאת ההודעה הראשונה בכל פעם שנפתחת עסקה חדשה.',
    steps: [
      ['שיחת היכרות', 'נציג שלנו יחזור אליך בימים הקרובים, כדי להבין מה אתה מחפש ולענות על שאלות.'],
      ['העסקה הבאה, לפני כולם', 'כשנפתחת עסקה חדשה, מי שברשימה מקבל אותה ראשון — עם כל המספרים.'],
      ['בלי התחייבות', 'ההצטרפות לרשימה לא מחייבת אותך בכלום. אתה מחליט אם ומתי להיכנס.']
    ],
    showcaseTitle: 'מה שאנחנו עושים בפועל',
    showcaseLede: 'נכסים אמיתיים בבירמינגהם, אלבמה — נקנים, מושבחים ונמכרים.'
  },
  contact: {
    subject: 'קיבלנו את הפנייה שלך · Safe Capital',
    preheader: 'הפרטים שלך הגיעו אלינו. נחזור אליך בהקדם.',
    kicker: 'פנייה חדשה',
    title: 'הפנייה שלך התקבלה',
    lede: 'תודה שפנית אלינו. הפרטים שלך הגיעו, והם מול העיניים — לא במערכת אוטומטית שאף אחד לא פותח.',
    steps: [
      ['נחזור אליך', 'נציג שלנו יתקשר אליך תוך יום עסקים אחד.'],
      ['נבין מה אתה מחפש', 'שיחה קצרה, בלי לחץ — כמה אתה חושב להשקיע, ומה חשוב לך.'],
      ['נראה לך מה פתוח', 'אם זה מתאים, נעבור יחד על העסקאות שפתוחות עכשיו.']
    ],
    showcaseTitle: 'בינתיים, כמה מהנכסים שלנו',
    showcaseLede: 'כל עסקה שלנו היא נכס אחד, ממוקד, בבירמינגהם שבאלבמה.'
  }
};

/* ── תוויות לערכי הבוררים ──────────────────────────────────────────────
   שני הטפסים שולחים ניסוחים שונים לאותו דבר: טופס הפנייה שולח מפתח
   (‏under-50k), טפסי הרשימה שולחים את הטקסט העברי עצמו. הטבלה מתרגמת
   את המפתחות, וכל ערך שאינו מפתח עובר כמו שהוא. */
const VALUE_LABELS = {
  'under-50k': 'עד 50 אלף דולר',
  '50k-100k': '50 עד 100 אלף דולר',
  '100k-250k': '100 עד 250 אלף דולר',
  'over-250k': 'מעל 250 אלף דולר',
  yes: 'כן',
  partial: 'חלקית',
  no: 'לא'
};

function label(v) {
  if (!v) return null;
  return VALUE_LABELS[v] || v;
}

function absolutize(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : ADMIN_HOST + (url.startsWith('/') ? '' : '/') + url;
}

/**
 * עד שלושה נכסים מפורסמים עם תמונה שאפשר להציג במייל.
 * ‏webp נופל בסינון: אאוטלוק לא מרנדר אותו, ותמונה שבורה במייל
 * גרועה מאשר בלי תמונה.
 * לעולם לא זורק — מייל בלי תמונות עדיף על מייל שלא נשלח.
 */
async function fetchShowcaseDeals(limit = 3) {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.city, d.state, d.property_status,
              COALESCE(
                NULLIF(d.thumbnail_url, ''),
                (SELECT i.image_url
                   FROM deal_images i
                  WHERE i.deal_id = d.id
                    AND i.image_url ~* '\\.(jpe?g|png)(\\?|$)'
                  ORDER BY CASE i.category
                             WHEN 'after'     THEN 0
                             WHEN 'rendering' THEN 1
                             WHEN 'thumbnail' THEN 2
                             WHEN 'gallery'   THEN 3
                             ELSE 4
                           END,
                           i.sort_order
                  LIMIT 1)
              ) AS image_url
         FROM deals d
        WHERE d.is_published = true
        ORDER BY d.deal_number DESC NULLS LAST
        LIMIT $1`,
      [limit * 3]
    );

    return rows
      .filter(r => r.image_url && /\.(jpe?g|png)(\?|$)/i.test(r.image_url))
      .slice(0, limit)
      .map(r => ({
        name: r.name,
        place: [r.city, r.state].filter(Boolean).join(', '),
        image: absolutize(r.image_url)
      }));
  } catch (err) {
    console.error('[lead-email] showcase query failed:', err.message);
    return [];
  }
}

/** כמה מפתחות מ-site_settings, עם ערכי גיבוי שנכונים היום. */
async function fetchSettings() {
  const fallback = {
    phone: '054-7828550',
    email_main: 'safecapital2024@gmail.com',
    whatsapp_group: 'https://chat.whatsapp.com/HvYhT4qzIYR1lM24jaNyL0?mode=gi_t',
    copyright_text: '© Safe Capital · כל הזכויות שמורות.'
  };
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM site_settings
        WHERE key IN ('phone_footer','phone','email_main','whatsapp_group','copyright_text')`
    );
    const map = {};
    rows.forEach(r => { if (r.value) map[r.key] = r.value; });
    return {
      phone: map.phone_footer || map.phone || fallback.phone,
      email_main: map.email_main || fallback.email_main,
      whatsapp_group: map.whatsapp_group || fallback.whatsapp_group,
      copyright_text: map.copyright_text || fallback.copyright_text
    };
  } catch (err) {
    console.error('[lead-email] settings query failed:', err.message);
    return fallback;
  }
}

/* ── חלקי התבנית ───────────────────────────────────────────────────── */

/** שורת התצוגה המקדימה — מה שנקרא ברשימת המיילים לפני שפותחים. */
function preheader(text) {
  return `<div style="display:none;font-size:1px;color:${C.bone};line-height:1px;` +
         `max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(text)}` +
         `${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`;
}

function header(copy) {
  return `
  <tr>
    <td style="background-color:${C.navy};padding:34px 34px 30px 34px;text-align:right;">
      <div style="color:${C.white};font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.65;font-family:${LATIN};">Safe Capital</div>
      <div style="height:1px;line-height:1px;font-size:0;">&nbsp;</div>
      <div style="color:${C.white};font-size:28px;font-weight:800;line-height:1.25;margin-top:14px;">${escapeHtml(copy.title)}</div>
      <div style="color:#c9b7b9;font-size:13px;font-weight:600;letter-spacing:.5px;margin-top:8px;">${escapeHtml(copy.kicker)}</div>
    </td>
  </tr>
  <tr><td style="background-color:${C.wine};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>`;
}

function greeting(firstName, copy) {
  return `
  <tr>
    <td style="padding:34px 34px 0 34px;text-align:right;">
      <div style="font-size:21px;font-weight:700;color:${C.navy};">היי ${escapeHtml(firstName)},</div>
      <div style="font-size:16px;line-height:1.75;color:${C.muted};margin-top:12px;">${escapeHtml(copy.lede)}</div>
    </td>
  </tr>`;
}

/* שלב אחד = שורת טבלה. עיגול נייבי עם מספר בצד ימין, טקסט לצידו.
   העיגול הוא תא צבוע עם border-radius — לא תמונה, כדי שהוא ייראה
   גם כשהתמונות חסומות. */
function steps(copy) {
  const rows = copy.steps.map(([title, body], i) => `
    <tr>
      <td width="38" valign="top" style="padding:0 0 18px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="30" height="30" align="center" valign="middle"
              style="background-color:${C.navy};border-radius:15px;color:${C.white};
                     font-family:${LATIN};font-size:13px;font-weight:700;">${i + 1}</td>
        </tr></table>
      </td>
      <td valign="top" style="padding:0 0 18px 0;text-align:right;">
        <div style="font-size:16px;font-weight:700;color:${C.ink};line-height:1.4;">${escapeHtml(title)}</div>
        <div style="font-size:14px;line-height:1.7;color:${C.muted};margin-top:4px;">${escapeHtml(body)}</div>
      </td>
    </tr>`).join('');

  return `
  <tr>
    <td style="padding:30px 34px 6px 34px;text-align:right;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.wine};font-weight:700;font-family:${LATIN};margin-bottom:18px;">מה קורה עכשיו</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td>
  </tr>`;
}

/* תמונת גיבור אחת ברוחב מלא, ומתחתיה עד שתי תמונות בשתי עמודות.
   רוחב מפורש על כל <img> — בלעדיו אאוטלוק מותח לגודל המקורי. */
function showcase(deals, copy) {
  if (!deals.length) return '';

  const hero = deals[0];
  const rest = deals.slice(1, 3);

  const heroBlock = `
    <a href="${SITE_URL}/deals" style="text-decoration:none;color:inherit;">
      <img src="${escapeHtml(hero.image)}" width="532" height="290" alt="${escapeHtml(hero.name)}"
           style="display:block;width:100%;max-width:532px;height:290px;border:0;
                  border-radius:10px;background-color:${C.panel};object-fit:cover;">
    </a>
    <div dir="auto" style="font-size:15px;font-weight:700;color:${C.navy};margin-top:10px;unicode-bidi:plaintext;text-align:right;">${escapeHtml(hero.name)}</div>
    ${hero.place ? `<div style="font-size:13px;color:${C.muted};margin-top:2px;" dir="ltr">${escapeHtml(hero.place)}</div>` : ''}`;

  /* שתי תמונות → שתי עמודות. אחת → רוחב מלא ונמוכה יותר, כדי לא
     להשאיר חצי שורה ריקה. אפס → אין בלוק בכלול. */
  const card = (d, w, h) => `
    <a href="${SITE_URL}/deals" style="text-decoration:none;color:inherit;">
      <img src="${escapeHtml(d.image)}" width="${w}" height="${h}" alt="${escapeHtml(d.name)}"
           style="display:block;width:100%;max-width:${w}px;height:${h}px;border:0;
                  border-radius:8px;background-color:${C.panel};object-fit:cover;">
    </a>
    <div dir="auto" style="font-size:13px;font-weight:700;color:${C.navy};margin-top:8px;unicode-bidi:plaintext;text-align:right;">${escapeHtml(d.name)}</div>
    ${d.place ? `<div style="font-size:12px;color:${C.muted};margin-top:1px;" dir="ltr">${escapeHtml(d.place)}</div>` : ''}`;

  const restBlock = !rest.length ? '' : rest.length === 1 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr><td valign="top" style="text-align:right;">${card(rest[0], 532, 186)}</td></tr>
    </table>` : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr>
        <td width="50%" valign="top" style="padding-left:8px;text-align:right;">${card(rest[0], 258, 168)}</td>
        <td width="50%" valign="top" style="padding-right:8px;text-align:right;">${card(rest[1], 258, 168)}</td>
      </tr>
    </table>`;

  return `
  <tr>
    <td style="padding:16px 34px 0 34px;text-align:right;">
      <div style="height:1px;line-height:1px;font-size:0;background-color:${C.line};margin:14px 0 26px 0;">&nbsp;</div>
      <div style="font-size:18px;font-weight:800;color:${C.navy};">${escapeHtml(copy.showcaseTitle)}</div>
      <div style="font-size:14px;line-height:1.7;color:${C.muted};margin:6px 0 18px 0;">${escapeHtml(copy.showcaseLede)}</div>
      ${heroBlock}
      ${restBlock}
    </td>
  </tr>`;
}

/** מה שהוא מילא, כפי שנקלט אצלנו — כדי שיוכל לתקן אם משהו שגוי. */
function recap(lead) {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const line = (k, v, ltr) => v
    ? `<tr><td style="padding:3px 0;font-size:14px;color:${C.ink};">
         <span style="color:${C.muted};">${k}:</span>
         <strong${ltr ? ` dir="ltr" style="unicode-bidi:embed;"` : ''}>${escapeHtml(v)}</strong>
       </td></tr>`
    : '';

  const rows = [
    line('שם', fullName),
    line('אימייל', lead.email, true),
    line('טלפון', lead.phone, true),
    line('הון משוער', label(lead.capital)),
    line('נזילות', label(lead.liquid)),
    lead.kind === 'waitlist' ? line('ליצור קשר', label(lead.wants_contact)) : '',
    line('הודעה', lead.message)
  ].join('');

  return `
  <tr>
    <td style="padding:28px 34px 0 34px;text-align:right;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background-color:${C.panel};border-radius:10px;">
        <tr><td style="padding:20px 22px;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.wine};font-weight:700;font-family:${LATIN};margin-bottom:10px;">הפרטים שהשארת</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
          <div style="font-size:12px;color:${C.muted};margin-top:12px;line-height:1.6;">משהו לא נכון? אפשר פשוט להשיב למייל הזה.</div>
        </td></tr>
      </table>
    </td>
  </tr>`;
}

/* כפתור = טבלה עם תא צבוע. ‏<a> עם padding לבד קורס באאוטלוק. */
function button(href, text, bg, color) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
    <tr><td align="center" style="background-color:${bg};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${SANS};
         font-size:15px;font-weight:700;color:${color};text-decoration:none;">${escapeHtml(text)}</a>
    </td></tr></table>`;
}

function cta(settings) {
  return `
  <tr>
    <td style="padding:28px 34px 34px 34px;text-align:right;">
      <div style="font-size:15px;line-height:1.7;color:${C.muted};margin-bottom:16px;">
        עד שנדבר — הקהילה השקטה שלנו בוואטסאפ היא המקום שבו עולים העדכונים מהשטח.
      </div>
      ${button(escapeHtml(settings.whatsapp_group), 'להצטרפות לקהילה בוואטסאפ', '#1f8f4e', C.white)}
      <span style="display:inline-block;width:8px;">&nbsp;</span>
      ${button(SITE_URL + '/deals', 'לעסקאות שלנו', C.panel, C.navy)}
    </td>
  </tr>`;
}

function footer(settings) {
  const tel = String(settings.phone || '').replace(/[^\d+]/g, '');
  return `
  <tr>
    <td style="background-color:${C.navy};padding:26px 34px;text-align:right;">
      <div style="color:${C.white};font-size:15px;font-weight:700;">Safe Capital · סייף קפיטל</div>
      <div style="color:#9fb0c2;font-size:13px;line-height:1.9;margin-top:8px;">
        <a href="tel:${escapeHtml(tel)}" style="color:#9fb0c2;text-decoration:none;" dir="ltr">${escapeHtml(settings.phone)}</a>
        &nbsp;·&nbsp;
        <a href="mailto:${escapeHtml(settings.email_main)}" style="color:#9fb0c2;text-decoration:none;" dir="ltr">${escapeHtml(settings.email_main)}</a>
      </div>
      <div dir="auto" style="color:#6f8399;font-size:11px;margin-top:14px;font-family:${LATIN};unicode-bidi:plaintext;text-align:right;">${escapeHtml(settings.copyright_text)}</div>
    </td>
  </tr>`;
}

/* ── ההרכבה ────────────────────────────────────────────────────────── */

function buildHtml(lead, copy, deals, settings) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(copy.title)} · Safe Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Inter:wght@600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${C.bone};font-family:${SANS};color:${C.ink};direction:rtl;">
${preheader(copy.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bone};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background-color:${C.white};border-radius:14px;overflow:hidden;">
        ${header(copy)}
        ${greeting(lead.first_name, copy)}
        ${steps(copy)}
        ${showcase(deals, copy)}
        ${recap(lead)}
        ${cta(settings)}
        ${footer(settings)}
      </table>
      <div style="max-width:600px;margin:16px auto 0;font-size:11px;color:#8b8d8a;text-align:center;line-height:1.7;">
        קיבלת את המייל הזה כי השארת פרטים באתר סייף קפיטל.
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** גרסת הטקסט. לא נספח — יש לקוחות שמראים רק אותה. */
function buildText(lead, copy, deals, settings) {
  const out = [`היי ${lead.first_name},`, '', copy.lede, '', '— מה קורה עכשיו —'];
  copy.steps.forEach(([t, b], i) => out.push(`${i + 1}. ${t} — ${b}`));

  if (deals.length) {
    out.push('', `— ${copy.showcaseTitle} —`);
    deals.forEach(d => out.push(`· ${d.name}${d.place ? ` (${d.place})` : ''}`));
    out.push(`${SITE_URL}/deals`);
  }

  out.push('', '— הפרטים שהשארת —');
  out.push(`שם: ${[lead.first_name, lead.last_name].filter(Boolean).join(' ')}`);
  out.push(`אימייל: ${lead.email}`);
  if (lead.phone) out.push(`טלפון: ${lead.phone}`);
  if (lead.capital) out.push(`הון משוער: ${label(lead.capital)}`);
  if (lead.liquid) out.push(`נזילות: ${label(lead.liquid)}`);
  if (lead.kind === 'waitlist' && lead.wants_contact) out.push(`ליצור קשר: ${label(lead.wants_contact)}`);
  if (lead.message) out.push(`הודעה: ${lead.message}`);

  out.push('', `קהילת הוואטסאפ: ${settings.whatsapp_group}`);
  out.push('', 'Safe Capital · סייף קפיטל', settings.phone, settings.email_main);
  return out.join('\n');
}

/**
 * שולח את מייל התודה. לעולם לא זורק — מחזיר
 * ‏{ sent, skipped?, reason?, error? } כדי שהראוט ירשום את התוצאה על הליד.
 */
async function sendLeadThankYouEmail(lead) {
  if (!lead || !lead.email) return { sent: false, skipped: true, reason: 'missing email' };

  const copy = COPY[lead.kind] || COPY.contact;

  try {
    const [deals, settings] = await Promise.all([fetchShowcaseDeals(3), fetchSettings()]);
    const res = await sendMail({
      to: lead.email,
      subject: copy.subject,
      html: buildHtml(lead, copy, deals, settings),
      text: buildText(lead, copy, deals, settings)
    });
    if (res.sent) {
      console.log('[lead-email] thank-you sent →', lead.email, `(${lead.kind})`);
      return res;
    }
    /* ‏sendMail מדלג בשקט כשאין SMTP מוגדר. בלי סיבה מפורשת עמוד
       הלידים היה מראה "לא נשלח" בלי לרמוז למה, והתשובה יושבת רק
       בלוגים של Vercel. */
    return Object.assign({}, res, {
      reason: res.reason || (res.skipped ? 'SMTP לא מוגדר בשרת' : 'שליחה נכשלה')
    });
  } catch (err) {
    console.error('[lead-email] send failed:', err.message);
    return { sent: false, error: err };
  }
}

module.exports = {
  sendLeadThankYouEmail,
  // מיוצאים לתצוגה מקדימה ולבדיקות
  buildHtml,
  buildText,
  fetchShowcaseDeals,
  fetchSettings,
  COPY
};

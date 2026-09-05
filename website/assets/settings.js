/* ═══════════════════════════════════════════════════════════════
   settings.js — טקסטים וקישורים מתוך אדמין הפאנל

   ── מה זה פותר ──
   מספר טלפון, כתובת מייל, קישור לקבוצת הוואטסאפ ושורת הזכויות
   הם **נתונים**, לא קוד. הם מתחלפים בלי שאף אחד יגע באתר, והם
   מופיעים ביותר מעמוד אחד. כשהם כתובים בתוך ה-HTML, שינוי אחד
   דורש עריכה בשבעה קבצים — ובפועל אחד מהם תמיד נשכח.

   כאן הם נמשכים מ-/api/public/settings, מאותו מקום שממנו
   נמשכות העסקאות.

   ── החוזה ──
   ‏<span data-setting="phone">          → הטקסט מוחלף
   ‏<a data-setting-href="whatsapp_group"> → ה-href מוחלף

   אותה מוסכמה בדיוק שהייתה באתר הישן, כדי שמי שמכיר אותה לא
   ילמד שנייה.

   ── שדרוג, לא תלות ──
   מה שכתוב ב-HTML הוא ערך אמיתי ועדכני, לא מציין מקום. בלי
   רשת, או אם ה-API נופל — העמוד נשאר עם ערך שעובד. הסקריפט
   רק **מרענן** אותו. זה אותו עיקרון שמנחה את deals.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = 'https://admin.safecapital.co.il/api/public/settings';

  var text = document.querySelectorAll('[data-setting]');
  var href = document.querySelectorAll('[data-setting-href]');
  if (!text.length && !href.length) return;
  if (!window.fetch) return;

  fetch(API)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows || !rows.length) return;

      var map = {};
      rows.forEach(function (row) { map[row.key] = row.value; });

      text.forEach(function (el) {
        var v = map[el.getAttribute('data-setting')];
        if (v) el.textContent = v;
      });

      href.forEach(function (el) {
        var v = map[el.getAttribute('data-setting-href')];
        if (v) el.setAttribute('href', v);
      });
    })
    .catch(function () { /* נשארים עם מה שב-HTML */ });

})();

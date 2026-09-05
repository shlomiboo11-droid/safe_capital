/* ═══════════════════════════════════════════════════════════════
   a11y.js — טעינת ווידג'ט הנגישות "נגיש לי"

   אותו כלי שרץ באתר הישן (safecapital.co.il), אותה גרסה (2.3),
   הועבר לכאן כמו שהוא: assets/nagishli/.

   ── למה קובץ נפרד ולא בלוק בכל עמוד ──
   באתר הישן ההטמעה הייתה משוכפלת בתחתית כל קובץ HTML — כולל
   ה-CSS, כולל טיימר, כולל תיקון z-index. שכפול של 20 שורות על
   פני שישה עמודים אומר שכל שינוי צריך לקרות שש פעמים. כאן זה
   סקריפט אחד שכל עמוד טוען.

   ── התלות ב-jQuery ──
   ‏nagishli.js דורש jQuery. הוא נטען מ-CDN עם integrity, ורק
   **אחרי** שהוא עלה נטען הווידג'ט — אחרת הווידג'ט נופל בשקט
   על $ שאינו מוגדר. בלי רשת (או אם ה-CDN חסום) הווידג'ט לא
   יעלה; האתר עצמו לא נפגע.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = 'assets/nagishli/';

  /* ההגדרות של נגיש לי — נקראות ממנו כמשתנים גלובליים.
     ‏br = פינה ימנית תחתונה, בדיוק כמו באתר הישן. הפינה
     השמאלית שמורה לכפתור ההצטרפות (‏.join-fab), ושני
     כפתורים צפים באותה פינה נלחמים זה בזה. */
  window.nl_pos = 'br';
  window.nl_lang = 'he';
  window.nl_color = 'blue';
  window.nl_compact = '1';
  window.nl_accordion = '0';
  window.nl_dir = BASE + 'nl-files/';

  function load(src, attrs, done) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    if (done) s.onload = done;
    document.head.appendChild(s);
  }

  /* ‏jQuery כבר על העמוד? לא טוענים פעמיים. */
  if (window.jQuery) {
    load(BASE + 'nagishli.js?v=2.3');
    return;
  }

  load('https://code.jquery.com/jquery-3.7.1.min.js', {
    integrity: 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=',
    crossorigin: 'anonymous'
  }, function () {
    load(BASE + 'nagishli.js?v=2.3');
  });

})();

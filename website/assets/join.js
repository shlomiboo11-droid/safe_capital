/* ═══════════════════════════════════════════════════════════════
   join.js — כפתור ההצטרפות הצף

   ── עיקרון: שדרוג, לא תלות ──
   הכפתור ב-HTML הוא **קישור אמיתי** לטופס ההרשמה. בלי JS
   לחיצה עליו פשוט מגיעה לטופס — לא כפתור מת. הסקריפט הזה
   רק מחליף את ההתנהגות: במקום לנווט, הוא פותח חלון עם שתי
   האפשרויות. אותו עיקרון שמנחה את deals.js.

   ── למה <dialog> ──
   הדפדפן נותן בחינם את מה שהיה צריך לכתוב ביד ולפספס חצי
   ממנו: מלכודת פוקוס (Tab לא בורח מהחלון), סגירה ב-Esc,
   החזרת הפוקוס לכפתור בסגירה, ושכבת ::backdrop אמיתית.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var fab = document.getElementById('join-fab');
  var dlg = document.getElementById('join-dialog');
  if (!fab || !dlg) return;

  /* דפדפן בלי showModal — משאירים את הקישור כמו שהוא.
     הכפתור ימשיך להוביל לטופס, וזה בדיוק המצב הרצוי. */
  if (typeof dlg.showModal !== 'function') return;

  fab.addEventListener('click', function (e) {
    e.preventDefault();
    dlg.showModal();
  });

  /* סגירה בלחיצה על הרקע.
     ה-<dialog> עצמו פרוס על כל המסך והפאנל יושב בתוכו, ולכן
     קליק שנחת על ה-dialog ולא על הפאנל הוא קליק על הרקע.
     בודקים לפי הקואורדינטות ולא לפי e.target: קליק שמתחיל
     על הפאנל ומסתיים מחוצה לו (גרירה של טקסט) מדווח על
     ה-dialog, והחלון היה נסגר באמצע בחירת טקסט. */
  dlg.addEventListener('click', function (e) {
    /* ── שני שומרי סף לפני בדיקת הקואורדינטות ──
       ‏detail === 0 · הפעלה במקלדת (Enter או רווח על כפתור)
       מייצרת אירוע click בלי קואורדינטות — 0,0 — שהוא תמיד
       "מחוץ לפאנל". בלי השורה הזו, משתמש מקלדת שלחץ על
       "הרשמה לרשימת ההמתנה" היה **סוגר את החלון** במקום
       לפתוח את הטופס. תפסתי את זה במדידה, לא בעין.

       ‏e.target !== dlg · קליק שנחת על תוכן כלשהו בתוך
       החלון מדווח על אותו תוכן; רק קליק על הרקע מדווח על
       ה-dialog עצמו. */
    if (e.detail === 0) return;
    if (e.target !== dlg) return;

    /* ומעבר לזה — הקואורדינטות. גרירה שמתחילה בתוך הפאנל
       ומסתיימת מחוצה לו מדווחת על ה-dialog, ובלי הבדיקה
       הזו החלון היה נסגר באמצע בחירת טקסט. */
    var panel = dlg.querySelector('.join__panel');
    if (!panel) return;
    var r = panel.getBoundingClientRect();
    var inside = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top  && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  });

  /* ── שני המסכים שבתוך החלון ────────────────────────────────
     בחירה → טופס. שניהם ב-HTML מלכתחילה; המעבר הוא hidden
     בלבד, ולכן אין כאן בנייה דינמית של שדות ואין רגע שבו
     הטופס לא קיים ב-DOM. */
  var screens = {};
  dlg.querySelectorAll('[data-screen]').forEach(function (el) {
    screens[el.getAttribute('data-screen')] = el;
  });

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].hidden = (k !== name);
    });
    /* הפוקוס עובר לראש המסך החדש — אחרת הוא נשאר על כפתור
       שכבר מוסתר, וניווט במקלדת מתחיל מלמעלה במקום מכאן.

       ‏preventScroll הוא לא פרט טכני: בלעדיו הדפדפן גולל את
       הכותרת לתוך התצוגה, והפאנל — שהוא עצמו אזור גלילה —
       נגלל מעט ומסתיר את כפתור החזרה שמעליה. מדדתי. אחרי
       העברת הפוקוס מחזירים את הפאנל לראשו במפורש. */
    var h = screens[name] && screens[name].querySelector('h2');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    var panel = dlg.querySelector('.join__panel');
    if (panel) panel.scrollTop = 0;
  }

  var toForm = document.getElementById('join-to-form');
  if (toForm) toForm.addEventListener('click', function () { show('form'); });

  var back = document.getElementById('join-back');
  if (back) back.addEventListener('click', function () { show('choose'); });

  /* בכל פתיחה מתחילים מהבחירה — מי שסגר באמצע הטופס לא
     אמור למצוא אותו פתוח שוב בפעם הבאה. */
  fab.addEventListener('click', function () { show('choose'); });

  /* הוואטסאפ נפתח בלשונית חדשה, והעמוד נשאר מאחור — ואם
     המשתמש יחזור, עדיף שלא ימצא חלון פתוח שסיים איתו.
     הכפתור שמוביל לטופס אינו קישור ולכן אינו נכלל. */
  dlg.querySelectorAll('a.join__option').forEach(function (a) {
    a.addEventListener('click', function () { dlg.close(); });
  });

})();

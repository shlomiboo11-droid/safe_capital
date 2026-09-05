/* ═══════════════════════════════════════════════════════════════
   forms.js — ולידציה לכל טופס באתר

   שני טפסים משתמשים בקובץ הזה, והם **אינם אותו טופס**:

     ‏#contact-form   · פנייה כללית, בעמוד צור קשר
     ‏#waitlist-form  · הרשמה לרשימת ההמתנה, בחלון הצף.
                        זה הטופס שתואם לשאלון בדיקת ההתאמה
                        ‏(fitcheck-preview.html) ושיזין איתו את
                        אותה טבלה — ולכן שמות השדות שלו זהים
                        לשמות שם: first · last · mail · phone ·
                        capital · liquid · contact · ok.

   ── איך טופס נרשם ──
   ‏<form data-validate>, ולכל שדה ‏data-rule עם אחד מהערכים
   ‏name · email · phone · choice. אין רשימת שדות בקוד: הוספת
   שדה ל-HTML לא דורשת נגיעה כאן.

   ── למה ולידציה משלנו ולא של הדפדפן ──
   הטפסים נושאים novalidate, ולכן בועת ההודעה של הדפדפן לא
   קופצת. היא מגיעה בשפת המערכת, יושבת מעל העיצוב ולא ניתנת
   לצביעה. השדות עדיין נושאים required ו-type, כך שבלי JS
   הדפדפן חוזר לוולידציה שלו — ולא נשארים בלי שום בדיקה.

   ── שליחה ──
   **שום טופס לא שולח לשום מקום.** אין עדיין endpoint של
   לידים. ‏submit() למטה הוא הנקודה היחידה שצריך למלא.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var EMPTY_MSG = 'שדה חובה';

  /* ── הכללים ────────────────────────────────────────────────
     ── שם ──
     עברית, לטינית, רווח, גרש ומקף. הגרש והמקף אמיתיים בשמות
     ("בן־גוריון", "או'קונור") ולכן הם בפנים; ספרות בחוץ.

     ── אימייל ──
     בדיקה מכוונת־רופפת: משהו, שטרודל, משהו, נקודה, סיומת של
     שתי אותיות לפחות. ה-RFC מתיר צורות שכל regex "מחמיר"
     פוסל בטעות, והמחיר של פסילת כתובת אמיתית גבוה מהמחיר של
     לתת לטעות דפוס לעבור — ממילא רק שליחת מייל מוכיחה כתובת.

     ── טלפון ──
     מנקים כל מה שאינו ספרה, ואז סופרים. ‏9 עד 15 מכסה גם
     0501234567 (10) וגם +972501234567 (12) וגם קווי ישן בן 9.

     ── בחירה ──
     בורר. מספיק שנבחר משהו מלבד האופציה הריקה. */
  var RULES = {
    name: {
      test: function (v) { return /^[A-Za-z֐-׿'׳\-\s]{2,}$/.test(v); },
      msg: 'אותיות בלבד'
    },
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v); },
      msg: 'כתובת מייל לא תקינה'
    },
    phone: {
      test: function (v) {
        var d = v.replace(/[^\d]/g, '');
        return d.length >= 9 && d.length <= 15;
      },
      msg: 'מספר טלפון לא תקין'
    },
    choice: {
      test: function (v) { return v !== ''; },
      msg: 'צריך לבחור'
    }
  };

  /* ההודעה שמגיעה לשדה, או '' אם הוא תקין. מקור אמת אחד
     ל-blur ולשליחה גם יחד. */
  function check(el) {
    var rule = RULES[el.getAttribute('data-rule')];
    var v = (el.value || '').trim();
    if (!v) return EMPTY_MSG;
    if (!rule) return '';
    return rule.test(v) ? '' : rule.msg;
  }

  /* סימון שדה: ‏aria-invalid עליו (ה-CSS צובע דרכו את
     הכוכבית, וקורא מסך שומע שהשדה פסול) + טקסט ההסבר ב-span
     שמתחתיו, המקושר אליו ב-aria-describedby. */
  function mark(el, msg) {
    var box = el.getAttribute('aria-describedby');
    box = box && document.getElementById(box);
    if (msg) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    if (box) box.textContent = msg || '';
  }

  function boot(form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('[data-rule]'));
    var consent = form.querySelector('input[type="checkbox"][required]');
    var note = form.querySelector('[data-note]');

    function setNote(text, ok) {
      if (!note) return;
      note.textContent = text || '';
      note.classList.toggle('is-ok', !!ok);
    }

    /* ── מתי בודקים שדה ──────────────────────────────────────
       ‏blur   · המשתמש סיים עם השדה ועבר הלאה. הרגע הטבעי
                להגיד "המייל הזה לא תקין" — בזמן שהוא עוד
                זוכר מה הקליד.
       ‏input  · ההערה יורדת מיד כשמתחילים לתקן.
       ‏submit · רשת הביטחון, גם לשדות שדילגו עליהם.

       ── touched ──
       בלי הדגל הזה, מעבר מהיר עם Tab על טופס ריק היה מדליק
       את כל ההערות בבת אחת לפני שהוקלד תו. שדה נבדק ב-blur
       רק אם נגעו בו, או אם כבר יש בו תוכן (מילוי אוטומטי של
       הדפדפן נכנס בלי אירוע input). */
    fields.forEach(function (el) {
      var touched = false;
      function touch() { touched = true; mark(el, ''); }
      el.addEventListener('input', touch);
      el.addEventListener('change', touch);
      el.addEventListener('blur', function () {
        if (!touched && !el.value) return;
        mark(el, check(el));
      });
    });
    if (consent) {
      consent.addEventListener('change', function () { mark(consent, ''); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;

      fields.forEach(function (el) {
        var msg = check(el);
        mark(el, msg);
        if (msg && !firstBad) firstBad = el;
      });

      if (consent && !consent.checked) {
        mark(consent, 'צריך לאשר');
        if (!firstBad) firstBad = consent;
      }

      if (firstBad) {
        setNote('', false);
        firstBad.focus();
        return;
      }

      /* ── כאן תיכנס השליחה בפועל ──
         שני הטפסים אמורים להגיע לאותה טבלה, ולכן זו נקודה
         אחת: fetch(ADMIN_HOST + '/api/public/leads', …) עם
         ‏new FormData(form). הטופס שבחלון כבר שולח בדיוק את
         המפתחות שהשאלון שולח.
         עד אז: מנקים ומאשרים למשתמש שהפרטים נקלטו בצד שלו.
         הנוסח נזהר ולא מבטיח שנחזור — שום דבר עדיין לא יוצא
         מהדפדפן. */
      form.reset();
      fields.forEach(function (el) { mark(el, ''); });
      if (consent) mark(consent, '');
      setNote(form.getAttribute('data-done') ||
              'הפרטים נקלטו. חיבור השליחה עדיין לא הוגדר.', true);
    });
  }

  Array.prototype.slice
    .call(document.querySelectorAll('form[data-validate]'))
    .forEach(boot);

})();

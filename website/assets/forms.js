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
   שני הטפסים נשלחים לאותה כתובת אחת —
   ‏ADMIN_HOST + '/api/public/leads' — ומגיעים לאותה טבלה. מה
   שמבדיל ביניהם הוא ‏data-lead-kind על ה-<form>:

     ‏contact   · פנייה כללית
     ‏waitlist  · הרשמה לרשימה

   הסוג נשלח כערך מפורש ולא נגזר משמות השדות. גזירה כזו נשברת
   בשקט ביום ששדה משנה שם, ואז ליד נכנס לרשימה הלא נכונה.

   ── כשהשליחה נכשלת ──
   לא מציגים "נקלט". הפרטים לא הגיעו לאף אחד, ומי שממתין
   לשיחה שלא תבוא נפגע פעמיים. מוצגת הודעה שאומרת את האמת
   ומציעה דרך חלופית, והכפתור חוזר להיות לחיץ.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var EMPTY_MSG = 'שדה חובה';

  /* אותו מארח שממנו נמשכות העסקאות וההגדרות (deals.js, settings.js). */
  var ADMIN_HOST = 'https://admin.safecapital.co.il';
  var LEADS_API = ADMIN_HOST + '/api/public/leads';

  var FAIL_MSG = 'לא הצלחנו לשלוח כרגע. אפשר לנסות שוב, ' +
                 'או לכתוב לנו ישירות בוואטסאפ.';

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

  /* מאיפה הגיע המבקר. נשמר ב-utm כדי שאפשר יהיה לדעת איזו מודעה
     מביאה לידים — בלי לפזר חמש עמודות בסכימה על משהו שעוד לא
     בטוח שנמדוד. */
  function collectUtm() {
    var utm = {};
    try {
      var params = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
        .forEach(function (k) {
          var v = params.get(k);
          if (v) utm[k] = v;
        });
      if (document.referrer && document.referrer.indexOf(window.location.host) === -1) {
        utm.referrer = document.referrer;
      }
    } catch (err) { /* דפדפן ישן בלי URLSearchParams — פשוט בלי utm */ }
    return utm;
  }

  function collectPayload(form) {
    var data = {
      kind: form.getAttribute('data-lead-kind') || 'contact',
      source: form.getAttribute('data-lead-source') || '',
      page_url: window.location.href,
      utm: collectUtm()
    };
    /* שמות השדות עוברים כמו שהם. השרת מקבל את שני האיותים
       (‏first_name/first, email/mail), ולכן אין כאן מיפוי שיכול
       להתיישן ביחס ל-HTML. */
    Array.prototype.slice.call(form.elements).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else data[el.name] = el.value;
    });
    return data;
  }

  function sendLead(form) {
    return fetch(LEADS_API, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectPayload(form))
    }).then(function (r) {
      if (r.ok) return r.json();
      /* לשרת יש מה להגיד על 400 ועל 429 ("יותר מדי פניות…"), והמשפט
         שלו מדויק יותר מהודעת הגיבוי הכללית. */
      return r.json().catch(function () { return null; }).then(function (body) {
        var err = new Error((body && body.error) || 'HTTP ' + r.status);
        err.fromServer = !!(body && body.error);
        throw err;
      });
    });
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

    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.innerHTML : '';
    var sending = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
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

      /* ── שליחה ──
         הכפתור ננעל עד שיש תשובה, אחרת לחיצה כפולה שולחת
         פעמיים. השרת ממילא מזהה הגשה כפולה, אבל עדיף שהמשתמש
         יראה שמשהו קורה. */
      sending = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'שולח…';
      }
      setNote('', false);

      sendLead(form).then(function () {
        form.reset();
        fields.forEach(function (el) { mark(el, ''); });
        if (consent) mark(consent, '');
        setNote(form.getAttribute('data-done') ||
                'הפרטים נקלטו. נחזור אליך בהקדם.', true);
      }).catch(function (err) {
        setNote(err.fromServer ? err.message : FAIL_MSG, false);
      }).then(function () {
        sending = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitLabel;
        }
      });
    });
  }

  Array.prototype.slice
    .call(document.querySelectorAll('form[data-validate]'))
    .forEach(boot);

})();

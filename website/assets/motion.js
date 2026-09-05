/* ═══════════════════════════════════════════════════════════════
   motion.js — כל התנועה מונעת־הגלילה של עמוד הבית

   שיפורים מול המקור (מכוונים):
   • כל הקריאות ל-scroll עוברות דרך requestAnimationFrame אחד
   • המידות נשמרות ב-cache ומחושבות מחדש רק ב-resize
   • prefers-reduced-motion מכבה את כל התנועה מונעת־הגלילה
   • אין תלות ב-jQuery
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── קבועים מהמקור ────────────────────────────────────────── */
  var MIN_FX_WIDTH = 1200;   // מתחת לזה — אפס אפקטי transform

  /* שתי פעימות רצופות על מסלול הפרוצס, ביחידות של מסכים.
     שתיהן קורות **בזמן שהבמה נעוצה**, וזה העיקר: הפייד אאוט
     של המפה מתרחש כשהיא עומדת במקום, לא בזמן שהיא נגללת
     מעלה. הסכום + מסך אחד לבמה = .process{min-height}. */
  var PHASE = {
    rail: 1.00,   // הרכבת נעה שמאלה
    exit: 0.45    // המפה והערכים דוהים במקומם
  };

  /* ── מסלול ה-deep ═══════════════════════════════════════════
     "איך עסקה מייצרת רווח" — ביחידות של מסכי גלילה.

     ── מאיפה נמדד u ──
     מהרגע ש**הרכבת עוצרת**, כלומר מאותו פיקסל שבו המפה
     מתחילה לדהות. השאלה עולה בזמן שהמפה נעלמת, לא אחריה.

     כדי שזה יהיה אפשרי הכותרת היא position:fixed ולא absolute
     בתוך הבמה. absolute היה כובל אותה לבמה של deep, והבמה
     הזו לא קיימת על המסך לפני שהסקשן שלה מגיע — כלומר
     העלייה לא הייתה יכולה להתחיל לפני שסקשן הפרוצס נגמר.
     fixed מנתק אותה מזה, בדיוק כמו .pinned.

     ב-u=1 הכותרת ממורכזת. מאותו רגע ואילך fixed ו-absolute
     היו נותנים אותה תוצאה בדיוק, כי הבמה נעוצה ב-top:0 —
     ולכן שאר המסלול לא מושפע מהשינוי.

         0 ──▶ 1 ──▶ hold ──▶ park ──────▶ tail
         עולה  נוחתת  עומדת   נוסעת ימינה   מנוחה
         מלמטה בשמאל          לעמודה

                      └──▶ item × N ─────┘
                           הטקסטים נכנסים משמאל ומתחלפים

     הטקסטים מתחילים ב-hold ולא ב-park: הטקסט הראשון נכנס
     **במקביל** לנסיעה של הכותרת ימינה, לא אחריה. הוא נוחת
     ראשון (0.34 מהמשבצת), והכותרת מתייצבת אחריו.

     item הוא אורך משבצת אחת; מספר המשבצות נקרא מה-DOM.

     ── הקשר ל-.deep{min-height} ──
     המסלול מתחיל 1+PHASE.exit מסכים לפני ראש הסקשן, ולכן
     הבמה צריכה להישאר נעוצה עוד (4.50 − 1 − 0.45) = 3.05
     מסכים אחרי שהיא נתפסת. ועוד מסך אחד לבמה = 405svh. */
  var DEEP_VH = {
    /* בלי מנוחה — הנסיעה לצד מתחילה באותו פיקסל שבו העלייה
       נגמרת, ולכן אין רגע שבו הכותרת סתם עומדת. */
    hold: 0.00,
    /* אין כאן park: אורך הנסיעה נגזר מהמרחק שצריך לעבור,
       כי היא 1:1 מול האצבע. ראה measure(). */
  };

  /* ── לוח הזמנים של הטקסטים ═════════════════════════════════
     ביחידות מסכים, לא באחוזים ממשבצת. הסיבה: הטקסט הראשון
     חורג — הוא נכנס **יחד עם הכותרת**, באותו חלון ובאותו
     מרחק, ולכן משך הכניסה שלו נגזר ולא מוקלד. במודל של
     משבצת אחידה כל השאר היו נמתחים איתו והכניסה שלהם
     הייתה נגררת. */
  var DEEP_TEXT = {
    /* אין כאן enter. משך הכניסה נגזר מהמרחק: slideIn פיקסלים
       על פני slideIn פיקסלים של גלילה, בדיוק כמו הנסיעה של
       "איך עסקה מייצרת רווח?" ושל הטקסט הראשון. ראה measure(). */
    /* האור נדלק רק בהתחלת הכניסה, וכמעט מיידית — 0.05 מסך
       הם 36px גלילה. כל שאר התנועה נעשית כשהטקסט כבר ב-100%,
       ולא כשהוא דוהה לאורך כל הדרך. */
    fadeIn: 0.05,
    /* ההיעלמות ארוכה ב-60% מההידלקות: 0.08 מסך = 58px מול 36.
       מופרדת ממנה בכוונה — הכניסה צריכה להידלק מיד כדי שהטקסט
       ינוע כשהוא כבר מואר, והיציאה דווקא רכה יותר. */
    fadeOut: 0.08,
    /* 0.25 ולא 0.55. הקיפאון היה 396px מול 128px של תנועה —
       שלושה רבעים מהגלילה בלי שום שינוי, וזה מה שגרם להחלפה
       להיראות פתאומית. עכשיו התנועה היא הרוב. */
    hold:   0.25
  };
  /* אורך המסלול כולו, במסכים. קבוע בכל רזולוציה — משך הכניסה
     של הטקסט הראשון משתנה עם יחס המסך, וההפרש נבלע במנוחה
     שאחרי האחרון. חייב להתאים ל-.deep{min-height}. */
  var DEEP_TOTAL = 4.70;
  /* מתי הכותרת מתחילה להיכנס, בתוך מסך העלייה. 0.30 ולא 0
     כדי שהיא לא תעלה על המפה בזמן שהמפה עדיין קריאה.

     האורך של הכניסה **לא** נקבע כאן: הוא PROCESS_FADE, אותו
     מספר שמכניס את "איך אנחנו עושים את זה?". גם המרחק שהיא
     עולה הוא אותו מספר בפיקסלים, וגם העקומה לינארית כמוהו —
     ולכן שתי הכניסות זהות בקצב לחלוטין, ולא רק דומות.
     ראה measure(). */
  var DEEP_FADE_FROM = 0.30;
  /* ── AFTER ──────────────────────────────────────────────────
     אותה שפה של .deep: RISE הוא גם משך העלייה במסכים וגם המרחק
     בפיקסלים חלקי vh, ולכן היחס הוא 1:1. GAP הוא ההשהיה בין שלב
     לשלב — קצר בכוונה, כדי שהרצף יקרא כתנועה אחת. */
  var AFTER_LEAD_HOLD = 0.25;
  var AFTER_GAP       = 0.10;
  /* כמה זמן השלב האחרון נשאר לקריאה לפני שהגבעה מתחילה לכסות */
  var AFTER_HOLD      = 0.35;
  /* חלק מהעלייה שבו האור נדלק. קצר, כמו ב-.deep. */
  var AFTER_FADE_IN   = 0.28;
  /* אין כאן מרחק כניסה קבוע. הוא נמדד: הטקסט מתחיל כשקצהו
     הימני נוגע בקצה השמאלי של המסך, ונוסע עד מקומו — כלומר
     כל פיקסל של גלילה הוא פיקסל של תנועה שרואים.

     קודם זה היה 10% מרוחב המסך, 128px. הכניסה הראשונה, לעומת
     זאת, נוסעת את מרחק הכותרת — 806px ב-1280. פי 6.3. התוצאה
     הייתה ריצה ארוכה וחלקה, ואז שתי "החלפות" קצרות ומהירות
     עם 396px של קיפאון ביניהן. */
  /* המרווח בין תחתית הכותרת לראש הטקסטים, בגבהי מסך.
     הכותרת ממורכזת אנכית וגובהה משתנה עם רוחב המסך, ולכן
     מיקום הטקסטים נגזר ממדידה שלה ולא מוקלד. */
  var DEEP_GAP = 0.05;
  /* גובה הטקסטים בדסקטופ. הם יושבים בצד השני של המסך מהכותרת
     ועוברים דרכה בנסיעה, ולכן הם חייבים להיות מעליה ולא לצדה.
     מה שנשאר מתחתיהם הוא השטח לתמונת ההמחשה. */
  var DEEP_TEXT_TOP = 0.18;
                             /* מרחק הנסיעה של הרכבת נמדד מה-DOM ולא מקובע.
                                קודם הוא היה 50vw קשיח, שהיה נכון רק כל עוד
                                --panel נשאר 50vw — שינוי אחד בו היה שובר
                                את הסקשן בשקט. */
  var STICK_AT     = 20;     // px — הסף שבו ה-header נדבק
  var LOADER_MS    = 1300;

  var HERO_FADE    = { from: 0.62, to: 1.0 };   // חלק מטווח הנעיצה


  /* ══ נקודות העוגן של המשפט הנעוץ ═══════════════════════════════
     ארבעה מספרים. היחידה היא **גבהי מסך של גלילה** —
     `scrollY / innerHeight`. 1.0 = גללת בדיוק מסך אחד.

         start ──▶ centerStart ═══════ centerEnd ──▶ end
         └ פייד אין ┘  └── החזקה ──┘  └ פייד אאוט ┘
           מתחיל       אטום לגמרי       נעלם לגמרי
           להופיע

     אורך הפייד = ההפרש בין שתי הנקודות. אין ידית נפרדת לאורך;
     הוא נגזר, וכך אי אפשר ליצור מצב לא עקבי.

     ── למה דווקא היחידה הזו ──
     כל שאר נקודות הציון כבר מוגדרות בגבהי מסך:
       הגבעה מסיימת לכסות ב-  heroH − 1  =  0.70 (דסקטופ) / 1.00 (מובייל)
       סקשן התהליך מתחיל ב-   heroH      =  1.70 (דסקטופ) / 2.00 (מובייל)
       פייד הכניסה שלו        PROCESS_FADE = 0.50
     כשגם העוגנים כאן באותה יחידה, כל היחסים נשמרים בכל גובה
     מסך — לא רק בזה שכיוונו עליו.

     ── להביא ערכים חדשים ──
     מדוד ב-px בדפדפן ותן לי גם את גובה החלון. px ÷ גובה = הערך כאן.
     המספרים למטה נגזרו ממדידה על מובייל 812 ודסקטופ 900.        */
  /* מובייל: כניסה 0.24 · החזקה 0.33 · יציאה 0.25  =  0.82 מסך —
     אותו קצב כמו הדסקטופ שמתחתיו, במקום החזקה של 1.05 מסך.
     היציאה נגמרת ב-1.40, לפני 1.50 שבו מתחיל פייד הכניסה של
     סקשן התהליך (heroH 2.00 פחות PROCESS_FADE). קודם המשפט
     נעלם, ורק אחר כך "איך אנחנו עושים את זה" מופיע — הם לא
     חולקים מסך. הקודם נגמר ב-2.07 ולכן כיתוב המפה נכנס לתוכו:
     נמדדה חפיפה של 36–59px ב-812. */
  var PINNED_VH_MOBILE  = { start: 0.580, centerStart: 0.820, centerEnd: 1.150, end: 1.400 };
  /* דסקטופ: כניסה 0.2 · החזקה 0.35 · יציאה 0.2  =  0.75 מסך.
     ההתחלה 0.55 — לפני שהגבעה סיימה לכסות (0.70), ולכן המשפט
     כבר ב-75% אטימות ברגע שהיא נוגעת בראש המסך. */
  var PINNED_VH_DESKTOP = { start: 0.55, centerStart: 0.75, centerEnd: 1.10, end: 1.30 };
  /* אורך פייד הכניסה לסקשן התהליך, בגבהי מסך.
     הפייד תמיד **מסתיים** כשראש הסקשן מגיע (1.70 בדסקטופ),
     ולכן הגדלת המספר מקדימה את ההתחלה: 0.50 → מתחיל ב-1.20. */
  var PROCESS_FADE = 0.50;

  /* ── מובייל · לוח הזמנים של סקשן התהליך ═══════════════════
     מתחת ל-768 הסקשן הוא במה נעוצה שבתוכה רצה שורה אחת גדולה.
     הכל ביחידות מסכים, כש-u=0 הוא הרגע שראש הסקשן נוגע בראש
     החלון. הסכום חייב להתאים ל-.process{min-height} במובייל.
     נמדד ב-378×765: valuesStart 0.92 + 2×slot 1.79 + enter 0.45
     + hold 0.30 = 3.46, ועוד זנב. ‏500svh (מסלול 4.00) משאיר
     לערך האחרון 0.85 מסך של החזקה לפני שהבמה משתחררת. */
  var PROC_M = {
    /* הכניסה מתחילה לפני u=0. 0.68 ולא PROCESS_FADE 0.50:
       המשפט הנעוץ נכבה ב-1.40 מסכים מראש ההירו, וזה מה שסוגר
       את החור שביניהם — הכותרת עולה באותו פיקסל שבו הוא נגמר. */
    titleFrom: 0.68,
    titleRise: 0.34,      /* מרחק העלייה, כשבר מגובה מסך */
    /* הרווח בין הכותרת לתחילת המשפט, כשבר מרוחב מסך. בין
       "הכל מתחיל ב" ל"בירמינגהם" אין רווח כלל — ה-ב מרכיבה
       איתו "בבירמינגהם", וזו הסיבה שהם שני אלמנטים ולא אחד. */
    gap: 0.14,
    /* כמה ממשיכה השורה לרוץ אחרי שהמילה ננעלה. נדרשים רק
       ~0.12 מסך כדי ש"הכל מתחיל ב" ייצא מהמסך; 0.20 משאיר
       שוליים גם אם הגופן נרנדר רחב יותר. */
    exit: 0.20,
    pause: 0.05,          /* נשימה בין יציאת השורה לכניסת הערכים */
    /* המפה נכנסת **יחד** עם הגעת המילה למרכז, ולכן הפייד שלה
       נגמר בדיוק בנקודת הנעילה ולא אחריה. */
    mapLead: 0.30, mapRise: 0.15,
    /* כל ערך: כניסה, החזקה, יציאה. הסכום הוא slot בדיוק, ולכן
       היוצא נגמר באותו פיקסל שבו הבא מתחיל. */
    /* אין כאן enter ואין slot. שניהם נגזרים מהמרחק שנמדד
       ב-measure(), בדיוק כמו M.slideIn ו-deepSched של .deep:
       כך משך הכניסה בפיקסלים שווה למרחק בפיקסלים, וכל פיקסל
       גלילה הוא פיקסל תזוזה. שני מספרים מוקלדים נפרדים —
       0.55 מרוחב ו-0.25 מגובה — נתנו 1.095 ב-378×765, כלומר
       הערכים רצו 9.5% מהר יותר מהאצבע, וסטו עם יחס המסך. */
    hold: 0.30, out: 0.15,
    tail: 0.45            /* זנב אחרי האחרון, לפני שהבמה משתחררת */
  };

  /* ── עוזרים ───────────────────────────────────────────────── */
  var clamp01 = function (n) { return n < 0 ? 0 : n > 1 ? 1 : n; };
  /* כותב תנוחה ואטימות בפעימה אחת. גם visibility ולא רק
     opacity: אלמנט שקוף עדיין מצויר ועדיין נקרא בקורא מסך. */
  function paint(el, dx, dy, o) {
    if (!el) return;
    el.style.transform  = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    el.style.opacity    = o.toFixed(3);
    el.style.visibility = o === 0 ? 'hidden' : 'visible';
  }
  /* יציאה רכה — מהיר בהתחלה, נוחת לאט. לכניסות ולנסיעה לצד. */

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: null };

  /* ── אלמנטים ──────────────────────────────────────────────── */
  var header  = document.getElementById('site-header');
  var dealbar = document.getElementById('dealbar');
  var loader  = document.getElementById('loader');
  var hero    = document.querySelector('.hero');
  var pinned  = document.getElementById('pinned');
  var process = document.getElementById('process');
  var rail    = document.getElementById('rail');
  var stage   = document.getElementById('stage');
  /* שלושת הפאנלים בנפרד — במובייל כל אחד מהם נע לבד */
  var railTitle  = rail ? rail.querySelector('.rail__panel--title')  : null;
  var railCenter = rail ? rail.querySelector('.rail__panel--center') : null;
  var railValues = rail ? rail.querySelector('.rail__panel--values') : null;
  var valuesBox  = rail ? rail.querySelector('.values') : null;
  var procMValues = rail
    ? Array.prototype.slice.call(rail.querySelectorAll('.values li'))
    : [];
  /* שלושת חלקי השורה הרצה במובייל, ועוד המפה שנכנסת מתחתיה */
  var procTitle  = document.querySelector('.process__title');
  var mapEyebrow = document.querySelector('.mapfig__eyebrow');
  var mapPlace   = document.querySelector('.mapfig__place');
  var mapSvg     = document.querySelector('.mapfig__svg');
  var heroInner = document.querySelector('.hero__inner');
  var heroHill  = document.getElementById('hero-hill');
  var deep      = document.getElementById('deep');
  var deepStage = document.getElementById('deep-stage');
  var deepLead  = document.getElementById('deep-lead');
  var deepSlidesBox = document.getElementById('deep-slides');
  var deepSlides = deep
    ? Array.prototype.slice.call(deep.querySelectorAll('.deep__slide'))
    : [];
  var after      = document.getElementById('after');
  var afterStage = document.getElementById('after-stage');
  var afterLead  = document.getElementById('after-lead');
  var afterStepsBox = document.getElementById('after-steps');
  var afterHill  = document.getElementById('after-hill');
  var afterHouse = after ? after.querySelector('.after__house') : null;
  var afterSteps = after
    ? Array.prototype.slice.call(after.querySelectorAll('.after__step'))
    : [];
  var toggle  = document.getElementById('nav-toggle');
  var menu    = document.getElementById('menu');
  var scrim   = document.getElementById('menu-scrim');
  /* מטרת ההקלדה: ההירו בעמוד הבית, או כל כותרת אחרת שמסומנת
     ב-data-typed. בעמוד הבית ה-span הזה הוא ילד ישיר של
     הכותרת, ולכן parentElement מחזיר בדיוק את אותו אלמנט
     ש-getElementById('hero-title') החזיר — התנהגות זהה. */
  var typed   = document.getElementById('hero-typed') ||
                document.querySelector('[data-typed]');
  var title   = typed ? typed.parentElement : null;

  /* ── מידות ב-cache ────────────────────────────────────────── */
  var M = {};

  /* כמה פיקסלים שווה 100vh בפועל. נמדד מאלמנט זמני ולא מחושב,
     כי רק הדפדפן יודע איך הוא פותר את היחידה. */
  var vhProbe;
  function cssVh() {
    if (!document.body) return window.innerHeight;
    if (!vhProbe) {
      vhProbe = document.createElement('div');
      vhProbe.style.cssText = 'position:absolute;top:0;left:0;width:0;' +
        'height:100vh;visibility:hidden;pointer-events:none';
    }
    document.body.appendChild(vhProbe);
    var h = vhProbe.offsetHeight;
    document.body.removeChild(vhProbe);
    return h || window.innerHeight;
  }

  function measure() {
    /* **לא** window.innerHeight. ב-iOS סרגל הכתובת נסגר ונפתח תוך
       כדי גלילה, innerHeight משתנה, ו-measure() מחשב מחדש את כל
       המרחקים — האלמנטים קופצים בלי ששום דבר נגלל. נמדד בסימולציה
       של +99px, בלי גלילה כלל: שלבי .after זזו 359px, שקף המשפך
       199px, והאטימות שלו קפצה ב-0.74 בפריים אחד.
       ‏CSS vh אינו משתנה עם הסרגל, וכל הסקשנים מוגדרים בו — ולכן
       זה המספר שמשאיר את הלוח והפריסה מסונכרנים. */
    var vh = cssVh();

    M.vh = vh;
    M.fxOn = window.innerWidth >= MIN_FX_WIDTH && !reduceMotion.matches;

    if (process) {
      M.processTop = process.offsetTop;
      M.processTravel = Math.max(1, process.offsetHeight - vh);
    }
    /* כמה הרכבת צריכה לנסוע כדי שהפאנל האחרון ייכנס למסך */
    M.railTravel = (rail && stage) ? Math.max(0, rail.scrollWidth - stage.clientWidth) : 0;

    /* איפה בדיוק נגמרת גלולת ה-header — משם הבורר נצמד.
       נמדד ולא מוקלד: גובה הגלולה נגזר מגודל הלוגו ומה-padding,
       ושניהם משתנים עם רוחב המסך. ה-8px הם ה"מרווח הקל". */
    if (dealbar && header) {
      var bar = header.querySelector('.header-bar');
      var top = (parseFloat(getComputedStyle(header).paddingTop) || 0) +
                (bar ? bar.getBoundingClientRect().height : 0) + 8;
      dealbar.style.setProperty('--bar-top', Math.round(top) + 'px');
    }

    /* איפה על המסלול הרכבת עוצרת והפייד אאוט מתחיל */
    M.railEnd = PHASE.rail / (PHASE.rail + PHASE.exit);

    /* ── מובייל · הבמה הנעוצה ──────────────────────────────
       רק מתחת ל-768. בין 768 ל-1199 הסקשן נשאר ערימה סטטית,
       ומ-1200 ומעלה רצה הרכבת האופקית במקום. */
    M.procMOn = window.innerWidth < 768 && !reduceMotion.matches &&
                !!(process && stage && rail &&
                   procTitle && mapEyebrow && mapPlace);
    if (M.procMOn) {
      M.procMTop = process.offsetTop;
      /* המרחק שערך צריך לעבור כדי להיכנס מקצה המסך — הקצה
         הימני של העמודה שלו. נמדד מה-DOM ולא מוקלד, בדיוק כמו
         M.slideIn של .deep. ממנו נגזרים גם משך הכניסה וגם אורך
         המשבצת, ולכן הקצב הוא 1:1 מול האצבע בכל יחס מסך —
         אותו קצב בדיוק כמו השקפים של .deep. */
      M.procMSlide = railValues
        ? Math.round(railValues.getBoundingClientRect().right)
        : Math.round(window.innerWidth * 0.9);
      M.procMEnter = M.procMSlide / vh;
      M.procMSlot  = M.procMEnter + PROC_M.hold + PROC_M.out;

      /* מודדים בלי ה-transform שכבר מרוח עליהם. אין פריים
         ביניים — measure() ו-onScroll() רצים באותו task. */
      procTitle.style.transform = mapEyebrow.style.transform =
        mapPlace.style.transform = '';
      M.tW = procTitle.offsetWidth;
      M.eW = mapEyebrow.offsetWidth;
      M.pW = mapPlace.offsetWidth;
      /* הרווח בין הכותרת לתחילת המשפט. השבר שב-PROC_M הוא רק
         רצפה טיפוגרפית — הרווח **חייב** להיות לפחות המרחק
         מקצה המסך עד קצה הכותרת הממורכזת, אחרת "הכל מתחיל ב"
         מציץ בשמאל המסך כבר ברגע שהכותרת עומדת במקום.
         הקצה הימני שלו יוצא בדיוק (מרכז − רוחב_כותרת/2 − רווח),
         ולכן זו בדיוק הרצפה. ‏+8 כדי שגם overhang של הגופן
         לא יציץ. נגזר ולא מוקלד: ב-767 הכותרת גדולה פי 1.4
         ושם כל שבר קבוע היה נשבר. */
      M.gapPx = Math.max(
        Math.round(window.innerWidth * PROC_M.gap),
        Math.ceil(window.innerWidth / 2 - M.tW / 2) + 8
      );

      /* מרחק הריצה עד הנעילה — נגזר ולא מוקלד. הוא בדיוק
         המרחק בין מרכז הכותרת למרכז "בירמינגהם" בתוך השורה,
         ולכן ב-d=0 הכותרת ממורכזת, וב-d=lockD המילה ממורכזת.
         שינוי גופן או ניסוח מזיז את שתי הנקודות יחד. */
      M.lockD = Math.round(M.pW / 2 + M.eW + M.gapPx + M.tW / 2);
      M.lockU = M.lockD / vh;
      M.valuesStart = M.lockU + PROC_M.exit + PROC_M.pause;

      /* הערכים מוחלטים ולכן לא תורמים גובה למכל שלהם, והקו
         האנכי היה מתאפס. offsetHeight של אלמנט מוחלט שה-inline
         שלו קבוע הוא בדיוק גובה התוכן — אז מודדים ולא מקלידים. */
      if (valuesBox && procMValues.length) {
        var vMax = 0;
        procMValues.forEach(function (li) {
          if (li.offsetHeight > vMax) vMax = li.offsetHeight;
        });
        if (vMax) valuesBox.style.setProperty('--value-h', vMax + 'px');
      }
      /* חובה. measure() מוחק את ה-transform כדי למדוד רוחב נקי,
         ו-updateProcessMobile יוצא מוקדם כש-u לא השתנה — בלי
         האיפוס הזה השורה נשארת בתנוחת ה-CSS שלה, שלושת החלקים
         ערומים על left:0. קורה בכל resize: סיבוב מסך, וגם
         כיווץ שורת הכתובת בדפדפן הנייד. */
      M.procMU = undefined;
    }

    /* ── מסלול ה-deep ──────────────────────────────────────
       ההיסט של הכותרת נמדד ולא מקובע: קוראים את התנוחה
       הסופית מה-DOM ומחשבים כמה צריך להזיז אותה כדי שתשב
       במרכז המסך. כך שינוי ב-CSS (רוחב עמודה, top, גודל
       גופן) לא דורש נגיעה בשום מספר כאן. */
    M.deepOn = !reduceMotion.matches && !!(deep && deepStage && deepLead);
    if (M.deepOn) {
      /* נקודת האפס היא הרגע שהרכבת עוצרת — אותו פיקסל שבו
         המפה מתחילה לדהות. מתחת ל-1200 אין רכבת, ואז נשארים
         עם מסך אחד לפני ראש הסקשן. */
      /* מתחת ל-1200 סקשן הפרוצס הוא ערימה סטטית שלא דוהה,
         ולכן אי אפשר להתחיל מסך אחד מוקדם — הכותרת הייתה
         מופיעה על גבי רשימת הערכים שעדיין על המסך. שם
         נקודת האפס היא הרגע שהבמה נתפסת. */
      M.deepTop = (M.fxOn && process)
        ? M.processTop + M.processTravel * M.railEnd
        : deep.offsetTop;
      /* הרגע שבו הבמה משתחררת מהנעיצה. נקרא מה-DOM ולא
         מחושב מהפעימות, כך שהיציאה נכונה גם אם המספרים ינועו. */
      M.deepEnd = deep.offsetTop + deep.offsetHeight - vh;

      /* מודדים בלי ה-transform שכבר מרוח עליה. אין כאן פריים
         ביניים — measure() ו-onScroll() רצים באותו task.
         הכותרת fixed, ולכן ה-rect שלה כבר ביחס לחלון. */
      deepLead.style.transform = '';
      var lr = deepLead.getBoundingClientRect();
      /* תנוחת ההמתנה: הצד השני של המסך, באותו מרחק מהקצה
         בדיוק. המרחק נמדד מהתנוחה הסופית ולא מוקלד, ולכן
         שינוי ה-11vw ב-CSS מזיז את שתי התנוחות יחד.
         מתחת ל-1200 אין עמודות שמאל/ימין ואין רכבת, ולכן אין
         גם נסיעה אופקית — שם הכותרת רק עולה לראש המסך. */
      var edge = window.innerWidth - lr.right;
      /* בדסקטופ הנסיעה אופקית טהורה: הכותרת כבר ממורכזת אנכית
         ב-CSS, ולכן אין לה מה לזוז ב-Y. מתחת ל-1200 הפוך —
         אין עמודות, והנסיעה היחידה היא מהמרכז לראש המסך. */
      M.leadDx = M.fxOn ? Math.round(edge - lr.left) : 0;
      M.leadDy = M.fxOn ? 0 : Math.round(vh / 2 - (lr.top + lr.height / 2));

      /* גובה הטקסטים.
         בדסקטופ הם בצד הנגדי לכותרת ועוברים דרכה בנסיעה,
         ולכן הם מעליה — לא מתחתיה — ומה שנשאר למטה הוא
         שטח התמונה.
         במובייל אין צדדים: הכותרת עולה מהמרכז לראש המסך
         ועוברת דרך האזור הזה, ולכן הם יורדים מתחת לתנוחה
         הנמוכה שלה. הגובה נמדד ולא מוקלד, כי הוא נגזר
         מ---fs-process. */
      if (deepSlidesBox) {
        deepSlidesBox.style.top = M.fxOn
          ? Math.round(vh * DEEP_TEXT_TOP) + 'px'
          : Math.round(lr.bottom + vh * DEEP_GAP) + 'px';
      }

      /* ── מרכוז האינפוגרפיקה מול הטקסט שמעליה ────────────
         הטקסט מיושר לימין ומשונן משמאל, ולכן מרכז המסה שלו
         יושב ימינה ממרכז העמודה. גרפיקה שתופסת את מלוא הרוחב
         נראית לכן מוסטת שמאלה — 33px בשקף של ציר הזמן.

         התיקון הוא שוליים בצד השמאלי (inline-end ב-RTL) בגודל
         המרווח שהטקסט מותיר שם, כך שהקצה השמאלי של הגרפיקה
         נופל על השורה הארוכה ביותר. הקצה הימני לא זז, והמרכזים
         מתלכדים. נמדד ולא מוקלד, כי הוא תלוי במלל ובגופן.

         ההפרש בין שני ה-rect חסין ל-transform של ההורה: שניהם
         נמדדים באותה מערכת. */
      deepSlides.forEach(function (el) {
        var fig = el.querySelector('.deep__fig');
        var txt = el.querySelector('.deep__text');
        if (!fig || !txt) return;
        fig.style.marginInlineEnd = fig.style.marginInlineStart = '';
        var fr = fig.getBoundingClientRect(), edge = Infinity, rng = document.createRange();
        [].forEach.call(txt.children, function (c) {
          rng.selectNodeContents(c);
          [].forEach.call(rng.getClientRects(), function (q) {
            if (q.width > 0 && q.height > 0) edge = Math.min(edge, q.left);
          });
        });
        if (edge !== Infinity) {
          /* gap הוא הרווח שהטקסט מותיר משמאל, וההיסט הדרוש
             למרכוז הוא חציו. */
          var gap = Math.max(0, Math.round(edge - fr.left));
          var d   = Math.round(gap / 2);
          if (M.fxOn) {
            /* בדסקטופ מזיזים ולא מצמצמים: שוליים חיוביים משמאל
               ושליליים מימין באותו גודל. הרוחב נשמר, שני הקצוות
               זזים ימינה יחד. הגרפיקה חורגת מקצה העמודה ימינה,
               אבל הקו האנכי של הטקסט משתרע רק לגובה הטקסט ולכן
               אין שם מה להתנגש. */
            fig.style.marginInlineEnd   = d + 'px';
            fig.style.marginInlineStart = -d + 'px';
          } else {
            /* במובייל אין לאן לחרוג — הגרפיקה כבר 84vw. שם
               מצמצמים משמאל, עם תקרה של 10%: המשפך יושב על
               הגבול, וצמצום גדול יותר הוציא את הטקסט מהרצועות. */
            fig.style.marginInlineStart = '';
            fig.style.marginInlineEnd =
              Math.min(Math.round(fr.width * 0.10), gap) + 'px';
          }
        }
      });

      /* ── קצב הכניסה, זהה ל"איך אנחנו עושים את זה?" ──────
         שם הבמה דוהה לינארית לאורך PROCESS_FADE מסכים, ובו
         בזמן נגללת מעלה בדיוק אותו מספר פיקסלים — כי היא
         פשוט נכנסת עם הגלילה, 1:1 מול האצבע.
         לכן כאן: אותו אורך חלון, אותו מרחק, ולינארי.
         שני המספרים נגזרים מ-PROCESS_FADE ולא מוקלדים, כך
         ששינוי שם מזיז את שתי הכניסות יחד. */
      /* בדסקטופ נקודת האפס היא מסך לפני ראש הסקשן, ובאותם
         0.30 מסך הראשונים המפה עדיין דוהה — כלומר משהו קורה.
         במובייל הפרוצס הוא ערימה סטטית והמסלול מתחיל בנעיצה,
         ולכן אותם 0.30 היו 244px של גלילה בלי שום שינוי. */
      M.leadFadeFrom = M.fxOn ? DEEP_FADE_FROM : 0;
      M.leadFadeSpan = PROCESS_FADE;
      M.leadRise = Math.round(vh * PROCESS_FADE);

      /* הקצה הימני של תיבת הטקסטים = המרחק שהיא צריכה לנסוע
         כדי להיכנס מקצה המסך. נמדד ולא מוקלד: משתנה עם 36vw
         בדסקטופ ו-84vw במובייל. */
      M.slideIn = deepSlidesBox
        ? Math.round(deepSlidesBox.getBoundingClientRect().right)
        : Math.round(window.innerWidth * 0.5);

      var d = DEEP_VH;
      /* העלייה נגמרת בסוף חלון הפייד, לא ב-u=1. אם מתחילים
         את הנסיעה ב-1 נוצר מקטע שבו הכותרת כבר במקומה ורק
         עומדת — 0.20 מסך של גלילה מתה. */
      var riseEnd = M.leadFadeFrom + M.leadFadeSpan;
      /* אורך הנסיעה לצד = המרחק שהיא עוברת, בפיקסלים. כך כל
         פיקסל גלילה הוא פיקסל תזוזה — 1:1 מול האצבע, בדיוק
         כמו הרכבת שמעליה. גם העלייה כבר 1:1 (leadRise שווה
         לאורך החלון שלה), ולכן כל התנועה בקצב אחד רציף. */
      M.parkDist = Math.max(Math.abs(M.leadDx), Math.abs(M.leadDy));
      var parkVh = M.parkDist / vh;
      M.deepPh = {
        riseEnd: riseEnd,                      /* נחתה בצד שמאל */
        holdEnd: riseEnd + d.hold,             /* מתחילה לנסוע ימינה */
        parkEnd: riseEnd + d.hold + parkVh     /* הגיעה לעמודה הימנית */
      };

      /* ── לוח הזמנים של הטקסטים ──────────────────────────
         הראשון נכנס בדיוק בחלון של הנסיעה: אותה התחלה, אותו
         סוף, אותו מרחק — ולכן גם אותו קצב 1:1. השאר נכנסים
         בקצב שלהם, כל אחד מתחיל בחפיפה קלה על יציאת הקודם. */
      /* בדסקטופ הטקסט הראשון נכנס במקביל לנסיעה של הכותרת,
         כי הם בשני צדדים של המסך. במובייל אין צדדים: הכותרת
         עולה מהמרכז לראש המסך ועוברת דרך המקום של הטקסט,
         ולכן שם הוא מתחיל רק אחרי שהיא נעצרה. אחרת הטקסטים
         היו חייבים לרדת מתחת לתנוחה הממורכזת שלה, ובמסכים
         קטנים האינפוגרפיקה כבר לא נכנסת מתחתם. */
      var T = DEEP_TEXT, t = M.fxOn ? M.deepPh.holdEnd : M.deepPh.parkEnd;
      M.deepSched = deepSlides.map(function (el, i) {
        /* 1:1 עם הגלילה, כמו הכותרת: משך הכניסה במסכים שווה
           למרחק בפיקסלים חלקי גובה המסך. הראשון נוסע parkDist,
           השאר slideIn — קצב זהה, מרחק שונה. */
        var enter = (i === 0 ? M.parkDist : M.slideIn) / vh;
        /* היוצא נעלם במקום, בלי תזוזה, ובאותו חלון קצר שבו הנכנס
           נדלק. הבא מתחיל להיכנס בדיוק ברגע שזה מתחיל להיעלם,
           ולכן אין ולו פיקסל אחד שבו אף אינפוגרפיקה לא על המסך. */
        var row = { from: t,                          /* מתחיל לנוע */
                    full: t + enter,                  /* הגיע למקומו */
                    fade: t + enter + T.hold,         /* מתחיל להיעלם */
                    gone: t + enter + T.hold + T.fadeOut };
        t = row.fade;   /* חפיפה מכוונת: היוצא כבה בזמן שהבא נכנס */
        return row;
      });
      M.deepU = undefined;   /* מכריח ציור מחדש אחרי מדידה */
    }

    /* ── AFTER ────────────────────────────────────────────────
       הכותרת עולה מלמטה ונעצרת, ואז ארבעת השלבים עולים אחד־אחד.
       אותם קצבים של .deep: העלייה 1:1 עם הגלילה, לינארית, והאור
       נדלק מהר בתחילתה כדי שהתנועה תיעשה כשהטקסט כבר מואר. */
    M.afterOn = !reduceMotion.matches && !!(after && afterStage && afterLead);
    if (M.afterOn) {
      /* נקודת האפס היא הרגע שהבמה נתפסת, ולא מסך לפניו: התוכן
         כאן absolute בתוך הבמה, ולכן לפני הנעיצה הוא עדיין מתחת
         לקצה התחתון של המסך ולא היה נראה בכלל. */
      M.afterTop = after.offsetTop;
      M.afterEnd = after.offsetTop + after.offsetHeight - vh;
      /* המרחק שכל שלב עולה. נמדד מגובה השלב עצמו כדי שהוא יתחיל
         בדיוק מתחת לקצה התחתון שלו ולא ממספר שרירותי. */
      /* בדסקטופ השלב עולה מלמטה — המרחק נגזר מגובהו. במובייל
         הוא נכנס משמאל, ואז המרחק הוא הקצה הימני של הערימה:
         הוא מתחיל כשקצהו הימני נוגע בקצה השמאלי של המסך, ולכן
         כל פיקסל של גלילה הוא פיקסל של תנועה שרואים — בדיוק
         כמו הטקסטים ב-.deep. */
      var st = afterSteps[0];
      M.stepRise = st ? Math.round(st.getBoundingClientRect().height + vh * 0.06) : 80;
      M.stepSlide = afterStepsBox
        ? Math.round(afterStepsBox.getBoundingClientRect().right) : 0;
      M.stepDist = M.fxOn ? M.stepRise : M.stepSlide;

      /* פעימה קצרה אחרי הנעיצה, כדי שהכותרת תיקרא לפני שהשלב
         הראשון מתחיל לעלות. */
      var t0 = AFTER_LEAD_HOLD;
      M.afterSched = afterSteps.map(function (el, i) {
        var d = M.stepDist / vh;               /* 1:1 */
        var row = { from: t0, full: t0 + d };
        t0 = row.full + AFTER_GAP;
        return row;
      });

      /* ── טיפוס הגבעה ──────────────────────────────────────
         אחרי שהשלב האחרון התיישב ונקרא, הגבעה מטפסת מלמטה ומכסה
         את המלל. המלל לא זז ולא דוהה — הוא נחסם, כמו הכותרת
         בהירו. המרחק הוא מסך מלא ועוד רדיוס הקימור, כדי שגם
         העיקול יעבור את הקצה העליון והמסך יישאר bone אחיד. */
      M.hillR = afterHill
        ? parseFloat(getComputedStyle(afterHill).borderTopLeftRadius.split(' ').pop())
        : 0;
      /* הבית יושב מעל קצה הגבעה, ולכן אם הגבעה מתחילה בדיוק מתחת
         לקצה המסך — הבית כבר בתוכו. דוחפים את שניהם למטה בגובה
         הבית, ומוסיפים אותו גם למרחק הטיפוס. */
      M.houseH = afterHouse
        ? Math.round(afterHouse.getBoundingClientRect().height) : 0;
      M.hillClimb = Math.round(vh + M.hillR + M.houseH);
      M.climbSpan = M.hillClimb / vh;
      /* הטיפוס חייב להסתיים **לפני** שהבמה משתחררת מהנעיצה.
         אחרת נפתח חלון שבו שתי תנועות של 1:1 מצטברות: הדף כבר
         מגלגל את הבמה מעלה, וה-JS עוד מטפס בתוכה — והגבעה עם
         הבית זזות פי שניים מהאצבע. נמדד 8 פיקסלים בקצב 2.0
         בדיוק בנקודת השחרור, וזו הקפיצה של הבית.
         הרגע נגזר מגובה הסקשן ולא מלוח השלבים, ולכן הוא נכון
         גם אם המספרים שמעליו ינועו. */
      /* ‏-4px: בפיקסל השחרור עצמו ה-sticky עובר ממצב נעוץ לזורם,
         והעיגול ב-Math.round משאיר שם עוד פריים בקצב 1.8.
         שוליים של 4 פיקסלים מרחיקים את סוף הטיפוס מהתפר. */
      var releaseU = (after.offsetHeight - vh - 4) / vh;
      M.climbFrom = Math.min(t0 - AFTER_GAP + AFTER_HOLD,
                             releaseU - M.climbSpan);          /* 1:1 עם הגלילה */
      M.afterU = undefined;
    }

    /* ה-hero הנעוץ בכל הרוחבים. טווח הנעיצה = כל מה שמעבר
       לגובה מסך אחד, וזה בדיוק המרחק שהגבעה מטפסת — יחס 1:1
       מול האצבע. בסופו ראש הסקשן הבא נוגע בתחתית המסך. */
    M.heroPin = !reduceMotion.matches && !!hero;
    if (M.heroPin) M.heroClimb = Math.max(1, hero.offsetHeight - vh);

    /* גבהי מסך → פיקסלים. זה הרגע היחיד שבו ההמרה קורית,
       והיא מתרעננת בכל resize, ולכן היחסים נשמרים תמיד. */
    var A = window.innerWidth >= 768 ? PINNED_VH_DESKTOP : PINNED_VH_MOBILE;
    M.pin = {
      start:       A.start       * vh,
      centerStart: A.centerStart * vh,
      centerEnd:   A.centerEnd   * vh,
      end:         A.end         * vh
    };
  }

  /* ── 01 · Header נדבק ─────────────────────────────────────── */
  function updateHeader(y) {
    if (!header) return;
    var stuck = y > STICK_AT;
    if (stuck !== M.stuck) {
      M.stuck = stuck;
      header.classList.toggle('is-stuck', stuck);
      /* בורר העסקאות מתכווץ עם ההאדר מאותו סף בדיוק, ולכן
         שניהם נקראים כגוף אחד ולא כשתי תנועות נפרדות. */
      if (dealbar) dealbar.classList.toggle('is-stuck', stuck);
    }
  }

  /* ── 02 · המשפט הנעוץ ─────────────────────────────────────── *
   * ארבע נקודות עוגן. ה-hold באמצע הוא מה שגורם למשפט
   * להרגיש "נעצר" בלי scroll-jacking אמיתי.                    */
  function updatePinned(y) {
    if (!pinned) return;

    /* ב-reduced-motion ה-CSS הופך את המשפט לבלוק סטטי גלוי
       (`.pinned{opacity:1!important;position:static}`). אם נמשיך
       לכתוב כאן inline style, ה-visibility יסתיר אותו למרות ה-!important —
       הוא תכונה אחרת ו-!important על opacity לא מגן עליו. */
    if (reduceMotion.matches) {
      if (M.pinOpacity !== undefined) {
        pinned.style.opacity = '';
        pinned.style.visibility = '';
        M.pinOpacity = undefined;
      }
      return;
    }

    var p = M.pin, o;

    if (y < p.start)            o = 0;
    else if (y <= p.centerStart) o = (y - p.start) / (p.centerStart - p.start);
    else if (y <= p.centerEnd)   o = 1;
    else if (y <= p.end)         o = 1 - (y - p.centerEnd) / (p.end - p.centerEnd);
    else                         o = 0;

    o = clamp01(o);
    if (o !== M.pinOpacity) {
      M.pinOpacity = o;
      pinned.style.opacity = o.toFixed(3);
      pinned.style.visibility = o === 0 ? 'hidden' : 'visible';
    }
  }

  /* ── 03 · הרכבת האופקית ────────────────────────────────────── *
   * גלילה אנכית → תנועה אופקית. הפאנלים — הכותרת, המפה
   * ורשימת הערכים — נעים כגוש אחד; לאף אחד מהם אין תנועה משלו. */
  function updateRail(y) {
    if (!M.fxOn || !process || !rail) return;

    var p = clamp01((y - M.processTop) / (M.processTravel * M.railEnd));
    if (p !== M.pRail) {
      M.pRail = p;
      rail.style.transform = 'translateX(' + (M.railTravel * p) + 'px)';
    }
  }

  /* ── 04 · ה-hero הנעוץ + טיפוס הגבעה ───────────────────────── *
   * ה-CSS מחזיק את הכותרת במקום (position:sticky). כאן הגבעה
   * מטפסת מעליה ומכסה אותה — הכותרת לא דוהה, היא נחסמת.
   * מרחק הטיפוס = טווח הנעיצה, כלומר יחס 1:1 מול הגלילה.        */
  function updateHeroPin(y) {
    if (!heroHill) return;

    if (!M.heroPin) {
      if (M.hillY !== undefined) { heroHill.style.transform = ''; M.hillY = undefined; }
      return;
    }

    var p = clamp01((y - hero.offsetTop) / M.heroClimb);
    var px = -Math.round(p * M.heroClimb);

    if (px !== M.hillY) {
      M.hillY = px;
      heroHill.style.transform = 'translate3d(0,' + px + 'px,0)';
    }
  }

  /* ── 05 · פייד כניסה ויציאה לסקשן התהליך ───────────────────── *
   * כניסה: התוכן עולה מ-0 ל-1 בזמן שהסקשן נכנס למסך. הרקע כהה
   * משני הצדדים, ולכן בלי זה הכותרת פשוט מופיעה בבת אחת.
   * יציאה: אחרי שהרכבת עוצרת, הבמה **עדיין נעוצה** ודוהה
   * במקומה. זה ההבדל בין "נעלמת בפייד" לבין "נגללת מעלה",
   * ולכן הפעימה הזו חייבת להישאר בתוך טווח הנעיצה.            */
  function updateProcessFade(y) {
    if (!stage || !M.processTop) return;

    /* במובייל הבמה נעוצה ומצוירת אלמנט־אלמנט ב-updateProcessMobile,
       ולכן הבמה עצמה נשארת אטומה — פייד נוסף עליה היה מכפיל
       את הדהייה ומחשיך גם את הכותרת שכבר נחתה. */
    if (M.procMOn) {
      if (M.stageOpacity !== undefined) {
        M.stageOpacity = undefined;
        stage.style.opacity = stage.style.visibility = '';
      }
      return;
    }

    var span = M.vh * PROCESS_FADE;
    var from = M.processTop - span;          /* מתחיל לפני שהסקשן נעצר */
    var o = clamp01((y - from) / span);

    /* היציאה רק כשהמסלול האופקי פעיל. מתחת ל-1200 הסקשן הוא
       ערימה סטטית ארוכה, והעלמתו בסופה הייתה מוחקת את רשימת
       הערכים בזמן שהיא עדיין מול העיניים. */
    if (M.fxOn) {
      var p = clamp01((y - M.processTop) / M.processTravel);
      if (p > M.railEnd) {
        o = Math.min(o, clamp01(1 - (p - M.railEnd) / (1 - M.railEnd)));
      }
    }

    if (o !== M.stageOpacity) {
      M.stageOpacity = o;
      stage.style.opacity = o.toFixed(3);
      stage.style.visibility = o === 0 ? 'hidden' : 'visible';
    }
  }

  /* ── 05ב · מובייל · השורה הרצה של סקשן התהליך ────────────── *
   * שורה אחת גדולה נעה ימינה 1:1 מול האצבע:
   *   [בירמינגהם, אלבמה] [הכל מתחיל ב] [איך אנחנו עושים את זה?]
   * ‏(ב-RTL הראשון לקריאה הוא הימני, ולכן הכותרת בקצה הימני
   * והמילה שנועדה להיעצר בקצה השמאלי.)
   * כשהמילה מגיעה למרכז היא ננעלת שם והמפה נכנסת מתחתיה,
   * ושאר החלקים ממשיכים ימינה ויוצאים מהמסך. אחר כך מתחלפים
   * שלושת הערכים מתחת למפה, אחד בכל פעם, כל אחד משמאל.
   * u = כמה מסכים נגללו מאז שראש הסקשן נגע בראש החלון.        */
  function updateProcessMobile(y) {
    if (!M.procMOn) {
      /* יציאה נקייה כשעוברים לדסקטופ או ל-reduced-motion:
         מוחקים כל inline style, אחרת ה-!important שב-CSS
         היה נאבק בערכים שנשארו מהמצב הקודם. */
      if (M.procMU !== undefined) {
        [procTitle, mapEyebrow, mapPlace, mapSvg, railValues]
          .forEach(function (el) {
            if (el) el.style.transform = el.style.opacity =
                    el.style.visibility = '';
          });
        procMValues.forEach(function (el) {
          el.style.transform = el.style.opacity = el.style.visibility = '';
        });
        M.procMU = undefined;
      }
      return;
    }

    /* אותו שער. הכניסה מתחילה titleFrom מסכים לפני ראש הסקשן,
       ולכן הגבול העליון נגזר ממנו ולא ממסך שרירותי. */
    if (y < M.procMTop - (PROC_M.titleFrom + 0.3) * M.vh ||
        y > M.procMTop + M.processTravel + M.vh) {
      if (M.procMU !== undefined) {
        [procTitle, mapEyebrow, mapPlace, mapSvg, railValues]
          .forEach(function (el) {
            if (el) el.style.transform = el.style.opacity =
                    el.style.visibility = '';
          });
        procMValues.forEach(function (el) {
          el.style.transform = el.style.opacity = el.style.visibility = '';
        });
        M.procMU = undefined;
      }
      return;
    }

    var u = (y - M.procMTop) / M.vh;
    if (u === M.procMU) return;
    M.procMU = u;

    var P = PROC_M, vh = M.vh, vw = window.innerWidth, cx = vw / 2;

    /* ── הכניסה ──
       השורה כולה עולה מלמטה ונדלקת. בשלב הזה רק הכותרת בתוך
       המסך — שני החלקים האחרים עדיין משמאל לו, מחוץ לתמונה. */
    var q = clamp01((u + P.titleFrom) / P.titleFrom);
    var ry = Math.round((1 - q) * P.titleRise * vh);

    /* ── הריצה ──
       d = מרחק הריצה בפיקסלים, 1:1 מול הגלילה.
       vpx הוא המיקום ה"וירטואלי" של המילה — הוא ממשיך לגדול
       גם אחרי הנעילה, וזה בדיוק מה שממשיך להזיז את שאר
       החלקים ימינה בזמן שהיא עצמה עומדת. */
    var d   = Math.max(0, u) * vh;
    var vpx = cx - M.pW / 2 + (d - M.lockD);
    var px  = Math.min(vpx, cx - M.pW / 2);   /* ננעל במרכז */
    var ex  = vpx + M.pW;                     /* "הכל מתחיל ב", צמוד */
    var tx  = ex + M.eW + M.gapPx;            /* הכותרת, אחריו */

    /* מכבים ברגע שיצאו מהמסך ולא רק סומכים על ה-overflow:
       שכבה מורכבת אלפי פיקסלים מחוץ למסך עדיין עולה בקומפוזיטור. */
    paint(mapPlace,   Math.round(px), ry, q);
    paint(mapEyebrow, Math.round(ex), ry, ex > vw ? 0 : q);
    paint(procTitle,  Math.round(tx), ry, tx > vw ? 0 : q);

    /* ── המפה ──
       נכנסת יחד עם הגעת המילה למרכז: הפייד נגמר בדיוק ב-lockU. */
    var mq = clamp01((u - (M.lockU - P.mapLead)) / P.mapLead);
    paint(mapSvg, 0, Math.round((1 - mq) * P.mapRise * vh), mq);

    /* מכל הערכים נדלק באותו קצב כמו הערך הראשון — הוא נושא
       את הקו האנכי, וקו שנדלק בבת אחת נקרא כקפיצה. */
    paint(railValues, 0, 0, clamp01((u - M.valuesStart) / M.procMEnter));

    /* ── שלושת הערכים ── */
    var last = procMValues.length - 1;
    procMValues.forEach(function (el, i) {
      var from = M.valuesStart + i * M.procMSlot;
      var full = from + M.procMEnter;
      var fade = full + P.hold;
      var sx = -M.procMSlide, o = 0, e;

      if (u <= from)     { sx = -M.procMSlide; o = 0; }
      else if (u < full) { e = (u - from) / M.procMEnter;
                           sx = Math.round((1 - e) * -M.procMSlide);
                           o = e; }
      else               { sx = 0; o = 1; }

      /* האחרון לא יוצא — הוא מחזיק עד שהבמה משתחררת, אחרת
         הגלילה האחרונה הייתה על מסך ריק. */
      if (i !== last && u >= fade) {
        o = u >= fade + P.out ? 0 : 1 - (u - fade) / P.out;
      }
      paint(el, sx, 0, clamp01(o));
    });
  }

  /* ── 06 · סקשן ה-deep ──────────────────────────────────────── *
   * הכותרת: עולה מלמטה למרכז, עומדת, ואז נוסעת אל התנוחה
   * שכתובה ב-CSS ונשארת שם. הטקסטים: כל אחד נכנס משמאל
   * בפייד אין, מחזיק, ודוהה במקום לפני שהבא מגיע.
   * u = כמה מסכים נגללו מאז שראש הסקשן נגע בראש החלון.        */
  function updateDeep(y) {
    if (!deepLead) return;

    /* ב-reduced-motion ה-CSS פורש את הסקשן כערימה סטטית עם
       !important. אם נמשיך לכתוב inline style, ה-visibility
       יסתיר אותו למרות זה — הוא תכונה אחרת. לכן יציאה מוקדמת. */
    if (!M.deepOn) {
      if (M.deepU !== undefined) {
        deepLead.style.transform = deepLead.style.opacity =
          deepLead.style.visibility = '';
        deepSlides.forEach(function (el) {
          el.style.transform = el.style.opacity = el.style.visibility = '';
        });
        if (deepSlidesBox) deepSlidesBox.style.top = deepSlidesBox.style.transform = '';
        M.deepU = undefined;
      }
      return;
    }

    /* מחוץ לטווח — מאפסים פעם אחת ויוצאים, בדיוק כמו updateAfter.
       בלי זה הכותרת והשקפים ממשיכים לקבל transform חדש בכל פריים
       עד תחתית העמוד: הם fixed, opacity 1, ועם will-change — כלומר
       שכבות קומפוזיטור חיות — והתנועה שלהם רצה מעל האנימציה של
       .after. נמדד: ב-12948 הם עוד נדחפו ל--4480px.
       ה-top של תיבת השקפים לא מתאפס כאן בכוונה: הוא נכתב פעם
       אחת ב-measure() ולא היה נכתב מחדש עד ה-resize הבא. */
    if (y < M.deepTop - M.vh || y > M.deepEnd + M.vh) {
      if (M.deepU !== undefined) {
        deepLead.style.transform = deepLead.style.opacity =
          deepLead.style.visibility = '';
        deepSlides.forEach(function (el) {
          el.style.transform = el.style.opacity = el.style.visibility = '';
        });
        if (deepSlidesBox) deepSlidesBox.style.transform = '';
        M.deepU = undefined;
      }
      return;
    }

    var u = (y - M.deepTop) / M.vh;
    if (u === M.deepU) return;
    M.deepU = u;

    /* ── הכותרת ──
       עד ph.riseEnd היא עולה מלמטה אל תנוחת ההמתנה ודוהה פנימה
       על אותו טווח. לינארי ובאותו מרחק כמו הכניסה של
       "איך אנחנו עושים את זה?" — ראה measure(). */
    var ph = M.deepPh, dx = M.leadDx, dy = M.leadDy, o = 1, q;

    if (u < ph.riseEnd) {
      q = clamp01((u - M.leadFadeFrom) / M.leadFadeSpan);
      o = q;
      dy += Math.round((1 - q) * M.leadRise);
    } else if (u >= ph.holdEnd && u < ph.parkEnd) {
      /* לינארי, בלי שום עקומה: הפעימה נמשכת בדיוק כאורך
         המרחק, ולכן זה 1:1 מול האצבע — כמו הרכבת. כל האטה
         בקצה הייתה שוברת את היחס הזה. */
      q = (u - ph.holdEnd) / (ph.parkEnd - ph.holdEnd);
      dx = Math.round(dx * (1 - q));
      dy = Math.round(dy * (1 - q));
    } else if (u >= ph.parkEnd) {
      dx = dy = 0;
    }

    /* הכותרת fixed, ולכן היא לא נגללת החוצה מעצמה בסוף
       המסלול. מכאן ואילך מזיזים אותה מעלה בדיוק כמו הגלילה,
       כדי שהיא תעזוב את המסך יחד עם הבמה ועם הטקסטים. */
    if (y > M.deepEnd) dy -= Math.round(y - M.deepEnd);

    deepLead.style.transform  = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    deepLead.style.opacity    = clamp01(o).toFixed(3);
    deepLead.style.visibility = o === 0 ? 'hidden' : 'visible';

    /* ── הטקסטים ──
       גם הם fixed, ולכן גם הם לא נגללים החוצה מעצמם. היציאה
       מוחלת על המיכל, וכך היא לא מתנגשת ב-translateX של
       הטקסט הבודד שרץ בתוכו. */
    if (deepSlidesBox) {
      deepSlidesBox.style.transform = y > M.deepEnd
        ? 'translate3d(0,' + -Math.round(y - M.deepEnd) + 'px,0)'
        : '';
    }

    var last = deepSlides.length - 1;
    deepSlides.forEach(function (el, i) {
      var sc = M.deepSched[i];
      /* כולם נכנסים משמאל ימינה. הראשון עושה את זה לאורך אותו
         מרחק שהכותרת נוסעת, ולכן גם באותו קצב 1:1 ובאותו חלון
         בדיוק — הוא נע יחד איתה ועוצר כשהיא עוצרת. */
      var fromX = -(i === 0 ? M.parkDist : M.slideIn);
      var so = 0, sx = fromX, e;

      /* ── המיקום ──
         רץ על כל חלון הכניסה, בלי קשר לאטימות. */
      if (u <= sc.from)      sx = fromX;
      else if (u < sc.full) {
        e = (u - sc.from) / (sc.full - sc.from);
        /* לינארי לכולם — כל ריכוך שובר את ה-1:1 */
        sx = Math.round((1 - e) * fromX);
      } else sx = 0;   /* היוצא נשאר במקומו ורק נכבה */

      /* ── האטימות ──
         נדלקת מהר בתחילת הכניסה ואז נשארת 1 לכל אורך התנועה.
         מופרדת מהמיקום בכוונה: אם היא נמתחת על כל הכניסה,
         הטקסט זוחל פנימה דהוי במקום להיכנס מואר. */
      if (u <= sc.from)      so = 0;
      else if (u < sc.fade)  so = (u - sc.from) / DEEP_TEXT.fadeIn;
      else if (i === last)   so = 1;
      else if (u < sc.gone)  so = 1 - (u - sc.fade) / (sc.gone - sc.fade);
      else                   so = 0;

      so = clamp01(so);
      el.style.transform  = 'translate3d(' + sx + 'px,0,0)';
      el.style.opacity    = so.toFixed(3);
      el.style.visibility = so === 0 ? 'hidden' : 'visible';
    });
  }

  /* ── לולאת הגלילה — קריאה אחת ל-rAF לכל הפריים ────────────── */
  var ticking = false;

  /* ── AFTER ────────────────────────────────────────────────── */
  function updateAfter(y) {
    if (!M.afterOn) return;

    /* מחוץ לטווח — מאפסים פעם אחת ויוצאים. */
    if (y < M.afterTop - M.vh || y > M.afterEnd + M.vh) {
      if (M.afterU !== undefined) {
        if (afterHill) afterHill.style.transform = '';
        afterSteps.forEach(function (el) {
          el.style.transform = el.style.opacity = el.style.visibility = '';
        });
        M.afterU = undefined;
      }
      return;
    }

    var u = (y - M.afterTop) / M.vh;
    if (u === M.afterU) return;
    M.afterU = u;

    /* הכותרת לא מונפשת כלל — ראה .after__lead ב-CSS. */

    /* הגבעה מטפסת ומכסה. 1:1 ולינארי, כמו כל השאר בעמוד. */
    if (afterHill) {
      var c = clamp01((u - M.climbFrom) / M.climbSpan) * M.hillClimb;
      afterHill.style.transform =
        'translate3d(0,' + Math.round(M.houseH - c) + 'px,0)';
    }

    afterSteps.forEach(function (el, i) {
      var sc = M.afterSched[i], e, d = 0, so;
      if (u <= sc.from)      { d = M.stepDist; so = 0; }
      else if (u < sc.full)  {
        e  = (u - sc.from) / (sc.full - sc.from);   /* לינארי = 1:1 */
        d  = Math.round((1 - e) * M.stepDist);
        so = clamp01(e / AFTER_FADE_IN);
      }
      else { d = 0; so = 1; }
      /* בדסקטופ המרחק הוא Y, במובייל X.

         אין כאן גלילה־החוצה ידנית: השלבים הם absolute בתוך במה
         sticky, ולכן כשהבמה משתחררת הם נגללים איתה מעצמם. הוספת
         היסט משלנו הכפילה את הקצב — הם עפו מעלה בכפול מהעמוד
         ונתלשו מהכותרת, שאינה מונפשת כלל. */
      var sx = M.fxOn ? 0 : -d, sy = M.fxOn ? d : 0;
      el.style.transform  = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
      el.style.opacity    = so.toFixed(3);
      el.style.visibility = so === 0 ? 'hidden' : 'visible';
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      updateHeader(y);
      updateHeroPin(y);
      updatePinned(y);
      updateRail(y);
      updateProcessFade(y);
      updateProcessMobile(y);
      updateDeep(y);
      updateAfter(y);
      ticking = false;
    });
  }

  /* ── איפוס כשהאפקטים כבויים ───────────────────────────────── */
  function resetFx() {
    if (rail) rail.style.transform = '';
    M.pRail = undefined;
  }

  /* ── Resize — מדידה מחדש, לא חישוב בכל פריים ──────────────── */
  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasOn = M.fxOn;
      measure();
      if (wasOn && !M.fxOn) resetFx();
      onScroll();
    }, 150);
  }

  /* ── 06 · Loader + רצף הפתיחה ─────────────────────────────── *
   * 1. הלואדר מציג את המגן
   * 2. הוא דוהה והאתר נכנס ב-fade
   * 3. הכותרת מוקלדת
   *
   * ב-reduced-motion אין הקלדה כלל — הטקסט המלא כבר יושב
   * ב-HTML, אז פשוט לא נוגעים בו.                                */
  var INTRO = { typeMin: 22, typeMax: 46 };

  function bootLoader() {
    var reveal = function () {
      if (loader) loader.classList.add('is-done');
      document.body.classList.add('is-ready');
    };

    if (reduceMotion.matches) { reveal(); return; }

    /* בעמוד פנימי אין לואדר, ואין על מה לחכות — ההמתנה שם
       הייתה משאירה כותרת ריקה על המסך במשך שנייה וחצי. */
    setTimeout(function () {
      reveal();
      // מחכים שהאתר ייכנס ב-fade ואז מקלידים
      setTimeout(startTyping, 260);
    }, loader ? LOADER_MS : 0);
  }

  function startTyping() {
    if (!typed || !title) return;

    /* מכווץ רווחים וטאבים אבל משמר \n — השוברים נשלטים ב-CSS
       (white-space), כך שהם פעילים במובייל בלבד. */
    var text = typed.textContent
      .replace(/[ \t]+/g, ' ')
      .split('\n').map(function (l) { return l.trim(); }).join('\n')
      .replace(/^\n+|\n+$/g, '');

    /* נועלים את גובה הכותרת לפי הטקסט המלא כדי שההקלדה
       לא תזיז את הפריסה שורה-שורה. נמדד רק אחרי שהגופן נטען,
       אחרת הגובה יוצא שגוי. */
    var lock = function () {
      typed.textContent = text;
      title.style.setProperty('--title-h', title.getBoundingClientRect().height + 'px');
      title.classList.add('is-typing');
      typed.textContent = '';

      typeOut(text);
    };

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock);
    else lock();
  }

  /* הקלדה בקצב לא אחיד — רווחים איטיים יותר, בתוך מילה מהיר */
  function typeOut(text) {
    var i = 0;
    var step = function () {
      typed.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        // משחררים את נעילת הגובה — אחרת resize יישאר עם גובה ישן
        title.classList.remove('is-typing');
        title.style.removeProperty('--title-h');
        return;
      }
      var delay = INTRO.typeMin + Math.random() * (INTRO.typeMax - INTRO.typeMin);
      if (text.charAt(i - 1) === ' ') delay *= 1.6;
      setTimeout(step, delay);
    };
    step();
  }

  /* ── 07 · תפריט מסך מלא ───────────────────────────────────── */
  function bootMenu() {
    if (!toggle || !menu) return;

    var MENU_FADE = 340;   /* חייב להתאים ל-transition ב-CSS */
    var lockTimer;

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);

      /* נועלים את הגלילה רק אחרי שהשכבה כבר אטומה. נעילה בו-זמנית
         עם הפייד מחשבת מחדש את ה-sticky ומקפיצה את הרקע. */
      clearTimeout(lockTimer);
      if (open) {
        lockTimer = setTimeout(function () {
          document.body.classList.add('menu-locked');
        }, MENU_FADE);
      } else {
        document.body.classList.remove('menu-locked');
      }

      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      }
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });

    if (scrim) scrim.addEventListener('click', function () {
      setOpen(false);
      toggle.focus();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ── 08 · סימון הסקשן הפעיל בניווט ────────────────────────── */
  function bootCurrentLink() {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('.menu__list a'));
    var targets = links
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);
    if (!targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    targets.forEach(function (t) { io.observe(t); });
  }

  /* ── ממשק לפאנל השליטה ─────────────────────────────────────
     נחשף תמיד (זול, בלי תופעות לוואי). panel.js קורא דרכו,
     כותב, ואז מבקש ריענון — measure() מחשב מחדש ו-onScroll()
     מצייר. בלי זה שינוי ערך לא היה נראה עד הגלילה הבאה. */
  window.SC_MOTION = {
    get pin() { return { desktop: PINNED_VH_DESKTOP, mobile: PINNED_VH_MOBILE }; },
    get processFade() { return PROCESS_FADE; },
    set processFade(v) { PROCESS_FADE = v; },
    get deep() { return DEEP_VH; },
    refresh: function () {
      M.pinOpacity = M.hillY = M.stageOpacity = M.deepU = undefined;
      measure(); onScroll();
    }
  };

  /* ── Init ─────────────────────────────────────────────────── */
  measure();
  bootLoader();
  bootMenu();
  bootCurrentLink();
  onScroll();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('load', function () { measure(); onScroll(); });

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', function () {
      measure();
      if (!M.fxOn) resetFx();
      onScroll();
    });
  }
})();

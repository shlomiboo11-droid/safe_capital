/* ═══════════════════════════════════════════════════════════════
   deals.js — מושך את העסקאות מאדמין הפאנל

   שני צרכנים, אותו מקור:
     • עמוד הבית   — רשת הטיזרים (#deals-grid)
     • עמוד עסקאות — בורר + תצוגה אחת גדולה (#dealbar-list)

   ── למה זה בנוי כ"שדרוג" ולא כרינדור מלא ──
   הכרטיסים כבר יושבים ב-HTML עם נתונים אמיתיים. הסקריפט הזה
   רק **מחליף** אותם במה שיש עכשיו באדמין. המשמעות:

     • בלי JS, או אם ה-API נופל — עדיין רואים עסקאות אמיתיות
       ולא סקשן ריק.
     • תמונות לא כפופות ל-CORS (תגית img אף פעם לא), ולכן הן
       נטענות מהאדמין בכל מצב. רק משיכת ה-JSON כפופה ל-CORS.

   ── CORS ──
   השרת באדמין מחזיק whitelist של origins (server/server.js).
   מקור שלא נמצא בו לא יקבל את ה-JSON, והדף פשוט יישאר עם מה
   שב-HTML. כדי שהמשיכה החיה תעבוד מדומיין חדש — צריך להוסיף
   אותו לרשימה שם.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ADMIN_HOST = 'https://admin.safecapital.co.il';
  var API = ADMIN_HOST + '/api/public/deals';

  var grid  = document.getElementById('deals-grid');      /* עמוד הבית */
  var tabs  = document.getElementById('dealbar-list');    /* עמוד העסקאות */
  var track = document.getElementById('dealview-track');
  var view  = track && track.parentElement;
  var headMedia = document.getElementById('page-head-media');
  if (!grid && !(tabs && track)) return;

  /* כתובות התמונה חוזרות מה-API כנתיב יחסי (/uploads/...).
     הלקוח הוא זה שמצרף את המארח — ראה ההערה ב-routes/public.js. */
  function abs(url) {
    if (!url) return '';
    return /^https?:\/\//.test(url) ? url : ADMIN_HOST + url;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* רק שורת הרחוב. באדמין full_address הוא
     "206 Mountain Avenue, Birmingham, AL 35213", והפסיק הראשון
     מפריד את הרחוב מהעיר/מדינה/מיקוד. חותכים שם ולא לפי שם
     העיר, כדי שזה יעבוד גם על Vestavia Hills ועל כל עיר שתתווסף.
     בלי פסיק — מחזירים את המחרוזת כמו שהיא. */
  function street(fullAddress) {
    return String(fullAddress || '').split(',')[0].trim();
  }

  /* ── עמוד הבית: כרטיס טיזר ──────────────────────────────── */
  function gridCard(deal) {
    return '<li class="card">' +
      '<a class="card__link" href="deals.html#deal-' + esc(deal.id) + '">' +
        '<img class="card__media" src="' + esc(abs(deal.thumbnail_url)) + '"' +
             ' alt="" loading="lazy" decoding="async">' +
        '<span class="card__scrim" aria-hidden="true"></span>' +
        '<span class="card__addr" dir="ltr">' + esc(street(deal.full_address)) + '</span>' +
      '</a>' +
    '</li>';
  }

  /* ── עמוד העסקאות: כפתור בורר + פאנל ────────────────────── */
  /* שתי צורות של אותו שם, וה-CSS בוחר. במובייל הכתובת המלאה
     שברה את הגלולה לשתי שורות; מספר הבית לבדו מספיק כדי
     להבחין בין העסקאות ונכנס בשורה אחת.
     ה-aria-label נושא תמיד את השם המלא, ושני ה-span מוסתרים
     מקורא מסך — אחרת השם הנגיש היה מתכווץ ל-"206". */
  function tabButton(deal, i) {
    var full = esc(deal.name);
    var num  = esc(String(deal.name || '').trim().split(/\s+/)[0]);
    return '<button type="button" class="dealbar__btn' + (i === 0 ? ' is-current' : '') + '"' +
      ' role="tab" data-deal="' + i + '" data-id="' + esc(deal.id) + '"' +
      ' id="dealtab-' + i + '"' +
      ' aria-controls="dealpane-' + i + '"' +
      ' aria-label="' + full + '"' +
      ' aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' +
      '<span class="dealbar__num" aria-hidden="true">' + num + '</span>' +
      '<span class="dealbar__full" aria-hidden="true">' + full + '</span>' +
      '</button>';
  }


  /* ── נתוני העסקה ──────────────────────────────────────────
     נבנים **רק** מהמשיכה החיה, בלי גיבוי סטטי ב-HTML. זה מכוון:
     מספר פיננסי ישן גרוע ממספר חסר. אם האדמין לא נגיש — הבלוק
     לא נרנדר בכלל, ואף פעם לא מוצג נתון שכבר לא נכון.
     כל תא שאין לו ערך פשוט לא נוצר, ולכן אין "—" ריקים. */

  function n(v) {
    var x = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isFinite(x) ? x : null;
  }
  function money(v) {
    var x = n(v);
    return x === null ? null : '$' + Math.round(x).toLocaleString('en-US');
  }
  /* באדמין הערך הוא "4 months" באחת ו-"12" בלי יחידה באחרת */
  function months(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    var m = s.match(/\d+(\.\d+)?/);
    return m ? m[0] + ' חודשים' : s;
  }
  function spec(deal, needle) {
    var list = deal.specs || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].spec_name || '').indexOf(needle) !== -1) return list[i];
    }
    return null;
  }
  function sqm(v) {
    var x = n(v);
    return x === null ? null : Math.round(x * 0.092903).toLocaleString('en-US');
  }

  function factPair(label, before, after, unit, sub) {
    var b = n(before), a = n(after);
    if (after == null || String(after) === '') return '';
    var shown = esc(after) + esc(unit || ''), body;
    if (b !== null && a !== null && b === a) {
      body = '<span class="fact__val">' + shown + '</span>' +
             '<span class="fact__flat">ללא שינוי</span>';
    } else if (b !== null) {
      /* ב-RTL חץ ההתקדמות מצביע שמאלה */
      body = '<span class="fact__was">' + esc(before) + '</span>' +
             '<span class="fact__arrow" aria-hidden="true">←</span>' +
             '<span class="fact__val">' + shown + '</span>';
    } else {
      body = '<span class="fact__val">' + shown + '</span>';
    }
    if (sub) body += '<span class="fact__sub">' + esc(sub) + '</span>';
    return '<div class="fact"><p class="fact__label">' + esc(label) + '</p>' +
           '<p class="fact__body">' + body + '</p></div>';
  }

  function factValue(label, value, hero) {
    if (value == null || value === '') return '';
    return '<div class="fact"><p class="fact__label">' + esc(label) + '</p>' +
      '<p class="fact__body"><span class="fact__val' + (hero ? ' fact__val--hero' : '') +
      '">' + esc(value) + '</span></p></div>';
  }

  /* סדר ה-DOM הוא סדר הקריאה בדסקטופ — שם, סכום, אחוז —
     וזה גם מה שקורא מסך מקריא. במובייל הגריד ממקם מחדש
     את האחוז לראש התא, בלי לגעת בסדר. */
  function capItem(kind, pct, name, sum) {
    return '<div class="cap__item">' +
      '<i class="cap__mark cap__mark--' + kind + '"></i>' +
      '<p class="cap__name">' + esc(name) + '</p>' +
      '<p class="cap__sum">' + esc(sum) + '</p>' +
      '<p class="cap__pct">' + pct + '%</p>' +
    '</div>';
  }

  function facts(deal) {
    var area = spec(deal, 'שטח'), beds = spec(deal, 'שינה'), baths = spec(deal, 'רחצה');

    /* הקהל ישראלי. ‏sqft היה הערך ומ"ר הערת שוליים מתחתיו —
       הפוך מהיחידה שהקורא באמת מודד בה. האדמין ממשיך לשמור
       sqft וההמרה נעשית כאן, כדי שלא יהיו שתי אמיתות במקור.
       ‏אם שני הערכים מתעגלים לאותו מ"ר, factPair יציג "ללא
       שינוי" — וזה נכון: ברזולוציה שמוצגת באמת אין הבדל. */
    var plan =
      (area  ? factPair('שטח בנוי',  sqm(area.value_before), sqm(area.value_after), ' מ"ר') : '') +
      (beds  ? factPair('חדרי שינה', beds.value_before,  beds.value_after)  : '') +
      (baths ? factPair('חדרי רחצה', baths.value_before, baths.value_after) : '');

    var nums =
      factValue('עלות הפרויקט', money(deal.total_cost)) +
      factValue('משך צפוי', months(deal.project_duration)) +
      factValue('רווח צפוי למשקיעים',
                deal.expected_roi_percent == null ? null : deal.expected_roi_percent + '%', true);

    /* הרכב ההון. fundraising_goal הוא ההון המושקע כולו —
       המשקיעים והחברה יחד — וכל מה שמעבר לו בעלות הפרויקט
       הוא המימון. */
    var cap = '', total = n(deal.total_cost), equity = n(deal.fundraising_goal);
    if (total && equity !== null && total > 0) {
      var loan = Math.max(total - equity, 0), p = Math.round(equity / total * 100);
      cap = '<div class="cap">' +
        '<p class="fact__label">הרכב ההון</p>' +
        '<div class="cap__bar" role="img"' +
          ' aria-label="משקיעים ויזמים ' + p + ' אחוז, מימון ' + (100 - p) + ' אחוז">' +
          '<span style="width:' + p + '%"></span></div>' +
        '<div class="cap__legend">' +
          capItem('inv',  p,       'משקיעים ויזמים', money(equity)) +
          capItem('firm', 100 - p, 'מימון',          money(loan)) +
        '</div></div>';
    }

    var out = '';
    if (plan) out += '<section class="dealfacts"><h3 class="dealfacts__title">תכנית השיפוץ</h3>' +
                     '<div class="factrow">' + plan + '</div></section>';
    if (nums || cap) out += '<section class="dealfacts"><h3 class="dealfacts__title">הפרויקט במספרים</h3>' +
                     (nums ? '<div class="factrow">' + nums + '</div>' : '') + cap + '</section>';
    return out;
  }

  /* eager על **כל** הפאנלים, גם אלה שמחוץ למסך.
     ‏loading="lazy" דחה אותם עד שהם נכנסים לפריים — כלומר
     ההורדה התחילה בדיוק ברגע שהמשתמש כבר מחליק אליהם, והוא
     ראה מלבן ריק. אחת התמונות היא 10.4MB ולוקחת ~3.5 שניות.
     ‏fetchpriority שומר על סדר: הנראה קודם, השאר ברקע. */
  function pane(deal, i) {
    return '<article class="dealpane" role="tabpanel" id="dealpane-' + i + '"' +
      ' aria-labelledby="dealtab-' + i + '"' + (i === 0 ? '' : ' aria-hidden="true"') + '>' +
      '<div class="dealpane__body">' +
        '<p class="dealpane__addr" dir="ltr">' + esc(street(deal.full_address)) + '</p>' +
        '<p class="dealpane__text">' + esc(deal.description) + '</p>' +
        facts(deal) +
      '</div>' +
    '</article>';
  }

  /* ── תצלום הנכס ברקע כותרת העמוד ────────────────────────
     שכבה אחת לכל עסקה, מוערמות זו על זו. ההחלפה היא opacity
     בלבד, ולכן היא מצליבה במקום לקפוץ. eager על כולן — הן
     צריכות להיות מוכנות עוד לפני שלוחצים. */
  function headBg(deal, i) {
    return '<img class="page-head__bg' + (i === 0 ? ' is-current' : '') + '"' +
      ' src="' + esc(abs(deal.thumbnail_url)) + '" alt="" loading="eager"' +
      ' decoding="async" fetchpriority="' + (i === 0 ? 'high' : 'low') + '">';
  }

  /* ── כניסה מקישור לעסקה מסוימת ────────────────────────────
     כרטיס בעמוד הבית מפנה ל-deals.html#deal-<id>. ה-hash נושא
     את **מזהה** העסקה ולא את מיקומה ברשימה, כי הסדר באדמין
     יכול להשתנות והקישור צריך לשרוד את זה. אין בעמוד אלמנט
     עם ה-id הזה, ולכן הדפדפן לא גולל לשומקום — הוא רק נוחת
     למעלה עם העסקה הנכונה כבר פתוחה. */
  function indexOfId(id) {
    if (id == null || !tabs) return -1;
    var btns = tabs.querySelectorAll('.dealbar__btn');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-id') === String(id)) return i;
    }
    return -1;
  }
  function hashIndex() {
    var m = /^#deal-(.+)$/.exec(location.hash || '');
    return m ? indexOfId(decodeURIComponent(m[1])) : -1;
  }

  /* ── מעבר בין עסקאות ────────────────────────────────────── */
  var current = 0;

  /* הרצועה היא flex row, ולכן בלי התערבות הגובה שלה נקבע לפי
     הפאנל הגבוה מכולם — ותחת כל פאנל קצר יותר נפער ריק עד
     הפוטר. ‏Mountain הוא 878px ו-Oxmoor 960, כלומר 82px של
     לובן מתחת לקצר מביניהם, ועוד ריפוד התחתית של הפאנל.
     ‏align-items:flex-start מחזיר לכל פאנל את גובהו הטבעי,
     וכאן נועלים על החלון את גובה הנבחר בלבד. */
  var MOBILE = window.matchMedia ? window.matchMedia('(max-width:767px)') : null;
  function sizeView() {
    if (!view || !track) return;
    /* בדסקטופ הפאנלים נמתחים כמו תמיד — הנעילה היא התנהגות
       מובייל בלבד, ולכן חוצים חזרה למעלה מנקים את הגובה. */
    if (MOBILE && !MOBILE.matches) { view.style.height = ''; return; }
    var pane = track.children[current];
    if (pane) view.style.height = pane.offsetHeight + 'px';
  }

  function select(i, focusTab) {
    var btns  = tabs.querySelectorAll('.dealbar__btn');
    var panes = track.querySelectorAll('.dealpane');
    if (!btns.length || i < 0 || i >= btns.length) return;
    current = i;

    for (var n = 0; n < btns.length; n++) {
      var on = n === i;
      btns[n].classList.toggle('is-current', on);
      btns[n].setAttribute('aria-selected', String(on));
      /* רק הכפתור הנבחר בסדר ה-Tab; בין הכפתורים נעים בחצים,
         וזו ההתנהגות שמצופה מ-tablist. */
      btns[n].tabIndex = on ? 0 : -1;
      if (panes[n]) {
        if (on) panes[n].removeAttribute('aria-hidden');
        else panes[n].setAttribute('aria-hidden', 'true');
      }
    }
    /* ה-JS כותב אינדקס בלבד; את התנועה עושה ה-CSS. */
    track.style.setProperty('--i', i);

    if (headMedia) {
      var bgs = headMedia.querySelectorAll('.page-head__bg');
      for (var k = 0; k < bgs.length; k++) bgs[k].classList.toggle('is-current', k === i);
    }
    sizeView();
    if (focusTab) btns[i].focus();
  }

  function bind() {
    /* גלילה על הצד בנייד משנה innerHeight בלי ששום דבר בפריסה
       באמת זז, ולכן מודדים מחדש רק כשהרוחב השתנה. בזמן גרירת
       חלון בדסקטופ ההנפשה מכובה — אחרת כל פריים היה פותח מעבר
       של .6s והגובה היה רודף אחרי העכבר. */
    /* חציית נקודת השבירה עצמה נשמעת מה-MediaQueryList ולא
       מ-resize. זה גם ה-API הנכון לשאלה "האם אנחנו במובייל",
       וגם היחיד שנורה כשהרוחב משתנה בלי אירוע resize —
       למשל בהחלפת viewport באמולציה של הדפדפן. בלי זה החלון
       נשאר נעול על גובה המובייל אחרי מעבר לדסקטופ. */
    if (MOBILE) {
      if (MOBILE.addEventListener) MOBILE.addEventListener('change', sizeView);
      else if (MOBILE.addListener) MOBILE.addListener(sizeView);
    }

    var lastW = window.innerWidth, resizeT;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      view.style.transition = 'none';
      sizeView();
      clearTimeout(resizeT);
      resizeT = setTimeout(function () { view.style.transition = ''; }, 150);
    });

    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.dealbar__btn') : null;
      if (btn) select(Number(btn.getAttribute('data-deal')), false);
    });

    /* קישור לעסקה אחרת בזמן שכבר נמצאים בעמוד — הדפדפן לא
       טוען מחדש, רק משנה hash, ולכן צריך להאזין. */
    window.addEventListener('hashchange', function () {
      var i = hashIndex();
      if (i > -1) select(i, false);
    });

    tabs.addEventListener('keydown', function (e) {
      var last = tabs.querySelectorAll('.dealbar__btn').length - 1;
      var to;
      /* RTL: החץ שמאלה מוביל לכפתור הבא ברשימה, כי הוא זה
         שמצויר משמאל. ימינה — הקודם. */
      if (e.key === 'ArrowLeft')       to = Math.min(current + 1, last);
      else if (e.key === 'ArrowRight') to = Math.max(current - 1, 0);
      else if (e.key === 'Home')       to = 0;
      else if (e.key === 'End')        to = last;
      else return;
      e.preventDefault();
      select(to, true);
    });
  }

  /* הורדה לבדה לא מספיקה. תמונה של 2366×1824 נפענחת בעשרות
     מילישניות, וזה נופל בדיוק על הפריימים של ההחלקה. decode()
     מוציא את הפענוח מהמסלול הקריטי בזמן שהמשתמש עוד קורא.
     רץ אחרי load כדי לא להתחרות בציור הראשון. */
  /* נקודת החיתוך נגזרת מיחס התמונה עצמה, כי ערך אחד לא יכול
     לשרת גם לרוחב וגם לאורך:
       • תמונת רוחב — הבית באמצע-עליון, ולכן מטים מעלה כדי
         שהגג לא ייחתך (זו הבעיה של Oxmoor).
       • תמונת אורך — החיתוך ממילא קיצוני, והטיה מעלה מוציאה
         את הבית מהפריים ומשאירה גג ועצים. שם מרכז עדיף. */
  /* עקיפה ידנית לתמונה מסוימת. ממופה לפי **שם הקובץ** ולא לפי
     העסקה: אם יחליפו את ה-thumbnail באדמין, העקיפה מפסיקה לחול
     והכלל האוטומטי חוזר — עדיף מאשר מסגור שגוי על תמונה חדשה.
       Oxmoor — ב-30% נשאר הרבה שמיים מעל הגג. 40% מוריד את
       המסגרת, הבית ממלא יותר, והגמלונים עדיין נכנסים במלואם.
       ב-50% הגג כבר נחתך. */
  var FOCUS = { '1775364865691_Gemini': 'center 40%' };

  function focus(img) {
    var src = img.getAttribute('src') || '';
    for (var key in FOCUS) {
      if (src.indexOf(key) !== -1) { img.style.objectPosition = FOCUS[key]; return; }
    }
    var ar = img.naturalWidth / img.naturalHeight;
    img.style.objectPosition = ar < 1 ? 'center' : 'center 38%';
  }
  function focusAll() {
    var imgs = document.querySelectorAll('.page-head__bg');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.complete && im.naturalWidth) focus(im);
      else im.addEventListener('load', function () { focus(this); }, { once: true });
    }
  }

  function predecode() {
    var imgs = document.querySelectorAll('.page-head__bg');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].decode) imgs[i].decode().catch(function () { /* תמונה חסרה — לא נורא */ });
    }
  }
  function whenIdle(fn) {
    if (document.readyState === 'complete') fn();
    else window.addEventListener('load', fn, { once: true });
  }

  /* הרצועה כהה כבר ב-HTML, ולכן אין מה לחכות לטעינת תמונה
     כדי להחיל את מצב "מצע כהה" — וגם אין הבזק צבע. */
  if (document.getElementById('page-head-media')) {
    document.body.classList.add('head-on-media');
    focusAll();
  }

  /* ה-HTML הסטטי כבר תקין, ולכן קושרים אותו מיד — המשיכה
     החיה שבהמשך רק מחליפה תוכן ומצביעה שוב על אותו אינדקס. */
  if (tabs && track) {
    bind();
    var start = hashIndex();
    select(start > -1 ? start : 0, false);
    whenIdle(predecode);
    /* הגופנים נוחתים אחרי המדידה הראשונה ומזיזים את הגובה. */
    whenIdle(sizeView);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeView);
  }

  if (!window.fetch) return;

  fetch(API, { mode: 'cors', credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      var deals = ((data && data.deals) || []).filter(function (d) {
        /* בלי תמונה או בלי כתובת אין מה להראות */
        return d && d.thumbnail_url && d.full_address;
      });
      /* אפס תוצאות = לא נוגעים. עדיף מה שב-HTML מאשר ריק. */
      if (!deals.length) return;

      if (grid) grid.innerHTML = deals.map(gridCard).join('');

      if (headMedia) {
        /* התמונות כבר ב-HTML ומורידות מרגע הפרסינג. כותבים
           מחדש **רק** אם האדמין באמת מחזיר סט אחר — אחרת היינו
           הורסים אלמנטים שכבר באמצע הורדה ומתחילים מהתחלה. */
        var have = [].map.call(headMedia.querySelectorAll('.page-head__bg'),
                               function (im) { return im.getAttribute('src'); }).join('|');
        var want = deals.map(function (d) { return abs(d.thumbnail_url); }).join('|');
        if (have !== want) { headMedia.innerHTML = deals.map(headBg).join(''); focusAll(); }
      }

      if (tabs && track) {
        /* הבחירה נשמרת לפי מזהה. אם האדמין סידר מחדש, המשתמש
           נשאר על אותה עסקה במקום לקפוץ למי שתפס את המקום. */
        var cur = tabs.querySelector('.dealbar__btn.is-current');
        var keep = cur ? cur.getAttribute('data-id') : null;

        tabs.innerHTML  = deals.map(tabButton).join('');
        track.innerHTML = deals.map(pane).join('');

        var to = indexOfId(keep);
        if (to < 0) to = hashIndex();
        if (to < 0) to = Math.min(current, deals.length - 1);
        select(to, false);
        whenIdle(predecode);   /* אלמנטים חדשים — לפענח שוב */
      }
    })
    .catch(function () {
      /* שקט מכוון: ה-HTML הסטטי הוא הנפילה הרכה. */
    });
})();

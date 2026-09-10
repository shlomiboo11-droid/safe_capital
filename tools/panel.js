/* ═══════════════════════════════════════════════════════════════
   panel.js — פאנל שליטה לכוונון תנועה

   נטען רק עם ?panel=1 בכתובת, ולכן לא נוגע בפרודקשן.

   איך הוא יודע על מה מדובר: הוא לא מנחש. כל ערך רשום ב-TUNABLES
   עם תווית בעברית, קבוצה, טווח, ומאיפה הוא נקרא — CSS או JS.
   בריחוף על סליידר האלמנט המושפע מהבהב בדף, וכפתור "קפוץ לכאן"
   מזיז את הגלילה בדיוק לנקודה שבה הערך פועל.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!/[?&]panel=1/.test(location.search)) return;

  var css  = document.documentElement.style;
  var root = getComputedStyle(document.documentElement);
  var M    = window.SC_MOTION;

  /* ── עוזרים ─────────────────────────────────────────────────── */
  function isDesktop() { return window.innerWidth >= 768; }
  function pin() { return isDesktop() ? M.pin.desktop : M.pin.mobile; }
  function vh() { return window.innerHeight; }
  /* גובה מסלול ההירו נקרא מהאלמנט, כי הוא מגיע מ-media query */
  function heroTrackVh() {
    var h = document.querySelector('.hero');
    return h ? h.offsetHeight / vh() : 2;
  }

  /* ── הרישום ─────────────────────────────────────────────────
     kind: 'css'  → משתנה CSS על :root
           'rel'  → נקודת עוגן של המשפט הנעוץ (יחידות = מסך)
           'js'   → ערך ב-SC_MOTION
     at:   פונקציה שמחזירה את מיקום הגלילה שבו הערך פועל       */
  var TUNABLES = [
    { group: 'ההירו והגבעה', items: [
      { id: 'heroTrack', label: 'אורך מסלול ההירו', unit: 'vh',
        min: 100, max: 260, step: 5, kind: 'heroTrack',
        get: heroTrackVh,
        hint: 'שולט גם בגלילה הכוללת וגם במרחק שהגבעה מטפסת',
        target: '.hero', at: function () { return 0; } },

      { id: 'hillPeek', label: 'כמה גבעה נראית בטעינה', unit: 'px',
        min: 0, max: 140, step: 2, kind: 'css', varName: '--hill-peek',
        target: '.hero__hill', at: function () { return 0; } },

      { id: 'hillCurve', label: 'עוצמת הקימור של הגבעה', unit: 'px',
        min: 0, max: 260, step: 5, kind: 'hillCurve',
        target: '.hero__hill', at: function () { return 0; } },

      { id: 'houseW', label: 'גודל הבית', unit: 'px',
        min: 40, max: 260, step: 4, kind: 'css', varName: '--house-w',
        target: '.hero__house', at: function () { return 0; } }
    ]},

    { group: 'המשפט הנעוץ — px מראש העמוד (נשמר כגבהי מסך)', items: [
      { id: 'start', label: 'מתחיל להופיע', unit: 'px',
        min: 0, max: 2600, step: 5, kind: 'pin', key: 'start',
        hint: 'המרחק מ־"אטום לגמרי" הוא אורך הפייד אין',
        target: '#pinned' },
      { id: 'centerStart', label: 'אטום לגמרי', unit: 'px',
        min: 0, max: 2600, step: 5, kind: 'pin', key: 'centerStart',
        target: '#pinned' },
      { id: 'centerEnd', label: 'מתחיל להיעלם', unit: 'px',
        min: 0, max: 2600, step: 5, kind: 'pin', key: 'centerEnd',
        target: '#pinned' },
      { id: 'end', label: 'נעלם לגמרי', unit: 'px',
        min: 0, max: 2600, step: 5, kind: 'pin', key: 'end',
        hint: 'המרחק מ־"מתחיל להיעלם" הוא אורך הפייד אאוט',
        target: '#pinned' }
    ]},

    { group: 'סקשן התהליך', items: [
      { id: 'processFade', label: 'אורך פייד הכניסה', unit: 'מסך',
        min: 0.05, max: 1.2, step: 0.05, kind: 'js', prop: 'processFade',
        target: '#stage',
        at: function () {
          var p = document.querySelector('.process');
          return p ? p.offsetTop - vh() * 0.3 : 0;
        } }
    ]}
  ];

  /* ── קריאה וכתיבה ───────────────────────────────────────────── */
  function readValue(t) {
    if (t.kind === 'pin')       return Math.round(pin()[t.key] * vh());
    if (t.kind === 'js')        return M[t.prop];
    if (t.kind === 'heroTrack') return +t.get().toFixed(2);
    if (t.kind === 'hillCurve') {
      var el = document.querySelector('.hero__hill');
      return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius.split(' ').pop()) || 0 : 0;
    }
    var v = root.getPropertyValue(t.varName) ||
            getComputedStyle(document.querySelector(t.target) || document.body)
              .getPropertyValue(t.varName);
    return parseFloat(v) || 0;
  }

  function writeValue(t, v) {
    if (t.kind === 'pin')            pin()[t.key] = +(v / vh()).toFixed(4);
    else if (t.kind === 'js')        M[t.prop] = v;
    else if (t.kind === 'heroTrack') { /* מטופל בבלוק שמתחת — min-height
                                          מגיע מ-media query וחייב override
                                          ישיר על האלמנט, לא על :root */ }
    else if (t.kind === 'hillCurve') {
      var r = v + 'px';
      document.querySelectorAll('.hero__hill').forEach(function (el) {
        el.style.borderRadius = '50% 50% 0 0 / ' + r + ' ' + r + ' 0 0';
      });
    } else css.setProperty(t.varName, v + 'px');

    if (t.kind === 'heroTrack') {
      /* min-height מגיע מ-media query; דורסים ישירות על האלמנט */
      var hero = document.querySelector('.hero');
      if (hero) hero.style.minHeight = v + 'vh';
    }
    M.refresh();
  }

  /* ── הדגשת האלמנט המושפע ────────────────────────────────────── */
  var flash;
  function highlight(sel) {
    clearHighlight();
    var el = document.querySelector(sel);
    if (!el) return;
    var r = el.getBoundingClientRect();
    flash = document.createElement('div');
    flash.style.cssText =
      'position:fixed;pointer-events:none;z-index:99999;' +
      'border:2px solid #5D1819;background:rgba(93,24,25,.12);' +
      'left:' + r.left + 'px;top:' + r.top + 'px;' +
      'width:' + r.width + 'px;height:' + r.height + 'px;';
    document.body.appendChild(flash);
  }
  function clearHighlight() { if (flash) { flash.remove(); flash = null; } }

  /* ── בניית הפאנל ────────────────────────────────────────────── */
  var panel = document.createElement('div');
  panel.dir = 'rtl';
  panel.style.cssText =
    'position:fixed;inset-block-start:12px;inset-inline-end:12px;z-index:99998;' +
    'width:310px;max-height:88vh;overflow:auto;' +
    'background:#0E1E2E;color:#E8E5DF;border-radius:14px;' +
    'font:400 12px/1.5 Heebo,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.4);' +
    'padding:12px 14px 16px;';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;' +
                       'margin-bottom:10px;font-weight:700;font-size:13px';
  head.innerHTML = '<span>פאנל כוונון</span>';
  var mini = document.createElement('button');
  mini.textContent = '—';
  mini.style.cssText = 'background:none;border:0;color:inherit;cursor:pointer;font-size:16px';
  var body = document.createElement('div');
  mini.onclick = function () {
    var hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    mini.textContent = hidden ? '—' : '+';
  };
  head.appendChild(mini);
  panel.appendChild(head);
  panel.appendChild(body);

  var rows = [];

  TUNABLES.forEach(function (g) {
    var t = document.createElement('div');
    t.textContent = g.group;
    t.style.cssText = 'margin:14px 0 6px;font-weight:700;color:#A47E7E;font-size:11px';
    body.appendChild(t);

    g.items.forEach(function (item) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:10px';

      var lab = document.createElement('div');
      lab.style.cssText = 'display:flex;justify-content:space-between;gap:6px';
      var name = document.createElement('span');
      name.textContent = item.label;
      var out = document.createElement('b');
      lab.appendChild(name); lab.appendChild(out);

      var input = document.createElement('input');
      input.type = 'range';
      input.min = item.min; input.max = item.max; input.step = item.step;
      input.value = readValue(item);
      input.style.cssText = 'width:100%;accent-color:#A47E7E;margin-top:2px';
      out.textContent = (+input.value).toFixed(item.step < 1 ? 2 : 0) + ' ' + item.unit;

      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        out.textContent = v.toFixed(item.step < 1 ? 2 : 0) + ' ' + item.unit;
        writeValue(item, v);
      });
      input.addEventListener('mouseenter', function () { highlight(item.target); });
      input.addEventListener('mouseleave', clearHighlight);

      wrap.appendChild(lab);
      wrap.appendChild(input);

      if (item.hint) {
        var h = document.createElement('div');
        h.textContent = item.hint;
        h.style.cssText = 'opacity:.55;font-size:10.5px;margin-top:1px';
        wrap.appendChild(h);
      }

      /* קפיצה לרגע שבו הערך פועל */
      var jump = document.createElement('button');
      jump.textContent = 'קפוץ לכאן';
      jump.style.cssText = 'margin-top:3px;background:rgba(255,255,255,.1);border:0;' +
                           'color:inherit;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:10.5px';
      jump.onclick = function () {
        var y = item.at ? item.at() : Math.round(readValue(item));
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      };
      wrap.appendChild(jump);

      body.appendChild(wrap);
      rows.push({ item: item, input: input, out: out });
    });
  });

  /* ── ייצוא הערכים ───────────────────────────────────────────── */
  var exp = document.createElement('button');
  exp.textContent = 'העתק ערכים';
  exp.style.cssText = 'margin-top:14px;width:100%;background:#A47E7E;border:0;color:#0E1E2E;' +
                      'font-weight:700;border-radius:8px;padding:7px;cursor:pointer;font-size:12px';
  exp.onclick = function () {
    var r = pin();
    var lines = [
      '/* ' + (isDesktop() ? 'דסקטופ' : 'מובייל') + ' — רוחב ' + window.innerWidth + 'px */',
      '',
      'styles.css:',
      '  .hero{min-height:' + document.querySelector('.hero').style.minHeight + '}',
      '  --hill-peek: ' + css.getPropertyValue('--hill-peek'),
      '  --house-w:   ' + css.getPropertyValue('--house-w'),
      '  .hero__hill border-radius: ' +
        (document.querySelector('.hero__hill').style.borderRadius || '(לא שונה)'),
      '',
      'motion.js:',
      '  PINNED_VH_' + (isDesktop() ? 'DESKTOP' : 'MOBILE') + ' = { start: ' + r.start +
        ', centerStart: ' + r.centerStart + ', centerEnd: ' + r.centerEnd + ', end: ' + r.end + ' };',
      '  // @' + vh() + 'px:  פייד אין ' + Math.round((r.centerStart - r.start) * vh()) +
        'px · החזקה ' + Math.round((r.centerEnd - r.centerStart) * vh()) +
        'px · פייד אאוט ' + Math.round((r.end - r.centerEnd) * vh()) + 'px',
      '  PROCESS_FADE = ' + M.processFade + ';'
    ].join('\n');
    navigator.clipboard.writeText(lines).then(function () {
      exp.textContent = 'הועתק ✓';
      setTimeout(function () { exp.textContent = 'העתק ערכים'; }, 1400);
    });
    console.log(lines);
  };
  body.appendChild(exp);

  var note = document.createElement('div');
  note.textContent = 'השינויים חיים בדפדפן בלבד. "העתק ערכים" ואז שלח לי — ואטמיע בקוד.';
  note.style.cssText = 'opacity:.5;font-size:10px;margin-top:8px;line-height:1.4';
  body.appendChild(note);

  document.body.appendChild(panel);
  window.addEventListener('scroll', clearHighlight, { passive: true });
})();

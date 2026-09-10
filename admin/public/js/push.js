/* ═══════════════════════════════════════════════════════════════════════
   push.js — הפעלת התראות במכשיר של המנהל

   ── מה צריך כדי שזה יעבוד בטלפון ──
   ‏אנדרואיד · דפדפן רגיל מספיק.
   ‏אייפון   · **חובה** להוסיף את הפאנל למסך הבית (iOS 16.4 ומעלה).
              ‏Safari בלשונית רגילה לא מקבל התראות דחיפה בכלל, ולכן
              במצב הזה מוצגות הוראות ההוספה במקום כפתור מת.

   ── אישור ההרשאה חייב לשבת בתוך לחיצה ──
   ‏Notification.requestPermission() נקרא כשורה הראשונה במטפל הלחיצה.
   ‏iOS פוסל את הבקשה אם היא מגיעה אחרי await — לכן קודם מבקשים, ורק
   אחר כך רושמים סרוויס וורקר ומדברים עם השרת.

   ── סנכרון בכל טעינה ──
   הדפדפן מחליף מנוי מדי פעם (סיבוב מפתחות, התקנה מחדש באייפון).
   הסרוויס וורקר לא מחזיק טוקן ולכן אינו יכול לעדכן את השרת בעצמו;
   במקום זה כל טעינה של עמוד עם הרכיב הזה שולחת מחדש את המנוי הנוכחי.
   ‏POST /api/push/subscribe הוא upsert לפי endpoint, אז זה זול ובטוח.
   ═══════════════════════════════════════════════════════════════════════ */
const SCPush = (function () {
  'use strict';

  let vapidKey = null;

  function supported() {
    return 'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /** האם אנחנו רצים כאפליקציה מותקנת ולא בלשונית דפדפן. */
  function isStandalone() {
    return window.navigator.standalone === true ||
           window.matchMedia('(display-mode: standalone)').matches;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function getKey() {
    if (vapidKey) return vapidKey;
    const res = await API.get('/push/public-key');
    if (!res || !res.key) throw new Error('התראות לא מוגדרות בשרת');
    vapidKey = res.key;
    return vapidKey;
  }

  async function registration() {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  async function currentSubscription() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  }

  /** רושם את המנוי בשרת. ‏upsert — בטוח לקרוא בכל טעינה. */
  async function syncToServer(sub) {
    if (!sub) return;
    await API.post('/push/subscribe', { subscription: sub.toJSON() });
  }

  /**
   * מפעיל התראות. **חייב** להיקרא ישירות ממטפל לחיצה.
   * מחזיר { ok } או { ok:false, reason }.
   */
  async function enable() {
    if (!supported()) return { ok: false, reason: 'unsupported' };

    // שורה ראשונה, בלי await לפניה — אחרת iOS פוסל את הבקשה
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission };

    const [reg, key] = await Promise.all([registration(), getKey()]);
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
    }
    await syncToServer(sub);
    return { ok: true };
  }

  async function disable() {
    const sub = await currentSubscription();
    if (!sub) return { ok: true };
    await API.post('/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
    return { ok: true };
  }

  async function test() {
    return API.post('/push/test', {});
  }

  /** מסנכרן מנוי קיים בשקט. נכשל בשקט — זו לא פעולה שהמשתמש ביקש. */
  async function resync() {
    try {
      if (!supported() || Notification.permission !== 'granted') return;
      await registration();
      const sub = await currentSubscription();
      if (sub) await syncToServer(sub);
    } catch (err) {
      console.warn('[push] resync failed:', err.message);
    }
  }

  /* ── הרכיב ─────────────────────────────────────────────────────────
     נבנה לתוך אלמנט קיים. משתמש רק במחלקות שכבר קיימות בגיליון של
     הדאשבורד — אין כאן CSS חדש. */
  function render(el, state) {
    const box = (icon, title, body, actions, tone) => `
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined ${tone || 'text-primary'}">${icon}</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-900">${title}</div>
          <div class="text-sm text-gray-500 mt-1 leading-relaxed">${body}</div>
          ${actions ? `<div class="flex flex-wrap gap-2 mt-3">${actions}</div>` : ''}
        </div>
      </div>`;

    if (state.reason === 'unsupported') {
      el.innerHTML = box('notifications_off', 'התראות לא נתמכות בדפדפן הזה',
        'נסה מדפדפן עדכני, או מהאפליקציה שהתקנת על הטלפון.', '', 'text-gray-400');
      return;
    }

    if (state.reason === 'ios-needs-install') {
      el.innerHTML = box('ios_share', 'כדי לקבל התראות באייפון',
        'צריך להוסיף את הפאנל למסך הבית: כפתור השיתוף ב-Safari ' +
        '<span class="whitespace-nowrap">← "הוספה למסך הבית"</span>, ואז לפתוח את הפאנל משם ולהפעיל כאן התראות.',
        '', 'text-primary');
      return;
    }

    if (state.reason === 'denied') {
      el.innerHTML = box('notifications_off', 'ההתראות חסומות',
        'הדפדפן חוסם התראות מהאתר הזה. צריך לאפשר אותן בהגדרות האתר בדפדפן ואז לרענן.',
        '', 'text-red-500');
      return;
    }

    if (state.reason === 'not-configured') {
      el.innerHTML = box('notifications_paused', 'התראות לא מוגדרות בשרת',
        'חסרים מפתחות VAPID במשתני הסביבה.', '', 'text-gray-400');
      return;
    }

    if (state.subscribed) {
      el.innerHTML = box('notifications_active', 'התראות פעילות במכשיר הזה',
        'כל ליד חדש שמגיע מהאתר יקפוץ כאן כהתראה.',
        `<button class="btn btn-secondary btn-sm" data-push="test">שליחת בדיקה</button>
         <button class="btn btn-secondary btn-sm" data-push="off">כיבוי במכשיר הזה</button>`,
        'text-green-600');
    } else {
      el.innerHTML = box('notifications', 'הפעלת התראות במכשיר הזה',
        'קבל התראה ברגע שמישהו משאיר פרטים באתר — בפנייה או בהרשמה לרשימה.',
        `<button class="btn btn-primary btn-sm" data-push="on">הפעלת התראות</button>`);
    }
  }

  async function currentState() {
    if (!supported()) return { reason: 'unsupported' };
    if (isIOS() && !isStandalone()) return { reason: 'ios-needs-install' };
    if (Notification.permission === 'denied') return { reason: 'denied' };

    try {
      const info = await API.get('/push/public-key');
      if (!info || !info.configured) return { reason: 'not-configured' };
    } catch (err) {
      return { reason: 'not-configured' };
    }

    const sub = await currentSubscription();
    return { subscribed: !!sub && Notification.permission === 'granted' };
  }

  function flash(el, text, ok) {
    const note = document.createElement('div');
    note.className = 'text-sm mt-2 ' + (ok ? 'text-green-600' : 'text-red-600');
    note.textContent = text;
    el.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  /** מרכיב את הפקד לתוך #id ומחזיר promise שנפתר כשהוא מוצג. */
  async function mount(id) {
    const el = document.getElementById(id);
    if (!el) return;

    /* רישום הסרוויס וורקר לא תלוי בהרשאה: בלעדיו כרום לא מציע
       "התקנת אפליקציה" בכלל, ובלי התקנה אין התראות באייפון. */
    if (supported()) registration().catch(function () {});

    /* המצב האמיתי דורש סיבוב לשרת. עד שהוא חוזר משאירים את הכרטיס
       ריק — כפתור "הפעלת התראות" שמתחלף אחרי רגע ל"חסום" נראה כמו
       תקלה. */
    el.innerHTML = '<div class="text-sm text-gray-400">בודק הרשאות התראות…</div>';
    render(el, await currentState());

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-push]');
      if (!btn) return;
      const action = btn.getAttribute('data-push');
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'רגע…';

      try {
        if (action === 'on') {
          const res = await enable();
          if (!res.ok) {
            render(el, { reason: res.reason === 'denied' ? 'denied' : res.reason });
            return;
          }
          render(el, await currentState());
          flash(el, 'ההתראות הופעלו במכשיר הזה.', true);
        } else if (action === 'off') {
          await disable();
          render(el, await currentState());
          flash(el, 'ההתראות כובו במכשיר הזה.', true);
        } else if (action === 'test') {
          const res = await test();
          btn.disabled = false;
          btn.textContent = label;
          flash(el, res && res.sent
            ? 'נשלחה התראת בדיקה.'
            : 'לא נשלחה התראה — אין מכשיר רשום.', !!(res && res.sent));
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = label;
        flash(el, err.message || 'משהו השתבש', false);
      }
    });

    resync();
  }

  return { supported, isIOS, isStandalone, mount, enable, disable, test, resync };
})();

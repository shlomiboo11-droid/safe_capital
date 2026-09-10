/* ═══════════════════════════════════════════════════════════════════════
   sw.js — סרוויס וורקר של האדמין פאנל

   ── מה הוא עושה ──
   מקבל התראות דחיפה ומציג אותן, ופותח את העמוד הנכון בלחיצה. זהו.

   ── מה הוא **לא** עושה: קאשינג ──
   אין כאן שמירה במטמון בכוונה. פאנל ניהול הוא מסך שמראה מצב אמיתי;
   גרסה שמורה של HTML או JS שלו היא מסך ששקר לא ניכר בו. ה-fetch למטה
   מעביר הכל לרשת כמו שהוא — הוא קיים רק כי כרום דורש מטפל fetch כדי
   להציע התקנה.

   ── עדכון ──
   הדפדפן מתקין מחדש בכל שינוי בייט בקובץ הזה, ו-skipWaiting למטה
   מוודא שהגרסה החדשה נכנסת מיד ולא ממתינה לסגירת כל הלשוניות.
   ═══════════════════════════════════════════════════════════════════════ */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

/* מעבר שקוף לרשת. בלי מטמון — ראה למעלה. */
self.addEventListener('fetch', () => {});

/* ── התראה נכנסת ─────────────────────────────────────────────────────
   הגוף מגיע כ-JSON מ-services/push.js. אם משום מה הוא לא JSON, עדיין
   מציגים משהו — התראה ריקה גרועה מהתראה גנרית. */
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Safe Capital', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Safe Capital', {
      body: data.body || '',
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      tag: data.tag || 'safe-capital',
      dir: 'rtl',
      lang: 'he',
      renotify: true,
      data: { url: data.url || '/leads' }
    })
  );
});

/* ── לחיצה על ההתראה ─────────────────────────────────────────────────
   אם הפאנל כבר פתוח איפשהו — מביאים אותו לחזית ומנווטים בו, במקום
   לפתוח חלון שני. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/leads';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

/* ── המנוי הוחלף ─────────────────────────────────────────────────────
   קורה כשהדפדפן מסובב מפתחות, או ב-iOS אחרי הסרה מהמסך הבית והתקנה
   מחדש. נרשמים מחדש מיד; **הרישום בשרת** מתבצע בפעם הבאה שהפאנל
   נפתח — ‏js/push.js מסנכרן את המנוי בכל טעינה, ושם יש טוקן. סרוויס
   וורקר לא מחזיק טוקן ואסור לו לכתוב לשרת בלי אימות. */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription || await self.registration.pushManager.getSubscription();
      if (old && old.options && old.options.applicationServerKey) {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: old.options.applicationServerKey
        });
      }
    } catch (err) {
      // אין מה לעשות כאן; הסנכרון הבא בפתיחת הפאנל יתקן
    }
  })());
});

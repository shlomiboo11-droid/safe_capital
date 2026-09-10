-- ═══════════════════════════════════════════════════════════════════════
-- לידים והתראות · leads + push_subscriptions
--
-- ‏db.js לא רץ בפרודקשן (‏initDb מדולג כש-VERCEL=1), ולכן הקובץ הזה הוא
-- העותק שמריצים ידנית ב-SQL editor של Supabase. הטקסט כאן **זהה בתו**
-- לבלוק שבסוף ‏server/db.js — אם משנים אחד, משנים את השני.
--
-- להריץ **לפני** שדוחפים את הטפסים המחוברים, אחרת הפנייה הראשונה
-- מהאתר החי נופלת על טבלה שלא קיימת.
-- ═══════════════════════════════════════════════════════════════════════

-- ── לידים ──────────────────────────────────────────────────────────────
-- טבלה אחת, שני סוגים. שני הטפסים באתר חולקים כמעט את כל השדות, ועמוד
-- הלידים מציג אותם יחד — ולכן עמודת סוג עדיפה על שתי טבלאות כמעט זהות.
--
-- ‏kind = contact   · הטופס בעמוד צור קשר
-- ‏kind = waitlist  · ההרשמה לרשימת ההמתנה (החלון הצף + שאלון ההתאמה)
--
-- **אין קשר ל-deal_waitlist**: זו תור פנימי לעסקה מסוימת, שמצביע על משקיע
-- קיים. כאן מדובר ברשימת ההמתנה הפומבית של האתר.
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN ('contact','waitlist')),

  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT NOT NULL,
  phone         TEXT,

  capital       TEXT,          -- הון משוער להשקעה
  liquid        TEXT,          -- האם ההון נזיל כרגע
  wants_contact TEXT,          -- רשימת המתנה בלבד: האם לחזור אליו
  message       TEXT,          -- טקסט חופשי, אם יתווסף שדה כזה

  source        TEXT,          -- contact-page · join-dialog · fitcheck-quiz
  page_url      TEXT,
  utm           JSONB,         -- utm_* + referrer, כפי שנקלטו בדפדפן
  raw           JSONB,         -- כל מה שנשלח, כמו שהוא. שדה חדש בטופס
                               -- לא דורש שינוי סכימה ולא הולך לאיבוד.

  consent       BOOLEAN DEFAULT FALSE,

  -- אין עמודת is_read נפרדת: "לא נקרא" הוא status = 'new'. מקור אמת אחד,
  -- אחרת השניים נפרדים ומונה ההתראות בתפריט משקר.
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','read','contacted','qualified','archived')),
  notes         TEXT,

  ip            TEXT,
  user_agent    TEXT,

  -- תוצאות האוטומציות. בלי זה כישלון שליחה חי רק בלוגים של Vercel.
  email_sent_at TIMESTAMPTZ,
  email_error   TEXT,
  push_sent_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_kind_created ON leads(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email        ON leads(lower(email));

-- ── מנויי התראות ───────────────────────────────────────────────────────
-- מנוי אחד לכל דפדפן/מכשיר. ה-endpoint הוא המפתח היציב שהדפדפן מנפיק,
-- ולכן הוא ייחודי — התקנה חוזרת מעדכנת שורה קיימת ולא מוסיפה כפילות.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  failure_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

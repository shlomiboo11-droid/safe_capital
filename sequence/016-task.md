---
id: 016
captured_at: 2026-04-24T14:23:00Z
has_image: true
images:
  - sequence/016-image-1.png
suggested_agents: []
complexity: low
---

# פרומפט מקורי
פה בוורסל?

# משימה משופרת

**הקשר ויזואלי (מהתמונה המצורפת):**
המשתמש נמצא ב-Vercel dashboard, ב-URL:
`vercel.com/shlomiboo11-droids-projects/safe-capital/settings/environments`

זהו דף **Environments** (לא Environment Variables!) — כאן רואים Production/Preview/Development.

**השאלה:** המשתמש שואל אם פה הוא צריך להגדיר את `CRON_SECRET`.

**תשובה (לא פעולה — זו משימה ענייה):**
- **לא** — הוא בדף הלא נכון.
- `CRON_SECRET` זה **Environment Variable** (משתנה סביבה), לא **Environment** (סביבה).
- הוא צריך ללחוץ בסיידבר השמאלי על **"Environment Variables"** (שמופיע מעל **Domains** ומתחת ל-**Settings**).
- בדף שייפתח: Add New → Name: `CRON_SECRET` → Value: מחרוזת אקראית (`openssl rand -hex 32`) → Environments: Production → Save.
- חשוב: הוא גם בפרויקט הלא נכון — הוא נמצא בפרויקט **safe-capital** (שהוא הפורטל משקיעים לפי ה-URL). ה-`CRON_SECRET` צריך להיכנס לפרויקט **admin**, כי שם ה-cron רץ.
- כדי להגיע לפרויקט admin: למעלה ליד לוגו Vercel → dropdown של הפרויקטים → בחר "admin".

**הגדרת 'מוגמר':**
- [ ] המשתמש מבין שהוא בדף הלא נכון
- [ ] המשתמש מבין איזה פרויקט (admin ולא safe-capital)
- [ ] המשתמש מבין את ההבדל בין Environments ל-Environment Variables

# תכנית ביצוע
זו משימת מידע בלבד — אין קוד לשנות. התשובה מופיעה לעיל.

# תמונות מצורפות
- sequence/016-image-1.png *(הערה: התמונה לא נשמרה כקובץ בינארי. התיאור לעיל משחזר את המצב הויזואלי.)*

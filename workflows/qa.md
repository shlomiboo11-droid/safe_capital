# Workflow: QA — Quality Assurance

**מתי להפעיל:** כאשר המשתמש מבקש לבדוק איכות קוד, לחפש באגים, לוודא שהמערכת עובדת, לבצע QA לפני deploy, או לאחר שינוי גדול.

**הפעלה:** `/qa`, "תעשה QA", "בדוק את המערכת", "חפש באגים", "verify"

---

## שלב 1 — זיהוי סקופ

לפני הכל — הבן מה לבדוק:

- **`all`** (ברירת מחדל) — כל 6 agents על כל הקוד
- **`quick`** — רק functions + logic (בדיקה מהירה)
- **`ui`** — רק UI ופורמים
- **`api`** — רק endpoints ו-backend
- **`logic`** — רק business logic
- **`e2e`** — רק user flows
- **`security`** — רק security ו-performance

זהה גם את מבנה הפרוייקט: תיקיות src, קבצי config, frameworks (React, Express, Python וכו'), מסגרות בדיקה קיימות.

---

## שלב 2 — הרצת 6 Agents (ברצף)

### Agent 1: function-tester
**משימה:** סרוק כל פונקציה ומתודה. לכל פונקציה בדוק:
- happy path עם קלטים תקינים
- edge cases: מחרוזות ריקות, null, undefined, מספרים שליליים, מערכים ריקים
- error cases: קלט לא תקין, כשלי רשת (לפונקציות async)
- boundary values: גבולות טווחים
כתוב unit tests בפרמייוורק הקיים. דווח: כמה פונקציות נמצאו, כמה נבדקו, כמה issues נמצאו.

---

### Agent 2: ui-form-tester
**משימה:** סרוק כל קומפוננט, פורם, כפתור, ו-input. לכל אחד בדוק:
- **פורמים:** validation (שדות חובה, פורמטים, שגיאות), submission (loading state, success, error, מניעת double-submit)
- **כפתורים:** click handler, disabled state, keyboard (Enter/Space)
- **קומפוננטים:** initial state, state transitions, empty states, error boundaries
- **accessibility:** aria labels, tab order, focus management
כתוב component tests. דווח: קומפוננטים, פורמים, issues קריטיים.

---

### Agent 3: api-tester
**משימה:** סרוק כל endpoint ו-route. לכל endpoint בדוק:
- **request validation:** שדות חובה, types, פרמטרים לא חוקיים
- **response:** status codes נכונים (200/201/400/401/403/404/500), schema תקין
- **CRUD:** create/read/update/delete עובדים נכון
- **auth:** unauthenticated → 401, unauthorized → 403
- **error handling:** שגיאות server לא חושפות stack traces
כתוב API tests. דווח: endpoints, CRUD operations, auth issues.

---

### Agent 4: logic-flow-tester
**משימה:** מפה כל לוגיקה עסקית ו-conditional flows. בדוק:
- **branches:** TRUE/FALSE לכל if/else, כל case ב-switch, default case
- **calculations:** תוצאות ידועות, חלוקה באפס, floating point, עיגולים
- **state machines:** transitions חוקיות בלבד, side effects של כל transition
- **transformations:** null handling, type coercion, date/timezone
- **business rules:** לא מתנגשות, סדר עדיפויות נכון
כתוב tests. דווח: logic blocks, branch coverage %, bugs.

---

### Agent 5: integration-e2e-tester
**משימה:** מפה ובדוק את כל user flows מקצה לקצה. בדוק:
- **auth flow:** signup → login → logout → session expiry
- **CRUD flows:** create → appears in list → edit → verify → delete → gone
- **data flow:** נתון שנכנס → נשמר → מוצג נכון בכל view
- **navigation:** כל links, back button, deep links, 404
- **cross-feature:** output של feature אחת הוא input נכון של אחרת
- **error recovery:** network disconnect, server error, session expiry mid-flow
כתוב E2E tests. דווח: flows, broken steps, data integrity.

---

### Agent 6: security-perf-tester
**משימה:** בדוק security ו-performance. בדוק:
- **injections:** SQL injection (raw queries), XSS (unescaped input), Command injection, Path traversal
- **auth:** hardcoded secrets, JWT misconfiguration, CSRF, IDOR, privilege escalation
- **data exposure:** passwords בלוגים, stack traces למשתמש, sensitive fields ב-API response
- **dependencies:** `npm audit` / `pip audit`, CVEs ידועות, packages ישנים
- **performance:** N+1 queries, missing indexes, unbounded queries, memory leaks, missing pagination, sync calls שצריכות להיות async
- **config:** CORS, security headers (CSP/HSTS), debug mode ב-production, insecure cookies
דווח: vulnerabilities לפי severity, performance bottlenecks.

---

## שלב 3 — QA Master Report

לאחר שכל 6 agents סיימו, צור דו"ח מרוכז:

```
# QA Master Report
תאריך: [date]
פרוייקט: [project-name]
סקופ: [what was tested]

## סיכום מנהלים
- ציון בריאות כולל: X/100
- בעיות קריטיות: X (חובה לתקן)
- עדיפות גבוהה: X (כדאי לתקן)
- עדיפות בינונית: X (מומלץ)
- עדיפות נמוכה: X (nice to have)
- בדיקות שנכתבו: X

## ציון — חישוב
מתחיל מ-100:
- בעיה קריטית: -15 כל אחת
- עדיפות גבוהה: -8 כל אחת
- עדיפות בינונית: -3 כל אחת
- עדיפות נמוכה: -1 כל אחת

## תוצאות לפי שכבה
### Functions — [X פונקציות, X tests, X issues]
### UI & Forms — [X קומפוננטים, X פורמים, X issues]
### API — [X endpoints, X CRUD, X auth issues]
### Logic — [X% branch coverage, X bugs]
### E2E — [X flows, X שבורים]
### Security & Performance — [X vulnerabilities, X bottlenecks]

## תוכנית פעולה לפי עדיפות

### מיידי (קריטי)
1. [בעיה] — [file:line] — [תיקון]

### השבוע (עדיפות גבוהה)
1. [בעיה] — [file:line] — [תיקון]

### בהמשך (עדיפות בינונית)
1. [בעיה] — [file:line] — [תיקון]
```

---

## שלב 4 — תיקון

לאחר הדו"ח, הצע למשתמש:
1. **תיקון אוטומטי** — תקן את כל הבעיות שיש להן פתרון ברור
2. **תיקון מודרך** — עבור על כל בעיה אחת אחת
3. **הרצה חוזרת** — לאחר תיקונים, הרץ שוב לאימות

---

## דוגמאות שימוש

```
תעשה QA על המערכת          ← כל 6 agents
תעשה QA מהיר               ← functions + logic בלבד
תבדוק רק את ה-UI            ← ui-form-tester בלבד
תעשה security audit         ← security-perf-tester בלבד
תבדוק flows לפני deploy     ← e2e + security
```

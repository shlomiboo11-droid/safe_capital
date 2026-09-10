# Safe Capital — Project Brief

מסמך זה מכיל את כל מה שצריך לדעת על הפרויקט כדי לכתוב פרומפטים רלוונטיים לפעולות ב-Claude Code.

---

## מה זה Safe Capital?

**סייף קפיטל** — חברת השקעות נדל"ן ישראלית שעושה עסקאות **Fix & Flip** בבירמינגהם, אלבמה (ארה"ב). קונים בתים במצב ירוד, משפצים, ומוכרים ברווח.

- **קהל יעד:** משקיעים ישראלים (גילאי 28–55, משתכרים 20K–50K ₪/חודש)
- **מודל השקעה:** מינימום $50K, תשואה עד 20%, עסקאות 3–12 חודשים
- **מבנה משפטי:** כל עסקה = LLC נפרד, משקיעים רשומים כבעלים לפי אחוז ההשקעה
- **חלוקת רווחים:** משקיעים מרוויחים קודם (עד 20%), מייסדים רק מעל 21%
- **צוות:** שלומי (CEO), איתן (רכישות), עדי והוטר (יחסי משקיעים)

---

## מבנה הפרויקט

```
safe_capital/
├── website/          ← אתר שיווקי (HTML סטטי, port 8081)
├── admin/            ← דאשבורד ניהול (Node.js + Express, port 3000)
├── .claude/agents/   ← סוכני Claude Code
├── oxmoore/          ← תיקיית עסקה לדוגמה (xlsx, תמונות, מסמכים)
└── 206mountain av/   ← תיקיית עסקה נוספת
```

---

## Website (האתר השיווקי)

### מידע טכני
- **טכנולוגיה:** HTML סטטי + Tailwind CSS (CDN) + Vanilla JavaScript
- **שפה:** עברית (RTL) — `<html dir="rtl" lang="he">`
- **שרת מקומי:** `cd website && python3 -m http.server 8081`
- **דפלוי:** Vercel (סטטי)
- **פונטים:** Heebo (עברית), Inter (מספרים/אנגלית)

### עמודים
| קובץ | עמוד | שורות | תיאור |
|-------|------|-------|--------|
| `index.html` | דף הבית / לנדינג | 1,407 | דף נחיתה שלם עם Hero, שיטת העבודה, Before/After, כרטיסי אמון, מספרים, צוות, FAQ, CTA |
| `landing.html` | לנדינג (עותק) | 1,407 | זהה ל-index.html |
| `properties.html` | עסקאות | 383 | רשימת עסקאות — מושך נתונים חיים מה-Admin API |
| `join.html` | איך להצטרף | 387 | תהליך ההשקעה בשלבים |
| `contact.html` | צור קשר | 269 | טופס יצירת קשר |
| `privacy.html` | מדיניות פרטיות | 256 | עמוד משפטי |
| `terms.html` | תנאי שימוש | 216 | עמוד משפטי |

### קבצי JavaScript
| קובץ | תפקיד |
|-------|--------|
| `js/shared.js` | Tailwind config + צבעי הברנד + קומפוננטות משותפות (navbar, footer) |
| `js/deals.js` | מושך עסקאות מ-API ומרנדר לעמוד properties.html |
| `js/join.js` | לוגיקה לעמוד ההצטרפות |
| `js/landing.js` | אנימציות ולוגיקה ללנדינג |
| `css/shared.css` | סטיילים משותפים |

### חיבור ל-Admin API
```javascript
// מתוך deals.js
const ADMIN_HOST = (window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://safe-capital-admin.vercel.app';
const API_URL = ADMIN_HOST + '/api/public/deals';
```
- ה-API הציבורי `/api/public/deals` **לא דורש אותנטיקציה**
- מחזיר כל עסקה שסומנה `is_published = true` עם כל הנתונים הקשורים

---

## Admin Dashboard (דאשבורד ניהול)

### מידע טכני
- **טכנולוגיה:** Node.js + Express + PostgreSQL (Supabase)
- **שרת מקומי:** `cd admin && npm run dev` (port 3000)
- **דפלוי:** Vercel (Serverless)
- **אותנטיקציה:** JWT (bcrypt לסיסמאות)
- **Frontend:** HTML + Tailwind CSS + Vanilla JS (לא React/Vue)

### עמודי ה-Admin
| קובץ | עמוד | תיאור |
|-------|------|--------|
| `public/login.html` | כניסה | התחברות עם email + סיסמה |
| `public/index.html` | דאשבורד ראשי | רשימת כל העסקאות |
| `public/deal.html` | עמוד עסקה | עריכת עסקה עם טאבים |
| `public/deal-wizard.html` | אשף עסקה חדשה | יצירת עסקה חדשה בשלבים |
| `public/users.html` | ניהול משתמשים | רשימת משתמשים + הוספה |

### API Routes
| Route | תיאור |
|-------|--------|
| `/api/auth` | כניסה/יציאה, JWT |
| `/api/deals` | CRUD עסקאות |
| `/api/deals/:id/financials` | נתונים פיננסיים |
| `/api/deals/:id/cashflow` | תזרים מזומנים |
| `/api/deals/:id/investors` | משקיעים + specs + timeline + images + comps + documents |
| `/api/upload` | העלאת קבצים |
| `/api/extract` | חילוץ נתונים מ-xlsx/PDF עם AI |
| `/api/google-drive` | אינטגרציית Google Drive |
| `/api/audit` | לוג פעולות |
| `/api/users` | ניהול משתמשים |
| `/api/public/deals` | API ציבורי (ללא אותנטיקציה) — מוזן לאתר |

### טאבים בעמוד עסקה (deal.html)
כל עסקה נערכת דרך טאבים, כל אחד בקובץ JS נפרד:

| טאב | קובץ JS | תוכן |
|-----|---------|-------|
| Property | `deal-tabs/property.js` | פרטי נכס בסיסיים |
| Financial | `deal-tabs/financial.js` | מחיר רכישה, ARV, עלויות |
| Specs | `deal-tabs/specs.js` | מפרט לפני/אחרי (חדרים, שטח) |
| Images | `deal-tabs/images.js` | תמונות לפני/אחרי/הדמיות |
| Timeline | `deal-tabs/timeline.js` | שלבי העסקה |
| Comps | `deal-tabs/comps.js` | השוואות שוק (Zillow) |
| Fundraising | `deal-tabs/fundraising.js` | גיוס — משקיעים + סכומים |
| Cashflow | `deal-tabs/cashflow.js` | תזרים מזומנים |
| Renovation | `deal-tabs/renovation.js` | תוכנית שיפוץ |
| Documents | `deal-tabs/documents.js` | מסמכים מצורפים |

### Database Schema (PostgreSQL / Supabase)

**טבלאות עיקריות:**

| טבלה | תיאור |
|-------|--------|
| `users` | משתמשי המערכת (super_admin, manager, investor) |
| `deals` | עסקאות — כל המידע הבסיסי |
| `deal_financials_snapshot` | צילום פיננסי (planned vs actual) |
| `deal_cost_categories` | קטגוריות עלות (רכישה, שיפוץ, מימון...) |
| `deal_cost_items` | פריטי עלות בכל קטגוריה |
| `deal_investors` | משקיעים לכל עסקה + סכומים + אחוזי בעלות |
| `deal_cashflow` | תזרים — הכנסות והוצאות לפי תאריך |
| `deal_specs` | מפרט לפני/אחרי |
| `deal_timeline_steps` | שלבי עסקה (sourcing → sold) |
| `deal_images` | תמונות (before, during, after, rendering, gallery, thumbnail) |
| `deal_comps` | עסקאות השוואה מ-Zillow |
| `deal_documents` | מסמכים ציבוריים |
| `deal_uploaded_documents` | מסמכים שהועלו לחילוץ נתונים |
| `deal_renovation_plan` | תוכנית שיפוץ + סיכום AI |
| `audit_log` | לוג פעולות |

**סטטוסים:**
- Property: `sourcing` → `purchased` → `planning` → `renovation` → `selling` → `sold`
- Fundraising: `upcoming` → `active` → `completed` → `closed`
- User roles: `super_admin`, `manager`, `investor`

---

## Design System

### צבעים
| Token | Hex | שימוש |
|-------|-----|-------|
| Background | `#fbf9f6` | רקע עמוד |
| Surface | `#f5f3f0` | בלוקים/סקשנים |
| Surface White | `#ffffff` | כרטיסים |
| Primary (Navy) | `#022445` | כותרות, CTA |
| Primary Container | `#1e3a5c` | גרדיינטים |
| Secondary (Crimson) | `#984349` | מספרים, אקצנטים |
| Text | `#1b1c1a` | טקסט ראשי |
| Text Muted | `#43474e` | טקסט משני |
| WhatsApp | `#25D366` | כפתורי וואטסאפ |

### כללי עיצוב בלתי ניתנים לשינוי
1. **אין קווים מפרידים** — רק שינויי רקע בין סקשנים
2. **אין צללים כבדים** — מקסימום blur 24px, opacity 4%
3. **אין יישור מרכזי** — עברית ימין, אנגלית שמאל. מרכז רק ב-Hero
4. **RTL כברירת מחדל** — כל ה-layout מניח RTL
5. **אין focus ring מלא** — רק border-bottom 2px ב-`#022445`

### טיפוגרפיה
- **כותרות:** Heebo 700/800
- **מספרים פיננסיים:** Inter Bold, צבע `#984349`
- **גוף:** Heebo 300/400, Inter לאנגלית

---

## סוכני Claude Code

הסוכנים מאורגנים בתוך `.claude/agents/` בשלושה צוותים:

### `build/` — בונים
| סוכן | תפקיד |
|-------|--------|
| `frontend-developer` | HTML/CSS/JS, אנימציות, קומפוננטות |
| `ui-designer` | עיצוב, SVG, עקביות ברנד |
| `content-strategist` | קופי, תוכן בעברית |
| `deal-analyst` | נתונים פיננסיים מ-xlsx/מסמכים |
| `mobile-adapter` | התאמת responsive, touch, מובייל |

### `qa/` — בודקים
| סוכן | תפקיד |
|-------|--------|
| `qa` | בדיקות E2E — לינקים, טפסים, RTL, responsive |
| `code-reviewer` | ביקורת קוד |
| `ux-reviewer` | UX, המרה, נגישות |
| `seo-legal-reviewer` | משפטי, SEO, disclaimers |

### `ops/` — ניהול ותיקון
| סוכן | תפקיד |
|-------|--------|
| `project-manager` | אורקסטרטור — מחלק משימות לצוותים |
| `debugger` | מציאת ותיקון באגים |

---

## איך להריץ

```bash
# אתר שיווקי
cd website && python3 -m http.server 8081
# פתח: http://localhost:8081

# דאשבורד ניהול
cd admin && npm run dev
# פתח: http://localhost:3000/login
```

---

## הערות חשובות לכתיבת פרומפטים

1. **שפה:** האתר בעברית (RTL). כשאומרים "ימין" מתכוונים לימין ויזואלית — שב-CSS זה `left`
2. **אין frameworks:** הכל Vanilla JS + Tailwind CDN. אין React/Vue/Next
3. **חיבור website ↔ admin:** רק דרך `/api/public/deals` (ללא auth). כל שאר ה-API דורש JWT
4. **נתוני עסקאות:** תמיד לקרוא מקבצי xlsx אמיתיים — אף פעם לא להמציא נתונים פיננסיים
5. **עיצוב:** אסור לשנות CSS/עיצוב אלא אם ביקשו במפורש
6. **משימות קטנות** (באג, שינוי בשדה) → לעבוד ישירות
7. **משימות גדולות** (עמוד חדש, פיצ'ר שנוגע ב-4+ קבצים) → להפעיל project-manager קודם
8. **DB:** PostgreSQL על Supabase — credentials ב-`admin/.env`
9. **Deploy:** שניהם על Vercel — website כסטטי, admin כ-serverless

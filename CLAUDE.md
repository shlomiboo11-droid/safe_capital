# Safe Capital — Project Instructions

## Project Overview
**Safe Capital (סייף קפיטל)** is an Israeli real estate investment company doing fix-and-flip deals in Birmingham, Alabama. The website targets Israeli investors and is Hebrew-first (RTL).

- **Website:** Marketing & investor-facing (`website/`)
- **Admin:** Internal dashboard for managing deals and investors (`admin/`)
- **Language:** Hebrew primary, RTL. English only for financial/real estate terms (LLC, Flip, ARV, Exit)
- **Servers:** Website on port 8081 (`python3 -m http.server`), Admin on port 3000 (Node.js)

## Task Routing
- **Small tasks** (bug fix, add/remove field, simple change, 1-3 files) → Work directly. No project-manager.
- **Large tasks** (new page, feature touching 4+ files, architecture) → Invoke `project-manager` first.

**Available workflows:** `workflows/single_task.md`, `workflows/qa.md`

## Image Generation — חובה בכל תמונה חסרה

**כלל ברזל:** בכל מקום באתר שצריך תמונה — אל תשתמש ב-placeholder, אל תדלג, אל תבקש מהמשתמש. צור את התמונה בעצמך.

### תהליך חובה:
1. **הבן** מה התמונה צריכה להראות (הקשר הדף, המיקום, הגודל)
2. **כתוב פרומפט** באנגלית, מציאותי ככל האפשר — פרט סגנון, תאורה, זווית, צבעים
3. **צור** עם `generate_image` (nano-banana MCP) — תמיד עם יחס גובה-רוחב מתאים
4. **העבר** את הקובץ מ-`generated_imgs/` ל-`website/images/` (או לתיקייה המתאימה)
5. **שים** את הנתיב בקוד ה-HTML

### עקרונות לפרומפט:
- **תמיד באנגלית**
- **תמיד פוטוריאליסטי:** "photorealistic, professional real estate photography, natural lighting, sharp focus, 8K"
- **ספציפי:** אל תכתוב "house" — כתוב "brick ranch-style home in Birmingham Alabama, green lawn, blue sky, afternoon light"
- **יחסי גובה-רוחב:** hero = `16:9`, כרטיסי דיל = `4:3`, פרופיל = `1:1`, מובייל = `9:16`

### תיקיות:
- תמונות אתר → `website/images/`
- תמונות פורטל → `admin/public/portal/images/`
- תמונות דיל ספציפי → `website/images/deals/[deal-name]/`

## Graphify Auto-Update Rule
בכל פעם שאתה משנה קובץ כלשהו בתיקיית `admin/` — בסוף התשובה שלך כתוב:
> עדכנתי גם את גרפיפיי

ה-hook מריץ את העדכון אוטומטית ברקע. ההודעה מאשרת לשלומי שזה קרה.

## Ironclad Rules
- **Never change CSS, design, colors, layout, or styling** unless the user explicitly asks
- **Never touch files outside the task scope** — no "improvements" or "cleanups"
- **After every code change** — verify it works (restart server if needed, test endpoint)
- **One agent max per task** — never spawn multiple agents

## Git Workflow — ערוץ אחד בלבד

**התיקייה `/Users/shlomidavid/claudecode/safe_capital` על ברנץ' `main` היא מקור האמת היחיד.**

הזרימה, ואין אחרת:
```
עורכים ב-main → בודקים ב-localhost → commit → push → Vercel מדפלוי → פרודקשן
```

חוקים:
- **אסור ליצור worktrees.** לא `git worktree add`, ולא `isolation: "worktree"` בקריאה ל-Agent. כל עבודה נעשית בתיקייה הראשית.
- **אסור ליצור ברנצ'ים.** לא `claude/*`, לא feature branches. עובדים ישירות על `main`.
- **`git pull` בתחילת כל סשן** שנוגע בקוד — לפני שנוגעים בקובץ הראשון.
- **`git push` בסוף כל סשן** שבו נעשה commit. שינוי שלא נדחף = שינוי שלא קיים בפרודקשן.
- לפני commit — לוודא שאין קבצי סוד בסטייג': `git diff --cached --name-only | grep -i "token\|secret\|credential\|\.env"`

**למה:** בעבר פיצ'ר שלם (WhatsApp Updates, 153 קבצים) נבנה ב-worktree, נדחף ל-GitHub, ועלה לפרודקשן — בזמן שהתיקייה הראשית נשארה תקועה חודשיים אחורה. שלומי גילה בפרודקשן פיצ'ר שלא היה קיים אצלו בלוקלהוסט. ערוץ אחד מונע את זה.

### פרודקשן
**Vercel לא עושה auto-deploy מ-GitHub.** דחיפה ל-`main` לא מעלה כלום לאוויר — צריך `/deploy` ידני לכל אחד מ-3 הפרויקטים (`website/`, `admin/`, שורש=investors). לכן `push` ו-`deploy` הם שני צעדים נפרדים, ושניהם חובה.

שורש הדיפלוי של האדמין הוא `admin/` — **כל קובץ שהקוד בצד השרת קורא בזמן ריצה חייב לשבת בתוך `admin/`**, אחרת הוא לא נכלל בחבילה ויקרוס ב-ENOENT בפרודקשן בלבד (זה בדיוק מה שקרה עם `docs/voice-guide.md`, שהועבר ל-`admin/docs/`).

## Design System — קרא לפני כל בנייה ב-`website/`

**`DESIGN-SYSTEM.md` (שורש הפרויקט) הוא מקור האמת העיצובי.** חולץ מסריקה מלאה של האתר — 17 עמודי HTML, 7 קבצי CSS, 8 קבצי JS. כל ערך בו מגובה במופע אמיתי בקוד.

| קובץ | תפקיד |
|------|-------|
| `DESIGN-SYSTEM.md` | ההנחיה המלאה — צבעים, טיפוגרפיה, מרווחים, כפתורים, טפסים, אייקונים, תמונות, מוֹשן, שכבות, RTL, כרטיסים. **כל כלל מכסה מובייל ודסקטופ** |
| `website/css/design-tokens.css` | 121 טוקנים בתחילית `--sc-*`. אדיטיבי — קישור אליו לא משנה שום דבר חזותי |
| `website/css/design-system.css` | **שכבת הקומפוננטות** — `.sc-btn`, `.sc-field`, `.sc-card`, `.sc-actions`, `.sc-form-card`, `.sc-t-*`. mobile-first, hover מוגן, reduced-motion מכובד. **תיקונים עיצוביים נכנסים כאן** |
| `website/styleguide.html` | תצוגה חיה של הכל + תצוגת מובייל מקבילה ב-iframe. הערכים בו נקראים מהטוקנים בזמן ריצה |
| `website/css/tokens.css` | גדלי פונט (`--fs-*`) — **דסקטופ בלבד.** לבנייה חדשה: `.sc-t-*`, שנושאת את שני המסכים |

**חובה לפני בנייה של עמוד, סקשן או קומפוננטה:**
1. **קרא את הסקשן הרלוונטי ב-`DESIGN-SYSTEM.md`** — לא לנחש ערך שנראה דומה לעמוד אחר
2. **השתמש במחלקות `.sc-*`** לפני שכותבים CSS חדש. רוב מה שצריך כבר שם
3. השתמש ב-`var(--sc-*)`, לא במספרים קשיחים. צריך ערך שאין? מוסיפים ל-`design-tokens.css`
4. **בנה mobile-first** — הערך ללא media query הוא המובייל
5. עבור על **§15 צ'קליסט** (כולל בלוק המובייל שבו) ו-**§18 מובייל** לפני סיום
6. **§16 "חריגות מוכרות"** מפרט 25 באגים אמיתיים שקיימים בקוד — המסמך מנצח את הקוד, לא להעתיק מהם

**במקרה של סתירה — `DESIGN-SYSTEM.md` קובע.** הסקשנים שמתחת (Key Design Constraints, Brand Colors, Typography) הם תקציר שלו.

## Key Design Constraints
These rules are non-negotiable. Violating them produces an off-brand result:

- **No 1px border lines** — use background color shifts for section separation
- **No heavy shadows** — max `blur: 24px`, `Y: 8px`, `opacity: 4%`
- **No center-alignment** — Hebrew flush-right, English flush-left. Center only for hero headlines
- **RTL by default** — `dir="rtl"` on root, all layout/spacing/flex assumes RTL
- **No full-box focus rings** — input focus = 2px bottom-border in `var(--sc-navy)` only

## Brand Colors
**הפלטה נקראת "דיו ואוקסבלד".** נבחרה מתוך חמש חלופות ב-`website/palettes.html`.

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Ink Navy) | `#0e1e2e` | כל המבנה — טקסט, כותרות, כפתורים, סקשן כהה, פוקוס |
| Accent (Oxblood) | `#5d1819` | המבטא היחיד — eyebrow, מספר מודגש, נאב אקטיבי |
| Accent on dark | `#a47e7e` | **אותו מבטא בסקשן כהה בלבד** — 4.71:1 מול הנייבי |
| Background | `#f7f5f1` | Page base |
| Surface | `#ffffff` | Cards, alternating sections |
| Fill | `#e8e5df` | Control fill — fields, tonal buttons |
| Body text | `rgba(14,30,46,0.72)` | נגזר מנייבי, לא אפור נפרד |

**למבטא שתי מדרגות, וזה לא קפריזה.** אוקסבלד על נייבי הוא 1.29:1 — כהה על כהה. הקס אחד לא יכול לשרת גם מצע בהיר וגם סקשן כהה, ואסור גם להפוך: המדרגה הבהירה על נייר היא 3.29:1 ונופלת. על `.sc-on-dark` משתמשים ב-`--sc-maroon-on-dark`. ראה `DESIGN-SYSTEM.md` §1.

**הנייבי הקודם `#022445` היה כחול טהור** — ערוץ הכחול גדול פי 34 מהאדום, וגוונים טהורים ברוויה גבוהה הם מה שעפרונות צבעוניים ודגלים עשויים מהם. `#1E3A5C`, `#7B2D33` ו-`#43474e` הוסרו.

**שלושה משטחים בהירים בלבד.** `#f5f3f0` ו-`#e4e2df` הוסרו — הם היו כמעט בלתי-נראים מול השכנים שלהם. ראה `DESIGN-SYSTEM.md` §1.2.

## Typography
**Heebo בלבד — משפחה אחת לכל דבר**, כולל מספרים ותוויות לטיניות.

- **Heebo 800** — hero, display, כותרות סקשן, מספרים
- **Heebo 700** — h3, h4, כפתורים, תוויות
- **Heebo 300** — טקסט גוף

Inter הוסר: ספרותיו פרופורציונליות ולכן עמודת סכומים לא מתיישרת. Montserrat מעולם לא היה בקוד.
**אין uppercase ואין מרווח אות רחב על טקסט קטן.** ההדגשה מגיעה ממשקל וצבע.

## Typography — חוק ברזל

**דרך אחת בלבד להגדיר גודל פונט בקוד האתר (`website/`):**

1. **אסור** לכתוב `font-size: Xrem/Xpx` בשום מקום (inline, `<style>`, או CSS file)
2. **אסור** להשתמש ב-Tailwind `text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl/6xl` לגודל טקסט
3. **מותר** רק: מחלקות `.t-*` (מ-`website/css/typography.css`) או `var(--fs-*)` (מ-`website/css/tokens.css`)
4. אם צריך גודל חדש — **הוסף אותו ל-`tokens.css`**, לא בקוד
5. לפני עריכה של UI — **קרא `tokens.css`** כדי לראות אילו טוקנים קיימים

**תוקף נוכחי:** `website/properties.html` דסקטופ בלבד. שאר העמודים והמובייל — יצורפו ב-phases הבאים.

## Agents
Specialist agents in `.claude/agents/`, organized by team:

### `build/` — Builds code & content
| Agent | Responsibility |
|-------|---------------|
| `frontend-developer` | HTML/CSS/JS, animations, interactive components |
| `ui-designer` | Visual design, SVG icons, brand consistency |
| `content-strategist` | Copy, messaging, Hebrew content |
| `deal-analyst` | Deal financial data from xlsx/docs |
| `mobile-adapter` | Mobile responsiveness, touch, viewport fixes |

### `qa/` — Reviews & tests
| Agent | Responsibility |
|-------|---------------|
| `qa` | End-to-end testing — links, forms, responsive, RTL |
| `code-reviewer` | Code quality, bugs, best practices |
| `ux-reviewer` | UX, conversion, trust signals |
| `seo-legal-reviewer` | Legal pages, SEO, compliance |

### `ops/` — Manages & fixes
| Agent | Responsibility |
|-------|---------------|
| `project-manager` | Orchestrator — delegates to teams |
| `debugger` | Bug finding and fixing |

## Codebase Knowledge Graph (RAG)

`graphify-out/` contains a pre-built knowledge graph of the `admin/` codebase:

| File | Use |
|------|-----|
| `graphify-out/graph.json` | Machine-readable graph — 273 nodes, 336 edges, 43 communities |
| `graphify-out/GRAPH_REPORT.md` | Plain-language architecture summary |
| `graphify-out/graph.html` | Interactive visual explorer (open in browser) |

**When to use:** Before touching any `admin/` code — read `graphify-out/GRAPH_REPORT.md` first to understand which modules are involved, then use `graph.json` to trace dependencies between functions/routes/files. This replaces blind `grep` searches across dozens of files.

**Key communities:** Deal Detail UI · UI Utilities · Comps (Zillow) · Timeline · Images/Google Drive · Deal Wizard · Renovation · Financial · Fundraising · Documents & AI Extraction · Notifications · User Management · Shared Components

**Refresh:** Run `/graphify admin` after major structural changes to the admin codebase.

## Deal Data
Deal folders (e.g., `oxmoore/`) contain: financial calculators (.xlsx), photos, renderings, construction plans, loan docs. Always read actual deal files — never invent financial data.

## RTL Note
When Shlomi says "ימין" he means the right side visually — which in CSS (RTL) maps to `left`. Flip accordingly.

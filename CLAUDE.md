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

## Key Design Constraints
These rules are non-negotiable. Violating them produces an off-brand result:

- **No 1px border lines** — use background color shifts for section separation
- **No heavy shadows** — max `blur: 24px`, `Y: 8px`, `opacity: 4%`
- **No center-alignment** — Hebrew flush-right, English flush-left. Center only for hero headlines
- **RTL by default** — `dir="rtl"` on root, all layout/spacing/flex assumes RTL
- **No full-box focus rings** — input focus = 2px bottom-border in `#022445` only

## Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Navy) | `#022445` / `#1E3A5C` | Headlines, CTAs, gradient |
| Secondary (Maroon) | `#984349` / `#7B2D33` | Key numbers, accents |
| Background | `#fbf9f6` | Page base |
| Surface Low | `#f5f3f0` | Section blocks |
| Surface Lowest | `#ffffff` | Cards |
| On Surface Variant | `#43474e` | Body text |

## Typography
- **Heebo 700/800** — Hebrew headlines
- **Inter / Montserrat** — numbers, financial metrics, English labels
- **Heebo 300 / Inter** — body text

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

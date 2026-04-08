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

## Agents
Specialist agents are in `.claude/agents/`. The project-manager orchestrates all of them:

| Agent | Responsibility |
|-------|---------------|
| `project-manager` | Orchestrator — reads workflows, delegates |
| `frontend-developer` | HTML/CSS/JS implementation |
| `ui-designer` | Visual design, styling, brand consistency |
| `content-strategist` | Copy, messaging, Hebrew content |
| `deal-analyst` | Deal financial data from xlsx/docs |
| `code-reviewer` | Post-implementation review |
| `ux-reviewer` | UX, conversion, trust signals |
| `debugger` | Bug finding and fixing |
| `seo-legal-reviewer` | Legal pages, SEO, compliance |

## Deal Data
Deal folders (e.g., `oxmoore/`) contain: financial calculators (.xlsx), photos, renderings, construction plans, loan docs. Always read actual deal files — never invent financial data.

## RTL Note
When Shlomi says "ימין" he means the right side visually — which in CSS (RTL) maps to `left`. Flip accordingly.

# Graph Report - website  (2026-04-12)

## Corpus Check
- 10 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 75 nodes · 76 edges · 23 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Deal Rendering Engine|Deal Rendering Engine]]
- [[_COMMUNITY_NagishLi Accessibility Plugin|NagishLi Accessibility Plugin]]
- [[_COMMUNITY_Admin API Integration|Admin API Integration]]
- [[_COMMUNITY_Deal Card Components|Deal Card Components]]
- [[_COMMUNITY_Join Page Flow|Join Page Flow]]
- [[_COMMUNITY_Landing Page Interactions|Landing Page Interactions]]
- [[_COMMUNITY_Site Settings & Stats|Site Settings & Stats]]
- [[_COMMUNITY_Accessibility Bootstrap|Accessibility Bootstrap]]
- [[_COMMUNITY_Shared Carousel|Shared Carousel]]
- [[_COMMUNITY_Join Progress & Celebration|Join Progress & Celebration]]
- [[_COMMUNITY_Accordion UI Pattern|Accordion UI Pattern]]
- [[_COMMUNITY_Portal Button Injection|Portal Button Injection]]
- [[_COMMUNITY_Hebrew Digit Audio|Hebrew Digit Audio]]
- [[_COMMUNITY_English Digit Audio|English Digit Audio]]
- [[_COMMUNITY_Tax FAQ Toggle|Tax FAQ Toggle]]
- [[_COMMUNITY_Scroll Fade Animation|Scroll Fade Animation]]
- [[_COMMUNITY_BeforeAfter Slider|Before/After Slider]]
- [[_COMMUNITY_WhatsApp FAB|WhatsApp FAB]]
- [[_COMMUNITY_Smooth Scroll|Smooth Scroll]]
- [[_COMMUNITY_Tooltip Toggle|Tooltip Toggle]]
- [[_COMMUNITY_Mobile Nav Menu|Mobile Nav Menu]]
- [[_COMMUNITY_FAQ Accordion|FAQ Accordion]]
- [[_COMMUNITY_Mobile Carousel|Mobile Carousel]]

## God Nodes (most connected - your core abstractions)
1. `renderExpandedContent() — Full Deal Detail Renderer` - 9 edges
2. `renderExpandedContent()` - 8 edges
3. `formatUSD() — Currency Formatter` - 5 edges
4. `formatUSD()` - 4 edges
5. `loadDeals()` - 4 edges
6. `NagishLi Accessibility Plugin v2.3` - 4 edges
7. `loadDeals() — Fetch Deals from Admin API` - 4 edges
8. `ADMIN_HOST — Admin API base URL (env-switched)` - 4 edges
9. `renderDealCard() — Deal Card HTML Generator` - 4 edges
10. `loadSiteSettings() — Fetch & inject site settings` - 4 edges

## Surprising Connections (you probably didn't know these)
- `NagishLi Accessibility Plugin v2.3` --conceptually_related_to--> `RTL-First Design Constraint`  [INFERRED]
  website/nagishli.js → website/CLAUDE.md
- `Tailwind Config — Brand Color Tokens` --conceptually_related_to--> `RTL-First Design Constraint`  [INFERRED]
  website/js/shared.js → website/CLAUDE.md
- `NagishLi Third-Party Credits` --references--> `NagishLi Accessibility Plugin v2.3`  [EXTRACTED]
  website/nl-files/gfx/credits.txt → website/nagishli.js
- `renderExpandedContent() — Full Deal Detail Renderer` --shares_data_with--> `[data-setting] / [data-setting-href] DOM Binding Pattern`  [EXTRACTED]
  website/js/deals.js → website/js/settings.js
- `Tailwind Config — Brand Color Tokens` --implements--> `Brand Color Palette (#022445 Navy, #984349 Crimson)`  [EXTRACTED]
  website/js/shared.js → website/CLAUDE.md

## Communities

### Community 0 - "Deal Rendering Engine"
Cohesion: 0.31
Nodes (12): formatUSD(), loadDeals(), renderCostCategories(), renderDealCard(), renderExpandedContent(), renderFundraisingBar(), renderGallery(), renderSpecs() (+4 more)

### Community 1 - "NagishLi Accessibility Plugin"
Cohesion: 0.22
Nodes (10): NagishLi Third-Party Credits, initNagishLi() — main plugin bootstrap, jQuery Dependency (dynamically loaded if missing), NagishLi Accessibility Settings (localStorage), NagishLi Accessibility Plugin v2.3, Tailwind Config — Brand Color Tokens, Brand Color Palette (#022445 Navy, #984349 Crimson), Website CLAUDE.md — Landing Page Project Instructions (+2 more)

### Community 2 - "Admin API Integration"
Cohesion: 0.27
Nodes (10): Admin API — /api/public/* (deals, settings, stats, contact), ADMIN_HOST — Admin API base URL (env-switched), loadDeals() — Fetch Deals from Admin API, API_URL — /api/public/deals endpoint, SETTINGS_API — Admin API base URL (env-switched), [data-setting] / [data-setting-href] DOM Binding Pattern, formatSettingValue() — Date Display Formatter (HE/EN), loadSiteSettings() — Fetch & inject site settings (+2 more)

### Community 3 - "Deal Card Components"
Cohesion: 0.33
Nodes (9): formatUSD() — Currency Formatter, renderDealCard() — Deal Card HTML Generator, renderCostCategories() — Cost Categories Accordion, renderExpandedContent() — Full Deal Detail Renderer, renderFundraisingBar() — Fundraising Progress Bar, renderGallery() — Before/After/Rendering Images, renderSpecs() — Property Specs Table, renderTimeline() — Deal Timeline Steps (+1 more)

### Community 4 - "Join Page Flow"
Cohesion: 0.67
Nodes (2): launchConfetti(), updateProgress()

### Community 5 - "Landing Page Interactions"
Cohesion: 0.5
Nodes (0): 

### Community 6 - "Site Settings & Stats"
Cohesion: 0.5
Nodes (0): 

### Community 7 - "Accessibility Bootstrap"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Shared Carousel"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Join Progress & Celebration"
Cohesion: 1.0
Nodes (2): launchConfetti() — Canvas Confetti Animation, Join Page Sticky Progress Bar

### Community 10 - "Accordion UI Pattern"
Cohesion: 1.0
Nodes (2): Deal Accordion Click Handler (document-level), Deal Accordion Toggle (shared.js — static HTML)

### Community 11 - "Portal Button Injection"
Cohesion: 1.0
Nodes (2): Portal Button Injection into Nav, PORTAL_URL — Investor Portal Link (env-switched)

### Community 12 - "Hebrew Digit Audio"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "English Digit Audio"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Tax FAQ Toggle"
Cohesion: 1.0
Nodes (1): toggleTaxAccordion() — Tax FAQ Accordion (Step 6)

### Community 15 - "Scroll Fade Animation"
Cohesion: 1.0
Nodes (1): IntersectionObserver — .fade-in-up scroll animations

### Community 16 - "Before/After Slider"
Cohesion: 1.0
Nodes (1): Before/After Image Slider

### Community 17 - "WhatsApp FAB"
Cohesion: 1.0
Nodes (1): WhatsApp FAB Visibility (scroll-triggered)

### Community 18 - "Smooth Scroll"
Cohesion: 1.0
Nodes (1): Smooth Scroll for Anchor Links

### Community 19 - "Tooltip Toggle"
Cohesion: 1.0
Nodes (1): Tooltip Toggle Click Handler

### Community 20 - "Mobile Nav Menu"
Cohesion: 1.0
Nodes (1): Mobile Menu Toggle (site nav)

### Community 21 - "FAQ Accordion"
Cohesion: 1.0
Nodes (1): FAQ Accordion Toggle

### Community 22 - "Mobile Carousel"
Cohesion: 1.0
Nodes (1): Mobile Carousel / Scroll-Snap with Dot Indicators

## Knowledge Gaps
- **24 isolated node(s):** `jQuery Dependency (dynamically loaded if missing)`, `NagishLi Accessibility Settings (localStorage)`, `NagishLi Third-Party Credits`, `Join Page Sticky Progress Bar`, `launchConfetti() — Canvas Confetti Animation` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Accessibility Bootstrap`** (2 nodes): `initNagishLi()`, `nagishli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Carousel`** (2 nodes): `initCarousels()`, `shared.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Join Progress & Celebration`** (2 nodes): `launchConfetti() — Canvas Confetti Animation`, `Join Page Sticky Progress Bar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accordion UI Pattern`** (2 nodes): `Deal Accordion Click Handler (document-level)`, `Deal Accordion Toggle (shared.js — static HTML)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portal Button Injection`** (2 nodes): `Portal Button Injection into Nav`, `PORTAL_URL — Investor Portal Link (env-switched)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hebrew Digit Audio`** (1 nodes): `he_digits.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `English Digit Audio`** (1 nodes): `en_digits.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tax FAQ Toggle`** (1 nodes): `toggleTaxAccordion() — Tax FAQ Accordion (Step 6)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scroll Fade Animation`** (1 nodes): `IntersectionObserver — .fade-in-up scroll animations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Before/After Slider`** (1 nodes): `Before/After Image Slider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WhatsApp FAB`** (1 nodes): `WhatsApp FAB Visibility (scroll-triggered)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Smooth Scroll`** (1 nodes): `Smooth Scroll for Anchor Links`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tooltip Toggle`** (1 nodes): `Tooltip Toggle Click Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mobile Nav Menu`** (1 nodes): `Mobile Menu Toggle (site nav)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FAQ Accordion`** (1 nodes): `FAQ Accordion Toggle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mobile Carousel`** (1 nodes): `Mobile Carousel / Scroll-Snap with Dot Indicators`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `renderExpandedContent() — Full Deal Detail Renderer` connect `Deal Card Components` to `Admin API Integration`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ADMIN_HOST — Admin API base URL (env-switched)` connect `Admin API Integration` to `Deal Card Components`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `renderDealCard() — Deal Card HTML Generator` connect `Deal Card Components` to `Admin API Integration`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `jQuery Dependency (dynamically loaded if missing)`, `NagishLi Accessibility Settings (localStorage)`, `NagishLi Third-Party Credits` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
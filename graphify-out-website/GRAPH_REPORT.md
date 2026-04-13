# Graph Report - website  (2026-04-12)

## Corpus Check
- 8 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 73 nodes · 76 edges · 21 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Module 0|Module 0]]
- [[_COMMUNITY_Module 1|Module 1]]
- [[_COMMUNITY_Module 2|Module 2]]
- [[_COMMUNITY_Module 3|Module 3]]
- [[_COMMUNITY_Module 4|Module 4]]
- [[_COMMUNITY_Module 5|Module 5]]
- [[_COMMUNITY_Module 6|Module 6]]
- [[_COMMUNITY_Module 7|Module 7]]
- [[_COMMUNITY_Module 8|Module 8]]
- [[_COMMUNITY_Module 9|Module 9]]
- [[_COMMUNITY_Module 10|Module 10]]
- [[_COMMUNITY_Module 11|Module 11]]
- [[_COMMUNITY_Module 12|Module 12]]
- [[_COMMUNITY_Module 13|Module 13]]
- [[_COMMUNITY_Module 14|Module 14]]
- [[_COMMUNITY_Module 15|Module 15]]
- [[_COMMUNITY_Module 16|Module 16]]
- [[_COMMUNITY_Module 17|Module 17]]
- [[_COMMUNITY_Module 18|Module 18]]
- [[_COMMUNITY_Module 19|Module 19]]
- [[_COMMUNITY_Module 20|Module 20]]

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
10. `Admin API — /api/public/* (deals, settings, stats, contact)` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Module 0"
Cohesion: 0.31
Nodes (12): formatUSD(), loadDeals(), renderCostCategories(), renderDealCard(), renderExpandedContent(), renderFundraisingBar(), renderGallery(), renderSpecs() (+4 more)

### Community 1 - "Module 1"
Cohesion: 0.22
Nodes (10): NagishLi Third-Party Credits, initNagishLi() — main plugin bootstrap, jQuery Dependency (dynamically loaded if missing), NagishLi Accessibility Settings (localStorage), NagishLi Accessibility Plugin v2.3, Tailwind Config — Brand Color Tokens, Brand Color Palette (#022445 Navy, #984349 Crimson), Website CLAUDE.md — Landing Page Project Instructions (+2 more)

### Community 2 - "Module 2"
Cohesion: 0.27
Nodes (10): Admin API — /api/public/* (deals, settings, stats, contact), ADMIN_HOST — Admin API base URL (env-switched), loadDeals() — Fetch Deals from Admin API, API_URL — /api/public/deals endpoint, SETTINGS_API — Admin API base URL (env-switched), [data-setting] / [data-setting-href] DOM Binding Pattern, formatSettingValue() — Date Display Formatter (HE/EN), loadSiteSettings() — Fetch & inject site settings (+2 more)

### Community 3 - "Module 3"
Cohesion: 0.33
Nodes (9): formatUSD() — Currency Formatter, renderDealCard() — Deal Card HTML Generator, renderCostCategories() — Cost Categories Accordion, renderExpandedContent() — Full Deal Detail Renderer, renderFundraisingBar() — Fundraising Progress Bar, renderGallery() — Before/After/Rendering Images, renderSpecs() — Property Specs Table, renderTimeline() — Deal Timeline Steps (+1 more)

### Community 4 - "Module 4"
Cohesion: 0.67
Nodes (2): launchConfetti(), updateProgress()

### Community 5 - "Module 5"
Cohesion: 0.5
Nodes (0): 

### Community 6 - "Module 6"
Cohesion: 0.5
Nodes (0): 

### Community 7 - "Module 7"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Module 8"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Module 9"
Cohesion: 1.0
Nodes (2): launchConfetti() — Canvas Confetti Animation, Join Page Sticky Progress Bar

### Community 10 - "Module 10"
Cohesion: 1.0
Nodes (2): Deal Accordion Click Handler (document-level), Deal Accordion Toggle (shared.js — static HTML)

### Community 11 - "Module 11"
Cohesion: 1.0
Nodes (2): Portal Button Injection into Nav, PORTAL_URL — Investor Portal Link (env-switched)

### Community 12 - "Module 12"
Cohesion: 1.0
Nodes (1): toggleTaxAccordion() — Tax FAQ Accordion (Step 6)

### Community 13 - "Module 13"
Cohesion: 1.0
Nodes (1): IntersectionObserver — .fade-in-up scroll animations

### Community 14 - "Module 14"
Cohesion: 1.0
Nodes (1): Before/After Image Slider

### Community 15 - "Module 15"
Cohesion: 1.0
Nodes (1): WhatsApp FAB Visibility (scroll-triggered)

### Community 16 - "Module 16"
Cohesion: 1.0
Nodes (1): Smooth Scroll for Anchor Links

### Community 17 - "Module 17"
Cohesion: 1.0
Nodes (1): Tooltip Toggle Click Handler

### Community 18 - "Module 18"
Cohesion: 1.0
Nodes (1): Mobile Menu Toggle (site nav)

### Community 19 - "Module 19"
Cohesion: 1.0
Nodes (1): FAQ Accordion Toggle

### Community 20 - "Module 20"
Cohesion: 1.0
Nodes (1): Mobile Carousel / Scroll-Snap with Dot Indicators

## Knowledge Gaps
- **24 isolated node(s):** `jQuery Dependency (dynamically loaded if missing)`, `NagishLi Accessibility Settings (localStorage)`, `Join Page Sticky Progress Bar`, `launchConfetti() — Canvas Confetti Animation`, `toggleTaxAccordion() — Tax FAQ Accordion (Step 6)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Module 7`** (2 nodes): `initNagishLi()`, `nagishli.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 8`** (2 nodes): `initCarousels()`, `shared.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 9`** (2 nodes): `launchConfetti() — Canvas Confetti Animation`, `Join Page Sticky Progress Bar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 10`** (2 nodes): `Deal Accordion Click Handler (document-level)`, `Deal Accordion Toggle (shared.js — static HTML)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 11`** (2 nodes): `Portal Button Injection into Nav`, `PORTAL_URL — Investor Portal Link (env-switched)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 12`** (1 nodes): `toggleTaxAccordion() — Tax FAQ Accordion (Step 6)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 13`** (1 nodes): `IntersectionObserver — .fade-in-up scroll animations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 14`** (1 nodes): `Before/After Image Slider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 15`** (1 nodes): `WhatsApp FAB Visibility (scroll-triggered)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 16`** (1 nodes): `Smooth Scroll for Anchor Links`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 17`** (1 nodes): `Tooltip Toggle Click Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 18`** (1 nodes): `Mobile Menu Toggle (site nav)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 19`** (1 nodes): `FAQ Accordion Toggle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 20`** (1 nodes): `Mobile Carousel / Scroll-Snap with Dot Indicators`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `renderExpandedContent() — Full Deal Detail Renderer` connect `Module 3` to `Module 2`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `ADMIN_HOST — Admin API base URL (env-switched)` connect `Module 2` to `Module 3`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `renderDealCard() — Deal Card HTML Generator` connect `Module 3` to `Module 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `jQuery Dependency (dynamically loaded if missing)`, `NagishLi Accessibility Settings (localStorage)`, `Join Page Sticky Progress Bar` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
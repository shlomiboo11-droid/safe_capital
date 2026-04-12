# Graph Report - admin  (2026-04-12)

## Corpus Check
- 48 files · ~500,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 343 nodes · 446 edges · 52 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Deal Detail UI|Deal Detail UI]]
- [[_COMMUNITY_UI Utilities & Helpers|UI Utilities & Helpers]]
- [[_COMMUNITY_Comparable Properties (Comps)|Comparable Properties (Comps)]]
- [[_COMMUNITY_Timeline Management|Timeline Management]]
- [[_COMMUNITY_Image & Google Drive Integration|Image & Google Drive Integration]]
- [[_COMMUNITY_Deal List & Management|Deal List & Management]]
- [[_COMMUNITY_Deal Creation Wizard|Deal Creation Wizard]]
- [[_COMMUNITY_Renovation Planning|Renovation Planning]]
- [[_COMMUNITY_Deal Edit View|Deal Edit View]]
- [[_COMMUNITY_Financial Tracking|Financial Tracking]]
- [[_COMMUNITY_Fundraising & Investors|Fundraising & Investors]]
- [[_COMMUNITY_Shared Portal Components|Shared Portal Components]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_User Management|User Management]]
- [[_COMMUNITY_Documents & AI Extraction|Documents & AI Extraction]]
- [[_COMMUNITY_Cash Flow Management|Cash Flow Management]]
- [[_COMMUNITY_Google Drive Integration|Google Drive Integration]]
- [[_COMMUNITY_User Profile|User Profile]]
- [[_COMMUNITY_Property Specs|Property Specs]]
- [[_COMMUNITY_Authentication & Authorization|Authentication & Authorization]]
- [[_COMMUNITY_Zillow Image Scraper|Zillow Image Scraper]]
- [[_COMMUNITY_AI Document Extractor|AI Document Extractor]]
- [[_COMMUNITY_Content Seeding|Content Seeding]]
- [[_COMMUNITY_Investor Migration|Investor Migration]]
- [[_COMMUNITY_API Middleware|API Middleware]]
- [[_COMMUNITY_Database Connection|Database Connection]]
- [[_COMMUNITY_Settings Seeding|Settings Seeding]]
- [[_COMMUNITY_Data Seeding|Data Seeding]]
- [[_COMMUNITY_Portal Authentication|Portal Authentication]]
- [[_COMMUNITY_Deal Cashflow Routes|Deal Cashflow Routes]]
- [[_COMMUNITY_Document Extraction|Document Extraction]]
- [[_COMMUNITY_Audit Logging|Audit Logging]]
- [[_COMMUNITY_Excel File Extraction|Excel File Extraction]]
- [[_COMMUNITY_Property Tab Rendering|Property Tab Rendering]]
- [[_COMMUNITY_HTTP Server Entry|HTTP Server Entry]]
- [[_COMMUNITY_Investor API Routes|Investor API Routes]]
- [[_COMMUNITY_Deal Sub-Entities|Deal Sub-Entities]]
- [[_COMMUNITY_Deal Financials|Deal Financials]]
- [[_COMMUNITY_Public API Routes|Public API Routes]]
- [[_COMMUNITY_File Upload|File Upload]]
- [[_COMMUNITY_Portal Routes|Portal Routes]]
- [[_COMMUNITY_Content Management|Content Management]]
- [[_COMMUNITY_Settings Routes|Settings Routes]]
- [[_COMMUNITY_Module 43|Module 43]]
- [[_COMMUNITY_Module 44|Module 44]]
- [[_COMMUNITY_Module 45|Module 45]]
- [[_COMMUNITY_Module 46|Module 46]]
- [[_COMMUNITY_Module 47|Module 47]]
- [[_COMMUNITY_Module 48|Module 48]]
- [[_COMMUNITY_Module 49|Module 49]]
- [[_COMMUNITY_Module 50|Module 50]]
- [[_COMMUNITY_Module 51|Module 51]]

## God Nodes (most connected - your core abstractions)
1. `PostgreSQL Pool (db.js)` - 17 edges
2. `Express App (server.js)` - 16 edges
3. `authenticate()` - 14 edges
4. `loadDeal (admin edit)` - 13 edges
5. `renderDeal()` - 12 edges
6. `logAudit helper` - 11 edges
7. `API (admin client)` - 8 edges
8. `formatCurrency()` - 7 edges
9. `escapeHtml()` - 7 edges
10. `renderPlanVsActual()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `startExtraction (wizard)` --calls--> `API (admin client)`  [INFERRED]
  admin/public/js/deal-wizard.js → admin/public/js/api.js
- `Express App (server.js)` --uses--> `Public Route (/api/public)`  [EXTRACTED]
  admin/server/server.js → admin/server/routes/public.js
- `Public Route (/api/public)` --uses--> `PostgreSQL Pool (db.js)`  [EXTRACTED]
  admin/server/routes/public.js → admin/server/db.js
- `Auth Route (/api/auth)` --calls--> `generateToken (auth.js)`  [EXTRACTED]
  admin/server/routes/auth.js → admin/server/middleware/auth.js
- `Extract Route (/api/extract)` --calls--> `XLSX Extractor Service`  [EXTRACTED]
  admin/server/routes/extract.js → admin/server/services/xlsx-extractor.js

## Communities

### Community 0 - "Deal Detail UI"
Cohesion: 0.08
Nodes (31): API (admin client), requireAuth (client), deleteDeal (admin), loadDeal (admin edit), saveDealField, deleteDealWithPassword, loadDeals (admin), renderDealCard (admin) (+23 more)

### Community 1 - "UI Utilities & Helpers"
Cohesion: 0.19
Nodes (24): logAudit helper, authenticate(), authorize(), generateToken (auth.js), PostgreSQL Pool (db.js), portalAuthenticate middleware, Audit Route (/api/audit), Auth Route (/api/auth) (+16 more)

### Community 2 - "Comparable Properties (Comps)"
Cohesion: 0.19
Nodes (23): closeLightbox(), deviationClass(), errorHTML(), escapeHtml(), formatCurrency(), formatDate(), hasValue(), initLightbox() (+15 more)

### Community 3 - "Timeline Management"
Cohesion: 0.14
Nodes (10): confirmAction(), createElement(), formatCurrency(), formatCurrencyInput(), getDealIdFromUrl(), getUrlParam(), parseAmount(), showConfirmModal() (+2 more)

### Community 4 - "Image & Google Drive Integration"
Cohesion: 0.18
Nodes (13): _buildOurData(), closeCompGallery(), _compDataRow(), deleteCompImage(), _indicator(), initCompsMap(), _loadGoogleMaps(), openCompGallery() (+5 more)

### Community 5 - "Deal List & Management"
Cohesion: 0.17
Nodes (9): buildStepRowHTML(), buildTimelineChartHTML(), buildTimelineTabHTML(), closeTimelineStepModal(), escapeHtml(), getActiveStageIndex(), onStageClick(), renderTimelineTab() (+1 more)

### Community 6 - "Deal Creation Wizard"
Cohesion: 0.18
Nodes (6): closeDriveLinkModal(), _handleDriveUrlParams(), handleImageDrop(), handleImageUpload(), renderImagesTab(), submitDriveLink()

### Community 7 - "Renovation Planning"
Cohesion: 0.18
Nodes (4): closeInlineCashflow(), deleteDealWithPassword(), loadDeals(), submitInlineCashflow()

### Community 8 - "Deal Edit View"
Cohesion: 0.26
Nodes (8): esc(), goToStep(), handleDrop(), handleFileSelect(), renderReviewStep(), showFileNames(), startExtraction(), updateExtractButton()

### Community 9 - "Financial Tracking"
Cohesion: 0.23
Nodes (6): autoRecalcRenovationTotal(), escapeHtmlRenovation(), handlePhaseCostChange(), renderRenovationTab(), toggleRenovationEditMode(), updateRenovationPhase()

### Community 10 - "Fundraising & Investors"
Cohesion: 0.29
Nodes (8): closeQuickCashflow(), loadDeal(), openQuickCashflow(), populateQuickCategories(), reloadDeal(), setQuickCashflowType(), submitQuickCashflow(), updateQuickCostItems()

### Community 11 - "Shared Portal Components"
Cohesion: 0.22
Nodes (3): recalcFinancials(), renderFinancialTab(), toggleFinancialEditMode()

### Community 12 - "Notifications"
Cohesion: 0.22
Nodes (2): deleteDealInvestor(), deleteInvestor()

### Community 13 - "User Management"
Cohesion: 0.39
Nodes (7): buildBottomNav(), buildFooter(), buildHeader(), fetchUnreadCount(), getCurrentPage(), initPortalShell(), updateBadges()

### Community 14 - "Documents & AI Extraction"
Cohesion: 0.33
Nodes (6): escapeHtml(), loadNotifications(), markAllAsRead(), markAsRead(), renderNotifications(), updateHeaderBadge()

### Community 15 - "Cash Flow Management"
Cohesion: 0.31
Nodes (4): deleteUser(), loadUsers(), renderUsers(), toggleUserStatus()

### Community 16 - "Google Drive Integration"
Cohesion: 0.22
Nodes (0): 

### Community 17 - "User Profile"
Cohesion: 0.32
Nodes (3): applyCashflowFilter(), clearCashflowFilters(), renderCashflowTab()

### Community 18 - "Property Specs"
Cohesion: 0.32
Nodes (8): PORTAL_API (portal auth), requirePortalAuth, loadDeal (portal), loadNotifications, markAsRead, fetchUnreadCount, initPortalShell, updateBadges

### Community 19 - "Authentication & Authorization"
Cohesion: 0.47
Nodes (3): getAuthenticatedDrive(), getStoredTokens(), makeOAuth2Client()

### Community 20 - "Zillow Image Scraper"
Cohesion: 0.53
Nodes (5): handlePasswordChange(), loadProfile(), profileField(), renderProfile(), showToast()

### Community 21 - "AI Document Extractor"
Cohesion: 0.33
Nodes (0): 

### Community 22 - "Content Seeding"
Cohesion: 0.67
Nodes (2): extractImagesFromResponse(), fetchZillowImages()

### Community 23 - "Investor Migration"
Cohesion: 0.83
Nodes (3): analyzeAllDocuments(), callClaude(), parseAIJson()

### Community 24 - "API Middleware"
Cohesion: 1.0
Nodes (2): readAgentFile(), seed()

### Community 25 - "Database Connection"
Cohesion: 1.0
Nodes (2): migrate(), parseName()

### Community 26 - "Settings Seeding"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Data Seeding"
Cohesion: 0.67
Nodes (3): analyzeAllDocuments, callClaude, getXlsxAsText

### Community 28 - "Portal Authentication"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Deal Cashflow Routes"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Document Extraction"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Audit Logging"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Excel File Extraction"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Property Tab Rendering"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "HTTP Server Entry"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Investor API Routes"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Deal Sub-Entities"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Deal Financials"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Public API Routes"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "File Upload"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Portal Routes"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Content Management"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Settings Routes"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Module 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Module 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Module 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Module 46"
Cohesion: 1.0
Nodes (1): initDb (db.js)

### Community 47 - "Module 47"
Cohesion: 1.0
Nodes (1): fetchZillowImages

### Community 48 - "Module 48"
Cohesion: 1.0
Nodes (1): renderDeal (portal)

### Community 49 - "Module 49"
Cohesion: 1.0
Nodes (1): hasRole (client)

### Community 50 - "Module 50"
Cohesion: 1.0
Nodes (1): formatDate

### Community 51 - "Module 51"
Cohesion: 1.0
Nodes (1): renderTimelineTab

## Knowledge Gaps
- **27 isolated node(s):** `initDb (db.js)`, `generateToken (auth.js)`, `portalAuthenticate middleware`, `XLSX Extractor Service`, `AI Extractor Service` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Portal Authentication`** (2 nodes): `db.js`, `initDb()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deal Cashflow Routes`** (2 nodes): `seed-settings.js`, `seedSettings()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Document Extraction`** (2 nodes): `seed.js`, `seed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audit Logging`** (2 nodes): `portalAuth.js`, `portalAuthenticate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Excel File Extraction`** (2 nodes): `deal-cashflow.js`, `recalcActualAmount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Property Tab Rendering`** (2 nodes): `audit.js`, `logAudit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Server Entry`** (2 nodes): `extract.js`, `parseAIAmount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Investor API Routes`** (2 nodes): `xlsx-extractor.js`, `getXlsxAsText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deal Sub-Entities`** (2 nodes): `property.js`, `renderPropertyTab()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deal Financials`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Public API Routes`** (1 nodes): `investors.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Upload`** (1 nodes): `deal-sub-entities.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portal Routes`** (1 nodes): `deal-financials.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Content Management`** (1 nodes): `public.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Settings Routes`** (1 nodes): `upload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 43`** (1 nodes): `portal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 44`** (1 nodes): `content.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 45`** (1 nodes): `settings.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 46`** (1 nodes): `initDb (db.js)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 47`** (1 nodes): `fetchZillowImages`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 48`** (1 nodes): `renderDeal (portal)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 49`** (1 nodes): `hasRole (client)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 50`** (1 nodes): `formatDate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 51`** (1 nodes): `renderTimelineTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `initDb (db.js)`, `generateToken (auth.js)`, `portalAuthenticate middleware` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Deal Detail UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Timeline Management` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
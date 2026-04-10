# Graph Report - admin  (2026-04-10)

## Corpus Check
- Large corpus: 159 files · ~1,964,680 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 273 nodes · 336 edges · 43 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `renderDeal()` - 12 edges
2. `formatCurrency()` - 7 edges
3. `escapeHtml()` - 7 edges
4. `renderPlanVsActual()` - 6 edges
5. `initPortalShell()` - 6 edges
6. `deviationClass()` - 5 edges
7. `renderMyInvestment()` - 5 edges
8. `planRow()` - 5 edges
9. `planRowTotal()` - 5 edges
10. `openQuickCashflow()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Deal Detail UI"
Cohesion: 0.19
Nodes (23): closeLightbox(), deviationClass(), errorHTML(), escapeHtml(), formatCurrency(), formatDate(), hasValue(), initLightbox() (+15 more)

### Community 1 - "UI Utilities & Helpers"
Cohesion: 0.14
Nodes (10): confirmAction(), createElement(), formatCurrency(), formatCurrencyInput(), getDealIdFromUrl(), getUrlParam(), parseAmount(), showConfirmModal() (+2 more)

### Community 2 - "Comparable Properties (Comps)"
Cohesion: 0.18
Nodes (13): _buildOurData(), closeCompGallery(), _compDataRow(), deleteCompImage(), _indicator(), initCompsMap(), _loadGoogleMaps(), openCompGallery() (+5 more)

### Community 3 - "Timeline Management"
Cohesion: 0.17
Nodes (9): buildStepRowHTML(), buildTimelineChartHTML(), buildTimelineTabHTML(), closeTimelineStepModal(), escapeHtml(), getActiveStageIndex(), onStageClick(), renderTimelineTab() (+1 more)

### Community 4 - "Image & Google Drive Integration"
Cohesion: 0.18
Nodes (6): closeDriveLinkModal(), _handleDriveUrlParams(), handleImageDrop(), handleImageUpload(), renderImagesTab(), submitDriveLink()

### Community 5 - "Deal List & Management"
Cohesion: 0.18
Nodes (4): closeInlineCashflow(), deleteDealWithPassword(), loadDeals(), submitInlineCashflow()

### Community 6 - "Deal Creation Wizard"
Cohesion: 0.26
Nodes (8): esc(), goToStep(), handleDrop(), handleFileSelect(), renderReviewStep(), showFileNames(), startExtraction(), updateExtractButton()

### Community 7 - "Renovation Planning"
Cohesion: 0.23
Nodes (6): autoRecalcRenovationTotal(), escapeHtmlRenovation(), handlePhaseCostChange(), renderRenovationTab(), toggleRenovationEditMode(), updateRenovationPhase()

### Community 8 - "Deal Edit View"
Cohesion: 0.29
Nodes (8): closeQuickCashflow(), loadDeal(), openQuickCashflow(), populateQuickCategories(), reloadDeal(), setQuickCashflowType(), submitQuickCashflow(), updateQuickCostItems()

### Community 9 - "Financial Tracking"
Cohesion: 0.22
Nodes (3): recalcFinancials(), renderFinancialTab(), toggleFinancialEditMode()

### Community 10 - "Fundraising & Investors"
Cohesion: 0.22
Nodes (2): deleteDealInvestor(), deleteInvestor()

### Community 11 - "Shared UI Components"
Cohesion: 0.39
Nodes (7): buildBottomNav(), buildFooter(), buildHeader(), fetchUnreadCount(), getCurrentPage(), initPortalShell(), updateBadges()

### Community 12 - "Notifications"
Cohesion: 0.33
Nodes (6): escapeHtml(), loadNotifications(), markAllAsRead(), markAsRead(), renderNotifications(), updateHeaderBadge()

### Community 13 - "User Management"
Cohesion: 0.31
Nodes (4): deleteUser(), loadUsers(), renderUsers(), toggleUserStatus()

### Community 14 - "Documents & AI Extraction"
Cohesion: 0.22
Nodes (0): 

### Community 15 - "Module: cashflow"
Cohesion: 0.32
Nodes (3): applyCashflowFilter(), clearCashflowFilters(), renderCashflowTab()

### Community 16 - "Module: google_drive"
Cohesion: 0.47
Nodes (3): getAuthenticatedDrive(), getStoredTokens(), makeOAuth2Client()

### Community 17 - "Module: profile"
Cohesion: 0.53
Nodes (5): handlePasswordChange(), loadProfile(), profileField(), renderProfile(), showToast()

### Community 18 - "Module: specs"
Cohesion: 0.33
Nodes (0): 

### Community 19 - "Module: auth"
Cohesion: 0.4
Nodes (0): 

### Community 20 - "Module: zillow_scraper"
Cohesion: 0.67
Nodes (2): extractImagesFromResponse(), fetchZillowImages()

### Community 21 - "Module: ai_extractor"
Cohesion: 0.83
Nodes (3): analyzeAllDocuments(), callClaude(), parseAIJson()

### Community 22 - "Module: seed_content"
Cohesion: 1.0
Nodes (2): readAgentFile(), seed()

### Community 23 - "Module: migrate_investors"
Cohesion: 1.0
Nodes (2): migrate(), parseName()

### Community 24 - "Module: api"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Module: db"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Module: seed_settings"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Module: seed"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Module: portalauth"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Module: deal_cashflow"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Module: extract"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Module: audit"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Module: xlsx_extractor"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Module: property"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Module: server"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Module: investors"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Module: deal_sub_entities"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Module: deal_financials"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Module: public"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Module: upload"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Module: portal"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Module: content"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Module: settings"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Module: db`** (2 nodes): `db.js`, `initDb()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: seed_settings`** (2 nodes): `seed-settings.js`, `seedSettings()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: seed`** (2 nodes): `seed.js`, `seed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: portalauth`** (2 nodes): `portalAuth.js`, `portalAuthenticate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: deal_cashflow`** (2 nodes): `deal-cashflow.js`, `recalcActualAmount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: extract`** (2 nodes): `extract.js`, `parseAIAmount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: audit`** (2 nodes): `audit.js`, `logAudit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: xlsx_extractor`** (2 nodes): `xlsx-extractor.js`, `getXlsxAsText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: property`** (2 nodes): `property.js`, `renderPropertyTab()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: server`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: investors`** (1 nodes): `investors.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: deal_sub_entities`** (1 nodes): `deal-sub-entities.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: deal_financials`** (1 nodes): `deal-financials.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: public`** (1 nodes): `public.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: upload`** (1 nodes): `upload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: portal`** (1 nodes): `portal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: content`** (1 nodes): `content.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module: settings`** (1 nodes): `settings.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `UI Utilities & Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
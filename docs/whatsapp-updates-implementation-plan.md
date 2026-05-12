# תוכנית ביצוע ארכיטקטונית — עמוד יצירת עדכוני WhatsApp

> מסמך זה הוא **תוכנית ביצוע** מבוססת על [docs/whatsapp-updates-feature-prompt.md](whatsapp-updates-feature-prompt.md). אין כאן קוד, רק מפת קבצים, סכמת DB, רשימת endpoints, ארכיטקטורת AI, פאזות, סיכונים. הביצוע יחל רק לאחר אישור.

## 0. עקרונות מנחים לכל הביצוע

- **לא לגעת ב-CSS/עיצוב קיים.** כל סטיילינג חדש יחיה בקובץ ייעודי `admin/public/css/whatsapp-updates.css` שמייבא tokens קיימים מ-`dashboard.css`.
- **שכבת AI מאוחדת.** במקום לשכפל את הלוגיקה של `services/article-bot.js`, נחלץ ממנו את ה-helper `callClaude()` ל-`services/claude-client.js` חדש (refactor מינימלי, לא שובר תאימות).
- **Frontend = vanilla JS** במודולים ES, בעקבות הדפוס של `article-bot.html` ושאר עמודי האדמין.
- **כל שלב חייב לעבור בדיקה** ידנית של שלומי לפני המעבר לפאזה הבאה. אין auto-deploy בין פאזות.
- **Feature flag** — משתנה `WHATSAPP_UPDATES_ENABLED` ב-`.env` (default `false`) כך שאפשר לכבות מהר אם משהו דולף לפרודקשן.

---

## 1. מפת קבצים מלאה

### 1.1 קבצים חדשים — Frontend

| נתיב | תיאור |
|------|------|
| `admin/public/whatsapp-updates.html` | העמוד הראשי. RTL. sidebar+main. טוען chat UI ו-modal. |
| `admin/public/js/whatsapp-updates/index.js` | Entry point. בוטסטראפ של App state, ראוטינג בין מסכים (sessions list / chat). |
| `admin/public/js/whatsapp-updates/onboarding-modal.js` | חלון הפתיחה — desktop modal / mobile bottom sheet. |
| `admin/public/js/whatsapp-updates/chat-view.js` | רינדור בועות הודעות, typing indicator, scroll behavior. |
| `admin/public/js/whatsapp-updates/composer.js` | תיבת הקלט בתחתית + כפתורי פעולה דינמיים לפי שלב. |
| `admin/public/js/whatsapp-updates/research-panel.js` | side panel ימני בדסקטופ — שאילתות פעילות, מקורות, טוקנים. |
| `admin/public/js/whatsapp-updates/selection-popover.js` | ה-popover/bottom-sheet שעולה על סלקציית טקסט (סעיף 6.5 ב-spec). |
| `admin/public/js/whatsapp-updates/length-tabs.js` | רכיב קצר/בינוני/ארוך בשלב הכתיבה + מונה מילים. |
| `admin/public/js/whatsapp-updates/sessions-list.js` | רשימת סשנים קודמים (Phase 6). |
| `admin/public/js/whatsapp-updates/sse-client.js` | wrapper דק ל-`EventSource` עם reconnect ו-event parsing. |
| `admin/public/js/whatsapp-updates/api-client.js` | wrapper ל-fetch מול `/api/whatsapp/*` — auth header, error handling. |
| `admin/public/js/whatsapp-updates/state.js` | store פנימי (Object + emitter קטן) — מצב סשן, הודעות, מחקר, טיוטה. |
| `admin/public/js/whatsapp-updates/markup.js` | פונקציות עזר להמרת `*bold*` של WhatsApp ל-HTML preview ובחזרה. |
| `admin/public/css/whatsapp-updates.css` | סטיילים ייעודיים. משתמש ב-tokens קיימים בלבד (Navy `#022445`, Maroon `#984349`, רקע `#fbf9f6`). |

### 1.2 קבצים קיימים שיתעדכנו — Frontend (תוספות בלבד, לא שינוי עיצוב קיים)

| נתיב | תוספת |
|------|------|
| `admin/public/index.html` + שאר עמודי האדמין | להוסיף לתפריט הצד פריט ניווט חדש "עדכוני וואטסאפ" (`/whatsapp-updates`) באזור "תוכן", אחרי "בוט כתבות". זהה למבנה הקיים — `<a class="sidebar-link">` + Material icon (`forum` או `chat`). **לא משנים שום סטייל**. |
| `admin/server/server.js` | להוסיף `app.use('/api/whatsapp', require('./routes/whatsapp'))` + serve של `/whatsapp-updates` route (אם יש router סטטי). |

### 1.3 קבצים חדשים — Backend

| נתיב | תיאור |
|------|------|
| `admin/server/routes/whatsapp.js` | כל ה-endpoints תחת `/api/whatsapp/*`. עוטף את ה-services. |
| `admin/server/services/whatsapp/session-store.js` | CRUD על `whatsapp_sessions` + auto-save draft + sync ל-Drive. |
| `admin/server/services/whatsapp/research-provider.js` | Interface (JSDoc) + factory לפי `RESEARCH_PROVIDER` env. |
| `admin/server/services/whatsapp/claude-research-provider.js` | Implementation עם Claude Sonnet 4.6 + tool use. שולח אירועים ל-SSE channel. |
| `admin/server/services/whatsapp/gpt5-research-provider.js` | Stub בלבד ב-Phase 1–5. ממומש ב-Phase 6 אם נצטרך. |
| `admin/server/services/whatsapp/writing-service.js` | קריאה ל-Claude Opus 4.7 עם prompt caching של voice-guide. |
| `admin/server/services/whatsapp/search-adapters/tavily.js` | Wrapper ל-Tavily Search API. |
| `admin/server/services/whatsapp/search-adapters/brave.js` | Wrapper ל-Brave Search API. |
| `admin/server/services/whatsapp/search-adapters/firecrawl.js` | Wrapper ל-Firecrawl scrape API. |
| `admin/server/services/whatsapp/search-adapters/index.js` | Router לפי `depth` + retry/fallback. |
| `admin/server/services/whatsapp/voice-guide-loader.js` | טוען `docs/voice-guide.md` לזיכרון, נשמר כ-cache-control `ephemeral` של Anthropic. |
| `admin/server/services/whatsapp/drive-sync.js` | יוצר תיקיית סשן ב-Drive ומעלה את 6 הקבצים (סעיף 8.2 ב-spec). משתמש ב-`getAuthenticatedDrive()` הקיים מ-`routes/google-drive.js`. |
| `admin/server/services/whatsapp/sse-bus.js` | מיני event-bus in-memory (Map of sessionId → response stream) לדחיפת אירועי סוכן ל-frontend. |
| `admin/server/services/whatsapp/cost-tracker.js` | סופר טוקנים ועלות לפי מודל, מצטבר לסשן. |
| `admin/server/services/claude-client.js` | **refactor** — חילוץ `callClaude()` הגנרי מ-`article-bot.js` + `ai-extractor.js` לקובץ אחד. תאימות מלאה. |

### 1.4 Migration / DB

| נתיב | תיאור |
|------|------|
| `admin/server/db.js` | להוסיף `CREATE TABLE IF NOT EXISTS` עבור 3 הטבלאות החדשות בתוך `initDb()` הקיים. **לא לגעת בטבלאות קיימות.** |

### 1.5 Configuration

| נתיב | תוספת |
|------|------|
| `admin/.env.example` | להוסיף `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`, `FIRECRAWL_API_KEY`, `OPENAI_API_KEY` (ריק עד Phase 6), `RESEARCH_PROVIDER=claude`, `WHATSAPP_UPDATES_ENABLED=false`, `WHATSAPP_DRIVE_ROOT_FOLDER_ID=`. |
| `admin/package.json` | תלויות חדשות (סעיף 6). |

### 1.6 Docs

| נתיב | תיאור |
|------|------|
| `docs/voice-guide.md` | מסמך הטון המלא — סעיפים 7.2.1, 7.2.2, 7.2.3 מה-spec + טבלת mood shifters + 6 הדוגמאות עצמן עם דגל "מקור לסטייל בלבד, לא להעתיק מסרים". זהו ה-system prompt של שלב הכתיבה. |
| `docs/whatsapp-updates-architecture.md` | (אופציונלי בסיום Phase 4) — diagram טקסטואלי של flow ה-AI לתחזוקה עתידית. |

---

## 2. סכמת DB

3 טבלאות חדשות, יתווספו בתוך `initDb()` ב-`admin/server/db.js` (פטרן `CREATE TABLE IF NOT EXISTS` בעקבות שאר הקובץ).

### 2.1 `whatsapp_sessions`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title               TEXT,                                 -- אוטומטי מהנושא, ניתן לעריכה
  status              TEXT NOT NULL DEFAULT 'onboarding'    -- onboarding | researching | research_review | writing | done | archived
                      CHECK(status IN ('onboarding','researching','research_review','writing','done','archived')),
  update_type         TEXT,                                 -- progress | new_deal | exit | macro | educational | event | holiday | other
  deal_id             INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  communication_goal  TEXT,
  length_pref         TEXT DEFAULT 'medium' CHECK(length_pref IN ('short','medium','long')),
  formality           TEXT DEFAULT 'professional_warm' CHECK(formality IN ('casual_warm','professional_warm','professional_dry')),
  research_depth      TEXT DEFAULT 'normal' CHECK(research_depth IN ('normal','deep')),
  topic_brief         TEXT,                                 -- הפסקה החופשית מסעיף 6.1
  messages            JSONB DEFAULT '[]'::jsonb,            -- כל בועות השיחה לסשן
  research_summary    TEXT,                                 -- הסיכום המאושר (עברית)
  final_post          TEXT,                                 -- הפוסט הסופי
  alternative_posts   JSONB DEFAULT '[]'::jsonb,            -- וריאציות שנוצרו
  tokens_used         INTEGER DEFAULT 0,
  estimated_cost_usd  NUMERIC(10,4) DEFAULT 0,
  drive_folder_id     TEXT,                                 -- ה-Drive folder id של הסשן (אם סונכרן)
  drive_synced_at     TIMESTAMPTZ,
  is_template         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_user ON whatsapp_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_status ON whatsapp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_deal ON whatsapp_sessions(deal_id);
```

### 2.2 `whatsapp_research_findings`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_research_findings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,                                -- השאילתה שהובילה לממצא
  query_lang  TEXT DEFAULT 'he' CHECK(query_lang IN ('he','en')),
  source_url  TEXT,
  source_name TEXT,
  raw_excerpt TEXT,                                         -- ציטוט מקורי (שפת מקור)
  hebrew_note TEXT,                                         -- סיכום בעברית
  provider    TEXT,                                         -- tavily | brave | firecrawl | anthropic_web
  relevance   NUMERIC(3,2),                                 -- 0..1
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_findings_session ON whatsapp_research_findings(session_id);
```

### 2.3 `whatsapp_drafts`

```sql
-- היסטוריית גרסאות (לא רק האחרונה) של סיכום מחקר ופוסט סופי.
-- מאפשר undo/diff/history של תיקונים נקודתיים.
CREATE TABLE IF NOT EXISTS whatsapp_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK(kind IN ('research_summary','post','alternative')),
  length_pref TEXT,                                         -- short/medium/long (לפוסטים)
  content     TEXT NOT NULL,
  parent_id   UUID REFERENCES whatsapp_drafts(id) ON DELETE SET NULL,
  edit_reason TEXT,                                         -- "תאמת מחקרית"/"קצר ב-30%"/"עריכה ידנית" וכו'
  tokens_used INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_drafts_session ON whatsapp_drafts(session_id, kind, created_at DESC);
```

**הערה:** הודעות הצ׳אט עצמן נשמרות כ-JSONB בעמודה `messages` של `whatsapp_sessions` ולא בטבלה נפרדת, כי זה תמיד נקרא יחד עם הסשן. אם בעתיד יעלה צורך בחיפוש חוצה-סשנים על הודעות — נשקול hot-migration לטבלה נפרדת.

---

## 3. API Endpoints

כל ה-endpoints מאחורי `authenticate` + `authorize('super_admin','manager')` (כמו `routes/content.js`). פרפיקס `/api/whatsapp`.

### 3.1 Sessions CRUD

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions` | `{ update_type, deal_id?, communication_goal?, length_pref, formality, research_depth }` (פלט Onboarding) | `{ session: WhatsappSession }` |
| `GET` | `/sessions` | — | `{ sessions: [...], counts: { researching, writing, done } }` |
| `GET` | `/sessions/:id` | — | `{ session, findings, drafts }` |
| `PATCH` | `/sessions/:id` | partial fields | `{ session }` |
| `DELETE` | `/sessions/:id` | — | `{ ok: true }` |
| `POST` | `/sessions/:id/duplicate` | — | `{ session }` (שכפול תבנית) |

### 3.2 Chat / messages

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions/:id/messages` | `{ role: 'user', content }` | `{ message }` (מצורף ל-`messages` JSONB) |
| `POST` | `/sessions/:id/topic` | `{ topic_brief }` | `{ proposed_queries: Query[] }` — הסוכן מציע 5-10 שאילתות (סעיף 6.2). |

### 3.3 Research stage

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions/:id/queries` | `{ queries: [{ id, text, enabled, lang }] }` | `{ ok }` — שמירה לפני התחלת ריצה. |
| `POST` | `/sessions/:id/research/start` | — | `{ ok, stream_url: '/api/whatsapp/sessions/:id/stream' }` — מאתחל ריצה אסינכרונית. |
| `GET` | `/sessions/:id/stream` | — (SSE) | `text/event-stream` עם events: `query_started`, `finding`, `consultation_needed`, `tokens`, `query_done`, `summary_ready`, `error`, `done`. |
| `POST` | `/sessions/:id/research/consult` | `{ consultation_id, answer }` | `{ ok }` — מענה לשאלת התייעצות בזמן ריצה (HITL). |
| `POST` | `/sessions/:id/research/stop` | — | `{ ok }` — קוטע ועובר לסיכום עם מה שיש. |
| `POST` | `/sessions/:id/research/edit-selection` | `{ selection: { start, end, text }, instruction, action }` | `{ patch: { start, end, old_text, new_text }, draft_id }` — סעיף 6.5: תיקון נקודתי. |
| `POST` | `/sessions/:id/research/accept` | `{ draft_id? }` | `{ ok }` — אישור הסיכום, מעבר לשלב כתיבה. |

### 3.4 Writing stage

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions/:id/write` | `{ length_pref }` | `{ draft_id, content, word_count }` — מייצר טיוטה ראשונית. |
| `POST` | `/sessions/:id/write/alternative` | `{ length_pref, count: 2 }` | `{ drafts: [...] }` |
| `POST` | `/sessions/:id/write/quick-action` | `{ draft_id, action: 'shorten_30' \| 'add_cta' \| 'add_emoji' \| 'remove_emoji' \| 'strengthen_open' \| 'strengthen_close' }` | `{ draft_id: new, content }` |
| `POST` | `/sessions/:id/write/edit-selection` | זהה לסעיף 3.3 אבל על draft של פוסט | `{ patch, draft_id }` |
| `POST` | `/sessions/:id/finalize` | `{ draft_id }` | `{ final_post, drive_folder_url? }` — נועל final_post, מסנכרן ל-Drive. |

### 3.5 Drive sync

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions/:id/drive/sync` | — | `{ folder_url, files: [...] }` — sync ידני (כפתור "💾 שמור בענן עכשיו"). |

### 3.6 Health / metadata

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `{ providers: { anthropic: 'ok', tavily: 'ok'/'down', ... }, drive_connected: bool }` |

---

## 4. ארכיטקטורת ה-AI / Agent

### 4.1 שכבות (מלמעלה למטה)

```
┌────────────────────────────────────────────────────────┐
│  routes/whatsapp.js   (HTTP + SSE adapters)            │
└────────────────────┬───────────────────────────────────┘
                     │
       ┌─────────────┼─────────────────────────┐
       │             │                         │
┌──────▼─────┐ ┌─────▼─────────┐ ┌─────────────▼─────┐
│ session-   │ │ research-     │ │ writing-service   │
│ store      │ │ provider      │ │ (Opus 4.7)        │
│ (DB+Drive) │ │ (interface)   │ └─────────┬─────────┘
└──────┬─────┘ └─────┬─────────┘           │
       │             │                     │
       │       ┌─────▼──────────┐    ┌─────▼─────────┐
       │       │ claude-research│    │ voice-guide-  │
       │       │ -provider      │    │ loader        │
       │       │ (Sonnet 4.6)   │    │ (cached)      │
       │       └─────┬──────────┘    └───────────────┘
       │             │
       │       ┌─────▼─────────────────────────┐
       │       │ search-adapters/              │
       │       │  tavily | brave | firecrawl   │
       │       │  + anthropic native web_search│
       │       └───────────────────────────────┘
       │
┌──────▼──────────────┐
│ drive-sync          │  → routes/google-drive.js (getAuthenticatedDrive)
└─────────────────────┘
```

### 4.2 `ResearchProvider` interface (JSDoc — JS, לא TS)

```js
/**
 * @typedef {Object} Query
 * @property {string} id
 * @property {string} text
 * @property {'he'|'en'} lang
 * @property {string} rationale  // מה היא בודקת ולמה
 */

/**
 * @interface ResearchProvider
 *   proposeQueries(sessionCtx) → Promise<Query[]>
 *   executeResearch(sessionCtx, queries) → AsyncIterator<ResearchEvent>
 *   summarize(sessionCtx, findings) → Promise<{ summary, sources }>
 *   reviseSelection(sessionCtx, selection, instruction) → Promise<{ new_text }>
 */
```

`factory(env.RESEARCH_PROVIDER)` מחזיר `ClaudeResearchProvider` (Phase 2) או `GPT5DeepResearchProvider` (Phase 6).

### 4.3 חלוקת מודלים בפועל

| תפקיד | מודל | קריאה דרך |
|--------|------|-----------|
| הצעת שאילתות | `claude-sonnet-4-6` | `services/claude-client.js` |
| ביצוע מחקר רגיל | `claude-sonnet-4-6` + tool use (Tavily + native web_search) | `claude-research-provider` |
| ביצוע מחקר מעמיק | `claude-opus-4-7` + extended thinking + tool use (Tavily+Brave+Firecrawl) | `claude-research-provider` |
| סיכום מחקר לעברית | `claude-sonnet-4-6` | `claude-research-provider.summarize()` |
| תיקון סלקציה (מחקר וכתיבה) | `claude-sonnet-4-6` | `writing-service.reviseSelection()` |
| כתיבת הפוסט הסופי | `claude-opus-4-7` עם voice-guide cached | `writing-service.generatePost()` |
| Quick actions (קצר ב-30% וכו׳) | `claude-sonnet-4-6` | `writing-service.applyQuickAction()` |

### 4.4 Prompt caching

- `docs/voice-guide.md` ייטען פעם אחת ל-system prompt עם `cache_control: { type: 'ephemeral' }`. חוסך ~90% מהטוקנים בכל קריאה חוזרת בתוך 5 דקות.
- נתוני דיל (אם נבחר `deal_id` ב-Onboarding) — נטענים כ-cache block נפרד, גם הם eph.
- ההודעות עצמן של המשתמש לא נשמרות ב-cache (משתנות).

### 4.5 SSE event model

```
event: query_started     data: { query_id, text }
event: tool_call          data: { provider, query, args }
event: finding            data: { finding_id, query_id, source_url, source_name, raw_excerpt, hebrew_note }
event: consultation_needed data: { consultation_id, question, options: [...] }
event: tokens             data: { used, cost_usd }
event: query_done         data: { query_id }
event: summary_ready      data: { draft_id, content }
event: error              data: { message, recoverable: bool }
event: done               data: { reason: 'completed' | 'stopped' }
```

ה-frontend מצייר את הפאנל הימני מ-events אלה בזמן אמת. ה-state נשמר גם ב-DB כדי שריענון דף לא יאבד הקשר (resume from latest).

### 4.6 SessionStore — DB + Drive synchronization

- **כל 10 שניות** — debounce של auto-save רק אם יש שינוי ב-`messages`/`draft` (`UPDATE whatsapp_sessions SET messages=$1, updated_at=NOW()`).
- **בסיום שלב מחקר** (`status` → `writing`) — קריאה ל-`drive-sync.syncResearchStage(sessionId)` שיוצר את התיקיה ב-Drive ומעלה `01_settings.json` + `02_research-summary.md` + `03_research-sources.json`.
- **בסיום שלב כתיבה** (`status` → `done`) — `drive-sync.syncFinalStage(sessionId)` מעלה `04_final-post.txt` + `05_alternative-versions/` + `06_session-log.json`.
- **כפתור "שמור בענן עכשיו"** — קריאה ידנית ל-sync מלא, גם אם באמצע סשן.

מבנה התיקיות תואם לסעיף 8.2 ב-spec:
```
Safe Capital - WhatsApp Updates/
└── <YYYY>/<MM-Mon>/<YYYY-MM-DD>_<title-slug>/
    ├── 01_settings.json
    ├── 02_research-summary.md
    ├── 03_research-sources.json
    ├── 04_final-post.txt
    ├── 05_alternative-versions/
    └── 06_session-log.json
```

ה-root folder מוגדר ב-`.env` כ-`WHATSAPP_DRIVE_ROOT_FOLDER_ID` (נוצר ידנית ב-Drive פעם אחת ע"י שלומי).

---

## 5. חלוקה ל-6 Phases

### Phase 1 — Skeleton (ETA: 2–3 ימי עבודה)

**Scope:**
- `whatsapp-updates.html` עם sidebar, header, chat area ריק, composer.
- Onboarding modal (desktop) + bottom sheet (mobile, גרסה בסיסית).
- DB migration — 3 הטבלאות.
- API: `POST /sessions`, `GET /sessions/:id`, `PATCH /sessions/:id`, `POST /sessions/:id/messages`.
- שמירה אוטומטית debounced של הודעות צ׳אט.
- כפתור "סשן חדש" עובד, כפתור "סשנים קודמים" עדיין placeholder.
- ניווט בתפריט הצד של ה-admin (`/whatsapp-updates`).

**Definition of Done:**
- אפשר להיכנס לעמוד, לפתוח Onboarding, למלא את 7 השדות, להתחיל סשן, להחליף עם הסוכן הודעות mock (echo) ולראות שהן נשמרות ב-DB.
- ריענון דף → חוזר לאותו סשן ולאותן הודעות.
- שום שינוי בעיצוב של עמודים קיימים.

**בדיקות:**
- `curl POST /api/whatsapp/sessions` עם payload תקין → status 201.
- בדיקת RTL: עברית מיושרת לימין, כפתורים בסדר נכון.
- בדיקת mobile: 360px, 414px — modal הופך ל-sheet.

---

### Phase 2 — Research engine בסיסי (ETA: 4–5 ימי עבודה)

**Scope:**
- `services/claude-client.js` (refactor מ-`article-bot.js`).
- `claude-research-provider.js` — proposeQueries + executeResearch (ללא HITL עדיין, ללא Brave/Firecrawl) + summarize.
- `search-adapters/tavily.js` + Anthropic native `web_search_20250305`.
- SSE channel ב-`routes/whatsapp.js`.
- API: `/topic`, `/queries`, `/research/start`, `/stream`, `/research/accept`.
- UI: רשימת שאילתות עם checkboxes, side panel מציג findings + tokens, בועת סיכום מחקר.
- Cost tracker — מחשב עלות מצטברת.

**Definition of Done:**
- סשן מלא: Onboarding → topic → queries → run → summary → accept → סטטוס "writing".
- במחקר רגיל, סשן ממוצע גמור תוך ~3–5 דק׳, עלות $0.3–0.6 (target).
- כל finding נשמר ב-`whatsapp_research_findings`.
- ריענון דף תוך כדי מחקר → רואים progress עד הנקודה האחרונה שנשמרה.

**בדיקות:**
- מחקר על דיל אמיתי מה-DB (`deal_id` נבחר ב-Onboarding) — הסוכן צריך להזריק את נתוני הדיל ל-context.
- מחקר על "ריבית Fed Q1 2026" — חייב להחזיר מקורות אמיתיים עם URLs.
- בדיקת fallback: לסגור TAVILY_API_KEY → לראות שהסוכן מודיע על השגיאה ולא קורס.

---

### Phase 3 — Human-in-the-loop + ממשק תיקונים (ETA: 4–5 ימי עבודה)

**Scope:**
- מנגנון `consultation_needed` ב-SSE — הסוכן עוצר בצומת החלטה, ה-frontend מציג שאלת התייעצות עם כפתורים.
- `POST /research/consult` — מענה ממשיך את הסוכן.
- כפתור "עצור מחקר" — `POST /research/stop`.
- `selection-popover.js` — סלקציה על בועת הסיכום פותחת popover/sheet עם 6 הכפתורים מסעיף 6.5 + תיבת טקסט.
- `POST /research/edit-selection` — מחזיר patch + diff ויזואלי (accept/reject).
- "ערוך טקסט חופשית" — toggle ל-textarea.
- היסטוריית גרסאות ב-`whatsapp_drafts` עם parent_id.

**Definition of Done:**
- שלומי יכול לסמן משפט בסיכום ולבקש "תאמת מחקרית" — הסוכן יקרא ל-search adapter עם השאילתה, יחזיר טקסט מתוקן, ושלומי יוכל לאשר/לדחות.
- מספר תיקונים רצופים שומרים שרשרת drafts ב-DB.
- במובייל: סלקציה ארוכה ב-touch פותחת bottom sheet עם אותם כפתורים.

**בדיקות:**
- סלקציה של חצי משפט → תיקון → diff מוצג נכון.
- סלקציה של שני קטעים נפרדים → שליחת הוראה אחת לשניהם → שניהם מתוקנים.
- בדיקה שאחרי תיקון, סלקציה ישנה לא "תופסת" אינדקסים שלא קיימים יותר.

---

### Phase 4 — Writing stage עם voice-guide (ETA: 4–5 ימי עבודה)

**Scope:**
- כתיבת `docs/voice-guide.md` — כל סעיפי 7.2 + 6 הדוגמאות. דגל ברור "סטייל בלבד".
- `writing-service.js` — `generatePost()` עם Claude Opus 4.7 + voice-guide cached + mood shifter לפי `update_type`.
- API: `/write`, `/write/alternative`, `/write/quick-action`, `/write/edit-selection`, `/finalize`.
- UI: 3 tabs לאורך (קצר/בינוני/ארוך), מונה מילים עם גוון ירוק/כתום/אדום, כפתור "העתק לוואטסאפ" שמעתיק טקסט עם `*bold*` ושומר line breaks, כפתור "גרסה אלטרנטיבית".
- אותו `selection-popover` משלב 3 פעיל גם על טיוטת הפוסט.

**Definition of Done:**
- מסשן מחקר מאושר → לחיצה על "עבור לכתיבה" → טיוטה ראשונה ב-Opus תוך ~10–15 שניות.
- מעבר בין tabs קצר/בינוני/ארוך — או טוען draft קיים או מייצר חדש.
- "העתק לוואטסאפ" — בדיקה ידנית שההדבקה לוואטסאפ אמיתי שומרת bold, ירידות שורה, ואמוג׳ים.
- Mood shifters עובדים: סשן "יום זיכרון" מייצר טקסט שקט; סשן "Exit" מייצר טקסט אנרגטי.

**בדיקות:**
- ייצור 3 פוסטים מסוגים שונים → השוואה אנושית של שלומי שהטון אכן שונה.
- בדיקה שאין `#` כותרות, אין bullets אמריקאיים, אין קלישאות AI שמפורטות ב-anti-patterns.

---

### Phase 5 — Mobile polish (ETA: 2–3 ימי עבודה)

**Scope:**
- Bottom sheet מלא לכל ה-modals (Onboarding, popover, sessions list).
- Sticky composer שנצמד למקלדת (CSS `position: sticky` + `visualViewport` API).
- Hamburger menu לסיידבר.
- Drag-to-dismiss לכל ה-sheets.
- Touch targets ≥ 44px על כל הכפתורים.
- Long-press selection במובייל עם feedback ויזואלי.
- בדיקת responsiveness ב-360px / 414px / 768px.

**Definition of Done:**
- שימוש מלא בסשן באייפון 13 mini ללא בעיות.
- מקלדת לא חוסמת את ה-composer.
- מעברים בין שלבים חלקים (no layout shift).

**בדיקות:**
- DevTools mobile emulation + מכשיר אמיתי של שלומי.
- בדיקת RTL במובייל — חצים בכיוון נכון, slide-in מצד נכון.

---

### Phase 6 — History + Drive sync + GPT-5 fallback (ETA: 3–4 ימי עבודה, אופציונלי)

**Scope:**
- עמוד "סשנים קודמים" — חיפוש לפי תאריך/נושא/סוג, פתח/שכפל/מחק.
- `drive-sync.js` מלא + סנכרון אוטומטי בנקודות מפתח + כפתור "💾 שמור בענן עכשיו".
- אם שלומי החליט שצריך — `gpt5-research-provider.js` עם OpenAI Deep Research API. החלפה ע"י `RESEARCH_PROVIDER=gpt5` ב-`.env`.
- שיתוף סשן עם הצוות (אופציונלי — דורש החלטה).

**Definition of Done:**
- כל פלט סופי מופיע ב-Drive בתיקיית `Safe Capital - WhatsApp Updates/<year>/<month>/<session>`.
- חיפוש בהיסטוריה מחזיר תוצאות נכונות.
- אם GPT-5 הופעל — סשן מחקר מעמיק רץ דרכו וההמשך (כתיבה) נשאר על Claude.

---

## 6. תלויות חיצוניות (npm)

נוסיף ל-`admin/package.json`:

| Package | גרסה משוערת | למה |
|---------|--------------|-----|
| `@anthropic-ai/sdk` | `^0.30.0` | קליינט רשמי. עדיף על fetch ידני בשביל streaming + tool use + caching. |
| `eventsource` | `^2.0.2` | לא חובה (frontend משתמש ב-EventSource native), אבל יכול לעזור בבדיקות. |
| `slugify` | `^1.6.6` | שמות תיקיות Drive (Hebrew-safe slugs). |

**לא נוסיף SDKs לחיצוניים** (Tavily/Brave/Firecrawl) — נשתמש ב-`fetch` ישיר בתוך adapters קטנים. הוספת חבילות מקטינה bundle ומאריכה install.

**OpenAI SDK** — רק ב-Phase 6 אם נחליט להפעיל GPT-5.

---

## 7. בדיקות מומלצות לכל Phase

| Phase | בדיקות חובה |
|-------|-------------|
| 1 | curl על כל endpoint + lighthouse mobile + manual smoke test של Onboarding + RTL |
| 2 | סשן מחקר מלא + spot-check על 5 findings שהמקורות אמיתיים + cost tracker נכון + fallback API failure |
| 3 | סלקציה + תיקון × 3 סוגי instructions + heatest שאחרי תיקון אינדקסים תקינים + mobile long-press |
| 4 | ייצור פוסט בכל 7 mood shifters + העתקה לוואטסאפ אמיתי + מונה מילים מדויק + alternative versions |
| 5 | מכשיר אמיתי + emulation × 3 viewports + מקלדת + drag-to-dismiss + accessibility (focus trap ב-modals) |
| 6 | סנכרון Drive בדיקה — קובץ נוצר, נפתח, תוכן תקין + GPT-5 (אם הופעל) → fallback ל-Claude עובד |

**רגרסיה כללית בכל פאזה:** לבדוק שעמודי `articles.html`, `content-agents.html`, `weekly-briefing.html`, `index.html` של ה-admin עובדים כרגיל ולא נפגעו (העמוד החדש נוסף לצדם, לא במקומם).

---

## 8. סיכונים וצמתי החלטה

### 8.1 סיכונים טכניים

| סיכון | חומרה | מיטיגציה |
|--------|--------|----------|
| **Anthropic SDK + tool use זמן ריצה ארוך → timeout של Vercel serverless** | גבוהה | להריץ research כ-background job. ה-`POST /research/start` רק יוצר רשומה ו-fork. ה-streaming דרך SSE channel נפרד. ב-Vercel ייתכן שצריך לעבור ל-`runtime: edge` או להוציא את ה-runner לתהליך חיצוני (Railway/Render worker). **צומת החלטה לפני Phase 2.** |
| **SSE לא תומך מעבר ל-Vercel Edge בצורה אמינה** | בינונית | חלופה: long-polling קצר (כל 2 שניות) על endpoint `/sessions/:id/events?since=X`. פחות אלגנטי, יותר אמין. |
| **Prompt caching לא נשמר בין קריאות serverless** | בינונית | ה-caching של Anthropic הוא 5 דקות ממומש בצד שלהם — לא תלוי בהפעלה רציפה אצלנו. כל קריאה ששולחת את אותו cache block תיהנה. |
| **מקורות סותרים / מחקר חוזר על עצמו** | נמוכה | הסוכן עוצר ב-`consultation_needed`. אם יותר מ-5 התייעצויות בסשן — לסמן אזהרה ולתת לשלומי להחליט "המשך/עצור". |
| **טון של AI דולף לפוסט הסופי למרות voice-guide** | בינונית | בדיקה אנושית של 10 פוסטים ראשונים. אם נופל — לחזק את ה-anti-patterns ב-voice-guide ולהוסיף few-shot examples. |
| **Tavily/Brave/Firecrawl יקרים מעבר לתחזית** | בינונית | קביעת cap עלות לסשן (env: `WHATSAPP_MAX_COST_USD_PER_SESSION=5`). אם חורגים — עצירה אוטומטית עם הודעה. |
| **שמירת סלקציה אחרי עריכה — אינדקסים זזים** | בינונית | לא לשמור `start/end` numeric בלבד — לשמור גם `anchor_text` (התווים בסביבת הסלקציה). אחרי עריכה, fuzzy-match לזיהוי המיקום החדש. אם לא נמצא — להעלים את הסימון בעדינות. |
| **Google Drive OAuth token פג תוקף** | נמוכה | קוד קיים ב-`routes/google-drive.js` כבר מטפל ב-refresh. נשתמש ב-`getAuthenticatedDrive()` הקיים. |

### 8.2 צמתי החלטה שדורשים את שלומי תוך כדי

1. **לפני Phase 2:** איפה ירוץ ה-research worker? Vercel serverless עם תקרת timeout? VPS חיצוני? **המלצה: לבדוק קודם אם 60 שניות של Vercel Pro מספיקות; אחרת לעבור ל-Render worker קטן.**
2. **לפני Phase 3:** האם לשמור snapshot מלא אחרי כל תיקון (יקר באחסון) או רק diff (מסובך)? **המלצה: snapshot מלא ב-`whatsapp_drafts` — האחסון זול בפוסטגרס, ה-clarity של ההיסטוריה שווה.**
3. **לפני Phase 4:** האם voice-guide.md יהיה checkpointed בגיט (default) או editable מתוך ה-admin UI? **המלצה: גיט בלבד ב-Phase 4. UI editor — אופציה ל-Phase 7+ אם יעלה צורך.**
4. **לפני Phase 5:** האם להוסיף `iOS PWA` (`apple-touch-icon`, `manifest.json`) כדי שאפשר יהיה "להתקין" את העמוד למסך הבית? **המלצה: לא ב-Phase 5. אם שלומי יבקש — Phase 7.**
5. **לפני Phase 6:** האם GPT-5 fallback באמת נחוץ? **המלצה: לדחות. להריץ 20 סשנים על Claude בלבד. רק אם 30%+ מהמחקרים מרגישים שטחיים — להפעיל.**
6. **MCP servers ייעודיים** (סעיף 13.1 ב-spec): **המלצה: לא ב-Phase 1–5.** wrappers ידניים פשוטים יותר ונותנים שליטה. MCP — שיקול ל-Phase 7+.
7. **שיתוף עם הצוות** (סעיף 8.2 sub-bullet): **המלצה: לדחות. ב-Phase 6 רק "share Drive link" ידני; UI מובנה — בעתיד.**

---

## 9. סיכום נקודות שאסור לשכוח

- **שום שינוי CSS בעמודים קיימים.** רק תוספת לתפריט הצד (אותה סטייל קיים).
- **כל מודל Claude נקרא דרך `services/claude-client.js`** — לא לשכפל URL/headers.
- **`docs/voice-guide.md` הוא הלב.** איכות הפוסט תלויה בו יותר מאשר במודל. להשקיע זמן בכתיבה שלו.
- **RTL, עברית, Heebo + Inter, צבעי מותג בלבד** (`#022445`, `#984349`, `#fbf9f6`).
- **בלי קווי 1px, בלי צללים כבדים** — רק רקעים והפרשי גוון.
- **ספירת טוקנים גלויה למשתמש** בכל סשן.
- **שמירה אוטומטית כל 10 שניות** — לא לאבד עבודה אם שלומי סוגר טאב.
- **Feature flag** — `WHATSAPP_UPDATES_ENABLED=false` כברירת מחדל. הפעלה מודעת.

---

**סוף תוכנית הביצוע.** מומלץ אישור Phase 1 בלבד תחילה, ואז התקדמות עם בדיקת ביניים של שלומי בכל פאזה.

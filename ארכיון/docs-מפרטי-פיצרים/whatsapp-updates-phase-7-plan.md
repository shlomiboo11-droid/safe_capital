# תוכנית Phase 7: Mid-Research Consultations + Learning System

> מסמך זה הוא **תכנון** לשלב הבא של מערכת עדכוני וואטסאפ. הוא מורכב משני חלקים עצמאיים שניתן לבצע במקביל או בנפרד.

---

## חלק 1 — Mid-Research Consultations (Phase 3B שנדחה)

### מה זה עושה
בזמן שהסוכן רץ על שאילתות המחקר, הוא **עוצר מרצונו** ברגעי החלטה משמעותיים ושואל את המשתמש שאלה ממוקדת. דוגמאות:

- "מצאתי שני מקורות סותרים על שיעור האינפלציה ב-Q1: Bloomberg אומר 2.4%, Fed אומר 2.7%. באיזה להשתמש?"
- "ראיתי דאטה רלוונטית גם על שכונת Mountain Brook — להרחיב גם עליה או להתמקד ב-Vestavia Hills?"
- "הנתון שביקשת אינו זמין לרבעון האחרון — לעבוד עם הקודם או לדלג על הזווית הזו?"

המשתמש עונה (כפתור או טקסט חופשי) → הסוכן ממשיך מאותה נקודה עם ההכרעה.

### למה זה היה דחוי
דורש שינוי **ארכיטקטוני** בלולאת הסוכן: היום `callClaude` חד-טורני (one-shot). כדי לאפשר עצירה והמשך, צריך agent loop רב-טורני עם state פרסיסטנטי.

### ארכיטקטורה מוצעת

**א. Tool חדש `ask_human`**

ניתן ל-Claude tool ייעודי שהוא יכול לקרוא:
```json
{
  "name": "ask_human",
  "description": "Pause research to ask the user a question. Use only at meaningful decision points.",
  "input_schema": {
    "type": "object",
    "properties": {
      "question": { "type": "string" },
      "options": { "type": "array", "items": { "type": "string" } },
      "context": { "type": "string" }
    },
    "required": ["question"]
  }
}
```

**ב. Agent Loop ב-`executeResearch`**

במקום קריאה אחת ל-`callClaude`, ננהל לולאה רב-טורנית עבור כל שאילתה:

```pseudo
messages = [{ role: 'user', content: query_prompt }]
while True:
  resp = callClaude({ tools: [web_search, ask_human], messages })
  
  if resp.stop_reason === 'end_turn':
    # Research complete
    save_finding(resp.text)
    break
  
  if resp.has_tool_use('ask_human'):
    consultation_id = persist_consultation(session_id, query_id, question)
    publish_sse('consultation_needed', { id: consultation_id, question, options })
    user_answer = await wait_for_consult_response(consultation_id)  # blocks
    messages.push(resp.content)  # the tool_use block
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: ..., content: user_answer }] })
    continue
  
  # web_search results — let Claude continue
  if resp.has_tool_use('web_search'):
    # Claude already processed; just loop with the same context
    messages.push(resp.content)
    continue
```

**ג. מנגנון resume**

חייבים מנגנון לעצירה והמשך:
- כשהסוכן מבקש `ask_human` — שומרים את ה-conversation state ב-DB
- שולחים SSE event ל-frontend
- מחכים על Promise שנפתר כש-`POST /research/consult` נקרא
- אחרי שהמשתמש עונה → resolve הPromise → הלולאה ממשיכה

**יישום ה-promise wait:** in-memory Map של `consultationId → resolver`. אם השרת מתאתחל באמצע — נצטרך לאתחל את הלולאה מחדש מ-DB (יקר, אבל אפשרי).

### DB additions

טבלה חדשה `whatsapp_consultations`:
```sql
CREATE TABLE whatsapp_consultations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  query_id        TEXT,
  question        TEXT NOT NULL,
  options         JSONB DEFAULT '[]'::jsonb,
  context         TEXT,
  answer          TEXT,
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'answered', 'timed_out', 'skipped')),
  conversation_state JSONB,  -- snapshot of messages array for resume
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  answered_at     TIMESTAMPTZ
);
CREATE INDEX idx_wa_consultations_session ON whatsapp_consultations(session_id, status);
```

### API endpoints חדשים

| Method | Path | Body | תפקיד |
|--------|------|------|--------|
| POST | `/sessions/:id/research/consult` | `{ consultation_id, answer }` | מענה לשאלת התייעצות; ממשיך את הסוכן |
| POST | `/sessions/:id/research/consult/skip` | `{ consultation_id }` | המשתמש בחר לדלג; הסוכן ימשיך עם דעתו |

### Frontend

**רכיב חדש:** `consultation-bubble.js`
- בועה מיוחדת שמופיעה בצ׳אט כש-SSE event `consultation_needed` מגיע
- מציג: השאלה + 2-3 כפתורי options + תיבת טקסט חופשי + כפתור "דלג, תחליט בעצמך"
- כפתורים = answers מוגדרים מראש
- שליחת תשובה → POST /consult → הבועה נעלמת → הסוכן ממשיך

**עדכון `chat-view.js`:**
- שמירת `pendingConsultation` ב-state
- כשיש consultation pending → render bubble + לחסום את כפתור "עצור מחקר" עד שהמשתמש עונה

### עלויות / משך
- ETA: 3-4 ימי עבודה
- העלות עולה ב-~20% (יותר טורנים → יותר input tokens מהקונטקסט החוזר)
- אבל איכות המחקר עולה משמעותית — הסוכן ממוקד בדיוק במה שהמשתמש רוצה

### סיכונים
1. **רעש מיותר** — אם הסוכן שואל יותר מדי, חוויה גרועה. אחזק את ה-system prompt: "שאל רק בצמתי החלטה משמעותיים, מקסימום 1-2 שאלות לכל שאילתה"
2. **Resume אחרי restart** — אם השרת קרס באמצע, נצטרך מנגנון retry שטוען conversation_state מ-DB
3. **Timeout** — אם המשתמש לא עונה תוך 5 דקות, אוטומטית skip (חיוב עלינו לא להחזיק resources)

### קבצים שייגעו
- `admin/server/db.js` — טבלה חדשה
- `admin/server/services/whatsapp/claude-research-provider.js` — agent loop
- `admin/server/routes/whatsapp.js` — endpoints חדשים
- `admin/public/js/whatsapp-updates/consultation-bubble.js` — חדש
- `admin/public/js/whatsapp-updates/chat-view.js` — wire
- `admin/public/js/whatsapp-updates/state.js` — pendingConsultation
- `admin/public/css/whatsapp-updates.css` — סטיילים
- `admin/public/whatsapp-updates.html` — modulepreload

---

## חלק 2 — Learning System (מערכת תחקור והעדפות)

### מה זה עושה
המערכת **שומרת ומנתחת כל פעולת משתמש** לאורך זמן, לומדת את ההעדפות שלו, ובאופן אוטומטי משפרת את הפלט בסשנים הבאים.

### מה נמדד

**מהמחקר:**
- אילו שאילתות **הוסרו** ע"י המשתמש
- אילו שאילתות **נוספו** ידנית
- אילו שאילתות **עברו עריכה** (diff)
- אילו תיקונים על הסיכום ביקש (verify/rephrase/expand/shorten/delete/explain/freeform)
- מתי בחר ב-"ערוך טקסט חופשית" וערך ידנית (diff בין הגרסה של הבוט לידנית)

**מהכתיבה:**
- אילו quick-actions הופעלו (shorten_30, add_cta, add_emoji, remove_emoji, strengthen_open, strengthen_close)
- האם המשתמש בחר "גרסה אלטרנטיבית" (פעם, פעמיים, יותר?)
- כמה פעמים "ערוך הגדרות וכתוב מחדש" הופעל
- בסוף — האם הפוסט הסופי שונה מהטיוטה הראשונה? כמה משמעותית? (diff)

**ברמת הסשן:**
- זמן ממוצע לסשן
- עלות ממוצעת
- האם המשתמש אישר ושמר כסופי, או נטש?

### DB Schema

**טבלה חדשה `feedback_events`:**
```sql
CREATE TABLE feedback_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- enum: query_removed, query_added, selection_edit, ...
  event_data  JSONB,           -- { action: 'shorten', selection_text: '...', from: '...', to: '...' }
  stage       TEXT,            -- 'research' | 'writing'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feedback_user_type ON feedback_events(user_id, event_type, created_at DESC);
CREATE INDEX idx_feedback_session ON feedback_events(session_id);
```

**טבלה חדשה `user_preferences`:**
```sql
CREATE TABLE user_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension    TEXT NOT NULL,     -- 'length' | 'emoji_density' | 'cta_strength' | 'topic_preference' | ...
  value        JSONB,             -- structured per dimension
  confidence   NUMERIC(3, 2),     -- 0-1
  sample_size  INTEGER DEFAULT 0, -- כמה sessions עומדים מאחורי המסקנה
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, dimension)
);
```

### Architecture — 3 שכבות

**שכבה 1: Tracker (אוסף אירועים)**
- מודול חדש `services/whatsapp/preference-tracker.js`
- חושף API פשוט: `trackEvent(userId, sessionId, eventType, eventData)`
- נקרא אוטומטית מכל endpoint שמקבל פעולה: edit-selection, quick-action, manual-edit, finalize וכו׳
- **דרישה:** אסור שיאט את הפעולה — fire-and-forget, אם נכשל לא נוגעים בתגובה למשתמש

**שכבה 2: Analyzer (מתרגם אירועים לתובנות)**
- מודול חדש `services/whatsapp/preference-analyzer.js`
- 2 מצבים:
  - **A. Statistical** — מצטבר אירועים, מחשב ממוצעים. למשל: "המשתמש מפעיל shorten_30 ב-78% מהסשנים → ברירת מחדל לאורך קצר יותר"
  - **B. AI-driven** — קורא ל-Claude Sonnet עם דאמפ של 10 סשנים אחרונים ומבקש: "סכם את העדפות הסגנון של המשתמש בעברית"
- רץ כ-cron job פעם ביום, או בסיום כל סשן

**שכבה 3: Applier (מזריק העדפות לפרומפט)**
- מודול חדש `services/whatsapp/preference-applier.js`
- חושף `getPreferenceBlock(userId)` שמחזיר טקסט להזרקה ל-system prompt
- נקרא מ-`writing-service.generatePost` ו-`claude-research-provider.proposeQueries`
- הולך אל system prompt כ-cache block נפרד (caching לא נפגע ביחס לטון)

### דוגמה לזרימה מלאה

1. **משתמש מסיים סשן:** נשמרו 12 אירועים ב-`feedback_events` (5 quick-actions, 3 selection-edits, 1 alternative, 3 manual edits)

2. **Cron job של preference-analyzer רץ בלילה:** טוען את 50 האירועים האחרונים של המשתמש, מחשב:
   - "shorten_30 הופעל ב-8/12 סשנים → confidence 0.78"
   - "Manual edit הוסיף בממוצע 4 אמוג׳ים → המשתמש אוהב יותר אמוג׳ים מהדיפולט"
   - "מפעיל strengthen_open ב-6/12 → ה-Hook הראשון של הבוט תמיד חלש"

3. **Applier מעדכן את `user_preferences`:**
   ```json
   { dimension: 'length_bias', value: 'shorter_by_30pct', confidence: 0.78 }
   { dimension: 'emoji_density', value: '+4_per_post', confidence: 0.85 }
   { dimension: 'hook_strength', value: 'needs_stronger_opening', confidence: 0.7 }
   ```

4. **בסשן הבא:** writing-service.generatePost קורא:
   ```js
   const prefs = await preferenceApplier.getPreferenceBlock(userId);
   ```
   ומקבל:
   ```
   # העדפות המשתמש (נלמדו מ-12 סשנים אחרונים)
   - המשתמש מעדיף פוסטים ב-30% קצרים מההמלצה הסטנדרטית
   - הוסף עוד 3-4 אמוג׳ים בסוף שורות מהדיפולט שלך
   - השקיע במיוחד בפתיחה (Hook) — היא נוטה להיות חלשה מדי
   ```

5. ה-Block הזה נוסף ל-system prompt → הטיוטה הראשונה כבר מותאמת.

### Tiers של מורכבות

**Tier 1 — סטטיסטי בלבד** (MVP, ~3 ימי עבודה)
- אירועים נספרים, ממוצעים מחושבים
- ~5-10 dimensions מוגדרות מראש
- הזרקה ידנית לפרומפט בפורמט קבוע

**Tier 2 — AI-driven analyzer** (הרחבה, ~2 ימי עבודה נוספים)
- Claude קורא את ה-events ומסיק תובנות בעברית טבעית
- יותר גמיש — תופס דפוסים שלא חשבנו עליהם
- עלות: ~$0.05 לכל cron job (לילי)

**Tier 3 — דיאלוג עם המשתמש** (אופציה לעתיד)
- כפתור "מה למדת עליי?" → המערכת מציגה את ה-preferences שלמדה
- המשתמש יכול לאשר/לדחות/לערוך
- מעלה את ה-confidence והופך את ה-learning ל-explicit

### עלויות / משך
- **Tier 1:** 3-4 ימי עבודה. עלות בזמן ריצה: 0 (סטטיסטי בלבד)
- **Tier 1+2:** ~5 ימי עבודה. עלות: ~$1-2/חודש לcron jobs
- **Tier 3:** עוד 1-2 ימים. עלות זניחה.

### סיכונים
1. **למידה מוטעית** — אם המשתמש פעם אחת עשה שגיאה (למשל shorten_30 לפוסט חשוב), אסור שזה ייכנס כ-preference. מינימום sample_size לפני שמיישמים (לפחות 5 sessions).
2. **Overfitting** — preferences יכולות "להידבק" יותר מדי. צריך **time decay** — אירועים מ-3 חודשים אחורה במשקל חצי.
3. **שקיפות** — המשתמש חייב לדעת מה למדנו. תיקון: הוספת panel "מה הבוט יודע עליך" (Tier 3).

### קבצים שייגעו
- `admin/server/db.js` — 2 טבלאות חדשות
- `admin/server/services/whatsapp/preference-tracker.js` — חדש
- `admin/server/services/whatsapp/preference-analyzer.js` — חדש
- `admin/server/services/whatsapp/preference-applier.js` — חדש
- `admin/server/routes/whatsapp.js` — קריאות tracker מכל endpoint רלוונטי
- `admin/server/routes/cron.js` — cron job חדש (ניתן להריץ בLambda של Vercel)
- `admin/server/services/whatsapp/writing-service.js` — קריאה ל-applier
- `admin/server/services/whatsapp/claude-research-provider.js` — קריאה ל-applier
- אופציה Tier 3: `admin/public/js/whatsapp-updates/preferences-panel.js` חדש

---

## הצעת סדר ביצוע

### Sprint A (~4 ימי עבודה)
**Phase 3B — Mid-research consultations**
- בנייה מלאה
- בדיקה עם 3-5 מחקרים אמיתיים

### Sprint B (~3-4 ימי עבודה)
**Learning System Tier 1 (סטטיסטי)**
- Tracker — מתחיל לאסוף נתונים מיד
- Analyzer בסיסי (rule-based)
- Applier בסיסי (5 dimensions)

### Sprint C (~2 ימי עבודה, אחרי 1-2 שבועות שימוש)
**Learning System Tier 2 (AI-driven)**
- Claude analyzer
- חיווט ל-cron יומי
- תצוגה למשתמש (אופציונלי Tier 3)

### Sprint D (אופציונלי)
- GPT-5 Deep Research fallback
- Templates ממסטים מצליחים
- אנליטיקה כללית

---

## שיקולים לפני התחלה

1. **התחל ב-Sprint B (Tier 1).** הוא מתחיל לאסוף נתונים מיד, גם אם לא משתמשים בהם עדיין. אחרי שבועיים יהיה לך datasete מספיק ל-Tier 2.

2. **Sprint A יקר ב-tokens** (agent loop + מצב פרסיסטנטי) — דחה אותו עד שהמערכת מייצרת ערך אמיתי.

3. **Tier 3 (שקיפות למשתמש) אופציה גרעינית** — חוזק האמון, חולשת תחזוקה. החלט אחרי שיהיה מה להראות.

4. **רעיון אלטרנטיבי שכדאי לשקול:** במקום preferences שנלמדות אוטומטית, **לאפשר למשתמש לכתוב prompt חוזר משלו** ("העדפות חוזרות") שיוזרק לכל סשן. פחות חכם אבל מהיר לבנייה (יומיים) ושקוף לגמרי. אפשר להתחיל מזה ולשדרג ל-auto-learning בהמשך.

---

**סוף תוכנית Phase 7.**
שני החלקים עצמאיים. ההמלצה: לסגור על סדר העדיפות לפני שמתחילים.

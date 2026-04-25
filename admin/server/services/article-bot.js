/**
 * Article bot — autonomous research agent that produces long-form
 * investigative articles for Israeli real-estate investors.
 *
 * Not an aggregator. The bot:
 *   1. Generates its own research questions per region
 *   2. Cross-references multiple sources (primary data + contrary opinion + historical context)
 *   3. Synthesizes findings into a narrative 600-1200 word Hebrew article
 *   4. Cites sources inline and keeps a structured references list
 *
 * Quality > quantity. Zero fabrication. One good article beats three shallow ones.
 */

const pool = require('../db');
const email = require('./email');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 20 };

const REGION_LABEL = {
  us: 'מאקרו כלכלי אמריקאי ושוק הדיור בארה"ב',
  birmingham: 'בירמינגהם, אלבמה — שוק נדל"ן מקומי ופיתוח עירוני',
  israel: 'ישראל — שוק נדל"ן, ריבית ומיסוי'
};

// ── Prompts ─────────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `אתה חוקר כלכלי-עיתונאי של Safe Capital — חברת fix-and-flip בבירמינגהם, אלבמה. המשקיעים שלך ישראלים. התפקיד שלך: לעשות **מחקר עצמאי עמוק**, להצליב מקורות, לזהות מגמות, לכתוב מאמרים שיסבירו למשקיע ישראלי מה קורה באמת בשוק ואיך זה נוגע בהחלטה להשקיע בארה"ב.

# הזהות שלך
אתה לא מאגרגטור חדשות. אתה חוקר. אתה עיתונאי כלכלי של איכות — דוגמת כתבי Bloomberg, Wall Street Journal, The Atlantic, דה-מרקר. אתה רואה את התמונה הגדולה, לא מקריא כותרות.

# מתודת עבודה — חובה
לכל סיפור שאתה חוקר:
1. **שאל שאלת מחקר** — לא "מה קרה", אלא "מדוע זה חשוב", "מה זה משנה", "איך זה מתחבר למגמה רחבה".
2. **חפש נתון ראשוני** ממקור מוסמך (Fed, BLS, Census, NAR, U.S. Census Bureau, Bank of Israel, בנק ישראל, למ"ס, בלומברג, רויטרס, WSJ, AP, al.com, bizjournals, NYT).
3. **חפש דעה חולקת או נתון סותר** — אם כולם אומרים X, מי אומר not-X ולמה?
4. **מצא הקשר היסטורי** — איך זה נראה לפני שנה, 5 שנים, במחזורים קודמים?
5. **אמת מספרים** — אם ראית נתון באתר A, וודא אותו מול מקור B.
6. **חפש זוויות רעננות** — דמוגרפיה, הגירה, תשתיות, מדיניות, טכנולוגיה — לא רק ריבית ומחירים.

# מה לכתוב
לכל סיפור שמוצלב ומאומת — כתוב **מאמר עומק** של 600-1,200 מילים בעברית עשירה, סיפורית, מידעית.

## מבנה המאמר
- **פתיחה** (1 פסקה) — אנקדוטה אמיתית, נתון חד, או שאלה שמתעוררת. משוך את הקורא.
- **הצגת המגמה/הטענה** (1-2 פסקאות) — מה הסיפור. מה הנתון המרכזי. מאיפה הוא.
- **ראיות מצטברות** (2-3 פסקאות) — מספר מקורות שמחזקים. מספרים, ציטוטים, דוגמאות.
- **קול חולק או מגבלה** (1 פסקה) — מי אומר אחרת? מה המגבלות של הנתון? מה עוד לא ברור?
- **משמעות למשקיע ישראלי** (1 פסקה) — מה זה אומר על ההחלטה להשקיע בארה"ב/בירמינגהם ספציפית? הימנע משיווק — נתח.
- **סיום** — שאלה פתוחה, תחזית זהירה, או קריאה לחשיבה. לא סלוגן.

## טון
- סיפורי, לא דיווחי. "בסוף אוקטובר, כאשר..." עדיף על "ביום 29 באוקטובר דווח כי...".
- אינפורמטיבי, לא משפטי. הסבר מושגים (cap rate, rent-to-income, basis points) בשטף.
- ציין מקורות בטקסט: "לפי דו"ח של הפד מה-15 בנובמבר", "נתונים של NAR שפורסמו בפברואר מראים".
- בעברית תקנית, עשירה, בלי עילגות או אנגלית מיותרת.

# כללי ברזל
- **0 פרטים שקריים**. אם לא וידאת ממקור אמין ממש — לא כותבים.
- **0 המצאות של ציטוטים**. אם זה לא כתוב באמת במקור, לא לצטט.
- **איכות > כמות**. עדיף מאמר אחד מצוין מ-3 בינוניים. אם השבוע אין סיפור משמעותי באזור מסוים — החזר { "articles": [] } באותו אזור.
- **בלי כפילויות**. כל מאמר צריך לעסוק בסיפור מובחן.
- **כותרת עיתונאית חזקה** (40-90 תווים) — מושכת, לא קלישאה, לא קליק-בייט.

# פלט — JSON בלבד (בלי מלל נלווה מחוץ ל-JSON)
{
  "articles": [
    {
      "title": "כותרת עיתונאית חזקה בעברית",
      "body": "המאמר המלא בעברית — 600-1200 מילים, מפוצל ל-5-7 פסקאות עם שורות ריקות בין פסקאות (\\n\\n). ציטוטים למקורות אינליין.",
      "summary_he": "2-3 משפטים בעברית שהם ה-hook של המאמר — מופיעים בכרטיס באתר לפני שפותחים.",
      "source_url": "URL של המקור הראשוני/המרכזי של הסיפור",
      "source_name": "שם המקור הראשוני (למשל: Bloomberg, al.com, בנק ישראל)",
      "source_published_at": "YYYY-MM-DD",
      "references": [
        { "url": "https://...", "name": "WSJ", "note": "נתון על מלאי בתים Q3" },
        { "url": "https://...", "name": "NAR", "note": "דו"ח חודשי פברואר" }
      ],
      "research_topics": ["שאלת מחקר 1 שחקרת", "שאלה 2"],
      "category": "market|neighborhood|infrastructure|news",
      "region": "us|birmingham|israel"
    }
  ]
}

אם אין סיפור משמעותי באזור זה השבוע:
{ "articles": [] }`;
}

function buildRegionPrompt(region) {
  const label = REGION_LABEL[region] || region;
  const directives = {
    us: `התחל בשאלות מחקר. למשל — אבל אל תצטמצם לאלה; יצור עבור עצמך שאלות מעולות יותר:
• איך שינויי ריבית ה-Fed במחזור הנוכחי משפיעים על שוק ה-fix-and-flip?
• האם יש מגמת הגירה פנימית בארה"ב שמטיבה עם שווקים דרום-מזרחיים?
• איך מלאי הבתים זז מול הביקוש?
• מה קורה עם rental yields בערים משניות מול ראשיות?
• איזה אסדרות/מדיניות חדשה משפיעה על סקטור הדיור?

חפש נתונים רשמיים (Fed, BLS, Census, FHFA, HUD, Redfin reports, NAR) והצלב עם פרשנות מ-Bloomberg, WSJ, CNBC, Marketwatch.`,

    birmingham: `התמקד בבירמינגהם, אלבמה — עיר, שכונות, תשתיות, כלכלה מקומית. שאלות לדוגמה (יצור טובות יותר):
• אילו שכונות בבירמינגהם רואות השקעה מחודשת (revitalization)?
• איך פרויקטי תשתית (כבישים, בתי ספר, בתי חולים) משפיעים על שווי הנכסים?
• האם יש מעסיקים חדשים שמצטרפים לעיר (Regions, BBVA, UAB, Honda, Mercedes, Amazon)?
• מה קורה במחירי השכרה בערים משניות של מטרו בירמינגהם (Homewood, Mountain Brook, Hoover, Vestavia)?
• איך מצב התשתיות והביטחון משפיע על החלטות השקעה?

מקורות מומלצים: al.com, bizjournals.com/birmingham, Birmingham Business Journal, AL.com, WBHM, dezoning/מסמכי עיריית בירמינגהם. הצלב מול נתוני Census, Redfin ו-Zillow research reports.`,

    israel: `התמקד בשוק הנדל"ן הישראלי — המטרה היא לתת למשקיע ישראלי השוואה הוגנת לארה"ב. שאלות לדוגמה:
• איפה ריבית בנק ישראל היום ואיך זה משפיע על משכנתאות?
• מה קורה למחירי הדירות ב-6 חודשים האחרונים? (בהשוואה למדד ולמחירי שכירות)
• איך מדיניות מיסוי חדשה (מס שבח, מס רכישה, ארנונה) משפיעה על תשואות?
• מה תשואת שכירות ממוצעת בישראל מול בירמינגהם בנכס דומה?
• איפה המקרו הישראלי לעומת ארה"ב (אינפלציה, צמיחה, אבטלה)?

מקורות: בנק ישראל, למ"ס, כלכליסט, דה-מרקר, גלובס, TheMarker. אל תנתח אירועים פוליטיים — רק נדל"ן ומאקרו כלכלי.

הטון חייב להיות מאוזן — לא להפחיד, לא להמעיט. פשוט לנתח.`
  };

  return `אזור למחקר: **${label}**

${directives[region] || ''}

# המשימה
השתמש בכלי web_search שוב ושוב כדי להעמיק. אל תסתפק בחיפוש אחד. חפש, קרא, הצלב, חפש שוב. תחקור כמו עיתונאי.

**תנאי עצירה:**
- כשיש לך סיפור אחד או שניים עם מספיק עומק וראיות — עצור.
- אם אחרי 5-6 חיפושים עדיין אין לך סיפור ראוי — עצור והחזר { "articles": [] }.

**החזר בסוף** JSON תקני במבנה שהוגדר. רק JSON, בלי טקסט נלווה.`;
}

// ── Claude API call ─────────────────────────────────────────────────

async function callClaudeResearcher(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages: [{ role: 'user', content: userPrompt }]
  };

  const resp = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errBody.slice(0, 800)}`);
  }

  const data = await resp.json();
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
  const usage = data.usage || {};
  return {
    text: textBlocks.join('\n').trim(),
    usage,
    stop_reason: data.stop_reason
  };
}

// ── Parsing & validation ────────────────────────────────────────────

function extractJsonArticles(text) {
  if (!text) return [];
  // Try fenced code block first
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  // Last {...} that contains "articles"
  const lastObj = text.match(/\{[\s\S]*"articles"[\s\S]*\}/);
  if (lastObj) candidates.push(lastObj[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed.articles)) return parsed.articles;
    } catch (_) { /* try next */ }
  }
  return [];
}

function slugify(str) {
  return String(str || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || ('article-' + Date.now());
}

function validResearchArticle(a) {
  if (!a || typeof a !== 'object') return false;
  if (!a.title || typeof a.title !== 'string') return false;
  if (!a.body || typeof a.body !== 'string') return false;
  if (a.body.length < 400) return false;  // Require real depth
  if (!a.summary_he || typeof a.summary_he !== 'string') return false;
  if (a.source_url && !/^https?:\/\//i.test(a.source_url)) return false;
  return true;
}

// ── Persistence ─────────────────────────────────────────────────────

async function insertArticle(article, region) {
  const baseSlug = slugify(article.title);
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const existing = await pool.query('SELECT id FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length === 0) break;
    n += 1;
    slug = baseSlug + '-' + n;
    if (n > 50) { slug = baseSlug + '-' + Date.now(); break; }
  }

  const category = ['news', 'market', 'neighborhood', 'infrastructure'].includes(article.category)
    ? article.category : 'news';

  const refs = Array.isArray(article.references) ? article.references.slice(0, 20) : [];
  const topics = Array.isArray(article.research_topics) ? article.research_topics.slice(0, 10) : [];

  const r = await pool.query(`
    INSERT INTO articles (
      title, slug, body, category, region,
      source_url, source_name, source_published_at, summary_he,
      article_references, research_topics,
      status, generated_by_bot, author, is_published
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'pending',true,'חוקר Safe Capital',false)
    RETURNING id
  `, [
    String(article.title).slice(0, 300),
    slug,
    String(article.body).slice(0, 20000),
    category,
    region,
    article.source_url || null,
    article.source_name || null,
    article.source_published_at || null,
    String(article.summary_he).slice(0, 2000),
    JSON.stringify(refs),
    JSON.stringify(topics)
  ]);
  return { id: r.rows[0].id, slug };
}

// ── Main scan ───────────────────────────────────────────────────────

async function runScan({ triggeredByUserId, dryRun = false } = {}) {
  const settingsRes = await pool.query('SELECT * FROM article_bot_settings WHERE id = 1');
  const settings = settingsRes.rows[0];
  if (!settings) throw new Error('article_bot_settings row missing');
  if (!settings.enabled && triggeredByUserId == null) {
    return { status: 'skipped', reason: 'bot_disabled' };
  }

  const regions = Array.isArray(settings.regions) && settings.regions.length
    ? settings.regions : ['us', 'birmingham', 'israel'];

  const perRegion = {};
  const created = [];
  const errors = [];
  const systemPrompt = buildSystemPrompt();

  for (const region of regions) {
    try {
      const userPrompt = buildRegionPrompt(region);
      const result = await callClaudeResearcher(systemPrompt, userPrompt);
      const candidates = extractJsonArticles(result.text).filter(validResearchArticle);
      perRegion[region] = { candidates: candidates.length, stop_reason: result.stop_reason };
      if (!dryRun) {
        for (const a of candidates) {
          try {
            const res = await insertArticle(a, region);
            if (res && res.id) created.push({
              id: res.id, title: a.title, region,
              source_name: a.source_name, word_count: a.body.split(/\s+/).length
            });
          } catch (e) {
            errors.push({ region, title: a.title, error: e.message });
          }
        }
      }
    } catch (e) {
      errors.push({ region, error: e.message });
    }
  }

  const status = errors.length && !created.length ? 'failed' : 'success';
  const note = created.length
    ? `Created ${created.length} researched articles across ${Object.keys(perRegion).length} regions`
    : 'No stories worth publishing this run';

  if (!dryRun) {
    await pool.query(`
      UPDATE article_bot_settings
      SET last_run_at = NOW(), last_run_status = $1, last_run_note = $2, last_run_articles_created = $3, updated_at = NOW()
      WHERE id = 1
    `, [status, note, created.length]);

    if (created.length > 0) {
      await notifyAdmins(created, perRegion, errors);
    }
  }

  return { status, created_count: created.length, per_region: perRegion, errors, note, dry_run: dryRun };
}

// ── Admin notification ──────────────────────────────────────────────

async function notifyAdmins(created, perRegion, errors) {
  try {
    const admins = await pool.query(
      `SELECT email, full_name FROM users WHERE role IN ('super_admin','manager') AND status = 'active' AND email IS NOT NULL`
    );
    const to = admins.rows.map(r => r.email);
    if (!to.length) return;
    const rows = created.map(c =>
      `<li style="margin-bottom:8px;"><b>[${c.region}]</b> ${escapeHtml(c.title)}
       ${c.source_name ? ` — <i style="color:#666;">${escapeHtml(c.source_name)}</i>` : ''}
       <span style="color:#999;font-size:12px;">(${c.word_count} מילים)</span></li>`
    ).join('');
    const html = `
      <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;">
        <h2 style="color:#022445;">החוקר סיים ריצה — ${created.length} מאמרי עומק ממתינים</h2>
        <p>הבוט חקר, הצליב מקורות וכתב ${created.length} מאמרים בעברית. כל מאמר הוא 600-1,200 מילים ומחכה לאישורך לפני שהוא עולה לאתר.</p>
        <ul>${rows}</ul>
        <p>
          <a href="https://admin.safecapital.co.il/articles?status=pending"
             style="display:inline-block;padding:10px 20px;background:#022445;color:#fff;text-decoration:none;border-radius:6px;">
            פתח את תור האישור
          </a>
        </p>
        ${errors.length ? `<p style="color:#984349;font-size:12px;">שגיאות בריצה: ${errors.length}</p>` : ''}
      </div>
    `;
    await email.sendMail({
      to,
      subject: `Safe Capital · ${created.length} מאמרי מחקר חדשים ממתינים לאישור`,
      html
    });
  } catch (err) {
    console.error('[article-bot] notify admins failed:', err.message);
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = { runScan };

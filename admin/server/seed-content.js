// Run once: node admin/server/seed-content.js
// Seeds initial content for Birmingham pages and agent prompts

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('neon')
    ? { rejectUnauthorized: false }
    : false
});

// ── Agent prompt content ────────────────────────────────────────────

function readAgentFile(filename) {
  const agentDir = path.join(__dirname, '..', '..', '.claude', 'agents', 'content');
  return fs.readFileSync(path.join(agentDir, filename), 'utf-8');
}

// ── Birmingham Info HTML ────────────────────────────────────────────

const BIRMINGHAM_INFO_HTML = `
<h2>העיר שבנתה את עצמה מחדש</h2>
<p>בירמינגהם, אלבמה, היא העיר הגדולה ביותר במדינת אלבמה ומרכז המטרופולין הגדול ביותר בה. העיר ממוקמת במרכז-צפון אלבמה, ברכס האפלצ'ים הדרומי. אוכלוסיית המטרופולין מונה כ-1.1 מיליון תושבים, והעיר עצמה כ-200,000.</p>
<p>בירמינגהם הוקמה ב-1871 כעיר תעשייתית מבוססת ברזל ופלדה, ומאז עברה טרנספורמציה מרשימה. היום היא מרכז רפואי, פיננסי וטכנולוגי מוביל בדרום ארה"ב, עם כלכלה מגוונת שמושכת השקעות ותושבים חדשים.</p>

<h2>כלכלה ותעסוקה</h2>
<p>הכלכלה של בירמינגהם מגוונת ויציבה, עם מספר ענפים מרכזיים:</p>
<ul>
  <li><strong>רפואה וביוטכנולוגיה:</strong> UAB (University of Alabama at Birmingham) הוא המעסיק הגדול ביותר באלבמה עם כ-28,000 עובדים, והשפעה כלכלית שנתית של מעל $7.3 מיליארד על הכלכלה המקומית.</li>
  <li><strong>פיננסים:</strong> בירמינגהם היא מרכז בנקאי מוביל. Regions Financial ו-Protective Life מרכזים את פעילותם בעיר. סניף הפדרל ריזרב של אטלנטה פועל כאן.</li>
  <li><strong>טכנולוגיה:</strong> העיר הוכרזה כ-Tech Hub ע"י הממשל הפדרלי, עם מיקוד בביוטכנולוגיה ובינה מלאכותית. Innovation Depot, אחד האינקובטורים הגדולים בדרום ארה"ב, פועל במרכז העיר.</li>
  <li><strong>ייצור:</strong> Honda מפעילה מפעל גדול באזור, ו-Amazon פתחה מספר מרכזי הפצה.</li>
</ul>
<p>שיעור האבטלה באזור עומד על כ-2.5%, נמוך מהממוצע הלאומי, מה שמצביע על שוק תעסוקה חזק ויציב.</p>

<h2>מוסדות עוגן</h2>
<p>מוסדות עוגן הם גופים גדולים ויציבים שלא צפויים לעזוב את העיר, ומספקים בסיס כלכלי ותעסוקתי יציב:</p>
<ul>
  <li><strong>UAB Hospital:</strong> בית החולים המוביל באלבמה, מדורג בין 50 בתי החולים הטובים בארה"ב ע"י U.S. News. מעסיק אלפי רופאים, אחיות וחוקרים.</li>
  <li><strong>Children's of Alabama:</strong> בית חולים ילדים מהמובילים בארה"ב, שמושך משפחות ואנשי מקצוע מכל המדינה.</li>
  <li><strong>Samford University:</strong> אוניברסיטה פרטית מובילה עם כ-5,800 סטודנטים.</li>
  <li><strong>Southern Research:</strong> מכון מחקר עצמאי שפועל מאז 1941, עם מעבדות ביוטכנולוגיה ומדע חומרים.</li>
  <li><strong>Grandview Medical Center:</strong> בית חולים מתרחב שמחזק את הקלאסטר הרפואי של העיר.</li>
</ul>

<h2>שוק הנדל"ן</h2>
<p>שוק הנדל"ן בבירמינגהם מאופיין במחירים נגישים יחסית לערים אמריקאיות אחרות:</p>
<ul>
  <li>מחיר חציוני לבית באזור המטרופולין: כ-$230,000</li>
  <li>מס נכס אפקטיבי באלבמה: כ-0.41% — מהנמוכים בארה"ב</li>
  <li>אין מס רכישה (transfer tax) כמו בישראל</li>
  <li>שוק ידידותי למשקיעים עם אפשרויות flip ו-rental</li>
  <li>עליית מחירים שנתית ממוצעת של 3%-5% בשנים האחרונות</li>
</ul>

<h2>שכונות מפתח להשקעה</h2>
<h3>Avondale</h3>
<p>שכונה שעוברת התחדשות מרשימה. מסעדות, בתי קפה וגלריות פותחים ברחובות הראשיים. קרובה למרכז העיר ול-UAB. מחירים עדיין נגישים אך עולים בהתמדה.</p>

<h3>Woodlawn</h3>
<p>שכונה היסטורית עם פוטנציאל גבוה. מחירי רכישה נמוכים ו-ARV (שווי אחרי שיפוץ) שמצדיק השקעה. קרבה לנתיב Red Line BRT (קו תחבורה מהיר).</p>

<h3>East Lake</h3>
<p>קהילה עם היסטוריה עשירה, פארק וגולף קלאב. עוברת פיתוח מואץ, עם ביקוש הולך וגובר מצד שוכרים ורוכשים.</p>

<h3>Ensley</h3>
<p>שכונה עם מחירי כניסה נמוכים ביותר ופוטנציאל לעלייה משמעותית. פרויקטי פיתוח עירוני מתוכננים באזור.</p>

<h3>West End</h3>
<p>שכונה מתפתחת עם מבני מגורים היסטוריים. קרובה למרכז העיר ולאזור התעסוקה. מחירים עדיין נמוכים יחסית לפוטנציאל.</p>

<h2>איכות חיים</h2>
<p>יוקר המחייה בבירמינגהם נמוך בכ-10% מהממוצע הלאומי בארה"ב, מה שמושך עובדים ומשפחות מערים יקרות יותר. העיר מציעה:</p>
<ul>
  <li>מסעדות ובתי קפה ברמה גבוהה — James Beard Foundation הכירה בשפים מקומיים</li>
  <li>שטחים ירוקים נרחבים — Railroad Park, Red Mountain Park, Ruffner Mountain</li>
  <li>סצנת אמנות ותרבות — Birmingham Museum of Art, Alabama Theatre</li>
  <li>קרבה לטבע — Appalachian Trail, אגמים ושמורות טבע</li>
</ul>

<h2>תשתיות ופיתוח</h2>
<p>בירמינגהם נמצאת בעיצומה של תקופת פיתוח ובנייה:</p>
<ul>
  <li><strong>BRT (Bus Rapid Transit):</strong> קו תחבורה מהיר שמחבר שכונות מרכזיות ומעלה ערכי נדל"ן לאורך המסלול</li>
  <li><strong>City Center Master Plan:</strong> תוכנית אב לפיתוח מרכז העיר עם דגש על מגורים, מסחר ושטחים ציבוריים</li>
  <li><strong>Opportunity Zones:</strong> אזורי הזדמנות פדרליים שמעניקים הטבות מס למשקיעים</li>
  <li><strong>פרויקטי UAB:</strong> הרחבה מתמשכת של הקמפוס, מעבדות מחקר חדשות ומגורי סטודנטים</li>
</ul>

<p><em>המידע מוצג למטרות מידע בלבד ואינו מהווה ייעוץ השקעות. נתונים עשויים להשתנות. מומלץ לבצע בדיקת נאותות עצמאית לפני כל החלטת השקעה.</em></p>
`;

// ── Birmingham Compare HTML ─────────────────────────────────────────

const BIRMINGHAM_COMPARE_HTML = `
<h2>למה ישראלים מחפשים אלטרנטיבה?</h2>
<p>שוק הנדל"ן בישראל הפך לאחד היקרים בעולם. מחירי הדירות עלו בעשרות אחוזים בעשור האחרון, ומשקיעים מוצאים את עצמם עם תשואה שנתית של 2%-3% בהשכרה, עלויות כניסה גבוהות, ומיסוי כבד על דירה שנייה.</p>
<p>במקביל, ערים בדרום ארה"ב — ובראשן בירמינגהם — מציעות הזדמנויות עם מחירי כניסה נמוכים, תשואות גבוהות יותר, ורגולציה ידידותית למשקיעים זרים.</p>

<h2>טבלת השוואה</h2>
<table>
  <thead>
    <tr>
      <th>פרמטר</th>
      <th>ישראל</th>
      <th>בירמינגהם, אלבמה</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>מחיר דירה/בית ממוצע</td>
      <td>~2,500,000 ש"ח ($680,000)</td>
      <td>~$230,000</td>
    </tr>
    <tr>
      <td>הון עצמי נדרש</td>
      <td>600,000+ ש"ח (דירה שנייה)</td>
      <td>$50,000</td>
    </tr>
    <tr>
      <td>מס רכישה</td>
      <td>8% (דירה שנייה)</td>
      <td>0%</td>
    </tr>
    <tr>
      <td>מס נכס שנתי</td>
      <td>5,000-15,000 ש"ח</td>
      <td>~$919</td>
    </tr>
    <tr>
      <td>תשואת השכרה</td>
      <td>2%-3%</td>
      <td>6%-10%</td>
    </tr>
    <tr>
      <td>פוטנציאל Flip</td>
      <td>לא מקובל בישראל</td>
      <td>עד 20% על הון מושקע</td>
    </tr>
    <tr>
      <td>זמן עסקה ממוצע</td>
      <td>6-12 חודשים</td>
      <td>4-6 חודשים</td>
    </tr>
    <tr>
      <td>מבנה משפטי</td>
      <td>בעלות ישירה</td>
      <td>LLC — הגנה משפטית מלאה</td>
    </tr>
    <tr>
      <td>אמנת מס כפל</td>
      <td>—</td>
      <td>כן, ישראל-ארה"ב</td>
    </tr>
  </tbody>
</table>

<h2>איזו עיר בישראל דומה לבירמינגהם?</h2>
<p>הדרך הכי טובה להבין את בירמינגהם היא לדמיין אותה כ<strong>באר שבע של ארה"ב</strong>:</p>
<ul>
  <li>עיר אוניברסיטאית עם מרכז רפואי דומיננטי (סורוקה ≈ UAB Hospital)</li>
  <li>אוכלוסייה דומה באזור המטרופולין</li>
  <li>עיר שעוברת התחדשות ופיתוח מואץ</li>
  <li>מחירי נדל"ן נמוכים מהמרכז, עם מגמת עלייה</li>
  <li>בסיס כלכלי יציב מבוסס מוסדות עוגן</li>
</ul>
<p>ההבדל המרכזי: בבירמינגהם מחירי הכניסה נמוכים בהרבה, ויש אפשרות ליצור רווח משמעותי דרך שיפוץ ומכירה (Flip) — מודל שלא קיים בפועל בישראל.</p>

<h2>למה דווקא שם יש הזדמנויות?</h2>
<ul>
  <li><strong>מרווחים:</strong> הפער בין מחיר רכישה של נכס ישן לשווי אחרי שיפוץ (ARV) גדול מספיק כדי ליצור רווח משמעותי</li>
  <li><strong>עלויות עבודה:</strong> שכר עבודה בבניין באלבמה נמוך ב-30%-50% מערים גדולות כמו ניו יורק או לוס אנג'לס</li>
  <li><strong>מבנה LLC:</strong> הקמת חברה אמריקאית פשוטה, מגנה על המשקיע משפטית ומאפשרת הפרדת נכסים</li>
  <li><strong>אמנת מס:</strong> אמנת מס כפל בין ישראל לארה"ב מונעת תשלום מס כפול</li>
  <li><strong>ביקוש:</strong> העיר מושכת תושבים חדשים מערים יקרות יותר, מה שיוצר ביקוש לנכסים משופצים</li>
</ul>

<h2>מה הסיכונים?</h2>
<p>אנחנו מאמינים בשקיפות מלאה. כל השקעה כרוכה בסיכונים:</p>
<ul>
  <li><strong>שוק זר:</strong> השקעה במדינה אחרת, בשפה אחרת, עם חוקים שונים. לכן חשוב לעבוד עם צוות מקומי מנוסה.</li>
  <li><strong>ניהול מרחוק:</strong> המשקיע לא נמצא פיזית ליד הנכס. סייף קפיטל מנהלת את התהליך כולו על הקרקע.</li>
  <li><strong>תנודות שוק:</strong> מחירי נדל"ן יכולים לרדת. תוכנית עסקית שמרנית עם מרווחי ביטחון מצמצמת את הסיכון.</li>
  <li><strong>עלויות שיפוץ:</strong> חריגות מתקציב אפשריות. ניהול פרויקט צמוד ותמחור שמרני מלכתחילה מקטינים את החשיפה.</li>
  <li><strong>רגולציה ומיסוי:</strong> חוקי מס ורגולציה משתנים. ליווי של רו"ח ועו"ד מומחים בנדל"ן אמריקאי חיוני.</li>
  <li><strong>נזילות:</strong> נדל"ן הוא השקעה לא נזילה — לא ניתן למכור ברגע. משך עסקת Flip טיפוסית: 4-6 חודשים.</li>
</ul>

<p><em>המידע מוצג למטרות מידע בלבד ואינו מהווה ייעוץ השקעות. תשואות עבר אינן מעידות על תשואות עתידיות. מומלץ להתייעץ עם יועץ השקעות מוסמך לפני קבלת החלטה.</em></p>
`;

// ── Seed function ───────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    // 1. Agent prompts
    const agents = [
      {
        agent_name: 'manager',
        display_name: '\u05DE\u05E0\u05D4\u05DC \u05EA\u05D5\u05DB\u05DF',
        description: '\u05DE\u05D7\u05DC\u05D9\u05D8 \u05D0\u05D9\u05DC\u05D5 \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05DC\u05D7\u05E7\u05D5\u05E8, \u05DE\u05E0\u05D4\u05DC \u05D0\u05EA \u05D6\u05E8\u05D9\u05DE\u05EA \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4',
        prompt: readAgentFile('content-manager.md')
      },
      {
        agent_name: 'researcher',
        display_name: '\u05D7\u05D5\u05E7\u05E8',
        description: '\u05DE\u05D7\u05E4\u05E9 \u05DE\u05D9\u05D3\u05E2 \u05D1\u05D0\u05D9\u05E0\u05D8\u05E8\u05E0\u05D8 \u05D5\u05DE\u05D1\u05D9\u05D0 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D2\u05D5\u05DC\u05DE\u05D9\u05D9\u05DD',
        prompt: readAgentFile('content-researcher.md')
      },
      {
        agent_name: 'writer',
        display_name: '\u05DB\u05D5\u05EA\u05D1',
        description: '\u05DB\u05D5\u05EA\u05D1 \u05DB\u05EA\u05D1\u05D5\u05EA \u05D5\u05E1\u05E7\u05D9\u05E8\u05D5\u05EA \u05E2\u05DC \u05D1\u05E1\u05D9\u05E1 \u05D4\u05DE\u05D9\u05D3\u05E2 \u05E9\u05D4\u05D7\u05D5\u05E7\u05E8 \u05DE\u05E6\u05D0',
        prompt: readAgentFile('content-writer.md')
      }
    ];

    for (const agent of agents) {
      await client.query(`
        INSERT INTO content_agent_prompts (agent_name, display_name, description, prompt)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (agent_name) DO UPDATE SET display_name = $2, description = $3, prompt = $4, updated_at = NOW()
      `, [agent.agent_name, agent.display_name, agent.description, agent.prompt]);
    }
    console.log('Agent prompts seeded');

    // 2. Static page: birmingham-info
    await client.query(`
      INSERT INTO static_pages (slug, title, body, seo_title, seo_description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) DO UPDATE SET title = $2, body = $3, seo_title = $4, seo_description = $5, updated_at = NOW()
    `, [
      'birmingham-info',
      '\u05D4\u05DB\u05D9\u05E8\u05D5 \u05D0\u05EA \u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD',
      BIRMINGHAM_INFO_HTML,
      '\u05DE\u05D9\u05D3\u05E2 \u05E2\u05DC \u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD \u05D0\u05DC\u05D1\u05DE\u05D4 \u2014 \u05DB\u05DC\u05DB\u05DC\u05D4, \u05D0\u05D5\u05DB\u05DC\u05D5\u05E1\u05D9\u05D9\u05D4 \u05D5\u05E9\u05DB\u05D5\u05E0\u05D5\u05EA | \u05E1\u05D9\u05D9\u05E3 \u05E7\u05E4\u05D9\u05D8\u05DC',
      '\u05E1\u05E7\u05D9\u05E8\u05D4 \u05DE\u05E7\u05D9\u05E4\u05D4 \u05E2\u05DC \u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD, \u05D0\u05DC\u05D1\u05DE\u05D4 \u2014 \u05DB\u05DC\u05DB\u05DC\u05D4, \u05DE\u05D5\u05E1\u05D3\u05D5\u05EA \u05E2\u05D5\u05D2\u05DF, \u05E9\u05DB\u05D5\u05E0\u05D5\u05EA, \u05EA\u05E9\u05EA\u05D9\u05D5\u05EA \u05D5\u05D0\u05D9\u05DB\u05D5\u05EA \u05D7\u05D9\u05D9\u05DD.'
    ]);
    console.log('Birmingham info page seeded');

    // 3. Static page: birmingham-compare
    await client.query(`
      INSERT INTO static_pages (slug, title, body, seo_title, seo_description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) DO UPDATE SET title = $2, body = $3, seo_title = $4, seo_description = $5, updated_at = NOW()
    `, [
      'birmingham-compare',
      '\u05D9\u05E9\u05E8\u05D0\u05DC vs \u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD',
      BIRMINGHAM_COMPARE_HTML,
      '\u05D4\u05E9\u05D5\u05D5\u05D0\u05EA \u05E0\u05D3\u05DC"\u05DF \u2014 \u05D9\u05E9\u05E8\u05D0\u05DC \u05DE\u05D5\u05DC \u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD | \u05E1\u05D9\u05D9\u05E3 \u05E7\u05E4\u05D9\u05D8\u05DC',
      '\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05DE\u05E7\u05D9\u05E4\u05D4 \u05D1\u05D9\u05DF \u05E9\u05D5\u05E7 \u05D4\u05E0\u05D3\u05DC"\u05DF \u05D1\u05D9\u05E9\u05E8\u05D0\u05DC \u05DC\u05D1\u05D9\u05E8\u05DE\u05D9\u05E0\u05D2\u05D4\u05DD \u2014 \u05DE\u05D7\u05D9\u05E8\u05D9\u05DD, \u05EA\u05E9\u05D5\u05D0\u05D5\u05EA, \u05DE\u05D9\u05E1\u05D5\u05D9.'
    ]);
    console.log('Birmingham compare page seeded');

    console.log('Done! All content seeded successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

/**
 * Seed the current "May 2026 TLV" investor event into the events table.
 * Safe to re-run — only seeds if the events table is empty.
 *
 * Run: node admin/server/seed-active-event.js
 */
const pool = require('./db');

// Source data extracted from:
//   website/investor-nights.html
//   website/js/investor-nights.js
const EVENT_DATA = {
  slug: 'may-2026-tlv',
  is_active: true,
  is_published: true,

  hero_eyebrow_location: 'בירמינגהם · אלבמה',
  hero_eyebrow_session: 'מפגש סגור 01',
  hero_title_main: 'ערב משקיעים',
  hero_title_accent: 'מאי 2026',
  hero_description: 'הצגת העסקה הבאה בבירמינגהאם לקהל סגור של 40 משקיעים. ערב אחד בלבד בתל-אביב.',
  hero_image_url: 'images/investor-nights/hero-birmingham.jpg',

  event_date: '2026-05-14',
  event_time_start: '19:30',
  event_time_end: '22:30',
  event_date_display_full: 'יום חמישי, 14 במאי 2026',
  event_date_display_short: '14.05.2026',

  venue_name: 'The Norman',
  venue_address: 'תל-אביב · נחמני 25',
  venue_short: 'The Norman · TLV',
  venue_full_address: 'The Norman, נחמני 25, תל אביב',

  seats_total: 40,
  seats_taken: 33,

  min_investment_display: '$50,000',
  roi_target_display: 'עד 20%',
  roi_spec: 'שנתי · ברוטו',
  holding_period: '6-12 חודשים',

  brief_text: 'ניפגש פנים אל פנים בתל-אביב. נציג את המודל העסקי שלנו, את הפעילות שלו, והכי חשוב - נציג את העסקה הבאה בבירמינגהאם!',

  track_record_title: 'העסקאות שלנו',
  track_record_subtitle: 'TRACK RECORD · 2024–2026',

  whatsapp_number: '972547828550',
  gcal_title: 'ערב משקיעים · Safe Capital',
  gcal_description: 'ערב משקיעים סגור של Safe Capital בתל-אביב. הצגת העסקה הבאה בבירמינגהאם, אלבמה.',

  agenda: [
    { time: '19:30', title: 'קבלת פנים', subtitle: 'מינגלינג והיכרות', host: 'כל הצוות', sort_order: 0 },
    { time: '20:00', title: 'הצגת הפעילות', subtitle: 'נעבור על השיטה שלנו למציאת פרוייקטים בפינצטה', host: 'שלומי דוד', sort_order: 1 },
    { time: '20:45', title: 'הצגת העסקה — 206 Mountain Ave', subtitle: 'מבנה עסקה · טווחי זמנים · אסטרטגיית מכירה', host: 'איתן גל', sort_order: 2 },
    { time: '21:30', title: 'שאלות ותשובות', subtitle: 'זמן חופשי לשאלות איתנו באחד על אחד', host: 'כל הצוות', sort_order: 3 }
  ],

  speakers: [
    { name: 'שלומי דוד',   role: 'מייסד, מנהל כספים ושיווק', initials: 'שד', number_badge: '01', image_url: null, sort_order: 0 },
    { name: 'עדי פיטוסי',  role: 'מייסד, מנהל משקיעים',       initials: 'עפ', number_badge: '02', image_url: null, sort_order: 1 },
    { name: 'חוטר פדלון',  role: 'מייסד, מנהל עסקאות',        initials: 'חפ', number_badge: '03', image_url: null, sort_order: 2 },
    { name: 'איתן גל',     role: 'מייסד, מנהל משקיעים',       initials: 'אג', number_badge: '04', image_url: null, sort_order: 3 }
  ],

  faqs: [
    { question: 'האם ההגעה מחייבת השקעה?',       answer: 'לא. הערב הזדמנות להכיר את הצוות ואת המודל. אין התחייבות להשקעה.', sort_order: 0 },
    { question: 'צריך להכין משהו?',               answer: 'לא, אתם תקבלו את כל המסמכים והמידע בערב עצמו.',                         sort_order: 1 },
    { question: 'איך ניתן להגיע?',                answer: 'המיקום יישלח אליכם יחד עם תזכורת טרם המפגש. ניתן להגיע ברכב או בתחבורה ציבורית.', sort_order: 2 },
    { question: 'האם ניתן להשתתף בזום?',          answer: 'לא, אנחנו מאמינים בנוכחות פיזית ובלהכיר את המשקיעים שלנו בפנים מול פנים.', sort_order: 3 }
  ]
};

// Featured deals from the static track record
// Each row will try to match an existing deal by deal_number or address substring.
// If no match — fallback_* fields will be used to render the row on the website.
const FEATURED_DEALS = [
  { address_hint: 'Mountain Ave',   deal_number_hint: 2, fallback_address: 'Mountain Ave 206',   fallback_deal_number: '2', fallback_raised_display: '$268,194', fallback_investor_count: 4,  fallback_roi_display: '20%',        override_status_label: 'בתהליך שיפוץ',  override_status_tone: 'active',    sort_order: 0 },
  { address_hint: 'Clairmont',      deal_number_hint: 1, fallback_address: 'Clairmont Ct 61',    fallback_deal_number: '1', fallback_raised_display: '$475,000', fallback_investor_count: 7,  fallback_roi_display: 'In progress', override_status_label: 'בשיווק',         override_status_tone: 'marketing', sort_order: 1 },
  { address_hint: 'Highland',       deal_number_hint: 3, fallback_address: 'Highland Ter 27',    fallback_deal_number: '3', fallback_raised_display: '$290,000', fallback_investor_count: 4,  fallback_roi_display: 'In progress', override_status_label: 'בתהליך שיפוץ',  override_status_tone: 'active',    sort_order: 2 },
  { address_hint: 'Mountain Dr',    deal_number_hint: 4, fallback_address: 'Mountain Dr 915',    fallback_deal_number: '4', fallback_raised_display: '$640,000', fallback_investor_count: 11, fallback_roi_display: '+24%',       override_status_label: 'הושלמה',         override_status_tone: 'done',      sort_order: 3 },
  { address_hint: 'Oak Grove',      deal_number_hint: 5, fallback_address: 'Oak Grove Rd 42',    fallback_deal_number: '5', fallback_raised_display: '$520,000', fallback_investor_count: 8,  fallback_roi_display: '+19%',       override_status_label: 'הושלמה',         override_status_tone: 'done',      sort_order: 4 },
  { address_hint: '5th Ave',        deal_number_hint: 6, fallback_address: '5th Ave S 118',      fallback_deal_number: '6', fallback_raised_display: '$380,000', fallback_investor_count: 6,  fallback_roi_display: '+21%',       override_status_label: 'הושלמה',         override_status_tone: 'done',      sort_order: 5 }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Skip if events already exist (prevent clobbering production)
    const existing = await client.query('SELECT COUNT(*)::int AS cnt FROM events');
    if (existing.rows[0].cnt > 0) {
      console.log(`ℹ  Events table already has ${existing.rows[0].cnt} rows — skipping seed.`);
      await client.query('ROLLBACK');
      return;
    }

    console.log('→ Seeding active event (May 2026 TLV)...');

    const insertRes = await client.query(`
      INSERT INTO events (
        slug, is_active, is_published,
        hero_eyebrow_location, hero_eyebrow_session, hero_title_main, hero_title_accent,
        hero_description, hero_image_url,
        event_date, event_time_start, event_time_end,
        event_date_display_full, event_date_display_short,
        venue_name, venue_address, venue_short, venue_full_address,
        seats_total, seats_taken,
        min_investment_display, roi_target_display, roi_spec, holding_period,
        brief_text,
        track_record_title, track_record_subtitle,
        whatsapp_number, gcal_title, gcal_description,
        agenda, speakers, faqs
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23, $24,
        $25,
        $26, $27,
        $28, $29, $30,
        $31::jsonb, $32::jsonb, $33::jsonb
      )
      RETURNING id
    `, [
      EVENT_DATA.slug, EVENT_DATA.is_active, EVENT_DATA.is_published,
      EVENT_DATA.hero_eyebrow_location, EVENT_DATA.hero_eyebrow_session,
      EVENT_DATA.hero_title_main, EVENT_DATA.hero_title_accent,
      EVENT_DATA.hero_description, EVENT_DATA.hero_image_url,
      EVENT_DATA.event_date, EVENT_DATA.event_time_start, EVENT_DATA.event_time_end,
      EVENT_DATA.event_date_display_full, EVENT_DATA.event_date_display_short,
      EVENT_DATA.venue_name, EVENT_DATA.venue_address, EVENT_DATA.venue_short, EVENT_DATA.venue_full_address,
      EVENT_DATA.seats_total, EVENT_DATA.seats_taken,
      EVENT_DATA.min_investment_display, EVENT_DATA.roi_target_display, EVENT_DATA.roi_spec, EVENT_DATA.holding_period,
      EVENT_DATA.brief_text,
      EVENT_DATA.track_record_title, EVENT_DATA.track_record_subtitle,
      EVENT_DATA.whatsapp_number, EVENT_DATA.gcal_title, EVENT_DATA.gcal_description,
      JSON.stringify(EVENT_DATA.agenda),
      JSON.stringify(EVENT_DATA.speakers),
      JSON.stringify(EVENT_DATA.faqs)
    ]);

    const eventId = insertRes.rows[0].id;
    console.log(`  ✓ Event inserted id=${eventId}`);

    // Featured deals — try to link existing deals by deal_number or address
    let linkedCount = 0;
    for (const fd of FEATURED_DEALS) {
      let linkedDealId = null;

      // Try deal_number first
      if (fd.deal_number_hint) {
        const numRes = await client.query(
          'SELECT id FROM deals WHERE deal_number = $1 LIMIT 1',
          [fd.deal_number_hint]
        );
        if (numRes.rows[0]) linkedDealId = numRes.rows[0].id;
      }

      // Try address substring match
      if (!linkedDealId && fd.address_hint) {
        const addrRes = await client.query(
          `SELECT id FROM deals
           WHERE full_address ILIKE $1 OR name ILIKE $1
           LIMIT 1`,
          [`%${fd.address_hint}%`]
        );
        if (addrRes.rows[0]) linkedDealId = addrRes.rows[0].id;
      }

      await client.query(`
        INSERT INTO event_featured_deals (
          event_id, deal_id, sort_order,
          fallback_address, fallback_deal_number,
          fallback_raised_display, fallback_investor_count, fallback_roi_display,
          override_status_label, override_status_tone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        eventId, linkedDealId, fd.sort_order,
        fd.fallback_address, fd.fallback_deal_number,
        fd.fallback_raised_display, fd.fallback_investor_count, fd.fallback_roi_display,
        fd.override_status_label, fd.override_status_tone
      ]);

      linkedCount += linkedDealId ? 1 : 0;
      console.log(`  ✓ Featured deal "${fd.fallback_address}" — ${linkedDealId ? 'linked to deal id=' + linkedDealId : 'using fallback only'}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Seed complete. Event id=${eventId} · ${FEATURED_DEALS.length} featured deals (${linkedCount} linked to live deals).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));

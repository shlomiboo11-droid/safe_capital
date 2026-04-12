/**
 * Seed site_settings with initial values.
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */
const pool = require('./db');

const SETTINGS = [
  // ── contact ──
  { key: 'phone', value: '+972 (0) 3 555 0123', label: 'טלפון ראשי', category: 'contact', field_type: 'tel' },
  { key: 'phone_whatsapp', value: '+972 54 123 4567', label: 'טלפון וואטסאפ', category: 'contact', field_type: 'tel' },
  { key: 'phone_footer', value: '054-7828550', label: 'טלפון בפוטר', category: 'contact', field_type: 'text' },
  { key: 'email_main', value: 'safecapital2024@gmail.com', label: 'אימייל ראשי', category: 'contact', field_type: 'email' },
  { key: 'email_info', value: 'safecapital2024@gmail.com', label: 'אימייל כללי (פוטר)', category: 'contact', field_type: 'email' },
  { key: 'email_privacy', value: 'privacy@safecapital.co.il', label: 'אימייל פרטיות', category: 'contact', field_type: 'email' },
  { key: 'email_legal', value: 'legal@safecapital.co.il', label: 'אימייל משפטי', category: 'contact', field_type: 'email' },
  { key: 'hours_weekday', value: 'ראשון - חמישי: 09:00 - 18:00', label: 'שעות פעילות — ימי חול', category: 'contact', field_type: 'text' },
  { key: 'hours_weekend', value: 'שישי ושבת: סגור', label: 'שעות פעילות — סופ"ש', category: 'contact', field_type: 'text' },

  // ── links ──
  { key: 'whatsapp_group', value: 'https://chat.whatsapp.com/', label: 'קישור לקבוצת וואטסאפ', category: 'links', field_type: 'url' },
  { key: 'whatsapp_chat', value: 'https://wa.me/972501234567', label: 'קישור לצ\'אט וואטסאפ ישיר', category: 'links', field_type: 'url' },
  { key: 'facebook', value: '#', label: 'פייסבוק', category: 'links', field_type: 'url' },
  { key: 'instagram', value: '#', label: 'אינסטגרם', category: 'links', field_type: 'url' },
  { key: 'linkedin', value: '#', label: 'לינקדאין', category: 'links', field_type: 'url' },

  // ── legal ──
  { key: 'company_name_en', value: 'Safe Capital', label: 'שם חברה באנגלית', category: 'legal', field_type: 'text' },
  { key: 'copyright_text', value: '© 2026 Safe Capital. כל הזכויות שמורות', label: 'טקסט זכויות יוצרים', category: 'legal', field_type: 'text' },
  { key: 'last_updated_he', value: '2026-03-15', label: 'עדכון אחרון (עברית)', category: 'legal', field_type: 'date' },
  { key: 'last_updated_en', value: '2026-03-15', label: 'עדכון אחרון (אנגלית)', category: 'legal', field_type: 'date' },
  { key: 'footer_description', value: 'חברת Safe Capital מתמחה באיתור, השבחה ומכירה של נכסי נדל"ן בארה"ב, עם דגש על שקיפות מלאה ותשואה גבוהה למשקיעים', label: 'תיאור בפוטר', category: 'legal', field_type: 'textarea' },

  // ── events ──
  { key: 'event_cta_text', value: 'בואו לכנס המשקיעים הקרוב\nושמעו את כל הפרטים', label: 'טקסט CTA כנס', category: 'events', field_type: 'textarea' },
];

async function seedSettings() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const s of SETTINGS) {
      const result = await client.query(
        `INSERT INTO site_settings (key, value, label, category, field_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO NOTHING`,
        [s.key, s.value, s.label, s.category, s.field_type]
      );
      if (result.rowCount > 0) inserted++;
    }
    console.log(`Seeded ${inserted} settings (${SETTINGS.length - inserted} already existed).`);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedSettings().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

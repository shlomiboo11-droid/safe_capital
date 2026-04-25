/**
 * Investor Events — CRUD + activate + featured deals sub-routes.
 * Requires super_admin or manager auth.
 */
const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizeJsonArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch (_) { return []; }
  }
  return [];
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || ('event-' + Date.now());
}

// ─────────────────────────────────────────────────────────────
// Auto-compute derived fields from user input
// ─────────────────────────────────────────────────────────────
const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEBREW_WEEKDAYS = ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','שבת'];
const ENG_MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function cityAbbrev(address) {
  if (!address) return '';
  const s = String(address);
  if (s.includes('תל-אביב') || s.includes('תל אביב')) return 'TLV';
  if (s.includes('ירושלים')) return 'JLM';
  if (s.includes('חיפה')) return 'HFA';
  return '';
}

function computeDerivedFields(ev, ctx) {
  const out = {};
  const date = ev.event_date ? new Date(ev.event_date) : null;
  const hasDate = date && !isNaN(date.getTime());

  // Constants (same for every event)
  out.hero_title_main = 'ערב משקיעים';
  out.hero_eyebrow_location = 'בירמינגהם · אלבמה';
  out.track_record_title = 'העסקאות שלנו';
  out.min_investment_display = ev.min_investment_display || '$50,000';
  out.roi_target_display = ev.roi_target_display || 'עד 20%';
  out.roi_spec = ev.roi_spec || 'שנתי · ברוטו';
  out.holding_period = ev.holding_period || '6-12 חודשים';
  out.whatsapp_number = ev.whatsapp_number || '972547828550';

  // Date-derived
  if (hasDate) {
    const day = date.getUTCDate();
    const monthIdx = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const weekdayIdx = date.getUTCDay();

    out.hero_title_accent = `${HEBREW_MONTHS[monthIdx]} ${year}`;
    out.event_date_display_full = `${HEBREW_WEEKDAYS[weekdayIdx]}, ${day} ב${HEBREW_MONTHS[monthIdx]} ${year}`;
    out.event_date_display_short = `${String(day).padStart(2,'0')}.${String(monthIdx+1).padStart(2,'0')}.${year}`;
    out.track_record_subtitle = `TRACK RECORD · ${year - 2}-${year}`;

    if (ctx && ctx.eventCount) {
      out.hero_eyebrow_session = `מפגש סגור ${String(ctx.eventCount).padStart(2, '0')}`;
    }
  }

  // Venue-derived
  if (ev.venue_name) {
    const abbrev = cityAbbrev(ev.venue_address);
    out.venue_short = abbrev ? `${ev.venue_name} · ${abbrev}` : ev.venue_name;
    if (ev.venue_address) {
      const parts = String(ev.venue_address).split(/\s*·\s*/);
      if (parts.length === 2) {
        out.venue_full_address = `${ev.venue_name}, ${parts[1].trim()}, ${parts[0].trim()}`;
      } else {
        out.venue_full_address = `${ev.venue_name}, ${ev.venue_address}`;
      }
    }
  }

  // Google Calendar
  if (out.hero_title_accent) {
    out.gcal_title = `ערב משקיעים · ${out.hero_title_accent} · Safe Capital`;
  }
  const desc = ev.brief_text || ev.hero_description || '';
  if (desc) {
    out.gcal_description = String(desc).slice(0, 500);
  }

  return out;
}

// Derive slug from event_date (e.g. "may-2026"). Uniqueness handled by caller.
function deriveSlug(eventDate) {
  const d = eventDate ? new Date(eventDate) : null;
  if (!d || isNaN(d.getTime())) return 'event-' + Date.now();
  return `${ENG_MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

// ─────────────────────────────────────────────────────────────
// GET /api/events — list all events (newest first)
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*,
        (SELECT COUNT(*)::int FROM event_registrations er
          WHERE er.event_id = e.id OR (er.event_id IS NULL AND er.event_slug = e.slug)) AS registrations_count,
        (SELECT COUNT(*)::int
           FROM deals d
           LEFT JOIN event_featured_deals efd
             ON efd.deal_id = d.id AND efd.event_id = e.id
          WHERE d.is_published = TRUE
            AND (efd.is_hidden IS NULL OR efd.is_hidden = FALSE)
        ) AS featured_deals_count
      FROM events e
      ORDER BY e.is_active DESC, e.event_date DESC NULLS LAST, e.created_at DESC
    `);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/events/:id — full event + featured_deals + registrations
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const evRes = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    const event = evRes.rows[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const [featuredRes, registrationsRes] = await Promise.all([
      pool.query(`
        SELECT efd.*,
          d.name          AS deal_name,
          d.full_address  AS deal_full_address,
          d.deal_number   AS deal_number,
          d.thumbnail_url AS deal_thumbnail,
          d.property_status AS deal_property_status,
          d.is_published    AS deal_is_published
        FROM event_featured_deals efd
        LEFT JOIN deals d ON efd.deal_id = d.id
        WHERE efd.event_id = $1
        ORDER BY efd.sort_order ASC, efd.id ASC
      `, [req.params.id]),
      pool.query(`
        SELECT id, first_name, last_name, email, phone,
               invested_before, range_k, readiness, source, note,
               agree_terms, subscribe_updates, created_at
        FROM event_registrations
        WHERE event_id = $1 OR (event_id IS NULL AND event_slug = $2)
        ORDER BY created_at DESC
      `, [req.params.id, event.slug])
    ]);

    res.json({
      event,
      featured_deals: featuredRes.rows,
      registrations: registrationsRes.rows
    });
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/events — create new event
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { event_date, venue_name, venue_address, hero_description, brief_text } = req.body || {};
    if (!event_date) {
      return res.status(400).json({ error: 'Event date is required' });
    }

    // Count existing events for session number
    const countRes = await pool.query('SELECT COUNT(*)::int AS c FROM events');
    const eventCount = (countRes.rows[0]?.c || 0) + 1;

    // Compute all derived fields
    const derived = computeDerivedFields(
      { event_date, venue_name, venue_address, hero_description, brief_text },
      { eventCount }
    );

    // Generate unique slug (may-2026 → may-2026-2 if already taken)
    let baseSlug = deriveSlug(event_date);
    let finalSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await pool.query('SELECT id FROM events WHERE slug = $1', [finalSlug]);
      if (existing.rows.length === 0) break;
      counter += 1;
      finalSlug = baseSlug + '-' + counter;
    }

    const result = await pool.query(`
      INSERT INTO events (
        slug, event_date, venue_name, venue_address, hero_description, brief_text,
        seats_total, seats_taken, event_time_start, event_time_end,
        hero_title_main, hero_eyebrow_location, hero_eyebrow_session,
        hero_title_accent, event_date_display_full, event_date_display_short,
        venue_short, venue_full_address,
        track_record_title, track_record_subtitle,
        min_investment_display, roi_target_display, roi_spec, holding_period,
        whatsapp_number, gcal_title, gcal_description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
      RETURNING id, slug
    `, [
      finalSlug,
      event_date,
      venue_name || null,
      venue_address || null,
      hero_description || null,
      brief_text || null,
      parseInt(req.body.seats_total) || 40,
      parseInt(req.body.seats_taken) || 0,
      req.body.event_time_start || null,
      req.body.event_time_end || null,
      derived.hero_title_main,
      derived.hero_eyebrow_location,
      derived.hero_eyebrow_session || null,
      derived.hero_title_accent || null,
      derived.event_date_display_full || null,
      derived.event_date_display_short || null,
      derived.venue_short || null,
      derived.venue_full_address || null,
      derived.track_record_title,
      derived.track_record_subtitle || null,
      derived.min_investment_display,
      derived.roi_target_display,
      derived.roi_spec,
      derived.holding_period,
      derived.whatsapp_number,
      derived.gcal_title || null,
      derived.gcal_description || null
    ]);

    await logAudit(req.user.id, 'create', 'event', result.rows[0].id, { slug: finalSlug });
    res.status(201).json({ id: result.rows[0].id, slug: result.rows[0].slug, message: 'Event created' });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/events/:id — update event fields
// ─────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });
    const existingRow = existing.rows[0];

    const simpleFields = [
      'slug', 'is_published',
      'hero_eyebrow_location', 'hero_eyebrow_session',
      'hero_title_main', 'hero_title_accent', 'hero_description', 'hero_image_url',
      'event_date', 'event_time_start', 'event_time_end',
      'event_date_display_full', 'event_date_display_short',
      'venue_name', 'venue_address', 'venue_short', 'venue_full_address',
      'seats_total', 'seats_taken',
      'min_investment_display', 'roi_target_display', 'roi_spec', 'holding_period',
      'brief_text',
      'track_record_title', 'track_record_subtitle',
      'whatsapp_number', 'gcal_title', 'gcal_description'
    ];

    const jsonFields = ['agenda', 'speakers', 'faqs'];

    // Auto-compute derived fields from effective values (request + existing row)
    const effective = {
      event_date: req.body.event_date ?? existingRow.event_date,
      venue_name: req.body.venue_name ?? existingRow.venue_name,
      venue_address: req.body.venue_address ?? existingRow.venue_address,
      hero_description: req.body.hero_description ?? existingRow.hero_description,
      brief_text: req.body.brief_text ?? existingRow.brief_text
    };
    const derived = computeDerivedFields(effective, {});
    // Preserve the event's original session number if already set
    if (existingRow.hero_eyebrow_session) {
      delete derived.hero_eyebrow_session;
    }

    // Merge: user-provided wins, derived fills the rest (for fields not in req.body)
    const toWrite = { ...derived, ...req.body };
    // Also re-derive slug when event_date changes, unless user explicitly provided one
    if (req.body.event_date !== undefined && req.body.slug === undefined) {
      toWrite.slug = deriveSlug(req.body.event_date);
    }

    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of simpleFields) {
      if (toWrite[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        let val = toWrite[field];
        if (field === 'is_published') val = val ? true : false;
        else if (val === '') val = null;
        values.push(val);
      }
    }

    for (const field of jsonFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}::jsonb`);
        values.push(JSON.stringify(normalizeJsonArray(req.body[field])));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE events SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    await logAudit(req.user.id, 'update', 'event', id, req.body);

    res.json({ message: 'Event updated' });
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('slug')) {
      return res.status(409).json({ error: 'Slug already taken' });
    }
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/events/:id/activate — make this the active event (atomic)
// ─────────────────────────────────────────────────────────────
router.post('/:id/activate', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    // Deactivate all others first, then activate target (unique index requires this order)
    await client.query('UPDATE events SET is_active = FALSE WHERE is_active = TRUE AND id != $1', [id]);
    await client.query('UPDATE events SET is_active = TRUE, updated_at = NOW() WHERE id = $1', [id]);
    await client.query('COMMIT');

    await logAudit(req.user.id, 'activate', 'event', id, {});
    res.json({ message: 'Event activated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Activate event error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/events/:id/deactivate — clear active flag (no active event)
// ─────────────────────────────────────────────────────────────
router.post('/:id/deactivate', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE events SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    await logAudit(req.user.id, 'deactivate', 'event', id, {});
    res.json({ message: 'Event deactivated' });
  } catch (err) {
    console.error('Deactivate event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/events/:id/duplicate — create a draft copy of this event
// Copies core fields + agenda/speakers/faqs, but NOT registrations, featured_deals,
// is_active, is_published. New event gets a fresh slug.
// ─────────────────────────────────────────────────────────────
router.post('/:id/duplicate', async (req, res) => {
  const { id } = req.params;
  try {
    const src = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (!src.rows[0]) return res.status(404).json({ error: 'Event not found' });
    const ev = src.rows[0];

    // Unique slug: "<original>-copy", then "-copy-2", etc.
    const baseSlug = (ev.slug || 'event') + '-copy';
    let finalSlug = baseSlug;
    let counter = 1;
    while (true) {
      const ex = await pool.query('SELECT id FROM events WHERE slug = $1', [finalSlug]);
      if (ex.rows.length === 0) break;
      counter += 1;
      finalSlug = baseSlug + '-' + counter;
    }

    const result = await pool.query(`
      INSERT INTO events (
        slug, event_date, event_time_start, event_time_end,
        venue_name, venue_address, venue_short, venue_full_address,
        hero_title_main, hero_title_accent, hero_eyebrow_location, hero_eyebrow_session,
        hero_description, hero_image_url,
        event_date_display_full, event_date_display_short,
        seats_total, seats_taken,
        min_investment_display, roi_target_display, roi_spec, holding_period,
        brief_text, track_record_title, track_record_subtitle,
        whatsapp_number, gcal_title, gcal_description,
        agenda, speakers, faqs,
        is_active, is_published
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,
        FALSE, FALSE
      ) RETURNING id, slug
    `, [
      finalSlug, ev.event_date, ev.event_time_start, ev.event_time_end,
      ev.venue_name, ev.venue_address, ev.venue_short, ev.venue_full_address,
      ev.hero_title_main, ev.hero_title_accent, ev.hero_eyebrow_location, ev.hero_eyebrow_session,
      ev.hero_description, ev.hero_image_url,
      ev.event_date_display_full, ev.event_date_display_short,
      ev.seats_total, 0,
      ev.min_investment_display, ev.roi_target_display, ev.roi_spec, ev.holding_period,
      ev.brief_text, ev.track_record_title, ev.track_record_subtitle,
      ev.whatsapp_number, ev.gcal_title, ev.gcal_description,
      ev.agenda || '[]', ev.speakers || '[]', ev.faqs || '[]'
    ]);

    await logAudit(req.user.id, 'duplicate', 'event', result.rows[0].id, { from: id, slug: finalSlug });
    res.status(201).json({ id: result.rows[0].id, slug: result.rows[0].slug, message: 'Event duplicated' });
  } catch (err) {
    console.error('Duplicate event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/events/:id — delete event
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT slug FROM events WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    await logAudit(req.user.id, 'delete', 'event', id, { slug: existing.rows[0].slug });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Featured deals sub-routes
// ─────────────────────────────────────────────────────────────

// GET /api/events/:id/featured-deals
router.get('/:id/featured-deals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT efd.*,
        d.name AS deal_name,
        d.full_address AS deal_full_address,
        d.deal_number AS deal_number,
        d.thumbnail_url AS deal_thumbnail
      FROM event_featured_deals efd
      LEFT JOIN deals d ON efd.deal_id = d.id
      WHERE efd.event_id = $1
      ORDER BY efd.sort_order ASC, efd.id ASC
    `, [req.params.id]);
    res.json({ featured_deals: result.rows });
  } catch (err) {
    console.error('List featured deals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/:id/featured-deals
router.post('/:id/featured-deals', async (req, res) => {
  const { id } = req.params;
  const {
    deal_id, sort_order, is_hidden,
    fallback_address, fallback_deal_number,
    fallback_raised_display, fallback_investor_count, fallback_roi_display,
    override_status_label, override_status_tone, override_note
  } = req.body || {};

  try {
    // Determine sort_order if not provided (append to end)
    let finalOrder = sort_order;
    if (finalOrder == null) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM event_featured_deals WHERE event_id = $1',
        [id]
      );
      finalOrder = parseInt(maxRes.rows[0].max_order) + 1;
    }

    const result = await pool.query(`
      INSERT INTO event_featured_deals
        (event_id, deal_id, sort_order, is_hidden,
         fallback_address, fallback_deal_number,
         fallback_raised_display, fallback_investor_count, fallback_roi_display,
         override_status_label, override_status_tone, override_note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      id, deal_id || null, finalOrder, !!is_hidden,
      fallback_address || null, fallback_deal_number || null,
      fallback_raised_display || null, fallback_investor_count != null ? parseInt(fallback_investor_count) : null, fallback_roi_display || null,
      override_status_label || null, override_status_tone || null, override_note || null
    ]);

    res.status(201).json({ id: result.rows[0].id, message: 'Featured deal added' });
  } catch (err) {
    console.error('Create featured deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id/featured-deals/:fdId
router.put('/:id/featured-deals/:fdId', async (req, res) => {
  const { fdId } = req.params;
  try {
    const fields = [
      'deal_id', 'sort_order', 'is_hidden',
      'fallback_address', 'fallback_deal_number',
      'fallback_raised_display', 'fallback_investor_count', 'fallback_roi_display',
      'override_status_label', 'override_status_tone', 'override_note'
    ];
    const updates = [];
    const values = [];
    let p = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${p++}`);
        values.push(req.body[f] === '' ? null : req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(fdId);
    await pool.query(`UPDATE event_featured_deals SET ${updates.join(', ')} WHERE id = $${p}`, values);
    res.json({ message: 'Featured deal updated' });
  } catch (err) {
    console.error('Update featured deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/events/:id/featured-deals/:fdId
router.delete('/:id/featured-deals/:fdId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM event_featured_deals WHERE id = $1',
      [req.params.fdId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Featured deal not found' });
    res.json({ message: 'Featured deal removed' });
  } catch (err) {
    console.error('Delete featured deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

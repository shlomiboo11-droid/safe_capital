/**
 * Public API routes — no authentication required.
 * Serves published deal data to the website (http://localhost:8081).
 */

const express = require('express');
const pool = require('../db');
const { sendEventRegistrationEmail } = require('../services/email');

const router = express.Router();

// NOTE: image URLs are returned as relative paths (e.g. `/api/google-drive/file/:id`,
// `/uploads/...`). Clients (website + admin) prepend ADMIN_HOST themselves —
// see website/js/deals.js which does `ADMIN_HOST + image_url`. Do NOT absolutize
// here or you'll cause double-host URLs on the website side.

// GET /api/public/deals — returns all published deals with related data
router.get('/deals', async (req, res) => {
  try {
    // Fetch all published deals ordered by deal_number DESC (newest first)
    const dealsResult = await pool.query(`
      SELECT
        id, deal_number, name, full_address, city, state,
        property_status, fundraising_status,
        is_featured, is_expandable, thumbnail_url, description, card_summary,
        project_duration, purchase_price, arv, expected_sale_price,
        sale_price_tooltip, fundraising_goal, min_investment,
        opens_at_date, sold_at_date, renovation_progress_percent,
        sale_completion_note, actual_purchase_price, actual_sale_price,
        profit_distributed, investor_roi_cap_percent,
        sort_order, created_at
      FROM deals
      WHERE is_published = true
      ORDER BY deal_number DESC NULLS LAST
    `);

    const deals = dealsResult.rows;

    if (deals.length === 0) {
      return res.json({ deals: [] });
    }

    const dealIds = deals.map(d => d.id);

    // Fetch all related data in parallel for all published deals
    const [
      imagesResult,
      costCatsResult,
      costItemsResult,
      timelineResult,
      specsResult,
      investorsResult,
      plannedRoiResult,
      investorCountResult,
      waitlistCountResult,
      compsResult
    ] = await Promise.all([
      pool.query(
        `SELECT * FROM deal_images WHERE deal_id = ANY($1) ORDER BY category, sort_order`,
        [dealIds]
      ),
      pool.query(
        `SELECT c.*,
          (SELECT COALESCE(SUM(ci.planned_amount), 0) FROM deal_cost_items ci WHERE ci.category_id = c.id) as total_planned
         FROM deal_cost_categories c
         WHERE c.deal_id = ANY($1)
         ORDER BY c.sort_order`,
        [dealIds]
      ),
      pool.query(
        `SELECT ci.* FROM deal_cost_items ci
         INNER JOIN deal_cost_categories cc ON ci.category_id = cc.id
         WHERE cc.deal_id = ANY($1)
         ORDER BY ci.sort_order`,
        [dealIds]
      ),
      pool.query(
        `SELECT * FROM deal_timeline_steps WHERE deal_id = ANY($1) ORDER BY sort_order`,
        [dealIds]
      ),
      pool.query(
        `SELECT * FROM deal_specs WHERE deal_id = ANY($1) ORDER BY sort_order`,
        [dealIds]
      ),
      pool.query(
        `SELECT deal_id, COALESCE(SUM(amount), 0) as total_raised
         FROM deal_investors
         WHERE deal_id = ANY($1)
         GROUP BY deal_id`,
        [dealIds]
      ),
      pool.query(
        `SELECT deal_id, planned_roi
         FROM deal_financials_snapshot
         WHERE deal_id = ANY($1)`,
        [dealIds]
      ),
      pool.query(
        `SELECT deal_id, COUNT(id)::int AS investor_count
         FROM deal_investors
         WHERE deal_id = ANY($1)
         GROUP BY deal_id`,
        [dealIds]
      ),
      pool.query(
        `SELECT deal_id, COUNT(*)::int AS waitlist_count
         FROM deal_waitlist
         WHERE deal_id = ANY($1)
         GROUP BY deal_id`,
        [dealIds]
      ),
      pool.query(
        `SELECT deal_id, address, sale_price, days_on_market, bedrooms, bathrooms, sqft
         FROM deal_comps
         WHERE deal_id = ANY($1)
         ORDER BY deal_id, sale_price DESC`,
        [dealIds]
      )
    ]);

    // Group cost items by category_id
    const itemsByCategory = {};
    for (const item of costItemsResult.rows) {
      if (!itemsByCategory[item.category_id]) {
        itemsByCategory[item.category_id] = [];
      }
      itemsByCategory[item.category_id].push(item);
    }

    // Attach items to categories
    for (const cat of costCatsResult.rows) {
      cat.items = itemsByCategory[cat.id] || [];
    }

    // Build lookup maps keyed by deal_id
    const imagesByDeal = {};
    for (const img of imagesResult.rows) {
      if (!imagesByDeal[img.deal_id]) imagesByDeal[img.deal_id] = [];
      imagesByDeal[img.deal_id].push(img);
    }

    const catsByDeal = {};
    for (const cat of costCatsResult.rows) {
      if (!catsByDeal[cat.deal_id]) catsByDeal[cat.deal_id] = [];
      catsByDeal[cat.deal_id].push(cat);
    }

    const timelineByDeal = {};
    for (const step of timelineResult.rows) {
      if (!timelineByDeal[step.deal_id]) timelineByDeal[step.deal_id] = [];
      timelineByDeal[step.deal_id].push(step);
    }

    const specsByDeal = {};
    for (const spec of specsResult.rows) {
      if (!specsByDeal[spec.deal_id]) specsByDeal[spec.deal_id] = [];
      specsByDeal[spec.deal_id].push(spec);
    }

    const raisedByDeal = {};
    for (const row of investorsResult.rows) {
      raisedByDeal[row.deal_id] = parseFloat(row.total_raised);
    }

    // expected_roi_percent is computed LIVE below per-deal (project profit / fundraising_goal, capped by investor_roi_cap_percent)
    // plannedRoiResult is kept as legacy fallback only if live calc can't be done.
    const legacyRoiByDeal = {};
    for (const row of plannedRoiResult.rows) {
      legacyRoiByDeal[row.deal_id] = row.planned_roi != null ? parseFloat(row.planned_roi) : null;
    }

    const investorCountByDeal = {};
    for (const row of investorCountResult.rows) {
      investorCountByDeal[row.deal_id] = row.investor_count;
    }

    const waitlistCountByDeal = {};
    for (const row of waitlistCountResult.rows) {
      waitlistCountByDeal[row.deal_id] = row.waitlist_count;
    }

    const compsByDeal = {};
    for (const row of compsResult.rows) {
      if (!compsByDeal[row.deal_id]) compsByDeal[row.deal_id] = [];
      compsByDeal[row.deal_id].push(row);
    }

    // Assemble final deal objects
    const enrichedDeals = deals.map(deal => {
      const fundraisingGoal = parseFloat(deal.fundraising_goal || 0);
      const fundraisingRaised = raisedByDeal[deal.id] || 0;
      const totalPlanned = (catsByDeal[deal.id] || []).reduce(
        (sum, c) => sum + parseFloat(c.total_planned || 0), 0
      );
      const totalActual = (catsByDeal[deal.id] || []).reduce((sum, c) =>
        sum + (c.items || []).reduce((s, i) => s + parseFloat(i.actual_amount || 0), 0), 0);
      const expectedSalePrice = parseFloat(deal.expected_sale_price || 0);

      // Live investor ROI: profit / fundraising_goal × 100, capped at investor_roi_cap_percent
      const expectedProfit = (expectedSalePrice > 0 && totalPlanned > 0) ? (expectedSalePrice - totalPlanned) : null;
      const investorCap = parseFloat(deal.investor_roi_cap_percent != null ? deal.investor_roi_cap_percent : 20);
      let investorRoi = null;
      if (expectedProfit != null && fundraisingGoal > 0) {
        const rawRoi = (expectedProfit / fundraisingGoal) * 100;
        investorRoi = Math.max(0, Math.min(investorCap, rawRoi));
      } else if (legacyRoiByDeal[deal.id] != null) {
        investorRoi = Math.min(investorCap, legacyRoiByDeal[deal.id]);
      }

      return {
        id: deal.id,
        deal_number: deal.deal_number,
        name: deal.name,
        full_address: deal.full_address,
        city: deal.city,
        state: deal.state,
        property_status: deal.property_status,
        fundraising_status: deal.fundraising_status,
        is_featured: deal.is_featured,
        is_expandable: deal.is_expandable,
        thumbnail_url: deal.thumbnail_url,
        description: deal.description,
        card_summary: deal.card_summary,
        project_duration: deal.project_duration,
        purchase_price: deal.purchase_price,
        arv: deal.arv,
        expected_sale_price: deal.expected_sale_price,
        sale_price_tooltip: deal.sale_price_tooltip,
        fundraising_goal: deal.fundraising_goal,
        fundraising_raised: fundraisingRaised,
        min_investment: deal.min_investment,
        created_at: deal.created_at,
        // Computed helpers
        total_cost: totalPlanned > 0 ? totalPlanned : null,
        total_actual_cost: totalActual > 0 ? totalActual : null,
        expected_profit: expectedProfit,
        fundraising_percent: fundraisingGoal > 0
          ? Math.round((fundraisingRaised / fundraisingGoal) * 100)
          : 0,
        // Investor-facing display fields (live, capped)
        expected_roi_percent: investorRoi,
        investor_count: investorCountByDeal[deal.id] || 0,
        waitlist_count: waitlistCountByDeal[deal.id] || 0,
        spots_remaining: (parseFloat(deal.min_investment) > 0 && fundraisingGoal > 0)
          ? Math.max(0, Math.floor((fundraisingGoal - fundraisingRaised) / parseFloat(deal.min_investment)))
          : null,
        actual_roi_percent: (parseFloat(deal.actual_sale_price) > 0 && parseFloat(deal.actual_purchase_price) > 0)
          ? Math.round(((parseFloat(deal.actual_sale_price) - parseFloat(deal.actual_purchase_price)) / parseFloat(deal.actual_purchase_price)) * 100 * 10) / 10
          : null,
        actual_duration_months: (deal.sold_at_date && deal.opens_at_date)
          ? Math.max(1, Math.round((new Date(deal.sold_at_date) - new Date(deal.opens_at_date)) / (1000 * 60 * 60 * 24 * 30)))
          : null,
        opens_at_date: deal.opens_at_date,
        sold_at_date: deal.sold_at_date,
        renovation_progress_percent: deal.renovation_progress_percent,
        sale_completion_note: deal.sale_completion_note,
        profit_distributed: deal.profit_distributed != null ? parseFloat(deal.profit_distributed) : null,
        // Related data
        images: imagesByDeal[deal.id] || [],
        cost_categories: catsByDeal[deal.id] || [],
        timeline: timelineByDeal[deal.id] || [],
        specs: specsByDeal[deal.id] || [],
        comps: compsByDeal[deal.id] || []
      };
    });

    res.json({ deals: enrichedDeals });
  } catch (err) {
    console.error('Public deals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/settings — all site settings (no auth)
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value, category FROM site_settings ORDER BY category, key'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Public settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/stats — computed deal statistics (no auth)
router.get('/stats', async (req, res) => {
  try {
    const [dealsResult, raisedResult, roiResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM deals WHERE property_status = 'sold'`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM deal_investors`),
      pool.query(`
        SELECT AVG(
          CASE WHEN actual_sale_price > 0 AND actual_purchase_price > 0
          THEN ((actual_sale_price - actual_purchase_price) / actual_purchase_price) * 100
          ELSE NULL END
        ) as avg_roi
        FROM deals
        WHERE property_status = 'sold'
          AND actual_sale_price > 0
          AND actual_purchase_price > 0
      `)
    ]);

    const totalDeals = parseInt(dealsResult.rows[0].count);
    const totalRaised = parseFloat(raisedResult.rows[0].total);
    const avgRoi = roiResult.rows[0].avg_roi ? parseFloat(roiResult.rows[0].avg_roi) : null;

    res.json({
      total_deals: totalDeals,
      total_raised: totalRaised,
      total_raised_display: totalRaised >= 1000000
        ? `$${(totalRaised / 1000000).toFixed(1)}M`
        : `$${Math.round(totalRaised).toLocaleString()}`,
      avg_return: avgRoi ? `${avgRoi.toFixed(1)}%` : null
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/active-event — returns active + published event for the website
router.get('/active-event', async (req, res) => {
  try {
    const evRes = await pool.query(
      `SELECT * FROM events
       WHERE is_active = TRUE AND is_published = TRUE
       LIMIT 1`
    );
    const event = evRes.rows[0];
    if (!event) {
      return res.status(404).json({ error: 'No active event' });
    }

    // Auto-pull: all published deals, left-joined to per-event overrides.
    // event_featured_deals rows with is_hidden=true are excluded.
    const fdRes = await pool.query(`
      SELECT
        d.id                        AS linked_deal_id,
        d.deal_number               AS deal_number,
        d.name                      AS deal_name,
        d.full_address              AS deal_full_address,
        d.thumbnail_url             AS deal_thumbnail,
        d.property_status           AS deal_property_status,
        d.fundraising_goal          AS deal_fundraising_goal,
        d.expected_sale_price       AS deal_expected_sale_price,
        d.investor_roi_cap_percent  AS deal_investor_roi_cap_percent,
        d.is_published              AS deal_is_published,
        d.sort_order                AS deal_sort_order,
        efd.id                      AS id,
        COALESCE(efd.sort_order, d.sort_order, 0) AS sort_order,
        efd.override_status_label,
        efd.override_status_tone,
        efd.override_note,
        efd.fallback_address,
        efd.fallback_deal_number,
        efd.fallback_raised_display,
        efd.fallback_investor_count,
        efd.fallback_roi_display
      FROM deals d
      LEFT JOIN event_featured_deals efd
        ON efd.deal_id = d.id AND efd.event_id = $1
      WHERE d.is_published = TRUE
        AND (efd.is_hidden IS NULL OR efd.is_hidden = FALSE)
      ORDER BY sort_order ASC, d.id DESC
    `, [event.id]);

    // Fetch aggregate data for linked deals:
    //   raised + investor count + planned roi (legacy) + total_planned (for LIVE roi)
    const dealIds = fdRes.rows.map(r => r.linked_deal_id).filter(Boolean);
    const raisedMap = {};
    const investorCountMap = {};
    const legacyRoiMap = {};
    const totalPlannedMap = {};
    if (dealIds.length > 0) {
      const [raisedRes, countRes, roiRes, plannedRes] = await Promise.all([
        pool.query(
          `SELECT deal_id, COALESCE(SUM(amount), 0) AS total_raised
           FROM deal_investors WHERE deal_id = ANY($1) GROUP BY deal_id`,
          [dealIds]
        ),
        pool.query(
          `SELECT deal_id, COUNT(id)::int AS cnt
           FROM deal_investors WHERE deal_id = ANY($1) GROUP BY deal_id`,
          [dealIds]
        ),
        pool.query(
          `SELECT deal_id, planned_roi FROM deal_financials_snapshot
           WHERE deal_id = ANY($1)`,
          [dealIds]
        ),
        pool.query(
          `SELECT cc.deal_id, COALESCE(SUM(ci.planned_amount), 0) AS total_planned
           FROM deal_cost_categories cc
           LEFT JOIN deal_cost_items ci ON ci.category_id = cc.id
           WHERE cc.deal_id = ANY($1)
           GROUP BY cc.deal_id`,
          [dealIds]
        )
      ]);
      for (const r of raisedRes.rows) raisedMap[r.deal_id] = parseFloat(r.total_raised);
      for (const r of countRes.rows) investorCountMap[r.deal_id] = r.cnt;
      for (const r of roiRes.rows) legacyRoiMap[r.deal_id] = r.planned_roi != null ? parseFloat(r.planned_roi) : null;
      for (const r of plannedRes.rows) totalPlannedMap[r.deal_id] = parseFloat(r.total_planned || 0);
    }

    const featured_deals = fdRes.rows.map(r => {
      const live = r.linked_deal_id != null;
      const raised = live && raisedMap[r.linked_deal_id] != null ? raisedMap[r.linked_deal_id] : null;
      const count = live && investorCountMap[r.linked_deal_id] != null ? investorCountMap[r.linked_deal_id] : null;

      // LIVE investor ROI — same formula as /deals endpoint:
      //   profit / fundraising_goal × 100, capped at investor_roi_cap_percent (default 20)
      const fundraisingGoal = parseFloat(r.deal_fundraising_goal || 0);
      const expectedSalePrice = parseFloat(r.deal_expected_sale_price || 0);
      const totalPlanned = totalPlannedMap[r.linked_deal_id] || 0;
      const expectedProfit = (expectedSalePrice > 0 && totalPlanned > 0) ? (expectedSalePrice - totalPlanned) : null;
      const investorCap = parseFloat(r.deal_investor_roi_cap_percent != null ? r.deal_investor_roi_cap_percent : 20);
      let roi = null;
      if (live && expectedProfit != null && fundraisingGoal > 0) {
        const rawRoi = (expectedProfit / fundraisingGoal) * 100;
        roi = Math.max(0, Math.min(investorCap, rawRoi));
      } else if (live && legacyRoiMap[r.linked_deal_id] != null) {
        roi = Math.min(investorCap, legacyRoiMap[r.linked_deal_id]);
      }

      return {
        id: r.id,
        sort_order: r.sort_order,
        deal_id: r.linked_deal_id,
        deal_number: r.deal_number || r.fallback_deal_number || null,
        name: r.deal_name || null,
        address: r.deal_full_address || r.deal_name || r.fallback_address || '',
        thumbnail_url: r.deal_thumbnail || null,
        property_status: r.deal_property_status || null,
        raised_amount: raised,
        raised_display: r.fallback_raised_display || (raised != null ? '$' + Math.round(raised).toLocaleString('en-US') : null),
        investor_count: count != null ? count : r.fallback_investor_count,
        roi_percent: roi,
        roi_display: r.fallback_roi_display || (roi != null ? Math.round(roi) + '%' : null),
        status_label: r.override_status_label || null,
        status_tone: r.override_status_tone || null,
        note: r.override_note || null
      };
    });

    res.json({
      event: {
        id: event.id,
        slug: event.slug,
        is_active: event.is_active,
        is_published: event.is_published,

        hero_eyebrow_location: event.hero_eyebrow_location,
        hero_eyebrow_session: event.hero_eyebrow_session,
        hero_title_main: event.hero_title_main,
        hero_title_accent: event.hero_title_accent,
        hero_description: event.hero_description,
        hero_image_url: event.hero_image_url,

        event_date: event.event_date,
        event_time_start: event.event_time_start,
        event_time_end: event.event_time_end,
        event_date_display_full: event.event_date_display_full,
        event_date_display_short: event.event_date_display_short,

        venue_name: event.venue_name,
        venue_address: event.venue_address,
        venue_short: event.venue_short,
        venue_full_address: event.venue_full_address,

        seats_total: event.seats_total,
        seats_taken: event.seats_taken,

        min_investment_display: event.min_investment_display,
        roi_target_display: event.roi_target_display,
        roi_spec: event.roi_spec,
        holding_period: event.holding_period,

        brief_text: event.brief_text,

        track_record_title: event.track_record_title,
        track_record_subtitle: event.track_record_subtitle,

        whatsapp_number: event.whatsapp_number,
        gcal_title: event.gcal_title,
        gcal_description: event.gcal_description,

        agenda: event.agenda || [],
        speakers: event.speakers || [],
        faqs: event.faqs || []
      },
      featured_deals
    });
  } catch (err) {
    console.error('Active event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/public/event-registration — save investor-nights event registration
// TODO(future): send confirmation email (requires SMTP/SendGrid configured)
// TODO(future): send WhatsApp notification to admin (requires Twilio / WhatsApp Business API)
router.post('/event-registration', async (req, res) => {
  try {
    const {
      event_id,
      event_slug,
      first_name,
      last_name,
      email,
      phone,
      guest_name,
      investor_type,
      invested_before,
      range_k,
      readiness,
      source,
      note,
      agree_terms,
      subscribe_updates
    } = req.body || {};

    if (!first_name || !last_name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!agree_terms) {
      return res.status(400).json({ error: 'Terms must be accepted' });
    }

    const result = await pool.query(
      `INSERT INTO event_registrations
        (event_id, event_slug, first_name, last_name, email, phone, guest_name,
         investor_type, invested_before, range_k, readiness, source, note,
         agree_terms, subscribe_updates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        event_id ? parseInt(event_id) : null,
        event_slug || 'may-2026-tlv',
        first_name,
        last_name,
        email,
        phone,
        guest_name || null,
        investor_type || null,
        invested_before || null,
        range_k || null,
        readiness || null,
        source || null,
        note || null,
        !!agree_terms,
        subscribe_updates === false ? false : true
      ]
    );

    res.json({ success: true, id: result.rows[0].id });

    // Fire-and-forget confirmation email. Never blocks the response;
    // errors are logged inside the service and never thrown.
    (async () => {
      try {
        const eventId = event_id ? parseInt(event_id) : null;
        const slug = event_slug || 'may-2026-tlv';
        const evRes = await pool.query(
          `SELECT hero_title_main, hero_title_accent,
                  event_date_display_full, event_time_start, event_time_end,
                  venue_name, venue_address, venue_full_address
             FROM events
            WHERE ($1::int IS NOT NULL AND id = $1) OR slug = $2
            LIMIT 1`,
          [eventId, slug]
        );
        const eventRow = evRes.rows[0] || {};
        await sendEventRegistrationEmail(
          { first_name, last_name, email, phone, guest_name },
          eventRow
        );
      } catch (mailErr) {
        console.error('[email] Post-registration email path failed:', mailErr.message);
      }
    })();
  } catch (err) {
    console.error('Event registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/public/contact — save contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await pool.query(
      'INSERT INTO contact_submissions (name, email, phone, message) VALUES ($1, $2, $3, $4)',
      [name, email, phone || null, message]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/articles — published articles with pagination
router.get('/articles', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const category = req.query.category || null;

    let where = 'WHERE is_published = true';
    const params = [];
    let paramIdx = 1;

    if (category) {
      where += ` AND category = $${paramIdx++}`;
      params.push(category);
    }

    // Count total for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM articles ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const sql = `
      SELECT id, title, subtitle, slug, thumbnail_url, category, tags,
             is_featured, publish_date, author, seo_title, seo_description, created_at
      FROM articles ${where}
      ORDER BY publish_date DESC NULLS LAST, created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;

    const result = await pool.query(sql, [...params, limit, offset]);

    res.json({
      articles: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Public articles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/articles/:slug — single published article by slug
router.get('/articles/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, subtitle, slug, body, thumbnail_url, category, tags,
              is_featured, publish_date, author, seo_title, seo_description, created_at
       FROM articles
       WHERE slug = $1 AND is_published = true`,
      [req.params.slug]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error('Public article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/weekly-briefing — latest published briefing
router.get('/weekly-briefing', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, week_start, body, created_at
       FROM weekly_briefing
       WHERE is_published = true
       ORDER BY week_start DESC
       LIMIT 1`
    );

    if (!result.rows[0]) {
      return res.json({ briefing: null });
    }

    res.json({ briefing: result.rows[0] });
  } catch (err) {
    console.error('Public weekly briefing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/public/static-pages/:slug — static page by slug
router.get('/static-pages/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, title, body, seo_title, seo_description, updated_at
       FROM static_pages
       WHERE slug = $1`,
      [req.params.slug]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page: result.rows[0] });
  } catch (err) {
    console.error('Public static page error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

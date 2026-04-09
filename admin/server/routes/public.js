/**
 * Public API routes — no authentication required.
 * Serves published deal data to the website (http://localhost:8081).
 */

const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/public/deals — returns all published deals with related data
router.get('/deals', async (req, res) => {
  try {
    // Fetch all published deals ordered by sort_order then created_at
    const dealsResult = await pool.query(`
      SELECT
        id, deal_number, name, full_address, city, state,
        property_status, fundraising_status,
        is_featured, is_expandable, thumbnail_url, description,
        project_duration, purchase_price, arv, expected_sale_price,
        sale_price_tooltip, fundraising_goal, min_investment,
        sort_order, created_at
      FROM deals
      WHERE is_published = true
      ORDER BY sort_order ASC, created_at DESC
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
      investorsResult
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

    // Assemble final deal objects
    const enrichedDeals = deals.map(deal => {
      const fundraisingGoal = parseFloat(deal.fundraising_goal || 0);
      const fundraisingRaised = raisedByDeal[deal.id] || 0;
      const totalPlanned = (catsByDeal[deal.id] || []).reduce(
        (sum, c) => sum + parseFloat(c.total_planned || 0), 0
      );
      const expectedSalePrice = parseFloat(deal.expected_sale_price || 0);

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
        expected_profit: (expectedSalePrice > 0 && totalPlanned > 0)
          ? (expectedSalePrice - totalPlanned)
          : null,
        fundraising_percent: fundraisingGoal > 0
          ? Math.round((fundraisingRaised / fundraisingGoal) * 100)
          : 0,
        // Related data
        images: imagesByDeal[deal.id] || [],
        cost_categories: catsByDeal[deal.id] || [],
        timeline: timelineByDeal[deal.id] || [],
        specs: specsByDeal[deal.id] || []
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

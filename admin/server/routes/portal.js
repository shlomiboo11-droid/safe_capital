/**
 * Portal API routes — investor-facing endpoints
 * Authentication via portalAuthenticate middleware (JWT with type='portal')
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = require('../db');
const { portalAuthenticate } = require('../middleware/portalAuth');
const { logAudit } = require('../helpers/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'safe-capital-secret-key';
const router = express.Router();

// ── POST /api/portal/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM investors WHERE portal_username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    const investor = result.rows[0];

    if (!investor.portal_active) {
      return res.status(403).json({ error: 'חשבון הפורטל אינו פעיל' });
    }

    if (!investor.portal_password_hash) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    const valid = await bcrypt.compare(password, investor.portal_password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    // Generate portal JWT
    const token = jwt.sign(
      {
        investor_id: investor.id,
        first_name: investor.first_name,
        type: 'portal'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last_login
    await pool.query(
      'UPDATE investors SET last_login = NOW() WHERE id = $1',
      [investor.id]
    );

    // Audit log (user_id is null — this is an investor, not an admin user)
    await logAudit(null, 'portal_login', 'investor', null, {
      investor_id: investor.id,
      name: `${investor.first_name} ${investor.last_name || ''}`.trim()
    });

    res.json({
      token,
      investor: {
        id: investor.id,
        first_name: investor.first_name,
        last_name: investor.last_name,
        email: investor.email
      }
    });
  } catch (err) {
    console.error('Portal login error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── Admin routes (require admin auth, not portal auth) ──────────────
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/portal/deals/:dealId/notify — send notification to deal investors
router.post('/deals/:dealId/notify', authenticate, authorize('super_admin', 'manager'), async (req, res) => {
  const dealId = parseInt(req.params.dealId);
  if (isNaN(dealId)) {
    return res.status(400).json({ error: 'מזהה עסקה לא תקין' });
  }

  const { title, body, type, investor_id } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'כותרת נדרשת' });
  }

  const validTypes = ['update', 'milestone', 'document', 'financial', 'message'];
  const notifType = validTypes.includes(type) ? type : 'update';

  try {
    // Get target investors
    let investorIds = [];
    if (investor_id) {
      // Verify this investor is linked to the deal
      const check = await pool.query(
        'SELECT investor_id FROM deal_investors WHERE deal_id = $1 AND investor_id = $2',
        [dealId, investor_id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'משקיע לא נמצא בעסקה זו' });
      }
      investorIds = [investor_id];
    } else {
      // All investors on the deal
      const result = await pool.query(
        'SELECT investor_id FROM deal_investors WHERE deal_id = $1 AND investor_id IS NOT NULL',
        [dealId]
      );
      investorIds = result.rows.map(r => r.investor_id);
    }

    if (investorIds.length === 0) {
      return res.status(400).json({ error: 'אין משקיעים בעסקה זו' });
    }

    // Insert notification for each investor
    let count = 0;
    for (const invId of investorIds) {
      await pool.query(
        `INSERT INTO investor_notifications (investor_id, deal_id, title, body, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [invId, dealId, title.trim(), body || null, notifType]
      );
      count++;
    }

    await logAudit(req.user.id, 'send_notification', 'deal', dealId, {
      title: title.trim(),
      type: notifType,
      recipient_count: count,
      target_investor: investor_id || 'all'
    });

    res.json({ success: true, count, message: `נשלחו ${count} התראות` });
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── All routes below require portal authentication ──────────────────
router.use(portalAuthenticate);

// ── GET /api/portal/me ──────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, phone, phone_secondary,
              address, city, country, company_name, llc_name,
              portal_username, portal_active, last_login, status,
              created_at
       FROM investors WHERE id = $1`,
      [req.investor.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משקיע לא נמצא' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Portal /me error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── PUT /api/portal/me/password ─────────────────────────────────────
router.put('/me/password', async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'סיסמה נוכחית וסיסמה חדשה נדרשות' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' });
  }

  try {
    const result = await pool.query(
      'SELECT portal_password_hash FROM investors WHERE id = $1',
      [req.investor.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משקיע לא נמצא' });
    }

    const valid = await bcrypt.compare(current_password, result.rows[0].portal_password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'הסיסמה הנוכחית שגויה' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE investors SET portal_password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, req.investor.id]
    );

    await logAudit(null, 'portal_password_change', 'investor', null, {
      investor_id: req.investor.id
    });

    res.json({ success: true, message: 'הסיסמה עודכנה בהצלחה' });
  } catch (err) {
    console.error('Portal password change error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── GET /api/portal/my-deals ────────────────────────────────────────
router.get('/my-deals', async (req, res) => {
  try {
    // Get all deals this investor is linked to
    const dealsResult = await pool.query(`
      SELECT
        di.id AS deal_investor_id,
        di.amount,
        di.ownership_percentage,
        di.investment_date,
        di.status AS investment_status,
        di.notes AS investment_notes,
        d.*
      FROM deal_investors di
      JOIN deals d ON d.id = di.deal_id
      WHERE di.investor_id = $1
      ORDER BY di.investment_date DESC
    `, [req.investor.id]);

    const deals = [];
    for (const row of dealsResult.rows) {
      // Fetch timeline steps
      const timeline = await pool.query(
        'SELECT * FROM deal_timeline_steps WHERE deal_id = $1 ORDER BY sort_order',
        [row.id]
      );

      // Fetch thumbnail image
      const thumbnail = await pool.query(
        `SELECT image_url, alt_text FROM deal_images
         WHERE deal_id = $1 AND category = 'thumbnail'
         ORDER BY sort_order LIMIT 1`,
        [row.id]
      );

      deals.push({
        deal_investor_id: row.deal_investor_id,
        amount: row.amount,
        ownership_percentage: row.ownership_percentage,
        investment_date: row.investment_date,
        investment_status: row.investment_status,
        investment_notes: row.investment_notes,
        deal: {
          id: row.id,
          deal_number: row.deal_number,
          name: row.name,
          full_address: row.full_address,
          city: row.city,
          state: row.state,
          property_status: row.property_status,
          fundraising_status: row.fundraising_status,
          purchase_price: row.purchase_price,
          arv: row.arv,
          expected_sale_price: row.expected_sale_price,
          actual_purchase_price: row.actual_purchase_price,
          actual_sale_price: row.actual_sale_price,
          project_duration: row.project_duration,
          thumbnail_url: row.thumbnail_url,
          timeline_steps: timeline.rows,
          thumbnail: thumbnail.rows[0] || null
        }
      });
    }

    // Compute summary
    let total_invested = 0;
    let active_deals = 0;
    let completed_deals = 0;
    let total_profit = 0;

    for (const d of deals) {
      total_invested += parseFloat(d.amount || 0);
      if (d.deal.property_status === 'sold') {
        completed_deals++;
        if (d.deal.actual_sale_price && d.deal.actual_purchase_price) {
          const roi = (d.deal.actual_sale_price - d.deal.actual_purchase_price) / d.deal.actual_purchase_price;
          total_profit += parseFloat(d.amount || 0) * roi;
        }
      } else {
        active_deals++;
      }
    }

    res.json({
      deals,
      summary: {
        total_invested,
        active_deals,
        completed_deals,
        total_profit
      }
    });
  } catch (err) {
    console.error('Portal my-deals error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── GET /api/portal/my-deals/:deal_id ───────────────────────────────
router.get('/my-deals/:deal_id', async (req, res) => {
  const dealId = parseInt(req.params.deal_id);
  if (isNaN(dealId)) {
    return res.status(400).json({ error: 'מזהה עסקה לא תקין' });
  }

  try {
    // Verify investor has access to this deal
    const access = await pool.query(
      'SELECT * FROM deal_investors WHERE investor_id = $1 AND deal_id = $2',
      [req.investor.id, dealId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'אין הרשאה לצפות בעסקה זו' });
    }

    // Fetch all deal data in parallel
    const [
      dealResult,
      financialsResult,
      categoriesResult,
      investorResult,
      timelineResult,
      imagesResult,
      specsResult,
      compsResult,
      documentsResult,
      renovationResult,
      cashflowResult
    ] = await Promise.all([
      pool.query('SELECT * FROM deals WHERE id = $1', [dealId]),
      pool.query('SELECT * FROM deal_financials_snapshot WHERE deal_id = $1', [dealId]),
      pool.query('SELECT * FROM deal_cost_categories WHERE deal_id = $1 ORDER BY sort_order', [dealId]),
      pool.query(
        'SELECT id, deal_id, investor_id, amount, ownership_percentage, investment_date, status, notes FROM deal_investors WHERE investor_id = $1 AND deal_id = $2',
        [req.investor.id, dealId]
      ),
      pool.query('SELECT * FROM deal_timeline_steps WHERE deal_id = $1 ORDER BY sort_order', [dealId]),
      pool.query('SELECT * FROM deal_images WHERE deal_id = $1 ORDER BY category, sort_order', [dealId]),
      pool.query('SELECT * FROM deal_specs WHERE deal_id = $1 ORDER BY sort_order', [dealId]),
      pool.query('SELECT * FROM deal_comps WHERE deal_id = $1 ORDER BY sort_order', [dealId]),
      pool.query('SELECT * FROM deal_documents WHERE deal_id = $1 ORDER BY sort_order', [dealId]),
      pool.query('SELECT * FROM deal_renovation_plan WHERE deal_id = $1', [dealId]),
      pool.query(
        `SELECT type, funding_source, SUM(amount)::numeric AS total
         FROM deal_cashflow WHERE deal_id = $1
         GROUP BY type, funding_source`,
        [dealId]
      )
    ]);

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'עסקה לא נמצאה' });
    }

    // Fetch cost items for each category
    const categories = [];
    for (const cat of categoriesResult.rows) {
      const items = await pool.query(
        'SELECT * FROM deal_cost_items WHERE category_id = $1 ORDER BY sort_order',
        [cat.id]
      );
      categories.push({ ...cat, items: items.rows });
    }

    // Fetch comp images
    const comps = [];
    for (const comp of compsResult.rows) {
      const compImages = await pool.query(
        'SELECT * FROM deal_comp_images WHERE comp_id = $1 ORDER BY sort_order',
        [comp.id]
      );
      comps.push({ ...comp, images: compImages.rows });
    }

    // Compute planned vs actual totals from cost items
    let planned_total = 0;
    let actual_total = 0;
    for (const cat of categories) {
      for (const item of cat.items) {
        planned_total += parseFloat(item.planned_amount || 0);
        actual_total += parseFloat(item.actual_amount || 0);
      }
    }

    // Audit log — record deal view
    await logAudit(null, 'portal_view_deal', 'deal', dealId, {
      investor_id: req.investor.id
    });

    res.json({
      deal: dealResult.rows[0],
      financials_snapshot: financialsResult.rows[0] || null,
      cost_categories: categories,
      investor_position: investorResult.rows[0] || null,
      timeline_steps: timelineResult.rows,
      images: imagesResult.rows,
      specs: specsResult.rows,
      comps,
      documents: documentsResult.rows,
      renovation_plan: renovationResult.rows[0] || null,
      cashflow_summary: cashflowResult.rows,
      totals: {
        planned_total,
        actual_total,
        variance: actual_total - planned_total
      }
    });
  } catch (err) {
    console.error('Portal deal detail error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── GET /api/portal/notifications ───────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM investor_notifications
       WHERE investor_id = $1
       ORDER BY created_at DESC`,
      [req.investor.id]
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM investor_notifications
       WHERE investor_id = $1 AND is_read = FALSE`,
      [req.investor.id]
    );

    res.json({
      notifications: result.rows,
      unread_count: unreadResult.rows[0].count
    });
  } catch (err) {
    console.error('Portal notifications error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ── PUT /api/portal/notifications/:id/read ──────────────────────────
router.put('/notifications/:id/read', async (req, res) => {
  try {
    // Verify notification belongs to this investor
    const result = await pool.query(
      `UPDATE investor_notifications
       SET is_read = TRUE
       WHERE id = $1 AND investor_id = $2
       RETURNING *`,
      [req.params.id, req.investor.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'התראה לא נמצאה' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Portal mark notification read error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

module.exports = router;

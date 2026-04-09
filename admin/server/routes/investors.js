/**
 * Investor management routes — CRUD + search
 * All routes require JWT authentication.
 */
const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate);

// ── GET /api/investors — list with search, filter, sort ──
router.get('/', async (req, res) => {
  try {
    const { q, status, sort, order } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (q) {
      conditions.push(`(
        i.first_name ILIKE $${idx} OR i.last_name ILIKE $${idx}
        OR i.email ILIKE $${idx} OR i.phone ILIKE $${idx}
        OR i.company_name ILIKE $${idx}
        OR (i.first_name || ' ' || i.last_name) ILIKE $${idx}
      )`);
      params.push(`%${q}%`);
      idx++;
    }

    if (status) {
      conditions.push(`i.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const validSorts = ['first_name', 'last_name', 'created_at', 'status'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const result = await pool.query(`
      SELECT
        i.*,
        COUNT(di.id)::int AS deal_count,
        COALESCE(SUM(di.amount), 0)::numeric AS total_invested
      FROM investors i
      LEFT JOIN deal_investors di ON di.investor_id = i.id
      ${where}
      GROUP BY i.id
      ORDER BY i.${sortCol} ${sortDir}
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('List investors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/investors/search?q= — quick search for autocomplete ──
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, phone, email, status
      FROM investors
      WHERE first_name ILIKE $1 OR last_name ILIKE $1
        OR email ILIKE $1 OR phone ILIKE $1
        OR company_name ILIKE $1
        OR (first_name || ' ' || last_name) ILIKE $1
      ORDER BY first_name, last_name
      LIMIT 10
    `, [`%${q}%`]);

    res.json(result.rows);
  } catch (err) {
    console.error('Search investors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/investors/:id — single investor + deals ──
router.get('/:id', async (req, res) => {
  try {
    const inv = await pool.query('SELECT * FROM investors WHERE id = $1', [req.params.id]);
    if (inv.rows.length === 0) return res.status(404).json({ error: 'Investor not found' });

    const deals = await pool.query(`
      SELECT
        di.id AS deal_investor_id,
        di.amount,
        di.ownership_percentage,
        di.investment_date,
        di.status AS investment_status,
        di.notes AS investment_notes,
        d.id AS deal_id,
        d.name AS deal_name,
        d.property_status,
        d.purchase_price,
        d.actual_sale_price,
        d.actual_purchase_price
      FROM deal_investors di
      JOIN deals d ON d.id = di.deal_id
      WHERE di.investor_id = $1
      ORDER BY di.investment_date DESC
    `, [req.params.id]);

    // Compute summary
    const totalInvested = deals.rows.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    let totalProfit = 0;
    let closedDeals = 0;
    for (const d of deals.rows) {
      if (d.property_status === 'sold' && d.actual_sale_price && d.actual_purchase_price) {
        const roi = ((d.actual_sale_price - d.actual_purchase_price) / d.actual_purchase_price);
        const investorProfit = parseFloat(d.amount || 0) * roi;
        totalProfit += investorProfit;
        closedDeals++;
      }
    }

    res.json({
      investor: inv.rows[0],
      deals: deals.rows,
      summary: {
        deal_count: deals.rows.length,
        total_invested: totalInvested,
        total_profit: totalProfit,
        avg_return: closedDeals > 0 ? (totalProfit / totalInvested * 100) : null,
      }
    });
  } catch (err) {
    console.error('Get investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/investors — create ──
router.post('/', authorize('super_admin', 'manager'), async (req, res) => {
  const {
    first_name, last_name, email, phone, phone_secondary,
    id_type, id_number, address, city, country,
    bank_name, bank_branch, bank_account,
    company_name, company_number,
    llc_name, llc_ein, us_tax_id,
    source, status, notes
  } = req.body;

  if (!first_name || !first_name.trim()) {
    return res.status(400).json({ error: 'שם פרטי הוא שדה חובה' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO investors (
        first_name, last_name, email, phone, phone_secondary,
        id_type, id_number, address, city, country,
        bank_name, bank_branch, bank_account,
        company_name, company_number,
        llc_name, llc_ein, us_tax_id,
        source, status, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *
    `, [
      first_name.trim(), (last_name || '').trim(), email || null, phone || null, phone_secondary || null,
      id_type || 'israeli_id', id_number || null, address || null, city || null, country || 'ישראל',
      bank_name || null, bank_branch || null, bank_account || null,
      company_name || null, company_number || null,
      llc_name || null, llc_ein || null, us_tax_id || null,
      source || null, status || 'lead', notes || null, req.user.id
    ]);

    await logAudit(req.user.id, 'create', 'investor', null, {
      investor_id: result.rows[0].id,
      name: `${first_name} ${last_name || ''}`.trim()
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/investors/:id — update ──
router.put('/:id', authorize('super_admin', 'manager'), async (req, res) => {
  const fields = [
    'first_name', 'last_name', 'email', 'phone', 'phone_secondary',
    'id_type', 'id_number', 'address', 'city', 'country',
    'bank_name', 'bank_branch', 'bank_account',
    'company_name', 'company_number',
    'llc_name', 'llc_ein', 'us_tax_id',
    'source', 'status', 'notes'
  ];

  const sets = [];
  const params = [];
  let idx = 1;

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = $${idx}`);
      params.push(req.body[f] === '' ? null : req.body[f]);
      idx++;
    }
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  sets.push(`updated_at = NOW()`);
  params.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE investors SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Investor not found' });

    await logAudit(req.user.id, 'update', 'investor', null, {
      investor_id: req.params.id,
      changed: Object.keys(req.body).filter(k => fields.includes(k))
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/investors/:id — only if no linked deals ──
router.delete('/:id', authorize('super_admin', 'manager'), async (req, res) => {
  try {
    const linked = await pool.query(
      'SELECT COUNT(*)::int AS count FROM deal_investors WHERE investor_id = $1',
      [req.params.id]
    );

    if (linked.rows[0].count > 0) {
      return res.status(409).json({
        error: `לא ניתן למחוק — המשקיע מקושר ל-${linked.rows[0].count} עסקאות. הסר אותו מהעסקאות קודם.`
      });
    }

    const result = await pool.query('DELETE FROM investors WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Investor not found' });

    await logAudit(req.user.id, 'delete', 'investor', null, { investor_id: req.params.id });
    res.json({ message: 'Investor deleted' });
  } catch (err) {
    console.error('Delete investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// ── Cost Categories ─────────────────────────────────────────

// GET /api/deals/:dealId/categories
router.get('/:dealId/categories', async (req, res) => {
  try {
    // Fetch categories and all their items in two parallel queries (eliminates N+1 loop)
    const [catsResult, itemsResult] = await Promise.all([
      pool.query(`
        SELECT c.*,
          (SELECT COALESCE(SUM(ci.planned_amount), 0) FROM deal_cost_items ci WHERE ci.category_id = c.id) as total_planned,
          (SELECT COALESCE(SUM(ci.actual_amount), 0) FROM deal_cost_items ci WHERE ci.category_id = c.id) as total_actual
        FROM deal_cost_categories c
        WHERE c.deal_id = $1
        ORDER BY c.sort_order
      `, [req.params.dealId]),
      pool.query(`
        SELECT ci.* FROM deal_cost_items ci
        INNER JOIN deal_cost_categories cc ON ci.category_id = cc.id
        WHERE cc.deal_id = $1
        ORDER BY ci.sort_order
      `, [req.params.dealId])
    ]);

    const categories = catsResult.rows;

    // Group items by category_id in memory
    const itemsByCategory = {};
    for (const item of itemsResult.rows) {
      if (!itemsByCategory[item.category_id]) {
        itemsByCategory[item.category_id] = [];
      }
      itemsByCategory[item.category_id].push(item);
    }
    for (const cat of categories) {
      cat.items = itemsByCategory[cat.id] || [];
    }

    res.json({ categories });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals/:dealId/categories — add category
router.post('/:dealId/categories', async (req, res) => {
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const result = await pool.query(`
      INSERT INTO deal_cost_categories (deal_id, name, sort_order, is_default)
      VALUES ($1, $2, $3, FALSE)
      RETURNING id
    `, [req.params.dealId, name, sort_order || 0]);

    const newId = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'cost_category', newId, { deal_id: req.params.dealId, name });

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/deals/:dealId/categories/:catId
router.put('/:dealId/categories/:catId', async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    await pool.query(
      'UPDATE deal_cost_categories SET name = COALESCE($1, name), sort_order = COALESCE($2, sort_order) WHERE id = $3 AND deal_id = $4',
      [name || null, sort_order !== undefined ? sort_order : null, req.params.catId, req.params.dealId]
    );
    res.json({ message: 'Category updated' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deals/:dealId/categories/:catId
router.delete('/:dealId/categories/:catId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_cost_categories WHERE id = $1 AND deal_id = $2', [req.params.catId, req.params.dealId]);
    await logAudit(req.user.id, 'delete', 'cost_category', req.params.catId, { deal_id: req.params.dealId });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Cost Items ──────────────────────────────────────────────

// POST /api/deals/:dealId/categories/:catId/items
router.post('/:dealId/categories/:catId/items', async (req, res) => {
  const { name, planned_amount, actual_amount, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });

  try {
    const result = await pool.query(`
      INSERT INTO deal_cost_items (category_id, name, planned_amount, actual_amount, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [req.params.catId, name, planned_amount || 0, actual_amount || 0, sort_order || 0]);

    const newId = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'cost_item', newId, { category_id: req.params.catId, name, planned_amount });

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Create cost item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/deals/:dealId/items/:itemId
router.put('/:dealId/items/:itemId', async (req, res) => {
  const { name, planned_amount, actual_amount, sort_order } = req.body;

  const sets = [];
  const vals = [];
  let paramIdx = 1;

  if (name !== undefined) { sets.push(`name = $${paramIdx++}`); vals.push(name); }
  if (planned_amount !== undefined) { sets.push(`planned_amount = $${paramIdx++}`); vals.push(planned_amount); }
  if (actual_amount !== undefined) { sets.push(`actual_amount = $${paramIdx++}`); vals.push(actual_amount); }
  if (sort_order !== undefined) { sets.push(`sort_order = $${paramIdx++}`); vals.push(sort_order); }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  vals.push(req.params.itemId);

  try {
    await pool.query(`UPDATE deal_cost_items SET ${sets.join(', ')} WHERE id = $${paramIdx}`, vals);
    await logAudit(req.user.id, 'update', 'cost_item', req.params.itemId, req.body);
    res.json({ message: 'Item updated' });
  } catch (err) {
    console.error('Update cost item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deals/:dealId/items/:itemId
router.delete('/:dealId/items/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_cost_items WHERE id = $1', [req.params.itemId]);
    await logAudit(req.user.id, 'delete', 'cost_item', req.params.itemId, { deal_id: req.params.dealId });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete cost item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Renovation Plan ─────────────────────────────────────────

// GET /api/deals/:dealId/renovation-plan
router.get('/:dealId/renovation-plan', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_renovation_plan WHERE deal_id = $1', [req.params.dealId]);
    const plan = result.rows[0] || null;
    if (!plan) return res.json({ plan: null });

    try {
      plan.phases = plan.phases_json ? JSON.parse(plan.phases_json) : [];
    } catch (_) {
      plan.phases = [];
    }
    delete plan.phases_json;

    res.json({ plan });
  } catch (err) {
    console.error('Get renovation plan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals/:dealId/renovation-plan — create or replace
router.post('/:dealId/renovation-plan', async (req, res) => {
  const { total_cost, phases, ai_summary } = req.body;
  const phasesJson = JSON.stringify(phases || []);

  try {
    const existing = await pool.query('SELECT id FROM deal_renovation_plan WHERE deal_id = $1', [req.params.dealId]);
    if (existing.rows[0]) {
      await pool.query(`
        UPDATE deal_renovation_plan
        SET total_cost = $1, phases_json = $2, ai_summary = $3, updated_at = NOW()
        WHERE deal_id = $4
      `, [total_cost || null, phasesJson, ai_summary || null, req.params.dealId]);
      res.json({ message: 'Renovation plan updated' });
    } else {
      const result = await pool.query(`
        INSERT INTO deal_renovation_plan (deal_id, total_cost, phases_json, ai_summary)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [req.params.dealId, total_cost || null, phasesJson, ai_summary || null]);
      res.status(201).json({ id: result.rows[0].id, message: 'Renovation plan created' });
    }
  } catch (err) {
    console.error('Create/update renovation plan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/deals/:dealId/renovation-plan — partial update
router.put('/:dealId/renovation-plan', async (req, res) => {
  const { total_cost, phases, ai_summary } = req.body;

  const sets = ['updated_at = NOW()'];
  const vals = [];
  let paramIdx = 1;

  if (total_cost !== undefined) { sets.push(`total_cost = $${paramIdx++}`); vals.push(total_cost); }
  if (phases !== undefined) { sets.push(`phases_json = $${paramIdx++}`); vals.push(JSON.stringify(phases)); }
  if (ai_summary !== undefined) { sets.push(`ai_summary = $${paramIdx++}`); vals.push(ai_summary); }

  vals.push(req.params.dealId);

  try {
    await pool.query(`UPDATE deal_renovation_plan SET ${sets.join(', ')} WHERE deal_id = $${paramIdx}`, vals);
    res.json({ message: 'Renovation plan updated' });
  } catch (err) {
    console.error('Update renovation plan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Snapshot ────────────────────────────────────────────────

// PUT /api/deals/:dealId/snapshot — upsert financial snapshot
router.put('/:dealId/snapshot', async (req, res) => {
  const { planned_purchase_price, planned_arv, planned_sale_price, planned_total_cost, planned_profit, planned_roi } = req.body;

  try {
    await pool.query(`
      INSERT INTO deal_financials_snapshot (deal_id, planned_purchase_price, planned_arv, planned_sale_price, planned_total_cost, planned_profit, planned_roi)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (deal_id) DO UPDATE SET
        planned_purchase_price = COALESCE($2, deal_financials_snapshot.planned_purchase_price),
        planned_arv            = COALESCE($3, deal_financials_snapshot.planned_arv),
        planned_sale_price     = COALESCE($4, deal_financials_snapshot.planned_sale_price),
        planned_total_cost     = COALESCE($5, deal_financials_snapshot.planned_total_cost),
        planned_profit         = COALESCE($6, deal_financials_snapshot.planned_profit),
        planned_roi            = COALESCE($7, deal_financials_snapshot.planned_roi),
        snapshot_date          = NOW()
    `, [
      req.params.dealId,
      planned_purchase_price || null, planned_arv || null, planned_sale_price || null,
      planned_total_cost || null, planned_profit || null, planned_roi || null
    ]);

    res.json({ message: 'Snapshot updated' });
  } catch (err) {
    console.error('Update snapshot error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

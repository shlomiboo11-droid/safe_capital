const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// GET /api/deals/:dealId/cashflow
router.get('/:dealId/cashflow', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cf.*,
        cc.name as category_name,
        ci.name as cost_item_name,
        u.full_name as created_by_name
      FROM deal_cashflow cf
      LEFT JOIN deal_cost_categories cc ON cf.category_id = cc.id
      LEFT JOIN deal_cost_items ci ON cf.cost_item_id = ci.id
      LEFT JOIN users u ON cf.created_by = u.id
      WHERE cf.deal_id = $1
      ORDER BY cf.date DESC, cf.created_at DESC
    `, [req.params.dealId]);

    const entries = result.rows;
    const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0);

    // Summary by funding source
    const byFundingSource = { equity: 0, loan: 0, sale: 0, other: 0 };
    for (const e of entries) {
      const src = e.funding_source;
      if (src && byFundingSource.hasOwnProperty(src)) {
        byFundingSource[src] += parseFloat(e.amount);
      }
    }

    res.json({
      entries,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense,
        byFundingSource
      }
    });
  } catch (err) {
    console.error('List cashflow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals/:dealId/cashflow — add entry
router.post('/:dealId/cashflow', async (req, res) => {
  const { date, type, amount, description, category_id, cost_item_id, funding_source } = req.body;

  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (!type || !['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type must be income or expense' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (funding_source && !['equity', 'loan', 'sale', 'other'].includes(funding_source)) {
    return res.status(400).json({ error: 'Invalid funding source' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO deal_cashflow (deal_id, date, type, amount, description, category_id, cost_item_id, funding_source, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [req.params.dealId, date, type, amount, description || null, category_id || null, cost_item_id || null, funding_source || null, req.user.id]);

    const newId = result.rows[0].id;

    // Auto-update actual amount on cost item if linked (only for expenses)
    if (type === 'expense' && cost_item_id) {
      await recalcActualAmount(cost_item_id);
    }

    // Auto-update renovation progress percent on the deal
    await recalcRenovationProgress(req.params.dealId);

    await logAudit(req.user.id, 'create', 'cashflow', newId, {
      deal_id: req.params.dealId, date, type, amount, description, category_id, cost_item_id, funding_source
    });

    res.status(201).json({ id: newId, message: 'Cashflow entry added' });
  } catch (err) {
    console.error('Create cashflow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/deals/:dealId/cashflow/:entryId
router.put('/:dealId/cashflow/:entryId', async (req, res) => {
  const { date, type, amount, description, category_id, cost_item_id, funding_source } = req.body;

  try {
    const entryResult = await pool.query(
      'SELECT * FROM deal_cashflow WHERE id = $1 AND deal_id = $2',
      [req.params.entryId, req.params.dealId]
    );
    const entry = entryResult.rows[0];
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const oldCostItemId = entry.cost_item_id;

    await pool.query(`
      UPDATE deal_cashflow SET
        date = COALESCE($1, date),
        type = COALESCE($2, type),
        amount = COALESCE($3, amount),
        description = COALESCE($4, description),
        category_id = $5,
        cost_item_id = $6,
        funding_source = $7
      WHERE id = $8
    `, [
      date || null, type || null, amount || null,
      description !== undefined ? description : entry.description,
      category_id !== undefined ? category_id : entry.category_id,
      cost_item_id !== undefined ? cost_item_id : entry.cost_item_id,
      funding_source !== undefined ? funding_source : entry.funding_source,
      req.params.entryId
    ]);

    // Recalculate actual amounts for affected cost items
    if (oldCostItemId) await recalcActualAmount(oldCostItemId);
    const newCostItemId = cost_item_id !== undefined ? cost_item_id : entry.cost_item_id;
    if (newCostItemId && newCostItemId !== oldCostItemId) await recalcActualAmount(newCostItemId);

    // Auto-update renovation progress percent on the deal
    await recalcRenovationProgress(req.params.dealId);

    await logAudit(req.user.id, 'update', 'cashflow', req.params.entryId, req.body);

    res.json({ message: 'Entry updated' });
  } catch (err) {
    console.error('Update cashflow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deals/:dealId/cashflow/:entryId
router.delete('/:dealId/cashflow/:entryId', async (req, res) => {
  try {
    const entryResult = await pool.query(
      'SELECT * FROM deal_cashflow WHERE id = $1 AND deal_id = $2',
      [req.params.entryId, req.params.dealId]
    );
    const entry = entryResult.rows[0];
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await pool.query('DELETE FROM deal_cashflow WHERE id = $1', [req.params.entryId]);

    if (entry.cost_item_id) {
      await recalcActualAmount(entry.cost_item_id);
    }

    // Auto-update renovation progress percent on the deal
    await recalcRenovationProgress(req.params.dealId);

    await logAudit(req.user.id, 'delete', 'cashflow', req.params.entryId, { deal_id: req.params.dealId, amount: entry.amount });

    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Delete cashflow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Recalculate actual_amount on a cost item based on all linked cashflow entries
 */
async function recalcActualAmount(costItemId) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM deal_cashflow
    WHERE cost_item_id = $1 AND type = 'expense'
  `, [costItemId]);

  await pool.query('UPDATE deal_cost_items SET actual_amount = $1 WHERE id = $2', [result.rows[0].total, costItemId]);
}

/**
 * Calculate renovation progress percent for a deal, based on accounting entries:
 *   percent = (sum of expense cashflow in "renovation" categories) / renovation_plan.total_cost * 100
 *
 * A cashflow entry is considered a renovation expense if:
 *   - type = 'expense'
 *   - its category (deal_cost_categories) name contains 'שיפוץ' or 'renovation' (case-insensitive)
 *
 * Budget source: deal_renovation_plan.total_cost (the effective plan total).
 *
 * Returns { percent, spent, budget }. percent is clamped to [0, 100].
 * If budget is missing / zero → percent = null (we cannot compute a ratio).
 */
async function calcRenovationProgress(dealId) {
  // 1) Spent: sum of expense cashflow in renovation-tagged categories
  const spentResult = await pool.query(`
    SELECT COALESCE(SUM(cf.amount), 0) AS spent
    FROM deal_cashflow cf
    JOIN deal_cost_categories cc ON cf.category_id = cc.id
    WHERE cf.deal_id = $1
      AND cf.type = 'expense'
      AND (cc.name ILIKE '%שיפוץ%' OR cc.name ILIKE '%renovation%')
  `, [dealId]);
  const spent = parseFloat(spentResult.rows[0].spent) || 0;

  // 2) Budget: deal_renovation_plan.total_cost
  const budgetResult = await pool.query(
    'SELECT total_cost FROM deal_renovation_plan WHERE deal_id = $1',
    [dealId]
  );
  const budget = budgetResult.rows[0] ? parseFloat(budgetResult.rows[0].total_cost) : null;

  let percent = null;
  if (budget && budget > 0) {
    percent = (spent / budget) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    percent = Math.round(percent * 10) / 10; // 1 decimal
  }

  return { percent, spent, budget };
}

/**
 * Recalculate and persist renovation_progress_percent on the deal.
 * Called after any cashflow mutation. Silent on error (diagnostic only).
 */
async function recalcRenovationProgress(dealId) {
  try {
    const { percent } = await calcRenovationProgress(dealId);
    await pool.query(
      'UPDATE deals SET renovation_progress_percent = $1 WHERE id = $2',
      [percent, dealId]
    );
  } catch (err) {
    console.error('recalcRenovationProgress error (deal ' + dealId + '):', err.message);
  }
}

// GET /api/deals/:dealId/renovation-progress — returns live computed progress
router.get('/:dealId/renovation-progress', async (req, res) => {
  try {
    const result = await calcRenovationProgress(req.params.dealId);
    res.json(result);
  } catch (err) {
    console.error('renovation-progress error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.calcRenovationProgress = calcRenovationProgress;
router.recalcRenovationProgress = recalcRenovationProgress;
module.exports = router;

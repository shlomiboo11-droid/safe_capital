const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');
const { regenerateDescription } = require('../services/ai-extractor');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// Default cost categories with standard line items matching the oxmoor calculator
const DEFAULT_CATEGORIES = [
  {
    name: 'עלויות רכישה',
    sort_order: 1,
    items: [
      { name: 'מחיר רכישת הנכס', sort_order: 1 },
      { name: 'עלויות סגירה (Closing Costs)', sort_order: 2 },
      { name: 'בדיקות ופיקוח (Inspections)', sort_order: 3 }
    ]
  },
  {
    name: 'עלויות שיפוץ',
    sort_order: 2,
    items: [
      { name: 'הריסה ובנייה (Hard Costs / Demo & Build)', sort_order: 1 },
      { name: 'חומרי גמר ואביזרים (Materials & Finishes)', sort_order: 2 },
      { name: 'פיתוח חוץ (Landscaping)', sort_order: 3 }
    ]
  },
  {
    name: 'עלויות החזקה',
    sort_order: 3,
    items: [
      { name: 'ארנונה וביטוח (Property Tax & Insurance)', sort_order: 1 },
      { name: 'תכנון אדריכלי והנדסי (Architectural & Engineering)', sort_order: 2 },
      { name: 'חשמל, מים ותשתיות (Utilities)', sort_order: 3 }
    ]
  },
  {
    name: 'עלויות מימון',
    sort_order: 4,
    items: [
      { name: 'ריבית הלוואה (Loan Interest)', sort_order: 1 },
      { name: 'עמלות פתיחת הלוואה (Origination Fees)', sort_order: 2 }
    ]
  },
  {
    name: 'עלויות מכירה',
    sort_order: 5,
    items: [
      { name: 'עמלות מתווכים (Agent Commission)', sort_order: 1 },
      { name: 'עלויות סגירת מכירה (Closing)', sort_order: 2 }
    ]
  }
];

// Default timeline steps
const DEFAULT_TIMELINE = [
  { step_name: 'איתור', status: 'active', sort_order: 1 },
  { step_name: 'רכישה', status: 'pending', sort_order: 2 },
  { step_name: 'תכנון', status: 'pending', sort_order: 3 },
  { step_name: 'שיפוץ', status: 'pending', sort_order: 4 },
  { step_name: 'מכירה', status: 'pending', sort_order: 5 }
];

// GET /api/deals — list all deals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
        (SELECT COALESCE(SUM(di.amount), 0) FROM deal_investors di WHERE di.deal_id = d.id) as total_raised,
        (SELECT dim.image_url FROM deal_images dim WHERE dim.deal_id = d.id AND dim.category = 'before' ORDER BY dim.sort_order LIMIT 1) as first_before_image
      FROM deals d
      ORDER BY d.sort_order ASC, d.created_at DESC
    `);
    res.json({ deals: result.rows });
  } catch (err) {
    console.error('List deals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/deals/:id — get single deal with all related data
router.get('/:id', async (req, res) => {
  try {
    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [req.params.id]);
    const deal = dealResult.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Load ALL data in a single parallel batch (eliminates N+1 sequential queries)
    const [catsResult, allItemsRes, snapshotRes, investorsRes, cashflowRes, specsRes, timelineRes, imagesRes, compsRes, documentsRes, uploadedDocsRes, renovationRes] = await Promise.all([
      // Cost categories with totals
      pool.query(`
        SELECT c.*,
          (SELECT COALESCE(SUM(ci.planned_amount), 0) FROM deal_cost_items ci WHERE ci.category_id = c.id) as total_planned,
          (SELECT COALESCE(SUM(ci.actual_amount), 0) FROM deal_cost_items ci WHERE ci.category_id = c.id) as total_actual
        FROM deal_cost_categories c WHERE c.deal_id = $1 ORDER BY c.sort_order
      `, [deal.id]),
      // All cost items for this deal in one query (eliminates N+1 loop)
      pool.query(`
        SELECT ci.* FROM deal_cost_items ci
        INNER JOIN deal_cost_categories cc ON ci.category_id = cc.id
        WHERE cc.deal_id = $1
        ORDER BY ci.sort_order
      `, [deal.id]),
      pool.query('SELECT * FROM deal_financials_snapshot WHERE deal_id = $1', [deal.id]),
      pool.query('SELECT * FROM deal_investors WHERE deal_id = $1 ORDER BY created_at DESC', [deal.id]),
      pool.query(`
        SELECT cf.*,
          cc.name as category_name,
          ci.name as cost_item_name
        FROM deal_cashflow cf
        LEFT JOIN deal_cost_categories cc ON cf.category_id = cc.id
        LEFT JOIN deal_cost_items ci ON cf.cost_item_id = ci.id
        WHERE cf.deal_id = $1
        ORDER BY cf.date DESC, cf.created_at DESC
      `, [deal.id]),
      pool.query('SELECT * FROM deal_specs WHERE deal_id = $1 ORDER BY sort_order', [deal.id]),
      pool.query('SELECT * FROM deal_timeline_steps WHERE deal_id = $1 ORDER BY sort_order', [deal.id]),
      pool.query('SELECT * FROM deal_images WHERE deal_id = $1 ORDER BY category, sort_order', [deal.id]),
      pool.query('SELECT * FROM deal_comps WHERE deal_id = $1 ORDER BY sort_order', [deal.id]),
      pool.query('SELECT * FROM deal_documents WHERE deal_id = $1 ORDER BY sort_order', [deal.id]),
      pool.query('SELECT * FROM deal_uploaded_documents WHERE deal_id = $1 ORDER BY uploaded_at DESC', [deal.id]),
      pool.query('SELECT * FROM deal_renovation_plan WHERE deal_id = $1', [deal.id])
    ]);

    const categories = catsResult.rows;
    const allItems = allItemsRes.rows;

    // Group cost items by category_id in memory (replaces N+1 sequential queries)
    const itemsByCategory = {};
    for (const item of allItems) {
      if (!itemsByCategory[item.category_id]) {
        itemsByCategory[item.category_id] = [];
      }
      itemsByCategory[item.category_id].push(item);
    }
    for (const cat of categories) {
      cat.items = itemsByCategory[cat.id] || [];
    }

    const snapshot = snapshotRes.rows[0] || null;
    const investors = investorsRes.rows;
    const cashflow = cashflowRes.rows;
    const specs = specsRes.rows;
    const timeline = timelineRes.rows;
    const images = imagesRes.rows;
    const comps = compsRes.rows;

    // Attach images to each comp
    if (comps.length > 0) {
      const compIds = comps.map(c => c.id);
      const compImagesRes = await pool.query(
        'SELECT * FROM deal_comp_images WHERE comp_id = ANY($1) ORDER BY is_primary DESC, sort_order',
        [compIds]
      );
      const imgByComp = {};
      for (const img of compImagesRes.rows) {
        if (!imgByComp[img.comp_id]) imgByComp[img.comp_id] = [];
        imgByComp[img.comp_id].push(img);
      }
      for (const comp of comps) {
        comp.images = imgByComp[comp.id] || [];
      }
    }

    const documents = documentsRes.rows;
    const uploadedDocs = uploadedDocsRes.rows;

    let renovationPlan = renovationRes.rows[0] || null;
    if (renovationPlan) {
      try { renovationPlan.phases = renovationPlan.phases_json ? JSON.parse(renovationPlan.phases_json) : []; } catch (_) { renovationPlan.phases = []; }
      delete renovationPlan.phases_json;
    }

    // Compute totals
    const totalPlanned = categories.reduce((sum, c) => sum + parseFloat(c.total_planned || 0), 0);
    const totalActual = categories.reduce((sum, c) => sum + parseFloat(c.total_actual || 0), 0);
    const totalRaised = investors.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalIncome = cashflow.filter(c => c.type === 'income').reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const totalExpense = cashflow.filter(c => c.type === 'expense').reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const expectedSalePrice = parseFloat(deal.expected_sale_price || deal.arv || 0);
    const actualSalePrice = parseFloat(deal.actual_sale_price || 0);
    const effectiveSalePrice = actualSalePrice > 0 ? actualSalePrice : expectedSalePrice;
    const fundraisingGoal = parseFloat(deal.fundraising_goal || 0);

    // Summary by funding source
    const byFundingSource = { equity: 0, loan: 0, sale: 0, other: 0 };
    for (const c of cashflow) {
      const src = c.funding_source;
      if (src && byFundingSource.hasOwnProperty(src)) {
        byFundingSource[src] += parseFloat(c.amount);
      }
    }

    res.json({
      deal,
      categories,
      snapshot,
      investors,
      cashflow,
      specs,
      timeline,
      images,
      comps,
      documents,
      uploadedDocs,
      renovationPlan,
      computed: (() => {
        const plannedProfit = expectedSalePrice - totalPlanned;
        const actualProfit = totalActual > 0 ? (effectiveSalePrice - totalActual) : null;
        const investorCap = parseFloat(deal.investor_roi_cap_percent != null ? deal.investor_roi_cap_percent : 20);
        // Project ROI: profit / fundraising_goal × 100 (uncapped)
        const projectPlannedROI = fundraisingGoal > 0 ? (plannedProfit / fundraisingGoal * 100) : null;
        const projectActualROI = (fundraisingGoal > 0 && actualProfit != null) ? (actualProfit / fundraisingGoal * 100) : null;
        // Investor ROI: same but capped
        const investorPlannedROI = projectPlannedROI != null ? Math.max(0, Math.min(investorCap, projectPlannedROI)) : null;
        const investorActualROI = projectActualROI != null ? Math.max(0, Math.min(investorCap, projectActualROI)) : null;
        return {
          totalPlanned,
          totalActual,
          deviation: totalActual - totalPlanned,
          deviationPercent: totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned * 100) : 0,
          plannedProfit,
          actualProfit,
          // Legacy cost-based ROI (kept for backwards compatibility with any other reader)
          plannedROI: totalPlanned > 0 ? ((expectedSalePrice - totalPlanned) / totalPlanned * 100) : 0,
          actualROI: totalActual > 0 ? ((effectiveSalePrice - totalActual) / totalActual * 100) : null,
          // New: project ROI (uncapped) + investor ROI (capped)
          projectPlannedROI,
          projectActualROI,
          investorPlannedROI,
          investorActualROI,
          investorCap,
          totalRaised,
          fundraisingPercent: fundraisingGoal > 0 ? (totalRaised / fundraisingGoal * 100) : 0,
          remainingToRaise: fundraisingGoal - totalRaised,
          totalIncome,
          totalExpense,
          cashflowBalance: totalIncome - totalExpense,
          byFundingSource
        };
      })()
    });
  } catch (err) {
    console.error('Get deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals — create new deal
router.post('/', async (req, res) => {
  const {
    name, full_address, city, state, zillow_url,
    property_status, fundraising_status,
    is_featured, is_expandable, is_published, sort_order,
    thumbnail_url, description, project_duration,
    purchase_price, arv, expected_sale_price, sale_price_tooltip,
    fundraising_goal, min_investment
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Deal name is required' });
  }

  // Validate numeric fields are positive numbers when provided
  const numericFields = { purchase_price, arv, fundraising_goal };
  for (const [field, value] of Object.entries(numericFields)) {
    if (value != null && value !== '') {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ error: `${field} must be a valid positive number` });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get next deal number
    const lastDealRes = await client.query('SELECT MAX(deal_number) as max_num FROM deals');
    const dealNumber = (parseInt(lastDealRes.rows[0].max_num) || 0) + 1;

    const dealResult = await client.query(`
      INSERT INTO deals (
        deal_number, name, full_address, city, state, zillow_url,
        property_status, fundraising_status,
        is_featured, is_expandable, is_published, sort_order,
        thumbnail_url, description, project_duration,
        purchase_price, arv, expected_sale_price, sale_price_tooltip,
        fundraising_goal, min_investment
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING id
    `, [
      dealNumber, name, full_address || null, city || null, state || null, zillow_url || null,
      property_status || 'sourcing', fundraising_status || 'upcoming',
      is_featured ? true : false, is_expandable ? true : false, is_published ? true : false, sort_order || 0,
      thumbnail_url || null, description || null, project_duration || null,
      purchase_price || null, arv || null, expected_sale_price || null, sale_price_tooltip || null,
      fundraising_goal || null, min_investment || null
    ]);

    const dealId = dealResult.rows[0].id;

    // Create default cost categories with standard line items
    for (const cat of DEFAULT_CATEGORIES) {
      const catResult = await client.query(
        'INSERT INTO deal_cost_categories (deal_id, name, sort_order, is_default) VALUES ($1, $2, $3, TRUE) RETURNING id',
        [dealId, cat.name, cat.sort_order]
      );
      const catId = catResult.rows[0].id;
      for (const item of (cat.items || [])) {
        await client.query(
          'INSERT INTO deal_cost_items (category_id, name, planned_amount, actual_amount, sort_order) VALUES ($1, $2, 0, 0, $3)',
          [catId, item.name, item.sort_order]
        );
      }
    }

    // Create default timeline steps
    for (const step of DEFAULT_TIMELINE) {
      await client.query(
        'INSERT INTO deal_timeline_steps (deal_id, step_name, status, sort_order) VALUES ($1, $2, $3, $4)',
        [dealId, step.step_name, step.status, step.sort_order]
      );
    }

    // Create financial snapshot
    await client.query(`
      INSERT INTO deal_financials_snapshot (deal_id, planned_purchase_price, planned_arv, planned_sale_price)
      VALUES ($1, $2, $3, $4)
    `, [dealId, purchase_price || null, arv || null, expected_sale_price || null]);

    await client.query('COMMIT');

    await logAudit(req.user.id, 'create', 'deal', dealId, { name, deal_number: dealNumber });

    res.status(201).json({ id: dealId, deal_number: dealNumber, message: 'Deal created' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create deal error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/deals/:id — update deal basic info
router.put('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [id]);
    if (!dealResult.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const fields = [
      'deal_number', 'name', 'full_address', 'city', 'state', 'zillow_url',
      'property_status', 'fundraising_status',
      'is_featured', 'is_expandable', 'is_published', 'sort_order',
      'thumbnail_url', 'description', 'card_summary', 'project_duration',
      'purchase_price', 'arv', 'expected_sale_price', 'sale_price_tooltip',
      'actual_purchase_price', 'actual_arv', 'actual_sale_price',
      'fundraising_goal', 'min_investment', 'investor_roi_cap_percent',
      'opens_at_date', 'sold_at_date', 'renovation_progress_percent', 'sale_completion_note',
      'profit_distributed'
    ];

    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        const val = req.body[field];
        if (['is_featured', 'is_expandable', 'is_published'].includes(field)) {
          values.push(val ? true : false);
        } else {
          values.push(val === '' ? null : val);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(`UPDATE deals SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);

    await logAudit(req.user.id, 'update', 'deal', id, req.body);

    res.json({ message: 'Deal updated' });
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('deal_number')) {
      return res.status(409).json({ error: 'מספר העסקה כבר תפוס על ידי עסקה אחרת' });
    }
    console.error('Update deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals/:id/regenerate-description — regenerate AI description + card summary
router.post('/:id/regenerate-description', async (req, res) => {
  const { id } = req.params;
  try {
    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [id]);
    const deal = dealResult.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const { deal_description, card_summary } = await regenerateDescription(deal);

    await pool.query(
      `UPDATE deals
         SET description = $1,
             card_summary = $2,
             updated_at = NOW()
       WHERE id = $3`,
      [deal_description || null, card_summary || null, id]
    );

    await logAudit(req.user.id, 'regenerate_description', 'deal', id, {
      description_length: (deal_description || '').length,
      card_summary_length: (card_summary || '').length
    });

    res.json({ description: deal_description, card_summary });
  } catch (err) {
    console.error('Regenerate description error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/deals/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [id]);
    const deal = dealResult.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    await pool.query('DELETE FROM deals WHERE id = $1', [id]);
    await logAudit(req.user.id, 'delete', 'deal', id, { name: deal.name });

    res.json({ message: 'Deal deleted' });
  } catch (err) {
    console.error('Delete deal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

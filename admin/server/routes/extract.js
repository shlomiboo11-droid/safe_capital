/**
 * Document Extraction Routes — /api/extract/
 *
 * UNIFIED AI-FIRST approach:
 * All documents are sent to Claude in a single API call.
 * Claude analyzes everything together and returns structured JSON.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');
const { getXlsxAsText } = require('../services/xlsx-extractor');
const { analyzeAllDocuments } = require('../services/ai-extractor');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// ── Upload config ────────────────────────────────────────────
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'extraction', Date.now().toString());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0590-\u05FF-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/extract/upload — Upload all documents + Zillow URL
// Sends everything to AI in ONE call
// ──────────────────────────────────────────────────────────────
router.post('/upload', upload.array('files', 10), async (req, res) => {
  // Collect temp directories for cleanup
  const tempDirs = new Set();

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const types = req.body.types
      ? (Array.isArray(req.body.types) ? req.body.types : [req.body.types])
      : [];
    const zillowUrl = (req.body.zillow_url || '').trim() || null;

    // Prepare documents for AI
    let xlsxText = null;
    let loanPdfBuffer = null;
    let renovationPdfBuffer = null;

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = types[i] || 'other';
      const ext = path.extname(file.originalname).toLowerCase();

      // Track temp directory for cleanup
      tempDirs.add(path.dirname(file.path));

      if (['.xlsx', '.xls'].includes(ext) && docType === 'calculator') {
        xlsxText = getXlsxAsText(file.path);
      } else if (ext === '.pdf' && docType === 'loan_application') {
        loanPdfBuffer = fs.readFileSync(file.path);
      } else if (ext === '.pdf' && docType === 'renovation_plan') {
        renovationPdfBuffer = fs.readFileSync(file.path);
      }
    }

    if (!xlsxText) {
      return res.status(400).json({ error: 'Calculator XLSX is required' });
    }

    // Single AI call with all documents
    console.log('Sending all documents to AI for unified analysis...');
    const aiResult = await analyzeAllDocuments(xlsxText, loanPdfBuffer, renovationPdfBuffer, zillowUrl);
    console.log('AI analysis complete.');

    // Return the AI result directly to the frontend
    res.json({
      ai_result: aiResult,
      zillow_url: zillowUrl
    });

  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    // Clean up temporary extraction files
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Temp file cleanup error:', cleanupErr.message);
      }
    }
  }
});

// Helper: safely parse any AI-returned numeric string to a JS number (or null)
function parseAIAmount(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

// ──────────────────────────────────────────────────────────────
// POST /api/extract/create-and-apply — Create a new deal from AI result
// ──────────────────────────────────────────────────────────────
router.post('/create-and-apply', async (req, res) => {
  const { property_info, calculator, renovation_plan, financing, summary, deal_description } = req.body;

  const DEFAULT_TIMELINE = [
    { step_name: 'איתור', status: 'active', sort_order: 1 },
    { step_name: 'רכישה', status: 'pending', sort_order: 2 },
    { step_name: 'תכנון', status: 'pending', sort_order: 3 },
    { step_name: 'שיפוץ', status: 'pending', sort_order: 4 },
    { step_name: 'מכירה', status: 'pending', sort_order: 5 }
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get next deal number
    const lastDealRes = await client.query('SELECT MAX(deal_number) as max_num FROM deals');
    const dealNumber = (parseInt(lastDealRes.rows[0].max_num) || 0) + 1;

    const name = property_info?.name || 'עסקה חדשה';
    const duration = property_info?.project_duration_months
      ? `${property_info.project_duration_months} months`
      : null;

    // Create deal
    const createResult = await client.query(`
      INSERT INTO deals (
        deal_number, name, full_address, city, state, zillow_url,
        property_status, fundraising_status,
        purchase_price, arv, expected_sale_price, project_duration, description
      ) VALUES ($1,$2,$3,$4,$5,$6,'sourcing','upcoming',$7,$8,$9,$10,$11)
      RETURNING id
    `, [
      dealNumber, name,
      property_info?.full_address || null,
      property_info?.city || null,
      property_info?.state || null,
      property_info?.zillow_url || null,
      parseAIAmount(summary?.purchase_price),
      parseAIAmount(summary?.arv),
      parseAIAmount(summary?.arv), // expected_sale_price = ARV
      duration,
      deal_description || null
    ]);

    const dealId = createResult.rows[0].id;

    // Insert cost categories from calculator
    if (calculator && calculator.length > 0) {
      for (let ci = 0; ci < calculator.length; ci++) {
        const cat = calculator[ci];
        const catResult = await client.query(
          'INSERT INTO deal_cost_categories (deal_id, name, sort_order, is_default) VALUES ($1, $2, $3, TRUE) RETURNING id',
          [dealId, cat.category, ci + 1]
        );
        const catId = catResult.rows[0].id;

        if (cat.items && cat.items.length > 0) {
          for (let ii = 0; ii < cat.items.length; ii++) {
            const item = cat.items[ii];
            // parseFloat ensures AI-returned string amounts (e.g. "475,000" or "475000") are stored as numbers
            const plannedAmount = parseFloat(String(item.amount || '0').replace(/[^0-9.-]/g, '')) || 0;
            await client.query(
              'INSERT INTO deal_cost_items (category_id, name, planned_amount, actual_amount, sort_order) VALUES ($1, $2, $3, 0, $4)',
              [catId, item.label, plannedAmount, ii + 1]
            );
          }
        }
      }
    }

    // Default timeline
    for (const step of DEFAULT_TIMELINE) {
      await client.query(
        'INSERT INTO deal_timeline_steps (deal_id, step_name, status, sort_order) VALUES ($1, $2, $3, $4)',
        [dealId, step.step_name, step.status, step.sort_order]
      );
    }

    // Financial snapshot
    const totalInvestment = parseAIAmount(summary?.total_investment);
    const profit = parseAIAmount(summary?.net_profit);
    const roi = totalInvestment && profit ? (profit / totalInvestment * 100) : null;

    await client.query(`
      INSERT INTO deal_financials_snapshot (deal_id, planned_purchase_price, planned_arv, planned_sale_price, planned_total_cost, planned_profit, planned_roi)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      dealId,
      parseAIAmount(summary?.purchase_price),
      parseAIAmount(summary?.arv),
      parseAIAmount(summary?.arv),
      totalInvestment,
      profit,
      roi
    ]);

    // Renovation plan — normalize AI field names to canonical format
    if (renovation_plan && renovation_plan.phases && renovation_plan.phases.length > 0) {
      const normalizedPhases = renovation_plan.phases.map((p, i) => ({
        phase_number: p.phase_number || p.phase || (i + 1),
        title: p.title || '',
        cost: parseAIAmount(p.cost != null ? p.cost : (p.amount != null ? p.amount : 0)) || 0,
        ai_explanation: p.ai_explanation || p.description_ai || ''
      }));
      await client.query(
        'INSERT INTO deal_renovation_plan (deal_id, total_cost, phases_json, ai_summary) VALUES ($1, $2, $3, $4)',
        [dealId, parseAIAmount(renovation_plan.total_cost), JSON.stringify(normalizedPhases), null]
      );
    }

    // Specs (before/after)
    if (property_info?.specs_before && property_info?.specs_after) {
      const specPairs = [
        { name: 'חדרי שינה', before: property_info.specs_before.bedrooms, after: property_info.specs_after.bedrooms },
        { name: 'חדרי רחצה', before: property_info.specs_before.bathrooms, after: property_info.specs_after.bathrooms },
        { name: 'שטח בנוי (sqft)', before: property_info.specs_before.sqft, after: property_info.specs_after.sqft }
      ];
      for (let si = 0; si < specPairs.length; si++) {
        const s = specPairs[si];
        if (s.before != null || s.after != null) {
          await client.query(
            'INSERT INTO deal_specs (deal_id, spec_name, value_before, value_after, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [dealId, s.name, String(s.before || ''), String(s.after || ''), si + 1]
          );
        }
      }
    }

    await client.query('COMMIT');
    await logAudit(req.user.id, 'create', 'deal', dealId, { name, source: 'ai_extraction' });

    res.status(201).json({
      message: 'Deal created with AI-extracted data',
      deal_id: dealId,
      deal_number: dealNumber
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create-and-apply error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

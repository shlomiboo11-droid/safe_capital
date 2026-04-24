/**
 * Sub-entity routes for deals: investors, specs, timeline, images, comps, documents
 * All follow the same CRUD pattern
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// ── Investors ───────────────────────────────────────────────

router.get('/:dealId/investors', async (req, res) => {
  try {
    const investorsRes = await pool.query(
      'SELECT * FROM deal_investors WHERE deal_id = $1 ORDER BY created_at DESC',
      [req.params.dealId]
    );
    const investors = investorsRes.rows;
    const total = investors.reduce((s, i) => s + parseFloat(i.amount || 0), 0);

    const dealRes = await pool.query('SELECT fundraising_goal FROM deals WHERE id = $1', [req.params.dealId]);
    const deal = dealRes.rows[0];
    const goal = parseFloat(deal?.fundraising_goal || 0);

    res.json({
      investors,
      totals: {
        raised: total,
        goal,
        percent: goal > 0 ? (total / goal * 100) : 0,
        remaining: goal - total
      }
    });
  } catch (err) {
    console.error('List investors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/investors', async (req, res) => {
  const { investor_name, amount, investment_date, ownership_percentage, notes } = req.body;
  if (!investor_name) return res.status(400).json({ error: 'Investor name is required' });

  const investorAmount = parseFloat(amount) || 0;

  try {
    const result = await pool.query(`
      INSERT INTO deal_investors (deal_id, investor_name, amount, investment_date, ownership_percentage, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [req.params.dealId, investor_name, investorAmount, investment_date || null, ownership_percentage || null, notes || null]);

    const newId = result.rows[0].id;

    // Auto-create income cashflow entry for the investment
    if (investorAmount > 0) {
      const cashflowDate = investment_date || new Date().toISOString().split('T')[0];
      const description = `השקעה מ-${investor_name}`;
      const cashflowResult = await pool.query(`
        INSERT INTO deal_cashflow (deal_id, date, type, amount, description, category_id, cost_item_id, funding_source, created_by)
        VALUES ($1, $2, 'income', $3, $4, NULL, NULL, 'equity', $5)
        RETURNING id
      `, [req.params.dealId, cashflowDate, investorAmount, description, req.user.id]);

      await logAudit(req.user.id, 'create', 'cashflow', cashflowResult.rows[0].id, {
        deal_id: req.params.dealId, type: 'income', amount: investorAmount,
        description, funding_source: 'equity', auto_created: 'investor_add'
      });
    }

    await logAudit(req.user.id, 'create', 'deal_investor', newId, { deal_id: req.params.dealId, investor_name, amount: investorAmount });
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Create investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/investors/:itemId', async (req, res) => {
  const { investor_name, amount, investment_date, ownership_percentage, notes } = req.body;
  try {
    await pool.query(`
      UPDATE deal_investors SET
        investor_name = COALESCE($1, investor_name),
        amount = COALESCE($2, amount),
        investment_date = COALESCE($3, investment_date),
        ownership_percentage = $4,
        notes = $5
      WHERE id = $6 AND deal_id = $7
    `, [
      investor_name || null,
      amount !== undefined ? amount : null,
      investment_date || null,
      ownership_percentage !== undefined ? ownership_percentage : null,
      notes !== undefined ? notes : null,
      req.params.itemId, req.params.dealId
    ]);
    await logAudit(req.user.id, 'update', 'deal_investor', req.params.itemId, req.body);
    res.json({ message: 'Investor updated' });
  } catch (err) {
    console.error('Update investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/investors/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_investors WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    await logAudit(req.user.id, 'delete', 'deal_investor', req.params.itemId, { deal_id: req.params.dealId });
    res.json({ message: 'Investor removed' });
  } catch (err) {
    console.error('Delete investor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Specs ───────────────────────────────────────────────────

router.get('/:dealId/specs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_specs WHERE deal_id = $1 ORDER BY sort_order', [req.params.dealId]);
    res.json({ specs: result.rows });
  } catch (err) {
    console.error('List specs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/specs', async (req, res) => {
  const { spec_name, value_before, value_after, sort_order } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO deal_specs (deal_id, spec_name, value_before, value_after, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.dealId, spec_name || '', value_before || '', value_after || '', sort_order || 0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create spec error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/specs/:itemId', async (req, res) => {
  const { spec_name, value_before, value_after, sort_order } = req.body;
  try {
    await pool.query(
      `UPDATE deal_specs SET
        spec_name = COALESCE($1, spec_name),
        value_before = COALESCE($2, value_before),
        value_after = COALESCE($3, value_after),
        sort_order = COALESCE($4, sort_order)
      WHERE id = $5 AND deal_id = $6`,
      [spec_name || null, value_before !== undefined ? value_before : null, value_after !== undefined ? value_after : null, sort_order !== undefined ? sort_order : null, req.params.itemId, req.params.dealId]
    );
    res.json({ message: 'Spec updated' });
  } catch (err) {
    console.error('Update spec error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/specs/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_specs WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    res.json({ message: 'Spec deleted' });
  } catch (err) {
    console.error('Delete spec error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Timeline ────────────────────────────────────────────────

router.get('/:dealId/timeline', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_timeline_steps WHERE deal_id = $1 ORDER BY sort_order', [req.params.dealId]);
    res.json({ steps: result.rows });
  } catch (err) {
    console.error('List timeline error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/timeline', async (req, res) => {
  const { step_name, status, sort_order } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO deal_timeline_steps (deal_id, step_name, status, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.params.dealId, step_name || '', status || 'pending', sort_order || 0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create timeline step error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/timeline/:itemId', async (req, res) => {
  const { step_name, status, sort_order } = req.body;
  try {
    await pool.query(
      'UPDATE deal_timeline_steps SET step_name = COALESCE($1, step_name), status = COALESCE($2, status), sort_order = COALESCE($3, sort_order) WHERE id = $4 AND deal_id = $5',
      [step_name || null, status || null, sort_order !== undefined ? sort_order : null, req.params.itemId, req.params.dealId]
    );
    await logAudit(req.user.id, 'update', 'deal_timeline_step', parseInt(req.params.itemId), {
      deal_id: req.params.dealId,
      step_name: step_name || null,
      status: status || null
    });
    res.json({ message: 'Step updated' });
  } catch (err) {
    console.error('Update timeline step error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/timeline/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_timeline_steps WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    res.json({ message: 'Step deleted' });
  } catch (err) {
    console.error('Delete timeline step error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Images ──────────────────────────────────────────────────

router.get('/:dealId/images', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_images WHERE deal_id = $1 ORDER BY category, sort_order', [req.params.dealId]);
    res.json({ images: result.rows });
  } catch (err) {
    console.error('List images error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/images', async (req, res) => {
  const { image_url, alt_text, category, sort_order } = req.body;
  if (!image_url) return res.status(400).json({ error: 'image_url is required' });
  try {
    const result = await pool.query(
      'INSERT INTO deal_images (deal_id, image_url, alt_text, category, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.dealId, image_url, alt_text || '', category || 'gallery', sort_order || 0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/images/:itemId', async (req, res) => {
  const { image_url, alt_text, category, sort_order } = req.body;
  try {
    await pool.query(
      'UPDATE deal_images SET image_url = COALESCE($1, image_url), alt_text = COALESCE($2, alt_text), category = COALESCE($3, category), sort_order = COALESCE($4, sort_order) WHERE id = $5 AND deal_id = $6',
      [image_url || null, alt_text !== undefined ? alt_text : null, category || null, sort_order !== undefined ? sort_order : null, req.params.itemId, req.params.dealId]
    );
    res.json({ message: 'Image updated' });
  } catch (err) {
    console.error('Update image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/images/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_images WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Image File Upload ───────────────────────────────────────

const imgUploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(imgUploadDir)) fs.mkdirSync(imgUploadDir, { recursive: true });

const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dealDir = path.join(imgUploadDir, req.params.dealId);
    if (!fs.existsSync(dealDir)) fs.mkdirSync(dealDir, { recursive: true });
    cb(null, dealDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const imgUpload = multer({
  storage: imgStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

router.post('/:dealId/images/upload', imgUpload.array('images', 30), async (req, res) => {
  const { dealId } = req.params;
  const category = req.body.category || 'before';

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No image files uploaded' });
  }

  try {
    const maxOrderRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM deal_images WHERE deal_id = $1 AND category = $2',
      [dealId, category]
    );
    let sortOrder = (parseInt(maxOrderRes.rows[0].max_order) || -1) + 1;

    const saved = [];
    for (const file of req.files) {
      const imageUrl = `/uploads/${dealId}/${file.filename}`;
      const result = await pool.query(
        'INSERT INTO deal_images (deal_id, image_url, alt_text, category, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [dealId, imageUrl, file.originalname, category, sortOrder++]
      );
      saved.push(result.rows[0]);
    }

    await logAudit(req.user.id, 'create', 'deal_images_upload', parseInt(dealId), {
      count: saved.length, category
    });

    res.status(201).json({ images: saved, count: saved.length });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Zillow Image Fetch ──────────────────────────────────────

router.post('/:dealId/fetch-zillow-images', async (req, res) => {
  const { dealId } = req.params;
  const address = req.body.url || req.body.address;

  if (!address || typeof address !== 'string' || address.trim().length < 5) {
    return res.status(400).json({ error: 'כתובת נכס או Zillow URL נדרשים' });
  }

  // Verify deal exists
  try {
    const dealCheck = await pool.query('SELECT id FROM deals WHERE id = $1', [dealId]);
    if (!dealCheck.rows[0]) {
      return res.status(404).json({ error: 'עסקה לא נמצאה' });
    }
  } catch (err) {
    console.error('Deal check error:', err);
    return res.status(500).json({ error: 'Server error' });
  }

  let fetchZillowImages;
  try {
    ({ fetchZillowImages } = require('../services/zillow-scraper'));
  } catch (err) {
    console.error('Failed to load zillow-scraper service:', err);
    return res.status(500).json({ error: 'שירות ה-Zillow אינו זמין' });
  }

  let zillowResult;
  try {
    zillowResult = await fetchZillowImages(address.trim());
  } catch (err) {
    console.error('Zillow fetch error:', err.message);
    return res.status(502).json({
      error: err.message || 'לא ניתן לגשת ל-Zillow כרגע'
    });
  }

  const { images: imageUrls, source, warning } = zillowResult;

  if (!imageUrls || imageUrls.length === 0) {
    return res.status(404).json({ error: 'לא נמצאו תמונות לנכס זה ב-Zillow' });
  }

  // Insert all fetched images into deal_images table
  // category = 'before' for property-as-found images from Zillow
  const savedImages = [];
  let sortOrder = 0;

  try {
    // Get current max sort_order for the deal to avoid collisions
    const maxOrderRes = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM deal_images WHERE deal_id = $1 AND category = 'before'",
      [dealId]
    );
    sortOrder = (parseInt(maxOrderRes.rows[0].max_order) || -1) + 1;

    for (const url of imageUrls) {
      const result = await pool.query(
        "INSERT INTO deal_images (deal_id, image_url, alt_text, category, sort_order) VALUES ($1, $2, $3, 'before', $4) RETURNING id, image_url, alt_text, category, sort_order",
        [dealId, url, `Zillow - ${address}`, sortOrder]
      );
      savedImages.push(result.rows[0]);
      sortOrder++;
    }

    await logAudit(req.user.id, 'create', 'deal_images_zillow', parseInt(dealId), {
      count: savedImages.length,
      address,
      source
    });

    res.json({
      success: true,
      images: savedImages,
      count: savedImages.length,
      source,
      ...(warning ? { warning } : {})
    });
  } catch (err) {
    console.error('Save zillow images error:', err);
    res.status(500).json({ error: 'שגיאה בשמירת התמונות למסד הנתונים' });
  }
});

// ── Comps ───────────────────────────────────────────────────

router.get('/:dealId/comps', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_comps WHERE deal_id = $1 ORDER BY sort_order', [req.params.dealId]);
    res.json({ comps: result.rows });
  } catch (err) {
    console.error('List comps error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/comps', async (req, res) => {
  const {
    zillow_url, address, sale_price, days_on_market, bedrooms, bathrooms,
    sqft, year_built, lot_size, property_type, sale_date, image_url,
    distance_miles, latitude, longitude, data_source, sort_order
  } = req.body;

  const ppsf = (sale_price && sqft) ? (sale_price / sqft) : null;

  try {
    const result = await pool.query(`
      INSERT INTO deal_comps (
        deal_id, zillow_url, address, sale_price, days_on_market, bedrooms, bathrooms,
        sqft, year_built, price_per_sqft, lot_size, property_type, sale_date, image_url,
        distance_miles, latitude, longitude, data_source, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id
    `, [
      req.params.dealId, zillow_url || null, address || null, sale_price || null,
      days_on_market || null, bedrooms || null, bathrooms || null,
      sqft || null, year_built || null, ppsf, lot_size || null,
      property_type || null, sale_date || null, image_url || null,
      distance_miles || null, latitude || null, longitude || null,
      data_source || 'manual', sort_order || 0
    ]);

    const newId = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'comp', newId, { deal_id: req.params.dealId, address });
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Create comp error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/comps/:itemId', async (req, res) => {
  const fields = [
    'zillow_url', 'address', 'sale_price', 'days_on_market', 'bedrooms', 'bathrooms',
    'sqft', 'year_built', 'lot_size', 'property_type', 'sale_date', 'image_url',
    'distance_miles', 'latitude', 'longitude', 'data_source', 'sort_order'
  ];

  const updates = [];
  const values = [];
  let paramIdx = 1;

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${paramIdx++}`);
      values.push(req.body[f] === '' ? null : req.body[f]);
    }
  }

  // Recalculate price_per_sqft
  if (req.body.sale_price !== undefined || req.body.sqft !== undefined) {
    try {
      const existing = await pool.query('SELECT sale_price, sqft FROM deal_comps WHERE id = $1', [req.params.itemId]);
      const ex = existing.rows[0];
      const sp = req.body.sale_price !== undefined ? req.body.sale_price : ex?.sale_price;
      const sf = req.body.sqft !== undefined ? req.body.sqft : ex?.sqft;
      updates.push(`price_per_sqft = $${paramIdx++}`);
      values.push((sp && sf) ? (sp / sf) : null);
    } catch (_) { /* skip ppsf recalc on error */ }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.itemId, req.params.dealId);

  try {
    await pool.query(`UPDATE deal_comps SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND deal_id = $${paramIdx}`, values);
    res.json({ message: 'Comp updated' });
  } catch (err) {
    console.error('Update comp error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/comps/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_comps WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    await logAudit(req.user.id, 'delete', 'comp', req.params.itemId, { deal_id: req.params.dealId });
    res.json({ message: 'Comp deleted' });
  } catch (err) {
    console.error('Delete comp error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Comp: fetch from Zillow API ────────────────────────────

router.post('/:dealId/comps/fetch-zillow', async (req, res) => {
  const { dealId } = req.params;
  const { addressOrUrl } = req.body;

  if (!addressOrUrl || addressOrUrl.trim().length < 5) {
    return res.status(400).json({ error: 'כתובת או Zillow URL נדרשים' });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY לא מוגדר' });
  }

  const input = addressOrUrl.trim();
  let apiUrl;
  if (input.startsWith('http')) {
    apiUrl = `https://private-zillow.p.rapidapi.com/byurl?url=${encodeURIComponent(input)}`;
  } else {
    apiUrl = `https://private-zillow.p.rapidapi.com/byaddress?propertyaddress=${encodeURIComponent(input)}`;
  }

  try {
    const resp = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'private-zillow.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Zillow API error (${resp.status}): ${text.substring(0, 200)}` });
    }

    const data = await resp.json();

    if (!data.PropertyAddress) {
      return res.status(404).json({ error: 'נכס לא נמצא' });
    }

    const addr = data.PropertyAddress;
    const fullAddress = [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', ');
    const zpid = data.PropertyZPID;

    // Fetch price history to get actual sale date + days on market
    let saleDate = null;
    let daysOnMarket = null;

    if (zpid) {
      try {
        const histResp = await fetch(`https://private-zillow.p.rapidapi.com/pricehistory?byzpid=${zpid}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': 'private-zillow.p.rapidapi.com',
            'x-rapidapi-key': apiKey
          },
          signal: AbortSignal.timeout(10000)
        });

        if (histResp.ok) {
          const histData = await histResp.json();
          const history = histData.priceHistory || [];

          // Find last "Sold" event and the "Listed for sale" before it
          const soldEvent = history.find(h => h.event === 'Sold');
          if (soldEvent) {
            saleDate = soldEvent.date; // e.g. "2026-01-22"

            // Find the listing event before the sold event
            const soldTime = soldEvent.time;
            const listingEvent = history.find(h =>
              (h.event === 'Listed for sale' || h.event === 'Listed (Active)') &&
              h.time < soldTime
            );
            if (listingEvent) {
              daysOnMarket = Math.round((soldTime - listingEvent.time) / (1000 * 60 * 60 * 24));
            }
          }
        }
      } catch (histErr) {
        console.error('Price history fetch error:', histErr.message);
      }
    }

    // Auto-create the comp
    const ppsf = (data.Price && data['Area(sqft)']) ? (data.Price / data['Area(sqft)']) : null;

    const latitude = data.latitude || data.Latitude || data.lat || null;
    const longitude = data.longitude || data.Longitude || data.lng || data.lon || null;

    const result = await pool.query(`
      INSERT INTO deal_comps (
        deal_id, zillow_url, address, sale_price, days_on_market, bedrooms, bathrooms,
        sqft, year_built, price_per_sqft, sale_date, latitude, longitude, data_source, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        (SELECT COALESCE(MAX(sort_order),0)+1 FROM deal_comps WHERE deal_id=$1))
      RETURNING *
    `, [
      dealId,
      data.PropertyZillowURL || (input.startsWith('http') ? input : null),
      fullAddress,
      data.Price || null,
      daysOnMarket,
      data.Bedrooms || null,
      data.Bathrooms || null,
      data['Area(sqft)'] || null,
      data.yearBuilt || null,
      ppsf,
      saleDate,
      latitude,
      longitude,
      'zillow_api'
    ]);

    await logAudit(req.user.id, 'create', 'comp', result.rows[0].id, { deal_id: dealId, source: 'zillow_api', address: fullAddress });

    res.json({ comp: result.rows[0] });
  } catch (err) {
    console.error('Zillow comp fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Comp: Auto search candidates (Top-N similar properties) ────
//
// Pulls similar + nearby properties from private-zillow RapidAPI
// (/similar returns FOR_SALE comps, /nearby returns Zestimate-based neighbors),
// merges, filters by the deal's specs (sqft / beds / baths / price ranges),
// scores by similarity, and returns the Top 5 candidates.
//
// This is a *search* only — the user selects which candidates to promote
// into real comps via the existing /comps/fetch-zillow endpoint.

router.post('/:dealId/comps/search-candidates', async (req, res) => {
  const { dealId } = req.params;

  try {
    // 1. Load deal + specs + existing comps
    const [dealRes, specsRes, compsRes] = await Promise.all([
      pool.query('SELECT * FROM deals WHERE id = $1', [dealId]),
      pool.query('SELECT * FROM deal_specs WHERE deal_id = $1', [dealId]),
      pool.query('SELECT zillow_url, address FROM deal_comps WHERE deal_id = $1', [dealId])
    ]);

    const deal = dealRes.rows[0];
    if (!deal) return res.status(404).json({ error: 'עסקה לא נמצאה' });

    const addressQuery = deal.full_address || deal.name;
    if (!addressQuery || addressQuery.length < 5) {
      return res.status(400).json({
        error: 'missing_address',
        message_he: 'חסרה כתובת מלאה לעסקה. הגדר את "כתובת מלאה" לפני החיפוש.'
      });
    }

    // Target specs from deal_specs (value_after for after-renovation target)
    let targetSqft = 0, targetBed = 0, targetBath = 0;
    for (const spec of specsRes.rows) {
      const name = (spec.spec_name || '').toLowerCase();
      const val = spec.value_after || spec.value_before || '';
      if (name.includes('שטח') || name.includes('sqft') || name.includes('square')) {
        targetSqft = parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
      }
      if (name.includes('חדרי שינה') || name.includes('bedroom') || name.includes('bed')) {
        targetBed = parseInt(val) || 0;
      }
      if (name.includes('חדרי רחצה') || name.includes('bathroom') || name.includes('bath')) {
        targetBath = parseFloat(val) || 0;
      }
    }
    const targetPrice = parseFloat(deal.arv || deal.expected_sale_price || deal.purchase_price || 0) || 0;

    // 2. Call both endpoints in parallel
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY לא מוגדר' });

    const RAPIDAPI_HOST = 'private-zillow.p.rapidapi.com';
    const encodedAddr = encodeURIComponent(addressQuery);
    const headers = {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': apiKey
    };
    const opts = { headers, signal: AbortSignal.timeout(20000) };

    let similarJson = null;
    let nearbyJson = null;
    let zillowBlocked = false;

    await Promise.all([
      fetch(`https://${RAPIDAPI_HOST}/similar?byaddress=${encodedAddr}`, opts)
        .then(r => {
          if (r.status === 429) { zillowBlocked = true; return null; }
          if (!r.ok) return null;
          return r.json();
        })
        .then(j => { similarJson = j; })
        .catch(() => { zillowBlocked = true; }),
      fetch(`https://${RAPIDAPI_HOST}/nearby?byaddress=${encodedAddr}`, opts)
        .then(r => {
          if (r.status === 429) { zillowBlocked = true; return null; }
          if (!r.ok) return null;
          return r.json();
        })
        .then(j => { nearbyJson = j; })
        .catch(() => {})
    ]);

    if (zillowBlocked && !similarJson && !nearbyJson) {
      return res.status(502).json({
        error: 'zillow_blocked',
        message_he: 'שירות החיפוש לא זמין כרגע. נסה שוב בעוד מספר דקות.'
      });
    }

    // 3. Merge + normalize candidates
    const raw = [
      ...((similarJson?.similar_properties?.propertyDetails) || []),
      ...((nearbyJson?.nearby_properties) || [])
    ];

    // Build a set of already-added zillow URLs (normalized) to exclude
    const existingSet = new Set();
    for (const c of compsRes.rows) {
      if (c.zillow_url) existingSet.add(String(c.zillow_url).split('?')[0]);
    }

    // Normalize candidates, dedupe by zpid, exclude existing
    const seenZpid = new Set();
    const candidates = [];
    for (const p of raw) {
      if (!p || !p.zpid) continue;
      if (seenZpid.has(p.zpid)) continue;
      seenZpid.add(p.zpid);

      const zillowUrl = p.hdpUrl ? `https://www.zillow.com${p.hdpUrl}` : null;
      if (zillowUrl && existingSet.has(zillowUrl.split('?')[0])) continue;

      const addrParts = [p.address?.streetAddress, p.address?.city, p.address?.state, p.address?.zipcode]
        .filter(Boolean);
      const fullAddr = addrParts.join(', ');

      // Skip candidate if it matches deal's own address (substring match)
      if (fullAddr && addressQuery && fullAddr.toLowerCase().includes(
        (deal.full_address || '').split(',')[0].toLowerCase().trim()
      ) && (deal.full_address || '').length > 5) {
        continue;
      }

      candidates.push({
        zpid: p.zpid,
        zillow_url: zillowUrl,
        address: fullAddr || null,
        sale_price: p.price || null,
        sqft: p.livingArea || null,
        bedrooms: p.bedrooms || null,
        bathrooms: p.bathrooms || null,
        home_status: p.homeStatus || null,
        home_type: p.homeType || null,
        thumbnail_url: p.miniCardPhotos?.[0]?.url || null,
        latitude: p.latitude || null,
        longitude: p.longitude || null,
      });
    }

    // 4. Filter by tolerance bands (only when we have target values to compare)
    const filtered = candidates.filter(c => {
      // sqft within ±25% (more lenient than 15% to ensure we get 5 results)
      if (targetSqft > 0 && c.sqft) {
        const ratio = c.sqft / targetSqft;
        if (ratio < 0.70 || ratio > 1.35) return false;
      }
      // bedrooms within ±1
      if (targetBed > 0 && c.bedrooms) {
        if (Math.abs(c.bedrooms - targetBed) > 1) return false;
      }
      // bathrooms within ±1
      if (targetBath > 0 && c.bathrooms) {
        if (Math.abs(c.bathrooms - targetBath) > 1) return false;
      }
      // price within ±30%
      if (targetPrice > 0 && c.sale_price) {
        const ratio = c.sale_price / targetPrice;
        if (ratio < 0.65 || ratio > 1.40) return false;
      }
      return true;
    });

    // 5. Score by weighted similarity (lower = better)
    function score(c) {
      let s = 0;
      if (targetSqft > 0 && c.sqft)     s += Math.pow((c.sqft - targetSqft) / targetSqft, 2) * 3;
      if (targetPrice > 0 && c.sale_price) s += Math.pow((c.sale_price - targetPrice) / targetPrice, 2) * 3;
      if (targetBed > 0 && c.bedrooms)  s += Math.pow(c.bedrooms - targetBed, 2) * 0.3;
      if (targetBath > 0 && c.bathrooms) s += Math.pow(c.bathrooms - targetBath, 2) * 0.3;
      // Slight bonus for RECENTLY_SOLD over FOR_SALE (rare but possible)
      if (c.home_status === 'RECENTLY_SOLD' || c.home_status === 'SOLD') s -= 0.5;
      return s;
    }
    filtered.sort((a, b) => score(a) - score(b));

    // Top 5: start with filter-passers; if fewer than 5, pad with next-best from unfiltered.
    // This ensures users always see something useful even when specs are unusual (e.g. $1.35M ARV in a $500K neighborhood).
    let results = filtered.slice(0, 5);
    if (results.length < 5) {
      const filteredSet = new Set(filtered.map(c => c.zpid));
      const extra = candidates
        .filter(c => !filteredSet.has(c.zpid))
        .sort((a, b) => score(a) - score(b))
        .slice(0, 5 - results.length);
      results = [...results, ...extra];
    }

    res.json({
      results,
      target: {
        address: addressQuery,
        sqft: targetSqft || null,
        bedrooms: targetBed || null,
        bathrooms: targetBath || null,
        price: targetPrice || null,
      },
      stats: {
        total_fetched: raw.length,
        after_dedupe: candidates.length,
        after_filter: filtered.length,
        returned: results.length,
      }
    });
  } catch (err) {
    console.error('Comp search-candidates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Comp: Geocode missing lat/lng ──────────────────────────

router.post('/:dealId/comps/geocode', async (req, res) => {
  const { dealId } = req.params;
  try {
    const compsRes = await pool.query(
      'SELECT id, address FROM deal_comps WHERE deal_id = $1 AND (latitude IS NULL OR longitude IS NULL) AND address IS NOT NULL',
      [dealId]
    );
    const comps = compsRes.rows;
    const updated = [];

    for (const comp of comps) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(comp.address)}&limit=1`;
        const geoResp = await fetch(url, { headers: { 'User-Agent': 'SafeCapital/1.0' } });
        const geoData = await geoResp.json();
        if (geoData[0]) {
          const lat = parseFloat(geoData[0].lat);
          const lng = parseFloat(geoData[0].lon);
          await pool.query('UPDATE deal_comps SET latitude = $1, longitude = $2 WHERE id = $3', [lat, lng, comp.id]);
          updated.push({ id: comp.id, lat, lng });
        }
        // Respect Nominatim rate limit
        await new Promise(r => setTimeout(r, 1100));
      } catch (e) {
        console.error('Geocode error for comp', comp.id, e.message);
      }
    }

    res.json({ updated: updated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Comp: AI Analysis ──────────────────────────────────────

router.post('/:dealId/comps/ai-analysis', async (req, res) => {
  const { dealId } = req.params;

  try {
    // Get deal + specs + comps
    const [dealRes, specsRes, compsRes] = await Promise.all([
      pool.query('SELECT * FROM deals WHERE id = $1', [dealId]),
      pool.query('SELECT * FROM deal_specs WHERE deal_id = $1', [dealId]),
      pool.query('SELECT * FROM deal_comps WHERE deal_id = $1 ORDER BY sort_order', [dealId])
    ]);

    const deal = dealRes.rows[0];
    if (!deal) return res.status(404).json({ error: 'עסקה לא נמצאה' });

    const comps = compsRes.rows;
    if (comps.length === 0) return res.status(400).json({ error: 'אין נכסים דומים להשוואה' });

    const specs = specsRes.rows;

    // Build context
    const ourPrice = deal.arv || deal.expected_sale_price || deal.purchase_price || 0;
    let ourSqft = 0, ourBed = 0, ourBath = 0;
    for (const spec of specs) {
      const name = (spec.spec_name || '').toLowerCase();
      const val = spec.value_after || spec.value_before || '';
      if (name.includes('שטח') || name.includes('sqft')) ourSqft = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
      if (name.includes('חדרי שינה') || name.includes('bedroom')) ourBed = parseInt(val) || 0;
      if (name.includes('חדרי רחצה') || name.includes('bathroom')) ourBath = parseFloat(val) || 0;
    }

    const prompt = `אתה מנתח נדל"ן. להלן נתונים על הנכס שלנו ונכסים דומים שנמכרו באזור. כתוב ניתוח בעברית (3-5 פסקאות) שמסביר:

1. האם מחיר המכירה הצפוי שלנו נתמך על ידי הנכסים הדומים?
2. מהם ההבדלים המהותיים בין הנכסים (גודל, מחיר למ"ר, גיל)?
3. מסקנה: האם ההשקעה מוצדקת מבחינת שוק?

דבר במילים, לא במספרים. הימנע מלחזור על כל המספרים - תן פרשנות.

=== הנכס שלנו ===
כתובת: ${deal.full_address || deal.name}
מחיר צפוי (ARV): $${ourPrice.toLocaleString()}
שטח: ${ourSqft} sqft
חדרי שינה: ${ourBed} | חדרי רחצה: ${ourBath}
${ourSqft > 0 ? `מחיר למ"ר: $${Math.round(ourPrice / ourSqft)}` : ''}

=== נכסים דומים ===
${comps.map((c, i) => `
Comp ${i + 1}: ${c.address || 'ללא כתובת'}
  מחיר: $${(c.sale_price || 0).toLocaleString()}
  שטח: ${c.sqft || '?'} sqft
  חדרים: ${c.bedrooms || '?'} שינה, ${c.bathrooms || '?'} רחצה
  שנת בנייה: ${c.year_built || '?'}
  ימים בשוק: ${c.days_on_market || '?'}
  ${c.price_per_sqft ? `$/sqft: $${Math.round(c.price_per_sqft)}` : ''}
`).join('\n')}`;

    // Call Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY לא מוגדר');

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'אתה מנתח נדל"ן מקצועי. ענה בעברית בלבד.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text().catch(() => '');
      throw new Error(`Claude API error (${claudeResp.status}): ${errText.substring(0, 200)}`);
    }

    const claudeData = await claudeResp.json();
    let analysis = '';
    if (claudeData.content) {
      for (const block of claudeData.content) {
        if (block.type === 'text') analysis += block.text;
      }
    }

    // Save to DB
    await pool.query('UPDATE deals SET comps_ai_analysis = $1 WHERE id = $2', [analysis, dealId]);

    res.json({ analysis });
  } catch (err) {
    console.error('Comps AI analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Comp Images ────────────────────────────────────────────

router.get('/:dealId/comps/:compId/images', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deal_comp_images WHERE comp_id = $1 ORDER BY is_primary DESC, sort_order',
      [req.params.compId]
    );
    res.json({ images: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const compImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', '..', 'public', 'uploads', req.params.dealId, 'comps');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `comp_${req.params.compId}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

router.post('/:dealId/comps/:compId/images/upload', compImageUpload.array('images', 20), async (req, res) => {
  const { compId, dealId } = req.params;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  try {
    // Check if comp has any images yet
    const existing = await pool.query('SELECT COUNT(*) FROM deal_comp_images WHERE comp_id=$1', [compId]);
    const hasExisting = parseInt(existing.rows[0].count) > 0;

    const saved = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const publicUrl = `/uploads/${dealId}/comps/${file.filename}`;
      const isPrimary = !hasExisting && i === 0; // First image is primary if none exist

      const result = await pool.query(
        `INSERT INTO deal_comp_images (comp_id, image_url, is_primary, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [compId, publicUrl, isPrimary, i]
      );
      saved.push(result.rows[0]);
    }

    res.json({ images: saved, count: saved.length });
  } catch (err) {
    console.error('Comp image upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/comps/:compId/images/:imageId/primary', async (req, res) => {
  const { compId, imageId } = req.params;
  try {
    await pool.query('UPDATE deal_comp_images SET is_primary = FALSE WHERE comp_id = $1', [compId]);
    await pool.query('UPDATE deal_comp_images SET is_primary = TRUE WHERE id = $1 AND comp_id = $2', [imageId, compId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/comps/:compId/images/:imageId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_comp_images WHERE id = $1 AND comp_id = $2', [req.params.imageId, req.params.compId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Documents ───────────────────────────────────────────────

router.get('/:dealId/documents', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deal_documents WHERE deal_id = $1 ORDER BY sort_order', [req.params.dealId]);
    res.json({ documents: result.rows });
  } catch (err) {
    console.error('List documents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:dealId/documents', async (req, res) => {
  const { title, file_url, file_type, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    const result = await pool.query(
      'INSERT INTO deal_documents (deal_id, title, file_url, file_type, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.params.dealId, title, file_url || null, file_type || 'pdf', sort_order || 0]
    );
    const newId = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'document', newId, { deal_id: req.params.dealId, title });
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Create document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:dealId/documents/:itemId', async (req, res) => {
  const { title, file_url, file_type, sort_order } = req.body;
  try {
    await pool.query(
      'UPDATE deal_documents SET title = COALESCE($1, title), file_url = COALESCE($2, file_url), file_type = COALESCE($3, file_type), sort_order = COALESCE($4, sort_order) WHERE id = $5 AND deal_id = $6',
      [title || null, file_url || null, file_type || null, sort_order !== undefined ? sort_order : null, req.params.itemId, req.params.dealId]
    );
    res.json({ message: 'Document updated' });
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:dealId/documents/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_documents WHERE id = $1 AND deal_id = $2', [req.params.itemId, req.params.dealId]);
    await logAudit(req.user.id, 'delete', 'document', req.params.itemId, { deal_id: req.params.dealId });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

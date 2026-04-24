/**
 * POST /api/deals/:slug/pdf — generate a deal report PDF
 *
 * This endpoint is currently slug-based (matches content/<slug>.json) to keep
 * the first iteration simple. A future iteration can accept a dealId, pull
 * content from the DB, and generate on the fly.
 */

const express = require('express');
const { generateDealReport } = require('../services/pdf-generator');

const router = express.Router();

// GET for easier testing — POST also accepted.
router.get('/:slug/pdf', handlePdf);
router.post('/:slug/pdf', handlePdf);

async function handlePdf(req, res) {
  const { slug } = req.params;
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  try {
    const pdf = await generateDealReport(slug);
    const filename = `safe-capital-deal-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
}

module.exports = router;

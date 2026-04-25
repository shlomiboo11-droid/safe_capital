/**
 * Cron endpoints — called by Vercel Cron on a fixed schedule.
 * Protected by CRON_SECRET shared header (set via Vercel env var).
 *
 * Vercel Cron automatically includes a Bearer token matching CRON_SECRET
 * in the Authorization header. In production we verify it here.
 */

const express = require('express');
const articleBot = require('../services/article-bot');

const router = express.Router();

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.VERCEL !== '1';  // local: allow; prod without secret: deny
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}`;
}

router.post('/articles-scan', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await articleBot.runScan({ triggeredByUserId: null, dryRun: false });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cron articles-scan error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Vercel Cron sends GET by default; support both.
router.get('/articles-scan', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await articleBot.runScan({ triggeredByUserId: null, dryRun: false });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cron articles-scan error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;

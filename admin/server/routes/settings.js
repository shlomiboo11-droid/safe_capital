const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();

// GET /api/settings — all settings (requires JWT)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value, label, category, field_type, updated_at FROM site_settings ORDER BY category, key'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Settings fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings — update settings (requires JWT, super_admin or manager)
router.put('/', authenticate, authorize('super_admin', 'manager'), async (req, res) => {
  const { settings } = req.body; // [{ key, value }, ...]

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ error: 'settings must be a non-empty array of { key, value }' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const changed = [];
    for (const { key, value } of settings) {
      if (typeof key !== 'string' || typeof value !== 'string') continue;

      const prev = await client.query('SELECT value FROM site_settings WHERE key = $1', [key]);
      const oldValue = prev.rows[0]?.value;

      if (oldValue === undefined) continue; // key doesn't exist, skip
      if (oldValue === value) continue;     // no change, skip

      await client.query(
        'UPDATE site_settings SET value = $1, updated_at = NOW() WHERE key = $2',
        [value, key]
      );
      changed.push({ key, from: oldValue, to: value });
    }

    await client.query('COMMIT');

    if (changed.length > 0) {
      await logAudit(req.user.id, 'update', 'site_settings', null, { changed });
    }

    res.json({ updated: changed.length, changes: changed });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

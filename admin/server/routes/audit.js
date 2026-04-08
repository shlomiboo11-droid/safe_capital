const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('super_admin'));

// GET /api/audit — query audit log
router.get('/', async (req, res) => {
  const { entity_type, entity_id, user_id, limit = 100, offset = 0 } = req.query;

  let sql = `
    SELECT al.*, u.full_name as user_name, u.email as user_email
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIdx = 1;

  if (entity_type) { sql += ` AND al.entity_type = $${paramIdx++}`; params.push(entity_type); }
  if (entity_id) { sql += ` AND al.entity_id = $${paramIdx++}`; params.push(entity_id); }
  if (user_id) { sql += ` AND al.user_id = $${paramIdx++}`; params.push(user_id); }

  sql += ` ORDER BY al.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
  params.push(parseInt(limit), parseInt(offset));

  try {
    const result = await pool.query(sql, params);
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Audit query error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

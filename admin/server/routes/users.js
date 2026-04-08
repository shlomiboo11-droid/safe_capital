const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();

// All routes require super_admin
router.use(authenticate, authorize('super_admin'));

// GET /api/users — list all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, role, full_name, phone, status, joined_at, created_at
      FROM users ORDER BY created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users — create new user
router.post('/', async (req, res) => {
  const { email, password, role, full_name, phone } = req.body;

  if (!email || !password || !role || !full_name) {
    return res.status(400).json({ error: 'email, password, role, and full_name are required' });
  }

  if (!['manager', 'investor'].includes(role)) {
    return res.status(400).json({ error: 'Role must be manager or investor' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(`
      INSERT INTO users (email, password_hash, role, full_name, phone, status, joined_at, created_by)
      VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_DATE, $6)
      RETURNING id
    `, [email, hash, role, full_name, phone || null, req.user.id]);

    const newId = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'user', newId, { email, role, full_name });

    res.status(201).json({ id: newId, message: 'User created' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id — update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, full_name, phone, status } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot change super_admin's role
    if (user.role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Cannot change super_admin role' });
    }

    await pool.query(`
      UPDATE users SET
        role = COALESCE($1, role),
        full_name = COALESCE($2, full_name),
        phone = COALESCE($3, phone),
        status = COALESCE($4, status),
        updated_at = NOW()
      WHERE id = $5
    `, [role || null, full_name || null, phone || null, status || null, id]);

    await logAudit(req.user.id, 'update', 'user', id, { role, full_name, status });

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/reset-password — reset password
router.post('/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);

    await logAudit(req.user.id, 'update', 'user', id, { action: 'password_reset' });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id — delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot delete super_admin' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await logAudit(req.user.id, 'delete', 'user', id, { email: user.email });

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

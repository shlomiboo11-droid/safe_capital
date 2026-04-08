const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generateToken, authenticate } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Only super_admin and manager can access admin dashboard (Phase 1)
    if (!['super_admin', 'manager'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const token = generateToken(user);

    await logAudit(user.id, 'login', 'user', user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me — verify token and return user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, full_name, status FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify-password — verify current user's password
router.post('/verify-password', authenticate, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 AND status = $2',
      [req.user.id, 'active']
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ valid: false, error: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    res.json({ valid });
  } catch (err) {
    console.error('Verify password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

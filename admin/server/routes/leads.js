/**
 * leads.js — ה-API של עמוד הלידים באדמין
 *
 * קורא מטבלת leads, שאליה מגיעים שני הטפסים של האתר
 * (ראה server/services/leads.js). דורש התחברות כמו כל שאר האדמין.
 *
 * ‏audit_log.entity_id הוא INTEGER וה-id של ליד הוא UUID, ולכן המזהה
 * נרשם בתוך details ולא בעמודה.
 */

const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

const KINDS = ['contact', 'waitlist'];

/* מזהה ליד הוא UUID. ערך אחר גורם ל-Postgres לזרוק 22P02, שהיה חוזר
   כ-500 — אבל "אין ליד כזה" היא התשובה הנכונה. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function badId(req, res) {
  if (UUID_RE.test(req.params.id)) return false;
  res.status(404).json({ error: 'Lead not found' });
  return true;
}
const STATUSES = ['new', 'read', 'contacted', 'qualified', 'archived'];

const COLUMNS = `id, kind, first_name, last_name, email, phone,
                 capital, liquid, wants_contact, message,
                 source, page_url, utm, raw, consent,
                 status, notes, email_sent_at, email_error, push_sent_at,
                 created_at, updated_at`;

/* ── GET /api/leads ────────────────────────────────────────────────────
   ‏?kind=contact|waitlist · ?status=… · ?q=חיפוש חופשי · ?limit&offset
   בלי kind מחזיר את שניהם, ממוינים חדש-לישן. */
router.get('/', async (req, res) => {
  try {
    const where = [];
    const params = [];

    if (KINDS.includes(req.query.kind)) {
      params.push(req.query.kind);
      where.push(`kind = $${params.length}`);
    }
    if (STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }
    const q = (req.query.q || '').trim();
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(first_name ILIKE $${i} OR last_name ILIKE $${i}
                   OR email ILIKE $${i} OR phone ILIKE $${i})`);
    }

    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [list, count] = await Promise.all([
      pool.query(
        `SELECT ${COLUMNS} FROM leads ${clause}
         ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM leads ${clause}`, params)
    ]);

    res.json({ leads: list.rows, total: count.rows[0].total, limit, offset });
  } catch (err) {
    console.error('Leads list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/leads/stats ──────────────────────────────────────────────
   מונים לכותרות ולתג שבתפריט. "לא נקרא" הוא status='new' — אין דגל שני
   שיכול להיפרד ממנו. */
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT kind,
              COUNT(*)::int                                   AS total,
              COUNT(*) FILTER (WHERE status = 'new')::int     AS unread,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS week
         FROM leads GROUP BY kind`
    );
    const out = {
      contact:  { total: 0, unread: 0, week: 0 },
      waitlist: { total: 0, unread: 0, week: 0 }
    };
    rows.forEach(r => { if (out[r.kind]) out[r.kind] = { total: r.total, unread: r.unread, week: r.week }; });
    out.unread = out.contact.unread + out.waitlist.unread;
    res.json(out);
  } catch (err) {
    console.error('Leads stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/leads/export.csv ─────────────────────────────────────────
   ‏BOM בראש הקובץ, אחרת אקסל פותח עברית כג'יבריש.
   כל תא שמתחיל ב-‏= + - @ מקבל גרש מוביל: אקסל מריץ תא כזה כנוסחה,
   וליד ששמו =HYPERLINK(...) הוא וקטור אמיתי. */
router.get('/export.csv', async (req, res) => {
  try {
    const params = [];
    let clause = '';
    if (KINDS.includes(req.query.kind)) {
      params.push(req.query.kind);
      clause = 'WHERE kind = $1';
    }
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM leads ${clause} ORDER BY created_at DESC`, params
    );

    const cell = v => {
      if (v == null) return '';
      let s = String(v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const head = ['סוג', 'שם', 'שם משפחה', 'אימייל', 'טלפון', 'הון משוער',
                  'נזילות', 'ליצור קשר', 'הודעה', 'מקור', 'סטטוס', 'הערות', 'נשלח מייל', 'תאריך'];
    const lines = [head.map(cell).join(',')];
    rows.forEach(r => lines.push([
      r.kind === 'waitlist' ? 'רשימת המתנה' : 'צור קשר',
      r.first_name, r.last_name, r.email, r.phone, r.capital, r.liquid,
      r.wants_contact, r.message, r.source, r.status, r.notes,
      r.email_sent_at ? 'כן' : 'לא',
      r.created_at ? new Date(r.created_at).toLocaleString('he-IL') : ''
    ].map(cell).join(',')));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + lines.join('\r\n'));
  } catch (err) {
    console.error('Leads export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── GET /api/leads/:id ─────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    if (badId(req, res)) return;
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM leads WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Lead fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── PATCH /api/leads/:id — סטטוס והערות ───────────────────────────── */
router.patch('/:id', async (req, res) => {
  try {
    if (badId(req, res)) return;
    const sets = [];
    const params = [];

    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'status must be one of: ' + STATUSES.join(', ') });
      }
      params.push(req.body.status);
      sets.push(`status = $${params.length}`);
    }
    if (req.body.notes !== undefined) {
      params.push(String(req.body.notes || '').slice(0, 4000) || null);
      sets.push(`notes = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE leads SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });

    await logAudit(req.user.id, 'update', 'lead', null,
      { id: req.params.id, status: req.body.status, notes: req.body.notes !== undefined });
    res.json(rows[0]);
  } catch (err) {
    console.error('Lead update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── DELETE /api/leads/:id ─────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    if (badId(req, res)) return;
    const { rows } = await pool.query(
      'DELETE FROM leads WHERE id = $1 RETURNING id, kind, email', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    await logAudit(req.user.id, 'delete', 'lead', null, rows[0]);
    res.json({ success: true });
  } catch (err) {
    console.error('Lead delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

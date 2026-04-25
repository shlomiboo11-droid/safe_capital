const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// ── Articles ─────────────────────────────────────────────────────────

// GET /api/content/articles — all articles (including drafts)
// Supports filters: ?status=pending&region=us (both optional, combinable)
router.get('/articles', async (req, res) => {
  try {
    const where = [];
    const params = [];
    let p = 1;
    if (req.query.status) { where.push(`status = $${p++}`); params.push(req.query.status); }
    if (req.query.region) { where.push(`region = $${p++}`); params.push(req.query.region); }
    const sql = `
      SELECT * FROM articles
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'published' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END,
        created_at DESC
    `;
    const result = await pool.query(sql, params);
    // Also return queue counts for UI badges
    const counts = await pool.query(`
      SELECT status, COUNT(*)::int AS c FROM articles
      WHERE status IN ('pending','approved','published','rejected')
      GROUP BY status
    `);
    const countMap = {};
    for (const r of counts.rows) countMap[r.status] = r.c;
    res.json({ articles: result.rows, counts: countMap });
  } catch (err) {
    console.error('List articles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/articles/:id/approve — approve and publish
router.put('/articles/:id/approve', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE articles
      SET status = 'published',
          is_published = true,
          publish_date = COALESCE(publish_date, NOW()),
          approved_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $1 AND status IN ('pending','approved','rejected','draft')
      RETURNING id, status
    `, [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    await logAudit(req.user.id, 'approve', 'article', null, { id: req.params.id });
    res.json({ message: 'Article approved and published', status: result.rows[0].status });
  } catch (err) {
    console.error('Approve article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/articles/:id/reject — reject with reason
router.put('/articles/:id/reject', async (req, res) => {
  try {
    const reason = (req.body && req.body.reason) || null;
    const result = await pool.query(`
      UPDATE articles
      SET status = 'rejected',
          is_published = false,
          rejected_reason = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [req.params.id, reason]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    await logAudit(req.user.id, 'reject', 'article', null, { id: req.params.id, reason });
    res.json({ message: 'Article rejected' });
  } catch (err) {
    console.error('Reject article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/articles/:id/unpublish — pull an already-published article
router.put('/articles/:id/unpublish', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE articles SET status = 'approved', is_published = false, updated_at = NOW()
      WHERE id = $1 RETURNING id
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    await logAudit(req.user.id, 'unpublish', 'article', null, { id: req.params.id });
    res.json({ message: 'Article unpublished' });
  } catch (err) {
    console.error('Unpublish article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/content/articles/:id — single article by ID
router.get('/articles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json({ article: result.rows[0] });
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/content/articles — create article
router.post('/articles', async (req, res) => {
  const {
    title, subtitle, slug, body, thumbnail_url, category,
    tags, is_published, is_featured, publish_date, author,
    seo_title, seo_description
  } = req.body;

  if (!title || !slug || !body) {
    return res.status(400).json({ error: 'title, slug, and body are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO articles (
        title, subtitle, slug, body, thumbnail_url, category,
        tags, is_published, is_featured, publish_date, author,
        seo_title, seo_description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [
      title, subtitle || null, slug, body, thumbnail_url || null,
      category || 'news', tags || null,
      is_published ? true : false, is_featured ? true : false,
      publish_date || null, author || 'צוות סייף קפיטל',
      seo_title || null, seo_description || null
    ]);

    const id = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'article', null, { id, title, slug });

    res.status(201).json({ id, message: 'Article created' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/articles/:id — update article
router.put('/articles/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Article not found' });

    const fields = [
      'title', 'subtitle', 'slug', 'body', 'thumbnail_url', 'category',
      'tags', 'is_published', 'is_featured', 'publish_date', 'author',
      'seo_title', 'seo_description',
      // bot/approval workflow columns
      'source_url', 'source_name', 'source_published_at', 'region',
      'summary_he', 'status', 'rejected_reason'
    ];

    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        const val = req.body[field];
        if (['is_published', 'is_featured'].includes(field)) {
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

    await pool.query(`UPDATE articles SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    await logAudit(req.user.id, 'update', 'article', null, { id, ...req.body });

    res.json({ message: 'Article updated' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/content/articles/:id — delete article
router.delete('/articles/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Article not found' });

    await pool.query('DELETE FROM articles WHERE id = $1', [id]);
    await logAudit(req.user.id, 'delete', 'article', null, { id, title: existing.rows[0].title });

    res.json({ message: 'Article deleted' });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Articles Bot ─────────────────────────────────────────────────────

// GET /api/content/bot-settings
router.get('/bot-settings', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM article_bot_settings WHERE id = 1');
    res.json({ settings: r.rows[0] });
  } catch (err) {
    console.error('Get bot settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/bot-settings
router.put('/bot-settings', async (req, res) => {
  try {
    const { enabled, frequency_cron, allowed_sources, regions } = req.body || {};
    const updates = [];
    const values = [];
    let p = 1;
    if (enabled !== undefined) { updates.push(`enabled = $${p++}`); values.push(!!enabled); }
    if (frequency_cron !== undefined) { updates.push(`frequency_cron = $${p++}`); values.push(frequency_cron || null); }
    if (Array.isArray(allowed_sources)) { updates.push(`allowed_sources = $${p++}`); values.push(allowed_sources); }
    if (Array.isArray(regions)) { updates.push(`regions = $${p++}`); values.push(regions); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    await pool.query(`UPDATE article_bot_settings SET ${updates.join(', ')} WHERE id = 1`, values);
    await logAudit(req.user.id, 'update', 'article_bot_settings', null, req.body);
    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Update bot settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/content/articles/generate — manual trigger of the bot
// Body: { dry_run?: boolean }
router.post('/articles/generate', async (req, res) => {
  const articleBot = require('../services/article-bot');
  try {
    const result = await articleBot.runScan({
      triggeredByUserId: req.user.id,
      dryRun: req.body && req.body.dry_run === true
    });
    await logAudit(req.user.id, 'generate', 'articles_bot', null, result);
    res.json(result);
  } catch (err) {
    console.error('Generate articles error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── Weekly Briefings ─────────────────────────────────────────────────

// GET /api/content/briefings — all briefings
router.get('/briefings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM weekly_briefing
      ORDER BY week_start DESC
    `);
    res.json({ briefings: result.rows });
  } catch (err) {
    console.error('List briefings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/content/briefings/:id — single briefing
router.get('/briefings/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM weekly_briefing WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Briefing not found' });
    res.json({ briefing: result.rows[0] });
  } catch (err) {
    console.error('Get briefing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/content/briefings — create briefing
router.post('/briefings', async (req, res) => {
  const { week_start, body, is_published } = req.body;

  if (!week_start || !body) {
    return res.status(400).json({ error: 'week_start and body are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO weekly_briefing (week_start, body, is_published)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [week_start, body, is_published ? true : false]);

    const id = result.rows[0].id;
    await logAudit(req.user.id, 'create', 'briefing', null, { id, week_start });

    res.status(201).json({ id, message: 'Briefing created' });
  } catch (err) {
    console.error('Create briefing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/briefings/:id — update briefing
router.put('/briefings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM weekly_briefing WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Briefing not found' });

    const fields = ['week_start', 'body', 'is_published'];
    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        const val = req.body[field];
        if (field === 'is_published') {
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

    await pool.query(`UPDATE weekly_briefing SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    await logAudit(req.user.id, 'update', 'briefing', null, { id, ...req.body });

    res.json({ message: 'Briefing updated' });
  } catch (err) {
    console.error('Update briefing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/content/briefings/:id — delete briefing
router.delete('/briefings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM weekly_briefing WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Briefing not found' });

    await pool.query('DELETE FROM weekly_briefing WHERE id = $1', [id]);
    await logAudit(req.user.id, 'delete', 'briefing', null, { id, week_start: existing.rows[0].week_start });

    res.json({ message: 'Briefing deleted' });
  } catch (err) {
    console.error('Delete briefing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Static Pages ─────────────────────────────────────────────────────

// GET /api/content/static-pages — all static pages
router.get('/static-pages', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM static_pages
      ORDER BY slug ASC
    `);
    res.json({ pages: result.rows });
  } catch (err) {
    console.error('List static pages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/content/static-pages/:slug — single page by slug
router.get('/static-pages/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM static_pages WHERE slug = $1', [req.params.slug]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Page not found' });
    res.json({ page: result.rows[0] });
  } catch (err) {
    console.error('Get static page error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/static-pages/:slug — update page (upsert)
router.put('/static-pages/:slug', async (req, res) => {
  const { slug } = req.params;
  const { title, body, seo_title, seo_description } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO static_pages (slug, title, body, seo_title, seo_description, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        updated_at = NOW()
      RETURNING id
    `, [slug, title, body, seo_title || null, seo_description || null]);

    const id = result.rows[0].id;
    await logAudit(req.user.id, 'update', 'static_page', null, { id, slug, title });

    res.json({ id, message: 'Page updated' });
  } catch (err) {
    console.error('Update static page error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Agent Prompts ────────────────────────────────────────────────────

// GET /api/content/agent-prompts — all prompts
router.get('/agent-prompts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM content_agent_prompts
      ORDER BY agent_name ASC
    `);
    res.json({ prompts: result.rows });
  } catch (err) {
    console.error('List agent prompts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/content/agent-prompts/:agent_name — update prompt (upsert)
router.put('/agent-prompts/:agent_name', async (req, res) => {
  const { agent_name } = req.params;
  const { display_name, prompt, description } = req.body;

  if (!display_name || !prompt) {
    return res.status(400).json({ error: 'display_name and prompt are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO content_agent_prompts (agent_name, display_name, prompt, description, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (agent_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        prompt = EXCLUDED.prompt,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING id
    `, [agent_name, display_name, prompt, description || null]);

    const id = result.rows[0].id;
    await logAudit(req.user.id, 'update', 'agent_prompt', null, { id, agent_name, display_name });

    res.json({ id, message: 'Prompt updated' });
  } catch (err) {
    console.error('Update agent prompt error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

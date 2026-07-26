const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const researchProvider = require('../services/whatsapp/claude-research-provider');
const writingService = require('../services/whatsapp/writing-service');
const driveSync = require('../services/whatsapp/drive-sync');
const sseBus = require('../services/whatsapp/sse-bus');

// ── Startup cleanup ─────────────────────────────────────────────────
// Research runners live in-memory only. If the Node process died (crash,
// restart, deploy), any session left in 'researching' status is orphaned —
// no runner is actually working on it. Mark them as 'research_review' on
// boot so the UI can recover instead of spinning forever.
(async () => {
  try {
    const r = await pool.query(
      `UPDATE whatsapp_sessions
         SET status = 'research_review',
             updated_at = NOW()
       WHERE status = 'researching'
       RETURNING id`
    );
    console.log(`[whatsapp] Startup cleanup: reclaimed ${r.rowCount} orphaned 'researching' sessions.`);
  } catch (e) {
    console.warn('[whatsapp] Startup cleanup failed:', e.message);
  }
})();

const router = express.Router();
// Note: SSE stream uses query-param auth (EventSource can't set headers).
// The /sessions/:id/stream route registers its own auth path below.
router.use(authenticate, authorize('super_admin', 'manager'));

// POST /api/whatsapp/sessions — create a new session from Onboarding payload.
// Phase 1: only research-stage inputs are collected here.
// Writing-stage settings (length_pref, formality, update_type) are set later,
// after the research is reviewed. They keep their DB defaults until then.
router.post('/sessions', async (req, res) => {
  try {
    const {
      topic_brief,
      auto_topic,
      research_depth,
      title
    } = req.body || {};

    // Title: short generic stamp. The topic itself is shown as the first chat
    // message, not as the title — so the topbar stays readable regardless of
    // how long the user's brief is. A smarter title can be suggested later by
    // the bot in Phase 2.
    const dateStr = new Date().toLocaleDateString('he-IL');
    const computedTitle = title || ('סשן · ' + dateStr);

    // Seed the chat with the user's brief (or a placeholder for auto-topic)
    // so it's visible as a message in the conversation.
    const seedMessages = [];
    if (auto_topic) {
      seedMessages.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        role: 'user',
        content: 'תבחר נושא בעצמך — משהו מעניין מהשבוע האחרון שרלוונטי למשקיעי Safe Capital.',
        created_at: new Date().toISOString()
      });
    } else if (topic_brief && topic_brief.trim()) {
      seedMessages.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        role: 'user',
        content: topic_brief.trim(),
        created_at: new Date().toISOString()
      });
    }

    const result = await pool.query(
      `INSERT INTO whatsapp_sessions
         (user_id, title, topic_brief, research_depth, status, messages)
       VALUES ($1, $2, $3, $4, 'onboarding', $5::jsonb)
       RETURNING *`,
      [
        req.user.id,
        computedTitle,
        auto_topic ? null : (topic_brief || null),
        research_depth || 'normal',
        JSON.stringify(seedMessages)
      ]
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Create whatsapp session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/whatsapp/sessions — list sessions for current user
router.get('/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, status, update_type, deal_id, length_pref,
              research_depth, created_at, updated_at
       FROM whatsapp_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS c
       FROM whatsapp_sessions
       WHERE user_id = $1
       GROUP BY status`,
      [req.user.id]
    );

    const countMap = {};
    for (const r of counts.rows) countMap[r.status] = r.c;

    res.json({ sessions: result.rows, counts: countMap });
  } catch (err) {
    console.error('List whatsapp sessions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/whatsapp/sessions/:id — full session with findings + drafts
router.get('/sessions/:id', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT * FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const findingsRes = await pool.query(
      `SELECT * FROM whatsapp_research_findings
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    const draftsRes = await pool.query(
      `SELECT id, kind, length_pref, edit_reason, tokens_used, parent_id, created_at
       FROM whatsapp_drafts
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({
      session: sessionRes.rows[0],
      findings: findingsRes.rows,
      drafts: draftsRes.rows
    });
  } catch (err) {
    console.error('Get whatsapp session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/whatsapp/sessions/:id — partial update of allowed fields
router.patch('/sessions/:id', async (req, res) => {
  try {
    const allowed = [
      'title', 'status', 'update_type', 'deal_id', 'communication_goal',
      'length_pref', 'formality', 'research_depth', 'topic_brief',
      'editorial_angle', 'editorial_points', 'editorial_takeaway',
      'focus_notes',
      'messages', 'research_summary', 'final_post', 'alternative_posts',
      'is_template'
    ];

    const sets = [];
    const params = [];
    let p = 1;

    for (const key of allowed) {
      if (key in req.body) {
        sets.push(`${key} = $${p++}`);
        // JSONB fields need stringify
        if (key === 'messages' || key === 'alternative_posts') {
          params.push(JSON.stringify(req.body[key]));
        } else {
          params.push(req.body[key]);
        }
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE whatsapp_sessions SET ${sets.join(', ')}
       WHERE id = $${p}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error('Update whatsapp session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/duplicate — clone settings only (not findings/drafts)
router.post('/sessions/:id/duplicate', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM whatsapp_sessions WHERE id = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const s = r.rows[0];
    const dateStr = new Date().toLocaleDateString('he-IL');
    const newTitle = (s.title || 'סשן') + ' · עותק ' + dateStr;
    const ins = await pool.query(
      `INSERT INTO whatsapp_sessions
         (user_id, title, topic_brief, research_depth, length_pref, formality,
          editorial_angle, editorial_points, editorial_takeaway,
          status, messages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'onboarding','[]'::jsonb)
       RETURNING *`,
      [
        req.user.id,
        newTitle,
        s.topic_brief,
        s.research_depth,
        s.length_pref,
        s.formality,
        s.editorial_angle,
        s.editorial_points,
        s.editorial_takeaway
      ]
    );
    res.json({ session: ins.rows[0] });
  } catch (err) {
    console.error('Duplicate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/whatsapp/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM whatsapp_sessions WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete whatsapp session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/messages — append a message to the chat log
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const { role, content } = req.body || {};
    if (!role || !content) {
      return res.status(400).json({ error: 'role and content are required' });
    }
    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      role,
      content,
      created_at: new Date().toISOString()
    };

    const result = await pool.query(
      `UPDATE whatsapp_sessions
         SET messages = COALESCE(messages, '[]'::jsonb) || $1::jsonb,
             updated_at = NOW()
       WHERE id = $2
       RETURNING messages`,
      [JSON.stringify([message]), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // The Phase 1 echo bot was removed once Phase 2+ replaced it with real
    // research/writing flows. Free-form chat messages during research are
    // saved but produce no auto-response — the bot's activity is reflected
    // in the research panel and the dedicated bubbles (queries, summary,
    // post drafts).
    res.json({ message });
  } catch (err) {
    console.error('Append whatsapp message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Auto-topic preliminary flow ─────────────────────────────────────

// POST /api/whatsapp/sessions/:id/discover-topics
// Search the web for hot topics, save to session.discovered_topics, return.
router.post('/sessions/:id/discover-topics', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT id, research_depth FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];
    const { topics, usage, cost } = await researchProvider.discoverTopics(session);

    await pool.query(
      `UPDATE whatsapp_sessions
         SET discovered_topics = $1::jsonb,
             estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
             tokens_used = COALESCE(tokens_used, 0) + $3,
             updated_at = NOW()
       WHERE id = $4`,
      [
        JSON.stringify(topics),
        cost,
        (usage.input_tokens || 0) + (usage.output_tokens || 0),
        session.id
      ]
    );

    res.json({ topics, cost });
  } catch (err) {
    console.error('Discover topics error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/select-topic
// Body: { topic_id, focus_notes? } OR { custom_topic, focus_notes? }
// Sets topic_brief from discovered_topics or from a custom user-provided title,
// stores focus_notes, AND appends a user message to the chat showing what
// the user picked (mimics how it appeared in the topic-discovery card).
// The next step (propose queries) is driven by the client.
router.post('/sessions/:id/select-topic', async (req, res) => {
  try {
    const { topic_id, custom_topic, focus_notes } = req.body || {};
    const r = await pool.query(`SELECT * FROM whatsapp_sessions WHERE id = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = r.rows[0];

    let topicTitle = String(custom_topic || '').trim();
    let chosenCard = null;     // for building the chat message
    if (!topicTitle && topic_id) {
      const list = Array.isArray(session.discovered_topics) ? session.discovered_topics : [];
      const found = list.find(t => t.id === topic_id);
      if (!found) return res.status(400).json({ error: 'Unknown topic_id' });
      chosenCard = found;
      // Use title + description as the topic brief so the bot has full context
      // when it later proposes queries.
      topicTitle = found.title + (found.description ? '\n\n' + found.description : '');
    }
    if (!topicTitle) return res.status(400).json({ error: 'topic_id or custom_topic is required' });

    // Build a user message that mirrors the topic card the user picked, plus
    // their focus notes if they typed any. This makes the chat feel like a
    // real conversation: "I want to research X" then bot responds with queries.
    const trimmedFocus = String(focus_notes || '').trim();
    const msgLines = [];
    if (chosenCard) {
      msgLines.push(chosenCard.title);
      if (chosenCard.description) msgLines.push(chosenCard.description);
    } else {
      msgLines.push(topicTitle);
    }
    if (trimmedFocus) {
      msgLines.push('');
      msgLines.push('🎯 התמקדויות שביקשתי:');
      msgLines.push(trimmedFocus);
    }
    const newMessage = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      role: 'user',
      content: msgLines.join('\n'),
      created_at: new Date().toISOString()
    };

    const upd = await pool.query(
      `UPDATE whatsapp_sessions
         SET topic_brief = $1,
             focus_notes = $2,
             proposed_queries = '[]'::jsonb,
             messages = COALESCE(messages, '[]'::jsonb) || $3::jsonb,
             updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [topicTitle, trimmedFocus || null, JSON.stringify([newMessage]), req.params.id]
    );

    res.json({ session: upd.rows[0] });
  } catch (err) {
    console.error('Select topic error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Phase 2: Research stage ─────────────────────────────────────────

// POST /api/whatsapp/sessions/:id/topic
// Ask Claude to propose research queries based on session.topic_brief.
// Saves them to session.proposed_queries and returns them.
router.post('/sessions/:id/topic', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT id, topic_brief FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    const { title, queries, usage, cost } = await researchProvider.proposeQueries(session);

    // Update the session title only if Claude returned a non-empty one.
    // The existing title (auto-generated 'סשן · date') stays as a safe fallback.
    if (title && title.length >= 2) {
      await pool.query(
        `UPDATE whatsapp_sessions
           SET title = $1,
               proposed_queries = $2::jsonb,
               estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $3,
               tokens_used = COALESCE(tokens_used, 0) + $4,
               updated_at = NOW()
         WHERE id = $5`,
        [
          title,
          JSON.stringify(queries),
          cost,
          (usage.input_tokens || 0) + (usage.output_tokens || 0),
          session.id
        ]
      );
    } else {
      await pool.query(
        `UPDATE whatsapp_sessions
           SET proposed_queries = $1::jsonb,
               estimated_cost_usd = COALESCE(estimated_cost_usd, 0) + $2,
               tokens_used = COALESCE(tokens_used, 0) + $3,
               updated_at = NOW()
         WHERE id = $4`,
        [
          JSON.stringify(queries),
          cost,
          (usage.input_tokens || 0) + (usage.output_tokens || 0),
          session.id
        ]
      );
    }

    res.json({ title, queries, cost });
  } catch (err) {
    console.error('Propose queries error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/queries
// Save the user's edited/selected query list (overwrites proposed_queries).
router.post('/sessions/:id/queries', async (req, res) => {
  try {
    const { queries } = req.body || {};
    if (!Array.isArray(queries)) {
      return res.status(400).json({ error: 'queries (array) is required' });
    }

    const sanitized = queries.map((q, i) => ({
      id: String(q.id || ('q' + (i + 1))).slice(0, 16),
      text: String(q.text || '').trim().slice(0, 500),
      lang: (q.lang === 'he' || q.lang === 'en') ? q.lang : 'en',
      rationale: String(q.rationale || '').trim().slice(0, 500),
      enabled: q.enabled !== false
    })).filter(q => q.text);

    const result = await pool.query(
      `UPDATE whatsapp_sessions
         SET proposed_queries = $1::jsonb,
             updated_at = NOW()
       WHERE id = $2
       RETURNING id, proposed_queries`,
      [JSON.stringify(sanitized), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ queries: result.rows[0].proposed_queries });
  } catch (err) {
    console.error('Save queries error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/research/start
// Kick off research execution in the background. Client opens /stream to follow.
router.post('/sessions/:id/research/start', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT * FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];
    const queries = Array.isArray(session.proposed_queries) ? session.proposed_queries : [];
    if (queries.filter(q => q.enabled !== false).length === 0) {
      return res.status(400).json({ error: 'No enabled queries to run' });
    }

    // Mark as researching immediately so the UI updates.
    await pool.query(
      `UPDATE whatsapp_sessions SET status = 'researching', updated_at = NOW() WHERE id = $1`,
      [session.id]
    );

    // Respond fast — research runs async in this process.
    res.json({ ok: true, stream_url: `/api/whatsapp/sessions/${session.id}/stream` });

    // Fire-and-forget. Errors go to SSE.
    runResearchAsync(session, queries).catch(err => {
      console.error('Research run crashed:', err);
      sseBus.publish(session.id, 'error', { message: err.message || 'Research failed', recoverable: false });
      sseBus.publish(session.id, 'done', { reason: 'error' });
    });
  } catch (err) {
    console.error('Start research error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function runResearchAsync(session, queries) {
  try {
    await researchProvider.executeResearch(session, queries, session.research_depth);
    // Auto-summarize after all queries finished.
    sseBus.publish(session.id, 'summarizing', {});
    const { summary, draft_id, cost } = await researchProvider.summarizeResearch(session);
    sseBus.publish(session.id, 'summary_ready', { draft_id, content: summary, cost });
    sseBus.publish(session.id, 'done', { reason: 'completed' });
  } catch (err) {
    sseBus.publish(session.id, 'error', { message: err.message, recoverable: false });
    sseBus.publish(session.id, 'done', { reason: 'error' });
  }
}

// GET /api/whatsapp/sessions/:id/stream
// SSE channel. Auth via ?token=<jwt> because EventSource can't set headers.
// We register this OUTSIDE the router-level authenticate middleware below.

// POST /api/whatsapp/sessions/:id/research/stop
// Mark research as stopped early. The async runner detects this via the
// session.status row and exits cleanly. Then we summarize what we have.
const activeRuns = new Map(); // sessionId -> abort flag (in-process only)
router.post('/sessions/:id/research/stop', async (req, res) => {
  try {
    activeRuns.set(req.params.id, true);
    await pool.query(
      `UPDATE whatsapp_sessions SET status = 'research_review', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    sseBus.publish(req.params.id, 'stopped', { reason: 'user_requested' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Stop research error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/whatsapp/sessions/:id/research/edit-selection
// Phase 3 — apply a targeted edit to a portion of the research summary.
// Body: { selection_text, action, instruction? }
// Returns: { old_text, new_text, full_summary, draft_id, cost }
router.post('/sessions/:id/research/edit-selection', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT * FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];
    const result = await researchProvider.reviseSelection(session, req.body || {});
    res.json(result);
  } catch (err) {
    console.error('Edit selection error:', err);
    res.status(400).json({ error: err.message || 'Edit failed' });
  }
});

// POST /api/whatsapp/sessions/:id/research/manual-edit
// Phase 3 — overwrite the full research summary with user-edited text.
router.post('/sessions/:id/research/manual-edit', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT id FROM whatsapp_sessions WHERE id = $1`,
      [req.params.id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const result = await researchProvider.manualEditSummary(
      { id: req.params.id },
      String(req.body?.content || '')
    );
    res.json(result);
  } catch (err) {
    console.error('Manual edit error:', err);
    res.status(400).json({ error: err.message || 'Manual edit failed' });
  }
});

// POST /api/whatsapp/sessions/:id/research/accept
// Confirm the research summary and advance status to 'writing'.
router.post('/sessions/:id/research/accept', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE whatsapp_sessions
         SET status = 'writing', updated_at = NOW()
       WHERE id = $1 AND status IN ('research_review', 'researching')
       RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or not ready' });
    }
    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error('Accept research error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Phase 4: Writing stage ──────────────────────────────────────────

async function loadSession(req, res) {
  const r = await pool.query(`SELECT * FROM whatsapp_sessions WHERE id = $1`, [req.params.id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  return r.rows[0];
}

// POST /sessions/:id/write — generate the first post draft.
router.post('/sessions/:id/write', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const length = req.body?.length_pref || session.length_pref || 'medium';
    const result = await writingService.generatePost(session, length);
    res.json(result);
  } catch (err) {
    console.error('Write error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/write/alternative — generate an alternative variant.
router.post('/sessions/:id/write/alternative', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const length = req.body?.length_pref || session.length_pref || 'medium';
    const result = await writingService.generateAlternative(session, length);
    res.json(result);
  } catch (err) {
    console.error('Write-alternative error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/write/quick-action — apply shorten/cta/emoji/etc.
router.post('/sessions/:id/write/quick-action', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const { draft_id, action } = req.body || {};
    if (!draft_id || !action) {
      return res.status(400).json({ error: 'draft_id and action required' });
    }
    const result = await writingService.applyQuickAction(session, draft_id, action);
    res.json(result);
  } catch (err) {
    console.error('Quick-action error:', err);
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/write/edit-selection — point-edit on a post draft.
router.post('/sessions/:id/write/edit-selection', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const { draft_id, ...rest } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
    const result = await writingService.reviseSelection(session, draft_id, rest);
    res.json(result);
  } catch (err) {
    console.error('Write edit-selection error:', err);
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/write/manual-edit — save manually-edited post text.
router.post('/sessions/:id/write/manual-edit', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const { draft_id, content } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
    const result = await writingService.manualEditPost(session, draft_id, content);
    res.json(result);
  } catch (err) {
    console.error('Write manual-edit error:', err);
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/finalize — lock the final post.
router.post('/sessions/:id/finalize', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const { draft_id } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
    const result = await writingService.finalizePost(session, draft_id);
    res.json(result);
  } catch (err) {
    console.error('Finalize error:', err);
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

// POST /sessions/:id/drive/sync — manually sync this session to Google Drive.
router.post('/sessions/:id/drive/sync', async (req, res) => {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    const result = await driveSync.syncSession(session);
    res.json(result);
  } catch (err) {
    console.error('Drive sync error:', err);
    res.status(500).json({ error: err.message || 'Drive sync failed' });
  }
});

// GET /sessions/:id/drafts — list all post drafts (latest first).
router.get('/sessions/:id/drafts', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, kind, length_pref, content, parent_id, edit_reason, created_at
       FROM whatsapp_drafts
       WHERE session_id = $1 AND kind IN ('post', 'alternative')
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json({ drafts: r.rows });
  } catch (err) {
    console.error('List drafts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// ── SSE stream (registered separately to allow query-param auth) ────
// Exposed via main server.js with its own router-level setup.
const jwt = require('jsonwebtoken');
const sseRouter = express.Router();
sseRouter.get('/sessions/:id/stream', async (req, res) => {
  // EventSource can't set Authorization header, so accept ?token=
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!['super_admin', 'manager'].includes(payload.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const lastEventId = req.headers['last-event-id'] || req.query.lastEventId;
  sseBus.attach(req.params.id, res, { lastEventId });
});

module.exports.sseRouter = sseRouter;

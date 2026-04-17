/**
 * Google Drive Integration (v2 — single account)
 *
 * One-time OAuth to connect Google account (stored system-wide).
 * Then each category just needs a folder ID — no re-authentication.
 *
 * Routes:
 *   GET  /auth              → redirect to Google OAuth (one-time setup)
 *   GET  /callback           → exchange code, save tokens globally
 *   GET  /status             → check if Google account is connected
 *   POST /link               → link folder ID to deal+category
 *   POST /sync/:dealId/:cat  → pull images from linked folder
 *   GET  /folders/:dealId    → list linked folders for a deal
 *   DELETE /link/:dealId/:cat → unlink folder
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// ── OAuth2 client ────────────────────────────────────────────────────────────

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ── DB setup ─────────────────────────────────────────────────────────────────

async function ensureTables() {
  await pool.query(`
    -- System-wide Google tokens (single row)
    CREATE TABLE IF NOT EXISTS google_drive_tokens (
      id              SERIAL PRIMARY KEY,
      account_email   TEXT,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_expiry    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    -- Folder links per deal+category (no tokens here — uses global tokens)
    CREATE TABLE IF NOT EXISTS deal_drive_folders (
      id              SERIAL PRIMARY KEY,
      deal_id         INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      category        TEXT NOT NULL,
      folder_id       TEXT NOT NULL,
      folder_name     TEXT,
      last_synced     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(deal_id, category)
    )
  `);
}

ensureTables().catch(err => console.error('Drive tables error:', err.message));

// ── Helper: get stored tokens ────────────────────────────────────────────────

async function getStoredTokens() {
  const result = await pool.query('SELECT * FROM google_drive_tokens ORDER BY id DESC LIMIT 1');
  return result.rows[0] || null;
}

async function getAuthenticatedDrive() {
  const stored = await getStoredTokens();
  if (!stored) throw new Error('Google Drive לא מחובר. יש להתחבר דרך ההגדרות.');

  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.token_expiry ? new Date(stored.token_expiry).getTime() : null
  });

  // Auto-refresh tokens and save back
  oauth2Client.on('tokens', async (tokens) => {
    await pool.query(
      'UPDATE google_drive_tokens SET access_token=$1, token_expiry=$2, updated_at=NOW() WHERE id=$3',
      [tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, stored.id]
    );
  });

  // Test that refresh token is still valid
  try {
    await oauth2Client.getAccessToken();
  } catch (refreshErr) {
    if (refreshErr.message && refreshErr.message.includes('invalid_grant')) {
      // Token expired — clear it from DB so status shows disconnected
      await pool.query('DELETE FROM google_drive_tokens WHERE id=$1', [stored.id]);
      throw new Error('invalid_grant: חיבור Google Drive פג תוקף. יש להתחבר מחדש.');
    }
    throw refreshErr;
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ── One-time OAuth ───────────────────────────────────────────────────────────

// GET /api/google-drive/auth?token=JWT
router.get('/auth', (req, res) => {
  const { token } = req.query;
  const jwt = require('jsonwebtoken');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const oauth2Client = makeOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
    state: token  // pass JWT so we can redirect back to correct page
  });

  res.redirect(url);
});

// GET /api/google-drive/callback
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?driveError=auth_denied');
  }

  try {
    const oauth2Client = makeOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get account email
    oauth2Client.setCredentials(tokens);
    let email = null;
    try {
      const about = await google.drive({ version: 'v3', auth: oauth2Client }).about.get({ fields: 'user' });
      email = about.data.user.emailAddress;
    } catch { /* ok, email is optional */ }

    // Upsert — delete old tokens and insert new
    await pool.query('DELETE FROM google_drive_tokens');
    await pool.query(
      `INSERT INTO google_drive_tokens (account_email, access_token, refresh_token, token_expiry)
       VALUES ($1, $2, $3, $4)`,
      [email, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
    );

    // Also migrate any existing deal_drive_folders that had per-folder tokens
    // (drop old token columns if they exist)
    try {
      await pool.query('ALTER TABLE deal_drive_folders DROP COLUMN IF EXISTS access_token');
      await pool.query('ALTER TABLE deal_drive_folders DROP COLUMN IF EXISTS refresh_token');
      await pool.query('ALTER TABLE deal_drive_folders DROP COLUMN IF EXISTS token_expiry');
    } catch { /* columns may not exist */ }

    res.redirect('/?driveConnected=true');
  } catch (err) {
    console.error('Drive callback error:', err.message);
    res.redirect('/?driveError=' + encodeURIComponent(err.message));
  }
});

// ── Status ───────────────────────────────────────────────────────────────────

// GET /api/google-drive/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const stored = await getStoredTokens();
    if (!stored) return res.json({ connected: false });
    res.json({
      connected: true,
      email: stored.account_email,
      connectedAt: stored.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disconnect ───────────────────────────────────────────────────────────────

// DELETE /api/google-drive/disconnect
router.delete('/disconnect', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM google_drive_tokens');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Link folder ──────────────────────────────────────────────────────────────

// POST /api/google-drive/link  { dealId, category, folderId }
router.post('/link', authenticate, async (req, res) => {
  const { dealId, category, folderId } = req.body;
  if (!dealId || !category || !folderId) {
    return res.status(400).json({ error: 'dealId, category, folderId required' });
  }

  try {
    let drive;
    try {
      drive = await getAuthenticatedDrive();
    } catch (authErr) {
      if (authErr.message && authErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
      }
      throw authErr;
    }

    // Get folder name from Drive
    let folderName = folderId;
    try {
      const meta = await drive.files.get({ fileId: folderId, fields: 'name' });
      folderName = meta.data.name;
    } catch (metaErr) {
      if (metaErr.message && metaErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
      }
      /* use folderId as fallback name */
    }

    await pool.query(`
      INSERT INTO deal_drive_folders (deal_id, category, folder_id, folder_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (deal_id, category) DO UPDATE SET
        folder_id   = EXCLUDED.folder_id,
        folder_name = EXCLUDED.folder_name
    `, [dealId, category, folderId, folderName]);

    res.json({ ok: true, folderName });
  } catch (err) {
    console.error('Drive link error:', err.message);
    if (err.message && err.message.includes('invalid_grant')) {
      return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Sync folder ──────────────────────────────────────────────────────────────

// POST /api/google-drive/sync/:dealId/:category
router.post('/sync/:dealId/:category', authenticate, async (req, res) => {
  const { dealId, category } = req.params;

  try {
    const folderRow = await pool.query(
      'SELECT * FROM deal_drive_folders WHERE deal_id=$1 AND category=$2',
      [dealId, category]
    );

    if (folderRow.rows.length === 0) {
      return res.status(404).json({ error: 'No linked folder found' });
    }

    const folder = folderRow.rows[0];

    let drive;
    try {
      drive = await getAuthenticatedDrive();
    } catch (authErr) {
      if (authErr.message && authErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
      }
      throw authErr;
    }

    // List image files in the folder
    let listRes;
    try {
      listRes = await drive.files.list({
        q: `'${folder.folder_id}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: 'files(id,name,mimeType,thumbnailLink,webContentLink)',
        pageSize: 100
      });
    } catch (listErr) {
      if (listErr.message && listErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
      }
      throw listErr;
    }

    const driveFiles = listRes.data.files || [];

    // Get existing images (match by drive file ID in URL)
    const existingRows = await pool.query(
      'SELECT image_url FROM deal_images WHERE deal_id=$1 AND category=$2',
      [dealId, category]
    );
    const existingUrls = new Set(existingRows.rows.map(r => r.image_url));

    let added = 0;

    for (const file of driveFiles) {
      // Use Google Drive direct image URL (no local download needed)
      const driveImageUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;

      if (existingUrls.has(driveImageUrl)) continue;

      try {
        await pool.query(
          `INSERT INTO deal_images (deal_id, image_url, alt_text, category, sort_order)
           VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order),0)+1 FROM deal_images WHERE deal_id=$1 AND category=$4))`,
          [dealId, driveImageUrl, file.name, category]
        );
        added++;
      } catch (insertErr) {
        console.error(`Failed to save ${file.name}:`, insertErr.message);
      }
    }

    await pool.query(
      'UPDATE deal_drive_folders SET last_synced=NOW() WHERE deal_id=$1 AND category=$2',
      [dealId, category]
    );

    res.json({ ok: true, added, total: driveFiles.length });
  } catch (err) {
    console.error('Drive sync error:', err.message);
    if (err.message && err.message.includes('invalid_grant')) {
      return res.status(401).json({ error: 'חיבור Google Drive פג תוקף. יש להתחבר מחדש דרך ההגדרות.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── List linked folders ──────────────────────────────────────────────────────

// GET /api/google-drive/folders/:dealId
router.get('/folders/:dealId', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category, folder_id, folder_name, last_synced FROM deal_drive_folders WHERE deal_id=$1',
      [req.params.dealId]
    );
    const folders = {};
    for (const row of result.rows) {
      folders[row.category] = {
        folderId: row.folder_id,
        folderName: row.folder_name,
        lastSynced: row.last_synced
      };
    }
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unlink folder ────────────────────────────────────────────────────────────

// DELETE /api/google-drive/link/:dealId/:category
router.delete('/link/:dealId/:category', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM deal_drive_folders WHERE deal_id=$1 AND category=$2',
      [req.params.dealId, req.params.category]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

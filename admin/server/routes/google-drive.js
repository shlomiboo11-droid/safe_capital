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
    );

    -- Track Drive provenance of imported images (for sync diff)
    ALTER TABLE deal_images ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_deal_images_drive_file_id
      ON deal_images(deal_id, category, drive_file_id)
      WHERE drive_file_id IS NOT NULL;
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

// ── Drive → object storage helpers ───────────────────────────────────────────
// Nothing here touches the filesystem: on Vercel the code dir is read-only
// (EROFS) and every disk write fails in production. Files are buffered in
// memory (capped at MAX_DOWNLOAD_BYTES) and pushed to Supabase Storage.

const storage = require('../services/storage');

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20MB

const { buildDriveFilename } = storage;

/**
 * Pull a Drive file into memory and upload it to object storage.
 * Pass `knownMeta` when the caller already fetched metadata, to save an API call.
 * @returns {Promise<{meta: object, url: string, key: string}>}
 */
async function copyDriveFileToStorage(drive, fileId, key, knownMeta) {
  let meta = knownMeta;
  if (!meta) {
    const metaRes = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
    meta = metaRes.data;
  }

  const size = parseInt(meta.size || '0', 10);
  if (size && size > MAX_DOWNLOAD_BYTES) {
    const err = new Error(`file too large: ${size} bytes (max ${MAX_DOWNLOAD_BYTES})`);
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const buffer = Buffer.from(res.data);

  // Drive doesn't always report size in metadata — enforce the cap on real bytes too.
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    const err = new Error(`file too large: ${buffer.length} bytes (max ${MAX_DOWNLOAD_BYTES})`);
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const uploaded = await storage.uploadBuffer(buffer, key, { contentType: meta.mimeType });
  return { meta, url: uploaded.url, key: uploaded.key };
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
// @deprecated — replaced by POST /sync-selection/:dealId/:category which downloads
// selected files to /uploads/{dealId}/ instead of saving proxy URLs.
// Kept temporarily for backward compat until UI migration completes.
router.post('/sync/:dealId/:category', authenticate, async (req, res) => {
  console.warn('[deprecated] POST /api/google-drive/sync/:dealId/:category — use /sync-selection instead');
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

    let added = 0;

    // Migrate any existing rows from old thumbnail URL to the new proxy URL
    await pool.query(
      `UPDATE deal_images
         SET image_url = '/api/google-drive/file/' || substring(image_url FROM 'id=([a-zA-Z0-9_-]+)')
       WHERE deal_id = $1 AND category = $2 AND image_url LIKE 'https://drive.google.com/thumbnail%'`,
      [dealId, category]
    );

    const refreshedRows = await pool.query(
      'SELECT image_url FROM deal_images WHERE deal_id=$1 AND category=$2',
      [dealId, category]
    );
    const existingUrlsNow = new Set(refreshedRows.rows.map(r => r.image_url));

    for (const file of driveFiles) {
      const driveImageUrl = `/api/google-drive/file/${file.id}`;

      if (existingUrlsNow.has(driveImageUrl)) continue;

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

// ── Image proxy (unauthenticated; file IDs are opaque & only exposed after sync) ──

// GET /api/google-drive/file/:fileId — stream file bytes through server
router.get('/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return res.status(400).send('invalid file id');
  }
  try {
    const check = await pool.query(
      `SELECT 1 FROM deal_images WHERE image_url LIKE $1 LIMIT 1`,
      [`%${fileId}%`]
    );
    if (check.rows.length === 0) return res.status(404).send('not found');

    const drive = await getAuthenticatedDrive();
    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    const mime = meta.data.mimeType || 'application/octet-stream';
    const stream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.data.on('error', (e) => {
      console.error('Drive stream error:', e.message);
      if (!res.headersSent) res.status(502).send('stream error');
    });
    stream.data.pipe(res);
  } catch (err) {
    console.error('Drive proxy error:', err.message);
    res.status(500).send('proxy error');
  }
});

// ── Thumbnail proxy (authenticated via header OR query token; used by <img> tags) ──

const jwt = require('jsonwebtoken');

function authenticateImg(req, res, next) {
  // Accept token either from Authorization header or ?token= query (so <img src> works)
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.split(' ')[1];
  else if (req.query.token) token = req.query.token;
  if (!token) return res.status(401).send('auth required');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).send('invalid token');
  }
}

// GET /api/google-drive/thumb/:fileId — small image stream for picker UI
router.get('/thumb/:fileId', authenticateImg, async (req, res) => {
  const { fileId } = req.params;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return res.status(400).send('invalid file id');
  }
  try {
    const drive = await getAuthenticatedDrive();
    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    const mime = meta.data.mimeType || 'application/octet-stream';
    const stream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.data.on('error', (e) => {
      console.error('Drive thumb stream error:', e.message);
      if (!res.headersSent) res.status(502).send('stream error');
    });
    stream.data.pipe(res);
  } catch (err) {
    console.error('Drive thumb error:', err.message);
    res.status(500).send('thumb error');
  }
});

// ── List folder files (for picker modal) ─────────────────────────────────────

// GET /api/google-drive/folder/:folderId/files?dealId=X&category=Y
// Returns { files: [...], orphans: [...] }
//   files[]:    { id, name, mimeType, size, modifiedTime, synced, localUrl }
//   orphans[]:  { imageId, drive_file_id, image_url, alt_text } — in DB but not in Drive
router.get('/folder/:folderId/files', authenticate, async (req, res) => {
  const { folderId } = req.params;
  const { dealId, category } = req.query;

  if (!dealId || !category) {
    return res.status(400).json({ error: 'dealId and category query params required' });
  }
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(folderId)) {
    return res.status(400).json({ error: 'invalid folder id' });
  }

  try {
    let drive;
    try {
      drive = await getAuthenticatedDrive();
    } catch (authErr) {
      if (authErr.message && authErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'invalid_grant' });
      }
      throw authErr;
    }

    // List all image files in the folder (with pagination)
    const driveFiles = [];
    let pageToken = undefined;
    const HARD_LIMIT = 1000;
    while (true) {
      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime)',
        pageSize: 200,
        pageToken
      });
      for (const f of (listRes.data.files || [])) {
        driveFiles.push(f);
        if (driveFiles.length >= HARD_LIMIT) break;
      }
      pageToken = listRes.data.nextPageToken;
      if (!pageToken || driveFiles.length >= HARD_LIMIT) break;
    }

    // Cross-reference with deal_images
    const existing = await pool.query(
      `SELECT id, drive_file_id, image_url, alt_text
         FROM deal_images
        WHERE deal_id = $1 AND category = $2 AND drive_file_id IS NOT NULL`,
      [dealId, category]
    );
    const byFileId = new Map();
    for (const row of existing.rows) byFileId.set(row.drive_file_id, row);

    const driveFileIds = new Set(driveFiles.map(f => f.id));

    const files = driveFiles.map(f => {
      const local = byFileId.get(f.id);
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? parseInt(f.size, 10) : null,
        modifiedTime: f.modifiedTime,
        synced: !!local,
        localUrl: local ? local.image_url : null
      };
    });

    // Orphans: in DB with drive_file_id, but file no longer in Drive folder
    const orphans = existing.rows
      .filter(row => !driveFileIds.has(row.drive_file_id))
      .map(row => ({
        imageId: row.id,
        drive_file_id: row.drive_file_id,
        image_url: row.image_url,
        alt_text: row.alt_text
      }));

    res.json({ files, orphans, truncated: driveFiles.length >= HARD_LIMIT });
  } catch (err) {
    console.error('Drive folder list error:', err.message);
    if (err.code === 404 || /not found/i.test(err.message)) {
      return res.status(404).json({ error: 'folder_not_found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Sync by user selection (download to uploads, delete locally if unchecked) ─

// POST /api/google-drive/sync-selection/:dealId/:category
// Body: { fileIds: string[] }
// Performs diff vs current deal_images (matched by drive_file_id):
//   • toAdd   — download to /uploads/{dealId}/ + INSERT deal_images
//   • toRemove— DELETE deal_images + unlink local file (Drive untouched)
//   • kept    — no-op
router.post('/sync-selection/:dealId/:category', authenticate, async (req, res) => {
  const { dealId, category } = req.params;
  const { fileIds } = req.body || {};

  if (!Array.isArray(fileIds)) {
    return res.status(400).json({ error: 'fileIds (array) required' });
  }
  // Validate all file IDs
  for (const id of fileIds) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
      return res.status(400).json({ error: `invalid file id: ${id}` });
    }
  }

  if (!storage.isStorageConfigured()) {
    return res.status(500).json({ error: 'אחסון הקבצים לא מוגדר. יש להגדיר SUPABASE_URL ו-SUPABASE_SERVICE_KEY.' });
  }

  try {
    let drive;
    try {
      drive = await getAuthenticatedDrive();
    } catch (authErr) {
      if (authErr.message && authErr.message.includes('invalid_grant')) {
        return res.status(401).json({ error: 'invalid_grant' });
      }
      throw authErr;
    }

    // Current synced files for this deal+category
    const currentRes = await pool.query(
      `SELECT id, drive_file_id, image_url
         FROM deal_images
        WHERE deal_id = $1 AND category = $2 AND drive_file_id IS NOT NULL`,
      [dealId, category]
    );
    const currentMap = new Map();
    for (const row of currentRes.rows) currentMap.set(row.drive_file_id, row);

    const desired = new Set(fileIds);
    const current = new Set(currentMap.keys());

    const toAdd = [...desired].filter(id => !current.has(id));
    const toRemove = [...current].filter(id => !desired.has(id));
    const kept = [...desired].filter(id => current.has(id));

    const added = [];
    const removed = [];
    const failed = [];

    // Process additions: copy Drive → object storage + INSERT
    for (const fileId of toAdd) {
      try {
        // Fetch metadata first so we know the filename
        const meta = await drive.files.get({
          fileId,
          fields: 'id,name,mimeType,size'
        });
        const size = parseInt(meta.data.size || '0', 10);
        if (size && size > MAX_DOWNLOAD_BYTES) {
          failed.push({ fileId, name: meta.data.name, error: 'file_too_large' });
          continue;
        }
        const filename = buildDriveFilename(fileId, meta.data.name, meta.data.mimeType);
        const key = storage.buildKey('uploads', dealId, filename);

        const { url: imageUrl } = await copyDriveFileToStorage(drive, fileId, key, meta.data);

        const ins = await pool.query(
          `INSERT INTO deal_images (deal_id, image_url, alt_text, category, sort_order, drive_file_id)
           VALUES ($1, $2, $3, $4,
             (SELECT COALESCE(MAX(sort_order),0)+1 FROM deal_images WHERE deal_id=$1 AND category=$4),
             $5)
           RETURNING id`,
          [dealId, imageUrl, meta.data.name, category, fileId]
        );
        added.push({ fileId, name: meta.data.name, imageId: ins.rows[0].id, imageUrl });
      } catch (e) {
        console.error(`sync-selection add failed for ${fileId}:`, e.message);
        failed.push({ fileId, error: e.code || e.message });
      }
    }

    // Process removals: DELETE row + delete stored object (NEVER touch Drive)
    for (const fileId of toRemove) {
      const row = currentMap.get(fileId);
      try {
        // Remove the stored object (best-effort). Legacy '/uploads/...' rows that
        // were never migrated have no object to delete — they're git-tracked files.
        await storage.deleteObject(row.image_url);
        // Clear thumbnail_url if it points to this image
        await pool.query(
          `UPDATE deals SET thumbnail_url = NULL WHERE id = $1 AND thumbnail_url = $2`,
          [dealId, row.image_url]
        );
        await pool.query(`DELETE FROM deal_images WHERE id = $1`, [row.id]);
        removed.push({ fileId, imageId: row.id, image_url: row.image_url });
      } catch (e) {
        console.error(`sync-selection remove failed for ${fileId}:`, e.message);
        failed.push({ fileId, error: e.message });
      }
    }

    const summary = {
      added: added.length,
      removed: removed.length,
      kept: kept.length,
      failed: failed.length
    };

    // last_synced means "the folder and the DB are in sync". Stamping it after a
    // failed run is what hid the EROFS bug for months — the UI reported success
    // while every single file had failed to save. Only stamp a clean run.
    if (failed.length === 0) {
      await pool.query(
        `UPDATE deal_drive_folders SET last_synced = NOW()
          WHERE deal_id = $1 AND category = $2`,
        [dealId, category]
      );
    }

    // Nothing we attempted succeeded → this is a failure, report it as one.
    const attempted = toAdd.length + toRemove.length;
    if (attempted > 0 && failed.length === attempted) {
      const firstError = failed[0] && failed[0].error ? ` (${failed[0].error})` : '';
      return res.status(502).json({
        ok: false,
        error: `הסנכרון נכשל — אף קובץ לא נשמר${firstError}`,
        added, removed, kept, failed, summary
      });
    }

    res.json({
      ok: failed.length === 0,
      ...(failed.length ? { warning: `${failed.length} קבצים נכשלו בסנכרון` } : {}),
      added,
      removed,
      kept,
      failed,
      summary
    });
  } catch (err) {
    console.error('sync-selection error:', err.message);
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

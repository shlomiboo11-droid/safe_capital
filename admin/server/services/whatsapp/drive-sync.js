/**
 * Drive sync — Phase 6.
 *
 * Uploads a session's artifacts to a structured folder tree in the
 * "Safe Capital - WhatsApp Updates" root folder on Google Drive.
 *
 *   <root>/<YYYY>/<MM-Mon>/<YYYY-MM-DD>_<title-slug>/
 *       01_settings.json
 *       02_research-summary.md
 *       03_research-sources.json
 *       04_final-post.txt          (only if status='done')
 *       05_alternative-versions/   (only if any alternatives exist)
 *       06_session-log.json
 *
 * The root folder id is provided via WHATSAPP_DRIVE_ROOT_FOLDER_ID env var.
 * If absent, we fall back to "My Drive" root.
 *
 * Auth piggy-backs on the existing google-drive routes infrastructure.
 */

const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const pool = require('../../db');

const HEBREW_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const ROOT_FOLDER_NAME = 'Safe Capital - WhatsApp Updates';

// ── Auth — duplicate of getAuthenticatedDrive in routes/google-drive.js ─
// We replicate rather than refactor to avoid changing the existing route.

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getStoredTokens() {
  try {
    const r = await pool.query(
      `SELECT id, access_token, refresh_token, token_expiry FROM google_drive_tokens ORDER BY id DESC LIMIT 1`
    );
    return r.rows[0] || null;
  } catch (_) {
    return null;
  }
}

async function getAuthenticatedDrive() {
  const stored = await getStoredTokens();
  if (!stored) throw new Error('Google Drive לא מחובר. יש להתחבר דרך ההגדרות.');

  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date:   stored.token_expiry ? new Date(stored.token_expiry).getTime() : null
  });
  oauth2Client.on('tokens', async (tokens) => {
    await pool.query(
      'UPDATE google_drive_tokens SET access_token=$1, token_expiry=$2, updated_at=NOW() WHERE id=$3',
      [tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, stored.id]
    );
  });
  await oauth2Client.getAccessToken();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ── Folder helpers ──────────────────────────────────────────────────

async function findOrCreateFolder(drive, name, parentId) {
  const safeName = String(name).replace(/'/g, "\\'");
  const q = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const list = await drive.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1
  });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  });
  return created.data.id;
}

async function uploadOrReplaceFile(drive, parentId, fileName, content, mimeType) {
  const safeName = String(fileName).replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1
  });
  if (list.data.files && list.data.files.length > 0) {
    const id = list.data.files[0].id;
    await drive.files.update({
      fileId: id,
      media: { mimeType: mimeType || 'text/plain', body: content }
    });
    return id;
  }
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType: mimeType || 'text/plain', body: content },
    fields: 'id'
  });
  return created.data.id;
}

function slugify(str) {
  return String(str || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || ('session-' + Date.now());
}

async function getRootFolderId(drive) {
  const explicit = process.env.WHATSAPP_DRIVE_ROOT_FOLDER_ID;
  if (explicit) return explicit;
  // Fall back to creating/finding a top-level folder in My Drive.
  return await findOrCreateFolder(drive, ROOT_FOLDER_NAME, 'root');
}

// ── Main: sync a session ────────────────────────────────────────────

/**
 * Sync a session's artifacts to Drive. Idempotent — replaces existing files.
 *
 * @param {Object} session — row from whatsapp_sessions
 * @returns {Promise<{folder_id, folder_url}>}
 */
async function syncSession(session) {
  const drive = await getAuthenticatedDrive();

  const created = new Date(session.created_at || Date.now());
  const yyyy = String(created.getFullYear());
  const mm = String(created.getMonth() + 1).padStart(2, '0');
  const monthFolder = `${mm}-${HEBREW_MONTH[created.getMonth()]}`;
  const day = String(created.getDate()).padStart(2, '0');
  const dateStamp = `${yyyy}-${mm}-${day}`;
  const sessionFolderName = `${dateStamp}_${slugify(session.title || 'session')}`;

  const rootId  = await getRootFolderId(drive);
  const yearId  = await findOrCreateFolder(drive, yyyy, rootId);
  const monthId = await findOrCreateFolder(drive, monthFolder, yearId);
  const sessId  = await findOrCreateFolder(drive, sessionFolderName, monthId);

  // 01 — settings.json
  const settings = {
    id: session.id,
    title: session.title,
    status: session.status,
    topic_brief: session.topic_brief,
    research_depth: session.research_depth,
    length_pref: session.length_pref,
    formality: session.formality,
    editorial_angle:    session.editorial_angle,
    editorial_points:   session.editorial_points,
    editorial_takeaway: session.editorial_takeaway,
    created_at: session.created_at,
    updated_at: session.updated_at,
    tokens_used: session.tokens_used,
    estimated_cost_usd: session.estimated_cost_usd
  };
  await uploadOrReplaceFile(drive, sessId, '01_settings.json',
    JSON.stringify(settings, null, 2), 'application/json');

  // 02 — research-summary.md
  if (session.research_summary) {
    await uploadOrReplaceFile(drive, sessId, '02_research-summary.md',
      session.research_summary, 'text/markdown');
  }

  // 03 — research-sources.json
  const findingsRes = await pool.query(
    `SELECT query, source_url, source_name, raw_excerpt, hebrew_note, provider, created_at
     FROM whatsapp_research_findings
     WHERE session_id = $1 ORDER BY created_at ASC`,
    [session.id]
  );
  await uploadOrReplaceFile(drive, sessId, '03_research-sources.json',
    JSON.stringify(findingsRes.rows, null, 2), 'application/json');

  // 04 — final-post.txt (only if a final post exists)
  if (session.final_post) {
    await uploadOrReplaceFile(drive, sessId, '04_final-post.txt',
      session.final_post, 'text/plain');
  }

  // 05 — alternative-versions folder (only if alternatives exist)
  const altsRes = await pool.query(
    `SELECT id, content, created_at FROM whatsapp_drafts
     WHERE session_id = $1 AND kind = 'alternative' ORDER BY created_at ASC`,
    [session.id]
  );
  if (altsRes.rows.length > 0) {
    const altFolderId = await findOrCreateFolder(drive, '05_alternative-versions', sessId);
    let i = 1;
    for (const alt of altsRes.rows) {
      await uploadOrReplaceFile(drive, altFolderId, `alt-${String(i).padStart(2, '0')}.txt`,
        alt.content, 'text/plain');
      i++;
    }
  }

  // 06 — session-log.json (light audit trail)
  const draftsRes = await pool.query(
    `SELECT id, kind, length_pref, edit_reason, tokens_used, parent_id, created_at
     FROM whatsapp_drafts WHERE session_id = $1 ORDER BY created_at ASC`,
    [session.id]
  );
  const log = {
    drafts: draftsRes.rows,
    proposed_queries: session.proposed_queries,
    messages: session.messages,
    synced_at: new Date().toISOString()
  };
  await uploadOrReplaceFile(drive, sessId, '06_session-log.json',
    JSON.stringify(log, null, 2), 'application/json');

  const folderUrl = `https://drive.google.com/drive/folders/${sessId}`;
  await pool.query(
    `UPDATE whatsapp_sessions SET drive_folder_id = $1, drive_synced_at = NOW() WHERE id = $2`,
    [sessId, session.id]
  );

  return { folder_id: sessId, folder_url: folderUrl };
}

module.exports = { syncSession };

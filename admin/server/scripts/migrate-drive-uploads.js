/**
 * ⚠ SUPERSEDED — do not run. Phases 2 and 3 write to admin/public/uploads/,
 * which is a read-only filesystem on Vercel (EROFS). Uploads now live in object
 * storage; use server/scripts/migrate-uploads-to-storage.js instead. Its Phase 0
 * replaces Phase 1 below (drive_file_id backfill) and matches both the legacy
 * and the migrated URL shapes. Kept only as a record of the previous migration.
 *
 * One-time migration: unify deal_images storage on /uploads/{dealId}/
 *
 * Phase 1: Backfill drive_file_id for rows already in /uploads/ with
 *          `drive_{fileId}_` filename prefix (legacy import format).
 *
 * Phase 2: For rows with image_url = '/api/google-drive/file/{fileId}'
 *          (live proxy URLs — break when admin server is down):
 *            - Download the file from Drive to /uploads/{dealId}/drive_{fileId}_{name}
 *            - Update image_url to the local /uploads/ path
 *            - Set drive_file_id = fileId
 *
 * Phase 3: For deals.thumbnail_url pointing at the old proxy URL, swap to the
 *          corresponding /uploads/ path (looked up via drive_file_id).
 *
 * Idempotent: safe to re-run. Existing /uploads/ rows that already have
 *             drive_file_id set are skipped.
 *
 * Run:  cd admin && node server/scripts/migrate-drive-uploads.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'public', 'uploads');
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff'
};

function sanitizeFilename(name) {
  if (!name) return 'file';
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120) || 'file';
}

function buildDriveFilename(fileId, originalName, mimeType) {
  const safe = sanitizeFilename(originalName || '');
  const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(safe);
  const ext = hasExt ? '' : (MIME_EXT[mimeType] || '');
  return `drive_${fileId}_${safe}${ext}`;
}

async function getAuthenticatedDrive() {
  const r = await pool.query('SELECT * FROM google_drive_tokens ORDER BY id DESC LIMIT 1');
  const stored = r.rows[0];
  if (!stored) throw new Error('No Drive tokens stored — connect Drive via admin UI first');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.token_expiry ? new Date(stored.token_expiry).getTime() : null
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

async function downloadDriveFileToDisk(drive, fileId, destPath) {
  const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
  const size = parseInt(meta.data.size || '0', 10);
  if (size && size > MAX_DOWNLOAD_BYTES) {
    throw new Error(`file too large: ${size} bytes`);
  }
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    let settled = false;
    const fail = async (e) => {
      if (settled) return;
      settled = true;
      out.destroy();
      try { await fs.promises.unlink(destPath); } catch {}
      reject(e);
    };
    res.data.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => { if (!settled) { settled = true; resolve(); } });
    res.data.pipe(out);
  });
  return meta.data;
}

async function phase1_backfillExistingUploads() {
  console.log('\n── Phase 1: Backfill drive_file_id from existing /uploads/drive_* filenames ──');
  const rows = await pool.query(`
    SELECT id, deal_id, image_url
      FROM deal_images
     WHERE image_url LIKE '/uploads/%/drive_%'
       AND drive_file_id IS NULL
  `);
  console.log(`Found ${rows.rows.length} candidate rows`);
  let updated = 0;
  for (const row of rows.rows) {
    const m = row.image_url.match(/\/drive_([a-zA-Z0-9_-]+)_/);
    if (m) {
      await pool.query(`UPDATE deal_images SET drive_file_id = $1 WHERE id = $2`, [m[1], row.id]);
      console.log(`  ✓ row ${row.id} (deal ${row.deal_id}) → drive_file_id = ${m[1]}`);
      updated++;
    } else {
      console.log(`  - row ${row.id}: no fileId pattern in ${row.image_url}`);
    }
  }
  console.log(`Phase 1 done: ${updated} updated`);
  return updated;
}

async function phase2_downloadProxyUrls() {
  console.log('\n── Phase 2: Download proxy URLs → /uploads/ ──');
  const rows = await pool.query(`
    SELECT id, deal_id, image_url, alt_text
      FROM deal_images
     WHERE image_url LIKE '/api/google-drive/file/%'
  `);
  console.log(`Found ${rows.rows.length} proxy-URL rows`);
  if (rows.rows.length === 0) return { migrated: 0, failed: 0 };

  const drive = await getAuthenticatedDrive();
  let migrated = 0;
  let failed = 0;
  for (const row of rows.rows) {
    const fileId = row.image_url.split('/').pop();
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      console.log(`  ✗ row ${row.id}: invalid fileId "${fileId}"`);
      failed++;
      continue;
    }
    try {
      const meta = await drive.files.get({ fileId, fields: 'name,mimeType,size' });
      const filename = buildDriveFilename(fileId, meta.data.name, meta.data.mimeType);
      const destPath = path.join(UPLOADS_ROOT, String(row.deal_id), filename);
      await downloadDriveFileToDisk(drive, fileId, destPath);
      const newUrl = `/uploads/${row.deal_id}/${filename}`;
      await pool.query(
        `UPDATE deal_images SET image_url = $1, drive_file_id = $2 WHERE id = $3`,
        [newUrl, fileId, row.id]
      );
      console.log(`  ✓ row ${row.id} (deal ${row.deal_id}): ${fileId} → ${newUrl}`);
      migrated++;
    } catch (e) {
      console.error(`  ✗ row ${row.id} (deal ${row.deal_id}): ${e.message}`);
      failed++;
    }
  }
  console.log(`Phase 2 done: ${migrated} migrated, ${failed} failed`);
  return { migrated, failed };
}

async function phase3_fixThumbnails() {
  console.log('\n── Phase 3: Fix deals.thumbnail_url pointing at old proxy URLs ──');
  const rows = await pool.query(`
    SELECT id, name, thumbnail_url
      FROM deals
     WHERE thumbnail_url LIKE '/api/google-drive/file/%'
  `);
  console.log(`Found ${rows.rows.length} deals with proxy thumbnails`);
  let updated = 0;
  for (const deal of rows.rows) {
    const fileId = deal.thumbnail_url.split('/').pop();
    const lookup = await pool.query(
      `SELECT image_url FROM deal_images WHERE drive_file_id = $1 AND deal_id = $2 LIMIT 1`,
      [fileId, deal.id]
    );
    if (lookup.rows[0]) {
      await pool.query(
        `UPDATE deals SET thumbnail_url = $1 WHERE id = $2`,
        [lookup.rows[0].image_url, deal.id]
      );
      console.log(`  ✓ deal ${deal.id} (${deal.name}): ${fileId} → ${lookup.rows[0].image_url}`);
      updated++;
    } else {
      console.log(`  - deal ${deal.id}: no matching deal_image found for fileId ${fileId}`);
    }
  }
  console.log(`Phase 3 done: ${updated} thumbnails updated`);
  return updated;
}

async function verify() {
  console.log('\n── Verification ──');
  const a = await pool.query(`SELECT COUNT(*)::int AS n FROM deal_images WHERE image_url LIKE '/api/google-drive/file/%'`);
  const b = await pool.query(`SELECT COUNT(*)::int AS n FROM deals WHERE thumbnail_url LIKE '/api/google-drive/file/%'`);
  console.log(`deal_images with proxy URLs: ${a.rows[0].n} (expected 0 if all migrations succeeded)`);
  console.log(`deals.thumbnail_url with proxy URLs: ${b.rows[0].n} (expected 0)`);
  return { proxyImages: a.rows[0].n, proxyThumbs: b.rows[0].n };
}

(async () => {
  try {
    await phase1_backfillExistingUploads();
    await phase2_downloadProxyUrls();
    await phase3_fixThumbnails();
    await verify();
    console.log('\n✓ Migration complete');
  } catch (e) {
    console.error('\n✗ Migration aborted:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

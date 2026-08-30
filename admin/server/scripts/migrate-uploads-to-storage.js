/**
 * One-time migration: local disk uploads → Supabase Storage
 *
 * Why: on Vercel the code directory (/var/task) is read-only. Files under
 * admin/public/uploads/ only exist because they were committed to git from a
 * local machine — nothing written at runtime in production ever survived
 * (EROFS). All new uploads now go to object storage; this script moves the
 * historical files there too so there is exactly one storage backend.
 *
 * Object keys mirror the old tree 1:1 — '/uploads/15/foo.jpg' → 'uploads/15/foo.jpg'
 * so the mapping is mechanical and re-runnable.
 *
 * Phases
 *   0. Backfill deal_images.drive_file_id from 'drive_{fileId}_' filenames.
 *      Without this the next Drive sync sees 0 known files and re-imports
 *      everything as duplicates (deal 15 / Mountain Ave has 45 such rows).
 *      Runs first, and matches both legacy and already-migrated URLs.
 *   1. deal_images.image_url
 *   2. deal_comp_images.image_url
 *   3. deals.thumbnail_url
 *   4. Verify + report anything left behind.
 *
 * Idempotent by construction:
 *   - uploads use x-upsert, so re-uploading the same key is a no-op overwrite
 *   - every UPDATE is guarded by "url still starts with /uploads/"
 *   - the drive_file_id backfill only touches rows where it IS NULL
 *
 * Run:
 *   cd admin && node server/scripts/migrate-uploads-to-storage.js
 *   cd admin && node server/scripts/migrate-uploads-to-storage.js --dry-run
 *
 * Requires in admin/.env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const storage = require('../services/storage');

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PUBLIC_ROOT = path.join(__dirname, '..', '..', 'public');

const stats = { uploaded: 0, skipped: 0, missing: 0, failed: 0, rows: 0 };

/** '/uploads/15/foo.jpg' → { key: 'uploads/15/foo.jpg', localPath: '<public>/uploads/15/foo.jpg' } */
function resolveLegacyUrl(url) {
  const clean = url.split('?')[0].split('#')[0];
  const rel = clean.replace(/^\/+/, '');            // uploads/15/foo.jpg
  const localPath = path.join(PUBLIC_ROOT, rel);
  // Guard against '..' escaping the public dir
  if (!localPath.startsWith(PUBLIC_ROOT + path.sep)) return null;
  return { key: rel, localPath };
}

/**
 * Upload one legacy file and return its new public URL.
 * Returns null when the file is missing on disk (nothing we can do — reported).
 */
async function migrateFile(url, label) {
  const resolved = resolveLegacyUrl(url);
  if (!resolved) {
    console.log(`  ✗ ${label}: unsafe path in "${url}"`);
    stats.failed++;
    return null;
  }

  const { key, localPath } = resolved;

  if (!fs.existsSync(localPath)) {
    console.log(`  ⚠ ${label}: file missing on disk — ${localPath}`);
    stats.missing++;
    return null;
  }

  if (DRY_RUN) {
    console.log(`  · ${label}: would upload ${key}`);
    stats.skipped++;
    return storage.publicUrl(key);
  }

  const buffer = await fs.promises.readFile(localPath);
  const { url: newUrl } = await storage.uploadBuffer(buffer, key);
  stats.uploaded++;
  console.log(`  ✓ ${label}: ${key} (${(buffer.length / 1024).toFixed(0)}KB)`);
  return newUrl;
}

// ── Phase 0 — backfill drive_file_id ─────────────────────────────────────────

/**
 * Recover the Drive file ID from a stored filename.
 *
 * The filename is `drive_{fileId}_{sanitize(originalName)}`, and BOTH halves can
 * contain underscores — a real ID from this data set is
 * `1sbv_fB-M-0-IqQ3iWG9Q7C397HaPn-jt`. So splitting on '_' is ambiguous and a
 * greedy regex silently swallows part of the name into the ID. A wrong ID is
 * worse than none: the Drive picker would still see the image as unsynced and
 * re-download every file as a duplicate.
 *
 * alt_text holds the original Drive filename, which makes the split exact:
 * sanitize it, strip it off the end, and what remains is the ID.
 */
function extractDriveFileId(imageUrl, altText) {
  const filename = String(imageUrl || '').split('/').pop();
  if (!filename.startsWith('drive_')) return null;
  const body = filename.slice('drive_'.length);

  const suffix = '_' + storage.sanitizeFilename(altText);
  if (altText) {
    const i = body.lastIndexOf(suffix);
    // i > 0 — an ID of zero length is not an ID.
    if (i > 0 && body.slice(i) === suffix) return body.slice(0, i);
  }

  // No usable alt_text: fall back to the shortest plausible ID, i.e. cut at the
  // FIRST underscore that leaves a valid-looking ID. Reported so it can be checked.
  const m = body.match(/^([a-zA-Z0-9_-]{10,}?)_/);
  if (!m) return null;
  console.log(`    ⚠ ${filename}: no alt_text — ID guessed, verify in the Drive picker`);
  return m[1];
}

async function phase0_backfillDriveFileIds() {
  console.log('\n── Phase 0: backfill deal_images.drive_file_id from drive_{fileId}_ filenames ──');
  // '%/drive\_%' matches both '/uploads/15/drive_X_y.jpg' and the migrated
  // 'https://…/uploads/15/drive_X_y.jpg', so phase order can't break it.
  const rows = await pool.query(`
    SELECT id, deal_id, image_url, alt_text
      FROM deal_images
     WHERE image_url LIKE '%/drive\\_%'
       AND drive_file_id IS NULL
  `);
  console.log(`Found ${rows.rows.length} rows with NULL drive_file_id`);

  let updated = 0;
  let unmatched = 0;
  for (const row of rows.rows) {
    const fileId = extractDriveFileId(row.image_url, row.alt_text);
    if (!fileId) {
      console.log(`  - row ${row.id}: could not resolve fileId from ${row.image_url}`);
      unmatched++;
      continue;
    }
    if (!DRY_RUN) {
      await pool.query('UPDATE deal_images SET drive_file_id = $1 WHERE id = $2', [fileId, row.id]);
    }
    console.log(`  ✓ row ${row.id} (deal ${row.deal_id}) → drive_file_id = ${fileId}`);
    updated++;
  }
  console.log(`Phase 0 done: ${updated} backfilled, ${unmatched} unmatched`);
  return { updated, unmatched };
}

// ── Phase 1 — deal_images ────────────────────────────────────────────────────

async function phase1_dealImages() {
  console.log('\n── Phase 1: deal_images.image_url ──');
  const rows = await pool.query(`
    SELECT id, deal_id, image_url
      FROM deal_images
     WHERE image_url LIKE '/uploads/%'
     ORDER BY deal_id, id
  `);
  console.log(`Found ${rows.rows.length} rows on local disk`);

  for (const row of rows.rows) {
    try {
      const newUrl = await migrateFile(row.image_url, `image ${row.id} (deal ${row.deal_id})`);
      if (!newUrl) continue;
      if (!DRY_RUN) {
        // Guard keeps a re-run from clobbering an already-migrated row.
        const upd = await pool.query(
          `UPDATE deal_images SET image_url = $1
            WHERE id = $2 AND image_url LIKE '/uploads/%'`,
          [newUrl, row.id]
        );
        stats.rows += upd.rowCount;
      }
    } catch (e) {
      console.error(`  ✗ image ${row.id}: ${e.message}`);
      stats.failed++;
    }
  }
}

// ── Phase 2 — deal_comp_images ───────────────────────────────────────────────

async function phase2_compImages() {
  console.log('\n── Phase 2: deal_comp_images.image_url ──');
  const rows = await pool.query(`
    SELECT id, comp_id, image_url
      FROM deal_comp_images
     WHERE image_url LIKE '/uploads/%'
     ORDER BY id
  `);
  console.log(`Found ${rows.rows.length} rows on local disk`);

  for (const row of rows.rows) {
    try {
      const newUrl = await migrateFile(row.image_url, `comp image ${row.id} (comp ${row.comp_id})`);
      if (!newUrl) continue;
      if (!DRY_RUN) {
        const upd = await pool.query(
          `UPDATE deal_comp_images SET image_url = $1
            WHERE id = $2 AND image_url LIKE '/uploads/%'`,
          [newUrl, row.id]
        );
        stats.rows += upd.rowCount;
      }
    } catch (e) {
      console.error(`  ✗ comp image ${row.id}: ${e.message}`);
      stats.failed++;
    }
  }
}

// ── Phase 3 — deals.thumbnail_url ────────────────────────────────────────────

async function phase3_thumbnails() {
  console.log('\n── Phase 3: deals.thumbnail_url ──');
  const rows = await pool.query(`
    SELECT id, name, thumbnail_url
      FROM deals
     WHERE thumbnail_url LIKE '/uploads/%'
     ORDER BY id
  `);
  console.log(`Found ${rows.rows.length} deals with local thumbnails`);

  for (const row of rows.rows) {
    try {
      // Re-uploading is safe (same key, upsert) and keeps this phase independent
      // of whether the matching deal_images row was migrated already.
      const newUrl = await migrateFile(row.thumbnail_url, `thumbnail deal ${row.id} (${row.name})`);
      if (!newUrl) continue;
      if (!DRY_RUN) {
        const upd = await pool.query(
          `UPDATE deals SET thumbnail_url = $1
            WHERE id = $2 AND thumbnail_url LIKE '/uploads/%'`,
          [newUrl, row.id]
        );
        stats.rows += upd.rowCount;
      }
    } catch (e) {
      console.error(`  ✗ thumbnail deal ${row.id}: ${e.message}`);
      stats.failed++;
    }
  }
}

// ── Phase 4 — verification ───────────────────────────────────────────────────

async function verify() {
  console.log('\n── Verification ──');
  const q = async (sql) => (await pool.query(sql)).rows[0].n;

  const leftImages = await q(`SELECT COUNT(*)::int AS n FROM deal_images WHERE image_url LIKE '/uploads/%'`);
  const leftComps = await q(`SELECT COUNT(*)::int AS n FROM deal_comp_images WHERE image_url LIKE '/uploads/%'`);
  const leftThumbs = await q(`SELECT COUNT(*)::int AS n FROM deals WHERE thumbnail_url LIKE '/uploads/%'`);
  const nullDriveIds = await q(`
    SELECT COUNT(*)::int AS n FROM deal_images
     WHERE image_url LIKE '%/drive\\_%' AND drive_file_id IS NULL
  `);
  const docs = await q(`SELECT COUNT(*)::int AS n FROM deal_uploaded_documents WHERE file_url LIKE '/uploads/%'`);

  console.log(`deal_images still on /uploads/:        ${leftImages}  (expected 0)`);
  console.log(`deal_comp_images still on /uploads/:   ${leftComps}  (expected 0)`);
  console.log(`deals.thumbnail_url still on /uploads/: ${leftThumbs}  (expected 0)`);
  console.log(`deal_images with drive_ name & NULL id: ${nullDriveIds}  (expected 0)`);
  console.log(`deal_uploaded_documents on /uploads/:   ${docs}  (NOT migrated — documents are out of scope)`);

  console.log(
    `\nFiles: ${stats.uploaded} uploaded, ${stats.skipped} skipped (dry-run), ` +
    `${stats.missing} missing on disk, ${stats.failed} failed. DB rows updated: ${stats.rows}`
  );

  return { leftImages, leftComps, leftThumbs, nullDriveIds };
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing in admin/.env');
    if (!storage.isStorageConfigured()) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in admin/.env');
    }
    if (DRY_RUN) console.log('*** DRY RUN — nothing will be uploaded or written ***');

    await phase0_backfillDriveFileIds();
    await phase1_dealImages();
    await phase2_compImages();
    await phase3_thumbnails();
    const result = await verify();

    const clean = result.leftImages === 0 && result.leftComps === 0 &&
                  result.leftThumbs === 0 && result.nullDriveIds === 0;
    console.log(DRY_RUN ? '\n· Dry run complete' : (clean ? '\n✓ Migration complete' : '\n⚠ Migration finished with leftovers — see above'));
    process.exitCode = (DRY_RUN || clean) ? 0 : 1;
  } catch (e) {
    console.error('\n✗ Migration aborted:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

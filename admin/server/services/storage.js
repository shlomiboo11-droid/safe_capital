/**
 * Object Storage (Supabase Storage) — the ONLY place the admin writes uploaded files.
 *
 * Why: on Vercel the code directory (/var/task) is a read-only filesystem.
 * Any `fs.writeFile` / multer diskStorage under public/uploads/ throws EROFS in
 * production. Everything that used to land on disk now goes to a Supabase bucket
 * and the DB stores the resulting public URL.
 *
 * Conventions
 * -----------
 * Object keys mirror the old on-disk tree 1:1, so a legacy URL maps to a key by
 * dropping the leading slash:
 *     /uploads/15/foo.jpg          → uploads/15/foo.jpg
 *     /uploads/15/comps/bar.jpg    → uploads/15/comps/bar.jpg
 *     /uploads/speakers/baz.jpg    → uploads/speakers/baz.jpg
 *
 * Public URL shape (bucket is public):
 *     {SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}
 *
 * No SDK on purpose — the Storage REST API is three endpoints and the codebase
 * already talks to every external service with native fetch (see zillow-scraper,
 * claude-client). One less dependency in the Vercel bundle.
 *
 * Required env vars (admin/.env + Vercel):
 *   SUPABASE_URL              e.g. https://atvhgtjlksfcsboqbttl.supabase.co
 *   SUPABASE_SERVICE_KEY      the secret / service_role key (server-side only)
 *   SUPABASE_STORAGE_BUCKET   optional, defaults to "website-assets"
 */

const DEFAULT_BUCKET = 'website-assets';

function config() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: process.env.SUPABASE_SERVICE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET
  };
}

/** True when the env vars needed to talk to Storage are present. */
function isStorageConfigured() {
  const { url, key } = config();
  return Boolean(url && key);
}

function requireConfig() {
  const cfg = config();
  if (!cfg.url || !cfg.key) {
    const err = new Error('אחסון הקבצים לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים)');
    err.code = 'STORAGE_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

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

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime'
};

/** Strip anything that isn't safe in an object key. Mirrors the old disk naming. */
function sanitizeFilename(name) {
  if (!name) return 'file';
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120) || 'file';
}

function extname(name) {
  const m = /(\.[a-zA-Z0-9]{1,5})$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

/** Best-effort content type from filename, with an explicit override. */
function contentTypeFor(filename, explicit) {
  if (explicit && explicit !== 'application/octet-stream') return explicit;
  return EXT_MIME[extname(filename)] || 'application/octet-stream';
}

/** `drive_{fileId}_{name}` — the naming the Drive sync has always used. */
function buildDriveFilename(fileId, originalName, mimeType) {
  const safe = sanitizeFilename(originalName || '');
  const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(safe);
  const ext = hasExt ? '' : (MIME_EXT[mimeType] || '');
  return `drive_${fileId}_${safe}${ext}`;
}

/** Join key segments, dropping empties and stray slashes. */
function buildKey(...segments) {
  return segments
    .filter(s => s !== undefined && s !== null && String(s) !== '')
    .map(s => String(s).replace(/^\/+|\/+$/g, ''))
    .join('/');
}

/** Public URL for a stored object. */
function publicUrl(key) {
  const { url, bucket } = requireConfig();
  const encoded = String(key).split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * Reverse of publicUrl — returns the object key for a URL we produced,
 * or null when the URL doesn't belong to our bucket (external / legacy).
 */
function keyFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  const { url, bucket } = config();
  if (!url) return null;
  const prefix = `${url}/storage/v1/object/public/${bucket}/`;
  if (!fileUrl.startsWith(prefix)) return null;
  return decodeURIComponent(fileUrl.slice(prefix.length));
}

/** True when the URL points at our storage bucket. */
function isStorageUrl(fileUrl) {
  return keyFromUrl(fileUrl) !== null;
}

/**
 * Upload a Buffer/Uint8Array. Overwrites an existing object at the same key
 * (idempotent — a re-run of the migration is a no-op, not a duplicate).
 *
 * @returns {Promise<{key: string, url: string, size: number}>}
 */
async function uploadBuffer(buffer, key, { contentType, cacheControl = '31536000' } = {}) {
  const { url, key: apiKey, bucket } = requireConfig();
  if (!buffer || !buffer.length) {
    const err = new Error('קובץ ריק');
    err.code = 'EMPTY_FILE';
    throw err;
  }

  const encoded = String(key).split('/').map(encodeURIComponent).join('/');
  const endpoint = `${url}/storage/v1/object/${bucket}/${encoded}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': contentTypeFor(key, contentType),
      'Cache-Control': `max-age=${cacheControl}`,
      'x-upsert': 'true'
    },
    body: buffer,
    signal: AbortSignal.timeout(60000)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Storage upload failed (${resp.status}): ${text.slice(0, 300)}`);
    err.code = 'STORAGE_UPLOAD_FAILED';
    err.status = resp.status;
    throw err;
  }

  return { key: String(key), url: publicUrl(key), size: buffer.length };
}

/**
 * Delete an object. Accepts either a raw key or a public URL we produced.
 * Never throws — deletion is always best-effort so it can't block a DB delete.
 *
 * @returns {Promise<boolean>} true when the object was removed
 */
async function deleteObject(keyOrUrl) {
  if (!keyOrUrl) return false;
  if (!isStorageConfigured()) return false;

  const key = keyFromUrl(keyOrUrl) || (String(keyOrUrl).startsWith('http') ? null : String(keyOrUrl));
  if (!key) return false;

  try {
    const { url, key: apiKey, bucket } = config();
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    const resp = await fetch(`${url}/storage/v1/object/${bucket}/${encoded}`, {
      method: 'DELETE',
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000)
    });
    return resp.ok;
  } catch (e) {
    console.error('Storage delete failed:', key, e.message);
    return false;
  }
}

module.exports = {
  isStorageConfigured,
  uploadBuffer,
  deleteObject,
  publicUrl,
  keyFromUrl,
  isStorageUrl,
  buildKey,
  buildDriveFilename,
  sanitizeFilename,
  contentTypeFor,
  MIME_EXT
};

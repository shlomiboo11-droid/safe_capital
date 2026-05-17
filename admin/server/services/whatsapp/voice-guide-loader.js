/**
 * Loads docs/voice-guide.md once per process and caches it in-memory.
 * The cached text is passed as a `system` content block with
 * `cache_control: { type: 'ephemeral' }` to Anthropic for prompt caching
 * (~90% token discount on repeated calls within 5 minutes).
 */

const fs = require('fs');
const path = require('path');

// Resolves to admin/docs/voice-guide.md. Lives inside admin/ so it ships with
// the Vercel admin deployment — previously was at <project-root>/docs/ which
// sits OUTSIDE the admin deploy bundle and broke prod reads (ENOENT).
const VOICE_GUIDE_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'voice-guide.md');

let cached = null;
let cachedAt = 0;
const TTL_MS = 60 * 1000; // reload at most once a minute (so edits during dev pick up)

function loadVoiceGuide() {
  const now = Date.now();
  if (cached && (now - cachedAt) < TTL_MS) return cached;

  try {
    cached = fs.readFileSync(VOICE_GUIDE_PATH, 'utf8');
    cachedAt = now;
    return cached;
  } catch (err) {
    console.error('voice-guide-loader: failed to read', VOICE_GUIDE_PATH, err.message);
    cached = '';
    cachedAt = now;
    return cached;
  }
}

/**
 * Returns the voice guide as a system content block array suitable for the
 * Anthropic Messages API, with cache_control: ephemeral.
 *
 * Use as `system: getCachedSystemBlocks(...)` instead of a plain string.
 */
function getCachedSystemBlocks(extraIntro) {
  const voice = loadVoiceGuide();
  // Pull the business context too — it's the "who Safe Capital is" memory
  // that lives alongside the voice guide. Both are cached as separate blocks
  // so they survive across calls.
  let business = '';
  try {
    business = require('./business-context-loader').loadBusinessContext();
  } catch (_) { /* optional */ }

  const blocks = [];

  // First block: an intro that may vary per call — not cached.
  if (extraIntro) {
    blocks.push({ type: 'text', text: extraIntro });
  }

  // Business context block — cached.
  if (business) {
    blocks.push({
      type: 'text',
      text: '# ההקשר העסקי המלא של Safe Capital\n\n' + business,
      cache_control: { type: 'ephemeral' }
    });
  }

  // Voice guide block — cached.
  blocks.push({
    type: 'text',
    text: voice,
    cache_control: { type: 'ephemeral' }
  });

  return blocks;
}

module.exports = { loadVoiceGuide, getCachedSystemBlocks };

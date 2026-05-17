/**
 * Loads docs/business-context.md once per process (TTL 60s for dev edits).
 * Returns it as a cached system block — same mechanism as voice-guide-loader.
 *
 * Used by every Claude call that needs to know who Safe Capital is:
 *   - discoverTopics
 *   - proposeQueries
 *   - executeResearch (per-query system prompt)
 *   - summarizeResearch
 *   - writing-service generatePost / generateAlternative / etc.
 */

const fs = require('fs');
const path = require('path');

// Resolves to admin/docs/business-context.md. Lives inside admin/ so it ships
// with the Vercel admin deployment — previously was at <project-root>/docs/
// which sits OUTSIDE the admin deploy bundle and broke prod reads (ENOENT).
const BUSINESS_CONTEXT_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'business-context.md');

let cached = null;
let cachedAt = 0;
const TTL_MS = 60 * 1000;

function loadBusinessContext() {
  const now = Date.now();
  if (cached && (now - cachedAt) < TTL_MS) return cached;
  try {
    cached = fs.readFileSync(BUSINESS_CONTEXT_PATH, 'utf8');
    cachedAt = now;
    return cached;
  } catch (err) {
    console.error('business-context-loader: failed to read', BUSINESS_CONTEXT_PATH, err.message);
    cached = '';
    cachedAt = now;
    return cached;
  }
}

/**
 * Build a system blocks array that prepends the business-context document
 * as an ephemeral-cached block. `intro` is an optional non-cached preamble.
 */
function getBusinessSystemBlocks(intro) {
  const business = loadBusinessContext();
  const blocks = [];
  if (intro) blocks.push({ type: 'text', text: intro });
  if (business) {
    blocks.push({
      type: 'text',
      text: '# ההקשר העסקי המלא של Safe Capital\n\n' + business,
      cache_control: { type: 'ephemeral' }
    });
  }
  return blocks;
}

module.exports = { loadBusinessContext, getBusinessSystemBlocks };

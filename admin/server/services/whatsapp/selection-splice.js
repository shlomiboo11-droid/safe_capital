/**
 * Locating a user-marked selection inside stored text.
 *
 * Shared by the two point-edit paths (post draft + research summary) — the same
 * buggy line used to live in both files, and fixing one left the other broken
 * (A4#4 / A4#14).
 */

/**
 * Resolve where the marked selection sits inside `full`.
 *
 * The client measures the index against the very text it is displaying and
 * sends it as `selection_start`; we trust it only after verifying that the
 * stored text really does contain the selection at that index.
 *
 * Fallback: if the index is missing or stale (an old page still open, or the
 * text changed underneath), we accept a plain search ONLY when the selection
 * appears exactly once — an unambiguous match cannot edit the wrong occurrence.
 *
 * @param {string} full          the stored text
 * @param {string} selection     the exact raw text the user marked
 * @param {*}      selectionStart client-reported index (may be undefined)
 * @returns {number} index into `full`, or -1 when it cannot be resolved safely
 */
function locateSelection(full, selection, selectionStart) {
  if (typeof full !== 'string' || !selection) return -1;

  const start = Number.isInteger(selectionStart) ? selectionStart : -1;
  if (start >= 0 && full.substr(start, selection.length) === selection) {
    return start;
  }

  const first = full.indexOf(selection);
  if (first < 0) return -1;
  const second = full.indexOf(selection, first + 1);
  return second < 0 ? first : -1;
}

/**
 * Replace [start, start+length) with `replacement`.
 *
 * Deliberately slice+concat and never `String.replace(str, str)`: that form
 * replaces the first occurrence only, and interprets `$&` / `` $` `` / `$'`
 * inside the replacement — which duplicated whole chunks of the post (A4#14).
 */
function spliceAt(full, start, length, replacement) {
  return full.slice(0, start) + replacement + full.slice(start + length);
}

module.exports = { locateSelection, spliceAt };

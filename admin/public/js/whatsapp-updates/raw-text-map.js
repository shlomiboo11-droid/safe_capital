// Bridge between the rendered DOM and the raw text the server stores.
//
// The screen shows formatted text; the database holds raw text with `*` / `#` /
// `- ` markers. Two opposite directions are needed, and each gets its own
// function here:
//
//   1. DOM → raw            `serializeDom()`      — read back what the user
//                                                   edited in place.
//   2. screen position → raw index
//                           `postRawRange()` / `summaryRawRange()`
//                                                 — tell the server exactly
//                                                   WHERE a selection sits in
//                                                   the stored text.
//
// Nothing here mutates the DOM and nothing here changes how text is rendered:
// `formatMarkdown` (markup.js) and `renderWhatsappFormatted` (writing-view.js)
// stay exactly as they are, so the findings panel keeps rendering unchanged.

// Elements that start a new line when serialized back to text. `contenteditable`
// in Chrome wraps every new paragraph in a <div>; Firefox/Safari use <br>.
// Both are handled.
const BLOCK_TAGS = new Set([
  'div', 'p', 'li', 'ul', 'ol', 'section', 'article', 'blockquote', 'pre', 'tr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]);

// Raw markdown markers that the renderer swallows (they never reach the screen).
const MARKER_CHARS = new Set(['*', '_', '#']);

/**
 * Serialize a rendered element back to raw text.
 *
 * @param {Element} root
 * @param {{bold?: boolean}} [opts]  bold:true re-emits `<strong>` as `*…*`
 *                                   (single asterisk — WhatsApp style, and the
 *                                   exact inverse of renderWhatsappFormatted).
 * @returns {string}
 */
export function serializeDom(root, opts = {}) {
  return walkSerialize(root, opts, null, 0).text;
}

/**
 * Length of the serialized text that precedes a DOM point (node + offset).
 * That length IS the index of that point inside `serializeDom(root, opts)`.
 */
export function domOffset(root, node, offset, opts = {}) {
  return walkSerialize(root, opts, node, offset).stop;
}

/**
 * Wrap the serialized content of one `<strong>` in WhatsApp bold markers.
 *
 * Two rules, both forced by the fact that `renderWhatsappFormatted`
 * (writing-view.js) only ever recognises the pattern `/(\*[^*\n]+\*)/`:
 *
 *  1. A line with no non-whitespace character gets NO markers. Chrome's
 *     contenteditable INHERITS `<strong>` while the caret sits at the end of a
 *     bold run, so pressing Enter after a bold closing line produces
 *     `<strong><br></strong>`. Wrapping that unconditionally emitted `*\n*` —
 *     two lines that are a single naked asterisk — and "העתק לוואטסאפ" copies
 *     the stored text verbatim, so the garbage reached the investors' group.
 *  2. Content that spans several lines gets one `*…*` PAIR PER LINE. A single
 *     pair around a multi-line run can never be read back (the regex above
 *     stops at `\n`), so on the next render the markers would show up as
 *     literal asterisks — and re-editing would freeze them into the text.
 *
 * `stopRel` is the caret index inside `inner`, or -1 when the caret is not in
 * this run. It is translated to the matching index inside the wrapped text so
 * `domOffset` still measures the same point. The two boundaries are chosen
 * deliberately and match what the previous implementation produced: at the
 * start of a line the caret lands AFTER the opening marker, at the end of a
 * line BEFORE the closing one. That is what keeps a selection covering exactly
 * one bold run marker-free, so `balanceBoldRuns` leaves it alone and the edited
 * text stays bold.
 *
 * @returns {{text: string, stop: number}}
 */
function wrapBoldContent(inner, stopRel) {
  const lines = inner.split('\n');
  let text = '';
  let stop = -1;
  let pos = 0;                       // index in `inner` where this line starts
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) { text += '\n'; pos += 1; }
    const line = lines[i];
    // Wrap every non-empty line, including one that is only spaces: `*   *` is
    // legitimate raw text and must survive the roundtrip. Only a genuinely
    // empty line gets no markers — that is the <strong><br></strong> Chrome
    // leaves behind when the caret inherits bold, and wrapping it would emit a
    // lone `*` that WhatsApp shows literally.
    const wrap = line.length > 0;
    if (stop < 0 && stopRel >= pos && stopRel <= pos + line.length) {
      stop = text.length + (wrap ? 1 : 0) + (stopRel - pos);
    }
    text += wrap ? '*' + line + '*' : line;
    pos += line.length;
  }
  return { text, stop };
}

function walkSerialize(root, opts, stopNode, stopOffset) {
  const bold = !!opts.bold;
  let buf = '';
  let stopAt = -1;              // index in `buf` of the caret, -1 = not reached

  function reachStop() { if (stopAt < 0) stopAt = buf.length; }

  function atLineStart() {
    return buf === '' || buf.endsWith('\n');   // '' — nothing emitted yet
  }

  function walkChildren(node) {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      if (node === stopNode && i === stopOffset) reachStop();
      walk(kids[i]);
    }
    if (node === stopNode && stopOffset >= kids.length) reachStop();
  }

  function walk(node) {
    if (node.nodeType === 3) {                       // text node
      const v = node.nodeValue || '';
      if (node === stopNode) {
        buf += v.slice(0, stopOffset);
        reachStop();
        buf += v.slice(stopOffset);
        return;
      }
      buf += v;
      return;
    }
    if (node.nodeType !== 1) return;                 // comments etc.

    const tag = node.tagName.toLowerCase();
    if (tag === 'br') { buf += '\n'; return; }

    // The accept/reject buttons of an inline diff are UI, not user text.
    if (node.classList && node.classList.contains('wa-diff-actions')) return;

    if (bold && (tag === 'strong' || tag === 'b')) {
      // The run must be serialized in FULL before it can be wrapped: whether a
      // line carries markers depends on characters that may still lie ahead of
      // the caret, so the walk can no longer stop half-way through. The caret
      // position is carried in `stopAt` instead and remapped below.
      const hadStop = stopAt >= 0;
      const mark = buf.length;
      walkChildren(node);
      const rel = (!hadStop && stopAt >= 0) ? stopAt - mark : -1;
      const wrapped = wrapBoldContent(buf.slice(mark), rel);
      buf = buf.slice(0, mark) + wrapped.text;
      if (rel >= 0) {
        stopAt = mark + (wrapped.stop >= 0 ? wrapped.stop : wrapped.text.length);
      }
      return;
    }

    if (BLOCK_TAGS.has(tag) && !atLineStart()) buf += '\n';
    walkChildren(node);
  }

  walk(root);
  return { text: buf, stop: stopAt < 0 ? buf.length : stopAt };
}

/**
 * Clamp a raw [start,end) range onto real content: drop surrounding whitespace.
 * Returns null when nothing is left.
 */
function trimRange(raw, start, end) {
  if (!(end > start)) return null;
  while (start < end && /\s/.test(raw[start])) start++;
  while (end > start && /\s/.test(raw[end - 1])) end--;
  if (end <= start) return null;
  return { start, end, text: raw.slice(start, end) };
}

/**
 * Push the range out over any bold run it cuts in half.
 *
 * `renderWhatsappFormatted` builds the post's bold runs by splitting on
 * `/(\*[^*\n]+\*)/` — the same matches are computed here. A selection that
 * starts inside a run and ends after it (or the mirror case) would otherwise
 * carry ONE asterisk: the server splices the model's answer over it, and the
 * stored post keeps an orphan `*` that WhatsApp shows literally while the
 * highlight disappears. Widening to the run's own edges keeps the markers
 * paired — the replacement swallows the whole run, markers included.
 *
 * A selection that sits entirely INSIDE a run carries no asterisk at all and is
 * left untouched, so editing bold text keeps it bold.
 */
function balanceBoldRuns(raw, start, end) {
  const re = /\*[^*\n]+\*/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const s = m.index;              // index of the opening `*`
    const e = s + m[0].length;      // index just after the closing `*`
    const hasOpen  = start <= s && end > s;
    const hasClose = start <= e - 1 && end >= e;
    if (hasClose && !hasOpen) start = s;
    else if (hasOpen && !hasClose) end = e;
  }
  return { start, end, text: raw.slice(start, end) };
}

/**
 * Exact mapping for the POST bubble.
 *
 * `renderWhatsappFormatted` is losslessly invertible, so we can verify the
 * mapping before trusting it: if the serialized DOM doesn't match the stored
 * text character for character, we refuse rather than guess.
 *
 * @returns {{start:number, end:number, text:string}|null}
 */
export function postRawRange(bodyEl, range, rawContent) {
  const raw = String(rawContent || '');
  const opts = { bold: true };
  if (serializeDom(bodyEl, opts) !== raw) return null;
  const start = domOffset(bodyEl, range.startContainer, range.startOffset, opts);
  const end   = domOffset(bodyEl, range.endContainer, range.endOffset, opts);
  const t = trimRange(raw, start, end);
  if (!t) return null;
  return balanceBoldRuns(raw, t.start, t.end);
}

/**
 * Mapping for the RESEARCH SUMMARY bubble.
 *
 * `formatMarkdown` is NOT invertible (it drops `#`, `*`, `_`, `---` lines and
 * collapses blank lines), so we align the on-screen plain text against the raw
 * text instead: visible characters must match one-to-one, and only markers /
 * whitespace may be skipped. The server's `locateSelection` check cannot catch a
 * bad alignment here (we cut `selection_text` out of the same stored text it
 * verifies against, so the check always passes) — the alignment below is the
 * only thing standing between the user's marking and what gets overwritten.
 *
 * Note: the bubble renders `stripSourcesSection(summary)` while `rawFull` is the
 * complete summary. Only a trailing section is removed, so prefix offsets — the
 * only thing measured here — are unaffected.
 *
 * @returns {{start:number, end:number, text:string}|null}
 */
export function summaryRawRange(bodyEl, range, rawFull) {
  const raw = String(rawFull || '');
  const opts = { bold: false };
  const plain = serializeDom(bodyEl, opts);
  const from = domOffset(bodyEl, range.startContainer, range.startOffset, opts);
  const to   = domOffset(bodyEl, range.endContainer, range.endOffset, opts);
  if (!(to > from)) return null;

  // Anchor on the characters the user actually covered — never on where the
  // parallel walk happened to stop. Stopping at the boundary used to leave `i`
  // sitting BEFORE raw text that the renderer had hidden just in front of the
  // selection (a `- ` bullet marker, its indent, a `---` rule), and that hidden
  // text was then sent along and overwritten: the bullet fell out of the list,
  // the rule vanished.
  const map = mapPlainToRaw(raw, plain);
  let start = -1;
  let end   = -1;
  for (let j = from; j < to && j < plain.length; j++) {
    if (map[j] < 0 || /\s/.test(plain[j])) continue;   // injected/whitespace
    if (start < 0) start = map[j];
    end = map[j] + 1;
  }
  if (start < 0 || end <= start) return null;
  return trimRange(raw, start, end);
}

/**
 * Walk the raw text and the on-screen text in parallel and record, for every
 * on-screen character, the index of the raw character it came from.
 *
 * -1 means "no raw character": either the renderer injected it (the `• ` bullet,
 * a line break markdown didn't have) or the walk had to skip it. Markers
 * (`*` `_` `#`) and text the renderer drops (`---`) are consumed on the raw side
 * only, so they never own a position on screen — which is exactly what keeps
 * them out of a selection that merely sits next to them.
 *
 * @returns {number[]} one entry per character of `plain`
 */
function mapPlainToRaw(raw, plain) {
  const map = new Array(plain.length).fill(-1);
  let i = 0;   // index in raw
  let j = 0;   // index in plain (what's on screen)

  while (j < plain.length && i < raw.length) {
    const rc = raw[i];
    const pc = plain[j];
    if (rc === pc)            { map[j] = i; i++; j++; continue; }
    if (pc === '•')           { j++; continue; }   // bullet the renderer injects
    if (MARKER_CHARS.has(rc)) { i++; continue; }   // * _ # swallowed by renderer
    if (/\s/.test(rc))        { i++; continue; }   // collapsed blank lines, list indent
    if (/\s/.test(pc))        { j++; continue; }   // line breaks the renderer added
    i++;                                           // content dropped on screen ('---')
  }

  return map;
}

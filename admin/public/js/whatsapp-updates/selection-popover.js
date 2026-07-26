// Floating popover that appears when the user selects text inside a
// "selectable" container (the research summary bubble, in Phase 3).
//
// Workflow:
//   1. mouseup / touchend → check selection → show popover near it.
//   2. User clicks a quick-action or types a free-text instruction → POST.
//   3. Response includes { old_text, new_text } → render diff inline:
//        old text struck-through, new text in green, accept/reject buttons.
//   4. Accept → replace inline in DOM + ApiClient already committed it server-side.
//      Reject → restore original text; revert via ApiClient.manualEdit().

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { setMarkdown, stripSourcesSection } from './markup.js';
import { summaryRawRange } from './raw-text-map.js';

const QUICK_ACTIONS = [
  { key: 'verify',   label: 'תאמת מחקרית', icon: 'fact_check',     needsInstr: false },
  { key: 'rephrase', label: 'תנסח מחדש',  icon: 'autorenew',      needsInstr: false },
  { key: 'expand',   label: 'הרחב על זה', icon: 'unfold_more',    needsInstr: false },
  { key: 'shorten',  label: 'קצר את זה',  icon: 'unfold_less',    needsInstr: false },
  { key: 'delete',   label: 'מחק את זה',  icon: 'delete',         needsInstr: false },
  { key: 'explain',  label: 'הסבר',       icon: 'help',           needsInstr: false }
];

let popoverEl = null;
let currentTarget = null;     // the contentEditable element that owns the selection
let savedRange = null;
let savedSelectionText = '';
let savedSelectionStart = -1;   // index of the selection inside the RAW summary

function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'wa-selection-popover wa-hidden';
  popoverEl.innerHTML = `
    <div class="wa-popover-actions">
      ${QUICK_ACTIONS.map(a => `
        <button type="button" class="wa-popover-action" data-action="${a.key}" title="${a.label}">
          <span class="material-symbols-outlined">${a.icon}</span>
          <span class="wa-popover-action-label">${a.label}</span>
        </button>
      `).join('')}
    </div>
    <div class="wa-popover-input-row">
      <input type="text" class="wa-popover-input" placeholder="או כתוב הוראה משלך…">
      <button type="button" class="wa-popover-send" title="שלח (Enter)">
        <span class="material-symbols-outlined">send</span>
      </button>
    </div>
    <div class="wa-popover-busy wa-hidden">
      <span class="wa-typing"><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span></span>
      <span>חושב…</span>
    </div>
  `;
  document.body.appendChild(popoverEl);

  // Quick actions
  popoverEl.querySelectorAll('.wa-popover-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      submitEdit(action, '');
    });
  });

  const input = popoverEl.querySelector('.wa-popover-input');
  const send  = popoverEl.querySelector('.wa-popover-send');
  send.addEventListener('click', () => {
    const v = input.value.trim();
    if (!v) return;
    submitEdit('freeform', v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send.click();
    } else if (e.key === 'Escape') {
      hidePopover();
    }
  });

  // Dismiss on outside click — but not when the click is in a diff block.
  document.addEventListener('mousedown', (e) => {
    if (!popoverEl || popoverEl.classList.contains('wa-hidden')) return;
    if (popoverEl.contains(e.target)) return;
    if (e.target.closest('.wa-diff-block')) return;
    hidePopover();
  });

  return popoverEl;
}

function positionPopover(rect) {
  const p = popoverEl;
  p.style.visibility = 'hidden';
  p.classList.remove('wa-hidden');
  // Measure after un-hiding
  const pw = p.offsetWidth;
  const ph = p.offsetHeight;
  const margin = 8;

  let top = window.scrollY + rect.bottom + margin;
  // If it'd overflow viewport bottom, show above the selection.
  if (rect.bottom + ph + margin > window.innerHeight) {
    top = window.scrollY + rect.top - ph - margin;
  }
  let left = window.scrollX + rect.left + (rect.width / 2) - (pw / 2);
  left = Math.max(window.scrollX + 8, Math.min(left, window.scrollX + window.innerWidth - pw - 8));

  p.style.top = top + 'px';
  p.style.left = left + 'px';
  p.style.visibility = '';
}

function hidePopover() {
  if (!popoverEl) return;
  popoverEl.classList.add('wa-hidden');
  setBusy(false);
  const input = popoverEl.querySelector('.wa-popover-input');
  if (input) input.value = '';
  savedRange = null;
  savedSelectionText = '';
  savedSelectionStart = -1;
  currentTarget = null;
}

function setBusy(busy) {
  if (!popoverEl) return;
  const actions = popoverEl.querySelector('.wa-popover-actions');
  const inputRow = popoverEl.querySelector('.wa-popover-input-row');
  const busyEl   = popoverEl.querySelector('.wa-popover-busy');
  actions.style.display = busy ? 'none' : '';
  inputRow.style.display = busy ? 'none' : '';
  busyEl.classList.toggle('wa-hidden', !busy);
}

async function submitEdit(action, instruction) {
  if (!savedSelectionText || !currentTarget) return;
  const session = Store.get().session;
  if (!session) return;

  // A3#9 — remember the summary EXACTLY as it is stored right now. A rejection
  // must restore this, never whatever the flattened diff view left on screen.
  const prevRaw = Store.get().research.summary || '';
  // Snapshot what we're editing — an outside click during the request calls
  // hidePopover() and would otherwise clear these mid-flight.
  const target = currentTarget;
  const selText = savedSelectionText;
  const selStart = savedSelectionStart;

  setBusy(true);
  try {
    const result = await ApiClient.editSelection(session.id, {
      selection_text: selText,
      // A3#8 / A4#4 — exact index in the stored summary, so the server splices
      // instead of searching for a string that never matched (the `*`/`#`
      // markers are not on screen) and instead of hitting the first occurrence.
      selection_start: selStart,
      action,
      instruction
    });
    renderDiffInPlace(target, selText, result, prevRaw);
    hidePopover();
    // Refresh the session locally so future selections use the updated summary.
    const updated = await ApiClient.getSession(session.id);
    Store.setSession(updated.session, { findings: updated.findings });
  } catch (err) {
    console.error('edit-selection failed', err);
    alert('שגיאה בעריכה: ' + err.message);
    setBusy(false);
  }
}

/**
 * Replace the selected text inside `container` with a diff block that
 * shows both old (struck) and new (green), with accept/reject buttons.
 *
 * `prevRaw` is the stored summary from BEFORE the edit — the only safe thing to
 * restore on rejection (A3#9). Both buttons re-render the bubble from raw text,
 * so the flattening this preview causes never outlives the preview itself.
 */
function renderDiffInPlace(container, oldText, result, prevRaw) {
  // The selection is raw text (it may carry `*` / `#` markers that are not on
  // screen) — strip them to find it in the rendered text.
  const visibleOld = String(oldText || '')
    .replace(/^#{1,3}[ \t]+/gm, '')
    .replace(/[*_]/g, '');
  const text = container.textContent || '';
  const idx = text.indexOf(visibleOld);
  if (idx < 0) {
    // Can't anchor the preview — show the saved result straight away instead of
    // leaving a stale summary on screen.
    setMarkdown(container, stripSourcesSection(result.full_summary || prevRaw || ''));
    return;
  }
  oldText = visibleOld;

  // Rebuild the container as: [before] [diff] [after]
  const before = text.slice(0, idx);
  const after  = text.slice(idx + oldText.length);
  container.textContent = '';

  const beforeNode = document.createTextNode(before);
  container.appendChild(beforeNode);

  const diff = document.createElement('span');
  diff.className = 'wa-diff-block';
  diff.dataset.draftId = result.draft_id;

  if (oldText) {
    const oldEl = document.createElement('del');
    oldEl.className = 'wa-diff-old';
    oldEl.textContent = oldText;
    diff.appendChild(oldEl);
  }
  if (result.new_text) {
    const newEl = document.createElement('ins');
    newEl.className = 'wa-diff-new';
    newEl.textContent = result.new_text;
    diff.appendChild(newEl);
  } else {
    const empty = document.createElement('span');
    empty.className = 'wa-diff-deleted-mark';
    empty.textContent = '⟨נמחק⟩';
    diff.appendChild(empty);
  }

  const actions = document.createElement('span');
  actions.className = 'wa-diff-actions';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'wa-diff-btn wa-diff-accept';
  ok.title = 'אישור';
  ok.innerHTML = '<span class="material-symbols-outlined">check</span>';
  ok.addEventListener('click', () => {
    // Accept: the server already committed it — redraw the whole bubble from the
    // saved text so headings, bold and line breaks come back immediately.
    setMarkdown(container, stripSourcesSection(result.full_summary || ''));
  });
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'wa-diff-btn wa-diff-reject';
  cancel.title = 'דחייה (לשחזר)';
  cancel.innerHTML = '<span class="material-symbols-outlined">close</span>';
  cancel.addEventListener('click', async () => {
    // Reject: roll back to the summary as it was BEFORE the edit. A3#9 — this
    // used to send `container.textContent`, i.e. the flattened preview, which
    // overwrote the good summary with a version stripped of every heading,
    // bullet and line break.
    setMarkdown(container, stripSourcesSection(prevRaw || ''));
    const sessionId = Store.get().session?.id;
    if (!sessionId) return;
    try {
      await ApiClient.manualEdit(sessionId, prevRaw || '');
      const updated = await ApiClient.getSession(sessionId);
      if (updated) Store.setSession(updated.session, { findings: updated.findings });
    } catch (err) {
      console.warn('Server-side rollback failed (UI restored)', err);
    }
  });
  actions.appendChild(ok);
  actions.appendChild(cancel);
  diff.appendChild(actions);

  container.appendChild(diff);
  container.appendChild(document.createTextNode(after));
}

/**
 * Enable selection-popover behavior on `el`. El must contain the editable
 * summary text. The popover appears when the user selects ≥ 3 chars inside.
 */
export function attachSelectionPopover(el) {
  ensurePopover();

  function maybeShow() {
    if (el.dataset.editing === '1') return;   // free-edit in progress
    // A pending diff puts BOTH the old and the new text on screen at once, so
    // nothing on screen lines up with the stored summary any more. Make the user
    // resolve it (וי/איקס) before marking something else.
    if (el.querySelector('.wa-diff-block')) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    // A3#8 — sel.toString() has no `*` / `#` markers, so the server never found
    // it. Map the on-screen selection onto the RAW summary instead.
    const raw = summaryRawRange(el, range, Store.get().research.summary || '');
    if (!raw || raw.text.length < 3) return;

    savedRange = range.cloneRange();
    savedSelectionText = raw.text;
    savedSelectionStart = raw.start;
    currentTarget = el;
    positionPopover(range.getBoundingClientRect());
    const input = popoverEl.querySelector('.wa-popover-input');
    if (input) input.focus();
  }

  el.addEventListener('mouseup', () => setTimeout(maybeShow, 10));
  el.addEventListener('touchend', () => setTimeout(maybeShow, 10));
}

export function detachAllPopovers() {
  hidePopover();
}

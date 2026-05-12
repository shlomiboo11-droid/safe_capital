// Variant of selection-popover that targets the POST draft (Phase 4)
// instead of the research summary. Same UX, different API endpoint.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';

const QUICK_ACTIONS = [
  { key: 'verify',   label: 'תאמת מחקרית', icon: 'fact_check' },
  { key: 'rephrase', label: 'תנסח מחדש',  icon: 'autorenew' },
  { key: 'expand',   label: 'הרחב על זה', icon: 'unfold_more' },
  { key: 'shorten',  label: 'קצר את זה',  icon: 'unfold_less' },
  { key: 'delete',   label: 'מחק את זה',  icon: 'delete' },
  { key: 'explain',  label: 'הסבר',       icon: 'help' }
];

let popoverEl = null;
let currentTarget = null;
let savedSelectionText = '';

function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'wa-selection-popover wa-hidden';
  popoverEl.dataset.kind = 'post';
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
      <button type="button" class="wa-popover-send" title="שלח">
        <span class="material-symbols-outlined">send</span>
      </button>
    </div>
    <div class="wa-popover-busy wa-hidden">
      <span class="wa-typing"><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span></span>
      <span>חושב…</span>
    </div>
  `;
  document.body.appendChild(popoverEl);

  popoverEl.querySelectorAll('.wa-popover-action').forEach(btn => {
    btn.addEventListener('click', () => submitEdit(btn.dataset.action, ''));
  });
  const input = popoverEl.querySelector('.wa-popover-input');
  const send  = popoverEl.querySelector('.wa-popover-send');
  send.addEventListener('click', () => {
    const v = input.value.trim();
    if (v) submitEdit('freeform', v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send.click(); }
    else if (e.key === 'Escape') hidePopover();
  });

  document.addEventListener('mousedown', (e) => {
    if (!popoverEl || popoverEl.classList.contains('wa-hidden')) return;
    if (popoverEl.contains(e.target)) return;
    hidePopover();
  });

  return popoverEl;
}

function positionPopover(rect) {
  const p = popoverEl;
  p.style.visibility = 'hidden';
  p.classList.remove('wa-hidden');
  const pw = p.offsetWidth;
  const ph = p.offsetHeight;
  const margin = 8;
  let top = window.scrollY + rect.bottom + margin;
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
  savedSelectionText = '';
  currentTarget = null;
}

function setBusy(busy) {
  if (!popoverEl) return;
  popoverEl.querySelector('.wa-popover-actions').style.display   = busy ? 'none' : '';
  popoverEl.querySelector('.wa-popover-input-row').style.display = busy ? 'none' : '';
  popoverEl.querySelector('.wa-popover-busy').classList.toggle('wa-hidden', !busy);
}

async function submitEdit(action, instruction) {
  if (!savedSelectionText || !currentTarget) return;
  const state = Store.get();
  if (!state.session || !state.post.draftId) return;
  setBusy(true);
  try {
    const result = await ApiClient.editPostSelection(state.session.id, state.post.draftId, {
      selection_text: savedSelectionText,
      action,
      instruction
    });
    Store.setPost({
      draftId: result.draft_id,
      content: result.full_content,
      wordCount: result.word_count
    });
    hidePopover();
  } catch (err) {
    console.error('post edit-selection failed', err);
    alert('שגיאה בעריכה: ' + err.message);
    setBusy(false);
  }
}

export function attachSelectionPopoverForPost(el) {
  ensurePopover();

  function maybeShow() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const text = sel.toString().trim();
    if (text.length < 3) return;
    savedSelectionText = text;
    currentTarget = el;
    positionPopover(range.getBoundingClientRect());
    popoverEl.querySelector('.wa-popover-input')?.focus();
  }

  el.addEventListener('mouseup', () => setTimeout(maybeShow, 10));
  el.addEventListener('touchend', () => setTimeout(maybeShow, 10));
}

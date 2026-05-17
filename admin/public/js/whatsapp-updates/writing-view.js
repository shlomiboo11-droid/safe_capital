// Renders the Post bubble in the chat: length tabs, word-count meter,
// quick-action buttons, selection-popover support, and a "copy to WhatsApp" CTA.
//
// Reads state.post. Re-renders on any change.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { attachSelectionPopoverForPost } from './selection-popover-post.js';

const LENGTH_TARGETS = {
  short:  { min: 70,  max: 110, label: 'קצר' },
  medium: { min: 140, max: 210, label: 'בינוני' },
  long:   { min: 220, max: 320, label: 'ארוך' }
};

const QUICK_ACTIONS = [
  { key: 'shorten_30',       label: 'קצר ב-30%',     icon: 'compress' },
  { key: 'add_cta',          label: 'הוסף CTA',     icon: 'campaign' },
  { key: 'add_emoji',        label: 'הוסף אמוג׳ים',  icon: 'add_reaction' },
  { key: 'remove_emoji',     label: 'הסר אמוג׳ים',   icon: 'sentiment_neutral' },
  { key: 'strengthen_open',  label: 'חזק פתיחה',     icon: 'arrow_upward' },
  { key: 'strengthen_close', label: 'חזק סגירה',     icon: 'arrow_downward' }
];

function meterClassForCount(count, target) {
  if (!target) return 'wa-meter-neutral';
  if (count < target.min - 30 || count > target.max + 50) return 'wa-meter-bad';
  if (count < target.min || count > target.max) return 'wa-meter-warn';
  return 'wa-meter-good';
}

export function renderWritingBubble(container) {
  const state = Store.get();
  const wrap = document.createElement('div');
  wrap.className = 'wa-msg wa-msg-assistant wa-post-bubble';

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble wa-msg-post';

  // Length is set in the writing-config modal (and changeable via "ערוך הגדרות").
  // We don't show inline tabs here — only the meter below so the user can see
  // if the post is within the target range.

  // Word count meter
  const target = LENGTH_TARGETS[state.post.lengthPref];
  const meter = document.createElement('div');
  meter.className = 'wa-word-meter ' + meterClassForCount(state.post.wordCount, target);
  meter.innerHTML = `
    <span class="wa-meter-count">${state.post.wordCount}</span>
    <span class="wa-meter-target">${target.min}–${target.max} מילים</span>
  `;
  bubble.appendChild(meter);

  // Post body — selectable + contenteditable for free edit
  const body = document.createElement('div');
  body.className = 'wa-post-body';
  // Render *bold* segments
  body.appendChild(renderWhatsappFormatted(state.post.content || ''));
  bubble.appendChild(body);

  // Wire selection popover for point-edits on the post
  attachSelectionPopoverForPost(body);

  // Quick actions row
  const qa = document.createElement('div');
  qa.className = 'wa-quick-actions';
  for (const a of QUICK_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wa-quick-btn';
    btn.title = a.label;
    btn.innerHTML = `
      <span class="material-symbols-outlined">${a.icon}</span>
      <span class="wa-quick-label">${a.label}</span>
    `;
    btn.addEventListener('click', () => onQuickAction(a.key, btn));
    qa.appendChild(btn);
  }
  bubble.appendChild(qa);

  // Bottom action row
  const actions = document.createElement('div');
  actions.className = 'wa-post-actions';

  const copy = document.createElement('button');
  copy.className = 'btn btn-primary';
  copy.innerHTML = '<span class="material-symbols-outlined">content_copy</span> העתק לוואטסאפ';
  copy.addEventListener('click', () => onCopy(copy));

  const alt = document.createElement('button');
  alt.className = 'btn btn-secondary';
  alt.innerHTML = '<span class="material-symbols-outlined">refresh</span> גרסה אלטרנטיבית';
  alt.addEventListener('click', () => onAlternative(alt));

  const editSettings = document.createElement('button');
  editSettings.className = 'btn btn-secondary';
  editSettings.innerHTML = '<span class="material-symbols-outlined">tune</span> ערוך הגדרות וכתוב מחדש';
  editSettings.title = 'שנה את הזווית / הנקודות / המסקנה / האורך וצור טיוטה חדשה';
  editSettings.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('wa:reopen-writing-config'));
  });

  const freeEdit = document.createElement('button');
  freeEdit.className = 'btn btn-secondary';
  freeEdit.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
  freeEdit.addEventListener('click', () => onFreeEdit(body, copy, alt, freeEdit));

  const finalize = document.createElement('button');
  finalize.className = 'btn btn-secondary';
  finalize.innerHTML = '<span class="material-symbols-outlined">lock</span> שמור כסופי';
  finalize.addEventListener('click', () => onFinalize(finalize));

  actions.appendChild(copy);
  actions.appendChild(alt);
  actions.appendChild(editSettings);
  actions.appendChild(freeEdit);
  actions.appendChild(finalize);
  bubble.appendChild(actions);

  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

function renderWhatsappFormatted(text) {
  // Convert *bold* to <strong>, preserving line breaks via white-space: pre-wrap.
  const frag = document.createDocumentFragment();
  const parts = String(text || '').split(/(\*[^*\n]+\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const b = document.createElement('strong');
      b.textContent = part.slice(1, -1);
      frag.appendChild(b);
    } else {
      frag.appendChild(document.createTextNode(part));
    }
  }
  return frag;
}

// ── Handlers ────────────────────────────────────────────────────────

async function onLengthChange(newLength) {
  const session = Store.get().session;
  if (!session) return;
  const current = Store.get().post.lengthPref;
  if (current === newLength) return;

  Store.setPostGenerating(true);
  try {
    const result = await ApiClient.writePost(session.id, newLength);
    Store.setPost({
      draftId: result.draft_id,
      content: result.content,
      lengthPref: result.length_pref,
      wordCount: result.word_count
    });
  } catch (err) {
    console.error('length change failed', err);
    alert('שגיאה: ' + err.message);
    Store.setPostGenerating(false);
  }
}

async function onQuickAction(actionKey, btn) {
  const state = Store.get();
  if (!state.session || !state.post.draftId) return;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> <span class="wa-quick-label">חושב…</span>';
  try {
    const result = await ApiClient.quickAction(state.session.id, state.post.draftId, actionKey);
    Store.setPost({
      draftId: result.draft_id,
      content: result.content,
      wordCount: result.word_count
    });
  } catch (err) {
    console.error('quick action failed', err);
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function onAlternative(btn) {
  const state = Store.get();
  if (!state.session) return;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> מייצר…';
  try {
    const result = await ApiClient.writeAlternative(state.session.id, state.post.lengthPref);
    Store.setPost({
      draftId: result.draft_id,
      content: result.content,
      wordCount: result.word_count
    });
  } catch (err) {
    console.error('alternative failed', err);
    alert('שגיאה: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function onCopy(btn) {
  const text = Store.get().post.content;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined">check</span> הועתק!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  } catch (err) {
    console.error('copy failed', err);
    alert('שגיאה בהעתקה');
  }
}

function onFreeEdit(body, copyBtn, altBtn, freeBtn) {
  const editing = body.dataset.editing === '1';
  if (!editing) {
    body.dataset.editing = '1';
    body.dataset.originalText = body.textContent;
    body.contentEditable = 'true';
    body.classList.add('wa-post-editing');
    body.focus();
    freeBtn.innerHTML = '<span class="material-symbols-outlined">save</span> שמור עריכה';
    copyBtn.disabled = true;
    altBtn.disabled = true;
  } else {
    const newText = body.textContent;
    body.contentEditable = 'false';
    body.classList.remove('wa-post-editing');
    body.dataset.editing = '';
    freeBtn.disabled = true;
    freeBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> שומר…';
    const state = Store.get();
    ApiClient.manualEditPost(state.session.id, state.post.draftId, newText)
      .then((result) => {
        Store.setPost({
          draftId: result.draft_id,
          content: result.content,
          wordCount: result.word_count
        });
      })
      .catch((err) => {
        console.error('manual edit failed', err);
        alert('שגיאה: ' + err.message);
      })
      .finally(() => {
        freeBtn.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
        freeBtn.disabled = false;
        copyBtn.disabled = false;
        altBtn.disabled = false;
      });
  }
}

async function onFinalize(btn) {
  const state = Store.get();
  if (!state.session || !state.post.draftId) return;
  if (!confirm('לשמור את הגרסה הזאת כסופית? תוכל לפתוח סשן חדש בכל רגע.')) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> שומר…';
  try {
    await ApiClient.finalizePost(state.session.id, state.post.draftId);
    const fresh = await ApiClient.getSession(state.session.id);
    Store.setSession(fresh.session, { findings: fresh.findings });
  } catch (err) {
    console.error('finalize failed', err);
    alert('שגיאה: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">lock</span> שמור כסופי';
  }
}

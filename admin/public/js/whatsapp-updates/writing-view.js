// Renders the Post bubble in the chat: length tabs, word-count meter,
// quick-action buttons, selection-popover support, and a "copy to WhatsApp" CTA.
//
// Reads state.post. Re-renders on any change.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { attachSelectionPopoverForPost } from './selection-popover-post.js';
import { serializeDom } from './raw-text-map.js';
import { toHebrewError } from './error-text.js';

// A4#6 — ONE paid post-rewrite at a time, for the whole bubble.
// Each button only ever disabled itself, so pressing "קצר ב-30%" and then
// "הוסף CTA" fired two billed calls that both started from the SAME source
// draft; the slower one overwrote the faster one and that result vanished —
// paid for, never seen. Must be reset in `finally` on BOTH handlers: leaving it
// stuck on a failure would freeze every action until a page refresh.
let postActionInFlight = false;

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
    // A1#12 / A4#10 — the one alert in this file the translation pass missed.
    // Every other catch here already goes through error-text.js.
    alert(toHebrewError(err.message));
    Store.setPostGenerating(false);
  }
}

async function onQuickAction(actionKey, btn) {
  const state = Store.get();
  if (!state.session || !state.post.draftId) return;
  if (postActionInFlight) return;   // A4#6
  postActionInFlight = true;
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
    alert(toHebrewError(err.message));
  } finally {
    postActionInFlight = false;
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function onAlternative(btn) {
  const state = Store.get();
  if (!state.session) return;
  if (postActionInFlight) return;   // A4#6
  postActionInFlight = true;
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
    alert(toHebrewError(err.message));
  } finally {
    postActionInFlight = false;
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// A4#12 — `navigator.clipboard` does not exist in an insecure context (plain
// HTTP on a LAN IP — i.e. opening the admin from a phone on the office
// network). `await navigator.clipboard.writeText(...)` threw a TypeError, the
// old catch showed "שגיאה בהעתקה" and left the user with no way to get the
// post out, at the exact moment the post is finally ready.
//
// Order: modern API when it's actually available → the legacy execCommand path
// (works over plain HTTP) → give up and hand the user a selection to Ctrl+C.
// The secure path MUST stay first — do not "simplify" this to execCommand only.
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('clipboard API failed, falling back', err);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // Off-screen and removed immediately — nothing visible changes on the page.
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);   // iOS needs the explicit range
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (err) {
    console.warn('execCommand copy failed', err);
  }
  return false;
}

function selectPostBody() {
  const body = document.querySelector('.wa-post-body');
  if (!body) return false;
  try {
    const range = document.createRange();
    range.selectNodeContents(body);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch (_) { return false; }
}

async function onCopy(btn) {
  const text = Store.get().post.content;
  if (!text) return;
  const copied = await copyTextToClipboard(text);
  if (copied) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined">check</span> הועתק!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
    return;
  }
  const selected = selectPostBody();
  alert(selected
    ? 'לא ניתן להעתיק אוטומטית בחיבור הזה — הטקסט מסומן, העתק עם Ctrl+C (או לחיצה ארוכה בנייד).'
    : 'לא ניתן להעתיק אוטומטית בחיבור הזה — סמן את הטקסט של הפוסט והעתק ידנית.');
}

// A4#2 / A4#13 — free edit on the post is a transparent round-trip (decision 5).
// The bold text stays bold while editing; `serializeDom` rebuilds the raw text
// from the DOM — `<strong>` back to a SINGLE `*…*` (exactly what
// renderWhatsappFormatted consumed), and the browser's <div>/<br> line breaks
// back to real "\n". `body.textContent` did neither.
function onFreeEdit(body, copyBtn, altBtn, freeBtn) {
  const editing = body.dataset.editing === '1';
  if (!editing) {
    body.dataset.editing = '1';
    body.dataset.originalText = Store.get().post.content || '';
    body.contentEditable = 'true';
    body.classList.add('wa-post-editing');
    body.focus();
    freeBtn.innerHTML = '<span class="material-symbols-outlined">save</span> שמור עריכה';
    copyBtn.disabled = true;
    altBtn.disabled = true;
  } else {
    const newText = serializeDom(body, { bold: true });
    // A4#9 — an empty post would be saved as a new draft and the bubble would
    // vanish with no way back. Stay in edit mode instead. A lone emoji counts
    // as content: the test is "no non-whitespace character".
    if (!/\S/.test(newText)) {
      alert('אי אפשר לשמור פוסט ריק. הקלד תוכן או שחזר את הטקסט הקודם.');
      body.focus();
      return;
    }
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
        alert(toHebrewError(err.message));
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
    alert(toHebrewError(err.message));
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">lock</span> שמור כסופי';
  }
}

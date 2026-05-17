// Auto-topic flow — Phase A (pre-research).
//
//   1. Render a list of discovered topic candidates as cards (title + description).
//   2. User clicks one → an inline expansion opens UNDER that card with a focus
//      textarea + confirm button. Clicking a different card moves the expansion
//      under the new one (state — the typed text — is preserved).
//   3. "אישור" → calls /select-topic which sets topic_brief + focus_notes,
//      then the index.js subscribe will trigger proposeQueries automatically.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';

const CATEGORY_LABEL = {
  geopolitics:        '🌍 גיאופוליטיקה',
  israel_economy:     '🇮🇱 כלכלת ישראל',
  israel_real_estate: '🏘️ נדל"ן בישראל',
  birmingham:         '🏙️ בירמינגהאם',
  us_macro:           '🇺🇸 מאקרו אמריקאי',
  other:              '🎯 אחר'
};

// One shared expansion element. Lives between cards — moved into whichever
// card the user picks. Preserves textarea state across selections naturally.
let expansionEl = null;
let confirmHandler = null;

function ensureExpansion() {
  if (expansionEl) return expansionEl;
  expansionEl = document.createElement('div');
  expansionEl.className = 'wa-topic-expansion';
  expansionEl.innerHTML = `
    <label class="wa-focus-label">מה חשוב לך שיתמקדו בו במחקר? (אופציונלי)</label>
    <textarea class="wa-focus-textarea" rows="3"
      placeholder='לדוגמה: תשווה עם המצב לפני שנה / תבדוק איך זה משפיע על משכנתאות בארה"ב / תפסיק על נקודת המבט של בנק ישראל…'></textarea>
    <button type="button" class="btn btn-primary wa-focus-confirm">
      אישור והמשך למחקר
      <span class="material-symbols-outlined">arrow_back</span>
    </button>
  `;
  const btn = expansionEl.querySelector('.wa-focus-confirm');
  btn.addEventListener('click', () => {
    if (typeof confirmHandler === 'function') confirmHandler();
  });
  // Stop card click from bubbling out of the expansion (e.g., textarea click
  // shouldn't trigger a card selection).
  expansionEl.addEventListener('click', (e) => e.stopPropagation());
  return expansionEl;
}

function getSelectedTopicId() {
  const parent = expansionEl?.parentElement;
  return parent?.dataset?.topicId || null;
}

function moveExpansionTo(card) {
  const ex = ensureExpansion();
  card.appendChild(ex);
  // Focus textarea so the user can start typing immediately.
  setTimeout(() => ex.querySelector('.wa-focus-textarea')?.focus(), 50);
}

function renderTopicCard(topic, onSelect, selectedId) {
  const card = document.createElement('div');
  card.className = 'wa-topic-card' + (topic.id === selectedId ? ' active' : '');
  card.dataset.topicId = topic.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const head = document.createElement('div');
  head.className = 'wa-topic-card-head';
  const cat = document.createElement('span');
  cat.className = 'wa-topic-category';
  cat.textContent = CATEGORY_LABEL[topic.category] || CATEGORY_LABEL.other;
  head.appendChild(cat);

  const title = document.createElement('div');
  title.className = 'wa-topic-card-title';
  title.textContent = topic.title;

  const desc = document.createElement('div');
  desc.className = 'wa-topic-card-desc';
  desc.textContent = topic.description;

  card.appendChild(head);
  card.appendChild(title);
  card.appendChild(desc);

  card.addEventListener('click', (e) => {
    // Ignore clicks that originated inside the expansion (textarea, button…).
    if (e.target.closest('.wa-topic-expansion')) return;
    onSelect(topic.id);
  });
  card.addEventListener('keydown', (e) => {
    // Only handle keys that target the card itself — never the textarea/inputs
    // nested inside the expansion. Otherwise space in the textarea would
    // re-trigger selection and look like a refresh bug.
    if (e.target !== card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(topic.id);
    }
  });
  return card;
}

export function renderDiscoveryBubble(container) {
  const state = Store.get();
  const session = state.session;
  if (!session) return;

  const wrap = document.createElement('div');
  wrap.className = 'wa-msg wa-msg-assistant wa-discovery-bubble';

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble wa-msg-discovery';

  // Title
  const title = document.createElement('div');
  title.className = 'wa-discovery-title';
  title.textContent = 'מצאתי כמה נושאים חמים מהשבוע האחרון. איזה מהם נחקור?';
  bubble.appendChild(title);

  // Loading state
  if (state.discoveringTopics) {
    const loader = document.createElement('div');
    loader.className = 'wa-discovery-loading';
    loader.innerHTML = `
      <span class="wa-typing"><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span></span>
      <span>מחפש נושאים…</span>
    `;
    bubble.appendChild(loader);
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    return;
  }

  // List of topic cards
  const list = document.createElement('div');
  list.className = 'wa-topic-list';
  bubble.appendChild(list);

  // Wire the confirm handler before rendering cards.
  confirmHandler = async () => {
    const topicId = getSelectedTopicId();
    if (!topicId || !session.id) return;
    const focusInput = expansionEl.querySelector('.wa-focus-textarea');
    const btn = expansionEl.querySelector('.wa-focus-confirm');
    const origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> שולח למחקר…';
    try {
      const { session: updated } = await ApiClient.selectTopic(session.id, {
        topic_id: topicId,
        focus_notes: (focusInput?.value || '').trim()
      });
      // Setting the session triggers index.js subscribe → proposeQueries kicks off.
      Store.setSession(updated);
    } catch (err) {
      console.error('Select topic failed', err);
      alert('שגיאה: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  };

  let selectedId = getSelectedTopicId();
  const cards = new Map();

  function onSelect(id) {
    selectedId = id;
    for (const [cid, card] of cards.entries()) {
      card.classList.toggle('active', cid === id);
    }
    moveExpansionTo(cards.get(id));
  }

  for (const t of state.topics) {
    const card = renderTopicCard(t, onSelect, selectedId);
    cards.set(t.id, card);
    list.appendChild(card);
  }

  // If we already had a selection before this render (e.g., re-render after
  // an unrelated state change), re-attach the expansion to the right card.
  if (selectedId && cards.has(selectedId)) {
    moveExpansionTo(cards.get(selectedId));
  }

  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

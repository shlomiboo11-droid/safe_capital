// Phase 6 — full sessions history modal: search, open, duplicate, delete.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { attachDragToDismiss } from './sheet-utils.js';

const STATUS_LABEL = {
  onboarding:      'בהמתנה',
  researching:     'במהלך מחקר',
  research_review: 'סקירת מחקר',
  writing:         'בכתיבה',
  done:            'הושלם',
  archived:        'בארכיון'
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return ''; }
}

let cachedSessions = [];

function renderItem(s, container) {
  const item = document.createElement('div');
  item.className = 'wa-session-item';
  item.dataset.sessionId = s.id;

  const left = document.createElement('div');
  left.className = 'wa-session-item-main';

  const title = document.createElement('div');
  title.className = 'wa-session-item-title';
  title.textContent = s.title || 'סשן ללא כותרת';
  left.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'wa-session-item-meta';
  meta.textContent = `${STATUS_LABEL[s.status] || s.status} · ${formatDate(s.updated_at)}`;
  left.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'wa-session-item-actions';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'wa-session-action';
  openBtn.title = 'פתח';
  openBtn.innerHTML = '<span class="material-symbols-outlined">arrow_back</span>';
  openBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const fresh = await ApiClient.getSession(s.id);
      Store.setSession(fresh.session, { findings: fresh.findings });
      closeModal();
    } catch (err) {
      console.error('Failed to load session', err);
      alert('שגיאה בטעינה: ' + err.message);
    }
  });

  const dupBtn = document.createElement('button');
  dupBtn.type = 'button';
  dupBtn.className = 'wa-session-action';
  dupBtn.title = 'שכפל הגדרות';
  dupBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
  dupBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('לשכפל את ההגדרות של הסשן הזה לסשן חדש?')) return;
    try {
      const { session: dup } = await ApiClient.duplicateSession(s.id);
      Store.setSession(dup);
      closeModal();
    } catch (err) {
      console.error('Duplicate failed', err);
      alert('שגיאה: ' + err.message);
    }
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'wa-session-action wa-session-action-danger';
  delBtn.title = 'מחק';
  delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`למחוק לצמיתות את "${s.title || 'הסשן הזה'}"? הפעולה לא הפיכה.`)) return;
    try {
      await ApiClient.deleteSession(s.id);
      cachedSessions = cachedSessions.filter(x => x.id !== s.id);
      renderList(getSearchValue());
      // If the deleted session is the active one, clear it.
      if (Store.get().session?.id === s.id) {
        Store.clearSession();
        history.replaceState(null, '', window.location.pathname);
      }
    } catch (err) {
      console.error('Delete failed', err);
      alert('שגיאה: ' + err.message);
    }
  });

  actions.appendChild(openBtn);
  actions.appendChild(dupBtn);
  actions.appendChild(delBtn);

  item.appendChild(left);
  item.appendChild(actions);

  // Click on row (not on action) → open
  item.addEventListener('click', () => openBtn.click());

  container.appendChild(item);
}

function getSearchValue() {
  return (document.getElementById('waSessionsSearch')?.value || '').trim().toLowerCase();
}

function renderList(query) {
  const listEl = document.getElementById('waSessionsList');
  if (!listEl) return;

  const filtered = query
    ? cachedSessions.filter(s =>
        (s.title || '').toLowerCase().includes(query)
        || (STATUS_LABEL[s.status] || '').toLowerCase().includes(query))
    : cachedSessions;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="wa-sessions-empty">${query ? 'לא נמצאו התאמות.' : 'עדיין אין סשנים קודמים.'}</div>`;
    return;
  }
  for (const s of filtered) renderItem(s, listEl);
}

function closeModal() {
  document.getElementById('waSessionsOverlay').classList.add('hidden');
}

export function initSessionsList() {
  const overlay = document.getElementById('waSessionsOverlay');
  const closeBtn = document.getElementById('waSessionsClose');
  const modalBody = overlay.querySelector('.wa-modal-body');

  // Inject search field once (if not already present)
  if (!document.getElementById('waSessionsSearch')) {
    const wrap = document.createElement('div');
    wrap.className = 'wa-sessions-search-row';
    wrap.innerHTML = `
      <span class="material-symbols-outlined wa-search-icon">search</span>
      <input type="search" id="waSessionsSearch"
             placeholder="חיפוש לפי כותרת או סטטוס…"
             class="wa-sessions-search-input">
    `;
    modalBody.insertBefore(wrap, modalBody.firstChild);
    wrap.querySelector('input').addEventListener('input', (e) => {
      renderList(e.target.value.trim().toLowerCase());
    });
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  attachDragToDismiss(overlay, closeModal);

  async function open() {
    overlay.classList.remove('hidden');
    const listEl = document.getElementById('waSessionsList');
    listEl.innerHTML = '<div class="wa-sessions-empty">טוען…</div>';
    try {
      const { sessions } = await ApiClient.listSessions();
      cachedSessions = sessions || [];
      renderList(getSearchValue());
    } catch (err) {
      console.error('Failed to list sessions', err);
      listEl.innerHTML = '<div class="wa-sessions-empty">שגיאה בטעינה.</div>';
    }
  }

  return { open, close: closeModal };
}

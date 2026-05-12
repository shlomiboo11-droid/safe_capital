// Renders the proposed queries inline as a special assistant bubble.
// Lets the user check/uncheck, edit text, remove, and add custom queries.
// Hands the final list to ApiClient.saveQueries + ApiClient.startResearch.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';

function uid() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function renderQuery(q, onChange, onRemove) {
  const row = document.createElement('div');
  row.className = 'wa-query-row';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = q.enabled !== false;
  cb.className = 'wa-query-checkbox';
  cb.addEventListener('change', () => {
    q.enabled = cb.checked;
    onChange();
  });

  const body = document.createElement('div');
  body.className = 'wa-query-body';

  const text = document.createElement('div');
  text.className = 'wa-query-text';
  text.contentEditable = 'true';
  text.spellcheck = false;
  text.textContent = q.text;
  text.addEventListener('blur', () => {
    q.text = text.textContent.trim();
    onChange();
  });

  const meta = document.createElement('div');
  meta.className = 'wa-query-meta';
  const langChip = document.createElement('span');
  langChip.className = 'wa-query-lang';
  langChip.textContent = q.lang === 'he' ? 'עברית' : 'אנגלית';
  langChip.title = 'לחץ להחלפת שפת חיפוש';
  langChip.addEventListener('click', () => {
    q.lang = q.lang === 'he' ? 'en' : 'he';
    langChip.textContent = q.lang === 'he' ? 'עברית' : 'אנגלית';
    onChange();
  });
  meta.appendChild(langChip);

  if (q.rationale) {
    const why = document.createElement('span');
    why.className = 'wa-query-rationale';
    why.textContent = q.rationale;
    meta.appendChild(why);
  }

  body.appendChild(text);
  body.appendChild(meta);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'wa-query-remove';
  rm.title = 'הסר שאילתה';
  rm.innerHTML = '<span class="material-symbols-outlined">close</span>';
  rm.addEventListener('click', onRemove);

  row.appendChild(cb);
  row.appendChild(body);
  row.appendChild(rm);
  return row;
}

export function renderQueriesBubble(container, queries, opts = {}) {
  // Mutating-by-reference for simplicity inside this small component
  const queriesRef = queries.slice();
  let busy = false;

  const wrap = document.createElement('div');
  wrap.className = 'wa-msg wa-msg-assistant wa-queries-bubble';

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble wa-msg-queries';

  const title = document.createElement('div');
  title.className = 'wa-queries-title';
  title.textContent = 'הנה שאילתות המחקר שאני מציע. בחר את אלו שיריצו אותן, ערוך/מחק לפי הצורך, או הוסף משלך.';
  bubble.appendChild(title);

  const list = document.createElement('div');
  list.className = 'wa-queries-list';
  bubble.appendChild(list);

  function commit() { /* called by row events; just keeps queriesRef synced */ }

  function repaint() {
    list.innerHTML = '';
    for (const q of queriesRef) {
      const row = renderQuery(q, commit, () => {
        const idx = queriesRef.indexOf(q);
        if (idx >= 0) queriesRef.splice(idx, 1);
        repaint();
      });
      list.appendChild(row);
    }
  }
  repaint();

  // Add-custom + Run row
  const actions = document.createElement('div');
  actions.className = 'wa-queries-actions';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'wa-queries-add';
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span> הוסף שאילתה';
  addBtn.addEventListener('click', () => {
    queriesRef.push({ id: uid(), text: '', lang: 'en', rationale: '', enabled: true });
    repaint();
    // Focus the new row's text
    const lastRow = list.lastElementChild;
    lastRow?.querySelector('.wa-query-text')?.focus();
  });

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn btn-primary wa-queries-run';
  runBtn.innerHTML = '<span class="material-symbols-outlined">search</span> אשר והתחל מחקר';
  runBtn.addEventListener('click', async () => {
    if (busy) return;
    const session = Store.get().session;
    if (!session) return;
    const valid = queriesRef.filter(q => q.text && q.enabled !== false);
    if (valid.length === 0) {
      alert('צריך לפחות שאילתה אחת מסומנת.');
      return;
    }
    busy = true;
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> מתחיל…';
    try {
      await ApiClient.saveQueries(session.id, queriesRef);
      Store.setQueries(queriesRef.slice());
      await ApiClient.startResearch(session.id);
      Store.setStatus('researching');
      Store.setResearchRunning(true);
      opts.onStarted?.();
    } catch (err) {
      console.error('Failed to start research', err);
      alert('שגיאה בהתחלת מחקר: ' + err.message);
      runBtn.disabled = false;
      runBtn.innerHTML = '<span class="material-symbols-outlined">search</span> אשר והתחל מחקר';
      busy = false;
    }
  });

  actions.appendChild(addBtn);
  actions.appendChild(runBtn);
  bubble.appendChild(actions);

  wrap.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'wa-msg-meta';
  meta.textContent = 'הצעות הסוכן';
  wrap.appendChild(meta);

  container.appendChild(wrap);
}

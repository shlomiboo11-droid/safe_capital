// Renders the proposed queries inline as a special assistant bubble.
// Lets the user check/uncheck, edit text, remove, and add custom queries.
// Hands the final list to ApiClient.saveQueries + ApiClient.startResearch.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { resetTopicSelection } from './topic-discovery.js';
import { toHebrewError } from './error-text.js';

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

  // (Remove-button (X) intentionally omitted — the checkbox already lets the
  // user opt out of a query. Keeping the row clean leaves more room for the
  // query text on narrow screens.)
  void onRemove;

  row.appendChild(cb);
  row.appendChild(body);
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
    // Write through to the Store. Pushing only into the local copy meant the
    // next chat re-render rebuilt this bubble from state.queries and the added
    // row was gone (A2#9).
    Store.setQueries(queriesRef.slice());
    // Store.subscribe → chat-view re-render is SYNCHRONOUS (state.js emit), so
    // by now this whole bubble has been rebuilt and `list` above is detached.
    // Focus must go through the LIVE DOM, not the closure variable.
    document.querySelector('.wa-queries-list')?.lastElementChild
      ?.querySelector('.wa-query-text')?.focus();
  });

  // A2#4 — the way back to the topic list. The discovery bubble only renders
  // while the session has no topic_brief, and nothing ever cleared it, so a
  // wrong pick could only be undone by opening a NEW session — i.e. paying for
  // topic discovery all over again. The topics themselves are already stored in
  // discovered_topics; bringing them back costs nothing.
  //
  // Only offered while `opts.canChangeTopic` (see chat-view): before research
  // started, and only in the auto-topic flow where there IS a list to go back
  // to. Clearing topic_brief in the manual flow would leave an empty screen.
  let changeBtn = null;
  if (opts.canChangeTopic) {
    changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'wa-queries-add';
    changeBtn.innerHTML = '<span class="material-symbols-outlined">swap_horiz</span> החלף נושא';
    changeBtn.addEventListener('click', async () => {
      if (busy) return;
      const session = Store.get().session;
      if (!session) return;
      // X3 — never spend money silently. Re-picking a topic triggers a fresh
      // (paid) query-building call, so say so before, not after.
      if (!confirm('לחזור לרשימת הנושאים ולבחור מחדש?\n\nהשאילתות שנבנו לנושא הנוכחי יימחקו, ובחירת נושא חדש תבנה שאילתות מחדש — קריאה בתשלום ל-Claude. רשימת הנושאים עצמה כבר שמורה ולא עולה כלום.')) return;
      busy = true;
      changeBtn.disabled = true;
      runBtn.disabled = true;
      const origHTML = changeBtn.innerHTML;
      changeBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> מחזיר…';
      try {
        // Order matters. Clearing the topic FIRST means a failure on the second
        // call leaves the session without a topic — harmless, and /select-topic
        // wipes proposed_queries itself when the user picks again. The reverse
        // order would leave a topic with no queries, which index.js reads as
        // "queries are missing" and answers with a paid rebuild the user never
        // asked for.
        const { session: updated } = await ApiClient.patchSession(session.id, {
          topic_brief: null,
          focus_notes: null
        });
        // Old queries belong to the old topic. Leaving them is the silent
        // failure this fix exists to avoid: queries for topic A under topic B.
        await ApiClient.saveQueries(session.id, []);
        resetTopicSelection();
        Store.setSession(updated, { queries: [] });
      } catch (err) {
        console.error('Change topic failed', err);
        alert(toHebrewError(err.message));
        changeBtn.disabled = false;
        runBtn.disabled = false;
        changeBtn.innerHTML = origHTML;
        busy = false;
      }
    });
  }

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
  if (changeBtn) actions.appendChild(changeBtn);
  actions.appendChild(runBtn);
  bubble.appendChild(actions);

  wrap.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'wa-msg-meta';
  meta.textContent = 'הצעות הסוכן';
  wrap.appendChild(meta);

  container.appendChild(wrap);
}

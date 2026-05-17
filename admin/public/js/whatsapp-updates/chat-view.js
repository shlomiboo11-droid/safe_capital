// Renders chat bubbles. Reads from Store, observes changes.

import { Store } from './state.js';
import { renderQueriesBubble } from './query-list.js';
import { ApiClient } from './api-client.js';
import { attachSelectionPopover, detachAllPopovers } from './selection-popover.js';
import { renderWritingBubble } from './writing-view.js';
import { renderDiscoveryBubble } from './topic-discovery.js';
import { setMarkdown } from './markup.js';

const STATUS_LABELS = {
  onboarding:      'המתנה להתחלה',
  researching:     'במהלך מחקר',
  research_review: 'סקירת מחקר',
  writing:         'בכתיבה',
  done:            'מוכן',
  archived:        'בארכיון'
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Strip the trailing "מקורות:" / "Sources:" section from a research summary.
 * Sources are shown separately in the research panel so we don't need them
 * cluttering the chat bubble.
 */
function stripSourcesSection(text) {
  if (!text) return '';
  // Match "**מקורות:**" / "*מקורות*" / "מקורות:" / "Sources:" anywhere on its own line
  const pattern = /\n\s*\*{0,2}\s*(?:מקורות|מקור|Sources?)\s*:?\s*\*{0,2}\s*\n[\s\S]*$/i;
  return text.replace(pattern, '').trimEnd();
}

function renderMessage(msg) {
  const el = document.createElement('div');
  el.className = 'wa-msg wa-msg-' + (msg.role || 'assistant');
  el.dataset.messageId = msg.id;

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble';
  bubble.textContent = msg.content || '';
  el.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'wa-msg-meta';
  meta.textContent = formatTime(msg.created_at);
  el.appendChild(meta);

  return el;
}

function renderSummaryBubble(container, summary, sessionId, onAccept) {
  const wrap = document.createElement('div');
  wrap.className = 'wa-msg wa-msg-assistant wa-summary-bubble';

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble wa-msg-summary';

  const title = document.createElement('div');
  title.className = 'wa-summary-title';

  const titleText = document.createElement('span');
  titleText.textContent = 'סיכום המחקר';
  title.appendChild(titleText);

  // Hint about selection
  const hint = document.createElement('span');
  hint.className = 'wa-summary-hint';
  hint.textContent = ' · סמן טקסט לתיקון נקודתי';
  title.appendChild(hint);

  bubble.appendChild(title);

  const body = document.createElement('div');
  body.className = 'wa-summary-body';
  setMarkdown(body, stripSourcesSection(summary || ''));
  bubble.appendChild(body);

  // Wire selection popover on this body
  attachSelectionPopover(body);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'wa-summary-actions';

  const accept = document.createElement('button');
  accept.className = 'btn btn-primary';
  accept.innerHTML = '<span class="material-symbols-outlined">check</span> אשר ועבור לכתיבה';
  accept.addEventListener('click', onAccept);

  const freeEdit = document.createElement('button');
  freeEdit.className = 'btn btn-secondary';
  freeEdit.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
  freeEdit.addEventListener('click', () => toggleFreeEdit(body, sessionId, accept, freeEdit));

  actions.appendChild(accept);
  actions.appendChild(freeEdit);
  bubble.appendChild(actions);

  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

function toggleFreeEdit(body, sessionId, acceptBtn, freeEditBtn) {
  const isEditing = body.dataset.editing === '1';
  if (!isEditing) {
    // Enter edit mode
    detachAllPopovers();
    const original = body.textContent;
    body.dataset.originalText = original;
    body.dataset.editing = '1';
    body.contentEditable = 'true';
    body.classList.add('wa-summary-editing');
    body.focus();
    freeEditBtn.innerHTML = '<span class="material-symbols-outlined">save</span> שמור עריכה';
    acceptBtn.disabled = true;
  } else {
    // Save edit
    const newFull = body.textContent;
    body.contentEditable = 'false';
    body.classList.remove('wa-summary-editing');
    body.dataset.editing = '';
    freeEditBtn.disabled = true;
    freeEditBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> שומר…';
    ApiClient.manualEdit(sessionId, newFull)
      .then(() => {
        freeEditBtn.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
        freeEditBtn.disabled = false;
        acceptBtn.disabled = false;
        // Refresh session so future selection-edits use the new full text.
        return ApiClient.getSession(sessionId);
      })
      .then((data) => { if (data) Store.setSession(data.session, { findings: data.findings }); })
      .catch((err) => {
        console.error('Manual edit failed', err);
        alert('שגיאה בשמירת העריכה: ' + err.message);
        body.textContent = body.dataset.originalText || newFull;
        freeEditBtn.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
        freeEditBtn.disabled = false;
        acceptBtn.disabled = false;
      });
  }
}

function renderTypingBubble(container, label, sessionId) {
  const wrap = document.createElement('div');
  wrap.className = 'wa-msg wa-msg-assistant wa-typing-bubble';

  const bubble = document.createElement('div');
  bubble.className = 'wa-msg-bubble';

  const typing = document.createElement('span');
  typing.className = 'wa-typing';
  typing.innerHTML = '<span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span>';
  bubble.appendChild(typing);

  if (label) {
    const lbl = document.createElement('span');
    lbl.className = 'wa-typing-label';
    lbl.textContent = ' ' + label;
    bubble.appendChild(lbl);
  }

  // Stop button — lets the user cut research short.
  if (sessionId) {
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'wa-stop-btn';
    stop.innerHTML = '<span class="material-symbols-outlined">stop_circle</span> עצור מחקר';
    stop.addEventListener('click', async () => {
      stop.disabled = true;
      stop.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> עוצר…';
      try {
        await ApiClient.stopResearch(sessionId);
      } catch (err) {
        console.error('Stop failed', err);
      }
    });
    bubble.appendChild(stop);
  }

  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

export function initChatView() {
  const emptyEl  = document.getElementById('waEmptyState');
  const listEl   = document.getElementById('waMessages');
  const composer = document.getElementById('waComposer');
  const title    = document.getElementById('waSessionTitle');
  const chip     = document.getElementById('waStatusChip');
  const chipText = document.getElementById('waStatusText');

  // Snapshot of what's actually rendered in the chat. We only rebuild the
  // message list when one of these values changes — NOT on every Store emit.
  // This stops the "page refresh" flicker that happened every time tokens_used
  // or estimated_cost_usd ticked during research (polling, SSE, auto-save).
  let prev = { sid: null };
  function snapshot(state) {
    const s = state.session;
    return {
      sid: s ? s.id : null,
      title: s ? s.title : '',
      status: s ? s.status : '',
      hasTopicBrief: !!(s && s.topic_brief),
      msgCount: state.messages.length,
      lastMsgId: state.messages.length ? state.messages[state.messages.length - 1].id : '',
      topicCount: state.topics.length,
      queryCount: state.queries.length,
      summaryLen: state.research.summary ? state.research.summary.length : 0,
      postContent: state.post.content || '',
      postGenerating: !!state.post.generating,
      discovering: !!state.discoveringTopics
    };
  }

  Store.subscribe((state) => {
    const hasSession = !!state.session;
    emptyEl.style.display  = hasSession ? 'none' : '';
    listEl.style.display   = hasSession ? '' : 'none';
    composer.style.display = hasSession ? '' : 'none';

    if (!hasSession) {
      title.textContent = 'סשן חדש';
      chip.dataset.status = 'onboarding';
      chipText.textContent = STATUS_LABELS.onboarding;
      prev = { sid: null };
      return;
    }

    // Topbar text always updates (cheap — single textContent assignments).
    title.textContent = state.session.title || 'סשן ללא שם';
    const status = state.session.status || 'onboarding';
    chip.dataset.status = status;
    chipText.textContent = STATUS_LABELS[status] || status;

    // Diff check — bail before the expensive listEl.innerHTML wipe + loop.
    const snap = snapshot(state);
    const unchanged = prev.sid === snap.sid
      && prev.title === snap.title
      && prev.status === snap.status
      && prev.hasTopicBrief === snap.hasTopicBrief
      && prev.msgCount === snap.msgCount
      && prev.lastMsgId === snap.lastMsgId
      && prev.topicCount === snap.topicCount
      && prev.queryCount === snap.queryCount
      && prev.summaryLen === snap.summaryLen
      && prev.postContent === snap.postContent
      && prev.postGenerating === snap.postGenerating
      && prev.discovering === snap.discovering;
    if (unchanged) return;   // no visible chat change — skip render
    prev = snap;

    listEl.innerHTML = '';

    // 1. Render chat messages
    for (const msg of state.messages) {
      listEl.appendChild(renderMessage(msg));
    }

    // 2a. Auto-topic flow: discovery bubble shown while we have topic candidates
    //     but no topic_brief yet, OR while topics are being discovered.
    const isAutoFlow = !state.session.topic_brief
                    && (state.discoveringTopics || (Array.isArray(state.topics) && state.topics.length > 0));
    if (isAutoFlow && status === 'onboarding') {
      renderDiscoveryBubble(listEl);
    }

    // 2b. Render queries bubble if available and we're still before/around research
    const showQueries = Array.isArray(state.queries) && state.queries.length > 0
                     && ['onboarding', 'researching', 'research_review'].includes(status);
    if (showQueries && status === 'onboarding') {
      renderQueriesBubble(listEl, state.queries, {
        onStarted: () => { /* status flip handled by store */ }
      });
    }

    // 3. Live typing/summarizing indicator (with Stop button).
    // Source of truth: session.status — more reliable than the in-memory
    // research.running flag which can drift if SSE drops or re-connects.
    if (status === 'researching') {
      renderTypingBubble(listEl, 'הסוכן חוקר. עקוב אחרי הממצאים בצד.', state.session.id);
    }

    // 4. Render summary bubble once ready
    if (state.research.summary && (status === 'research_review' || status === 'writing' || status === 'done')) {
      renderSummaryBubble(listEl, state.research.summary, state.session.id,
        async () => {
          try {
            const { session } = await ApiClient.acceptResearch(state.session.id);
            Store.setSession(session);
          } catch (err) {
            console.error('Accept failed', err);
            alert('שגיאה: ' + err.message);
          }
        }
      );
    }

    // 5. Writing stage — show the post bubble once we have a draft
    if ((status === 'writing' || status === 'done') && state.post.content) {
      renderWritingBubble(listEl);
    } else if (state.post.generating) {
      const typing = document.createElement('div');
      typing.className = 'wa-msg wa-msg-assistant';
      typing.innerHTML = '<div class="wa-msg-bubble"><span class="wa-typing"><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span></span><span class="wa-typing-label"> מייצר טיוטה ב-Opus…</span></div>';
      listEl.appendChild(typing);
    }

    // Smart auto-scroll — only snap to the bottom if the user is ALREADY
    // near the bottom. If they've scrolled up to re-read something, leave
    // their scroll position alone. Background ticks (poll, SSE, auto-save)
    // shouldn't yank them out of context.
    requestAnimationFrame(() => {
      const area = document.getElementById('waChatArea');
      if (!area) return;
      const distanceFromBottom = area.scrollHeight - (area.scrollTop + area.clientHeight);
      if (distanceFromBottom < 120) {
        area.scrollTop = area.scrollHeight;
      }
    });
  });
}

// Renders chat bubbles. Reads from Store, observes changes.

import { Store, missingQueries } from './state.js';
import { renderQueriesBubble } from './query-list.js';
import { ApiClient } from './api-client.js';
import { attachSelectionPopover, detachAllPopovers } from './selection-popover.js';
import { renderWritingBubble } from './writing-view.js';
import { renderDiscoveryBubble } from './topic-discovery.js';
import { setMarkdown, stripSourcesSection } from './markup.js';
import { serializeDom } from './raw-text-map.js';
import { STATUS_LABELS } from './status-labels.js';
import { toHebrewError } from './error-text.js';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
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

// `canAccept` — A1#5. The summary bubble is deliberately shown in 'writing' and
// 'done' too (you still want to read the research while the post is written),
// but "אשר ועבור לכתיבה" only means something in 'research_review'. Rendering it
// unconditionally meant that in 'writing' every press hit /research/accept,
// matched 0 rows and returned a 404 whose English text ("Session not found or
// not ready") also lied — the session exists, it's just past this step.
function renderSummaryBubble(container, summary, sessionId, onAccept, canAccept) {
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

  let accept = null;
  if (canAccept) {
    accept = document.createElement('button');
    accept.className = 'btn btn-primary';
    accept.innerHTML = '<span class="material-symbols-outlined">check</span> אשר ועבור לכתיבה';
    accept.addEventListener('click', onAccept);
  }

  const freeEdit = document.createElement('button');
  freeEdit.className = 'btn btn-secondary';
  freeEdit.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
  // `accept` is null in 'writing'/'done'. toggleFreeEdit already guards every
  // read of it — see the note there; free editing must keep working in all
  // three states, and it fails SILENTLY (console TypeError) if that breaks.
  freeEdit.addEventListener('click', () => toggleFreeEdit(body, sessionId, accept, freeEdit, summary || ''));

  if (accept) actions.appendChild(accept);
  actions.appendChild(freeEdit);
  bubble.appendChild(actions);

  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

// A3#3 — free edit on the summary is a RAW text box (product decision 5).
//
// The rendered summary can't be translated back losslessly (formatMarkdown
// drops `#`, `**` vs `*`, `---` lines and extra blank lines), and the bubble
// only shows `stripSourcesSection(summary)` while the save writes the FULL
// summary — so reading the screen also deleted the sources section every time.
// Editing the raw text instead removes both problems at the root: the markers
// are visible while editing, and what's saved is exactly what's in the box.
function toggleFreeEdit(body, sessionId, acceptBtn, freeEditBtn, fallbackRaw) {
  const isEditing = body.dataset.editing === '1';
  if (!isEditing) {
    // Enter edit mode — show the stored text as-is, asterisks and all.
    detachAllPopovers();
    const raw = Store.get().research.summary || fallbackRaw || '';
    body.dataset.originalText = raw;
    body.dataset.editing = '1';
    body.textContent = raw;
    body.contentEditable = 'true';
    body.classList.add('wa-summary-editing');
    body.focus();
    freeEditBtn.innerHTML = '<span class="material-symbols-outlined">save</span> שמור עריכה';
    // acceptBtn is null in 'writing'/'done' (A1#5) — every one of the three
    // reads below MUST stay guarded, or free editing dies with a silent
    // TypeError exactly in the states where the accept button is gone.
    if (acceptBtn) acceptBtn.disabled = true;
  } else {
    // Save edit — serializeDom turns the browser's <div>/<br> line breaks back
    // into real "\n" (textContent silently dropped them — A3#3 / A4#13).
    const newFull = serializeDom(body, { bold: false });
    const previous = body.dataset.originalText || '';
    body.contentEditable = 'false';
    body.classList.remove('wa-summary-editing');
    body.dataset.editing = '';
    freeEditBtn.disabled = true;
    freeEditBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> שומר…';
    ApiClient.manualEdit(sessionId, newFull)
      .then(() => {
        // Back to the formatted view of what was actually saved.
        setMarkdown(body, stripSourcesSection(newFull));
        freeEditBtn.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
        freeEditBtn.disabled = false;
        if (acceptBtn) acceptBtn.disabled = false;
        // Refresh session so future selection-edits use the new full text.
        return ApiClient.getSession(sessionId);
      })
      .then((data) => { if (data) Store.setSession(data.session, { findings: data.findings }); })
      .catch((err) => {
        console.error('Manual edit failed', err);
        alert('שגיאה בשמירת העריכה: ' + err.message);
        setMarkdown(body, stripSourcesSection(previous || newFull));
        freeEditBtn.innerHTML = '<span class="material-symbols-outlined">edit_note</span> ערוך טקסט חופשית';
        freeEditBtn.disabled = false;
        if (acceptBtn) acceptBtn.disabled = false;
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
        // Stopping only ends the query loop — the runner still summarizes what
        // it collected, and the status is already 'research_review' by now.
        // Mark it so the "restart research" button stays hidden until the
        // summary lands; restarting here would double-charge the API and later
        // overwrite the summary the user may already have edited.
        Store.setSummarizing(true);
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
      summarizing: !!state.research.summarizing,
      // A3#15 — the pacing note lives in the typing-bubble label. Leaving it out
      // of the diff below means the store updates and the label never redraws.
      pacing: state.research.pacing ? (state.research.pacing.index + '/' + state.research.pacing.of) : '',
      postContent: state.post.content || '',
      postGenerating: !!state.post.generating,
      discovering: !!state.discoveringTopics,
      // A2#1 / A3#5 — both of these are the ONLY thing that changes when a
      // non-fatal problem or the "building queries" state appears. If they
      // aren't in the diff below the store updates and the screen never
      // redraws, which looks exactly like the bug we're fixing.
      proposing: !!state.proposingQueries,
      error: state.error || ''
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
      && prev.summarizing === snap.summarizing
      && prev.pacing === snap.pacing
      && prev.postContent === snap.postContent
      && prev.postGenerating === snap.postGenerating
      && prev.discovering === snap.discovering
      && prev.proposing === snap.proposing
      && prev.error === snap.error;
    if (unchanged) return;   // no visible chat change — skip render

    // A3#9 — an inline diff is waiting for the user's וי/איקס. The edit is
    // already committed server-side, so the very next refresh carries a NEW
    // summary length and would wipe the list — deleting the reject button
    // within milliseconds and making the edit irreversible. Hold the DOM still
    // while only the summary changed; both buttons redraw the bubble themselves,
    // and anything more substantial (another session, a status flip, a new
    // message, a new post) still renders so the screen can't freeze.
    if (listEl.querySelector('.wa-diff-block')
        && prev.sid === snap.sid
        && prev.status === snap.status
        && prev.msgCount === snap.msgCount
        && prev.lastMsgId === snap.lastMsgId
        && prev.postContent === snap.postContent
        && prev.postGenerating === snap.postGenerating) {
      return;
    }
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
    // Shown while onboarding, and again in research_review when the run is
    // really over and produced no summary (research failed) so it can be retried.
    // NEVER while 'researching' — starting a second run mid-flight would produce
    // a premature summary over partial findings. And NEVER while `summarizing`:
    // /research/stop flips the status to research_review while the summary is
    // still being generated, and a retry in that window would double-charge the
    // API and later overwrite the summary. (The server refuses it too — 409
    // from /research/start — this just keeps the button out of sight.)
    if (showQueries && (status === 'onboarding'
                        || (status === 'research_review'
                            && !state.research.summary
                            && !state.research.summarizing))) {
      renderQueriesBubble(listEl, state.queries, {
        onStarted: () => { /* status flip handled by store */ },
        // A2#4 — the way back to the topic list. Three conditions, all needed:
        //   'onboarding'      → research hasn't started; afterwards the queries
        //                       already produced findings and swapping the topic
        //                       under them would be nonsense.
        //   topics.length > 0 → auto-topic flow only. In the manual flow there
        //                       is no list to come back to, so clearing
        //                       topic_brief would leave a blank screen.
        //   topic_brief       → there is something to change.
        canChangeTopic: status === 'onboarding'
                        && !!state.session.topic_brief
                        && Array.isArray(state.topics) && state.topics.length > 0,
        // The two recovery buttons, both live only in the state this branch
        // already narrowed to: research is over, findings exist, no summary was
        // ever produced. That is exactly the shape a killed run leaves behind.
        // A number, not a boolean — the labels count what they act on.
        canSummarizeExisting: (status === 'research_review' && state.findings.length > 0)
                        ? state.findings.length : 0,
        // `findings.length > 0` is load-bearing: with nothing collected at all,
        // "run the 10 that didn't run" and "אשר והתחל מחקר" are the same button
        // with two labels. Resuming only means something once part of the run
        // actually landed.
        missingCount: (status === 'research_review' && state.findings.length > 0)
                        ? missingQueries(state).length : 0
      });
    }

    // 3. Live typing/summarizing indicator (with Stop button).
    // Source of truth: session.status — more reliable than the in-memory
    // research.running flag which can drift if SSE drops or re-connects.
    // The indicator must survive the status flip that /research/stop does:
    // the summary is still being generated at that point, so without this the
    // screen would look idle. No Stop button while summarizing — stopping only
    // affects the query loop, which is already over by then.
    const summarizing = !!state.research.summarizing && !state.research.summary;
    if (status === 'researching' || (status === 'research_review' && summarizing)) {
      // A3#15 — the runner deliberately idles 25-35s between queries to stay
      // under the Anthropic per-minute limit. That gap used to look identical
      // to a dead run; the `pacing` event says where we are, so say it.
      const p = state.research.pacing;
      const researchLabel = (p && !summarizing)
        ? `הסוכן חוקר (שאילתה ${p.index} מתוך ${p.of}). עקוב אחרי הממצאים בצד.`
        : 'הסוכן חוקר. עקוב אחרי הממצאים בצד.';
      renderTypingBubble(
        listEl,
        summarizing ? 'מסכם את הממצאים…' : researchLabel,
        summarizing ? null : state.session.id
      );
    } else if (state.proposingQueries) {
      // A2#1 — the gap between "אישור והמשך למחקר" and the queries bubble. Same
      // typing animation used during research; no Stop button, there is nothing
      // to stop yet.
      renderTypingBubble(listEl, 'בונה שאילתות מחקר…', null);
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
            alert(toHebrewError(err.message));
          }
        },
        // A1#5 — only 'research_review' can actually be accepted. Note this
        // reads the STORE status, so the local-only setStatus('research_review')
        // escape hatch (index.js, 0-findings summary) still shows the button.
        status === 'research_review'
      );
    }

    // 5. Writing stage — show the post bubble once we have a draft.
    // `generating` is checked FIRST on purpose: the store no longer clears
    // post.content on a same-session refresh (state.js), so after "צור טיוטה
    // ראשונה" the old post is still there. Checking content first would let it
    // win and the "מייצר טיוטה ב-Opus…" indicator would never appear.
    if (state.post.generating) {
      const typing = document.createElement('div');
      typing.className = 'wa-msg wa-msg-assistant';
      typing.innerHTML = '<div class="wa-msg-bubble"><span class="wa-typing"><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span><span class="wa-typing-dot"></span></span><span class="wa-typing-label"> מייצר טיוטה ב-Opus…</span></div>';
      listEl.appendChild(typing);
    } else if ((status === 'writing' || status === 'done') && state.post.content) {
      renderWritingBubble(listEl);
    }

    // 6. A2#1 / A3#5 — the one place a non-fatal problem is shown.
    // `state.error` had four writers and zero readers: every failure between
    // "the user picked a topic" and "the research ended" was stored and never
    // displayed, so the screen just froze. Rendered through the SAME bubble
    // component as a normal message — no new markup, no new styling — and last
    // in the list so the auto-scroll below brings it into view.
    if (state.error) {
      listEl.appendChild(renderMessage({
        id: 'wa-error-notice',
        role: 'assistant',
        content: '⚠️ ' + state.error,
        created_at: new Date().toISOString()
      }));
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

// Entry point — bootstraps the WhatsApp Updates page.
// Phase 1: shell + Onboarding + basic chat.
// Phase 2: query proposal, research execution via SSE, research summary.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { initChatView } from './chat-view.js';
import { initComposer } from './composer.js';
import { initOnboardingModal } from './onboarding-modal.js';
import { initSessionsList } from './sessions-list.js';
import { initResearchPanel } from './research-panel.js';
import { initWritingConfigModal } from './writing-config-modal.js';
import { connectStream } from './sse-client.js';
import { friendlyClaudeError } from './error-text.js';

function gateAuth() {
  if (!API.isLoggedIn()) {
    window.location.href = '/login';
    return false;
  }
  const user = API.getUser();
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarRole = document.getElementById('sidebar-role');
  if (user) {
    if (sidebarUsername) sidebarUsername.textContent = user.full_name || user.email;
    if (sidebarRole) sidebarRole.textContent = user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל';
    if (user.role === 'super_admin') {
      const navUsers = document.getElementById('nav-users');
      if (navUsers) navUsers.style.display = '';
    }
  }
  return true;
}

function wireSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Keep the hamburger working if it's visible (it's only hidden on mobile via CSS).
  if (toggle) {
    toggle.addEventListener('click', () => openSidebar());
  }

  // Backdrop element (created once, lives in DOM permanently).
  const backdrop = document.createElement('div');
  backdrop.className = 'wa-sidebar-backdrop';
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', closeSidebar);

  function openSidebar() {
    sidebar.classList.add('open');
    document.body.classList.add('wa-sidebar-open');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    document.body.classList.remove('wa-sidebar-open');
  }

  // Close on ESC for desktop keyboard users.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  // Mobile only: edge-swipe-from-right opens the sidebar.
  //   - Touch must start within EDGE_PX of the right edge of the screen.
  //   - Drag at least OPEN_THRESHOLD_PX to the left to commit.
  //   - Drag at least CLOSE_THRESHOLD_PX to the right (when open) to close.
  const EDGE_PX = 24;
  const OPEN_THRESHOLD_PX = 60;
  const CLOSE_THRESHOLD_PX = 80;
  const FLICK_VELOCITY = 0.5;  // px/ms

  let touch = null;
  function isMobile() {
    return window.matchMedia('(max-width: 1023px)').matches;
  }

  document.addEventListener('touchstart', (e) => {
    if (!isMobile()) return;
    const t = e.touches[0];
    if (!t) return;
    const isOpen = sidebar.classList.contains('open');
    const startedAtRightEdge = (window.innerWidth - t.clientX) <= EDGE_PX;

    // Edge-swipe to open (closed state + finger near right edge).
    if (!isOpen && startedAtRightEdge) {
      touch = { x0: t.clientX, t0: e.timeStamp, mode: 'open' };
      return;
    }
    // Drag to close (open state + finger inside the sidebar area, going right).
    if (isOpen && t.clientX > window.innerWidth - sidebar.offsetWidth) {
      touch = { x0: t.clientX, t0: e.timeStamp, mode: 'close' };
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!touch) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touch.x0;
    // 'open' = finger moving LEFT (dx negative).
    // 'close' = finger moving RIGHT (dx positive).
    if (touch.mode === 'open' && dx < -OPEN_THRESHOLD_PX) {
      openSidebar();
      touch = null;
    } else if (touch.mode === 'close' && dx > CLOSE_THRESHOLD_PX) {
      closeSidebar();
      touch = null;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touch) return;
    // Flick detection: even short drags can trigger if the finger was fast.
    const tEnd = (e.changedTouches && e.changedTouches[0]) || null;
    if (tEnd) {
      const dx = tEnd.clientX - touch.x0;
      const dt = (e.timeStamp - touch.t0) || 1;
      const v = Math.abs(dx) / dt;
      if (v > FLICK_VELOCITY) {
        if (touch.mode === 'open' && dx < -20) openSidebar();
        else if (touch.mode === 'close' && dx > 20) closeSidebar();
      }
    }
    touch = null;
  }, { passive: true });
}

// ── Phase 2: query proposal + SSE wiring ─────────────────────────────

let activeStream = null;

// Guards so the subscribe callback doesn't fire duplicate API calls while a
// request is in flight (state changes can happen many times before the
// response comes back).
// `loadDraft` holds the PROMISE (not a boolean) — openWritingConfigIfNoDraft
// awaits it. A boolean guard would return instantly while the draft is still
// loading, and the modal would open over an existing draft — the original bug.
// `loadDraftSessionId` keys that promise: sharing it across DIFFERENT sessions
// would hand session B the draft of session A and never fetch B's own.
const inflight = { proposeQueries: false, discoverTopics: false, loadDraft: null, loadDraftSessionId: null };

// Polling fallback for when SSE connection silently dies (background tab,
// network blip, server restart). Every 15s while researching we refetch the
// session and merge state. Stops automatically when status leaves 'researching'.
let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const s = Store.get().session;
    if (!s) { stopPolling(); return; }
    if (s.status !== 'researching') { stopPolling(); return; }
    try {
      const fresh = await ApiClient.getSession(s.id);
      if (!fresh?.session) return;
      // Only update if something materially changed — otherwise re-render storm.
      const ns = fresh.session;
      const changed =
        ns.status !== s.status ||
        ns.tokens_used !== s.tokens_used ||
        ns.research_summary !== s.research_summary ||
        (Array.isArray(fresh.findings) && fresh.findings.length !== Store.get().findings.length);
      if (changed) {
        Store.setSession(ns, { findings: fresh.findings });
      }
    } catch (e) {
      // Network blip — keep trying.
    }
  }, 15_000);
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function proposeQueriesForCurrentSession() {
  if (inflight.proposeQueries) return;
  const s = Store.get().session;
  if (!s) return;
  if (Array.isArray(s.proposed_queries) && s.proposed_queries.length > 0) return;
  if (!['onboarding'].includes(s.status)) return;
  if (!s.topic_brief) return;  // auto-topic without selection yet

  inflight.proposeQueries = true;
  // A2#1 — show a live indicator for the whole call, and drop any previous
  // failure notice so a stale one can't sit next to a fresh attempt.
  Store.setError(null);
  Store.setProposingQueries(true);
  try {
    const { queries, title } = await ApiClient.proposeQueries(s.id);
    Store.setQueries(queries || []);
    if (title) {
      const fresh = await ApiClient.getSession(s.id);
      if (fresh?.session) Store.setSession(fresh.session, { findings: fresh.findings });
    }
  } catch (err) {
    console.error('Failed to propose queries', err);
    Store.setError(friendlyClaudeError(err.message));
  } finally {
    Store.setProposingQueries(false);
    inflight.proposeQueries = false;
  }
}

// A1#12 — the local copy of the Anthropic billing/quota translation used to
// live here, and a SECOND copy lived in the SSE `error` handler below. Both now
// call the shared table in error-text.js.

async function discoverTopicsIfNeeded() {
  if (inflight.discoverTopics) return;
  const s = Store.get().session;
  if (!s) return;
  if (s.status !== 'onboarding') return;
  if (s.topic_brief) return;  // not auto-topic
  // Already discovered? Don't re-run.
  if (Array.isArray(s.discovered_topics) && s.discovered_topics.length > 0) {
    Store.setTopics(s.discovered_topics);
    return;
  }

  inflight.discoverTopics = true;
  Store.setError(null);
  Store.setDiscoveringTopics(true);
  try {
    const { topics } = await ApiClient.discoverTopics(s.id);
    Store.setTopics(topics || []);
  } catch (err) {
    console.error('Discover topics failed', err);
    // The chat bubble carries this now (chat-view section 6). The alert that
    // used to be here would be a second copy of the same sentence.
    Store.setError(friendlyClaudeError(err.message));
  } finally {
    Store.setDiscoveringTopics(false);
    inflight.discoverTopics = false;
  }
}

// A3#5 — per-query failures are counted, not announced one by one. A run where
// 4 of 6 queries time out would otherwise fill the chat with four notices in a
// row, on a research run that is still going.
//
// The counter is per RUN, and resetting it only in attachStreamFor was not
// enough: that function is skipped whenever a stream is still attached when a
// new run begins — which is exactly what happens after a run whose process was
// killed, because no `done` event ever arrived to close it. The failures of the
// dead run then kept adding up, and the user was told "13 שאילתות מחקר נכשלו"
// on a session that only ever had 8. resetFailedQueries is called from the
// status transition into 'researching' as well, so every run starts at zero
// however it was started.
let failedQueries = { count: 0, lastMessage: '' };
function resetFailedQueries() {
  failedQueries = { count: 0, lastMessage: '' };
  // The notice bubble IS this counter's rendering — zeroing the number while
  // "13 שאילתות מחקר נכשלו" stays on screen fixes nothing the user can see.
  // Safe to drop here: at the start of a run, any notice on screen belongs to
  // the previous one. (Same as proposeQueriesForCurrentSession does before it
  // starts its own call.)
  if (Store.get().error) Store.setError(null);
}

function attachStreamFor(sessionId) {
  if (activeStream) {
    activeStream.close();
    activeStream = null;
  }
  resetFailedQueries();
  activeStream = connectStream(ApiClient.streamUrl(sessionId), {
    query_started: (data) => {
      // The query is running now — the "waiting before query N" note from the
      // pacing event no longer describes what's happening.
      Store.setPacing(null);
    },
    // A3#15 — the server has been publishing these two since the pacing/stop
    // work landed and NOTHING listened, so they were dropped on the floor.
    // `pacing` is the 25-35s gap the runner waits between queries to stay under
    // the Anthropic tokens-per-minute limit — without it the screen looks stuck.
    pacing: (data) => {
      const idx = Number(data && data.next_query_index) || 0;
      const of  = Number(data && data.of) || 0;
      Store.setPacing(idx && of ? { index: idx, of } : null);
    },
    // `stopped` fires when the query loop ends early — the user pressed Stop
    // (possibly in ANOTHER tab), or the status changed underneath the runner.
    // The runner still summarizes what it collected, so this is exactly the
    // state the Stop button sets locally: summarizing, no more querying.
    stopped: () => {
      Store.setPacing(null);
      Store.setSummarizing(true);
    },
    // The runner decided on its own to stop early — it ran out of run budget or
    // hit the rate limit — and is about to summarize what it has. Said out loud
    // through the same notice bubble as everything else (chat-view section 6),
    // never an alert: the run did not fail, it came back short, and a popup
    // would read as "everything collapsed".
    budget_exhausted: (data) => {
      Store.setPacing(null);
      const done   = Number(data && data.queries_done) || 0;
      const total  = Number(data && data.queries_total) || 0;
      const why    = (data && data.reason === 'rate_limit')
        ? 'בגלל מגבלת הקצב של Anthropic'
        : 'בגלל מגבלת הזמן של הריצה';
      Store.setError(
        (done && total
          ? `המחקר נעצר אחרי ${done} מתוך ${total} שאילתות ${why}.`
          : `המחקר נעצר לפני שהספיק להריץ את כל השאילתות ${why}.`)
        + ' הסיכום מבוסס על מה שנאסף עד כה — אפשר להריץ את השאילתות שנותרו בנפרד.'
      );
    },
    finding: (data) => {
      Store.addFinding(data);
    },
    tokens: (data) => {
      Store.setTokens(Number(data.used) || 0, Number(data.cost_usd) || 0);
    },
    query_done: () => {},
    summarizing: () => {
      // Keep typing indicator; status already 'researching'.
      // Flag the summarize step so the "restart research" button stays hidden
      // if the status flips to research_review (early stop) before it lands.
      Store.setSummarizing(true);
    },
    summary_ready: (data) => {
      Store.setSummary(data.content, data.draft_id);
      Store.setStatus('research_review');
    },
    error: (data) => {
      console.warn('Research error event:', data);
      // Fatal errors (credit, auth) stop the whole run — unchanged behaviour,
      // they just travel through the chat bubble now instead of an alert.
      if (data && data.recoverable === false) {
        // A1#12 — same translation table as every other screen (error-text.js).
        Store.setError('המחקר נעצר: ' + friendlyClaudeError(data.message));
        return;
      }
      // A3#5 — a single query failed and the run continues. This used to end in
      // the console only, so a summary built on 2 of 6 queries looked complete.
      // Reported quietly and aggregated — never an alert, the research is still
      // running and a popup would read as "everything collapsed".
      failedQueries.count += 1;
      failedQueries.lastMessage = (data && data.message) || failedQueries.lastMessage;
      const many = failedQueries.count > 1;
      Store.setError(
        (many
          ? `${failedQueries.count} שאילתות מחקר נכשלו ולא נכללו בממצאים.`
          : 'שאילתת מחקר אחת נכשלה ולא נכללה בממצאים.')
        + ' המחקר ממשיך — קח בחשבון שהסיכום מבוסס על פחות מקורות.'
        // The reason comes straight off the wire, so it goes through the same
        // table as everything else — otherwise this Hebrew bubble ends with a
        // bare 'Server error'. friendlyClaudeError (not toHebrewError) because
        // it's already nested inside the sentence built above.
        + (failedQueries.lastMessage ? ' סיבה: ' + friendlyClaudeError(failedQueries.lastMessage) : '')
      );
    },
    done: (data) => {
      Store.setResearchRunning(false);
      Store.setPacing(null);
      // The run is over for real (summary landed, or it failed) — a retry is
      // allowed again from here on.
      Store.setSummarizing(false);
      activeStream?.close();
      activeStream = null;
    }
  });
}

function maybeAttachStream() {
  const s = Store.get().session;
  if (!s) return;
  // Attach if we're actively researching (page refreshed mid-run)
  if (s.status === 'researching' && !activeStream) {
    attachStreamFor(s.id);
  }
}

function init() {
  if (!gateAuth()) return;

  wireSidebarToggle();
  initChatView();
  initComposer();
  initResearchPanel();
  const onboarding = initOnboardingModal();
  const sessionsList = initSessionsList();
  const writingConfig = initWritingConfigModal();

  document.getElementById('waBtnNewSession').addEventListener('click', onboarding.open);
  document.getElementById('waEmptyStart').addEventListener('click', onboarding.open);
  document.getElementById('waBtnSessions').addEventListener('click', sessionsList.open);

  // Allow the writing bubble to re-open the writing-config modal so the user
  // can tweak editorial settings and regenerate the post.
  document.addEventListener('wa:reopen-writing-config', () => {
    const s = Store.get().session;
    if (s) writingConfig.open(s);
  });

  // When the tab returns to focus after being hidden, refetch the session
  // immediately. Background tabs often have their SSE connection throttled
  // or dropped by the browser — this catches the gap.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const s = Store.get().session;
    if (!s) return;
    try {
      const fresh = await ApiClient.getSession(s.id);
      if (fresh?.session) Store.setSession(fresh.session, { findings: fresh.findings });
    } catch (_) {
      // Swallowed ON PURPOSE — do NOT add a notice here (A1#10). This fires on
      // every tab focus; a session deleted elsewhere would pop a dialog every
      // time the user glances back at the tab. Same reason as the 15s poll above.
    }
  });

  // (Drive sync button removed — the /sessions/:id/drive/sync endpoint
  // still exists on the server for future reuse.)

  // Resume last session if URL has ?session=<id>
  const params = new URLSearchParams(window.location.search);
  const resumeId = params.get('session');
  if (resumeId) {
    ApiClient.getSession(resumeId)
      .then((data) => {
        // A 401 makes ApiClient redirect to /login and resolve with undefined —
        // destructuring it here would throw and pop the notice below mid-logout.
        if (!data || !data.session) return;
        Store.setSession(data.session, { findings: data.findings || [] });
        maybeAttachStream();
        proposeQueriesForCurrentSession();
      })
      .catch(err => {
        // A1#10 — a link to a session that was deleted (or a URL that lost a
        // character on the way through WhatsApp) used to land on the empty
        // "you haven't started a session yet" screen with the id still in the
        // address bar, so every refresh retried the same dead id in silence.
        console.warn('Failed to resume session', err);
        alert('הסשן כבר לא קיים או שהקישור שגוי.');
        history.replaceState(null, '', window.location.pathname);
      });
  }

  // Reflect current session into the URL + react to new sessions.
  let lastSessionId = null;
  let lastStatus = null;
  Store.subscribe((state) => {
    if (!state.session) return;
    const want = '?session=' + state.session.id;
    if (window.location.search !== want) {
      history.replaceState(null, '', window.location.pathname + want);
    }
    // First time we see this session id: trigger the right opening step.
    if (state.session.id !== lastSessionId) {
      lastSessionId = state.session.id;
      maybeAttachStream();
      // Auto-topic flow: discover topics if not yet done.
      discoverTopicsIfNeeded();
      // Manual-topic flow OR after the user picked one: propose queries.
      proposeQueriesForCurrentSession();
      loadLatestPostDraft();
    }
    // When the user picks a topic in the discovery bubble, topic_brief becomes
    // set but proposed_queries is empty — kick off proposeQueries.
    if (state.session.topic_brief
        && state.session.status === 'onboarding'
        && (!Array.isArray(state.session.proposed_queries) || state.session.proposed_queries.length === 0)) {
      proposeQueriesForCurrentSession();
    }
    // If status flips to 'researching' (after user pressed Start), attach the stream.
    if (state.session.status === 'researching' && !activeStream) {
      attachStreamFor(state.session.id);
    }
    // Polling fallback — runs in parallel with SSE. Catches missed events when
    // SSE drops silently (background tab, server restart, network blip).
    if (state.session.status === 'researching') {
      startPolling();
    } else {
      stopPolling();
    }
    // When we transition INTO 'writing' and have no draft yet, open the
    // writing config modal so the user picks update_type/length/formality.
    const status = state.session.status;
    if (status !== lastStatus) {
      lastStatus = status;
      // A new run begins here regardless of whether a stream had to be opened
      // for it — see the note on resetFailedQueries. Without this the failures
      // of a previous run are still on the tally when this one reports its own.
      if (status === 'researching') resetFailedQueries();
      if (status === 'writing' && !state.post.content && !state.post.generating) {
        openWritingConfigIfNoDraft(state.session, writingConfig);
      }
    }
  });
}

// Returns a promise that settles once the latest draft has been loaded (or the
// attempt failed). Concurrent callers share the same in-flight request instead
// of firing a second /drafts fetch.
function loadLatestPostDraft() {
  const s = Store.get().session;
  if (!s) return Promise.resolve();
  // Reuse the in-flight request ONLY for the same session. Returning session A's
  // promise to a caller working on session B means B's /drafts request is never
  // sent, and A's draft lands on B's screen.
  if (inflight.loadDraft && inflight.loadDraftSessionId === s.id) return inflight.loadDraft;
  if (!['writing', 'done'].includes(s.status)) return Promise.resolve();
  const sessionId = s.id;
  const p = (async () => {
    try {
      const { drafts } = await ApiClient.listPostDrafts(sessionId);
      // The user may have switched sessions while this was in flight. Writing the
      // draft into another session shows the wrong post and sends a foreign
      // draft_id to the server (which filters by id + session_id and fails).
      if (Store.get().session?.id !== sessionId) return;
      if (drafts && drafts.length > 0) {
        const latest = drafts[0];
        Store.setPost({
          draftId: latest.id,
          content: latest.content,
          lengthPref: latest.length_pref,
          wordCount: countWordsLocal(latest.content)
        });
      }
    } catch (err) {
      // Never rejects — a failed load must not stall the modal decision below.
      console.warn('failed to load post drafts', err);
    }
  })();
  inflight.loadDraft = p;
  inflight.loadDraftSessionId = sessionId;
  p.finally(() => {
    if (inflight.loadDraft === p) {
      inflight.loadDraft = null;
      inflight.loadDraftSessionId = null;
    }
  });
  return p;
}

// Opens the writing-config modal ONLY after we know whether a draft exists.
// The status flip to 'writing' is evaluated synchronously inside Store.subscribe
// while the draft fetch is still in flight — hence the modal used to pop over an
// existing draft (A1#7 / A4#8).
async function openWritingConfigIfNoDraft(session, writingConfig) {
  await loadLatestPostDraft();
  const st = Store.get();
  if (st.session?.id !== session.id) return;   // user moved to another session
  if (st.post.content || st.post.generating) {
    console.debug('[wa] draft found — writing-config modal not opened');
    return;
  }
  console.debug('[wa] no draft — opening writing-config modal');
  writingConfig.open(session);
}

function countWordsLocal(text) {
  return (text || '').trim().split(/\s+/).filter(w => /\S/.test(w)).length;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

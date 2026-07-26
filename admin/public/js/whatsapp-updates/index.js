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
const inflight = { proposeQueries: false, discoverTopics: false };

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
  try {
    const { queries, title } = await ApiClient.proposeQueries(s.id);
    Store.setQueries(queries || []);
    if (title) {
      const fresh = await ApiClient.getSession(s.id);
      if (fresh?.session) Store.setSession(fresh.session, { findings: fresh.findings });
    }
  } catch (err) {
    console.error('Failed to propose queries', err);
    Store.setError(err.message);
  } finally {
    inflight.proposeQueries = false;
  }
}

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
  Store.setDiscoveringTopics(true);
  try {
    const { topics } = await ApiClient.discoverTopics(s.id);
    Store.setTopics(topics || []);
  } catch (err) {
    console.error('Discover topics failed', err);
    Store.setError(err.message);
    let friendly = err.message || 'שגיאה';
    if (/credit balance is too low/i.test(friendly)) {
      friendly = 'אזל הקרדיט בחשבון Anthropic — טען קרדיט ונסה שוב.';
    } else if (/rate.?limit/i.test(friendly)) {
      friendly = 'הגעת ל-rate limit של Anthropic. המתן כדקה ורענן את הדף.';
    }
    alert('גילוי הנושאים נכשל: ' + friendly);
  } finally {
    Store.setDiscoveringTopics(false);
    inflight.discoverTopics = false;
  }
}

function attachStreamFor(sessionId) {
  if (activeStream) {
    activeStream.close();
    activeStream = null;
  }
  activeStream = connectStream(ApiClient.streamUrl(sessionId), {
    query_started: (data) => {
      // Could show per-query progress; for now the panel is enough.
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
    },
    summary_ready: (data) => {
      Store.setSummary(data.content, data.draft_id);
      Store.setStatus('research_review');
    },
    error: (data) => {
      console.warn('Research error event:', data);
      // Surface fatal errors to the user (rate limit, credit, auth issues).
      // Recoverable per-query errors (data.recoverable) stay in the console.
      if (data && data.recoverable === false) {
        const msg = (data.message || 'שגיאה לא ידועה');
        // Friendlier messages for common Anthropic billing/quota cases.
        let friendly = msg;
        if (/credit balance is too low/i.test(msg)) {
          friendly = 'אזל הקרדיט בחשבון Anthropic. כנס ל-https://console.anthropic.com/settings/billing וטען קרדיט, ואז התחל סשן חדש.';
        } else if (/rate.?limit/i.test(msg) && /minute/i.test(msg)) {
          friendly = 'הגעת ל-rate limit של Anthropic. המתן כדקה והפעל מחדש את המחקר.';
        }
        Store.setError(friendly);
        alert('המחקר נעצר: ' + friendly);
      }
    },
    done: (data) => {
      Store.setResearchRunning(false);
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
    } catch (_) { /* ignore */ }
  });

  // (Drive sync button removed — the /sessions/:id/drive/sync endpoint
  // still exists on the server for future reuse.)

  // Resume last session if URL has ?session=<id>
  const params = new URLSearchParams(window.location.search);
  const resumeId = params.get('session');
  if (resumeId) {
    ApiClient.getSession(resumeId)
      .then(({ session, findings }) => {
        Store.setSession(session, { findings: findings || [] });
        maybeAttachStream();
        proposeQueriesForCurrentSession();
      })
      .catch(err => console.warn('Failed to resume session', err));
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
      if (status === 'writing' && !state.post.content && !state.post.generating) {
        writingConfig.open(state.session);
      }
    }
  });
}

async function loadLatestPostDraft() {
  const s = Store.get().session;
  if (!s) return;
  if (!['writing', 'done'].includes(s.status)) return;
  try {
    const { drafts } = await ApiClient.listPostDrafts(s.id);
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
    console.warn('failed to load post drafts', err);
  }
}

function countWordsLocal(text) {
  return (text || '').trim().split(/\s+/).filter(w => /\S/.test(w)).length;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

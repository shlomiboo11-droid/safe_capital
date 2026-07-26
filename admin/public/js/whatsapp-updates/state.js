// Tiny pub/sub store. Keeps session + chat + research state in memory.

const subs = new Set();
const data = {
  session: null,        // current WhatsappSession or null
  messages: [],         // chat bubbles
  topics: [],           // discovered topic candidates (auto-topic flow)
  discoveringTopics: false,
  proposingQueries: false, // true while /topic is in flight (after topic pick)
  queries: [],          // proposed/edited research queries
  findings: [],         // live findings collected during research run
  research: {
    running: false,
    summarizing: false,  // true between "queries finished/stopped" and summary_ready
    pacing: null,        // { index, of } while the runner waits between queries (A3#15)
    tokens: 0,
    cost: 0,
    summary: null,       // research summary text once ready
    summaryDraftId: null
  },
  // Phase 4 — writing stage
  post: {
    draftId: null,       // current post draft id
    content: '',         // current post text
    lengthPref: 'medium',
    wordCount: 0,
    generating: false    // true while a Claude call is in-flight
  },
  saving: false,
  error: null
};

function emit() {
  for (const fn of subs) {
    try { fn(data); } catch (e) { console.error(e); }
  }
}

export const Store = {
  get() { return data; },
  subscribe(fn) { subs.add(fn); fn(data); return () => subs.delete(fn); },

  setSession(session, extras = {}) {
    // Two callers with two different intents share this function:
    //   • switching to a DIFFERENT session  → reset everything (4 call sites)
    //   • refreshing the CURRENT session    → keep screen-only state (10 call sites)
    // Both ids must be truthy — an undefined/failed session must NEVER count as
    // "same", or a broken response would inherit the previous session's screen.
    const sameSession = !!(session && session.id) && session.id === data.session?.id;
    // The "summarize in flight" flag lives only in memory (the server has no
    // status for it). Polling calls setSession every 15s, so it must survive a
    // refresh of the SAME session — but never leak to a different one.
    const keepSummarizing = sameSession && !!data.research.summarizing;
    // Same reasoning for the pacing note (A3#15): it only exists in memory, and
    // the 15s poll calls setSession — without this it would blink away.
    const keepPacing = sameSession ? data.research.pacing : null;
    data.session  = session;
    data.messages = Array.isArray(session?.messages) ? session.messages : [];
    data.topics   = Array.isArray(session?.discovered_topics) ? session.discovered_topics : [];
    // Queries the user edited or added by hand live only on screen until
    // "אשר והתחל מחקר" persists them. A refresh of the SAME session must not
    // overwrite them with the (older) server copy — A2#9.
    data.queries  = Array.isArray(extras.queries)
      ? extras.queries
      : (sameSession && data.queries.length > 0
          ? data.queries
          : (Array.isArray(session?.proposed_queries) ? session.proposed_queries : []));
    // Findings live only in memory during a run — the server payload carries
    // them only when the caller asked for them (8 of 14 call sites do). On a
    // same-session refresh without them, keep what's on screen — A1#6.
    data.findings = Array.isArray(extras.findings)
      ? extras.findings
      : (sameSession ? data.findings : []);
    data.research = {
      running: session?.status === 'researching',
      summarizing: keepSummarizing,
      pacing: keepPacing,
      tokens: Number(session?.tokens_used || 0),
      cost: Number(session?.estimated_cost_usd || 0),
      summary: session?.research_summary || null,
      summaryDraftId: null
    };
    // The post draft is NOT part of the session row — it lives in
    // whatsapp_drafts and is fetched separately by loadLatestPostDraft().
    // Rebuilding it from session.final_post on a same-session refresh wipes the
    // draft id and the word count, which makes the post disappear (A4#1 / A1#3)
    // and kills the edit buttons after "שמור כסופי" (A4#5).
    // Only a swap to a DIFFERENT session resets it.
    data.post = sameSession ? data.post : {
      draftId: null,
      content: session?.final_post || '',
      lengthPref: session?.length_pref || 'medium',
      wordCount: 0,
      generating: false
    };
    // A2#1 — `error` is screen-only state, exactly like queries/findings/post
    // above. Clearing it on every refresh of the SAME session meant the 15s
    // polling tick (and every visibilitychange refetch) erased the failure
    // notice seconds after it appeared. A swap to a DIFFERENT session still
    // resets it, so an error can never leak across sessions.
    data.error = sameSession ? data.error : null;
    emit();
  },

  clearSession() {
    data.session = null;
    data.messages = [];
    data.queries = [];
    data.findings = [];
    data.research = { running: false, summarizing: false, pacing: null, tokens: 0, cost: 0, summary: null, summaryDraftId: null };
    data.error = null;
    emit();
  },

  appendMessage(msg) {
    data.messages = [...data.messages, msg];
    emit();
  },

  setQueries(queries) {
    data.queries = queries;
    emit();
  },

  setTopics(topics) {
    data.topics = topics;
    emit();
  },

  setDiscoveringTopics(v) {
    data.discoveringTopics = v;
    emit();
  },

  // A2#1 — drives the "working on it" bubble between "the user confirmed a
  // topic" and "the queries came back". Without it the screen was completely
  // static for the whole call and looked dead.
  setProposingQueries(v) {
    data.proposingQueries = !!v;
    emit();
  },

  setStatus(status) {
    if (data.session) {
      data.session = { ...data.session, status };
      emit();
    }
  },

  setResearchRunning(running) {
    data.research = { ...data.research, running };
    emit();
  },

  // True from the moment the query loop ends (or the user pressed Stop) until
  // the summary lands. Guards the "restart research" button — see chat-view.
  setSummarizing(v) {
    data.research = { ...data.research, summarizing: !!v };
    emit();
  },

  // A3#15 — { index, of } while the runner is deliberately idling between
  // queries, null the rest of the time. Fed by the `pacing` SSE event.
  setPacing(p) {
    const next = (p && p.index && p.of) ? { index: p.index, of: p.of } : null;
    const cur = data.research.pacing;
    // Cheap equality check — this fires on a timer-ish cadence and every emit
    // costs a full chat re-render.
    if (!next && !cur) return;
    if (next && cur && next.index === cur.index && next.of === cur.of) return;
    data.research = { ...data.research, pacing: next };
    emit();
  },

  addFinding(f) {
    data.findings = [...data.findings, f];
    emit();
  },

  setTokens(tokens, cost) {
    data.research = { ...data.research, tokens, cost };
    emit();
  },

  setSummary(content, draftId) {
    data.research = { ...data.research, summary: content, summaryDraftId: draftId, running: false, summarizing: false, pacing: null };
    emit();
  },

  setPost({ draftId, content, lengthPref, wordCount }) {
    data.post = {
      ...data.post,
      draftId: draftId ?? data.post.draftId,
      content: content ?? data.post.content,
      lengthPref: lengthPref ?? data.post.lengthPref,
      wordCount: typeof wordCount === 'number' ? wordCount : data.post.wordCount,
      generating: false
    };
    emit();
  },

  setPostGenerating(v) {
    data.post = { ...data.post, generating: v };
    emit();
  },

  // setSaving is internal-only — no UI consumer reads `data.saving`.
  // We intentionally DON'T emit here, so the auto-save timer (which toggles
  // it true/false) doesn't trigger a full chat re-render twice every cycle.
  setSaving(v) { data.saving = v; },

  setError(err) { data.error = err; emit(); }
};

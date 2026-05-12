// Tiny pub/sub store. Keeps session + chat + research state in memory.

const subs = new Set();
const data = {
  session: null,        // current WhatsappSession or null
  messages: [],         // chat bubbles
  topics: [],           // discovered topic candidates (auto-topic flow)
  discoveringTopics: false,
  queries: [],          // proposed/edited research queries
  findings: [],         // live findings collected during research run
  research: {
    running: false,
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
    data.session  = session;
    data.messages = Array.isArray(session?.messages) ? session.messages : [];
    data.topics   = Array.isArray(session?.discovered_topics) ? session.discovered_topics : [];
    data.queries  = Array.isArray(session?.proposed_queries) ? session.proposed_queries : [];
    data.findings = Array.isArray(extras.findings) ? extras.findings : [];
    data.research = {
      running: session?.status === 'researching',
      tokens: Number(session?.tokens_used || 0),
      cost: Number(session?.estimated_cost_usd || 0),
      summary: session?.research_summary || null,
      summaryDraftId: null
    };
    // Reset post state on session swap; will be populated by /drafts call.
    data.post = {
      draftId: null,
      content: session?.final_post || '',
      lengthPref: session?.length_pref || 'medium',
      wordCount: 0,
      generating: false
    };
    data.error = null;
    emit();
  },

  clearSession() {
    data.session = null;
    data.messages = [];
    data.queries = [];
    data.findings = [];
    data.research = { running: false, tokens: 0, cost: 0, summary: null, summaryDraftId: null };
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

  addFinding(f) {
    data.findings = [...data.findings, f];
    emit();
  },

  setTokens(tokens, cost) {
    data.research = { ...data.research, tokens, cost };
    emit();
  },

  setSummary(content, draftId) {
    data.research = { ...data.research, summary: content, summaryDraftId: draftId, running: false };
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

  setSaving(v) { data.saving = v; emit(); },
  setError(err) { data.error = err; emit(); }
};

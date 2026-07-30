// Thin wrapper around the global `API` helper for WhatsApp endpoints.

function authHeaders() {
  const token = API.getToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function request(path, options = {}) {
  const url = '/api/whatsapp' + path;
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers || {})
  };
  const body = options.body && typeof options.body === 'object'
    ? JSON.stringify(options.body)
    : options.body;

  const resp = await fetch(url, { ...options, headers, body });
  if (resp.status === 401) {
    API.logout();
    return;
  }
  if (!resp.ok) {
    let msg = 'Request failed';
    try { msg = (await resp.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export const ApiClient = {
  createSession: (payload) => request('/sessions', { method: 'POST', body: payload }),
  listSessions:  () => request('/sessions'),
  getSession:    (id) => request('/sessions/' + id),
  patchSession:  (id, fields) => request('/sessions/' + id, { method: 'PATCH', body: fields }),
  deleteSession: (id) => request('/sessions/' + id, { method: 'DELETE' }),
  sendMessage:   (id, role, content) =>
    request('/sessions/' + id + '/messages', { method: 'POST', body: { role, content } }),

  // Auto-topic preliminary flow
  discoverTopics: (id) => request('/sessions/' + id + '/discover-topics', { method: 'POST' }),
  selectTopic:    (id, payload) => request('/sessions/' + id + '/select-topic', { method: 'POST', body: payload }),

  // Phase 2 — research stage
  proposeQueries: (id) => request('/sessions/' + id + '/topic', { method: 'POST' }),
  saveQueries:    (id, queries) =>
    request('/sessions/' + id + '/queries', { method: 'POST', body: { queries } }),
  // `opts` is the request body. Called with no argument (the normal "start
  // research" button) it posts {} — same as the empty body it used to send.
  // { only_missing: true } re-runs just the queries that produced no finding.
  startResearch:  (id, opts = {}) =>
    request('/sessions/' + id + '/research/start', { method: 'POST', body: opts }),
  stopResearch:   (id) => request('/sessions/' + id + '/research/stop', { method: 'POST' }),
  // Turn the findings already in the DB into a summary, without running any
  // query. The rescue path for a run that was killed mid-flight.
  summarizeExisting: (id) =>
    request('/sessions/' + id + '/research/summarize', { method: 'POST' }),
  acceptResearch: (id) => request('/sessions/' + id + '/research/accept', { method: 'POST' }),
  editSelection:  (id, payload) =>
    request('/sessions/' + id + '/research/edit-selection', { method: 'POST', body: payload }),
  manualEdit:     (id, content) =>
    request('/sessions/' + id + '/research/manual-edit', { method: 'POST', body: { content } }),

  // Phase 4 — writing stage
  writePost:        (id, length_pref) =>
    request('/sessions/' + id + '/write', { method: 'POST', body: { length_pref } }),
  writeAlternative: (id, length_pref) =>
    request('/sessions/' + id + '/write/alternative', { method: 'POST', body: { length_pref } }),
  quickAction:      (id, draft_id, action) =>
    request('/sessions/' + id + '/write/quick-action', { method: 'POST', body: { draft_id, action } }),
  editPostSelection: (id, draft_id, payload) =>
    request('/sessions/' + id + '/write/edit-selection', { method: 'POST', body: { draft_id, ...payload } }),
  manualEditPost:   (id, draft_id, content) =>
    request('/sessions/' + id + '/write/manual-edit', { method: 'POST', body: { draft_id, content } }),
  finalizePost:     (id, draft_id) =>
    request('/sessions/' + id + '/finalize', { method: 'POST', body: { draft_id } }),
  listPostDrafts:   (id) =>
    request('/sessions/' + id + '/drafts'),

  // Phase 6 — history & Drive sync
  duplicateSession: (id) =>
    request('/sessions/' + id + '/duplicate', { method: 'POST' }),
  syncDrive:        (id) =>
    request('/sessions/' + id + '/drive/sync', { method: 'POST' }),

  // SSE stream URL (token via query param; EventSource can't set headers)
  streamUrl: (id) => '/api/whatsapp/sessions/' + id + '/stream?token=' + encodeURIComponent(API.getToken() || ''),

  listDeals: () => fetch('/api/deals', { headers: authHeaders() })
                    .then(r => r.ok ? r.json() : { deals: [] })
};

// Thin EventSource wrapper with handler registration.
// Auto-reconnect is built into native EventSource; we only handle lifecycle.

export function connectStream(url, handlers = {}) {
  const es = new EventSource(url);

  // Default handlers
  // A3#15 — 'stopped' and 'pacing' were missing here. The server published both
  // (routes/whatsapp.js on stop, claude-research-provider.js between queries)
  // and the browser threw them away without a trace, which is why "עצור מחקר"
  // pressed in one tab did nothing visible in another and the 25-35s gap
  // between queries looked like the run had died.
  // `budget_exhausted` is published when the runner stops itself before it has
  // gone through every query (time budget, rate limit) and goes on to summarize
  // what it collected. Without it in this list the run would look like it simply
  // finished, and a summary built on 5 of 8 queries would read as complete.
  const eventNames = [
    'query_started', 'finding', 'tokens', 'query_done',
    'consultation_needed', 'summarizing', 'summary_ready',
    'pacing', 'stopped', 'budget_exhausted', 'error', 'done'
  ];

  for (const name of eventNames) {
    es.addEventListener(name, (e) => {
      let data = null;
      try { data = JSON.parse(e.data); } catch (_) { data = e.data; }
      handlers[name]?.(data, e);
    });
  }

  es.onerror = (e) => {
    // EventSource will auto-retry; only forward fatal close.
    if (es.readyState === EventSource.CLOSED) {
      handlers.connection_closed?.(e);
    }
  };

  return {
    close: () => es.close(),
    raw: es
  };
}

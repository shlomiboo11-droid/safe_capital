// Thin EventSource wrapper with handler registration.
// Auto-reconnect is built into native EventSource; we only handle lifecycle.

export function connectStream(url, handlers = {}) {
  const es = new EventSource(url);

  // Default handlers
  const eventNames = [
    'query_started', 'finding', 'tokens', 'query_done',
    'consultation_needed', 'summarizing', 'summary_ready',
    'error', 'done'
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

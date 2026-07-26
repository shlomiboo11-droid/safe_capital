/**
 * In-memory event bus per session.
 *   - Subscribers (Express response streams) join via attach(sessionId, res).
 *   - Producers push events via publish(sessionId, eventName, data).
 *   - A small ring buffer (last N events) lets a reconnecting client replay
 *     events it missed if the network blipped.
 *
 * Scope: single-process. On Vercel serverless each invocation is its own
 * process; a long-running research run must be co-located with the SSE
 * stream. That trade-off is handled by Phase 6 (background worker).
 */

const BUFFER_SIZE = 100;

const channels = new Map();
// channels.get(sessionId) = { subscribers: Set<res>, buffer: Array<{event, data, id}>, nextId: number }

function ensureChannel(sessionId) {
  let ch = channels.get(sessionId);
  if (!ch) {
    ch = { subscribers: new Set(), buffer: [], nextId: 1 };
    channels.set(sessionId, ch);
  }
  return ch;
}

/**
 * Attach an Express response as an SSE subscriber for the given session.
 * Sends initial heartbeat + replays last N events.
 *
 * @param {string} sessionId
 * @param {import('express').Response} res
 * @param {Object} [opts]
 * @param {number} [opts.lastEventId] — replay events with id > lastEventId
 */
function attach(sessionId, res, opts = {}) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if any
  res.flushHeaders?.();

  const ch = ensureChannel(sessionId);
  ch.subscribers.add(res);

  // Replay missed events (basic Last-Event-Id semantics)
  const since = Number(opts.lastEventId || 0);
  for (const item of ch.buffer) {
    if (item.id > since) writeEvent(res, item);
  }

  // Initial comment to flush headers in browsers
  res.write(': connected\n\n');

  // Keepalive every 25s
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { /* ignore */ }
  }, 25000);

  res.on('close', () => {
    clearInterval(ping);
    ch.subscribers.delete(res);
  });
}

function writeEvent(res, item) {
  try {
    res.write(`id: ${item.id}\n`);
    res.write(`event: ${item.event}\n`);
    res.write(`data: ${JSON.stringify(item.data)}\n\n`);
  } catch (_) {
    // Subscriber dropped — will be cleaned up on close.
  }
}

/**
 * Publish an event to all subscribers of a session + record it in the buffer.
 */
function publish(sessionId, event, data) {
  const ch = ensureChannel(sessionId);
  const item = { id: ch.nextId++, event, data, timestamp: Date.now() };
  ch.buffer.push(item);
  if (ch.buffer.length > BUFFER_SIZE) ch.buffer.shift();
  for (const sub of ch.subscribers) writeEvent(sub, item);
}

/**
 * Close all subscribers and clear the buffer.
 *
 * A3#11 — call this ONLY when the session itself is gone (DELETE /sessions/:id).
 * Do NOT call it when a research run finishes "for symmetry": the ring buffer
 * above is what replays `summary_ready` to a tab whose EventSource dropped
 * (backgrounded tab, network blip). Dropping it at the end of a run means the
 * user never sees the summary they paid for, and nothing reports an error.
 */
function destroy(sessionId) {
  const ch = channels.get(sessionId);
  if (!ch) return;
  for (const sub of ch.subscribers) {
    try { sub.end(); } catch (_) {}
  }
  channels.delete(sessionId);
}

/**
 * Snapshot of subscriber count (debug/health).
 */
function getChannelInfo(sessionId) {
  const ch = channels.get(sessionId);
  if (!ch) return { subscribers: 0, buffered: 0 };
  return { subscribers: ch.subscribers.size, buffered: ch.buffer.length };
}

module.exports = { attach, publish, destroy, getChannelInfo };

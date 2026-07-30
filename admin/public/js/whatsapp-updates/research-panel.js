// Side panel that shows live research progress (findings + tokens + cost).
// Renders into a fixed container `#waResearchPanel`. On mobile this can be
// collapsed via a top-bar toggle (Phase 5).

import { Store, missingQueries } from './state.js';
import { setMarkdown } from './markup.js';

function fmtCost(c) {
  if (!c) return '$0.00';
  return '$' + Number(c).toFixed(2);
}

function fmtTokens(t) {
  if (!t) return '0';
  if (t >= 1000) return (t / 1000).toFixed(1) + 'K';
  return String(t);
}

export function initResearchPanel() {
  const panel = document.getElementById('waResearchPanel');
  if (!panel) return;

  const tokensEl = panel.querySelector('#waPanelTokens');
  const costEl   = panel.querySelector('#waPanelCost');
  const listEl   = panel.querySelector('#waPanelFindings');
  const titleEl  = panel.querySelector('#waPanelStatus');

  Store.subscribe((state) => {
    if (!state.session) {
      panel.classList.add('wa-hidden');
      return;
    }

    const interesting = ['researching', 'research_review'].includes(state.session.status)
                     || state.findings.length > 0
                     || state.research.summary;
    panel.classList.toggle('wa-hidden', !interesting);

    if (titleEl) {
      if (state.research.running) {
        titleEl.textContent = 'מחקר רץ…';
        titleEl.dataset.state = 'running';
      } else if (state.research.summary) {
        titleEl.textContent = 'סיכום מוכן';
        titleEl.dataset.state = 'done';
      } else if (state.findings.length > 0) {
        titleEl.textContent = 'ממצאים';
        titleEl.dataset.state = 'idle';
      } else {
        titleEl.textContent = 'מצב מחקר';
        titleEl.dataset.state = 'idle';
      }
    }
    if (tokensEl) tokensEl.textContent = fmtTokens(state.research.tokens);
    if (costEl)   costEl.textContent   = fmtCost(state.research.cost);

    if (listEl) {
      listEl.innerHTML = '';

      // The gap between what was asked and what came back. When a run is killed
      // mid-flight nothing anywhere says so: no error event is published (the
      // process is simply gone), the SSE buffer is per-process so a refresh
      // wipes what little was on screen, and the panel below happily shows 5
      // findings as if 5 were all that was ever planned. This line is the only
      // place the user learns that 3 queries never ran.
      //
      // Only while the run is over — during it, "not yet" and "never" look the
      // same and every gap is expected.
      const missing = missingQueries(state);
      if (missing.length > 0
          && !state.research.running
          && ['research_review', 'writing', 'done'].includes(state.session.status)) {
        const total = (Array.isArray(state.session.proposed_queries) ? state.session.proposed_queries : [])
          .filter(q => q && q.enabled !== false).length;
        const note = document.createElement('div');
        note.className = 'wa-panel-empty';
        // Two different stories, and the "stopped partway" sentence is a lie
        // about the second one: a session whose research never started (or was
        // reclaimed by the startup cleanup before the first query) has every
        // query missing, and telling the user it "stopped before reaching them"
        // invents a run that never happened.
        note.textContent = state.findings.length > 0
          ? `${missing.length} מתוך ${total} השאילתות לא רצו — המחקר נעצר לפני שהספיק להגיע אליהן.`
          : `אף אחת מ-${total} השאילתות לא הפיקה ממצא — המחקר לא רץ, או נעצר לפני השאילתה הראשונה.`;
        listEl.appendChild(note);
      }

      // De-duplicate findings by source_url (one entry per source, latest note wins)
      // A3#10 — the same row arrives as `finding_id` over SSE and as `id` when
      // it's re-read from the DB (both are whatsapp_research_findings.id, only
      // the field name differs). Reading `finding_id` alone made every
      // source-less finding key on 'finding-undefined' after a refresh, so they
      // all collapsed into one row and the research looked far thinner than it
      // was. Accepting both names also stops the SSE copy and the DB copy of one
      // finding from showing up twice (A3#12).
      const byUrl = new Map();
      for (const f of state.findings) {
        if (!f) continue;
        const key = f.source_url || ('finding-' + (f.finding_id || f.id));
        byUrl.set(key, f);
      }
      const items = Array.from(byUrl.values()).slice(-30);

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'wa-panel-empty';
        empty.textContent = state.research.running ? 'מתחיל לאסוף ממצאים…' : 'אין ממצאים עדיין.';
        listEl.appendChild(empty);
        return;
      }

      for (const f of items) {
        const item = document.createElement('div');
        item.className = 'wa-finding-item';

        const head = document.createElement('div');
        head.className = 'wa-finding-head';
        if (f.source_url) {
          const a = document.createElement('a');
          a.href = f.source_url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'wa-finding-source';
          a.textContent = f.source_name || (new URL(f.source_url)).hostname.replace(/^www\./, '');
          head.appendChild(a);
        } else {
          const span = document.createElement('span');
          span.className = 'wa-finding-source wa-finding-source-none';
          span.textContent = 'מקור פנימי';
          head.appendChild(span);
        }
        item.appendChild(head);

        if (f.hebrew_note) {
          const body = document.createElement('div');
          body.className = 'wa-finding-note';
          // Show only first ~200 chars; full text is in the summary later.
          // Run through markdown so **bold** / # headings render as formatting.
          const t = String(f.hebrew_note).trim();
          const truncated = t.length > 200 ? t.slice(0, 200) + '…' : t;
          setMarkdown(body, truncated);
          item.appendChild(body);
        }

        listEl.appendChild(item);
      }
    }
  });
}

// Minimal Markdown renderer for content the bot produces during research.
//
// Handles:
//   - `# H1` / `## H2` / `### H3` headings (rendered as bold lines, larger)
//   - `**bold**` (markdown standard)
//   - `*bold*`   (WhatsApp standard — also bold here)
//   - `_italic_`
//   - `- ` / `* ` list items (rendered as line with bullet character)
//   - Line breaks preserved
//
// Returns a DocumentFragment ready to append. textContent stays safe (no HTML
// injection) because we create text nodes manually instead of innerHTML.

function appendInlineFormatted(text, container) {
  // Order matters — process bold first (longer match), then italic.
  // We tokenize the line by walking through with a regex.
  const tokenRe = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIdx = 0;
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > lastIdx) {
      container.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
    }
    const token = m[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const b = document.createElement('strong');
      b.textContent = token.slice(2, -2);
      container.appendChild(b);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const b = document.createElement('strong');
      b.textContent = token.slice(1, -1);
      container.appendChild(b);
    } else if (token.startsWith('_') && token.endsWith('_')) {
      const i = document.createElement('em');
      i.textContent = token.slice(1, -1);
      container.appendChild(i);
    }
    lastIdx = m.index + token.length;
  }
  if (lastIdx < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}

/**
 * Render markdown text as a DocumentFragment.
 * Use this instead of `el.textContent = text` whenever the bot's output
 * may contain markdown.
 */
export function formatMarkdown(text) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings — render as a bold paragraph with larger font.
    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headEl = document.createElement('div');
      headEl.className = 'wa-md-heading wa-md-h' + level;
      const strong = document.createElement('strong');
      strong.textContent = headingMatch[2];
      headEl.appendChild(strong);
      frag.appendChild(headEl);
      continue;
    }

    // List item — `- foo` or `* foo` (where the asterisk is followed by space).
    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      const li = document.createElement('div');
      li.className = 'wa-md-li';
      li.appendChild(document.createTextNode('• '));
      appendInlineFormatted(listMatch[1], li);
      frag.appendChild(li);
      continue;
    }

    // Regular line — inline formatting + line break (except last line).
    appendInlineFormatted(line, frag);
    if (i < lines.length - 1) {
      frag.appendChild(document.createElement('br'));
    }
  }
  return frag;
}

/**
 * Replace an element's content with a markdown-formatted fragment.
 * Convenience wrapper for the common case.
 */
export function setMarkdown(el, text) {
  el.innerHTML = '';
  el.appendChild(formatMarkdown(text));
}

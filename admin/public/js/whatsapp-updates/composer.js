// Composer behavior: auto-grow textarea, Cmd/Ctrl+Enter to send, click send.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { toHebrewError } from './error-text.js';

export function initComposer() {
  const input  = document.getElementById('waComposerInput');
  const button = document.getElementById('waComposerSend');

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }

  async function send() {
    const session = Store.get().session;
    const content = input.value.trim();
    if (!session || !content) return;

    button.disabled = true;
    input.disabled = true;

    // Optimistic append of the user message.
    const optimistic = {
      id: 'optimistic-' + Date.now(),
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    Store.appendMessage(optimistic);

    try {
      const resp = await ApiClient.sendMessage(session.id, 'user', content);
      input.value = '';
      autoGrow();

      // Replace optimistic with server-confirmed messages.
      // Easiest: refetch the session.
      const fresh = await ApiClient.getSession(session.id);
      Store.setSession(fresh.session);
    } catch (err) {
      console.error('send failed', err);
      // `state.error` is rendered as a ⚠️ chat bubble now (chat-view section 6).
      // Before that it had writers and no readers, so the raw server string here
      // never reached a human — 'Failed to fetch' / 'Server error' would now sit
      // inside a Hebrew bubble, which is exactly what error-text.js exists to
      // prevent. toHebrewError (not friendlyClaudeError) because this notice
      // stands on its own rather than being wrapped in another sentence.
      Store.setError(toHebrewError(err.message));
    } finally {
      button.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    // WhatsApp-style send: Enter → send, Shift+Enter → newline.
    // (We deliberately ignore Cmd/Ctrl+Enter as a separate shortcut — Enter
    // alone is unambiguous since IME composition uses different events.)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  button.addEventListener('click', send);

  // Mobile virtual keyboard handling — keep composer above the keyboard.
  // visualViewport reports the visible area minus the OS keyboard.
  const composerEl = document.getElementById('waComposer');
  if (window.visualViewport && composerEl) {
    const vv = window.visualViewport;
    const updateOffset = () => {
      // Distance from visualViewport bottom to layout viewport bottom = keyboard height.
      const kbHeight = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      // Only apply translation on mobile widths; CSS handles desktop.
      if (window.matchMedia('(max-width: 768px)').matches) {
        composerEl.style.transform = kbHeight > 0 ? `translateY(-${kbHeight}px)` : '';
      } else {
        composerEl.style.transform = '';
      }
    };
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    input.addEventListener('focus', () => setTimeout(updateOffset, 100));
    input.addEventListener('blur', () => { composerEl.style.transform = ''; });
  }
}

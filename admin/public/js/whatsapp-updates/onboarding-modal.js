// Onboarding modal — minimal pre-research setup.
// Phase 1 scope: pick a topic (or let the bot choose) + research depth.
// Writing-stage settings (length, formality, tone) are configured later, after research.

import { Store } from './state.js';
import { ApiClient } from './api-client.js';
import { attachDragToDismiss } from './sheet-utils.js';

function readChipValue(groupEl) {
  const active = groupEl.querySelector('.wa-chip.active');
  return active ? active.dataset.value : null;
}

function wireChipGroup(groupEl) {
  groupEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.wa-chip');
    if (!chip || !groupEl.contains(chip)) return;
    groupEl.querySelectorAll('.wa-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
}

export function initOnboardingModal() {
  const overlay    = document.getElementById('waOnboardingOverlay');
  const closeBtn   = document.getElementById('waOnboardingClose');
  const cancelBtn  = document.getElementById('waOnboardingCancel');
  const submitBtn  = document.getElementById('waOnboardingSubmit');
  const topicEl    = document.getElementById('waTopicBrief');
  const autoEl     = document.getElementById('waAutoTopic');

  overlay.querySelectorAll('.wa-chip-group').forEach(wireChipGroup);

  // When "let the bot choose" is checked, disable the manual topic textarea
  // and clear its value so the intent is unambiguous.
  autoEl.addEventListener('change', () => {
    topicEl.disabled = autoEl.checked;
    if (autoEl.checked) {
      topicEl.value = '';
    }
  });

  function open() {
    overlay.classList.remove('hidden');
    setTimeout(() => topicEl.focus(), 50);
  }

  function close() {
    overlay.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  attachDragToDismiss(overlay, close);

  submitBtn.addEventListener('click', async () => {
    const autoTopic = autoEl.checked;
    const topic     = (topicEl.value || '').trim();

    if (!autoTopic && !topic) {
      topicEl.focus();
      topicEl.setAttribute('aria-invalid', 'true');
      return;
    }
    topicEl.removeAttribute('aria-invalid');

    const payload = {
      topic_brief: autoTopic ? null : topic,
      auto_topic: autoTopic,
      research_depth: readChipValue(overlay.querySelector('[data-name="research_depth"]')) || 'normal'
    };

    submitBtn.disabled = true;
    try {
      const { session } = await ApiClient.createSession(payload);
      Store.setSession(session);
      close();
      // Reset for next session
      topicEl.value = '';
      autoEl.checked = false;
      topicEl.disabled = false;
    } catch (err) {
      console.error('Failed to create session', err);
      alert('שגיאה ביצירת סשן: ' + err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  return { open, close };
}

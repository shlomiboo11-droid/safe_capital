// Pops up once when transitioning from research_review → writing.
// Collects the post-shape settings that were intentionally deferred from
// the initial Onboarding (update_type, length, formality).
// Persists them to the session via PATCH then triggers the first /write call.

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

let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'wa-modal-overlay hidden';
  modalEl.id = 'waWritingConfigOverlay';
  modalEl.innerHTML = `
    <div class="wa-modal wa-modal-wide">
      <div class="wa-modal-header">
        <h2 class="wa-modal-title">איך תרצה את הפוסט?</h2>
        <button class="wa-modal-close" id="waWcClose" aria-label="סגור">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="wa-modal-body">
        <p class="wa-modal-subtitle">
          המחקר מוכן. עכשיו תן ל-AI את <strong>הזווית של Safe Capital</strong> על המידע — מה דעתנו, איך זה רלוונטי למשקיעים, מה המסקנה. ככה הפוסט לא ייצא ניטרלי וקר אלא יהיה שלנו.
        </p>

        <div class="wa-field">
          <label class="form-label" for="waWcAngle">הזווית / השאלה המרכזית</label>
          <textarea id="waWcAngle" class="form-input wa-editorial-textarea" rows="2"
                    placeholder="למשל: האם משקיעי Safe Capital צריכים לפחד מירידת הדולר בהשקעות בארה&quot;ב?"></textarea>
          <span class="wa-field-hint">המסגרת של הפוסט — שאלה, טענה, או תזה. זה מה שמכווין את הקורא.</span>
        </div>

        <div class="wa-field">
          <label class="form-label" for="waWcPoints">נקודות שחשוב לכלול</label>
          <textarea id="waWcPoints" class="form-input wa-editorial-textarea" rows="4"
                    placeholder="למשל:
• השקל תמיד תנודתי — זו לא תופעה חדשה
• דולר נמוך עכשיו = הזדמנות להיכנס לדילים במחיר טוב
• אנחנו נכנסים עם מימון מקומי בדולר, אז התנודה לא משפיעה על הרווח"></textarea>
          <span class="wa-field-hint">הטיעונים שלך, הסיבות, נתונים תומכים. הבוט יפתח אותם בפוסט.</span>
        </div>

        <div class="wa-field">
          <label class="form-label" for="waWcTakeaway">המסר / המסקנה</label>
          <textarea id="waWcTakeaway" class="form-input wa-editorial-textarea" rows="2"
                    placeholder="למשל: ירידת דולר זו לא איום — היא הזדמנות, ואנחנו ב-Safe Capital ערוכים לזה."></textarea>
          <span class="wa-field-hint">מה אתה רוצה שהמשקיעים ייקחו איתם בסוף הפוסט.</span>
        </div>

        <div class="wa-field">
          <label class="form-label">אורך מבוקש</label>
          <div class="wa-chip-group" data-name="length_pref">
            <button type="button" class="wa-chip" data-value="short">קצר · 30 שניות</button>
            <button type="button" class="wa-chip active" data-value="medium">בינוני · 60 שניות</button>
            <button type="button" class="wa-chip" data-value="long">ארוך · 90 שניות</button>
          </div>
        </div>

        <div class="wa-field">
          <label class="form-label">רמת רשמיות</label>
          <div class="wa-chip-group" data-name="formality">
            <button type="button" class="wa-chip" data-value="casual_warm">חם וקליל</button>
            <button type="button" class="wa-chip active" data-value="professional_warm">מקצועי-חם</button>
            <button type="button" class="wa-chip" data-value="professional_dry">מקצועי-יבש</button>
          </div>
        </div>
      </div>
      <div class="wa-modal-footer">
        <button class="btn btn-secondary" id="waWcCancel">דלג כרגע</button>
        <button class="btn btn-primary" id="waWcSubmit">
          <span class="material-symbols-outlined">edit</span>
          צור טיוטה ראשונה
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.querySelectorAll('.wa-chip-group').forEach(wireChipGroup);

  modalEl.querySelector('#waWcClose').addEventListener('click', close);
  modalEl.querySelector('#waWcCancel').addEventListener('click', close);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });
  attachDragToDismiss(modalEl, close);

  modalEl.querySelector('#waWcSubmit').addEventListener('click', submit);
  return modalEl;
}

function open(session) {
  ensureModal();
  // Pre-fill from existing session values
  modalEl.querySelector('#waWcAngle').value    = session.editorial_angle    || '';
  modalEl.querySelector('#waWcPoints').value   = session.editorial_points   || '';
  modalEl.querySelector('#waWcTakeaway').value = session.editorial_takeaway || '';
  setActiveChip('length_pref', session.length_pref || 'medium');
  setActiveChip('formality',   session.formality || 'professional_warm');
  modalEl.classList.remove('hidden');
  setTimeout(() => modalEl.querySelector('#waWcAngle')?.focus(), 50);
}

function close() {
  if (modalEl) modalEl.classList.add('hidden');
}

function setActiveChip(name, value) {
  const grp = modalEl.querySelector(`[data-name="${name}"]`);
  if (!grp) return;
  grp.querySelectorAll('.wa-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === value);
  });
}

async function submit() {
  const submitBtn = modalEl.querySelector('#waWcSubmit');
  const session = Store.get().session;
  if (!session) return;

  const payload = {
    editorial_angle:    modalEl.querySelector('#waWcAngle').value.trim()    || null,
    editorial_points:   modalEl.querySelector('#waWcPoints').value.trim()   || null,
    editorial_takeaway: modalEl.querySelector('#waWcTakeaway').value.trim() || null,
    length_pref: readChipValue(modalEl.querySelector('[data-name="length_pref"]')) || 'medium',
    formality:   readChipValue(modalEl.querySelector('[data-name="formality"]')) || 'professional_warm'
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> מייצר טיוטה…';

  try {
    const { session: updated } = await ApiClient.patchSession(session.id, payload);
    Store.setSession(updated);
    close();
    Store.setPostGenerating(true);
    const result = await ApiClient.writePost(session.id, payload.length_pref);
    Store.setPost({
      draftId: result.draft_id,
      content: result.content,
      lengthPref: result.length_pref,
      wordCount: result.word_count
    });
  } catch (err) {
    console.error('Writing config submit failed', err);
    alert('שגיאה ביצירת טיוטה: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> צור טיוטה ראשונה';
    Store.setPostGenerating(false);
  }
}

export function initWritingConfigModal() {
  return { open, close };
}

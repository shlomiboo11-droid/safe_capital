/**
 * Event Tab: FAQs — Q&A list (stored as JSONB).
 */
let _faqItems = [];

function renderFaqsTab(data) {
  const c = document.getElementById('tab-faqs');
  const items = Array.isArray(data.event.faqs) ? [...data.event.faqs] : [];

  c.innerHTML = `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">שאלות ותשובות (FAQ)</h3>
        <button class="btn btn-primary btn-sm" onclick="addFaqItem()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף שאלה
        </button>
      </div>

      <div id="faqsList" class="space-y-3"></div>

      <div class="flex justify-end mt-6">
        <button class="btn btn-primary px-8" onclick="saveFaqs()">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור FAQ
        </button>
      </div>
    </div>
  `;

  _faqItems = items.map(it => ({ question: it.question || '', answer: it.answer || '' }));
  renderFaqsList();
}

function renderFaqsList() {
  const list = document.getElementById('faqsList');
  if (!list) return;
  if (_faqItems.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">אין שאלות — לחץ "הוסף שאלה"</div>';
    return;
  }
  list.innerHTML = _faqItems.map((it, idx) => `
    <div class="border border-gray-200 rounded-lg p-4" data-idx="${idx}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-gray-500 font-inter">#${idx + 1}</span>
        <div class="flex gap-1">
          <button type="button" class="btn btn-secondary btn-sm" onclick="moveFaq(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}><span class="material-symbols-outlined text-sm">arrow_upward</span></button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="moveFaq(${idx}, 1)" ${idx === _faqItems.length - 1 ? 'disabled' : ''}><span class="material-symbols-outlined text-sm">arrow_downward</span></button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="removeFaq(${idx})"><span class="material-symbols-outlined text-sm">delete</span></button>
        </div>
      </div>
      <div class="space-y-3">
        <div>
          <label class="form-label">שאלה</label>
          <input type="text" class="form-input" value="${escAttrQ(it.question)}" oninput="updateFaq(${idx}, 'question', this.value)" placeholder="האם ההגעה מחייבת השקעה?">
        </div>
        <div>
          <label class="form-label">תשובה</label>
          <textarea class="form-input" rows="2" oninput="updateFaq(${idx}, 'answer', this.value)" placeholder="תשובה קצרה...">${escHtmlQ(it.answer)}</textarea>
        </div>
      </div>
    </div>
  `).join('');
}

function addFaqItem() {
  _faqItems.push({ question: '', answer: '' });
  renderFaqsList();
}
function removeFaq(idx) { _faqItems.splice(idx, 1); renderFaqsList(); }
function moveFaq(idx, dir) {
  const tgt = idx + dir;
  if (tgt < 0 || tgt >= _faqItems.length) return;
  [_faqItems[idx], _faqItems[tgt]] = [_faqItems[tgt], _faqItems[idx]];
  renderFaqsList();
}
function updateFaq(idx, field, value) { _faqItems[idx][field] = value; }

async function saveFaqs() {
  const payload = _faqItems.map((it, i) => ({
    question: it.question.trim(),
    answer: it.answer.trim(),
    sort_order: i
  }));
  try {
    await API.put(`/events/${currentEvent.id}`, { faqs: payload });
    showToast('ה-FAQ נשמר');
    currentEvent.faqs = payload;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escAttrQ(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }
function escHtmlQ(v) { return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

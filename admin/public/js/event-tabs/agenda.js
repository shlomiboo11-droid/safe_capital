/**
 * Event Tab: Agenda — list of items (time, title, subtitle, host)
 * Stored as JSONB on the events table.
 */
function renderAgendaTab(data) {
  const c = document.getElementById('tab-agenda');
  const items = Array.isArray(data.event.agenda) ? [...data.event.agenda] : [];

  c.innerHTML = `
    <div class="flex items-center justify-end mb-4">
      <button class="btn btn-primary btn-sm" onclick="addAgendaItem()">
        <span class="material-symbols-outlined text-sm">add</span>
        הוסף שורה
      </button>
    </div>

    <div id="agendaList" class="space-y-3">
      ${items.length === 0 ? '<div class="text-sm text-gray-400 text-center py-6">אין פריטים — לחץ "הוסף שורה"</div>' : ''}
    </div>

    <div class="flex justify-end mt-6">
      <button class="btn btn-primary px-8" onclick="saveAgenda()">
        <span class="material-symbols-outlined text-lg">save</span>
        שמור סדר יום
      </button>
    </div>
  `;

  _agendaItems = items.map(it => ({
    time: it.time || '',
    title: it.title || '',
    subtitle: it.subtitle || '',
    host: it.host || ''
  }));
  renderAgendaList();
}

let _agendaItems = [];

function renderAgendaList() {
  const list = document.getElementById('agendaList');
  if (!list) return;
  if (_agendaItems.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">אין פריטים — לחץ "הוסף שורה"</div>';
    return;
  }
  list.innerHTML = _agendaItems.map((it, idx) => `
    <div class="border border-gray-200 rounded-lg p-4" data-idx="${idx}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <button type="button" class="drag-handle" aria-label="גרור למיקום אחר"><span class="material-symbols-outlined">drag_indicator</span></button>
          <span class="text-xs text-gray-500 font-inter">#${idx + 1}</span>
        </div>
        <div class="flex gap-1">
          <button type="button" class="btn btn-secondary btn-sm" onclick="removeAgendaItem(${idx})" title="מחק"><span class="material-symbols-outlined text-sm">delete</span></button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="form-label">שעה</label>
          <input type="text" class="form-input ltr" dir="ltr" value="${escAttrA(it.time)}" oninput="updateAgendaItem(${idx}, 'time', this.value)" placeholder="19:30">
        </div>
        <div>
          <label class="form-label">כותרת</label>
          <input type="text" class="form-input" value="${escAttrA(it.title)}" oninput="updateAgendaItem(${idx}, 'title', this.value)" placeholder="קבלת פנים">
        </div>
        <div>
          <label class="form-label">תת-כותרת</label>
          <input type="text" class="form-input" value="${escAttrA(it.subtitle)}" oninput="updateAgendaItem(${idx}, 'subtitle', this.value)" placeholder="מינגלינג והיכרות">
        </div>
        <div>
          <label class="form-label">מנחה</label>
          <input type="text" class="form-input" value="${escAttrA(it.host)}" oninput="updateAgendaItem(${idx}, 'host', this.value)" placeholder="כל הצוות">
        </div>
      </div>
    </div>
  `).join('');

  _wireAgendaSortable();
}

function _wireAgendaSortable() {
  if (typeof initSortableList !== 'function') return;
  initSortableList({
    containerSelector: '#agendaList',
    handleSelector: '.drag-handle',
    items: _agendaItems,
    onReorder: () => { saveAgenda(); renderAgendaList(); }
  });
}

function addAgendaItem() {
  _agendaItems.push({ time: '', title: '', subtitle: '', host: '' });
  renderAgendaList();
}

function removeAgendaItem(idx) {
  _agendaItems.splice(idx, 1);
  renderAgendaList();
}

function updateAgendaItem(idx, field, value) {
  _agendaItems[idx][field] = value;
}

async function saveAgenda() {
  const payload = _agendaItems.map((it, i) => ({
    time: it.time.trim(),
    title: it.title.trim(),
    subtitle: it.subtitle.trim(),
    host: it.host.trim(),
    sort_order: i
  }));
  try {
    await API.put(`/events/${currentEvent.id}`, { agenda: payload });
    showToast('סדר היום נשמר');
    currentEvent.agenda = payload;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escAttrA(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }

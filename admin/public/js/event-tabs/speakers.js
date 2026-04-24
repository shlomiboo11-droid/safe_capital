/**
 * Event Tab: Speakers — list of speakers (name, role, initials, badge, image)
 * Stored as JSONB.
 */
let _speakerItems = [];

function renderSpeakersTab(data) {
  const c = document.getElementById('tab-speakers');
  const items = Array.isArray(data.event.speakers) ? [...data.event.speakers] : [];

  c.innerHTML = `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">צוות</h3>
        <button class="btn btn-primary btn-sm" onclick="addSpeakerItem()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף איש צוות
        </button>
      </div>

      <div id="speakersList" class="space-y-3"></div>

      <div class="flex justify-end mt-6">
        <button class="btn btn-primary px-8" onclick="saveSpeakers()">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור צוות
        </button>
      </div>
    </div>
  `;

  _speakerItems = items.map(it => ({
    name: it.name || '',
    role: it.role || '',
    image_url: it.image_url || ''
  }));
  renderSpeakersList();
}

function renderSpeakersList() {
  const list = document.getElementById('speakersList');
  if (!list) return;
  if (_speakerItems.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">אין אנשי צוות — לחץ "הוסף איש צוות"</div>';
    return;
  }
  list.innerHTML = _speakerItems.map((it, idx) => `
    <div class="border border-gray-200 rounded-lg p-4" data-idx="${idx}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <button type="button" class="drag-handle" aria-label="גרור למיקום אחר"><span class="material-symbols-outlined">drag_indicator</span></button>
          <span class="text-xs text-gray-500 font-inter">#${idx + 1}</span>
        </div>
        <div class="flex gap-1">
          <button type="button" class="btn btn-secondary btn-sm" onclick="removeSpeaker(${idx})"><span class="material-symbols-outlined text-sm">delete</span></button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="form-label">שם מלא</label>
          <input type="text" class="form-input" value="${escAttrS(it.name)}" oninput="updateSpeaker(${idx}, 'name', this.value)" placeholder="שלומי דוד">
        </div>
        <div>
          <label class="form-label">תפקיד</label>
          <input type="text" class="form-input" value="${escAttrS(it.role)}" oninput="updateSpeaker(${idx}, 'role', this.value)" placeholder="מייסד, מנהל כספים">
        </div>
        <div class="md:col-span-2">
          <label class="form-label">תמונת איש צוות</label>
          <div class="flex items-center gap-3 flex-wrap">
            <img id="speaker-preview-${idx}" src="${escAttrS(it.image_url)}" alt=""
              style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb;${it.image_url ? '' : 'display:none;'}"
              onerror="this.style.display='none'">
            <input type="file" id="speaker-file-${idx}" accept="image/png,image/jpeg,image/webp" style="display:none;"
              onchange="handleSpeakerFile(${idx}, this.files[0])">
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('speaker-file-${idx}').click()">
              <span class="material-symbols-outlined text-sm">upload</span>
              ${it.image_url ? 'החלף תמונה' : 'בחר תמונה'}
            </button>
            ${it.image_url ? `<button type="button" class="btn btn-secondary btn-sm" onclick="clearSpeakerImage(${idx})"><span class="material-symbols-outlined text-sm">close</span>הסר</button>` : ''}
            <span id="speaker-upload-status-${idx}" class="text-xs text-gray-500"></span>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  _wireSpeakersSortable();
}

function _wireSpeakersSortable() {
  if (typeof initSortableList !== 'function') return;
  initSortableList({
    containerSelector: '#speakersList',
    handleSelector: '.drag-handle',
    items: _speakerItems,
    onReorder: () => { saveSpeakers(); renderSpeakersList(); }
  });
}

function addSpeakerItem() {
  _speakerItems.push({ name: '', role: '', image_url: '' });
  renderSpeakersList();
}
function removeSpeaker(idx) { _speakerItems.splice(idx, 1); renderSpeakersList(); }
function updateSpeaker(idx, field, value) { _speakerItems[idx][field] = value; }

async function saveSpeakers() {
  const payload = _speakerItems.map((it, i) => ({
    name: it.name.trim(),
    role: it.role.trim(),
    image_url: it.image_url.trim(),
    sort_order: i
  }));
  try {
    await API.put(`/events/${currentEvent.id}`, { speakers: payload });
    showToast('הצוות נשמר');
    currentEvent.speakers = payload;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escAttrS(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }

async function handleSpeakerFile(idx, file) {
  if (!file) return;
  const status = document.getElementById('speaker-upload-status-' + idx);
  const MAX = 8 * 1024 * 1024;
  if (file.size > MAX) {
    if (status) status.textContent = 'הקובץ גדול מ-8MB';
    return;
  }
  if (status) status.textContent = 'מעלה...';
  try {
    const form = new FormData();
    form.append('file', file);
    const token = API.getToken ? API.getToken() : localStorage.getItem('sc_token');
    const res = await fetch('/api/upload/speaker-image', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: form
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    const data = await res.json();
    _speakerItems[idx].image_url = data.url;
    if (status) status.textContent = 'נשמר. לחץ "שמור צוות" כדי לעדכן.';
    renderSpeakersList();
  } catch (err) {
    if (status) status.textContent = 'העלאה נכשלה: ' + err.message;
  }
}

function clearSpeakerImage(idx) {
  _speakerItems[idx].image_url = '';
  renderSpeakersList();
}

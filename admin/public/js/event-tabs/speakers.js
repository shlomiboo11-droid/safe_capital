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
        <h3 class="text-lg font-bold">דוברים</h3>
        <button class="btn btn-primary btn-sm" onclick="addSpeakerItem()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף דובר
        </button>
      </div>

      <div id="speakersList" class="space-y-3"></div>

      <div class="flex justify-end mt-6">
        <button class="btn btn-primary px-8" onclick="saveSpeakers()">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור דוברים
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
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">אין דוברים — לחץ "הוסף דובר"</div>';
    return;
  }
  list.innerHTML = _speakerItems.map((it, idx) => `
    <div class="border border-gray-200 rounded-lg p-4" data-idx="${idx}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-gray-500 font-inter">#${idx + 1}</span>
        <div class="flex gap-1">
          <button type="button" class="btn btn-secondary btn-sm" onclick="moveSpeaker(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}><span class="material-symbols-outlined text-sm">arrow_upward</span></button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="moveSpeaker(${idx}, 1)" ${idx === _speakerItems.length - 1 ? 'disabled' : ''}><span class="material-symbols-outlined text-sm">arrow_downward</span></button>
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
          <label class="form-label">תמונת דובר (URL)</label>
          <input type="text" class="form-input ltr" dir="ltr" value="${escAttrS(it.image_url)}" oninput="updateSpeaker(${idx}, 'image_url', this.value)" placeholder="https://...">
        </div>
      </div>
    </div>
  `).join('');
}

function addSpeakerItem() {
  _speakerItems.push({ name: '', role: '', image_url: '' });
  renderSpeakersList();
}
function removeSpeaker(idx) { _speakerItems.splice(idx, 1); renderSpeakersList(); }
function moveSpeaker(idx, dir) {
  const tgt = idx + dir;
  if (tgt < 0 || tgt >= _speakerItems.length) return;
  [_speakerItems[idx], _speakerItems[tgt]] = [_speakerItems[tgt], _speakerItems[idx]];
  renderSpeakersList();
}
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
    showToast('הדוברים נשמרו');
    currentEvent.speakers = payload;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escAttrS(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }

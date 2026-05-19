/**
 * Tab G: Images & Gallery
 * Categories: before, rendering, during, after
 * Layout: horizontal scroll per category, upload + Drive link per category
 */

const IMG_CATEGORIES = [
  { key: 'before',    label: 'לפני שיפוץ',          icon: 'photo_camera' },
  { key: 'rendering', label: 'הדמיות אדריכליות',     icon: 'architecture' },
  { key: 'during',    label: 'במהלך השיפוץ',         icon: 'construction' },
  { key: 'after',     label: 'אחרי שיפוץ',           icon: 'auto_awesome' }
];

let _driveFolders = {};
let _driveStatus = { connected: false };

async function renderImagesTab(data) {
  const images = data.images || [];
  const container = document.getElementById('tab-images');

  const grouped = {};
  for (const cat of IMG_CATEGORIES) {
    grouped[cat.key] = images.filter(img => img.category === cat.key);
  }

  // Load Drive status + linked folders
  try {
    [_driveStatus, _driveFolders] = await Promise.all([
      API.get('/google-drive/status'),
      API.get(`/google-drive/folders/${currentDeal.id}`)
    ]);
  } catch {
    _driveStatus = { connected: false };
    _driveFolders = {};
  }

  container.innerHTML = `
    <!-- Google Drive Connection Status -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-xl">cloud</span>
          <div>
            <h3 class="text-lg font-bold">Google Drive</h3>
            ${_driveStatus.connected
              ? `<p class="text-sm text-green-600">מחובר: ${_driveStatus.email || 'חשבון מחובר'}</p>`
              : `<p class="text-sm text-gray-400">לא מחובר</p>`
            }
          </div>
        </div>
        <div>
          ${_driveStatus.connected
            ? `<button class="btn btn-danger btn-sm" onclick="disconnectGoogleDrive()">
                <span class="material-symbols-outlined text-sm">link_off</span>
                נתק חשבון
              </button>`
            : `<button class="btn btn-primary btn-sm" onclick="connectGoogleDrive()">
                <span class="material-symbols-outlined text-sm">link</span>
                חבר חשבון Google
              </button>`
          }
        </div>
      </div>
    </div>

    <!-- Zillow Auto-Fetch -->
    <div class="card p-6 mb-6">
      <div class="flex items-center gap-3 mb-3">
        <span class="material-symbols-outlined text-primary text-xl">photo_library</span>
        <h3 class="text-lg font-bold">משיכה אוטומטית מ-Zillow</h3>
      </div>
      <p class="text-sm text-gray-500 mb-4">
        ימשוך תמונות של הנכס מ-Zillow ויוסיף אותן לקטגוריה "לפני שיפוץ".
      </p>
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <label class="form-label">Zillow URL</label>
          <input type="text" id="zillowAddressInput" class="form-input ltr text-sm" dir="ltr"
            value="${((typeof currentDeal !== 'undefined' && currentDeal.zillow_url) || '').replace(/"/g, '&quot;')}"
            placeholder="https://www.zillow.com/homedetails/...">
        </div>
        <button type="button" id="fetchZillowBtn" class="btn btn-primary" onclick="fetchZillowImages()" style="padding-top: 0.6rem; padding-bottom: 0.6rem; white-space: nowrap;">
          <span class="material-symbols-outlined text-sm">download</span>
          משוך תמונות מ-Zillow
        </button>
      </div>
      <div id="zillowFetchStatus" class="mt-3 hidden"></div>
    </div>

    <!-- Categories -->
    ${IMG_CATEGORIES.map(cat => {
      const imgs = grouped[cat.key] || [];
      const linked = _driveFolders[cat.key];
      return `
      <div class="card p-6 mb-6" id="img-cat-${cat.key}">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">${cat.icon}</span>
            <h3 class="text-lg font-bold">${cat.label}</h3>
            <span class="text-sm text-gray-400">(${imgs.length})</span>
          </div>
          <div class="flex items-center gap-2">
            ${linked ? `
              <span class="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                <span class="material-symbols-outlined text-sm">folder</span>
                ${linked.folderName || linked.folderId}
              </span>
              <button class="btn btn-secondary btn-sm" onclick="syncDriveFolder('${cat.key}')" title="סנכרן מ-Google Drive">
                <span class="material-symbols-outlined text-sm">sync</span>
                סנכרן
              </button>
              <button class="btn btn-danger btn-sm" onclick="unlinkDriveFolder('${cat.key}')" title="נתק תיקייה">
                <span class="material-symbols-outlined text-sm">link_off</span>
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="openDriveLinkModal('${cat.key}')" title="קשר תיקיית Google Drive">
                <span class="material-symbols-outlined text-sm">folder_shared</span>
                Google Drive
              </button>
            `}
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
              <span class="material-symbols-outlined text-sm">add_photo_alternate</span>
              הוסף תמונות
              <input type="file" multiple accept="image/*" style="display:none;"
                onchange="handleImageUpload(this.files, '${cat.key}')">
            </label>
          </div>
        </div>

        ${linked && linked.lastSynced ? `
          <p class="text-xs text-gray-400 mb-3">סנכרון אחרון: ${new Date(linked.lastSynced).toLocaleString('he-IL')}</p>
        ` : ''}

        ${imgs.length === 0 ? `
          <div class="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg img-drop-zone"
            data-category="${cat.key}"
            ondragover="event.preventDefault(); this.classList.add('border-primary','bg-primary/5');"
            ondragleave="this.classList.remove('border-primary','bg-primary/5');"
            ondrop="handleImageDrop(event, '${cat.key}')">
            <span class="material-symbols-outlined text-3xl">add_photo_alternate</span>
            <p class="text-sm mt-2">גרור תמונות לכאן או לחץ על "הוסף תמונות"</p>
          </div>
        ` : `
          <div class="img-scroll-row"
            ondragover="event.preventDefault(); this.style.outline='2px solid #022445';"
            ondragleave="this.style.outline='';"
            ondrop="this.style.outline=''; handleImageDrop(event, '${cat.key}')">
            ${imgs.map(img => `
              <div class="img-scroll-item" data-img-id="${img.id}">
                <div class="img-scroll-thumb">
                  <img src="${img.image_url}" alt="${img.alt_text || ''}" loading="lazy"
                    onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;\\' ><span class=\\'material-symbols-outlined text-3xl text-gray-300\\'>broken_image</span></div>'">
                </div>
                <div class="img-scroll-actions">
                  <button class="btn btn-danger btn-sm" onclick="deleteImage(${img.id})" title="מחק">
                    <span class="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>`;
    }).join('')}

    <!-- Drive Link Modal -->
    <div id="driveLinkModal" class="modal-overlay hidden" onclick="if(event.target===this)closeDriveLinkModal()">
      <div class="modal-box" style="max-width: 28rem;">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary text-xl">folder_shared</span>
            <h2 class="text-lg font-bold">קישור תיקיית Google Drive</h2>
          </div>
          <button onclick="closeDriveLinkModal()" class="text-gray-400 hover:text-gray-600">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <p class="text-sm text-gray-500 mb-2" id="driveLinkCategoryLabel"></p>

        <div class="mb-4">
          <label class="form-label">קישור התיקייה או Folder ID</label>
          <input type="text" id="driveFolderIdInput" class="form-input ltr text-sm" dir="ltr"
            placeholder="https://drive.google.com/drive/folders/1A2B3C..." >
          <p class="text-xs text-gray-400 mt-2">
            הדבק את כתובת התיקייה המלאה מהדפדפן, או רק את ה-ID.<br>
            המערכת תזהה אוטומטית.
          </p>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" id="driveLinkSubmitBtn" onclick="submitDriveLink()">
            <span class="material-symbols-outlined text-sm">link</span>
            קשר תיקייה
          </button>
          <button class="btn btn-secondary" onclick="closeDriveLinkModal()">ביטול</button>
        </div>
      </div>
    </div>

    <!-- Drive Picker Modal -->
    <div id="drivePickerModal" class="branded-modal-overlay"
      onclick="if(event.target===this) closePickerModal()" style="z-index:70; display:none;">
      <div class="branded-modal" style="max-width: 56rem; padding: 1.5rem; width: 92%;">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">cloud_sync</span>
            <h2 class="branded-modal-title" style="margin:0;" id="pickerTitle">סנכרון תיקיית Google Drive</h2>
          </div>
          <button id="pickerCloseBtn" onclick="closePickerModal()" class="text-gray-400 hover:text-gray-600">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div id="pickerStateLoading" class="py-12 text-center text-gray-500">
          <span class="material-symbols-outlined text-4xl animate-spin">refresh</span>
          <p class="mt-3 text-sm">טוען קבצים מ-Drive...</p>
        </div>

        <div id="pickerStateError" class="hidden py-8 text-center">
          <span class="material-symbols-outlined text-4xl text-red-500">error</span>
          <p id="pickerErrorMsg" class="mt-3 text-sm text-gray-700"></p>
          <button class="btn btn-secondary mt-4" onclick="loadPickerFiles()">
            <span class="material-symbols-outlined text-sm">refresh</span>
            נסה שוב
          </button>
        </div>

        <div id="pickerStateList" class="hidden">
          <div class="flex items-center justify-between mb-3 text-sm">
            <div class="flex items-center gap-3">
              <button class="text-primary hover:underline" onclick="pickerSelectAll(true)">בחר הכל</button>
              <span class="text-gray-300">|</span>
              <button class="text-primary hover:underline" onclick="pickerSelectAll(false)">בטל הכל</button>
            </div>
            <div class="text-gray-500" id="pickerCountLabel">0 מסומנים</div>
          </div>

          <div class="thumbnail-picker-grid" id="pickerGrid" style="max-height: 56vh;"></div>

          <div id="pickerOrphansSection" class="hidden mt-5 pt-4 border-t border-gray-200">
            <p class="text-xs text-gray-500 mb-2">
              <span class="material-symbols-outlined text-sm align-middle">warning</span>
              קבצים אלה כבר לא קיימים ב-Drive. סמן אילו למחוק מהפרויקט.
            </p>
            <div class="thumbnail-picker-grid" id="pickerOrphansGrid" style="max-height: 30vh;"></div>
          </div>

          <div class="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <div class="text-sm text-gray-500" id="pickerDiffLabel">אין שינויים</div>
            <div class="flex gap-2">
              <button class="branded-modal-btn branded-modal-btn-secondary" onclick="closePickerModal()">ביטול</button>
              <button class="branded-modal-btn branded-modal-btn-primary" id="pickerSyncBtn"
                onclick="commitPickerSync()" disabled>סנכרן</button>
            </div>
          </div>
        </div>

        <div id="pickerStateSyncing" class="hidden py-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="material-symbols-outlined animate-spin text-primary">sync</span>
            <p class="text-sm" id="pickerSyncStatus">מסנכרן... אל תסגור את החלון</p>
          </div>
          <div class="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div id="pickerProgressBar" class="bg-primary h-full transition-all" style="width: 0%;"></div>
          </div>
        </div>

        <div id="pickerStateDone" class="hidden py-6">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-green-600">check_circle</span>
            <h3 class="font-bold text-gray-900">הסנכרון הושלם</h3>
          </div>
          <div id="pickerSummary" class="text-sm text-gray-700 space-y-1 mb-4"></div>
          <button class="branded-modal-btn branded-modal-btn-primary" onclick="closePickerModal()">סגור ורענן</button>
        </div>
      </div>
    </div>
  `;

  // Handle driveConnected/driveError from URL params
  _handleDriveUrlParams();
}

// ── Upload handlers ──────────────────────────────────────────

async function handleImageUpload(files, category) {
  if (!files || files.length === 0) return;
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  formData.append('category', category);
  showToast('מעלה תמונות...');
  try {
    await API.upload(`/deals/${currentDeal.id}/images/upload`, formData);
    showToast(`${files.length} תמונות הועלו בהצלחה`);
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleImageDrop(event, category) {
  event.preventDefault();
  const files = event.dataTransfer.files;
  if (files.length > 0) handleImageUpload(files, category);
}

// ── CRUD ─────────────────────────────────────────────────────

async function deleteImage(id) {
  if (!await confirmAction('האם למחוק את התמונה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/images/${id}`);
    showToast('התמונה נמחקה');
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Zillow ───────────────────────────────────────────────────

async function fetchZillowImages() {
  const btn = document.getElementById('fetchZillowBtn');
  const statusEl = document.getElementById('zillowFetchStatus');
  const addressInput = document.getElementById('zillowAddressInput');
  if (!btn || !statusEl || !addressInput) return;

  const address = addressInput.value.trim();
  if (!address) {
    statusEl.className = 'mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3';
    statusEl.textContent = 'יש להזין כתובת נכס לפני המשיכה.';
    statusEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  const originalBtnHTML = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מושך תמונות...';
  statusEl.className = 'mt-3 text-sm text-blue-700 bg-blue-50 rounded-lg p-3';
  statusEl.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מתחבר ל-Zillow...';
  statusEl.classList.remove('hidden');

  try {
    const result = await API.post(`/deals/${currentDeal.id}/fetch-zillow-images`, { url: address });
    const count = result.count || 0;
    statusEl.className = 'mt-3 text-sm text-green-700 bg-green-50 rounded-lg p-3';
    statusEl.textContent = `נמשכו ${count} תמונות מ-Zillow ונשמרו בקטגוריה "לפני שיפוץ".`;
    showToast(`${count} תמונות נמשכו מ-Zillow`);
    reloadDeal(renderImagesTab);
  } catch (err) {
    let errMsg = err.message || 'שגיאה לא ידועה';
    if (errMsg.includes('403') || errMsg.includes('429') || errMsg.includes('חסם')) {
      errMsg = 'Zillow חסם את הבקשה. נסה שוב בעוד מספר דקות.';
    }
    statusEl.className = 'mt-3 text-sm text-red-700 bg-red-50 rounded-lg p-3';
    statusEl.textContent = errMsg;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

// ── Google Drive — one-time connect ──────────────────────────

function connectGoogleDrive() {
  const token = API.getToken();
  window.location.href = `/api/google-drive/auth?token=${encodeURIComponent(token)}`;
}

async function disconnectGoogleDrive() {
  if (!await confirmAction('לנתק את חשבון Google Drive?')) return;
  try {
    await API.delete('/google-drive/disconnect');
    showToast('חשבון Google Drive נותק');
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function _handleDriveUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('driveConnected')) {
    showToast('חשבון Google Drive חובר בהצלחה!');
    window.history.replaceState({}, '', window.location.pathname + '?id=' + currentDeal.id);
  }
  if (params.get('driveError')) {
    showToast('שגיאה בחיבור Google Drive: ' + params.get('driveError'), 'error');
    window.history.replaceState({}, '', window.location.pathname + '?id=' + currentDeal.id);
  }
}

// ── Google Drive — link folder modal ─────────────────────────

let _pendingLinkCategory = null;

function openDriveLinkModal(category) {
  if (!_driveStatus.connected) {
    showToast('יש לחבר חשבון Google Drive קודם — מעביר לחיבור...', 'error');
    setTimeout(() => connectGoogleDrive(), 1200);
    return;
  }
  _pendingLinkCategory = category;
  const catLabel = IMG_CATEGORIES.find(c => c.key === category)?.label || category;
  document.getElementById('driveLinkCategoryLabel').textContent = `קטגוריה: ${catLabel}`;
  document.getElementById('driveFolderIdInput').value = '';
  document.getElementById('driveLinkModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('driveFolderIdInput').focus(), 100);
}

function closeDriveLinkModal() {
  document.getElementById('driveLinkModal').classList.add('hidden');
  _pendingLinkCategory = null;
}

function extractDriveFolderId(input) {
  if (!input) return '';
  const s = input.trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return '';
}

async function submitDriveLink() {
  const raw = document.getElementById('driveFolderIdInput').value.trim();
  const folderId = extractDriveFolderId(raw);
  if (!folderId) {
    showToast('לא זוהה Folder ID תקין — הדבק קישור מלא לתיקייה', 'error');
    return;
  }

  const btn = document.getElementById('driveLinkSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מקשר...';

  try {
    const result = await API.post('/google-drive/link', {
      dealId: currentDeal.id,
      category: _pendingLinkCategory,
      folderId
    });
    const linkedCategory = _pendingLinkCategory;
    closeDriveLinkModal();
    showToast(`תיקייה "${result.folderName}" קושרה — בוחר תמונות לייבוא`);
    // Refresh _driveFolders so subsequent picker open knows about it
    _driveFolders[linkedCategory] = {
      folderId,
      folderName: result.folderName,
      lastSynced: null
    };
    // Auto-open picker for seamless UX
    await openDrivePickerModal(linkedCategory, folderId);
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">link</span> קשר תיקייה';
  }
}

// ── Google Drive — sync (opens picker modal) ─────────────────

async function syncDriveFolder(category) {
  const linked = _driveFolders[category];
  if (!linked) {
    showToast('אין תיקייה מקושרת לקטגוריה הזו', 'error');
    return;
  }
  await openDrivePickerModal(category, linked.folderId);
}

async function unlinkDriveFolder(category) {
  if (!await confirmAction('לנתק את תיקיית Google Drive מקטגוריה זו?')) return;
  try {
    await API.delete(`/google-drive/link/${currentDeal.id}/${category}`);
    showToast('התיקייה נותקה');
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
  }
}

// ── Drive Picker Modal (state machine) ───────────────────────

let _pickerState = null;
// shape: { dealId, category, folderId, files, orphans, selected:Set, originalSelected:Set,
//          orphansSelected:Set, syncing:false }

function _pickerSwitchState(name) {
  for (const s of ['Loading', 'Error', 'List', 'Syncing', 'Done']) {
    const el = document.getElementById('pickerState' + s);
    if (el) el.classList.toggle('hidden', s.toLowerCase() !== name);
  }
}

async function openDrivePickerModal(category, folderId) {
  if (!_driveStatus.connected) {
    showToast('יש לחבר חשבון Google Drive קודם', 'error');
    return;
  }
  const catLabel = IMG_CATEGORIES.find(c => c.key === category)?.label || category;
  document.getElementById('pickerTitle').textContent = `סנכרון תיקיית Google Drive — ${catLabel}`;

  _pickerState = {
    dealId: currentDeal.id,
    category,
    folderId,
    files: [],
    orphans: [],
    selected: new Set(),
    originalSelected: new Set(),
    orphansSelected: new Set(),
    syncing: false
  };

  document.getElementById('drivePickerModal').style.display = 'flex';
  await loadPickerFiles();
}

async function loadPickerFiles() {
  if (!_pickerState) return;
  _pickerSwitchState('loading');
  try {
    const { dealId, category, folderId } = _pickerState;
    const res = await API.get(
      `/google-drive/folder/${folderId}/files?dealId=${dealId}&category=${encodeURIComponent(category)}`
    );
    _pickerState.files = res.files || [];
    _pickerState.orphans = res.orphans || [];
    _pickerState.selected = new Set(_pickerState.files.filter(f => f.synced).map(f => f.id));
    _pickerState.originalSelected = new Set(_pickerState.selected);
    _pickerState.orphansSelected = new Set();  // default: keep orphans (don't delete)
    renderPickerGrid();
    _pickerSwitchState('list');
  } catch (err) {
    let msg = err.message || 'שגיאה לא ידועה';
    if (msg.includes('invalid_grant') || msg.includes('401')) {
      msg = 'חיבור Google Drive פג תוקף — יש להתחבר מחדש';
    } else if (msg.includes('folder_not_found') || msg.includes('404')) {
      msg = 'התיקייה לא נמצאה ב-Drive. ייתכן שנמחקה — נתק וקשר מחדש.';
    }
    document.getElementById('pickerErrorMsg').textContent = msg;
    _pickerSwitchState('error');
  }
}

function renderPickerGrid() {
  if (!_pickerState) return;
  const token = API.getToken();
  const grid = document.getElementById('pickerGrid');
  const files = _pickerState.files;

  if (files.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:#9ca3af; font-size:0.875rem;">
      התיקייה ריקה — אין קבצי תמונה ב-Drive
    </div>`;
  } else {
    grid.innerHTML = files.map(f => {
      const isSelected = _pickerState.selected.has(f.id);
      const isSynced = f.synced;
      return `
        <label class="thumbnail-picker-item" style="position:relative; display:block; outline: ${isSelected ? '3px solid #022445' : '2px solid transparent'}; transition: outline 0.15s;">
          <img src="/api/google-drive/thumb/${f.id}?token=${encodeURIComponent(token)}"
            alt="${(f.name || '').replace(/"/g,'&quot;')}" loading="lazy"
            onerror="this.style.display='none'; this.parentElement.style.background='#f3f4f6';">
          <input type="checkbox" ${isSelected ? 'checked' : ''}
            onchange="togglePickerFile('${f.id}', this.checked)"
            style="position:absolute; top:0.5rem; right:0.5rem; width:1.25rem; height:1.25rem; cursor:pointer; accent-color:#022445; z-index:2;">
          ${isSynced ? `
            <span style="position:absolute; bottom:0.4rem; right:0.4rem; background:rgba(2,36,69,0.85); color:#fff; font-size:0.65rem; padding:0.15rem 0.4rem; border-radius:0.25rem;">
              כבר מסונכרן
            </span>
          ` : ''}
          <span style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent); color:#fff; font-size:0.7rem; padding:0.5rem 0.4rem 0.3rem; text-align:right; direction:ltr; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${(f.name || '').slice(0, 40)}
          </span>
        </label>`;
    }).join('');
  }

  // Orphans section
  const orphansSection = document.getElementById('pickerOrphansSection');
  const orphansGrid = document.getElementById('pickerOrphansGrid');
  if (_pickerState.orphans.length === 0) {
    orphansSection.classList.add('hidden');
  } else {
    orphansSection.classList.remove('hidden');
    orphansGrid.innerHTML = _pickerState.orphans.map(o => {
      const willDelete = _pickerState.orphansSelected.has(o.drive_file_id);
      return `
        <label class="thumbnail-picker-item" style="position:relative; display:block; outline: ${willDelete ? '3px solid #991b1b' : '2px solid transparent'}; transition: outline 0.15s;">
          <img src="${o.image_url}" alt="${(o.alt_text || '').replace(/"/g,'&quot;')}" loading="lazy"
            onerror="this.style.display='none'; this.parentElement.style.background='#f3f4f6';">
          <input type="checkbox" ${willDelete ? 'checked' : ''}
            onchange="togglePickerOrphan('${o.drive_file_id}', this.checked)"
            title="סמן למחיקה מקומית"
            style="position:absolute; top:0.5rem; right:0.5rem; width:1.25rem; height:1.25rem; cursor:pointer; accent-color:#991b1b; z-index:2;">
          <span style="position:absolute; bottom:0.4rem; right:0.4rem; background:rgba(153,27,27,0.85); color:#fff; font-size:0.65rem; padding:0.15rem 0.4rem; border-radius:0.25rem;">
            ${willDelete ? 'יימחק' : 'יישמר'}
          </span>
        </label>`;
    }).join('');
  }

  _updatePickerLabels();
}

function _updatePickerLabels() {
  if (!_pickerState) return;
  const selectedCount = _pickerState.selected.size;
  const total = _pickerState.files.length;
  document.getElementById('pickerCountLabel').textContent = `${selectedCount} מסומנים מתוך ${total}`;

  // Calculate diff vs original
  const orig = _pickerState.originalSelected;
  const cur = _pickerState.selected;
  let toAdd = 0, toRemove = 0;
  for (const id of cur) if (!orig.has(id)) toAdd++;
  for (const id of orig) if (!cur.has(id)) toRemove++;
  const orphansToDelete = _pickerState.orphansSelected.size;

  const totalChanges = toAdd + toRemove + orphansToDelete;
  const parts = [];
  if (toAdd) parts.push(`+${toAdd} להוסיף`);
  if (toRemove) parts.push(`-${toRemove} להסיר`);
  if (orphansToDelete) parts.push(`${orphansToDelete} יתומים למחיקה`);

  const diffLabel = document.getElementById('pickerDiffLabel');
  diffLabel.textContent = parts.length ? parts.join(' · ') : 'אין שינויים';

  const btn = document.getElementById('pickerSyncBtn');
  btn.disabled = totalChanges === 0;
  btn.textContent = totalChanges === 0 ? 'אין שינויים' : `סנכרן ${totalChanges} שינויים`;
}

function togglePickerFile(fileId, checked) {
  if (!_pickerState) return;
  if (checked) _pickerState.selected.add(fileId);
  else _pickerState.selected.delete(fileId);
  renderPickerGrid();  // re-render to update outline
}

function togglePickerOrphan(driveFileId, checked) {
  if (!_pickerState) return;
  if (checked) _pickerState.orphansSelected.add(driveFileId);
  else _pickerState.orphansSelected.delete(driveFileId);
  renderPickerGrid();
}

function pickerSelectAll(selectAll) {
  if (!_pickerState) return;
  if (selectAll) {
    _pickerState.selected = new Set(_pickerState.files.map(f => f.id));
  } else {
    _pickerState.selected = new Set();
  }
  renderPickerGrid();
}

async function commitPickerSync() {
  if (!_pickerState) return;
  _pickerState.syncing = true;
  _pickerSwitchState('syncing');

  try {
    const { dealId, category, selected, orphansSelected } = _pickerState;

    // Build desired set:
    //   • All currently-selected Drive files
    //   • Orphans the user did NOT check for deletion (we want to keep them locally)
    // Backend diff logic: anything in DB with drive_file_id but NOT in fileIds → remove.
    const orphansToKeep = _pickerState.orphans
      .filter(o => !orphansSelected.has(o.drive_file_id))
      .map(o => o.drive_file_id);
    const fileIds = [...selected, ...orphansToKeep];

    document.getElementById('pickerSyncStatus').textContent = 'מסנכרן בחירה...';
    document.getElementById('pickerProgressBar').style.width = '30%';

    const result = await API.post(
      `/google-drive/sync-selection/${dealId}/${encodeURIComponent(category)}`,
      { fileIds }
    );

    document.getElementById('pickerProgressBar').style.width = '100%';

    // Show summary
    const summary = result.summary || {};
    const summaryHtml = `
      <p>✓ נוספו: <strong>${summary.added || 0}</strong> תמונות</p>
      <p>✗ הוסרו: <strong>${summary.removed || 0}</strong> תמונות (Drive לא נגוע)</p>
      <p>• נשמרו: <strong>${summary.kept || 0}</strong> תמונות</p>
      ${summary.failed ? `<p class="text-red-600">⚠ נכשלו: <strong>${summary.failed}</strong></p>` : ''}
    `;
    document.getElementById('pickerSummary').innerHTML = summaryHtml;
    _pickerSwitchState('done');
  } catch (err) {
    let msg = err.message || 'שגיאה לא ידועה';
    if (msg.includes('invalid_grant')) msg = 'חיבור Google Drive פג תוקף';
    document.getElementById('pickerErrorMsg').textContent = msg;
    _pickerSwitchState('error');
  } finally {
    _pickerState.syncing = false;
  }
}

function closePickerModal() {
  if (_pickerState && _pickerState.syncing) {
    showToast('סנכרון בעיצומו — אל תסגור', 'error');
    return;
  }
  document.getElementById('drivePickerModal').style.display = 'none';
  const wasOpen = _pickerState !== null;
  _pickerState = null;
  // Refresh the deal so newly added/removed images appear in the gallery
  if (wasOpen) reloadDeal(renderImagesTab);
}

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
    closeDriveLinkModal();
    showToast(`תיקייה "${result.folderName}" קושרה בהצלחה`);
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">link</span> קשר תיקייה';
  }
}

// ── Google Drive — sync ──────────────────────────────────────

async function syncDriveFolder(category) {
  const btn = event.target.closest('button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מסנכרן...';
  }
  try {
    const result = await API.post(`/google-drive/sync/${currentDeal.id}/${category}`, {});
    showToast(`סנכרון הושלם — ${result.added} תמונות חדשות נוספו`);
    reloadDeal(renderImagesTab);
  } catch (err) {
    showToast('שגיאה בסנכרון: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">sync</span> סנכרן';
    }
  }
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

/**
 * Event Tab: Featured Deals
 * Links deals from the deals table OR falls back to manual data.
 */
let _allDealsCache = null;

function renderFeaturedDealsTab(data) {
  const c = document.getElementById('tab-featured-deals');
  const items = data.featured_deals || [];

  c.innerHTML = `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">עסקאות מוצגות בעמוד האירוע</h3>
        <button class="btn btn-primary btn-sm" onclick="openAddFeaturedDeal()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף עסקה
        </button>
      </div>

      <p class="text-sm text-gray-500 mb-4">
        שורה שמקושרת לעסקה קיימת תמשוך נתונים חיים (גיוס, משקיעים, סטטוס).
        ניתן גם להזין נתוני fallback שיוצגו אם אין עסקה מקושרת.
      </p>

      <div id="featuredDealsList" class="space-y-3"></div>
    </div>

    <!-- Add/Edit Modal -->
    <div id="fdModal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width:40rem;">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-bold" id="fdModalTitle">הוספת עסקה</h2>
          <button onclick="closeFdModal()" class="text-gray-400 hover:text-gray-600">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <form id="fdForm" class="space-y-4">
          <input type="hidden" id="fdId">

          <div>
            <label class="form-label">קישור לעסקה קיימת (אופציונלי)</label>
            <select id="fdDealId" class="form-select">
              <option value="">— ללא עסקה מקושרת (שימוש ב-fallback) —</option>
            </select>
            <div class="text-xs text-gray-400 mt-1">
              אם בוחרים עסקה — הכתובת, תמונה, סטטוס, גיוס ומשקיעים נשלפים אוטומטית מהעסקה
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="form-label">Fallback — כתובת</label>
              <input type="text" id="fdFallbackAddress" class="form-input" placeholder="Mountain Ave 206">
            </div>
            <div>
              <label class="form-label">Fallback — מספר עסקה</label>
              <input type="text" id="fdFallbackDealNumber" class="form-input ltr" dir="ltr" placeholder="2">
            </div>
            <div>
              <label class="form-label">Fallback — גיוס כולל (תצוגה)</label>
              <input type="text" id="fdFallbackRaised" class="form-input ltr" dir="ltr" placeholder="$268,194">
            </div>
            <div>
              <label class="form-label">Fallback — מספר משקיעים</label>
              <input type="number" id="fdFallbackInvestorCount" class="form-input ltr font-inter" dir="ltr" placeholder="4">
            </div>
            <div>
              <label class="form-label">Fallback — תשואה (תצוגה)</label>
              <input type="text" id="fdFallbackRoi" class="form-input" placeholder="20%">
            </div>
            <div>
              <label class="form-label">סדר תצוגה</label>
              <input type="number" id="fdSortOrder" class="form-input ltr" dir="ltr" value="0">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-4">
            <div>
              <label class="form-label">Override — תווית סטטוס</label>
              <input type="text" id="fdOverrideStatusLabel" class="form-input" placeholder="בתהליך שיפוץ / הושלמה / בשיווק">
            </div>
            <div>
              <label class="form-label">Override — טון הסטטוס</label>
              <select id="fdOverrideStatusTone" class="form-select">
                <option value="">— ברירת מחדל —</option>
                <option value="active">active (צהוב — בשיפוץ)</option>
                <option value="marketing">marketing (כחול — בשיווק)</option>
                <option value="done">done (ירוק — הושלם)</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="form-label">Override — הערה</label>
              <input type="text" id="fdOverrideNote" class="form-input" placeholder="הערה קצרה שמופיעה על הכרטיס">
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button type="submit" class="btn btn-primary flex-1">שמור</button>
            <button type="button" onclick="closeFdModal()" class="btn btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderFeaturedDealsList(items);
  loadAllDealsForPicker();
}

async function loadAllDealsForPicker() {
  if (_allDealsCache) return _allDealsCache;
  try {
    const data = await API.get('/deals');
    _allDealsCache = data.deals || [];
    // Populate select
    const sel = document.getElementById('fdDealId');
    if (sel) {
      _allDealsCache.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `#${d.deal_number || '—'} · ${d.name || d.full_address || 'ללא שם'}`;
        sel.appendChild(opt);
      });
    }
    return _allDealsCache;
  } catch (err) {
    console.error('Failed to load deals:', err);
    return [];
  }
}

function renderFeaturedDealsList(items) {
  const list = document.getElementById('featuredDealsList');
  if (!list) return;
  if (items.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">אין עסקאות מוצגות</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const linked = item.deal_id != null;
    const address = item.deal_full_address || item.deal_name || item.fallback_address || '(ללא כתובת)';
    const dealNumber = item.deal_number || item.fallback_deal_number || '';
    const linkedBadge = linked
      ? '<span class="badge badge-green text-xs">מקושר לעסקה</span>'
      : '<span class="badge badge-gray text-xs">Fallback בלבד</span>';

    return `
      <div class="border border-gray-200 rounded-lg p-4 flex items-start gap-4">
        ${item.deal_thumbnail
          ? `<img src="${escAttrFd(item.deal_thumbnail)}" class="w-20 h-20 object-cover rounded" alt="">`
          : `<div class="w-20 h-20 bg-gray-100 rounded flex items-center justify-center"><span class="material-symbols-outlined text-gray-400">home</span></div>`
        }
        <div style="flex:1;min-width:0;">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold">${escHtmlFd(address)}</span>
            ${dealNumber ? `<span class="badge badge-gray text-xs font-inter">#${escHtmlFd(dealNumber)}</span>` : ''}
            ${linkedBadge}
          </div>
          <div class="text-xs text-gray-500">
            גיוס: ${escHtmlFd(item.fallback_raised_display || '—')} ·
            משקיעים: ${escHtmlFd(item.fallback_investor_count || '—')} ·
            תשואה: ${escHtmlFd(item.fallback_roi_display || '—')}
          </div>
          ${item.override_status_label
            ? `<div class="text-xs mt-1"><span class="badge badge-blue text-xs">${escHtmlFd(item.override_status_label)}</span></div>`
            : ''
          }
        </div>
        <div class="flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick='openEditFeaturedDeal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
            <span class="material-symbols-outlined text-sm">edit</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="deleteFeaturedDeal(${item.id})">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddFeaturedDeal() {
  document.getElementById('fdId').value = '';
  document.getElementById('fdModalTitle').textContent = 'הוספת עסקה';
  document.getElementById('fdDealId').value = '';
  document.getElementById('fdFallbackAddress').value = '';
  document.getElementById('fdFallbackDealNumber').value = '';
  document.getElementById('fdFallbackRaised').value = '';
  document.getElementById('fdFallbackInvestorCount').value = '';
  document.getElementById('fdFallbackRoi').value = '';
  document.getElementById('fdSortOrder').value = (currentEventData.featured_deals || []).length;
  document.getElementById('fdOverrideStatusLabel').value = '';
  document.getElementById('fdOverrideStatusTone').value = '';
  document.getElementById('fdOverrideNote').value = '';
  document.getElementById('fdModal').classList.remove('hidden');
}

function openEditFeaturedDeal(item) {
  document.getElementById('fdId').value = item.id;
  document.getElementById('fdModalTitle').textContent = 'עריכת עסקה';
  document.getElementById('fdDealId').value = item.deal_id || '';
  document.getElementById('fdFallbackAddress').value = item.fallback_address || '';
  document.getElementById('fdFallbackDealNumber').value = item.fallback_deal_number || '';
  document.getElementById('fdFallbackRaised').value = item.fallback_raised_display || '';
  document.getElementById('fdFallbackInvestorCount').value = item.fallback_investor_count != null ? item.fallback_investor_count : '';
  document.getElementById('fdFallbackRoi').value = item.fallback_roi_display || '';
  document.getElementById('fdSortOrder').value = item.sort_order || 0;
  document.getElementById('fdOverrideStatusLabel').value = item.override_status_label || '';
  document.getElementById('fdOverrideStatusTone').value = item.override_status_tone || '';
  document.getElementById('fdOverrideNote').value = item.override_note || '';
  document.getElementById('fdModal').classList.remove('hidden');
}

function closeFdModal() {
  document.getElementById('fdModal').classList.add('hidden');
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'fdForm') return;
  e.preventDefault();

  const id = document.getElementById('fdId').value;
  const body = {
    deal_id: document.getElementById('fdDealId').value ? parseInt(document.getElementById('fdDealId').value) : null,
    fallback_address: document.getElementById('fdFallbackAddress').value.trim(),
    fallback_deal_number: document.getElementById('fdFallbackDealNumber').value.trim(),
    fallback_raised_display: document.getElementById('fdFallbackRaised').value.trim(),
    fallback_investor_count: document.getElementById('fdFallbackInvestorCount').value ? parseInt(document.getElementById('fdFallbackInvestorCount').value) : null,
    fallback_roi_display: document.getElementById('fdFallbackRoi').value.trim(),
    sort_order: parseInt(document.getElementById('fdSortOrder').value) || 0,
    override_status_label: document.getElementById('fdOverrideStatusLabel').value.trim(),
    override_status_tone: document.getElementById('fdOverrideStatusTone').value,
    override_note: document.getElementById('fdOverrideNote').value.trim()
  };

  try {
    if (id) {
      await API.put(`/events/${currentEvent.id}/featured-deals/${id}`, body);
      showToast('העסקה עודכנה');
    } else {
      await API.post(`/events/${currentEvent.id}/featured-deals`, body);
      showToast('העסקה נוספה');
    }
    closeFdModal();
    reloadEvent((data) => renderFeaturedDealsTab(data));
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteFeaturedDeal(fdId) {
  const ok = await confirmAction('להסיר את העסקה מהאירוע?');
  if (!ok) return;
  try {
    await API.delete(`/events/${currentEvent.id}/featured-deals/${fdId}`);
    showToast('הוסר');
    reloadEvent((data) => renderFeaturedDealsTab(data));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escAttrFd(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }
function escHtmlFd(v) { return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

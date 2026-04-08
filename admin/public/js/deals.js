/**
 * Deal list page logic
 */

(function() {
  if (!requireAuth()) return;

  const user = API.getUser();

  // Show user info in sidebar
  document.getElementById('sidebar-username').textContent = user.full_name;
  document.getElementById('sidebar-role').textContent =
    user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל';

  // Show user management link for super_admin
  if (user.role === 'super_admin') {
    document.getElementById('nav-users').style.display = '';
  }

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Close any open deal card menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.deal-card-menu-btn') && !e.target.closest('.deal-card-menu')) {
      document.querySelectorAll('.deal-card-menu').forEach(m => m.remove());
    }
  });

  loadDeals();
})();

async function loadDeals() {
  const container = document.getElementById('dealsContainer');
  const loading = document.getElementById('loadingState');
  const empty = document.getElementById('emptyState');

  try {
    const data = await API.get('/deals');
    loading.classList.add('hidden');
    loading.style.display = 'none';

    if (!data.deals || data.deals.length === 0) {
      empty.classList.remove('hidden');
      empty.style.display = '';
      return;
    }

    // Stats
    document.getElementById('stat-total').textContent = data.deals.length;
    document.getElementById('stat-active').textContent =
      data.deals.filter(d => ['renovation', 'planning', 'purchased'].includes(d.property_status)).length;
    document.getElementById('stat-sold').textContent =
      data.deals.filter(d => d.property_status === 'sold').length;
    document.getElementById('stat-fundraising').textContent =
      data.deals.filter(d => d.fundraising_status === 'active').length;

    // Render deal cards
    container.innerHTML = data.deals.map(deal => renderDealCard(deal)).join('');

  } catch (err) {
    loading.innerHTML = `<p class="text-red-500">שגיאה בטעינת העסקאות: ${err.message}</p>`;
  }
}

function renderDealCard(deal) {
  const fundLabel = FUNDRAISING_STATUS[deal.fundraising_status] || deal.fundraising_status;
  const fundBadge = FUNDRAISING_STATUS_BADGE[deal.fundraising_status] || 'badge-gray';
  const raised = deal.total_raised || 0;
  const goal = deal.fundraising_goal || 0;
  const fundPct = goal > 0 ? Math.min(100, (raised / goal * 100)) : 0;
  const thumbnailSrc = deal.thumbnail_url || deal.first_before_image;

  return `
    <a href="/deal?id=${deal.id}" class="card hover:shadow-md transition-shadow group">
      <!-- Thumbnail -->
      <div class="h-40 bg-gray-100 rounded-t-xl overflow-hidden relative">
        ${thumbnailSrc
          ? `<img src="${thumbnailSrc}" alt="${deal.name}" class="w-full h-full object-cover">`
          : `<div class="flex items-center justify-center h-full">
               <span class="material-symbols-outlined text-4xl text-gray-300">home</span>
             </div>`
        }
        <button type="button" class="deal-card-menu-btn" style="position:absolute;top:0.75rem;right:0.75rem;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,0,0,0.4);border:none;color:#fff;cursor:pointer;padding:0;transition:background 0.15s;" onmouseover="this.style.background='rgba(0,0,0,0.6)'" onmouseout="this.style.background='rgba(0,0,0,0.4)'" onclick="event.preventDefault();event.stopPropagation();toggleDealMenu(event, ${deal.id})">
          <span class="material-symbols-outlined" style="font-size:1.25rem">more_vert</span>
        </button>
        ${deal.deal_number ? `<div class="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded font-inter">#${deal.deal_number}</div>` : ''}
      </div>

      <!-- Info -->
      <div class="p-4">
        <h3 class="font-bold text-gray-900 group-hover:text-primary transition-colors">${deal.name}</h3>

        <div class="flex items-center gap-2 mt-3">
          <span class="badge ${fundBadge} text-xs">${fundLabel}</span>
          <span class="badge ${PROPERTY_STATUS_BADGE[deal.property_status] || 'badge-gray'} text-xs">${PROPERTY_STATUS[deal.property_status] || deal.property_status || '--'}</span>
        </div>

        ${goal > 0 ? `
        <div class="mt-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span class="font-inter" dir="ltr">${formatCurrency(raised)} / ${formatCurrency(goal)}</span>
            <span>גיוס: ${formatPercent(fundPct, 0)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${fundPct}%"></div>
          </div>
        </div>` : ''}

        ${deal.purchase_price ? `
        <div class="mt-3 pt-3 border-t border-gray-100">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">מחיר רכישה</span>
            <span class="font-inter font-semibold text-primary">${formatCurrency(deal.purchase_price)}</span>
          </div>
        </div>` : ''}
      </div>
    </a>
  `;
}

// ── 3-dot menu ────────────────────────────────────────────

function toggleDealMenu(event, dealId) {
  // Close any existing menus
  document.querySelectorAll('.deal-card-menu').forEach(m => m.remove());

  const btn = event.currentTarget;
  const container = btn.closest('.relative');

  const menu = document.createElement('div');
  menu.className = 'deal-card-menu';
  menu.innerHTML = `
    <div class="deal-card-menu-item" onclick="event.preventDefault();event.stopPropagation();openThumbnailPicker(${dealId})">
      <span class="material-symbols-outlined" style="font-size:1rem">image</span>
      בחר תמונה ראשית
    </div>
    <div class="deal-card-menu-item primary" onclick="event.preventDefault();event.stopPropagation();openInlineCashflow(${dealId})">
      <span class="material-symbols-outlined" style="font-size:1rem">add_circle</span>
      הוסף פעולה חשבונאית
    </div>
    <div class="deal-card-menu-item danger" onclick="event.preventDefault();event.stopPropagation();deleteDealWithPassword(${dealId})">
      <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
      מחק עסקה
    </div>
  `;

  container.appendChild(menu);
}

// ── Inline Quick Cashflow (no page navigation) ───────────

let _inlineCfDealId = null;
let _inlineCfCategories = [];
let _inlineCfType = 'expense';

async function openInlineCashflow(dealId) {
  // Close menu
  document.querySelectorAll('.deal-card-menu').forEach(m => m.remove());

  _inlineCfDealId = dealId;
  _inlineCfType = 'expense';

  // Fetch deal data to get categories
  let categories = [];
  try {
    const data = await API.get(`/deals/${dealId}`);
    categories = data.categories || [];
  } catch (err) {
    showToast('שגיאה בטעינת נתוני עסקה', 'error');
    return;
  }
  _inlineCfCategories = categories;

  const catOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const today = new Date().toISOString().split('T')[0];

  const overlay = document.createElement('div');
  overlay.className = 'branded-modal-overlay';
  overlay.id = 'inlineCashflowOverlay';
  overlay.innerHTML = `
    <div class="branded-modal" style="max-width:28rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
        <h3 class="branded-modal-title" style="margin-bottom:0">הוספת תנועה מהירה</h3>
        <button type="button" onclick="closeInlineCashflow()" style="background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px;">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form id="inlineCashflowForm" onsubmit="submitInlineCashflow(event)">
        <!-- Amount -->
        <div style="margin-bottom:1.25rem;">
          <label class="form-label" style="font-size:1rem;">סכום ($)</label>
          <input type="text" inputmode="numeric" name="amount" data-currency="true"
            class="form-input ltr" style="font-size:1.5rem;font-weight:700;text-align:center;padding:1rem;font-family:'Inter',sans-serif;"
            placeholder="0"
            onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)" required>
        </div>

        <!-- Type toggle -->
        <div style="margin-bottom:1.25rem;">
          <label class="form-label">סוג תנועה</label>
          <div style="display:flex;gap:0.5rem;">
            <button type="button" class="qcf-type-btn qcf-type-expense active" onclick="setInlineCfType('expense',this)">
              <span class="material-symbols-outlined" style="font-size:0.875rem">arrow_upward</span>
              הוצאה
            </button>
            <button type="button" class="qcf-type-btn qcf-type-income" onclick="setInlineCfType('income',this)">
              <span class="material-symbols-outlined" style="font-size:0.875rem">arrow_downward</span>
              הכנסה
            </button>
          </div>
          <input type="hidden" name="type" value="expense">
        </div>

        <!-- Category (expense only) -->
        <div style="margin-bottom:1rem;" id="icf-category-wrapper">
          <label class="form-label">קטגוריה</label>
          <select name="category_id" class="form-select" style="font-size:0.875rem;" id="icf-category" onchange="updateInlineCostItems()">
            <option value="">-- בחר קטגוריה --</option>
            ${catOptions}
          </select>
        </div>

        <!-- Sub-category (expense only) -->
        <div style="margin-bottom:1rem;" id="icf-costitem-wrapper">
          <label class="form-label">תת-קטגוריה (פריט)</label>
          <select name="cost_item_id" class="form-select" style="font-size:0.875rem;" id="icf-costitem">
            <option value="">-- ללא --</option>
          </select>
        </div>

        <!-- Funding source -->
        <div style="margin-bottom:1rem;">
          <label class="form-label">מקור מימון</label>
          <select name="funding_source" class="form-select" style="font-size:0.875rem;" required>
            <option value="">-- בחר מקור --</option>
            <option value="equity">הון עצמי (Equity)</option>
            <option value="loan">הלוואה (Loan)</option>
            <option value="sale">הכנסת מכירה (Sale)</option>
            <option value="other">אחר</option>
          </select>
        </div>

        <!-- Description -->
        <div style="margin-bottom:1rem;">
          <label class="form-label">תיאור</label>
          <input type="text" name="description" class="form-input" style="font-size:0.875rem;" placeholder="תיאור התנועה (אופציונלי)">
        </div>

        <!-- Date -->
        <div style="margin-bottom:1.5rem;">
          <label class="form-label">תאריך</label>
          <input type="date" name="date" class="form-input ltr" style="font-size:0.875rem;" value="${today}" required>
        </div>

        <!-- Submit -->
        <button type="submit" id="icf-submit-btn" class="btn btn-primary" style="width:100%;padding:0.75rem;font-size:1rem;">
          <span class="material-symbols-outlined" style="font-size:0.875rem">save</span>
          שמור תנועה
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInlineCashflow(); });
}

function closeInlineCashflow() {
  const el = document.getElementById('inlineCashflowOverlay');
  if (el) el.remove();
}

function setInlineCfType(type, clickedBtn) {
  _inlineCfType = type;
  const form = document.getElementById('inlineCashflowForm');
  form.querySelector('[name="type"]').value = type;

  const expBtn = form.querySelector('.qcf-type-expense');
  const incBtn = form.querySelector('.qcf-type-income');
  expBtn.classList.toggle('active', type === 'expense');
  incBtn.classList.toggle('active', type === 'income');

  document.getElementById('icf-category-wrapper').style.display = type === 'expense' ? '' : 'none';
  document.getElementById('icf-costitem-wrapper').style.display = type === 'expense' ? '' : 'none';

  if (type === 'income') {
    form.querySelector('[name="category_id"]').value = '';
    form.querySelector('[name="cost_item_id"]').value = '';
  }
}

function updateInlineCostItems() {
  const catId = document.getElementById('icf-category').value;
  const itemSelect = document.getElementById('icf-costitem');
  itemSelect.innerHTML = '<option value="">-- ללא --</option>';
  if (!catId) return;

  const cat = _inlineCfCategories.find(c => c.id == catId);
  if (cat && cat.items) {
    for (const item of cat.items) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      itemSelect.appendChild(opt);
    }
  }
}

async function submitInlineCashflow(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('icf-submit-btn');

  const body = {
    date: form.date.value,
    type: form.type.value,
    amount: parseAmount(form.amount.value),
    description: form.description.value.trim() || null,
    funding_source: form.funding_source.value || null
  };

  if (body.type === 'expense') {
    body.category_id = form.category_id.value ? parseInt(form.category_id.value) : null;
    body.cost_item_id = form.cost_item_id.value ? parseInt(form.cost_item_id.value) : null;
  } else {
    body.category_id = null;
    body.cost_item_id = null;
  }

  if (!body.amount || body.amount <= 0) { showToast('נא להזין סכום', 'error'); return; }
  if (!body.funding_source) { showToast('נא לבחור מקור מימון', 'error'); return; }
  if (body.type === 'expense' && !body.category_id) { showToast('נא לבחור קטגוריה עבור הוצאה', 'error'); return; }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.875rem">refresh</span> שומר...';

  try {
    await API.post(`/deals/${_inlineCfDealId}/cashflow`, body);
    showToast('התנועה נוספה בהצלחה');
    closeInlineCashflow();
  } catch (err) {
    showToast(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.875rem">save</span> שמור תנועה';
  }
}

// ── Thumbnail picker modal ────────────────────────────────

async function openThumbnailPicker(dealId) {
  // Close menu
  document.querySelectorAll('.deal-card-menu').forEach(m => m.remove());

  try {
    const data = await API.get(`/deals/${dealId}`);
    const images = data.images || [];

    if (images.length === 0) {
      showToast('אין תמונות לעסקה זו', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
      <div class="branded-modal" style="max-width:36rem">
        <h3 class="branded-modal-title">בחר תמונה ראשית</h3>
        <div class="thumbnail-picker-grid">
          ${images.map(img => `
            <div class="thumbnail-picker-item" data-url="${img.image_url}">
              <img src="${img.image_url}" alt="${img.category || ''}">
            </div>
          `).join('')}
        </div>
        <div class="branded-modal-actions" style="margin-top:1rem">
          <button type="button" class="branded-modal-btn branded-modal-btn-secondary" data-action="cancel">ביטול</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Click on image to select
    overlay.querySelectorAll('.thumbnail-picker-item').forEach(item => {
      item.addEventListener('click', async () => {
        const url = item.dataset.url;
        try {
          await API.put(`/deals/${dealId}`, { thumbnail_url: url });
          overlay.remove();
          showToast('התמונה עודכנה');
          loadDeals();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Close
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Delete with password verification ─────────────────────

async function deleteDealWithPassword(dealId) {
  // Close menu
  document.querySelectorAll('.deal-card-menu').forEach(m => m.remove());

  const confirmed = await showConfirmModal('מחיקת עסקה', 'האם אתה בטוח שברצונך למחוק עסקה זו? פעולה זו אינה ניתנת לביטול.');
  if (!confirmed) return;

  const password = await showPromptModal('אימות סיסמה', 'הזן את הסיסמה שלך');
  if (!password) return;

  try {
    const verifyRes = await API.post('/auth/verify-password', { password });
    if (!verifyRes.valid) {
      showToast('סיסמה שגויה', 'error');
      return;
    }

    await API.delete(`/deals/${dealId}`);
    showToast('העסקה נמחקה');
    loadDeals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── New deal modal ────────────────────────────────────────

function createNewDeal() {
  document.getElementById('newDealModal').classList.remove('hidden');
  document.getElementById('newDealName').focus();
}

function closeNewDealModal() {
  document.getElementById('newDealModal').classList.add('hidden');
  document.getElementById('newDealForm').reset();
}

document.getElementById('newDealForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('newDealName').value.trim();
  const full_address = document.getElementById('newDealAddress').value.trim();
  const city = document.getElementById('newDealCity').value.trim();
  const state = document.getElementById('newDealState').value.trim();

  if (!name) return;

  try {
    const data = await API.post('/deals', { name, full_address, city, state });
    closeNewDealModal();
    // Navigate to the new deal
    window.location.href = `/deal?id=${data.id}`;
  } catch (err) {
    showToast(err.message, 'error');
  }
});

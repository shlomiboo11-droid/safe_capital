/**
 * Deal Edit Page — orchestrator
 * Loads deal data and delegates to individual tab modules
 */

let currentDeal = null;
let currentDealData = null;

(function() {
  if (!requireAuth()) return;

  const user = API.getUser();
  document.getElementById('sidebar-username').textContent = user.full_name;
  document.getElementById('sidebar-role').textContent = user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל';
  if (user.role === 'super_admin') document.getElementById('nav-users').style.display = '';

  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  initTabs();
  loadDeal();
})();

async function loadDeal() {
  const dealId = getDealIdFromUrl();
  if (!dealId) {
    window.location.href = '/';
    return;
  }

  try {
    const data = await API.get(`/deals/${dealId}`);
    currentDeal = data.deal;
    currentDealData = data;

    // Update header
    document.getElementById('dealTitle').textContent = data.deal.name;
    document.getElementById('dealNumber').textContent = `#${data.deal.deal_number}`;

    const status = PROPERTY_STATUS[data.deal.property_status] || data.deal.property_status;
    const badge = PROPERTY_STATUS_BADGE[data.deal.property_status] || 'badge-gray';
    document.getElementById('dealStatusBadge').textContent = status;
    document.getElementById('dealStatusBadge').className = `badge ${badge}`;

    document.title = `${data.deal.name} | Safe Capital Admin`;

    // Render all tabs
    renderPropertyTab(data);
    renderFinancialTab(data);
    renderRenovationTab(data);
    renderFundraisingTab(data);
    renderCashflowTab(data);
    // Specs are rendered inside the property tab
    renderImagesTab(data);
    renderCompsTab(data);
    renderDocumentsTab(data);

    // Auto-open quick cashflow modal if navigated with #quick-cashflow hash
    if (window.location.hash === '#quick-cashflow') {
      // Clear hash to avoid re-opening on reload
      history.replaceState(null, '', window.location.pathname + window.location.search);
      openQuickCashflow();
    }

  } catch (err) {
    document.getElementById('dealTitle').textContent = 'שגיאה בטעינה';
    showToast(err.message, 'error');
  }
}

async function saveDealField(field, value) {
  const dealId = currentDeal.id;
  try {
    await API.put(`/deals/${dealId}`, { [field]: value });
    currentDeal[field] = value;
  } catch (err) {
    showToast(`שגיאה בשמירה: ${err.message}`, 'error');
  }
}

async function deleteDeal() {
  if (!await confirmAction(`האם למחוק את העסקה "${currentDeal.name}"? פעולה זו אינה ניתנת לביטול.`)) return;
  try {
    await API.delete(`/deals/${currentDeal.id}`);
    showToast('העסקה נמחקה');
    window.location.href = '/';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Reload deal data and re-render a specific tab.
 * Debounced: if a reload is already in flight, the new renderTab
 * callback is queued and executed once the current fetch completes,
 * avoiding redundant API calls on rapid user actions.
 */
let _reloadInFlight = false;
let _reloadPending = null;

async function reloadDeal(renderTab) {
  if (_reloadInFlight) {
    // Queue the latest render callback; it will run after the current fetch
    _reloadPending = renderTab;
    return;
  }

  _reloadInFlight = true;
  try {
    const data = await API.get(`/deals/${currentDeal.id}`);
    currentDeal = data.deal;
    currentDealData = data;
    if (renderTab) renderTab(data);

    // If another reload was requested while we were fetching, run it now
    if (_reloadPending) {
      const pendingRender = _reloadPending;
      _reloadPending = null;
      pendingRender(data);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    _reloadInFlight = false;
  }
}

// ── Quick Cashflow FAB + Modal ──────────────────────────────

let _qcfCurrentType = 'expense';
let _qcfEditingId = null; // null = add mode, number = edit mode

function openQuickCashflow(editEntry) {
  const modal = document.getElementById('quickCashflowModal');
  const form = document.getElementById('quickCashflowForm');
  const title = modal.querySelector('h2');
  const submitBtn = document.getElementById('qcf-submit-btn');

  // Reset form
  form.reset();

  // Populate categories from current deal data (must happen before setting values)
  populateQuickCategories();

  if (editEntry) {
    // ── Edit mode ──
    _qcfEditingId = editEntry.id;
    title.textContent = 'עריכת תנועה';
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> עדכן תנועה';

    // Pre-populate fields
    form.querySelector('[name="amount"]').value = formatCurrency(editEntry.amount);
    form.querySelector('[name="date"]').value = editEntry.date ? editEntry.date.split('T')[0] : '';
    form.querySelector('[name="description"]').value = editEntry.description || '';
    form.querySelector('[name="funding_source"]').value = editEntry.funding_source || '';

    // Set type
    const type = editEntry.type || 'expense';
    setQuickCashflowType(type);

    // Set category and cost item (after populateQuickCategories)
    if (type === 'expense') {
      form.querySelector('[name="category_id"]').value = editEntry.category_id || '';
      // Populate cost items for the selected category, then set value
      updateQuickCostItems();
      form.querySelector('[name="cost_item_id"]').value = editEntry.cost_item_id || '';
    }
  } else {
    // ── Add mode ──
    _qcfEditingId = null;
    title.textContent = 'הוספת תנועה מהירה';
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> שמור תנועה';

    _qcfCurrentType = 'expense';
    form.querySelector('[name="type"]').value = 'expense';
    form.querySelector('[name="date"]').value = new Date().toISOString().split('T')[0];

    // Set type toggle buttons
    setQuickCashflowType('expense');
  }

  modal.classList.remove('hidden');
}

function closeQuickCashflow() {
  document.getElementById('quickCashflowModal').classList.add('hidden');
  _qcfEditingId = null;
}

function setQuickCashflowType(type) {
  _qcfCurrentType = type;
  const form = document.getElementById('quickCashflowForm');
  form.querySelector('[name="type"]').value = type;

  // Toggle button styles
  const expBtn = form.querySelector('.qcf-type-expense');
  const incBtn = form.querySelector('.qcf-type-income');
  expBtn.classList.toggle('active', type === 'expense');
  incBtn.classList.toggle('active', type === 'income');

  // Show/hide category fields for expense only
  const catWrapper = document.getElementById('qcf-category-wrapper');
  const itemWrapper = document.getElementById('qcf-costitem-wrapper');
  if (type === 'expense') {
    catWrapper.style.display = '';
    itemWrapper.style.display = '';
  } else {
    catWrapper.style.display = 'none';
    itemWrapper.style.display = 'none';
    // Clear category/item selections when switching to income
    form.querySelector('[name="category_id"]').value = '';
    form.querySelector('[name="cost_item_id"]').value = '';
  }
}

function populateQuickCategories() {
  const catSelect = document.getElementById('qcf-category');
  catSelect.innerHTML = '<option value="">-- בחר קטגוריה --</option>';

  const categories = (currentDealData && currentDealData.categories) || [];
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    catSelect.appendChild(opt);
  }

  // Reset cost item select
  document.getElementById('qcf-costitem').innerHTML = '<option value="">-- ללא --</option>';
}

function updateQuickCostItems() {
  const catId = document.getElementById('qcf-category').value;
  const itemSelect = document.getElementById('qcf-costitem');
  itemSelect.innerHTML = '<option value="">-- ללא --</option>';

  if (!catId || !currentDealData) return;

  const cat = currentDealData.categories.find(c => c.id == catId);
  if (cat && cat.items) {
    for (const item of cat.items) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      itemSelect.appendChild(opt);
    }
  }
}

async function submitQuickCashflow(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('qcf-submit-btn');
  const isEdit = _qcfEditingId !== null;

  const body = {
    date: form.date.value,
    type: form.type.value,
    amount: parseAmount(form.amount.value),
    description: form.description.value.trim() || null,
    funding_source: form.funding_source.value || null
  };

  // Only include category/cost_item for expenses
  if (body.type === 'expense') {
    body.category_id = form.category_id.value ? parseInt(form.category_id.value) : null;
    body.cost_item_id = form.cost_item_id.value ? parseInt(form.cost_item_id.value) : null;
  } else {
    body.category_id = null;
    body.cost_item_id = null;
  }

  // Validation
  if (!body.amount || body.amount <= 0) {
    showToast('נא להזין סכום', 'error');
    return;
  }
  if (!body.funding_source) {
    showToast('נא לבחור מקור מימון', 'error');
    return;
  }
  if (body.type === 'expense' && !body.category_id) {
    showToast('נא לבחור קטגוריה עבור הוצאה', 'error');
    return;
  }

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> שומר...';

  try {
    if (isEdit) {
      await API.put(`/deals/${currentDeal.id}/cashflow/${_qcfEditingId}`, body);
      showToast('התנועה עודכנה בהצלחה');
    } else {
      await API.post(`/deals/${currentDeal.id}/cashflow`, body);
      showToast('התנועה נוספה בהצלחה');
    }
    closeQuickCashflow();

    // Reload deal and refresh all relevant tabs
    reloadDeal((data) => {
      renderCashflowTab(data);
      renderFinancialTab(data);
    });
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    const label = isEdit ? 'עדכן תנועה' : 'שמור תנועה';
    submitBtn.innerHTML = `<span class="material-symbols-outlined text-sm">save</span> ${label}`;
  }
}

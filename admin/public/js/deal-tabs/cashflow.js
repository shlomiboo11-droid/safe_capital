/**
 * Tab D: Cashflow — Redesigned with funding source, summary cards, and filters
 */

// Funding source labels (Hebrew)
const FUNDING_SOURCE_LABELS = {
  equity: 'הון עצמי',
  loan: 'הלוואה',
  sale: 'הכנסת מכירה',
  other: 'אחר'
};

const FUNDING_SOURCE_BADGE = {
  equity: 'badge-equity',
  loan: 'badge-loan',
  sale: 'badge-sale',
  other: 'badge-other'
};

// Active filters state
let _cfFilters = { type: '', category_id: '', funding_source: '' };

function renderCashflowTab(data) {
  const cashflow = data.cashflow || [];
  const categories = data.categories || [];
  const computed = data.computed || {};
  const container = document.getElementById('tab-cashflow');
  const byFunding = computed.byFundingSource || { equity: 0, loan: 0, sale: 0, other: 0 };

  // Apply filters
  const filtered = cashflow.filter(entry => {
    if (_cfFilters.type && entry.type !== _cfFilters.type) return false;
    if (_cfFilters.category_id && String(entry.category_id) !== _cfFilters.category_id) return false;
    if (_cfFilters.funding_source && entry.funding_source !== _cfFilters.funding_source) return false;
    return true;
  });

  container.innerHTML = `
    <!-- Summary Cards: 4 cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="fin-card">
        <div class="fin-card-value font-inter text-red-700">${formatCurrency(computed.totalExpense)}</div>
        <div class="fin-card-label">סה"כ הוצאות</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter text-green-700">${formatCurrency(computed.totalIncome)}</div>
        <div class="fin-card-label">סה"כ הכנסות</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter" style="color: #1e40af;">${formatCurrency(byFunding.equity)}</div>
        <div class="fin-card-label">מימון הון עצמי</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter" style="color: #92400e;">${formatCurrency(byFunding.loan)}</div>
        <div class="fin-card-label">מימון הלוואה</div>
      </div>
    </div>

    <!-- Balance Card -->
    <div class="card p-4 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-500">מאזן נוכחי (הכנסות - הוצאות)</span>
          <div class="font-inter font-bold text-xl ${computed.cashflowBalance >= 0 ? 'text-green-700' : 'text-red-700'}">${formatCurrency(computed.cashflowBalance)}</div>
        </div>
        <div class="flex gap-4 text-sm text-gray-500">
          ${byFunding.sale > 0 ? `<span>הכנסות מכירה: <strong class="font-inter">${formatCurrency(byFunding.sale)}</strong></span>` : ''}
          ${byFunding.other > 0 ? `<span>אחר: <strong class="font-inter">${formatCurrency(byFunding.other)}</strong></span>` : ''}
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card p-4 mb-4">
      <div class="cashflow-filters">
        <span class="text-sm font-bold text-gray-600">סינון:</span>
        <select class="form-select" id="cf-filter-type" onchange="applyCashflowFilter('type', this.value)">
          <option value="">כל הסוגים</option>
          <option value="expense" ${_cfFilters.type === 'expense' ? 'selected' : ''}>הוצאה</option>
          <option value="income" ${_cfFilters.type === 'income' ? 'selected' : ''}>הכנסה</option>
        </select>
        <select class="form-select" id="cf-filter-category" onchange="applyCashflowFilter('category_id', this.value)">
          <option value="">כל הקטגוריות</option>
          ${categories.map(c => `<option value="${c.id}" ${_cfFilters.category_id === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <select class="form-select" id="cf-filter-funding" onchange="applyCashflowFilter('funding_source', this.value)">
          <option value="">כל מקורות המימון</option>
          <option value="equity" ${_cfFilters.funding_source === 'equity' ? 'selected' : ''}>הון עצמי</option>
          <option value="loan" ${_cfFilters.funding_source === 'loan' ? 'selected' : ''}>הלוואה</option>
          <option value="sale" ${_cfFilters.funding_source === 'sale' ? 'selected' : ''}>הכנסת מכירה</option>
          <option value="other" ${_cfFilters.funding_source === 'other' ? 'selected' : ''}>אחר</option>
        </select>
        ${(_cfFilters.type || _cfFilters.category_id || _cfFilters.funding_source) ?
          `<button class="btn btn-secondary btn-sm" onclick="clearCashflowFilters()">
            <span class="material-symbols-outlined text-sm">clear</span> נקה
          </button>` : ''}
      </div>
    </div>

    <!-- Add Entry Form (inline in tab) -->
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">הוספת תנועה חדשה</h3>
      <form id="cashflowForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="form-label">תאריך</label>
            <input type="date" name="date" class="form-input ltr text-sm" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div>
            <label class="form-label">סוג</label>
            <select name="type" class="form-select text-sm" id="cf-inline-type" onchange="toggleInlineCategoryFields()">
              <option value="expense">הוצאה</option>
              <option value="income">הכנסה</option>
            </select>
          </div>
          <div>
            <label class="form-label">סכום ($)</label>
            <input type="text" inputmode="numeric" name="amount" data-currency="true" class="form-input ltr text-sm"
              onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)" required>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div id="cf-inline-cat-wrapper">
            <label class="form-label">קטגוריה</label>
            <select name="category_id" class="form-select text-sm" onchange="updateCostItemSelect(this)">
              <option value="">-- ללא --</option>
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div id="cf-inline-item-wrapper">
            <label class="form-label">תת-קטגוריה</label>
            <select name="cost_item_id" class="form-select text-sm">
              <option value="">-- ללא --</option>
            </select>
          </div>
          <div>
            <label class="form-label">מקור מימון</label>
            <select name="funding_source" class="form-select text-sm" required>
              <option value="">-- בחר --</option>
              <option value="equity">הון עצמי</option>
              <option value="sale">הכנסת מכירה</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div>
            <label class="form-label">תיאור</label>
            <div class="flex gap-2">
              <input type="text" name="description" class="form-input text-sm flex-1" placeholder="תיאור התנועה">
              <button type="submit" class="btn btn-primary btn-sm self-end">
                <span class="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>

    <!-- Cashflow Table -->
    <div class="card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>סוג</th>
            <th>סכום</th>
            <th>קטגוריה</th>
            <th>תת-קטגוריה</th>
            <th>מקור מימון</th>
            <th>תיאור</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="8" class="text-center text-gray-400 py-8">אין תנועות</td></tr>' : ''}
          ${filtered.map(entry => `
            <tr>
              <td class="font-inter text-sm">${formatDate(entry.date)}</td>
              <td>
                <span class="badge ${entry.type === 'income' ? 'badge-green' : 'badge-red'}">
                  ${entry.type === 'income' ? 'הכנסה' : 'הוצאה'}
                </span>
              </td>
              <td class="font-inter font-medium ${entry.type === 'income' ? 'text-green-700' : 'text-red-700'}">${formatCurrency(entry.amount)}</td>
              <td class="text-sm text-gray-500">${entry.category_name || '--'}</td>
              <td class="text-sm text-gray-500">${entry.cost_item_name || '--'}</td>
              <td>
                ${entry.funding_source ?
                  `<span class="badge ${FUNDING_SOURCE_BADGE[entry.funding_source] || 'badge-gray'}">${FUNDING_SOURCE_LABELS[entry.funding_source] || entry.funding_source}</span>` :
                  '<span class="text-sm text-gray-400">--</span>'}
              </td>
              <td class="text-sm">${entry.description || ''}</td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-secondary btn-sm" onclick="editCashflowEntry(${entry.id})" title="ערוך">
                    <span class="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteCashflowEntry(${entry.id})" title="מחק">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${filtered.length > 0 ? `
        <div class="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">
          מציג ${filtered.length} ${filtered.length < cashflow.length ? `מתוך ${cashflow.length}` : ''} תנועות
        </div>
      ` : ''}
    </div>
  `;

  // Store categories data for the cost item select
  window._cfCategories = categories;

  // Form handler
  document.getElementById('cashflowForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const type = form.type.value;

    const body = {
      date: form.date.value,
      type: type,
      amount: parseAmount(form.amount.value),
      description: form.description.value.trim(),
      funding_source: form.funding_source.value || null
    };

    // Only include category/cost_item for expenses
    if (type === 'expense') {
      body.category_id = form.category_id.value ? parseInt(form.category_id.value) : null;
      body.cost_item_id = form.cost_item_id.value ? parseInt(form.cost_item_id.value) : null;
    } else {
      body.category_id = null;
      body.cost_item_id = null;
    }

    // Validation
    if (!body.funding_source) {
      showToast('נא לבחור מקור מימון', 'error');
      return;
    }
    if (type === 'expense' && !body.category_id) {
      showToast('נא לבחור קטגוריה עבור הוצאה', 'error');
      return;
    }

    // Prevent double-submit
    submitBtn.disabled = true;
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span>';

    try {
      await API.post(`/deals/${currentDeal.id}/cashflow`, body);
      showToast('התנועה נוספה');
      reloadDeal((data) => {
        renderCashflowTab(data);
        renderFinancialTab(data);
      });
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
    }
  });
}

/**
 * Toggle inline form category/cost_item fields based on type selection
 */
function toggleInlineCategoryFields() {
  const type = document.getElementById('cf-inline-type').value;
  const catWrapper = document.getElementById('cf-inline-cat-wrapper');
  const itemWrapper = document.getElementById('cf-inline-item-wrapper');

  if (type === 'income') {
    catWrapper.style.display = 'none';
    itemWrapper.style.display = 'none';
  } else {
    catWrapper.style.display = '';
    itemWrapper.style.display = '';
  }
}

function updateCostItemSelect(catSelect) {
  const catId = catSelect.value;
  const itemSelect = catSelect.closest('form').querySelector('[name="cost_item_id"]');
  itemSelect.innerHTML = '<option value="">-- ללא --</option>';

  if (!catId || !window._cfCategories) return;

  const cat = window._cfCategories.find(c => c.id == catId);
  if (cat && cat.items) {
    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      itemSelect.appendChild(opt);
    });
  }
}

/**
 * Apply filter and re-render
 */
function applyCashflowFilter(key, value) {
  _cfFilters[key] = value;
  if (currentDealData) {
    renderCashflowTab(currentDealData);
  }
}

function clearCashflowFilters() {
  _cfFilters = { type: '', category_id: '', funding_source: '' };
  if (currentDealData) {
    renderCashflowTab(currentDealData);
  }
}

/**
 * Edit cashflow entry — opens the FAB modal pre-populated with entry data
 */
function editCashflowEntry(id) {
  const cashflow = (currentDealData && currentDealData.cashflow) || [];
  const entry = cashflow.find(e => e.id === id);
  if (!entry) return;

  openQuickCashflow(entry);
}

async function deleteCashflowEntry(id) {
  if (!await confirmAction('האם למחוק את התנועה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/cashflow/${id}`);
    showToast('התנועה נמחקה');
    reloadDeal((data) => {
      renderCashflowTab(data);
      renderFinancialTab(data);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

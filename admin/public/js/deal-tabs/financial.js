/**
 * Tab B: Financial Calculator -- Integrated Plan vs Actual
 *
 * Layout:
 * 1. Summary cards (planned total, actual total, deviation, profit)
 * 2. Edit mode toggle for planned values
 * 3. Unified cost breakdown table with:
 *    - Summary rows at top (purchase price, sale price ARV, totals)
 *    - Cost categories with items, each showing planned | actual | deviation
 * 4. ROI summary at bottom
 */

// ── Edit Mode State ─────────────────────────────────────────
let financialEditMode = false;

function renderFinancialTab(data) {
  const deal = data.deal;
  const categories = data.categories || [];
  const computed = data.computed || {};
  const container = document.getElementById('tab-financial');

  // Deviation status helper
  function devStatus(planned, actual) {
    return getDeviationStatus(planned, actual);
  }

  const totalPlanned = computed.totalPlanned || 0;
  const totalActual = computed.totalActual || 0;
  const deviation = computed.deviation || 0;
  const devPct = computed.deviationPercent || 0;
  const overallStatus = devStatus(totalPlanned, totalActual);

  container.innerHTML = `
    <!-- Edit Mode Toggle -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold">מחשבון פיננסי</h2>
      </div>
      <button id="editModeToggle" class="btn ${financialEditMode ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="toggleFinancialEditMode()">
        <span class="material-symbols-outlined text-sm">${financialEditMode ? 'lock_open' : 'lock'}</span>
        ${financialEditMode ? 'מצב עריכה: פעיל' : 'עריכת ערכי תכנון'}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="fin-card">
        <div class="fin-card-value font-inter" id="fc-total-planned">${formatCurrency(totalPlanned)}</div>
        <div class="fin-card-label">סך עלויות הפרוייקט (תכנון)</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter" id="fc-total-actual">${formatCurrency(deal.fundraising_goal || 0)}</div>
        <div class="fin-card-label">סך השקעה בפועל</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter ${overallStatus.color}" id="fc-deviation">${formatCurrency(deviation)}</div>
        <div class="fin-card-label">חריגה כוללת <span class="badge ${overallStatus.class} mr-1" id="fc-dev-badge">${formatPercent(devPct)}</span></div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter" id="fc-planned-profit">${formatCurrency(computed.plannedProfit)}</div>
        <div class="fin-card-label">רווח נקי צפוי (תכנון)</div>
      </div>
    </div>

    <!-- Fundraising goal (read-only mirror from "גיוס הון" tab) -->
    <div class="card p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="form-label">סכום יעד לגיוס</label>
          <div class="form-input-readonly ltr">${deal.fundraising_goal ? formatCurrency(deal.fundraising_goal) : '—'}</div>
          <div class="form-help-readonly">נערך בטאב "גיוס הון"</div>
        </div>
        <div>
          <label class="form-label">סכום מינימום להשקעה</label>
          <div class="form-input-readonly ltr">${formatCurrency(deal.min_investment || 50000)}</div>
          <div class="form-help-readonly">נערך בטאב "גיוס הון"</div>
        </div>
      </div>
    </div>

    <!-- Unified Cost Breakdown Table -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">פירוט עלויות — תכנון מול ביצוע</h3>
        <button class="btn btn-secondary btn-sm" onclick="addCategory()">
          <span class="material-symbols-outlined text-sm">add</span>
          קטגוריה חדשה
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table" id="financialBreakdownTable">
          <thead>
            <tr>
              <th>פריט</th>
              <th>תכנון</th>
              <th>בפועל</th>
              <th>חריגה</th>
              <th>% חריגה</th>
              <th class="w-20">פעולות</th>
            </tr>
          </thead>
          <tbody>
            <!-- Summary Row: Expected Sale Price (ARV) -->
            <tr class="bg-green-50/50 border-b-2 border-green-100">
              <td class="font-bold text-green-800">מחיר מכירה צפוי (ARV)</td>
              <td>
                <input type="text" inputmode="numeric" data-currency="true"
                  class="form-input ltr text-sm w-36 font-inter ${!financialEditMode ? 'bg-gray-50 pointer-events-none' : ''}"
                  value="${deal.arv ? formatCurrency(deal.arv) : ''}"
                  ${!financialEditMode ? 'readonly tabindex="-1"' : ''}
                  onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
                  onchange="saveDealField('arv', parseAmount(this.value)); saveDealField('expected_sale_price', parseAmount(this.value)); recalcFinancials()">
              </td>
              <td>
                <input type="text" inputmode="numeric" data-currency="true"
                  class="form-input ltr text-sm w-36 font-inter"
                  value="${deal.actual_sale_price ? formatCurrency(deal.actual_sale_price) : ''}"
                  onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
                  onchange="saveDealField('actual_sale_price', parseAmount(this.value)); saveDealField('actual_arv', parseAmount(this.value)); recalcFinancials()">
              </td>
              <td class="font-inter text-sm" id="dev-arv">
                ${deal.actual_sale_price ? formatCurrency((deal.actual_sale_price || 0) - (deal.arv || 0)) : '--'}
              </td>
              <td class="font-inter text-sm" id="devpct-arv">
                ${deal.arv && deal.actual_sale_price ? formatPercent(((deal.actual_sale_price - deal.arv) / deal.arv) * 100) : '--'}
              </td>
              <td></td>
            </tr>

            <!-- Separator -->
            <tr class="bg-gray-100">
              <td colspan="6" class="py-1"></td>
            </tr>

            <!-- Category rows with items -->
            ${categories.map(cat => renderCategoryRows(cat, financialEditMode)).join('')}

            <!-- Grand Total Row -->
            <tr class="font-bold bg-gray-100 border-t-2 border-gray-300" id="grand-total-row">
              <td class="text-primary">סה"כ עלויות</td>
              <td class="font-inter" id="grand-total-planned">${formatCurrency(totalPlanned)}</td>
              <td class="font-inter" id="grand-total-actual">${formatCurrency(totalActual)}</td>
              <td class="font-inter ${overallStatus.color}" id="grand-total-dev">${formatCurrency(deviation)}</td>
              <td class="font-inter ${overallStatus.color}" id="grand-total-devpct">${formatPercent(devPct)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ROI Summary -->
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">סיכום תשואה</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter text-primary" id="roi-project-planned">${computed.projectPlannedROI != null ? formatPercent(computed.projectPlannedROI) : '--'}</div>
          <div class="text-xs text-gray-500 mt-1">תשואה על הפרויקט (תכנון)</div>
        </div>
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter text-primary" id="roi-project-actual">${computed.projectActualROI != null ? formatPercent(computed.projectActualROI) : '--'}</div>
          <div class="text-xs text-gray-500 mt-1">תשואה על הפרויקט (מעודכן)</div>
        </div>
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter text-secondary" id="roi-investor-planned">${computed.investorPlannedROI != null ? formatPercent(computed.investorPlannedROI) : '--'}</div>
          <div class="text-xs text-gray-500 mt-1">תשואה למשקיע (תכנון, תקרה ${computed.investorCap || 20}%)</div>
        </div>
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter text-secondary" id="roi-investor-actual">${computed.investorActualROI != null ? formatPercent(computed.investorActualROI) : '--'}</div>
          <div class="text-xs text-gray-500 mt-1">תשואה למשקיע (מעודכן)</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter text-primary" id="roi-planned-profit">${formatCurrency(computed.plannedProfit)}</div>
          <div class="text-xs text-gray-500 mt-1">רווח צפוי (תכנון)</div>
        </div>
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <div class="text-2xl font-bold font-inter ${computed.actualProfit == null ? 'text-primary' : (computed.actualProfit >= 0 ? 'text-green-700' : 'text-red-700')}" id="roi-actual-profit">${computed.actualProfit != null ? formatCurrency(computed.actualProfit) : '--'}</div>
          <div class="text-xs text-gray-500 mt-1">רווח (מעודכן)</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render category header + item rows for unified table
 */
function renderCategoryRows(cat, editMode) {
  const catPlanned = parseFloat(cat.total_planned) || 0;
  const catActual = parseFloat(cat.total_actual) || 0;
  const catDev = catActual - catPlanned;
  const catDevPct = catPlanned > 0 ? (catDev / catPlanned * 100) : 0;
  const catStatus = getDeviationStatus(catPlanned, catActual);

  let html = '';

  // Item rows (rendered first; category summary appears below them)
  if (cat.items && cat.items.length > 0) {
    for (const item of cat.items) {
      // Renovation-cost item: bind value to renovation_plan.total_cost (read-only here, edited in renovation tab)
      const isRenovationItem = (item.name || '').trim().startsWith('עלות שיפוץ');
      const renoTotal = parseFloat(currentDeal && currentDeal.renovation_plan && currentDeal.renovation_plan.total_cost) || 0;
      const itemPlanned = isRenovationItem ? renoTotal : (parseFloat(item.planned_amount) || 0);
      const itemActual = parseFloat(item.actual_amount) || 0;
      const itemDev = itemActual - itemPlanned;
      const itemDevPct = itemPlanned > 0 ? (itemDev / itemPlanned * 100) : 0;
      const itemStatus = getDeviationStatus(itemPlanned, itemActual);
      const planLocked = isRenovationItem || !editMode;

      html += `
        <tr data-item-id="${item.id}" data-cat-id="${cat.id}">
          <td class="pr-8">
            <input type="text" class="form-input text-sm ${!editMode ? 'bg-gray-50 pointer-events-none' : ''}" value="${item.name}"
              ${!editMode ? 'readonly tabindex="-1"' : ''}
              onchange="updateCostItem(${item.id}, 'name', this.value)">
            ${isRenovationItem ? '<div class="text-xs text-gray-400 mt-1">מחושב אוטומטית מתכנית השיפוץ</div>' : ''}
          </td>
          <td>
            <input type="text" inputmode="numeric" data-currency="true"
              class="form-input ltr text-sm w-36 ${planLocked ? 'bg-gray-50 pointer-events-none' : ''}"
              value="${itemPlanned ? formatCurrency(itemPlanned) : ''}"
              ${planLocked ? 'readonly tabindex="-1"' : ''}
              onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
              ${isRenovationItem ? '' : `onchange="updateCostItem(${item.id}, 'planned_amount', parseAmount(this.value)); recalcFinancials()"`}>
          </td>
          <td>
            <input type="text" inputmode="numeric" data-currency="true"
              class="form-input ltr text-sm w-36"
              value="${itemActual ? formatCurrency(itemActual) : ''}"
              onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
              onchange="updateCostItem(${item.id}, 'actual_amount', parseAmount(this.value)); recalcFinancials()">
          </td>
          <td class="font-inter text-sm text-right ltr ${itemStatus.color}">${itemActual ? formatCurrency(itemDev) : '--'}</td>
          <td class="font-inter text-sm text-right ${itemStatus.color}">${itemActual ? formatPercent(itemDevPct) : '--'}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteCostItem(${item.id})">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </td>
        </tr>
      `;
    }
  } else {
    html += `
      <tr>
        <td colspan="6" class="text-center text-gray-400 text-sm py-3 pr-8">
          אין פריטים. לחץ + כדי להוסיף.
        </td>
      </tr>
    `;
  }

  // Category summary row (placed BELOW the items it sums up)
  html += `
    <tr class="bg-gray-50 border-t border-gray-200" data-cat-id="${cat.id}">
      <td class="font-bold text-sm text-primary">
        ${editMode
          ? `<input type="text" class="form-input text-sm font-bold text-primary" value="${cat.name}"
              onchange="updateCategoryName(${cat.id}, this.value)">`
          : cat.name}
      </td>
      <td class="font-inter font-bold text-sm text-left ltr" id="cat-planned-${cat.id}">${formatCurrency(catPlanned)}</td>
      <td class="font-inter font-bold text-sm text-left ltr" id="cat-actual-${cat.id}">${formatCurrency(catActual)}</td>
      <td class="font-inter font-bold text-sm text-right ltr ${catStatus.color}" id="cat-dev-${cat.id}">${formatCurrency(catDev)}</td>
      <td class="font-inter text-sm text-right">
        <span class="badge ${catStatus.class}" id="cat-badge-${cat.id}">${catPlanned > 0 ? catStatus.label + ' ' + formatPercent(catDevPct) : '--'}</span>
      </td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="addCostItem(${cat.id})" title="הוסף פריט">
            <span class="material-symbols-outlined text-sm">add</span>
          </button>
          ${!cat.is_default ? `
            <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})" title="מחק קטגוריה">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;

  return html;
}

/**
 * Toggle edit mode for planned values
 */
function toggleFinancialEditMode() {
  financialEditMode = !financialEditMode;
  // Re-render tab to apply edit mode state
  if (currentDealData) {
    renderFinancialTab(currentDealData);
  }
}

/**
 * Recalculate all financial fields in real-time after any value changes.
 * This is called after saving actual or planned amounts.
 * Instead of a full reload, we reload data and re-render to get fresh computed values.
 */
async function recalcFinancials() {
  try {
    const data = await API.get(`/deals/${currentDeal.id}`);
    currentDeal = data.deal;
    currentDealData = data;
    renderFinancialTab(data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Category & Item CRUD (kept from original) ──────────────

async function addCategory() {
  const name = await showPromptModal('שם הקטגוריה', 'הזן שם קטגוריה...');
  if (!name) return;
  try {
    await API.post(`/deals/${currentDeal.id}/categories`, { name });
    showToast('קטגוריה נוספה');
    reloadDeal(renderFinancialTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCategoryName(catId, newName) {
  if (!newName || !newName.trim()) return;
  try {
    await API.put(`/deals/${currentDeal.id}/categories/${catId}`, { name: newName.trim() });
  } catch (err) {
    showToast(`שגיאה בעדכון שם קטגוריה: ${err.message}`, 'error');
  }
}

async function deleteCategory(catId) {
  if (!await confirmAction('האם למחוק את הקטגוריה וכל הפריטים שבה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/categories/${catId}`);
    showToast('קטגוריה נמחקה');
    reloadDeal(renderFinancialTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addCostItem(catId) {
  const name = await showPromptModal('שם הפריט', 'הזן שם פריט...');
  if (!name) return;
  try {
    await API.post(`/deals/${currentDeal.id}/categories/${catId}/items`, { name, planned_amount: 0, actual_amount: 0 });
    showToast('פריט נוסף');
    reloadDeal(renderFinancialTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCostItem(itemId, field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/items/${itemId}`, { [field]: value });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCostItem(itemId) {
  if (!await confirmAction('האם למחוק את הפריט?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/items/${itemId}`);
    showToast('פריט נמחק');
    reloadDeal(renderFinancialTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

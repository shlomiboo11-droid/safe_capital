/**
 * Tab C: Fundraising
 */
function renderFundraisingTab(data) {
  const deal = data.deal;
  const investors = data.investors || [];
  const computed = data.computed || {};
  const container = document.getElementById('tab-fundraising');

  const raised = computed.totalRaised || 0;
  const goal = deal.fundraising_goal || 0;
  const pct = computed.fundraisingPercent || 0;
  const remaining = computed.remainingToRaise || 0;
  // Default min_investment to $50,000
  const minInvestment = deal.min_investment || 50000;

  container.innerHTML = `
    <!-- Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="fin-card">
        <div class="fin-card-value font-inter">${formatCurrency(goal)}</div>
        <div class="fin-card-label">יעד גיוס</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter">${formatCurrency(raised)}</div>
        <div class="fin-card-label">גויס</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter">${formatPercent(pct, 0)}</div>
        <div class="fin-card-label">אחוז גיוס</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-value font-inter">${formatCurrency(remaining)}</div>
        <div class="fin-card-label">נותר לגייס</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="card p-6 mb-6">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-500">התקדמות הגיוס</span>
        <span class="font-inter font-medium">${formatPercent(pct, 0)}</span>
      </div>
      <div class="progress-bar h-3">
        <div class="progress-fill" style="width: ${Math.min(100, pct)}%; background: ${pct >= 100 ? '#166534' : '#022445'}"></div>
      </div>
    </div>

    <!-- Fundraising Settings -->
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">הגדרות גיוס</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">יעד גיוס</label>
          <input type="text" inputmode="numeric" data-currency="true" class="form-input ltr"
            value="${deal.fundraising_goal ? formatCurrency(deal.fundraising_goal) : ''}"
            onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
            onchange="saveDealField('fundraising_goal', parseAmount(this.value))">
        </div>
        <div>
          <label class="form-label">סכום מינימום להשקעה</label>
          <input type="text" inputmode="numeric" data-currency="true" class="form-input ltr"
            value="${formatCurrency(minInvestment)}"
            onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
            onchange="saveDealField('min_investment', parseAmount(this.value))">
        </div>
        <div>
          <label class="form-label">תקרת תשואה למשקיע (%)</label>
          <input type="number" step="0.1" min="0" max="100" class="form-input ltr" dir="ltr"
            value="${deal.investor_roi_cap_percent != null ? deal.investor_roi_cap_percent : 20}"
            onchange="saveDealField('investor_roi_cap_percent', parseFloat(this.value) || 0)">
          <div class="text-xs text-gray-400 mt-1">ברירת מחדל: 20%</div>
        </div>
      </div>
    </div>

    <!-- Investors Table -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">רשימת משקיעים</h3>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="addInvestor()">
            <span class="material-symbols-outlined text-sm">person_add</span>
            הוספת משקיע
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openNotifyInvestorsModal()">
            <span class="material-symbols-outlined text-sm">notifications</span>
            שלח עדכון למשקיעים
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>שם משקיע</th>
              <th>סכום השקעה</th>
              <th>תאריך</th>
              <th>הערות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody id="investorsTableBody">
            ${investors.length === 0 ? '<tr><td colspan="5" class="text-center text-gray-400 py-8">אין משקיעים. לחץ על "הוספת משקיע" כדי להוסיף.</td></tr>' : ''}
            ${investors.map(inv => {
              const displayName = inv.investor_name || '';
              const hasProfile = !!inv.investor_id;
              const nameLink = hasProfile
                ? `<a href="/investor?id=${inv.investor_id}" class="text-primary hover:underline font-medium">${escapeHtml(displayName)}</a>`
                : `<span class="text-gray-700">${escapeHtml(displayName)}</span>`;
              return `
              <tr data-inv-id="${inv.id}">
                <td>${nameLink}</td>
                <td>
                  <input type="text" inputmode="numeric" data-currency="true" class="form-input ltr text-sm w-36"
                    value="${inv.amount ? formatCurrency(inv.amount) : ''}"
                    onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
                    onchange="updateInvestor(${inv.id}, 'amount', parseAmount(this.value))">
                </td>
                <td>
                  <input type="date" class="form-input ltr text-sm w-36" value="${inv.investment_date || ''}"
                    onchange="updateInvestor(${inv.id}, 'investment_date', this.value)">
                </td>
                <td>
                  <input type="text" class="form-input text-sm" value="${inv.notes || ''}"
                    onchange="updateInvestor(${inv.id}, 'notes', this.value)">
                </td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="deleteDealInvestor(${inv.id})">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Investor search autocomplete ──
let investorSearchTimer = null;
let investorSearchResults = [];

function addInvestor() {
  const today = new Date().toISOString().split('T')[0];
  const overlay = document.createElement('div');
  overlay.className = 'branded-modal-overlay';
  overlay.innerHTML = `
    <div class="branded-modal" style="max-width: 28rem;">
      <h3 class="branded-modal-title">הוספת משקיע לעסקה</h3>
      <form id="addInvestorModalForm" class="space-y-4">
        <div style="position: relative;">
          <label class="form-label">חיפוש משקיע קיים</label>
          <input type="text" id="investorSearchInput" class="form-input text-sm" placeholder="הקלד שם, טלפון או מייל..." autocomplete="off">
          <div id="investorSearchDropdown" class="investor-search-dropdown" style="display:none;"></div>
          <input type="hidden" id="selectedInvestorId" name="investor_id" value="">
          <div id="selectedInvestorBadge" style="display:none;" class="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style="background:#f0fdf4;">
            <span class="material-symbols-outlined text-green-600 text-sm">check_circle</span>
            <span id="selectedInvestorName" class="text-sm font-medium text-green-800"></span>
            <button type="button" onclick="clearSelectedInvestor()" class="text-gray-400 hover:text-red-500 mr-auto">
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>

        <div class="text-center text-xs text-gray-400 py-1">— או —</div>

        <div id="manualNameField">
          <label class="form-label">שם משקיע חדש</label>
          <input type="text" name="investor_name" id="manualInvestorName" class="form-input text-sm" placeholder="שם מלא (ייצור משקיע חדש)">
        </div>

        <div>
          <label class="form-label">סכום השקעה ($) *</label>
          <input type="text" inputmode="numeric" name="amount" data-currency="true" class="form-input ltr text-sm"
            placeholder="$0" required>
        </div>
        <div>
          <label class="form-label">תאריך כניסת הכסף *</label>
          <input type="date" name="investment_date" class="form-input ltr text-sm" required value="${today}">
        </div>
        <div>
          <label class="form-label">הערות</label>
          <input type="text" name="notes" class="form-input text-sm" placeholder="הערות (אופציונלי)">
        </div>
        <div class="branded-modal-actions" style="margin-top: 1.5rem;">
          <button type="submit" class="branded-modal-btn branded-modal-btn-primary">
            הוסף משקיע
          </button>
          <button type="button" class="branded-modal-btn branded-modal-btn-secondary" data-action="cancel">
            ביטול
          </button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  // Bind currency formatting on the amount field
  const amountInput = overlay.querySelector('[name="amount"]');
  amountInput.addEventListener('focus', () => unformatCurrencyInput(amountInput));
  amountInput.addEventListener('blur', () => formatCurrencyInput(amountInput));

  // Investor search autocomplete
  const searchInput = overlay.querySelector('#investorSearchInput');
  const dropdown = overlay.querySelector('#investorSearchDropdown');

  searchInput.addEventListener('input', () => {
    clearTimeout(investorSearchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      dropdown.style.display = 'none';
      return;
    }
    investorSearchTimer = setTimeout(async () => {
      try {
        investorSearchResults = await API.get(`/investors/search?q=${encodeURIComponent(q)}`);
        if (investorSearchResults.length === 0) {
          dropdown.innerHTML = '<div class="investor-search-item" style="color:#9ca3af;cursor:default;">לא נמצאו תוצאות</div>';
        } else {
          dropdown.innerHTML = investorSearchResults.map(inv => {
            const name = `${inv.first_name} ${inv.last_name || ''}`.trim();
            const extra = inv.phone || inv.email || '';
            return `<div class="investor-search-item" data-id="${inv.id}" data-name="${escapeHtml(name)}">
              <span class="font-medium">${escapeHtml(name)}</span>
              ${extra ? `<span class="text-xs text-gray-400 font-inter mr-2" dir="ltr">${escapeHtml(extra)}</span>` : ''}
            </div>`;
          }).join('');
        }
        dropdown.style.display = 'block';
      } catch {
        dropdown.style.display = 'none';
      }
    }, 250);
  });

  // Click on dropdown result
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (!item) return;
    selectInvestor(item.dataset.id, item.dataset.name);
    dropdown.style.display = 'none';
    searchInput.value = '';
  });

  // Hide dropdown on outside click
  overlay.addEventListener('click', (e) => {
    if (!e.target.closest('#investorSearchInput') && !e.target.closest('#investorSearchDropdown')) {
      dropdown.style.display = 'none';
    }
  });

  // Cancel
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Submit
  overlay.querySelector('#addInvestorModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const selectedId = document.getElementById('selectedInvestorId').value;
    const manualName = document.getElementById('manualInvestorName').value.trim();

    // Must have either selected investor or manual name
    if (!selectedId && !manualName) {
      showToast('בחר משקיע קיים או הזן שם חדש', 'error');
      return;
    }

    const body = {
      amount: parseAmount(form.amount.value),
      investment_date: form.investment_date.value || null,
      notes: form.notes.value.trim() || null
    };

    if (!body.amount || body.amount <= 0) {
      showToast('נא להזין סכום השקעה', 'error');
      return;
    }

    if (selectedId) {
      // Link to existing investor
      body.investor_id = selectedId;
      // Also set investor_name for display/backward compat
      body.investor_name = document.getElementById('selectedInvestorName').textContent;
    } else {
      body.investor_name = manualName;
    }

    // Prevent double-submit
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'שומר...';

    try {
      await API.post(`/deals/${currentDeal.id}/investors`, body);
      showToast('משקיע נוסף בהצלחה');
      overlay.remove();
      reloadDeal((data) => {
        renderFundraisingTab(data);
        renderCashflowTab(data);
      });
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Focus search
  requestAnimationFrame(() => searchInput.focus());
}

function selectInvestor(id, name) {
  document.getElementById('selectedInvestorId').value = id;
  document.getElementById('selectedInvestorName').textContent = name;
  document.getElementById('selectedInvestorBadge').style.display = 'flex';
  document.getElementById('selectedInvestorBadge').style.background = '#f0fdf4';
  // Disable manual name when investor is selected
  document.getElementById('manualInvestorName').value = '';
  document.getElementById('manualInvestorName').disabled = true;
  document.getElementById('manualNameField').style.opacity = '0.4';
}

function clearSelectedInvestor() {
  document.getElementById('selectedInvestorId').value = '';
  document.getElementById('selectedInvestorName').textContent = '';
  document.getElementById('selectedInvestorBadge').style.display = 'none';
  document.getElementById('manualInvestorName').disabled = false;
  document.getElementById('manualNameField').style.opacity = '1';
}

async function updateInvestor(id, field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/investors/${id}`, { [field]: value });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDealInvestor(id) {
  if (!await confirmAction('האם להסיר את המשקיע מעסקה זו?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/investors/${id}`);
    showToast('המשקיע הוסר');
    reloadDeal(renderFundraisingTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Keep backward compat alias
function deleteInvestor(id) { return deleteDealInvestor(id); }

// ── Notify Investors Modal ──
function openNotifyInvestorsModal() {
  const investors = (typeof currentDealData !== 'undefined' && currentDealData && currentDealData.investors) || [];

  // Build investor options
  const investorOptions = investors
    .filter(inv => inv.investor_id)
    .map(inv => `<option value="${inv.investor_id}">${escapeHtml(inv.investor_name || '')}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'branded-modal-overlay';
  overlay.innerHTML = `
    <div class="branded-modal" style="max-width: 28rem;">
      <h3 class="branded-modal-title">שלח עדכון למשקיעים</h3>
      <form id="notifyInvestorsForm" class="space-y-4">
        <div>
          <label class="form-label">כותרת *</label>
          <input type="text" name="notifyTitle" class="form-input text-sm" required>
        </div>
        <div>
          <label class="form-label">תוכן</label>
          <textarea name="notifyBody" class="form-input text-sm" rows="3"></textarea>
        </div>
        <div>
          <label class="form-label">סוג הודעה</label>
          <select name="notifyType" class="form-select text-sm">
            <option value="update">עדכון כללי</option>
            <option value="milestone">אבן דרך</option>
            <option value="document">מסמך חדש</option>
            <option value="financial">עדכון פיננסי</option>
            <option value="message">הודעה אישית</option>
          </select>
        </div>
        <div>
          <label class="form-label">נמענים</label>
          <select name="notifyTarget" class="form-select text-sm">
            <option value="all">כל משקיעי העסקה</option>
            ${investorOptions}
          </select>
        </div>
        <div class="branded-modal-actions" style="margin-top: 1.5rem;">
          <button type="submit" class="branded-modal-btn branded-modal-btn-primary">שלח</button>
          <button type="button" class="branded-modal-btn branded-modal-btn-secondary" data-action="cancel">ביטול</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#notifyInvestorsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'שולח...';

    const target = form.notifyTarget.value;
    const body = {
      title: form.notifyTitle.value.trim(),
      body: form.notifyBody.value.trim() || null,
      type: form.notifyType.value
    };

    if (target !== 'all') {
      body.investor_id = target;
    }

    try {
      const result = await API.post(`/portal/deals/${currentDeal.id}/notify`, body);
      showToast(result.message || 'ההתראות נשלחו בהצלחה');
      overlay.remove();
    } catch (err) {
      showToast(err.message || 'שגיאה בשליחה', 'error');
      btn.disabled = false;
      btn.textContent = 'שלח';
    }
  });

  requestAnimationFrame(() => overlay.querySelector('[name="notifyTitle"]').focus());
}

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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>

    <!-- Investors Table -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">רשימת משקיעים</h3>
        <button class="btn btn-primary btn-sm" onclick="addInvestor()">
          <span class="material-symbols-outlined text-sm">person_add</span>
          משקיע חדש
        </button>
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
            ${investors.length === 0 ? '<tr><td colspan="5" class="text-center text-gray-400 py-8">אין משקיעים. לחץ על "משקיע חדש" כדי להוסיף.</td></tr>' : ''}
            ${investors.map(inv => `
              <tr data-inv-id="${inv.id}">
                <td>
                  <input type="text" class="form-input text-sm" value="${inv.investor_name || ''}"
                    onchange="updateInvestor(${inv.id}, 'investor_name', this.value)">
                </td>
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
                  <button class="btn btn-danger btn-sm" onclick="deleteInvestor(${inv.id})">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function addInvestor() {
  const today = new Date().toISOString().split('T')[0];
  const overlay = document.createElement('div');
  overlay.className = 'branded-modal-overlay';
  overlay.innerHTML = `
    <div class="branded-modal" style="max-width: 28rem;">
      <h3 class="branded-modal-title">הוספת משקיע חדש</h3>
      <form id="addInvestorModalForm" class="space-y-4">
        <div>
          <label class="form-label">שם המשקיע *</label>
          <input type="text" name="investor_name" class="form-input text-sm" required placeholder="שם מלא">
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

  // Cancel
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Submit
  overlay.querySelector('#addInvestorModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const body = {
      investor_name: form.investor_name.value.trim(),
      amount: parseAmount(form.amount.value),
      investment_date: form.investment_date.value || null,
      notes: form.notes.value.trim() || null
    };

    if (!body.investor_name) {
      showToast('נא להזין שם משקיע', 'error');
      return;
    }
    if (!body.amount || body.amount <= 0) {
      showToast('נא להזין סכום השקעה', 'error');
      return;
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

  // Focus first field
  requestAnimationFrame(() => overlay.querySelector('[name="investor_name"]').focus());
}

async function updateInvestor(id, field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/investors/${id}`, { [field]: value });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteInvestor(id) {
  if (!await confirmAction('האם להסיר את המשקיע?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/investors/${id}`);
    showToast('המשקיע הוסר');
    reloadDeal(renderFundraisingTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

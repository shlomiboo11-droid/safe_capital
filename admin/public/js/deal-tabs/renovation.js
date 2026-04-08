/**
 * Tab: Renovation Plan
 * Displays the construction draw schedule extracted from the uploaded PDF.
 * Data source: deal_renovation_plan table, populated during wizard extraction.
 *
 * Features:
 * - Edit mode toggle (read-only by default)
 * - Auto-recalculate total when phase costs change
 * - Phase completion checkboxes with progress bar
 */

// ── Edit Mode State ─────────────────────────────────────────
let renovationEditMode = false;

function renderRenovationTab(data) {
  const container = document.getElementById('tab-renovation');
  const plan = data.renovationPlan;

  if (!plan) {
    container.innerHTML = `
      <div class="card p-10 text-center">
        <span class="material-symbols-outlined text-5xl text-gray-300 mb-4 block">construction</span>
        <h3 class="text-lg font-bold text-gray-500 mb-2">אין תכנית שיפוץ</h3>
        <p class="text-sm text-gray-400 mb-6">תכנית השיפוץ נחלצת אוטומטית מקובץ PDF של לוח המשיכות (Draw Schedule) שהועלה בשלב האשף.</p>
        <p class="text-xs text-gray-300">לאחר עדכון, הנתונים יופיעו כאן באופן אוטומטי.</p>
      </div>
    `;
    return;
  }

  const phases = plan.phases || [];
  const totalCost = plan.total_cost;

  // Calculate completion stats
  const completedCount = phases.filter(p => p.completed).length;
  const totalCount = phases.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate sum of phase costs
  const phasesSum = phases.reduce((sum, p) => sum + (p.cost != null ? p.cost : (p.amount || 0)), 0);

  // Readonly helper
  const ro = !renovationEditMode;
  const roClass = ro ? 'bg-gray-100 border-transparent cursor-default' : '';
  const roAttr = ro ? 'readonly tabindex="-1"' : '';

  container.innerHTML = `
    <!-- Edit Mode Toggle + Refresh -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold">תכנית שיפוץ</h2>
      </div>
      <div class="flex items-center gap-2">
        <button id="renovationEditToggle" class="btn ${renovationEditMode ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="toggleRenovationEditMode()">
          <span class="material-symbols-outlined text-sm">${renovationEditMode ? 'lock_open' : 'lock'}</span>
          ${renovationEditMode ? 'מצב עריכה: פעיל' : 'מצב עריכה'}
        </button>
      </div>
    </div>

    <!-- Total Cost Hero -->
    <div class="card p-8 mb-6 text-center bg-primary text-white rounded-2xl">
      <div class="text-sm font-medium text-white/70 mb-2">עלות כוללת לשיפוץ</div>
      <div class="text-5xl font-bold font-inter mb-1" id="renovation-total-display">${totalCost ? formatCurrency(totalCost) : '—'}</div>
      ${plan.ai_summary ? `<p class="mt-4 text-sm text-white/80 max-w-2xl mx-auto leading-relaxed">${escapeHtmlRenovation(plan.ai_summary)}</p>` : ''}
    </div>

    ${totalCount > 0 ? `
    <!-- Progress Bar -->
    <div class="card p-5 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">task_alt</span>
          <span class="font-bold text-sm">התקדמות שיפוץ</span>
        </div>
        <span class="text-sm font-inter font-bold text-primary" id="renovation-progress-label">${completedCount}/${totalCount} שלבים הושלמו</span>
      </div>
      <div class="progress-bar" style="height: 10px;">
        <div class="progress-fill" id="renovation-progress-fill" style="width: ${completionPct}%; background: ${completionPct === 100 ? '#166534' : '#022445'};"></div>
      </div>
    </div>
    ` : ''}

    <!-- Edit Total Cost -->
    <div class="card p-5 mb-6 ${ro ? 'opacity-60 pointer-events-none' : ''}" id="renovation-edit-total-section">
      <div class="flex items-center gap-4">
        <label class="form-label mb-0 whitespace-nowrap">עלות כוללת (עריכה ידנית)</label>
        <input type="text" inputmode="numeric" data-currency="true" class="form-input ltr font-bold w-48 ${roClass}"
          value="${totalCost ? formatCurrency(totalCost) : ''}"
          ${roAttr}
          onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
          onchange="updateRenovationField('total_cost', parseAmount(this.value))">
      </div>
    </div>

    <!-- Phases Table -->
    ${phases.length > 0 ? `
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">
          <span class="material-symbols-outlined align-middle ml-1 text-primary">view_timeline</span>
          טבלת שלבי תשלום (Draw Schedule)
        </h3>
        <span class="text-sm text-gray-400 font-inter">${phases.length} שלבים</span>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="w-12"></th>
              <th class="w-16">שלב</th>
              <th>תיאור עבודה</th>
              <th class="w-36">עלות</th>
              <th>הסבר AI</th>
              <th class="w-20">פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${phases.map((phase, idx) => {
              const phaseNum = phase.phase_number || phase.phase || (idx + 1);
              const phaseCost = phase.cost != null ? phase.cost : (phase.amount != null ? phase.amount : 0);
              const phaseDesc = phase.ai_explanation || phase.description_ai || '';
              const isCompleted = !!phase.completed;
              return `
              <tr class="${isCompleted ? 'renovation-phase-completed' : ''}" id="renovation-phase-row-${idx}">
                <td class="text-center">
                  <label class="renovation-checkbox-wrapper">
                    <input type="checkbox" class="renovation-phase-checkbox"
                      ${isCompleted ? 'checked' : ''}
                      onchange="togglePhaseCompletion(${idx}, this.checked)">
                    <span class="renovation-checkbox-visual ${isCompleted ? 'checked' : ''}">
                      ${isCompleted ? '<span class="material-symbols-outlined" style="font-size:16px;">check</span>' : ''}
                    </span>
                  </label>
                </td>
                <td class="text-center font-bold font-inter text-primary">${phaseNum}</td>
                <td>
                  <input type="text" class="form-input text-sm ${roClass}"
                    value="${escapeHtmlRenovation(phase.title || '')}"
                    ${roAttr}
                    onchange="updateRenovationPhase(${idx}, 'title', this.value)">
                </td>
                <td>
                  <input type="text" inputmode="numeric" data-currency="true" class="form-input ltr text-sm w-36 ${roClass}"
                    value="${phaseCost ? formatCurrency(phaseCost) : ''}"
                    ${roAttr}
                    onfocus="unformatCurrencyInput(this)" onblur="formatCurrencyInput(this)"
                    onchange="handlePhaseCostChange(${idx}, this.value)">
                </td>
                <td>
                  ${ro ? `
                    <div class="text-sm text-gray-700 leading-relaxed py-1 renovation-explanation">
                      ${phaseDesc ? escapeHtmlRenovation(phaseDesc) : '<span class="text-gray-300">אין הסבר</span>'}
                    </div>
                  ` : `
                    <input type="text" class="form-input text-sm"
                      value="${escapeHtmlRenovation(phaseDesc)}"
                      onchange="updateRenovationPhase(${idx}, 'ai_explanation', this.value)"
                      placeholder="הסבר AI...">
                  `}
                </td>
                <td class="text-center">
                  ${renovationEditMode ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteRenovationPhase(${idx})" title="מחק שלב">
                      <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;}).join('')}
          </tbody>
          <tfoot>
            <tr class="font-bold bg-gray-50">
              <td></td>
              <td colspan="2" class="text-left">סה"כ</td>
              <td class="font-inter" id="renovation-phases-sum">${formatCurrency(phasesSum)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Add phase button (only in edit mode) -->
      ${renovationEditMode ? `
      <div class="mt-4">
        <button class="btn btn-secondary btn-sm" onclick="addRenovationPhase()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף שלב
        </button>
      </div>
      ` : ''}
    </div>
    ` : `
    <div class="card p-8 text-center mb-6">
      <p class="text-gray-400 text-sm">לא נמצאו שלבים בתכנית השיפוץ.</p>
      ${renovationEditMode ? `
      <button class="btn btn-secondary btn-sm mt-4" onclick="addRenovationPhase()">
        <span class="material-symbols-outlined text-sm">add</span>
        הוסף שלב ראשון
      </button>
      ` : ''}
    </div>
    `}
  `;
}

// ── Edit Mode Toggle ─────────────────────────────────────────

function toggleRenovationEditMode() {
  const wasEditing = renovationEditMode;
  renovationEditMode = !renovationEditMode;
  if (wasEditing) {
    // Exiting edit mode — reload fresh data from server
    reloadDeal(renderRenovationTab);
  } else if (currentDealData) {
    // Entering edit mode — just re-render current data
    renderRenovationTab(currentDealData);
  }
}

// ── Phase Cost Change + Auto-Recalculate ─────────────────────

async function handlePhaseCostChange(phaseIdx, rawValue) {
  const newCost = parseAmount(rawValue);

  // 1. Save to server
  await updateRenovationPhase(phaseIdx, 'cost', newCost);

  // 2. Auto-recalculate total from all phases
  await autoRecalcRenovationTotal();
}

/**
 * Recalculate the total_cost as SUM of all phase costs,
 * update display, and save to server.
 */
async function autoRecalcRenovationTotal() {
  try {
    const data = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
    const plan = data.plan;
    if (!plan || !plan.phases) return;

    const newTotal = plan.phases.reduce((sum, p) => sum + (p.cost != null ? p.cost : (p.amount || 0)), 0);

    // Update the total_cost on server
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { total_cost: newTotal });

    // Update display without full re-render
    const totalDisplay = document.getElementById('renovation-total-display');
    if (totalDisplay) totalDisplay.textContent = formatCurrency(newTotal);

    const phasesSum = document.getElementById('renovation-phases-sum');
    if (phasesSum) phasesSum.textContent = formatCurrency(newTotal);

    // Update currentDealData for consistency
    if (currentDealData && currentDealData.renovationPlan) {
      currentDealData.renovationPlan.total_cost = newTotal;
    }
  } catch (err) {
    showToast(`שגיאה בחישוב סה"כ: ${err.message}`, 'error');
  }
}

// ── Phase Completion Toggle ──────────────────────────────────

async function togglePhaseCompletion(phaseIdx, isCompleted) {
  try {
    const data = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
    const plan = data.plan;
    if (!plan || !plan.phases) return;

    plan.phases[phaseIdx].completed = isCompleted;
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { phases: plan.phases });

    // Update the row styling immediately
    const row = document.getElementById(`renovation-phase-row-${phaseIdx}`);
    if (row) {
      if (isCompleted) {
        row.classList.add('renovation-phase-completed');
      } else {
        row.classList.remove('renovation-phase-completed');
      }
      // Update the checkbox visual
      const visual = row.querySelector('.renovation-checkbox-visual');
      if (visual) {
        if (isCompleted) {
          visual.classList.add('checked');
          visual.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">check</span>';
        } else {
          visual.classList.remove('checked');
          visual.innerHTML = '';
        }
      }
    }

    // Update progress bar
    const phases = plan.phases;
    const completedCount = phases.filter(p => p.completed).length;
    const totalCount = phases.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const label = document.getElementById('renovation-progress-label');
    if (label) label.textContent = `${completedCount}/${totalCount} שלבים הושלמו`;

    const fill = document.getElementById('renovation-progress-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct === 100 ? '#166534' : '#022445';
    }

    // Update currentDealData
    if (currentDealData && currentDealData.renovationPlan) {
      currentDealData.renovationPlan.phases = phases;
    }

  } catch (err) {
    showToast(`שגיאה בעדכון השלמה: ${err.message}`, 'error');
  }
}

// ── Renovation Plan Mutations ─────────────────────────────────

async function updateRenovationField(field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { [field]: value });
  } catch (err) {
    showToast(`שגיאה בעדכון: ${err.message}`, 'error');
  }
}

async function updateRenovationPhase(phaseIdx, field, value) {
  try {
    const data = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
    const plan = data.plan;
    if (!plan || !plan.phases) return;

    plan.phases[phaseIdx][field] = value;
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { phases: plan.phases });
  } catch (err) {
    showToast(`שגיאה בעדכון שלב: ${err.message}`, 'error');
  }
}

async function deleteRenovationPhase(phaseIdx) {
  if (!await confirmAction('האם למחוק שלב זה מתכנית השיפוץ?')) return;
  try {
    const data = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
    const plan = data.plan;
    if (!plan || !plan.phases) return;

    plan.phases.splice(phaseIdx, 1);
    // Re-number phases
    plan.phases = plan.phases.map((p, i) => ({ ...p, phase_number: i + 1 }));
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { phases: plan.phases });

    // Also recalculate total
    const newTotal = plan.phases.reduce((sum, p) => sum + (p.cost != null ? p.cost : (p.amount || 0)), 0);
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { total_cost: newTotal });

    showToast('שלב נמחק');
    reloadDeal(renderRenovationTab);
  } catch (err) {
    showToast(`שגיאה במחיקה: ${err.message}`, 'error');
  }
}

async function addRenovationPhase() {
  try {
    const data = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
    let plan = data.plan;

    if (!plan) {
      // Create plan first
      await API.post(`/deals/${currentDeal.id}/renovation-plan`, {
        total_cost: 0,
        phases: [],
        ai_summary: null
      });
      const data2 = await API.get(`/deals/${currentDeal.id}/renovation-plan`);
      plan = data2.plan;
    }

    const phases = plan.phases || [];
    const newPhase = {
      phase_number: phases.length + 1,
      title: `שלב ${phases.length + 1}`,
      cost: 0,
      ai_explanation: '',
      completed: false
    };
    phases.push(newPhase);
    await API.put(`/deals/${currentDeal.id}/renovation-plan`, { phases });
    showToast('שלב נוסף');
    reloadDeal(renderRenovationTab);
  } catch (err) {
    showToast(`שגיאה בהוספה: ${err.message}`, 'error');
  }
}

async function reloadRenovationTab() {
  reloadDeal(renderRenovationTab);
}

function escapeHtmlRenovation(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Timeline tab — two layers:
 *  1. buildTimelineChartHTML / onStageClick: the visual status chart rendered
 *     inside the Property tab (maps property_status → a step on the horizontal chart).
 *  2. renderTimelineTab: editable list of deal_timeline_steps from the DB,
 *     shown in the dedicated "ציר זמן" tab.
 */

// ── Layer 1: Status Chart (used by property.js) ─────────────

/**
 * Fixed stages for the status chart in the property tab.
 * Each maps to a property_status value stored on the deal.
 */
const TIMELINE_STAGES = [
  { label: 'גיוס משקיעים', status: 'fundraising' },
  { label: 'רכישת הנכס',   status: 'purchased' },
  { label: 'אישורי בנייה', status: 'planning' },
  { label: 'שיפוץ',        status: 'renovation' },
  { label: 'מכירה',        status: 'selling' },
  { label: 'נמכר',         status: 'sold' }
];

/**
 * Determine the index of the current stage based on property_status.
 * Returns -1 if the status doesn't match any stage (e.g. 'sourcing').
 */
function getActiveStageIndex(propertyStatus) {
  return TIMELINE_STAGES.findIndex(s => s.status === propertyStatus);
}

/**
 * Build the horizontal status-chart HTML.
 * @param {string} propertyStatus — current deal.property_status
 * @returns {string} HTML string
 */
function buildTimelineChartHTML(propertyStatus) {
  const activeIdx = getActiveStageIndex(propertyStatus);

  return `
    <div class="status-chart" id="statusChart">
      <div class="status-chart-track">
        ${TIMELINE_STAGES.map((stage, idx) => {
          let stageClass = 'pending';
          if (activeIdx >= 0) {
            if (idx < activeIdx) stageClass = 'completed';
            else if (idx === activeIdx) stageClass = 'active';
          }

          const lineClass = (activeIdx >= 0 && idx <= activeIdx) ? 'completed' : '';

          return `
            ${idx > 0 ? `<div class="status-chart-line ${lineClass}"></div>` : ''}
            <div class="status-chart-stage ${stageClass}" data-stage-idx="${idx}" onclick="onStageClick(${idx})">
              <div class="status-chart-circle">
                ${stageClass === 'completed'
                  ? '<span class="material-symbols-outlined text-sm">check</span>'
                  : `<span class="stage-number">${idx + 1}</span>`}
              </div>
              <span class="status-chart-label">${stage.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Handle click on a status chart stage (in the property tab).
 * Shows a confirmation dialog, then updates the deal's property_status via API.
 */
async function onStageClick(stageIdx) {
  const stage = TIMELINE_STAGES[stageIdx];
  if (!stage) return;

  // Don't do anything if already at this stage
  if (currentDeal.property_status === stage.status) return;

  const confirmed = await confirmAction(`האם לעדכן את סטטוס הנכס ל-${stage.label}?`);
  if (!confirmed) return;

  try {
    await API.put(`/deals/${currentDeal.id}`, { property_status: stage.status });
    currentDeal.property_status = stage.status;

    // Update header badge
    const statusLabel = PROPERTY_STATUS[stage.status] || stage.label;
    const badgeClass = PROPERTY_STATUS_BADGE[stage.status] || 'badge-gray';
    document.getElementById('dealStatusBadge').textContent = statusLabel;
    document.getElementById('dealStatusBadge').className = `badge ${badgeClass}`;

    // Update the property_status dropdown if it exists
    const statusSelect = document.querySelector('select[name="property_status"]');
    if (statusSelect) statusSelect.value = stage.status;

    // Re-render just the chart
    const chartContainer = document.getElementById('statusChart');
    if (chartContainer) {
      chartContainer.outerHTML = buildTimelineChartHTML(stage.status);
    }

    showToast(`סטטוס עודכן ל-${stage.label}`);
  } catch (err) {
    showToast(`שגיאה בעדכון סטטוס: ${err.message}`, 'error');
  }
}

// ── Layer 2: Editable Timeline Steps Tab ─────────────────────

const STEP_STATUS_LABELS = {
  pending:   'ממתין',
  active:    'פעיל',
  completed: 'הושלם'
};

const STEP_STATUS_BADGE = {
  pending:   'badge-gray',
  active:    'badge-blue',
  completed: 'badge-green'
};

/**
 * Render the editable timeline steps tab.
 * Called from deal-edit.js after deal data is loaded.
 */
function renderTimelineTab(data) {
  const steps = (data.timeline || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const container = document.getElementById('tab-timeline');
  if (!container) return;

  container.innerHTML = buildTimelineTabHTML(steps);
}

/**
 * The modal HTML is always rendered regardless of whether there are steps,
 * so that openAddTimelineStep() always finds it in the DOM.
 */
const TIMELINE_STEP_MODAL_HTML = `
  <div id="timelineStepModal" class="modal-overlay hidden" onclick="if(event.target===this)closeTimelineStepModal()">
    <div class="modal-box" style="max-width: 26rem;">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-bold" id="timelineModalTitle">הוסף שלב</h2>
        <button onclick="closeTimelineStepModal()" class="text-gray-400 hover:text-gray-600">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form id="timelineStepForm" onsubmit="submitTimelineStep(event)">
        <input type="hidden" id="timelineStepId" value="">
        <div class="mb-4">
          <label class="form-label">שם השלב</label>
          <input type="text" id="timelineStepName" class="form-input" placeholder="לדוגמה: שיפוץ" required>
        </div>
        <div class="mb-4">
          <label class="form-label">סטטוס</label>
          <select id="timelineStepStatus" class="form-select">
            <option value="pending">ממתין</option>
            <option value="active">פעיל</option>
            <option value="completed">הושלם</option>
          </select>
        </div>
        <div class="mb-6">
          <label class="form-label">סדר תצוגה</label>
          <input type="number" id="timelineStepOrder" class="form-input" value="0" min="0">
        </div>
        <div class="flex gap-3">
          <button type="submit" id="timelineStepSubmitBtn" class="btn btn-primary flex-1">
            <span class="material-symbols-outlined text-sm">save</span>
            שמור
          </button>
          <button type="button" onclick="closeTimelineStepModal()" class="btn btn-secondary flex-1">ביטול</button>
        </div>
      </form>
    </div>
  </div>
`;

function buildTimelineTabHTML(steps) {
  if (!steps || steps.length === 0) {
    return `
      <div class="card p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold">שלבי העסקה</h3>
          <button class="btn btn-secondary btn-sm" onclick="openAddTimelineStep()">
            <span class="material-symbols-outlined text-sm">add</span>
            הוסף שלב
          </button>
        </div>
        <div class="text-center text-gray-400 py-8">
          <span class="material-symbols-outlined text-4xl block mb-2">timeline</span>
          <p>אין שלבים מוגדרים לעסקה זו</p>
        </div>
      </div>
      ${TIMELINE_STEP_MODAL_HTML}
    `;
  }

  const stepsHTML = steps.map((step, idx) => buildStepRowHTML(step, idx, steps.length)).join('');

  return `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold">שלבי העסקה</h3>
        <button class="btn btn-secondary btn-sm" onclick="openAddTimelineStep()">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף שלב
        </button>
      </div>

      <!-- Vertical timeline list -->
      <div class="timeline-steps-list" id="timelineStepsList">
        ${stepsHTML}
      </div>
    </div>

    ${TIMELINE_STEP_MODAL_HTML}
  `;
}

function buildStepRowHTML(step, idx, total) {
  const statusLabel = STEP_STATUS_LABELS[step.status] || step.status;
  const badgeClass  = STEP_STATUS_BADGE[step.status] || 'badge-gray';

  // Status cycle: pending → active → completed → pending
  const nextStatus = step.status === 'pending' ? 'active'
    : step.status === 'active' ? 'completed'
    : 'pending';
  const nextLabel = STEP_STATUS_LABELS[nextStatus];

  // Circle icon per status
  const circleIcon = step.status === 'completed'
    ? '<span class="material-symbols-outlined text-base">check_circle</span>'
    : step.status === 'active'
    ? '<span class="material-symbols-outlined text-base">radio_button_checked</span>'
    : '<span class="material-symbols-outlined text-base">radio_button_unchecked</span>';

  const circleColorClass = step.status === 'completed' ? 'text-secondary'
    : step.status === 'active' ? 'text-primary'
    : 'text-gray-300';

  return `
    <div class="timeline-step-row" data-step-id="${step.id}">
      <div class="flex items-start gap-4 py-4">
        <!-- Circle indicator -->
        <div class="timeline-step-icon ${circleColorClass} mt-0.5 flex-shrink-0">
          ${circleIcon}
        </div>

        <!-- Step info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-gray-900">${escapeHtml(step.step_name)}</span>
            <span class="badge ${badgeClass} text-xs">${statusLabel}</span>
          </div>
          <div class="text-xs text-gray-400 mt-0.5 font-inter">שלב ${step.sort_order + 1}</div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 flex-shrink-0">
          <!-- Quick status cycle button -->
          <button
            class="btn btn-secondary btn-sm text-xs"
            onclick="quickCycleStepStatus(${step.id}, '${nextStatus}')"
            title="שנה ל-${nextLabel}">
            <span class="material-symbols-outlined text-sm">swap_horiz</span>
            ${nextLabel}
          </button>
          <!-- Edit button -->
          <button
            class="btn btn-secondary btn-sm"
            onclick="openEditTimelineStep(${step.id}, '${escapeHtml(step.step_name)}', '${step.status}', ${step.sort_order})"
            title="ערוך שלב">
            <span class="material-symbols-outlined text-sm">edit</span>
          </button>
          <!-- Delete button -->
          <button
            class="btn btn-secondary btn-sm text-secondary"
            onclick="deleteTimelineStep(${step.id})"
            title="מחק שלב">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to safely embed step_name in HTML attributes.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Quick status cycle ─────────────────────────────────────

/**
 * One-click status toggle: cycles to the next status without opening the modal.
 */
async function quickCycleStepStatus(stepId, newStatus) {
  try {
    await API.put(`/deals/${currentDeal.id}/timeline/${stepId}`, { status: newStatus });
    showToast(`סטטוס שלב עודכן ל-${STEP_STATUS_LABELS[newStatus]}`);
    // Reload the timeline tab
    reloadDeal(renderTimelineTab);
  } catch (err) {
    showToast(`שגיאה בעדכון: ${err.message}`, 'error');
  }
}

// ── Modal helpers ──────────────────────────────────────────

function openAddTimelineStep() {
  document.getElementById('timelineModalTitle').textContent = 'הוסף שלב';
  document.getElementById('timelineStepId').value = '';
  document.getElementById('timelineStepName').value = '';
  document.getElementById('timelineStepStatus').value = 'pending';

  // Default sort_order = current max + 1
  const rows = document.querySelectorAll('.timeline-step-row');
  document.getElementById('timelineStepOrder').value = rows.length;

  document.getElementById('timelineStepModal').classList.remove('hidden');
  document.getElementById('timelineStepName').focus();
}

function openEditTimelineStep(stepId, stepName, status, sortOrder) {
  document.getElementById('timelineModalTitle').textContent = 'ערוך שלב';
  document.getElementById('timelineStepId').value = stepId;
  document.getElementById('timelineStepName').value = stepName;
  document.getElementById('timelineStepStatus').value = status;
  document.getElementById('timelineStepOrder').value = sortOrder;

  document.getElementById('timelineStepModal').classList.remove('hidden');
  document.getElementById('timelineStepName').focus();
}

function closeTimelineStepModal() {
  document.getElementById('timelineStepModal').classList.add('hidden');
}

// ── CRUD operations ────────────────────────────────────────

async function submitTimelineStep(e) {
  e.preventDefault();
  const stepId    = document.getElementById('timelineStepId').value;
  const stepName  = document.getElementById('timelineStepName').value.trim();
  const status    = document.getElementById('timelineStepStatus').value;
  const sortOrder = parseInt(document.getElementById('timelineStepOrder').value) || 0;
  const submitBtn = document.getElementById('timelineStepSubmitBtn');

  if (!stepName) {
    showToast('נא להזין שם שלב', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> שומר...';

  try {
    if (stepId) {
      // Edit existing
      await API.put(`/deals/${currentDeal.id}/timeline/${stepId}`, {
        step_name: stepName,
        status,
        sort_order: sortOrder
      });
      showToast('השלב עודכן בהצלחה');
    } else {
      // Create new
      await API.post(`/deals/${currentDeal.id}/timeline`, {
        step_name: stepName,
        status,
        sort_order: sortOrder
      });
      showToast('השלב נוסף בהצלחה');
    }
    closeTimelineStepModal();
    reloadDeal(renderTimelineTab);
  } catch (err) {
    showToast(`שגיאה: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> שמור';
  }
}

async function deleteTimelineStep(stepId) {
  const confirmed = await confirmAction('האם למחוק שלב זה מציר הזמן?');
  if (!confirmed) return;

  try {
    await API.delete(`/deals/${currentDeal.id}/timeline/${stepId}`);
    showToast('השלב נמחק');
    reloadDeal(renderTimelineTab);
  } catch (err) {
    showToast(`שגיאה במחיקה: ${err.message}`, 'error');
  }
}

// Legacy stubs kept for safety
async function addTimelineStep() {}
async function updateTimelineStep() {}

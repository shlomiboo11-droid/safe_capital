/**
 * Specs — Before/After
 * Rendering is now handled inside the property tab.
 * This file retains the CRUD helper functions (addSpec, updateSpec, deleteSpec).
 */
function renderSpecsTab() { /* no-op — specs are rendered inside property tab */ }

/**
 * Build the specs HTML for embedding inside another container.
 */
function buildSpecsHTML(specs) {
  return `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">מפרט לפני / אחרי</h3>
        <button class="btn btn-primary btn-sm" onclick="addSpec()">
          <span class="material-symbols-outlined text-sm">add</span>
          שורה חדשה
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>שם מפרט</th>
              <th>לפני</th>
              <th>אחרי</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${specs.length === 0 ? '<tr><td colspan="4" class="text-center text-gray-400 py-8">אין מפרטים. לחץ על "שורה חדשה" כדי להוסיף.</td></tr>' : ''}
            ${specs.map(s => `
              <tr>
                <td><input type="text" class="form-input text-sm" value="${s.spec_name || ''}" onchange="updateSpec(${s.id}, 'spec_name', this.value)"></td>
                <td><input type="text" class="form-input ltr text-sm" value="${s.value_before || ''}" onchange="updateSpec(${s.id}, 'value_before', this.value)"></td>
                <td><input type="text" class="form-input ltr text-sm" value="${s.value_after || ''}" onchange="updateSpec(${s.id}, 'value_after', this.value)"></td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="deleteSpec(${s.id})">
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

async function addSpec() {
  // Find the button that triggered this and disable it to prevent double-click
  const btn = document.querySelector('[onclick="addSpec()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> שומר...';
  }
  try {
    await API.post(`/deals/${currentDeal.id}/specs`, { spec_name: '', value_before: '', value_after: '' });
    reloadDeal(renderPropertyTab);
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">add</span> שורה חדשה';
    }
  }
}

async function updateSpec(id, field, value) {
  try { await API.put(`/deals/${currentDeal.id}/specs/${id}`, { [field]: value }); }
  catch (err) { showToast(err.message, 'error'); }
}

async function deleteSpec(id) {
  if (!await confirmAction('למחוק שורה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/specs/${id}`);
    reloadDeal(renderPropertyTab);
  } catch (err) { showToast(err.message, 'error'); }
}

/**
 * Tab A: Property Details
 * Now also includes: Specs (before/after) and Timeline (status chart)
 */
function renderPropertyTab(data) {
  const deal = data.deal;
  const specs = data.specs || [];
  const container = document.getElementById('tab-property');

  container.innerHTML = `
    <form id="propertyForm" class="space-y-6">
      <!-- Basic Info -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">פרטים בסיסיים</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">שם הנכס</label>
            <input type="text" name="name" class="form-input" value="${deal.name || ''}" required>
          </div>
          <div>
            <label class="form-label">מספר עסקה</label>
            <input type="number" name="deal_number" class="form-input ltr font-inter" dir="ltr" value="${deal.deal_number || ''}" min="1" required>
          </div>
          <div class="md:col-span-2">
            <label class="form-label">כתובת מלאה</label>
            <input type="text" name="full_address" class="form-input ltr" dir="ltr" value="${deal.full_address || ''}">
          </div>
          <div>
            <label class="form-label">עיר</label>
            <input type="text" name="city" class="form-input ltr" dir="ltr" value="${deal.city || ''}">
          </div>
          <div>
            <label class="form-label">מדינה (State)</label>
            <input type="text" name="state" class="form-input ltr" dir="ltr" value="${deal.state || ''}">
          </div>
          <div>
            <label class="form-label">קישור Zillow</label>
            <input type="url" name="zillow_url" class="form-input ltr" dir="ltr" value="${deal.zillow_url || ''}" placeholder="https://www.zillow.com/...">
          </div>
          <div>
            <label class="form-label">משך הפרויקט</label>
            <input type="text" name="project_duration" class="form-input ltr" dir="ltr" value="${deal.project_duration || ''}" placeholder="8 Months">
          </div>
        </div>
      </div>

      <!-- Zillow & Map Section -->
      ${deal.zillow_url ? `
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">
            <span class="material-symbols-outlined align-middle ml-1 text-primary">location_on</span>
            נתוני Zillow
          </h3>
          <a href="${deal.zillow_url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined text-sm">open_in_new</span>
            צפה ב-Zillow
          </a>
        </div>

        ${deal.thumbnail_url ? `
        <div class="mb-4 rounded-lg overflow-hidden" style="max-height: 240px;">
          <img src="${deal.thumbnail_url}" alt="${deal.name || 'Property'}" class="w-full object-cover" style="max-height: 240px;"
            onerror="this.parentElement.style.display='none'">
        </div>
        ` : ''}

        ${deal.full_address ? `
        <div class="mb-4">
          <iframe
            src="https://maps.google.com/maps?q=${encodeURIComponent(deal.full_address)}&output=embed"
            width="100%" height="300" style="border:0; border-radius: 0.75rem;"
            allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade">
          </iframe>
        </div>
        ` : ''}

        ${(function() {
          const zillowSpecs = [];
          for (const s of specs) {
            const name = (s.spec_name || '').toLowerCase();
            const val = s.value_after || s.value_before || '';
            if (name.includes('שינה') || name.includes('bed')) zillowSpecs.push({ label: 'חדרי שינה', value: val, icon: 'bed' });
            else if (name.includes('רחצה') || name.includes('bath')) zillowSpecs.push({ label: 'חדרי רחצה', value: val, icon: 'bathtub' });
            else if (name.includes('שטח') || name.includes('sqft')) zillowSpecs.push({ label: 'שטח (sqft)', value: val, icon: 'straighten' });
          }
          if (zillowSpecs.length === 0) return '';
          return '<div class="grid grid-cols-3 gap-3">' + zillowSpecs.map(s =>
            '<div class="text-center p-3 bg-gray-50 rounded-lg">' +
              '<span class="material-symbols-outlined text-primary text-xl block mb-1">' + s.icon + '</span>' +
              '<div class="font-inter font-bold text-lg">' + s.value + '</div>' +
              '<div class="text-xs text-gray-500">' + s.label + '</div>' +
            '</div>'
          ).join('') + '</div>';
        })()}
      </div>
      ` : ''}

      <!-- Specs: Before / After -->
      ${buildSpecsHTML(specs)}

      <!-- Status & Display -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">סטטוס ותצוגה</h3>

        <!-- Timeline Status Chart -->
        ${buildTimelineChartHTML(deal.property_status)}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label class="form-label">סטטוס נכס</label>
            <select name="property_status" class="form-select">
              <option value="fundraising" ${deal.property_status === 'fundraising' ? 'selected' : ''}>גיוס משקיעים</option>
              <option value="sourcing" ${deal.property_status === 'sourcing' ? 'selected' : ''}>איתור</option>
              <option value="purchased" ${deal.property_status === 'purchased' ? 'selected' : ''}>נרכש</option>
              <option value="planning" ${deal.property_status === 'planning' ? 'selected' : ''}>בתכנון</option>
              <option value="renovation" ${deal.property_status === 'renovation' ? 'selected' : ''}>בשיפוץ</option>
              <option value="selling" ${deal.property_status === 'selling' ? 'selected' : ''}>למכירה</option>
              <option value="sold" ${deal.property_status === 'sold' ? 'selected' : ''}>נמכר</option>
            </select>
          </div>
          <div>
            <label class="form-label">סטטוס גיוס</label>
            <select name="fundraising_status" class="form-select">
              <option value="upcoming" ${deal.fundraising_status === 'upcoming' ? 'selected' : ''}>טרם התחיל</option>
              <option value="active" ${deal.fundraising_status === 'active' ? 'selected' : ''}>בגיוס</option>
              <option value="completed" ${deal.fundraising_status === 'completed' ? 'selected' : ''}>גיוס הושלם</option>
              <option value="closed" ${deal.fundraising_status === 'closed' ? 'selected' : ''}>סגור</option>
            </select>
          </div>
          <div>
            <label class="form-label">סדר תצוגה</label>
            <input type="number" name="sort_order" class="form-input" value="${deal.sort_order || 0}">
          </div>
          <div>
            <label class="form-label">תמונה ראשית (URL)</label>
            <input type="url" name="thumbnail_url" class="form-input ltr" dir="ltr" value="${deal.thumbnail_url || ''}">
          </div>
        </div>

        <!-- Toggles -->
        <div class="flex flex-wrap gap-6 mt-6">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="is_published" class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" ${deal.is_published ? 'checked' : ''}>
            <span class="text-sm font-medium">מפורסם</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="is_featured" class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" ${deal.is_featured ? 'checked' : ''}>
            <span class="text-sm font-medium">מוצג בדף הבית</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="is_expandable" class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" ${deal.is_expandable ? 'checked' : ''}>
            <span class="text-sm font-medium">ניתן להרחבה</span>
          </label>
        </div>
      </div>

      <!-- Description -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">תיאור העסקה</h3>
        <textarea name="description" class="form-input" rows="6" placeholder="2-3 פסקאות שמתארות את העסקה...">${deal.description || ''}</textarea>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end">
        <button type="submit" class="btn btn-primary px-8">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור פרטים
        </button>
      </div>
    </form>
  `;

  // Form submit handler
  document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      deal_number: parseInt(form.deal_number.value) || null,
      name: form.name.value.trim(),
      full_address: form.full_address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      zillow_url: form.zillow_url.value.trim(),
      project_duration: form.project_duration.value.trim(),
      property_status: form.property_status.value,
      fundraising_status: form.fundraising_status.value,
      sort_order: parseInt(form.sort_order.value) || 0,
      thumbnail_url: form.thumbnail_url.value.trim(),
      is_published: form.is_published.checked,
      is_featured: form.is_featured.checked,
      is_expandable: form.is_expandable.checked,
      description: form.description.value.trim()
    };

    try {
      await API.put(`/deals/${currentDeal.id}`, body);
      currentDeal.property_status = body.property_status;
      currentDeal.deal_number = body.deal_number;
      showToast('הפרטים נשמרו בהצלחה');

      // Update header
      document.getElementById('dealTitle').textContent = body.name;
      document.getElementById('dealNumber').textContent = `#${body.deal_number}`;
      const status = PROPERTY_STATUS[body.property_status];
      const badge = PROPERTY_STATUS_BADGE[body.property_status];
      document.getElementById('dealStatusBadge').textContent = status;
      document.getElementById('dealStatusBadge').className = `badge ${badge}`;

      // Re-render the status chart to reflect the new status
      const chartContainer = document.getElementById('statusChart');
      if (chartContainer) {
        chartContainer.outerHTML = buildTimelineChartHTML(body.property_status);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

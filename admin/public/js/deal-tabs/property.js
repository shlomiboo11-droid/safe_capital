/**
 * Tab A: Property Details
 * Now also includes: Specs (before/after) and Timeline (status chart)
 */
function renderPropertyTab(data) {
  const deal = data.deal;
  const specs = data.specs || [];
  const images = data.images || [];
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
            <label class="form-label">תמונה ראשית</label>
            <select name="thumbnail_url" class="form-input ltr" dir="ltr" id="thumbnailPicker" onchange="updateThumbnailPreview(this.value)">
              <option value="">— ללא תמונה —</option>
              ${images.map(img => `
                <option value="${(img.image_url || '').replace(/"/g, '&quot;')}" ${deal.thumbnail_url === img.image_url ? 'selected' : ''}>
                  ${(img.category || 'כללי')} — ${(img.alt_text || img.image_url.split('/').pop() || '').slice(0, 60)}
                </option>
              `).join('')}
              ${deal.thumbnail_url && !images.some(i => i.image_url === deal.thumbnail_url) ? `<option value="${deal.thumbnail_url.replace(/"/g, '&quot;')}" selected>(URL חיצוני) ${deal.thumbnail_url.split('/').pop()}</option>` : ''}
            </select>
            <img id="thumbnailPreview" src="${deal.thumbnail_url || ''}" alt=""
              class="mt-2 rounded ${deal.thumbnail_url ? '' : 'hidden'}"
              style="max-height: 80px; max-width: 100%;"
              onerror="this.style.display='none'">
          </div>
          <div>
            <label class="form-label">תאריך פתיחה לגיוס</label>
            <input type="date" name="opens_at_date" class="form-input ltr" dir="ltr" value="${deal.opens_at_date ? String(deal.opens_at_date).slice(0, 10) : ''}">
          </div>
          <div>
            <label class="form-label">תאריך מכירה בפועל</label>
            <input type="date" name="sold_at_date" class="form-input ltr" dir="ltr" value="${deal.sold_at_date ? String(deal.sold_at_date).slice(0, 10) : ''}">
          </div>
          <div>
            <label class="form-label">אחוז התקדמות שיפוץ</label>
            <div class="relative">
              <input type="number" name="renovation_progress_percent" class="form-input ltr font-inter" dir="ltr" min="0" max="100" step="1" value="${deal.renovation_progress_percent != null ? deal.renovation_progress_percent : ''}">
              <span class="absolute top-1/2 -translate-y-1/2 left-3 text-sm text-gray-500 pointer-events-none">%</span>
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="form-label">הערת סיום עסקה</label>
            <textarea name="sale_completion_note" class="form-input" rows="2" placeholder="הערה קצרה על סיום העסקה (למשל: 'נמכר מעל ציפיות תוך 6 חודשים')">${deal.sale_completion_note || ''}</textarea>
          </div>
          <div>
            <label class="form-label">רווח שפוזר למשקיעים (USD)</label>
            <div class="relative">
              <input type="number" name="profit_distributed" class="form-input ltr font-inter" dir="ltr" min="0" step="1" placeholder="סכום דולרי שחולק בפועל" value="${deal.profit_distributed != null ? deal.profit_distributed : ''}">
              <span class="absolute top-1/2 -translate-y-1/2 left-3 text-sm text-gray-500 pointer-events-none">$</span>
            </div>
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
        <div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 class="text-lg font-bold">תיאור העסקה</h3>
          <button type="button" id="regenerateDescriptionBtn" class="btn btn-secondary btn-sm" onclick="regenerateDealDescription()">
            <span class="material-symbols-outlined text-sm">auto_awesome</span>
            <span id="regenerateDescriptionBtnLabel">רענן תיאור ב-AI</span>
          </button>
        </div>
        <textarea name="description" id="dealDescriptionField" class="form-input" rows="6" placeholder="2-3 פסקאות שמתארות את העסקה...">${deal.description || ''}</textarea>

        <div class="mt-4">
          <label class="form-label">תקציר לכרטיסיה</label>
          <textarea name="card_summary" id="dealCardSummaryField" class="form-input" rows="2" maxlength="200" placeholder="עד 15 מילים בעברית, בלי מספרים — ייווצר אוטומטית עם הכפתור למעלה">${deal.card_summary || ''}</textarea>
          <p class="text-xs text-gray-500 mt-1">תקציר שיווקי קצר לכרטיס הנכס באתר. עד 15 מילים בעברית, ללא מספרים. ניתן לעריכה ידנית.</p>
        </div>
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
      description: form.description.value.trim(),
      card_summary: form.card_summary ? form.card_summary.value.trim() : '',
      opens_at_date: form.opens_at_date.value || null,
      sold_at_date: form.sold_at_date.value || null,
      renovation_progress_percent: form.renovation_progress_percent.value === '' ? null : parseFloat(form.renovation_progress_percent.value),
      sale_completion_note: form.sale_completion_note.value.trim() || null,
      profit_distributed: form.profit_distributed.value === '' ? null : parseFloat(form.profit_distributed.value)
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

async function regenerateDealDescription() {
  if (typeof currentDeal === 'undefined' || !currentDeal || !currentDeal.id) {
    showToast('לא נמצאה עסקה פעילה', 'error');
    return;
  }
  const btn = document.getElementById('regenerateDescriptionBtn');
  const label = document.getElementById('regenerateDescriptionBtnLabel');
  const descField = document.getElementById('dealDescriptionField');
  const cardField = document.getElementById('dealCardSummaryField');
  const originalLabel = label ? label.textContent : '';

  if (btn) btn.disabled = true;
  if (label) label.textContent = 'מייצר תיאור חדש...';

  try {
    const data = await API.post(`/deals/${currentDeal.id}/regenerate-description`, {});
    if (descField && typeof data.description === 'string') {
      descField.value = data.description;
    }
    if (cardField && typeof data.card_summary === 'string') {
      cardField.value = data.card_summary;
    }
    showToast('התיאור והתקציר עודכנו');
  } catch (err) {
    showToast(err.message || 'כשל ביצירת תיאור', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (label) label.textContent = originalLabel || 'רענן תיאור ב-AI';
  }
}

function updateThumbnailPreview(url) {
  const img = document.getElementById('thumbnailPreview');
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = '';
    img.classList.remove('hidden');
  } else {
    img.style.display = 'none';
  }
}

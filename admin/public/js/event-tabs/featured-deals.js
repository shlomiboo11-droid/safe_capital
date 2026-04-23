/**
 * Event Tab: Featured Deals (auto-pull model)
 * All published deals from the dashboard are shown on the event page automatically.
 * This tab lets the admin hide specific deals per-event and set per-event override fields.
 */
let _publishedDeals = [];     // from GET /api/deals (filtered to is_published)
let _eventOverrides = {};     // map: deal_id -> { id, is_hidden, sort_order, override_status_label, override_status_tone, override_note }

async function renderFeaturedDealsTab(data) {
  const c = document.getElementById('tab-featured-deals');
  c.innerHTML = `
    <div class="card p-6">
      <div class="mb-4">
        <h3 class="text-lg font-bold">עסקאות מוצגות בעמוד האירוע</h3>
        <p class="text-sm text-gray-500 mt-2">
          כל העסקאות המפורסמות בדאשבורד נמשכות אוטומטית. אפשר להסתיר עסקאות ספציפיות מהאירוע או להוסיף הערת תצוגה פר-עסקה.
        </p>
      </div>
      <div id="featuredDealsList" class="space-y-2"><div class="text-sm text-gray-400 py-4 text-center">טוען...</div></div>
      <div class="flex justify-end mt-6">
        <button class="btn btn-primary px-8" onclick="saveFeaturedOverrides()">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור שינויים
        </button>
      </div>
    </div>
  `;

  // Build overrides map from existing event_featured_deals rows (only rows linked to a deal)
  _eventOverrides = {};
  for (const r of (data.featured_deals || [])) {
    if (r.deal_id != null) {
      _eventOverrides[r.deal_id] = {
        id: r.id,
        is_hidden: !!r.is_hidden,
        sort_order: r.sort_order || 0,
        override_status_label: r.override_status_label || '',
        override_status_tone: r.override_status_tone || '',
        override_note: r.override_note || ''
      };
    }
  }

  // Fetch all deals and filter to published
  try {
    const list = await API.get('/deals');
    const all = (list.deals || list) || [];
    _publishedDeals = all.filter(d => d.is_published);
    // Sort by per-event sort_order override (if present), else by deal's sort_order, else by id desc
    _publishedDeals.sort((a, b) => {
      const ao = _eventOverrides[a.id]?.sort_order ?? a.sort_order ?? 0;
      const bo = _eventOverrides[b.id]?.sort_order ?? b.sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return b.id - a.id;
    });
    renderPublishedDealsList();
  } catch (err) {
    document.getElementById('featuredDealsList').innerHTML = `<div class="text-sm text-red-500 py-4 text-center">שגיאה בטעינה: ${err.message}</div>`;
  }
}

function renderPublishedDealsList() {
  const list = document.getElementById('featuredDealsList');
  if (!list) return;
  if (_publishedDeals.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 py-4 text-center">אין עסקאות מפורסמות בדאשבורד</div>';
    return;
  }
  list.innerHTML = _publishedDeals.map((d, idx) => {
    const ov = _eventOverrides[d.id] || {};
    const hidden = !!ov.is_hidden;
    const num = d.deal_number != null ? '#' + d.deal_number : '';
    const addr = d.full_address || d.name || '—';
    const status = d.property_status || '';
    return `
      <div class="border border-gray-200 rounded-lg p-4 ${hidden ? 'opacity-50' : ''}" data-deal-id="${d.id}">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <button type="button" class="btn btn-secondary btn-sm" onclick="moveFeaturedDeal(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-sm">arrow_upward</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="moveFeaturedDeal(${idx}, 1)" ${idx === _publishedDeals.length - 1 ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-sm">arrow_downward</span>
            </button>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm text-primary truncate">${escAttrF(addr)}</div>
              <div class="text-xs text-gray-500 font-inter mt-0.5">
                ${num ? '<span class="ml-2">' + escAttrF(num) + '</span>' : ''}
                ${status ? '<span>' + escAttrF(status) + '</span>' : ''}
              </div>
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer shrink-0">
            <input type="checkbox" class="w-4 h-4 rounded accent-primary" ${hidden ? 'checked' : ''} onchange="toggleHidden(${d.id}, this.checked)">
            <span class="text-xs text-gray-600">הסתר מהאירוע</span>
          </label>
        </div>
        <details class="mt-3">
          <summary class="text-xs font-bold text-gray-500 cursor-pointer hover:text-primary">הגדרות תצוגה מותאמות (אופציונלי)</summary>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label class="form-label text-xs">תווית סטטוס</label>
              <input type="text" class="form-input text-sm" value="${escAttrF(ov.override_status_label || '')}"
                placeholder="למשל: הושלמה" onchange="updateOverride(${d.id}, 'override_status_label', this.value)">
            </div>
            <div>
              <label class="form-label text-xs">גוון (active / marketing / done)</label>
              <input type="text" class="form-input text-sm" value="${escAttrF(ov.override_status_tone || '')}"
                placeholder="active" onchange="updateOverride(${d.id}, 'override_status_tone', this.value)">
            </div>
            <div>
              <label class="form-label text-xs">הערה</label>
              <input type="text" class="form-input text-sm" value="${escAttrF(ov.override_note || '')}"
                placeholder="מכירה צפויה בקרוב" onchange="updateOverride(${d.id}, 'override_note', this.value)">
            </div>
          </div>
        </details>
      </div>
    `;
  }).join('');
}

function toggleHidden(dealId, isHidden) {
  if (!_eventOverrides[dealId]) _eventOverrides[dealId] = { is_hidden: false, sort_order: 0, override_status_label: '', override_status_tone: '', override_note: '' };
  _eventOverrides[dealId].is_hidden = !!isHidden;
  renderPublishedDealsList();
}

function updateOverride(dealId, field, value) {
  if (!_eventOverrides[dealId]) _eventOverrides[dealId] = { is_hidden: false, sort_order: 0, override_status_label: '', override_status_tone: '', override_note: '' };
  _eventOverrides[dealId][field] = value;
}

function moveFeaturedDeal(idx, dir) {
  const tgt = idx + dir;
  if (tgt < 0 || tgt >= _publishedDeals.length) return;
  [_publishedDeals[idx], _publishedDeals[tgt]] = [_publishedDeals[tgt], _publishedDeals[idx]];
  // Write new sort_orders to overrides
  _publishedDeals.forEach((d, i) => {
    if (!_eventOverrides[d.id]) _eventOverrides[d.id] = { is_hidden: false, sort_order: 0, override_status_label: '', override_status_tone: '', override_note: '' };
    _eventOverrides[d.id].sort_order = i;
  });
  renderPublishedDealsList();
}

async function saveFeaturedOverrides() {
  const toUpsert = [];
  for (const d of _publishedDeals) {
    const ov = _eventOverrides[d.id];
    if (!ov) continue;
    const hasData = ov.is_hidden || ov.override_status_label || ov.override_status_tone || ov.override_note || ov.sort_order;
    if (hasData || ov.id) {
      toUpsert.push({ deal_id: d.id, ...ov });
    }
  }

  try {
    for (const row of toUpsert) {
      if (row.id) {
        await API.put(`/events/${currentEvent.id}/featured-deals/${row.id}`, {
          sort_order: row.sort_order,
          is_hidden: row.is_hidden,
          override_status_label: row.override_status_label || null,
          override_status_tone: row.override_status_tone || null,
          override_note: row.override_note || null
        });
      } else {
        await API.post(`/events/${currentEvent.id}/featured-deals`, {
          deal_id: row.deal_id,
          sort_order: row.sort_order,
          is_hidden: row.is_hidden,
          override_status_label: row.override_status_label || null,
          override_status_tone: row.override_status_tone || null,
          override_note: row.override_note || null
        });
      }
    }
    showToast('ההגדרות נשמרו');
  } catch (err) {
    showToast(err.message || 'שגיאה', 'error');
  }
}

function escAttrF(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }

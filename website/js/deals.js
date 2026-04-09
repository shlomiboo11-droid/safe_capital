/**
 * deals.js — Safe Capital website
 * Fetches published deals from the admin API and renders them
 * into the #deals-container on properties.html.
 *
 * RTL: All rendered HTML is already inside dir="rtl" root.
 * All text is right-aligned by default.
 */

const ADMIN_HOST = (window.location.hostname === 'localhost') ? 'http://localhost:3000' : 'https://safe-capital-admin.vercel.app';
const API_URL = ADMIN_HOST + '/api/public/deals';

// ── Status label maps ────────────────────────────────────────────────────────

const PROPERTY_STATUS_LABELS = {
  sourcing:    'בשלב איתור',
  purchased:   'הנכס נקנה',
  planning:    'בתכנון',
  renovation:  'בשיפוץ',
  selling:     'מוצע למכירה',
  sold:        'נמכר'
};

const FUNDRAISING_STATUS_LABELS = {
  upcoming:    'גיוס קרוב',
  active:      'גיוס בעיצומו',
  completed:   'גיוס הושלם',
  closed:      'גיוס סגור'
};

// Timeline step status → icon + style
const TIMELINE_STEP_STYLE = {
  completed: { icon: 'check',       bg: 'bg-primary',   text: 'text-white',   extra: '' },
  active:    { icon: 'engineering', bg: 'bg-secondary',  text: 'text-white',   extra: '' },
  pending:   { icon: '',            bg: 'bg-outline-variant', text: 'text-white', extra: 'opacity-30' }
};

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatUSD(value) {
  if (value == null || value === '') return '—';
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

// ── Timeline renderer ────────────────────────────────────────────────────────

// Map property_status to timeline step index for fallback sync
const STATUS_TO_STEP_INDEX = {
  sourcing: 0,
  purchased: 1,
  planning: 2,
  renovation: 3,
  selling: 4,
  sold: 5
};

function renderTimeline(steps, propertyStatus) {
  if (!steps || steps.length === 0) return '';

  // Sync timeline with property_status if timeline data is stale
  const expectedIndex = STATUS_TO_STEP_INDEX[propertyStatus] || 0;
  steps.forEach((step, i) => {
    if (i < expectedIndex) {
      step.status = 'completed';
    } else if (i === expectedIndex) {
      step.status = 'active';
    } else {
      step.status = 'pending';
    }
  });

  // Calculate progress percentage
  let activeIndex = -1;
  steps.forEach((step, i) => {
    if (step.status === 'completed') activeIndex = i;
    if (step.status === 'active' && activeIndex < i) activeIndex = i;
  });
  const progressPct = steps.length > 1 ? Math.round((activeIndex / (steps.length - 1)) * 100) : 0;

  const stepsHtml = steps.map(step => {
    const style = TIMELINE_STEP_STYLE[step.status] || TIMELINE_STEP_STYLE.pending;
    const iconHtml = style.icon
      ? `<span class="material-symbols-outlined text-sm">${style.icon}</span>`
      : '';
    const labelClass = step.status === 'active'
      ? 'text-xs font-extrabold text-secondary'
      : 'text-xs font-bold';

    return `
      <div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-8 h-8 rounded-full ${style.bg} flex items-center justify-center ${style.text}">
          ${iconHtml}
        </div>
        <p class="${labelClass}">${step.step_name}</p>
      </div>`;
  }).join('');

  return `
    <h3 class="text-2xl font-extrabold text-primary mb-8">לוחות זמנים</h3>
    <div class="relative flex justify-between items-start">
      <div class="absolute top-4 right-0 left-0 h-0.5 bg-outline-variant/20"></div>
      <div class="absolute top-4 right-0 h-0.5 bg-primary" style="width:${progressPct}%"></div>
      ${stepsHtml}
    </div>`;
}

// ── Fundraising progress bar ─────────────────────────────────────────────────

function renderFundraisingBar(deal) {
  const goal = parseFloat(deal.fundraising_goal || 0);
  const raised = parseFloat(deal.fundraising_raised || 0);
  const pct = deal.fundraising_percent || 0;

  if (goal === 0) return '';

  return `
    <div class="bg-surface-container rounded-xl p-8">
      <div class="flex justify-between items-end mb-4">
        <div>
          <p class="text-primary font-bold mb-1">התקדמות גיוס הון</p>
          <p class="text-sm text-on-surface-variant">גויסו ${formatUSD(raised)} מתוך ${formatUSD(goal)}</p>
        </div>
        <p class="text-2xl font-bold font-label text-primary">${pct}%</p>
      </div>
      <div class="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-l from-primary to-primary-container" style="width: ${Math.min(pct, 100)}%"></div>
      </div>
    </div>`;
}

// ── Cost categories accordion ────────────────────────────────────────────────

function renderCostCategories(categories) {
  if (!categories || categories.length === 0) return '';

  const catsHtml = categories.map(cat => {
    const itemsHtml = (cat.items || []).map(item => `
      <div class="flex justify-between py-2 px-8 border-b border-outline-variant/10">
        <span class="text-on-surface-variant text-sm">${item.name}</span>
        <span class="font-label font-medium text-sm">${formatUSD(item.planned_amount)}</span>
      </div>`).join('');

    return `
      <div class="cost-category mb-2">
        <div class="cost-category-header" onclick="toggleCostCategory(this)">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary text-lg cost-category-arrow">expand_more</span>
            <span class="font-bold text-on-surface">${cat.name}</span>
          </div>
          <span class="font-label font-bold text-primary">${formatUSD(cat.total_planned)}</span>
        </div>
        <div class="cost-category-items">
          ${itemsHtml}
        </div>
      </div>`;
  }).join('');

  return catsHtml;
}

// ── Specs table ──────────────────────────────────────────────────────────────

function renderSpecs(specs) {
  if (!specs || specs.length === 0) return '';

  const rowsHtml = specs.map(spec => `
    <tr class="border-b border-outline-variant/10">
      <td class="py-4 font-bold text-primary">${spec.spec_name}</td>
      <td class="py-4">${spec.value_before || '—'}</td>
      <td class="py-4 text-secondary font-bold">${spec.value_after || '—'}</td>
    </tr>`).join('');

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-right">
        <thead>
          <tr class="text-xs text-outline uppercase tracking-wider border-b border-outline-variant/30">
            <th class="pb-4 font-bold">מפרט</th>
            <th class="pb-4 font-bold">לפני</th>
            <th class="pb-4 font-bold">אחרי</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
}

// ── Gallery (before/after images) ───────────────────────────────────────────

function renderGallery(images) {
  if (!images || images.length === 0) return '';

  const renderingImages = images.filter(img => img.category === 'rendering');
  const beforeImages    = images.filter(img => img.category === 'before');
  const afterImages     = images.filter(img => img.category === 'after');

  let html = '';

  // Before/After split view (show first of each)
  if (beforeImages.length > 0 || afterImages.length > 0) {
    const beforeSrc = beforeImages[0]?.image_url || '';
    const afterSrc  = afterImages[0]?.image_url  || '';
    html += `
      <div class="relative group rounded-xl overflow-hidden aspect-video">
        <div class="absolute inset-0 flex">
          ${beforeSrc ? `
          <div class="w-1/2 relative">
            <img class="h-full w-full object-cover" src="${beforeSrc}" alt="לפני שיפוץ"/>
            <span class="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">לפני</span>
          </div>` : ''}
          ${afterSrc ? `
          <div class="${beforeSrc ? 'w-1/2' : 'w-full'} relative ${beforeSrc ? 'border-r-4 border-white' : ''}">
            <img class="h-full w-full object-cover" src="${afterSrc}" alt="אחרי שיפוץ (הדמיה)"/>
            <span class="absolute bottom-4 left-4 bg-primary/80 text-white text-xs px-2 py-1 rounded">אחרי (הדמיה)</span>
          </div>` : ''}
        </div>
      </div>`;
  }

  // Rendering gallery grid
  if (renderingImages.length > 0) {
    const renderingHtml = renderingImages.slice(0, 8).map(img => `
      <img class="rounded-lg aspect-square object-cover" src="${img.image_url}" alt="${img.alt_text || 'הדמיה אדריכלית'}"/>`
    ).join('');

    html += `
      <div>
        <h3 class="text-2xl font-extrabold text-primary mb-6">גלריית הדמיות אדריכליות</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${renderingHtml}
        </div>
      </div>`;
  }

  return html;
}

// ── Full expanded deal content ───────────────────────────────────────────────

function renderExpandedContent(deal) {
  const timelineHtml        = renderTimeline(deal.timeline, deal.property_status);
  const fundraisingBarHtml  = renderFundraisingBar(deal);
  const costCatsHtml        = renderCostCategories(deal.cost_categories);
  const specsHtml           = renderSpecs(deal.specs);
  const galleryHtml         = renderGallery(deal.images);

  const totalCost        = deal.total_cost;
  const expectedProfit   = deal.expected_profit;
  const purchasePrice    = deal.purchase_price;
  const arv              = deal.arv;
  const expectedSalePrice = deal.expected_sale_price;

  const tooltipId = `tooltip-sale-price-${deal.id}`;
  const tooltipHtml = deal.sale_price_tooltip
    ? `<button class="tooltip-trigger" data-tooltip="${tooltipId}" onclick="event.stopPropagation()">?</button>
       <div id="${tooltipId}" class="tooltip-popup hidden">${deal.sale_price_tooltip}</div>`
    : '';

  const descriptionHtml = deal.description
    ? `<p class="text-on-surface-variant leading-relaxed">${deal.description}</p>`
    : '';

  return `
    <!-- Timeline & Fundraising -->
    <div class="space-y-8">
      <div>${timelineHtml}</div>
      ${fundraisingBarHtml}
    </div>

    <!-- Before/After & Key Metrics -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>${galleryHtml}</div>
      <div class="grid grid-cols-2 gap-4">
        ${purchasePrice ? `
        <div class="bg-surface-container-low p-6 rounded-lg">
          <p class="text-xs text-on-surface-variant mb-1 font-bold">רכישה</p>
          <p class="text-2xl font-bold text-primary font-label">${formatUSD(purchasePrice)}</p>
        </div>` : ''}
        ${totalCost ? `
        <div class="bg-surface-container-low p-6 rounded-lg">
          <p class="text-xs text-on-surface-variant mb-1 font-bold">עלות כוללת</p>
          <p class="text-2xl font-bold text-primary font-label">${formatUSD(totalCost)}</p>
        </div>` : ''}
        ${arv ? `
        <div class="bg-surface-container-low p-6 rounded-lg">
          <p class="text-xs text-on-surface-variant mb-1 font-bold">שווי עתידי (ARV)</p>
          <p class="text-2xl font-bold text-secondary font-label">${formatUSD(arv)}</p>
        </div>` : ''}
        ${expectedProfit ? `
        <div class="bg-surface-container-low p-6 rounded-lg">
          <p class="text-xs text-on-surface-variant mb-1 font-bold">רווח צפוי</p>
          <p class="text-2xl font-bold text-secondary font-label">${formatUSD(expectedProfit)}</p>
        </div>` : ''}
        ${deal.project_duration ? `
        <div class="col-span-2 bg-primary text-on-primary p-6 rounded-lg flex justify-between items-center">
          <span class="text-sm font-bold">משך זמן הפרויקט</span>
          <span class="text-xl font-bold font-label">${deal.project_duration}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Deal Plan -->
    ${(descriptionHtml || specsHtml) ? `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-outline-variant/15 pt-12">
      ${descriptionHtml ? `
      <div class="lg:col-span-1">
        <h3 class="text-2xl font-extrabold text-primary mb-4">תכנית העסקה</h3>
        ${descriptionHtml}
      </div>` : ''}
      ${specsHtml ? `
      <div class="${descriptionHtml ? 'lg:col-span-2' : 'lg:col-span-3'}">
        ${specsHtml}
      </div>` : ''}
    </div>` : ''}

    <!-- Financial Breakdown -->
    ${costCatsHtml ? `
    <div class="bg-surface-container-low rounded-xl p-8 md:p-12">
      <div class="flex flex-col md:flex-row-reverse justify-between items-start md:items-center mb-8 gap-4">
        <h3 class="text-2xl font-extrabold text-primary">פירוט פיננסי</h3>
      </div>
      ${costCatsHtml}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 mt-8 border-t border-primary/10 text-center items-center">
        ${totalCost ? `
        <div>
          <p class="text-xs text-on-surface-variant mb-1 font-bold">סך השקעה</p>
          <p class="text-2xl font-bold text-primary font-label">${formatUSD(totalCost)}</p>
        </div>` : ''}
        ${expectedSalePrice ? `
        <div>
          <div class="flex items-center gap-1 mb-1 justify-center">
            <p class="text-xs text-on-surface-variant font-bold">מחיר מכירה צפוי</p>
            ${tooltipHtml}
          </div>
          <p class="text-2xl font-bold text-primary font-label">${formatUSD(expectedSalePrice)}</p>
        </div>` : ''}
        ${expectedProfit ? `
        <div class="bg-secondary/5 p-4 rounded-lg">
          <p class="text-xs text-secondary mb-1 font-extrabold">רווח צפוי</p>
          <p class="text-3xl font-extrabold text-secondary font-label">${formatUSD(expectedProfit)}</p>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Bottom CTA -->
    <div class="pt-12">
      <div class="rounded-xl p-8 md:p-12 text-center" style="background:linear-gradient(135deg,#022445 0%,#1e3a5c 100%)">
        <p class="text-lg text-white/90 leading-relaxed mb-6">
          מעוניינים להשקיע בעסקה הזו? רוצים לדעת מתי כנס המשקיעים הבא?
        </p>
        <a href="https://chat.whatsapp.com/" data-setting-href="whatsapp_group" target="_blank" rel="noopener noreferrer"
           class="inline-block bg-whatsapp text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 active:scale-95 transition-all">
          <span class="flex items-center gap-3 justify-center">
            <span>לחצו כאן כדי להצטרף לקבוצת הווצאפ שלנו</span>
            <span class="material-symbols-outlined" data-weight="fill">chat</span>
          </span>
        </a>
      </div>
    </div>`;
}

// ── Single deal card ─────────────────────────────────────────────────────────

function renderDealCard(deal, index) {
  const isExpandable = deal.is_expandable !== false;
  const propertyLabel   = PROPERTY_STATUS_LABELS[deal.property_status]   || deal.property_status   || '';
  const fundraisingLabel = FUNDRAISING_STATUS_LABELS[deal.fundraising_status] || deal.fundraising_status || '';

  const thumbHtml = deal.thumbnail_url
    ? `<img class="deal-thumb" alt="${deal.name}" src="${deal.thumbnail_url}"/>`
    : '';

  const arrowHtml = isExpandable
    ? `<div class="deal-arrow-wrap">
         <span class="deal-arrow-label">לפירוט מלא</span>
         <span class="deal-arrow material-symbols-outlined text-secondary text-2xl">expand_more</span>
       </div>`
    : '';

  const totalCost    = deal.total_cost;
  const expectedProfit = deal.expected_profit;

  const expandedHtml = isExpandable
    ? `<div class="deal-expanded space-y-16">${renderExpandedContent(deal)}</div>`
    : `<div class="deal-expanded"></div>`;

  // Reduced opacity for non-featured collapsed deals (same as original design)
  const cardClass = deal.is_featured
    ? 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(27,28,26,0.04)] transition-all'
    : 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm opacity-60 hover:opacity-100 transition-opacity';

  // Featured deal has a visible border-b on the header
  const headerBorderClass = deal.is_featured ? 'border-b border-outline-variant/15' : '';

  return `
    <div class="${cardClass}">
      <div class="deal-header p-4 md:p-6 cursor-pointer ${headerBorderClass}">
        <div class="deal-summary-row">
          <span class="deal-num">#${deal.deal_number}</span>
          <span class="deal-name">${deal.name}</span>
          <div class="deal-meta-fields">
            ${propertyLabel   ? `<span class="deal-status-badge property-status">${propertyLabel}</span>`   : ''}
            ${fundraisingLabel ? `<span class="deal-status-badge fundraising-status">${fundraisingLabel}</span>` : ''}
            ${totalCost    ? `<span class="deal-value">${formatUSD(totalCost)}</span>`         : ''}
            ${expectedProfit ? `<span class="deal-profit">${formatUSD(expectedProfit)}</span>` : ''}
          </div>
          ${thumbHtml}
          ${arrowHtml}
        </div>
      </div>
      ${expandedHtml}
    </div>`;
}

// ── State renderers ──────────────────────────────────────────────────────────

function showLoading(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 gap-6" role="status" aria-live="polite">
      <div class="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
      <p class="text-on-surface-variant font-bold">טוען עסקאות...</p>
    </div>`;
}

function showEmpty(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 gap-4 text-center" role="alert">
      <span class="material-symbols-outlined text-5xl text-on-surface-variant/40">apartment</span>
      <p class="text-on-surface-variant font-bold text-lg">אין עסקאות פעילות כרגע</p>
      <p class="text-on-surface-variant text-sm">הצטרפו לקבוצת הוואטסאפ שלנו כדי לקבל עדכון כשעסקה חדשה יוצאת לדרך.</p>
    </div>`;
}

function showError(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 gap-4 text-center" role="alert">
      <span class="material-symbols-outlined text-5xl text-secondary/50">error_outline</span>
      <p class="text-on-surface font-bold text-lg">לא הצלחנו לטעון את העסקאות</p>
      <p class="text-on-surface-variant text-sm">בדקו את החיבור לאינטרנט ורענן את הדף, או <a href="contact.html" class="text-primary font-bold underline">צרו איתנו קשר</a>.</p>
    </div>`;
}

// ── Accordion toggle (attaches to document — works for dynamically added cards) ──

document.addEventListener('click', function (e) {
  const header = e.target.closest('.deal-header');
  if (!header) return;

  const card = header.closest('.bg-surface-container-lowest');
  if (!card) return;

  const expanded = card.querySelector('.deal-expanded');
  if (!expanded) return;

  // Check if this deal is expandable (has content)
  if (!expanded.children.length) return;

  const isOpen = expanded.classList.contains('open');

  // Close all open deals first
  document.querySelectorAll('.deal-expanded.open').forEach(el => {
    el.classList.remove('open');
    const arr = el.closest('.bg-surface-container-lowest')?.querySelector('.deal-arrow');
    if (arr) arr.classList.remove('open');
  });

  // Toggle current if it was closed
  if (!isOpen) {
    expanded.classList.add('open');
    const arrow = card.querySelector('.deal-arrow');
    if (arrow) arrow.classList.add('open');
  }
});

// ── Tooltip toggle ───────────────────────────────────────────────────────────

document.addEventListener('click', function (e) {
  const trigger = e.target.closest('.tooltip-trigger');
  if (trigger) {
    e.stopPropagation();
    const tooltipId = trigger.dataset.tooltip;
    if (!tooltipId) return;
    const tooltip = document.getElementById(tooltipId);
    if (!tooltip) return;
    tooltip.classList.toggle('hidden');
    return;
  }
  // Close any open tooltip when clicking elsewhere
  document.querySelectorAll('.tooltip-popup:not(.hidden)').forEach(t => t.classList.add('hidden'));
});

// ── Main: fetch & render ─────────────────────────────────────────────────────

async function loadDeals() {
  const container = document.getElementById('deals-container');
  if (!container) return;

  showLoading(container);

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const deals = data.deals || [];

    if (deals.length === 0) {
      showEmpty(container);
      return;
    }

    container.innerHTML = deals.map((deal, i) => renderDealCard(deal, i)).join('');

  } catch (err) {
    console.error('Failed to load deals:', err);
    showError(container);
  }
}

// Start loading when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDeals);
} else {
  loadDeals();
}

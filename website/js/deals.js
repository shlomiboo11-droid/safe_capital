/**
 * deals.js — Safe Capital website
 * Fetches published deals from the admin API and renders them
 * into the #deals-container on properties.html.
 *
 * RTL: All rendered HTML is already inside dir="rtl" root.
 * All text is right-aligned by default.
 */

const ADMIN_HOST = (window.location.hostname === 'localhost') ? 'http://localhost:3000' : 'https://admin.safecapital.co.il';
const API_URL = ADMIN_HOST + '/api/public/deals';

function isMobile() { return window.innerWidth < 768; }

const WHATSAPP_SVG = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

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

// Unified 5-stage pipeline — must stay in sync with admin
// (admin/public/js/deal-tabs/timeline.js → TIMELINE_STAGES)
const TIMELINE_STAGES = [
  { label: 'גיוס',   status: 'fundraising' },
  { label: 'רכישה',  status: 'purchased' },
  { label: 'שיפוץ',  status: 'renovation' },
  { label: 'מכירה',  status: 'selling' },
  { label: 'נמכר',   status: 'sold' }
];

// Map legacy statuses to current stages
function getActiveStageIndex(propertyStatus) {
  if (propertyStatus === 'sourcing') return 0;
  if (propertyStatus === 'planning') return 1;
  const idx = TIMELINE_STAGES.findIndex(s => s.status === propertyStatus);
  return idx === -1 ? 0 : idx;
}

function buildStageList(propertyStatus) {
  const activeIdx = getActiveStageIndex(propertyStatus);
  return TIMELINE_STAGES.map((stage, i) => ({
    step_name: stage.label,
    status: i < activeIdx ? 'completed' : i === activeIdx ? 'active' : 'pending'
  }));
}

function renderTimeline(propertyStatus) {
  const steps = buildStageList(propertyStatus);
  const activeIndex = getActiveStageIndex(propertyStatus);
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
    <h3 class="t-h3 font-extrabold text-primary mb-8">לוחות זמנים</h3>
    <div class="relative flex justify-between items-start">
      <div class="absolute top-4 right-0 left-0 h-0.5 bg-outline-variant/20"></div>
      <div class="absolute top-4 right-0 h-0.5 bg-primary" style="width:${progressPct}%"></div>
      ${stepsHtml}
    </div>`;
}

// ── Mobile timeline renderer ─────────────────────────────────────────────────

function renderMobileTimeline(propertyStatus) {
  const steps = buildStageList(propertyStatus);
  const activeIndex = getActiveStageIndex(propertyStatus);
  const progressPct = steps.length > 1 ? Math.round((activeIndex / (steps.length - 1)) * 100) : 0;

  const stepsHtml = steps.map(step => {
    if (step.status === 'completed') {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#022445] text-white flex items-center justify-center">
          <span class="material-symbols-outlined" style="font-size:14px">check</span>
        </div>
        <span class="text-[12px] font-bold">${step.step_name}</span>
      </div>`;
    } else if (step.status === 'active') {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#022445] border-4 border-white shadow-sm flex items-center justify-center"></div>
        <span class="text-[12px] font-bold text-[#022445]">${step.step_name}</span>
      </div>`;
    } else {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#e4e2df] flex items-center justify-center"></div>
        <span class="text-[12px] font-bold text-[#43474e]">${step.step_name}</span>
      </div>`;
    }
  }).join('');

  return `<div class="px-5 py-6">
    <div class="flex items-center justify-between relative">
      <div class="absolute top-3 left-0 right-0 h-0.5 bg-[#e4e2df] z-0"></div>
      <div class="absolute top-3 right-0 h-0.5 bg-[#022445] z-0" style="width:${progressPct}%"></div>
      ${stepsHtml}
    </div>
  </div>`;
}

// ── Mobile fundraising bar ──────────────────────────────────────────────────

function renderMobileFundraisingBar(deal) {
  if (deal.fundraising_status !== 'active') return '';
  const goal = parseFloat(deal.fundraising_goal || 0);
  if (goal === 0) return '';
  const raised = parseFloat(deal.fundraising_raised || 0);
  const pct = deal.fundraising_percent || 0;

  return `<div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
    <h3 class="text-base font-extrabold text-[#022445] mb-2 px-3">התקדמות גיוס</h3>
    <div class="bg-[#f5f3f0] rounded-lg py-3 px-3">
      <div class="flex justify-between items-center" style="margin-bottom:10px">
        <div class="font-bold text-[#984349]" style="font-size:var(--fs-body-xs);font-family:'Inter',sans-serif;line-height:1.2">${pct}%</div>
        <div class="text-[#43474e]" dir="ltr" style="font-size:11px;font-family:'Inter',sans-serif;line-height:1.2">${formatUSD(raised)} / ${formatUSD(goal)}</div>
      </div>
      <div class="bg-[#eae8e5] rounded-full overflow-hidden" style="height:8px">
        <div class="h-full bg-[#984349] rounded-full" style="width:${Math.min(pct, 100)}%"></div>
      </div>
    </div>
  </div>`;
}

// ── Mobile gallery ──────────────────────────────────────────────────────────

function renderMobileGallery(images) {
  if (!images || images.length === 0) return '';

  const beforeImages = images.filter(img => img.category === 'before');
  const afterImages = images.filter(img => img.category === 'after');
  const renderingImages = images.filter(img => img.category === 'rendering');
  const allImages = [...beforeImages, ...afterImages, ...renderingImages];

  let html = '<div class="px-5 mb-6">';

  // Before/After main image
  if (beforeImages.length > 0 || afterImages.length > 0) {
    const beforeSrc = beforeImages[0]?.image_url || '';
    const afterSrc = afterImages[0]?.image_url || '';
    html += `<div class="relative h-48 w-full rounded-lg overflow-hidden mb-2">`;
    if (afterSrc) {
      html += `<img class="w-full h-full object-cover" src="${ADMIN_HOST + afterSrc}" alt="לפני ואחרי" loading="lazy"/>`;
    } else if (beforeSrc) {
      html += `<img class="w-full h-full object-cover" src="${ADMIN_HOST + beforeSrc}" alt="לפני ואחרי" loading="lazy"/>`;
    }
    html += `<div class="absolute inset-0 flex">`;
    if (beforeSrc) {
      html += `<div class="flex-1 border-l border-white/50 flex items-center justify-center">
        <span class="bg-black/40 text-white text-[12px] px-2 py-1 rounded-sm backdrop-blur-md">לפני</span>
      </div>`;
    }
    if (afterSrc) {
      html += `<div class="flex-1 flex items-center justify-center">
        <span class="bg-black/40 text-white text-[12px] px-2 py-1 rounded-sm backdrop-blur-md">אחרי</span>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Thumbnail grid (4 cols)
  if (allImages.length > 1) {
    const thumbs = allImages.slice(1, 4);
    const remaining = allImages.length - 4;
    html += '<div class="grid grid-cols-4 gap-2">';
    thumbs.forEach(img => {
      html += `<img class="h-16 w-full object-cover rounded-md" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || ''}" loading="lazy"/>`;
    });
    if (remaining > 0 && allImages[4]) {
      html += `<div class="relative h-16 w-full rounded-md overflow-hidden">
        <img class="w-full h-full object-cover" src="${ADMIN_HOST + allImages[4].image_url}" alt="" loading="lazy"/>
        <div class="absolute inset-0 bg-[#022445]/60 flex items-center justify-center text-white text-xs font-bold">+${remaining}</div>
      </div>`;
    } else if (allImages[4]) {
      html += `<img class="h-16 w-full object-cover rounded-md" src="${ADMIN_HOST + allImages[4].image_url}" alt="" loading="lazy"/>`;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ── Mobile metrics grid ─────────────────────────────────────────────────────

function renderMobileMetrics(deal) {
  const sale = deal.expected_sale_price;
  const cost = deal.total_cost;
  const goal = deal.fundraising_goal;
  if (!sale && !cost && !goal) return '';

  const heroHtml = sale ? `
    <div class="py-2.5 px-3 text-center${(cost || goal) ? ' border-b border-[#eae8e5]' : ''}">
      <div class="text-[#43474e] font-medium" style="font-size:var(--fs-label);line-height:1.2;margin-bottom:3px">מחיר מכירה צפוי</div>
      <div class="font-bold text-[#984349]" style="font-size:var(--fs-body-lg);font-family:'Inter',sans-serif;line-height:1.2">${formatUSD(sale)}</div>
    </div>` : '';

  const bottomCells = [];
  if (cost) bottomCells.push({ label: 'עלות פרויקט כוללת', value: formatUSD(cost) });
  if (goal) bottomCells.push({ label: 'סכום לגיוס',         value: formatUSD(goal) });

  const bottomHtml = bottomCells.length === 0 ? '' : `
    <div class="grid grid-cols-${bottomCells.length}">
      ${bottomCells.map((c, i) => `
        <div class="py-2 px-2 text-center${i > 0 ? ' border-r border-[#eae8e5]' : ''}">
          <div class="text-[#43474e] font-medium" style="font-size:var(--fs-label);line-height:1.2;margin-bottom:3px">${c.label}</div>
          <div class="font-bold text-[#022445]" style="font-size:var(--fs-body-xs);font-family:'Inter',sans-serif;line-height:1.2">${c.value}</div>
        </div>`).join('')}
    </div>`;

  return `<div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
    <div class="bg-[#f5f3f0] rounded-lg overflow-hidden">${heroHtml}${bottomHtml}</div>
  </div>`;
}

// ── Mobile specs table ──────────────────────────────────────────────────────

function renderMobileSpecs(specs) {
  if (!specs || specs.length === 0) return '';

  const rowsHtml = specs.map(spec => `
    <tr>
      <td class="py-2 px-3 text-right">${spec.spec_name}</td>
      <td class="py-2 px-2 text-center font-label">${spec.value_before || '—'}</td>
      <td class="py-2 px-2 text-center font-label font-bold text-[#984349]">${spec.value_after || '—'}</td>
    </tr>`).join('');

  return `<div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
    <h3 class="text-base font-extrabold text-[#022445] mb-2 px-3">תכנית ההשבחה</h3>
    <div class="bg-[#f5f3f0] overflow-hidden rounded-lg">
      <table class="w-full text-sm" style="table-layout:fixed">
        <thead class="bg-[#eae8e5]">
          <tr>
            <th class="py-2 px-3 text-right font-bold" style="width:50%">מפרט</th>
            <th class="py-2 px-2 text-center font-bold" style="width:25%">לפני</th>
            <th class="py-2 px-2 text-center font-bold text-[#984349]" style="width:25%">אחרי</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#eae8e5]">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Mobile cost accordion ───────────────────────────────────────────────────

function renderMobileCostAccordion(categories) {
  if (!categories || categories.length === 0) return '';

  // Filter items with planned_amount > 0, then drop categories with no items / zero total.
  const filteredCats = (categories || [])
    .map(cat => {
      const items = (cat.items || []).filter(i => parseFloat(i.planned_amount || 0) > 0);
      return { ...cat, items };
    })
    .filter(cat => cat.items.length > 0 && parseFloat(cat.total_planned || 0) > 0);

  if (filteredCats.length === 0) return '';

  const rows = filteredCats.map(cat => `
    <div>
      <div class="bg-[#eae8e5] flex justify-between items-center cursor-pointer cost-category-header-mobile py-2 px-3" onclick="toggleMobileCostCategory(this)">
        <div class="font-bold text-[#022445]" style="font-size:var(--fs-body-xs)">${cat.name}</div>
        <div class="flex items-center" style="gap:8px">
          <div class="font-bold text-[#022445]" style="font-size:var(--fs-body-xs);font-family:'Inter',sans-serif">${formatUSD(cat.total_planned)}</div>
          <span class="material-symbols-outlined mobile-cost-arrow" style="font-size:18px;color:#43474e;font-variation-settings:'wght' 400">expand_more</span>
        </div>
      </div>
      <div class="mobile-cost-items bg-[#f5f3f0]" style="max-height:0;overflow:hidden;transition:max-height 0.3s ease">
        ${cat.items.map(item => `
          <div class="flex justify-between items-center py-2 px-3 border-t border-[#eae8e5]">
            <div class="text-[#43474e]" style="font-size:var(--fs-body-xs)">${item.name}</div>
            <div class="flex items-center" style="gap:8px">
              <div class="text-[#43474e]" style="font-size:var(--fs-body-xs);font-family:'Inter',sans-serif">${formatUSD(item.planned_amount)}</div>
              <span aria-hidden="true" style="display:inline-block;width:18px;height:18px;flex-shrink:0"></span>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
      <h3 class="text-base font-bold text-[#022445] mb-3 px-3">פירוט עלויות</h3>
      <div class="rounded-lg overflow-hidden divide-y divide-[#eae8e5]">${rows}</div>
    </div>`;
}

// ── Mobile WhatsApp CTA ─────────────────────────────────────────────────────

function renderMobileWhatsAppCTA() {
  return '';
}

// ── Mobile expanded content ─────────────────────────────────────────────────

function renderMobileExpandedContent(deal) {
  const sectionIds = getExpandedConfig(deal);
  return sectionIds
    .map(id => (SECTION_RENDERERS_MOBILE[id] ? SECTION_RENDERERS_MOBILE[id](deal) : ''))
    .filter(Boolean)
    .join('');
}

// ── Card v2 helpers (shared between desktop + mobile) ───────────────────────

function colorClass(name) {
  // Maps semantic color name → .deal-number--* modifier class
  const map = {
    'navy': 'deal-number--navy',
    'crimson': 'deal-number--crimson',
    'crimson-soft': 'deal-number--crimson-soft',
    'navy-soft': 'deal-number--navy-soft'
  };
  return map[name] || 'deal-number--navy';
}

function renderBadge(badgeConfig, deal) {
  const text = typeof badgeConfig.text === 'function' ? badgeConfig.text(deal) : (badgeConfig.text || '');

  let iconHtml = '';
  if (badgeConfig.dotPulse) {
    iconHtml = '<span class="deal-badge__dot" aria-hidden="true"></span>';
  } else if (badgeConfig.arrow) {
    iconHtml = '<span class="material-symbols-outlined" style="font-size:14px" aria-hidden="true">arrow_back</span>';
  } else if (badgeConfig.check) {
    iconHtml = '<span class="material-symbols-outlined" style="font-size:14px" aria-hidden="true">check</span>';
  } else if (badgeConfig.doubleCheck) {
    iconHtml = '<span class="material-symbols-outlined" style="font-size:14px" aria-hidden="true">done_all</span>';
  }

  return `<span class="deal-badge deal-badge--${badgeConfig.style}">${iconHtml}${text}</span>`;
}

function renderFundraisingSecondaryBadge(deal) {
  const displayStatus = getDisplayStatus(deal);
  if (displayStatus === 'active') return '';
  if (deal.fundraising_status !== 'active') return '';
  return `<span class="deal-badge deal-badge--filled-crimson">
    <span class="deal-badge__dot" aria-hidden="true"></span>גיוס משקיעים פתוח
  </span>`;
}

function renderProgress(progressConfig, deal, opts) {
  if (!progressConfig) return '';
  const isMobileView = !!(opts && opts.mobile);

  // Helper to pull string from config field that may be fn or literal
  const cfgText = (key) => typeof progressConfig[key] === 'function' ? progressConfig[key](deal) : (progressConfig[key] || '');

  if (progressConfig.type === 'fundraising') {
    const pct = typeof progressConfig.percent === 'function' ? progressConfig.percent(deal) : 0;
    const clamped = Math.min(Math.max(Number(pct) || 0, 0), 100);
    const remaining = cfgText('remaining');
    const bottom = cfgText('bottom');
    const legacyText = cfgText('text');

    if (isMobileView) {
      // percent LEFT + "X$ remaining" RIGHT (above bar) + bottom text centered BELOW
      return `
        <div class="w-full">
          <div class="flex items-baseline justify-between mb-2">
            <span class="deal-number deal-number--regular deal-number--crimson">${clamped}%</span>
            <span class="deal-progress-text">${remaining}</span>
          </div>
          <div class="deal-progress-track">
            <div class="deal-progress-fill--crimson" style="width:${clamped}%"></div>
          </div>
          <div class="deal-progress-text text-center mt-2">${bottom}</div>
        </div>`;
    }

    return `
      <div class="w-full">
        <div class="deal-progress-track">
          <div class="deal-progress-fill--crimson" style="width:${clamped}%"></div>
        </div>
        <div class="deal-progress-text">${legacyText || bottom || remaining}</div>
      </div>`;
  }

  if (progressConfig.type === 'timeline') {
    const bottom = cfgText('bottom');
    return renderCollapsedTimeline(deal.property_status, bottom, isMobileView);
  }

  if (progressConfig.type === 'investors-enjoyed') {
    const bottom = cfgText('bottom');
    return `<div class="deal-progress-text text-center">${bottom}</div>`;
  }

  // Legacy types (kept for backwards compat, currently unused)
  if (progressConfig.type === 'social' || progressConfig.type === 'success-note' || progressConfig.type === 'renovation') {
    const text = cfgText('text');
    return `<div class="deal-progress-text text-center">${text}</div>`;
  }

  return '';
}

// Compact horizontal timeline for collapsed renovation card
// Driven by property_status using the unified TIMELINE_STAGES (synced with admin dashboard)
function renderCollapsedTimeline(propertyStatus, bottomText, isMobileView) {
  const steps = buildStageList(propertyStatus);
  const dotColor = (s) => s === 'completed' ? '#984349' : (s === 'active' ? '#984349' : '#c4c6cf');
  const dotFill  = (s) => s === 'pending' ? 'transparent' : dotColor(s);
  const labelColor = (s) => s === 'pending' ? '#43474e' : '#022445';
  const fontWeight = (s) => s === 'active' ? 700 : 500;

  const dots = steps.map(step => {
    const color = dotColor(step.status);
    const fill = dotFill(step.status);
    return `
      <div class="flex flex-col items-center gap-1" style="flex:1;min-width:0">
        <div style="width:10px;height:10px;border-radius:9999px;border:2px solid ${color};background:${fill}"></div>
        <span class="deal-progress-text" style="color:${labelColor(step.status)};font-weight:${fontWeight(step.status)};font-size:var(--fs-label);text-align:center;white-space:nowrap">${step.step_name}</span>
      </div>`;
  }).join('');

  // Connector line behind the dots (crimson up to active step)
  const activeIdx = steps.findIndex(s => s.status === 'active');
  const doneCount = steps.filter(s => s.status === 'completed').length;
  const segments = Math.max(steps.length - 1, 1);
  const progressPct = Math.min(100, Math.round(((activeIdx >= 0 ? activeIdx : doneCount) / segments) * 100));

  return `
    <div class="w-full">
      <div class="relative" style="padding-top:4px">
        <div class="absolute" style="top:9px;left:8%;right:8%;height:2px;background:#e4e2df"></div>
        <div class="absolute" style="top:9px;right:8%;width:${progressPct * 0.84}%;height:2px;background:#984349"></div>
        <div class="relative flex justify-between" style="gap:4px">${dots}</div>
      </div>
      <div class="deal-progress-text text-center mt-3">${bottomText}</div>
    </div>`;
}

function renderCTA(ctaConfig, isExpandable) {
  if (!ctaConfig) return '';
  const arrowIcon = ctaConfig.style === 'text-only'
    ? '<span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">arrow_back</span>'
    : '';
  const isToggle = isExpandable && ctaConfig.expandedText;
  const toggleCls = isToggle ? ' deal-toggle-btn' : '';
  const dataAttrs = isToggle
    ? ` data-text-collapsed="${ctaConfig.text}" data-text-expanded="${ctaConfig.expandedText}"`
    : '';
  return `
    <button type="button" class="deal-cta deal-cta--${ctaConfig.style}${toggleCls}"${dataAttrs}>
      ${ctaConfig.text}
      ${arrowIcon}
    </button>`;
}

function renderNumbersRow(numbers, deal, opts) {
  const isMobileView = !!(opts && opts.mobile);
  const cells = numbers.map((num, i) => {
    const value = typeof num.value === 'function' ? num.value(deal) : num.value;
    const sizeClass = num.hero ? 'deal-number--hero' : 'deal-number--regular';
    const colorCls = colorClass(num.color);
    const cellAlign = isMobileView ? 'items-center text-center' : 'min-w-0';
    // Mobile: vertical dividers between cells (skip first — RTL puts it rightmost)
    const dividerCls = (isMobileView && i > 0) ? 'deal-numbers-divider' : '';
    return `
      <div class="flex flex-col ${cellAlign} ${dividerCls}">
        <span class="deal-number-label">${num.label}</span>
        <span class="deal-number ${sizeClass} ${colorCls}">${value}</span>
      </div>`;
  }).join('');

  if (isMobileView) {
    return `
      <div class="grid grid-cols-3 gap-2 py-0.5 px-2 rounded-lg deal-numbers-mobile-grid bg-[#f5f3f0]">
        ${cells}
      </div>`;
  }

  return `<div class="deal-numbers-row">${cells}</div>`;
}

function locationSubtitle(deal) {
  const parts = [];
  if (deal.city) parts.push(deal.city);
  if (deal.state) parts.push(deal.state);
  const loc = parts.join(', ');
  const num = deal.deal_number ? `#${deal.deal_number}` : '';
  if (loc && num) return `${loc} · ${num}`;
  return loc || num;
}

// ── Mobile deal card ────────────────────────────────────────────────────────

function renderMobileDealCard(deal, index) {
  const isExpandable = deal.is_expandable !== false;
  const status = getDisplayStatus(deal);
  const config = DEAL_DISPLAY_CONFIG[status];

  const thumbSrc = deal.thumbnail_url ? (ADMIN_HOST + deal.thumbnail_url) : '';

  const badgeHtml    = renderBadge(config.badge, deal);
  const secondaryBadgeHtml = renderFundraisingSecondaryBadge(deal);
  const numbersHtml  = renderNumbersRow(config.numbers, deal, { mobile: true });
  const progressHtml = renderProgress(config.progress, deal, { mobile: true });
  const ctaHtml      = renderCTA(config.cta, isExpandable);

  // Mobile: deal# shown as white ribbon (original style)
  const dealNumRibbon = deal.deal_number
    ? `<span class="deal-number-ribbon">#${deal.deal_number}</span>`
    : '';

  const expandedHtml = isExpandable
    ? `<div class="deal-expanded mobile-deal-expanded bg-white">${renderMobileExpandedContent(deal)}</div>`
    : '';

  const accentStripHtml = config.accentStrip
    ? '<div class="deal-accent-strip"></div>'
    : '';

  const imageHtml = thumbSrc
    ? `<img alt="${deal.name}" class="w-full h-full object-cover rounded-2xl" style="height:220px" src="${thumbSrc}" loading="lazy"/>`
    : `<div class="w-full bg-[#f5f3f0] rounded-2xl" style="height:220px"></div>`;

  return `
    <article class="deal-card-v2 bg-white rounded-2xl overflow-hidden shadow-[0px_8px_24px_rgba(2,36,69,0.04)]">
      ${accentStripHtml}
      <div class="deal-header cursor-pointer">
        <div class="p-3 relative">
          ${imageHtml}
          <div class="absolute top-6 right-6 flex flex-col gap-2 items-start">${badgeHtml}${secondaryBadgeHtml}</div>
          <div class="absolute top-6 left-6">${dealNumRibbon}</div>
        </div>
        <div class="px-4 pb-4 flex flex-col gap-4">
          <div class="text-right" dir="rtl">
            <h3 class="deal-card-title" style="text-align:right">${deal.name || ''}</h3>
          </div>
          ${numbersHtml}
          ${progressHtml ? `<div class="w-full">${progressHtml}</div>` : ''}
        </div>
      </div>
      ${expandedHtml}
      <div class="px-4 pb-4 pt-0 w-full">
        ${ctaHtml}
      </div>
    </article>`;
}

// ── Fundraising progress bar ─────────────────────────────────────────────────

function renderFundraisingBar(deal) {
  if (deal.fundraising_status !== 'active') return '';
  const goal = parseFloat(deal.fundraising_goal || 0);
  if (goal === 0) return '';
  const raised = parseFloat(deal.fundraising_raised || 0);
  const pct = deal.fundraising_percent || 0;

  return `
    <div class="bg-[#f5f3f0] rounded-2xl p-8">
      <div class="flex justify-between items-center mb-6">
        <div class="t-h4 font-bold text-[#022445]">התקדמות גיוס הון</div>
        <div class="t-body-sm text-[#43474e]" dir="ltr" style="font-family:'Inter',sans-serif">${formatUSD(raised)} / ${formatUSD(goal)}</div>
      </div>
      <div class="flex items-center" style="gap:20px">
        <div class="font-bold text-[#984349]" style="font-size:var(--fs-metric-xl);font-family:'Inter',sans-serif;line-height:1;min-width:90px">${pct}%</div>
        <div class="flex-1 bg-[#e4e2df] rounded-full overflow-hidden" style="height:12px">
          <div class="h-full bg-[#984349] rounded-full" style="width:${Math.min(pct, 100)}%"></div>
        </div>
      </div>
    </div>`;
}

// ── Cost categories accordion ────────────────────────────────────────────────

function renderCostCategories(categories) {
  if (!categories || categories.length === 0) return '';

  // Filter items with planned_amount > 0, then skip categories with no items / zero total.
  const filteredCats = (categories || [])
    .map(cat => {
      const items = (cat.items || []).filter(i => parseFloat(i.planned_amount || 0) > 0);
      return { ...cat, items };
    })
    .filter(cat => cat.items.length > 0 && parseFloat(cat.total_planned || 0) > 0);

  if (filteredCats.length === 0) return '';

  const catsHtml = filteredCats.map(cat => {
    const itemsHtml = cat.items.map(item => `
      <div class="flex justify-between py-2 px-8 border-b border-outline-variant/10">
        <span class="t-body-xs text-on-surface-variant">${item.name}</span>
        <span class="t-body-xs font-label font-medium">${formatUSD(item.planned_amount)}</span>
      </div>`).join('');

    return `
      <div class="cost-category mb-2">
        <div class="cost-category-header" onclick="toggleCostCategory(this)">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary cost-category-arrow" style="font-size:1.25rem">expand_more</span>
            <span class="t-body font-bold text-on-surface">${cat.name}</span>
          </div>
          <span class="t-body font-label font-bold text-primary">${formatUSD(cat.total_planned)}</span>
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
          <tr class="t-label text-on-surface-variant border-b border-outline-variant/30">
            <th class="pb-4 font-bold">מפרט</th>
            <th class="pb-4 font-bold">לפני</th>
            <th class="pb-4 font-bold">אחרי</th>
          </tr>
        </thead>
        <tbody class="t-body-xs">
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
}

// ── Gallery (before/after images) ───────────────────────────────────────────

// Mode:
//   'before-after' (default) — split view before+after + renderings grid
//   'during'                 — during-construction grid + renderings (no before)
//   'after-only'             — only after photos (the showcase, for selling)
function renderGallery(images, mode = 'before-after') {
  if (!images || images.length === 0) return '';

  const renderingImages = images.filter(img => img.category === 'rendering');
  const beforeImages    = images.filter(img => img.category === 'before');
  const afterImages     = images.filter(img => img.category === 'after');
  const duringImages    = images.filter(img => img.category === 'during');

  let html = '';

  if (mode === 'after-only') {
    if (afterImages.length === 0) return '';
    const grid = afterImages.slice(0, 8).map(img => `
      <img class="rounded-lg aspect-square object-cover" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || 'תמונה'}" loading="lazy"/>`
    ).join('');
    return `
      <div>
        <h3 class="text-2xl font-extrabold text-primary mb-6">הנכס המוכן למכירה</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${grid}
        </div>
      </div>`;
  }

  if (mode === 'during') {
    if (duringImages.length === 0 && renderingImages.length === 0) return '';
    if (duringImages.length > 0) {
      const grid = duringImages.slice(0, 8).map(img => `
        <img class="rounded-lg aspect-square object-cover" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || 'תמונה מהשטח'}" loading="lazy"/>`
      ).join('');
      html += `
        <div class="mb-8">
          <h3 class="text-2xl font-extrabold text-primary mb-6">תמונות מהשטח</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${grid}
          </div>
        </div>`;
    }
    if (renderingImages.length > 0) {
      const grid = renderingImages.slice(0, 8).map(img => `
        <img class="rounded-lg aspect-square object-cover" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || 'הדמיה אדריכלית'}" loading="lazy"/>`
      ).join('');
      html += `
        <div>
          <h3 class="text-2xl font-extrabold text-primary mb-6">הדמיות אדריכליות (אחרי)</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${grid}
          </div>
        </div>`;
    }
    return html;
  }

  // Default: before-after split view + renderings grid
  if (beforeImages.length > 0 || afterImages.length > 0) {
    const beforeSrc = beforeImages[0]?.image_url || '';
    const afterSrc  = afterImages[0]?.image_url  || '';
    html += `
      <div class="relative group rounded-xl overflow-hidden aspect-video">
        <div class="absolute inset-0 flex">
          ${beforeSrc ? `
          <div class="w-1/2 relative">
            <img class="h-full w-full object-cover" src="${ADMIN_HOST + beforeSrc}" alt="לפני שיפוץ" loading="lazy"/>
            <span class="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">לפני</span>
          </div>` : ''}
          ${afterSrc ? `
          <div class="${beforeSrc ? 'w-1/2' : 'w-full'} relative ${beforeSrc ? 'border-r-4 border-white' : ''}">
            <img class="h-full w-full object-cover" src="${ADMIN_HOST + afterSrc}" alt="אחרי שיפוץ" loading="lazy"/>
            <span class="absolute bottom-4 left-4 bg-primary/80 text-white text-xs px-2 py-1 rounded">אחרי</span>
          </div>` : ''}
        </div>
      </div>`;
  }

  if (renderingImages.length > 0) {
    const renderingHtml = renderingImages.slice(0, 8).map(img => `
      <img class="rounded-lg aspect-square object-cover" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || 'הדמיה אדריכלית'}" loading="lazy"/>`
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

// ── Per-status section renderers (desktop) ──────────────────────────────────

function renderKeyMetricsSection(deal) {
  const fundraisingGoal   = deal.fundraising_goal;
  const expectedSalePrice = deal.expected_sale_price;
  const expectedProfit    = deal.expected_profit;
  const tooltipId         = `tooltip-sale-price-km-${deal.id}`;
  const tooltipHtml = deal.sale_price_tooltip
    ? `<button class="tooltip-trigger" data-tooltip="${tooltipId}" onclick="event.stopPropagation()">?</button>
       <div id="${tooltipId}" class="tooltip-popup hidden">${deal.sale_price_tooltip}</div>`
    : '';

  if (!expectedSalePrice && !expectedProfit && !fundraisingGoal) return '';

  const heroCell = expectedSalePrice ? `
    <div class="deal-metric-hero md:col-span-2 bg-surface-container-low rounded-2xl p-8 flex flex-col justify-center">
      <div class="flex items-center gap-1 mb-2">
        <p class="t-label font-bold text-on-surface-variant" style="letter-spacing:0.03em">מחיר מכירה צפוי</p>
        ${tooltipHtml}
      </div>
      <p class="t-metric-xl font-extrabold text-secondary font-label">${formatUSD(expectedSalePrice)}</p>
    </div>` : '';

  const sideCells = [
    expectedProfit && `
      <div class="bg-surface-container-low rounded-2xl p-6 flex flex-col justify-center">
        <p class="t-label font-bold text-on-surface-variant mb-2" style="letter-spacing:0.03em">רווח צפוי</p>
        <p class="t-metric font-bold text-primary font-label">${formatUSD(expectedProfit)}</p>
      </div>`,
    fundraisingGoal && `
      <div class="bg-surface-container-low rounded-2xl p-6 flex flex-col justify-center">
        <p class="t-label font-bold text-on-surface-variant mb-2" style="letter-spacing:0.03em">סכום לגיוס</p>
        <p class="t-metric font-bold text-primary font-label">${formatUSD(fundraisingGoal)}</p>
      </div>`
  ].filter(Boolean).join('');

  return `
    <div class="deal-section deal-section--metrics">
      <h3 class="t-h3 font-extrabold text-primary mb-6">נתונים כלליים</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${heroCell}
        <div class="flex flex-col gap-4">
          ${sideCells}
        </div>
      </div>
    </div>`;
}

function renderDescriptionSection(deal) {
  if (!deal.description) return '';
  return `
    <div class="deal-section deal-section--description">
      <h3 class="t-h3 font-extrabold text-primary mb-4">תכנית העסקה</h3>
      <p class="t-body text-on-surface-variant leading-relaxed" style="max-width:65ch">${deal.description}</p>
    </div>`;
}

function renderTimelineSection(deal) {
  const html = renderTimeline(deal.property_status);
  return html ? `<div>${html}</div>` : '';
}

function renderFundraisingBarSection(deal) {
  return renderFundraisingBar(deal);
}

function renderSpecsSection(deal) {
  const html = renderSpecs(deal.specs);
  if (!html) return '';
  return `
    <div class="deal-section deal-section--specs">
      <h3 class="t-h3 font-extrabold text-primary mb-6">מפרט הנכס</h3>
      ${html}
    </div>`;
}

function renderCostBreakdownSection(deal) {
  const catsHtml = renderCostCategories(deal.cost_categories);
  if (!catsHtml) return '';

  const totalCost = deal.total_cost;

  return `
    <div class="deal-section deal-section--cost-breakdown bg-surface-container-low rounded-2xl p-8 md:p-12">
      <div class="flex flex-col md:flex-row-reverse justify-between items-start md:items-center mb-8 gap-4">
        <h3 class="t-h2 font-extrabold text-primary">פירוט עלויות</h3>
      </div>
      ${catsHtml}
      ${totalCost ? `
      <div class="flex justify-between items-baseline pt-6 mt-6 border-t-2 border-primary/20">
        <span class="t-body font-bold text-on-surface">סך עלות פרויקט</span>
        <span class="t-metric font-extrabold text-primary font-label">${formatUSD(totalCost)}</span>
      </div>` : ''}
    </div>`;
}

function renderWhatsAppCTASection() {
  return `
    <div class="deal-section deal-section--cta">
      <div class="rounded-2xl p-8 md:p-12 text-center" style="background:#022445">
        <p class="t-body-lg text-white/90 leading-relaxed mb-6">
          מעוניינים להשקיע בעסקה הזו? רוצים לדעת מתי כנס המשקיעים הבא?
        </p>
        <a href="https://chat.whatsapp.com/" data-setting-href="whatsapp_group" target="_blank" rel="noopener noreferrer"
           class="inline-block bg-whatsapp text-white px-8 py-4 rounded-2xl font-bold t-body-lg hover:opacity-90 active:scale-95 transition-all">
          <span class="flex items-center gap-3 justify-center">
            <span>לחצו כאן כדי להצטרף לקבוצת הווצאפ שלנו</span>
            <span class="material-symbols-outlined" data-weight="fill">chat</span>
          </span>
        </a>
      </div>
    </div>`;
}

// ── New per-status section renderers (desktop) ──────────────────────────────

function renderRenovationProgress(deal) {
  // Prefer explicit field; fall back to timeline-derived percent.
  let pct = deal.renovation_progress_percent;
  if (pct == null) {
    const steps = Array.isArray(deal.timeline) ? deal.timeline : [];
    const renoIdx = steps.findIndex(s => /שיפוץ|renovation/i.test(s.step_name || ''));
    if (renoIdx >= 0 && steps.length > 1) {
      // Status assumed to have been synced upstream
      const completedBefore = steps.slice(0, renoIdx).filter(s => s.status === 'completed').length;
      const isActive = steps[renoIdx].status === 'active';
      pct = Math.round(((completedBefore + (isActive ? 0.5 : steps[renoIdx].status === 'completed' ? 1 : 0)) / steps.length) * 100);
    }
  }
  if (pct == null) pct = 0;
  const clamped = Math.min(Math.max(Number(pct) || 0, 0), 100);

  return `
    <div class="deal-section deal-section--renovation-progress rounded-2xl p-8 md:p-12 text-white" style="background:#022445">
      <div class="flex items-baseline justify-between mb-6">
        <h3 class="t-h3 font-extrabold">התקדמות השיפוץ</h3>
        <span class="t-display font-label font-extrabold" style="line-height:1">${clamped}%</span>
      </div>
      <div class="w-full h-3 bg-white/15 rounded-full overflow-hidden">
        <div class="h-full bg-secondary rounded-full" style="width:${clamped}%"></div>
      </div>
      ${deal.project_duration ? `
        <p class="mt-4 t-body-sm text-white/80">משך פרויקט מתוכנן: <strong>${deal.project_duration}</strong></p>` : ''}
    </div>`;
}

function renderPlanVsActual(deal) {
  const fmtMoney = (n) => (n == null || n === '') ? '—' : formatUSD(n);
  const fmtPct = (n) => (n == null || n === '') ? '—' : Number(n).toFixed(1) + '%';

  const rows = [
    {
      label: 'עלות פרויקט כוללת',
      planned: fmtMoney(deal.total_cost),
      actual:  fmtMoney(deal.total_actual_cost),
      key: 'total_cost', isHigherBetter: false,
      pNum: deal.total_cost, aNum: deal.total_actual_cost
    },
    {
      label: 'משך הפרויקט',
      planned: deal.project_duration || '—',
      actual:  deal.actual_duration_months ? deal.actual_duration_months + ' חודשים' : '—',
      key: 'duration', isHigherBetter: false,
      pNum: parseFloat(String(deal.project_duration || '').match(/\d+/)?.[0]),
      aNum: deal.actual_duration_months
    },
    {
      label: 'מחיר מכירה',
      planned: fmtMoney(deal.expected_sale_price),
      actual:  fmtMoney(deal.actual_sale_price),
      key: 'sale_price', isHigherBetter: true,
      pNum: deal.expected_sale_price, aNum: deal.actual_sale_price
    },
    {
      label: 'תשואה למשקיע',
      planned: fmtPct(deal.expected_roi_percent),
      actual:  fmtPct(deal.actual_roi_percent),
      key: 'roi', isHigherBetter: true,
      pNum: deal.expected_roi_percent, aNum: deal.actual_roi_percent
    }
  ];

  const colorFor = (row) => {
    if (row.aNum == null || row.pNum == null || row.aNum === '' || row.pNum === '') return 'text-primary';
    const a = Number(row.aNum), p = Number(row.pNum);
    if (isNaN(a) || isNaN(p)) return 'text-primary';
    const better = row.isHigherBetter ? a >= p : a <= p;
    return better ? 'text-secondary' : 'text-on-surface-variant';
  };

  const rowsHtml = rows.map(row => `
    <tr class="border-b border-outline-variant/10">
      <td class="py-4 font-bold text-primary">${row.label}</td>
      <td class="py-4 text-on-surface-variant text-center">${row.planned}</td>
      <td class="py-4 font-extrabold text-center font-label ${colorFor(row)}">${row.actual}</td>
    </tr>`).join('');

  return `
    <div class="deal-section deal-section--plan-vs-actual bg-surface-container-low rounded-2xl p-8 md:p-12">
      <h3 class="t-h2 font-extrabold text-primary mb-2">התוצאה: תוכנית מול מציאות</h3>
      <p class="t-body-sm text-on-surface-variant mb-8">השוואה מלאה בין מה שתכננו למה שקרה בפועל</p>
      <div class="overflow-x-auto">
        <table class="w-full text-right">
          <thead>
            <tr class="t-label text-on-surface-variant border-b border-outline-variant/30">
              <th class="pb-4 font-bold">פרמטר</th>
              <th class="pb-4 font-bold text-center">מתוכנן</th>
              <th class="pb-4 font-bold text-center">בפועל</th>
            </tr>
          </thead>
          <tbody class="t-body-xs">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderPostSaleSummary(deal) {
  if (!deal.sale_completion_note) return '';
  return `
    <div class="deal-section deal-section--post-sale bg-surface-container-low rounded-2xl p-8 md:p-10">
      <h3 class="t-h4 font-extrabold text-primary mb-3">סיכום העסקה</h3>
      <p class="t-body text-on-surface-variant leading-relaxed" style="max-width:65ch">${deal.sale_completion_note}</p>
    </div>`;
}

function renderComps(deal) {
  const comps = Array.isArray(deal.comps) ? deal.comps : [];
  if (comps.length === 0) return '';

  const specs = Array.isArray(deal.specs) ? deal.specs : [];
  const findSpec = (patterns) => {
    for (const s of specs) {
      const name = String(s.spec_name || '').toLowerCase();
      if (patterns.some(p => name.includes(p))) {
        return s.value_after || s.value_before || null;
      }
    }
    return null;
  };
  const ourSqft     = findSpec(['sqft', 'שטח', 'גודל', 'square']);
  const ourBedrooms = findSpec(['bedroom', 'חדר']);
  const ourPrice    = deal.arv;

  const fmtSqft = (v) => (v == null || v === '') ? '—' : (typeof v === 'number' ? v.toLocaleString('en-US') : v);
  const fmtBeds = (v) => (v == null || v === '') ? '—' : v;
  const fmtDOM  = (v) => (v == null || v === '') ? '—' : v + ' ימים';

  const shortAddr = (full) => {
    if (!full) return '—';
    const first = String(full).split(',')[0].trim();
    const numMatch = first.match(/^\d+/);
    if (numMatch) return numMatch[0];
    return first.split(' ')[0] || '—';
  };

  const ourRow = `
    <tr class="border-b border-outline-variant/10">
      <td class="py-4 px-4 font-bold text-primary text-right">הנכס שלנו</td>
      <td class="py-4 px-4 text-center font-label font-bold text-primary">${fmtSqft(ourSqft)}</td>
      <td class="py-4 px-4 text-center font-label font-bold text-primary">${fmtBeds(ourBedrooms)}</td>
      <td class="py-4 px-4 text-center font-label font-bold text-secondary">${formatUSD(ourPrice)}</td>
      <td class="py-4 px-4 text-center font-label text-on-surface-variant">—</td>
    </tr>`;

  const compsRows = comps.map(c => {
    const label = shortAddr(c.address);
    const cell = c.zillow_url
      ? `<a href="${c.zillow_url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${label}</a>`
      : label;
    return `
    <tr class="border-b border-outline-variant/10">
      <td class="py-4 px-4 t-body-xs text-on-surface-variant text-right">${cell}</td>
      <td class="py-4 px-4 text-center font-label">${fmtSqft(c.sqft)}</td>
      <td class="py-4 px-4 text-center font-label">${fmtBeds(c.bedrooms)}</td>
      <td class="py-4 px-4 text-center font-label font-bold text-primary">${formatUSD(c.sale_price)}</td>
      <td class="py-4 px-4 text-center font-label text-on-surface-variant">${fmtDOM(c.days_on_market)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="deal-section deal-section--comps">
      <h3 class="t-h3 font-extrabold text-primary mb-2">השוואת נכסים בשכונה</h3>
      <p class="t-body-sm text-on-surface-variant mb-6">נכסים דומים שנמכרו לאחרונה — האישוש לשווי המתוכנן</p>
      <div class="overflow-x-auto">
        <table class="w-full" style="table-layout:fixed">
          <colgroup>
            <col style="width:22%">
            <col style="width:18%">
            <col style="width:14%">
            <col style="width:26%">
            <col style="width:20%">
          </colgroup>
          <thead>
            <tr class="t-label text-on-surface-variant border-b border-outline-variant/30">
              <th class="pb-4 px-4 font-bold text-right">כתובת</th>
              <th class="pb-4 px-4 font-bold text-center">גודל (sqft)</th>
              <th class="pb-4 px-4 font-bold text-center">חדרים</th>
              <th class="pb-4 px-4 font-bold text-center">מחיר שנמכר</th>
              <th class="pb-4 px-4 font-bold text-center">זמן בשוק</th>
            </tr>
          </thead>
          <tbody class="t-body-xs">
            ${ourRow}
            ${compsRows}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Mobile section renderers ────────────────────────────────────────────────

function renderMobileKeyMetrics(deal) {
  return renderMobileMetrics(deal);
}

function renderMobileDescription(deal) {
  if (!deal.description) return '';
  return `
    <div class="px-5 mb-6">
      <h3 class="text-base font-bold text-[#022445] mb-2">תכנית העסקה</h3>
      <p class="text-sm text-[#43474e] leading-relaxed">${deal.description}</p>
    </div>`;
}

function renderMobileTimelineSection(deal) {
  return renderMobileTimeline(deal.property_status);
}

function renderMobileFundraisingBarSection(deal) {
  return renderMobileFundraisingBar(deal);
}

function renderMobileSpecsSection(deal) {
  return renderMobileSpecs(deal.specs);
}

function renderMobileCostBreakdownSection(deal) {
  return renderMobileCostAccordion(deal.cost_categories);
}

function renderMobileGallerySection(deal, mode) {
  // Reuse desktop gallery filter logic but route through mobile renderer for default.
  if (mode === 'before-after') return renderMobileGallery(deal.images);
  // For 'during' and 'after-only', render a simpler grid in mobile.
  const images = Array.isArray(deal.images) ? deal.images : [];
  if (images.length === 0) return '';
  const filtered = mode === 'after-only'
    ? images.filter(i => i.category === 'after')
    : images.filter(i => i.category === 'during' || i.category === 'rendering');
  if (filtered.length === 0) return '';
  const heading = mode === 'after-only' ? 'הנכס המוכן למכירה' : 'תמונות מהשטח';
  const thumbs = filtered.slice(0, 6).map(img => `
    <img class="aspect-square w-full object-cover rounded-md" src="${ADMIN_HOST + img.image_url}" alt="${img.alt_text || ''}" loading="lazy"/>`).join('');
  return `
    <div class="px-5 mb-6">
      <h3 class="text-base font-bold text-[#022445] mb-3">${heading}</h3>
      <div class="grid grid-cols-3 gap-2">${thumbs}</div>
    </div>`;
}

function renderMobileWhatsAppCTASection() {
  return renderMobileWhatsAppCTA();
}

function renderMobileRenovationProgress(deal) {
  let pct = deal.renovation_progress_percent;
  if (pct == null) pct = 0;
  const clamped = Math.min(Math.max(Number(pct) || 0, 0), 100);
  return `
    <div class="px-5 mb-6">
      <div class="bg-gradient-to-br from-[#022445] to-[#1e3a5c] rounded-xl p-5 text-white">
        <div class="flex items-baseline justify-between mb-3">
          <h3 class="text-base font-extrabold">התקדמות השיפוץ</h3>
          <span class="font-label font-extrabold text-3xl">${clamped}%</span>
        </div>
        <div class="w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
          <div class="h-full bg-[#984349] rounded-full" style="width:${clamped}%"></div>
        </div>
        ${deal.project_duration ? `<p class="mt-3 text-xs text-white/80">משך מתוכנן: ${deal.project_duration}</p>` : ''}
      </div>
    </div>`;
}

function renderMobilePlanVsActual(deal) {
  const fmtMoney = (n) => (n == null || n === '') ? '—' : formatUSD(n);
  const fmtPct = (n) => (n == null || n === '') ? '—' : Number(n).toFixed(1) + '%';

  const rows = [
    { label: 'עלות כוללת',  planned: fmtMoney(deal.total_cost),           actual: fmtMoney(deal.total_actual_cost) },
    { label: 'משך',          planned: deal.project_duration || '—',         actual: deal.actual_duration_months ? deal.actual_duration_months + ' חוד׳' : '—' },
    { label: 'מחיר מכירה',   planned: fmtMoney(deal.expected_sale_price),   actual: fmtMoney(deal.actual_sale_price) },
    { label: 'תשואה',        planned: fmtPct(deal.expected_roi_percent),    actual: fmtPct(deal.actual_roi_percent) }
  ];

  const rowsHtml = rows.map(r => `
    <tr>
      <td class="py-3 px-3 font-bold">${r.label}</td>
      <td class="py-3 px-2 text-center text-[#43474e] text-xs">${r.planned}</td>
      <td class="py-3 px-2 text-center font-bold font-label text-[#984349]">${r.actual}</td>
    </tr>`).join('');

  return `
    <div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
      <h3 class="text-base font-extrabold text-[#022445] mb-2 px-3">תוכנית מול מציאות</h3>
      <div class="bg-[#f5f3f0] overflow-hidden rounded-lg">
        <table class="w-full text-sm" style="table-layout:fixed">
          <thead class="bg-[#eae8e5]">
            <tr>
              <th class="py-2 px-3 text-right font-bold" style="width:40%">פרמטר</th>
              <th class="py-2 px-2 text-center font-bold text-xs" style="width:30%">מתוכנן</th>
              <th class="py-2 px-2 text-center font-bold text-[#984349]" style="width:30%">בפועל</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#eae8e5]">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
}

function renderMobilePostSaleSummary(deal) {
  if (!deal.sale_completion_note) return '';
  return `
    <div class="px-5 mb-6">
      <div class="bg-[#f5f3f0] p-4 rounded-lg">
        <h3 class="text-base font-bold text-[#022445] mb-2">סיכום העסקה</h3>
        <p class="text-sm text-[#43474e] leading-relaxed">${deal.sale_completion_note}</p>
      </div>
    </div>`;
}

function renderMobileComps(deal) {
  const comps = Array.isArray(deal.comps) ? deal.comps : [];
  if (comps.length === 0) return '';

  const specs = Array.isArray(deal.specs) ? deal.specs : [];
  const findSpec = (patterns) => {
    for (const s of specs) {
      const name = String(s.spec_name || '').toLowerCase();
      if (patterns.some(p => name.includes(p))) {
        return s.value_after || s.value_before || null;
      }
    }
    return null;
  };
  const ourSqft     = findSpec(['sqft', 'שטח', 'גודל', 'square']);
  const ourBedrooms = findSpec(['bedroom', 'חדר']);
  const ourPrice    = deal.arv;

  const fmtSqft = (v) => (v == null || v === '') ? '—' : (typeof v === 'number' ? v.toLocaleString('en-US') : v);
  const fmtBeds = (v) => (v == null || v === '') ? '—' : v;

  const shortAddr = (full) => {
    if (!full) return '—';
    const first = String(full).split(',')[0].trim();
    const numMatch = first.match(/^\d+/);
    if (numMatch) return numMatch[0];
    return first.split(' ')[0] || '—';
  };

  const ourRow = `
    <tr>
      <td class="py-2 px-2 font-bold text-[#022445] text-right" style="white-space:nowrap">הנכס שלנו</td>
      <td class="py-2 px-1 text-center font-label font-bold text-[#022445]">${fmtSqft(ourSqft)}</td>
      <td class="py-2 px-1 text-center font-label font-bold text-[#022445]">${fmtBeds(ourBedrooms)}</td>
      <td class="py-2 px-1 text-center font-label font-bold text-[#984349]">${formatUSD(ourPrice)}</td>
    </tr>`;

  const compsRows = comps.map(c => {
    const label = shortAddr(c.address);
    const cell = c.zillow_url
      ? `<a href="${c.zillow_url}" target="_blank" rel="noopener noreferrer" class="text-[#022445] underline">${label}</a>`
      : label;
    return `
    <tr>
      <td class="py-2 px-2 text-[#43474e] text-right">${cell}</td>
      <td class="py-2 px-1 text-center font-label">${fmtSqft(c.sqft)}</td>
      <td class="py-2 px-1 text-center font-label">${fmtBeds(c.bedrooms)}</td>
      <td class="py-2 px-1 text-center font-label font-bold text-[#022445]">${formatUSD(c.sale_price)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
      <h3 class="text-base font-extrabold text-[#022445] mb-2 px-3">השוואת נכסים בשכונה</h3>
      <div class="bg-[#f5f3f0] overflow-hidden rounded-lg">
        <table class="w-full text-sm" style="table-layout:fixed">
          <colgroup>
            <col style="width:26%">
            <col style="width:22%">
            <col style="width:14%">
            <col style="width:38%">
          </colgroup>
          <thead class="bg-[#eae8e5]">
            <tr>
              <th class="py-2 px-2 text-right font-bold">כתובת</th>
              <th class="py-2 px-1 text-center font-bold">sqft</th>
              <th class="py-2 px-1 text-center font-bold">חדרים</th>
              <th class="py-2 px-1 text-center font-bold">מחיר</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#eae8e5]">
            ${ourRow}
            ${compsRows}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Unified gallery (category tabs + carousel) ──────────────────────────────

const GALLERY_CATEGORY_ORDER = ['before', 'after', 'during', 'rendering'];
const GALLERY_CATEGORY_LABELS = {
  before:    'לפני',
  after:     'אחרי',
  during:    'במהלך השיפוץ',
  rendering: 'הדמיות'
};

function buildGalleryImagesMap(deal) {
  const map = {};
  const imgs = Array.isArray(deal.images) ? deal.images : [];
  for (const cat of GALLERY_CATEGORY_ORDER) {
    const list = imgs
      .filter(i => i.category === cat)
      .map(i => ({ image_url: ADMIN_HOST + i.image_url, alt_text: i.alt_text || '' }));
    if (list.length > 0) map[cat] = list;
  }
  return map;
}

function renderUnifiedGallery(deal) {
  const imagesMap = buildGalleryImagesMap(deal);
  const activeCategories = Object.keys(imagesMap);
  if (activeCategories.length === 0) return '';

  const initialCategory = activeCategories[0];
  const initialList = imagesMap[initialCategory];
  const firstImg = initialList[0];
  const jsonAttr = JSON.stringify(imagesMap).replace(/'/g, '&#39;');

  const showTabs = activeCategories.length > 1;
  const showNav = initialList.length > 1;

  const tabsHtml = showTabs ? `
    <div class="flex gap-2 mt-4 flex-wrap">
      ${activeCategories.map(cat => {
        const isActive = cat === initialCategory;
        const activeClasses = 'bg-primary text-white';
        const idleClasses = 'bg-surface-container-low text-on-surface-variant';
        return `
          <button type="button"
                  data-gallery-tab="${cat}"
                  data-active="${isActive}"
                  onclick="switchGalleryCategory(event, '${deal.id}', '${cat}')"
                  class="px-5 py-2 rounded-full t-body-xs font-bold transition ${isActive ? activeClasses : idleClasses}">
            ${GALLERY_CATEGORY_LABELS[cat] || cat}
          </button>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="deal-section deal-section--gallery">
      <h3 class="t-h3 font-extrabold text-primary mb-6">גלריה</h3>
      <div class="unified-gallery-wrapper"
           data-gallery-deal-id="${deal.id}"
           data-active-category="${initialCategory}"
           data-active-index="0"
           data-gallery-images='${jsonAttr}'>
        <div class="relative aspect-video rounded-2xl overflow-hidden bg-surface-container-low">
          <img data-gallery-main class="w-full h-full object-cover" src="${firstImg.image_url}" alt="${firstImg.alt_text}" loading="lazy"/>
          <button type="button" data-gallery-nav="prev"
                  onclick="galleryNavigate(event, '${deal.id}', 'prev')"
                  aria-label="קודם"
                  class="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center hover:bg-white transition"
                  style="${showNav ? '' : 'display:none'}">
            <span class="material-symbols-outlined text-primary">chevron_right</span>
          </button>
          <button type="button" data-gallery-nav="next"
                  onclick="galleryNavigate(event, '${deal.id}', 'next')"
                  aria-label="הבא"
                  class="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center hover:bg-white transition"
                  style="${showNav ? '' : 'display:none'}">
            <span class="material-symbols-outlined text-primary">chevron_left</span>
          </button>
          <div data-gallery-indicator dir="ltr"
               class="absolute bottom-3 left-3 bg-black/50 text-white rounded-full px-3 py-1 t-label font-label"
               style="${showNav ? '' : 'display:none'}">
            1 / ${initialList.length}
          </div>
        </div>
        ${tabsHtml}
      </div>
    </div>`;
}

function renderMobileUnifiedGallery(deal) {
  const imagesMap = buildGalleryImagesMap(deal);
  const activeCategories = Object.keys(imagesMap);
  if (activeCategories.length === 0) return '';

  const initialCategory = activeCategories[0];
  const initialList = imagesMap[initialCategory];
  const firstImg = initialList[0];
  const jsonAttr = JSON.stringify(imagesMap).replace(/'/g, '&#39;');

  const showTabs = activeCategories.length > 1;
  const showNav = initialList.length > 1;

  const tabsHtml = showTabs ? `
    <div class="flex gap-2 mt-3 overflow-x-auto px-3" style="scrollbar-width:none">
      ${activeCategories.map(cat => {
        const isActive = cat === initialCategory;
        const activeClasses = 'bg-primary text-white';
        const idleClasses = 'bg-surface-container-low text-on-surface-variant';
        return `
          <button type="button"
                  data-gallery-tab="${cat}"
                  data-active="${isActive}"
                  onclick="switchGalleryCategory(event, '${deal.id}', '${cat}')"
                  class="whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition ${isActive ? activeClasses : idleClasses}">
            ${GALLERY_CATEGORY_LABELS[cat] || cat}
          </button>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="mb-6" style="margin-left:-0.25rem;margin-right:-0.25rem">
      <h3 class="text-md font-bold text-[#022445] mb-3 px-3">גלריה</h3>
      <div class="unified-gallery-wrapper"
           data-gallery-deal-id="${deal.id}"
           data-active-category="${initialCategory}"
           data-active-index="0"
           data-gallery-images='${jsonAttr}'>
        <div class="relative aspect-video overflow-hidden bg-surface-container-low rounded-lg" style="touch-action:pan-y">
          <img data-gallery-main class="w-full h-full object-cover" src="${firstImg.image_url}" alt="${firstImg.alt_text}" loading="lazy" draggable="false" style="user-select:none;-webkit-user-drag:none"/>
          <button type="button" data-gallery-nav="prev"
                  onclick="galleryNavigate(event, '${deal.id}', 'prev')"
                  aria-label="קודם"
                  class="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style="${showNav ? '' : 'display:none'};right:10px;width:36px;height:36px;border-radius:9999px;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)">
            <span class="material-symbols-outlined" style="font-size:18px;color:#fff;font-variation-settings:'wght' 300">chevron_right</span>
          </button>
          <button type="button" data-gallery-nav="next"
                  onclick="galleryNavigate(event, '${deal.id}', 'next')"
                  aria-label="הבא"
                  class="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style="${showNav ? '' : 'display:none'};left:10px;width:36px;height:36px;border-radius:9999px;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)">
            <span class="material-symbols-outlined" style="font-size:18px;color:#fff;font-variation-settings:'wght' 300">chevron_left</span>
          </button>
          <div data-gallery-indicator dir="ltr"
               class="absolute bottom-2 left-2 text-white text-xs font-label"
               style="${showNav ? '' : 'display:none'};background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:2px 8px;border-radius:9999px">
            1 / ${initialList.length}
          </div>
        </div>
        ${tabsHtml}
      </div>
    </div>`;
}

window.switchGalleryCategory = function(event, dealId, category) {
  if (event) event.stopPropagation();
  const wrappers = document.querySelectorAll(`.unified-gallery-wrapper[data-gallery-deal-id="${dealId}"]`);
  wrappers.forEach(wrapper => {
    wrapper.dataset.activeCategory = category;
    wrapper.dataset.activeIndex = '0';
    updateGalleryView(wrapper);
  });
};

// Swipe-to-navigate on gallery — global delegation, calls existing galleryNavigate
(function attachGallerySwipe() {
  if (window.__gallerySwipeAttached) return;
  window.__gallerySwipeAttached = true;
  let startX = 0, startY = 0, startWrapper = null, decided = false, isHorizontal = false;
  document.addEventListener('touchstart', e => {
    const wrapper = e.target.closest('.unified-gallery-wrapper');
    if (!wrapper) { startWrapper = null; return; }
    startWrapper = wrapper;
    decided = false;
    isHorizontal = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!startWrapper) return;
    if (decided) {
      if (isHorizontal) e.preventDefault(); // lock browser scroll once horizontal intent confirmed
      return;
    }
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // not enough movement to decide
    decided = true;
    isHorizontal = Math.abs(dx) > Math.abs(dy);
    if (isHorizontal) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', e => {
    const wrapper = startWrapper;
    startWrapper = null;
    if (!wrapper || !isHorizontal) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return; // ignore short swipes
    const dealId = wrapper.dataset.galleryDealId;
    // RTL: swipe LEFT (dx < 0) = next; swipe RIGHT (dx > 0) = prev
    window.galleryNavigate(null, dealId, dx < 0 ? 'next' : 'prev');
  }, { passive: true });
})();

window.galleryNavigate = function(event, dealId, direction) {
  if (event) event.stopPropagation();
  const wrappers = document.querySelectorAll(`.unified-gallery-wrapper[data-gallery-deal-id="${dealId}"]`);
  wrappers.forEach(wrapper => {
    const images = JSON.parse(wrapper.dataset.galleryImages || '{}');
    const cat = wrapper.dataset.activeCategory;
    const list = images[cat] || [];
    if (list.length === 0) return;
    let idx = parseInt(wrapper.dataset.activeIndex || '0', 10);
    if (direction === 'next') idx = (idx + 1) % list.length;
    else idx = (idx - 1 + list.length) % list.length;
    wrapper.dataset.activeIndex = String(idx);
    updateGalleryView(wrapper);
  });
};

function updateGalleryView(wrapper) {
  const images = JSON.parse(wrapper.dataset.galleryImages || '{}');
  const cat = wrapper.dataset.activeCategory;
  const list = images[cat] || [];
  const idx = parseInt(wrapper.dataset.activeIndex || '0', 10);
  const current = list[idx];

  const mainImg = wrapper.querySelector('[data-gallery-main]');
  if (mainImg && current) {
    mainImg.src = current.image_url;
    mainImg.alt = current.alt_text || '';
  }

  const indicator = wrapper.querySelector('[data-gallery-indicator]');
  if (indicator) {
    indicator.textContent = `${idx + 1} / ${list.length}`;
    indicator.style.display = list.length > 1 ? '' : 'none';
  }

  const prev = wrapper.querySelector('[data-gallery-nav="prev"]');
  const next = wrapper.querySelector('[data-gallery-nav="next"]');
  if (prev) prev.style.display = list.length > 1 ? '' : 'none';
  if (next) next.style.display = list.length > 1 ? '' : 'none';

  wrapper.querySelectorAll('[data-gallery-tab]').forEach(btn => {
    const isActive = btn.dataset.galleryTab === cat;
    btn.dataset.active = isActive ? 'true' : 'false';
    if (isActive) {
      btn.classList.remove('bg-surface-container-low', 'text-on-surface-variant');
      btn.classList.add('bg-primary', 'text-white');
    } else {
      btn.classList.remove('bg-primary', 'text-white');
      btn.classList.add('bg-surface-container-low', 'text-on-surface-variant');
    }
  });
}

// ── Section dispatcher ──────────────────────────────────────────────────────

const SECTION_RENDERERS_DESKTOP = {
  'fundraising-bar':      (d) => renderFundraisingBarSection(d),
  'unified-gallery':      (d) => renderUnifiedGallery(d),
  'key-metrics':          (d) => renderKeyMetricsSection(d),
  'description':          (d) => renderDescriptionSection(d),
  'specs':                (d) => renderSpecsSection(d),
  'cost-breakdown':       (d) => renderCostBreakdownSection(d),
  'timeline':             (d) => renderTimelineSection(d),
  'comps':                (d) => renderComps(d),
  'renovation-progress':  (d) => renderRenovationProgress(d),
  'plan-vs-actual':       (d) => renderPlanVsActual(d),
  'post-sale-summary':    (d) => renderPostSaleSummary(d),
  'whatsapp-cta':         (_) => renderWhatsAppCTASection()
};

const SECTION_RENDERERS_MOBILE = {
  'fundraising-bar':      (d) => renderMobileFundraisingBarSection(d),
  'unified-gallery':      (d) => renderMobileUnifiedGallery(d),
  'key-metrics':          (d) => renderMobileKeyMetrics(d),
  'description':          (d) => renderMobileDescription(d),
  'specs':                (d) => renderMobileSpecsSection(d),
  'cost-breakdown':       (d) => renderMobileCostBreakdownSection(d),
  'timeline':             (d) => renderMobileTimelineSection(d),
  'comps':                (d) => renderMobileComps(d),
  'renovation-progress':  (d) => renderMobileRenovationProgress(d),
  'plan-vs-actual':       (d) => renderMobilePlanVsActual(d),
  'post-sale-summary':    (d) => renderMobilePostSaleSummary(d),
  'whatsapp-cta':         (_) => renderMobileWhatsAppCTASection()
};

function getExpandedConfig(deal) {
  const cfg = (window.EXPANDED_PANEL_CONFIG || {})[deal.property_status];
  // Fallback for unknown / missing status — same content as 'purchased'
  return cfg || (window.EXPANDED_PANEL_CONFIG || {}).purchased || [];
}

// ── Full expanded deal content (config-driven, per property_status) ─────────

function renderExpandedContent(deal) {
  const sectionIds = getExpandedConfig(deal);
  const html = sectionIds
    .map(id => (SECTION_RENDERERS_DESKTOP[id] ? SECTION_RENDERERS_DESKTOP[id](deal) : ''))
    .filter(Boolean)
    .join('');
  return html;
}

// ── Single deal card ─────────────────────────────────────────────────────────

function renderDealCard(deal, index) {
  // Mobile: use Stitch-style card
  if (isMobile()) return renderMobileDealCard(deal, index);

  const isExpandable = deal.is_expandable !== false;
  const status = getDisplayStatus(deal);
  const config = DEAL_DISPLAY_CONFIG[status];

  const thumbSrc = deal.thumbnail_url ? (ADMIN_HOST + deal.thumbnail_url) : '';
  const thumbHtml = thumbSrc
    ? `<img class="deal-card-thumb" alt="${deal.name}" src="${thumbSrc}" loading="lazy"/>`
    : `<div class="deal-card-thumb" style="background:#f5f3f0"></div>`;

  const badgeHtml    = renderBadge(config.badge, deal);
  const secondaryBadgeHtml = renderFundraisingSecondaryBadge(deal);
  const numbersHtml  = renderNumbersRow(config.numbers, deal, { mobile: false });
  const progressHtml = renderProgress(config.progress, deal);
  const ctaHtml      = renderCTA(config.cta, isExpandable);

  const subtitle = locationSubtitle(deal);

  const stickyCtaHtml = isExpandable
    ? `<a href="https://chat.whatsapp.com/" data-setting-href="whatsapp_group" target="_blank" rel="noopener noreferrer"
         class="deal-sticky-cta" aria-label="הצטרפות לקבוצת הווצאפ">
         <span class="material-symbols-outlined" data-weight="fill">chat</span>
         <span>מעוניינים? הצטרפו לקבוצה</span>
       </a>`
    : '';

  const expandedHtml = isExpandable
    ? `<div class="deal-expanded">${renderExpandedContent(deal)}${stickyCtaHtml}</div>`
    : `<div class="deal-expanded"></div>`;

  const accentStripHtml = config.accentStrip
    ? '<div class="deal-accent-strip"></div>'
    : '';

  const arrowHtml = isExpandable
    ? `<span class="deal-arrow material-symbols-outlined" style="color:#022445;font-size:1.5rem">expand_more</span>`
    : '';

  return `
    <div class="deal-card-v2 bg-surface-container-lowest rounded-[1rem] overflow-hidden shadow-[0px_8px_24px_rgba(2,36,69,0.04)] transition-all">
      ${accentStripHtml}
      <div class="deal-header p-4 md:p-6 cursor-pointer">
        <div class="flex flex-row items-center gap-6 w-full">
          <!-- Zone A: thumbnail + badge + title (30%) -->
          <div class="flex items-center gap-4 min-w-0" style="width:30%">
            ${thumbHtml}
            <div class="flex flex-col min-w-0">
              <div class="flex flex-col gap-1 items-start">${badgeHtml}${secondaryBadgeHtml}</div>
              <h3 class="deal-card-title mt-2 truncate">${deal.name || ''}</h3>
              ${subtitle ? `<div class="deal-card-subtitle truncate">${subtitle}</div>` : ''}
            </div>
          </div>

          <!-- Zone B: 3 numbers (30%) -->
          <div style="width:30%">
            ${numbersHtml}
          </div>

          <!-- Zone C: progress (25%) -->
          <div class="flex flex-col justify-center" style="width:25%">
            ${progressHtml}
          </div>

          <!-- Zone D: CTA + arrow (15%) -->
          <div class="flex items-center justify-end gap-2" style="width:15%">
            ${ctaHtml}
            ${arrowHtml}
          </div>
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

function setToggleBtnText(btn, open) {
  if (!btn) return;
  const collapsedText = btn.getAttribute('data-text-collapsed');
  const expandedText = btn.getAttribute('data-text-expanded');
  if (!collapsedText || !expandedText) return;
  // Preserve any trailing icon span
  const iconHtml = btn.querySelector('.material-symbols-outlined')?.outerHTML || '';
  btn.innerHTML = (open ? expandedText : collapsedText) + (iconHtml ? '\n      ' + iconHtml : '');
}

document.addEventListener('click', function (e) {
  const toggleBtn = e.target.closest('.deal-toggle-btn');
  const header = e.target.closest('.deal-header');
  const trigger = toggleBtn || header;
  if (!trigger) return;

  // Mobile: clicking header OR toggle button expands/collapses
  if (isMobile()) {
    const article = trigger.closest('article');
    if (!article) return;
    const expanded = article.querySelector('.mobile-deal-expanded');
    if (!expanded || !expanded.children.length) return;

    const isOpen = expanded.classList.contains('open');
    // Close all other expanded deals
    document.querySelectorAll('.mobile-deal-expanded.open').forEach(el => {
      el.classList.remove('open');
      const otherArticle = el.closest('article');
      if (otherArticle) {
        const otherBtn = otherArticle.querySelector('.deal-toggle-btn');
        setToggleBtnText(otherBtn, false);
      }
    });

    if (!isOpen) {
      expanded.classList.add('open');
      setToggleBtnText(article.querySelector('.deal-toggle-btn'), true);
    }
    return;
  }

  // Desktop: existing behavior
  const card = header.closest('.deal-card-v2') || header.closest('.bg-surface-container-lowest');
  if (!card) return;

  const expanded = card.querySelector('.deal-expanded');
  if (!expanded) return;

  // Check if this deal is expandable (has content)
  if (!expanded.children.length) return;

  const isOpen = expanded.classList.contains('open');

  // Close all open deals first
  document.querySelectorAll('.deal-expanded.open').forEach(el => {
    el.classList.remove('open');
    const parent = el.closest('.deal-card-v2') || el.closest('.bg-surface-container-lowest');
    const arr = parent ? parent.querySelector('.deal-arrow') : null;
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

// ── Mobile expand/collapse helpers ───────────────────────────────────────────

function expandMobileDeal(btn) {
  const article = btn.closest('article');
  if (!article) return;

  // Close all other expanded deals
  document.querySelectorAll('.mobile-deal-expanded.open').forEach(el => {
    el.classList.remove('open');
    const otherArticle = el.closest('article');
    if (otherArticle && otherArticle !== article) {
      const otherBtn = otherArticle.querySelector('.deal-expand-btn');
      if (otherBtn) otherBtn.style.display = '';
    }
  });

  const expanded = article.querySelector('.mobile-deal-expanded');
  if (expanded) {
    expanded.classList.add('open');
    btn.style.display = 'none';
  }
}

function collapseMobileDeal(btn) {
  const article = btn.closest('article');
  if (!article) return;

  const expanded = article.querySelector('.mobile-deal-expanded');
  if (expanded) {
    expanded.classList.remove('open');
    const expandBtn = article.querySelector('.deal-expand-btn');
    if (expandBtn) expandBtn.style.display = '';
    // Scroll to the card top
    article.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleMobileCostCategory(header) {
  const items = header.nextElementSibling;
  const arrow = header.querySelector('.mobile-cost-arrow');
  if (!items) return;
  if (items.style.maxHeight && items.style.maxHeight !== '0px') {
    items.style.maxHeight = '0px';
    if (arrow) arrow.style.transform = '';
  } else {
    items.style.maxHeight = items.scrollHeight + 'px';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  }
}

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

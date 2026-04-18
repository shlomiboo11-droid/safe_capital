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

// ── Mobile timeline renderer ─────────────────────────────────────────────────

function renderMobileTimeline(steps, propertyStatus) {
  if (!steps || steps.length === 0) return '';

  const expectedIndex = STATUS_TO_STEP_INDEX[propertyStatus] || 0;
  steps.forEach((step, i) => {
    if (i < expectedIndex) step.status = 'completed';
    else if (i === expectedIndex) step.status = 'active';
    else step.status = 'pending';
  });

  let activeIndex = -1;
  steps.forEach((step, i) => {
    if (step.status === 'completed') activeIndex = i;
    if (step.status === 'active' && activeIndex < i) activeIndex = i;
  });
  const progressPct = steps.length > 1 ? Math.round((activeIndex / (steps.length - 1)) * 100) : 0;

  const stepsHtml = steps.map(step => {
    if (step.status === 'completed') {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#022445] text-white flex items-center justify-center">
          <span class="material-symbols-outlined" style="font-size:14px">check</span>
        </div>
        <span class="text-[10px] font-bold">${step.step_name}</span>
      </div>`;
    } else if (step.status === 'active') {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#022445] border-4 border-white shadow-sm flex items-center justify-center"></div>
        <span class="text-[10px] font-bold text-[#022445]">${step.step_name}</span>
      </div>`;
    } else {
      return `<div class="relative z-10 flex flex-col items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#e4e2df] flex items-center justify-center"></div>
        <span class="text-[10px] font-bold text-[#43474e]">${step.step_name}</span>
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
  const goal = parseFloat(deal.fundraising_goal || 0);
  const pct = deal.fundraising_percent || 0;
  if (goal === 0) return '';

  return `<div class="px-5 pb-6">
    <div class="flex justify-between items-center mb-2">
      <span class="text-xs font-bold text-[#022445]">התקדמות גיוס</span>
      <span class="text-xs font-bold font-label text-[#022445]">${pct}%</span>
    </div>
    <div class="h-2 w-full bg-[#e4e2df] rounded-full overflow-hidden">
      <div class="h-full bg-gradient-to-l from-[#022445] to-[#1e3a5c] rounded-full" style="width:${Math.min(pct, 100)}%"></div>
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
        <span class="bg-black/40 text-white text-[10px] px-2 py-1 rounded-sm backdrop-blur-md">לפני</span>
      </div>`;
    }
    if (afterSrc) {
      html += `<div class="flex-1 flex items-center justify-center">
        <span class="bg-black/40 text-white text-[10px] px-2 py-1 rounded-sm backdrop-blur-md">אחרי</span>
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
  const purchasePrice = deal.purchase_price;
  const totalCost = deal.total_cost;
  const arv = deal.arv;
  const expectedProfit = deal.expected_profit;

  let html = '<div class="px-5 mb-6"><div class="grid grid-cols-2 gap-4">';

  if (purchasePrice) {
    html += `<div class="bg-white p-4 rounded-lg">
      <p class="text-[10px] text-[#43474e] uppercase mb-1">מחיר רכישה</p>
      <p class="text-lg font-bold font-label">${formatUSD(purchasePrice)}</p>
    </div>`;
  }
  if (totalCost) {
    html += `<div class="bg-white p-4 rounded-lg">
      <p class="text-[10px] text-[#43474e] uppercase mb-1">עלות פרויקט</p>
      <p class="text-lg font-bold font-label">${formatUSD(totalCost)}</p>
    </div>`;
  }
  if (arv) {
    html += `<div class="bg-white p-4 rounded-lg border-r-4 border-[#984349]">
      <p class="text-[10px] text-[#984349] font-bold uppercase mb-1">שווי שוק סופי (ARV)</p>
      <p class="text-lg font-bold font-label">${formatUSD(arv)}</p>
    </div>`;
  }
  if (expectedProfit) {
    html += `<div class="bg-[#ffdada] p-4 rounded-lg">
      <p class="text-[10px] text-[#792b32] font-bold uppercase mb-1">רווח משוער</p>
      <p class="text-lg font-bold font-label text-[#792b32]">${formatUSD(expectedProfit)}</p>
    </div>`;
  }

  html += '</div></div>';
  return html;
}

// ── Mobile specs table ──────────────────────────────────────────────────────

function renderMobileSpecs(specs) {
  if (!specs || specs.length === 0) return '';

  const rowsHtml = specs.map(spec => `
    <tr>
      <td class="py-2 px-3">${spec.spec_name}</td>
      <td class="py-2 px-3 text-center font-label">${spec.value_before || '—'}</td>
      <td class="py-2 px-3 text-center font-label font-bold text-[#984349]">${spec.value_after || '—'}</td>
    </tr>`).join('');

  return `<div class="px-5 mb-6">
    <div class="bg-white rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[#eae8e5]">
          <tr>
            <th class="py-2 px-3 text-right font-bold">מפרט</th>
            <th class="py-2 px-3 text-center font-bold">לפני</th>
            <th class="py-2 px-3 text-center font-bold text-[#984349]">אחרי</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#f5f3f0]">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Mobile cost accordion ───────────────────────────────────────────────────

function renderMobileCostAccordion(categories) {
  if (!categories || categories.length === 0) return '';

  const items = categories.map(cat => `
    <div class="bg-white p-3 rounded-lg">
      <div class="flex justify-between items-center cursor-pointer cost-category-header-mobile" onclick="toggleMobileCostCategory(this)">
        <span class="text-sm font-bold">${cat.name}</span>
        <div class="flex items-center gap-2">
          <span class="font-label font-bold text-[#022445] text-sm">${formatUSD(cat.total_planned)}</span>
          <span class="material-symbols-outlined text-[#022445] mobile-cost-arrow">expand_more</span>
        </div>
      </div>
      <div class="mobile-cost-items" style="max-height:0;overflow:hidden;transition:max-height 0.3s ease">
        ${(cat.items || []).map(item => `
          <div class="flex justify-between py-2 border-t border-[#f5f3f0] text-sm">
            <span class="text-[#43474e]">${item.name}</span>
            <span class="font-label font-medium">${formatUSD(item.planned_amount)}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  return `<div class="px-5 mb-6 space-y-2">${items}</div>`;
}

// ── Mobile WhatsApp CTA ─────────────────────────────────────────────────────

function renderMobileWhatsAppCTA() {
  return `<div class="px-5 pb-8">
    <div class="bg-gradient-to-br from-[#022445] to-[#1e3a5c] p-6 rounded-xl text-center text-white relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
      <h4 class="text-lg font-bold mb-2">מעוניין בפרטים נוספים?</h4>
      <p class="text-xs text-white/70 mb-4">הצטרף לקבוצת המשקיעים השקטה שלנו וקבל עדכונים לפני כולם</p>
      <a href="https://chat.whatsapp.com/" data-setting-href="whatsapp_group" target="_blank" rel="noopener noreferrer"
         class="w-full bg-[#25D366] hover:bg-[#128C7E] transition-colors py-3 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg text-white no-underline">
        ${WHATSAPP_SVG}
        דבר איתנו בוואטסאפ
      </a>
    </div>
  </div>`;
}

// ── Mobile expanded content ─────────────────────────────────────────────────

function renderMobileExpandedContent(deal) {
  const timelineHtml = renderMobileTimeline(deal.timeline, deal.property_status);
  const fundraisingHtml = renderMobileFundraisingBar(deal);
  const galleryHtml = renderMobileGallery(deal.images);
  const metricsHtml = renderMobileMetrics(deal);
  const specsHtml = renderMobileSpecs(deal.specs);
  const costHtml = renderMobileCostAccordion(deal.cost_categories);
  const whatsappHtml = renderMobileWhatsAppCTA();

  const descriptionHtml = deal.description
    ? `<div class="px-5 mb-6">
        <h3 class="text-md font-bold text-[#022445] mb-2">תכנית העסקה</h3>
        <p class="text-sm text-[#43474e] leading-relaxed">${deal.description}</p>
      </div>`
    : '';

  return `
    ${timelineHtml}
    ${fundraisingHtml}
    ${galleryHtml}
    ${metricsHtml}
    ${descriptionHtml}
    ${specsHtml}
    ${costHtml}
    ${whatsappHtml}`;
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
    const steps = Array.isArray(deal.timeline) ? deal.timeline : [];
    return renderCollapsedTimeline(steps, bottom, isMobileView);
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
function renderCollapsedTimeline(steps, bottomText, isMobileView) {
  if (!steps || steps.length === 0) {
    // Fallback to a generic 4-step timeline if no DB steps
    steps = [
      { step_name: 'רכישה',  status: 'completed' },
      { step_name: 'תכנון',  status: 'completed' },
      { step_name: 'שיפוץ',  status: 'active' },
      { step_name: 'מכירה',  status: 'pending' }
    ];
  }
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
      <div class="grid grid-cols-3 gap-2 py-0.5 px-2 rounded-xl deal-numbers-mobile-grid" style="background:rgba(2,36,69,0.04)">
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
  const numbersHtml  = renderNumbersRow(config.numbers, deal, { mobile: true });
  const progressHtml = renderProgress(config.progress, deal, { mobile: true });
  const ctaHtml      = renderCTA(config.cta, isExpandable);

  // Mobile: deal# shown as white ribbon (original style)
  const dealNumRibbon = deal.deal_number
    ? `<span class="deal-number-ribbon">#${deal.deal_number}</span>`
    : '';

  const expandedHtml = isExpandable
    ? `<div class="deal-expanded mobile-deal-expanded bg-[#f5f3f0]">${renderMobileExpandedContent(deal)}</div>`
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
          <div class="absolute top-6 right-6">${badgeHtml}</div>
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
            <img class="h-full w-full object-cover" src="${ADMIN_HOST + beforeSrc}" alt="לפני שיפוץ" loading="lazy"/>
            <span class="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">לפני</span>
          </div>` : ''}
          ${afterSrc ? `
          <div class="${beforeSrc ? 'w-1/2' : 'w-full'} relative ${beforeSrc ? 'border-r-4 border-white' : ''}">
            <img class="h-full w-full object-cover" src="${ADMIN_HOST + afterSrc}" alt="אחרי שיפוץ (הדמיה)" loading="lazy"/>
            <span class="absolute bottom-4 left-4 bg-primary/80 text-white text-xs px-2 py-1 rounded">אחרי (הדמיה)</span>
          </div>` : ''}
        </div>
      </div>`;
  }

  // Rendering gallery grid
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
  const numbersHtml  = renderNumbersRow(config.numbers, deal, { mobile: false });
  const progressHtml = renderProgress(config.progress, deal);
  const ctaHtml      = renderCTA(config.cta, isExpandable);

  const subtitle = locationSubtitle(deal);

  const expandedHtml = isExpandable
    ? `<div class="deal-expanded space-y-16">${renderExpandedContent(deal)}</div>`
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
              ${badgeHtml}
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

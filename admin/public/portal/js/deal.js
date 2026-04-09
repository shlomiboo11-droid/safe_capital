/**
 * Deal Detail Page — portal/js/deal.js
 * Loads and renders all 9 sections of a deal detail view.
 */

// Auth guard
const investor = requirePortalAuth();
if (investor) {
  initPortalShell('home');
  loadDeal();
}

// Get deal ID from URL
const dealId = new URLSearchParams(window.location.search).get('id');

// ── Status mapping ─────────────────────────────────────────────────
const STATUS_MAP = {
  sourcing:   { label: 'בחיפוש',  badge: 'badge-gray' },
  purchased:  { label: 'נרכש',    badge: 'badge-blue' },
  planning:   { label: 'בתכנון',  badge: 'badge-lightblue' },
  renovation: { label: 'בשיפוץ',  badge: 'badge-orange' },
  selling:    { label: 'למכירה',  badge: 'badge-purple' },
  sold:       { label: 'נמכר',    badge: 'badge-green' }
};

const INVEST_STATUS_MAP = {
  committed: { label: 'ממתין', css: 'invest-status-committed' },
  funded:    { label: 'מומן',  css: 'invest-status-funded' },
  returned:  { label: 'הוחזר', css: 'invest-status-returned' }
};

const CATEGORY_LABELS = {
  before:    'לפני השיפוץ',
  during:    'במהלך השיפוץ',
  after:     'אחרי השיפוץ',
  rendering: 'הדמיות',
  gallery:   'כללי',
  thumbnail: 'תמונת נכס'
};

// ── Helpers ─────────────────────────────────────────────────────────
function formatCurrency(val) {
  const n = parseFloat(val);
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return d.getDate() + ' ב' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function hasValue(val) {
  return val !== null && val !== undefined && val !== '' && val !== 0 && parseFloat(val) !== 0;
}

function deviationClass(planned, actual) {
  if (!hasValue(planned) || !hasValue(actual)) return '';
  const p = parseFloat(planned);
  const a = parseFloat(actual);
  if (p === 0) return '';
  const pct = Math.abs((a - p) / p) * 100;
  return pct > 10 ? 'deviation' : '';
}

// ── Load deal data ─────────────────────────────────────────────────
async function loadDeal() {
  const loading = document.getElementById('loadingState');
  const content = document.getElementById('dealContent');

  if (!dealId) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    content.innerHTML = errorHTML('לא צוין מזהה עסקה', 'חזרה לעסקאות שלי', '/index.html');
    return;
  }

  try {
    const data = await PORTAL_API.get('/my-deals/' + dealId);
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    renderDeal(data);
  } catch (err) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    content.innerHTML = errorHTML(err.message || 'שגיאה בטעינת הנתונים');
  }
}

function errorHTML(message, btnText, btnHref) {
  return `
    <div class="text-center py-16">
      <span class="material-symbols-outlined text-5xl mb-4 block" style="color: #d1d5db;">error</span>
      <p class="text-lg font-semibold" style="color: #1b1c1a;">שגיאה</p>
      <p class="text-sm mt-2" style="color: #43474e;">${escapeHtml(message)}</p>
      <a href="${btnHref || '/index.html'}" class="inline-block mt-4 px-6 py-2 rounded-lg text-sm font-semibold text-white" style="background: #022445;">
        ${btnText || 'חזרה'}
      </a>
    </div>
  `;
}

// ── Render all 9 sections ──────────────────────────────────────────
function renderDeal(data) {
  const content = document.getElementById('dealContent');
  const deal = data.deal || {};
  const snapshot = data.financials_snapshot || {};
  const myInvest = data.investor_position || {};
  const categories = data.cost_categories || [];
  const timeline = data.timeline_steps || [];
  const images = data.images || [];
  const specs = data.specs || [];
  const comps = data.comps || [];
  const documents = data.documents || [];
  const renovation = data.renovation_plan || null;
  const totals = data.totals || {};

  let html = '';

  // 1. Deal Summary Header
  html += renderSummaryHeader(deal, snapshot, categories, totals);

  // 2. My Investment
  html += renderMyInvestment(myInvest, snapshot);

  // 3. Timeline
  html += renderTimeline(timeline);

  // 4. Plan vs Actual
  html += renderPlanVsActual(deal, snapshot, categories, totals);

  // 5. Property Specs
  html += renderSpecs(specs);

  // 6. Photo Gallery
  html += renderGallery(images);

  // 7. Market Comparables
  html += renderComps(comps);

  // 8. Documents
  html += renderDocuments(documents);

  // 9. Renovation Plan
  html += renderRenovationPlan(renovation);

  content.innerHTML = html;

  // Init lightbox after render
  initLightbox();
}

// ── Section 1: Summary Header ──────────────────────────────────────
function renderSummaryHeader(deal, snapshot, categories, totals) {
  const status = STATUS_MAP[deal.property_status] || STATUS_MAP.sourcing;

  // Calculate renovation cost from categories
  const renovationCost = totals.planned_total || 0;
  const arv = deal.arv || snapshot.planned_arv || 0;
  const purchasePrice = deal.purchase_price || snapshot.planned_purchase_price || 0;
  const roi = snapshot.planned_roi || 0;

  const thumbnail = deal.thumbnail_url || '';

  return `
    <div class="mb-6">
      <a href="/portal/index.html" class="inline-flex items-center gap-1 text-sm font-semibold mb-4" style="color: #022445; text-decoration: none;">
        <span class="material-symbols-outlined text-base">arrow_forward</span>
        חזרה לעסקאות שלי
      </a>

      <div class="deal-section">
        <div class="flex flex-col sm:flex-row gap-4">
          ${thumbnail ? `
            <div class="sm:w-64 flex-shrink-0">
              <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(deal.name)}"
                   class="w-full rounded-lg object-cover" style="max-height: 300px;">
            </div>
          ` : ''}
          <div class="flex-1">
            <div class="flex items-start justify-between gap-3 mb-2">
              <h1 class="text-2xl font-bold" style="color: #022445; font-family: 'Heebo', sans-serif;">
                ${escapeHtml(deal.name)}
              </h1>
              <span class="badge ${status.badge} text-sm flex-shrink-0">${status.label}</span>
            </div>
            ${deal.full_address ? `<p class="text-sm mb-3" style="color: #74777f;">${escapeHtml(deal.full_address)}</p>` : ''}
            ${deal.description ? `<p class="text-sm" style="color: #43474e; line-height: 1.6;">${escapeHtml(deal.description)}</p>` : ''}
          </div>
        </div>

        <div class="key-metrics-grid mt-4">
          <div class="metric-card">
            <div class="metric-num">${formatCurrency(purchasePrice)}</div>
            <div class="metric-label">מחיר רכישה</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${formatCurrency(renovationCost)}</div>
            <div class="metric-label">עלות שיפוץ מתוכננת</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${formatCurrency(arv)}</div>
            <div class="metric-label">שווי צפוי אחרי שיפוץ</div>
          </div>
          <div class="metric-card">
            <div class="metric-num">${roi ? parseFloat(roi).toFixed(0) + '%' : '—'}</div>
            <div class="metric-label">תשואה צפויה</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Section 2: My Investment ───────────────────────────────────────
function renderMyInvestment(myInvest, snapshot) {
  if (!myInvest || !myInvest.amount) return '';

  const investStatus = INVEST_STATUS_MAP[myInvest.status] || INVEST_STATUS_MAP.committed;
  const ownershipPct = parseFloat(myInvest.ownership_percentage || 0);
  const plannedProfit = parseFloat(snapshot.planned_profit || 0);
  const myProfit = ownershipPct > 0 ? (ownershipPct * plannedProfit / 100) : 0;

  return `
    <div class="deal-section-alt mb-4">
      <h2 class="deal-section-title">ההשקעה שלי</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div class="col-span-2 sm:col-span-1">
          <div class="text-sm mb-1" style="color: #43474e;">סכום ההשקעה שלי</div>
          <div style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.75rem; color: #984349;">
            ${formatCurrency(myInvest.amount)}
          </div>
        </div>
        <div>
          <div class="text-sm mb-1" style="color: #43474e;">אחוז בעלות</div>
          <div style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.25rem; color: #1b1c1a;">
            ${ownershipPct ? ownershipPct.toFixed(1) + '%' : '—'}
          </div>
        </div>
        <div>
          <div class="text-sm mb-1" style="color: #43474e;">רווח צפוי</div>
          <div style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.25rem; color: #1b1c1a;">
            ${myProfit > 0 ? formatCurrency(myProfit) : '—'}
          </div>
        </div>
        <div>
          <div class="text-sm mb-1" style="color: #43474e;">תאריך השקעה</div>
          <div class="text-sm font-semibold" style="color: #1b1c1a;">
            ${formatDate(myInvest.investment_date)}
          </div>
        </div>
        <div>
          <div class="text-sm mb-1" style="color: #43474e;">סטטוס</div>
          <span class="badge ${investStatus.css}">${investStatus.label}</span>
        </div>
      </div>
      ${myInvest.notes ? `<p class="text-sm mt-3" style="color: #43474e;">${escapeHtml(myInvest.notes)}</p>` : ''}
    </div>
  `;
}

// ── Section 3: Timeline ────────────────────────────────────────────
function renderTimeline(timeline) {
  if (!timeline || timeline.length === 0) return '';

  let stepsHTML = '';
  timeline.forEach(step => {
    const s = step.status || 'pending';
    const dotClass = s === 'completed' ? 'completed' : s === 'active' ? 'active' : 'pending';
    const textClass = dotClass;
    const icon = s === 'completed' ? '<span class="material-symbols-outlined" style="font-size: 0.75rem; color: #fff;">check</span>' : '';

    stepsHTML += `
      <div class="timeline-step">
        <div class="timeline-dot ${dotClass}">${s === 'completed' ? '' : ''}</div>
        <div class="timeline-step-text ${textClass}">${escapeHtml(step.step_name)}</div>
      </div>
    `;
  });

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">התקדמות</h2>
      <div class="portal-timeline">
        ${stepsHTML}
      </div>
    </div>
  `;
}

// ── Section 4: Plan vs Actual ──────────────────────────────────────
function renderPlanVsActual(deal, snapshot, categories, totals) {
  const plannedPurchase = parseFloat(snapshot.planned_purchase_price || deal.purchase_price || 0);
  const actualPurchase = parseFloat(deal.actual_purchase_price || 0);
  const plannedSale = parseFloat(snapshot.planned_sale_price || deal.expected_sale_price || 0);
  const actualSale = parseFloat(deal.actual_sale_price || 0);
  const plannedTotal = parseFloat(snapshot.planned_total_cost || 0);
  const actualTotal = parseFloat(totals.actual_total || 0) + (actualPurchase || 0);
  const plannedProfit = parseFloat(snapshot.planned_profit || 0);
  const plannedROI = parseFloat(snapshot.planned_roi || 0);

  // Compute actual profit and ROI
  const actualProfit = actualSale > 0 ? actualSale - actualTotal : 0;
  const actualROI = actualTotal > 0 && actualSale > 0 ? ((actualSale - actualTotal) / actualTotal * 100) : 0;

  let rowsHTML = '';

  // Purchase price row
  rowsHTML += planRow('מחיר רכישה', plannedPurchase, actualPurchase);

  // Category rows
  categories.forEach(cat => {
    let catPlanned = 0;
    let catActual = 0;
    (cat.items || []).forEach(item => {
      catPlanned += parseFloat(item.planned_amount || 0);
      catActual += parseFloat(item.actual_amount || 0);
    });
    if (catPlanned > 0 || catActual > 0) {
      rowsHTML += planRow(cat.name || 'קטגוריה', catPlanned, catActual);
    }
  });

  // Total costs
  rowsHTML += planRowTotal('סה"כ עלויות', plannedTotal, actualTotal > 0 ? actualTotal : null);

  // Sale price
  rowsHTML += `
    <tr>
      <td style="font-weight: 600;">מחיר מכירה</td>
      <td class="num-cell">${formatCurrency(plannedSale)}</td>
      <td class="num-cell ${deviationClass(plannedSale, actualSale)}">${actualSale > 0 ? formatCurrency(actualSale) : 'טרם נמכר'}</td>
    </tr>
  `;

  // Profit
  rowsHTML += `
    <tr class="total-row">
      <td style="font-weight: 700;">רווח גולמי</td>
      <td class="num-cell">${formatCurrency(plannedProfit)}</td>
      <td class="num-cell ${actualProfit !== 0 && plannedProfit !== 0 ? deviationClass(plannedProfit, actualProfit) : ''}">${actualSale > 0 ? formatCurrency(actualProfit) : '—'}</td>
    </tr>
  `;

  // ROI
  rowsHTML += `
    <tr>
      <td style="font-weight: 600;">תשואה</td>
      <td class="num-cell">${plannedROI ? plannedROI.toFixed(0) + '%' : '—'}</td>
      <td class="num-cell ${deviationClass(plannedROI, actualROI)}">${actualSale > 0 ? actualROI.toFixed(0) + '%' : '—'}</td>
    </tr>
  `;

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">תכנון מול ביצוע</h2>
      <div style="overflow-x: auto;">
        <table class="plan-table">
          <thead>
            <tr>
              <th>פריט</th>
              <th>תכנון</th>
              <th>בפועל</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function planRow(label, planned, actual) {
  const p = parseFloat(planned) || 0;
  const a = parseFloat(actual) || 0;
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="num-cell">${p > 0 ? formatCurrency(p) : '—'}</td>
      <td class="num-cell ${deviationClass(p, a)}">${a > 0 ? formatCurrency(a) : '—'}</td>
    </tr>
  `;
}

function planRowTotal(label, planned, actual) {
  return `
    <tr class="total-row">
      <td>${escapeHtml(label)}</td>
      <td class="num-cell">${planned > 0 ? formatCurrency(planned) : '—'}</td>
      <td class="num-cell ${actual && planned ? deviationClass(planned, actual) : ''}">${actual ? formatCurrency(actual) : '—'}</td>
    </tr>
  `;
}

// ── Section 5: Property Specs ──────────────────────────────────────
function renderSpecs(specs) {
  if (!specs || specs.length === 0) {
    return `
      <div class="deal-section mb-4">
        <h2 class="deal-section-title">מפרט הנכס</h2>
        <p class="deal-empty-state">מפרט הנכס יתעדכן בהמשך</p>
      </div>
    `;
  }

  let rowsHTML = '';
  specs.forEach(spec => {
    rowsHTML += `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(spec.spec_name)}</td>
        <td>${escapeHtml(spec.value_before) || '—'}</td>
        <td>${escapeHtml(spec.value_after) || '—'}</td>
      </tr>
    `;
  });

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">מפרט הנכס</h2>
      <div style="overflow-x: auto;">
        <table class="specs-table">
          <thead>
            <tr>
              <th>פריט</th>
              <th>לפני</th>
              <th>אחרי</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Section 6: Photo Gallery ───────────────────────────────────────
function renderGallery(images) {
  // Filter out thumbnails
  const galleryImages = images.filter(img => img.category !== 'thumbnail');

  if (!galleryImages || galleryImages.length === 0) {
    return `
      <div class="deal-section mb-4">
        <h2 class="deal-section-title">גלריית תמונות</h2>
        <p class="deal-empty-state">תמונות יתעדכנו בהמשך</p>
      </div>
    `;
  }

  // Group by category
  const groups = {};
  const categoryOrder = ['before', 'during', 'after', 'rendering', 'gallery'];

  galleryImages.forEach(img => {
    const cat = img.category || 'gallery';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(img);
  });

  let galHTML = '';
  categoryOrder.forEach(cat => {
    if (!groups[cat] || groups[cat].length === 0) return;
    const label = CATEGORY_LABELS[cat] || cat;
    galHTML += `<h3 class="gallery-category-title">${escapeHtml(label)}</h3>`;
    galHTML += `<div class="gallery-grid">`;
    groups[cat].forEach((img, idx) => {
      galHTML += `
        <img src="${escapeHtml(img.image_url)}"
             alt="${escapeHtml(img.alt_text || label)}"
             class="gallery-img"
             data-gallery-cat="${escapeHtml(cat)}"
             data-gallery-idx="${idx}"
             loading="lazy">
      `;
    });
    galHTML += `</div>`;
  });

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">גלריית תמונות</h2>
      ${galHTML}
    </div>
  `;
}

// ── Section 7: Market Comparables ──────────────────────────────────
function renderComps(comps) {
  if (!comps || comps.length === 0) {
    return `
      <div class="deal-section mb-4">
        <h2 class="deal-section-title">נכסים דומים שנמכרו באזור</h2>
        <p class="deal-empty-state">השוואות שוק יתעדכנו בהמשך</p>
      </div>
    `;
  }

  let cardsHTML = '';
  comps.forEach(comp => {
    const compImg = comp.image_url || (comp.images && comp.images.length > 0 ? comp.images[0].image_url : '');
    cardsHTML += `
      <div class="comp-card">
        ${compImg ? `<img src="${escapeHtml(compImg)}" alt="${escapeHtml(comp.address)}" class="comp-card-img" loading="lazy">` : ''}
        <div class="comp-card-body">
          <div class="comp-card-address">${escapeHtml(comp.address)}</div>
          <div class="comp-card-price mb-2">${formatCurrency(comp.sale_price)}</div>
          ${comp.sqft ? `<div class="comp-card-detail">שטח: <span style="font-family: 'Inter', sans-serif;">${Number(comp.sqft).toLocaleString()}</span> sqft</div>` : ''}
          ${comp.bedrooms || comp.bathrooms ? `
            <div class="comp-card-detail">
              ${comp.bedrooms ? 'חדרים: <span style="font-family: \'Inter\', sans-serif;">' + comp.bedrooms + '</span>' : ''}
              ${comp.bedrooms && comp.bathrooms ? ' | ' : ''}
              ${comp.bathrooms ? 'אמבטיות: <span style="font-family: \'Inter\', sans-serif;">' + comp.bathrooms + '</span>' : ''}
            </div>
          ` : ''}
          ${comp.sale_date ? `<div class="comp-card-detail">תאריך מכירה: <span style="font-family: 'Inter', sans-serif;">${formatDateShort(comp.sale_date)}</span></div>` : ''}
        </div>
      </div>
    `;
  });

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">נכסים דומים שנמכרו באזור</h2>
      <div class="comps-grid">
        ${cardsHTML}
      </div>
    </div>
  `;
}

// ── Section 8: Documents ───────────────────────────────────────────
function renderDocuments(documents) {
  if (!documents || documents.length === 0) {
    return `
      <div class="deal-section mb-4">
        <h2 class="deal-section-title">מסמכים</h2>
        <p class="deal-empty-state">אין מסמכים זמינים כרגע</p>
      </div>
    `;
  }

  const iconMap = {
    pdf: 'description',
    excel: 'table_chart',
    xlsx: 'table_chart',
    xls: 'table_chart',
    csv: 'table_chart',
    image: 'image',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    doc: 'description',
    docx: 'description'
  };

  let listHTML = '';
  documents.forEach(doc => {
    const fileType = (doc.file_type || '').toLowerCase();
    const icon = iconMap[fileType] || 'description';
    listHTML += `
      <div class="doc-item">
        <div class="doc-item-icon">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <span class="doc-item-title">${escapeHtml(doc.title)}</span>
        <a href="${escapeHtml(doc.file_url)}" target="_blank" rel="noopener" class="doc-download-btn" aria-label="הורד ${escapeHtml(doc.title)}">
          <span class="material-symbols-outlined">download</span>
        </a>
      </div>
    `;
  });

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">מסמכים</h2>
      ${listHTML}
    </div>
  `;
}

// ── Section 9: Renovation Plan ─────────────────────────────────────
function renderRenovationPlan(renovation) {
  if (!renovation) {
    return `
      <div class="deal-section mb-4">
        <h2 class="deal-section-title">תוכנית שיפוץ</h2>
        <p class="deal-empty-state">תוכנית השיפוץ תתעדכן בהמשך</p>
      </div>
    `;
  }

  let inner = '';

  // Total cost
  if (renovation.total_cost) {
    inner += `
      <div class="mb-4">
        <span class="text-sm" style="color: #43474e;">עלות כוללת:</span>
        <span style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.25rem; color: #984349; margin-right: 0.5rem;">
          ${formatCurrency(renovation.total_cost)}
        </span>
      </div>
    `;
  }

  // AI Summary
  if (renovation.ai_summary) {
    inner += `
      <div class="renovation-summary mb-4">
        ${escapeHtml(renovation.ai_summary)}
      </div>
    `;
  }

  // Phases
  let phases = null;
  if (renovation.phases_json) {
    try {
      phases = typeof renovation.phases_json === 'string' ? JSON.parse(renovation.phases_json) : renovation.phases_json;
    } catch (e) { /* ignore parse error */ }
  }
  if (renovation.phases && Array.isArray(renovation.phases)) {
    phases = renovation.phases;
  }

  if (phases && phases.length > 0) {
    inner += `<div class="mt-4">`;
    inner += `<h3 class="text-sm font-semibold mb-2" style="color: #022445;">שלבי השיפוץ</h3>`;
    phases.forEach(phase => {
      inner += `
        <div class="renovation-phase">
          <span style="color: #1b1c1a; font-weight: 500;">${escapeHtml(phase.name || phase.phase_name || '')}</span>
          ${phase.cost || phase.amount ? `<span style="font-family: 'Inter', sans-serif; font-weight: 600; color: #43474e;">${formatCurrency(phase.cost || phase.amount)}</span>` : ''}
        </div>
      `;
    });
    inner += `</div>`;
  }

  return `
    <div class="deal-section mb-4">
      <h2 class="deal-section-title">תוכנית שיפוץ</h2>
      ${inner}
    </div>
  `;
}

// ── Lightbox ───────────────────────────────────────────────────────
let lightboxImages = [];
let lightboxIndex = 0;

function initLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  const img = document.getElementById('lightboxImg');
  if (!overlay || !img) return;

  // Click on gallery images
  document.querySelectorAll('.gallery-img').forEach(el => {
    el.addEventListener('click', function () {
      const cat = this.dataset.galleryCat;
      const idx = parseInt(this.dataset.galleryIdx);

      // Collect all images in the same category
      lightboxImages = [];
      document.querySelectorAll('.gallery-img[data-gallery-cat="' + cat + '"]').forEach(i => {
        lightboxImages.push(i.src);
      });
      lightboxIndex = idx;
      openLightbox();
    });
  });

  // Close
  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeLightbox();
  });

  // Nav
  overlay.querySelector('.lightbox-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightbox();
  });
  overlay.querySelector('.lightbox-next').addEventListener('click', function (e) {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
  });

  // Keyboard
  document.addEventListener('keydown', function (e) {
    if (overlay.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') {
      lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
      updateLightbox();
    }
    if (e.key === 'ArrowLeft') {
      lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
      updateLightbox();
    }
  });
}

function openLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  updateLightbox();
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const overlay = document.getElementById('lightboxOverlay');
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 200);
}

function updateLightbox() {
  const img = document.getElementById('lightboxImg');
  if (lightboxImages[lightboxIndex]) {
    img.src = lightboxImages[lightboxIndex];
  }
}

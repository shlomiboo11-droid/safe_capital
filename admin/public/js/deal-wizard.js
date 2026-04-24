/**
 * Deal Wizard — AI-powered document extraction flow
 * Step 1: Upload 3 documents + Zillow URL
 * Step 2: AI extraction (processing)
 * Step 3: Review, edit, and save
 *
 * NEW: Single AI call analyzes all documents together.
 * Response shape: { ai_result: { property_info, calculator, renovation_plan, financing, summary, cross_check } }
 */

// ── Document Types ───────────────────────────────────────────
const DOC_TYPES = [
  { id: 'calculator', label: 'מחשבון פיננסי', description: 'קובץ XLSX עם כל הנתונים הפיננסיים', icon: 'table_chart', accept: '.xlsx,.xls', color: 'text-blue-600 bg-blue-50', required: true, inputType: 'file' },
  { id: 'loan_application', label: 'חוזה הלוואה', description: 'PDF: סכום, ריבית, תנאי מימון', icon: 'account_balance', accept: '.pdf', color: 'text-green-600 bg-green-50', required: true, inputType: 'file' },
  { id: 'renovation_plan', label: 'תכנית שיפוץ', description: 'PDF: תקציב, שלבי תשלום, קבלן', icon: 'construction', accept: '.pdf', color: 'text-yellow-700 bg-yellow-50', required: true, inputType: 'file' },
  { id: 'zillow', label: 'קישור Zillow', description: 'URL של הנכס ב-Zillow', icon: 'link', color: 'text-purple-600 bg-purple-50', required: true, inputType: 'url' }
];

// ── State ────────────────────────────────────────────────────
let uploadedFiles = {};
let zillowUrl = '';
let aiResult = null; // The AI response
let currentStep = 1;

// ── API Test ─────────────────────────────────────────────────
async function testApiConnection() {
  const btn = document.querySelector('button[onclick="testApiConnection()"]');
  const result = document.getElementById('apiTestResult');
  btn.textContent = 'בודק...';
  btn.disabled = true;
  result.className = 'text-xs px-3 py-1.5 rounded-full font-medium';

  try {
    const data = await API.get('/extract/test');
    result.textContent = 'API תקין';
    result.classList.add('bg-green-100', 'text-green-700');
  } catch (err) {
    result.textContent = `שגיאה: ${err.message}`;
    result.classList.add('bg-red-100', 'text-red-700');
  } finally {
    btn.textContent = 'בדוק API';
    btn.disabled = false;
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderUploadCards();
  updateExtractButton();

  document.getElementById('btnStartExtraction').addEventListener('click', startExtraction);
  document.getElementById('btnSaveAsNew').addEventListener('click', saveDealFromExtraction);

  const backBtn = document.getElementById('btnBackToUpload');
  if (backBtn) backBtn.addEventListener('click', () => goToStep(1));
});

// ── Step 1: Upload cards ─────────────────────────────────────
function renderUploadCards() {
  const container = document.getElementById('docTypeGrid');
  container.innerHTML = DOC_TYPES.map(dt => {
    if (dt.inputType === 'url') {
      return `
      <div class="card p-5 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-2xl ${dt.color} p-2 rounded-lg">${dt.icon}</span>
          <div>
            <h4 class="font-bold text-sm">${dt.label} ${dt.required ? '<span class="text-red-500">*</span>' : ''}</h4>
            <p class="text-xs text-gray-500">${dt.description}</p>
          </div>
        </div>
        <input type="url" class="form-input ltr text-sm" dir="ltr"
          placeholder="https://www.zillow.com/homedetails/..."
          oninput="zillowUrl = this.value.trim(); updateExtractButton();">
      </div>`;
    }
    return `
    <div class="card p-5 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-2xl ${dt.color} p-2 rounded-lg">${dt.icon}</span>
        <div>
          <h4 class="font-bold text-sm">${dt.label} ${dt.required ? '<span class="text-red-500">*</span>' : ''}</h4>
          <p class="text-xs text-gray-500">${dt.description}</p>
        </div>
      </div>
      <div class="upload-zone" ondrop="handleDrop(event, '${dt.id}')" ondragover="event.preventDefault(); this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')">
        <span class="material-symbols-outlined text-xl text-gray-400 mb-1">cloud_upload</span>
        <span class="text-xs text-gray-500">גרור קובץ לכאן או</span>
        <label class="text-xs text-primary font-bold cursor-pointer hover:underline">
          לחץ לבחירה
          <input type="file" accept="${dt.accept}" class="hidden" onchange="handleFileSelect(this, '${dt.id}')">
        </label>
      </div>
      <div id="files-${dt.id}" class="text-xs text-gray-600"></div>
    </div>`;
  }).join('');
}

function handleDrop(e, docType) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    uploadedFiles[docType] = files;
    showFileNames(docType);
    updateExtractButton();
  }
}

function handleFileSelect(input, docType) {
  const files = Array.from(input.files);
  if (files.length > 0) {
    uploadedFiles[docType] = files;
    showFileNames(docType);
    updateExtractButton();
  }
}

function showFileNames(docType) {
  const div = document.getElementById(`files-${docType}`);
  if (!div) return;
  const files = uploadedFiles[docType] || [];
  div.innerHTML = files.map(f =>
    `<div class="flex items-center gap-1 mt-1">
      <span class="material-symbols-outlined text-xs text-green-500">check_circle</span>
      <span class="truncate">${f.name}</span>
      <span class="text-gray-300 font-inter">(${(f.size / 1024).toFixed(0)} KB)</span>
    </div>`
  ).join('');
}

function updateExtractButton() {
  const btn = document.getElementById('btnStartExtraction');
  const fileTypesReady = DOC_TYPES
    .filter(dt => dt.inputType === 'file')
    .every(dt => uploadedFiles[dt.id] && uploadedFiles[dt.id].length > 0);
  const zillowReady = zillowUrl.startsWith('http') && zillowUrl.includes('zillow.com');
  btn.disabled = !(fileTypesReady && zillowReady);
}

// ── Step 2: AI Extraction ────────────────────────────────────
async function startExtraction() {
  goToStep(2);

  const progressEl = document.getElementById('extractionProgress');
  const statusEl = document.getElementById('extractionStatus');
  const logEl = document.getElementById('extractionLog');

  const formData = new FormData();
  const allTypes = [];

  for (const [docType, files] of Object.entries(uploadedFiles)) {
    for (const file of files) {
      formData.append('files', file);
      allTypes.push(docType);
    }
  }
  for (const t of allTypes) formData.append('types', t);
  formData.append('zillow_url', zillowUrl);

  let logMessages = [];
  function addLog(msg) {
    logMessages.push(msg);
    logEl.innerHTML = logMessages.map(m => `<div>${m}</div>`).join('');
  }

  addLog('מעלה מסמכים ושולח לניתוח AI...');
  progressEl.style.width = '20%';

  try {
    statusEl.textContent = 'Claude AI מנתח את כל המסמכים ביחד...';
    progressEl.style.width = '40%';

    const result = await API.upload('/extract/upload', formData);

    progressEl.style.width = '90%';
    addLog('הניתוח הושלם!');

    if (result.ai_result) {
      aiResult = result.ai_result;
      if (result.zillow_url && aiResult.property_info) {
        aiResult.property_info.zillow_url = result.zillow_url;
      }
      addLog(`שם נכס: ${aiResult.property_info?.name || 'לא זוהה'}`);
      addLog(`מחיר רכישה: ${aiResult.summary?.purchase_price ? formatCurrency(aiResult.summary.purchase_price) : 'לא זוהה'}`);
      addLog(`ARV: ${aiResult.summary?.arv ? formatCurrency(aiResult.summary.arv) : 'לא זוהה'}`);
      addLog(`רווח נטו: ${aiResult.summary?.net_profit ? formatCurrency(aiResult.summary.net_profit) : 'לא זוהה'}`);
    }

    progressEl.style.width = '100%';
    statusEl.textContent = 'הניתוח הושלם בהצלחה!';

    setTimeout(() => {
      goToStep(3);
      renderReviewStep();
    }, 800);

  } catch (err) {
    statusEl.textContent = 'שגיאה בניתוח';
    addLog(`שגיאה: ${err.message}`);
    progressEl.style.width = '100%';
    progressEl.style.background = '#ef4444';
    logEl.innerHTML += `<div class="mt-4">
      <button class="btn btn-primary btn-sm" onclick="startExtraction()">נסה שוב</button>
      <button class="btn btn-secondary btn-sm mr-2" onclick="goToStep(1)">חזור להעלאה</button>
    </div>`;
  }
}

// ── Step 3: Review & Edit ────────────────────────────────────
function renderReviewStep() {
  const container = document.getElementById('reviewContent');
  if (!aiResult) {
    container.innerHTML = '<div class="card p-6 text-center text-gray-500">לא נמצאו נתונים לסקירה</div>';
    return;
  }

  const info = aiResult.property_info || {};
  const calculator = aiResult.calculator || [];
  const summary = aiResult.summary || {};
  const renovation = aiResult.renovation_plan || null;
  const financing = aiResult.financing || {};
  const crossCheck = aiResult.cross_check || {};

  // ── Section 1: Property Info ──────────────────────────────
  const propertyHtml = `
  <div class="card p-6 mb-6">
    <h3 class="text-lg font-bold mb-4">
      <span class="material-symbols-outlined text-primary align-middle ml-1">home</span>
      פרטי נכס
    </h3>
    <div class="space-y-1">
      <div class="field-row">
        <label class="form-label mb-0">שם העסקה</label>
        <input type="text" class="form-input text-sm" value="${esc(info.name)}"
          onchange="aiResult.property_info.name = this.value">
      </div>
      <div class="field-row">
        <label class="form-label mb-0">כתובת מלאה</label>
        <input type="text" class="form-input ltr text-sm" dir="ltr" value="${esc(info.full_address)}"
          onchange="aiResult.property_info.full_address = this.value">
      </div>
      <div class="field-row">
        <label class="form-label mb-0">עיר</label>
        <input type="text" class="form-input ltr text-sm" dir="ltr" value="${esc(info.city)}"
          onchange="aiResult.property_info.city = this.value">
      </div>
      <div class="field-row">
        <label class="form-label mb-0">מדינה</label>
        <input type="text" class="form-input ltr text-sm w-24" dir="ltr" value="${esc(info.state)}"
          onchange="aiResult.property_info.state = this.value">
      </div>
      <div class="field-row">
        <label class="form-label mb-0">Zillow URL</label>
        <input type="url" class="form-input ltr text-sm" dir="ltr" value="${esc(info.zillow_url)}"
          onchange="aiResult.property_info.zillow_url = this.value">
      </div>
      <div class="field-row">
        <label class="form-label mb-0">משך פרויקט</label>
        <input type="number" min="1" max="60" step="1" class="form-input ltr text-sm" dir="ltr"
          value="${info.project_duration_months || ''}" placeholder="8"
          onchange="aiResult.property_info.project_duration_months = parseInt(this.value) || null">
        <span class="text-sm" style="color: #6b7280; white-space: nowrap;">חודשים</span>
      </div>
    </div>
  </div>`;

  // ── Calculate additional costs (everything except purchase + renovation) ──
  const additionalCosts = (summary.total_investment || 0) - (summary.purchase_price || 0) - (summary.renovation_cost || 0);

  // ── Section 2: Four financial cards ───────────────────────
  const cardsHtml = `
  <div class="card p-6 mb-6">
    <h3 class="text-lg font-bold mb-4">
      <span class="material-symbols-outlined text-primary align-middle ml-1">payments</span>
      נתונים פיננסיים ראשיים
    </h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-surface-container-low p-5 rounded-lg text-center">
        <div class="text-sm text-on-surface-variant mb-1 font-bold">עלות רכישה</div>
        <div class="text-xl font-bold font-inter text-primary" dir="ltr" id="card-purchase">
          ${summary.purchase_price ? formatCurrency(summary.purchase_price) : '—'}
        </div>
      </div>
      <div class="bg-surface-container-low p-5 rounded-lg text-center">
        <div class="text-sm text-on-surface-variant mb-1 font-bold">עלות שיפוץ</div>
        <div class="text-xl font-bold font-inter text-primary" dir="ltr" id="card-renovation">
          ${summary.renovation_cost ? formatCurrency(summary.renovation_cost) : '—'}
        </div>
      </div>
      <div class="bg-surface-container-low p-5 rounded-lg text-center">
        <div class="text-sm text-on-surface-variant mb-1 font-bold">עלויות נוספות</div>
        <div class="text-xl font-bold font-inter text-primary" dir="ltr" id="card-additional">
          ${additionalCosts > 0 ? formatCurrency(additionalCosts) : '—'}
        </div>
        <div class="text-xs text-gray-400 mt-1">מימון, החזקה, מכירה</div>
      </div>
      <div class="bg-surface-container-low p-5 rounded-lg text-center">
        <div class="text-sm text-on-surface-variant mb-1 font-bold">מחיר מכירה (ARV)</div>
        <div class="text-xl font-bold font-inter text-secondary" dir="ltr" id="card-arv">
          ${summary.arv ? formatCurrency(summary.arv) : '—'}
        </div>
      </div>
    </div>
  </div>`;

  // ── Section 2.5: AI Deal Description ──────────────────────
  // Check multiple possible paths for the deal description
  const dealDescription = aiResult.deal_description || aiResult.summary?.deal_description || '';
  // Always show the description section — either with AI text or empty for manual entry
  const descriptionHtml = `
  <div class="card p-6 mb-6">
    <h3 class="text-lg font-bold mb-3">
      <span class="material-symbols-outlined text-primary align-middle ml-1">description</span>
      תיאור העסקה
    </h3>
    <textarea class="form-input text-sm w-full" rows="4" dir="rtl"
      onchange="aiResult.deal_description = this.value">${esc(dealDescription)}</textarea>
    <div class="text-xs text-gray-400 mt-1">${dealDescription ? 'נוצר אוטומטית ע״י AI — ניתן לעריכה' : 'לא נוצר תיאור אוטומטי — ניתן להזין ידנית'}</div>
  </div>`;

  // ── Section 3: Calculator (תחשיב עסקה) ────────────────────
  let calculatorHtml = '';
  if (calculator.length > 0) {
    let rows = '';
    for (let ci = 0; ci < calculator.length; ci++) {
      const cat = calculator[ci];
      // Category header
      rows += `<tr class="bg-gray-50">
        <td colspan="2" class="font-bold text-sm text-primary py-3 px-4">${esc(cat.category)}</td>
      </tr>`;
      // Items
      if (cat.items) {
        for (let ii = 0; ii < cat.items.length; ii++) {
          const item = cat.items[ii];
          if (!item.amount || item.amount <= 0) continue;
          rows += `<tr>
            <td class="text-sm py-2 px-4">${esc(item.label)}</td>
            <td class="py-2 px-4 text-left" style="width: 160px;">
              <input type="text" inputmode="numeric" data-currency="true"
                class="form-input ltr text-sm w-full text-left" dir="ltr"
                value="${formatCurrency(item.amount)}"
                onfocus="unformatCurrencyInput(this)"
                onblur="formatCurrencyInput(this)"
                onchange="aiResult.calculator[${ci}].items[${ii}].amount = parseAmount(this.value); recalcAllTotals();">
            </td>
          </tr>`;
        }
      }
      // Category total
      rows += `<tr class="border-t border-gray-200">
        <td class="font-bold text-sm py-2 px-4">סה"כ ${esc(cat.category)}</td>
        <td class="py-2 px-4 font-bold font-inter text-left" dir="ltr" style="width: 160px;" id="cat-total-${ci}">${formatCurrency(cat.total || 0)}</td>
      </tr>`;
    }
    // Net profit at bottom
    rows += `<tr class="border-t-2 border-gray-300">
      <td class="font-bold text-sm py-3 px-4">רווח נטו משוער</td>
      <td class="py-3 px-4 font-bold font-inter text-green-600 text-left" dir="ltr" style="width: 160px;" id="net-profit-display">${formatCurrency(summary.net_profit || 0)}</td>
    </tr>`;

    calculatorHtml = `
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">
        <span class="material-symbols-outlined text-primary align-middle ml-1">calculate</span>
        תחשיב עסקה
      </h3>
      <table class="data-table">
        <thead><tr><th>פריט</th><th class="text-left" style="width: 160px;">סכום</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ── Section 4: Renovation Plan ─────────────────────────────
  let renovationHtml = '';
  if (renovation && renovation.phases && renovation.phases.length > 0) {
    const phaseRows = renovation.phases.map((p, pi) => `
      <tr>
        <td class="font-inter text-sm py-2">${p.phase || (pi + 1)}</td>
        <td class="text-sm py-2">${esc(p.title)}</td>
        <td class="font-inter text-sm py-2" dir="ltr">
          <input type="text" inputmode="numeric" data-currency="true"
            class="form-input ltr text-sm w-32" dir="ltr"
            value="${p.amount ? formatCurrency(p.amount) : ''}"
            onfocus="unformatCurrencyInput(this)"
            onblur="formatCurrencyInput(this)"
            onchange="aiResult.renovation_plan.phases[${pi}].amount = parseAmount(this.value); recalcAllTotals();">
        </td>
        <td class="text-xs text-gray-600 py-2 leading-relaxed">${esc(p.description_ai)}</td>
      </tr>
    `).join('');

    renovationHtml = `
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">
        <span class="material-symbols-outlined text-primary align-middle ml-1">construction</span>
        תכנית שיפוץ
      </h3>
      ${renovation.total_cost ? `
        <div class="bg-surface-container-low p-4 rounded-lg mb-4 text-center">
          <span class="text-sm text-on-surface-variant font-bold">עלות כוללת:</span>
          <span class="text-xl font-bold font-inter text-primary mr-2" dir="ltr" id="reno-total-display">${formatCurrency(renovation.total_cost)}</span>
          ${renovation.contractor ? `<span class="text-xs text-gray-500">| קבלן: ${esc(renovation.contractor)}</span>` : ''}
        </div>` : ''}
      <table class="data-table">
        <thead><tr><th>#</th><th>שלב</th><th>סכום</th><th>הסבר</th></tr></thead>
        <tbody>${phaseRows}</tbody>
      </table>
    </div>`;
  }

  // ── Section 5: Financing (organized grid) ───────────────────
  let financingHtml = '';
  if (financing.loan_amount || financing.lender_name) {
    financingHtml = `
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">
        <span class="material-symbols-outlined text-primary align-middle ml-1">account_balance</span>
        פרטי הלוואה
      </h3>
      <table class="data-table">
        <tbody>
          ${financing.lender_name ? `<tr><td class="text-sm py-2 px-4 font-bold">שם המלווה</td><td class="text-sm py-2 px-4">${esc(financing.lender_name)}</td></tr>` : ''}
          ${financing.loan_amount ? `<tr><td class="text-sm py-2 px-4 font-bold">סכום הלוואה</td><td class="text-sm py-2 px-4 font-inter" dir="ltr">${formatCurrency(financing.loan_amount)}</td></tr>` : ''}
          ${financing.interest_rate_annual ? `<tr><td class="text-sm py-2 px-4 font-bold">ריבית שנתית</td><td class="text-sm py-2 px-4">${financing.interest_rate_annual}%</td></tr>` : ''}
          ${financing.monthly_payment ? `<tr><td class="text-sm py-2 px-4 font-bold">תשלום חודשי</td><td class="text-sm py-2 px-4 font-inter" dir="ltr">${formatCurrency(financing.monthly_payment)}</td></tr>` : ''}
          ${financing.loan_term_months ? `<tr><td class="text-sm py-2 px-4 font-bold">תקופה</td><td class="text-sm py-2 px-4">${financing.loan_term_months} חודשים</td></tr>` : ''}
          ${financing.total_finance_cost ? `<tr class="border-t border-gray-200"><td class="text-sm py-2 px-4 font-bold">עלות מימון כוללת</td><td class="text-sm py-2 px-4 font-bold font-inter" dir="ltr">${formatCurrency(financing.total_finance_cost)}</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
  }

  // ── Section 6: Cross-check ─────────────────────────────────
  let crossCheckHtml = '';
  if (crossCheck.notes && crossCheck.notes.length > 0) {
    crossCheckHtml = `
    <div class="card p-6 mb-6">
      <h3 class="text-sm font-bold text-gray-500 mb-3">
        <span class="material-symbols-outlined text-sm align-middle ml-1">fact_check</span>
        הצלבת מסמכים
      </h3>
      <ul class="text-sm text-gray-600 space-y-1">
        ${crossCheck.notes.map(n => `<li>• ${esc(n)}</li>`).join('')}
      </ul>
    </div>`;
  }

  // ── Section 7: Specs ───────────────────────────────────────
  let specsHtml = '';
  if (info.specs_before && info.specs_after) {
    const specs = [
      { name: 'חדרי שינה', before: info.specs_before.bedrooms, after: info.specs_after.bedrooms },
      { name: 'חדרי רחצה', before: info.specs_before.bathrooms, after: info.specs_after.bathrooms },
      { name: 'שטח (sqft)', before: info.specs_before.sqft, after: info.specs_after.sqft }
    ].filter(s => s.before || s.after);

    if (specs.length > 0) {
      specsHtml = `
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-bold mb-4">
          <span class="material-symbols-outlined text-primary align-middle ml-1">compare_arrows</span>
          מפרט לפני / אחרי
        </h3>
        <table class="data-table">
          <thead><tr><th>מאפיין</th><th>לפני</th><th>אחרי</th></tr></thead>
          <tbody>
            ${specs.map(s => `<tr>
              <td class="text-sm font-bold">${s.name}</td>
              <td class="text-sm">${s.before || '—'}</td>
              <td class="text-sm font-bold text-secondary">${s.after || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }
  }

  container.innerHTML = propertyHtml + cardsHtml + descriptionHtml + calculatorHtml + renovationHtml + financingHtml + crossCheckHtml + specsHtml;
  recalcAllTotals();
}

// ── Recalculate all totals when any amount changes ──────────
function recalcAllTotals() {
  if (!aiResult) return;
  const calculator = aiResult.calculator || [];

  // Recalc each category total
  for (let ci = 0; ci < calculator.length; ci++) {
    const cat = calculator[ci];
    const newTotal = (cat.items || []).reduce((sum, item) => sum + parseAmount(item.amount), 0);
    cat.total = newTotal;
    const el = document.getElementById(`cat-total-${ci}`);
    if (el) el.textContent = formatCurrency(newTotal);
  }

  // Recalc summary
  const summary = aiResult.summary || {};
  const REVENUE_RX = /הכנס|תקבול|\bARV\b|revenue|income/i;
  const isRevenueCat = (cat) => cat.type === 'revenue' || REVENUE_RX.test(cat.category || '');
  const totalInvestment = calculator
    .filter(cat => !isRevenueCat(cat))
    .reduce((sum, cat) => sum + parseAmount(cat.total), 0);
  summary.total_investment = totalInvestment;
  const netProfit = parseAmount(summary.arv) - totalInvestment;
  summary.net_profit = netProfit;

  const profitEl = document.getElementById('net-profit-display');
  if (profitEl) {
    profitEl.textContent = formatCurrency(netProfit);
    profitEl.className = `py-3 px-4 font-bold font-inter text-left ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`;
  }

  // Recalc renovation total
  let renoPhasesTotal = 0;
  if (aiResult.renovation_plan && aiResult.renovation_plan.phases) {
    renoPhasesTotal = aiResult.renovation_plan.phases.reduce((sum, p) => sum + parseAmount(p.amount), 0);
    aiResult.renovation_plan.total_cost = renoPhasesTotal;
    const renoEl = document.getElementById('reno-total-display');
    if (renoEl) renoEl.textContent = formatCurrency(renoPhasesTotal);
  }

  // ── Sync top cards ──────────────────────────
  const PURCHASE_RX = /רכיש|purchase/i;
  const RENO_RX = /שיפוץ|renovation/i;
  const purchaseCat = calculator.find(c => PURCHASE_RX.test(c.category || ''));
  const renoCat = calculator.find(c => RENO_RX.test(c.category || ''));

  const purchaseAmt = purchaseCat
    ? parseAmount(purchaseCat.total)
    : parseAmount(summary.purchase_price);

  const renoAmt = renoPhasesTotal > 0
    ? renoPhasesTotal
    : (renoCat ? parseAmount(renoCat.total) : 0);

  summary.purchase_price = purchaseAmt;
  summary.renovation_cost = renoAmt;

  const additional = totalInvestment - purchaseAmt - renoAmt;

  const setCard = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val && val > 0) ? formatCurrency(val) : '—';
  };
  setCard('card-purchase', purchaseAmt);
  setCard('card-renovation', renoAmt);
  setCard('card-additional', additional);
  setCard('card-arv', parseAmount(summary.arv));
}

// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Save ─────────────────────────────────────────────────────
async function saveDealFromExtraction() {
  if (!aiResult) return;

  const btn = document.getElementById('btnSaveAsNew');
  btn.disabled = true;
  btn.innerHTML = '<span class="extraction-spinner"></span> שומר...';

  try {
    const REVENUE_RX = /הכנס|תקבול|\bARV\b|revenue|income/i;
    const payload = {
      ...aiResult,
      calculator: (aiResult.calculator || []).filter(c => c.type !== 'revenue' && !REVENUE_RX.test(c.category || ''))
    };
    const result = await API.post('/extract/create-and-apply', payload);
    showToast('העסקה נוצרה בהצלחה!');
    setTimeout(() => {
      window.location.href = `/deal?id=${result.deal_id}`;
    }, 500);
  } catch (err) {
    showToast(`שגיאה בשמירה: ${err.message}`, 'error');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> שמור כעסקה חדשה';
  }
}

// ── Step Navigation ──────────────────────────────────────────
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('.wizard-page').forEach(el => el.classList.add('hidden'));
  document.getElementById(`step${step}`).classList.remove('hidden');

  for (let i = 1; i <= 3; i++) {
    const dot = document.querySelector(`.step-dot[data-step="${i}"]`);
    const line = document.querySelector(`.step-line[data-line="${i - 1}"]`);

    dot.classList.remove('active', 'completed');
    if (i < step) {
      dot.classList.add('completed');
      dot.innerHTML = '<span class="material-symbols-outlined text-sm">check</span>';
    } else if (i === step) {
      dot.classList.add('active');
      dot.textContent = i;
    } else {
      dot.textContent = i;
    }

    if (line) {
      line.classList.toggle('completed', i < step);
    }
  }
}

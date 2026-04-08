/**
 * Utility functions for formatting, computations, and DOM helpers
 */

// ── Number formatting ──────────────────────────────────────

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '0%';
  return value.toFixed(decimals) + '%';
}

function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('he-IL');
}

// ── Parse numbers from formatted strings ───────────────────

function parseAmount(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0;
}

// ── Currency input formatting ───────────────────────────────
// Apply to any <input> that holds a dollar amount.
// On focus: strip formatting so user sees raw number.
// On blur: reformat with $ and commas for display.

function formatCurrencyInput(input) {
  const raw = parseAmount(input.value);
  if (raw === 0 && input.value.trim() === '') {
    input.value = '';
  } else if (!isNaN(raw) && raw !== 0) {
    input.value = formatCurrency(raw);
  }
}

function unformatCurrencyInput(input) {
  const raw = parseAmount(input.value);
  input.value = raw === 0 ? '' : String(raw);
}

/**
 * Bind focus/blur currency formatting to all inputs with data-currency="true"
 * Call once after DOM is ready or after re-renders.
 */
function bindCurrencyInputs(container) {
  const scope = container || document;
  scope.querySelectorAll('input[data-currency="true"]').forEach(input => {
    // Remove old listeners by cloning (in case of re-render)
    input.addEventListener('focus', () => unformatCurrencyInput(input));
    input.addEventListener('blur', () => formatCurrencyInput(input));
    // Format on initial bind if has value
    if (input.value && input.value !== '0') {
      const raw = parseAmount(input.value);
      if (!isNaN(raw) && raw !== 0) input.value = formatCurrency(raw);
    }
  });
}

// ── Deviation status ───────────────────────────────────────

function getDeviationStatus(planned, actual) {
  if (!planned || planned === 0) return { class: 'badge-gray', label: '--' };
  const pct = ((actual - planned) / planned) * 100;
  if (pct <= 0) return { class: 'badge-green', label: 'בתקציב', color: 'deviation-green' };
  if (pct <= 10) return { class: 'badge-yellow', label: 'חריגה קלה', color: 'deviation-yellow' };
  return { class: 'badge-red', label: 'חריגה', color: 'deviation-red' };
}

// ── Property status labels (Hebrew) ────────────────────────

const PROPERTY_STATUS = {
  fundraising: 'גיוס משקיעים',
  sourcing: 'איתור',
  purchased: 'נרכש',
  planning: 'בתכנון',
  renovation: 'בשיפוץ',
  selling: 'למכירה',
  sold: 'נמכר'
};

const FUNDRAISING_STATUS = {
  upcoming: 'טרם התחיל',
  active: 'בגיוס',
  completed: 'גיוס הושלם',
  closed: 'סגור'
};

const PROPERTY_STATUS_BADGE = {
  fundraising: 'badge-blue',
  sourcing: 'badge-gray',
  purchased: 'badge-blue',
  planning: 'badge-yellow',
  renovation: 'badge-yellow',
  selling: 'badge-blue',
  sold: 'badge-green'
};

const FUNDRAISING_STATUS_BADGE = {
  upcoming: 'badge-gray',
  active: 'badge-blue',
  completed: 'badge-green',
  closed: 'badge-green'
};

// ── DOM helpers ────────────────────────────────────────────

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function createElement(tag, attrs = {}, children = '') {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class') el.className = val;
    else if (key === 'html') el.innerHTML = val;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
    else if (key.startsWith('data-')) el.setAttribute(key, val);
    else el[key] = val;
  }
  if (typeof children === 'string') el.innerHTML = children;
  else if (children instanceof HTMLElement) el.appendChild(children);
  return el;
}

// ── Toast notifications ────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = createElement('div', { class: `toast toast-${type}` }, message);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Branded Modal Dialogs ──────────────────────────────────

/**
 * Show a branded prompt modal (replaces native prompt()).
 * @param {string} title - Modal title
 * @param {string} placeholder - Input placeholder
 * @param {string} [defaultValue=''] - Default input value
 * @returns {Promise<string|null>} Resolves with input value or null if cancelled
 */
function showPromptModal(title, placeholder, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
      <div class="branded-modal">
        <h3 class="branded-modal-title">${title}</h3>
        <input type="text" class="branded-modal-input" placeholder="${placeholder || ''}" value="${defaultValue}">
        <div class="branded-modal-actions">
          <button type="button" class="branded-modal-btn branded-modal-btn-primary" data-action="ok">אישור</button>
          <button type="button" class="branded-modal-btn branded-modal-btn-secondary" data-action="cancel">ביטול</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.branded-modal-input');
    const okBtn = overlay.querySelector('[data-action="ok"]');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');

    function cleanup(value) {
      overlay.remove();
      resolve(value);
    }

    okBtn.addEventListener('click', () => cleanup(input.value || null));
    cancelBtn.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cleanup(input.value || null);
      if (e.key === 'Escape') cleanup(null);
    });

    // Focus input after render
    requestAnimationFrame(() => input.focus());
  });
}

/**
 * Show a branded confirm modal (replaces native confirm()).
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} Resolves with true (confirm) or false (cancel)
 */
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
      <div class="branded-modal">
        <h3 class="branded-modal-title">${title}</h3>
        <p class="branded-modal-message">${message}</p>
        <div class="branded-modal-actions">
          <button type="button" class="branded-modal-btn branded-modal-btn-danger" data-action="ok">אישור</button>
          <button type="button" class="branded-modal-btn branded-modal-btn-secondary" data-action="cancel">ביטול</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const okBtn = overlay.querySelector('[data-action="ok"]');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');

    function cleanup(value) {
      overlay.remove();
      resolve(value);
    }

    okBtn.addEventListener('click', () => cleanup(true));
    cancelBtn.addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    // Focus the confirm button
    requestAnimationFrame(() => okBtn.focus());
  });
}

// ── Confirm dialog (async branded) ────────────────────────

async function confirmAction(message) {
  return await showConfirmModal('אישור', message);
}

// ── Toggle switch helper ───────────────────────────────────

function initToggles() {
  document.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const input = toggle.querySelector('input[type="hidden"]') || toggle.previousElementSibling;
      if (input) input.value = toggle.classList.contains('active') ? '1' : '0';
    });
  });
}

// ── Tab navigation ─────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabGroup = btn.closest('.tab-container');
      const target = btn.dataset.tab;

      // Deactivate all tabs
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabGroup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Activate clicked tab
      btn.classList.add('active');
      const content = tabGroup.querySelector(`[data-tab-content="${target}"]`);
      if (content) content.classList.add('active');
    });
  });
}

// ── URL params ─────────────────────────────────────────────

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getDealIdFromUrl() {
  // Support /deal?id=123 or /deal/123
  const param = getUrlParam('id');
  if (param) return param;
  const match = window.location.pathname.match(/\/deal\/(\d+)/);
  return match ? match[1] : null;
}

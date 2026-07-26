/**
 * pitch.js — Safe Capital Investor Pitch Deck
 *
 * Navigation:
 *   ← / →           Next / Prev (RTL: ← = next, → = prev)
 *   PageDown / Space  Next
 *   PageUp           Prev
 *   Home             Slide 1
 *   Esc              Back to slide 1 (or 6 if currently on hidden 6.5)
 *   Cmd/Ctrl+Shift+H Toggle hidden internal slide 6.5
 *
 * Live data:
 *   Slide 7 fetches /api/public/deals and renders the Oxmoore deal
 *   (or first featured/active deal as fallback).
 */

(() => {
  // ── Config ─────────────────────────────────────────────────
  const ADMIN_HOST = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://admin.safecapital.co.il';
  const DEALS_API = ADMIN_HOST + '/api/public/deals';

  // ── State ──────────────────────────────────────────────────
  const slides = Array.from(document.querySelectorAll('#deck .slide'));
  const visibleSlides = slides.filter(s => !s.hasAttribute('data-internal'));
  const internalSlide = slides.find(s => s.hasAttribute('data-internal'));
  const counter = document.querySelector('[data-counter]');
  const prevBtn = document.querySelector('[data-prev]');
  const nextBtn = document.querySelector('[data-next]');

  let currentIndex = 0;       // index into visibleSlides
  let internalShown = false;
  let dealLoaded = false;

  // ── Render ─────────────────────────────────────────────────
  function showSlide(index, { internal = false } = {}) {
    slides.forEach(s => s.classList.remove('is-active'));

    if (internal && internalSlide) {
      internalSlide.classList.add('is-active');
      internalShown = true;
      counter.textContent = '6.5 / —';
      return;
    }

    internalShown = false;
    currentIndex = Math.max(0, Math.min(index, visibleSlides.length - 1));
    const slide = visibleSlides[currentIndex];
    slide.classList.add('is-active');
    counter.textContent = `${currentIndex + 1} / ${visibleSlides.length}`;

    // Lazy-load deal on slide 7
    if (slide.hasAttribute('data-deal-slide') && !dealLoaded) {
      loadDeal();
    }
  }

  function next() { if (!internalShown) showSlide(currentIndex + 1); }
  function prev() { if (!internalShown) showSlide(currentIndex - 1); }

  // ── Keyboard ───────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Hidden slide toggle
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
      e.preventDefault();
      if (internalShown) showSlide(5);          // back to slide 6 (index 5)
      else showSlide(0, { internal: true });
      return;
    }

    if (internalShown) {
      if (e.key === 'Escape') { e.preventDefault(); showSlide(5); }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
      case 'PageDown':
      case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowRight':
      case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home':
        e.preventDefault(); showSlide(0); break;
      case 'End':
        e.preventDefault(); showSlide(visibleSlides.length - 1); break;
      case 'Escape':
        e.preventDefault(); showSlide(0); break;
    }
  });

  // ── Buttons ────────────────────────────────────────────────
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // ── Deal fetch (Oxmoore) ───────────────────────────────────
  async function loadDeal() {
    dealLoaded = true;
    const root = document.querySelector('[data-deal-root]');
    const status = document.querySelector('[data-deal-status]');
    if (!root) return;

    try {
      const res = await fetch(DEALS_API, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const deals = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.deals) ? payload.deals : []);

      if (deals.length === 0) {
        renderDealError(root, status, 'אין עסקאות זמינות כרגע ב-API.');
        return;
      }

      // Prefer Oxmoor (also accept "oxmoore"); fallback to featured-active; fallback to first active
      const deal =
        deals.find(d => /oxmoo?re?/i.test([d.name, d.full_address, d.description].filter(Boolean).join(' '))) ||
        deals.find(d => d.is_featured && d.fundraising_status === 'active') ||
        deals.find(d => d.is_featured) ||
        deals.find(d => d.fundraising_status === 'active') ||
        deals[0];

      renderDeal(root, status, deal);
    } catch (err) {
      console.warn('[pitch] deal fetch failed:', err);
      renderDealError(root, status, 'לא הצלחנו לטעון את העסקה. ודא ששרת ה-admin רץ על :3000.');
    }
  }

  function renderDealError(root, status, msg) {
    if (status) status.textContent = 'נתונים לא זמינים';
    root.innerHTML = `
      <div class="deal__error">
        <div class="material-symbols-outlined" aria-hidden="true">cloud_off</div>
        <p class="t-body">${escape(msg)}</p>
      </div>`;
  }

  function renderDeal(root, status, d) {
    const fmtUSD = (n) => (n == null) ? '—' : '$' + Number(n).toLocaleString('en-US');
    const fmtPct = (n) => (n == null) ? '—' : Number(n).toFixed(0) + '%';

    if (status) status.textContent = labelStatus(d) || 'עסקה פעילה';

    const heroImage =
      (d.thumbnail_url && asAbsoluteUrl(d.thumbnail_url)) ||
      (Array.isArray(d.images) && d.images[0] && asAbsoluteUrl(d.images[0].image_url)) ||
      null;

    const comps = Array.isArray(d.comps) ? d.comps.slice(0, 4) : [];
    const specs = Array.isArray(d.specs) ? d.specs.slice(0, 4) : [];

    root.innerHTML = `
      <div class="deal__hero">
        ${heroImage
          ? `<div class="deal__image" style="background-image:url('${escape(heroImage)}')"></div>`
          : `<div class="deal__image deal__image--placeholder">
               <span class="material-symbols-outlined" aria-hidden="true">home_work</span>
             </div>`}
        <div class="deal__main">
          <div class="deal__badges">
            <span class="deal__badge deal__badge--accent">${escape(labelStatus(d) || 'פעיל')}</span>
            ${d.project_duration ? `<span class="deal__badge">${escape(formatDuration(d.project_duration))}</span>` : ''}
            ${d.expected_roi_percent != null ? `<span class="deal__badge">צפי ROI ${fmtPct(d.expected_roi_percent)}</span>` : ''}
          </div>
          <h3 class="deal__name t-h2" dir="ltr">${escape(d.name || 'העסקה')}</h3>
          ${d.full_address
            ? `<p class="deal__address t-body">
                 <span class="material-symbols-outlined" aria-hidden="true">place</span>
                 <span dir="ltr">${escape(d.full_address)}</span>
               </p>` : ''}
          ${d.description ? `<p class="t-body" style="color:var(--pitch-muted);margin:0;line-height:1.65;">${escape(d.description)}</p>` : ''}
        </div>
      </div>

      <div class="deal__metrics">
        <div class="deal-metric">
          <div class="deal-metric__label">מחיר רכישה</div>
          <div class="deal-metric__value">${fmtUSD(d.purchase_price)}</div>
        </div>
        <div class="deal-metric">
          <div class="deal-metric__label">ARV / מכירה צפויה</div>
          <div class="deal-metric__value">${fmtUSD(d.expected_sale_price || d.arv)}</div>
        </div>
        <div class="deal-metric deal-metric--accent">
          <div class="deal-metric__label">צפי רווח</div>
          <div class="deal-metric__value">${fmtUSD(d.expected_profit)}</div>
        </div>
        <div class="deal-metric deal-metric--accent">
          <div class="deal-metric__label">תשואה למשקיע</div>
          <div class="deal-metric__value">${fmtPct(d.expected_roi_percent || 20)}</div>
        </div>
      </div>

      <div class="deal__footer">
        <div class="deal__footer-block">
          <h4>מאפייני נכס</h4>
          ${specs.length
            ? `<ul class="comp-list">
                ${specs.map(s => `<li><span>${escape(s.spec_name)}</span><strong>${escape(s.spec_value)}</strong></li>`).join('')}
               </ul>`
            : `<p class="t-body" style="color:var(--pitch-muted);margin:0;">פרטים מלאים בפגישה.</p>`}
        </div>
        <div class="deal__footer-block">
          <h4>Comps — נמכרו לאחרונה</h4>
          ${comps.length
            ? `<ul class="comp-list">
                ${comps.map(c => `<li><span dir="ltr">${escape(c.address || '—')}</span><strong>${fmtUSD(c.sale_price)}</strong></li>`).join('')}
               </ul>`
            : `<p class="t-body" style="color:var(--pitch-muted);margin:0;">Comps יוצגו בעת השיחה.</p>`}
        </div>
      </div>
    `;
  }

  function formatDuration(d) {
    const s = String(d).trim();
    if (/^\d+$/.test(s)) return s + ' חודשים';
    if (/months?$/i.test(s)) return s.replace(/months?/i, 'חודשים');
    return s;
  }

  function labelStatus(d) {
    const property = {
      sourcing: 'בשלב איתור', purchased: 'נקנה', planning: 'בתכנון',
      renovation: 'בשיפוץ', selling: 'מוצע למכירה', sold: 'נמכר'
    };
    const fundraising = {
      upcoming: 'גיוס קרוב', active: 'גיוס בעיצומו',
      completed: 'גיוס הושלם', closed: 'גיוס סגור'
    };
    return fundraising[d.fundraising_status] || property[d.property_status] || '';
  }

  function asAbsoluteUrl(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return ADMIN_HOST + url;
    return url;
  }

  function escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // ── Init ───────────────────────────────────────────────────
  showSlide(0);
})();

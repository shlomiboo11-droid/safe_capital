/* Investor Nights — dynamic loading + stepper + submit
 * Fetches active event from /api/public/active-event and renders all sections.
 */
(function () {
  'use strict';

  // ---------- Config ----------
  var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://admin.safecapital.co.il';
  var ACTIVE_EVENT_URL = API_BASE + '/api/public/active-event';
  var SUBMIT_URL = API_BASE + '/api/public/event-registration';

  // ---------- Data (populated by loadEventData) ----------
  var EVENT = null;
  var FEATURED_DEALS = [];

  // ---------- Form State ----------
  var state = {
    step: 0,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bringGuest: 'alone',
    guestName: '',
    investedBefore: '',
    range: '250',
    readiness: '',
    source: '',
    note: '',
    agree: false,
    updates: true
  };
  var touched = {};
  var submitting = false;

  // ---------- Helpers ----------
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function validPhone(v) { return v.replace(/[^\d]/g, '').length >= 9; }

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function rangeLabel(v) {
    var n = parseInt(v, 10);
    if (n >= 500) return '$500K';
    if (n >= 350) return '$350K – $500K';
    if (n >= 250) return '$250K – $350K';
    if (n >= 150) return '$150K – $250K';
    return '$50K – $150K';
  }

  function rangeReviewLabel(v) {
    var n = parseInt(v, 10);
    return '$' + n + 'K';
  }

  // ---------- Data Loading ----------
  function loadEventData() {
    return fetch(ACTIVE_EVENT_URL, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error('API ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.event) {
          showNoEvent();
          return false;
        }
        EVENT = data.event;
        FEATURED_DEALS = data.featured_deals || [];
        renderAllSections();
        return true;
      })
      .catch(function (err) {
        console.error('Failed to load active event:', err);
        showNoEvent();
        return false;
      });
  }

  function hideLoading() {
    var loading = qs('#in-loading');
    if (loading) loading.style.display = 'none';
  }

  function showNoEvent() {
    hideLoading();
    var main = qs('#in-main-content');
    var noEvent = qs('#in-no-event');
    if (main) main.style.display = 'none';
    if (noEvent) noEvent.style.display = '';
  }

  // ---------- Rendering (event data) ----------
  function renderAllSections() {
    hideLoading();
    var main = qs('#in-main-content');
    var noEvent = qs('#in-no-event');
    if (main) main.style.display = '';
    if (noEvent) noEvent.style.display = 'none';

    renderHero();
    renderUrgency();
    renderBrief();
    renderDetailGrid();
    renderAgenda();
    renderSpeakers();
    renderTrackRecord();
    renderFAQ();
    renderFormHeader();
    initForm();
    initTabs();
    renderCTAInline();
    initStickyCTA();
  }

  function renderHero() {
    var img = qs('#in-hero-img');
    if (img) {
      img.src = EVENT.hero_image_url || 'images/investor-nights/hero-birmingham.jpg';
      img.alt = EVENT.hero_title_main || '';
      img.style.display = '';
    }

    var locEl = qs('#in-hero-eyebrow-location');
    if (locEl) locEl.textContent = EVENT.hero_eyebrow_location || '';

    var sesEl = qs('#in-hero-eyebrow-session');
    if (sesEl) sesEl.textContent = EVENT.hero_eyebrow_session || '';

    var mainTitle = qs('#in-hero-title-main');
    if (mainTitle) mainTitle.textContent = EVENT.hero_title_main || '';

    var accentTitle = qs('#in-hero-title-accent');
    if (accentTitle) accentTitle.textContent = EVENT.hero_title_accent || '';

    var descEl = qs('#in-hero-description');
    if (descEl) descEl.textContent = EVENT.hero_description || '';

    // Hero meta row
    var metaRow = qs('#in-hero-meta-row');
    if (metaRow) {
      var seatsTotal = EVENT.seats_total || 40;
      var seatsTaken = EVENT.seats_taken || 0;
      var seatsRemaining = Math.max(0, seatsTotal - seatsTaken);

      var shortDate = (EVENT.event_date_display_short || '').replace(/\.(\d{2})(\d{2})$/, '.$2');
      metaRow.innerHTML = [
        '<div class="hero-meta">',
        '  <div class="k">תאריך</div>',
        '  <div class="v">' + esc(shortDate) + '</div>',
        '</div>',
        '<div class="hero-meta-sep"></div>',
        '<div class="hero-meta">',
        '  <div class="k">שעה</div>',
        '  <div class="v">' + esc(EVENT.event_time_start || '') + '</div>',
        '</div>',
        '<div class="hero-meta-sep"></div>',
        '<div class="hero-meta">',
        '  <div class="k">מיקום</div>',
        '  <div class="v">' + esc(EVENT.venue_short || EVENT.venue_name || '') + '</div>',
        '</div>',
        '<div class="hero-meta-sep"></div>',
        '<div class="hero-meta accent">',
        '  <div class="k">מקומות</div>',
        '  <div class="v">' + seatsTotal + ' / ' + seatsRemaining + '</div>',
        '</div>'
      ].join('');
    }
  }

  function renderUrgency() {
    var banner = qs('#urgency-banner');
    if (!banner) return;
    var seatsTotal = EVENT.seats_total || 40;
    var seatsTaken = EVENT.seats_taken || 0;
    var seatsRemaining = Math.max(0, seatsTotal - seatsTaken);

    if (seatsRemaining > 0 && seatsRemaining <= Math.max(10, Math.floor(seatsTotal / 4))) {
      var txtEl = qs('#in-urgency-text');
      var barEl = qs('#in-urgency-bar');
      if (txtEl) txtEl.textContent = 'נותרו ' + seatsRemaining + ' מקומות מתוך ' + seatsTotal;
      if (barEl) barEl.style.width = Math.round((seatsTaken / seatsTotal) * 100) + '%';
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }

  function renderBrief() {
    var el = qs('#in-brief-text');
    if (el) el.textContent = EVENT.brief_text || '';
  }

  function renderDetailGrid() {
    var grid = qs('#in-detail-grid');
    if (!grid) return;

    var dateLine = EVENT.event_date_display_full || '';
    var timeSub = (EVENT.event_time_start || '') + (EVENT.event_time_end ? ' – ' + EVENT.event_time_end : '');

    grid.innerHTML = [
      '<div class="in-detail-row">',
      '  <div class="label"><span class="material-symbols-outlined">event</span>תאריך</div>',
      '  <div class="value">' + esc(dateLine) + '</div>',
      '  <div class="sub">' + esc(timeSub) + '</div>',
      '</div>',
      '<div class="in-detail-row">',
      '  <div class="label"><span class="material-symbols-outlined">place</span>מיקום</div>',
      '  <div class="value">' + esc(EVENT.venue_name || '') + '</div>',
      '  <div class="sub">' + esc(EVENT.venue_address || '') + '</div>',
      '</div>',
      '<div class="in-detail-row">',
      '  <div class="label"><span class="material-symbols-outlined">trending_up</span>יעד תשואה על ההון</div>',
      '  <div class="value accent">' + esc(EVENT.roi_target_display || '') + '</div>',
      '  <div class="sub">' + esc(EVENT.roi_spec || '') + '</div>',
      '</div>',
      '<div class="in-detail-row">',
      '  <div class="label"><span class="material-symbols-outlined">payments</span>השקעה מינימלית</div>',
      '  <div class="value" style="font-family:\'Inter\',sans-serif">' + esc(EVENT.min_investment_display || '') + '</div>',
      '  <div class="sub">' + esc(EVENT.holding_period || '') + '</div>',
      '</div>'
    ].join('');
  }

  function renderAgenda() {
    var list = qs('#in-agenda-list');
    var agenda = EVENT.agenda || [];
    if (!list) return;
    if (agenda.length === 0) {
      var section = qs('#in-agenda-section');
      if (section) section.style.display = 'none';
      return;
    }
    list.innerHTML = agenda.map(function (item) {
      return [
        '<li>',
        '  <span class="time">' + esc(item.time || '') + '</span>',
        '  <div>',
        '    <div class="title">' + esc(item.title || '') + '</div>',
        '    <div class="sub">' + esc(item.subtitle || '') + '</div>',
        '  </div>',
        '  <div class="host"><div class="k">מנחה</div><div class="v">' + esc(item.host || '') + '</div></div>',
        '</li>'
      ].join('');
    }).join('');

    // Duration meta (simple computation start-end → "3 שעות")
    var meta = qs('#in-agenda-meta');
    if (meta && EVENT.event_time_start && EVENT.event_time_end) {
      try {
        var sp = EVENT.event_time_start.split(':');
        var ep = EVENT.event_time_end.split(':');
        var mins = (parseInt(ep[0]) * 60 + parseInt(ep[1])) - (parseInt(sp[0]) * 60 + parseInt(sp[1]));
        if (mins > 0) {
          var hours = Math.round(mins / 60);
          meta.textContent = hours + ' שעות';
        }
      } catch (e) {}
    }
  }

  function renderSpeakers() {
    var grid = qs('#in-speakers-grid');
    var speakers = EVENT.speakers || [];
    if (!grid) return;
    if (speakers.length === 0) {
      var section = qs('#in-speakers-section');
      if (section) section.style.display = 'none';
      return;
    }
    grid.innerHTML = speakers.map(function (sp) {
      var portrait;
      if (sp.image_url) {
        portrait = '<div class="portrait">'
          + '<img src="' + esc(sp.image_url) + '" alt="' + esc(sp.name || '') + '" style="width:100%;height:100%;object-fit:cover;">'
          + '<div class="tick-h"></div><div class="tick-v"></div>'
          + '</div>';
      } else {
        portrait = '<div class="portrait">'
          + '<div class="tick-h"></div><div class="tick-v"></div>'
          + '</div>';
      }
      return [
        '<div class="in-speaker">',
        portrait,
        '  <div class="meta">',
        '    <div class="name">' + esc(sp.name || '') + '</div>',
        '    <div class="role">' + esc(sp.role || '') + '</div>',
        '  </div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderTrackRecord() {
    var subtitle = qs('#in-track-subtitle');
    var title = qs('#in-track-title');
    if (subtitle) subtitle.textContent = EVENT.track_record_subtitle || '';
    if (title) title.textContent = EVENT.track_record_title || '';

    var list = qs('#in-deals-list');
    if (!list) return;
    if (FEATURED_DEALS.length === 0) {
      var section = qs('#in-track-record-section');
      if (section) section.style.display = 'none';
      return;
    }

    list.innerHTML = FEATURED_DEALS.map(function (d) {
      var statusLabel = d.status_label || '';
      var statusTone = d.status_tone || 'active';
      var badgeClass = 'badge ' + statusTone;
      var statusBadge = statusLabel ? '<div class="' + esc(badgeClass) + '">' + esc(statusLabel) + '</div>' : '';

      // Thumbnail: use deal image if present, fall back to icon placeholder
      var thumbUrl = d.thumbnail_url || '';
      if (thumbUrl && thumbUrl.charAt(0) === '/') {
        thumbUrl = API_BASE + thumbUrl;
      }
      var thumbInner = thumbUrl
        ? '<img src="' + esc(thumbUrl) + '" alt="' + esc(d.address || '') + '" onerror="this.outerHTML=\'<div class=&quot;icon&quot;><span class=&quot;material-symbols-outlined&quot;>home</span></div>\'">'
        : '<div class="icon"><span class="material-symbols-outlined">home</span></div>';
      var thumb = '<div class="thumb">'
        + thumbInner
        + (d.deal_number ? '<div class="idx">#' + esc(d.deal_number) + '</div>' : '')
        + '</div>';

      // ROI: whole-number percent; different label for sold vs in-progress
      var roiDisplay = '—';
      if (d.roi_percent != null) {
        roiDisplay = Math.round(d.roi_percent) + '%';
      } else if (d.roi_display) {
        roiDisplay = d.roi_display;
      }
      var isSold = (d.property_status === 'sold');
      var roiLabel = isSold ? 'תשואה למשקיע' : 'תשואה צפויה למשקיע';

      // Property name: prefer deal.name, else first segment of address
      var propName = d.name || (d.address ? String(d.address).split(',')[0].trim() : '');

      return [
        '<div class="in-deal-row">',
        thumb,
        '  <div class="main">',
        '    <div class="addr">' + esc(propName) + '</div>',
        statusBadge,
        '  </div>',
        '  <div class="cell"><div class="k">משקיעים</div><div class="v">' + esc(d.investor_count != null ? d.investor_count : '—') + '</div></div>',
        '  <div class="cell"><div class="k">' + roiLabel + '</div><div class="v accent">' + esc(roiDisplay) + '</div></div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderFAQ() {
    var faqs = EVENT.faqs || [];
    var targets = [
      qs('#in-faq-list'),
      qs('#in-faq-mobile-section .in-faqs-list')
    ];
    if (faqs.length === 0) {
      var section = qs('#in-faq-section');
      if (section) section.style.display = 'none';
      var mobileSection = qs('#in-faq-mobile-section');
      if (mobileSection) mobileSection.style.display = 'none';
      return;
    }
    var html = faqs.map(function (f) {
      return [
        '<details>',
        '  <summary><span class="q">' + esc(f.question || '') + '</span><span class="chev material-symbols-outlined" style="font-size:22px;color:#43474e">expand_more</span></summary>',
        '  <p>' + esc(f.answer || '') + '</p>',
        '</details>'
      ].join('');
    }).join('');
    targets.forEach(function (list) {
      if (list) list.innerHTML = html;
    });
  }

  // ---------- Mobile: Tabs ----------
  function initTabs() {
    var bar = qs('.in-tabs-bar');
    if (!bar || bar.dataset.initialized) return;
    bar.dataset.initialized = '1';
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      var key = btn.dataset.tab;
      qsa('.in-tabs-bar button').forEach(function (b) {
        b.dataset.active = (b.dataset.tab === key) ? 'true' : 'false';
      });
      qsa('.in-tabs-content').forEach(function (p) {
        p.dataset.active = (p.dataset.tabPanel === key) ? 'true' : 'false';
      });
    });
  }

  // ---------- Mobile: Inline CTA ----------
  function scrollToForm() {
    var form = qs('#in-form');
    if (!form) return;
    var nav = qs('.site-nav');
    var navH = nav ? nav.offsetHeight : 0;
    var top = form.getBoundingClientRect().top + window.pageYOffset - navH - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function renderCTAInline() {
    var btn = qs('#in-cta-inline');
    if (!btn || btn.dataset.initialized) return;
    btn.dataset.initialized = '1';
    btn.addEventListener('click', scrollToForm);
  }

  // ---------- Mobile: Sticky CTA ----------
  function initStickyCTA() {
    var el = qs('#in-sticky-cta');
    if (!el || !EVENT || el.dataset.initialized) return;
    el.dataset.initialized = '1';
    var seatsTotal = EVENT.seats_total || 40;
    var seatsTaken = EVENT.seats_taken || 0;
    var left = Math.max(0, seatsTotal - seatsTaken);
    var dateStr = EVENT.event_date_display_short || '';
    var venueStr = EVENT.venue_short || EVENT.venue_name || '';
    var meta = dateStr + (dateStr && venueStr ? ' · ' : '') + venueStr;
    el.innerHTML = [
      '<div class="meta">',
      '  <div class="date">' + esc(meta) + '</div>',
      '  <div class="seats">נותרו ' + left + ' מקומות</div>',
      '</div>',
      '<button type="button" class="btn" id="in-sticky-cta-btn">',
      '  הרשמה',
      '  <span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>',
      '</button>'
    ].join('');
    var ctaBtn = qs('#in-sticky-cta-btn');
    if (ctaBtn) ctaBtn.addEventListener('click', scrollToForm);

    var form = qs('#in-form');
    if (form && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            el.classList.add('hidden');
          } else {
            el.classList.remove('hidden');
          }
        });
      }, { rootMargin: '-30% 0px -30% 0px', threshold: 0 });
      observer.observe(form);
    }
  }

  function renderFormHeader() {
    var dateDisp = qs('#in-form-date-display');
    if (dateDisp) dateDisp.textContent = EVENT.event_date_display_short || '';
  }

  // ---------- Validation per step ----------
  function errorsForStep(step) {
    var e = {};
    if (step === 0) {
      if (!state.firstName.trim()) e.firstName = 'שדה חובה';
      if (!state.lastName.trim()) e.lastName = 'שדה חובה';
      if (!validEmail(state.email)) e.email = 'כתובת לא תקינה';
      if (!validPhone(state.phone)) e.phone = 'מספר לא תקין';
      if (state.bringGuest === 'plus1' && !state.guestName.trim()) e.guestName = 'נא להזין שם אורח';
    } else if (step === 1) {
      if (!state.investedBefore) e.investedBefore = 'נא לבחור';
      if (!state.readiness) e.readiness = 'נא לבחור';
    } else if (step === 2) {
      if (!state.agree) e.agree = 'נדרש אישור';
    }
    return e;
  }

  // ---------- Form Rendering ----------
  function renderStepper() {
    qsa('.in-stepper button').forEach(function (btn) {
      var i = parseInt(btn.getAttribute('data-step'), 10);
      btn.classList.remove('done', 'active');
      if (i < state.step) btn.classList.add('done');
      else if (i === state.step) btn.classList.add('active');
      btn.disabled = i > state.step;
    });
    var counter = qs('#step-counter');
    if (counter) counter.textContent = String(state.step + 1);
  }

  function renderSteps() {
    qsa('.in-form-body .step').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-step'), 10);
      el.classList.toggle('active', i === state.step);
    });
  }

  function renderFoot() {
    var back = qs('#back-btn');
    var secure = qs('#secure-note');
    var next = qs('#next-btn');
    var label = qs('#next-label');
    if (state.step > 0) {
      back.style.display = '';
      secure.style.display = 'none';
    } else {
      back.style.display = 'none';
      secure.style.display = '';
    }
    label.textContent = state.step < 2 ? 'המשך' : 'אישור הרשמה';
    if (submitting) {
      next.disabled = true;
      label.textContent = 'שולח…';
    } else {
      next.disabled = false;
    }
  }

  function renderFieldErrors() {
    var errs = errorsForStep(state.step);
    qsa('.in-field[data-field]').forEach(function (f) {
      var name = f.getAttribute('data-field');
      var hasErr = Boolean(errs[name]);
      f.classList.toggle('has-err', hasErr);
      f.classList.toggle('touched', Boolean(touched[name]));
    });
    var termsBlock = qs('#terms-block');
    if (termsBlock) {
      termsBlock.classList.toggle('agree-err-visible', Boolean(errs.agree) && Boolean(touched.agree));
    }
  }

  function renderGuestField() {
    var guest = qs('#guest-field');
    if (!guest) return;
    guest.style.display = state.bringGuest === 'plus1' ? 'block' : 'none';
  }

  function renderReview() {
    function set(key, value) {
      var el = document.querySelector('[data-review="' + key + '"]');
      if (!el) return;
      if (!value) {
        el.innerHTML = '<span class="empty">—</span>';
      } else {
        el.textContent = value;
      }
    }
    set('name', (state.firstName + ' ' + state.lastName).trim());
    set('email', state.email);
    set('phone', state.phone);
    set('guest', state.bringGuest === 'plus1' ? ('+1 · ' + state.guestName) : 'לבד');
    set('investedBefore', state.investedBefore === 'yes' ? 'כן' : state.investedBefore === 'no' ? 'לא · מתעניין' : '');
    set('range', rangeReviewLabel(state.range));
    set('readiness', state.readiness);
  }

  function renderAll() {
    renderStepper();
    renderSteps();
    renderFoot();
    renderFieldErrors();
    renderGuestField();
    if (state.step === 2) renderReview();
  }

  // ---------- Form Handlers ----------
  function onInputChange(e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
    var name = el.name;
    if (!name) return;
    if (el.type === 'checkbox') {
      state[name] = el.checked;
      if (name === 'agree') touched.agree = true;
    } else {
      state[name] = el.value;
    }
    if (name === 'range') {
      var lbl = qs('#range-label');
      if (lbl) lbl.textContent = rangeLabel(el.value);
    }
    renderFieldErrors();
  }

  function onInputBlur(e) {
    var el = e.target;
    if (!el.name) return;
    touched[el.name] = true;
    renderFieldErrors();
  }

  function onSegClick(e) {
    var btn = e.target.closest('.seg-btn');
    if (!btn) return;
    var parent = btn.closest('.in-seg');
    if (!parent) return;
    var key = parent.getAttribute('data-seg');
    var value = btn.getAttribute('data-value');
    state[key] = value;
    touched[key] = true;
    qsa('.seg-btn', parent).forEach(function (b) {
      b.setAttribute('data-active', String(b === btn));
    });
    if (key === 'bringGuest') renderGuestField();
    renderFieldErrors();
  }

  function onChipClick(e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    var parent = btn.closest('.in-chips');
    if (!parent) return;
    var key = parent.getAttribute('data-chips');
    var value = btn.getAttribute('data-value');
    state[key] = value;
    touched[key] = true;
    qsa('.chip', parent).forEach(function (c) {
      c.classList.toggle('active', c === btn);
    });
    renderFieldErrors();
  }

  function onStepperClick(e) {
    var btn = e.target.closest('.in-stepper button');
    if (!btn || btn.disabled) return;
    var target = parseInt(btn.getAttribute('data-step'), 10);
    if (target < state.step) {
      state.step = target;
      renderAll();
    }
  }

  function onReviewJump(e) {
    var btn = e.target.closest('[data-jump]');
    if (!btn) return;
    var target = parseInt(btn.getAttribute('data-jump'), 10);
    state.step = target;
    renderAll();
  }

  function markAllTouchedInStep(step) {
    var errs = errorsForStep(step);
    Object.keys(errs).forEach(function (k) { touched[k] = true; });
  }

  function onNext() {
    var errs = errorsForStep(state.step);
    if (Object.keys(errs).length) {
      markAllTouchedInStep(state.step);
      renderFieldErrors();
      return;
    }
    if (state.step < 2) {
      state.step += 1;
      renderAll();
      requestAnimationFrame(function () {
        var formCard = document.getElementById('in-form');
        if (!formCard) return;
        var nav = document.querySelector('.site-nav');
        var navH = nav ? nav.offsetHeight : 0;
        var top = formCard.getBoundingClientRect().top + window.pageYOffset - navH - 16;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
    } else {
      submitForm();
    }
  }

  function onBack() {
    if (state.step > 0) {
      state.step -= 1;
      renderAll();
    }
  }

  // ---------- Submit ----------
  function submitForm() {
    submitting = true;
    renderFoot();

    var payload = {
      event_id: EVENT ? EVENT.id : null,
      event_slug: EVENT ? EVENT.slug : null,
      first_name: state.firstName,
      last_name: state.lastName,
      email: state.email,
      phone: state.phone,
      guest_name: state.bringGuest === 'plus1' ? state.guestName : null,
      invested_before: state.investedBefore,
      range_k: parseInt(state.range, 10),
      readiness: state.readiness,
      source: state.source || null,
      note: state.note || null,
      agree_terms: !!state.agree,
      subscribe_updates: !!state.updates
    };

    fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) console.warn('Submit returned non-OK', res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () { redirectToThankYou(); })
      .catch(function (err) {
        console.error('Submit failed:', err);
        redirectToThankYou();
      });
  }

  function redirectToThankYou() {
    var params = new URLSearchParams();
    params.set('fn', state.firstName);
    params.set('email', state.email);
    params.set('guests', state.bringGuest === 'plus1' ? '1' : '0');
    location.href = 'investor-nights-thankyou.html?' + params.toString();
  }

  // ---------- Init Form ----------
  function initForm() {
    var form = qs('#in-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = '1';

    form.addEventListener('input', onInputChange);
    form.addEventListener('change', onInputChange);
    form.addEventListener('blur', onInputBlur, true);

    qsa('.in-seg').forEach(function (seg) { seg.addEventListener('click', onSegClick); });
    qsa('.in-chips').forEach(function (c) { c.addEventListener('click', onChipClick); });

    var stepper = qs('.in-stepper');
    if (stepper) stepper.addEventListener('click', onStepperClick);

    qs('#next-btn').addEventListener('click', onNext);
    qs('#back-btn').addEventListener('click', onBack);

    qs('.in-review-list').addEventListener('click', onReviewJump);

    var rangeInput = qs('#range-input');
    if (rangeInput) qs('#range-label').textContent = rangeLabel(rangeInput.value);

    renderAll();
  }

  // ---------- Init ----------
  function init() {
    loadEventData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Tab H: Comps — Comparable Sales
 * Column-based comparison layout with our property on the right
 */

function renderCompsTab(data) {
  const comps = data.comps || [];
  const deal = data.deal;
  const container = document.getElementById('tab-comps');

  // Our property data
  const ourData = _buildOurData(deal, data.specs || [], data.images || []);
  const hasComps = comps.length > 0;

  container.innerHTML = `
    <!-- Add Comp -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-xl">compare_arrows</span>
          <h3 class="text-lg font-bold">נכסים דומים</h3>
        </div>
      </div>
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <label class="form-label">הוסף נכס דומה (כתובת או Zillow URL)</label>
          <input type="text" id="compAddressInput" class="form-input ltr text-sm" dir="ltr"
            placeholder="1234 Main St, Birmingham, AL 35209  או  https://www.zillow.com/homedetails/...">
        </div>
        <button type="button" class="btn btn-primary" onclick="addCompFromZillow()" style="padding-top:0.6rem;padding-bottom:0.6rem;white-space:nowrap;" id="addCompBtn">
          <span class="material-symbols-outlined text-sm">add</span>
          הוסף נכס דומה
        </button>
      </div>
      <div id="compAddStatus" class="mt-3 hidden"></div>
    </div>

    <!-- Comparison Columns -->
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-bold mb-4">טבלת השוואה</h3>
      <div class="comp-columns-container">
        <!-- Our Property Column (always first/right in RTL) -->
        <div class="comp-column comp-column-ours">
          <div class="comp-column-header">
            <div class="comp-img-box">
              ${ourData.image
                ? `<img src="${ourData.image}" alt="" class="comp-img">`
                : `<div class="comp-img-placeholder"><span class="material-symbols-outlined text-3xl">home</span></div>`
              }
              <div class="comp-column-badge">הנכס שלנו</div>
            </div>
          </div>
          <div class="comp-column-body">
            <div class="comp-row comp-row-address" title="${ourData.address}">${ourData.address}</div>
            ${_compDataRow('מחיר', ourData.price ? formatCurrency(ourData.price) : '--', null, null, true)}
            ${_compDataRow('$/sqft', ourData.ppsf > 0 ? '$' + Math.round(ourData.ppsf) : '--', null, null, true)}
            ${_compDataRow('שטח', ourData.sqft > 0 ? formatNumber(ourData.sqft) + ' sqft' : '--', null, null, true)}
            ${_compDataRow('חד\' שינה', ourData.bedrooms || '--', null, null, true)}
            ${_compDataRow('חד\' רחצה', ourData.bathrooms || '--', null, null, true)}
            ${_compDataRow('תאריך מכירה', '--', null, null, true)}
            ${_compDataRow('ימים בשוק', '--', null, null, true)}
          </div>
        </div>

        ${comps.map((comp, idx) => _renderCompColumn(comp, idx, ourData)).join('')}

        ${!hasComps ? `
          <div class="comp-column comp-column-empty">
            <div class="flex flex-col items-center justify-center h-full text-gray-300 py-12">
              <span class="material-symbols-outlined text-5xl">add_circle_outline</span>
              <p class="text-sm mt-3">הוסף נכס דומה להשוואה</p>
            </div>
          </div>
        ` : ''}
      </div>
    </div>


    <!-- AI Analysis -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-xl">psychology</span>
          <h3 class="text-lg font-bold">ניתוח בינה מלאכותית</h3>
        </div>
        <button class="btn btn-primary btn-sm" onclick="generateCompsAnalysis()" id="aiAnalysisBtn" ${!hasComps ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-sm">auto_awesome</span>
          צור ניתוח
        </button>
      </div>
      <div id="compsAnalysisContent">
        ${deal.comps_ai_analysis
          ? `<div class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${deal.comps_ai_analysis}</div>`
          : `<p class="text-sm text-gray-400">${hasComps ? 'לחץ "צור ניתוח" כדי לקבל ניתוח AI של הנכסים הדומים.' : 'יש להוסיף נכסים דומים לפני יצירת ניתוח.'}</p>`
        }
      </div>
    </div>

    <!-- Map -->
    ${hasComps ? `
    <div class="card p-6 mb-6">
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary text-xl">map</span>
        <h3 class="text-lg font-bold">מפת נכסים</h3>
      </div>
      <div id="compsMapContainer"></div>
    </div>
    ` : ''}

    <!-- Comp Image Gallery Modal -->
    <div id="compGalleryModal" class="modal-overlay hidden" onclick="if(event.target===this)closeCompGallery()">
      <div class="modal-box" style="max-width:40rem;">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold" id="compGalleryTitle">תמונות</h2>
          <button onclick="closeCompGallery()" class="text-gray-400 hover:text-gray-600">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div id="compGalleryGrid" class="grid grid-cols-3 gap-3 mb-4"></div>
        <div class="flex items-center gap-3">
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            <span class="material-symbols-outlined text-sm">add_photo_alternate</span>
            הוסף תמונות
            <input type="file" multiple accept="image/*" style="display:none;" id="compGalleryUploadInput">
          </label>
        </div>
      </div>
    </div>
  `;

  if (hasComps) initCompsMap(deal.id, ourData, comps);
}

// ── Map (Google Maps JavaScript API) ─────────────────────────

const GMAPS_KEY = 'AIzaSyDFFrVCt5Vl0-flMkT8hVsDuK10UmdMDUw';
let _gmapsLoaded = false;

async function _loadGoogleMaps() {
  if (window.google?.maps) return;
  if (_gmapsLoaded) {
    // Already loading — wait for it
    await new Promise(r => { const t = setInterval(() => { if (window.google?.maps) { clearInterval(t); r(); } }, 100); });
    return;
  }
  _gmapsLoaded = true;
  await new Promise((resolve, reject) => {
    window.__gmapsReady = resolve;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&callback=__gmapsReady`;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initCompsMap(dealId, ourData, comps) {
  const mapEl = document.getElementById('compsMapContainer');
  if (!mapEl) return;

  mapEl.innerHTML = '<div id="compsGmap" style="height:400px;border-radius:8px;"></div>';

  try {
    await _loadGoogleMaps();
  } catch (e) {
    mapEl.innerHTML = `<div class="text-sm text-red-600 p-4">שגיאה בטעינת המפה. ודא שה-Maps JavaScript API מופעל עבור המפתח.</div>`;
    return;
  }

  const mapDiv = document.getElementById('compsGmap');
  if (!mapDiv) return;

  const map = new google.maps.Map(mapDiv, {
    center: { lat: 33.5186, lng: -86.8104 },
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  const geocoder = new google.maps.Geocoder();
  const bounds = new google.maps.LatLngBounds();
  let placed = 0;

  const items = [
    { label: 'הנכס שלנו', address: ourData.address, color: '#022445',
      lat: null, lng: null, isOurs: true,
      price: ourData.price, sqft: ourData.sqft, ppsf: ourData.ppsf,
      bedrooms: ourData.bedrooms, bathrooms: ourData.bathrooms },
    ...comps.map((c, i) => {
      const imgs = c.images || [];
      const primaryImg = (imgs.find(img => img.is_primary) || imgs[0])?.image_url || c.image_url || null;
      return {
        label: `נכס דומה ${i + 1}`, address: c.address, color: '#984349',
        lat: c.latitude  ? parseFloat(c.latitude)  : null,
        lng: c.longitude ? parseFloat(c.longitude) : null,
        isOurs: false, image: primaryImg,
        price: c.sale_price, sqft: c.sqft
      };
    })
  ];

  function _pin(position, item) {
    const svgIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z" fill="${item.color}"/>
        <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
      </svg>`)}`;

    const marker = new google.maps.Marker({
      position, map,
      title: item.label,
      icon: { url: svgIcon, scaledSize: new google.maps.Size(24, 32), anchor: new google.maps.Point(12, 32) }
    });

    const imgHtml = item.image
      ? `<img src="${item.image}" style="width:100%;height:100px;object-fit:cover;border-radius:4px;margin-bottom:6px;">`
      : '';

    const info = new google.maps.InfoWindow({
      content: `<div style="font-family:Heebo,sans-serif;direction:rtl;width:180px;">
        ${imgHtml}
        <div style="font-weight:700;color:${item.color};font-size:13px;">${item.label}</div>
        ${item.price ? `<div style="font-family:Inter,sans-serif;font-weight:600;font-size:14px;margin-top:2px;">${formatCurrency(item.price)}</div>` : ''}
        ${item.sqft ? `<div style="font-family:Inter,sans-serif;font-size:12px;color:#666;">${formatNumber(item.sqft)} sqft</div>` : ''}
      </div>`
    });
    marker.addListener('click', () => info.open(map, marker));

    bounds.extend(position);
    placed++;
    if (placed === 1) map.setCenter(position);
    else map.fitBounds(bounds);
  }

  for (const item of items) {
    if (item.lat && item.lng) {
      _pin({ lat: item.lat, lng: item.lng }, item);
    } else if (item.address) {
      geocoder.geocode({ address: item.address }, (results, status) => {
        if (status === 'OK' && results[0]) _pin(results[0].geometry.location, item);
      });
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

function _buildOurData(deal, specs, images) {
  // Pick first "before" image, fallback to thumbnail
  const beforeImages = (images || []).filter(i => i.category === 'before');
  const firstBeforeImg = beforeImages.length > 0 ? beforeImages[0].image_url : null;

  const data = {
    address: deal.full_address || deal.name,
    price: parseFloat(deal.arv || deal.expected_sale_price || 0),
    image: firstBeforeImg || deal.thumbnail_url || null,
    sqft: 0, bedrooms: 0, bathrooms: 0, year_built: 0
  };
  for (const spec of specs) {
    const name = (spec.spec_name || '').toLowerCase();
    const val = spec.value_after || spec.value_before || '';
    if (name.includes('שטח') || name.includes('sqft') || name.includes('square')) data.sqft = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    if (name.includes('חדרי שינה') || name.includes('bedroom') || name.includes('bed')) data.bedrooms = parseInt(val) || 0;
    if (name.includes('חדרי רחצה') || name.includes('bathroom') || name.includes('bath')) data.bathrooms = parseFloat(val) || 0;
    if (name.includes('שנת בנייה') || name.includes('year')) data.year_built = parseInt(val) || 0;
  }
  data.ppsf = data.sqft > 0 ? (data.price / data.sqft) : 0;
  return data;
}

function _indicator(compVal, ourVal, higherIsGood = true) {
  if (!compVal || !ourVal) return '';
  const diff = compVal - ourVal;
  if (Math.abs(diff) < 0.01) return '<span class="text-gray-400 text-xs">=</span>';
  const isHigher = diff > 0;
  const isGood = higherIsGood ? isHigher : !isHigher;
  const icon = isHigher ? 'arrow_upward' : 'arrow_downward';
  const color = isGood ? 'text-green-600' : 'text-red-600';
  return `<span class="material-symbols-outlined ${color}" style="font-size:14px;">${icon}</span>`;
}

function _compDataRow(label, value, compVal, ourVal, isOurs = false) {
  return `
    <div class="comp-row">
      <span class="comp-row-label">${label}</span>
      <span class="comp-row-value ${isOurs ? 'font-semibold text-primary' : 'font-inter'}">${value}</span>
      ${!isOurs && compVal !== null && ourVal !== null ? _indicator(compVal, ourVal) : ''}
    </div>
  `;
}

function _renderCompColumn(comp, idx, ourData) {
  const images = comp.images || [];
  const primaryImg = images.find(i => i.is_primary) || images[0];
  const ppsf = comp.price_per_sqft ? Math.round(comp.price_per_sqft) : null;
  const imgCount = images.length;

  return `
    <div class="comp-column" data-comp-id="${comp.id}">
      <div class="comp-column-header">
        <div class="comp-img-box" onclick="openCompGallery(${comp.id})" style="cursor:pointer;">
          ${primaryImg
            ? `<img src="${primaryImg.image_url}" alt="" class="comp-img">`
            : (comp.image_url
              ? `<img src="${comp.image_url}" alt="" class="comp-img">`
              : `<div class="comp-img-placeholder"><span class="material-symbols-outlined text-3xl">home</span></div>`
            )
          }
          ${imgCount > 1 ? `<div class="comp-img-count">${imgCount}</div>` : ''}
          <div class="comp-column-badge-idx">נכס דומה ${idx + 1}</div>
        </div>
      </div>
      <div class="comp-column-body">
        <div class="comp-row comp-row-address" title="${comp.address || ''}">${comp.address || '--'}</div>

        <div class="comp-row">
          <span class="comp-row-label">מחיר</span>
          <span class="comp-row-value font-inter font-semibold">${comp.sale_price ? formatCurrency(comp.sale_price) : '--'}</span>
          ${_indicator(comp.sale_price, ourData.price, true)}
          ${comp.sale_price && ourData.price ? `<span class="text-xs text-gray-400 font-inter">${comp.sale_price >= ourData.price ? '+' : ''}${formatCurrency(comp.sale_price - ourData.price)}</span>` : ''}
        </div>

        <div class="comp-row">
          <span class="comp-row-label">$/sqft</span>
          <span class="comp-row-value font-inter">${ppsf ? '$' + ppsf : '--'}</span>
          ${_indicator(ppsf, ourData.ppsf > 0 ? Math.round(ourData.ppsf) : null, true)}
          ${ppsf && ourData.ppsf > 0 ? `<span class="text-xs text-gray-400 font-inter">${Math.round((ppsf / Math.round(ourData.ppsf) - 1) * 100)}%</span>` : ''}
        </div>

        ${_compDataRow('שטח', comp.sqft ? formatNumber(comp.sqft) + ' sqft' : '--', comp.sqft, ourData.sqft, false)}
        ${_compDataRow('חד\' שינה', comp.bedrooms || '--', comp.bedrooms, ourData.bedrooms, false)}
        ${_compDataRow('חד\' רחצה', comp.bathrooms || '--', comp.bathrooms, ourData.bathrooms, false)}
        ${_compDataRow('תאריך מכירה', comp.sale_date ? new Date(comp.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--', null, null, false)}
        ${_compDataRow('ימים בשוק', comp.days_on_market != null ? comp.days_on_market : '--', null, null, false)}

        <div class="comp-row-actions">
          ${comp.zillow_url ? `<a href="${comp.zillow_url}" target="_blank" class="text-xs text-blue-600 hover:underline">Zillow</a>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteComp(${comp.id})" title="מחק">
            <span class="material-symbols-outlined text-xs">delete</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Add Comp from Zillow API ─────────────────────────────────

async function addCompFromZillow() {
  const input = document.getElementById('compAddressInput');
  const btn = document.getElementById('addCompBtn');
  const statusEl = document.getElementById('compAddStatus');
  const value = input.value.trim();

  if (!value) {
    statusEl.className = 'mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3';
    statusEl.textContent = 'יש להזין כתובת או Zillow URL.';
    statusEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מחפש...';
  statusEl.className = 'mt-3 text-sm text-blue-700 bg-blue-50 rounded-lg p-3';
  statusEl.textContent = 'מחפש נתונים על הנכס...';
  statusEl.classList.remove('hidden');

  try {
    await API.post(`/deals/${currentDeal.id}/comps/fetch-zillow`, { addressOrUrl: value });
    statusEl.className = 'mt-3 text-sm text-green-700 bg-green-50 rounded-lg p-3';
    statusEl.textContent = 'נכס דומה נוסף בהצלחה!';
    input.value = '';
    showToast('נכס דומה נוסף');
    reloadDeal(renderCompsTab);
  } catch (err) {
    statusEl.className = 'mt-3 text-sm text-red-700 bg-red-50 rounded-lg p-3';
    statusEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// ── AI Analysis ──────────────────────────────────────────────

async function generateCompsAnalysis() {
  const btn = document.getElementById('aiAnalysisBtn');
  const contentEl = document.getElementById('compsAnalysisContent');

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> מנתח...';
  contentEl.innerHTML = '<p class="text-sm text-blue-600">מייצר ניתוח AI... זה יכול לקחת מספר שניות.</p>';

  try {
    const result = await API.post(`/deals/${currentDeal.id}/comps/ai-analysis`, {});
    contentEl.innerHTML = `<div class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${result.analysis}</div>`;
    showToast('ניתוח AI נוצר');
  } catch (err) {
    contentEl.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// ── CRUD ─────────────────────────────────────────────────────

async function updateComp(id, field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/comps/${id}`, { [field]: value });
    if (['sale_price', 'sqft'].includes(field)) reloadDeal(renderCompsTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteComp(id) {
  if (!await confirmAction('האם למחוק את הנכס הדומה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/comps/${id}`);
    showToast('נכס דומה נמחק');
    reloadDeal(renderCompsTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Comp Gallery ─────────────────────────────────────────────

let _galleryCompId = null;

function openCompGallery(compId) {
  _galleryCompId = compId;
  const comp = (currentDeal._raw?.comps || []).find(c => c.id === compId);
  const images = comp?.images || [];

  document.getElementById('compGalleryTitle').textContent = `תמונות — ${comp?.address || 'נכס דומה'}`;
  _renderGalleryGrid(images);

  const uploadInput = document.getElementById('compGalleryUploadInput');
  uploadInput.onchange = () => {
    if (uploadInput.files.length > 0) uploadCompImages(compId, uploadInput.files);
  };

  document.getElementById('compGalleryModal').classList.remove('hidden');
}

function closeCompGallery() {
  document.getElementById('compGalleryModal').classList.add('hidden');
  _galleryCompId = null;
}

function _renderGalleryGrid(images) {
  const grid = document.getElementById('compGalleryGrid');
  if (images.length === 0) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-3 text-center py-8">אין תמונות. לחץ "הוסף תמונות" להעלאה.</p>';
    return;
  }
  grid.innerHTML = images.map(img => `
    <div class="relative rounded-lg overflow-hidden" style="aspect-ratio:1;">
      <img src="${img.image_url}" alt="" class="w-full h-full object-cover">
      <div class="absolute top-1 left-1 flex gap-1">
        <button class="bg-white/90 rounded p-1 hover:bg-white" onclick="setCompPrimaryImage(${img.comp_id}, ${img.id})" title="הגדר כתמונה ראשית">
          <span class="material-symbols-outlined text-sm ${img.is_primary ? 'text-yellow-500' : 'text-gray-400'}">star</span>
        </button>
        <button class="bg-white/90 rounded p-1 hover:bg-white" onclick="deleteCompImage(${img.comp_id}, ${img.id})" title="מחק">
          <span class="material-symbols-outlined text-sm text-red-500">delete</span>
        </button>
      </div>
      ${img.is_primary ? '<div class="absolute bottom-1 right-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded">ראשית</div>' : ''}
    </div>
  `).join('');
}

async function uploadCompImages(compId, files) {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  showToast('מעלה תמונות...');
  try {
    await API.upload(`/deals/${currentDeal.id}/comps/${compId}/images/upload`, formData);
    showToast(`${files.length} תמונות הועלו`);
    reloadDeal(renderCompsTab);
    closeCompGallery();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function setCompPrimaryImage(compId, imageId) {
  try {
    await API.put(`/deals/${currentDeal.id}/comps/${compId}/images/${imageId}/primary`, {});
    showToast('תמונה ראשית עודכנה');
    reloadDeal(renderCompsTab);
    closeCompGallery();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCompImage(compId, imageId) {
  if (!await confirmAction('האם למחוק את התמונה?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/comps/${compId}/images/${imageId}`);
    showToast('תמונה נמחקה');
    reloadDeal(renderCompsTab);
    closeCompGallery();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Profile page — personal details, change password, logout
 */

const investor = requirePortalAuth();
if (investor) {
  initPortalShell('profile');
  loadProfile();
}

async function loadProfile() {
  const loading = document.getElementById('loadingState');
  const content = document.getElementById('profileContent');

  try {
    const data = await PORTAL_API.get('/me');
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    renderProfile(data);
  } catch (err) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    content.innerHTML = `
      <div class="text-center py-16">
        <span class="material-symbols-outlined text-5xl mb-4 block" style="color: #d1d5db;">error</span>
        <p class="text-lg font-semibold" style="color: #1b1c1a;">\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC</p>
        <p class="text-sm mt-2" style="color: #43474e;">${(err.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <button onclick="location.reload()" class="mt-4 px-6 py-2 rounded-lg text-sm font-semibold text-white" style="background: #022445;">
          \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1
        </button>
      </div>
    `;
  }
}

function renderProfile(data) {
  const content = document.getElementById('profileContent');
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.name || '\u2014';
  const address = [data.address, data.city, data.country].filter(Boolean).join(', ') || '\u2014';

  let html = '';

  // Page header
  html += `
    <h1 class="text-2xl font-bold mb-6" style="color: #022445; font-family: 'Heebo', sans-serif;">\u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05D9</h1>
  `;

  // Personal details card
  html += `
    <div class="bg-white rounded-xl p-5 mb-4" style="box-shadow: 0 1px 8px rgba(27,28,26,0.04);">
      <h2 class="text-lg font-bold mb-4" style="color: #022445;">\u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD</h2>
      <div>
        ${profileField('\u05E9\u05DD \u05DE\u05DC\u05D0', fullName)}
        ${profileField('\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC', data.email || '\u2014', true)}
        ${profileField('\u05D8\u05DC\u05E4\u05D5\u05DF', data.phone || '\u2014', true)}
        ${data.phone_secondary ? profileField('\u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3', data.phone_secondary, true) : ''}
        ${profileField('\u05DB\u05EA\u05D5\u05D1\u05EA', address)}
        ${data.company_name ? profileField('\u05D7\u05D1\u05E8\u05D4', data.company_name) : ''}
      </div>
    </div>
  `;

  // Contact info box
  html += `
    <div class="rounded-xl p-4 mb-6" style="background: #f0f9ff;">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined flex-shrink-0" style="color: #0369a1;">info</span>
        <div>
          <p class="text-sm font-medium mb-2" style="color: #0c4a6e;">\u05DC\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD, \u05E6\u05E8\u05D5 \u05E7\u05E9\u05E8 \u05E2\u05DD \u05D4\u05E6\u05D5\u05D5\u05EA</p>
          <div class="flex flex-wrap gap-3">
            <a href="https://wa.me/972547828550" target="_blank" class="inline-flex items-center gap-1 text-sm font-semibold" style="color: #25D366;">
              <span class="material-symbols-outlined text-base">chat</span>
              WhatsApp
            </a>
            <a href="mailto:info@safecapital.co.il" class="inline-flex items-center gap-1 text-sm font-semibold" style="color: #0369a1;">
              <span class="material-symbols-outlined text-base">mail</span>
              info@safecapital.co.il
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Change password card
  html += `
    <div class="bg-white rounded-xl p-5 mb-6" style="box-shadow: 0 1px 8px rgba(27,28,26,0.04);">
      <h2 class="text-lg font-bold mb-4" style="color: #022445;">\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E1\u05D9\u05E1\u05DE\u05D4</h2>
      <form id="passwordForm" onsubmit="handlePasswordChange(event)">
        <div class="mb-4">
          <label class="block text-sm mb-1" style="color: #43474e;">\u05E1\u05D9\u05E1\u05DE\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA</label>
          <input type="password" id="currentPassword" class="portal-input ltr" dir="ltr" required autocomplete="current-password">
        </div>
        <div class="mb-4">
          <label class="block text-sm mb-1" style="color: #43474e;">\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05D3\u05E9\u05D4</label>
          <input type="password" id="newPassword" class="portal-input ltr" dir="ltr" required minlength="6" autocomplete="new-password">
          <p class="text-xs mt-1" style="color: #74777f;">\u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD 6 \u05EA\u05D5\u05D5\u05D9\u05DD</p>
        </div>
        <div class="mb-4">
          <label class="block text-sm mb-1" style="color: #43474e;">\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05D3\u05E9\u05D4</label>
          <input type="password" id="confirmPassword" class="portal-input ltr" dir="ltr" required minlength="6" autocomplete="new-password">
        </div>
        <p id="passwordError" class="text-sm mb-3 hidden" style="color: #dc2626;"></p>
        <button type="submit" id="passwordSubmitBtn" class="w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors" style="background: #022445; min-height: 48px;">
          \u05E9\u05E0\u05D4 \u05E1\u05D9\u05E1\u05DE\u05D4
        </button>
      </form>
    </div>
  `;

  // Logout button
  html += `
    <button onclick="PORTAL_API.logout()" class="w-full py-3 rounded-lg text-sm font-semibold border transition-colors" style="color: #991b1b; border-color: #fecaca; background: #fff; min-height: 48px;">
      \u05D4\u05EA\u05E0\u05EA\u05E7
    </button>
  `;

  content.innerHTML = html;
}

function profileField(label, value, isLtr) {
  return `
    <div class="profile-field">
      <span class="profile-field-label">${label}</span>
      <span class="profile-field-value" ${isLtr ? 'dir="ltr" style="font-family: \'Inter\', sans-serif;"' : ''}>${value}</span>
    </div>
  `;
}

async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('passwordError');
  const submitBtn = document.getElementById('passwordSubmitBtn');

  // Reset error
  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  // Validate
  if (newPassword.length < 6) {
    errorEl.textContent = '\u05D4\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05DB\u05D9\u05DC \u05DC\u05E4\u05D7\u05D5\u05EA 6 \u05EA\u05D5\u05D5\u05D9\u05DD';
    errorEl.classList.remove('hidden');
    return;
  }
  if (newPassword !== confirmPassword) {
    errorEl.textContent = '\u05D4\u05E1\u05D9\u05E1\u05DE\u05D0\u05D5\u05EA \u05D0\u05D9\u05E0\u05DF \u05EA\u05D5\u05D0\u05DE\u05D5\u05EA';
    errorEl.classList.remove('hidden');
    return;
  }

  // Submit
  submitBtn.disabled = true;
  submitBtn.textContent = '\u05DE\u05E2\u05D3\u05DB\u05DF...';

  try {
    await PORTAL_API.put('/me/password', {
      current_password: currentPassword,
      new_password: newPassword
    });

    // Success
    showToast('\u05D4\u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05D5\u05E0\u05EA\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4', 'success');
    document.getElementById('passwordForm').reset();
  } catch (err) {
    showToast(err.message || '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D4\u05E1\u05D9\u05E1\u05DE\u05D4', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '\u05E9\u05E0\u05D4 \u05E1\u05D9\u05E1\u05DE\u05D4';
  }
}

function showToast(message, type) {
  // Remove existing toast
  const existing = document.querySelector('.portal-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'portal-toast';
  if (type === 'success') {
    toast.style.background = '#166534';
  } else if (type === 'error') {
    toast.style.background = '#991b1b';
  }
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

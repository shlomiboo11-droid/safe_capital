/**
 * Portal shell — header, footer, bottom nav, notifications
 */

// Current page detection
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('notifications')) return 'notifications';
  if (path.includes('profile')) return 'profile';
  if (path.includes('deal')) return 'deal';
  return 'home';
}

// Fetch unread notification count
async function fetchUnreadCount() {
  try {
    const data = await PORTAL_API.get('/notifications');
    const unread = Array.isArray(data) ? data.filter(n => !n.is_read).length : 0;
    updateBadges(unread);
    return unread;
  } catch {
    return 0;
  }
}

function updateBadges(count) {
  document.querySelectorAll('.notification-badge').forEach(badge => {
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}

// Build header
function buildHeader(activePage) {
  const header = document.getElementById('portalHeader');
  if (!header) return;

  const investor = PORTAL_API.getInvestor();
  const name = investor ? investor.name || investor.username || '' : '';

  header.innerHTML = `
    <div class="portal-header">
      <div class="portal-header-inner">
        <a href="/portal/index.html" class="portal-logo">
          <img src="/portal/images/logo-half.png" alt="Safe Capital" class="h-8">
        </a>

        <nav class="portal-nav-desktop">
          <a href="/portal/index.html" class="portal-nav-link ${activePage === 'home' ? 'active' : ''}">
            <span class="material-symbols-outlined text-xl">dashboard</span>
            העסקאות שלי
          </a>
          <a href="/portal/notifications.html" class="portal-nav-link ${activePage === 'notifications' ? 'active' : ''}">
            <span class="material-symbols-outlined text-xl">notifications</span>
            הודעות
            <span class="notification-badge hidden">0</span>
          </a>
          <a href="/portal/profile.html" class="portal-nav-link ${activePage === 'profile' ? 'active' : ''}">
            <span class="material-symbols-outlined text-xl">person</span>
            פרופיל
          </a>
        </nav>

        <div class="portal-header-actions">
          <span class="text-sm text-gray-500 hidden lg:inline">${name}</span>
          <button onclick="PORTAL_API.logout()" class="portal-logout-btn" title="התנתק">
            <span class="material-symbols-outlined text-xl">logout</span>
          </button>
          <button class="portal-hamburger lg:hidden" onclick="toggleMobileMenu()" aria-label="תפריט">
            <span class="material-symbols-outlined text-2xl">menu</span>
          </button>
        </div>
      </div>

      <div class="portal-mobile-menu hidden" id="portalMobileMenu">
        <a href="/portal/index.html" class="portal-mobile-link ${activePage === 'home' ? 'active' : ''}">
          <span class="material-symbols-outlined">dashboard</span>
          העסקאות שלי
        </a>
        <a href="/portal/notifications.html" class="portal-mobile-link ${activePage === 'notifications' ? 'active' : ''}">
          <span class="material-symbols-outlined">notifications</span>
          הודעות
          <span class="notification-badge hidden">0</span>
        </a>
        <a href="/portal/profile.html" class="portal-mobile-link ${activePage === 'profile' ? 'active' : ''}">
          <span class="material-symbols-outlined">person</span>
          פרופיל
        </a>
        <button onclick="PORTAL_API.logout()" class="portal-mobile-link" style="width:100%; border:none; background:none; cursor:pointer; font-family:inherit; font-size:inherit;">
          <span class="material-symbols-outlined">logout</span>
          התנתק
        </button>
      </div>
    </div>
  `;
}

function toggleMobileMenu() {
  const menu = document.getElementById('portalMobileMenu');
  if (!menu) return;
  menu.classList.toggle('hidden');
  const btn = document.querySelector('.portal-hamburger .material-symbols-outlined');
  if (btn) btn.textContent = menu.classList.contains('hidden') ? 'menu' : 'close';
}

// Build footer
function buildFooter() {
  const footer = document.getElementById('portalFooter');
  if (!footer) return;

  footer.innerHTML = `
    <div class="portal-footer">
      <div class="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style="color: #43474e;">
        <span>&copy; Safe Capital 2026. כל הזכויות שמורות.</span>
        <div class="flex items-center gap-4">
          <a href="https://wa.me/972544594947" target="_blank" class="hover:underline" style="color: #25D366;">WhatsApp</a>
          <a href="mailto:info@safecapital.co.il" class="hover:underline">info@safecapital.co.il</a>
          <a href="tel:+972544594947" class="hover:underline">054-459-4947</a>
        </div>
      </div>
      <div class="text-center text-xs px-4 pb-4" style="color: #74777f;">
        המידע באתר אינו מהווה ייעוץ השקעות או הצעה לציבור. ההשקעה כרוכה בסיכון.
      </div>
    </div>
  `;
}

// Build bottom nav (mobile only)
function buildBottomNav(activePage) {
  const nav = document.getElementById('portalBottomNav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="portal-bottom-nav">
      <a href="/portal/index.html" class="portal-bottom-link ${activePage === 'home' ? 'active' : ''}">
        <span class="material-symbols-outlined">dashboard</span>
        <span class="portal-bottom-label">העסקאות שלי</span>
      </a>
      <a href="/portal/notifications.html" class="portal-bottom-link ${activePage === 'notifications' ? 'active' : ''}">
        <span class="material-symbols-outlined">notifications</span>
        <span class="notification-badge hidden">0</span>
        <span class="portal-bottom-label">הודעות</span>
      </a>
      <a href="/portal/profile.html" class="portal-bottom-link ${activePage === 'profile' ? 'active' : ''}">
        <span class="material-symbols-outlined">person</span>
        <span class="portal-bottom-label">פרופיל</span>
      </a>
    </div>
  `;
}

// Main init
function initPortalShell(activePage) {
  if (!activePage) activePage = getCurrentPage();
  buildHeader(activePage);
  buildFooter();
  buildBottomNav(activePage);
  fetchUnreadCount();
}

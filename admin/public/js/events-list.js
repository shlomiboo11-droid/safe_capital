/**
 * Events list page
 */
(function() {
  if (!requireAuth()) return;

  const user = API.getUser();
  document.getElementById('sidebar-username').textContent = user.full_name;
  document.getElementById('sidebar-role').textContent =
    user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל';
  if (user.role === 'super_admin') {
    document.getElementById('nav-users').style.display = '';
  }

  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  loadEvents();
})();

async function loadEvents() {
  const container = document.getElementById('eventsContainer');
  const loading = document.getElementById('loadingState');
  const empty = document.getElementById('emptyState');

  try {
    const data = await API.get('/events');
    loading.classList.add('hidden');
    loading.style.display = 'none';

    if (!data.events || data.events.length === 0) {
      empty.classList.remove('hidden');
      empty.style.display = '';
      return;
    }

    container.innerHTML = data.events.map(renderEventCard).join('');
  } catch (err) {
    loading.innerHTML = `<p class="text-red-500">שגיאה בטעינה: ${err.message}</p>`;
  }
}

function renderEventCard(ev) {
  const title = (ev.hero_title_main || ev.slug || 'ללא כותרת') + (ev.hero_title_accent ? ' · ' + ev.hero_title_accent : '');
  const dateLabel = ev.event_date_display_short || (ev.event_date ? String(ev.event_date).slice(0, 10) : 'ללא תאריך');
  const venue = ev.venue_short || ev.venue_name || '—';

  const activeBadge = ev.is_active
    ? '<span class="badge badge-green text-xs" style="font-weight:600">פעיל באתר</span>'
    : '';
  const publishedBadge = ev.is_published
    ? '<span class="badge badge-blue text-xs">מפורסם</span>'
    : '<span class="badge badge-gray text-xs">טיוטה</span>';

  return `
    <a href="/event?id=${ev.id}" class="card hover:shadow-md transition-shadow group" style="display:block;padding:1.25rem;">
      <div class="flex items-start justify-between mb-3">
        <div style="flex:1;min-width:0;">
          <h3 class="font-bold text-gray-900 group-hover:text-primary transition-colors" style="font-size:1.05rem;line-height:1.3;">${title}</h3>
          <div class="text-xs text-gray-500 mt-1 font-inter">${dateLabel}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.25rem;align-items:flex-end;flex-shrink:0;">
          ${activeBadge}
          ${publishedBadge}
        </div>
      </div>

      <div class="flex items-center gap-2 text-sm text-gray-500 mt-2">
        <span class="material-symbols-outlined" style="font-size:1rem">place</span>
        <span>${venue}</span>
      </div>

      <div class="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
        <div class="text-center">
          <div class="font-inter font-bold text-lg text-primary">${ev.registrations_count || 0}</div>
          <div class="text-xs text-gray-500">נרשמים</div>
        </div>
        <div class="text-center">
          <div class="font-inter font-bold text-lg text-gray-700">${ev.featured_deals_count || 0}</div>
          <div class="text-xs text-gray-500">עסקאות</div>
        </div>
        <div class="text-center">
          <div class="font-inter font-bold text-lg text-gray-700">${ev.seats_total || 0}</div>
          <div class="text-xs text-gray-500">מקומות</div>
        </div>
      </div>
    </a>
  `;
}

// ── New event modal ────────────────────────────────────────

function createNewEvent() {
  document.getElementById('newEventModal').classList.remove('hidden');
  document.getElementById('newEventTitle').focus();
}

function closeNewEventModal() {
  document.getElementById('newEventModal').classList.add('hidden');
  document.getElementById('newEventForm').reset();
}

document.getElementById('newEventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const hero_title_main = document.getElementById('newEventTitle').value.trim();
  const hero_title_accent = document.getElementById('newEventAccent').value.trim();
  const slug = document.getElementById('newEventSlug').value.trim();
  const event_date = document.getElementById('newEventDate').value;

  if (!hero_title_main) return;

  try {
    const data = await API.post('/events', { hero_title_main, hero_title_accent, slug, event_date });
    closeNewEventModal();
    window.location.href = `/event?id=${data.id}`;
  } catch (err) {
    showToast(err.message, 'error');
  }
});

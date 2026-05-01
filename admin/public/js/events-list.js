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
    <a href="/event?id=${ev.id}" class="card hover:shadow-md transition-shadow group" style="display:block;padding:1.25rem;position:relative;">
      <button type="button"
        class="event-card-menu-btn"
        onclick="event.preventDefault();event.stopPropagation();toggleEventMenu(${ev.id});"
        aria-label="תפריט פעולות"
        style="position:absolute;top:0.75rem;left:0.75rem;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:transparent;border:none;cursor:pointer;color:#6b7280;z-index:2;">
        <span class="material-symbols-outlined" style="font-size:20px;">more_vert</span>
      </button>
      <div id="event-menu-${ev.id}" class="event-card-menu hidden"
        onclick="event.preventDefault();event.stopPropagation();"
        style="position:absolute;top:2.6rem;left:0.75rem;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.08);min-width:160px;z-index:10;overflow:hidden;">
        <button type="button" onclick="event.preventDefault();event.stopPropagation();duplicateEvent(${ev.id});" class="event-menu-item" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.6rem 0.9rem;background:none;border:none;text-align:right;cursor:pointer;font-size:0.875rem;color:#374151;">
          <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
          שכפל
        </button>
        <button type="button" onclick="event.preventDefault();event.stopPropagation();${ev.is_active ? 'unpublishEvent' : 'publishEvent'}(${ev.id});" class="event-menu-item" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.6rem 0.9rem;background:none;border:none;text-align:right;cursor:pointer;font-size:0.875rem;color:#374151;">
          <span class="material-symbols-outlined" style="font-size:18px;">${ev.is_active ? 'visibility_off' : 'publish'}</span>
          ${ev.is_active ? 'הסתר מהאתר' : 'פרסם'}
        </button>
        <button type="button" onclick="event.preventDefault();event.stopPropagation();deleteEvent(${ev.id}, '${(title || '').replace(/'/g, "\\'")}');" class="event-menu-item" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.6rem 0.9rem;background:none;border:none;text-align:right;cursor:pointer;font-size:0.875rem;color:#b91c1c;">
          <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
          מחק
        </button>
      </div>
      <div class="flex items-start justify-between mb-3">
        <div style="flex:1;min-width:0;padding-left:2.5rem;">
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

// ── Per-card action menu ───────────────────────────────────

function toggleEventMenu(id) {
  const menu = document.getElementById('event-menu-' + id);
  if (!menu) return;
  // Close all other menus first
  document.querySelectorAll('.event-card-menu').forEach(m => {
    if (m !== menu) m.classList.add('hidden');
  });
  menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  // Close all menus if click lands outside any menu or trigger
  if (!e.target.closest('.event-card-menu') && !e.target.closest('.event-card-menu-btn')) {
    document.querySelectorAll('.event-card-menu').forEach(m => m.classList.add('hidden'));
  }
});

async function duplicateEvent(id) {
  try {
    const res = await API.post(`/events/${id}/duplicate`, {});
    showToast('האירוע שוכפל', 'success');
    window.location.href = `/event?id=${res.id}`;
  } catch (err) {
    showToast('שכפול נכשל: ' + err.message, 'error');
  }
}

async function publishEvent(id) {
  try {
    await API.post(`/events/${id}/activate`, {});
    showToast('האירוע מוצג באתר. אירועים אחרים הוסרו מפרסום.', 'success');
    await loadEvents();
  } catch (err) {
    showToast('פרסום נכשל: ' + err.message, 'error');
  }
}

async function unpublishEvent(id) {
  try {
    await API.post(`/events/${id}/deactivate`, {});
    showToast('האירוע הוסר מהאתר. הנתונים נשמרו.', 'success');
    await loadEvents();
  } catch (err) {
    showToast('הסרה נכשלה: ' + err.message, 'error');
  }
}

async function deleteEvent(id, title) {
  if (!confirm(`למחוק לצמיתות את האירוע "${title}"?\nפעולה זו לא ניתנת לביטול.`)) return;
  try {
    await API.delete(`/events/${id}`);
    showToast('האירוע נמחק', 'success');
    await loadEvents();
  } catch (err) {
    showToast('מחיקה נכשלה: ' + err.message, 'error');
  }
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

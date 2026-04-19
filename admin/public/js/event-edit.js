/**
 * Event Edit Page — orchestrator
 */
let currentEvent = null;
let currentEventData = null;

(function() {
  if (!requireAuth()) return;

  const user = API.getUser();
  document.getElementById('sidebar-username').textContent = user.full_name;
  document.getElementById('sidebar-role').textContent = user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל';
  if (user.role === 'super_admin') document.getElementById('nav-users').style.display = '';

  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  initTabs();
  loadEvent();
})();

function getEventIdFromUrl() {
  const param = getUrlParam('id');
  if (param) return param;
  const match = window.location.pathname.match(/\/event\/(\d+)/);
  return match ? match[1] : null;
}

async function loadEvent() {
  const eventId = getEventIdFromUrl();
  if (!eventId) {
    window.location.href = '/events';
    return;
  }

  try {
    const data = await API.get(`/events/${eventId}`);
    currentEvent = data.event;
    currentEventData = data;

    updateHeader(data.event);
    document.title = `${data.event.hero_title_main || data.event.slug} | Safe Capital Admin`;

    renderBasicTab(data);
    renderAgendaTab(data);
    renderSpeakersTab(data);
    renderFeaturedDealsTab(data);
    renderFaqsTab(data);
    renderRegistrationsTab(data);
  } catch (err) {
    document.getElementById('eventTitle').textContent = 'שגיאה בטעינה';
    showToast(err.message, 'error');
  }
}

function updateHeader(ev) {
  const title = (ev.hero_title_main || ev.slug || 'ללא כותרת') + (ev.hero_title_accent ? ' · ' + ev.hero_title_accent : '');
  document.getElementById('eventTitle').textContent = title;
  document.getElementById('eventSlugBadge').textContent = ev.slug;

  const activeBadge = document.getElementById('eventActiveBadge');
  if (ev.is_active) {
    activeBadge.textContent = 'פעיל באתר';
    activeBadge.className = 'badge badge-green text-xs';
  } else {
    activeBadge.textContent = 'לא פעיל';
    activeBadge.className = 'badge badge-gray text-xs';
  }

  const pubBadge = document.getElementById('eventPublishedBadge');
  if (ev.is_published) {
    pubBadge.textContent = 'מפורסם';
    pubBadge.className = 'badge badge-blue text-xs';
  } else {
    pubBadge.textContent = 'טיוטה';
    pubBadge.className = 'badge badge-gray text-xs';
  }

  document.getElementById('activateBtn').style.display = ev.is_active ? 'none' : '';
  document.getElementById('deactivateBtn').style.display = ev.is_active ? '' : 'none';
}

async function reloadEvent(renderTab) {
  try {
    const data = await API.get(`/events/${currentEvent.id}`);
    currentEvent = data.event;
    currentEventData = data;
    updateHeader(data.event);
    if (renderTab) renderTab(data);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveEventFields(body) {
  try {
    await API.put(`/events/${currentEvent.id}`, body);
    Object.assign(currentEvent, body);
    showToast('נשמר בהצלחה');
    updateHeader(currentEvent);
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

async function activateEvent() {
  const ok = await confirmAction('להפעיל את האירוע הזה? אירוע פעיל אחר יועבר למצב "לא פעיל".');
  if (!ok) return;
  try {
    await API.post(`/events/${currentEvent.id}/activate`, {});
    showToast('האירוע הופעל');
    reloadEvent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deactivateEvent() {
  const ok = await confirmAction('להפסיק את פעילות האירוע? לא יוצג באתר יותר.');
  if (!ok) return;
  try {
    await API.post(`/events/${currentEvent.id}/deactivate`, {});
    showToast('האירוע הופסק');
    reloadEvent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteEventAction() {
  const confirmed = await showConfirmModal('מחיקת אירוע', `האם למחוק את האירוע "${currentEvent.hero_title_main || currentEvent.slug}"? פעולה זו אינה ניתנת לביטול.`);
  if (!confirmed) return;
  try {
    await API.delete(`/events/${currentEvent.id}`);
    showToast('האירוע נמחק');
    window.location.href = '/events';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

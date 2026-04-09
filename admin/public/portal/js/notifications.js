/**
 * Notifications page — load, render, mark as read
 */

const investor = requirePortalAuth();
if (investor) {
  initPortalShell('notifications');
  loadNotifications();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Relative date helper
function relativeDate(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '\u05E2\u05DB\u05E9\u05D9\u05D5';
  if (diffMins < 60) return `\u05DC\u05E4\u05E0\u05D9 ${diffMins} \u05D3\u05E7\u05D5\u05EA`;
  if (diffHours < 24) return `\u05DC\u05E4\u05E0\u05D9 ${diffHours} \u05E9\u05E2\u05D5\u05EA`;
  if (diffDays === 1) return '\u05D0\u05EA\u05DE\u05D5\u05DC';
  if (diffDays < 7) return `\u05DC\u05E4\u05E0\u05D9 ${diffDays} \u05D9\u05DE\u05D9\u05DD`;
  const months = ['\u05D9\u05E0\u05D5\u05D0\u05E8','\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8','\u05DE\u05E8\u05E5','\u05D0\u05E4\u05E8\u05D9\u05DC','\u05DE\u05D0\u05D9','\u05D9\u05D5\u05E0\u05D9','\u05D9\u05D5\u05DC\u05D9','\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8','\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8','\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8','\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8','\u05D3\u05E6\u05DE\u05D1\u05E8'];
  return `${date.getDate()} \u05D1${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Icon map by notification type
function getNotificationIcon(type) {
  const map = {
    update: { icon: 'info', cls: 'update' },
    milestone: { icon: 'flag', cls: 'milestone' },
    document: { icon: 'description', cls: 'document' },
    financial: { icon: 'payments', cls: 'financial' },
    message: { icon: 'chat', cls: 'message' }
  };
  return map[type] || map.update;
}

async function loadNotifications() {
  const loading = document.getElementById('loadingState');
  const content = document.getElementById('notificationsContent');

  try {
    const data = await PORTAL_API.get('/notifications');
    const notifications = Array.isArray(data) ? data : (data.notifications || []);
    const unreadCount = Array.isArray(data)
      ? data.filter(n => !n.is_read).length
      : (data.unread_count || 0);

    loading.classList.add('hidden');
    content.classList.remove('hidden');
    renderNotifications(notifications, unreadCount);
  } catch (err) {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    content.innerHTML = `
      <div class="text-center py-16">
        <span class="material-symbols-outlined text-5xl mb-4 block" style="color: #d1d5db;">error</span>
        <p class="text-lg font-semibold" style="color: #1b1c1a;">\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA</p>
        <p class="text-sm mt-2" style="color: #43474e;">${escapeHtml(err.message)}</p>
        <button onclick="location.reload()" class="mt-4 px-6 py-2 rounded-lg text-sm font-semibold text-white" style="background: #022445;">
          \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1
        </button>
      </div>
    `;
  }
}

function renderNotifications(notifications, unreadCount) {
  const content = document.getElementById('notificationsContent');
  let html = '';

  // Page header with unread badge
  html += `
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold" style="color: #022445; font-family: 'Heebo', sans-serif;">\u05D4\u05D5\u05D3\u05E2\u05D5\u05EA</h1>
        ${unreadCount > 0 ? `
          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style="background: #984349; font-family: 'Inter', sans-serif; min-width: 24px;">
            ${unreadCount}
          </span>
        ` : ''}
      </div>
      ${unreadCount > 0 ? `
        <button id="markAllReadBtn" onclick="markAllAsRead()" class="text-sm font-semibold px-4 py-2 rounded-lg transition-colors" style="color: #022445; background: rgba(2,36,69,0.06); min-height: 48px;">
          \u05E1\u05DE\u05DF \u05D4\u05DB\u05DC \u05DB\u05E0\u05E7\u05E8\u05D0
        </button>
      ` : ''}
    </div>
  `;

  // Empty state
  if (notifications.length === 0) {
    html += `
      <div class="text-center py-16">
        <span class="material-symbols-outlined text-5xl mb-4 block" style="color: #d1d5db;">notifications_none</span>
        <p class="text-lg font-semibold" style="color: #1b1c1a;">\u05D0\u05D9\u05DF \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA.</p>
        <p class="text-sm mt-2" style="color: #43474e;">\u05DB\u05E9\u05D9\u05D4\u05D9\u05D5 \u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD \u2014 \u05EA\u05E8\u05D0\u05D4 \u05D0\u05D5\u05EA\u05DD \u05DB\u05D0\u05DF.</p>
      </div>
    `;
  } else {
    // Notification list
    html += `<div id="notificationList">`;
    notifications.forEach(n => {
      const iconData = getNotificationIcon(n.type);
      const isUnread = !n.is_read;
      const nId = n.id || n._id;

      html += `
        <div class="notification-item ${isUnread ? 'unread' : 'read'}" data-id="${nId}" onclick="markAsRead('${nId}', this)">
          <div class="notification-icon ${iconData.cls}">
            <span class="material-symbols-outlined">${iconData.icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2 mb-1">
              <p class="text-sm ${isUnread ? 'font-bold' : 'font-medium'}" style="color: #1b1c1a;">${escapeHtml(n.title)}</p>
              <span class="text-xs flex-shrink-0" style="color: #74777f; font-family: 'Inter', sans-serif;">${relativeDate(n.created_at)}</span>
            </div>
            <p class="text-sm notification-body" style="color: #43474e;">${escapeHtml(n.body)}</p>
            ${n.deal_id ? `
              <a href="/deal.html?id=${n.deal_id}" class="inline-flex items-center gap-1 text-xs font-semibold mt-2" style="color: #022445;" onclick="event.stopPropagation();">
                \u05E6\u05E4\u05D4 \u05D1\u05E2\u05E1\u05E7\u05D4
                <span class="material-symbols-outlined text-sm">arrow_back</span>
              </a>
            ` : ''}
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  content.innerHTML = html;
}

async function markAsRead(id, element) {
  if (!element || element.classList.contains('read')) return;

  try {
    await PORTAL_API.put(`/notifications/${id}/read`);
  } catch {
    // Silently fail — still update UI
  }

  element.classList.remove('unread');
  element.classList.add('read');
  // Remove bold from title
  const title = element.querySelector('p');
  if (title) {
    title.classList.remove('font-bold');
    title.classList.add('font-medium');
  }

  // Update badge counts
  const remaining = document.querySelectorAll('.notification-item.unread').length;
  updateBadges(remaining);
  updateHeaderBadge(remaining);
}

async function markAllAsRead() {
  const unreadItems = document.querySelectorAll('.notification-item.unread');
  if (unreadItems.length === 0) return;

  const btn = document.getElementById('markAllReadBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '\u05DE\u05E1\u05DE\u05DF...';
  }

  const promises = [];
  unreadItems.forEach(item => {
    const id = item.dataset.id;
    promises.push(PORTAL_API.put(`/notifications/${id}/read`).catch(() => {}));

    item.classList.remove('unread');
    item.classList.add('read');
    const title = item.querySelector('p');
    if (title) {
      title.classList.remove('font-bold');
      title.classList.add('font-medium');
    }
  });

  await Promise.all(promises);

  updateBadges(0);
  updateHeaderBadge(0);

  if (btn) btn.remove();
  // Remove the unread count badge in page header
  const headerBadgeInline = document.querySelector('#notificationsContent .rounded-full');
  if (headerBadgeInline) headerBadgeInline.remove();
}

function updateHeaderBadge(count) {
  // Update the inline page header badge
  const badge = document.querySelector('#notificationsContent .rounded-full');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
    } else {
      badge.remove();
    }
  }
}

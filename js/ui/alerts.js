// =============================================================================
// NexStep — UI: Alerts / Notifications
// Fetches user notifications from Supabase and renders them.
// =============================================================================

import { fetchNotifications, markAllNotificationsRead } from '../api/notifications.js';
import { getCurrentUser } from '../auth.js';
import { showToast } from './toast.js';

/**
 * Render the alerts/notifications page.
 */
export async function renderAlerts() {
  const user      = getCurrentUser();
  const container = document.querySelector('.notif-list');
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <div class="empty-state-title">Sign In for Alerts</div>
        <div class="empty-state-desc">Sign in to receive personalized deadline alerts and notifications.</div>
      </div>
    `;
    return;
  }

  // Loading shimmer
  container.innerHTML = Array(3).fill(0).map(() => `
    <div class="notif-item">
      <div class="shimmer" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div class="shimmer" style="height:14px;width:70%;margin-bottom:8px;border-radius:4px;"></div>
        <div class="shimmer" style="height:40px;width:100%;margin-bottom:6px;border-radius:4px;"></div>
        <div class="shimmer" style="height:11px;width:30%;border-radius:4px;"></div>
      </div>
    </div>
  `).join('');

  const notifications = await fetchNotifications(user.id, 20);

  if (!notifications.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">You're All Caught Up</div>
        <div class="empty-state-desc">No alerts right now. We'll notify you when deadlines approach.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(n => buildNotifItem(n)).join('');
}

/** Handle "Mark All Read" button */
export async function handleMarkAllRead() {
  const user = getCurrentUser();
  if (!user) return;

  await markAllNotificationsRead(user.id);

  // Update UI — remove unread styling and dots
  document.querySelectorAll('.notif-item.unread').forEach(el => {
    el.classList.remove('unread');
  });
  document.querySelectorAll('.notif-dot').forEach(el => el.remove());

  // Zero the badge
  const badge = document.querySelector('#nav-alerts .nav-badge');
  if (badge) badge.style.display = 'none';

  showToast('All notifications marked as read.', 'success');
}

function buildNotifItem(n) {
  const icon = {
    deadline_alert: '🚨',
    tip_verified:   '✅',
    tip_flagged:    '🚩',
    weekly_digest:  '📊',
    new_intel:      '📡',
  }[n.type] || '🔔';

  const iconBg = {
    deadline_alert: 'var(--red-dim)',
    tip_verified:   'var(--green-dim)',
    tip_flagged:    'var(--red-dim)',
    weekly_digest:  'var(--purple-dim)',
    new_intel:      'var(--accent-dim)',
  }[n.type] || 'var(--surface2)';

  const timeLabel = timeAgo(n.created_at);
  const unreadClass = n.is_read ? '' : 'unread';
  const dot = n.is_read ? '' : '<div class="notif-dot"></div>';

  return `
    <div class="notif-item ${unreadClass}" data-id="${n.id}">
      <div class="notif-icon" style="background:${iconBg};">${icon}</div>
      <div class="notif-content">
        <div class="notif-title">${escapeHTML(n.title)}</div>
        <div class="notif-desc">${escapeHTML(n.body)}</div>
        <div class="notif-time">⏰ ${timeLabel}</div>
      </div>
      ${dot}
    </div>
  `;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h    = Math.round(diff / 3600000);
  if (h < 1)   return 'Just now';
  if (h < 2)   return '1 hour ago';
  if (h < 24)  return `${h} hours ago`;
  if (h < 48)  return 'Yesterday';
  return `${Math.ceil(h / 24)} days ago`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t])
  );
}

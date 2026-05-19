// =============================================================================
// NexStep — API: Notifications
// Fetch and manage user notifications / smart alerts.
// =============================================================================

import { supabase } from '../supabase.js';

// Guard: skip DB calls if userId is not a valid UUID (demo mode fallback)
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}


/**
 * Fetch notifications for the current user, newest first.
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function fetchNotifications(userId, limit = 20) {
  if (!isValidUUID(userId)) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, is_read, intel_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] fetchNotifications error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Count unread notifications for sidebar badge.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countUnreadNotifications(userId) {
  if (!isValidUUID(userId)) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Mark a single notification as read.
 * @param {string} notificationId
 */
export async function markNotificationRead(notificationId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

/**
 * Mark all notifications as read for a user.
 * @param {string} userId
 */
export async function markAllNotificationsRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

/**
 * Generate deadline alert notifications for upcoming intel deadlines.
 * Called on app load to surface relevant upcoming deadlines to the user.
 *
 * @param {string} userId
 * @param {Array}  upcomingIntel - from fetchUpcomingDeadlines()
 */
export async function generateDeadlineAlerts(userId, upcomingIntel) {
  if (!isValidUUID(userId)) return; // skip for demo users

  const alerts = upcomingIntel
    .filter(item => item.deadline_at)
    .map(item => {
      const hoursLeft = Math.round(
        (new Date(item.deadline_at) - Date.now()) / 3600000
      );
      const label = hoursLeft < 24
        ? `${hoursLeft} hours left`
        : hoursLeft < 48
          ? 'Tomorrow'
          : `${Math.ceil(hoursLeft / 24)} days left`;

      return {
        user_id:  userId,
        type:     'deadline_alert',
        title:    `Deadline: ${item.title}`,
        body:     `Closes in ${label}. Check the Intel Feed for details.`,
        intel_id: item.id,
        is_read:  false,
      };
    });

  if (alerts.length === 0) return;

  // Insert only new ones (ignore if already exists for this intel+user combo)
  // We check for duplicates by intel_id so we don't spam
  for (const alert of alerts) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('intel_id', alert.intel_id)
      .eq('type', 'deadline_alert')
      .single();

    if (!existing) {
      await supabase.from('notifications').insert(alert);
    }
  }
}

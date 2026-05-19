// =============================================================================
// NexStep — UI: Sidebar
// Populates college selector from DB, manages nav badge counts.
// =============================================================================

import { fetchColleges, fetchCollegeBySlug } from '../api/colleges.js';
import { fetchFeedStats } from '../api/intel.js';
import { countUnreadNotifications } from '../api/notifications.js';

let _colleges     = [];
let _selectedSlug = 'iit-delhi';

/**
 * Initialize the sidebar: load colleges, restore last selection.
 * @returns {Promise<string>} Selected college slug
 */
export async function initSidebar() {
  _colleges = await fetchColleges();
  renderCollegeSelector(_colleges);

  // Restore saved college preference
  const saved = localStorage.getItem('nextstep_college');
  if (saved) {
    _selectedSlug = saved;
    const select = document.querySelector('.college-selector select');
    if (select) select.value = saved;
  }

  return _selectedSlug;
}

/** Render college options into the <select> */
function renderCollegeSelector(colleges) {
  const select = document.querySelector('.college-selector select');
  if (!select) return;

  select.innerHTML = colleges.length
    ? colleges.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')
    : '<option value="">No colleges found</option>';
}

/** Called when user picks a different college */
export function getSelectedSlug()  { return _selectedSlug; }
export function setSelectedSlug(slug) {
  _selectedSlug = slug;
  localStorage.setItem('nextstep_college', slug);
}

/**
 * Update nav badges with live counts from Supabase.
 * @param {string} collegeId
 * @param {string} userId
 */
export async function refreshNavBadges(collegeId, userId) {
  const [stats, unreadCount] = await Promise.all([
    fetchFeedStats(collegeId),
    userId ? countUnreadNotifications(userId) : Promise.resolve(0),
  ]);

  // "Intel Feed" badge — new intel this week (total pending as proxy)
  const feedBadge = document.querySelector('.nav-item:nth-child(1) .nav-badge');
  if (feedBadge) {
    feedBadge.textContent = stats.totalApproved > 0
      ? stats.totalApproved.toString()
      : '';
    feedBadge.style.display = stats.totalApproved > 0 ? '' : 'none';
  }

  // "Alerts" badge
  const alertsBadge = document.querySelector('#nav-alerts .nav-badge');
  if (alertsBadge) {
    alertsBadge.textContent = unreadCount > 0 ? unreadCount.toString() : '';
    alertsBadge.style.display = unreadCount > 0 ? '' : 'none';
  }

  // "Verify Queue" badge
  const verifyBadge = document.querySelector('#nav-verify .nav-badge');
  if (verifyBadge) {
    verifyBadge.textContent = stats.totalPending > 0
      ? stats.totalPending.toString()
      : '';
    verifyBadge.style.display = stats.totalPending > 0 ? '' : 'none';
  }
}

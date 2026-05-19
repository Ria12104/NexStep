// =============================================================================
// NexStep — UI: Stats Row
// Renders the 4 stat cards on the Intel Feed page with live Supabase data.
// =============================================================================

import { fetchFeedStats } from '../api/intel.js';

/**
 * Load and render the stats row on the feed page.
 * Shows shimmer loading state while fetching.
 * @param {string} collegeId
 */
export async function renderStats(collegeId) {
  const statCards = document.querySelectorAll('.stat-card .stat-value');
  const statChanges = document.querySelectorAll('.stat-card .stat-change');

  // Show loading shimmer
  statCards.forEach(el => {
    el.textContent = '—';
    el.classList.add('shimmer');
  });

  const stats = await fetchFeedStats(collegeId);

  // Remove shimmer
  statCards.forEach(el => el.classList.remove('shimmer'));

  // Active Intel count
  const activeIntelEl = document.getElementById('stat-active-intel');
  if (activeIntelEl) activeIntelEl.textContent = stats.totalApproved.toLocaleString();

  // Senior Contributors
  const contributorsEl = document.getElementById('stat-contributors');
  if (contributorsEl) contributorsEl.textContent = stats.seniorContributors.toLocaleString();
}

// =============================================================================
// NexStep — UI: Stats Row + Credibility Widget
// Renders the 4 stat cards and the credibility score widget from Supabase.
// =============================================================================

import { fetchFeedStats } from '../api/intel.js';
import { getCurrentUser, getCurrentProfile } from '../auth.js';

/**
 * Load and render the stats row + credibility widget.
 * @param {string} collegeId
 */
export async function renderStats(collegeId) {
  const statCards = document.querySelectorAll('.stat-card .stat-value');

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

  // Credibility widget
  renderCredibilityWidget();
}

/** Populate the "Your Credibility Score" widget in the feed sidebar. */
export function renderCredibilityWidget() {
  const widget = document.getElementById('credibility-widget');
  if (!widget) return;

  const user    = getCurrentUser();
  const profile = getCurrentProfile();

  if (!user || !profile) {
    widget.innerHTML = `
      <div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">
        Sign in to view your score
      </div>
    `;
    return;
  }

  const score    = profile.credibility_score ?? 0;
  const tier     = getTier(score);
  const nextTier = getNextTierThreshold(score);
  const pct      = nextTier ? Math.min(100, Math.round((score / nextTier) * 100)) : 100;
  const avatarColors = 'linear-gradient(135deg,var(--accent),var(--purple))';

  widget.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div style="width:38px;height:38px;border-radius:50%;background:${avatarColors};
                  display:flex;align-items:center;justify-content:center;
                  font-weight:700;font-size:15px;color:white;flex-shrink:0;">
        ${profile.initials || '?'}
      </div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);">
          ${escapeHTML(profile.full_name || 'You')}
        </div>
        <div style="font-size:11px;color:var(--text3);">${tier}</div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--accent);">${score}</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);">pts</div>
      </div>
    </div>

    ${nextTier ? `
    <div class="credibility-bar">
      <div class="cred-header">
        <span>Progress to next tier</span>
        <span>${score} / ${nextTier}</span>
      </div>
      <div class="cred-track">
        <div class="cred-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));"></div>
      </div>
    </div>` : `
    <div style="text-align:center;font-size:12px;color:var(--accent);padding:4px 0;">👑 Max Tier Reached!</div>
    `}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--blue);">${profile.tips_submitted ?? 0}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">Tips Submitted</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--green);">${profile.tips_verified ?? 0}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">Tips Verified</div>
      </div>
    </div>
  `;
}

function getTier(score) {
  if (score >= 1000) return '👑 Legend';
  if (score >= 600)  return '💎 Intel Expert';
  if (score >= 300)  return '🔥 Trusted Contributor';
  if (score >= 100)  return '⚡ Contributor';
  return '🌱 Newcomer';
}

function getNextTierThreshold(score) {
  if (score < 100)  return 100;
  if (score < 300)  return 300;
  if (score < 600)  return 600;
  if (score < 1000) return 1000;
  return null; // max tier
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t])
  );
}

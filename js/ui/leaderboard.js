// =============================================================================
// NexStep — UI: Leaderboard
// Renders contributor leaderboard from Supabase profiles.
// =============================================================================

import { fetchLeaderboard } from '../api/profiles.js';
import { getCurrentUser, getCurrentCollegeId } from '../auth.js';

/**
 * Load and render the leaderboard for the current college.
 */
export async function renderLeaderboard() {
  const collegeId = getCurrentCollegeId();
  const currentUser = getCurrentUser();

  const container = document.querySelector('.card .leaderboard-list');
  if (!container) return;

  // Show shimmer
  container.innerHTML = Array(5).fill(0).map(() => `
    <div class="leaderboard-item" style="pointer-events:none;">
      <div class="shimmer" style="width:24px;height:24px;border-radius:50%;"></div>
      <div class="shimmer" style="width:38px;height:38px;border-radius:50%;"></div>
      <div style="flex:1;">
        <div class="shimmer" style="height:14px;width:60%;margin-bottom:6px;border-radius:4px;"></div>
        <div class="shimmer" style="height:12px;width:40%;border-radius:4px;"></div>
      </div>
      <div class="shimmer" style="width:50px;height:20px;border-radius:4px;"></div>
    </div>
  `).join('');

  if (!collegeId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏫</div>
        <div class="empty-state-title">Select a College</div>
        <div class="empty-state-desc">Choose your college to see the leaderboard.</div>
      </div>
    `;
    return;
  }

  const leaders = await fetchLeaderboard(collegeId, 20);

  if (!leaders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-title">No Contributors Yet</div>
        <div class="empty-state-desc">Be the first to submit and verify intel at your college!</div>
      </div>
    `;
    return;
  }

  const rankIcons = ['🥇', '🥈', '🥉'];
  const avatarColors = [
    '#f5a623,#e8892a', '#4da6ff,#2563eb', '#3ecf8e,#059669',
    '#a78bfa,#7c3aed', '#ff6b6b,#dc2626', '#f5a623,#a78bfa',
  ];

  container.innerHTML = leaders.map((p, i) => {
    const isCurrentUser = currentUser && p.id === currentUser.id;
    const rank     = i + 1;
    const rankDisp = rank <= 3 ? rankIcons[i] : rank.toString();
    const colorPair = avatarColors[i % avatarColors.length];
    const tierLabel = getTier(p.credibility_score);
    const highlightStyle = isCurrentUser
      ? 'background:var(--accent-dim);border-radius:var(--radius-sm);padding:12px 8px;border-bottom:none;margin-bottom:8px;'
      : '';
    const nameStyle = isCurrentUser ? 'color:var(--accent);' : '';

    return `
      <div class="leaderboard-item" style="${highlightStyle}">
        <div class="rank-num ${rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''}">${rankDisp}</div>
        <div class="leaderboard-avatar" style="background:linear-gradient(135deg,${colorPair});">
          ${escapeHTML(p.initials || p.full_name?.slice(0,2)?.toUpperCase() || '?')}
        </div>
        <div class="leaderboard-info">
          <div class="leaderboard-name" style="${nameStyle}">
            ${escapeHTML(p.full_name || 'Anonymous')}${isCurrentUser ? ' (You)' : ''}
          </div>
          <div class="leaderboard-meta">
            ${escapeHTML([p.year, p.branch?.toUpperCase()].filter(Boolean).join(' · '))}
            · ${p.tips_submitted} tip${p.tips_submitted !== 1 ? 's' : ''} submitted
          </div>
        </div>
        <div class="leaderboard-score">
          <div class="leaderboard-points">${p.credibility_score}</div>
          <div class="leaderboard-tips">${tierLabel} · ${Math.round(p.verification_rate || 0)}% verified</div>
        </div>
      </div>
    `;
  }).join('');
}

function getTier(score) {
  if (score >= 1000) return '👑 Legend';
  if (score >= 600)  return '💎 Intel Expert';
  if (score >= 300)  return '🔥 Trusted';
  if (score >= 100)  return '⚡ Contributor';
  return '🌱 Newcomer';
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t])
  );
}

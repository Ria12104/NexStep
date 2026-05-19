// =============================================================================
// NexStep — UI: Verify Queue
// Renders pending intel cards and handles approve/flag/skip actions.
// =============================================================================

import { fetchPendingIntel } from '../api/intel.js';
import { submitVerification } from '../api/verifications.js';
import { getCurrentUser, getCurrentCollegeId } from '../auth.js';
import { showToast } from './toast.js';

let _pendingIntel = [];

/**
 * Load and render the verification queue.
 */
export async function renderVerifyQueue() {
  const user      = getCurrentUser();
  const collegeId = getCurrentCollegeId();

  const container = document.querySelector('.verify-queue');
  if (!container) return;

  if (!user || !collegeId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <div class="empty-state-title">Sign In Required</div>
        <div class="empty-state-desc">
          Please sign in and complete your profile to access the Verify Queue.
        </div>
      </div>
    `;
    return;
  }

  // Show shimmer
  container.innerHTML = Array(2).fill(0).map(() => `
    <div class="verify-card" style="pointer-events:none;">
      <div class="shimmer" style="height:18px;width:60%;margin-bottom:12px;border-radius:4px;"></div>
      <div class="shimmer" style="height:60px;width:100%;margin-bottom:12px;border-radius:4px;"></div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <div class="shimmer" style="flex:1;height:38px;border-radius:8px;"></div>
        <div class="shimmer" style="flex:1;height:38px;border-radius:8px;"></div>
        <div class="shimmer" style="flex:1;height:38px;border-radius:8px;"></div>
      </div>
    </div>
  `).join('');

  _pendingIntel = await fetchPendingIntel(collegeId, user.id);

  if (!_pendingIntel.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Queue is Clear!</div>
        <div class="empty-state-desc">
          No intel waiting for verification right now.<br>
          Check back later or submit your own intel.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = _pendingIntel.map(item => buildVerifyCard(item)).join('');

  // Update section subtitle
  const subtitleEl = document.querySelector('#page-verify .section-sub');
  if (subtitleEl) {
    subtitleEl.textContent = `${_pendingIntel.length} tip${_pendingIntel.length !== 1 ? 's' : ''} awaiting peer review`;
  }
}

function buildVerifyCard(item) {
  const urgencyClass = item.urgency || 'medium';
  const urgencyLabel = { urgent: '🚨 URGENT', high: '⚡ HIGH', medium: '📌 MEDIUM' }[urgencyClass];
  const urgencyTag   = { urgent: 'tag-urgent', high: 'tag-high', medium: 'tag-medium' }[urgencyClass];

  const categoryText = {
    academics: '📚 Academics', research: '🧑‍🔬 Research',
    recruiting: '🏢 Recruiting', scholarships: '💰 Scholarships',
    campus: '🎭 Campus', faculty: '👨‍🏫 Faculty', institutional: '🏛️ Institutional',
  }[item.category] || '📌 General';

  const authorDisplay = item.is_anonymous
    ? 'Anonymous'
    : item.author?.full_name || 'Verified Senior';

  const submittedAgo = timeAgo(item.created_at);

  // Compute an AI pre-score (heuristic)
  const score    = computePreScore(item);
  const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const factors  = getScoreFactors(item);

  return `
    <div class="verify-card" data-id="${item.id}" data-author="${item.author?.id || ''}">
      <div class="verify-header">
        <div>
          <div class="intel-meta">
            <span class="tag ${urgencyTag}">${urgencyLabel}</span>
            <span class="tag tag-info">${categoryText}</span>
            <span class="tag tag-info">${(item.branch || 'all').toUpperCase()}</span>
          </div>
          <div class="intel-title" style="margin-top:8px;">${escapeHTML(item.title)}</div>
        </div>
        <div style="text-align:right;font-size:12px;color:var(--text3);">
          ${submittedAgo}<br>
          <span style="color:var(--text2);">by ${escapeHTML(authorDisplay)}</span>
        </div>
      </div>

      <div class="intel-body">${escapeHTML(item.body)}</div>

      <div class="verify-score-bar">
        <div class="score-circle ${scoreClass}">${score}</div>
        <div class="score-breakdown">
          <div class="score-label">Quality Pre-Score Factors</div>
          <div class="score-factors">
            ${factors.map(f => `<span class="score-factor">${f}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="verify-actions">
        <button class="btn-verify btn-approve" onclick="window.NexStep.verifyAction(this, 'approve')">
          ✅ Verify &amp; Approve
        </button>
        <button class="btn-verify btn-flag" onclick="window.NexStep.verifyAction(this, 'flag')">
          🚩 Flag as Inaccurate
        </button>
        <button class="btn-verify btn-skip" onclick="window.NexStep.verifyAction(this, 'skip')">
          → Skip
        </button>
      </div>
    </div>
  `;
}

/** Handle verify action (approve / flag / skip) */
export async function handleVerifyAction(btn, action) {
  const user = getCurrentUser();
  if (!user) { showToast('Please sign in to verify intel.', 'warning'); return; }

  const card     = btn.closest('.verify-card');
  const intelId  = card?.dataset.id;
  const authorId = card?.dataset.author;
  if (!intelId) return;

  // Animate card out
  card.style.transition = 'opacity 0.4s, transform 0.4s';
  card.style.opacity    = '0';
  card.style.transform  = 'translateX(-20px)';

  const { success, error } = await submitVerification(intelId, user.id, action, authorId);

  setTimeout(() => card.remove(), 400);

  if (!success) {
    showToast('Failed to record action. Try again.', 'warning');
    return;
  }

  const msgs = {
    approve: ['✅ Verified & approved! +15 credibility points earned.', 'success'],
    flag:    ['🚩 Flagged for review. Thanks for keeping NexStep accurate.', 'warning'],
    skip:    ['→ Skipped. Next tip ready.', 'success'],
  };
  showToast(...msgs[action]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computePreScore(item) {
  let score = 50;
  if (item.title?.length > 40)          score += 10;
  if (item.body?.length > 100)          score += 15;
  if (item.deadline_at)                 score += 10;
  if (item.source)                      score += 10;
  if (item.tags?.length > 0)            score += 5;
  if (item.author?.credibility_score > 50) score += 10;
  return Math.min(score, 100);
}

function getScoreFactors(item) {
  const factors = [];
  if (item.title?.length > 40)              factors.push('✓ Descriptive title');
  if (item.body?.length > 150)              factors.push('✓ Detailed body');
  if (item.deadline_at)                     factors.push('✓ Has deadline');
  if (item.source)                          factors.push('✓ Source provided');
  else                                      factors.push('⚠ No source');
  if (item.tags?.length > 0)               factors.push('✓ Tagged');
  if (item.author?.credibility_score > 50) factors.push('✓ Trusted author');
  return factors;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h    = Math.round(diff / 3600000);
  if (h < 1)   return 'Just now';
  if (h < 24)  return `${h}h ago`;
  return `${Math.ceil(h / 24)}d ago`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t])
  );
}

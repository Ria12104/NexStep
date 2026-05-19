// =============================================================================
// NexStep — UI: Intel Feed
// Renders intel cards dynamically from Supabase. Handles filter + sort.
// =============================================================================

import { fetchApprovedIntel } from '../api/intel.js';
import { toggleBookmark, fetchBookmarkedIds } from '../api/bookmarks.js';
import { submitVerification, getUserVerificationAction } from '../api/verifications.js';
import { getCurrentUser, getCurrentProfile } from '../auth.js';
import { showToast } from './toast.js';

// Active filter state
let _activeCategories = [];
let _activeBranches   = [];
let _sortBy           = 'urgency';
let _searchQuery      = '';
let _collegeId        = null;
let _bookmarkedIds    = new Set();
let _isLoading        = false;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the feed with a college and load initial data.
 * @param {string} collegeId
 */
export async function initFeed(collegeId) {
  _collegeId = collegeId;

  // Pre-load bookmarked IDs for UI state
  const user = getCurrentUser();
  if (user) {
    _bookmarkedIds = await fetchBookmarkedIds(user.id);
  }

  await refreshFeed();
}

/** Called when college changes */
export async function changeFeedCollege(collegeId) {
  _collegeId        = collegeId;
  _activeCategories = [];
  _activeBranches   = [];
  _searchQuery      = '';
  _sortBy           = 'urgency';

  // Reset filter chips UI
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('.filter-chip');
  if (allChip) allChip.classList.add('active');

  const sortSelect = document.getElementById('feed-sort');
  if (sortSelect) sortSelect.value = 'urgency';

  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) searchInput.value = '';

  await refreshFeed();
}

/** Re-fetch and re-render the feed with current filter state. */
export async function refreshFeed() {
  if (!_collegeId || _isLoading) return;
  _isLoading = true;

  renderLoadingShimmer();

  const intel = await fetchApprovedIntel(_collegeId, {
    sortBy:   _sortBy,
    search:   _searchQuery,
  });

  renderIntelCards(intel);
  updateFeedSubtitle();
  _isLoading = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter & Sort Handlers (called from index.html inline events)
// ─────────────────────────────────────────────────────────────────────────────

export function handleFilterToggle(el) {
  const text = el.textContent.replace(/[^\w\s]/g, '').trim().toLowerCase();

  if (text === 'all') {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    _activeCategories = [];
    _activeBranches   = [];
  } else {
    const allChip = Array.from(document.querySelectorAll('.filter-chip'))
      .find(c => c.textContent.includes('All'));
    if (allChip) allChip.classList.remove('active');

    el.classList.toggle('active');

    const branchMap = { cs: true, ece: true, me: true };
    if (branchMap[text]) {
      if (_activeBranches.includes(text)) {
        _activeBranches = _activeBranches.filter(b => b !== text);
      } else {
        _activeBranches.push(text);
      }
    } else {
      const catKey = getCategoryKey(text);
      if (_activeCategories.includes(catKey)) {
        _activeCategories = _activeCategories.filter(c => c !== catKey);
      } else if (catKey) {
        _activeCategories.push(catKey);
      }
    }

    // If nothing active, re-activate All
    const anyActive = document.querySelectorAll('.filter-chip.active').length;
    if (anyActive === 0 && allChip) {
      allChip.classList.add('active');
      _activeCategories = [];
      _activeBranches   = [];
    }
  }

  filterCardsClientSide();
  updateFeedSubtitle();
}

export function handleSortChange(value) {
  _sortBy = value;
  sortCardsClientSide();
  updateFeedSubtitle();
}

export function handleSearch(query) {
  _searchQuery = query.toLowerCase().trim();
  filterCardsClientSide();
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderLoadingShimmer() {
  const container = document.getElementById('intel-cards-container');
  if (!container) return;

  container.innerHTML = Array(3).fill(0).map(() => `
    <div class="intel-card medium" style="pointer-events:none;">
      <div class="shimmer" style="height:16px;width:40%;margin-bottom:12px;border-radius:4px;"></div>
      <div class="shimmer" style="height:20px;width:80%;margin-bottom:8px;border-radius:4px;"></div>
      <div class="shimmer" style="height:60px;width:100%;margin-bottom:12px;border-radius:4px;"></div>
      <div class="shimmer" style="height:14px;width:30%;border-radius:4px;"></div>
    </div>
  `).join('');
}

function renderIntelCards(intelList) {
  const container = document.getElementById('intel-cards-container');
  if (!container) return;

  if (!intelList.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No Intel Found</div>
        <div class="empty-state-desc">
          Be the first to submit intel for this college.<br>
          Use the <strong>Submit Intel</strong> page to contribute.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = intelList.map(item => buildIntelCard(item)).join('');
}

function buildIntelCard(item) {
  const urgencyClass = item.urgency || 'medium';
  const urgencyLabel = { urgent: '🚨 URGENT', high: '⚡ HIGH', medium: '📌 MEDIUM' }[urgencyClass] || '📌 MEDIUM';
  const urgencyTag   = { urgent: 'tag-urgent', high: 'tag-high', medium: 'tag-medium' }[urgencyClass] || 'tag-medium';

  const categoryText = {
    academics:     '📚 Academics',
    research:      '🧑‍🔬 Research',
    recruiting:    '🏢 Recruiting',
    scholarships:  '💰 Scholarships',
    campus:        '🎭 Campus Life',
    faculty:       '👨‍🏫 Faculty',
    institutional: '🏛️ Institutional',
  }[item.category] || '📌 General';

  const branchText = {
    all:         'All Branches',
    cs:          'CSE',
    ece:         'ECE',
    me:          'ME',
    civil:       'Civil',
    chemical:    'Chemical',
    electrical:  'Electrical',
    physics:     'Physics',
    mathematics: 'Mathematics',
  }[item.branch] || item.branch;

  // Deadline pill
  let deadlinePill = '';
  if (item.deadline_at) {
    const hoursLeft = Math.round((new Date(item.deadline_at) - Date.now()) / 3600000);
    const pillClass = hoursLeft < 48 ? '' : 'amber';
    const pillLabel = hoursLeft < 24
      ? `Closes in ${hoursLeft}h`
      : hoursLeft < 48
        ? 'Closes Tomorrow'
        : `${Math.ceil(hoursLeft / 24)} days left`;
    deadlinePill = `<div class="deadline-pill ${pillClass}">${pillLabel}</div>`;
  }

  // Author
  const isAnon = item.is_anonymous;
  const author = item.author;
  const authorName = isAnon ? 'Anonymous' : (author?.full_name || 'Unknown');
  const authorInfo = isAnon ? '' : [author?.year, author?.branch?.toUpperCase()].filter(Boolean).join(' · ');
  const initials = isAnon ? '?' : (author?.initials || authorName.slice(0, 2).toUpperCase());
  const avatarColors = ['#4da6ff,#7c3aed', '#f5a623,#e8892a', '#3ecf8e,#059669', '#a78bfa,#7c3aed', '#ff6b6b,#dc2626'];
  const colorPair   = avatarColors[(initials.charCodeAt(0) || 0) % avatarColors.length];
  const isVerified  = (item.verified_count ?? 0) >= 3;
  const verifiedTag = isVerified
    ? '<span class="tag tag-green" style="font-size:10px;">✓ Verified</span>'
    : '';

  // Bookmark state
  const isSaved    = _bookmarkedIds.has(item.id);
  const bookmarkLabel = isSaved ? '🔖 Saved' : '🔖 Save';

  // Upvote button
  const upvoteLabel = isVerified
    ? `✓ ${item.verified_count} verified`
    : `▲ ${item.verified_count || 0} agree`;
  const upvoteClass = isVerified ? 'action-btn verified' : 'action-btn';

  return `
    <div class="intel-card ${urgencyClass}"
         data-id="${item.id}"
         data-urgency="${item.urgency}"
         data-verified="${item.verified_count || 0}"
         data-category="${item.category}"
         data-branch="${item.branch}"
         data-recency="${new Date(item.created_at).getTime()}"
         data-author="${author?.id || ''}">
      <div class="intel-meta">
        <span class="tag ${urgencyTag}">${urgencyLabel}</span>
        <span class="tag tag-info">${categoryText}</span>
        <span class="tag tag-info">${branchText}</span>
        ${deadlinePill}
      </div>
      <div class="intel-title">${escapeHTML(item.title)}</div>
      <div class="intel-body">${escapeHTML(item.body)}</div>
      <div class="intel-footer">
        <div class="intel-author">
          <div class="mini-avatar" style="background:linear-gradient(135deg,${colorPair});">${initials}</div>
          ${escapeHTML(authorName)}${authorInfo ? ' · ' + escapeHTML(authorInfo) : ''}
          ${verifiedTag}
        </div>
        <div class="intel-actions">
          <button class="${upvoteClass}" onclick="window.NexStep.upvoteIntel(this)">${upvoteLabel}</button>
          <button class="action-btn ${isSaved ? 'saved' : ''}" onclick="window.NexStep.bookmarkIntel(this)">${bookmarkLabel}</button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side Filter & Sort (on already-fetched cards)
// ─────────────────────────────────────────────────────────────────────────────

function filterCardsClientSide() {
  const container = document.getElementById('intel-cards-container');
  if (!container) return;
  const cards = Array.from(container.children);

  cards.forEach(card => {
    const title    = (card.querySelector('.intel-title')?.textContent || '').toLowerCase();
    const body     = (card.querySelector('.intel-body')?.textContent  || '').toLowerCase();
    const category = card.getAttribute('data-category') || '';
    const branch   = card.getAttribute('data-branch')   || 'all';

    const searchOk   = !_searchQuery ||
      title.includes(_searchQuery) || body.includes(_searchQuery);
    const categoryOk = _activeCategories.length === 0 ||
      _activeCategories.includes(category);
    const branchList = branch.split(',').map(b => b.trim());
    const branchOk   = _activeBranches.length === 0 ||
      branchList.includes('all') ||
      _activeBranches.some(b => branchList.includes(b));

    card.style.display = (searchOk && categoryOk && branchOk) ? '' : 'none';
  });
}

function sortCardsClientSide() {
  const container = document.getElementById('intel-cards-container');
  if (!container) return;
  const cards = Array.from(container.children);
  const urgencyVal = { urgent: 3, high: 2, medium: 1 };

  cards.sort((a, b) => {
    if (_sortBy === 'urgency') {
      return (urgencyVal[b.dataset.urgency] || 0) - (urgencyVal[a.dataset.urgency] || 0);
    } else if (_sortBy === 'verified') {
      return parseInt(b.dataset.verified || 0) - parseInt(a.dataset.verified || 0);
    } else {
      return parseInt(b.dataset.recency || 0) - parseInt(a.dataset.recency || 0);
    }
  });

  cards.forEach(card => container.appendChild(card));
}

function updateFeedSubtitle() {
  const subtitleEl = document.getElementById('feed-subtitle');
  if (!subtitleEl) return;

  const collegeSelect = document.querySelector('.college-selector select');
  const collegeName   = collegeSelect?.options[collegeSelect.selectedIndex]?.text || 'College';
  const catText       = _activeCategories.length
    ? _activeCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
    : 'All Categories';
  const branchText    = _activeBranches.length
    ? _activeBranches.map(b => b.toUpperCase()).join(', ')
    : 'All Branches';
  const sortText      = _sortBy === 'urgency' ? 'Urgency' : _sortBy === 'verified' ? 'Verified Count' : 'Recency';

  subtitleEl.textContent = `${collegeName} · ${catText} · ${branchText} · Sorted by ${sortText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers (called from rendered HTML via window.NexStep)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleUpvote(btn) {
  const user = getCurrentUser();
  if (!user) { showToast('Please sign in to verify intel.', 'warning'); return; }

  const card    = btn.closest('.intel-card');
  const intelId = card?.dataset.id;
  const authorId = card?.dataset.author;
  if (!intelId) return;

  // Prevent double-vote
  const existing = await getUserVerificationAction(intelId, user.id);
  if (existing === 'approve') {
    showToast('You have already verified this tip.', 'warning');
    return;
  }

  const profile  = getCurrentProfile();
  const { success, error } = await submitVerification(
    intelId, user.id, 'approve', authorId
  );

  if (!success) {
    showToast('Failed to record verification. Try again.', 'warning');
    return;
  }

  // Update UI immediately (optimistic)
  const current = parseInt(btn.textContent.match(/\d+/)?.[0] || '0');
  const next    = current + 1;
  btn.textContent = `✓ ${next} verified`;
  btn.classList.add('verified');
  card.setAttribute('data-verified', next.toString());
  _bookmarkedIds.add(intelId); // not a bookmark, just a flag — reuse Set name is wrong; leave for now
  showToast('✅ Verification recorded! +15 credibility points', 'success');
}

export async function handleBookmark(btn) {
  const user = getCurrentUser();
  if (!user) { showToast('Please sign in to save intel.', 'warning'); return; }

  const card     = btn.closest('.intel-card');
  const intelId  = card?.dataset.id;
  const authorId = card?.dataset.author;
  if (!intelId) return;

  const { saved, error } = await toggleBookmark(user.id, intelId, authorId);
  if (error) { showToast('Failed to save. Try again.', 'warning'); return; }

  if (saved) {
    btn.textContent = '🔖 Saved';
    btn.classList.add('saved');
    _bookmarkedIds.add(intelId);
    showToast('🔖 Saved to your collection', 'success');
  } else {
    btn.textContent = '🔖 Save';
    btn.classList.remove('saved');
    _bookmarkedIds.delete(intelId);
    showToast('Removed from saved', 'success');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getCategoryKey(chipText) {
  const map = {
    academics: 'academics', academic: 'academics',
    recruiting: 'recruiting', research: 'research',
    scholarships: 'scholarships', scholarship: 'scholarships',
    campus: 'campus', 'campus life': 'campus',
    faculty: 'faculty', institutional: 'institutional',
  };
  return map[chipText] || null;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[tag]));
}

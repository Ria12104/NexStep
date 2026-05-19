// ── PAGE NAVIGATION ──
function showPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');

  const titles = {
    feed: 'Intel Feed', alerts: 'Smart Alerts', calendar: 'Deadline Calendar',
    submit: 'Submit Intel', verify: 'Verification Queue',
    leaderboard: 'Leaderboard', bizmodel: 'Business Model'
  };
  document.getElementById('topbar-title').textContent = titles[pageId] || 'IntelFirst';

  if (window.innerWidth < 900) closeSidebar();
  window.scrollTo(0, 0);
}

// ── MOBILE SIDEBAR ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

// ── COLLEGE CHANGE ──
function handleCollegeChange(val) {
  const names = {
    'iit-delhi': 'IIT Delhi', 'bits-pilani': 'BITS Pilani',
    'nit-trichy': 'NIT Trichy', 'iit-bombay': 'IIT Bombay',
    'du-north': 'DU North Campus'
  };
  showToast('🏛️ Switched to ' + (names[val] || val), 'success');
  updateFeed();
}

// ── FILTER CHIPS ──
function filterToggle(el) {
  const isAllChip = el.textContent.includes('All');
  if (isAllChip) {
    document.querySelectorAll('.filter-chip').forEach(chip => {
      if (chip === el) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  } else {
    el.classList.toggle('active');
    const allChip = Array.from(document.querySelectorAll('.filter-chip')).find(chip => chip.textContent.includes('All'));
    if (allChip) allChip.classList.remove('active');
    
    const otherActive = Array.from(document.querySelectorAll('.filter-chip.active')).length;
    if (otherActive === 0 && allChip) {
      allChip.classList.add('active');
    }
  }
  updateFeed();
}

// ── UPDATE FEED (FILTER & SORT) ──
function updateFeed() {
  const searchInput = document.querySelector('.search-bar input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const activeBranches = [];
  const activeCategories = [];

  document.querySelectorAll('.filter-chip.active').forEach(chip => {
    const text = chip.textContent.replace(/[^\w\s]/g, '').trim().toLowerCase();
    if (text === 'all') return;
    if (['cs', 'ece', 'me'].includes(text)) {
      activeBranches.push(text);
    } else {
      activeCategories.push(text);
    }
  });

  const container = document.getElementById('intel-cards-container');
  if (!container) return;
  const cards = Array.from(container.children);

  cards.forEach(card => {
    const title = (card.querySelector('.intel-title')?.textContent || '').toLowerCase();
    const body = (card.querySelector('.intel-body')?.textContent || '').toLowerCase();
    const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent.toLowerCase());

    const cardCategory = card.getAttribute('data-category') || '';
    const cardBranch = card.getAttribute('data-branch') || 'all';

    const matchesSearch = !query || title.includes(query) || body.includes(query) || tags.some(t => t.includes(query));

    const categoryMatch = activeCategories.length === 0 || activeCategories.some(cat => {
      return cat.includes(cardCategory) || cardCategory.includes(cat);
    });

    const cardBranchList = cardBranch.split(',').map(b => b.trim());
    const branchMatch = activeBranches.length === 0 || cardBranchList.includes('all') || activeBranches.some(br => cardBranchList.includes(br));

    const visible = matchesSearch && categoryMatch && branchMatch;
    card.style.display = visible ? '' : 'none';
  });

  const sortBy = document.getElementById('feed-sort')?.value || 'urgency';
  cards.sort((a, b) => {
    if (sortBy === 'urgency') {
      const valA = parseInt(a.getAttribute('data-urgency') || '0');
      const valB = parseInt(b.getAttribute('data-urgency') || '0');
      return valB - valA;
    } else if (sortBy === 'verified') {
      const valA = parseInt(a.getAttribute('data-verified') || '0');
      const valB = parseInt(b.getAttribute('data-verified') || '0');
      return valB - valA;
    } else if (sortBy === 'recency') {
      const valA = parseInt(a.getAttribute('data-recency') || '0');
      const valB = parseInt(b.getAttribute('data-recency') || '0');
      return valB - valA;
    }
    return 0;
  });

  cards.forEach(card => container.appendChild(card));

  const subtitleEl = document.getElementById('feed-subtitle');
  if (subtitleEl) {
    const collegeSelect = document.querySelector('.college-selector select');
    const collegeName = collegeSelect ? collegeSelect.value : 'iit-delhi';
    const names = {
      'iit-delhi': 'IIT Delhi', 'bits-pilani': 'BITS Pilani',
      'nit-trichy': 'NIT Trichy', 'iit-bombay': 'IIT Bombay',
      'du-north': 'DU North Campus'
    };
    const collegeText = names[collegeName] || 'IIT Delhi';

    const categoriesText = activeCategories.length > 0
      ? activeCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
      : 'All Categories';
    const branchesText = activeBranches.length > 0
      ? activeBranches.map(b => b.toUpperCase()).join(', ')
      : 'All Branches';
    const sortText = sortBy === 'urgency' ? 'Urgency' : sortBy === 'verified' ? 'Verified Count' : 'Recency';

    subtitleEl.textContent = `${collegeText} · ${categoriesText} · ${branchesText} · Sorted by ${sortText}`;
  }
}

// Helper to escape HTML characters to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ── UPVOTE ──
function upvote(btn) {
  const match = btn.textContent.match(/\d+/);
  if (match) {
    const num = parseInt(match[0]) + 1;
    btn.textContent = btn.classList.contains('verified')
      ? `✓ ${num} verified`
      : `▲ ${num} agree`;
    btn.classList.add('verified');
    showToast('✅ Verification recorded! +15 credibility points', 'success');

    // Update data attribute for sorting
    const card = btn.closest('.intel-card');
    if (card) {
      card.setAttribute('data-verified', num);
    }
  }
}

// ── BOOKMARK ──
function bookmark(btn) {
  btn.textContent = btn.textContent === '🔖 Save' ? '🔖 Saved' : '🔖 Save';
  if (btn.textContent === '🔖 Saved') showToast('🔖 Saved to your collection', 'success');
}

// ── URGENCY SELECT ──
function selectUrgency(el, type) {
  document.querySelectorAll('.urgency-option').forEach(o => o.classList.remove('selected', 'urgent', 'high', 'medium'));
  el.classList.add('selected', type);
}

// ── SUBMIT INTEL ──
function submitIntel() {
  const title = document.getElementById('submit-title').value.trim();
  const desc = document.getElementById('submit-desc').value.trim();
  const category = document.getElementById('submit-category').value || 'academics';
  const branch = document.getElementById('submit-branch').value || 'all';

  if (!title || !desc) {
    showToast('❌ Please fill in the required Title and Description fields.', 'warning');
    return;
  }

  // Get selected urgency
  const selectedUrgencyOption = document.querySelector('.urgency-option.selected');
  let urgencyClass = 'medium';
  let urgencyNum = '1';
  let urgencyLabel = '📌 MEDIUM';

  if (selectedUrgencyOption) {
    if (selectedUrgencyOption.classList.contains('urgent')) {
      urgencyClass = 'urgent';
      urgencyNum = '3';
      urgencyLabel = '🚨 URGENT';
    } else if (selectedUrgencyOption.classList.contains('high')) {
      urgencyClass = 'high';
      urgencyNum = '2';
      urgencyLabel = '⚡ HIGH';
    }
  }

  // Category clean name
  const catNames = {
    academics: '📚 Academics',
    research: '🧑‍🔬 Research',
    recruiting: '🏢 Recruiting',
    scholarships: '💰 Scholarships',
    campus: '🎭 Campus Life',
    faculty: '👨‍🏫 Faculty Preferences',
    institutional: '🏛️ Institutional'
  };
  const categoryText = catNames[category] || '📚 Academics';

  // Branch clean name
  const branchNames = {
    all: 'All Branches',
    cs: 'CSE',
    ece: 'ECE',
    me: 'ME',
    civil: 'Civil',
    chemical: 'Chemical',
    electrical: 'Electrical',
    physics: 'Physics',
    mathematics: 'Mathematics'
  };
  const branchText = branchNames[branch] || 'All Branches';

  // Create card element
  const container = document.getElementById('intel-cards-container');
  if (container) {
    const card = document.createElement('div');
    card.className = `intel-card ${urgencyClass}`;
    card.setAttribute('data-urgency', urgencyNum);
    card.setAttribute('data-verified', '1');
    card.setAttribute('data-category', category);
    card.setAttribute('data-branch', branch);
    card.setAttribute('data-recency', '6'); // higher than existing cards so it shows first on Newest sort!

    card.innerHTML = `
      <div class="intel-meta">
        <span class="tag tag-${urgencyClass}">${urgencyLabel}</span>
        <span class="tag tag-info">${categoryText}</span>
        <span class="tag tag-info">${branchText}</span>
        <div class="deadline-pill">New</div>
      </div>
      <div class="intel-title">${escapeHTML(title)}</div>
      <div class="intel-body">${escapeHTML(desc)}</div>
      <div class="intel-footer">
        <div class="intel-author">
          <div class="mini-avatar" style="background: linear-gradient(135deg, #10b981, #059669);">AS</div>
          Arjun Sharma · CSE Dept
        </div>
        <div class="intel-actions">
          <button class="action-btn" onclick="upvote(this)">▲ 1 agree</button>
          <button class="action-btn" onclick="bookmark(this)">🔖 Save</button>
        </div>
      </div>
    `;

    // Prepend to top
    container.insertBefore(card, container.firstChild);
  }

  // Clear inputs
  document.getElementById('submit-title').value = '';
  document.getElementById('submit-desc').value = '';
  document.getElementById('submit-category').value = '';
  document.getElementById('submit-branch').value = 'all';
  document.getElementById('submit-deadline').value = '';
  document.getElementById('submit-source').value = '';
  document.getElementById('submit-tags').value = '';

  showToast('🚀 Submitted for peer verification! Card added to feed.', 'success');

  // Refresh feed filtering & sorting
  updateFeed();

  // Redirect to feed page
  setTimeout(() => {
    const feedNavItem = Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('Feed'));
    showPage('feed', feedNavItem);
  }, 1200);
}

// ── VERIFY ACTIONS ──
function verifyAction(btn, action) {
  const card = btn.closest('.verify-card');
  const msgs = {
    approve: ['✅ Verification recorded! +15 pts earned', 'success'],
    flag: ['🚩 Flagged for review. Thanks for keeping intel clean.', 'warning'],
    skip: ['→ Skipped. Next tip loaded.', 'success']
  };
  showToast(msgs[action][0], msgs[action][1]);
  card.style.transition = 'opacity 0.4s, transform 0.4s';
  card.style.opacity = '0';
  card.style.transform = 'translateX(-20px)';
  setTimeout(() => card.remove(), 400);
}

// ── TOAST ──
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── INIT: Proactive deadline nudge ──
setTimeout(() => {
  showToast('🚨 Tata Scholar Fellowship closes in 38 hours — check Intel Feed!', 'warning');
}, 1800);

setTimeout(() => {
  showToast('🔔 3 new tips added for your branch today', 'success');
}, 4000);

// Initialize feed filtering/sorting
updateFeed();

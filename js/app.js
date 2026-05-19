// =============================================================================
// NexStep — App Orchestrator (js/app.js)
// Entry point: wires auth → sidebar → pages → data.
// Exposes window.NexStep for inline HTML event handlers.
// =============================================================================

import { initAuth, signIn, signUp, signOut, completeProfile,
         showAuthModal, getCurrentUser, getCurrentCollegeId } from './auth.js';
import { initSidebar, getSelectedSlug, setSelectedSlug, refreshNavBadges } from './ui/sidebar.js';
import { initFeed, changeFeedCollege, refreshFeed,
         handleFilterToggle, handleSortChange, handleSearch,
         handleUpvote, handleBookmark } from './ui/feed.js';
import { renderStats } from './ui/stats.js';
import { renderAlerts, handleMarkAllRead } from './ui/alerts.js';
import { renderCalendar, calPrevMonth, calNextMonth } from './ui/calendar.js';
import { handleSubmitIntel, handleUrgencySelect, initSubmitForm } from './ui/submit.js';
import { renderVerifyQueue, handleVerifyAction } from './ui/verify.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { fetchCollegeBySlug } from './api/colleges.js';
import { fetchUpcomingDeadlines } from './api/intel.js';
import { generateDeadlineAlerts } from './api/notifications.js';
import { showToast } from './ui/toast.js';

// ─────────────────────────────────────────────────────────────────────────────
// Page Navigation
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  feed:        'Intel Feed',
  alerts:      'Smart Alerts',
  calendar:    'Deadline Calendar',
  submit:      'Submit Intel',
  verify:      'Verification Queue',
  leaderboard: 'Leaderboard',
  bizmodel:    'Business Model',
};

function showPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');

  const title = document.getElementById('topbar-title');
  if (title) title.textContent = PAGE_TITLES[pageId] || 'NexStep';

  // Lazy-load page data when switching to it
  switch (pageId) {
    case 'alerts':      renderAlerts();      break;
    case 'calendar':    renderCalendar();    break;
    case 'verify':      renderVerifyQueue(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'submit':      initSubmitForm();    break;
  }

  if (window.innerWidth < 900) closeSidebar();
  window.scrollTo(0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

async function handleCollegeChange(slug) {
  setSelectedSlug(slug);
  const college = await fetchCollegeBySlug(slug);
  if (!college) return;

  showToast(`🏛️ Switched to ${college.name}`, 'success');
  await loadPageData(college.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Modal Handlers
// ─────────────────────────────────────────────────────────────────────────────
let _authMode = 'login'; // 'login' | 'signup'

function switchAuthMode(mode) {
  _authMode = mode;
  const loginPanel  = document.getElementById('auth-login-panel');
  const signupPanel = document.getElementById('auth-signup-panel');
  if (loginPanel)  loginPanel.style.display  = mode === 'login'  ? '' : 'none';
  if (signupPanel) signupPanel.style.display = mode === 'signup' ? '' : 'none';
}

async function handleLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('login-btn');

  if (!email || !password) { showToast('Please enter email and password.', 'warning'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  const { error } = await signIn(email, password);
  if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }

  if (error) {
    showToast('❌ ' + (error.message || 'Sign in failed.'), 'warning');
  }
}

async function handleSignup() {
  const name     = document.getElementById('signup-name')?.value.trim();
  const email    = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value;
  const btn      = document.getElementById('signup-btn');

  if (!name || !email || !password) {
    showToast('Please fill in all fields.', 'warning'); return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning'); return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

  const { error } = await signUp(email, password, name);
  if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }

  if (error) {
    showToast('❌ ' + (error.message || 'Signup failed.'), 'warning');
  } else {
    showToast('✅ Check your email to confirm your account!', 'success');
  }
}

async function handleProfileComplete() {
  const fullName  = document.getElementById('setup-name')?.value.trim();
  const branch    = document.getElementById('setup-branch')?.value;
  const year      = document.getElementById('setup-year')?.value;
  const collegeId = document.getElementById('setup-college')?.value;
  const btn       = document.getElementById('setup-complete-btn');

  if (!fullName || !branch || !year || !collegeId) {
    showToast('Please fill in all fields.', 'warning'); return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await completeProfile({ fullName, branch, year, collegeId });
  if (btn) { btn.disabled = false; btn.textContent = 'Complete Setup'; }

  if (error) {
    showToast('❌ ' + (error.message || 'Profile setup failed.'), 'warning');
  } else {
    showToast('🎉 Profile complete! Welcome to NexStep.', 'success');
    // Reload data with new college
    const user = getCurrentUser();
    const cid  = getCurrentCollegeId();
    if (cid) await loadPageData(cid);
  }
}

async function handleLogout() {
  await signOut();
  showToast('Signed out. See you next time!', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Loading
// ─────────────────────────────────────────────────────────────────────────────
async function loadPageData(collegeId) {
  const user = getCurrentUser();

  // Parallel: feed + stats + nav badges
  await Promise.all([
    initFeed(collegeId),
    renderStats(collegeId),
    refreshNavBadges(collegeId, user?.id),
  ]);

  // Generate deadline alerts for logged-in user
  if (user) {
    const deadlines = await fetchUpcomingDeadlines(collegeId, 14);
    await generateDeadlineAlerts(user.id, deadlines);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
async function boot() {
  // Check config
  if (window.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
    showToast('⚠️ Supabase not configured — see config.js', 'warning');
  }

  // Init sidebar (loads colleges)
  const slug = await initSidebar();

  // Init auth (checks session, shows modal if not logged in)
  await initAuth(async (user, profile) => {
    // Called whenever auth state changes
    const cid = profile?.college?.id;
    if (cid) {
      await loadPageData(cid);
    }
  });

  // Initial data load (use college from sidebar)
  const college = await fetchCollegeBySlug(getSelectedSlug());
  if (college) {
    await loadPageData(college.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expose to window (for inline HTML handlers)
// ─────────────────────────────────────────────────────────────────────────────
window.NexStep = {
  // Navigation
  showPage,
  toggleSidebar,
  closeSidebar,
  handleCollegeChange,

  // Auth
  switchAuthMode,
  handleLogin,
  handleSignup,
  handleProfileComplete,
  handleLogout,

  // Feed
  filterToggle:     handleFilterToggle,
  updateFeedSort:   handleSortChange,
  updateFeedSearch: handleSearch,
  upvoteIntel:      handleUpvote,
  bookmarkIntel:    handleBookmark,

  // Submit
  selectUrgency:  handleUrgencySelect,
  submitIntel:    handleSubmitIntel,

  // Verify
  verifyAction: handleVerifyAction,

  // Alerts
  markAllRead: handleMarkAllRead,

  // Calendar
  calPrev: calPrevMonth,
  calNext: calNextMonth,
};

// Start
boot();

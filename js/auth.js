// =============================================================================
// NexStep — Auth Module
// Handles login, signup, logout, and session management.
// Manages the auth modal UI and populates the sidebar user card on login.
// =============================================================================

import { supabase } from './supabase.js';
import { getProfile, updateProfile } from './api/profiles.js';
import { fetchColleges } from './api/colleges.js';

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let _currentUser    = null;
let _currentProfile = null;
let _colleges       = [];

/** @returns {Object|null} Supabase auth user */
export function getCurrentUser()    { return _currentUser; }
/** @returns {Object|null} NexStep profile row */
export function getCurrentProfile() { return _currentProfile; }
/** @returns {string|null} College UUID */
export function getCurrentCollegeId() {
  return _currentProfile?.college?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization — call once on app start
// ─────────────────────────────────────────────────────────────────────────────
export async function initAuth(onAuthChange) {
  // Load colleges for the profile setup form
  _colleges = await fetchColleges();

  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await _handleSignIn(session.user);
  }

  // Listen for future auth events
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await _handleSignIn(session.user);
      onAuthChange?.(_currentUser, _currentProfile);
    } else if (event === 'SIGNED_OUT') {
      _currentUser    = null;
      _currentProfile = null;
      updateSidebarUserCard(null);
      showAuthModal();
      onAuthChange?.(null, null);
    }
  });

  // Show modal if not logged in
  if (!_currentUser) showAuthModal();

  return { user: _currentUser, profile: _currentProfile };
}

async function _handleSignIn(user) {
  _currentUser = user;
  _currentProfile = await getProfile(user.id);

  // If profile is incomplete (no name set), show profile setup
  if (!_currentProfile?.full_name) {
    showProfileSetupModal(_colleges);
  } else {
    hideAuthModal();
    updateSidebarUserCard(_currentProfile);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Sign up with email + password */
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  return { data, error };
}

/** Sign in with email + password */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/** Sign out */
export async function signOut() {
  await supabase.auth.signOut();
}

/** Complete profile after signup */
export async function completeProfile({ fullName, branch, year, collegeId }) {
  if (!_currentUser) return;

  const initials = fullName
    .split(' ')
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '??';

  const { error } = await updateProfile(_currentUser.id, {
    full_name:  fullName,
    initials,
    branch,
    year,
    college_id: collegeId,
  });

  if (!error) {
    _currentProfile = await getProfile(_currentUser.id);
    hideProfileSetupModal();
    hideAuthModal();
    updateSidebarUserCard(_currentProfile);
  }
  return { error };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function showAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('visible');
}

export function hideAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('visible');
}

export function showProfileSetupModal(colleges) {
  const modal = document.getElementById('profile-setup-modal');
  if (!modal) return;

  // Populate college selector
  const select = modal.querySelector('#setup-college');
  if (select && colleges.length) {
    select.innerHTML = '<option value="">Select your college...</option>' +
      colleges.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  modal.classList.add('visible');
}

export function hideProfileSetupModal() {
  const modal = document.getElementById('profile-setup-modal');
  if (modal) modal.classList.remove('visible');
}

/** Updates the sidebar bottom user card with live profile data */
export function updateSidebarUserCard(profile) {
  const nameEl    = document.getElementById('user-display-name');
  const roleEl    = document.getElementById('user-display-role');
  const avatarEl  = document.getElementById('user-avatar-initials');
  const logoutBtn = document.getElementById('sidebar-logout-btn');

  if (!profile) {
    if (nameEl)    nameEl.textContent    = 'Sign in';
    if (roleEl)    roleEl.textContent    = '';
    if (avatarEl)  avatarEl.textContent  = '?';
    return;
  }

  if (nameEl)    nameEl.textContent    = profile.full_name || 'User';
  if (roleEl)    roleEl.textContent    = [profile.year, profile.college?.name]
                                           .filter(Boolean).join(' · ');
  if (avatarEl)  avatarEl.textContent  = profile.initials || '?';
  if (logoutBtn) logoutBtn.style.display = 'block';
}

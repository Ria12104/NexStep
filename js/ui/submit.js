// =============================================================================
// NexStep — UI: Submit Intel Form
// Handles form validation and Supabase insert for new intel submissions.
// =============================================================================

import { submitIntel as apiSubmitIntel } from '../api/intel.js';
import { incrementTipsSubmitted } from '../api/profiles.js';
import { getCurrentUser, getCurrentProfile, getCurrentCollegeId } from '../auth.js';
import { showToast } from './toast.js';

let _selectedUrgency = 'urgent'; // default

/** Initialize urgency selector default */
export function initSubmitForm() {
  _selectedUrgency = 'urgent';
  // Reset the form
  clearSubmitForm();
}

/** Called when urgency option is clicked */
export function handleUrgencySelect(el, urgencyType) {
  document.querySelectorAll('.urgency-option').forEach(o =>
    o.classList.remove('selected', 'urgent', 'high', 'medium')
  );
  el.classList.add('selected', urgencyType);
  _selectedUrgency = urgencyType;
}

/** Main submit handler — validates, calls API, shows feedback */
export async function handleSubmitIntel() {
  const user      = getCurrentUser();
  const profile   = getCurrentProfile();
  const collegeId = getCurrentCollegeId();

  if (!user || !collegeId) {
    showToast('Please sign in and complete your profile first.', 'warning');
    return;
  }

  // Role gate: only contributors can submit
  if (profile?.role === 'fresher') {
    showToast('Only Contributors (3rd year+) can submit intel.', 'warning');
    return;
  }

  // Gather form values
  const title    = document.getElementById('submit-title')?.value.trim()    || '';
  const desc     = document.getElementById('submit-desc')?.value.trim()     || '';
  const category = document.getElementById('submit-category')?.value        || '';
  const branch   = document.getElementById('submit-branch')?.value          || 'all';
  const deadline = document.getElementById('submit-deadline')?.value        || '';
  const source   = document.getElementById('submit-source')?.value.trim()   || '';
  const rawTags  = document.getElementById('submit-tags')?.value.trim()     || '';

  // Validation
  const errors = [];
  if (!title)    errors.push('Title is required.');
  if (!desc)     errors.push('Description is required.');
  if (!category) errors.push('Please select a category.');
  if (title.length < 10)  errors.push('Title must be at least 10 characters.');
  if (desc.length < 30)   errors.push('Description must be at least 30 characters.');

  if (errors.length) {
    showToast('❌ ' + errors[0], 'warning');
    return;
  }

  // Disable submit button during request
  const submitBtn = document.getElementById('submit-intel-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
  }

  // Parse tags
  const tags = rawTags
    ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const { data, error } = await apiSubmitIntel({
    title,
    body:        desc,
    category,
    branch,
    urgency:     _selectedUrgency,
    collegeId,
    authorId:    user.id,
    deadlineAt:  deadline || null,
    source:      source  || null,
    tags,
    isAnonymous: false,
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Submit for Verification';
  }

  if (error) {
    showToast('❌ Failed to submit. Please try again.', 'warning');
    console.error('[submit] error:', error);
    return;
  }

  // Update profile tip count
  await incrementTipsSubmitted(user.id);

  clearSubmitForm();
  showToast('🚀 Submitted! It enters the peer verification queue.', 'success');

  // Redirect to feed after short delay
  setTimeout(() => {
    const feedNavItem = Array.from(document.querySelectorAll('.nav-item'))
      .find(el => el.textContent.includes('Feed'));
    window.NexStep?.showPage('feed', feedNavItem);
  }, 1400);
}

function clearSubmitForm() {
  const ids = ['submit-title','submit-desc','submit-deadline','submit-source','submit-tags'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const catSel = document.getElementById('submit-category');
  if (catSel) catSel.value = '';
  const branchSel = document.getElementById('submit-branch');
  if (branchSel) branchSel.value = 'all';

  // Reset urgency selector
  document.querySelectorAll('.urgency-option').forEach(o =>
    o.classList.remove('selected', 'urgent', 'high', 'medium')
  );
  const firstOption = document.querySelector('.urgency-option.urgent');
  if (firstOption) firstOption.classList.add('selected', 'urgent');
  _selectedUrgency = 'urgent';
}

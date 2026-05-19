// =============================================================================
// NexStep — API: Profiles
// User profile CRUD and credibility score management.
// =============================================================================

import { supabase } from '../supabase.js';

/**
 * Fetch a user profile by UUID.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, full_name, initials, branch, year, role,
      credibility_score, tips_submitted, tips_verified,
      verification_rate, upvote_ratio, timeliness_score,
      college:colleges (id, name, slug)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[profiles] getProfile error:', error.message);
    return null;
  }
  return data;
}

/**
 * Update profile fields (name, branch, year, college_id).
 * Called after signup to complete the profile.
 *
 * @param {string} userId
 * @param {Object} updates  - { full_name, initials, branch, year, college_id }
 * @returns {Promise<{error: Object|null}>}
 */
export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) console.error('[profiles] updateProfile error:', error.message);
  return { error };
}

/**
 * Increment tips_submitted counter and recalculate verification_rate.
 * Called after a user submits intel.
 *
 * @param {string} userId
 */
export async function incrementTipsSubmitted(userId) {
  const { error } = await supabase.rpc('increment_tips_submitted', {
    p_user_id: userId,
  });
  // If the RPC doesn't exist yet, fall back to a manual update
  if (error) {
    const profile = await getProfile(userId);
    if (!profile) return;
    await supabase
      .from('profiles')
      .update({ tips_submitted: (profile.tips_submitted ?? 0) + 1 })
      .eq('id', userId);
  }
}

/**
 * Award credibility points to a user.
 * Points system:
 *   +40 tip verified by 3+ peers (status → approved)
 *   +20 each additional approval
 *   +10 tip bookmarked by others
 *   +15 verifying others' tips (per approve action)
 *   −30 tip flagged as inaccurate
 *
 * @param {string} userId
 * @param {number} delta  - positive or negative point change
 */
export async function awardCredibilityPoints(userId, delta) {
  const profile = await getProfile(userId);
  if (!profile) return;

  const newScore = Math.max(0, (profile.credibility_score ?? 0) + delta);

  const { error } = await supabase
    .from('profiles')
    .update({ credibility_score: newScore })
    .eq('id', userId);

  if (error) console.error('[profiles] awardCredibilityPoints error:', error.message);
}

/**
 * Fetch leaderboard — profiles ranked by credibility_score for a college.
 *
 * @param {string} collegeId
 * @param {number} limit   - how many users to return (default: 20)
 * @returns {Promise<Array>}
 */
export async function fetchLeaderboard(collegeId, limit = 20) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, full_name, initials, year, branch,
      credibility_score, tips_submitted, verification_rate
    `)
    .eq('college_id', collegeId)
    .order('credibility_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[profiles] fetchLeaderboard error:', error.message);
    return [];
  }
  return data ?? [];
}

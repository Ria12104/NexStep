// =============================================================================
// NexStep — API: Verifications
// Handles peer verification actions: approve / flag / skip.
// =============================================================================

import { supabase } from '../supabase.js';
import { awardCredibilityPoints } from './profiles.js';
import { approveIntel, flagIntel } from './intel.js';

// Guard: skip DB calls if userId is not a valid UUID (demo mode fallback)
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}


// Credibility point rewards per action
const POINTS = {
  verify_action:   +15,  // earned by verifier for each approve/flag action
  tip_approved:    +40,  // earned by author when tip reaches approved status
  tip_flagged:     -30,  // earned (lost) by author when tip is flagged
};

// Number of approvals required before a tip auto-approves
const AUTO_APPROVE_THRESHOLD = 3;

/**
 * Submit a verification action (approve / flag / skip) for an intel post.
 * - Inserts into verifications table (unique per user per intel)
 * - Triggers auto-approve if enough approvals
 * - Awards credibility points to verifier and author
 *
 * @param {string} intelId        - UUID of the intel being verified
 * @param {string} verifierId     - UUID of the current user
 * @param {string} action         - 'approve' | 'flag' | 'skip'
 * @param {string} authorId       - UUID of intel author (for point awards)
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function submitVerification(intelId, verifierId, action, authorId) {
  // Skip doesn't write to DB — it's purely a UI action
  if (action === 'skip') {
    return { success: true, error: null };
  }
  // Gracefully skip if verifier isn't a real DB user (demo mode)
  if (!isValidUUID(verifierId)) {
    return { success: true, error: null };
  }

  // Upsert verification record (update action if user changes their mind)
  const { error: upsertError } = await supabase
    .from('verifications')
    .upsert(
      { intel_id: intelId, verifier_id: verifierId, action },
      { onConflict: 'intel_id,verifier_id' }
    );

  if (upsertError) {
    console.error('[verifications] submitVerification error:', upsertError.message);
    return { success: false, error: upsertError.message };
  }

  // Award points to verifier for taking action
  await awardCredibilityPoints(verifierId, POINTS.verify_action);

  // Check if we've hit the auto-approve threshold
  if (action === 'approve') {
    const { count } = await supabase
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .eq('intel_id', intelId)
      .eq('action', 'approve');

    if ((count ?? 0) >= AUTO_APPROVE_THRESHOLD) {
      await approveIntel(intelId);
      // Award author for getting approved
      await awardCredibilityPoints(authorId, POINTS.tip_approved);
    }
  }

  // If flagged, mark intel as flagged and deduct author points
  if (action === 'flag') {
    await flagIntel(intelId);
    await awardCredibilityPoints(authorId, POINTS.tip_flagged);
  }

  return { success: true, error: null };
}

/**
 * Check whether the current user has already verified a specific intel post.
 *
 * @param {string} intelId
 * @param {string} userId
 * @returns {Promise<string|null>}  Returns the action ('approve'/'flag') or null
 */
export async function getUserVerificationAction(intelId, userId) {
  if (!isValidUUID(userId)) return null;

  const { data, error } = await supabase
    .from('verifications')
    .select('action')
    .eq('intel_id', intelId)
    .eq('verifier_id', userId)
    .single();

  if (error) return null;
  return data?.action ?? null;
}

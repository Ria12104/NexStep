// =============================================================================
// NexStep — API: Bookmarks
// Handles toggling bookmarks and fetching user's bookmarked intel IDs.
// =============================================================================

import { supabase } from '../supabase.js';

// Guard: skip Supabase if userId is not a valid UUID (e.g. old demo fallback)
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Fetch the set of intel IDs the user has bookmarked.
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
export async function fetchBookmarkedIds(userId) {
  if (!isValidUUID(userId)) return new Set();

  const { data, error } = await supabase
    .from('bookmarks')
    .select('intel_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[bookmarks] fetchBookmarkedIds error:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map(row => row.intel_id));
}

/**
 * Toggle a bookmark for the given user + intel.
 * If already bookmarked → delete. Otherwise → insert.
 *
 * @param {string} userId
 * @param {string} intelId
 * @returns {Promise<{saved: boolean, error: Object|null}>}
 */
export async function toggleBookmark(userId, intelId) {
  if (!isValidUUID(userId)) return { saved: false, error: null };

  // Check if bookmark already exists
  const { data: existing, error: checkError } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('intel_id', intelId)
    .maybeSingle();

  if (checkError) {
    console.error('[bookmarks] toggleBookmark check error:', checkError.message);
    return { saved: false, error: checkError };
  }

  if (existing) {
    // Remove bookmark
    const { error: delError } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', existing.id);

    if (delError) {
      console.error('[bookmarks] toggleBookmark delete error:', delError.message);
      return { saved: false, error: delError };
    }
    return { saved: false, error: null };
  } else {
    // Create bookmark
    const { error: insertError } = await supabase
      .from('bookmarks')
      .insert({ user_id: userId, intel_id: intelId });

    if (insertError) {
      console.error('[bookmarks] toggleBookmark insert error:', insertError.message);
      return { saved: false, error: insertError };
    }
    return { saved: true, error: null };
  }
}

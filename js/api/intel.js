// =============================================================================
// NexStep — API: Intel
// All CRUD operations for intel posts.
// =============================================================================

import { supabase } from '../supabase.js';

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch approved intel for a college, with optional filters.
 *
 * @param {string}   collegeId  - UUID of the college
 * @param {Object}   opts
 * @param {string}   opts.category   - filter by category ('all' = no filter)
 * @param {string}   opts.branch     - filter by branch ('all' = no filter)
 * @param {string}   opts.sortBy     - 'urgency' | 'verified' | 'recency'
 * @param {string}   opts.search     - free-text search term
 * @returns {Promise<Array>}
 */
export async function fetchApprovedIntel(collegeId, opts = {}) {
  const { category, branch, sortBy = 'urgency', search } = opts;

  let query = supabase
    .from('intel')
    .select(`
      id, title, body, category, branch, urgency,
      deadline_at, tags, status, verified_count, bookmark_count,
      is_anonymous, created_at,
      author:profiles!intel_author_id_fkey (
        id, full_name, initials, year, branch
      )
    `)
    .eq('college_id', collegeId)
    .eq('status', 'approved');

  // Category filter
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  // Branch filter: match exact branch OR 'all'
  if (branch && branch !== 'all') {
    query = query.or(`branch.eq.${branch},branch.eq.all`);
  }

  // Full-text search (searches title and body)
  if (search && search.trim()) {
    const q = search.trim();
    query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  }

  // Sorting
  if (sortBy === 'urgency') {
    // urgent=3, high=2, medium=1 — we sort by a case expression server-side
    // Supabase doesn't support CASE in order(), so we sort client-side for urgency
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'verified') {
    query = query.order('verified_count', { ascending: false });
  } else {
    // recency
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('[intel] fetchApprovedIntel error:', error.message);
    return [];
  }

  let results = data ?? [];

  // Client-side urgency sort (urgent > high > medium)
  if (sortBy === 'urgency') {
    const urgencyOrder = { urgent: 3, high: 2, medium: 1 };
    results = results.sort((a, b) =>
      (urgencyOrder[b.urgency] ?? 0) - (urgencyOrder[a.urgency] ?? 0)
    );
  }

  return results;
}

/**
 * Fetch pending intel for the Verify Queue (authenticated users only).
 * Excludes intel submitted by the current user (can't self-verify).
 *
 * @param {string} collegeId  - UUID of the college
 * @param {string} userId     - UUID of current user
 * @returns {Promise<Array>}
 */
export async function fetchPendingIntel(collegeId, userId) {
  const { data, error } = await supabase
    .from('intel')
    .select(`
      id, title, body, category, branch, urgency,
      deadline_at, tags, created_at, is_anonymous,
      author:profiles!intel_author_id_fkey (
        id, full_name, initials, year, branch, credibility_score
      )
    `)
    .eq('college_id', collegeId)
    .eq('status', 'pending')
    .neq('author_id', userId)  // can't verify your own
    .order('created_at', { ascending: true }); // oldest first (FIFO queue)

  if (error) {
    console.error('[intel] fetchPendingIntel error:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch intel entries that have upcoming deadlines (for calendar + alerts).
 *
 * @param {string} collegeId
 * @param {number} daysAhead  - how many days ahead to look (default: 30)
 * @returns {Promise<Array>}
 */
export async function fetchUpcomingDeadlines(collegeId, daysAhead = 30) {
  const now   = new Date().toISOString();
  const until = new Date(Date.now() + daysAhead * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from('intel')
    .select('id, title, category, urgency, deadline_at, branch')
    .eq('college_id', collegeId)
    .eq('status', 'approved')
    .gte('deadline_at', now)
    .lte('deadline_at', until)
    .order('deadline_at', { ascending: true });

  if (error) {
    console.error('[intel] fetchUpcomingDeadlines error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch aggregate stats for the feed dashboard.
 *
 * @param {string} collegeId
 * @returns {Promise<Object>} { totalApproved, verifiedPercent, seniorContributors, freshersHelped }
 */
export async function fetchFeedStats(collegeId) {
  // Total approved intel count
  const { count: totalApproved } = await supabase
    .from('intel')
    .select('id', { count: 'exact', head: true })
    .eq('college_id', collegeId)
    .eq('status', 'approved');

  // Total pending (for verify badge)
  const { count: totalPending } = await supabase
    .from('intel')
    .select('id', { count: 'exact', head: true })
    .eq('college_id', collegeId)
    .eq('status', 'pending');

  // Contributors at college
  const { count: seniorContributors } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('college_id', collegeId)
    .gt('tips_submitted', 0);

  return {
    totalApproved:       totalApproved  ?? 0,
    totalPending:        totalPending   ?? 0,
    seniorContributors:  seniorContributors ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a new intel post (status defaults to 'pending').
 *
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} payload.category
 * @param {string} payload.branch
 * @param {string} payload.urgency
 * @param {string} payload.collegeId
 * @param {string} payload.authorId
 * @param {string} [payload.deadlineAt]   - ISO date string or null
 * @param {string} [payload.source]
 * @param {string[]} [payload.tags]
 * @param {boolean} [payload.isAnonymous]
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function submitIntel(payload) {
  const {
    title, body, category, branch, urgency,
    collegeId, authorId,
    deadlineAt = null,
    source = null,
    tags = [],
    isAnonymous = false,
  } = payload;

  const { data, error } = await supabase
    .from('intel')
    .insert({
      title,
      body,
      category,
      branch,
      urgency,
      college_id:   collegeId,
      author_id:    authorId,
      deadline_at:  deadlineAt || null,
      source:       source || null,
      tags,
      is_anonymous: isAnonymous,
    })
    .select()
    .single();

  if (error) {
    console.error('[intel] submitIntel error:', error.message);
  }
  return { data, error };
}

/**
 * Approve a pending intel post (used by admins / auto-approve after N verifications).
 * Only updates status — actual counting is done by triggers.
 *
 * @param {string} intelId
 * @returns {Promise<{error: Object|null}>}
 */
export async function approveIntel(intelId) {
  const { error } = await supabase
    .from('intel')
    .update({ status: 'approved' })
    .eq('id', intelId);

  if (error) console.error('[intel] approveIntel error:', error.message);
  return { error };
}

/**
 * Flag an intel post as inaccurate.
 *
 * @param {string} intelId
 * @returns {Promise<{error: Object|null}>}
 */
export async function flagIntel(intelId) {
  const { error } = await supabase
    .from('intel')
    .update({ status: 'flagged' })
    .eq('id', intelId);

  if (error) console.error('[intel] flagIntel error:', error.message);
  return { error };
}

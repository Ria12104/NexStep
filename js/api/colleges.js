// =============================================================================
// NexStep — API: Colleges
// Fetches the list of supported colleges from Supabase.
// =============================================================================

import { supabase } from '../supabase.js';

/**
 * Fetch all colleges ordered alphabetically.
 * @returns {Promise<Array>} Array of { id, name, slug, city }
 */
export async function fetchColleges() {
  const { data, error } = await supabase
    .from('colleges')
    .select('id, name, slug, city')
    .order('name', { ascending: true });

  if (error) {
    console.error('[colleges] fetchColleges error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch a single college by its slug (e.g. "iit-delhi").
 * @param {string} slug
 * @returns {Promise<Object|null>}
 */
export async function fetchCollegeBySlug(slug) {
  const { data, error } = await supabase
    .from('colleges')
    .select('id, name, slug, city')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('[colleges] fetchCollegeBySlug error:', error.message);
    return null;
  }
  return data;
}

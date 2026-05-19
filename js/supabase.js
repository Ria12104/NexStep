// =============================================================================
// NexStep — Supabase Client Singleton
// Initializes the Supabase JS client using keys from config.js.
// Import this module wherever you need DB access.
// =============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// SUPABASE_URL and SUPABASE_ANON_KEY are loaded via config.js (non-module script)
// They are set as globals on window before this module loads.
const supabaseUrl  = window.SUPABASE_URL;
const supabaseKey  = window.SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL_HERE') {
  console.error(
    '[NexStep] ⚠️  Supabase not configured.\n' +
    'Open config.js and paste your SUPABASE_URL and SUPABASE_ANON_KEY.\n' +
    'See SETUP.md for instructions.'
  );
}

// Single shared client instance
export const supabase = createClient(supabaseUrl, supabaseKey);

-- =============================================================================
-- NexStep — Row Level Security (RLS) Policies
-- Run AFTER schema.sql in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE public.colleges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- COLLEGES — public read, no write (managed by admin via Supabase dashboard)
-- =============================================================================
CREATE POLICY "colleges_read_all"
  ON public.colleges FOR SELECT
  USING (true);  -- anyone (even unauthenticated) can read college list


-- =============================================================================
-- PROFILES
-- =============================================================================

-- Anyone can read profiles (for leaderboard, author names)
CREATE POLICY "profiles_read_all"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- System (trigger) handles INSERT — allow service role only
-- (profile is created automatically via trigger on auth.users insert)


-- =============================================================================
-- INTEL
-- =============================================================================

-- Anyone can read approved intel
CREATE POLICY "intel_read_approved"
  ON public.intel FOR SELECT
  USING (status = 'approved');

-- Authenticated users can read pending intel only in Verify Queue
-- (they need to see what's pending to verify it)
CREATE POLICY "intel_read_pending_auth"
  ON public.intel FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND status = 'pending'
  );

-- Authenticated users can insert intel (their own)
CREATE POLICY "intel_insert_own"
  ON public.intel FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Authors can update their own intel (e.g., to edit before approval)
CREATE POLICY "intel_update_own"
  ON public.intel FOR UPDATE
  USING (auth.uid() = author_id AND status = 'pending');

-- Authors can delete their own pending intel
CREATE POLICY "intel_delete_own"
  ON public.intel FOR DELETE
  USING (auth.uid() = author_id AND status = 'pending');


-- =============================================================================
-- VERIFICATIONS
-- =============================================================================

-- Authenticated users can read verifications (for audit trail)
CREATE POLICY "verifications_read_auth"
  ON public.verifications FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert a verification
-- Constraint: cannot verify your own intel
CREATE POLICY "verifications_insert_others"
  ON public.verifications FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = verifier_id
    AND NOT EXISTS (
      SELECT 1 FROM public.intel
      WHERE id = intel_id AND author_id = auth.uid()
    )
  );

-- Users can delete their own verification (to undo)
CREATE POLICY "verifications_delete_own"
  ON public.verifications FOR DELETE
  USING (auth.uid() = verifier_id);


-- =============================================================================
-- BOOKMARKS
-- =============================================================================

-- Users can read their own bookmarks only
CREATE POLICY "bookmarks_read_own"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create bookmarks for themselves
CREATE POLICY "bookmarks_insert_own"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "bookmarks_delete_own"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

-- Users can only read their own notifications
CREATE POLICY "notifications_read_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (used by Supabase functions) can insert notifications
-- For now, allow authenticated users to insert their own as well
CREATE POLICY "notifications_insert_own"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

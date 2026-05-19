-- =============================================================================
-- NexStep — Full Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: colleges
-- Stores all supported colleges. Seeded manually or via seed.sql.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.colleges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,                         -- e.g. "IIT Delhi"
  slug       TEXT NOT NULL UNIQUE,                  -- e.g. "iit-delhi"
  city       TEXT,                                  -- e.g. "New Delhi"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast slug lookups (used in college selector)
CREATE INDEX IF NOT EXISTS idx_colleges_slug ON public.colleges (slug);


-- =============================================================================
-- TABLE: profiles
-- One row per authenticated user. Created on first sign-in via trigger.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT NOT NULL DEFAULT '',
  initials           TEXT NOT NULL DEFAULT '?',     -- 2-char avatar text
  college_id         UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  branch             TEXT DEFAULT 'all',            -- cs, ece, me, civil, etc.
  year               TEXT DEFAULT '',               -- "Final Year", "3rd Year", etc.
  credibility_score  INT NOT NULL DEFAULT 0,
  tips_submitted     INT NOT NULL DEFAULT 0,
  tips_verified      INT NOT NULL DEFAULT 0,        -- how many others' tips verified
  verification_rate  NUMERIC(5,2) DEFAULT 0,        -- % of submitted tips approved
  upvote_ratio       NUMERIC(5,2) DEFAULT 0,
  timeliness_score   NUMERIC(5,2) DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to speed up leaderboard queries (rank by score)
CREATE INDEX IF NOT EXISTS idx_profiles_credibility ON public.profiles (credibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_college     ON public.profiles (college_id);


-- =============================================================================
-- TABLE: intel
-- Core intel posts submitted by users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.intel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'academics',
                  -- academics | research | recruiting | scholarships | campus | faculty | institutional
  branch          TEXT NOT NULL DEFAULT 'all',
                  -- cs | ece | me | civil | chemical | electrical | physics | mathematics | all
  urgency         TEXT NOT NULL DEFAULT 'medium',
                  -- urgent | high | medium
  deadline_at     TIMESTAMPTZ,                      -- NULL means evergreen tip
  source          TEXT,                             -- "Personally experienced", URL, etc.
  tags            TEXT[] DEFAULT '{}',              -- searchable tags array
  college_id      UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
                  -- pending | approved | flagged
  verified_count  INT NOT NULL DEFAULT 0,           -- cached count of approve verifications
  bookmark_count  INT NOT NULL DEFAULT 0,           -- cached count of bookmarks
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,   -- hides author name in feed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_intel_college_status  ON public.intel (college_id, status);
CREATE INDEX IF NOT EXISTS idx_intel_urgency         ON public.intel (urgency);
CREATE INDEX IF NOT EXISTS idx_intel_category        ON public.intel (category);
CREATE INDEX IF NOT EXISTS idx_intel_branch          ON public.intel (branch);
CREATE INDEX IF NOT EXISTS idx_intel_deadline        ON public.intel (deadline_at) WHERE deadline_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intel_author          ON public.intel (author_id);
CREATE INDEX IF NOT EXISTS idx_intel_created         ON public.intel (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_tags            ON public.intel USING GIN (tags);


-- =============================================================================
-- TABLE: verifications
-- Tracks approve / flag / skip votes per user per intel post.
-- Unique constraint prevents double-voting.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intel_id     UUID NOT NULL REFERENCES public.intel(id) ON DELETE CASCADE,
  verifier_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,                       -- approve | flag | skip
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One vote per user per intel
  CONSTRAINT unique_verification UNIQUE (intel_id, verifier_id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_intel    ON public.verifications (intel_id);
CREATE INDEX IF NOT EXISTS idx_verifications_verifier ON public.verifications (verifier_id);


-- =============================================================================
-- TABLE: bookmarks
-- Tracks which intel each user has saved.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intel_id   UUID NOT NULL REFERENCES public.intel(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_bookmark UNIQUE (user_id, intel_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user  ON public.bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_intel ON public.bookmarks (intel_id);


-- =============================================================================
-- TABLE: notifications
-- Smart alerts for users — generated from intel deadlines, verifications, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
             -- deadline_alert | tip_verified | tip_flagged | weekly_digest | new_intel
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  intel_id   UUID REFERENCES public.intel(id) ON DELETE SET NULL,  -- linked intel if any
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at DESC);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on intel table
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER intel_updated_at
  BEFORE UPDATE ON public.intel
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(UPPER(LEFT(NEW.raw_user_meta_data->>'full_name', 1)), '?')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update intel.verified_count when a verification is inserted/deleted
CREATE OR REPLACE FUNCTION sync_verified_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.action = 'approve' THEN
    UPDATE public.intel
    SET verified_count = verified_count + 1
    WHERE id = NEW.intel_id;
  ELSIF TG_OP = 'DELETE' AND OLD.action = 'approve' THEN
    UPDATE public.intel
    SET verified_count = GREATEST(verified_count - 1, 0)
    WHERE id = OLD.intel_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_intel_verified_count
  AFTER INSERT OR DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION sync_verified_count();

-- Update intel.bookmark_count when bookmarks change
CREATE OR REPLACE FUNCTION sync_bookmark_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.intel SET bookmark_count = bookmark_count + 1 WHERE id = NEW.intel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.intel SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.intel_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_intel_bookmark_count
  AFTER INSERT OR DELETE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION sync_bookmark_count();

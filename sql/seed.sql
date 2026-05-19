-- =============================================================================
-- NexStep — Seed Data
-- Run AFTER schema.sql and rls_policies.sql
-- Populates colleges so the college selector works immediately.
-- =============================================================================

INSERT INTO public.colleges (name, slug, city) VALUES
  ('IIT Delhi',          'iit-delhi',   'New Delhi'),
  ('IIT Bombay',         'iit-bombay',  'Mumbai'),
  ('IIT Madras',         'iit-madras',  'Chennai'),
  ('IIT Kanpur',         'iit-kanpur',  'Kanpur'),
  ('IIT Kharagpur',      'iit-kgp',     'Kharagpur'),
  ('BITS Pilani',        'bits-pilani', 'Pilani'),
  ('BITS Goa',           'bits-goa',    'Goa'),
  ('NIT Trichy',         'nit-trichy',  'Trichy'),
  ('NIT Warangal',       'nit-warangal','Warangal'),
  ('Delhi University North Campus', 'du-north', 'New Delhi'),
  ('IIT Hyderabad',      'iit-hyd',     'Hyderabad'),
  ('IIT Roorkee',        'iit-roorkee', 'Roorkee')
ON CONFLICT (slug) DO NOTHING;

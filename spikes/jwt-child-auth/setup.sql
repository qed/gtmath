-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the minimal schema needed for the JWT spike.

-- Minimal children table
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if re-running
DROP POLICY IF EXISTS "child_read_own" ON children;

-- Child can read own row via custom JWT claim
-- The JWT payload includes { child_id: "uuid" }
-- PostgREST exposes JWT claims via current_setting('request.jwt.claims')
CREATE POLICY "child_read_own"
  ON children FOR SELECT
  USING (
    id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Insert two test children
INSERT INTO children (id, name, pin_hash) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Spike Child A', '$2b$10$placeholder'),
  ('22222222-2222-2222-2222-222222222222', 'Spike Child B', '$2b$10$placeholder')
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT id, name FROM children;

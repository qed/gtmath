import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Run this ONCE to set up the test tables and RLS policies in your Supabase project.
// Uses the service_role key (full access) to create schema.
// After running, switch to test-jwt.ts which uses the child JWT.

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Add SUPABASE_SERVICE_ROLE_KEY to .env (Settings > API > service_role key)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SQL = `
-- Minimal children table for the spike
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Child can read own row (JWT claim: child_id)
CREATE POLICY IF NOT EXISTS "child_read_own"
  ON children FOR SELECT
  USING (id = ((current_setting('request.jwt.claims', true)::json)->>'child_id')::uuid);

-- Insert two test children
INSERT INTO children (id, name, pin_hash) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Spike Child A', '$2b$10$placeholder'),
  ('22222222-2222-2222-2222-222222222222', 'Spike Child B', '$2b$10$placeholder')
ON CONFLICT (id) DO NOTHING;
`;

async function setup() {
  console.log("Running setup SQL...");
  const { error } = await supabase.rpc("exec_sql", { sql: SQL });
  if (error) {
    // exec_sql may not exist; try via the SQL editor instead
    console.error("Could not run SQL via RPC. Run this SQL manually in the Supabase SQL Editor:");
    console.log("\n" + SQL);
    process.exit(1);
  }
  console.log("Setup complete.");
}

setup();

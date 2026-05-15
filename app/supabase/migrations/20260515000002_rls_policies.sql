-- GTMath Phase 1: Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE hb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- ── Children ──────────────────────────────────────────────────

-- Parent can read their linked children
CREATE POLICY "parent_read_children" ON children FOR SELECT
  USING (
    id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- Child JWT can read own row
CREATE POLICY "child_read_own" ON children FOR SELECT
  USING (
    id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Parent can update their children (name, tutorial_seen)
CREATE POLICY "parent_update_children" ON children FOR UPDATE
  USING (
    id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- Parent can delete their children
CREATE POLICY "parent_delete_children" ON children FOR DELETE
  USING (
    id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- ── Parent-Children junction ──────────────────────────────────

-- Parents can see their own links
CREATE POLICY "parent_read_own_links" ON parent_children FOR SELECT
  USING (parent_id = auth.uid());

-- Primary parent can invite partners
CREATE POLICY "primary_parent_invite" ON parent_children FOR INSERT
  WITH CHECK (
    -- Inserter must be a primary parent of this child
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = auth.uid()
        AND pc.child_id = child_id
        AND pc.role = 'primary'
    )
    -- Max 2 partners per child (primary + 2 partners = 3 total)
    AND (
      SELECT count(*) FROM parent_children pc
      WHERE pc.child_id = child_id
    ) < 3
  );

-- Primary parent can remove partners
CREATE POLICY "primary_parent_revoke" ON parent_children FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = auth.uid()
        AND pc.child_id = child_id
        AND pc.role = 'primary'
    )
  );

-- ── Solves ────────────────────────────────────────────────────

-- Child can insert own solves (via record_solve function, but direct insert too)
CREATE POLICY "child_insert_solves" ON solves FOR INSERT
  WITH CHECK (
    child_id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Child can read own solves
CREATE POLICY "child_read_own_solves" ON solves FOR SELECT
  USING (
    child_id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Parent can read their children's solves
CREATE POLICY "parent_read_child_solves" ON solves FOR SELECT
  USING (
    child_id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- ── HB Transactions ──────────────────────────────────────────

-- Child can read own transactions
CREATE POLICY "child_read_own_hb" ON hb_transactions FOR SELECT
  USING (
    child_id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Parent can read their children's transactions
CREATE POLICY "parent_read_child_hb" ON hb_transactions FOR SELECT
  USING (
    child_id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- ── Daily Activity ───────────────────────────────────────────

-- Child can read own activity
CREATE POLICY "child_read_own_activity" ON daily_activity FOR SELECT
  USING (
    child_id = (
      (current_setting('request.jwt.claims', true)::json)->>'child_id'
    )::uuid
  );

-- Parent can read their children's activity
CREATE POLICY "parent_read_child_activity" ON daily_activity FOR SELECT
  USING (
    child_id IN (
      SELECT child_id FROM parent_children
      WHERE parent_id = auth.uid()
    )
  );

-- ── Config ───────────────────────────────────────────────────

-- All authenticated users can read config
CREATE POLICY "authenticated_read_config" ON config FOR SELECT
  USING (true);

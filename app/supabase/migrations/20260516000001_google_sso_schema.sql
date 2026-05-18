-- Google SSO schema: extend children for SSO, add audit log, add create_child_sso()

-- ── Extend children table ───────────────────────────────────────────
ALTER TABLE children
  ALTER COLUMN pin_hash DROP NOT NULL;

ALTER TABLE children
  ADD COLUMN supabase_uid UUID UNIQUE REFERENCES auth.users(id),
  ADD COLUMN email TEXT,
  ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'pin'
    CHECK (auth_method IN ('pin', 'google')),
  ADD COLUMN deactivated_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_children_supabase_uid ON children(supabase_uid)
  WHERE supabase_uid IS NOT NULL;

-- ── Admin audit log ─────────────────────────────────────────────────
CREATE TABLE admin_audit_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_email     TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('reset_hb', 'deactivate', 'reactivate')),
  target_child_id UUID NOT NULL REFERENCES children(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_log_target ON admin_audit_log(target_child_id);

-- ── Extend hb_transactions type check ───────────────────────────────
ALTER TABLE hb_transactions
  DROP CONSTRAINT hb_transactions_type_check;

ALTER TABLE hb_transactions
  ADD CONSTRAINT hb_transactions_type_check
  CHECK (type IN ('EARN', 'COMPOUND', 'SPEED_BONUS', 'STREAK_BONUS', 'ADMIN_RESET'));

-- ── SSO child creation function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION create_child_sso(
  p_supabase_uid UUID,
  p_name         TEXT,
  p_email        TEXT
) RETURNS UUID AS $$
DECLARE
  v_child_id UUID;
BEGIN
  INSERT INTO children (name, supabase_uid, email, auth_method)
  VALUES (p_name, p_supabase_uid, p_email, 'google')
  RETURNING id INTO v_child_id;

  RETURN v_child_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

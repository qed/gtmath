-- GTMath Phase 1: Initial schema
-- Children, parent-child relationships, solves, Home Bucks, daily activity, config

-- Children: custom JWT auth, no Supabase Auth identity (COPPA)
CREATE TABLE children (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  pin_hash      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tutorial_seen BOOLEAN NOT NULL DEFAULT false
);

-- Multi-parent support via junction table
CREATE TABLE parent_children (
  parent_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'partner')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);
CREATE INDEX idx_parent_children_child ON parent_children(child_id);

-- Orphan cleanup: delete child when last parent removed
CREATE OR REPLACE FUNCTION cleanup_orphan_children()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parent_children WHERE child_id = OLD.child_id) THEN
    DELETE FROM children WHERE id = OLD.child_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cleanup_orphan_children
  AFTER DELETE ON parent_children
  FOR EACH ROW EXECUTE FUNCTION cleanup_orphan_children();

-- Atomic child creation: inserts children + parent_children in one transaction
CREATE OR REPLACE FUNCTION create_child(
  p_parent_id UUID,
  p_name      TEXT,
  p_pin_hash  TEXT
) RETURNS UUID AS $$
DECLARE
  v_child_id UUID;
BEGIN
  INSERT INTO children (name, pin_hash)
  VALUES (p_name, p_pin_hash)
  RETURNING id INTO v_child_id;

  INSERT INTO parent_children (parent_id, child_id, role)
  VALUES (p_parent_id, v_child_id, 'primary');

  RETURN v_child_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solves: one row per verified solve
CREATE TABLE solves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mode        SMALLINT NOT NULL CHECK (mode BETWEEN 2 AND 9),
  target      INT NOT NULL,
  combo       TEXT NOT NULL,
  time_ms     INT NOT NULL CHECK (time_ms BETWEEN 200 AND 600000),
  expression  TEXT NOT NULL,
  hb_earned   NUMERIC(12,2) NOT NULL DEFAULT 0,
  offline     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solves_child ON solves(child_id, created_at);
CREATE INDEX idx_solves_child_mode ON solves(child_id, mode);
CREATE INDEX idx_solves_combo ON solves(combo);

-- Home Bucks transactions: append-only ledger
CREATE TABLE hb_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('EARN', 'COMPOUND', 'SPEED_BONUS', 'STREAK_BONUS')),
  amount        NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  reference_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hb_txns_child ON hb_transactions(child_id, created_at);

-- Streak tracking per child per day
CREATE TABLE daily_activity (
  child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  active_date DATE NOT NULL,
  solve_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, active_date)
);

-- Config: tunable parameters
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Seed config
INSERT INTO config (key, value) VALUES
  ('compounding_rate', '0.001'),
  ('median_time_ms', '{"2": 5000, "3": 8000, "4": 15000, "5": 25000}'),
  ('speed_bonus_threshold', '20'),
  ('speed_bonus_amount', '50'),
  ('hb_milestones', '[{"threshold": 100, "label": "Bronze"}, {"threshold": 500, "label": "Silver"}, {"threshold": 2000, "label": "Gold"}]');

-- record_solve: atomic solve recording with HB calculation
CREATE OR REPLACE FUNCTION record_solve(
  p_child_id   UUID,
  p_mode       SMALLINT,
  p_target     INT,
  p_combo      TEXT,
  p_time_ms    INT,
  p_expression TEXT,
  p_offline    BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_solve_id    UUID;
  v_base_hb     NUMERIC(12,2);
  v_streak_days INT;
  v_streak_mult NUMERIC(5,2);
  v_total_hb    NUMERIC(12,2);
  v_old_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
BEGIN
  -- Advisory lock per child to prevent concurrent writes
  PERFORM pg_advisory_xact_lock(('x' || left(p_child_id::text, 8))::bit(32)::int);

  -- Base HB: mode * 5
  v_base_hb := p_mode * 5;

  -- Calculate streak (consecutive days up to today)
  SELECT count(*)
  INTO v_streak_days
  FROM (
    SELECT active_date
    FROM daily_activity
    WHERE child_id = p_child_id
      AND active_date <= CURRENT_DATE
    ORDER BY active_date DESC
  ) sub
  WHERE active_date >= CURRENT_DATE - (
    SELECT count(*) FROM generate_series(
      (SELECT min(active_date) FROM daily_activity WHERE child_id = p_child_id AND active_date <= CURRENT_DATE AND active_date >= CURRENT_DATE - 30),
      CURRENT_DATE,
      '1 day'::interval
    )
  )::int + 1;

  -- Simpler streak: count consecutive days backwards from yesterday
  SELECT count(*) INTO v_streak_days
  FROM (
    SELECT active_date, active_date - (ROW_NUMBER() OVER (ORDER BY active_date DESC))::int AS grp
    FROM daily_activity
    WHERE child_id = p_child_id AND active_date <= CURRENT_DATE
    ORDER BY active_date DESC
  ) sub
  WHERE grp = (
    SELECT active_date - 1::int
    FROM daily_activity
    WHERE child_id = p_child_id AND active_date = CURRENT_DATE
    LIMIT 1
  );

  -- Fallback: just count recent consecutive days
  v_streak_days := COALESCE(v_streak_days, 0);

  -- Streak bonus: +10% per day, cap at +50%
  IF NOT p_offline THEN
    v_streak_mult := LEAST(1.0 + (v_streak_days * 0.10), 1.50);
  ELSE
    v_streak_mult := 1.0; -- no streak bonus for offline solves
  END IF;

  v_total_hb := ROUND(v_base_hb * v_streak_mult, 2);

  -- Get current balance
  SELECT COALESCE(
    (SELECT balance_after FROM hb_transactions
     WHERE child_id = p_child_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO v_old_balance;

  v_new_balance := v_old_balance + v_total_hb;

  -- Insert solve
  INSERT INTO solves (child_id, mode, target, combo, time_ms, expression, hb_earned, offline)
  VALUES (p_child_id, p_mode, p_target, p_combo, p_time_ms, p_expression, v_total_hb, p_offline)
  RETURNING id INTO v_solve_id;

  -- Insert HB transaction
  INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
  VALUES (p_child_id, 'EARN', v_total_hb, v_new_balance, v_solve_id);

  -- Upsert daily activity
  INSERT INTO daily_activity (child_id, active_date, solve_count)
  VALUES (p_child_id, CURRENT_DATE, 1)
  ON CONFLICT (child_id, active_date)
  DO UPDATE SET solve_count = daily_activity.solve_count + 1;

  RETURN jsonb_build_object(
    'solve_id', v_solve_id,
    'hb_earned', v_total_hb,
    'new_balance', v_new_balance,
    'streak_days', v_streak_days + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily compounding function (called by pg_cron at midnight UTC)
CREATE OR REPLACE FUNCTION compound_daily() RETURNS void AS $$
DECLARE
  v_rate NUMERIC(10,6);
  rec RECORD;
BEGIN
  SELECT (value::text)::numeric INTO v_rate FROM config WHERE key = 'compounding_rate';
  v_rate := COALESCE(v_rate, 0.001);

  FOR rec IN
    SELECT DISTINCT ON (child_id) child_id, balance_after
    FROM hb_transactions
    ORDER BY child_id, created_at DESC
  LOOP
    IF rec.balance_after > 0 THEN
      INSERT INTO hb_transactions (child_id, type, amount, balance_after)
      VALUES (
        rec.child_id,
        'COMPOUND',
        ROUND(rec.balance_after * v_rate, 2),
        ROUND(rec.balance_after * (1 + v_rate), 2)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add speed bonus logic to record_solve
-- If the child's solve time is below (median_time_ms * speed_bonus_threshold/100),
-- they earn an extra speed_bonus_amount HB.

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
  v_solve_id        UUID;
  v_base_hb         NUMERIC(12,2);
  v_streak_days     INT;
  v_streak_mult     NUMERIC(5,2);
  v_total_hb        NUMERIC(12,2);
  v_speed_bonus     NUMERIC(12,2) := 0;
  v_old_balance     NUMERIC(12,2);
  v_new_balance     NUMERIC(12,2);
  v_median_ms       INT;
  v_threshold_pct   INT;
  v_bonus_amount    NUMERIC(12,2);
BEGIN
  PERFORM pg_advisory_xact_lock(('x' || left(p_child_id::text, 8))::bit(32)::int);

  -- Base HB: mode * 5
  v_base_hb := p_mode * 5;

  -- Calculate streak (consecutive days backwards from today)
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
  v_streak_days := COALESCE(v_streak_days, 0);

  -- Streak bonus: +10% per day, cap at +50%
  IF NOT p_offline THEN
    v_streak_mult := LEAST(1.0 + (v_streak_days * 0.10), 1.50);
  ELSE
    v_streak_mult := 1.0;
  END IF;

  v_total_hb := ROUND(v_base_hb * v_streak_mult, 2);

  -- Speed bonus: check if solve time is below threshold
  IF NOT p_offline THEN
    SELECT (value->>p_mode::text)::int INTO v_median_ms
    FROM config WHERE key = 'median_time_ms';

    SELECT (value::text)::int INTO v_threshold_pct
    FROM config WHERE key = 'speed_bonus_threshold';

    SELECT (value::text)::numeric INTO v_bonus_amount
    FROM config WHERE key = 'speed_bonus_amount';

    IF v_median_ms IS NOT NULL AND v_threshold_pct IS NOT NULL AND v_bonus_amount IS NOT NULL THEN
      IF p_time_ms < (v_median_ms * v_threshold_pct / 100) THEN
        v_speed_bonus := v_bonus_amount;
      END IF;
    END IF;
  END IF;

  -- Get current balance
  SELECT COALESCE(
    (SELECT balance_after FROM hb_transactions
     WHERE child_id = p_child_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO v_old_balance;

  v_new_balance := v_old_balance + v_total_hb + v_speed_bonus;

  -- Insert solve
  INSERT INTO solves (child_id, mode, target, combo, time_ms, expression, hb_earned, offline)
  VALUES (p_child_id, p_mode, p_target, p_combo, p_time_ms, p_expression, v_total_hb + v_speed_bonus, p_offline)
  RETURNING id INTO v_solve_id;

  -- Insert earn transaction
  INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
  VALUES (p_child_id, 'EARN', v_total_hb, v_old_balance + v_total_hb, v_solve_id);

  -- Insert speed bonus transaction (separate for auditability)
  IF v_speed_bonus > 0 THEN
    INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
    VALUES (p_child_id, 'SPEED_BONUS', v_speed_bonus, v_new_balance, v_solve_id);
  END IF;

  -- Upsert daily activity
  INSERT INTO daily_activity (child_id, active_date, solve_count)
  VALUES (p_child_id, CURRENT_DATE, 1)
  ON CONFLICT (child_id, active_date)
  DO UPDATE SET solve_count = daily_activity.solve_count + 1;

  RETURN jsonb_build_object(
    'solve_id', v_solve_id,
    'hb_earned', v_total_hb + v_speed_bonus,
    'new_balance', v_new_balance,
    'streak_days', v_streak_days + 1,
    'speed_bonus', v_speed_bonus
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

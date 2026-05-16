-- HB scaling: base = mode * 0.5, PB bonus = seconds_improved * base (decimal)

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
  v_speed_bonus     NUMERIC(12,2) := 0;
  v_old_avg_ms      NUMERIC;
  v_new_avg_ms      NUMERIC;
  v_improvement_s   NUMERIC;
  v_old_balance     NUMERIC(12,2);
  v_new_balance     NUMERIC(12,2);
  v_total_hb        NUMERIC(12,2);
BEGIN
  PERFORM pg_advisory_xact_lock(('x' || left(p_child_id::text, 8))::bit(32)::int);

  -- Base HB: mode * 0.5
  v_base_hb := ROUND(p_mode * 0.5, 2);
  v_total_hb := v_base_hb;

  -- Calculate streak for display (not used for HB)
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

  -- Calculate old avg top-10 fastest BEFORE inserting new solve
  IF NOT p_offline THEN
    SELECT avg(time_ms) INTO v_old_avg_ms
    FROM (
      SELECT time_ms FROM solves
      WHERE child_id = p_child_id AND mode = p_mode
      ORDER BY time_ms ASC
      LIMIT 10
    ) top10
    HAVING count(*) >= 10;
  END IF;

  -- Get current balance
  SELECT COALESCE(
    (SELECT balance_after FROM hb_transactions
     WHERE child_id = p_child_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO v_old_balance;

  -- Insert solve (hb_earned updated after PB check)
  INSERT INTO solves (child_id, mode, target, combo, time_ms, expression, hb_earned, offline)
  VALUES (p_child_id, p_mode, p_target, p_combo, p_time_ms, p_expression, 0, p_offline)
  RETURNING id INTO v_solve_id;

  -- Calculate new avg top-10 fastest AFTER inserting
  IF NOT p_offline AND v_old_avg_ms IS NOT NULL THEN
    SELECT avg(time_ms) INTO v_new_avg_ms
    FROM (
      SELECT time_ms FROM solves
      WHERE child_id = p_child_id AND mode = p_mode
      ORDER BY time_ms ASC
      LIMIT 10
    ) top10
    HAVING count(*) >= 10;

    IF v_new_avg_ms IS NOT NULL AND v_new_avg_ms < v_old_avg_ms THEN
      v_improvement_s := (v_old_avg_ms - v_new_avg_ms) / 1000.0;
      v_speed_bonus := ROUND(v_improvement_s * v_base_hb, 2);
      IF v_speed_bonus < v_base_hb THEN
        v_speed_bonus := v_base_hb;
      END IF;
    END IF;
  END IF;

  v_total_hb := v_base_hb + v_speed_bonus;
  v_new_balance := v_old_balance + v_total_hb;

  -- Update solve with final hb_earned
  UPDATE solves SET hb_earned = v_total_hb WHERE id = v_solve_id;

  -- Insert earn transaction
  INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
  VALUES (p_child_id, 'EARN', v_base_hb, v_old_balance + v_base_hb, v_solve_id);

  -- Insert PB bonus transaction
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
    'hb_earned', v_total_hb,
    'new_balance', v_new_balance,
    'streak_days', v_streak_days + 1,
    'speed_bonus', v_speed_bonus
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

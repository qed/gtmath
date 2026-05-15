-- Leaderboard: most solves per mode
CREATE OR REPLACE FUNCTION leaderboard_solves(
  p_mode SMALLINT,
  p_period TEXT DEFAULT 'all'
) RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  solve_count BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.child_id,
    c.name AS child_name,
    count(*) AS solve_count,
    ROW_NUMBER() OVER (ORDER BY count(*) DESC, min(s.time_ms) ASC) AS rank
  FROM solves s
  JOIN children c ON c.id = s.child_id
  WHERE s.mode = p_mode
    AND (
      p_period = 'all'
      OR (p_period = 'today' AND s.created_at >= CURRENT_DATE)
      OR (p_period = 'week' AND s.created_at >= CURRENT_DATE - INTERVAL '7 days')
    )
  GROUP BY s.child_id, c.name
  ORDER BY solve_count DESC, min(s.time_ms) ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Leaderboard: fastest solve per mode
CREATE OR REPLACE FUNCTION leaderboard_fastest(
  p_mode SMALLINT,
  p_period TEXT DEFAULT 'all'
) RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  best_time_ms INT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.child_id,
    c.name AS child_name,
    min(s.time_ms)::INT AS best_time_ms,
    ROW_NUMBER() OVER (ORDER BY min(s.time_ms) ASC) AS rank
  FROM solves s
  JOIN children c ON c.id = s.child_id
  WHERE s.mode = p_mode
    AND (
      p_period = 'all'
      OR (p_period = 'today' AND s.created_at >= CURRENT_DATE)
      OR (p_period = 'week' AND s.created_at >= CURRENT_DATE - INTERVAL '7 days')
    )
  GROUP BY s.child_id, c.name
  ORDER BY min(s.time_ms) ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fastest leaderboard: average of top 10 fastest solves, minimum 10 solves to qualify
DROP FUNCTION IF EXISTS leaderboard_fastest(SMALLINT, TEXT);
CREATE OR REPLACE FUNCTION leaderboard_fastest(
  p_mode SMALLINT,
  p_period TEXT DEFAULT 'all'
) RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  avg_time_ms INT,
  solve_count BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT s.child_id, s.time_ms
    FROM solves s
    WHERE s.mode = p_mode
      AND (
        p_period = 'all'
        OR (p_period = 'today' AND s.created_at >= CURRENT_DATE)
        OR (p_period = 'week' AND s.created_at >= CURRENT_DATE - INTERVAL '7 days')
      )
  ),
  counted AS (
    SELECT f.child_id, count(*) AS cnt
    FROM filtered f
    GROUP BY f.child_id
    HAVING count(*) >= 10
  ),
  top10 AS (
    SELECT f.child_id, f.time_ms,
           ROW_NUMBER() OVER (PARTITION BY f.child_id ORDER BY f.time_ms ASC) AS rn
    FROM filtered f
    JOIN counted ct ON ct.child_id = f.child_id
  )
  SELECT
    t.child_id,
    c.name AS child_name,
    avg(t.time_ms)::INT AS avg_time_ms,
    (SELECT cnt FROM counted ct2 WHERE ct2.child_id = t.child_id) AS solve_count,
    ROW_NUMBER() OVER (ORDER BY avg(t.time_ms) ASC) AS rank
  FROM top10 t
  JOIN children c ON c.id = t.child_id
  WHERE t.rn <= 10
  GROUP BY t.child_id, c.name
  ORDER BY avg(t.time_ms) ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

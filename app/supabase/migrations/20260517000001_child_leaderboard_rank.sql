-- Lightweight single-child leaderboard rank lookup
-- Returns one row: rank, avg_time_ms, total_ranked, solve_count
-- rank and avg_time_ms are NULL when the child has < 10 solves (unqualified)
DROP FUNCTION IF EXISTS child_leaderboard_rank(UUID, SMALLINT, TEXT);
CREATE OR REPLACE FUNCTION child_leaderboard_rank(
  p_child_id UUID,
  p_mode     SMALLINT,
  p_period   TEXT DEFAULT 'all'
) RETURNS TABLE (
  rank         BIGINT,
  avg_time_ms  INT,
  total_ranked BIGINT,
  solve_count  BIGINT
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
  ),
  ranked AS (
    SELECT
      t.child_id,
      avg(t.time_ms)::INT AS avg_time_ms,
      ROW_NUMBER() OVER (ORDER BY avg(t.time_ms) ASC) AS rank
    FROM top10 t
    WHERE t.rn <= 10
    GROUP BY t.child_id
  ),
  child_solve_count AS (
    SELECT count(*) AS cnt
    FROM filtered f
    WHERE f.child_id = p_child_id
  ),
  total AS (
    SELECT count(*) AS cnt FROM ranked
  )
  SELECT
    r.rank,
    r.avg_time_ms,
    tot.cnt  AS total_ranked,
    sc.cnt   AS solve_count
  FROM child_solve_count sc
  CROSS JOIN total tot
  LEFT JOIN ranked r ON r.child_id = p_child_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

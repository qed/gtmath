---
title: "HB Economy Rework: Effort-Based Earning with PB Improvement Bonus"
date: 2026-05-15
category: best-practices
module: economy
problem_type: best_practice
component: database
severity: high
applies_when:
  - Modifying HB earning rates or adding new reward types
  - Rebalancing the economy or adjusting compounding rates
  - Adding new game modes that need HB scaling
  - Displaying HB values anywhere in the UI
tags:
  - hb-economy
  - effort-based-earning
  - personal-best
  - record-solve
  - decimal-currency
  - supabase-rpc
---

# HB Economy Rework: Effort-Based Earning with PB Improvement Bonus

## Context

The GTMath HB (Home Bucks) economy needed a complete rework after Phase 1. The original design had three problems:

1. **Base HB too generous** (mode x 5): with 0.1% daily compounding, passive income outpaced active earning within weeks.
2. **Flat speed bonus** (+50 HB for solving under 20% of median time): a binary cliff where players either got the full bonus or nothing, rewarding only the fastest players.
3. **Streak multiplier** (+10%/day, capped at +50%): rewarded showing up consistently rather than improving, and inflated earnings for passive behavioral patterns.

GTMath is a deposit conversion tool for Alpha School -- every HB eventually converts to real value. The economy must incentivize sustained effort and continuous improvement, not passive accumulation (auto memory [claude]).

## Guidance

The reworked economy follows five principles, implemented across migrations 007 and 008.

### 1. Low base earnings with granular scaling

Base HB = `mode * 0.5`. Low enough that passive compounding never outpaces active play.

```sql
-- Before: too generous
v_base_hb := p_mode * 5;  -- Quick=10, Classic=20, Wild=45

-- After: controlled, allows decimals
v_base_hb := ROUND(p_mode * 0.5, 2);  -- Quick=1, Speed=1.5, Classic=2, Wild=4.5
```

| Mode | Cards | Base HB |
|------|-------|---------|
| Quick (2) | 2 | 1.0 |
| Speed (3) | 3 | 1.5 |
| Classic (4) | 4 | 2.0 |
| Combo (5) | 5 | 2.5 |
| Expert (6) | 6 | 3.0 |
| Power (7) | 7 | 3.5 |
| Master (8) | 8 | 4.0 |
| Wild (9) | 9 | 4.5 |

### 2. PB bonus replaces flat speed threshold

The PB (personal best) system rewards any improvement to a player's avg top-10 fastest times. Bonus scales with improvement magnitude, floored at base HB so every PB feels meaningful. Requires 10+ solves to activate.

```sql
-- Snapshot avg top-10 BEFORE inserting the new solve
SELECT avg(time_ms) INTO v_old_avg_ms
FROM (
  SELECT time_ms FROM solves
  WHERE child_id = p_child_id AND mode = p_mode
  ORDER BY time_ms ASC LIMIT 10
) top10
HAVING count(*) >= 10;

-- Insert the new solve
INSERT INTO solves (...) VALUES (...) RETURNING id INTO v_solve_id;

-- Recalculate AFTER insert
SELECT avg(time_ms) INTO v_new_avg_ms
FROM (
  SELECT time_ms FROM solves
  WHERE child_id = p_child_id AND mode = p_mode
  ORDER BY time_ms ASC LIMIT 10
) top10
HAVING count(*) >= 10;

-- PB bonus: proportional to seconds improved, floored at base_hb
IF v_new_avg_ms IS NOT NULL AND v_new_avg_ms < v_old_avg_ms THEN
  v_improvement_s := (v_old_avg_ms - v_new_avg_ms) / 1000.0;
  v_speed_bonus := ROUND(v_improvement_s * v_base_hb, 2);
  IF v_speed_bonus < v_base_hb THEN
    v_speed_bonus := v_base_hb;
  END IF;
END IF;
```

### 3. Separate ledger entries for auditability

Base earnings and speed bonuses are distinct `hb_transactions` rows with different type codes. This makes the balance fully auditable. See [COPPA/Auth architecture doc](../best-practices/coppa-compliant-child-auth-supabase-custom-jwt-2026-05-15.md) for the advisory lock and append-only ledger infrastructure.

```sql
INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
VALUES (p_child_id, 'EARN', v_base_hb, v_old_balance + v_base_hb, v_solve_id);

IF v_speed_bonus > 0 THEN
  INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
  VALUES (p_child_id, 'SPEED_BONUS', v_speed_bonus, v_new_balance, v_solve_id);
END IF;
```

### 4. Decimal currency formatting

Use `NUMERIC(12,2)` in the database. In the UI, show clean integers when possible, one decimal place otherwise.

```typescript
function fmtHB(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
// 2 -> "2", 1.5 -> "1.5", 4.50 -> "4.5"
```

### 5. Streaks are display-only

Streaks (consecutive-day play) are tracked and shown to players for motivation but do NOT multiply HB earnings.

## Why This Matters

**Pedagogical alignment.** If passive compounding outpaces active earning, students learn that showing up matters more than improving. The PB system teaches that continuous effort and measurable self-improvement are what get rewarded.

**Economy sustainability.** With ~50 students playtesting, a too-generous economy inflates quickly. Base HB of `mode * 0.5` with 0.1% daily compounding means a student earning 2 HB/solve in Classic mode needs roughly 20 solves/day to stay ahead of compounding -- achievable but requiring genuine engagement.

**Fairness across skill levels.** The flat +50 HB speed bonus rewarded only the fastest players. The PB system rewards every player who improves their own performance, regardless of absolute speed. A slower student who shaves 2 seconds off their average gets a proportionally meaningful bonus.

**Auditability.** The append-only `hb_transactions` ledger with separate EARN and SPEED_BONUS entries means any balance can be reconstructed from first principles. This matters for a real-money-adjacent economy where parents can see their child's earnings.

## When to Apply

- When modifying HB earning logic -- maintain the principle that base stays at `mode * 0.5` and bonuses require demonstrated improvement
- When adding new bonus types -- follow the pattern of separate `hb_transactions` entries with distinct type codes
- When introducing new modes (10+ cards) -- the `mode * 0.5` formula naturally scales
- When adjusting compounding rate -- verify daily passive income cannot exceed what an active player earns in a typical session (~20-30 solves)
- When displaying HB anywhere in the UI -- always use the `fmtHB()` formatter, never raw floating point
- When building atomic operations like `record_solve()` -- use advisory locks and calculate "before" state before inserting

## Examples

### Before: Flat speed bonus (Phase 1)

```sql
v_base_hb := p_mode * 5;  -- Classic = 20 HB/solve
IF p_time_ms < v_median_time * 0.2 THEN
  v_speed_bonus := 50;  -- All or nothing
END IF;
-- Single combined transaction
INSERT INTO hb_transactions (child_id, type, amount)
VALUES (p_child_id, 'EARN', v_base_hb + v_speed_bonus);
```

A Classic player earns 20 HB/solve minimum, 70 HB if fast. With compounding, passive income quickly dominates. Speed bonus is binary. No audit trail distinguishes base from bonus.

### After: PB-based bonus (Phase 2)

```sql
v_base_hb := ROUND(p_mode * 0.5, 2);  -- Classic = 2.0 HB/solve
-- PB bonus: 3.2s improvement = 3.2 * 2.0 = 6.4 HB (min 2.0)
v_speed_bonus := GREATEST(ROUND(v_improvement_s * v_base_hb, 2), v_base_hb);
-- Separate ledger entries
INSERT INTO hb_transactions (...) VALUES (..., 'EARN', v_base_hb, ...);
INSERT INTO hb_transactions (...) VALUES (..., 'SPEED_BONUS', v_speed_bonus, ...);
```

A Classic player earns 2.0 HB/solve. PB of 3.2 seconds improvement = 6.4 HB bonus. Compounding at 0.1% stays well below active earning. Every transaction is individually auditable.

## Related

- [COPPA-Compliant Child Auth & Supabase Custom JWT](../best-practices/coppa-compliant-child-auth-supabase-custom-jwt-2026-05-15.md) -- Section 4 covers the advisory lock and append-only ledger infrastructure used by `record_solve()`
- Migration `20260515000007_hb_rework.sql` -- initial rework (streak removal, integer PB bonus)
- Migration `20260515000008_hb_decimal_scaling.sql` -- decimal scaling (mode * 0.5, multiplicative PB bonus)
- `docs/phase-2-test-plan.md` Section 2 -- test cases for PB bonus verification

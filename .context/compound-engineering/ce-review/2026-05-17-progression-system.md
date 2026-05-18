# Code Review: Progression System (feat/progression-system)

**Date**: 2026-05-17
**Mode**: autofix
**Plan**: docs/plans/2026-05-17-001-feat-progression-system-plan.md
**Reviewers dispatched**: 10 (all completed)
**Changed lines**: ~384 (non-test, non-generated)

## Reviewers

| Reviewer | Status |
|----------|--------|
| correctness | completed |
| testing | completed |
| maintainability | completed |
| project-standards | completed |
| agent-native | completed (no gaps) |
| learnings-researcher | completed |
| adversarial | completed |
| performance | completed |
| data-migrations | completed |
| kieran-typescript | completed |

## Applied Fixes (safe_auto)

1. **P0: False celebrations on first solve of session** — `prevUnlockedRef`, `prevModeCountsRef`, `prevRanksRef` were initialized to defaults (`[2]`, `{}`, `{}`) and never updated from mount-time `fetchProgress`. Fixed by updating refs inside `fetchProgress` after setting state, and using local snapshots in `submitSolve` for delta comparison.

2. **P1: tutorialSeen defaults to `true` on client** — `data.tutorialSeen ?? true` would skip tutorial for edge cases where the field is nullish. Changed to `?? false` (show tutorial by default, matching the API's own default).

3. **P2: MODE_NAMES duplicates MODES[m].label** — Removed the redundant `MODE_NAMES` constant and replaced all 8 usages with `MODES[m].label`.

4. **P2: Unused Rational import** — Removed from page.tsx import line.

5. **P2: Tutorial useEffect missing dependency array** — Added explicit deps `[step, tiles, handleTileTap, handleOp, onComplete, handIdx]` to prevent event listener churn on every render.

6. **P2: pendingOp typed as `string` instead of `OpSymbol`** — Narrowed type in tutorial.tsx.

7. **P1: RPC error silently swallowed** — Added `error` destructuring and `console.error` logging in route.ts rank RPC calls.

## Unresolved Findings

### P0

- **No test suite exists** — Zero automated tests cover any code in the project. No test runner installed. (owner: human, manual)

### P1

- **Deploy ordering risk** — Supabase migration must be pushed before Vercel code deploy. `child_leaderboard_rank` RPC will 404 if code deploys first. (owner: human, advisory)
- **Qualify celebration false positive on first session** — `prevModeCountsRef` defaults to `{}`, so a player who already has 10+ solves will see a spurious qualify celebration on their first solve of any new session. Requires initializing refs from mount data AND guarding qualify check against "did this solve actually contribute." (owner: downstream-resolver, gated_auto)
- **N+1 RPC calls for rank data** — 8 concurrent Supabase RPC calls per page load when all modes unlocked. Safe at 50 students but needs batching for scale. (owner: human, advisory)

### P2

- **Tutorial teaches card-op-card but game uses card-card-op** — The tutorial interaction model diverges from the main game's pairwise reduction. Footer text also says card-op-card. The plan intended this change but the main game wasn't updated to match. Requires design decision. (owner: human, gated_auto)
- **UNLOCK_THRESHOLD hardcoded in two places** — `page.tsx` (const) and `route.ts` (literal `5`). If threshold changes, both must be updated. (owner: downstream-resolver, manual)
- **Stale closure risk in submitSolve** — `submitSolve` is a plain async function (not useCallback), called from `handleOp` which is wrapped in useCallback. Multiple reviewers flagged potential stale closure when timer re-renders change the component between definition and invocation. (owner: downstream-resolver, gated_auto)
- **SQL: 'week' period uses rolling 7 days** — May not match the leaderboard API's definition of "This week". Needs alignment check. (owner: downstream-resolver, gated_auto)

### P3 / Advisory

- **22 useState variables in page.tsx** — Component complexity; consider extracting progress/celebration logic into a custom hook.
- **Timer re-renders 19x/sec** — Extract `TimerDisplay` component to prevent full-page re-renders.
- **modeCounts fetches all solve rows** — Should use `GROUP BY mode` aggregate in SQL instead of JS counting.
- **bonusDismissed resets on navigation** — Not persisted; badge re-appears every session.
- **Initial deal hardcodes mode 2** — Advanced players see a 2-card preview briefly on load.
- **Keyboard celebrations: blocks keys but doesn't dismiss** — Enter/Space are prevented but celebrations can only be dismissed by clicking.
- **SolveResult.streakDays stale** — Type field remains after HB rework removed streak multiplier.

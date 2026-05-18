---
title: "feat: Progression system & tutorial fix"
type: feat
status: active
date: 2026-05-17
origin: docs/brainstorms/progression-system-requirements.md
---

# feat: Progression system & tutorial fix

## Overview

Add a cohesive progression system to the play page based on playtest feedback from ~50 students. The tutorial teaches the wrong interaction model (card-card-op instead of card-op-card), there's no sense of progress, level-up moments are absent, and the leaderboard goes unnoticed. This plan addresses all five issues with: tutorial fix, progress bar, celebration overlays, post-solve nudges, leaderboard deep-linking, and bonus mode gate.

## Problem Frame

See origin: `docs/brainstorms/progression-system-requirements.md`. Five interconnected issues from classroom playtesting: wrong tutorial interaction model, no progress visibility, invisible leaderboard, no level-up moments, and two unserved player types (competitive vs. self-improvement).

## Requirements Trace

### Tutorial Fix
- R1. Tutorial uses card-op-card interaction model
- R2. Tutorial instruction text reflects new flow (welcome screen + in-game)
- R3. Guided hand highlights card → operator → second card
- R3a. Play page footer text reflects card-op-card

### Progress Bar
- R4. Progress bar visible at all times below mode pills
- R5. Phase A: bar shows mode unlock progress (X/5)
- R6. Phase B pre-qualification: bar shows leaderboard qualification (X/10 in selected mode)
- R7. Phase B post-qualification: bar shows rank in selected mode's weekly fastest-10
- R8. Progress bar updates immediately after each solve

### Celebration Overlays
- R9. Full-screen celebration on mode unlock
- R10. Full-screen celebration on leaderboard qualification
- R11. Celebrations require button tap to dismiss

### Post-Solve Nudges
- R12. Post-solve nudges in win panel (rank change, unlock proximity ≤ 2, qualification proximity ≤ 2)
- R13. Existing PB tag continues
- R14. Nudges inside existing win panel area

### Leaderboard Deep-Linking
- R15. Leaderboard discovery via qualification celebration
- R15a. Leaderboard page accepts URL search params
- R16. Header leaderboard icon remains

### Bonus Mode Gate
- R17. Bonus mode gate: top-3 Classic → visual prompt for Expert
- R18. Modes 5-9 selectable independently of leaderboard rank

## Scope Boundaries

- Not changing HB economy, daily goals, or leaderboard page design
- War mode unaffected
- Modes 5-9 unlock threshold stays at 5 solves
- No new pages — all UI changes are on the play page, win panel, and leaderboard URL params

## Context & Research

### Relevant Code and Patterns

- **Solve flow**: `submitSolve()` → POST `/api/solve` → `record_solve` RPC → client sets `hbEarned`/`speedBonus` → `fetchProgress()` → GET `/api/progress` → client sets `modeCounts`/`unlockedModes`. Two async calls; win panel renders after the first, progress state arrives after the second.
- **Progress pips (fm-qp)**: Lines 435-459 of `page.tsx`. Shows "N more solves to unlock [mode]" with 5 filled dots. Only visible during Phase A. Hidden once qualified. Occupies the space between mode pills and target banner — this is where the progress bar goes.
- **Win panel**: Lines 590-612 of `page.tsx`. Shows time, expression, HB earned, PB tag, "Next hand" button. Nudges insert between `fm-hb-earned` and `fm-result-actions`.
- **Leaderboard RPCs**: `leaderboard_fastest(mode, period)` returns ranked rows with `avg_time_ms` from top-10 fastest solves. Qualification gate: ≥ 10 solves. `leaderboard_solves(mode, period)` ranks by count. Both return `rank BIGINT` via `ROW_NUMBER()`.
- **Tutorial**: `tutorial.tsx` — 3 hands with degrading scaffolding (full → semi → free). State machine uses `selected: string[]` allowing 2 cards before ops fire. CSS colocated in `game.css`. Tri-state loading in `page.tsx` (`tutorialSeen: boolean | null`).
- **API auth pattern**: Read `child_jwt` cookie → `verifyChildJwt()` → extract `childId` → `createServiceClient()` → query/RPC → JSON response.

### Institutional Learnings

- **Tutorial pattern** (`docs/solutions/best-practices/tutorial-onboarding-progressive-scaffolding-2026-05-15.md`): Tri-state loading, optimistic completion, CSS colocated in `game.css`, reuse `fm-card`/`fm-ops` classes.
- **Economy internals** (`docs/solutions/best-practices/hb-economy-effort-based-earning-rework-2026-05-15.md`): `record_solve` snapshots avg-top-10 before insert, PB bonus requires 10+ solves (same gate as leaderboard qualification).
- **Deploy gap** (`docs/solutions/integration-issues/google-sso-deploy-missing-migration-and-env-var-2026-05-17.md`): Migrations must be pushed separately via `npx supabase db push --linked`. Always verify before deploying.
- **CSS import gotcha** (`docs/solutions/build-errors/nextjs-route-group-relative-import-paths-2026-05-16.md`): Route group `(child)` adds a filesystem level. Use `@/` aliases or count the extra `../`.

## Key Technical Decisions

- **New `child_leaderboard_rank` RPC**: A lightweight single-row Postgres function that returns just the current child's rank, avg_time_ms, and total participants for a given mode/period. Avoids loading the full leaderboard (50 rows) just to find one child's rank. Called from `/api/progress` alongside existing queries.
  - Rationale: The existing `leaderboard_fastest` returns a ranked table of all qualified players. Querying it and scanning for one child wastes bandwidth and computation. A CTE with `ROW_NUMBER()` filtered to one child is O(n) in Postgres but returns a single row to the API.

- **Extend `/api/progress`, not `record_solve`**: Add rank data to the progress endpoint rather than complicating the solve RPC. The progress endpoint already runs after every solve; adding rank data there keeps `record_solve` focused on HB/ledger concerns and avoids enlarging the advisory-locked transaction.
  - Rationale: Separation of concerns. `record_solve` is transaction-critical with advisory locks. Rank queries are read-only and can tolerate slight staleness.

- **Replace pips with progress bar**: The existing `fm-qp` pip section is removed entirely. The new progress bar occupies the same position (below mode pills, above target banner) and covers all three states: Phase A unlock, Phase B qualification, Phase B rank. All modes 2-9 support independent leaderboard qualification (10 solves per mode). The bar shows qualification/rank for whichever mode is currently selected.
  - Rationale: Coexisting indicators for the same information would confuse kids. The progress bar supersedes pips.

- **Refactor `fetchProgress` to return data**: Currently `fetchProgress()` is fire-and-forget (called without await in `submitSolve`). Refactor it to `await fetchProgress()` and return the API response data. This enables both delta detection (comparing pre/post state) and deferred nudges (computing nudges from the returned data). The refactoring is: (1) `fetchProgress` returns the parsed response, (2) `submitSolve` snapshots current state via refs before the call, (3) `submitSolve` awaits `fetchProgress`, (4) celebrations and nudges are computed from snapshots vs. returned data.
  - Rationale: Both delta detection and deferred nudges require knowing when the progress fetch completed and what data it returned. React state updates are batched and asynchronous, so the caller cannot read post-state synchronously after `fetchProgress` — it must return the data directly.

- **Deferred nudge pattern**: Win panel renders immediately with HB data from the solve response. After `fetchProgress` resolves (now awaited), nudges are computed from returned data vs. pre-solve snapshots and set as state. Nudges animate in when the state lands (~200ms after the win panel renders).
  - Rationale: Fastest time-to-feedback. Kids see "You got 24!" and HB earned instantly. Nudges appear shortly after when progress state arrives.

- **Delta detection for celebrations**: In `submitSolve`, snapshot `unlockedModes` and `modeCounts` via refs before calling `fetchProgress`. After the awaited call returns, compare returned data against snapshots to detect new unlocks (new mode in `unlockedModes`) and new qualifications (`modeCounts[mode]` crossing from <10 to ≥10).
  - Rationale: Simpler than extending the API to return "what just happened" deltas. Client already has both states via snapshot + return value.

- **Celebration overlay keyboard trap**: While a celebration overlay is visible, suppress the existing Enter/Space handler that triggers `startReady()`. The overlay's own buttons handle dismissal.
  - Rationale: Without this, pressing Enter would dismiss the overlay AND deal a new hand simultaneously.

- **Bonus mode prompt**: Gold star badge on the Expert pill in the mode picker. Shown when the child is top-3 in Classic weekly fastest. Visible per-session (reappears each login but doesn't nag within a session after dismissal). Dismisses on tap or when switching to Expert.
  - Rationale: Subtle enough to not be pushy, visible enough to notice. Per-session avoids database persistence for a minor UI hint.

## Open Questions

### Resolved During Planning

- **Rank fetching efficiency**: New `child_leaderboard_rank` RPC returns one row per call. Called for all unlocked modes in `Promise.all` from `/api/progress` (~5ms each, ~40ms total for all 8 modes). Returns all ranks in one response so mode switches read from cached client state with no re-fetch.
- **Progress bar visual**: Continuous fill bar (not dots). Shows text label inside/beside the bar. Three distinct visual states.
- **Bonus mode visual**: Gold badge on Expert pill. Per-session visibility.
- **Overlay timing**: Fires after `fetchProgress` resolves, not optimistically. Win panel visible immediately; overlay appears on top after delta detection.
- **Nudge priority**: When multiple nudges apply, show only the highest-priority: rank change > unlock proximity > qualification proximity. One message at a time.
- **Weekly definition**: Uses the existing `leaderboard_fastest` period filter: `CURRENT_DATE - INTERVAL '7 days'` (rolling 7 days, not calendar week). No change needed.

### Deferred to Implementation

- Exact progress bar colors, font sizes, and animation easing — follow existing design tokens in `globals.css`
- Celebration overlay animation style (fade, scale, slide) — match the tutorial overlay pattern in `game.css`
- Whether `child_leaderboard_rank` should use a CTE or a subquery — implementation detail

## Implementation Units

- [ ] **Unit 1: Tutorial card-op-card rewrite**

**Goal:** Fix the tutorial to teach the correct card-op-card interaction model, and update the play page footer text.

**Requirements:** R1, R2, R3, R3a

**Dependencies:** None

**Files:**
- Modify: `app/src/app/(child)/play/tutorial.tsx`
- Modify: `app/src/app/(child)/play/page.tsx` (footer text only)
- Modify: `app/src/app/(child)/play/game.css` (tutorial highlight adjustments)

**Approach:**
- Rewrite `tutorial.tsx` state machine to mirror `page.tsx` card-op-card model: `selected` holds at most 1 tile, add `pendingOp` state, enable operators when `selected.length === 1`, second card tap triggers `apply()`
- Update `handleTileTap`: tap with no selection → select; tap with selection but no pendingOp → replace selection; tap with selection + pendingOp → execute operation
- Update `handleOp`: requires `selected.length === 1`, sets `pendingOp`
- Update highlight logic with clear state mapping:
  - `highlightCard0`: `selected.length === 0 && !pendingOp` → "Tap a card"
  - `highlightOp`: `selected.length === 1 && !pendingOp` → "Pick an operation" (operator buttons pulse)
  - `highlightCard1`: `selected.length === 1 && pendingOp` → "Tap the second card"
- Update guide instructions: "Tap a card" → "Pick an operation" → "Tap the second card"
- Update semi-guide instructions from "Tap both cards" to "Tap a card, pick an op, tap the second card"
- Update welcome screen text from "Tap two cards, then pick an operation" to "Tap a card, pick an operation, then tap a second card to combine"
- Remove swap button and `swapOperands` function (lines 68-70, 162-165 of tutorial.tsx) — card-op-card has no swap. The game page (page.tsx) does not have a swap button either; mirroring its logic naturally excludes swap.
- Update preview to match game: `[card] [op?] [?]` → `[card] [op] [?]`
- Update `page.tsx` footer hint text at line ~638 from "Tap two cards · then an operation" to "Tap a card · pick an op · tap another card". Also remove the "S(wap)" key reference since swap does not exist in card-op-card.

**Patterns to follow:**
- Mirror `page.tsx` lines 191-237 (`handleTileTap`, `handleOp`) for the selection/op state machine
- Keep tutorial's degrading scaffolding (full → semi → free) but with card-op-card highlights

**Test scenarios:**
- Happy path: Full-guide hand — tap first card (3♠), operator buttons highlight/pulse, tap +, second card highlights, tap 3♥ → result 6, "correct" feedback
- Happy path: Semi-guide hand — follow card-op-card flow (card → op → card) with abbreviated guidance → "correct"
- Happy path: Free hand — no highlights, user solves independently → "correct", advance to "done" screen
- Edge case: Tap same card twice → deselects, pendingOp clears
- Edge case: Tap operator without selecting a card → nothing happens (disabled)
- Edge case: Wrong operation produces wrong result → "wrong" feedback, retry
- Happy path: Welcome screen text reads card-op-card description
- Happy path: Skip button bypasses all hands, calls `onComplete`
- Happy path: Play page footer reads "Tap a card · pick an op · tap second card"

**Verification:**
- Tutorial teaches card-op-card — a new user following the guided hand will tap card → op → card, not card → card → op
- Footer text matches game behavior
- All three tutorial hands are completable

---

- [ ] **Unit 2: `child_leaderboard_rank` Supabase RPC**

**Goal:** Create a lightweight Postgres function that returns a single child's leaderboard rank for a given mode and period.

**Requirements:** R7, R12 (data dependency)

**Dependencies:** None

**Files:**
- Create: `app/supabase/migrations/20260517000001_child_leaderboard_rank.sql`

**Approach:**
- Function signature: `child_leaderboard_rank(p_child_id UUID, p_mode SMALLINT, p_period TEXT)` → returns `(rank BIGINT, avg_time_ms INT, total_ranked BIGINT, solve_count BIGINT)`
- Reuse the same logic as `leaderboard_fastest`: top-10 fastest solves per child, average them, rank by avg ascending. But wrap in a CTE and filter to the target child
- If the child doesn't qualify (< 10 solves in mode/period), return `NULL` for rank and avg_time_ms, but still return `solve_count` (used for R6 qualification progress)
- Period filter matches existing: 'all' (no filter), 'today' (`CURRENT_DATE`), 'week' (`CURRENT_DATE - 7 days`)

**Patterns to follow:**
- `leaderboard_fastest` in migration `20260515000006` — same ranking logic, same period filter, same top-10 average calculation

**Test scenarios:**
- Happy path: Child with 15 solves in mode 4, period 'week' → returns rank (e.g., 3), avg_time_ms, total_ranked count
- Happy path: Child with 8 solves in mode 4 → returns rank=NULL, avg_time_ms=NULL, solve_count=8
- Edge case: Child with 0 solves in a mode → returns all NULL except solve_count=0
- Edge case: Period 'today' with no solves today → returns NULL rank even if qualified in 'all'
- Edge case: Only child with 10+ solves → rank=1, total_ranked=1

**Verification:**
- Function callable via `SELECT * FROM child_leaderboard_rank(uuid, 4, 'week')` returning expected columns
- Rank matches what `leaderboard_fastest` would assign to the same child

---

- [ ] **Unit 3: Extend `/api/progress` with rank data**

**Goal:** Return leaderboard rank and qualification data alongside existing mode counts, enabling the progress bar and nudges.

**Requirements:** R5, R6, R7, R8, R12

**Dependencies:** Unit 2

**Files:**
- Modify: `app/src/app/api/progress/route.ts`
- Modify: `app/src/lib/types.ts` (add progress response types)

**Approach:**
- Add `child_leaderboard_rank` calls for **all unlocked modes** using 'week' period. At most 8 calls in `Promise.all` (~40ms total). This eliminates the need for a network round-trip on mode switch — the client caches rank data for all modes and updates the progress bar from cached state.
- Run in `Promise.all` alongside existing queries (solves count + tutorial_seen) — no extra round trip
- Response shape adds: `ranks: Record<number, { position: number | null, avgTimeMs: number | null, totalRanked: number, solveCount: number }>` — keyed by mode number
- `fetchProgress` accepts an optional `?mode=4` param that is **ignored** — all unlocked mode ranks are always returned. The param is reserved for future optimization if needed.
- Client gets all the data it needs in one `fetchProgress()` call. Mode switches read from cached `ranks[mode]` with no re-fetch.

**Patterns to follow:**
- Existing `Promise.all` pattern in `/api/progress` (parallel queries)
- Existing `/api/leaderboard` route for RPC calling convention

**Test scenarios:**
- Happy path: Child in Phase A (no Classic) → rank is null, modeCounts returned as before
- Happy path: Child in Phase B with 15 Classic solves → rank returns position, avgTimeMs
- Happy path: Child switches to Expert (mode 5) with 3 solves → rank null, solveCount=3
- Edge case: No `mode` query param → defaults to mode 4 (Classic)
- Edge case: Child with 0 solves → rank null, solveCount 0, modeCounts empty
- Integration: Response includes all existing fields (modeCounts, unlockedModes, unlockThreshold, tutorialSeen) plus new rank field

**Verification:**
- `GET /api/progress?mode=4` returns rank data alongside existing fields
- No regressions in existing progress-dependent behavior (mode pills, unlock gating)

---

- [ ] **Unit 4: Progress bar component**

**Goal:** Replace the pip dots with a persistent progress bar that shows unlock progress, qualification progress, or leaderboard rank depending on the player's phase.

**Requirements:** R4, R5, R6, R7, R8

**Dependencies:** Unit 3

**Files:**
- Modify: `app/src/app/(child)/play/page.tsx` (replace fm-qp pips section with progress bar)
- Modify: `app/src/app/(child)/play/game.css` (remove fm-qp styles, add progress bar styles)

**Approach:**
- Remove the `fm-qp` pip rendering block (lines 435-459) and its CSS (lines 772-843 in game.css)
- Add a `ProgressBar` inline section in the same position (below mode pills, above target banner)
- Three states determined by game state:
  - **Phase A** (next mode not unlocked): Fill bar showing `modeCounts[mode] / UNLOCK_THRESHOLD`. Text: "3/5 to unlock Speed"
  - **Phase B pre-qualification** (mode unlocked, rank.solveCount < 10): Fill bar showing `solveCount / 10`. Text: "7/10 to qualify for the leaderboard"
  - **Phase B post-qualification** (rank.position is not null): Rank display showing "#4 in Classic this week". Visual indicator: filled portion = (totalRanked - position + 1) / totalRanked. If rank is #1: "You're #1 in Classic this week!"
- Progress bar updates reactively when `modeCounts`, `unlockedModes`, or `ranks` state changes (already triggered by `fetchProgress` after each solve per R8)
- On mode switch: read from cached `ranks[mode]` — no re-fetch needed. `fetchProgress` returns ranks for all unlocked modes in one call.

**Patterns to follow:**
- Existing mode pill rendering for conditional styling
- Design tokens from `globals.css` for colors (primary blue for fill, gray for track)

**Test scenarios:**
- Happy path: New player on Quick → bar shows "0/5 to unlock Speed" with empty fill
- Happy path: 3 Quick solves → bar shows "3/5 to unlock Speed" with 60% fill
- Happy path: 5 Quick solves → bar transitions to "0/5 to unlock Classic" (after unlock celebration dismissed)
- Happy path: Classic unlocked, 7 Classic solves → bar shows "7/10 to qualify for the leaderboard"
- Happy path: 10+ Classic solves, ranked #4 → bar shows "#4 in Classic this week"
- Happy path: Ranked #1 → bar shows "You're #1 in Classic this week!"
- Edge case: Switch to Expert with 0 solves → bar shows "0/5 to unlock [next mode]" or "0/10 to qualify" (depending on unlock state). Reads from cached `ranks[5]`, no re-fetch.
- Edge case: Switch from Classic (ranked) to Speed (qualified) → bar updates to show Speed rank from cached `ranks[3]`
- Happy path: Solve a hand → bar updates without page refresh

**Verification:**
- Progress bar is visible at all times on the play page
- Bar reflects current mode's progression state
- Old pip dots are completely removed

---

- [ ] **Unit 5: Celebration overlays**

**Goal:** Show full-screen celebration overlays when a player unlocks a new mode or qualifies for the leaderboard.

**Requirements:** R9, R10, R11, R15

**Dependencies:** Unit 3

**Files:**
- Modify: `app/src/app/(child)/play/page.tsx` (celebration state, delta detection, overlay rendering, keyboard trap)
- Modify: `app/src/app/(child)/play/game.css` (celebration overlay styles)

**Approach:**
- Add celebration state as an array for queuing: `celebrations: Array<{ type: 'unlock' | 'qualify', mode: number }>`. Render `celebrations[0]`. On dismissal, shift the first element. When empty, overlay hides.
- **Delta detection**: In `submitSolve`, snapshot state via refs before `fetchProgress`. After the awaited call returns, compare returned data against snapshots:
  - New mode in `unlockedModes` not in snapshot → push `{ type: 'unlock', mode }` to celebrations
  - `modeCounts[mode]` crossed from <10 to ≥10 AND rank data is present → push `{ type: 'qualify', mode }`
- **Overlay rendering** (when `celebrations.length > 0`):
  - Unlock: "You unlocked [mode name]!" + "Try [mode name]" button (switches mode, shifts celebrations) + "Keep playing" button (shifts celebrations)
  - Qualify: "You're on the leaderboard!" + "See your rank" button (navigate to `/leaderboard?mode=N&metric=fastest&period=week`) + "Keep playing" button
  - Both require button tap to dismiss (R11)
- **Keyboard trap**: While `celebrations.length > 0`, the existing `handleKey` function skips `startReady()` for Enter/Space/N. Add `celebrations` to the `handleKey` useEffect dependency array so the closure captures the current value. The overlay's own buttons are the only interactive elements.
- **Multiple celebrations**: Unlikely in practice (a single solve can unlock a mode or qualify, but rarely both simultaneously), but the array state handles it naturally. If both occur, show unlock first, then qualify after dismissal.
- Overlay CSS: Full-viewport fixed overlay with backdrop blur, centered card with buttons. Reuse tutorial overlay pattern (`fm-tut-overlay`, `fm-tut-card`) as the visual base.

**Patterns to follow:**
- Tutorial overlay in `tutorial.tsx` — welcome/done screens with centered card and CTA buttons
- Tutorial CSS: `fm-tut-overlay` (full-screen fixed), `fm-tut-card` (centered content card)

**Test scenarios:**
- Happy path: 5th solve in Quick → overlay "You unlocked Speed!" with "Try Speed" and "Keep playing" buttons
- Happy path: Click "Try Speed" → mode switches to Speed, overlay dismisses, new hand deals in Speed
- Happy path: Click "Keep playing" → overlay dismisses, stays on Quick
- Happy path: 10th solve in Classic → overlay "You're on the leaderboard!" with "See your rank" and "Keep playing"
- Happy path: Click "See your rank" → navigates to `/leaderboard?mode=4&metric=fastest&period=week`
- Edge case: Press Enter while overlay is visible → nothing happens (keyboard trapped)
- Edge case: Press Space while overlay is visible → nothing happens
- Edge case: Unlock + qualify on same solve → unlock overlay first, then qualify overlay after dismissal
- Edge case: Re-solving in a mode that's already unlocked → no duplicate celebration

**Verification:**
- Celebration fires exactly once per unlock/qualify event
- Overlay requires button tap to dismiss
- Enter/Space do not bypass the overlay
- After dismissal, normal game flow resumes

---

- [ ] **Unit 6: Post-solve nudges**

**Goal:** Show contextual messages in the win panel after a successful solve — rank changes, unlock proximity, qualification proximity.

**Requirements:** R12, R13, R14

**Dependencies:** Unit 3

**Files:**
- Modify: `app/src/app/(child)/play/page.tsx` (nudge rendering in win panel)
- Modify: `app/src/app/(child)/play/game.css` (nudge styling)

**Approach:**
- Add `nudge: string | null` state. Computed in `submitSolve` after the awaited `fetchProgress` returns, by comparing returned data against pre-solve snapshots (stored in refs):
  - **Rank change**: Compare pre-solve `ranks[mode].position` (from ref snapshot) with returned rank. If improved: "You moved up to #{newRank} in [mode]!"
  - **Unlock proximity** (Phase A, remaining ≤ 2): `UNLOCK_THRESHOLD - modeCounts[mode]`. If ≤ 2: "N more to unlock [nextMode]!"
  - **Qualify proximity** (Phase B, remaining ≤ 2): `10 - ranks[mode].solveCount`. If ≤ 2: "N more solves to qualify!"
- **Priority**: Show only the highest-priority nudge: rank change > unlock proximity > qualification proximity. Each nudge is computed fresh per solve — no cross-solve deduplication needed since rank values change each time.
- **Rendering**: Insert nudge between `fm-hb-earned` and `fm-result-actions` in the win panel. Animate in (fade+slide) when the nudge state lands — may appear ~200ms after the win panel renders
- PB tag (R13) is unaffected — continues showing alongside HB earned
- No new toast or banner elements (R14)

**Patterns to follow:**
- Existing `fm-speed-tag` animation pattern for the PB tag
- Existing win panel structure (lines 590-612 of `page.tsx`)

**Test scenarios:**
- Happy path: Rank improves from #5 to #3 → nudge shows "You moved up to #3 in Classic!"
- Happy path: 4th solve in Quick (1 away from unlock) → nudge shows "1 more to unlock Speed!"
- Happy path: 3rd solve in Quick (2 away) → nudge shows "2 more to unlock Speed!"
- Happy path: 2nd solve in Quick (3 away) → no nudge (threshold is ≤ 2)
- Happy path: 9th solve in Classic → nudge shows "1 more solve to qualify!"
- Edge case: Rank + unlock proximity both true → shows rank change (higher priority)
- Edge case: No rank change, not close to anything → no nudge, win panel shows as before
- Happy path: PB tag still appears when speed bonus earned, alongside or above nudge

**Verification:**
- Nudges appear inside the win panel, not as separate UI
- Only one nudge at a time
- Nudge animates in after fetchProgress (not blocking the win panel)

---

- [ ] **Unit 7: Leaderboard URL params**

**Goal:** Support deep-linking to the leaderboard page with mode, metric, and period pre-selected.

**Requirements:** R15a

**Dependencies:** None

**Files:**
- Modify: `app/src/app/leaderboard/page.tsx`

**Approach:**
- Read `mode`, `metric`, `period` from `useSearchParams()` on mount
- Initialize useState values from URL params (with validation): `mode` must be 2-9, `metric` must be 'solves'|'fastest', `period` must be 'all'|'today'|'week'
- Fall back to current defaults (mode=4, metric='solves', period='all') for invalid or missing params
- Optionally sync state changes back to URL via `router.replace()` with search params so the URL stays shareable — but not required for MVP

**Patterns to follow:**
- Next.js App Router `useSearchParams()` for client-side URL param reading
- Existing leaderboard state management (useState for mode/metric/period)

**Test scenarios:**
- Happy path: Navigate to `/leaderboard?mode=3&metric=fastest&period=week` → leaderboard shows Mode 3, Fastest, This Week
- Happy path: Navigate to `/leaderboard` (no params) → defaults to Mode 4, Most Solved, All Time
- Edge case: Invalid mode (`?mode=99`) → falls back to Mode 4
- Edge case: Invalid metric (`?metric=foo`) → falls back to 'solves'
- Edge case: Partial params (`?mode=3`) → mode=3, metric and period default

**Verification:**
- Celebration overlay's "See your rank" link opens leaderboard with correct filters pre-selected
- Direct URL navigation works

---

- [ ] **Unit 8: Bonus mode gate**

**Goal:** Show a visual prompt on the Expert mode pill when the player is top-3 in Classic weekly fastest.

**Requirements:** R17, R18

**Dependencies:** Unit 3

**Files:**
- Modify: `app/src/app/(child)/play/page.tsx` (bonus prompt rendering on mode pill)
- Modify: `app/src/app/(child)/play/game.css` (bonus prompt styling)

**Approach:**
- Use `ranks[4]` from the extended progress response (Unit 3 returns ranks for all unlocked modes, including Classic)
- If `classicRank.position` is 1, 2, or 3 AND Expert (mode 5) is unlocked: show a gold star badge on the Expert pill
- Add `bonusDismissed` state (default false). Set to true when the player taps the Expert pill or dismisses the badge. Resets on page load (per-session, no persistence)
- Badge CSS: Small gold star (`⭐`) positioned as an absolute badge on the Expert pill, with a subtle pulse animation
- Modes 5-9 remain selectable at any time regardless of bonus prompt state (R18)

**Patterns to follow:**
- Existing locked mode pill styling (dashed border, 🔒 icon) for conditional pill decoration
- Existing `fm-tut-pulse` animation for attention-drawing

**Test scenarios:**
- Happy path: Player is #2 in Classic weekly fastest, Expert unlocked → gold star badge on Expert pill
- Happy path: Player taps Expert pill → badge dismissed, mode switches to Expert
- Edge case: Player is #4 → no badge
- Edge case: Expert not unlocked (< 5 Combo solves) → no badge even if #1 in Classic
- Edge case: Page reload → badge reappears (per-session state reset)
- Happy path: Non-Classic modes (6-9) do not get badges regardless of rank

**Verification:**
- Badge visible only when conditions met (top-3 Classic + Expert unlocked)
- Tapping Expert with badge dismisses it and switches mode
- Modes 5-9 remain functional regardless of badge state

## System-Wide Impact

- **Interaction graph:** `submitSolve()` → solve API → win panel renders immediately → snapshot refs → `await fetchProgress()` → progress API → returned data compared against snapshots → celebrations pushed to queue + nudge computed → state updates land → progress bar re-renders + celebration overlay appears (if applicable). The overlay traps keyboard input until dismissed.
- **Error propagation:** If `fetchProgress` fails after a solve, the progress bar shows stale data and no nudge/celebration fires. The solve itself is recorded correctly. No data loss — next successful `fetchProgress` catches up.
- **State lifecycle risks:** Delta detection compares pre/post `fetchProgress` state. If `fetchProgress` is called twice rapidly (e.g., fast consecutive solves), the second call's snapshot may miss the first call's unlock. Mitigation: the existing `submitting` flag prevents concurrent solves.
- **API surface parity:** No other interfaces consume `/api/progress` besides the play page. Changes are backwards-compatible (new fields added, no fields removed).
- **Unchanged invariants:** `record_solve` RPC, HB economy, advisory locks, solve verification — none are modified. The leaderboard RPCs (`leaderboard_fastest`, `leaderboard_solves`) are not modified; a new RPC is added alongside them.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `child_leaderboard_rank` RPCs add latency to `/api/progress` | Each RPC is ~5ms; running for all unlocked modes in `Promise.all` adds ~40ms worst case (all 8 modes). Most players have 2-4 modes unlocked (~10-20ms). Monitor after deploy. |
| Celebration overlay blocks game flow if user walks away | Overlay is non-modal from a browser perspective — refreshing the page clears it. No server-side celebration state. |
| Migration not applied to production before deploy | Follow deploy checklist from `docs/solutions/integration-issues/google-sso-deploy-missing-migration-and-env-var-2026-05-17.md`: push migration before deploying code. |
| Tutorial rewrite introduces regression in guided hand logic | Tutorial is self-contained (no shared state with game page). Test all 3 hands + skip flow. |
| 50 concurrent students calling `/api/progress` with rank queries | The rank RPC is read-only (no locks). Postgres handles 50 concurrent reads easily. |

## Sources & References

- **Origin document:** [docs/brainstorms/progression-system-requirements.md](docs/brainstorms/progression-system-requirements.md)
- Related code: `app/src/app/(child)/play/page.tsx`, `app/src/app/(child)/play/tutorial.tsx`, `app/src/app/api/progress/route.ts`
- Related migration: `app/supabase/migrations/20260515000006_fastest_avg_top10.sql` (leaderboard_fastest RPC to mirror)
- Institutional learnings: `docs/solutions/best-practices/tutorial-onboarding-progressive-scaffolding-2026-05-15.md`, `docs/solutions/best-practices/hb-economy-effort-based-earning-rework-2026-05-15.md`

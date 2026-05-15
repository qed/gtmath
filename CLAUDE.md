# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTMath** is a math card game (expanded from the classic "Make 24") with 8 difficulty modes (2–9 cards), player accounts, per-mode leaderboards, and a 2-player heads-up duel (War) mode on a shared device. Built for classroom playtesting with ~50 students.

The repository currently contains only the **design handoff prototype** under `artifacts/design_handoff_fastmath52/design/`. This is a working HTML + React-via-Babel prototype — it is the design reference, not production code. The production app has not yet been built.

## Running the Prototype

The prototype is a no-build static site. Serve the `artifacts/design_handoff_fastmath52/design/` directory with any HTTP server:

```
npx serve artifacts/design_handoff_fastmath52/design
# or
python -m http.server -d artifacts/design_handoff_fastmath52/design
```

Then open `GTMath.html` in a browser. Script load order matters — see the `<script>` tags in `GTMath.html`.

## Architecture: Design Prototype

All files live under `artifacts/design_handoff_fastmath52/design/`:

- **solver.js** — Rational arithmetic engine (`{n, d}` fractions to avoid float drift), generalized solvability checker, smart deal logic, achievable-value enumeration for variable-target modes. Exposes `window.FM24`.
- **store.js** — localStorage-backed data layer (`fm24:v1` key). Users, solves, combo canonicalization (`<mode>-<target>-<sorted ranks CSV>`), leaderboard derivations. Exposes `window.FM24Store`.
- **auth.jsx** — Login screen, user pill, user menu, avatar.
- **leaderboard.jsx** — MiniCards, leaderboard rows, win leaderboard, leaderboard modal, players view, qualify progress.
- **war.jsx** — Heads-up duel: setup screen, war panels, full match flow.
- **app.jsx** — Main game: single-hand state machine (Ready → Playing → Won/Bust), card/op/preview UI, mode picker, header, result panels. Mounts WarMode when active.
- **tweaks-panel.jsx** — Dev/playtest controls (card style, face cards, smart deal, hints).
- **styles/tokens.css** — Design tokens: colors, typography, spacing, radii, shadows, motion easing.

Scripts load via `<script type="text/babel">` and publish components on `window`. In a production build, these become proper module imports.

## Game Rules (Critical for Implementation)

- **Pairwise reduction only** — no explicit brackets. Tap card, tap card, tap operator → merge into result tile. Repeat until one tile remains.
- **No retry on bust** — if the final tile doesn't equal the target, the hand is locked. No undo after Won or Bust. This makes the "Most solved" leaderboard meaningful (every solve is first-try).
- **Tap order = operand order** for non-commutative ops (−, ÷). A swap button (⇆) lets users reverse without re-tapping.
- **Smart deal** — hands are validated for solvability before being shown (up to 4000 retries). Variable-target modes (7–9 cards) enumerate achievable values and pick a random integer in range. 600ms budget for variable-target dealing.
- **Canonical combo key**: `<mode>-<target>-<sorted ranks CSV>` (e.g., `4-24-3,3,8,8`). Same rank multiset at different targets or modes = different boards.
- **Suits are decorative** — two cards of the same rank with different suits are mathematically equivalent.

## Modes

| ID | Name    | Cards | Target            |
|----|---------|-------|-------------------|
| 2  | Quick   | 2     | 6                 |
| 3  | Speed   | 3     | 12                |
| 4  | Classic | 4     | 24                |
| 5  | Combo   | 5     | 72                |
| 6  | Expert  | 6     | 144               |
| 7  | Power   | 7     | Random 300–500    |
| 8  | Master  | 8     | Random 501–999    |
| 9  | Wild    | 9     | Random 1000–9999  |

Face cards: A=1, J=11, Q=12, K=13. Togglable to ranks 1–10 only.

## War Mode (2-Player Duel)

Split-screen on shared device — top half rotated 180°. 52-card deck, 12 cards each, top 2 per player form a shared 4-card hand each round. First to make 24 wins the round and takes all 4 cards. Match ends when a player has fewer than 2 cards. Selection state is independent per player (parallel arrays in `war.jsx`).

## Design System

Built on the **Alpha Toronto Parents Hub** design system. Key tokens in `tokens.css`:
- Primary: `--alpha-blue: #0000FF` (royal blue)
- Fonts: Archivo (display, 400–900), Inter (body), Instrument Serif Italic (editorial accent)
- Standard easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`, content reveal: `cubic-bezier(0.33, 1, 0.68, 1)`
- The prototype is **high-fidelity** — colors, type, spacing, radii, shadows, animations are all final. Recreate pixel-faithfully.

## Production Notes

The prototype uses localStorage. Production needs:
1. A real backend for cross-device leaderboards (suggested REST shape in README.md).
2. Server-side solve verification (re-evaluate expression with rational arithmetic).
3. Optionally: WebSocket-based cross-device War mode.

See `artifacts/design_handoff_fastmath52/README.md` for the full backend API shape, database schema sketch, and open questions.

## Documented Solutions

`docs/solutions/` -- documented solutions to past problems (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

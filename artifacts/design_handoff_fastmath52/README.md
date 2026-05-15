# Handoff: FastMath52

## Overview

**FastMath52** is a fast, mobile- and desktop-friendly take on the classic *Make 24* math card game, expanded into a full game system:

1. A **fast input loop** — tap a card, tap another card, tap an operation — that can be played as quickly as your brain can run the math.
2. **Eight difficulty modes** (2 cards → target 6, all the way up to 9 cards → random 4-digit target) so the same UI scales from kindergarten to challenge.
3. **Player accounts and per-mode leaderboards**, with two metrics: *Most solved* (distinct hands, first-try) and *Fastest 10 avg*.
4. **Heads-up Duel (War) mode** — a 2-player game-of-war on a shared device (split-screen with the top half rotated 180° so both players read normally).

Built for classroom playtesting with ~50 students. The prototype in `design/` is a complete, working HTML+React-via-Babel implementation that demonstrates every screen and interaction.

---

## About the design files

The files under `design/` are **design references**, not production code. They are a working HTML+React-via-Babel prototype that demonstrates intended look, behavior, micro-interactions, and data flow.

Your job is **not to ship this code as-is**. Your job is to **recreate this design in the target codebase's environment** — for example a React+TypeScript SPA, a Next.js app, SwiftUI, native Android, etc. — using that codebase's established patterns (router, state, styling, build, testing). If there is no existing codebase, pick a stack appropriate to the target (most natural fit: React + TS + a state library + a real backend for cross-device persistence).

What you *should* lift from the prototype, verbatim:

- The **rules** of the game and every mode (exact card counts, target values, bust behavior, deck mechanic for War).
- The **visual design** — colors, type scale, spacing, radii, shadows, exact copy.
- The **state machines** of a single hand and a War match.
- The **canonical key** for a combo and the rules for how solves are recorded.
- The **leaderboard formulas** (Most solved, Fastest 10 avg, qualifying threshold).

The prototype's choice of localStorage as a backend is a prototyping convenience. **Production should use a real backend** — see *Production architecture notes* below.

---

## Fidelity

**High-fidelity.** Every screen is the intended visual end-state: colors, type, spacing, radii, shadows, copy, micro-interactions, and animation timings are all final. Recreate pixel-faithfully using the target codebase's libraries.

Font substitutions (documented in the design system this draws from):
- **Display: Archivo** (Google Fonts) — sub for an Alpha-School-house font we couldn't access. If the customer has the real font, swap it in.
- **Body: Inter.**
- **Editorial accent (reserved, rarely used): Instrument Serif Italic.**

---

## The game

### Single-player loop

1. **Deal** — N cards appear (count depends on mode, default 4).
2. **Solve** — user taps a "Solve" button to start the timer.
3. **Reduce** — pairwise reduction interaction:
   - User taps a card → it gets badge ①.
   - User taps a second card → it gets badge ②.
   - User taps an operator (+, −, ×, ÷). The two operand cards merge into a single **result tile** showing the new value plus a small expression caption (e.g. `8 − 3`).
   - Repeat with remaining tiles until one tile remains.
4. **Resolve**:
   - Final tile equals target → **Won**. Time is recorded.
   - Otherwise → **Bust**. The hand is **locked** — no retry, no undo. The user must deal a new hand.
5. **Next** — deal a new hand.

### Why pairwise reduction (not an expression with brackets)

The original spec mentioned explicit open/close brackets. We pushed back: pairwise reduction is faster on mobile, eliminates parse errors, and makes every step implicitly bracketed. Each reduction *is* a parenthesized sub-expression. Stick with this model. **Don't ship explicit brackets.**

### Tap order = operand order

For non-commutative operators (− and ÷), the first-tapped card is the left operand. The expression preview makes this visible (`[a] ⇆ [b]`) and a tappable ⇄ swap glyph lets the user reverse order without re-tapping.

### Undo

Allowed only during the *playing* phase (before the final tile is committed). On Won or Bust, the verdict is final — Undo disappears and the user must move on. **This is the rule that makes the *Most-solved* board meaningful** — every recorded solve is first-try.

### Keyboard

- `1`–`9` toggles a card in/out of the selection.
- `+`, `-`, `*`, `/` commits the operation. `x` and `X` are aliases for `×`.
- `S` swaps operands.
- `U` or `Backspace` undoes.
- `Esc` clears the current selection.
- `Enter`/`Space` starts a hand (in Ready) or advances (in Won/Bust).

### Smart deal

Hands are validated for solvability before being shown. The deal logic retries up to ~4000 times to find a solvable hand. For variable-target modes (7–9 cards), the dealer enumerates all reachable rational values via memoized pairwise reduction and picks a random integer **inside the configured range** to be the target — guaranteeing solvability. If the solver hits a time budget (600ms for variable-target dealing) without finishing, it falls back to a random target and flags the hand `unverified`. Production should monitor this fallback rate; it should be near zero.

### Modes

| ID | Name    | Cards | Target           |
|----|---------|-------|------------------|
| 2  | Quick   | 2     | 6                |
| 3  | Speed   | 3     | 12               |
| 4  | Classic | 4     | 24               |
| 5  | Combo   | 5     | 72               |
| 6  | Expert  | 6     | 144              |
| 7  | Power   | 7     | Random 300–500   |
| 8  | Master  | 8     | Random 501–999   |
| 9  | Wild    | 9     | Random 1000–9999 |

Mode is exposed via a dropdown anchored to the target chip in the header. The chip displays the current target (e.g. `Make 24`) and a chevron. Clicking opens the picker.

### Face cards

A → 1, J → 11, Q → 12, K → 13. A toggle in the Tweaks panel can restrict the deck to ranks 1–10 (no face cards) for younger players.

### Suits

Decorative only. Two cards of the same rank with different suits are mathematically equivalent. The leaderboard treats them as the same hand.

### Canonical hand key

A solve is recorded under a string key:

```
<mode>-<target>-<sorted ranks CSV>
```

Examples:
- Classic hand of 3♠ 8♣ 3♥ 8♦ → `4-24-3,3,8,8`
- Power hand (mode 7) target 412 ranks 1,2,3,4,5,7,8 → `7-412-1,2,3,4,5,7,8`

Properties:
- Same multiset of ranks is the same hand regardless of suit or draw order.
- Same multiset at different targets (possible in modes 7–9) = different boards.
- Same multiset in different modes = different boards.

---

## Heads-up Duel (War mode)

### What it is

A two-player game-of-war played on one shared device — sit across from each other and put a tablet flat between you. The top half of the screen is rotated 180° so both players can read normally.

### Setup

1. User clicks the **2P** button in the header.
2. A setup card appears: Player 1 is the currently-signed-in user (read-only). Player 2 types their name.
3. Click **Deal cards**.

### Deck mechanic

- A standard 52-card deck is shuffled.
- 24 unique cards are dealt: **12 to Player 1, 12 to Player 2**. (The other 28 sit out.)
- Each round, the top 2 cards of each player's deck are revealed, forming a shared 4-card hand.
- **Solvability guarantee**: if the top-of-deck cards form an unsolvable hand (target 24), the dealer rotates Player 1's deck top→bottom until a solvable arrangement is found. Past 20 attempts it also rotates Player 2's deck. As a last resort it shuffles both decks. This is mostly invisible to users; you'll only notice ~10% of rounds re-shuffle once.
- After the round resolves:
  - **Winner**: all 4 cards (winner's contributed 2 + loser's contributed 2) are shuffled and added to the **bottom** of the winner's deck.
  - **Loser**: their contributed 2 cards are gone (transferred to winner). They lose 2 from the top.
  - **Push** (both bust): decks are unchanged. Cards stay at the top for next round? No — in this prototype, cards stay on the table for next round (next deal proceeds normally). In production you may want to recycle cards differently — this is a small design decision.

### Round flow

1. **Pre-round**: 4 cards appear on both halves of the screen with full UI. Each half shows a pulsing "Ready" button. **Both players must tap their Ready** to start the timer.
2. **Racing**: timers run on both sides independently. Each player taps cards + ops on their own half. Selection state is per-side (the two halves share the *card identities* but each tracks its own selected/reduced state).
3. **Round-over**: as soon as one player wins (reduces to 24), the round ends. The losing player's UI freezes. Both halves show an overlay:
   - Winner: "You win the round! / +4 cards" (royal-blue heading).
   - Loser: "You lose this round / −2 cards" (coral heading).
   - Push (both busted before either won): "Push. / Decks unchanged."
4. **Next round** button appears in the center band. Either player can tap it.
5. **Match over**: when a player's deck has fewer than 2 cards (can't contribute to the next round), the match ends. A modal shows the winner and round score, with **Rematch** or **Exit** options.

### Layout

The screen splits into 3 grid rows:

```
┌──────────────────────────────────────┐
│                                       │
│  Player 1's panel (rotated 180°)     │
│  - tile row, preview, op row         │
│  - header strip (name, wins, deck,   │
│    timer) at the top of the screen   │
│    (visually "facing" Player 1)      │
│                                       │
├──── center band (dark)  ─────────────┤
│  ROUND · 0 — 0 · MAKE 24             │
│  [Next round button when round over] │
├──────────────────────────────────────┤
│                                       │
│  Player 2's panel (normal)           │
│  - header strip (name, wins, deck,   │
│    timer)                             │
│  - tile row, preview, op row         │
│                                       │
└──────────────────────────────────────┘
```

The center band has a dark `--ink` background with pale-sky text. The scoreboard is large tabular-nums. **Either player can tap the Next round button** — its hitbox is in the shared center band, where both can reach.

### Implementation notes

- Selection state is two parallel arrays (one per player). The two halves share *card identities* via the same starting hand, but each tracks its own `tiles` (post-reduction state), `selected`, and `history`. See `playerStates` in `war.jsx`.
- Both timers reference the same `roundStartTs` — they freeze when their owner's phase transitions to `won` or `bust`, so the displayed time is the moment they finished.
- The "first to win" rule looks at each player's phase. If one is `won` and the other isn't, that player wins. If both reach `won` in the same render frame (extremely rare), the lower `endMs` wins as tiebreak.
- If both end up `bust` before either wins, the round is a push.

### Exit

A small `✕` button is top-right corner of the war stage. Tapping it returns to single-player mode. Match state is **lost on exit** in the prototype; production may want to save it so a player can resume later.

---

## Screens

### 1. Login

Full-screen overlay shown when no user is signed in.

- **Background**: white with a soft pale-sky radial gradient from top.
- **Card**: white, 1px hairline border, 28px radius, ~420px wide, drop shadow `--shadow-lg`, 40px/32px padding.
- **Mark**: 56×56 square, 16px radius, royal-blue background `#0000FF`, pale-sky `⚡` glyph centered. Below it the wordmark **FastMath52** (Archivo 900, ~38px, the `52` in royal blue).
- **Subtitle**: 15px Inter, `--ink-3`.
- **Two states**:
  - **No existing users on this device** → "Pick a name to save your times." + name input + primary "Start playing" button (royal blue, pill, white text, ALL CAPS).
  - **Existing users on this device** → "Who's playing?" + a stack of selectable rows (avatar + name + `→`) + ghost "+ New player" button.
- **Name input**: 18px Archivo 600, 14px padding, 14px radius, 1px hairline border that turns royal blue on focus with a 4px blue ring.
- Submitting on Enter is required.

### 2. Top bar (single-player game)

Three-column grid:

- **Left**: brand mark + wordmark "FastMath**52**" (the `52` in royal blue).
- **Center**: a pill button "**Make ⟨target⟩** ▾" — royal blue, white text, chevron in pale sky. Clicking opens the **Mode Picker** dropdown.
- **Right**: a flex row of:
  - **Timer** — Archivo 700, 22px, tabular nums, format `MM:SS.S`. Shows `READY` (gray 600, all-caps, letter-spaced) when no hand is in progress.
  - **2P button** (`fm-icon-btn-duel`) — small white button with the duel SVG icon + "2P" label. Hovers to pale-sky background. Opens the War-mode setup screen.
  - **Leaderboards icon button** — 36×36, hairline border, trophy SVG.
  - **User pill** — avatar (colored initial circle) + name (truncated to 12ch) + chevron. Click opens **User menu** popover.

#### Mode Picker dropdown
- Anchored to the target chip, 320px wide, drops down 8px below.
- White, 1px border, 20px radius, `--shadow-lg`, 160ms slide-down.
- Header eyebrow: `CHOOSE A MODE`.
- 8 rows: 36×36 royal-blue tile with card count, then mode label + sublabel ("Classic / 4 cards → 24"), then `✓` for current or `→` otherwise.

### 3. Game stage (single-player)

White background with a faint pale-sky radial gradient from the top. Centered column.

- **Card row** — flex row, centered, gap scales by viewport. Card aspect `5/7`, width scales by count via CSS `.fm-tiles.count-N` modifiers (~56px–200px). For higher counts (7–9), the row wraps; max content width 880px.
  - **Playing card style**: white background with faint vertical gradient, hairline border, rank in TL (Archivo 800, slight negative tracking), suit glyph below, big center suit (~50% of card height), mirrored rank+suit in BR rotated 180°. Red suits (`♥ ♦`) are `#C8102E`, black suits are `--ink`.
  - **Minimal style** (tweak): just the rank, no suit center.
  - **Result tile**: pale-sky gradient, 1px blue-tinted inner border. Big value (Archivo 900, royal-blue-ink, fraction-aware), small mono caption of expression below.
  - **Selected**: 8px up, 3px royal-blue ring, shadow-blue tint.
  - **Tap-order badge**: 26px circle with `①` or `②` in top-left of selected cards. 200ms scale pop.
  - **Final win state**: single remaining tile replaced with a royal-blue gradient "win" tile, pops to 1.15× scale.

- **Live expression preview** — a pill below the card row.
  - Empty: "Tap two cards" (eyebrow style, gray).
  - 1 selected: `[a] ? ?` with unknowns muted.
  - 2 selected: `[a] ⇆ [b]` (mono) with a circular swap button between them. Hover → rotates 180°.

- **Action area** (changes by phase):
  - **Ready**: primary "Solve ↵" pill button + ghost "Re-deal".
  - **Playing**: row of 4 op buttons (+, −, ×, ÷), ~70px square, 18px radius. Disabled (low opacity) when fewer than 2 cards selected; once 2 selected they wake to royal-blue filled with a brief scale-up animation. Secondary row: Undo (ghost), Restart hand (ghost, disabled until a move).
  - **Won/Bust**: see *Result panel* below.

- **Footer**: 11.5px caption — "Tap two cards · then an operation. Keys: 1–4, + − * /, S(wap), U(ndo), Esc."

### 4. Result panel (Won)

Stacked, centered.

- Title: "You got ⟨target⟩." (Archivo 800, ~28px, royal blue).
- Time: huge royal-blue numeric, Archivo 800, ~80px desktop, tabular nums.
- Expression chip: full reduction expression in monospace gray, in a paper-tone pill.
- **Qualify progress** chip — see *Qualify progress* below.
- **Win leaderboard** — top 5 for this combo, your row highlighted. If you're not in the top 5, a "···" gap appears and your row is appended. The just-set entry flashes gold (`--alpha-sun`) for ~1.2s.
- Primary "Next hand ↵" button at bottom.

### 4b. Result panel (Bust)

- Title: "That's ⟨result⟩, not ⟨target⟩." (Archivo 800, ~28px, danger red).
- Final expression chip.
- **"No retry · This hand is locked. Deal a new one."** message in a coral-tinted card.
- Primary "Next hand ↵" button. **No Undo.**

### 5. Qualify progress chip

Shown on the Win screen (full-width) and at the top of the Players → Fastest 10 section (compact) in the modal.

- 10 small horizontal pip-pills, gap 6px, each 22×10 (compact 16×7). Filled pips royal blue; unfilled pale-sky tint.
- Text below:
  - Not qualified, N>1 to go: "**N more** ⟨Mode⟩ hands to qualify · X/10"
  - Not qualified, 1 to go: "**1 more** ⟨Mode⟩ hand to qualify for the fastest-10 board"
  - Qualified: "✓ **Qualified.** ⟨Mode⟩ fastest-10 avg **MM:SS.S**" — pips animate a slow color shimmer.
- Background: pale-sky 50 with a faint blue border; qualified state uses a subtle blue gradient.

The metric is `distinct combos solved (first-try) in the selected mode`. Qualification is per-mode.

### 6. Leaderboards modal

Triggered by the trophy icon. Full-screen overlay (50% blackout + 4px backdrop blur). 560px max, 28px radius, white. Slide-in + fade.

- Header: title "Leaderboards" + close ✕.
- **Top tabs**: `Players` (default) | `Hands ⟨count⟩`.
- **Mode filter row** — chips for `All modes` plus one chip per mode that has any entries. The current mode is auto-selected when the modal opens. Active chip: solid royal blue.

#### Players tab
Two stacked sections:

1. **Most solved** — sorted by `distinctCombos` desc, tiebreak by `fastest10Avg` asc. Rows: rank/medal + avatar + name + big number (Archivo 800) + unit ("hand"/"hands"). Your row tinted pale-sky.
2. **Fastest 10 — avg** — sorted by `fastest10Avg` asc, only users with 10+ solves appear. Below them, a divider "WORKING TOWARD 10" and a muted list of users with 1–9 solves showing their partial avg and `X/10`. Compact qualify-progress chip appears at the top of this section when a specific mode is selected.

#### Hands tab
Sub-chips: `All` / `Yours`. Then a list of combo rows: MiniCards + best time + name + target badge (`→ 24`) + stats line + `→` arrow. Current combo gets a 2px royal-blue ring.

Clicking a combo row drills into a **combo detail** view: big MiniCards + eyebrow "⟨Mode⟩ · make ⟨target⟩" + "Top times" + full ranked list with names, times, and the actual reduction expressions used.

### 7. User menu

Anchored below the user pill, 220px wide, 14px radius, white, 1px border, `--shadow-lg`, ~160ms slide-in. Header: 32px avatar + name + "Signed in" sub. Two items: "⇄ Switch player" and "⏏ Sign out". Both just sign out and re-show the login picker.

### 8. Tweaks panel

Floating panel toggled from the host toolbar. Dev/playtest surface — most options belong in real user settings.
- **Cards**: Style (`playing` / `minimal`), Face cards (`on` / `off`), Smart deal toggle.
- **Display**: Live expression toggle, Show solution hint toggle.

### 9. War mode — Setup card

Full-screen overlay with a centered card (max 500px, 36px padding, 28px radius).

- Eyebrow: `HEADS-UP`.
- Title: "Duel for the deck." (Archivo 900, ~38px).
- Subtitle: "Each player starts with 12 cards. Every round you each play your top 2. First to make 24 takes all four cards. Game ends when someone has zero."
- Two rows:
  - "PLAYER 1" label + the current user's name (display-only).
  - "PLAYER 2" label + name input (auto-focused).
- Actions: ghost "Cancel" + primary "Deal cards ↵".

### 10. War mode — Match stage

Grid `1fr auto 1fr` rows.

- **Player panels** (top and bottom): each contains header (name, wins, deck visual + count, timer), tile row, preview line, ops row. Top panel rotated 180° via `transform: rotate(180deg)`.
- **Win/lost background tint**: panel background fades to pale-sky (win) or pale-coral (loss) when the round resolves.
- **Center band**: dark `--ink` background, pale-sky text. Layout: left "ROUND · 0 — 0", right "MAKE 24" eyebrow. In round-over state, a primary white pill "Next round" button appears centered.
- **Exit button**: tiny `✕` in top-right corner of the stage.

### 11. War mode — Overlays

In each player panel, a same-panel overlay covers the UI in two states:

- **Pre-round**: pulsing royal-blue "READY" button (Archivo 800, 24px, 0.08em tracking, ALL CAPS). Once tapped, replaces with "WAITING FOR OPPONENT…" eyebrow text. Both ready → overlays disappear → racing begins.
- **Round-over**:
  - Winner: "You win the round! / +4 cards" — 28px Archivo 900 in royal blue + smaller uppercase sub.
  - Loser: same layout but coral.
  - Push: muted gray, "Push. / Decks unchanged."

Both overlays are 88% white + 6px backdrop blur.

### 12. War mode — Match over

Centered modal over a 60% blackout + blur. White card, 40px padding, ~520px wide.

- Eyebrow: `MATCH OVER`.
- Title: "⟨name⟩ takes the deck." (Archivo 900, ~38px, royal blue).
- Score row: `Player1: N rounds   Player2: M rounds` in a centered flex with tabular nums.
- Actions: ghost "Exit duel" + primary "Rematch".

---

## Interactions & behavior

### Single-player selection state machine

```
selected: [] | [aId] | [aId, bId]

tap unselected tile:
  len < 2 → append
  len == 2 → replace bId (slot 2)

tap selected tile → remove from selection

tap op:
  only enabled when len == 2
  commits: apply(op, a, b) → new result tile
  if divide-by-zero → silent no-op (or animation flash on the preview)
  after commit: selected → []
  if tiles.length == 1 → check eqTarget; transition to Won or Bust
```

### Phase transitions (single hand)

```
Ready ──Solve──▶ Playing
Playing ──reduce to 1 tile == target──▶ Won
Playing ──reduce to 1 tile != target──▶ Bust
Won/Bust ──Next hand──▶ Ready (new deal)
```

From **Won** or **Bust**, **Undo is disabled.**

### War phase machine

```
Setup ──Deal──▶ PreRound
PreRound ──both Ready──▶ Racing
Racing ──first player to Won──▶ RoundOver(winner=X)
Racing ──both Bust──▶ RoundOver(winner=push)
RoundOver ──Next round (next deal)──▶ PreRound
RoundOver ──deck < 2──▶ MatchOver
```

### Animations & easing

- Standard easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Content reveal: `cubic-bezier(0.33, 1, 0.68, 1)`.
- Durations: 150ms (UI), 240ms (panels/modals), 480ms (content).
- Card hover: −3px translate.
- Card selected: −8px translate, 3px royal-blue ring, shadow-blue tint.
- Op-wake: 280ms ease-soft scale 0.92→1 with shadow gain.
- Modal in: 220ms fade + 8px lift + 0.98→1 scale.
- Just-set leaderboard row: gold→pale-sky background flash, 1200ms ease-soft.
- Qualify-progress shimmer (qualified state): slow color shift on pips, 1400ms loop.
- War Ready button pulse: scale 1↔1.05, 1400ms ease-soft infinite.
- War overlay-in: 200ms fade + blur ramp.

### Responsiveness

- Desktop ≥ 1024px: roomy, 1200px content max.
- Tablet (640–1024px): same layout, slightly smaller type and chips.
- Mobile ≤ 520px:
  - User pill collapses to avatar only.
  - Smaller header padding/type.
  - Cards shrink and wrap.
  - Modal padding tightens.
- War short-height (`max-height: 560px`): tiles and ops shrink, center band tightens.

### Multi-user on one device

All sign-ins live in the same localStorage record. Switching users is a one-tap action via the menu → back to login picker → choose name. Names are case-insensitive deduplicated on creation.

---

## Data model

The prototype's localStorage record under key `fm24:v1`:

```ts
type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { rank: 1..13, suit: Suit };

type User = {
  id: string;            // 'u_' + random
  name: string;
  createdAt: number;     // epoch ms
};

type Solve = {
  userId: string;
  combo: string;         // "<mode>-<target>-<sorted ranks CSV>"
  timeMs: number;
  expr: string;          // reduction expression as a string
  when: number;          // epoch ms
};

type State = {
  users: Record<string, User>;
  currentUserId: string | null;
  solves: Solve[];
};
```

War state is **ephemeral** in the prototype — held in React state only, lost on exit/refresh. Production may want to persist match-in-progress.

### Leaderboard derivations

- **Per-combo leaderboard**: for a combo key, group `solves` by `userId`, keep each user's fastest, sort asc by `timeMs`.
- **User's distinct combos solved** for mode M: filter solves by `userId` AND `parseCombo(combo).mode === M`, then count distinct combos.
- **User's fastest-10 avg** for mode M: same filter; group to best-per-combo; sort by `timeMs` asc; take first 10; mean of `timeMs`. Qualifies iff that group ≥ 10.

A user **qualifies** for the Fastest-10 board in mode M when they have solved 10 distinct combos in M (first-try). Partial users appear in a secondary "working toward 10" list with their partial avg and progress.

### Most-solved board

For each user, count distinct combo keys solved in the selected mode (or across all modes if filter is `All`). Sort desc; tiebreak by `fastest10Avg` asc.

---

## Design tokens

Defined in `design/styles/tokens.css`. Port these to the target codebase's token layer.

### Color

| Token | Value | Use |
|---|---|---|
| `--alpha-blue` | `#0000FF` | Primary CTA, selected ring, target chip, brand `52` |
| `--alpha-blue-600` | `#1212E6` | Primary hover |
| `--alpha-blue-700` | `#0A0AB8` | Primary pressed, picker active count tile |
| `--alpha-blue-ink` | `#000066` | Ink on pale-sky surfaces (result tile value) |
| `--alpha-sky` | `#CFE5FF` | Pale-sky for icons on blue, target eyebrow, center-band text |
| `--alpha-sky-soft` | `#E6F0FF` | Tinted surfaces, result tile background |
| `--alpha-sky-50` | `#F4F8FF` | Off-white wash, top-of-page radial gradient |
| `--alpha-sun` | `#FFD24A` | Just-set leaderboard row flash |
| `--alpha-coral` | `#FF7A59` | Reserved |
| `--ink` | `#0B0B10` | Primary text; war center band |
| `--ink-2` | `#2A2A33` | Secondary text |
| `--ink-3` | `#4A4A55` | Tertiary text |
| `--ink-4` | `#6B6B76` | Muted text, captions |
| `--line` | `#E4E4EA` | Hairlines |
| `--line-2` | `#EFEFF3` | Subtler hairlines |
| `--paper` | `#FFFFFF` | Main surface |
| `--paper-2` | `#FAFAF7` | Warm off-white card |
| `--danger` | `#C41E3A` | Error flash |
| Red suit | `#C8102E` | Hearts/Diamonds glyphs |
| Bust title | `#B83A1E` | Bust messaging, loser overlay |

### Typography

- **Display**: `Archivo` (Google Fonts, weights 400/500/600/700/800/900).
- **Body**: `Inter` (400/500/600/700).
- **Mono**: system mono via `ui-monospace, 'SF Mono', Menlo`.
- **Editorial accent**: `Instrument Serif Italic` (reserved).

Scale:
- H1: `clamp(44px, 6.4vw, 92px)`, 800, −0.035em, line-height 1.02.
- H2: `clamp(36px, 4.4vw, 64px)`, 800, −0.03em.
- H3: `clamp(26px, 2.6vw, 36px)`, 700.
- Eyebrow: 13px, 700, +0.14em, ALL-CAPS.
- Body: 17px / 1.5, −0.005em.

### Radii

`--r-xs: 4px`, `--r-sm: 8px`, `--r-md: 14px`, `--r-lg: 20px`, `--r-xl: 28px`, `--r-2xl: 40px`, `--r-pill: 999px`.

### Spacing

`4, 8, 12, 16, 24, 32, 48, 64, 96, 128` px (tokens `--s-1` … `--s-10`).

### Shadows

- `--shadow-sm`: `0 1px 2px rgba(11,11,16,0.05)` — cards at rest.
- `--shadow-md`: `0 4px 14px rgba(11,11,16,0.08)` — card hover.
- `--shadow-lg`: `0 18px 40px rgba(11,11,16,0.10)` — modals, popovers.
- `--shadow-blue`: `0 12px 30px rgba(0,0,255,0.18)` — primary CTAs, selected card lift, active op buttons.

### Motion

- `--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1)`
- `--ease-soft: cubic-bezier(0.33, 1, 0.68, 1)`
- `--dur-fast: 150ms`, `--dur-base: 240ms`, `--dur-slow: 480ms`.

---

## Production architecture notes

The prototype uses **localStorage** for everything. Production needs a real backend for two reasons:

1. **Cross-device leaderboards.** Two students on different devices in the same room should see each other on the Most-solved and Fastest-10 boards.
2. **Cross-device War mode** (stretch). The prototype's War mode is same-device only. If you want students on separate devices to duel each other, the server needs to coordinate.

### Suggested backend shape

```
POST   /sessions                    → { token, user }       // sign-in / create-by-name
GET    /me                          → User
PATCH  /me                          → User                   // rename
POST   /solves                      → Solve
  body: { combo, timeMs, expr }
  server-side: parse combo → (mode, target, ranks)
               re-evaluate expr with rational arithmetic; verify it equals target
               sanity-bound timeMs (e.g. > 200ms, < 10min); reject otherwise
               write into solves table
GET    /leaderboards/combo/:combo   → { entries: SolveWithUser[] }
GET    /leaderboards/players?mode=  → { mostSolved: [], fastest10: [], partial: [] }
GET    /me/stats?mode=              → { distinctCombos, fastest10Avg, fastest10Count, ... }
```

For cross-device War mode:

```
WS /duel
  client sends:
    { type: 'create' } → server returns { code, roomId }
    { type: 'join', code }
    { type: 'ready' }
    { type: 'tap', tile }            // optional: stream taps for live "ghost" view of opponent
    { type: 'op', op }
    { type: 'won', timeMs, expr }
    { type: 'bust' }
  server broadcasts:
    { type: 'roomState', ... }       // both players' state, current hand
    { type: 'roundResolved', winner, ... }
    { type: 'matchEnded', winner, score }
```

Server holds authoritative deck state, hands out the next hand each round (smart-deal validated), and decides the winner by comparing `won` timestamps.

### Schema sketch

```sql
users(id pk, name text, created_at timestamptz, ...auth fields)
solves(id pk, user_id fk, combo text, time_ms int, expr text, won_at timestamptz)
  index (combo)
  index (user_id, combo)             -- for best-per-(user,combo) queries
  index (user_id, won_at)
duel_matches(id pk, code text, p1_id fk, p2_id fk, started_at, ended_at, winner_id fk)
duel_rounds(id pk, match_id fk, round_no int, combo text, target int,
            p1_tap_ms int, p1_phase, p1_expr, p1_won_ms,
            p2_tap_ms int, p2_phase, p2_expr, p2_won_ms, winner_p int)
```

The Most-solved and Fastest-10 leaderboards are read-heavy; cache aggressively (per-mode, per-day, per-classroom).

---

## Open questions for the customer

Worth confirming before implementation:

1. **Account model.** Name-only sign-in in production, or real auth (email + password / SSO)? Affects schema.
2. **Scope of leaderboards.** One classroom, school-wide, or global?
3. **Daily resets.** Yes/no/configurable filter?
4. **War mode reach.** Same-device only (as prototyped) or also cross-device real-time? Affects backend complexity meaningfully.
5. **Brand fonts.** Real Alpha-School-house fonts or stick with Archivo + Inter substitutes?
6. **Accessibility.** Keyboard works for single-player. Add `aria-live` for time announcements? Color contrast for color-blind students (red suits + blue selection)? Voice-over labels for the rotated half in War?
7. **Solver budget.** The 600ms variable-target dealer budget is set client-side. Move to server with a stricter budget?

---

## Roadmap items intentionally NOT shipped in the prototype

- **Cross-device War rooms.** Same-device split-screen is implemented; cross-device requires a backend WebSocket.
- **Across-mode aggregate leaderboards.** The Players tab currently filters by mode. A "All modes combined" normalized ranking could be added.
- **Daily filter.** "Today only" filter on leaderboards for classroom playtesting.
- **Audio.** None in the prototype. A soft tick on op-commit and a chime on win would be welcome.
- **Solve replay.** Re-play a saved solve from the expression string — would be a nice teacher-facing feature for instruction.

---

## File guide

```
design/
├── FastMath52.html         Main entry. All CSS in <style>, script tags wire up the rest.
├── styles/tokens.css       Design tokens (colors, type, spacing, radii, shadows, motion).
├── solver.js               Rational arithmetic; modes table; solvability check;
│                           smart deal; achievable-value enumeration for variable-target modes.
├── store.js                localStorage-backed user + solve store; combo canonicalization;
│                           leaderboard derivations; per-user stats.
├── auth.jsx                LoginScreen, UserPill, UserMenu, Avatar.
├── leaderboard.jsx         MiniCards, LeaderboardRow, WinLeaderboard,
│                           LeaderboardsModal, PlayersView, QualifyProgress.
├── war.jsx                 Heads-up Duel: WarSetup, WarPanel, WarMode.
├── app.jsx                 Main game: state machine, card/op/preview UI, ModePicker,
│                           header, win/bust panels, mounts WarMode when active.
└── tweaks-panel.jsx        Generic tweaks UI scaffold (dev-time controls). Optional in production.
```

The script load order in `FastMath52.html` matters; recreate it correctly:

```
React 18 + ReactDOM 18 + Babel standalone (pinned with integrity hashes)
  ↓
solver.js (vanilla)
  ↓
store.js (vanilla)
  ↓
tweaks-panel.jsx
  ↓
auth.jsx        ← publishes Avatar, LoginScreen, UserPill, UserMenu on window
  ↓
leaderboard.jsx ← publishes MiniCards, LeaderboardRow, WinLeaderboard,
                  LeaderboardsModal, PlayersView, QualifyProgress
  ↓
war.jsx         ← publishes WarMode
  ↓
app.jsx         ← main App; calls ReactDOM.createRoot(...).render(<App />)
```

In a modern build pipeline this all collapses into proper module imports; the prototype's `<script type="text/babel">` + window-exports pattern is a no-build prototyping convenience.

---

*Built with the Alpha Toronto Parents Hub design system. Visual DNA: deep royal blue, pale sky, generous editorial spacing, Archivo display + Inter body.*

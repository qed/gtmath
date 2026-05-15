# War Mode — Cross-Device 2P Duel (Design Spike)

**Date**: 2026-05-15
**Status**: Planning
**Scope**: Phase 3

## Overview

War mode is a heads-up duel between two players on separate devices. Each player gets 12 cards from a shared 52-card deck. Each round, the top 2 cards from each player form a shared 4-card hand. Both players race to make 24 — the first to solve wins the round and takes all 4 cards. Match ends when a player has fewer than 2 cards.

**Critical constraint**: War mode is ALWAYS cross-device. Same-device split-screen is permanently out of scope.

## Game Rules (from prototype `war.jsx`)

- **Deck**: Standard 52 cards shuffled, 12 each (24 used, 28 reserved)
- **Each round**: Top 2 from each player → 4-card hand, target = 24
- **Solvability check**: Rotate deck cards if the initial 4 aren't solvable (up to 40 tries)
- **Winner**: First to correctly make 24 takes all 4 cards to deck bottom
- **Match end**: Player with < 2 cards loses
- **No retry on bust**: Same as solo — wrong answer locks you out for that round
- **Independent selection**: Each player has their own selection state (tap-to-select, operator application)

## Architecture Decision: Transport

### Option A: Supabase Realtime (Recommended)

Uses Supabase's built-in Presence + Broadcast channels.

**Pros**:
- Already in our stack, no new infra
- Presence handles online/offline tracking natively
- Broadcast handles message passing at <100ms latency
- RLS integration — can scope channels to authenticated users
- Free tier covers ~200 concurrent connections

**Cons**:
- ~100-200ms P95 latency (acceptable for card game, not for twitch)
- Limited message size (but our payloads are tiny)
- Less control over reconnection logic

### Option B: Custom WebSocket via Vercel Functions

**Pros**:
- Full control over protocol and reconnection
- Sub-50ms latency possible

**Cons**:
- Vercel Functions are stateless — need external state (Redis/Supabase) anyway
- Significant additional complexity for marginal latency improvement
- Have to build presence, heartbeat, reconnection from scratch

**Recommendation**: Option A. Supabase Realtime is sufficient for a card game (not a twitch shooter). Latency under 200ms is fine when the bottleneck is human thinking time (seconds).

## Data Model

### New Tables

```sql
CREATE TABLE war_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           -- 6-char join code (e.g., "MATH42")
  host_id UUID NOT NULL REFERENCES children(id),
  guest_id UUID REFERENCES children(id),
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting | playing | finished
  winner_id UUID REFERENCES children(id),
  rounds_played INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE war_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES war_matches(id),
  round_num INT NOT NULL,
  cards JSONB NOT NULL,                -- the 4-card hand
  winner_id UUID REFERENCES children(id),  -- NULL if bust-bust draw
  winning_expr TEXT,
  winning_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Join Flow

1. Host creates match → gets 6-char code (displayed on screen)
2. Guest enters code → joins match
3. Both subscribe to Supabase Realtime channel `war:{match_id}`
4. Server shuffles deck, assigns 12 cards each
5. Each round dealt from server (authoritative deck state)

## Realtime Protocol

Channel: `war:{match_id}`

### Messages (Broadcast)

| Event | Sender | Payload | Description |
|-------|--------|---------|-------------|
| `joined` | Server | `{ guest_id, guest_name }` | Guest joined, match starts |
| `round_start` | Server | `{ round, cards[], target }` | New round dealt |
| `solve_attempt` | Player | `{ player_id, expression }` | Player submits solution |
| `round_result` | Server | `{ winner_id, expression, time_ms }` | Round resolved |
| `bust` | Player | `{ player_id }` | Player busted |
| `match_end` | Server | `{ winner_id, rounds_played }` | Match over |
| `disconnect` | System | `{ player_id }` | Player dropped |

### Presence

Track `{ player_id, name, deck_count, status }` — UI shows opponent's card count and online state.

## Server-Side Authority

All game state lives on the server to prevent cheating:

1. **Deck state** stored in `war_matches.state` JSONB column (deck arrays, current round cards)
2. **Round dealing** via server function — client never sees opponent's deck
3. **Solve verification** uses existing `verify()` — server validates expression before broadcasting result
4. **Time stamping** at server — client sends `solve_attempt`, server records `time_ms` relative to `round_start`

## API Endpoints

```
POST /api/war/create     → { matchId, code }
POST /api/war/join       → { matchId, match }
POST /api/war/solve      → { result }
GET  /api/war/match/:id  → { match state }
```

## UI Components

- **`/war` page** — Create or join match (code input)
- **`/war/[id]` page** — Match view (waiting room → game → result)
- **War game panel** — Simplified version of play page (4 cards always, target always 24, timer shows opponent's time too)
- **Opponent indicator** — Card count, online status, "solving..." indicator

## Disconnect Handling

- 30-second grace period on disconnect
- Presence-based detection (Supabase Realtime handles heartbeat)
- If player doesn't reconnect within grace period, opponent wins the match
- If both disconnect, match is abandoned

## HB Economy

- **Winner earns**: 50 HB per match won
- **Participation**: 10 HB per round played (win or lose)
- **No speed bonus**: War mode rewards accuracy, not raw speed (already racing opponent)
- **No streak multiplier**: War HB are flat to keep it simple

## Phasing

1. **Phase 3a**: Core war flow — create, join, play rounds, basic UI
2. **Phase 3b**: Polish — animations, sound, rematch button, spectator mode
3. **Phase 3c**: Matchmaking — random opponent queue, ELO-style rating

## Open Questions

1. **Should we allow rematches?** (Likely yes — button at match end)
2. **Spectator mode for classroom?** (Teacher projects one screen showing both players)
3. **Timer per round?** (e.g., 2 minutes — if neither solves, draw and deal next)
4. **What if both bust?** (Draw — cards go to discard pile, neither gets them)

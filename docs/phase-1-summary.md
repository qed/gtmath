# GTMath Phase 1 — What We Built

## In Plain English

GTMath is a math card game where kids get dealt cards and have to combine them using +, −, ×, ÷ to hit a target number.

### For kids

- They log in with a PIN (no email or password — keeps it COPPA-safe for under-13s)
- They pick a difficulty mode (2–5 cards) and get dealt a solvable hand
- They tap two cards, pick an operation, and the cards merge into a result — repeat until one number is left
- If it matches the target, they earn Home Bucks (HB). If not, they're bust — no retries
- Harder modes and play streaks earn more HB. Their balance grows 0.1% overnight like a savings account

### For parents

- Sign in with a magic email link (no password to remember)
- See a dashboard with each child's stats: total solves, current streak, HB balance, milestone badges (Bronze at 100, Silver at 500, Gold at 2000)
- Can add new children and manage their accounts
- A second parent can be invited as a partner to share access

### Under the hood

- The server double-checks every solve so kids can't cheat
- Each child's data is locked down — they can only see their own stuff, and parents can only see their own kids
- The whole thing runs on Supabase (database), Vercel (hosting), and Next.js (app framework)

---

## Technical Summary

### Database (Supabase Postgres)

| Table | Purpose |
|-------|---------|
| `children` | Child profiles — name, PIN hash, tutorial flag |
| `parent_children` | Junction table — links parents to children with role (primary/partner) |
| `solves` | One row per verified solve — mode, target, combo, time, HB earned |
| `hb_transactions` | Append-only ledger — EARN, COMPOUND, SPEED_BONUS, STREAK_BONUS |
| `daily_activity` | Streak tracking — one row per child per active day |
| `config` | Tunable parameters — compounding rate, speed bonus thresholds, milestones |

**Key database functions:**

- `create_child(parent_id, name, pin_hash)` — Atomic child creation with parent link in one transaction
- `record_solve(child_id, mode, target, combo, time_ms, expression, offline)` — Atomic solve recording with advisory lock, HB calculation, and streak bonus (+10%/day, capped at +50%)
- `compound_daily()` — Applies 0.1% daily compounding to all positive balances, scheduled via pg_cron at midnight UTC
- `cleanup_orphan_children()` — Trigger that deletes a child when their last parent link is removed

**Row Level Security (RLS):**

- Children read their own data via custom JWT claim (`child_id`)
- Parents read/write their linked children via `parent_children` junction table
- Primary parents can invite up to 2 partners per child
- Config table is readable by all authenticated users

### API Routes (Next.js App Router)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/child-login` | POST | Validates child ID + 4-digit PIN, mints custom JWT, sets httpOnly cookie |
| `/api/auth/callback` | GET | Exchanges Supabase magic link code for parent session |
| `/api/children` | GET | Returns parent's children with HB balance, solve count, streak, unlocked modes |
| `/api/children` | POST | Creates a new child with bcrypt-hashed PIN |
| `/api/solve` | POST | Verifies child JWT, runs server-side expression verification, calls `record_solve()` |

### Pages

| Path | Who | What |
|------|-----|------|
| `/` | Everyone | Landing page with Play and Parent sign-in buttons |
| `/login` | Parents | Magic link email form |
| `/dashboard` | Parents | Child cards with stats, milestones, mode progress, add child form |
| `/pin` | Kids | Child selection + custom 3x4 keypad for PIN entry |
| `/play` | Kids | Full game — card tiles, operator bar, swap, undo, timer, mode picker (2–5) |

### Core Libraries

| File | Purpose |
|------|---------|
| `src/lib/solver.ts` | Rational arithmetic engine (`{n, d}` fractions), solvability checker, smart dealer with retry, achievable value enumeration for variable-target modes |
| `src/lib/verify.ts` | Server-side expression verification — recursive descent parser, rational arithmetic eval, card rank validation |
| `src/lib/jwt.ts` | Custom child JWT — mint and verify using `jose` (edge-compatible, no Node.js crypto dependency) |
| `src/lib/types.ts` | Shared TypeScript types — Card, Tile, Mode, Deal, SolvePayload, SolveResult, ChildProfile |
| `src/lib/supabase/server.ts` | Server-side Supabase clients (cookie-based + service role) |
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/middleware.ts` | Session refresh and auth redirect logic |
| `src/proxy.ts` | Next.js 16 proxy (middleware) — protects `/dashboard`, `/play`, `/pin` |

### Game Modes (Phase 1 ships 2–5)

| Mode | Name | Cards | Target |
|------|------|-------|--------|
| 2 | Quick | 2 | 6 |
| 3 | Speed | 3 | 12 |
| 4 | Classic | 4 | 24 |
| 5 | Combo | 5 | 72 |

Mode 2 is unlocked by default. Each subsequent mode requires 5 solves in the previous mode.

### Home Bucks Economy

- **Base earn:** mode number × 5 HB per solve (e.g., Mode 4 = 20 HB)
- **Streak bonus:** +10% per consecutive day, capped at +50%
- **Daily compounding:** 0.1% applied to all positive balances at midnight UTC
- **Milestones:** Bronze (100 HB), Silver (500 HB), Gold (2,000 HB)

### Infrastructure

- **Hosting:** Vercel (https://gtmath-helix3.vercel.app)
- **Database:** Supabase Postgres with RLS
- **Auth:** Supabase Auth for parents (magic link), custom JWT for children (COPPA)
- **Scheduling:** pg_cron for daily compounding
- **Repo:** github.com/qed/gtmath (private)

---

## What's Not in Phase 1

- Modes 6–9 (Power, Master, Wild — variable targets, 6–9 cards)
- Cross-device War mode (2-player duel)
- Leaderboards
- Speed bonus awards
- Offline solve sync
- Custom domain

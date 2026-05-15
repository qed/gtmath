# GTMath Roadmap

Target audience: ~50 Alpha School students for classroom playtesting, expanding to broader Alpha School use.

## Phase 1 — Core Game (SHIPPED 2026-05-15)

The playable foundation. Kids can log in and play, parents can manage accounts.

| Feature | Status |
|---------|--------|
| Next.js 16 + Supabase + Vercel stack | Done |
| Parent magic link auth | Done |
| Child PIN login (custom JWT, COPPA-safe) | Done |
| Parent dashboard (child cards, stats, milestones) | Done |
| Play page with pairwise reduction game mechanic | Done |
| Modes 2-5 (Quick, Speed, Classic, Combo) | Done |
| Smart dealer (solvability-checked hands) | Done |
| Server-side expression verification | Done |
| Home Bucks economy (earn, streak bonus, daily compounding) | Done |
| RLS policies (child/parent data isolation) | Done |
| Rational arithmetic engine (no float drift) | Done |
| DB migrations + pg_cron for daily compounding | Done |

**Live at:** https://gtmath-helix3.vercel.app

---

## Phase 2 — Classroom Ready

Make it competitive and polished enough for 50 students to use daily in a classroom.

| Feature | Description | Priority |
|---------|-------------|----------|
| Design polish | Port prototype's card styles, animations, colors, typography to production. The prototype is high-fidelity; production is functional but minimal. | High |
| Leaderboards | Per-mode rankings: most combos solved, fastest times. New API routes + leaderboard page. Drives classroom competition. | High |
| Speed bonus | Award extra HB for solving faster than the median time per mode. Config exists in DB (`speed_bonus_threshold`, `speed_bonus_amount`) but logic isn't wired up. | High |
| Modes 6-9 | Power (7 cards, 300-500), Master (8 cards, 501-999), Wild (9 cards, 1000-9999). Solver already supports them. Needs UI for variable targets + unlock gating. | Medium |
| Mode unlock UX | Visual progress indicator showing "5 solves in Mode N-1 to unlock Mode N". Currently tracked in API but not surfaced clearly. | Medium |
| Daily leaderboard filter | "Today only" filter for classroom playtesting — see who's solving the most right now. | Medium |
| CLAUDE.md update | Project overview still says "production app has not yet been built." Needs refresh. | Low |

---

## Phase 3 — Engagement and Parents

Keep students coming back and give parents visibility into learning outcomes.

| Feature | Description | Priority |
|---------|-------------|----------|
| War mode (cross-device) | 2-player duel via Supabase Realtime or WebSocket. Matchmaking, round flow, card pool management. The prototype has same-device split-screen as reference. | High |
| Shareable progress card | Server-rendered image (OG image) showing child's name, days active, modes reached, solve count, HB balance. URL contains UUID, not guessable. Parent can share it. | Medium |
| Weekly email digest | Monday email to parents summarizing child's game activity for the week. Requires email service integration (Resend or similar). | Medium |
| Learning outcomes on parent dashboard | Surface explicit pedagogical data: which operations the child is strong/weak at, speed trends over time, difficulty progression. Not just game stats. | Medium |
| Aggregate leaderboards | "All modes combined" normalized ranking across the school. | Low |
| Audio | Soft tick on operation commit, chime on win. No audio exists currently. | Low |

---

## Phase 4 — Scale and Polish

Production hardening for broader Alpha School use beyond one classroom.

| Feature | Description | Priority |
|---------|-------------|----------|
| Offline solve sync | Queue solves when offline (service worker), sync when back online. Solves marked `offline: true` skip streak bonus. Schema already supports this. | Medium |
| Solve replay | Re-play a saved solve from the expression string. Teacher-facing feature for instruction — show how a student solved a particular hand. | Medium |
| Custom domain | Point a real domain at Vercel instead of gtmath-helix3.vercel.app. | Medium |
| Accessibility | `aria-live` for time announcements, color contrast for color-blind students, keyboard navigation refinements. | Medium |
| Multi-classroom support | Teacher accounts, classroom grouping, class-level leaderboards. | Low |
| Brand fonts | Decide: real Alpha School fonts or keep Archivo + Inter substitutes. | Low |

---

## Open Questions

These need decisions before or during the relevant phase:

1. **Solver budget** — The 600ms variable-target dealer budget is client-side. Move to server with a stricter budget for modes 7-9?
2. **War mode transport** — Supabase Realtime (simpler, built-in) vs. dedicated WebSocket (lower latency)?
3. **School-use COPPA exception** — Does Alpha School's direct relationship with students qualify for the school-use exception under COPPA, simplifying consent requirements?
4. **Magic link sufficiency** — Is magic link email sufficient as "verified parental consent" under COPPA, or do we need additional verification?
5. **Privacy policy** — Formal privacy policy needed before broader rollout. What's the timeline?
6. **Progress card PII** — Does showing a child's first name + stats on a shareable URL constitute PII disclosure? Legal review needed.

---

## Key Constraints

- **COPPA compliance**: Children under 13 have no email, no Supabase Auth identity. All child auth is PIN + custom JWT.
- **Effort-based earning**: HB economy must reward active solving, not passive income. Compounding (0.1%/day) is intentionally tiny.
- **War mode is always cross-device**: Same-device split-screen is permanently out of scope for production (confirmed product decision).
- **Design fidelity**: The prototype in `artifacts/design_handoff_fastmath52/design/` is the visual reference. Production should match it pixel-faithfully.

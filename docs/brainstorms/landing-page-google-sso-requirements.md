---
date: 2026-05-15
topic: landing-page-google-sso
---

# Landing Page Redesign & Google SSO Auth

## Problem Frame

The current landing page is a generic splash with two buttons (Play / Parent sign-in) that doesn't communicate what GT Math is or who it's for. The auth flow uses parent magic links + child PINs, which adds friction and doesn't match the school's infrastructure — GT/Alpha students already have `@gt.school` Google accounts. The entry experience needs to be streamlined for students while clearly positioning the product.

## Requirements

**Landing Page**

- R1. The landing page displays the brand name "GT Math" prominently with the tagline: "Practice Fast Math. Climb Leaderboards. Earn Home Bucks and Learn Financial Literacy."
- R2. The primary call-to-action is "Join with your Alpha or GT email address" leading to Google SSO, with context text: "For existing Alpha or GT Students".
- R3. A "For Parents" section is visible but displays "Coming Soon" with no active link. The parent login code is preserved behind the scenes for later activation.

**Authentication**

- R4. Authentication uses Supabase Google OAuth. Only `@gt.school` email addresses and `pkuperman@gmail.com` are allowed to sign in. All other domains are rejected with a clear error message.
- R5. `pkuperman@gmail.com` is the superadmin account and can see all student data plus admin controls.
- R6. On first Google login, an account is auto-created for the user — no separate registration step.
- R7. New users land on the tutorial after their first login. Returning users land on `/play`.

**Superadmin**

- R8. The superadmin has a dashboard showing all students' progress, solves, and HB balances (similar to the current parent dashboard but across all students).
- R9. The superadmin has admin controls: at minimum, ability to view/manage student accounts and their data.

## Success Criteria

- A GT student can go from the landing page to playing the game in under 15 seconds (one Google SSO click + consent)
- Non-`@gt.school` emails are blocked with a clear, non-confusing message
- The landing page clearly communicates the product's value proposition
- The superadmin can see all student activity from a single dashboard

## Scope Boundaries

- Parent login UI is hidden ("Coming Soon") but existing parent auth code is not deleted
- No data migration from old child/PIN accounts — fresh start
- War mode, game mechanics, HB economy, and leaderboards are unchanged
- Superadmin controls are functional but don't need to be elaborate — view data, manage accounts
- The old child PIN flow is replaced by Google SSO for students

## Key Decisions

- **Google SSO via Supabase Auth**: Simplest path — Supabase already handles auth, just add the Google provider and enforce domain restriction server-side
- **Domain allowlist, not blocklist**: Only `@gt.school` + the superadmin email are permitted. Server-side enforcement, not just client-side
- **Auto-create accounts**: No registration form or profile setup. Extract display name from Google profile
- **Hide, don't delete parent flow**: "Coming Soon" label preserves the parent path for future activation without code churn

## Dependencies / Assumptions

- GT/Alpha students have Google accounts with `@gt.school` domain
- Supabase project needs Google OAuth provider configured in the dashboard (client ID + secret from Google Cloud Console)
- A Google Cloud project with OAuth consent screen configured for the allowed domains

## Outstanding Questions

### Deferred to Planning

- [Affects R6][Technical] How should the auto-created user record map to the existing database schema? New table or extend `children`?
- [Affects R7][Technical] How does the tutorial detect first-time vs returning user to route correctly?
- [Affects R4][Technical] Best approach for domain restriction — Supabase auth hook, RLS policy, or server-side check in the callback?
- [Affects R8-R9][Technical] Should the superadmin dashboard be a new route group or extend the existing parent dashboard?

## Next Steps

-> `/ce:plan` for structured implementation planning

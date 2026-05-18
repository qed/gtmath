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
- R2. The primary call-to-action is "Join with your Alpha or GT email address" leading to Google SSO, with context text: "For existing Alpha or GT Students". The CTA is the dominant visual element.
- R3. A "For Parents" section appears below the CTA as low-prominence text reading "For Parents — Coming Soon" with no active link. The existing parent auth routes (`/login`, `/dashboard`) return a redirect to `/` while the parent feature is disabled — routes are gated, not just hidden from nav.

**Authentication**

- R4. Authentication uses Supabase Google OAuth with a configurable domain allowlist (environment variable). Initial allowlist: `gt.school` + `pkuperman@gmail.com`. All other domains are rejected. Domain enforcement is layered: (1) server-side check in the auth callback after session exchange, (2) if domain is rejected, the callback signs out the session, deletes the auto-created `auth.users` row, and redirects to `/` with an error query parameter. Error message: "GT Math is for Alpha and GT students. Please sign in with your @gt.school email."
- R5. `pkuperman@gmail.com` is the superadmin. Superadmin is a role flag (not a hardcoded email check) — initially assigned to this one email, but the mechanism supports adding admins without code changes.
- R6. On first Google login, a `children` row is auto-created (extending the existing table with `pin_hash` made nullable for SSO users). Display name is extracted from the Google profile `name` field. No separate registration step.
- R7. New users (where `tutorial_seen = false`) see the existing tutorial component before `/play`. The tutorial has a skip option ("I already know how to play") and sets `tutorial_seen = true` on completion. Returning users (`tutorial_seen = true`) land on `/play`. Authenticated users who navigate to `/` are redirected to `/play`.

**Superadmin**

- R8. The superadmin dashboard shows: (a) aggregate engagement — students active today/this week, (b) student list with name, email, total HB, total solves, last activity, (c) per-student drill-down showing solve history and speed trends by mode.
- R9. Superadmin admin controls: view all student data, reset HB balance, deactivate accounts. All superadmin read/write actions are logged (timestamp, action, affected student).

## Success Criteria

- Returning student: landing page to `/play` in under 10 seconds
- New student: landing page to tutorial in under 20 seconds (includes Google consent screen)
- Non-`@gt.school` emails see the rejection message and can retry immediately
- The landing page clearly communicates GT Math's value proposition
- The superadmin can see all student engagement and drill into any student from a single dashboard

## Scope Boundaries

- Parent login UI is hidden ("Coming Soon") but existing parent auth code is not deleted
- No data migration from old child/PIN accounts — fresh start
- War mode, game mechanics, HB economy, and leaderboards are unchanged
- Superadmin controls are functional but don't need to be elaborate — view data, manage accounts
- The old child PIN flow is replaced by Google SSO for students

## Key Decisions

- **Google SSO via Supabase Auth**: Simplest path — Supabase already handles auth, just add the Google provider and enforce domain restriction server-side
- **Configurable domain allowlist**: Stored as an environment variable, not hardcoded. Initial list is `gt.school` + superadmin email. Supports adding domains without code changes
- **Auto-create accounts into existing `children` table**: Extend the existing table rather than creating a new one. Make `pin_hash` nullable for SSO users. Preserves all existing FK relationships, RLS policies, and leaderboard functions
- **Auth identity model**: Google SSO callback creates a `children` row and mints a `child_jwt` cookie, preserving the existing API contract. All game APIs (`/api/solve`, `/api/progress`, `/api/tutorial`) continue authenticating via `child_jwt` unchanged
- **COPPA — school-use exception**: Alpha/GT School acts as agent of parents under the COPPA school-use exception. School consent substitutes for parental consent. This supersedes the Phase 1 constraint against Supabase Auth identities for children
- **Parent layer deliberately deferred**: Priority is getting the classroom running with Google SSO. Parent-facing visibility (progress sharing, deposit conversion surface) comes in a later phase. This is a known temporary regression from the conversion thesis
- **Gate parent routes, don't just hide UI**: Parent routes (`/login`, `/dashboard`) redirect to `/` while disabled, preventing access via direct URL

## Dependencies / Assumptions

- GT/Alpha students have Google accounts with `@gt.school` domain
- Supabase project needs Google OAuth provider configured in the dashboard (client ID + secret from Google Cloud Console)
- Google Cloud OAuth consent screen must be set to "External" (not "Internal") to allow both `@gt.school` and `@gmail.com`. For <100 users, "Testing" mode works but requires each email to be added as a test user or verification must be completed
- Google OAuth client secret stored only in environment variables (not source control). Development and production use separate OAuth clients with different redirect URI allowlists
- Alpha/GT School provides COPPA consent for students under the school-use exception

## Outstanding Questions

### Deferred to Planning

- [Affects R6][Technical] Migration to make `pin_hash` nullable and add any new columns needed for SSO users (e.g., `google_sub`, `auth_method`)
- [Affects R8-R9][Technical] Should the superadmin dashboard be a new route group or extend the existing parent dashboard? Superadmin RLS policies needed to allow cross-student data access
- [Affects R6][Technical] The auth callback needs to create a `children` row AND mint a `child_jwt` cookie in one flow — verify this works with the existing `create_child()` function or if a new variant is needed
- [Affects R4][Technical] Validate the `next` redirect parameter in the OAuth callback against an allowlist of safe paths (`/play`, `/tutorial`) to prevent redirect manipulation

## Next Steps

-> `/ce:plan` for structured implementation planning

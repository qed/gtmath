# COPPA Compliance Legal Review Brief

**Project:** GTMath (math card game for Alpha School prospects)
**Target users:** Children ages 6-13 + their parents
**Deadline:** Week 2 go/no-go (before Phase 1 launch)
**Owner:** Founder + legal counsel

## What GTMath Collects from Children

| Data | How Collected | Stored Where | Retention |
|------|---------------|-------------|-----------|
| First name only | Parent enters it during child profile creation | Supabase Postgres (RLS-protected) | Until parent deletes account |
| 4-digit PIN (bcrypt hash) | Parent sets it, child enters it to log in | Supabase Postgres | Until parent resets or deletes |
| Game performance (solves, times, modes, expressions) | Automatically during gameplay | Supabase Postgres | Until parent deletes account |
| Home Bucks balance and transactions | Calculated server-side on solve | Supabase Postgres | Until parent deletes account |
| Daily activity dates | Server-side on solve | Supabase Postgres | Until parent deletes account |

**NOT collected from children:** Email, phone, photo, location, device ID, advertising ID, cookies (auth is via httpOnly JWT cookie set by server, not tracking cookie), IP address (not logged beyond standard Vercel/Supabase request logs).

## Our Consent Model

1. **Parent creates account first** via magic link email (verifiable adult identity).
2. **Parent creates child profile** (enters child's first name + sets PIN).
3. **Child plays using PIN only** -- no self-registration, no email, no personal info entered by child.
4. **Parent can delete child profile** at any time from the dashboard, which cascades to delete all child data (solves, HB, activity).

### Questions for Legal

1. **Does magic link email constitute "verifiable parental consent" under COPPA?** The parent provides their email, receives a magic link, authenticates, then creates the child profile. There's no credit card verification, knowledge-based authentication, or signed consent form. Is email-based magic link sufficient for the data we collect?

2. **Is game performance data "personal information" under COPPA?** We store solve times, expressions used, modes played, and HB balances -- all tied to a child UUID. The child's first name is the only human-readable identifier. No last name, no email, no photo.

3. **Do we need a privacy policy page?** If yes, what must it contain for COPPA compliance? Where must it be displayed (before parent signup? on every page?)?

4. **Partner invite flow:** A primary parent can invite a partner (co-parent) to view the child's dashboard. The partner authenticates via magic link. Max 2 partners per child. Does sharing a child's game data with an invited partner require additional consent, or does the primary parent's consent cover it?

5. **Data deletion:** When a parent deletes their account, if they're the last parent on a child, the child's data is automatically deleted (DB trigger). Is automatic deletion sufficient, or must we offer a separate "delete my child's data" button independent of account deletion?

6. **Shareable progress card (Phase 2):** A parent can share a server-rendered image showing the child's first name, days active, modes reached, solve count, and HB balance. The URL contains a UUID (not guessable). No last name, no photo. Does this constitute disclosure of child data to third parties?

7. **Weekly email digest:** Every Monday, parents receive an email summarizing their child's game activity. The email contains the child's first name and game stats. Is this permissible under COPPA since the email goes only to verified parents?

8. **Do we qualify for the COPPA "school use" exception?** GTMath is operated by Alpha School (a private school) for use by its prospective students. The school has a direct relationship with the families.

## What We Do NOT Do

- No advertising to children
- No behavioral tracking or profiling beyond game performance
- No social features between children (no chat, no friend lists, no sharing between kids)
- No third-party SDKs that collect child data (no analytics, no crash reporting beyond Vercel's default)
- No location tracking
- No photo/video/audio collection

## Architecture Relevant to COPPA

- Children have NO Supabase Auth identity (no email, no password, no OAuth)
- Children authenticate via 4-digit PIN verified server-side, receiving a custom JWT
- JWT is stored in httpOnly cookie (not accessible to client-side JavaScript)
- All child data is isolated via Postgres Row Level Security
- Parent dashboard access is gated by Supabase Auth (magic link)
- Orphan cleanup: if all parents delete their accounts, child data is automatically deleted via DB trigger

## Recommended Outcome

Legal confirms one of:
- **GREEN:** Current consent model is sufficient. Add privacy policy. Ship.
- **YELLOW:** Need additional consent mechanism (e.g., consent checkbox, signed form). Specify what.
- **RED:** Fundamental architecture change needed. Specify what.

Deadline for answer: end of week 2 (go/no-go for Phase 1 launch).

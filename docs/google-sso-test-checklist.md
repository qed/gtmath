# Google SSO + Landing Page — Test Checklist

Live at: https://gtmath-helix3.vercel.app

## Prerequisites

- [ ] Supabase dashboard: Google OAuth provider enabled with correct client ID/secret
- [ ] Supabase dashboard: Site URL set to `https://gtmath-helix3.vercel.app`
- [ ] Supabase dashboard: Redirect URL includes `https://gtmath-helix3.vercel.app/api/auth/callback`
- [ ] Vercel env vars set: `SUPERADMIN_EMAILS=pkuperman@gmail.com`
- [ ] Vercel env vars: `ALLOWED_EMAIL_DOMAINS` is empty or unset (allows all domains)

## Landing Page

- [ ] Visit `/` — shows GT Math branding (lightning bolt, title, tagline)
- [ ] "Sign in with Google" button is visible and styled blue
- [ ] "For Parents — Coming Soon" text visible below CTA
- [ ] No old login UI (no child picker, no PIN pad, no magic link form)

## Google SSO — New User

- [ ] Click "Sign in with Google" → redirects to Google consent screen
- [ ] Google shows account picker (important for shared Chromebooks)
- [ ] After selecting account → redirects back to `/play`
- [ ] `/play` shows cards and target (game loads correctly)
- [ ] Check Supabase `children` table: new row created with correct name, email, `auth_method = 'google'`
- [ ] Child name extracted from Google profile (or email prefix if no name)

## Google SSO — Returning User

- [ ] Sign out, then sign in again with same account
- [ ] Redirects to `/play` (not tutorial)
- [ ] No duplicate row in `children` table
- [ ] Same child_id, HB balance preserved

## Session & Sign Out

- [ ] After sign-in, refresh `/play` — stays authenticated (cookie persists)
- [ ] Click "Sign out" button (door icon) on play page
- [ ] Redirects to `/` (landing page)
- [ ] After sign-out, visiting `/play` directly → redirects to `/`
- [ ] `child_jwt` cookie is cleared after sign-out

## Session Expiry

- [ ] After 24h (or manually delete `child_jwt` cookie in devtools)
- [ ] Next API call shows session-expired overlay
- [ ] Overlay auto-redirects to `/` after 2s

## Superadmin Flow

- [ ] Sign in with `pkuperman@gmail.com` → redirects to `/admin` (not `/play`)
- [ ] `/admin` shows aggregate stats (Students, Active Today, Solves This Week)
- [ ] Student table lists all active students with Name, Email, HB, Solves, Last Active
- [ ] Click a student name → navigates to `/admin/students/[id]`
- [ ] Drilldown shows: student info, Speed by Mode stats, Recent Solves table, HB Ledger

## Admin Actions

- [ ] "Reset HB" button → shows confirmation text ("Reset HB to 0? This cannot be undone.")
- [ ] Click "Cancel" → confirmation disappears, no action taken
- [ ] Click "Confirm" → HB resets (verify in HB Ledger: ADMIN_RESET row with balance_after=0)
- [ ] "Deactivate" button → shows confirmation ("They will lose access immediately.")
- [ ] Confirm deactivation → student shows "(Deactivated)" badge
- [ ] "Reactivate" button appears for deactivated student
- [ ] Confirm reactivation → badge disappears, student can log in again
- [ ] Check `admin_audit_log` table in Supabase: all actions logged with admin email

## Deactivated User Enforcement

- [ ] Deactivate a test account via admin dashboard
- [ ] Try to sign in with that Google account → shows "Your account has been deactivated" error
- [ ] User cannot reach `/play` even with a valid cookie (proxy blocks)

## Legacy Routes (Gated)

- [ ] Visit `/login` → redirects to `/`
- [ ] Visit `/dashboard` → redirects to `/`
- [ ] Visit `/pin` → redirects to `/`

## Domain Restriction (Optional)

If you later set `ALLOWED_EMAIL_DOMAINS=gt.school` in Vercel env vars:
- [ ] Non-gt.school accounts get rejected with error message
- [ ] Superadmin email still gets through regardless of domain

## Edge Cases

- [ ] Open `/` in incognito → landing page loads, no errors
- [ ] Cancel Google consent screen → returns to `/` with no error (or generic error)
- [ ] Try `/admin` without superadmin account → redirects to `/`
- [ ] Try `/api/admin/students` without superadmin → returns 403 JSON
- [ ] Multiple rapid sign-in attempts → no duplicate children rows

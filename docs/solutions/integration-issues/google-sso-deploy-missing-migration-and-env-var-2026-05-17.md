---
title: Google SSO deploy failure — missing migration and env var
date: 2026-05-17
category: integration-issues
module: auth
problem_type: integration_issue
component: deployment
symptoms:
  - "Sign-in failed" error after clicking Google sign-in button
  - Supabase logs show function create_child_sso does not exist
  - OAuth callback returns auth_failed error code
root_cause: missing_workflow_step
resolution_type: configuration_change
severity: critical
tags: [google-sso, supabase, migration, env-var, deployment, vercel]
---

# Google SSO deploy failure — missing migration and env var

## Problem

After deploying the Google SSO feature to production, clicking "Sign in with Google" completed the Google consent screen but then showed "Sign-in failed. Please try again with a valid Google account." The OAuth callback was failing because two production prerequisites were missing: the database migration and a Vercel environment variable.

## Symptoms

- Google consent screen works, but redirect back to `/api/auth/callback` fails
- Browser shows the generic "Sign-in failed" error message
- Supabase logs reveal: `function public.create_child_sso(text, text, text, text) does not exist`
- No `auth_method` column on the `children` table (migration never ran)
- `SUPERADMIN_EMAILS` env var not set in Vercel, so superadmin detection silently fails

## What Didn't Work

- **Checking code logic first**: The OAuth callback code was correct — the issue was infrastructure, not application logic. Time spent reading the callback handler was wasted.
- **Assuming `supabase db push` ran the migration**: The migration file existed locally but was never applied to the remote database. There was no CI/CD step or manual command to push it.

## Solution

Two fixes were required:

### 1. Apply the migration to production

```bash
npx supabase db query --linked -f "supabase/migrations/20260516000001_google_sso_schema.sql"
```

This created:
- `auth_method` and `google_sub` columns on the `children` table
- The `create_child_sso()` function that the OAuth callback calls
- Necessary indexes

### 2. Add the missing environment variable

```bash
echo "pkuperman@gmail.com" | vercel env add SUPERADMIN_EMAILS production --scope helix3
```

Then redeploy so the new env var is picked up:

```bash
vercel deploy --prod --scope helix3
```

## Why This Works

The OAuth callback calls `create_child_sso()` to upsert a child record when a Google user signs in. Without the migration, that function didn't exist in production Postgres, causing every sign-in attempt to fail with a 500 error that the callback translated to "Sign-in failed."

The `SUPERADMIN_EMAILS` variable controls admin routing — without it, even a successful sign-in would not route the superadmin to `/admin`.

Both issues stem from the same root cause: the deployment workflow pushed application code (via Vercel) but did not include steps for database migrations or environment variable setup.

## Prevention

- **Pre-deploy checklist for features touching the database**: Before deploying, verify that all new migrations have been applied to production. Run `npx supabase db query --linked` to check for expected tables/functions.

- **Verify env vars before deploy**: For any feature that reads new environment variables, confirm they exist in Vercel before deploying:
  ```bash
  vercel env ls production --scope helix3
  ```

- **Smoke test after deploy**: After deploying auth changes, immediately test the sign-in flow end-to-end in production. Don't assume it works because it worked locally.

- **Migration application command**: Unlike `vercel deploy` which is automatic, Supabase migrations require an explicit push step. Document this in the deploy checklist:
  ```bash
  # Apply pending migrations to production
  npx supabase db push --linked
  # Or for a specific migration:
  npx supabase db query --linked -f "supabase/migrations/<filename>.sql"
  ```

## Related Issues

- [Google SSO Test Checklist](../../docs/google-sso-test-checklist.md) — covers the full SSO verification flow
- [Next.js route group CSS import paths](../build-errors/nextjs-route-group-relative-import-paths-2026-05-16.md) — another deployment issue from the same feature

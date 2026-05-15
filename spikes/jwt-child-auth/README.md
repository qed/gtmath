# JWT Child Auth Spike

Week 1 blocker: verify that Supabase accepts externally-minted JWTs for RLS.

## What we're testing

Children have NO Supabase Auth identity (COPPA -- no email/password for kids).
Instead, an API route verifies the child's PIN against a bcrypt hash, then mints
a JWT signed with Supabase's `jwt_secret`. The question: does Supabase's PostgREST
layer accept this JWT and enforce RLS policies based on its claims?

## Prerequisites

1. Create a Supabase project at https://supabase.com/dashboard
2. Copy your project's JWT secret: Settings > API > JWT Secret
3. Copy your project URL and anon key: Settings > API

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET
```

## Run the spike

```bash
npm install
npx tsx test-jwt.ts
```

## Expected output

```
[1/5] Minting child JWT...         OK (token: eyJ...)
[2/5] Creating test tables...      OK
[3/5] Inserting test child...      OK
[4/5] Querying with child JWT...   OK (child can read own row)
[5/5] Querying other child...      OK (RLS blocks cross-child read)

RESULT: PASS -- Supabase accepts externally-minted JWTs for RLS.
```

If step 4 fails with 401 or empty result: Supabase rejects external JWTs.
Fallback: service_role key in API route + manual auth checks (see plan).

## What happens next

- PASS: proceed with custom JWT architecture for child auth
- FAIL: switch to service_role fallback, update plan accordingly

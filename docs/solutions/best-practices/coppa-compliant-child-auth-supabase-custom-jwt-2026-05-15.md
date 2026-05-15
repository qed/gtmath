---
title: "COPPA-Compliant Child Auth with Custom JWTs on Supabase"
date: 2026-05-15
category: best-practices
module: gtmath-phase1
problem_type: best_practice
component: authentication
severity: critical
related_components:
  - database
  - tooling
applies_when:
  - Building a Supabase-backed app with child users under 13 where COPPA prohibits PII collection
  - Any multi-tenant RLS scenario requiring custom JWT claims beyond Supabase built-in auth
  - Server-side verification of user-submitted mathematical expressions
  - Virtual economy or leaderboard needing concurrent-write safety
  - Deploying Next.js 16 on Vercel with edge-compatible JWT handling
tags:
  - coppa
  - supabase
  - custom-jwt
  - jose
  - rls
  - rational-arithmetic
  - advisory-locks
  - nextjs-16
---

# COPPA-Compliant Child Auth with Custom JWTs on Supabase

## Context

Building GTMath (a math card game for Alpha School, ~50 students) required authenticating children under 13 without collecting PII. Supabase Auth requires email or phone — unusable under COPPA. The standard `jsonwebtoken` library fails on Vercel's Edge Runtime. Float arithmetic causes incorrect math expression evaluation (`1/3 * 3 !== 1`). Concurrent solve submissions can double-count leaderboard entries. These constraints collectively demanded a non-obvious architecture that isn't documented in Supabase's official guides.

The JWT spike (`spikes/jwt-child-auth/`) validated that Supabase PostgREST accepts externally-minted JWTs for RLS enforcement. The COPPA legal brief (`spikes/coppa-legal-brief.md`) confirmed the data model collects no regulated PII.

## Guidance

### 1. Custom Child JWT Auth (No Supabase Auth Identity)

Children get a row in a `children` table but NO Supabase Auth identity. Authentication is PIN-based. The app mints its own JWT that Supabase accepts as a valid session token.

**PIN login API route** (`/api/auth/child-login`):

```typescript
import { SignJWT } from 'jose';
import { compare } from 'bcryptjs';

export async function POST(req: Request) {
  const { childId, pin } = await req.json();

  const { data: child, error } = await supabaseAdmin
    .from('children')
    .select('pin_hash')
    .eq('id', childId)
    .single();

  if (error) return Response.json({ error: 'Server error' }, { status: 500 });
  if (!child || !(await compare(pin, child.pin_hash))) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) throw new Error('SUPABASE_JWT_SECRET is not set');
  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({
    role: 'authenticated',
    iss: 'supabase',
    sub: childId,
    child_id: childId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);

  const response = Response.json({ ok: true });
  response.headers.set(
    'Set-Cookie',
    `child-token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
  return response;
}
```

Why `jose` and not `jsonwebtoken`: `jsonwebtoken` depends on Node.js `crypto`, unavailable in Vercel's Edge Runtime. `jose` uses the Web Crypto API — works everywhere.

**RLS policy** that reads the custom claim:

```sql
CREATE POLICY "children_read_own" ON children
  FOR SELECT USING (
    id = (current_setting('request.jwt.claims', true)::json->>'child_id')::uuid
  );
```

Supabase passes JWT claims into `request.jwt.claims` for every request, so the same JWT that logs the child in also enforces data isolation at the database layer.

### 2. Server-Side Expression Verification (Separate from Solver)

Never trust client-submitted solutions. A separate `verify.ts` module validates expressions independently of the solver. "Can this hand be solved?" (solver) uses different algorithms than "is this submitted expression valid?" (verifier) — keeping them separate reduces attack surface.

The verifier uses a standard recursive descent parser (tokenize -> parseExpr -> parseTerm -> parsePrimary) to safely evaluate expressions without `eval`.

```typescript
export function verify(
  expression: string,
  ranks: number[],
  target: number,
  mode: number,
  elapsedMs: number
): { valid: true } | { valid: false; reason: string } {
  if (elapsedMs < 200 || elapsedMs > 600_000) return { valid: false, reason: 'implausible_time' };
  if (!VALID_MODES.has(mode)) return { valid: false, reason: 'invalid_mode' };

  const usedRanks = extractRanks(expression);
  if (!ranksMatch(usedRanks, ranks)) return { valid: false, reason: 'rank_mismatch' };

  const result = evaluate(parseExpr(tokenize(expression)));
  if (result.n !== target || result.d !== 1)
    return { valid: false, reason: 'wrong_answer' };

  return { valid: true };
}
```

Key validations: expression evaluates to target, card ranks match the dealt hand (same multiset), mode is valid, elapsed time is plausible (catches bots).

### 3. Rational Arithmetic (No Float Drift)

For any math game, floating-point arithmetic is fatal. `1/3 * 3` in IEEE 754 is `0.9999999999999999`, not `1`.

```typescript
type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function rat(n: number, d: number = 1): Rational {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return { n: n / g, d: d / g };
}

const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n);
const eq  = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;
```

Always normalize (GCD-reduce) after every operation. Use this in both the solver and verifier.

### 4. Atomic Database Operations with Advisory Locks

Concurrent solve submissions from the same child (two tabs, fast taps) can double-count rewards. Use per-child advisory locks scoped to the transaction:

```sql
CREATE OR REPLACE FUNCTION record_solve(p_child_id uuid, ...) RETURNS jsonb AS $$
BEGIN
  -- Advisory lock keyed to this child, released at transaction end
  PERFORM pg_advisory_xact_lock(('x' || left(p_child_id::text, 8))::bit(32)::int);

  -- Get current balance from append-only ledger
  SELECT COALESCE(
    (SELECT balance_after FROM hb_transactions
     WHERE child_id = p_child_id ORDER BY created_at DESC LIMIT 1),
    0
  ) INTO v_old_balance;

  v_new_balance := v_old_balance + v_total_hb;

  -- Insert solve + transaction rows atomically
  INSERT INTO solves (...) VALUES (...) RETURNING id INTO v_solve_id;
  INSERT INTO hb_transactions (child_id, type, amount, balance_after, reference_id)
  VALUES (p_child_id, 'EARN', v_total_hb, v_new_balance, v_solve_id);

  RETURN jsonb_build_object('solve_id', v_solve_id, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The `hb_transactions` table is append-only — `balance_after` on every row makes the balance auditable. Never `UPDATE` a balance column directly.

### 5. RLS for Parent-Child Relationships

Six tables, all RLS-enabled. The junction table pattern (`parent_children`) is the key:

```sql
-- Parents read linked children via junction table
CREATE POLICY "parent_read_children" ON children FOR SELECT
  USING (id IN (SELECT child_id FROM parent_children WHERE parent_id = auth.uid()));

-- Primary parent can invite partners (max 3 total links per child)
CREATE POLICY "primary_parent_invite" ON parent_children FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = auth.uid() AND pc.child_id = child_id AND pc.role = 'primary')
    AND (SELECT count(*) FROM parent_children pc WHERE pc.child_id = child_id) < 3
  );
```

Orphan cleanup trigger — when the last parent link is deleted, cascade-delete the child row. This satisfies COPPA right-to-deletion without application-layer orchestration.

### 6. Stack-Specific Gotchas

**Next.js 16**: `middleware.ts` is now `proxy.ts` with `export function proxy()`. Using the old names causes silent failures.

**Supabase CLI on Windows**: Global install unsupported. Always use `npx supabase`.

**PowerShell + bcrypt hashes**: `$2b$10$...` hashes break in double-quoted strings. Use here-strings:
```powershell
$hash = @'
$2b$10$yourHashHere
'@
```

**Supabase JWT secret**: Not in `supabase secrets list` (that's user-defined secrets only). Fetch via Management API: `GET /v1/projects/{ref}/postgrest`.

## Why This Matters

**COPPA compliance via architecture**: Using Supabase Auth for children inevitably collects an email or phone. The custom JWT approach means the `children` table contains only `{id, name, pin_hash}` — no PII, no consent requirement beyond the parent creating the child's profile.

**Separate verifier**: A compromised client that controls the solver cannot forge a valid verification response — the server re-derives the answer from scratch using independent code.

**Rational arithmetic**: Float bugs in a math game destroy trust. A student who correctly computes `(1/3) * 3 = 1` and gets "wrong answer" will never trust the app again.

**Advisory locks over table locks**: Table-level locks serialize all writes for all children. Per-child advisory locks allow concurrent writes from different children while preventing double-counting for the same child.

**Append-only ledger**: Economy bugs in a children's app are serious — perceived real value is at stake. A mutable `balance` column hides bugs. An append-only ledger is always auditable.

## When to Apply

- **Custom JWT auth**: any app where users cannot have PII-bearing accounts (children under 13, anonymous users, device-local accounts)
- **Server-side expression verification**: any user-submitted computation where correctness has value (game scores, financial calculations, assessments)
- **Rational arithmetic**: any application where mathematical exactness is user-facing (math games, financial apps, unit conversion)
- **Advisory locks**: any leaderboard, economy, or inventory system with concurrent writes per entity
- **Append-only ledger**: any virtual economy, points system, or balance that must be auditable
- **Orphan cleanup trigger**: any parent-child relationship where deleting the last parent should cascade-delete the child (right-to-deletion compliance)

## Examples

### Float arithmetic (broken) vs rational arithmetic (correct)

```javascript
// BROKEN: 1/3 * 3 === 0.9999999999999999
if (eval(expression) === 24) recordSolve();

// CORRECT: rational arithmetic
const result = evaluate(parseExpr(tokenize(expression)));
if (result.n === 24 && result.d === 1) recordSolve();
```

### Naive balance update (race condition) vs advisory lock + ledger (correct)

```sql
-- BROKEN: two concurrent requests both read balance=100, both write 110
UPDATE children SET balance = balance + 10 WHERE id = $1;

-- CORRECT: advisory lock serializes per-child, ledger records every change
PERFORM pg_advisory_xact_lock(('x' || left(child_id::text, 8))::bit(32)::int);
INSERT INTO hb_transactions (child_id, type, amount, balance_after)
VALUES ($1, 'EARN', 10, (SELECT balance_after FROM hb_transactions
  WHERE child_id = $1 ORDER BY created_at DESC LIMIT 1) + 10);
```

### jsonwebtoken on Edge (crashes) vs jose on Edge (works)

```typescript
// BROKEN: pulls in Node.js crypto — crashes on Vercel Edge Runtime
import jwt from 'jsonwebtoken';
const token = jwt.sign(claims, secret);

// CORRECT: pure Web Crypto API
import { SignJWT } from 'jose';
const token = await new SignJWT(claims)
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(new TextEncoder().encode(secret));
```

## Related

- `spikes/jwt-child-auth/README.md` — JWT spike that validated custom JWTs work with Supabase RLS
- `spikes/coppa-legal-brief.md` — Legal review confirming the data model collects no regulated PII
- `docs/phase-1-summary.md` — Full Phase 1 build summary (plain English + technical)
- `app/supabase/migrations/20260515000001_initial_schema.sql` — Tables, functions, advisory locks
- `app/supabase/migrations/20260515000002_rls_policies.sql` — All RLS policies
- `app/src/lib/jwt.ts` — Production JWT mint/verify implementation
- `app/src/lib/verify.ts` — Server-side expression verification
- `app/src/lib/solver.ts` — Rational arithmetic engine and smart dealer

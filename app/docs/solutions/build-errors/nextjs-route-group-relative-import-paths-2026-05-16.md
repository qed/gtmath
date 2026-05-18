---
title: Next.js route group breaks relative CSS import paths
date: 2026-05-16
category: build-errors
module: admin
problem_type: build_error
component: frontend
symptoms:
  - "Module not found: Can't resolve '../auth.css'" during next build
  - Build fails only with Turbopack, not caught by tsc
root_cause: incorrect_implementation
resolution_type: code_fix
severity: moderate
tags: [nextjs, route-group, css-import, turbopack, build-error]
---

# Next.js route group breaks relative CSS import paths

## Problem

After wrapping admin pages in a `(admin)` route group, the production build failed with `Module not found: Can't resolve '../auth.css'`. The route group directory adds a filesystem level that wasn't accounted for in relative import paths.

## Symptoms

- `next build` fails with `Module not found` for CSS imports
- `tsc --noEmit` passes — TypeScript doesn't validate CSS import paths
- Only surfaces during Turbopack bundling, not type-checking

## What Didn't Work

- **Running `tsc` as a pre-deploy check**: TypeScript ignores CSS imports entirely, so the broken paths weren't caught until `next build` ran.

## Solution

Add one more `../` to each CSS import to account for the route group directory:

```typescript
// Before (admin/page.tsx at app/(admin)/admin/page.tsx)
import "../auth.css";

// After — (admin) route group adds one filesystem level
import "../../auth.css";
```

Similarly for deeper pages:
```typescript
// Before (admin/students/[id]/page.tsx)
import "../../../auth.css";

// After
import "../../../../auth.css";
```

## Why This Works

Next.js route groups like `(admin)` create a real filesystem directory but don't add a URL segment. The file moves from `app/admin/page.tsx` to `app/(admin)/admin/page.tsx` — one level deeper. Relative imports must account for this extra directory even though the URL stays the same.

## Prevention

- **Always run `next build` before deploying** when moving files into or out of route groups. `tsc` alone won't catch CSS import issues.
- **When creating route groups**, audit all relative imports in moved files — CSS, images, and other non-TS assets that TypeScript doesn't validate.

## Related Issues

- [Google SSO deploy failure](../integration-issues/google-sso-deploy-missing-migration-and-env-var-2026-05-17.md) — another deployment issue from the same feature

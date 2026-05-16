---
title: "Next.js route group directories break relative import paths"
date: "2026-05-16"
category: build-errors
module: next-app-router
problem_type: build_error
component: tooling
symptoms:
  - "Vercel production build fails with 'Module not found: Can't resolve ../auth.css'"
  - "Relative CSS import paths resolve incorrectly inside (admin) route group"
  - "tsc --noEmit passes but next build fails"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags:
  - next-js-16
  - app-router
  - route-groups
  - relative-imports
  - build-error
  - css-imports
  - turbopack
---

# Next.js route group directories break relative import paths

## Problem

Next.js 16 production build failed on Vercel with "Module not found" errors for CSS imports inside App Router route group directories. The `(admin)` route group adds a filesystem level that was not counted when writing relative `../` traversals.

## Symptoms

- Vercel deploy failed during `next build` with:
  ```
  Module not found: Can't resolve '../../../auth.css'
    ./app/src/app/(admin)/admin/students/[id]/page.tsx:6:1

  Module not found: Can't resolve '../auth.css'
    ./app/src/app/(admin)/admin/page.tsx:5:1
  ```
- Local `npx tsc --noEmit` passed with zero errors (TypeScript does not resolve CSS imports)
- Error only surfaced during Turbopack bundling in the `next build` step

## What Didn't Work

- **Running `tsc --noEmit` as a pre-push check**: TypeScript ignores CSS module imports entirely, so broken CSS paths produce no diagnostics. Gave false confidence.
- **Counting path depth by URL structure**: Developers intuitively map the URL `/admin/students/[id]` to 3 levels from app root, forgetting `(admin)/` exists on disk but not in URLs.

## Solution

Corrected relative import paths to account for the `(admin)` route group directory:

**`app/src/app/(admin)/admin/page.tsx`** (2 directories deep: `(admin)` → `admin`):
```tsx
// Before (wrong — only counts 1 level)
import "../auth.css"

// After (correct — counts both (admin) and admin)
import "../../auth.css"
```

**`app/src/app/(admin)/admin/students/[id]/page.tsx`** (4 directories deep: `(admin)` → `admin` → `students` → `[id]`):
```tsx
// Before (wrong — counts 3 levels, missing (admin))
import "../../../auth.css"

// After (correct — counts all 4 physical directories)
import "../../../../auth.css"
```

## Why This Works

Relative imports resolve against the **filesystem path**, not the URL path. Route groups like `(admin)` are a Next.js routing convention — they prevent the directory name from becoming a URL segment — but they physically exist on disk. Every `../` must correspond to an actual directory traversal.

```
src/app/
├── auth.css              ← target
├── (admin)/              ← real directory, invisible in URLs
│   └── admin/
│       ├── page.tsx      ← 2 levels deep from auth.css
│       └── students/
│           └── [id]/
│               └── page.tsx  ← 4 levels deep from auth.css
```

## Prevention

1. **Use `@/` path aliases instead of relative imports**: Write `import "@/app/auth.css"` — eliminates relative path counting entirely.
2. **Count `(groupname)` directories as physical levels**: Always include the parenthesized directory in `../` count.
3. **Run `next build` locally before pushing, not just `tsc --noEmit`**: CSS and module resolution errors only surface during bundling.
4. **Prefer colocated styles**: Keep stylesheets adjacent to components to minimize deep relative traversals.

## Related Issues

- `docs/solutions/best-practices/coppa-compliant-child-auth-supabase-custom-jwt-2026-05-15.md` — documents another Next.js 16 filesystem gotcha (`proxy.ts` naming)
- Part of a broader pattern: Next.js App Router filesystem conventions that silently break things when developers rely on URL-path mental models

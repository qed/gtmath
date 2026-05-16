---
title: "Progressive Tutorial Pattern for Non-Obvious Game Mechanics"
date: "2026-05-15"
category: best-practices
module: tutorial
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - "Adding guided onboarding to a game or app with non-obvious interaction patterns"
  - "Database flag for tutorial completion exists but has no UI wired to it"
  - "Target audience includes young or first-time users who cannot read instructions"
  - "The real app has punitive rules (no retry, locked state) that would frustrate new users"
  - "Tutorial must reuse production UI without duplicating CSS or game logic"
related_components:
  - database
  - authentication
tags:
  - tutorial
  - onboarding
  - progressive-scaffolding
  - game-ux
  - next-js
  - supabase
---

# Progressive Tutorial Pattern for Non-Obvious Game Mechanics

## Context

GTMath's core mechanic — pairwise reduction (tap card, tap card, tap operator, cards merge into a result tile, repeat until one tile equals the target) — has no standard UI analogue. The game also enforces a no-retry-on-bust rule: if the final tile doesn't match the target, the hand is permanently locked. For the target audience (~50 elementary students in a classroom setting), combining a non-obvious mechanic with an unforgiving failure mode would produce immediate frustration.

The database already had a `tutorial_seen` boolean on the `children` table from the initial migration, along with type definitions (`ChildProfile.tutorialSeen`) and API plumbing in `/api/children`. But zero tutorial UI existed — just the flag waiting for a feature.

## Guidance

### Pattern: Pre-scripted hands with degrading scaffolding

Three layers work together:

**1. Pre-scripted hands replace random dealing.** Define a static array where each hand has exactly one viable operator, turning each into a single teaching moment:

```tsx
const HANDS: { cards: Card[]; target: number; guide: "full" | "semi" | "free" }[] = [
  { cards: [{ rank: 3, suit: "♠" }, { rank: 3, suit: "♥" }], target: 6, guide: "full" },
  { cards: [{ rank: 2, suit: "♦" }, { rank: 3, suit: "♣" }], target: 6, guide: "semi" },
  { cards: [{ rank: 9, suit: "♠" }, { rank: 3, suit: "♥" }], target: 6, guide: "free" },
];
```

Hand 1 (3+3=6): Only addition works. Hand 2 (2×3=6): Only multiplication works. Hand 3 (9−3=6): Only subtraction works.

**2. Progressive guidance degrades across hands.** A `guide` field controls scaffolding level. Instruction text and visual highlights adapt based on both the guide level and current selection state:

```tsx
if (guide === "full") {
  if (selected.length === 0) instruction = "Tap the first card";
  else if (selected.length === 1) instruction = "Now tap the second card";
  else instruction = "Tap + to combine them";
} else if (guide === "semi") {
  if (selected.length < 2) instruction = "Tap both cards";
  else instruction = `Which operation makes ${target}?`;
} else {
  if (selected.length < 2) instruction = `Your turn — make ${target}!`;
}
```

Pulse highlights (`fm-tut-pulse` CSS animation) only appear in `full` mode, guiding attention to the correct element at each sub-step.

**3. Retry replaces bust-lock in tutorial context.** The tutorial overrides the game's no-retry rule with a retry loop so users learn what bust looks like without penalty:

```
State machine:  welcome → playing ⇄ wrong (retry resets hand)
                                   → correct → next hand or done
```

Wrong-answer feedback uses the same `is-bust` styling as the real game — so when users encounter bust for real, they recognize it.

**4. Reuse game CSS classes for visual consistency.** The tutorial renders cards, operators, and preview using the identical `fm-card`, `fm-pc`, `fm-rc`, `fm-ops`, `fm-preview` classes. Tutorial-specific CSS (~90 lines) covers only the overlay chrome: instruction banner, pulse animation, feedback panels, and skip button.

**5. Wire the existing DB flag end-to-end.** Three integration points:

The progress API fetches `tutorial_seen` in parallel with existing queries (no extra round trip):

```ts
const [{ data: solves }, { data: child }] = await Promise.all([
  supabase.from("solves").select("mode").eq("child_id", auth.childId),
  supabase.from("children").select("tutorial_seen").eq("id", auth.childId).single(),
]);
```

The play page uses a tri-state (`null | false | true`) to prevent flash of wrong content:

```tsx
const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);

if (tutorialSeen === null) return <div className="fm-stage" />;
if (!tutorialSeen) return <Tutorial onComplete={handleTutorialComplete} />;
// ... render game
```

Completion is optimistic — UI transitions immediately, PATCH fires async. If offline, the tutorial re-shows next session (harmless):

```tsx
async function handleTutorialComplete() {
  setTutorialSeen(true);
  try {
    await fetch("/api/tutorial", { method: "PATCH" });
  } catch {
    // offline — tutorial will re-show next time
  }
}
```

## Why This Matters

Without a tutorial, students encounter pairwise reduction for the first time in a punitive environment. The tap-tap-operator flow has no real-world analogue. The first wrong answer locks the hand with no retry. In classroom testing (~50 students, limited teacher attention), this creates a support bottleneck in the first 30 seconds.

With the progressive tutorial, students complete 3 guided hands in under a minute. They learn the mechanic, see operators in isolation, experience bust safely, and transition directly into the game with confidence. The skip option respects returning players.

## When to Apply

- **Non-obvious core interaction**: If the primary mechanic doesn't map to a standard UI pattern (text input, drag-and-drop, tap-to-select), users need guided practice before free play.
- **Punitive failure mode**: If mistakes are permanent (no undo, locked state), the tutorial must relax those rules and show failure in a safe environment.
- **Young or distracted audience**: Children, casual users, or anyone in a high-distraction setting will skip text instructions. Guided hands with visual highlights teach by doing.
- **Unused DB flag available**: If a migration already created a completion flag, wire it end-to-end with tri-state loading rather than adding new schema.

Does NOT apply when:
- The interaction is a standard form/CRUD flow users already understand.
- The failure mode is forgiving (easy undo, no penalty).
- Tutorial content needs to be dynamic or A/B tested (pre-scripted hands are static by design).

## Examples

### Before: Direct drop into game

```tsx
export default function PlayPage() {
  const [phase, setPhase] = useState<GamePhase>("ready");
  // ... game logic ...
  return <div className="fm-stage">{ /* game UI */ }</div>;
}
```

Student taps "Solve", sees 2 cards and 4 operators, has no idea what to do. Taps randomly, busts, sees "No retry — this hand is locked."

### After: Conditional tutorial gate

```tsx
export default function PlayPage() {
  const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);
  // ... fetch tutorialSeen from /api/progress ...

  if (tutorialSeen === null) return <div className="fm-stage" />;
  if (!tutorialSeen) return <Tutorial onComplete={handleTutorialComplete} />;
  return <div className="fm-stage">{ /* game UI */ }</div>;
}
```

Student sees welcome screen, completes 3 guided hands with degrading scaffolding, transitions seamlessly into real game.

### Key files

| File | Purpose |
|------|---------|
| `src/app/(child)/play/tutorial.tsx` | Tutorial component — own state machine, 3 pre-scripted hands, progressive guidance |
| `src/app/(child)/play/page.tsx` | Play page with tri-state tutorial gate |
| `src/app/api/tutorial/route.ts` | PATCH endpoint to mark `tutorial_seen = true` |
| `src/app/api/progress/route.ts` | Returns `tutorialSeen` alongside solve progress |
| `src/app/(child)/play/game.css` | Tutorial CSS (overlay, pulse, feedback, banner) |

## Related

- `docs/solutions/best-practices/coppa-compliant-child-auth-supabase-custom-jwt-2026-05-15.md` — Child auth infrastructure the tutorial builds on
- `docs/solutions/best-practices/hb-economy-effort-based-earning-rework-2026-05-15.md` — HB economy that tutorial hands don't participate in (no HB during tutorial)

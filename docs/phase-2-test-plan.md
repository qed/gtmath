# Phase 2 Test Plan

Live at: https://gtmath-helix3.vercel.app

---

## 1. Leaderboards (`/leaderboard`)

- [ ] Navigate to `/leaderboard` (trophy icon in play header, or direct URL)
- [ ] Switch between modes using the mode pills (Quick, Speed, Classic, Combo, Expert, Power, Master, Wild)
- [ ] Switch between "Most solved" and "Fastest" metrics
- [ ] Switch between "All time", "This week", and "Today" period filters
- [ ] Verify top 3 show medal emoji (gold, silver, bronze)
- [ ] Verify "Fastest" metric shows times formatted as MM:SS.s
- [ ] Verify leaderboard is accessible without being logged in (no auth gate)
- [ ] Verify leaderboard updates after solving a hand (go solve, come back, see your entry)

## 2. Speed Bonus

- [ ] Solve a hand quickly (mode 2 Quick is easiest — median is 5 seconds, threshold is 20%, so solve under 1 second)
- [ ] Verify the won panel shows a gold "⚡ Speed bonus!" tag
- [ ] Verify HB earned includes the speed bonus (+50 HB extra)
- [ ] Solve a hand slowly and verify NO speed bonus tag appears
- [ ] Check parent dashboard — HB balance should reflect speed bonus earnings

## 3. Daily Leaderboard Filter

- [ ] On the leaderboard page, click "Today"
- [ ] Verify only solves from today appear
- [ ] Solve a hand, go back to leaderboard with "Today" filter, verify your new solve is counted
- [ ] Click "This week" — should include all solves from the current week
- [ ] Click "All time" — should include everything

## 4. Mode Unlock UX

- [ ] On the play page, verify all 8 modes are visible (Quick through Wild)
- [ ] Locked modes show a 🔒 icon and dashed border
- [ ] Locked modes cannot be clicked/selected
- [ ] Hover over a locked mode — tooltip says "Solve 5 in [previous mode] to unlock"
- [ ] Below the mode pills, verify progress pips show (e.g., "3 more Classic solves to unlock Combo · 2/5")
- [ ] Solve a hand and verify the pip count updates immediately (no page refresh needed)
- [ ] After 5 solves in a mode, verify the next mode unlocks and becomes clickable
- [ ] If all modes are unlocked, verify no progress pips bar is shown

## 5. Modes 6–9

- [ ] Unlock and play **Expert (mode 6)** — 6 cards, target 144
- [ ] Verify 6 cards appear and the target pill shows "Make 144"
- [ ] Unlock and play **Power (mode 7)** — 7 cards, random target 300–500
- [ ] Verify the target changes each deal (it's random within range)
- [ ] Unlock and play **Master (mode 8)** — 8 cards, random target 501–999
- [ ] Unlock and play **Wild (mode 9)** — 9 cards, random target 1000–9999
- [ ] Verify cards scale down appropriately for 7/8/9 card hands (responsive sizing)
- [ ] Verify solves in modes 6–9 are recorded and appear on the leaderboard
- [ ] Verify HB is earned (base = mode × 5, so mode 9 = 45 HB base)
- [ ] Verify speed bonus works for modes 6–9 (median times: 40s/60s/90s/120s)

## 6. Landing Page Polish

- [ ] Visit `/` — should show centered card with ⚡ brand mark, "GTMath52" title
- [ ] "Play" button links to `/pin`
- [ ] "Parent sign-in" button links to `/login`
- [ ] Verify radial gradient background and card shadow match prototype style
- [ ] Verify fonts are Archivo (display) and the blue accent is royal blue #0000FF

## 7. PIN Page Polish

- [ ] Visit `/pin` — should show "Who's playing?" with player list (if players exist in session)
- [ ] Verify player rows have avatar circle, name, arrow
- [ ] Click a player → PIN entry screen appears
- [ ] Verify PIN dots animate (fill blue) as digits are entered
- [ ] Verify styled keypad with shadow/hover effects
- [ ] Enter wrong PIN — verify red error message with shake animation
- [ ] Enter correct PIN — redirects to `/play`
- [ ] "← Back" button returns to player picker
- [ ] Keyboard input works (0–9 digits, Backspace)

## 8. Dashboard Polish

- [ ] Sign in as parent, visit `/dashboard`
- [ ] Verify header with "GTMath52" brand, Leaderboard/Play/Sign out links
- [ ] Verify child cards show avatar, name, badge (Bronze/Silver/Gold if earned)
- [ ] Verify stat grid: Solves count, Day streak, Home Bucks balance
- [ ] Verify mode tags show unlocked modes by label name (Quick, Speed, etc.)
- [ ] Verify "Next milestone" text shows progress toward Bronze/Silver/Gold
- [ ] "Play as [name]" button navigates to PIN page with that child pre-selected
- [ ] "+ Add child" button opens inline form with styled inputs
- [ ] Create a new child — verify it appears in the list

## 9. Cross-Feature Integration

- [ ] Full flow: Landing → PIN → Play → Solve → check Leaderboard → check Dashboard
- [ ] Solve 5 hands in Quick mode → verify Speed mode unlocks
- [ ] Continue unlocking through modes and verify progress pips update correctly
- [ ] Verify HB balance on dashboard matches expected earnings (base + streak + speed bonus)
- [ ] Verify leaderboard "Today" filter shows only today's activity after a fresh solve

## 10. Edge Cases

- [ ] Try to access `/play` without logging in — should redirect to PIN
- [ ] Try to access `/dashboard` without parent auth — should redirect to login
- [ ] Refresh the play page mid-game — verify state resets cleanly (new deal on "Solve")
- [ ] Bust a hand — verify "No retry" message, "Next hand" button works
- [ ] Rapid-fire solves — verify HB and leaderboard stay consistent
- [ ] Open leaderboard in a separate browser tab (no login) — should work

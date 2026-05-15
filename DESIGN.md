# DESIGN.md

Design system for GTMath, derived from the Alpha Toronto Parents Hub brand and the high-fidelity prototype.

## Brand

- **Primary:** `--alpha-blue: #0000FF` (royal electric blue). Used for CTAs, active states, learning milestone cards, selected indicators.
- **Accent warm:** `--alpha-sun: #FFD24A` (announcements, offline banner). `--alpha-coral: #FF7A59` (sparingly).
- **Neutrals:** `--ink` through `--ink-4` for text hierarchy. `--paper` / `--paper-2` / `--paper-3` for backgrounds.
- **Semantic:** `--success: #0E8A5F`, `--warning: #B85C00`, `--danger: #C41E3A`.

## Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Display (h1) | Archivo | 800 | clamp(44px, 6.4vw, 92px) | -0.035em |
| Section (h2) | Archivo | 800 | clamp(36px, 4.4vw, 64px) | -0.03em |
| Title (h3) | Archivo | 700 | clamp(26px, 2.6vw, 36px) | -0.025em |
| Subtitle (h4) | Archivo | 600 | 22px | -0.01em |
| Body | Inter | 400 | 17px / 1.55 | -0.005em |
| Body large | Inter | 400 | 20px / 1.45 | |
| Body small | Inter | 400 | 14px / 1.5 | |
| Caption | Inter | 400 | 12px | 0.02em |
| Eyebrow | Archivo | 700 | 13px uppercase | 0.14em |
| Editorial | Instrument Serif | 400 italic | varies | -0.01em |
| Mono/numbers | ui-monospace | 400 | 13px | |

## Spacing Scale

`--s-1` (4px) through `--s-10` (128px). Use `--s-4` (16px) as default padding, `--s-5` (24px) for section gaps, `--s-7` (48px) for major section breaks.

## Radii

| Use | Token | Value |
|-----|-------|-------|
| Form inputs, small chips | `--r-sm` | 8px |
| Cards, containers | `--r-md` | 14px |
| Large cards, sections | `--r-lg` | 20px |
| Feature cards | `--r-xl` | 28px |
| Squircle cards (game) | `--r-2xl` | 40px |
| Buttons, pills, tags | `--r-pill` | 999px |

## Shadows

- `--shadow-sm`: subtle lift (form fields, small cards)
- `--shadow-md`: medium elevation (modals, dropdowns)
- `--shadow-lg`: high elevation (overlays, floating elements)
- `--shadow-blue`: blue glow (primary CTA hover, selected states)

## Motion

- `--ease-standard`: cubic-bezier(0.2, 0.8, 0.2, 1) -- default for UI transitions
- `--ease-soft`: cubic-bezier(0.33, 1, 0.68, 1) -- content reveals, page transitions
- `--dur-fast`: 150ms (micro-interactions: button press, toggle)
- `--dur-base`: 240ms (standard transitions: card expand, menu open)
- `--dur-slow`: 480ms (emphasis animations: celebration, mode unlock)

## Component Patterns

### Cards
- Default: `--r-md` radius, `--shadow-sm`, `--paper` background, `--s-4` padding.
- Elevated: `--shadow-md`. Used for modals, popovers.
- Accent: `--alpha-blue` background, white text. Used for learning milestone, primary CTAs.

### Buttons
- Primary: `--alpha-blue` background, white text, `--r-pill`, 48px height, Archivo 600.
- Secondary: `--paper` background, `--alpha-blue` text, `--border`, `--r-pill`.
- Ghost: transparent background, `--alpha-blue` text. Used inline.
- Destructive: `--danger` background, white text, `--r-pill`.

### Form Inputs
- 48px height, `--r-sm` radius, `--border` default, `--alpha-blue` border on focus.
- Label above input (never placeholder-as-label).
- Error: `--danger` border + error text below in `--danger` color.

### PIN Keypad (child-facing)
- Custom 3x4 grid, 64x64px buttons, `--r-md` radius, `--s-3` gaps.
- Archivo 700 at 24px for digits. Haptic on tap.
- PIN circles: 16px diameter, `--line` unfilled, `--alpha-blue` filled.

## Responsive Breakpoints

| Viewport | Width | Layout |
|----------|-------|--------|
| Mobile | <= 520px | Single column. Cards stack vertically. Game cards scale down. PIN keypad full-width. |
| Tablet | 521-1024px | Game uses 2-column card grid. Dashboard sections stack but with side padding. |
| Desktop | >= 1025px | Full layout. Dashboard uses grid (2-column for stats + calendar, full-width for charts). Max-width 1280px centered. |

Game cards: minimum touch target 44px. On mobile (<520px), reduce card count per row if needed.

## Accessibility

- **Touch targets:** 44px minimum on all interactive elements. PIN keypad: 64px.
- **Color contrast:** Body text on background >= 4.5:1. Large text (h1-h3) >= 3:1. Tested against `--ink` on `--paper`.
- **Keyboard navigation:** All interactive elements focusable. Focus ring: 2px `--alpha-blue` outline, 2px offset.
- **Screen readers:** ARIA landmarks on all pages (nav, main, complementary). Chart data available as table fallback. Game state announced via aria-live region.
- **Motion:** Respect `prefers-reduced-motion`. Disable card flip, celebration, and coach-mark animations. Keep functional transitions (page navigation).

## Child vs. Parent Visual Treatment

- **Child-facing (game, login):** Playful but not childish. Cards use `--r-2xl` (squircle). Larger touch targets. Animations more expressive (confetti, card flip). Archivo 800 for numbers.
- **Parent-facing (dashboard, auth):** Editorial, warm, trustworthy. `--paper-2` background. `--r-md` cards. Instrument Serif for accent text. Charts use Inter for labels. Feels like a premium school report, not a game analytics page.

# DESIGN.md — Gym Tracker

Approved direction: **Mix · Volt + C** (canvas "Gym Tracker – Design-Richtungen", row "Mix").

## 1. Visual Theme & Atmosphere
Dark training-tool feel: graphite ground, one neon accent the user picks, big confident numbers.
Keywords: energetic, focused, tactile, honest data. One line: *a training instrument, not a toy.*

## 2. Color Palette & Roles
```css
--bg: #0F100E;        /* rgb 15 16 14   ground */
--surface: #181A17;   /* rgb 24 26 23   cards */
--surface-2: #1D1F1B; /* tab bar, raised */
--surface-hi: #1A1C18;/* active exercise card */
--inset: #0F100E;     /* inputs, set rows */
--line: #262924;      /* hairlines, empty ring */
--line-2: #3A3E36;    /* empty checkboxes */
--text: #F2F3EE;
--text-2: #C9CCC2;
--muted: #8E9388;     /* ≥ 4.5:1 on --surface */
--danger: #FF7A6B;
--accent: var(--user-accent);  /* see presets */
--on-accent: #0F100E;          /* text on accent is ALWAYS dark */
```
Accent presets (Profil): Volt `#D7FF3F` (default) · Cyan `#3FE0FF` · Blau `#4D8DFF` · Pink `#FF4FD8` · Orange `#FF7A2F` · Grün `#3FFF8B`.
Charts: weight = accent line + accent→transparent area; reps = `--text` bars (old/plateau-irrelevant bars `#33362F`).

## 3. Typography
- Display / UI: **Archivo** (variable `wdth 62..125`, `wght 400..900`). Screen titles uppercase at `font-stretch:125%`, weight 900. Big stats at `font-stretch:72%`, weight 800.
- Numbers: **Geist Mono**, always `tabular-nums`.
- Scale: 44 title · 30 page title · 24 card title · 17 picker · 15 body · 13 meta · 12 caption · 11 tab label / mono caps.
- Inputs ≥ 16px (no iOS zoom).

## 4. Components
- **Card**: `--surface`, radius 16 (rows) / 20–24 (feature cards). No borders, no left-border accents.
- **Active exercise card**: `--surface-hi`, radius 24, accent ring + soft accent glow (breathing 3s). Header: name + "2 × 8–10 · 90 s"; pill "Letztes Mal 35 × 7 · 6" (accent at 14 % bg). Set row = inset pill radius 18: index · `kg` · × · `Wdh` · round 44px check. Current row has accent inset ring + caret. "+1" badge pops when reps beat last time. Goal hint line with star.
- **Collapsed exercise row**: check square 26px radius 8 (accent filled when done), name, mono summary.
- **Day selector**: 4 equal buttons 44px radius 12; active = accent bg + dark text.
- **Progress ring**: 56px, accent stroke, done/total in mono.
- **Tab bar**: floating, inset 16px, 64px high, radius 22, `--surface-2`, shadow. **Active indicator is a pill that slides on rails** to the tapped tab (shared layout animation, spring). Icon + label, active = accent.
- **Buttons**: primary = accent bg / dark text, radius 12–14, height ≥ 44. Hover/active: brightness + scale .97. Focus: 2px accent outline, offset 2. Disabled: 40 % opacity.
- **Sheets**: slide up from bottom, radius 24 top, drag handle, backdrop fade.

## 5. Layout
Mobile-first, max width 480 centered. Side padding 20. Vertical rhythm 8/12/16/18/20. Bottom content padding 110px (tab bar). Safe areas via `env(safe-area-inset-*)`.

## 6. Depth & Elevation
Flat surfaces; elevation only for tab bar (`0 12px 32px rgba(0,0,0,.5)` + 1px inner line) and sheets. Active card uses accent glow instead of shadow.

## 7. Animation & Interaction (level L2, app-scale)
- Screen enter: children slide up 14–16px + fade, stagger 70ms, `cubic-bezier(.2,.8,.2,1)` 450ms.
- Tab switch: indicator pill springs to new tab (`stiffness 500, damping 38`); page cross-fades + 8px slide.
- Check: circle pops (scale .4→1.18→1), tick draws (stroke-dashoffset), haptic `navigator.vibrate(10)` where supported.
- "+1 / PR": badge pops; PR badge wobbles in.
- Chart: line draws 1.2s, area fades in after, reps bars grow with spring, last point pings.
- Ring: dash offset animates to new value.
- Drag & drop (plan): lifted item scales 1.03 + shadow, others glide.
- `prefers-reduced-motion`: all motion off, state changes instant.
Animate only `transform` and `opacity` (plus SVG stroke offsets). Never `transition: all`.

## 8. Do's and Don'ts
- Do keep exactly one accent; everything else graphite + white.
- Do put dark text on the accent, always.
- Do use tabular mono for every number.
- Do show last session values next to every input.
- Do give every icon-only button an `aria-label`.
- Don't use gradient washes as backgrounds.
- Don't use emoji as icons (inline stroke SVG / lucide).
- Don't use Inter/Roboto/Arial.
- Don't animate layout properties.
- Don't use color alone to signal state (checks + text too).
- Don't hide the tab bar behind content; keep 110px bottom padding.

## 9. Responsive
Phone first (360–430). Above 480px the app stays a centered column. Touch targets ≥ 44×44. No horizontal overflow at 360px.

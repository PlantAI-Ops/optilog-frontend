---
name: OptiLog
description: "Operational record & intelligence layer - a control-room interface for the factory floor."
colors:
  primary: "oklch(0.79 0.17 74)"
  primary-foreground: "oklch(0.19 0.03 60)"
  record: "oklch(0.65 0.24 25)"
  record-foreground: "oklch(0.99 0.004 250)"
  destructive: "oklch(0.63 0.22 27)"
  warning: "oklch(0.82 0.16 85)"
  success: "oklch(0.72 0.16 155)"
  background: "oklch(0.17 0.012 260)"
  foreground: "oklch(0.98 0.004 250)"
  card: "oklch(0.235 0.014 258)"
  secondary: "oklch(0.31 0.016 258)"
  muted: "oklch(0.29 0.014 258)"
  muted-foreground: "oklch(0.78 0.012 255)"
  accent: "oklch(0.34 0.018 258)"
  border: "oklch(0.38 0.016 258)"
  input: "oklch(0.38 0.016 258)"
  ring: "oklch(0.79 0.17 74)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.333
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "0.05em"
  stat:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "normal"
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  2xl: "22px"
  3xl: "26px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-floor-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.headline}"
    rounded: "{rounded.3xl}"
    height: "80px"
    width: "100%"
    padding: "0 32px"
  button-floor-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.headline}"
    rounded: "{rounded.2xl}"
    height: "56px"
    padding: "0 24px"
  button-floor-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    height: "56px"
    padding: "0 24px"
  button-console-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  input-floor:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    height: "56px"
    padding: "0 16px"
    width: "100%"
  input-console:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
    width: "100%"
  field-label:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  card-floor:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  card-console:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
  stat-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.stat}"
    rounded: "{rounded.xl}"
    padding: "16px"
  chip-source:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: OptiLog

## Overview

**Creative North Star: "The Control Room at 3 a.m."**

OptiLog looks the way a plant looks when the lights are down and one person is
responsible for what happens next: dark steel surfaces, a single amber signal
that means *this is the action*, and no ornament anywhere. The interface is
instrumentation. It reports state and gets out of the way. Nothing is styled to
be liked; everything is styled to be read at arm's length, in a noisy room, by
someone who has thirty seconds and gloves on.

The system runs on two densities because it serves two scenes. The **floor
world** - login, start shift, record, confirm, timeline, end shift - is a
single 448px column of oversized, weight-900 controls with radii generous
enough to read as physical buttons. The **console world** - dashboard, events,
shifts, RCA, admin - is a dense desktop shell of 1px-bordered plates, 14-16px
text and restrained 12-18px radii. They share one OKLCH palette, one radius
base and one type stack; only the scale changes. Colour never decorates: amber
is the action, red is the recording, and green/yellow/red report facts that are
actually true in the system.

Confirmed visual rejection: consumer-app softness - pastel gradients, playful
illustration, airy SaaS whitespace, and anything that reads as friendly rather
than dependable.

**Key Characteristics:**
- Flat surfaces; depth comes from a 1px border plus a step in the surface ladder.
- Weight contrast does the hierarchy work: 900 on the floor, 600/700 in the console.
- Colour is semantic and rationed; the palette is near-monochrome until a signal fires.
- Two densities, one system: `rounded-2xl/3xl` and 56-80px targets on the floor, `rounded-xl/lg` and 36px targets in the console.
- Every field label is uppercase, 12px, weight 700, wide-tracked.
- Numbers that get compared are tabular.

## Colors

The palette is near-black steel with one hot amber accent and a small set of
loud status signals - industrial high-contrast, defined once in OKLCH in
`src/styles.css` and mirrored per-theme in a `.dark` block.

### Primary
- **Safety Amber** (`oklch(0.79 0.17 74)`): the action colour. Every primary
  button on both surfaces, the focus ring (`--ring`), the OPTILOG wordmark, the
  "confirmed" status glyph, the active nav item's text, and inline links in the
  console. It appears because something can be *done* or *is currently true*.
- **Amber Ink** (`oklch(0.19 0.03 60)`): the text colour on any Safety Amber
  fill. Amber is light enough that white fails contrast against it, so amber
  surfaces always carry this dark ink.

### Secondary
- **Emergency Stop Red** (`oklch(0.65 0.24 25)`): `--record`. Reserved for the
  record puck and the 13-bar recording waveform - the one element on the
  product that means "the microphone is live." Nothing else may use it.

### Tertiary
Status signals - chromatic, but never decorative:
- **Running Green** (`oklch(0.72 0.16 155)`): resolved events, the "Data layer
  live" dot, online indicator, success tones on dashboard stats.
- **Caution Lamp** (`oklch(0.82 0.16 85)`): unresolved/investigating status,
  downtime figures, pending-sync badge, carryover-issue banners.
- **Fault Red** (`oklch(0.63 0.22 27)`): destructive actions, error banners,
  active-issue counts, offline indicator.

### Neutral
A cold blue-grey ramp at hue ~258, stepping from page to plate to well:
- **Steel Black** (`oklch(0.17 0.012 260)`): `--background`, the page canvas on
  both surfaces. Dark because the use scene is a dim plant floor and a control
  room, not because dark is fashionable.
- **Console Plate** (`oklch(0.235 0.014 258)`): `--card`. Every card, the
  sticky headers, the console rail - the elevated reading surface.
- **Recessed Well** (`oklch(0.31 0.016 258)`): `--secondary`. Steps *below*
  the card: input backgrounds, transcript wells, inactive nav hover, secondary
  buttons.
- **Slate Line** (`oklch(0.38 0.016 258)`): `--border` / `--input`. The single
  1px rule that separates every surface in the product.
- **Ash Text** (`oklch(0.78 0.012 255)`): `--muted-foreground`. Captions,
  field labels, inactive nav items, table meta.
- **Signal White** (`oklch(0.98 0.004 250)`): `--foreground`. Body and value
  text on every dark surface.
- **Focus Amber** (`oklch(0.79 0.17 74)`): `--ring`, identical to primary -
  focus is always the action colour.

### Named Rules
**The Amber Rarity Rule.** Safety Amber marks the one thing to do next. If two
amber elements compete on a screen, one of them is wrong.

**The Signal-Only Rule.** Green, yellow and red only appear where they report
system truth - a real status, a real count, a real connection. Never as an
accent, a hover, or a category colour.

**The One-Format Rule.** Colour is authored in OKLCH only. New semantic tokens
are added to `:root`, to `.dark`, and registered in `@theme inline` - three
places, one value.

## Typography

**Display Font:** the platform system sans (Tailwind v4's default
`--font-sans`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
'Helvetica Neue', 'Noto Sans', Arial, sans-serif`). No webfont is loaded for
this project.
**Body Font:** the same stack.
**Label/Mono Font:** the same stack, uppercased and tracked; there is no mono
role.

**Character:** the typeface is deliberately unremarkable, so hierarchy is
carried entirely by weight and case - 900 against 400, uppercase against
sentence case. The result reads as instrumentation rather than editorial:
blunt, wide, and legible in motion. Display personality is earned through
`tracking-[0.2em]` on the OPTILOG wordmark, `-0.025em` tracking on large
headlines, and italic quotation for transcribed speech.

### Hierarchy
- **Display** (900, 1.875rem / 30px, 1.2, -0.025em): floor screen titles -
  "OptiLog", "Good morning, {name}." Set at `text-3xl font-black tracking-tight`.
- **Headline** (900, 1.5rem / 24px, 1.333): floor section headers -
  "Shift timeline", "How long was the stoppage?", the record puck's
  RECORD/STOP label. A 2.25rem / 36px variant (`text-4xl font-black`) carries
  the floor stat numbers.
- **Title** (600, 1.125rem / 18px, 1.556, -0.025em): console page `h1`, dialog
  titles, card titles. Console tables and list rows use the 14px/500 variant;
  timeline row titles use 18px/900.
- **Body** (400, 1rem / 16px, 1.5): floor prose and values. The console runs a
  denser body at 0.875rem / 14px with weight 400-500 for meta text.
- **Label** (700, 0.75rem / 12px, 1.333, 0.05em, uppercase): every field label
  and micro-label - `text-xs font-bold uppercase tracking-wider
  text-muted-foreground`. Console table headers drop to weight 500 with
  `tracking-wide` (0.025em).
- **Stat** (700, 1.5rem / 24px, 1.333, `tabular-nums`): console dashboard
  numbers inside `StatCard`.

### Named Rules
**The 900 Rule.** Anything a person must read while standing - floor headlines,
button labels, timestamps, stat numbers - is weight 900. Nothing on the floor
is lighter than 500.

**The Uppercase Micro-Label Rule.** Field labels are always uppercase, 12px,
weight 700, +0.05em tracking, in Ash Text. A 12px label in sentence case is a
defect.

**The Tabular Numeral Rule.** Any number that will be compared down a column or
across a row - achievement %, downtime, counts, clock times - is set with
`tabular-nums`.

## Layout

OptiLog has two spatial models sharing one spacing rhythm built on Tailwind's
4px scale.

**Floor (single column, mobile-first).** A centred `max-w-md` (448px) column
on Steel Black, `px-4` (16px) gutters, `pt-4 pb-8`. A sticky `bg-card` header
with a 1px bottom rule pins the wordmark, the surface title, and 44px icon
buttons. Content stacks vertically and always ends in a full-width action
block - the primary CTA is never hidden inside a menu. Groups separate by
12-16px; sections by 24px.

**Console (rail + main).** A flex shell: a sticky `w-60` (240px) `bg-card`
rail with a 1px right rule, hidden below 1024px; a main column with `px-6
py-6` (24px) gutters and a sticky `bg-card/95 backdrop-blur` header carrying
the page title, subtitle, plant pill, live pill and sign-out. Below 1024px the
rail collapses into a horizontally scrolling nav strip inside the header.
Content uses 12-16px grid gaps: 4-up stats (`sm:grid-cols-2 xl:grid-cols-4`)
and 3-up panels (`xl:grid-cols-3`, primary panel spanning 2).

**Breakpoints.** Tailwind defaults - 640 / 768 / 1024 / 1280px. The console's
structural switch is `lg` (1024px): rail in, mobile nav strip out. The JS
mobile detector (`src/hooks/use-mobile.tsx`) triggers at 768px.

**Responsive behaviour.** Floor screens are written once for 448px and simply
scale down; nothing reflows into a second column. Console grids collapse
4 to 2 to 1 and 3 to 1, tables stay full-width and scroll, and the nav becomes
a strip rather than a drawer.

### Named Rules
**The Reach Rule.** On the floor every text control is at least 56px tall and
every primary CTA is 64-80px; icon controls are at least 44px. Gloved hands,
glare and a moving line are the design conditions, not an edge case.

**The Bottom-Anchor Rule.** The floor's committing action lives at the bottom
of the column, full width, in thumb reach - never in a header, a dropdown, or a
fifth card down.

## Elevation & Depth

This is a flat system. Surfaces do not float: depth is expressed by a single
1px Slate Line border combined with a step in the surface ladder - Steel Black
page, then Console Plate card, then Recessed Well input. Shadow is reserved for
genuinely floating layers: modal dialogs, their scrims (`bg-black/50` on the
floor, `bg-black/80` on shadcn dialogs), and toasts. The floor world uses no
shadows at all.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px
  rgb(0 0 0 / 0.1)` - Tailwind `shadow`): applied to the shadcn `Card`
  primitive. The one surface that carries a light shadow *and* its 1px border;
  the border is the real signal.
- **Outline / secondary rest** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0
  1px 2px -1px rgb(0 0 0 / 0.1)` - Tailwind `shadow-sm`): shadcn `outline` and
  `secondary` button variants, shadcn `Input` - a hairline lift, not a float.
- **Overlay lift** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px
  -4px rgb(0 0 0 / 0.1)` - Tailwind `shadow-lg`): dialog and alert-dialog
  content, the Sonner toast. Combined with a full-bleed scrim, this is the only
  depth the user reads as "above the page."
- **Field focus** (no shadow): floor fields signal focus by shifting their
  border to Focus Amber (`focus:border-ring`); shadcn fields use a 1px
  `ring-ring` outline, and the calendar uses a 3px `ring-ring/50` halo.

### Named Rules
**The Flat-By-Default Rule.** A new surface starts flat: `border` plus a
surface step. Shadow is earned only by something that floats above the page.

## Shapes

One radius base drives everything: `--radius: 0.875rem` (14px), from which
`rounded-sm` 10px, `rounded-md` 12px, `rounded-lg` 14px, `rounded-xl` 18px,
`rounded-2xl` 22px, `rounded-3xl` 26px and `rounded-4xl` 30px are derived.

The form language splits by density. The **console** uses 12-14px corners -
plate-like, square-ish, engineered; shadcn `rounded-md` on buttons and inputs,
`rounded-lg` on nav items, `rounded-xl` on cards. The **floor** uses 18-22px
corners on cards, wells, fields and standard buttons, and 26px on the hero
CTAs, so the controls read as physical, glove-friendly objects. `rounded-full`
is reserved for the record puck, waveform bars and the console's header pills.

Borders are always exactly 1px in Slate Line. The only dashed border is the
empty-state panel on the shift timeline. Status banners tint the border rather
than thickening it: `border-destructive/40` over `bg-destructive/10`.

### Named Rules
**The One-Pixel Rule.** Every border is 1px. Depth comes from the surface step,
never from a heavier line or a coloured side bar.

**The Radius Split Rule.** Floor surfaces are 22px or wider, console surfaces
are 18px or less. Never carry a floor radius into the console or vice versa.

## Components

### Buttons
- **Shape:** floor `rounded-2xl` (22px) standard, `rounded-3xl` (26px) hero,
  full-width; console `rounded-md` (12px), inline.
- **Primary (floor hero):** Safety Amber fill with Amber Ink text, 80px tall
  (`h-20`), weight 900, 24-32px horizontal padding. Used for "Start Logging",
  "Confirm", "End shift", "Back to recording".
- **Primary (floor standard):** 56px (`h-14`), 22px radius, weight 900; in a
  pair it takes `flex-[2]` so it is visibly the larger choice.
- **Secondary (floor):** Recessed Well fill, 1px Slate Line border,
  `text-secondary-foreground`, weight 700, 56px - the cancel/skip role, paired
  at `flex-1`. A neutral `bg-card` variant covers tertiary actions ("Manual",
  "End Shift").
- **Console:** shadcn `Button` - default 36px (`h-9 px-4`), `text-sm
  font-medium`; sizes `sm` 32px, `lg` 40px, `icon` 36x36. Variants `default`
  (amber), `destructive`, `outline`, `secondary`, `ghost`, `link`.
- **Hover / Focus:** floor controls are press-driven - `transition-transform
  active:scale-95` on the record puck, opacity 40-60% when disabled, and no
  hover state (the floor is touch). Console controls use `transition-colors`
  with `hover:bg-primary/90` (or `/80` on secondary) and
  `focus-visible:ring-1 ring-ring`.

### Chips
- **SourceBadge / status chip:** `rounded-md` (12px), 1px border, Recessed Well
  fill, 11px weight 600, uppercase, wide tracking, Ash Text. Used for event
  source, shift status, and category tags.
- **Header pill:** `rounded-full`, 1px border, `px-3 py-1`, 12px - plant name,
  "Data layer live" (paired with an 8px Running Green dot), sign-out.
- **Pending-sync badge:** pill on `bg-warning/20` with Caution Lamp text and a
  cloud glyph, floor header only.
- **Event status glyph:** a Lucide circle icon tinted Running Green (resolved),
  Caution Lamp (investigating), Safety Amber (confirmed) or Ash Text (draft).

### Cards / Containers
- **Corner Style:** floor `rounded-2xl` (22px); console `rounded-xl` (18px).
- **Background:** Console Plate on Steel Black; inner wells step *down* to
  Recessed Well so speech and inputs read as recessed.
- **Shadow Strategy:** flat - see Elevation & Depth. The shadcn `Card`
  primitive is the sole resting surface carrying `border` plus `shadow`.
- **Border:** 1px Slate Line.
- **Internal Padding:** floor 16px (`p-4`); console stat/list cards 16px,
  shadcn `Card` 24px (`p-6`).

### Inputs / Fields
- **Style:** floor - 56px tall (`h-14`), `rounded-2xl` (22px), Recessed Well
  fill, 1px `border-input`, 16-18px text, no resting shadow; textareas use
  `rounded-xl` (18px) with 12px padding and a capped height (`max-h-40`).
  Console/shadcn - 36px (`h-9`), `rounded-md` (12px), transparent fill,
  `shadow-sm`, 14px text.
- **Label:** always above the control, never floated or inside as a placeholder:
  12px / 700 / uppercase / +0.05em / Ash Text.
- **Focus:** floor shifts the border to Focus Amber (`focus:border-ring`) with
  no halo; shadcn uses `focus-visible:ring-1 ring-ring`.
- **Error / Disabled:** error banners are `border-destructive/40` +
  `bg-destructive/10` with Fault Red text, at `rounded-2xl` on the floor and
  `rounded-xl` in the console. Disabled = `opacity-40/50/60` plus
  `cursor-not-allowed` on shadcn controls.

### Navigation
- **Console rail:** sticky, 240px (`w-60`), Console Plate, 1px right rule,
  visible at `lg` and up. Items are `rounded-lg` (14px), `px-3 py-2`, 14px/500,
  with a 16px icon at 12px gap. Active = `bg-secondary text-foreground`;
  inactive = Ash Text with `hover:bg-secondary/60`. The rail opens with the
  amber `tracking-[0.2em]` OPTILOG wordmark over a 12px "Operations console"
  caption, and closes with a bordered "Mobile capture app" link.
- **Console mobile (below 1024px):** a horizontally scrolling nav strip inside
  the sticky header - `rounded-lg px-3 py-1.5`, 12px, active `bg-secondary`.
- **Floor header:** sticky, Console Plate, `px-4 py-3`, 1px bottom rule. The
  OPTILOG wordmark is 12px weight 900 with `tracking-[0.2em]` in Safety Amber,
  stacked over a 12px Ash Text surface title. Right side: a 44px bordered
  console shortcut, the pending badge, and 44px connectivity/sign-out buttons.
- **Floor back control:** 36px square, `rounded-xl`, Safety Amber, oversized
  24px chevron.

### Signature Components
**The Record Puck.** 224px (`size-56`) circle, Emergency Stop Red fill,
`rounded-full`, `transition-transform active:scale-95`, a 64px stop square or
80px mic glyph over a 24px weight-900 label reading RECORD / STOP / .... While
recording, a live `AnalyserNode` writes an inline glow -
`box-shadow: 0 0 {8-43}px rgba(239, 68, 68, {0.2-0.8})` - whose spread tracks
input level; a `shiftlog-pulse` keyframe ring (1.4s ease-out, via the
`record-pulse` utility) and a 13-bar `animate-pulse` waveform in Emergency Stop
Red accompany it. This is the product's one expressive moment; nothing else
animates at this amplitude.

**Stat tile.** Floor variant: `rounded-2xl border bg-card px-4 py-3`, value at
36px weight 900 (Caution Lamp when a warning value is above zero), label 14px
Ash Text. Console `StatCard`: `rounded-xl border bg-card p-4`, 12px uppercase
Ash Text label, value 24px weight 700 `tabular-nums`, tone in Running Green /
Caution Lamp / Fault Red, plus a 12px hint line.

**The Two-Button Footer.** Cancel at `flex-1` in Recessed Well with a 1px
border, confirm at `flex-[2]` in Safety Amber - both 56px, weight 700/900,
12px apart. The asymmetric split encodes which action is the real one. Appears
in `EventEditor`, the clarify step, and every floor dialog.

**Transcript Well.** `rounded-xl bg-secondary p-3`, capped at 128-192px with
vertical scroll, a 12px uppercase weight-700 label ("Transcript", "Live
preview", "Original transcript"), then the speech in italic 14-16px inside
quotes. It is always visually distinct from structured fields - raw human
speech is evidence, not data.

**Confirm Card (the audit card).** `rounded-2xl border bg-card p-4` headed by a
24px weight-900 `{asset} - {event_type}`, then a stack of `CardLine` pairs:
12px uppercase Ash Text label over an 18px value. Observation, Reported cause,
Suspected cause, Verified cause and Action taken each get their own pair and
are never merged.

## Do's and Don'ts

### Do:
- **Do** author colour in OKLCH in `src/styles.css`, and register every new
  semantic token in all three places: `:root`, `.dark`, and `@theme inline`.
- **Do** set floor copy at weight 900 for anything read standing up, and console
  copy at 14-16px with weight 400-600.
- **Do** make every floor text control at least 56px and every floor icon
  control at least 44px; hero CTAs are 64-80px.
- **Do** label every field `text-xs font-bold uppercase tracking-wider
  text-muted-foreground`, placed above the control.
- **Do** apply `tabular-nums` to any number compared across rows or columns.
- **Do** express depth with a 1px `border-border` plus a surface step
  (`background` to `card` to `secondary`).
- **Do** tint status banners at 10% fill / 40% border (`bg-warning/10
  border-warning/40`, `bg-destructive/10 border-destructive/40`).
- **Do** keep Observation, Reported cause, Suspected cause, Verified cause and
  Action taken as separately labelled blocks in every surface that shows them.
- **Do** keep the two-density split: floor `rounded-2xl`/`rounded-3xl` with
  56-80px targets, console `rounded-xl`/`rounded-lg` with 36px targets.
- **Do** reserve `shadow-lg` for floating layers and `transition-colors` for
  console hover states.

### Don't:
- **Don't** introduce hex, `rgb()`, or HSL colour literals - OKLCH is the
  project's normative format. (One existing exception: the record puck's inline
  audio glow is `rgba(239, 68, 68, alpha)`; new work stays on tokens.)
- **Don't** use `bg-info`, `text-info` or `border-info` - `--color-info` is not
  defined, so those utilities silently do nothing. Use `primary`, `warning` or
  `destructive`.
- **Don't** render a status colour as decoration. Running Green, Caution Lamp
  and Fault Red report real system state only.
- **Don't** give floor controls hover-only affordances; the floor is touch-first
  and has no pointer.
- **Don't** add a resting shadow to a new surface - border plus surface step.
- **Don't** exceed 1px on a border, and never use a coloured `border-left` /
  `border-right` rule as an accent.
- **Don't** set a 12px label in sentence case, or replace the uppercase label
  with a placeholder.
- **Don't** collapse Observation / Reported cause / Verified cause into a single
  description field.
- **Don't** put the floor's committing action anywhere but the bottom of the
  column, full width.
- **Don't** animate at record-puck amplitude anywhere else - one expressive
  moment per screen, maximum.

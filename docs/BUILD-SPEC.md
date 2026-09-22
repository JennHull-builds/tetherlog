# TetherLog build spec

**What is specified but not yet built.** Phases 1 and 2 are done; this file covers Phase 3 onward.

> ## The direction changed. Read this before using sections 1 and 2.
>
> **`docs/LOOK.md` is the binding visual direction: the gravity well / refraction lens**, approved
> 2026-09-18. See `docs/DECISIONS.md` D-007.
>
> **Sections 1 and 2 below were written for Depth Field, which is dead.** They are kept as
> reference, not as the target, because the contrast ratios and the motion physics were real work
> and a new palette still has to clear the same bars. **The mechanism in them is wrong**: there is
> no `Plane` primitive, no plane-distance model and no variable font width axis in the direction
> being built.
>
> **What to take from them:** the contrast-checked ratios, the spring physics, the semantic token
> naming, the reduced-motion pairs, and the per-surface layout and copy decisions.
> **What to ignore:** every mention of planes, `wdth`, `distance`, near/mid/far as a depth model,
> and the elevation scale factors.
>
> **Phases 3 and 4 in section 3 have been rewritten against `docs/LOOK.md`** and are current.
> Phases 5 to 7 are largely direction-agnostic and were corrected where they named a dead token.

When a phase completes, its section here is deleted and replaced by a decision entry in
`docs/DECISIONS.md`. This file should shrink to nothing.

---

## 1. Target token values (SUPERSEDED, reference only)

DTCG format, `$value` / `$type` / `$description`. `src/tokens/tokens.json` currently still holds
NIL's light values on purpose: Phase 2 proved the pipeline before the design changed. Phase 3
replaces them, but **with a palette derived from `docs/LOOK.md`, not with the values below.**

Every colour was contrast-checked before it went in, and the ratio lives in the token's own
`$description` so it travels with the value instead of sitting in a document nobody rereads.

```jsonc
{
  "$schema": "https://tr.designtokens.org/format/",

  // ─── PRIMITIVE ─────────────────────────────────────────────────────────
  // Raw values. No component may read these.

  "color": {
    "$type": "color",
    "plane": {
      "ground": { "$value": "#0a0b0e", "$description": "Deep space. Everything is measured from here." },
      "far":    { "$value": "#0d0e11", "$description": "Furthest plane. Navigation, ambient chrome." },
      "mid":    { "$value": "#121419", "$description": "Middle distance. The log, parked thoughts." },
      "near":   { "$value": "#1a1c21", "$description": "Near plane. The capture field lives here." },
      "nearer": { "$value": "#1f2229", "$description": "Near plane, focused. One step closer." }
    },
    "ink": {
      "near": { "$value": "#f5f6f8", "$description": "18.20:1 on ground. Anything you are meant to read." },
      "mid":  { "$value": "#9ca3ae", "$description": "7.74:1 on ground, 7.25:1 on plane.mid." },
      "far":  { "$value": "#616873", "$description": "3.50:1. NON-TEXT ONLY. Clears WCAG 1.4.11, fails AA for body copy, deliberately. Text promoted to readable moves forward a plane." },
      "placeholder": { "$value": "#8b919c", "$description": "6.21:1 on ground." }
    },
    "accent": {
      "base": { "$value": "#8b7bff", "$description": "5.97:1 on ground; ground on it is 5.97:1. Appears on the near plane only, so colour itself encodes distance." },
      "high": { "$value": "#a99cff", "$description": "8.33:1 on ground. Focus bar and confirm." }
    },
    "bucket": {
      "now":    { "$value": "#ff9e7a", "$description": "9.77:1 on ground." },
      "later":  { "$value": "#e0c06a", "$description": "11.17:1 on ground." },
      "wonder": { "$value": "#b8a6ff", "$description": "9.31:1 on ground." },
      "do":     { "$value": "#6fd9a8", "$description": "11.40:1 on ground." },
      "drop":   { "$value": "#616873", "$description": "3.50:1. Marker only, never the sole carrier of a state." },
      "write":  { "$value": "#7ac4e8", "$description": "Reserved for ROADMAP Phase 8. 9.86:1 on ground." }
    },
    "danger": { "$value": "#ef8a76", "$description": "8.44:1 on ground. Destructive only, never a triage bucket." },

    // Light mode. Atmospheric perspective runs the other way: far planes go
    // LIGHTER, and the accent darkens to hold 4.5:1.
    "light": {
      "ground": { "$value": "#eceef2" },
      "far":    { "$value": "#e6e8ed" },
      "mid":    { "$value": "#f2f3f6" },
      "near":   { "$value": "#fbfbfd" },
      "ink":    { "$value": "#14161a", "$description": "15.82:1 on light ground." },
      "ink-mid":{ "$value": "#4d535d", "$description": "7.41:1." },
      "ink-far":{ "$value": "#878d97", "$description": "3.12:1. Non-text only, same rule as dark." },
      "accent": { "$value": "#4a35d6", "$description": "7.93:1 on light ground." }
    }
  },

  "space": {
    "$type": "dimension",
    "base":   { "$value": "0.25rem", "$description": "Tailwind v4 derives the whole scale from this. See CLAUDE.md: never partially override --spacing-N." },
    "gutter": { "$value": "1.125rem", "$description": "Page inset at 390px." },
    "plane":  { "$value": "0.75rem",  "$description": "Inner padding of a plane." }
  },

  "type": {
    "font": {
      "$type": "fontFamily",
      "display": { "$value": ["Anybody", "system-ui", "sans-serif"], "$description": "Variable, wdth 75-125 + wght 300-800. Self-hosted, 55.5 KB latin subset." },
      "body":    { "$value": ["Anybody", "system-ui", "sans-serif"], "$description": "Same file. One voice; width carries the depth, not family." },
      "data":    { "$value": ["DM Mono", "ui-monospace", "monospace"], "$description": "Self-hosted, 14.5 KB. Counts, timestamps, durations." }
    },
    "width": {
      "$type": "number",
      "$description": "THE DEPTH CUE. Moves in lockstep with plane and contrast; never set independently.",
      "near":   { "$value": 108, "$description": "Capture input, readable body." },
      "display":{ "$value": 118, "$description": "Screen headline and Patterns numerals." },
      "mid":    { "$value": 92,  "$description": "The log, secondary copy." },
      "far":    { "$value": 85,  "$description": "Peek items, chips at rest, navigation." }
    },
    "size": {
      "$type": "dimension",
      "xs":   { "$value": "0.75rem",  "$description": "Chips, mono readouts. 12px." },
      "sm":   { "$value": "0.875rem" },
      "base": { "$value": "1rem" },
      "lg":   { "$value": "1.125rem", "$description": "Capture input. Never below this." },
      "xl":   { "$value": "1.5rem" },
      "2xl":  { "$value": "1.875rem", "$description": "Screen headline at 390px." },
      "3xl":  { "$value": "3rem",     "$description": "Patterns numerals." }
    },
    "weight": {
      "$type": "fontWeight",
      "light":   { "$value": 300, "$description": "Far plane only." },
      "regular": { "$value": 400 },
      "medium":  { "$value": 500 },
      "bold":    { "$value": 700, "$description": "Display and the one action per screen." }
    }
  },

  "motion": {
    "spring": {
      "$type": "cubicBezier",
      "$description": "Named for the moment in the arc, never for the shape. Each carries its reduced-motion counterpart. linear() values are emitted by scripts/build-tokens.mjs.",
      "focus": {
        "$value": { "stiffness": 900, "damping": 60, "mass": 1 },
        "$description": "Is it listening? Zeta 1.000, 230ms, no overshoot. Certainty, not personality.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "commit": {
        "$value": { "stiffness": 480, "damping": 34, "mass": 1.1 },
        "$description": "Did it take it? Zeta 0.740, 320ms, 3.2% overshoot. The only token allowed to overshoot. Mass above 1 on purpose: a thought handed over should have weight.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "settle": {
        "$value": { "stiffness": 620, "damping": 50, "mass": 1 },
        "$description": "Can I go now? Zeta 1.004, 270ms. Starts at +120ms so it overlaps commit; total arc 420ms.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "dismiss": {
        "$value": { "stiffness": 1200, "damping": 70, "mass": 1 },
        "$description": "Leaving without ceremony: chip deselect, error clear, triage card exit. Zeta 1.010, 200ms.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      }
    },
    "duration": {
      "$type": "duration",
      "instant": { "$value": "1ms",   "$description": "The reduced-motion value for everything." },
      "confirm": { "$value": "600ms", "$description": "How long the confirm word holds under full motion." },
      "confirm-reduced": { "$value": "1200ms", "$description": "Longer under reduced motion: the word carries more of the answer." }
    },
    "easing": {
      "$type": "cubicBezier",
      "standard": { "$value": [0.2, 0, 0, 1], "$description": "Non-spring transitions: colour, opacity off the arc." }
    }
  },

  "elevation": {
    "$type": "number",
    "$description": "There are no shadows in this system. Depth is scale, and it moves with type.width and plane colour as one effect. Numbers are transform scale factors.",
    "near-rest":  { "$value": 1,     "$description": "The near plane at rest." },
    "near-focus": { "$value": 1.035, "$description": "One step closer on focus." },
    "recede":     { "$value": 0.92,  "$description": "Where a committed thought lands." },
    "mid":        { "$value": 0.965, "$description": "Second row of the log." },
    "far":        { "$value": 0.93,  "$description": "Third row and beyond." },
    "commit-light": {
      "$value": 0.22,
      "$description": "BORROWED FROM APERTURE. Peak alpha of the one light event in the system, at the handover. Radial, centred on the field, 320ms, nowhere else in the app."
    }
  },

  // ─── SEMANTIC ──────────────────────────────────────────────────────────
  // Roles. Components read ONLY these. Names describe distance, not palette,
  // so they survive a direction change.

  "semantic": {
    "ground":           { "$value": "{color.plane.ground}", "$type": "color" },
    "plane-near":       { "$value": "{color.plane.near}",   "$type": "color" },
    "plane-near-focus": { "$value": "{color.plane.nearer}", "$type": "color" },
    "plane-mid":        { "$value": "{color.plane.mid}",    "$type": "color" },
    "plane-far":        { "$value": "{color.plane.far}",    "$type": "color" },
    "ink":              { "$value": "{color.ink.near}",     "$type": "color", "$description": "Anything the user must read." },
    "ink-mid":          { "$value": "{color.ink.mid}",      "$type": "color" },
    "ink-far":          { "$value": "{color.ink.far}",      "$type": "color", "$description": "Non-text only. 3.50:1." },
    "ink-placeholder":  { "$value": "{color.ink.placeholder}", "$type": "color" },
    "mark":             { "$value": "{color.accent.base}",  "$type": "color" },
    "mark-high":        { "$value": "{color.accent.high}",  "$type": "color" },
    "on-mark":          { "$value": "{color.plane.ground}", "$type": "color" },
    "focus-bar":        { "$value": "{color.accent.high}",  "$type": "color", "$description": "2px leading edge, 8.33:1. The focus indicator. Scale and width changes are NOT a focus indicator." },
    "bucket-now":       { "$value": "{color.bucket.now}",    "$type": "color" },
    "bucket-later":     { "$value": "{color.bucket.later}",  "$type": "color" },
    "bucket-wonder":    { "$value": "{color.bucket.wonder}", "$type": "color" },
    "bucket-do":        { "$value": "{color.bucket.do}",     "$type": "color" },
    "bucket-drop":      { "$value": "{color.bucket.drop}",   "$type": "color" },
    "danger":           { "$value": "{color.danger}",        "$type": "color" }
  }
}
```

**The rule that kept Depth Field honest, recorded because the failure mode generalises.** `plane`,
`type.width` and `ink` had to move together or not at all. A component that changes the plane colour without changing the width has broken the
illusion, and it will look like a bug nobody can name. No automated check can catch it,
so it is written into `CLAUDE.md` as a rule and into the components as a single `Plane` primitive
that sets all three from one `distance` prop.

Dark mode is the same semantic names re-pointed at `color.dark.*` under a `[data-theme="dark"]`
block. The semantic layer is what makes that a table in the generator rather than a second design.

---

## 2. Surface blueprints (superseded mechanism, live layout and copy)

Written for Depth Field. **The elevation and type-width mechanics are dead**; the layout, type
roles, copy, accessibility fixes and reduced-motion behaviour still hold and are the reason this
section survives.

### Capture

The only screen with a motion budget. At 390px the capture field is the only element above the fold.

**Layout.** Single column, `--tl-ref-space-gutter` inset, content vertically centred in the viewport
minus the nav. Order: headline, sub-line, the near plane holding the field, tag chips, Park, Mic, the parked-today
count, the peek stack. Max content width `32rem` on desktop, left-aligned rather than centred,
because a centred single field on a 1280px screen reads as a search engine.

**Type roles.** Headline `--font-display` at `--text-2xl`, weight 500. Sub-line `--font-sans` at
`--text-sm` in `--tl-ink-secondary`. The input `--font-sans` at `--text-lg`, which is the floor: the
capture field never goes below 18px, because it is the one place a person types while distracted.
Chips `--font-mono` at `--text-xs`, uppercase, tracked. Count `--font-mono` at `--text-xs`, tabular.

**Elevation.** There are no shadows and no borders. The field sits on `bg-near` at `wdth 108`, full
ink contrast and scale 1. Chips sit on `bg-mid` at `wdth 85` in `text-ink-far`, moving to `wdth 105`
and a bucket fill when selected, so selecting a chip visibly brings it forward. The peek stack is
`bg-mid` at scale 0.965 and 0.93 for successive rows. Park is the only element carrying `bg-mark`,
which is the one place accent appears on this screen.

**The boundary that carries WCAG 1.4.11.** Plane contrast is a depth cue, not an indicator: the near
plane measures 1.15:1 against the ground and is not trying to pass anything. The field is identified
by its placeholder at 6.21:1 and, on focus, by a 2px `--tl-focus-bar` at 8.33:1 on the leading edge.
**Scale and width changes are not a focus indicator** and must never be the only one; that rule is in
the token file and in `CLAUDE.md`, because it is the easiest thing to lose here.

**Motion.**

| State | What moves | Token |
|---|---|---|
| Idle | Nothing. No loop, no pulse, no ambient anything. | none |
| Typing | **Nothing.** No keystroke response of any kind. | none |
| Focus | Plane `bg-near` → `bg-near-focus`, scale 1 → 1.035, focus bar wipes in from the leading edge | `--ease-focus`, 230ms |
| Commit | Plane returns to scale 1. The thought leaves as a transient element, receding: translate down, scale to 0.92, width 108 → 92, ink near → mid. One radial light event peaks at 0.22 alpha and is gone. | `--ease-commit`, 320ms |
| Confirm | "Logged." fades in, holds, fades out. Count increments. | `--tl-duration-confirm`, 600ms |
| Settle | Near plane and light return to rest, starting at +120ms | `--ease-settle`, 270ms |

Depth animates as `transform: scale` and `opacity` only, both compositor properties. Plane background
colour transitions alongside, which is a paint, but on a single element with no children repainting.
`font-variation-settings` is **not** animated: width steps between discrete token values at the
transition boundary, because animating a variable axis forces a text relayout every frame and that is
the one thing the commit frame cannot afford.

**The light event.** Borrowed from Aperture and confined to this moment: a radial gradient centred on
the field, peaking at `elevation.commit-light` = 0.22 alpha, riding the commit spring and gone at
320ms. It exists nowhere else in the app. No ambient glow, no hover light, no focus light.

**Wall clock.** Field usable at **0ms**. Visual arc complete at **420ms** (commit 320ms; settle
starts at 120ms and runs 270ms). Confirm word gone at 600ms and it never blocks anything.

**Reduced motion.** All four values applied at 1ms, and the light event does not fire at all, because
a 320ms flash with no travel is a strobe rather than a cue. The planes still read near → nearer →
near, and the committed thought is simply already in the mid plane at mid contrast and mid width, so
all four questions are answered by state. The parked line appears in the peek stack without travelling,
the count still increments, and "Logged." holds 1200ms instead of 600ms because it is carrying more
of the answer. Nothing is removed that a user needed; the transitions between states are what go.

**Voice.** Recording replaces Park with "Stop and park" and shows elapsed time in the data face,
tabular so the digits do not jitter. The near plane holds its focus state throughout, because the app
is listening. No waveform: a waveform is an ambient animation in the capture path.

### Review

One at a time, and the flow does not change: wins, then triage, then summary, then Hands.

**Layout.** Vertical, one triage card in view at a time with the next peeking at the fold. Wins at the
top as a compact near plane plus Add. Hands at the bottom, `no-print` as now.

**Type roles.** Screen headline `--font-display` `--text-2xl`. The capture's own text is the hero of
each card: `--font-sans` at `--text-lg`, `--tl-ink`. The agent's reason is `--text-sm` in
`--tl-ink-secondary`, deliberately quieter than the thought it is about. Timestamps and voice
durations in `--font-mono` `--text-xs`.

**Elevation.** A triage card sits on the **near plane**, because the one thought you are deciding about
is the nearest thing in the app. Everything else on the screen drops to mid or far. The bucket colour is a 4px bar on the leading edge, which is the
`FileCard` idea with the tone bar doing real work. Confirm is the one `bg-mark` element per card; the
four override chips sit on the mid plane at `wdth 85` until chosen.

**Motion.** A confirmed card leaves on `--ease-dismiss`, 200ms, and the next rises into its place on
`--ease-settle`. Triage is repetitive by design, so the motion is the shortest in the system.

**Reduced motion.** Cards swap without travel. The bucket bar changing colour and the card leaving the
queue is the confirmation.

**Fix while here.** "Carry forward (max one)" currently uses `text-do` at **2.79:1**. It becomes
`--tl-ink` text with a `--tl-bucket-do` marker beside it. Colour stops being the only carrier, which
is right for a colour-coded system regardless of the ratio.

### Patterns

Data at a glance, on ruled ground. No axes, no gridlines: the page is the
grid.

**Layout.** Four stat readouts in a 2×2 at 390px and a row of four at 1280px. Then the 24-slot hour
distribution, then repeats, then the digest card.

**Type roles.** This is where the display face does its real work. Numerals in `--font-display` at
`--text-3xl`; labels in `--font-mono` `--text-xs`, uppercase, tracked, `--tl-ink-muted`. The
distribution's hour labels are mono because they must align to a column.

**Elevation.** Readouts are wells with no card around them: the number sits in the page. The ruled
ground handles separation, so there are no card borders anywhere on this screen.

**What may be shown.** Only the readouts `PatternsView` already computes: total captures, active
days, busiest hour, stuck items, the 24-slot hour distribution and repeats. No dials, no gauges, no targets, no
change arrows, no day-over-day comparison, and `perDay` rendered as distribution and never as a
sequence. A row of daily bars with gaps in it is a streak display, whatever the heading says.

**Motion.** Bars grow once on mount with `--ease-settle`, staggered by 8ms. That is the one piece of
decorative motion in the app and it is defensible because Patterns is a screen you arrive at
deliberately to read, not one you pass through while distracted.

**Reduced motion.** Bars are drawn at full height. No stagger.

### Settings

The quietest screen. Nothing here needs character; it needs to be unambiguous.

**Layout.** Stacked sections with a rule between them rather than cards. BYOK key, reminder, backup,
Save.

**Type roles.** Section heads `--font-sans` weight 500 `--text-base`. Body copy `--text-sm`
`--tl-ink-secondary`. The BYOK honesty paragraph stays at `--tl-ink` rather than muted, because it is
a promise and muted text reads as fine print.

**Elevation.** Inputs sit on the near plane. Save is the one `bg-mark` element. Section bodies sit on
mid. The Import JSON label currently fakes a button with a border and an inline `--nil-radius-none`;
it becomes a real `Button` with a hidden file input inside it.

**Motion.** Focus only. "Saved." uses the same confirm token as "Logged." so the two agree.

**Reduced motion.** Focus states switch rather than transition. Nothing else moves here anyway.

---

## 3. Phases

Each phase is independently shippable and ends with someone looking at a rendered screen. A phase is
not done because the code was written and the build passed.

> **Phases 4 to 6 are the design phases. They own layout, density and composition.**
>
> **No earlier phase owned the structure.** Phase 3 repainted an inherited six-element layout
> without ever asking whether that layout was right, and Phase 4 was scoped around motion, so the
> arrangement of the one screen the product exists for survived the whole overhaul unexamined.
>
> **Question the wireframe before painting it.** Structure is judged first and on its own, without
> colour, type or motion, and it does not need any of them to be judged. See `docs/DECISIONS.md`
> D-013.
>
> **None of them own copy.** Copy is worked separately.

Every phase ends with **a screenshot at 390px and at 1280px**, checked against that phase's
criteria. Phases marked ● also need **a screen recording of the full arc** (rest, focus, type, Park,
back to rest), **the same recording with `prefers-reduced-motion: reduce`**, and **a double-park**
with two thoughts committed in quick succession.

Phases 1 and 2 are done. Their evidence is in the commits and summarised in `docs/DECISIONS.md`.

---

**Phase 3: the ground, the type and the chrome** BUILT 2026-09-18, AWAITING REVIEW

> **Built, not done.** A phase is done when someone has looked at it. Screenshots were taken at
> 390px and 1280px on all four screens and the mechanical criteria below were checked in a browser.
> When the review passes, this whole section is deleted and replaced by a decision entry in
> `docs/DECISIONS.md`, per D-009.
>
> **Evidence.** Fonts 45.1 KB transfer on a cold load, zero requests to `fonts.googleapis.com`.
> Only the five type steps appear on any screen. Weights 300, 400 and 500 only, no 600. Mono is on
> the navigation alone. **Zero AA failures on all four screens**, measured per element against its
> own computed background. `theme-color`, `theme_color`, the favicon ground and `--tl-ground` are
> all `#08090c`. JS 106.74 KB, CSS 4.82 KB gzipped.
>
> **Five bugs were found by rendering it, none of which broke the build:** a selected chip put
> near-white ink on a light bucket fill at 1.52:1; the capture field rendered at 15px because an
> inline style beat the utility class; the field showed a scrollbar sliver at 390px; `bg-paper` was
> a dead class in `App.tsx` and `NavBar.tsx` after the theme rename; and the favicon was invalid
> XML because an SVG comment cannot contain a double hyphen and it said `--tl-ground`.

*Files:* `src/tokens/tokens.json`, `src/index.css`, `index.html`,
`public/manifest.webmanifest`, `public/favicon.svg`, `public/fonts/*`, the four views for copy

*Does:* the dark ground, the five-step type scale, self-hosted Geist and the PWA chrome.

> **Copy was removed from this phase's scope on 2026-09-18 (D-013), after the fact.** Copy is
> worked separately and the overhaul phases do not own it. 16 strings had already shipped in
> `9df1da0`; D-013 lists them so the copy work inherits rather than collides with them.

*Source of truth:* `docs/LOOK.md`, sections **Typography**, **Copy** and **Standing rules**.

*Open question to settle before starting:* `docs/LOOK.md` leaves **light ground or dark** open, and
proposes dark. Eight of nine still references are near white; the video that matches the product
almost exactly is pure black. **The mechanism works on both**: on light the field is a depression
that bends a fine grid or grain rather than a starfield. Settle this first, because the whole
palette follows from it.

*Acceptance, from the screenshots:*

- Every screen is on the chosen ground and, side by side with Phase 2, the difference is not
  subtle.
- **Radius is generous everywhere.** No `0px` corners survive. If any element still has square
  corners it is reading from a dead token.
- **The headline is visibly Geist, not `system-ui`.** Put a system-ui screenshot beside it. This is
  the specific gotcha that already cost this repo months: naming a font does not load it, and the
  fallback is always plausible. Fonts are self-hosted, never `fonts.googleapis.com`.
- **Exactly five type sizes exist on any screen**: 11, 13, 15, 17 and 34px. Any sixth is a bug.
  Grep the built CSS for `font-size` declarations and count the distinct values.
- The display headline is **weight 300 at 34px**, not 200. At 200 it is spindly and the screen has
  no anchor.
- **Mono appears in exactly two places: the parked count and the navigation.** Nowhere else.
- Chips are **sentence case in the body face**, not tracked mono caps. They are choices a person
  makes, not machine output.
- The capture field is **never below 17px**.
- **Colour appears once per screen**, on the primary action. Bucket hues are markers, not surfaces.
- No text on any screen fails AA. Check the Park button, the confirm word and the carry-forward
  line specifically; those are the three that failed before.

*Acceptance, mechanical:*

- `theme-color` in `index.html`, `theme_color` in the manifest and the ground token are the same
  string. Installed on Android the browser chrome must not be a different colour from the app.
- The favicon at 32px is recognisably the same product as the app.
- Font transfer on a cold load is **under 90 KB** total from the network panel. `docs/LOOK.md`
  budgets 51.3 KB for the Geist and Geist Mono latin subsets, so anything near 90 KB means the
  subset did not apply.
- JS gzip unchanged. This phase adds no JavaScript.

---

**Phase 4 ●: Capture, the well and the arc** BUILT 2026-09-18, AWAITING REVIEW

> **Built, not done.** A phase is done when someone has looked at it. Stills were taken at 390px
> and 1280px in rest, focus, typed, commit and after states, plus the other three screens, and
> every mechanical criterion below was checked in a browser. When the review passes, this whole
> section is deleted and replaced by a decision entry, per D-009. The entries are already written:
> **D-014** for the composition and **D-015** for the lens.
>
> **The clutter brief was answered first, and the element count went from six to three.** Headline,
> sub-line, field. Mic is a glyph and Park is a disc, both inside the field. Chips appear only once
> there is text. See D-014 for all five questions and their answers.
>
> **D-004 was specified and had never been built.** `handlePark` awaited the write before clearing
> the field, there was no `inFlightRef`, and a rejected write threw with no recovery. All four steps
> now exist and the recovery path is tested, including a failure landing mid-typing.
>
> **Evidence.** rAF while idle at rest: 0 in 3s. Idle and focused: 0 in 3s. A whole park arc: 10 to
> 21. Idle after the arc: 0. One WebGL context, created after first paint. Field usable in the same
> tick as Enter; two parks in 58ms of wall clock, both stored. Reduced motion runs 0 frames for a
> whole park and the commit light reads 0. WebGL disabled: park works, console clean. Field y is
> identical with 0 and with 2 parked. No scroll at 1280. Zero AA failures, including 9.91:1 for
> `--tl-ink` and 4.71:1 for `--tl-ink-muted` over the brightest painted star. Rim 3.48:1 and 3.25:1
> at rest, 5.69:1 and 4.92:1 on focus, measured from painted pixels.
>
> **JS 113.07 KB gzipped of 130, CSS 5.01 KB of 12, fonts unchanged.** The lens alone is 4.84 KB,
> measured by building with and without it, against the roughly 4 KB `docs/LOOK.md` budgeted.
>
> **Four things were found by rendering it, none of which broke the build:** the whole starfield
> rendered into a canvas hidden behind an ancestor's background by a negative `z-index`; the swept
> collar and the arcs cancelling each other out, so a working shader painted a plain field on a
> plain ground; the field jumping 66px the first time anything was parked; and the luminous rim
> becoming the default for every `Field`, which put three accents on a resting Settings screen.

*Files:* `src/components/ui/Field.tsx`, `src/components/ui/Button.tsx`,
`src/components/ui/Chip.tsx`, `src/views/CaptureView.tsx`, a new shader layer, plus a new
peek-stack component (the old `LogStack.tsx` was deleted 2026-09-18 as unused; rebuild it against
this direction rather than restoring it)

*Does:* the gravity well and all four moments, plus the optimistic park from `docs/DECISIONS.md`
D-004. **This is the phase the whole direction rests on.**

> ### Lead with the clutter, not the shader
>
> **Reviewed 2026-09-18: Capture is cluttered for what it is meant to do, and the bar is elegance
> rather than completeness.** This is the first thing Phase 4 addresses, before any shader work.
> A well behind a cluttered screen is still a cluttered screen.
>
> **Six things are on screen at rest**, for a surface whose entire job is to take one thought in
> under five seconds:
>
> | | Element | The problem with it |
> |---|---|---|
> | 1 | Headline | Fine. It asks the question. |
> | 2 | Sub-line | Onboarding text shown forever. Does it earn its place after the first use? |
> | 3 | The field | The point of the screen. |
> | 4 | Three tag chips | Always visible. `PRODUCT.md` forbids questions at park time, and three chips sitting there are a question, even an optional one. |
> | 5 | Park, full width | Primary action. Earns its size on a phone. |
> | 6 | Mic, full width | **The clearest fault.** It is the same size and weight as Park, so an alternative input method reads as an equal primary action. |
>
> **Named directly: Mic should be an icon.** Not a full-width button competing with Park.
>
> **The questions Phase 4 has to answer, none of them pre-decided here:**
>
> - What is the resting element count, and what does each survivor earn?
> - Do the chips appear at rest, on focus, after a park, or not at all? Tagging is optional and
>   the product forbids asking anything at park time.
> - Does the sub-line persist, fade after first use, or go?
> - If Enter parks and the field is always focused, what is the Park button actually for on
>   desktop, and does that differ from the phone?
> - Where does Mic sit once it is an icon: inside the field, beside it, or somewhere quieter?
>
> **Acceptance gains one criterion from this:** the resting screenshot at 390px is compared
> against the Phase 3 one and **the element count has gone down**. If it has not, this part of the
> phase did not happen, whatever the well looks like.

*The mechanism, from `docs/LOOK.md`:* a single fullscreen fragment shader, two triangles, no
library, roughly 4 KB of JavaScript and GLSL. The field is not raised and not recessed. It is
heavy, and space bends around it.

*The four moments:*

| Moment | What happens |
|---|---|
| At rest | The field has mass. Space is bent around it, held still. |
| On focus | It gains mass. The bend deepens, the rim brightens. |
| On commit | A pulse: the well briefly collapses inward and the thought falls in. |
| After | Space relaxes back to rest. The log below is one row longer. |

*Acceptance, from the screenshots:*

- At 390px the capture field is **the only element above the fold**, with the headline.
- **The distortion is visible in a still.** Stars or grain near the field are dragged into arcs. If
  a static screenshot looks like a plain field on a plain ground, the effect is not working, and
  this is the one thing a recording cannot settle better than a still.
- **Rest and focus screenshots are visibly different**: the bend is deeper and the rim brighter on
  focus. Two PNGs settle this with no judgement call.
- **One light source, one direction, on every element.** Two angles collapses the illusion into
  neumorphism.
- Accent appears in exactly **one** place, the Park button.
- The peek stack reads as behind the field without using a shadow attached to its edge.

*Acceptance, from the recordings:*

- Full arc: the field is typeable **before** the commit animation ends. Watch the caret, not the
  field.
- **Nothing whatsoever moves while typing**, and **nothing loops at rest.** Record ten seconds of
  an idle focused field: every frame must be identical. A drifting starfield is an ambient loop and
  breaks `PRODUCT.md`.
- Double park: two thoughts in under a second. No queue, no pile-up, no delay before the second
  field is usable.
- Reduced motion: all four moments still distinguishable by state, the parked line appears without
  travelling, the count increments, and the confirm word holds about twice as long because it is
  carrying more of the answer. The commit light does not fire at all, because a flash with no
  travel is a strobe.
- **Force a park failure** (throw from `parkCapture` in devtools) and record it: the text comes back
  into the field with an error, and a `console.warn` carries the text. This is the D-004 recovery
  path and it is the one thing on this screen that cannot ship untested.

*Acceptance, mechanical. These are the ones that catch a plausible-looking failure:*

- **No `requestAnimationFrame` loop exists.** Instrument it: wrap `rAF` and assert it is not called
  while the screen is idle. "It looks still" is not evidence.
- **Capture never waits on the GPU.** Throttle to the slowest CPU preset and confirm the field is
  focusable and typeable before the canvas has painted. The field is real DOM; the lens layers in
  behind it.
- **Disable WebGL and confirm nothing functional is lost.** Roughly 2% of devices land here. They
  get the field without the lens.
- The shader layer adds **no animation library and no WebGL library**. Three.js is about 170 KB
  gzipped, regl about 30 and OGL about 13, and none is needed for a scene with no geometry, no
  textures and no loader.
- JS gzip **≤ 130 KB**. It is 114.50 KB today with about 15 KB of headroom, and React is held back
  at 19.2.8 specifically to keep it (D-010). Record the number in the commit.
- Do not reach for a Canvas 2D approximation as a cost saving. It was tried, it was not good
  enough, and there was no cost to save.

---


**Phase 5: Review** BUILT 2026-09-22

*Files:* `src/views/ReviewView.tsx`, `src/components/ui/TriageCard.tsx` (replaced `FileCard.tsx`),
`src/index.css`

**Everything below was met. The three questions this phase had to settle are answered in
`docs/DECISIONS.md` D-018**, with the evidence: the hand-off, the navigation, and the wrap-up's own
layout. Two departures from what is written here are recorded there and are deliberate. The capture
text is set at the display step rather than at `--text-lg`, which is a dead Depth Field size. Rule
triage runs on open rather than behind a button, because it is local and synchronous; only the
Gemini call stays a button, because only it leaves the device.

**Structure, decided 2026-09-22 (D-017): two states, not one scrolling page.** Review opens straight
into a full-screen, one-card-at-a-time triage ritual — Wins, the backlog toggle, the summary and
Hands are not on screen yet. Once the queue is empty, it hands off to a second, separate state
carrying all of that. Read D-017 before starting: it has the reasoning, and explicitly leaves the
wrap-up state's own layout and the hand-off moment for this build session to settle.

*Acceptance, the triage state:*
- At 390px **one triage card fills the view** with the next just visible at the fold. Not a list.
- Bucket colour is visible as a leading-edge bar and is **never the only carrier** of a state: the
  carry-forward line reads without colour.
- Confirm is the one accent element per card; the override chips recede until chosen. **Recede by
  value and weight, not with a shadow on the edge and not with a Depth Field plane.**
- The confirm copy agrees with Capture. If Capture says "Parked.", nothing here says "Logged."

*Acceptance, the wrap-up state:*
- Wins, the triage summary, carry-forward, and Hands all live here, not on the triage screen.
- The Hands row wraps without overflow at 390px.
- Settle before building: what the hand-off from the last card actually looks like, and whether
  Patterns/Settings are reachable mid-ritual or only once the wrap-up state is showing.

---

**Phase 6: Patterns and Settings** BUILT 2026-09-22

*Files:* `src/views/PatternsView.tsx`, `src/views/SettingsView.tsx`, `src/views/ReviewView.tsx`,
`src/index.css`

**Everything below was met, and `docs/DECISIONS.md` D-021 has the evidence.** One departure is
recorded there and is deliberate: the readouts are a 2x2 at every width rather than a row of four
at 1280px, because every screen here is a 32rem column and a row of four leaves the labels ragged.
Review's summary counts moved to the same readout in the same change, which closes
`docs/BACKLOG.md` B-003.

*Acceptance:*
- Patterns numerals are in the display face at the 34px display step, legible from arm's length in
  the 390px screenshot. **Only the five sizes from `docs/LOOK.md` exist**; `--text-3xl` was a Depth
  Field token and is dead.
- Any ground texture measures under 1.5:1 against the page: perceptible, never something you read.
  The ruled variant came from the rejected Monolith direction, so if a texture is used here it
  follows the gravity-well grain, not rules.
- **No dial, no gauge, no target, no change arrow, no day-over-day comparison, and no sequence chart
  of daily counts** anywhere in the screenshot.
- The 24-slot hour distribution is readable at 390px; empty hours are visible as empty, not absent.
- Settings has no card borders, only rules. The BYOK honesty paragraph is full-strength ink.

---

**Phase 7: sweep and document**

*Files:* `README.md`, `CLAUDE.md`, `docs/DECISIONS.md`, this file

*Does:* README screenshot refreshed. There is no `.cursorrules` in this repo and one is not being
added; `CLAUDE.md` is the only rule file. **Every completed phase section is
deleted from this file** and replaced by a decision entry in `docs/DECISIONS.md`. If Phases 3 to 6
all landed, this file is deleted entirely.

*Acceptance:*
- `npm run build` emits no CSS warning and no prose-leaked utilities. Check the built CSS for the
  fourteen from D-006, not just the absence of a warning.
- `grep -rn -- "--nil-" src/` returns nothing and the alias block is gone from `index.css`.
- JS gzip **≤ 130 KB**, CSS gzip **≤ 12 KB**, fonts **≤ 90 KB**. Numbers recorded in the commit.
- No document in the repo describes a state the code has left. This is the D-009 rule and it is the
  one this phase exists to enforce.

---

## 4. Standing constraints

These apply to every phase and are not re-litigated per phase. The full set is in `CLAUDE.md`.

**Already decided, do not reopen:**

- **The optimistic park is approved.** Build it exactly as specified in `docs/DECISIONS.md` D-004,
  including the `console.warn` on failure, which is part of the change and not an optional extra.
- **NIL DS is out**, with no compatibility layer and no upstream.
- **Motion ships at 0 KB.** Springs are solved at build time. Do not install an animation library.

**Stop and ask about:**

- **Which design direction**, before Phase 3. This is the live blocker.
- **The 70 KB font cost** of Depth Field. The app currently ships zero font bytes.
- **Anything that would add a fifth screen, a streak, a target, a goal, or a comparison with
  yesterday.** The answer is no, but flag the request rather than quietly designing around it.
- **Any request to animate `font-variation-settings`.** It forces a relayout per frame. Width steps
  at transition boundaries; it does not tween.

**Do not touch:** the Dexie schema and stored data shape, the voice capture pipeline,
`src/lib/agent.ts` and the BYOK flow, `src/lib/hands.ts`, and routing between the four views.

**Budgets:** JS ≤ 130 KB gzipped, CSS ≤ 12 KB gzipped, fonts ≤ 90 KB transfer. Record the numbers in
the commit when they move.

One phase per session. Screenshot before moving on. A phase is done when someone has looked at it.

---

## Next session kickoff

**Paste this into a new chat to start Phase 4:**

> Read `CLAUDE.md`, then `docs/DECISIONS.md`, then `docs/BUILD-SPEC.md` Phase 4. Build Phase 4.
> Start with the clutter brief, not the shader.

That is the whole prompt. Everything else is in those three files, which is the point of them.

**Where things stand as of 2026-09-18:**

- Phases 1 and 2 done. **Phase 3 built and live**, awaiting a considered look at the composition
  rather than the palette.
- The direction is settled (D-007) and the ground is dark (D-011). **The violet and the type are
  placeholders**, not decisions, and are expected to change once there is a composition to judge
  them against.
- **Copy is not yours.** It is worked separately. Do not change UI strings. D-013 lists the 16
  that already shipped.
- Budget: **106.76 KB JS of 130**, 4.82 KB CSS of 12, fonts 45.1 KB of 90. React is pinned and
  zod is on `mini` to protect it (D-010, D-012). The shader costs about 4 KB.
- `npm run verify` before every push. Never put a shell script in `npm run build` (D-008).

**The live app is https://tetherlog-rouge.vercel.app and it updates on every push to `main`.**
A green local build proves nothing about Vercel: check the real URL, twice bitten.

**Phase 4's first question is not what the well looks like.** It is which of the six things on
Capture earn their place.

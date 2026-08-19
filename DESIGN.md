# TetherLog — design

Soul for the public app. Not Chappie. Not Clearpath. Not Mothership lime.

Updated 2026-08-19. Light filed look — replaces warm-tether dark.

---

## Feel

Light, crisp, lots of air. Paper, not screen. A tether is rope, not neon — but the page is paper, not a dark terminal.

Capture should feel like a pocket: one field, Park, gone. The log exists behind — abstract filing tabs peeking, not a literal cabinet. Review is an evening table, not a dashboard. Patterns is data you glance at — no guilt charts.

Voice in UI: warm, literal, spare. UK English. No streaks. No "you missed yesterday." Untriaged is parked, not failure.

**Copy:** verb is **Park**. Confirm is **Logged.** Filing is visual (tabbed card, slide-into-stack motion), not in the copy.

---

## Hard rule

Never use `#000000` or `#ffffff` unless Jen explicitly asks. Paper ≈ warm off-white. Ink ≈ deep charcoal.

---

## v1 tokens (light filed)

Map these through Tailwind v4 `@theme` so utilities are real (`bg-paper`, `text-ink`, `border-line`, `bg-do`) — never `bg-[var(--surface)]`.

### Neutrals

| Token | Hex | Use |
|-------|-----|-----|
| `paper` | `#f5f0eb` | page background (warm off-white) |
| `raised` | `#ece6df` | cards, nav, fields |
| `line` | `#d4cdc4` | borders, dividers |
| `ink` | `#2c2824` | body text (deep charcoal) |
| `muted` | `#8a8278` | labels, helper text |

### Action

| Token | Hex | Use |
|-------|-----|-----|
| `mark` | `#2c2824` | primary button fill (same as ink — charcoal Park button) |
| `mark-text` | `#f5f0eb` | text on mark (same as paper) |

### Tags (capture)

| Token | Hex | Use |
|-------|-----|-----|
| `tag-now` | `#d4764e` | now tag — burnt orange |
| `tag-later` | `#d4a574` | later tag — amber |
| `tag-wonder` | `#9b8fb8` | ? tag — dusk |

### Buckets (review)

| Token | Hex | Use |
|-------|-----|-----|
| `do` | `#6a9e6a` | sage green |
| `later` | `#d4a574` | amber (same as tag-later) |
| `drop` | `#8a8378` | stone |
| `wonder` | `#9b8fb8` | dusk (same as tag-wonder) |

---

## Shape — FileCard

Abstract tabbed card. Not a literal folder — a silhouette with a protruding tab on one edge (top-left, via clip-path or extra element). Optional `tone` from tag/bucket tokens tints the tab.

`LogStack` = 2–3 offset FileCards behind the hero capture form. Peek only — no thought text visible in the stack on Capture. Shows the log exists without competing.

---

## Radius, type, spacing, motion

**Radius:** cards `xl` (16 px); pills `full`; folder tab is a shape, not a round-rect.

**Type:** system-ui / `ui-sans-serif`. Capture input ~`text-lg`. Body readable, not tiny.

**Spacing:** 4 / 8 / 16 / 24 / 32. Capture is vertically centred on mobile. Max content width ~`max-w-lg`.

**Motion:**
- `--duration-file`: 700ms (file-into-stack on Park)
- `--ease-file`: `cubic-bezier(0.22, 1, 0.36, 1)`
- Park confirm ~900ms total. No ambient pulse, no streak flames.
- Honour `prefers-reduced-motion` — skip slide, show Logged. immediately.

---

## Tailwind v4 rules

In `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-paper: #f5f0eb;
  --color-raised: #ece6df;
  --color-line: #d4cdc4;
  --color-ink: #2c2824;
  --color-muted: #8a8278;
  --color-mark: #2c2824;
  --color-mark-text: #f5f0eb;
  --color-tag-now: #d4764e;
  --color-tag-later: #d4a574;
  --color-tag-wonder: #9b8fb8;
  --color-do: #6a9e6a;
  --color-later: #d4a574;
  --color-drop: #8a8378;
  --color-wonder: #9b8fb8;
}
```

Then: `bg-paper`, `bg-raised`, `text-ink`, `text-muted`, `border-line`, `bg-mark`, `text-mark-text`, `bg-do`.

**Do not:**
- Keep `:root` colour vars *and* `@theme` as two sources
- Use `text-[var(--muted)]` after this phase
- Add shadcn / a component kit
- Import Mothership or Clearpath CSS
- Invent a fifth screen
- Use `#000` or `#fff`

---

## Primitives (`src/components/ui/`)

Five. That's it.

| Component | Job |
|-----------|-----|
| `Button` | primary (`mark`) / ghost / danger. Full-width Park is primary. |
| `Field` | input + optional textarea (2–3 lines max) |
| `Card` | raised panel |
| `Chip` | tags + bucket overrides. Selected = category colour. |
| `FileCard` | tabbed silhouette with optional `tone`. Used on Capture confirm, Review items, Patterns. |

Plus `LogStack` — non-interactive composition of 2–3 offset FileCards behind the capture hero.

Hands buttons = ghost `Button`. Bucket colours from tokens.

---

## Screen craft notes

**Capture** — default landing. One question. Optional chips never required. Park → file-into-stack motion → "Logged." then ready again. `/` focuses. LogStack in background = log is present without a fifth screen.

**Review** — wins (optional) → triage FileCards → summary (counts + one carry-forward) → Hands with "Copied." feedback.

**Patterns** — heatmap readable at a glance. Digest still useful with no key. Light UI, bucket-coloured chips.

**Settings** — BYOK copy: "Your key stays on this device. We never see it." Reminder + backup. No theme toggle unless asked.

---

## ND constraints

- Capture: <5 seconds. Zero questions. Zero AI.
- Low visual noise. No celebration confetti.
- One thing at a time on Review.
- Contrast: ink on paper must stay readable. Category colours on raised must pass WCAG AA for large text at minimum.

---

## Log

- 2026-08-17: Warm-tether v0 locked. Dark look.
- 2026-08-19: Pivoted to light filed look. Paper/ink neutrals. Abstract filing tabs. Park/Logged. copy. No pure black or white.

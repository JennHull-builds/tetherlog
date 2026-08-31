# TetherLog — design

Soul for the public app. Not Chappie. Not Clearpath.

Updated 2026-08-31. **Mothership light + NIL DS** — supersedes the 2026-08-19 light filed-tab / warm-paper spec.

---

## Feel

Light, crisp, brutalist. Mothership warm off-white (`#EDECE8`), ink borders (`#0A0A0A`), hard edges — paper as structure, not soft filing cabinet.

Capture should feel like a pocket: one field, Park, gone. The log exists behind — abstract **bracket stack** (offset hard-border cards), not filed tabs. Review is an evening table, not a dashboard. Patterns is data you glance at — no guilt charts.

Voice in UI: warm, literal, spare. UK English. No streaks. No "you missed yesterday." Untriaged is parked, not failure.

**Copy:** verb is **Park**. Confirm is **Logged.** Filing is visual (bracket card + slide-into-stack motion), not in the copy.

---

## Hard rules

- **NIL DS is the component layer** — import `nil-ds/tokens/tokens.css` + `nil-ds/core/core.css`; wrap `Button`, `Card`, `Badge` from nil-ds under `src/components/ui/`.
- **Mothership light base** — bg `#EDECE8`, text/border `#0A0A0A`, muted surface `#E2E1DC`.
- **Accent locked `#0241e3`** (Jen) — primary actions, manifest theme, success confirm. Not Mothership orange.
- **Brutalist shape** — `0px` radius, `2px` borders everywhere. No rounded-xl filed look.
- Do not import Mothership or Clearpath CSS directly — consume via NIL.

---

## Token stack

| Layer | Source | Role |
|-------|--------|------|
| Primitive + semantic | `nil-ds/src/tokens/tokens.css` | `--nil-color-*`, spacing, borders |
| Core reset/layout | `nil-ds/src/core/core.css` | body reset, `.nil-container` etc. |
| App aliases | `src/index.css` `@theme` | Tailwind utilities mapped to `--nil-*` |

### NIL semantic (light)

| Token | Value | Use |
|-------|-------|-----|
| `--nil-color-bg` | `#EDECE8` | page (`bg-paper`) |
| `--nil-color-surface` | `#E2E1DC` | cards, nav (`bg-raised`) |
| `--nil-color-text` | `#0A0A0A` | body (`text-ink`) |
| `--nil-color-text-muted` | `#4A4A4A` | labels (`text-muted`) |
| `--nil-color-border` | `#0A0A0A` | borders (`border-line`) |
| `--nil-color-accent` | `#0241e3` | Park, confirm (`bg-mark`) |
| `--nil-color-accent-contrast` | `#ffffff` | on accent (`text-mark-text`) |

### TetherLog bucket colours (unchanged semantics)

Capture tags and review buckets keep their category hues — mapped in `@theme` as `--color-tag-*` / `--color-do` etc. Chips and FileCard left-bar use these; they are app tokens, not NIL primitives.

---

## Shape — FileCard (brutalist bracket)

**Supersedes:** filed-tab clip-path silhouette, `rounded-xl`, warm `raised` paper.

Hard rectangle, `2px` border, `0` radius. **Left accent bar** (6px) + bracket `[` glyph in tone colour. Peek cards get offset `box-shadow` for stack depth.

`LogStack` = 2–3 offset FileCards behind the capture hero. Peek only — no thought text visible on Capture.

---

## Radius, type, spacing, motion

**Radius:** `0px` everywhere (`--nil-radius-none`).

**Type:** `var(--nil-font-body)` / system stack. Capture input ~`text-lg`.

**Spacing:** NIL spacing scale via CSS vars. Capture vertically centred on mobile. Max content width ~`max-w-lg`.

**Motion:**
- `--duration-file`: 700ms (card-into-stack on Park)
- Park confirm ~900ms total. No ambient pulse.
- Honour `prefers-reduced-motion` — skip slide, show Logged. immediately.

---

## Primitives (`src/components/ui/`)

NIL-backed wrappers. Five surface components + LogStack.

| Component | NIL source | Job |
|-----------|------------|-----|
| `Button` | `nil-ds/Button` | primary (accent) / ghost (secondary) / danger |
| `Field` | custom, nil tokens | input + optional textarea |
| `Card` | `nil-ds/Card` | bordered surface panel |
| `Chip` | `nil-ds/Badge` + tone fills | tags + bucket overrides |
| `FileCard` | custom brutalist bracket | capture confirm, review items, patterns |

Plus `LogStack` — offset peek stack behind capture.

---

## Screen craft notes

**Capture** — default landing. One question. Optional chips never required. Park → bracket-into-stack → "Logged." then ready again. `/` focuses.

**Review** — wins → triage FileCards → summary → Hands with export actions.

**Patterns** — heatmap at a glance. Digest optional with Gemini key.

**Settings** — BYOK copy unchanged. Light only unless asked.

---

## ND constraints

- Capture: <5 seconds. Zero questions. Zero AI.
- Low visual noise. No celebration confetti.
- One thing at a time on Review.
- Contrast: ink on Mothership light must stay readable.

---

## Log

- 2026-08-17: Warm-tether v0 locked. Dark look.
- 2026-08-19: Pivoted to light filed look. **Superseded 2026-08-31.**
- 2026-08-31: Mothership light + NIL DS consumer pass. Accent `#0241e3`. Brutalist bracket FileCard. First nil-ds consumer.

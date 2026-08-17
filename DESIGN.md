# TetherLog — design

Soul for the public app. Quiet dark, warm rope — not neon, not a terminal skin.

Locked 2026-08-17. Tune hex in Phase 1 if it feels wrong — don't bikeshed first.

---

## Feel

Quiet dark. Warm, not cool slate. A tether is rope, not neon.

Capture should feel like a pocket: one field, Park, gone. Review is an evening table, not a dashboard. Patterns is data you glance at — no guilt charts.

Voice in UI: warm, literal, spare. UK English. No streaks. No "you missed yesterday." Untriaged is parked, not failure.

---

## v0 tokens (warm tether)

Map these through Tailwind v4 `@theme` so utilities are real (`bg-ink`, `text-muted`, `border-line`, `bg-accent`) — never `bg-[var(--surface)]`.

| Token | Hex | Use |
|-------|-----|-----|
| `ink` | `#16120e` | page background |
| `raised` | `#221c16` | cards, nav, fields |
| `line` | `#3a3228` | borders |
| `text` | `#f0ebe3` | body |
| `muted` | `#a89880` | labels, helper |
| `accent` | `#c4884a` | primary actions, focus (rope/brass) |
| `accent-dim` | `#8f6233` | pressed / disabled-adjacent |
| `do` | `#8fbc8f` | sage |
| `later` | `#d4a574` | amber |
| `drop` | `#8a8378` | stone |
| `wonder` | `#9b8fb8` | dusk |

**Radius:** generous (`xl` / `2xl`) — pocket, not terminal. Don't use `0px` radius.

**Type:** system-ui / `ui-sans-serif`. No display hero type. Capture input ~`text-lg`. Body readable, not tiny.

**Spacing:** 4 / 8 / 16 / 24 / 32. Capture is vertically centred on mobile. Max content width ~`max-w-lg`.

**Motion:** short. Park confirm ~900ms. No ambient pulse, no streak flames.

---

## Tailwind v4 rules

In `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-ink: #16120e;
  --color-raised: #221c16;
  --color-line: #3a3228;
  --color-text: #f0ebe3;
  --color-muted: #a89880;
  --color-accent: #c4884a;
  --color-accent-dim: #8f6233;
  --color-do: #8fbc8f;
  --color-later: #d4a574;
  --color-drop: #8a8378;
  --color-wonder: #9b8fb8;
}
```

Then: `bg-ink`, `bg-raised`, `text-muted`, `border-line`, `bg-accent`.

**Do not:**
- Keep `:root` colour vars *and* `@theme` as two sources
- Use `text-[var(--muted)]` after Phase 1
- Add shadcn / a component kit
- Import CSS from another product
- Invent a fifth screen

---

## Primitives (`src/components/ui/`)

Four. That's it.

| Component | Job |
|-----------|-----|
| `Button` | primary / ghost / danger. Full-width Park is primary. |
| `Field` | input + optional textarea (2–3 lines max) |
| `Card` | raised panel |
| `Chip` | tags + bucket overrides |

Hands buttons = ghost `Button`. Bucket colours from tokens, not one-off hex.

---

## Screen craft notes

**Capture** — default landing. One question. Optional chips never required. "Parked." then ready again. `/` focuses.

**Review** — wins (optional) → triage cards → summary (counts + one carry-forward) → Hands with "Copied." feedback.

**Patterns** — heatmap readable at a glance. Digest still useful with no key (stats always; narrative is BYOK).

**Settings** — BYOK copy: "Your key stays on this device. We never see it." Reminder + backup. Dark-only for v1 (spec mentioned theme; skip until asked).

---

## ND constraints

- Capture: &lt;5 seconds. Zero questions. Zero AI.
- Low visual noise. No celebration confetti.
- One thing at a time on Review (don't dump 40 items as equal weight if you can lead with the current suggestion).
- Contrast: accent on ink must stay readable (brass on near-black, not pale gold on tan).

---

## Log

- 2026-08-17: Warm-tether v0 locked. Tune hex in Phase 1, don't invent a second system.

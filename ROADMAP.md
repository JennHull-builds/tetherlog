# TetherLog — roadmap to done

**Refer here.** Spec is `PRODUCT.md`. Look is `DESIGN.md`. Agent rules to copy into the app repo: `CURSORRULES.md`.

Updated 2026-08-19. Visual: **light filed** (paper off-white, charcoal ink, abstract filing tabs, category colour on tags/buckets).

Work **in the tetherlog repo**. New chat per phase. `@` the files, paste the prompt, one phase, commit.

```
0 docs  →  1 tokens  →  2 capture  →  3 review  →  4 patterns/settings  →  5 spec gaps  →  6 ship
```

---

## Honest status

**Working (scaffold):** four screens, Dexie, rule + Gemini triage, deterministic patterns, most Hands (clipboard, .ics, share, mailto, print, JSON backup).

**Not done:** Tailwind `@theme` (still `:root` + `bg-[var(--muted)]`), no primitives, no FileCard/LogStack, no `.cursorrules`. Wins not persisted. No review summary card. Reminder is `setTimeout` (dies on refresh). Missing: `/` focus, 2–3 line expand, haptic, Obsidian export, tag/velocity charts, swipe.

**Do not:** salvage Clearpath UI. Do not borrow Mothership lime. Do not install shadcn — four screens need 5 primitives, not a kit.

---

## How to talk to the UI agent

1. File → Open Folder → `tetherlog`
2. Copy `CURSORRULES.md` → `tetherlog/.cursorrules` once (Phase 0)
3. New chat. `@` the files listed. Paste the prompt. One phase. Commit.
4. Look, then tune. Do not let it restyle every screen in one go.

**Capture is the hero.** Spend taste there. Review is ritual. Patterns is quiet data.

---

## Phase 0 — Drop these files into the app repo

Copy from this folder into `/Users/jennifer/tetherlog`:

| This file | Lands as |
|-----------|----------|
| `ROADMAP.md` | `tetherlog/ROADMAP.md` |
| `DESIGN.md` | `tetherlog/DESIGN.md` |
| `CURSORRULES.md` | `tetherlog/.cursorrules` |
| `PRODUCT.md` | already there — keep in sync |

---

## Phase prompts (new chat in **tetherlog** each time)

### 1 — Tokens + primitives

**Files:** `@DESIGN.md` `@ROADMAP.md` `@.cursorrules` `@src/index.css` `@src/App.tsx` `@src/views` `@src/components`

```
Read DESIGN.md and ROADMAP.md. Implement the v1 light-filed token set in src/index.css using Tailwind v4 @theme (semantic colour/radius/spacing/font — no :root-only vars with bg-[var(...)] leftovers). Add primitives Button, Field, Card, Chip, FileCard under src/components/ui/. Add a LogStack composition component. Rewire the four views and NavBar to those utilities/primitives. Light background (paper), charcoal text (ink). Do not invent new screens or change product behaviour. UK English. Commit.
```

**You do after:** look at Capture in the browser. If colours feel wrong, say it in one line and retune tokens only.

### 2 — Capture craft (the Fun one)

**Files:** `@DESIGN.md` `@PRODUCT.md` `@.cursorrules` `@src/views/CaptureView.tsx` `@src/components` `@src/index.css`

```
Craft the Capture screen only. It must feel dumb-fast and quiet: one field, Park, "Logged." confirm, optional Now/Later/? chips. LogStack in background — abstract filing tabs peeking behind the hero. On Park: file-into-stack motion (card slides down into the stack), then "Logged.", field ready. Honour prefers-reduced-motion. Keyboard: / or tap focuses, Enter parks, field stays ready. Optional expand to 2–3 lines max — not an essay. Haptic if the browser allows. No AI, no extra copy, no charts. Follow DESIGN.md tokens/primitives. UK English. Commit.
```

### 3 — Review ritual

**Files:** `@DESIGN.md` `@PRODUCT.md` `@.cursorrules` `@src/views/ReviewView.tsx` `@src/lib/hands.ts`

```
Craft Review only. Keep the flow: optional wins → triage → summary → Hands. Use FileCard for triage items with bucket colour on the tab. Add a summary card (bucket counts + one carry-forward max). Confirm/override should be obvious; Hands need a short "Copied." / "Downloaded." state. Persist wins to Dexie (the wins table already exists). Do not swipe-build unless cheap. Follow DESIGN.md. UK English. Commit.
```

### 4 — Patterns + Settings

**Files:** `@DESIGN.md` `@PRODUCT.md` `@src/views/PatternsView.tsx` `@src/views/SettingsView.tsx` `@.cursorrules`

```
Craft Patterns and Settings only. Patterns: readable heatmap with bucket-coloured bars, stuck/repeats, digest card that still works without a key. Settings: BYOK copy stays honest ("key stays on this device"), reminder, backup. Light UI. No new integrations. Follow DESIGN.md. UK English. Commit.
```

### 5 — Spec gaps (not visual)

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@package.json` `@vite.config.ts` `@src`

```
Close remaining PRODUCT.md v1 gaps only: vite-plugin-pwa + offline capture, Obsidian markdown export, `/` already on Capture if missing, untriaged backlog toggle on Review, tag breakdown + captures-per-day on Patterns, service-worker evening reminder instead of setTimeout. Do not restyle. UK English. Commit.
```

### 6 — Ship (ops)

GitHub `JennHull-builds/tetherlog` if not already public. Vercel from `main`. Screenshot in README. Tick the agent demo checklist in `PRODUCT.md`.

---

## Feature checklist (v1)

### Capture
- [x] Park to IndexedDB
- [x] Optional now / later / ? tags
- [x] "Parked." confirm → now "Logged."
- [ ] `/` or tap focuses
- [ ] Optional 2–3 line expand
- [ ] Haptic if available
- [ ] Offline PWA
- [ ] File-into-stack motion on Park
- [ ] LogStack behind capture hero

### Review
- [x] Rule triage (no key)
- [x] Gemini BYOK triage + Zod schema
- [x] Confirm / override buckets
- [ ] Wins persist (Dexie `wins` table exists, UI is memory-only)
- [ ] Summary card (counts + one carry-forward)
- [ ] Untriaged backlog toggle
- [ ] Hands confirm ("Copied." / "Downloaded.")
- [ ] Swipe (only if cheap)
- [ ] FileCard for triage items

### Hands
- [x] Copy do list / full review
- [x] Download .ics
- [x] Share
- [x] mailto
- [x] Print
- [x] JSON export / import
- [ ] Obsidian markdown export
- [ ] Evening reminder via service worker (not `setTimeout`)

### Patterns
- [x] Heatmap, repeats, stuck count
- [x] Weekly digest BYOK
- [ ] Captures per day / week
- [ ] Tag breakdown
- [ ] Velocity trend
- [ ] Theme clustering (BYOK, flex)

### Ship
- [ ] Tokens via `@theme` + primitives (light filed)
- [ ] FileCard + LogStack
- [ ] Capture / Review / Patterns craft
- [ ] `.cursorrules` in app repo
- [ ] Public GitHub + Vercel
- [ ] README screenshot
- [ ] Agent demo checklist ticked

---

## Log

- 2026-08-17: Roadmap locked. Warm-tether UI. Phase prompts copied from DX Grid Phase 2 pattern.
- 2026-08-19: Pivoted to light filed look. Updated all phase prompts. FileCard + LogStack added. Park/Logged. copy.

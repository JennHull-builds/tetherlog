# TetherLog — roadmap to done

**Refer here.** Spec is `PRODUCT.md`. Look is `DESIGN.md`. Agent rules to copy into the app repo: `CURSORRULES.md`.

Updated 2026-08-25. Visual: **light filed** (paper off-white, charcoal ink, abstract filing tabs, category colour on tags/buckets).

Work **in the tetherlog repo**. New chat per phase. `@` the files, paste the prompt, one phase, commit.

```
0 docs  →  1 tokens  →  2 capture  →  3 review  →  4 patterns/settings  →  5 spec gaps*  →  6 ship
                                                                              ↘
                         7 voice (NEXT)  →  8 writing lane  →  9 Android PWA ship
```

\*Phase 5 PWA / SW reminder bullets are **parked → Phase 9**. Do not double-build.

---

## Honest status

**Agentic Review loop — done** (see [Done means](#done-means--agentic-review-loop) below). Capture → rule or Gemini triage (Zod) → confirm/override → summary + carry-forward → Hands. Wins persist. BYOK honest; no key still works.

**UI craft — parked.** Tokens/primitives and Capture craft largely shipped (`/`, haptic, LogStack, file-into-stack, 2–3 line expand). Review/Patterns/Settings visual polish and remaining Phase 5 non-PWA gaps (Obsidian, chart extras) are not this slice. Do not restyle until priorities say so.

**Voice — NEXT.** PRODUCT.md locks voice + transcript as fundamental, writing lane second, Android-first PWA third. Phase 7A (this plan) is done. Build [7B — Voice MVP](#7b--voice-mvp-slice-1) next. Do not wait for full UI polish.

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

**Files:** `@PRODUCT.md` `@src/views/PatternsView.tsx` `@src/views/SettingsView.tsx` `@.cursorrules`

```
Craft Patterns and Settings only. Patterns: readable heatmap with bucket-coloured bars, stuck/repeats, digest card that still works without a key. Settings: BYOK copy stays honest ("key stays on this device"), reminder, backup. Light UI. No new integrations. Follow DESIGN.md. UK English. Commit.
```

### 5 — Spec gaps (not visual) — PWA parked

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@src`

```
Close remaining non-PWA PRODUCT.md v1 gaps only: Obsidian markdown export, tag breakdown + captures-per-day on Patterns (and `/` on Capture only if still missing). Do NOT add vite-plugin-pwa, Install path, or service-worker evening reminder — those belong to Phase 9 (Android PWA ship). Do not restyle. UK English. Commit.
```

**Parked → Phase 9:** `vite-plugin-pwa` + offline shell, Android Chrome Install / Add to Home Screen, SW evening reminder (replace `setTimeout`). Do not build them here.

### 6 — Ship (ops)

GitHub `JennHull-builds/tetherlog` if not already public. Vercel from `main`. Screenshot in README. Tick the agent demo checklist in `PRODUCT.md`. HTTPS on Vercel is required before Android mic + Install work well.

---

## Phase 7 — Voice (NEXT)

Front-load the thinnest path to: **Jen can record on her Android phone today.** Writing lane and full PWA come after a usable recorder.

### STT options (Android Chrome)

| Option | Offline audio park | Offline transcript | Cost | Long 10+ min | Quality |
|--------|--------------------|--------------------|------|--------------|---------|
| **Web Speech API** (Chrome) | n/a (STT only) | No — needs Google backend | Free | Poor / session limits | OK for short parks |
| **BYOK cloud STT** (API TBD) | n/a | No | User’s key | Likely yes, after park | Better for long dumps |
| Hosted STT we pay for | — | — | **Out** ($0 rule) | — | — |

**MVP default (7B):** Audio parks first via `MediaRecorder` (offline OK). Best-effort **Web Speech** for short parks when the browser allows. Fail open — `text` = `[voice]` (or similar) if no transcript yet. **Never block park on network or STT.** Capture stays usable with **no key**.

**Follow-up (7C):** Short spike to pick the real BYOK API (Gemini multimodal audio vs other BYOK), then wire post-park transcription for long dumps when a key exists. Do **not** treat “BYOK Gemini STT” as proven until that spike lands. No key still works.

### Out of Voice Slice 1 (7B)

- Full writing organise / filter / seed export (Phase 8)
- `write` chip — only if literally free; otherwise leave for Phase 8
- Fancy UI polish / restyle
- App Store / native shell
- AI rewriting babble into blog posts
- Full PWA / SW / Install (Phase 9)
- IndexedDB quota / growth cleanup for long dumps — **later warning**, not Slice 1 work

### 7A — Voice plan (docs only) — done

This section. Locked slices, STT default, Phase 9 PWA ownership, paste-ready prompts below.

### 7B — Voice MVP (Slice 1)

**Done means:**

1. **Dexie version bump (v2)** with optional fields: `audioBlob`, `audioMimeType`, `durationMs`, `transcriptStatus`. `text` stays **required** — use placeholder e.g. `[voice]` if no transcript yet.
2. Capture: mic start / stop for quick park **and** long recording (10+ min safe via chunked `MediaRecorder` / timeslice — do not blow the tab; do not base64 the whole take in memory).
3. On stop: park capture with audio Blob in Dexie; best-effort Web Speech transcript if cheap; never block park on network.
4. Review: replay audio (`<audio>`) + show `text` / transcript when present.
5. Capture stays dumb: no triage, no “what did you mean,” no summarising mid-record.
6. **Android test path:** HTTPS required for mic; prefer Vercel preview (or localhost HTTPS) → Android Chrome. No App Store.

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@DESIGN.md` `@.cursorrules` `@src/views/CaptureView.tsx` `@src/views/ReviewView.tsx` `@src` (db / types as needed)

```
Read PRODUCT.md Voice capture section, ROADMAP.md Phase 7B Done means, DESIGN.md, and .cursorrules.

Implement ONLY Voice MVP Slice 1 — nothing else.

Must ship:
- Dexie v2 migration: optional audioBlob, audioMimeType, durationMs, transcriptStatus; text stays required (placeholder e.g. [voice] if no transcript).
- Capture: mic start/stop for quick park AND long recording (10+ min safe via chunked MediaRecorder).
- On stop: park audio Blob in Dexie; best-effort Web Speech if cheap; never block park on network/STT. No key required.
- Review: replay audio + show text/transcript.
- Capture stays dumb: no triage, no questions, no mid-record summary.
- Android Chrome first. HTTPS required for mic — note Vercel preview or localhost HTTPS in the commit/PR notes.

Do not: write chip (unless literally one free line), writing organise/export, IndexedDB quota work, UI restyle, App Store, full PWA/SW, AI blog rewrite, Patterns changes.

UK English. Commit when MVP works locally. Then give exact steps to try on Android Chrome (permissions + HTTPS).
```

**You do after:** 10-second park + a longer babble on Android Chrome (or desktop Chrome first). Confirm audio replays in Review.

### 7C — Transcript reliability (Slice 2)

**Done means:**

1. Short spike: pick BYOK STT API (Gemini multimodal audio vs other BYOK) — document the pick in ROADMAP log before wiring.
2. Web Speech polish for short parks where it already helps.
3. Post-park BYOK transcription for long dumps when a key exists; park never waits on STT.
4. Settings copy stays honest; Capture + Review remain usable with no key.

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@.cursorrules` `@src` (Settings, db, Capture/Review voice paths)

```
Read ROADMAP.md Phase 7C and PRODUCT.md Voice capture.

1) Spike (short): compare Gemini multimodal audio vs other client-side BYOK STT for long dumps on Android Chrome. Pick one; note trade-offs in a ROADMAP log line. Do not assume Gemini STT is proven.
2) Implement: Web Speech polish for short parks; chosen BYOK STT after park for long audio when key present.
3) Never block park on STT. No key → audio + [voice] placeholder still work.
4) Honest Settings copy. No writing lane, no PWA, no restyle.

UK English. Commit.
```

**You do after:** short park with Web Speech; long dump parks audio offline; with key, transcript catches up after park.

---

## Phase 8 — Writing lane

**Done means:** optional `write` capture tag + review bucket (extend Zod / `BUCKET_LABELS` — one system, not two); filter writing seeds in Review; Hands markdown seed export (clipboard or download). No publish-in-app. No AI rewrite at park.

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@DESIGN.md` `@.cursorrules` `@src/types.ts` `@src/views` `@src/lib`

```
Read PRODUCT.md Writing lane and ROADMAP.md Phase 8.

Implement writing lane only: optional write tag on Capture; write bucket in triage schema + UI; filter writing seeds in Review; Hands export of a seed (or writing-tagged cluster) as draft-ready markdown.

Do not: restyle, App Store, AI blog rewrite at park, PWA work (Phase 9). Voice must already work from 7B.

UK English. Commit.
```

**You do after:** park a write-tagged thought; triage to `write`; export markdown seed.

---

## Phase 9 — Android PWA ship

**Owns exclusively** (do not build in Phase 5):

- `vite-plugin-pwa` + offline shell (text park offline; audio parks offline; transcript may need network)
- Android Chrome Install / Add to Home Screen path (document in README)
- Manifest colours match light filed (not old dark `#12121a`)
- Service-worker evening reminder (replace Settings `setTimeout`)
- Public HTTPS deploy already assumed from Phase 6 — needed for mic + Install

**Files:** `@PRODUCT.md` `@ROADMAP.md` `@package.json` `@vite.config.ts` `@public/manifest.webmanifest` `@src`

```
Read PRODUCT.md Android-first PWA notes and ROADMAP.md Phase 9.

Implement Android PWA ship only: vite-plugin-pwa + offline shell, Install / Add to Home Screen path for Android Chrome, light-filed manifest colours, service-worker evening reminder instead of setTimeout.

Do not restyle screens. No App Store. UK English. Commit. Document Install + HTTPS steps in README.
```

**You do after:** Install on Android Chrome from Vercel; park text offline; confirm reminder fires after tab close if SW allows.

---

## Feature checklist (v1)

### Capture
- [x] Park to IndexedDB
- [x] Optional now / later / ? tags
- [x] "Parked." confirm → now "Logged."
- [x] `/` or tap focuses
- [x] Optional 2–3 line expand
- [x] Haptic if available
- [x] File-into-stack motion on Park
- [x] LogStack behind capture hero
- [ ] Offline PWA shell → **Phase 9**
- [x] **Voice** quick park (mic → stop → audio + transcript when ready) → **7B**
- [x] **Voice** long dump (10+ min safe; audio local first) → **7B**
- [ ] Optional `write` tag on capture → **Phase 8**
- [ ] Android Chrome Install / Add to Home Screen → **Phase 9**

### Review
- [x] Rule triage (no key)
- [x] Gemini BYOK triage + Zod schema
- [x] Confirm / override buckets
- [x] Wins persist (Dexie `wins` table)
- [x] Summary card (counts + one carry-forward)
- [x] Untriaged backlog toggle
- [ ] Hands confirm ("Copied." / "Downloaded.") — UI polish, parked
- [ ] Swipe (only if cheap) — parked
- [x] FileCard for triage items
- [x] Voice: replay audio + show transcript → **7B**
- [ ] `write` bucket / filter → **Phase 8**

### Hands
- [x] Copy do list / full review
- [x] Download .ics
- [x] Share
- [x] mailto
- [x] Print
- [x] JSON export / import
- [ ] Obsidian markdown export → Phase 5 (non-PWA)
- [ ] Writing seed export → **Phase 8**
- [ ] Evening reminder via service worker (not `setTimeout`) → **Phase 9**

### Patterns
- [x] Heatmap, repeats, stuck count
- [x] Weekly digest BYOK
- [ ] Captures per day / week → Phase 5
- [ ] Tag breakdown → Phase 5
- [ ] Velocity trend
- [ ] Theme clustering (BYOK, flex)

### Ship
- [x] Tokens via `@theme` + primitives (light filed)
- [x] FileCard + LogStack
- [ ] Capture / Review / Patterns craft (Capture largely done; Review/Patterns parked)
- [x] `.cursorrules` in app repo
- [ ] Public GitHub + Vercel (HTTPS — needed for Android mic + Install)
- [ ] README screenshot
- [x] Agentic Review loop mark-done (see below)
- [x] Voice MVP on Android Chrome → **7B**
- [ ] Android PWA Install path → **Phase 9**

---

## Done means — agentic Review loop

For Jen. The learning-lane agentic loop is shippable when:

- Parked captures reach Review; rule triage runs with no key; Gemini runs with BYOK and falls back to rules on failure.
- Suggestions match the Zod triage schema; at most one carry-forward; decisions persist in Dexie.
- Wins persist for the day; summary shows bucket counts + carry-forward; Hands can export the confirmed `do` list.
- Settings copy is honest: key on device, never seen by us; product is never empty without a key.
- Not claimed: UI polish, swipe, Obsidian, PWA reminder, Patterns chart extras, voice.

---

## Log

- 2026-08-25: Phase 7B Voice MVP landed — Dexie v2 audio fields, chunked MediaRecorder, best-effort Web Speech, Review replay. HTTPS required for mic (Vercel preview or localhost). 7C still owns BYOK STT spike.
- 2026-08-25: Phase 7A landed — Voice → Writing → Android PWA track. 7B = skinny audio MVP (Dexie v2 fields, Web Speech best-effort, HTTPS → Android Chrome). 7C = STT spike then BYOK (API TBD). Phase 9 owns all PWA/SW/Install; Phase 5 PWA bullets parked.
- 2026-08-25: Phase 7A/7B prompts first sketched — Voice unparked ahead of UI polish. Android-first; writing lane second.
- 2026-08-17: Roadmap locked. Warm-tether UI. Phase prompts copied from DX Grid Phase 2 pattern.
- 2026-08-19: Pivoted to light filed look. Updated all phase prompts. FileCard + LogStack added. Park/Logged. copy.
- 2026-08-21: Agentic Review loop marked done (wins persist, summary, backlog toggle, batch normalise, BYOK honesty). UI craft stays parked.

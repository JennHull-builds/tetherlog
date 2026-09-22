# TetherLog decisions

What has been decided, when, and why. One entry per decision. Closed entries are not reopened
without a new entry saying so.

This file replaced `docs/UI-OVERHAUL.md` on 2026-09-18. That document had grown to 1,880 lines
governing a 2,585-line application: an audit of a state that no longer existed, a rip-out plan that
had already run, and two rejected design directions. The parts still doing work were split here and
into `docs/BUILD-SPEC.md`. `git log` has the original if it is ever wanted.

**Where things live now:**

| File | Job |
|---|---|
| `CLAUDE.md` | Binding rules and the gotcha list. Read before touching anything. |
| `PRODUCT.md` | Product spec. Binding. |
| `docs/LOOK.md` | Visual direction. Binding. |
| `docs/DECISIONS.md` | This file. What was decided and why. |
| `docs/BUILD-SPEC.md` | What is specified but not yet built: Phases 3 to 7. |
| `ROADMAP.md` | Feature delivery order, product-level. |
| `ARCHITECTURE.md` | Code structure. |

---

## Status

| | |
|---|---|
| Phases 1 and 2 | Done and pushed, 2026-09-18 |
| Phase 3 | **Built 2026-09-18**, awaiting a look. The ground, the type and the PWA chrome. |
| Phase 4 | **Built 2026-09-18, enhanced 2026-09-22.** Capture's composition, the lens, the arc, then the lens's own body (refraction, dispersion, specular, rim) and the commit sound. See D-014, D-015, D-016. |
| Phase 5 | **Built 2026-09-22.** Two states: a full-screen one-card triage ritual, then a separate wrap-up. Structure in D-017, the three questions it left open in D-018. |
| Phases 6 and 7 | Not started. Patterns and Settings, then the sweep. |
| Design direction | **Approved 2026-09-18:** the gravity well. `docs/LOOK.md` is binding. See D-007. |
| Live palette | The `docs/LOOK.md` dark palette, live since Phase 3. The violet is still a placeholder. |

---

## D-001: NIL DS is out, with no compatibility layer

**2026-09-18. Closed.**

The design system was vendored from a sibling checkout and had drifted from what this repo rendered.
`DESIGN.md` documented `#EDECE8` / `#0241e3`; the app painted `#f3f2ee` / `#3b6ef5`. The sync was
one-directional and nobody was running it.

Twenty live values were inlined under their existing names, `src/nil-ds/` was deleted along with
`scripts/sync-nil-ds.sh`, and this repo now owns its tokens outright with no upstream.

**Why it matters later:** `vite.config.ts` once aliased `../nil-ds`. It built green here and failed
on Vercel, because Vercel checks out this repository and nothing else. That rule is in `CLAUDE.md`.

## D-002: Tokens are the source of truth, in two layers

**2026-09-18. Closed.**

`src/tokens/tokens.json` is hand-authored DTCG and generates `src/styles/tokens.generated.css`,
which is the only file in `src/` carrying a colour literal. Primitives (`--tl-ref-*`) are never read
by a component; semantics (`--tl-*`) are the only thing a component reads.

The two-layer split is what lets a design direction change without touching a component: the
semantic names describe distance and role, not palette, so `near`, `mid` and `far` survive a
wholesale swap of the primitives underneath them.

The full contract, including the six numbered rules, is in `CLAUDE.md`. It is binding there rather
than here because `CLAUDE.md` is the file that gets read before the code is touched.

## D-003: Motion ships at 0 KB

**2026-09-18. Closed.**

Springs are solved at build time into CSS `linear()` easings by `scripts/build-tokens.mjs`. No
animation library is installed and none should be without a new entry in this file.

Springs are named for the moment in the arc they serve, never for their shape: `focus`, `commit`,
`settle`, `dismiss`. A token called `bouncy` has lost the plot.

Every motion token carries its reduced-motion counterpart in the same entry, and the generator
throws if one is missing. `prefers-reduced-motion: reduce` is a contract here, not a fallback,
because of who this is for.

## D-004: The optimistic park

**2026-09-18. Closed, and deliberately over-documented.**

This entry is longer than the change deserves, because the failure it can produce is a **silently
lost capture**, and a silently lost capture in a capture app is the worst bug the product can have.

**The decision:** Park does not wait for IndexedDB. The field clears and refocuses synchronously the
moment Park is pressed, and the database write settles behind it. This is the one place in the app
where the UI says "done" before the disk does.

**The four steps in `CaptureView.handlePark`, and the order is the whole thing:**

1. **Hold.** Put the text in `inFlightRef` before anything is cleared. This is the only copy of the
   user's words outside React state, and it must survive a re-render.
2. **Release.** Clear the field, refocus, fire the haptic and the commit motion. Synchronously.
3. **Settle.** Await the write, behind the user.
4. **Recover.** On failure, put the words back in the field with their tag, plus a `console.warn`
   carrying the text so it is retrievable even if the UI recovery also fails.

**The rules:**

1. **Nothing between the hold and the release may be async.** Not a state read, not an await, not a
   `queueMicrotask`. The release happens in the same synchronous block as the keypress handler, or
   the field's readiness is a function of something else again.
2. **`inFlightRef` is a ref, not state.** It must not trigger a re-render and it must survive one.
3. **A failed park never clears silently and never auto-retries.** A silent retry can double-write.
4. **If the field already has new text when a park fails**, the failed text is appended to the error
   rather than overwriting what the user has since typed. Losing the new thought to recover the old
   one is not a fix.
5. **The commit animation never reads `inFlightRef`.** Motion and persistence are independent;
   coupling them is how a slow disk becomes a stuck animation.

**If parks go missing, this is the table to read at 4am:**

| Symptom | Likely cause | Where to look |
|---|---|---|
| Thought typed, Park pressed, not in Review | The write rejected and recovery did not run | `handlePark`'s catch, and whether `restoreFailedPark` is wired |
| Field clears but the count does not increment | Optimistic UI updated, write failed, error swallowed | Whether the catch is `catch {}` rather than handling |
| Missing only on voice parks | `session.stop()` rejecting inside the same try | `stopAndParkVoice`, which has its own hold/release |
| Missing only on the phone | IndexedDB quota, likely stored audio blobs | Browser storage inspector; `ROADMAP.md` flags quota as future work |
| Two captures for one Park | A retry was added, or the hold was not cleared | `inFlightRef.current.delete` on both paths |
| Field does not clear at all | Something async crept in above the release | Step 2 of `handlePark` |

**BUILT IN PHASE 4, 2026-09-18.** This entry was written as a decision and the code did not follow
it: `handlePark` awaited `parkCapture` before clearing the field, there was no `inFlightRef`, and a
rejected write threw with no recovery and no `console.warn`. All four steps now exist. Verified in a
browser rather than by reading, because a capture path that silently drops one in a hundred looks
exactly like one that works:

| Checked | Result |
|---|---|
| Field usable immediately after Enter | focused, empty and enabled in the same tick |
| Two parks in under a second | both stored, count 2, no queue, 58ms of wall clock |
| Forced write failure | text back in the field, error shown, `console.warn` carried the words |
| Failure landing while the next thought is being typed | `"The new thought!\nThe old thought"`: nothing overwritten, and the caret stays on the person's own line |
| Rows written on a failed park | zero |

**The caret was a real find and rule 4 did not cover it.** Rule 4 says the failed text is appended
rather than overwriting what has been typed since, and that held. What it did not say is that
rewriting a controlled field moves the caret to the end, so the rest of what someone was mid-way
through typing landed inside the recovered sentence: `"The new thoug\nThe old thoughtht"`. Nothing
was lost and it still arrived shredded, at the exact moment they were being told the last one
failed. `restoreFailedPark` now puts the caret back where the person was. **Rule 6, new: a recovery
may not move the caret.**

**The trade, stated plainly.** Given up: the guarantee that the UI never says done before the disk
does. Gained: a field ready in 0ms rather than in however long IndexedDB takes, which is the single
biggest contributor to whether a hijacked person parks a thought or gives up. Residual risk: if the
write fails *and* recovery fails, the capture is gone with no trace. That is the one scenario this
design cannot make safe, which is why the `console.warn` is part of the change and not an optional
extra.

## D-005: Never add an unlayered global reset

**2026-09-18. Closed. Found by rendering the app, not by reading it.**

`src/nil-ds/core/core.css` opened with an ordinary-looking reset and was imported with a plain
`@import`, so it landed **unlayered**. Tailwind v4 puts every utility in `@layer utilities`, and
unlayered CSS beats layered CSS regardless of specificity. A zero-specificity `*` selector outranked
every padding and margin utility in the application.

**72 utilities across five files were dead.** At 1280px the whole app sat in a 512px column in the
top-left corner; at 390px every screen ran edge to edge with no gutter. `gap-*` still worked, because
gap is neither margin nor padding, and inline styles still worked, which is exactly why the five UI
primitives looked padded and the four screens did not.

Nothing errored, nothing warned, and it survived months of work. **A large part of what "the UI
looks the worst" was pointing at was this, and none of it was a taste problem.**

Fixed by deleting `core.css`. The reset is deliberately not recreated: Tailwind's preflight already
resets `margin` and `box-sizing` inside `@layer base`, where utilities correctly win.

## D-006: Tailwind compiles class names out of prose

**2026-09-18. Closed, with a permanent guard.**

Tailwind v4 scans the repository and cannot tell documentation from markup. Adding two markdown
files with no code changed emitted fourteen real, broken CSS rules into production from ordinary
English words: `shadow`, `blur`, `fixed`, `inline`, `static`, `ring`, `rounded`, `transform` and
more.

There is no way to write about a design system without using those words, so a writing rule cannot
fix this. The guard is in `src/index.css`:

```css
@source not "../*.md";
@source not "../docs/**/*.md";
@source not "../.cursorrules";
```

`.github` is on that list for a reason worth stating. The CI job that asserts these rules never
ship has to name the rules, and naming them shipped them: adding `.github/workflows/verify.yml`
put `.backdrop-filter`, `.font-sans` and `.invisible` straight back into production CSS, 1.43 KB of
it. The check caught its own side effect on its first run, which is the only reason it was noticed.

Verified on `tailwindcss@4.3.3`. If those lines disappear the leak returns silently, because the
rules are valid CSS. They just are not yours. CI asserts the directives are present for that
reason: a guard that can be deleted without a sound is not a guard.

## D-007: Design direction is the gravity well, not Depth Field

**Approved 2026-09-18. Closed.** The binding document is `docs/LOOK.md`.

The direction is the **gravity well / refraction lens**, closest to the Krea agent UI: a dark
ground with a fine starfield, one large fully-rounded input field barely lighter than the ground
with a luminous rim, and **the starfield bending around the field**. The field is not raised and
not recessed. It is heavy. Depth is expressed by what an object does to its surroundings, never by
a shadow attached to its edge.

It is also the right metaphor. TetherLog is a place to drop a thought so it stops pulling at you,
and a gravity well is something with enough mass to hold a thing you let go of.

**This is the third attempt at a direction and the first grounded in pictures rather than
adjectives.** Words like "modern", "sleek" and "minimal" map to hundreds of different screens,
which is why the first two failed. `docs/LOOK.md` was derived from twelve visual references and it
is binding. Read it before any visual work.

**What it replaces.** An earlier plan proposed three dark directions, Aperture, Monolith and
**Depth Field**, and recommended Depth Field: planes at distances with a variable font width axis
carrying the z-axis. `docs/LOOK.md` superseded all three. **Depth Field is dead**, including its
width-axis depth cue and its `Plane` primitive. Its contrast-checked palette survives only as
reference material in `docs/BUILD-SPEC.md`, which is marked accordingly, because the ratios were
real work even though the mechanism is not the one being built.

**Three rules from `docs/LOOK.md` that contradict everything written before it:**

1. **Radius is generous.** The old `0px` lock is dead.
2. **Depth is what an object does to its surroundings**, never a shadow attached to its edge.
3. **Never same-colour-as-ground plus two soft shadows.** That is neumorphism and it is the one
   thing explicitly rejected. The test: if you removed the shadows, would you still know the object
   was there? Under neumorphism the object *is* the shadows.

**The constraint the direction must respect.** `PRODUCT.md` forbids ambient motion in the capture
path. A drifting starfield is an ambient loop and is not allowed. The resolution is not a
compromise: **the field is static at rest.** Star positions are computed once and the distortion is
a still warp, redrawn only at the four moments and nowhere else. No `requestAnimationFrame` loop,
no drift, no shimmer.

**Cost.** A single fullscreen fragment shader, roughly 4 KB of JavaScript and GLSL, no library. GPU
time during transitions only. The capture field is real DOM and works the instant the page does;
the lens layers in behind it, so **capture never waits on the GPU**. Roughly 2% of devices get no
WebGL and lose nothing functional. A Canvas 2D approximation was tried and was not good enough; do
not reach for it again as a cost saving, because there was no cost to save.

## D-008: Verification is off the deploy path, as a controlled experiment

**2026-09-18. OPEN. Root cause still unknown.**

Every Vercel deployment on 2026-09-18 failed after `npm run build` was changed to
`npm run privacy:check && npm run tokens:check && tsc -b && vite build`. The commit before deployed
green; every commit after errored, on both `main` and the branch.

**It did not reproduce locally.** A clean shallow clone with `npm ci` and `CI=1 VERCEL=1` built green
at the first failing commit and at HEAD. The build logs were not readable with the available
credentials.

It was settled by changing exactly one thing back. The next deployment went `READY` immediately. The
cause was the bash scripts in the build command; **the precise mechanism is still unknown.**

**So `npm run build` stays `tsc -b && vite build`.** Verification runs in GitHub Actions
(`.github/workflows/verify.yml`), where the logs are readable, and locally via `npm run verify`
before pushing.

**To close this entry**, someone needs readable Vercel build logs for a deployment with the scripts
restored. Until then it stays open and the workaround stands.

**The wider lesson, and it is the second time this repo has taught it: a green local build proves
nothing about Vercel.** The first time it was a sibling-repo path (`f1416d2`); this time a shell
script. Both looked fine locally.

## D-009: The docs collapse

**2026-09-18. Closed.**

Documentation had outgrown the application: 3,210 lines of docs governing 2,585 lines of code, with
`docs/UI-OVERHAUL.md` alone at 1,880 lines. Six files read as binding and one of them,
`DESIGN.md`, was explicitly historical while sitting in the repo root looking exactly as
authoritative as `PRODUCT.md`. Four documents still described `LogStack` as live; it was imported by
nothing.

**Done:** `DESIGN.md` deleted. `docs/UI-OVERHAUL.md` split into this file and `docs/BUILD-SPEC.md`,
with the audit, the rip-out plan and the two rejected directions deleted outright. `LogStack.tsx`
deleted. All cross-references updated.

**Three things were found during the collapse, all the same shape: a document describing something
that is not there.**

1. `LogStack.tsx` was described as live in four documents and imported by nothing.
2. **`.cursorrules` has never existed in this repo.** `CLAUDE.md` opened by explaining how the two
   files relate, `ROADMAP.md` told you to copy it in, and `src/index.css` guards against it. It was
   never committed.
3. Adding `.github/workflows/verify.yml` leaked three utilities into production CSS, because the
   job that checks for leaked utilities has to name them. See D-006.

**The rule going forward:** a document that describes a state the code has left is worse than no
document, because it reads as current. When a phase completes, the spec for it moves to a decision
entry here or it goes. The mechanical version of this check is cheap and worth keeping: for every
backticked path in the docs, assert the file exists.

## D-010: React held at 19.2.8 on bundle grounds

**2026-09-18. Open, and cheap to reverse.**

Dependencies were swept: **0 vulnerabilities**. Every semver-compatible update was taken (Vite
8.3.0, Dexie 4.4.6, ESLint 10.10.0, typescript-eslint 8.70.0, the React types, plugin-react,
globals).

**React and React DOM are held at 19.2.8 and pinned to an exact version** so `npm update` does not
take them silently. Measured, not assumed: 19.3.0 costs **+8.64 KB gzipped** on its own, taking the
bundle from 114.50 to 123.14 KB against a 130 KB budget. Every other update in the sweep was free.

That leaves 6.9 KB of headroom instead of 15.5, immediately before two phases that spend budget:
Phase 3 adds self-hosted fonts and Phase 4 adds the WebGL shader, roughly 4 KB. There is no
security reason to move and no feature in 19.3.0 the app needs.

**To reverse:** set both back to `^19.2.8` and run `npm update`. Worth revisiting once the shader
has landed and the real number is known.

**The four major updates were then measured individually and resolved in D-012.**

## D-011: The ground is dark

**Decided 2026-09-18. Closed.** This was the last thing blocking Phase 3.

`docs/LOOK.md` left light or dark open and proposed dark. The mechanism works on either, so this
was a real choice: on a light ground the capture field would be a depression bending a fine grid or
grain rather than a starfield, and the gravity well would still read.

**Dark, for three reasons.** It is what the closest reference does, and that reference is the one
the whole direction was derived from. A warm-white ground is already ruled out, so light would mean
a cool near-white, which none of the references establish. And the starfield is the literal form of
the metaphor: a thought with enough mass to hold what you let go of reads better against space than
against paper.

**What this unblocks.** Phase 3 can start. The palette, the PWA `theme-color`, the favicon and the
contrast targets all follow from the ground.

**What it does not settle.** The exact ground value. `docs/BUILD-SPEC.md` section 1 carries a dead
direction's `#0a0b0e` as reference only; Phase 3 derives the real one from `docs/LOOK.md`.

## D-012: zod on mini, dexie-react-hooks on 4, TypeScript held

**2026-09-18. Closed for three of four.** Each major was measured rather than judged on reputation,
and the result contradicted the received wisdom on two of them.

### zod 3 to 4, on the `mini` export. Taken.

| Variant | JS gzipped | Against today |
|---|---|---|
| zod 3.25.76 | 114.50 KB | baseline |
| zod 4.6.5, standard export | 125.41 KB | **+10.91 KB** |
| zod 4.6.5, `zod/mini` | **106.76 KB** | **7.74 KB smaller** |

Standard zod 4 is substantially **bigger** than zod 3, which is the opposite of how the release is
usually described. The size win belongs to `zod/mini` alone.

`zod` lives in exactly one file, `src/types.ts`, holding eight simple schemas. The only API
difference that mattered was `z.optional(z.string())` in place of `z.string().optional()`; `mini`
drops the chainable builder methods but keeps `.parse()`, which is all `agent.ts` ever calls.

**Verified in a browser, not by typecheck**, because a schema library that silently stops
validating looks exactly like one that works:

- the rule triage path ran `reviewBatchSchema.parse()` for real and rendered its suggestions
- a valid payload is accepted
- a bad enum value, a missing required field, a wrong scalar type and an absent `summary` object
  are each **rejected**
- an omitted optional field is still accepted

**If richer schema features are ever needed**, `mini`'s functional API is more verbose than the
standard one. That is the trade, and it is worth 7.74 KB while the budget is tight.

### dexie-react-hooks 1.1.7 to 4.4.0. Taken.

The 1 to 4 jump reads as three breaking majors and is not: it is version alignment with Dexie 4.
One API, `useLiveQuery`, across 12 call sites in three views. Clean typecheck, **+0.05 KB**, and
every live query verified working in the browser: the capture write path, the open capture count,
Patterns and Settings.

### TypeScript 6 to 7. Refused, and not a judgement call.

`tsc` and `vite build` both succeed on TypeScript 7.0.2. **Lint does not**, and lint is now a
blocking gate:

```
Error: typescript-eslint does not support TS 7.0.
```

An explicit refusal, not a subtle incompatibility. Revisit when typescript-eslint ships TS 7
support. Until then TypeScript stays at 6.0.3.

### @types/node 24 to 26. Left.

Dev-only, zero runtime, zero bundle, no benefit right now. Take it free whenever something else
touches the lockfile.

### Where the budget stands

**106.76 KB of 130.** Combined with holding React at 19.2.8 (D-010), roughly 23 KB of headroom
going into Phase 4, which spends about 4 KB on the shader.

## D-013: Copy leaves the overhaul phases, and the phase sequence was wrong

**2026-09-18. Closed as a process decision; the sequencing consequence is live.**

### Copy is not owned by the UI overhaul any more

Copy is being worked separately and this repo's phase plan must not touch it again. Phase 3's
acceptance criteria included a copy pass; that was removed.

**16 strings were already changed and pushed in `9df1da0` before this decision.** They are listed
here so the copy work inherits them rather than colliding with them:

| Where | Change |
|---|---|
| `CaptureView` confirm | "Logged." became **"Parked."**, which `PRODUCT.md` always specified |
| `CaptureView` sub-line | "Park it. Go back. No thinking here." became "Park it. Sort it tonight." |
| `agent.ts` | 5 triage reason strings, em dashes removed |
| `hands.ts` | 4 strings, including the markdown export heading and the mailto subject |
| `ReviewView` | 5 strings |
| `SettingsView`, `PatternsView` | 1 each |

Most were corrections rather than choices: `PRODUCT.md` compliance and the em dash rule. **They are
not a copy direction and should not be treated as one.** Anything the copy work decides supersedes
them.

### The sequence was wrong, and it is worth saying why

Phase 3 delivered colour, type and copy with the layout untouched, then asked for a verdict on the
palette and the typeface.

**A first version of this entry said the problem was that there was no composition to judge. That
was wrong, and the correction is the useful part.** A composition existed the whole time: six
elements in a stack, inherited from the NIL era. That is a wireframe and it was always judgeable.
Asked about it, the immediate reading was that Capture is cluttered for what it does, and that
Mic should be an icon rather than a full-width button matching Park.

**The real fault is that no phase ever owned the structure.** Phase 3 repainted the inherited
layout without asking whether the layout was right. Phase 4 was scoped around motion and the
shader. So the arrangement of the one screen the product exists for was never on anybody's agenda,
and it survived a whole overhaul unexamined. That is why the clutter went unnoticed, not because
it could not be seen.

**The lesson for the phases that remain: question the wireframe before painting it.** Structure is
judged first and on its own, and it does not need colour, type or motion to be judged. Copy and
layout are also one decision, not two: where a sub-line goes and whether there should be one at
all are the same question.

**What was genuinely right to do early**, and would be done the same way again: proving the
typeface actually loads, that the token pipeline reaches the components, that contrast passes, and
that the PWA chrome agrees with the ground. That is plumbing, and plumbing before composition is
correct. **The mistake was labelling plumbing as a design phase and asking for a design verdict on
it.**

### Provisional verdicts, explicitly not final

- **The violet is fine for now** and is expected to change once there is a composition to judge it
  against. Not a decision, a placeholder.
- **The type is bland**, noted at the time it was reviewed. The five-step scale stands as
  structure; how it is used is a layout question.

**For the phases that remain:** Phase 4 onward are the design phases. They own layout, density and
composition. They do not own copy.

## D-014: Capture's composition, and what six elements became

**2026-09-18. Closed.** This is the clutter brief in `docs/BUILD-SPEC.md` Phase 4, answered. It was
answered before any shader work, because a well behind a cluttered screen is still a cluttered
screen.

**Six elements at rest became three: the headline, the sub-line, the field.**

### The five open questions, and the answers

**Where do Park and Mic live? Inside the field.** Mic is a quiet glyph on the field's trailing edge
and Park is an accent disc beside it. This was the one question put to a person rather than decided
here, because it is the composition of the screen the product exists for. The alternative was a
control row under the field, which is roomier for text at 390px and is still two objects. The
direction is one heavy object with space bent around it, so the controls went inside.

**What is the resting element count?** Three. The field is the only thing above the fold with the
headline, at 390px and at 1280px.

**Do the chips appear at rest?** No. They appear only once there is text, in a reserved line under
the field, with no transition. `PRODUCT.md` forbids questions at park time and three chips sitting
on an empty screen are a question. Once the thought is already in the field, tagging it is an
option rather than a gate. No transition, because nothing animates in response to typing.

**Does the sub-line persist?** Yes, unchanged. `docs/LOOK.md` defends it explicitly: it tells you to
let go and it tells you what happens next, which is the thing that makes letting go safe. It is one
13px line and it earns its place.

**What is Park for on desktop if Enter parks?** It is the target. The disc is a ring when the field
is empty and fills with accent when there is something to park, so **the one colour per screen is
present in every state, on the same element**, rather than blinking into existence when you start
typing. Same object on the phone, where it is also the thumb target. No responsive difference.

### One reserved line, three jobs

The line under the field is always the same height and holds: nothing at rest, the tag chips once
there is text, the confirm word after a park. The two can never collide, because a park empties the
field. **Nothing on this screen moves, ever.**

### What rendering it found, and reading it would not have

1. **The field rose by 66px the first time anything was parked.** The peek stack was rendered
   conditionally, so it shrank the centred block above it. The one screen that must never move,
   moving, at the exact moment a person is watching to see whether their thought landed. The stack
   slot is now a fixed height whether or not anything is in it.
2. **The luminous rim became the default for every `Field`.** Settings then rested with the one
   colour per screen appearing three times: the API key field, the reminder hour and Save settings.
   The rim is the capture field's mass signature, not a generic input treatment, so it is opt in and
   every other field keeps the structural rule token.
3. **A blank third row in the peek stack was invisible, not subtle.** Every surface token measures
   1.10:1 to 1.24:1 on this ground, so a textless bar cannot be seen at all. It is gone. The count
   says there are three while showing two, and that is the cue. **Rendering something nobody can see
   is worse than rendering nothing, because it reads as done.**

### Copy this phase touched, for the copy work to inherit

Phase 4 does not own copy and did not set out to change any. Three things happened anyway and are
listed here rather than buried:

| What | Why |
|---|---|
| **New:** "That one did not save. It is back in the field." | D-004 requires the recovery to be visible and there was no failure string at all, because there was no failure path. |
| **New:** "3 parked today" | Specified in `docs/LOOK.md`'s copy table and never built. Pluralised for one. |
| "Mic" and "Stop and park" are no longer drawn | They are the `aria-label` on their glyphs, verbatim. Nothing is lost to a screen reader and the copy work still has the strings. |

### Left alone, and worth saying

The recording timer carries `aria-live="polite"` and updates four times a second, which is four
announcements a second on a screen reader. It shipped that way and Phase 4 did not change it: it is
not a composition question and it should not be guessed at without testing on a real screen reader.
**Flagged for whoever owns accessibility next.**

## D-015: The gravity lens

**2026-09-18. Closed.** `src/components/GravityField.tsx`. One fullscreen fragment shader, no
library, **4.84 KB gzipped measured by building with and without it**, against the roughly 4 KB
`docs/LOOK.md` budgeted.

### How the arcs are made

Not by smearing the sample along the tangent. The offset from each star is measured in a squashed
space whose long axis follows the bend, so the star is **drawn** as an ellipse stretched along the
tangent: one sample per layer, and the arc is continuous. Multi-tapping instead needs a tap roughly
every pixel to avoid drawing three separate dots, which is about twenty samples per pixel at full
stretch, on every pixel of the screen.

The stretch asymptotes rather than growing with mass. Past about 3.5 the ellipse outgrows its own
grid cell and the star clips into a hard edge instead of fading out.

### The tuning finding, and it is the useful part

**The sweep and the arcs were cancelling each other out.** Space nearest the mass is swept clear of
stars, which is right and physical. The first tuning cleared them out to three quarters of the
influence radius, which is precisely the band where the stretch is strongest. So the screenshot
showed a plain field on a plain ground: the shader was working perfectly and painting almost
nothing. The sweep is now a tight collar that ends where the arcs begin.

### Star brightness is a contrast constraint, not a visual one

The headline and the sub-line sit on this field with no surface under them, so **the brightest star
is their background** wherever one lands behind a glyph. Measured off rendered frames, not
calculated:

| Near-layer gain | Brightest painted star | `--tl-ink` on it | `--tl-ink-muted` on it |
|---|---|---|---|
| 1.00 | `rgb(76, 82, 94)` | 7.9:1 | **3.62:1, fails AA** |
| 0.72 | `rgb(62, 67, 77)` | 9.02:1 | **4.29:1, fails AA** |
| **0.64, shipped** | `rgb(56, 61, 70)` | **9.91:1** | **4.71:1** |

Star coverage above twice the ground value is 0.43% of pixels. **Raising these gains puts 13px muted
copy under AA over the brightest stars.** They are a contrast constraint wearing a visual hat and
they are not a taste knob.

### Nothing loops, and it is instrumented rather than asserted

`requestAnimationFrame` is wrapped in the harness and counted. Idle at rest: **0 calls in 3
seconds.** Idle and focused: **0 calls in 3 seconds.** A whole park arc: 10 to 21 calls. Idle after
the arc settles: **0.** The frame function schedules its successor only while an arc is running and
the exit that leaves nothing scheduled is the one where nothing is moving.

### The rest of the contract, checked

- **Capture never waits on the GPU.** The context is created after first paint, off the idle
  callback. One context per page.
- **No WebGL loses nothing.** With `getContext` returning null for `webgl`, park still works, the
  stack still fills and the console is clean.
- **Reduced motion runs zero frames for a whole park.** `--tl-duration-confirm` reads 1.2s and
  `--tl-light-commit-peak` reads 0, so the commit light does not fire: a flash with no travel is a
  strobe.
- **The rim, measured from painted pixels:** 3.48:1 against the ground and 3.25:1 against the field
  at rest, 5.69:1 and 4.92:1 on focus. Both sides clear WCAG 1.4.11 in both states, and focus is
  visibly brighter in a still.

### The one that will bite again

**A negative `z-index` paints a fixed canvas behind an ancestor's background.** `App` carries
`bg-ground`, so `-z-10` rendered the entire starfield into a canvas nobody could see: build green,
instrumentation perfect, screen empty. The canvas is `z-0` and the content above it is `z-10`.

### Spring curves as numbers

`scripts/build-tokens.mjs` now emits `src/motion/springs.generated.ts` alongside the CSS. A canvas
cannot read a CSS easing, and solving the springs twice is exactly how a DOM arc and a WebGL arc
drift apart. Same solve, two outputs, and `npm run tokens:check` diffs both.

The generator also learned to put a reduced-motion override on the **semantic** name, not only the
primitive. Before this, `--tl-ref-motion-duration-confirm` was overridden inside the media query and
nothing could read it, because components may not read primitives. The override reached nothing.

## D-016: Tier 1 of the refraction lens, and the commit sound

**2026-09-22. Closed, Tier 2 (a flowing streak field replacing the point stars) explicitly not
attempted here — see docs/DECISIONS.md's own note below.**

D-015 shipped the gravity well as a starfield that bends around the field, with the field itself
left as flat CSS. Comparing it directly against the artifact that was actually approved on
2026-09-18 (`https://claude.ai/artifact/EvKDzM63jz98439hBFDrMk`, its shader still readable in the
page) found six things the approved version did that the shipped one didn't: a glass body, real
refraction, chromatic dispersion, a specular highlight, a nebula bloom, and dither. This entry is
that gap closed for the field's own body. The starfield's rendering (`sky()`, `starLayer()`) is
untouched.

### What changed

`GravityField.tsx`'s fragment shader gained a signed-distance lens profile (`sdBox`, ported near
verbatim from the approved artifact), a surface normal from that profile's finite difference, and a
lens body: refraction (background sampled at an offset per RGB channel — the offset difference IS
the dispersion), one fixed-direction specular highlight, a shader-drawn rim, and a small nebula
bloom behind the field. `Field.tsx` gained a `glass` prop: when true, its CSS background and border
go transparent so the shader's rendering is what's actually seen; when false — before the lens has
initialised, or on the ~2% of devices with no WebGL — it keeps the exact opaque look D-015 shipped.
`CaptureView` wires `GravityField`'s new `onReady` callback to that prop, so the fallback is
automatic rather than assumed.

**Thickness rides the existing mass arc.** The approved artifact drove `uThick` and `uMass` off two
parallel timers. Rather than add a second arc system to a file whose whole discipline is one
arc, one schedule, one idle exit, thickness is a plain linear remap of the mass value the file
already computes (`MASS_REST` to `MASS_FOCUS + MASS_COMMIT`). Every invariant the existing arc
already keeps — interruptible, reduced-motion-correct, idle at rest — applies to the lens body for
free.

### A coordinate bug, caught by rendering rather than reading the diff

The approved artifact flipped `gl_FragCoord` to a top-left-origin `uv` before doing any of this
math; this file inherits the star shader's native bottom-left-origin convention instead. Porting the
light direction verbatim (`vec3(-0.42, -0.72, 0.55)`) lit the field from the **bottom**-left, not the
top-left docs/LOOK.md rule 2 calls for. Caught by rendering a frame and comparing it to the reference
screenshots, not by reading the shader. Fixed by flipping the sign of the y component
(`vec3(-0.42, 0.72, 0.55)`) rather than the coordinate space itself, which would have touched the
untouched star code.

### Tokens, all in `tokens.json`'s new `lens` and `sound` groups

| Token | Shipped value | Note |
|---|---|---|
| `lens.thickness.rest` / `.commit-peak` | 0.42 / 1.0 | Matches the approved artifact's own values |
| `lens.dispersion` | 0.5 | First pass shipped 0.35 out of unwarranted caution; raised to match what was actually approved — there is no product reason to restrain it |
| `lens.specular-strength` | 1.0 | The approved artifact applied no damping scalar; matched rather than guessed at |
| `lens.rim-strength` | 0.85 | Raised from a first-pass 0.32. The real source video's rim was flagged as brighter and thicker than either build; a muted rim was the opposite of the note it was meant to answer |
| `lens.bloom-strength` | 0.09 | Kept small and tight to the well; see the contrast measurement below |

### Contrast, measured after the change, not assumed safe

D-015's star-brightness table stands: this entry doesn't touch `sky()`. The new bloom term was
checked separately by rendering a frame and reading back the actual canvas pixels (`gl.readPixels`,
`preserveDrawingBuffer` forced on for the check only) across the full headline bounding box, not a
single sampled line:

| | Brightest pixel found | `--tl-ink` on it | `--tl-ink-muted` on it |
|---|---|---|---|
| Full grid over the headline | `rgb(50, 53, 65)` | 11.08:1 | **5.27:1** |

Both clear AA with margin, and the brightest pixel found is darker than D-015's own documented worst
case (`rgb(56, 61, 70)`), consistent with the bloom term's falloff being negligible by the time it
reaches the headline (~150px away) — the star sky() gains remain the limiting factor, exactly as
before.

### What this is not

**Not Tier 2.** The real source (@soulegit, 2026-09-15) renders flowing curved light streaks, not
discrete stars — closer to a warp field than a starfield. That's a rendering-model change, not a
tuning pass, and it's deliberately not attempted in this entry. Evaluate it on its own measured
merits, separately.

**Not constant ambient motion.** The source video loops continuously because it's a marketing reel.
`CLAUDE.md` forbids exactly that in the capture path, written for the ND audience this product is
for. Nothing here reopens that rule.

### The commit sound

`src/lib/sound.ts`, one function, `playParkSound()`. Synthesized via Web Audio — a sine oscillator
through a lowpass filter, pitched down from `sound.commit.frequency-start` to `-end` over the
existing commit spring's own duration (`springs.commit.durationMs`, not a new hardcoded one) — no
asset file, no network request. Fires once, on commit only, from the same synchronous point in
`CaptureView.releaseField()` that already calls `hapticPark()`.

**Off by default.** `AppSettings.soundEnabled`, a plain boolean next to `reviewReminderEnabled`,
surfaced in Settings the same way. This is new user-facing surface on `src/types.ts` and
`src/db/index.ts`, both normally do-not-touch: the addition is the minimum one field, following the
existing pattern exactly, because the feature was explicitly asked for rather than incidental.

**Verified in a real browser, not by reading the diff:** zero oscillator starts with the setting off,
exactly one after turning it on and parking, in both cases with zero console errors. No-WebGL
fallback re-checked after this change specifically: `Field`'s shell renders its normal opaque
background and rim border, park still succeeds, nothing regresses. Double-park re-checked: two rapid
parks still produce two captures, no queueing. Reduced motion re-checked: zero `requestAnimationFrame`
calls at rest, park still confirms.

### Open, deliberately

**A user-facing accessibility consideration beyond the on/off switch** — the sound's frequency
range, or other accommodations specific to this product's audience — is flagged for a later look,
not resolved here. Off-by-default is the mitigation for now.

**JS budget:** 115.71 KB gzipped, up from 114.50 KB before this entry, against the 130 KB ceiling —
about 14.3 KB of headroom left. CSS 5.32 KB, up marginally from the nine new custom properties.

## D-017: Phase 5's structure — two states, not one scrolling page

**2026-09-22. Closed, not built.** `CLAUDE.md` flagged Review's first question as "structural, not
visual" without ever writing down what the question was — the same shape of gap Phase 4 closed with
D-014's "six things become three" brief before any shader work started. This is that brief for
Review.

### The actual question

`docs/BUILD-SPEC.md`'s Phase 5 acceptance criteria already commit to "one triage card fills the view
... not a list," but the current `ReviewView.tsx` renders every suggestion as a flat stack on one
scrolling page alongside Wins, the backlog toggle, the summary and Hands. That page has never been
rebuilt against the approved direction. The open question was never "what does the card look like" —
it was **whether the one-card-at-a-time queue lives embedded on that same kitchen-sink page, or
whether Review becomes a two-state screen: the queue first, full screen, then everything else
second.**

### The decision

**Two states.** Review opens straight into a full-screen, one-card-at-a-time triage ritual — Wins,
the backlog toggle, the summary and Hands do not exist on screen yet. Once the queue is empty, it
hands off to a second state carrying all of that: Wins, the triage summary, carry-forward, Hands.

**Why, not just what:** the rest of this product is built as a calm room — capture is silent and
asks nothing, and `PRODUCT.md` forbids streaks, guilt, and day-over-day comparison. A single
scrolling page that mixes the triage ritual with wins, an AI-triage button, a backlog checkbox and an
export row asks someone to hold all of that at once while they are mid-ritual. Splitting it into
"triage, then done" matches the same one-thing-at-a-time discipline `docs/LOOK.md` already applies to
Capture, rather than treating Review as a different kind of screen by default.

### What does not change

`docs/BUILD-SPEC.md`'s existing Phase 5 acceptance criteria (bucket colour as a leading-edge bar
never the sole carrier of state, confirm as the one accent per card, the Hands row wrapping at
390px, "Parked." agreeing with Capture) all still apply — they describe the triage state's own
card, which this decision does not touch. This entry adds the screen-level architecture around
them; it does not replace them.

### Not decided here

The wrap-up state's own layout, the exact hand-off moment (does the last card's confirm animate
into the wrap-up, or does the screen just change), and whether Patterns/Settings navigation is
reachable mid-ritual or only from the wrap-up state. Phase 5's build session should settle these
against `docs/LOOK.md`'s existing rules before writing components, the same way D-014 settled
Capture's composition before any shader work began.

## D-018: Review's hand-off, its navigation, and the wrap-up's layout

**2026-09-22. Closed and built.** D-017 settled the structure and explicitly left three things to
this build session: the hand-off from the last card, whether Patterns and Settings are reachable
mid-ritual, and the wrap-up state's own layout. All three are answered here, against
`docs/LOOK.md`'s existing rules rather than fresh ones.

### The hand-off is not a moment

**The last card leaves on `--ease-dismiss` exactly as every other card does, and the wrap-up rises
on `--ease-settle` in the space the next card would have used.** It is the same two animations, on
the same two springs, with nothing added for the fact that the queue happened to run out.

Four reasons, none of them taste:

1. **A flourish for finishing is a celebration.** `PRODUCT.md` forbids celebration, confetti and
   anything that rewards returning. "You got to the end" is the exact sentiment the rule exists to
   keep out.
2. **There is one light event in the whole app and it belongs to Capture's commit.** `CLAUDE.md`
   says commit is where the motion budget goes and that if one moment is exceptional it is the
   handover. A second exceptional moment on Review spends a budget that is already committed.
3. **Triage is repetitive by design**, so `docs/BUILD-SPEC.md` gives it the shortest motion in the
   system. If the seventh card behaves differently from the sixth, the screen has taught the person
   that finishing is the point, and the point is that the thought is gone.
4. **The code does not know which card is last.** The queue is derived from the database, so "the
   last card" is not a state that exists in advance: it is the moment nothing is left. Building a
   transition for it would mean inventing a concept the data model does not have.

The one piece of machinery this needs is that the leaving card outlives its own screen. It is
rendered as a ghost at the Review root, pinned to the rect the real card occupied, so it keeps
animating across the swap from the triage state to the wrap-up instead of being unmounted with it.
Each ghost is keyed by capture id and removed by its own timer, so two confirms in a row animate two
independent elements. Measured in the browser at 30ms apart: two `tl-triage-leave` animations
running at different offsets, one `tl-triage-rise` behind them, and the second card clickable
throughout. **Motion never queues.**

### Patterns and Settings stay reachable, and so does Capture

**The navigation is unchanged on both states.** No kiosk mode, nothing hidden until the queue is
empty.

1. **A thought that arrives mid-triage is the thought this product exists to catch.** `PRODUCT.md`
   is built on parking in under five seconds from wherever you are. Making Capture unreachable
   during Review is the one failure the product cannot afford, and Review is a screen a person sits
   on for minutes.
2. **A navigation that returns only when you finish is a completion gate**, and a completion gate is
   the guilt mechanic in different clothes. Untriaged is parked, not failure, and that has to stay
   true of a queue you walked away from halfway.
3. **Leaving costs nothing, so there is nothing to protect.** Every confirmed card is already
   written, and the queue re-derives itself from the database on return. Verified in the browser:
   confirm one, go to Capture, come back, and the same card is showing at the right position.
4. **Removing the only navigation is a keyboard and screen reader trap**, whatever it does for the
   composition.

The one thing genuinely lost by leaving is an AI triage run, which lives in component state. Rule
suggestions are recomputed identically, so the queue looks the same; the agent's reasons do not come
back. Storing them would mean touching the Dexie schema, which is on the do-not-touch list.

### The wrap-up's layout

**Space, not cards, and the sections are named in the body face.** A rule between them would have to
be `--tl-hairline`, which measures 1.08:1 on ground, 1.11:1 on raised and 1.15:1 on field. That is
not faint, it is invisible, and the structural rule token is reserved for boundaries a user has to
see. This is the same finding as the blank third row in Capture's peek stack (D-014).

**Order: the summary, then Wins, then Hands.** D-017 lists the contents rather than a sequence, and
the old scrolling page opened with Wins. Wins is a text field, which is a demand; the summary is
read-only and answers "what did I just do" without asking for anything. Reading comes before typing,
and Hands is the exit, so it is last.

**The backlog moved here and became a button.** It was a checkbox held open during triage. As a
control on the wrap-up it is a decision to start more triage, taken once and deliberately, and it
appears only when there is a backlog. It is never phrased as a count of what is owed.

**The display step belongs to the wrap-up's headline.** The triage state has no headline of its own,
which is what makes the arrival of "Evening review" legible as the hand-off without any animation
spent on it.

### What the triage card became

`FileCard` is gone, replaced by `TriageCard`. It was the last of the brutalist era in the component
directory: hard borders, a `3px 3px 0` offset shadow and a decorative `[` glyph, none of which
survive `docs/LOOK.md`. The name went with it, because a card that is only ever a triage card should
not be called something else.

| | |
|---|---|
| **Bucket colour** | A 4px bar on the leading edge, and the bucket written in words beside it. Read the card in greyscale and nothing is missing. |
| **Depth** | Value and occlusion, no border and no shadow. The card is `--tl-field`, the peek behind it is `--tl-raised` and starts underneath it. The same three cues as Capture's peek stack. |
| **The one accent** | Confirm, full width. The three overrides are unselected chips at `--tl-ink-muted`, 8.03:1 on the card, receding by value and weight as `docs/BUILD-SPEC.md` asked. |
| **Element count** | Four per card, down from five. The old card rendered the suggested bucket twice: once as a selected confirm chip and again in the row of all four buckets. |
| **The footer** | Pinned to the bottom on every card. Triage is the one repetitive action in the app and a target that moves between repetitions has to be found again every time. |
| **Carry forward** | `--tl-ink` text with a `--tl-bucket-do` marker, which is the fix `docs/BUILD-SPEC.md` asked for. It was `text-do` at 2.79:1 with the colour carrying the whole meaning. |

**The thought is set at the display step**, which is a departure from the Review blueprint in
`docs/BUILD-SPEC.md` and worth saying plainly. That blueprint asks for `--text-lg`, a Depth Field
size that does not exist in the live five-step scale, and the section is marked superseded for
exactly that reason. At 17px the thought did not fill a card that fills the view, and the screen
read as content followed by a hole. At 34px it is the one thing the screen is about, which is what
`docs/LOOK.md` means by one headline per screen, and it is the only display-sized element on the
triage state. There is a symmetry worth keeping: you type at 17px while distracted, and it comes
back at 34px when it is time to decide.

### What rendering it found, and reading it would not have

1. **`leading-display` was a token nothing could read.** `--tl-leading-display` has been in
   `tokens.json` since Phase 3 with no entry in the `@theme` block, so `leading-display` matched no
   utility and silently did nothing. It went unnoticed because Capture's headline is one line. The
   first multi-line display text in the app set 34px on 1.5 body leading and the lines fell apart.
   Same family as naming a font without loading it.
2. **Capping the card fixed 1280 and broke 390.** Left to fill the viewport the card is a 712px
   column at 1280 holding about 300px of content, because the wider the screen the fewer lines the
   thought wraps to. Capped at 32rem and centred it was square and composed at 1280, and at 390 it
   became a panel floating on a band of bare ground, which is an item on a page rather than the
   page. The card fills the view at both sizes and the emptiness is answered by centring the thought
   inside it.
3. **The bucket marker drifted to the wrong line.** Beside a two-line carry-forward sentence the dot
   sat between the lines rather than on the first one. It now centres itself in a box exactly one
   body line tall.
4. **The ghost re-used the live card's element ids.** Found because a test selector matched two
   elements at once. Harmless on the happy path, because the live card is replaced in the same
   commit, but a failed confirm puts its card back while its own ghost is still on screen, and two
   elements answering the same `aria-labelledby` is a card naming itself with somebody else's
   thought. The ghost has its own id namespace.
5. **Rule suggestions had to stop being derived from the live queue.** `ruleBasedTriage` grants
   carry-forward to the first `do` in the array it is handed, so re-running it against a queue that
   shrinks with every confirm moves the flag to the next `do` and offers "carry forward (max one)"
   on three separate cards. Suggestions come from an append-only ritual set instead, and a
   carry-forward already written tonight suppresses the offer on later cards. Verified: offered on
   one card, stored on one capture.

### Verified in a browser, not assumed from the code

| | |
|---|---|
| Queue empties | Six cards, positions 1 of 6 to 6 of 6, landing on the wrap-up with no cards and no ghosts left |
| Two confirms 30ms apart | Two independent leave animations at different offsets, second card clickable throughout |
| Reduced motion | Zero animations. Ghost at opacity 0 with no transform, next card at opacity 1 with no transform. Cards swap without travel |
| At rest | Zero running animations and zero `requestAnimationFrame` calls in one second |
| A failed write | The reserved line says so, the card returns to the queue, it does not move by a pixel, the database is untouched and a retry works |
| An override | Writes the chosen bucket and drops the agent's reason, as before |
| Leaving mid-ritual | Capture reachable, same card at the same position on return |
| Horizontal overflow | Zero at 390 and at 1280, Hands wrapping to three rows and two |

### Copy this phase touched

Phase 5 does not own copy. Three strings changed because the structure changed, and they are listed
here rather than buried, the way D-014 listed Capture's.

| What | Why |
|---|---|
| **New:** "N of M" | The ritual needs an end in sight. Mono micro, the same role as "3 parked today", and it counts down what is left rather than up what is done. |
| **New:** "That one did not save. It is back in the queue." | There was no failure path before, so there was no string. Agrees with Capture's "That one did not save. It is back in the field." |
| **New:** "Nothing to sort tonight." | Review with an empty queue and nothing triaged had no empty state at all; it rendered a heading and a disabled button. |
| **Retired:** "Rule triage" | Rule triage now runs on open, because it is local, synchronous and costs nothing. Only the Gemini call is a button, because only it leaves the device. |

### Numbers

| | Before | After | Budget |
|---|---|---|---|
| JS gzipped | 115.71 KB | 116.79 KB | 130 KB |
| CSS gzipped | 5.32 KB | 5.55 KB | 12 KB |

`CLAUDE.md` still recorded 113.07 KB and 5.01 KB, which predate the lens body and the commit sound
in `f1acb3d`. Both lines are now the measured figures.

### Left open

The wrap-up's four summary counts are body-sized text with a marker each. Patterns is where numerals
do their real work in the display face, and Phase 6 may well want the summary to agree with whatever
it settles. It is not changed here because Phase 6 owns that question.

# TetherLog decisions

What has been decided, when, and why. One entry per decision. Closed entries are not reopened
without a new entry saying so.

This file replaced `docs/UI-OVERHAUL.md` on 2026-09-18. That document had grown to 1,880 lines
governing a 2,585-line application: an audit of a state that no longer existed, a rip-out plan that
had already run, and two rejected design directions. The parts still doing work were split here and
into `docs/BUILD-SPEC.md`, which Phase 7 deleted in turn once the phases it held had all
landed (D-025). `git log` has both originals if they are ever wanted.

**Where things live now:**

| File | Job |
|---|---|
| `CLAUDE.md` | Binding rules and the gotcha list. Read before touching anything. |
| `PRODUCT.md` | Product spec. Binding. |
| `docs/LOOK.md` | Visual direction. Binding. |
| `docs/DECISIONS.md` | This file. What was decided and why. |
| `docs/BACKLOG.md` | Known, measured, deliberately not fixed yet. Nothing there blocks shipping. |
| `ROADMAP.md` | Feature delivery order, product-level. |
| `ARCHITECTURE.md` | Code structure. |
| `scripts/check-docs.mjs` | Asserts every path the docs name still exists. D-009's mechanical half. |

---

## Status

| | |
|---|---|
| Phases 1 and 2 | Done and pushed, 2026-09-18 |
| Phase 3 | **Built 2026-09-18, looked at and approved 2026-09-22** as good enough for now. The ground, the type and the PWA chrome. |
| Phase 4 | **Built 2026-09-18, enhanced 2026-09-22, looked at and approved** as good enough for now. Capture's composition, the lens, the arc, then the lens's own body and the commit sound. The starfield's colour, the sub-line and the sound default moved again in D-019. See D-014, D-015, D-016, D-019. |
| Phase 5 | **Built, looked at and approved 2026-09-22** as good enough for now. Two states: a full-screen one-card triage ritual, then a separate wrap-up. Structure in D-017, the three questions it left open in D-018. |
| Phase 6 | **Built 2026-09-22.** Patterns and Settings off the card shell, and one voice for a number across Review and Patterns. See D-021. |
| Phase 7 | **Built 2026-09-22, awaiting a look.** The sweep: the build spec deleted, every
document swept against D-009, the prose-leak traced to its real source and guarded. See D-024,
D-025 and D-026. |
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
reference material in the build spec, which marked it accordingly, because the ratios were
real work even though the mechanism is not the one being built. That file is gone as of D-025;
the live ratios travel in each token's own `$description` in `src/tokens/tokens.json`.

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

**What it does not settle.** The exact ground value. The build spec's section 1 carried a dead
direction's `#0a0b0e` as reference only; Phase 3 derived the real one from `docs/LOOK.md`.

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

**2026-09-18. Closed.** This is the clutter brief in the build spec's Phase 4, answered. It was
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
13px line and it earns its place. **SUPERSEDED 2026-09-22 by D-019: the sub-line is removed.** The
half of its job that made it earn its place, telling you what happens next, said "tonight".
Capture rests on two elements now, not three.

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
| `lens.bloom-strength` | 0.09 | Kept small and tight to the well; see the contrast measurement below. **Both halves of that were wrong and D-020 corrects them: it is 0.10 now, and it was never tight to the well.** |

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

**The last sentence is false and D-020 has the measurement that disproves it.** The bloom's falloff
is scaled by the field's own size, and the field is wide, so it is still at roughly half strength a
third of the way up a 390px screen. Turning it off entirely drops the share of sky pixels lifted off
the ground colour from 44.7% to 2.6%. It was not negligible at the headline; it was most of what was
lifting the headline's background. The numbers in the table above were taken over one frame at one
viewport, which is the same mistake D-015 made.

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

## D-017: Phase 5's structure, two states and not one scrolling page

**2026-09-22. Closed, not built.** `CLAUDE.md` flagged Review's first question as "structural, not
visual" without ever writing down what the question was — the same shape of gap Phase 4 closed with
D-014's "six things become three" brief before any shader work started. This is that brief for
Review.

### The actual question

The build spec's Phase 5 acceptance criteria already committed to "one triage card fills the view
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

The build spec's Phase 5 acceptance criteria (bucket colour as a leading-edge bar
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
3. **Triage is repetitive by design**, so the build spec gave it the shortest motion in the
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
| **The one accent** | Confirm, full width. The three overrides are unselected chips at `--tl-ink-muted`, 8.03:1 on the card, receding by value and weight as the build spec asked. |
| **Element count** | Four per card, down from five. The old card rendered the suggested bucket twice: once as a selected confirm chip and again in the row of all four buckets. |
| **The footer** | Pinned to the bottom on every card. Triage is the one repetitive action in the app and a target that moves between repetitions has to be found again every time. |
| **Carry forward** | `--tl-ink` text with a `--tl-bucket-do` marker, which is the fix the build spec asked for. It was `text-do` at 2.79:1 with the colour carrying the whole meaning. |

**The thought is set at the display step**, which is a departure from the build spec's Review
blueprint and worth saying plainly. That blueprint asked for `--text-lg`, a Depth Field
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

## D-019: The starfield gets its colour, the sub-line goes, and the sound comes on

**2026-09-22. Closed and built.** Three changes decided in one sitting, and the middle one is the
reason the first one could ship.

### The starfield is cool blue-white and warm cream, per star

It was one flat tint, `--tl-ink-faint`, a grey-slate dimmed in D-015 to keep the copy in front of it
readable. The approved reference artifact does something different: it mixes every star between a
cool blue-white and a warm cream, per cell, so the field has a colour temperature rather than a
tint. That mix is most of why its sky reads as stars instead of as noise.

Two new tokens carry the artifact's own values, converted from its GLSL rather than picked by eye:
`star.cool` `#b8ccff` from `vec3(0.72, 0.80, 1.0)` and `star.warm` `#fff0db` from
`vec3(1.0, 0.94, 0.86)`. `starLayer` returns a tinted colour now instead of a scalar, and `sky()`
sums colours.

**The lens rim was reading the same uniform as the stars, and no longer does.** It has its own,
`uRim`, still on `--tl-ink-faint`. They were never the same job: the stars are decoration whose
brightness is capped by the copy in front of them, and the rim is a boundary a user has to be able
to see under WCAG 1.4.11. Re-tinting the sky must never move that line, and until this change it
would have.

### The sub-line is gone, and the product reason came first

It read "Park it. Sort it tonight." D-014 kept it and `docs/LOOK.md` defended it: two jobs in five
words, telling you to let go and telling you what happens next, which is what makes letting go safe.

**The second job is what killed it. "Sort it tonight" tells a person to do their review at night**,
and nothing in this product should push anyone to act at a particular hour. That is the same family
as a streak or an overdue badge: a instruction about when, aimed at someone whose evenings are not
reliably available. `PRODUCT.md` forbids the badge and was silent on the sentence.

**Capture rests on two elements now: the headline and the field.** Six before Phase 4, three after
it, two now.

It was also, by a distance, the worst-measuring text in the application, and removing it is what
let the brighter starfield ship. That was a happy coincidence and not the argument.

### The commit sound is on by default

D-016 shipped it off. It is on now. It reaches exactly the people who have never opened Settings,
because those are the people with no stored settings row; anyone who has already turned it off has
an explicit `false` saved and keeps it.

It stays what it was: one tone, at commit only, never in response to typing, and never a reward
chime. **`PRODUCT.md`'s rule that nothing animates in response to typing covers sound too.**

### What it measures, and what was accepted

Worst case over nine viewport sizes and four states, sampled off rendered frames against the actual
glyph mask, so a star in the whitespace at the end of a line is not counted.

| On the bare starfield | Needs | Before | After |
|---|---|---|---|
| Headline, 34px | 3.0 | 6.62 | 2.97 |
| Parked count, 11px mono | 4.5 | 3.61 | 1.43 |
| Confirm word, 15px | 4.5 | 4.57 | 2.80 |
| Tag chip label, 13px | 4.5 | 4.57 | 3.54 |
| Sub-line, 13px | 4.5 | 3.56 | gone |

**Accepted as good enough for now and carried to `docs/BACKLOG.md` B-001**, to be revisited after
Phase 7. The call was the owner's, made against these numbers and not against a summary of them.
Two of the failures predate this change: the parked count and the sub-line were already under AA on
the grey starfield that shipped from Phase 4.

**The sub-line was not the whole problem and removing it did not solve it.** It was reported as the
worst offender on the strength of a two-element measurement; a four-element sweep found three more.
Whether a bright star lands behind an 11px glyph is luck of the star grid, so this is
viewport-dependent rather than constant, which is why it does not look as bad as the numbers read.

### Two measurement mistakes, both caught by looking

1. **A two-viewport probe is not a worst case.** The first pass measured 390 and 1280 and reported
   the parked count at 6.42:1 and 8.45:1, comfortably passing. At 414x896 it is 1.43:1. D-015's
   recorded 4.71:1 for the sub-line has the same flaw and is the reason a live failure sat
   unnoticed since Phase 4. **Sweep sizes. One viewport measures one star placement.**
2. **A probe that does not hide what it thinks it hides measures furniture.** The tag chip was
   reported failing at 2.67:1 against a background of rgb(88, 98, 113), identical on both builds to
   three significant figures. That is exactly `--tl-rule`: the chip's own border. The probe set
   `color` on the button and `Chip` sets it inline on an inner span, so the label never hid and the
   mask found the border instead. Measured properly the chip is 3.54:1. **A number that does not
   move when the thing under test moves is not measuring the thing under test.**

### The rest of the contract, checked

Zero `requestAnimationFrame` calls at rest, while focused and idle, and after an arc has settled, in
both motion modes, with one WebGL context. The commit sound handles a suspended `AudioContext` and
park is itself the user gesture, so there is no autoplay gate to work around now that it is on by
default. `npm run verify` clean.

| | Before | After | Budget |
|---|---|---|---|
| JS gzipped | 116.79 KB | 117.26 KB | 130 KB |
| CSS gzipped | 5.55 KB | 5.57 KB | 12 KB |

### Copy this change touched

| What | Why |
|---|---|
| **Removed:** "Park it. Sort it tonight." | It told a person when to do their review. Nothing here should. |

## D-020: The lens atmosphere is blue, and the accent stays violet

**2026-09-22. Closed and built.** Reported as a dull overlay washing the whole screen on load. It was
the lens bloom, and the fix was its colour rather than its level.

### What it was

The bloom exists so refraction has something worth bending. It read `--tl-mark-high`, the accent
violet, because that was the only atmospheric colour the palette had when D-016 landed.

Two things were wrong with that, and neither was visible until the starfield got crisper in D-019
and put a clean reference next to the washed ground.

**One: the falloff is screen-wide, not local.** It is scaled by the field's own size and the field
is wide, so the bloom is still at roughly half strength a third of the way up a 390px screen.
D-016's table called it "small and tight to the well" and its contrast note called its falloff
"negligible by the time it reaches the headline". Both are false. Measured by rendering the screen
with the bloom on, at a third of strength, and off:

| `lens.bloom-strength` | Median sky pixel | Share of sky lifted off the ground colour |
|---|---|---|
| 0.09, as shipped | 0.00338 | 44.7% |
| 0.03 | 0.00304 | 24.1% |
| 0 | 0.00274 | 2.6% |

At 0 the median sky pixel is the ground colour exactly, 0.00275. Everything above that line was the
bloom. It was not negligible at the headline; it was most of what was lifting the headline's
background.

**Two: the colour was pale, and pale over near-black is grey.** This is the half that actually
mattered and it is worth keeping, because the instinct is always to reach for the level.

### The hues, measured rather than argued

Taken from the reference artifact's own shader source, not from looking at it:

| | Hue | Lightness |
|---|---|---|
| Reference nebula, `vec3(0.07, 0.10, 0.24)` | 229 | 65% |
| Reference outer glow, `vec3(0.16, 0.24, 0.52)` | 226 | 65% |
| Reference lens rim | 224 | 81% |
| Reference accent | 221 | 86% |
| **Ours, the glow** | **248** | **80%** |
| Ours, the accent | 248 | 75% |

The reference sits in a band twenty degrees of hue wide. Pure blue is 240 and violet proper does not
begin until about 260, so **ours was never purple either**: it was blue-violet, and pale.

**A pale colour added to a near-black ground moves it toward grey; a deep saturated one keeps it
coloured.** At peak the old glow added `rgb(15, 14, 23)`, where red and green are close enough to
blue to read as neutral. The new one adds `rgb(7, 11, 26)`: half the red and green, more blue. Same
order of brightness, entirely different character.

### What changed

| | |
|---|---|
| `color.lens.glow` | New primitive, `#4a6bff`. The reference's nebula normalised to its own hue, so `bloom-strength` carries the level. |
| `color.lens.specular` | New primitive, `#d1e0ff`. The highlight was pure white, the last thing lighting the glass from outside the palette. |
| `lens.bloom-strength` | 0.09 to 0.10, which lands the peak contribution within a decimal of the reference's own. |
| `uSpecularTint` | New uniform. The shader had `vec3(1.0)` inline, which is a colour literal that the token check cannot see because it is not a hex. |

### The accent stays violet

Offered and declined the same day, with both rendered. With the atmosphere blue, the violet Park
disc is the only element left from a different family, and the reference's own pale blue would have
doubled its contrast on ground, 6.21:1 to 12.74:1, which matters because that token is also the
field's rim and the rim carries a WCAG 1.4.11 duty.

**Declined anyway, and the reason is the point:** the accent is Park here, Confirm on Review and
Save on Settings. Matching a reference is not a good enough reason to repaint the one colour that
appears once per screen across the whole application. The atmosphere is scenery; the accent is the
product. `docs/LOOK.md`'s rule 3 survives unchanged.

### The lesson, which is the same one twice now

**A contrast number taken from one frame at one viewport is a sample, not a worst case.** D-015 did
it, D-016 did it, and both recorded a comfortable margin that a sweep later contradicted. The
correction is in `CLAUDE.md` beside the gain it protects: sweep sizes, sweep states, and measure
every run of text rather than the one you expect to be worst.

## D-021: Patterns and Settings, and one voice for a number

**2026-09-22. Closed and built.** Phase 6. Both screens were the last two still wearing the card
shell from before the overhaul.

### A number looks the same wherever it appears

**Review's summary counts moved to the display step**, answered by the owner and the reason is
worth keeping: two screens that both answer "how many" should answer it in the same voice. Review's
totals were 15px body text with a marker; Patterns' readouts are 34px in the display face. Now both
are a numeral in the display face with a mono label beneath it, in the same grid. This closes
`docs/BACKLOG.md` B-003.

**Two by two at every width.** The build spec asked for a 2x2 at 390px opening to a row of four
at 1280px, and that blueprint assumed a full-width page. Every screen here is a 32rem column, so a
row of four gives each readout about 104px, which wraps "TOTAL CAPTURES" onto a second line while
its neighbours stay on one and leaves the row ragged. Rendered, not reasoned about.

### Patterns

**The number sits in the page.** No cards, no borders, nothing drawn around a readout: a display
numeral on the bare ground with space between them. The blueprint's "ruled ground" came from the
rejected Monolith direction, and the only rule-weight token quiet enough to be texture is the
hairline at 1.08:1, which is not faint but invisible. **No ground texture at all**, which is a
choice rather than an omission.

**No colour on this screen, and that is also a choice.** `docs/LOOK.md` gives the one colour per
screen to the primary action, and a screen you arrive at to read has none. The bars are ink, because
data is not decoration. The digest control is a ghost for the same reason it is a ghost on Review:
it is the one action here that leaves the device, and it should not be the brightest thing on the
page.

**An empty hour is visible as empty rather than absent.** It used to be a zero-height bar at 0.15
opacity, which is nothing at all: the day appeared to have fewer hours in it than it has. Every
hour now draws at least a 2px mark on the baseline in the structural rule token at 3.22:1. Same
finding as the blank third row in Capture's peek stack, and the third time this repo has paid for
it: **rendering something nobody can see is worse than rendering nothing, because it reads as done.**

**Motion:** the bars grow once on arrival, `--ease-settle`, staggered 8ms, and then the screen is
still. Verified rather than asserted: 24 bars animating 60ms in with the first at `scaleY(0.353)`,
zero animations running once settled, and zero `requestAnimationFrame` calls while idle. Under
reduced motion the animation is removed outright rather than shortened, because a 1ms animation
staggered across 184ms still arrives as a ripple; measured, the bars have no transform at all and
nothing runs.

### Settings

**Rules, not cards**, using the structural token at 3.22:1. Review's wrap-up does the same grouping
job with space alone. The two disagree and **Phase 7 owns picking one**; this entry does not, because
Review is already approved and repainting it here would be scope creep in a phase that does not own
it.

**The BYOK paragraph is full-strength ink** while every other body line on the screen is muted. It is
a promise about where a key goes, and muted text reads as fine print.

**Import JSON is a real button now.** It was a `<label>` hand-painted with the `Button` component's
border, padding and radius, which drifts from the real thing the moment either moves. It is a
`Button` that opens a hidden file input.

**The checkbox accent was the interesting one.** A checked native checkbox paints itself in the
*browser's* accent, a blue belonging to nobody here, so it needed a token. Handing it `--tl-mark`
looked good, which is the trap: with two checkboxes and Save, the one colour per screen then
appeared three times on the screen `docs/LOOK.md` calls the quietest. **That is D-014's finding
exactly**, when the luminous rim was briefly every field's default. It reads `--tl-ink`: not a
colour, unmistakably on, and Save keeps the accent.

### Copy this phase touched

Phase 6 does not own copy. Three things changed and are listed here rather than buried.

| What | Why |
|---|---|
| **Corrected:** "Off by default." to "On by default." | The sound default flipped in D-019 and this line was left behind. It was not a rewording, it was false. |
| **Removed:** the "Patterns" and "Settings" eyebrows above the headlines | Review dropped its equivalent in Phase 5 and the navigation already says which screen you are on. |
| **Format:** the busiest hour is zero-padded, `00:00` | It agreed with neither the hour labels under the distribution nor itself, and midnight read as an unfilled placeholder rather than a time. |

### Left alone

`PatternsView` still renders the weekly digest, and `CLAUDE.md` said "the agent runs on Review only",
which would have had someone delete it. `PRODUCT.md` sanctions it in three places and it is a shipped
feature; the shorthand was wrong and is corrected rather than the code.

## D-022: The bloom's reach, which is what was actually wrong

**2026-09-22. Closed and built.** The dull overlay was reported a third time, still there after D-020
made the bloom blue. D-020 changed its colour and raised its level; neither is what covered the
screen. **Its reach is.**

### What the third report found that the first two did not

Photographing the screen one frame before the canvas draws and one frame after:

| | Median sky pixel | Share of sky above the ground colour |
|---|---|---|
| Before the shader paints | 0.00000 | 1.8% |
| After it paints | 0.00313 | 46.2% |

**98.7% of the screen changes**, and the before frame is not the ground, it is pure black: a WebGL
context created with `alpha: false` initialises its drawing buffer to opaque black, and the canvas is
fixed to the whole viewport. So a page load is three states, not two. Ground, then the canvas
covering it in pure black, then the shader's first paint bringing the stars, the atmosphere and the
lift all at once, about a second in. **That last step is the "overlay", and it was never a second
event: it is the canvas arriving.**

### The knob

`nebula = exp(-(dist * dist) / (uInfluence * uInfluence * K))`, where `uInfluence` is derived from
the field's size and `K` was a hardcoded `1.1`. The field is wide, so at `1.1` the bloom is still at
roughly half strength a third of the way up a 390px screen. It was never atmosphere around an
object; it was a film over the view.

`K` is now `lens.bloom-reach`, because a constant that decides whether half the screen is lifted is
not a magic number in a shader. Measured across the ladder:

| `bloom-reach` | Median sky pixel | Share of sky lifted |
|---|---|---|
| 1.10, as shipped | 0.00313 | 46.2% |
| 0.50 | 0.00300 | 30.2% |
| **0.30, now** | **0.00274** | **22.6%** |
| 0.18 | 0.00274 | 17.7% |
| 0.10 | 0.00274 | 13.5% |

**At 0.30 and below the median sky pixel is the ground colour exactly**, 0.00274. More than half the
screen is true ground again, and what remains above it is the atmosphere near the field plus the
stars, which is the part worth having. 0.30 keeps the bloom at roughly 80% of full 50px from the
field and 7% a third of the way up.

**Reach, not strength, and the difference matters.** Lowering `bloom-strength` dims the atmosphere
everywhere including right at the field, which is the half that makes the lens read as glass.
Tightening the reach takes it off the parts of the screen it was never meant to be on.

### Two process notes, both the same shape

1. **A `&&` chain silently skipped the edit.** The shader change was run as
   `grep ... && python3 ...`, the grep found nothing because the semantic token did not exist yet,
   and the edit never ran. The ladder that followed measured five identical frames, which is the
   only reason it was caught. **A measurement that shows no difference is evidence about the
   measurement first and the subject second.**
2. **A primitive without a semantic reaches nothing.** `lens.bloom-reach` was added to the `lens`
   group and generated as `--tl-ref-lens-bloom-reach`, but components may not read `--tl-ref-*`, so
   `readNumber("--tl-lens-bloom-reach")` fell to its default and the token did nothing. Same family
   as rule 13 in `CLAUDE.md`'s token contract, which says this about reduced-motion overrides and is
   just as true of every other token.

---

## D-023: Capture does not open a keyboard nobody asked for

**2026-09-22. Closed and built.** Two faults on a phone, reported together, and they have the same
root: this screen took focus in places it should not and failed to offer it in the place it should.

### The keyboard opened on load

`CaptureView` focused the field on mount, and a click anywhere on the screen focused it again. On a
pointer device that is the whole promise: land ready to type, no clicks spent. On a phone the same
two lines throw the keyboard over half the screen before anyone has tapped, and every stray tap on
the sky throws it up again. The first thing a person does is dismiss it, which is the opposite of a
calm room.

**Both are now gated on `(pointer: fine)`**, read fresh on every call rather than cached, because a
tablet with a keyboard attached and removed changes the answer without a reload. Verified: on an
iPhone profile nothing is focused on load; at 1280 the field is focused on load exactly as before.

### Most of the field was not clickable

The shell is padded and grows to three lines, so most of its area is not the control. Clicking that
area did nothing at all. The screen-level click handler that would have caught it is blocked by the
form's own `stopPropagation`, which is there so the Mic and Park glyphs work.

**The fix belongs in `Field`, not in `CaptureView`**, because it is the field's shape that creates
the dead area and every future `Field` has the same shape. The shell focuses its control on
`mousedown`, skipping the control itself and anything inside a button, and calls `preventDefault` so
the shell never takes focus for a frame first. That frame is the flicker: it also restarted the
lens's focus arc, which is most of what "the animation is glitchy" was.

---

## D-024: The prose leak was never in the comments

**2026-09-22. Closed and built.** `docs/BACKLOG.md` B-002 said five junk utilities shipped from
ordinary English in `src/` comments, and that every fix was a decision. Measured properly, both
halves of that were wrong, and the correction is the useful part.

### It was four rules, not five

`.fixed` is real. `GravityField` renders the canvas with `className="pointer-events-none fixed
inset-0 z-0 h-full w-full"`, so that rule is doing its job. The junk was `.inline`, `.ring`,
`.rounded` and `.shadow`, 560 bytes uncompressed between them.

**Counting a used class as junk is the same error as the leak itself**: a plausible list nobody
rendered against the markup.

### `.shadow` came from a build script, not a comment

Tailwind's scanner was asked directly, per file, rather than reasoned about. Four of the five
candidate words did come from comments in `src/`. `shadow` did not:

```js
if (token.$type === "shadow") {     // scripts/build-tokens.mjs
```

That is a DTCG type name. **It cannot be reworded**, because it is the token format rather than a
sentence, so the one fix B-002 offered for it, rewording, could never have worked.

### So the guard could cover it after all

B-002's reasoning was that `src/` cannot be excluded, which is true and was the wrong boundary.
`scripts/` is not `src/`, renders nothing, and contains no class name. A fifth directive covers it:

```css
@source not "../scripts/**";
```

The four comment-sourced words were reworded in the same pass, and the rewording is mild because
only an **exact** utility name emits: `shadows` is safe, `box-shadow` is safe, `round-cornered` is
safe. `CLAUDE.md` said no writing rule could avoid these words. Nearly right: no writing rule can
avoid the *concepts*, and every one of them has a form the scanner does not match.

### Numbers

| | Before | After |
|---|---|---|
| Junk rules in production CSS | 4 | **0** |
| CSS, uncompressed | 23.15 KB | **21.20 KB** |
| CSS, gzipped | 5.72 KB | **5.44 KB** |

Verified by diffing the rule sets of the two built files: exactly four rules removed, none added,
and all four unused in any `className`. The extra saving beyond the 560 bytes is the `--tw-*`
custom-property scaffolding that `.ring` and `.shadow` drag in with them.

### The CI job was green the whole time

`.github/workflows/verify.yml` asserted on `backdrop-filter`, `rounded-card`, `font-sans`,
`invisible` and `bg-[var`. **Not one of those has ever leaked.** The job passed every run while
`.shadow` shipped, in an app whose direction is that depth is never an edge treatment.

It now asserts on the utilities that have actually leaked here, and the match requires the brace
immediately after the name so a real `rounded-2xl` cannot trip it. **It was exercised against the
leaky build before being trusted**: it fails on the old CSS and passes on the new one. An assertion
that has never been seen to fail is not evidence of anything, which is the whole lesson of this
entry.

## D-025: The build spec is deleted, and the docs are swept

**2026-09-22. Closed.** Phase 7's job, and D-009's rule enforced rather than restated: a document
describing a state the code has left is worse than no document, because it reads as current.

### `docs/BUILD-SPEC.md` is gone

It said so itself: "When a phase completes, its section here is deleted and replaced by a decision
entry. This file should shrink to nothing." Phases 3 to 6 have all landed, so it shrank to nothing.
727 lines, of which section 1 was a dead palette for a dead direction, sections 3's phases were all
built, and section 4 duplicated `CLAUDE.md`. `git log` has it.

**What was live in it and where it went.** Only one thing did not already exist elsewhere: the rule
about what Patterns may show. It is a product rule that stops a streak display appearing under an
innocent heading, `PatternsView` cites it, and `PRODUCT.md` actively invites the mistake by listing
"capture velocity trend". It is now in `CLAUDE.md` with the other product rules.

Everything else was already carried: the contrast ratios live in each token's `$description`, the
spring physics in `src/tokens/tokens.json`, the constraints in `CLAUDE.md`, and each phase's outcome
in its own entry here.

### What the sweep found

Seven documents named a state the code had left. The worst were not in the build spec:

| Where | Said | Actually |
|---|---|---|
| `ROADMAP.md` | Visual direction is "light filed", paper off-white and charcoal ink | The ground has been dark since D-011 and the direction is the gravity well |
| `ROADMAP.md` | "Phase 7: voice (NEXT)", "Voice: NEXT" | Voice is built and wired into Capture. Its own checklist ticks it off, in the same file |
| `ROADMAP.md` | `CURSORRULES.md` | Has never existed, in any form. The third shape this ghost has taken |
| `ROADMAP.md` | "LogStack behind capture hero", ticked | `LogStack` was deleted in D-009. `PeekStack` replaced it |
| The build spec | Capture's field floor is 18px | The token is 17px. The doc was never right |
| The build spec | Review is "wins, then triage, then summary, then Hands" | Two states since D-017 |
| The build spec | Capture's order includes a sub-line | Removed in D-019 |

**`ROADMAP.md` carried the two most dangerous lines in the repo**, because both read as current
direction and one of them contradicted a ticked checklist eleven lines below it.

### The mechanical half of D-009, finally built

D-009 called this check "cheap and worth keeping" and then nobody wrote it, which is how the build
spec's own dead references survived to be found here. `scripts/check-docs.mjs` asserts that every
backticked repo path in every markdown file resolves, and it runs in `npm run verify`.

It is deliberately narrow: it resolves a bare basename against the tracked file list, because docs
say `hands.ts` and mean `src/lib/hands.ts` and that is shorthand rather than rot. Files that are
gone **on purpose** and discussed as gone are listed in the script with a reason. A false pass is
acceptable; a false failure would get the check deleted, which is how the last one died.

It found three real stale paths on its first run, and it is off the deploy path with every other
check, per D-008. Never in `npm run build`.

## D-026: Settings separates on space, like everything else

**2026-09-22. Closed and built.** `docs/BACKLOG.md` B-003b, picked by Phase 7 as that entry asked.

Settings separated its sections with a 1px `--tl-rule`; Review's wrap-up did the same job with space
alone. Both were defensible and they disagreed, visibly, if you moved between the two screens.

**Patterns broke the tie.** It separates "Time of day" from "Weekly digest" with space and no rule,
using the same section-heading treatment as the other two: body size, weight 500, full ink. Two
screens of three already agreed, so Settings was the outlier rather than the standard.

**The heading is the separator.** Every section on all three screens opens with a full-ink heading,
and a line under it is a second signal for a boundary nobody was going to miss. It also put the one
edge-attached line in the app on the screen `docs/LOOK.md` calls the quietest, in a direction whose
first rule is that depth is never an edge treatment.

**The spacing did not change**, only the line. The gap between sections is still double the gap
inside one, so the grouping a settings form depends on is carried by exactly what carried it before.
Rendered at 390px before and after: four rules gone, nothing regrouped.

`--tl-rule` keeps its job and its `CLAUDE.md` contract. A boundary a user genuinely needs to see
still uses it, never the hairline; between two labelled sections, no boundary needed seeing.

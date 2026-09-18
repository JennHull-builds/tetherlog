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
| Phase 3 onward | Not started. Phases 3 and 4 need rework against `docs/LOOK.md` first. |
| Design direction | **Approved 2026-09-18:** the gravity well. `docs/LOOK.md` is binding. See D-007. |
| Live palette | Still NIL's light values, on purpose. Phase 3 swaps them for a `docs/LOOK.md` palette. |

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

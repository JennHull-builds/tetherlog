# CLAUDE.md

> ## ⚠️ READ THIS FIRST: this repository is PUBLIC
>
> `github.com/…/tetherlog` is public and MIT licensed, and it stays that way. Everything committed
> here is world-readable forever, including in git history after a later edit.
>
> **Never commit any of the following:**
>
> - **The owner's name, email, handle, or any personal identifier.** Refer to "the user", "the
>   owner", or "the primary user". Never a real name, not even in a commit message.
> - **Verbatim quotes from private conversation.** Carry the decision and the reasoning, never the
>   words. "The warm palette was ruled out" is fine; quoting what was said is not.
> - **Health, diagnosis or personal circumstance** beyond what the product spec already states about
>   its intended audience. Never attributed to a person.
> - **Absolute paths** (`/Users/…`, `/home/…`), machine names, or references to private
>   repositories, notes systems or working directories outside this repo.
> - **Keys, tokens, `.env` contents, API keys.** BYOK keys live in the user's browser only and must
>   never be logged, committed, or included in an export.
> - **Third-party images or media** collected as references. `docs/references/` is gitignored for
>   exactly this reason.
>
> **Commits are authored under a GitHub noreply address**, set locally for this repo
> (`git config --local user.email`). Do not commit with a personal email. `npm run build` warns if
> the identity drifts. Note that commits made before 2026-09-18 still carry a personal address in
> git history; that is known and was accepted rather than rewriting published history.
>
> **Before every commit, check the diff for these.** A scrub after the fact does not remove anything
> from git history; it only stops it getting worse.
>
> If a document genuinely needs personal context to be useful, it belongs in the owner's private
> notes, not in this repo, and the public file should carry the conclusion only.

Binding rules for TetherLog. Read this before touching anything.

**There is no `.cursorrules` in this repo.** Earlier documents describe one and `ROADMAP.md`'s
historical phase prompts reference it; it was never committed. This file is the only rule file.
The `@source not "../.cursorrules"` line in `src/index.css` is kept deliberately, so the guard is
already in place if one is ever added.

**The current work is the UI overhaul, and all seven of its phases are built.** What is decided is
in `docs/DECISIONS.md`. Start there: it opens with a status table and a map of which file does what.
**`docs/BUILD-SPEC.md` no longer exists.** It held the phases and was deleted by Phase 7 once they
had all landed, exactly as it said it would be; `git log` has it and D-025 records what moved where.
Any instruction that sends you to it is out of date.

**`docs/LOOK.md` is the visual direction and it is binding.** It was derived from reference images
rather than adjectives, which is the third attempt and the first one grounded in pictures. Read it
before any visual work. Three rules from it that contradict everything written before:

- **Radius is generous.** NIL's `0px` lock is dead.
- **Depth is what an object does to its surroundings**, never a shadow attached to its edge.
- **Never same-colour-as-ground plus two soft shadows.** That is neumorphism and it is the one thing
  explicitly rejected.
- **One colour, the violet, on the primary action.** There is no secondary palette. Bucket hues
  were never approved and were removed in D-028: a bucket is its word, a selected chip is ink.

Phases 1 to 6 are **done, looked at, approved as good enough for now, and pushed.** Capture is two
elements at rest on a dot grid; the composition is in `docs/DECISIONS.md` D-014 and D-019. **The
grid replaced the starfield lens on 2026-10-01 and is built, awaiting a look on a real phone**: see
D-027, which also says what of D-015, D-016, D-019, D-020 and D-022 still holds. **Review is two states**: a full-screen
one-card triage ritual, then a separate wrap-up. The structure is D-017 and the hand-off, the
navigation and the wrap-up's layout are D-018. **Phase 7, the sweep, is built and awaiting a look**:
the build spec deleted, every document swept against D-009, the prose leak traced to its real source
and guarded, and Settings moved onto space separators like the other two screens. See D-024, D-025
and D-026. `docs/BACKLOG.md` was its inbox and two entries are still open there.

**`docs/BACKLOG.md` is where a finding goes when it is real and the fix is a decision.** Read it
before starting a phase and add to it in the same session something is found. **A finding does not
stop a build.** Log it, say so, carry on; the owner decides when it gets fixed. Two entries are
open, B-004 and B-005. The grid closed both contrast failures, B-001 and B-006, by construction and
by measurement.

---

## What TetherLog is

An ND capture log. A thought hijacks you mid-task, you park it in under five seconds, you go back to
what you were doing. Review happens in the evening. Public, MIT, client-only, £0 to run.

`PRODUCT.md` is the product spec and it is binding. `ROADMAP.md` is the delivery order.

**`DESIGN.md` and `docs/UI-OVERHAUL.md` were deleted on 2026-09-18.** Both described states the code
had already left. Their live content is in `docs/DECISIONS.md`; `git log` has the originals. Any
instruction referencing either file is out of date. **`docs/BUILD-SPEC.md` went the same way on
2026-09-22**, for the same reason and by its own instruction. See D-025.

---

## Product rules, not open for redesign

1. **Capture is dumb, fast and silent.** Under five seconds. Zero AI, zero network, zero questions at
   park time. **Nothing animates in response to typing**: no keystroke pulse, no character effects,
   no ambient loop while the field is focused. Motion belongs at the state transitions, never inside
   them.
2. **No streaks, no guilt.** No overdue badges, no "you missed yesterday", no celebration, no
   confetti, no targets, no goals, no day-over-day comparison. Untriaged is parked, not failure.

   **On Patterns this has a specific shape, and it is the one rule the build spec carried that
   lived nowhere else.** Only the readouts `PatternsView` already computes may be shown: total
   captures, active days, busiest hour, stuck items, the 24-slot hour distribution and repeats. No
   dials, no gauges, no targets, no change arrows, no day-over-day comparison, and `perDay` is
   rendered as a distribution and **never as a sequence**. A row of daily bars with gaps in it is a
   streak display whatever the heading says. `PRODUCT.md` lists "capture velocity trend" and
   "captures per day / week chart" under Patterns, which is exactly how this gets built by accident:
   this rule narrows both. See `docs/DECISIONS.md` D-025.
3. **Four screens.** Capture, Review, Patterns, Settings. Never a fifth.
4. **Data stays on device.** Dexie and IndexedDB. No accounts in v1. BYOK for the agent, client-side
   only, key in localStorage, never on a server.
5. **The agent never runs at capture.** Not on a keystroke, not on park, not in the background.
   It runs on **Review**, for triage, and on **Patterns**, for the weekly digest, and both are
   explicit presses. This line used to read "the agent runs on Review only", which is not what
   `PRODUCT.md` says and would have had someone delete a shipped feature. Capture is the rule.
6. **UK English** in UI copy, comments and commits. Colour, organise, initialise.
7. **`prefers-reduced-motion: reduce` is a contract, not a fallback.** Every motion token ships its
   reduced-motion counterpart in the same token entry. The generator throws if one is missing. The
   ND user base makes this correctness, not courtesy.

**Copy is not part of the UI overhaul.** It is worked separately, and Phases 4 to 6 must not change
UI strings. 16 strings shipped in `9df1da0` before that was settled; `docs/DECISIONS.md` D-013
lists them. Anything the copy work decides supersedes them.

Tone: warm, literal, spare.

**Em dashes: zero in any heading, at most one per document in prose.** Use a colon, a full stop or a
bracket. This repo is public and the em dash is the current tell for AI-written text. Check with
`grep -c '—' <file>` before committing. En dashes in numeric ranges (`2–3 lines`) are correct and
are not the same character.

**State re-measured 2026-09-22 in Phase 7.** `ROADMAP.md`, `ARCHITECTURE.md` and `docs/LOOK.md` are
at zero, and every heading in the repo is clean.

| Where | Count | Standing |
|---|---|---|
| Shipped UI copy in `src/` | **0** | Was 16. Phases 4 to 6 rebuilt the views and the strings went with them. |
| `src/lib/agent.ts`, `src/lib/hands.ts` | **0** | Was 9, and these were the ones that mattered: they leave the app in the export, the do list and the mailto subject. Gone without anyone tracking it. |
| Code comments in `src/` | 19 | Not user-visible, not the tell. Leave them. |
| `src/tokens/tokens.json` | 4 | All in `$description` text, which reaches a CSS comment and no screen. |
| `PRODUCT.md` | 45 | Binding spec; rewording risks changing meaning. Still deliberately unswept. |
| `docs/DECISIONS.md` | 18 | Prose only. Over the one-per-document rule and logged as B-005, not swept here: it is a binding document and 18 rewordings is a decision, not a change. |

**Nothing user-visible carries one any more**, which is the part that was worth fixing and is now
worth protecting: check a new UI string before it ships rather than sweeping later.

---

## Stack facts

- **Vite 8 + React 19 + TypeScript strict.** Client only, no server, no accounts.
- **Tailwind v4** via `@import "tailwindcss"` and `@tailwindcss/vite`.
- **There is no `tailwind.config.js` and one must never be created.** Theme values live in the
  `@theme` block in `src/index.css`. Any instruction that references a Tailwind config file is
  describing v3 and is wrong here.
- **Dexie / IndexedDB** for storage. **Zod** for schemas.
- Deployed on Vercel **from this repo only**.

---

## Gotchas. Each of these has already cost a day.

### If a parked thought goes missing, start here

**Park does not wait for IndexedDB.** Decided 2026-09-18. The field clears and refocuses
synchronously the moment Park is pressed, and the database write settles behind it. This is the one
place in the app where the UI says "done" before the disk does.

The design is four steps in `CaptureView.handlePark`, and **the order is the whole thing**:

1. **Hold** the text in `inFlightRef` before anything is cleared
2. **Release** the field, synchronously, with nothing async above it
3. **Settle** the write behind the user
4. **Recover** on failure by putting the words back in the field, plus a `console.warn` carrying
   the text so it is retrievable even if the UI recovery also fails

Nothing between the hold and the release may be async. A failed park never clears silently and
never auto-retries, because a silent retry can double-write.

**`docs/DECISIONS.md` D-004 is the full write-up**, including a symptom-to-cause table for
exactly this: text typed, Park pressed, nothing in Review. Read that table before debugging anything
else, and read it before changing the order of those four steps.

### Triage suggestions must not be derived from the shrinking queue

`ruleBasedTriage` grants carry-forward to the **first `do` in the array it is handed**. Re-run it
against a queue that gets shorter with every confirm and the flag walks to the next `do`, so
"carry forward (max one)" is offered on card one, then card four, then card six. The database
enforces max one; the screen does not, and the screen is what a person reads.

`ReviewView` derives suggestions from an **append-only ritual set** rather than from the live queue,
and suppresses the offer once a carry-forward has been written tonight. Appending never moves the
first `do`. If suggestions ever start flickering between cards, look here. Written up in
`docs/DECISIONS.md` D-018.

### Seeding IndexedDB by hand leaves Dexie's cache stale

Dexie 4 caches index queries and invalidates them only on writes it made itself. Seed captures with
raw `indexedDB` for a screenshot or a test and `getCapturesForDay`, which is a
`where("createdAt").between(...)`, keeps returning the empty result it cached, while
`getUntriagedCaptures`, which is a table scan, returns the fresh rows. Review then shows an empty
queue and a full backlog and the bug looks like date handling.

**Reload the page after seeding**, or seed through the app's own Dexie instance. This cost twenty
minutes chasing a timezone bug that was not there.

### A negative z-index hides a fixed canvas behind an ancestor's background

The old gravity lens rendered its whole starfield into a canvas nobody could see. The build was green,
the rAF instrumentation was perfect, one WebGL context was created, no errors anywhere, and the
screen was empty black. `App`'s wrapper carries `bg-ground`, and a `-z-10` child paints behind an
ancestor's background rather than behind its content.

**The canvas is `z-0` and the content above it is `z-10`.** If the grid disappears, look here
before looking at the shader. Written up in `docs/DECISIONS.md` D-015.

### The grid keeps clear of text, and that is a contrast rule, not polish

Capture's copy sits on the grid with no surface under it. The dots at rest are dim, but **the dots
nearest the field, and every dot the wave passes, are `--tl-grid-dot-near`, and `--tl-ink-muted`
measures only 3.19:1 on that.** A near dot behind a chip label or the confirm word fails AA.

So `GravityField` takes a `keepClear` list of every run of text on the screen and the dots fade out
around each one. Measured on 2026-10-01 over nine viewports, with the confirm word caught mid-wave,
the brightest pixel behind any glyph is the ground itself: headline 17.98:1, chips, confirm word and
parked count 8.55:1 or better. **A new piece of copy on Capture has to be added to `keepClear`**, or
it sits on the dots and nothing will warn you.

**The two measuring rules the starfield taught still apply**, and they are why the numbers above are
worth trusting:

1. **Sweep viewport sizes. One viewport measures one placement.** The lens recorded 4.71:1 from a
   single viewport while the parked count was 1.43:1 at another.
2. **Measure every run of text, not the one you expect to be worst.** The starfield's sub-line was
   removed as the worst offender on a two-element sweep, and three more were failing.

There is also **a clean collar a few pixels wide outside the field's edge.** The grid is pushed back
from the field, which compresses the dots just outside it, and the focus edge is measured against
whatever is next to it. Without the collar a dot can sit against the edge; with it the focus edge
measures 5.12:1 at its worst, all the way round. See `docs/BACKLOG.md` B-006, closed.

**The grid is there from the first paint.** The same dots are painted in CSS under the canvas, on the
token pitch and anchored to the same bottom-left origin the shader counts from, so the first frame
that shows the page shows the grid. WebGL arrives later and crossfades in place, its first frame
putting every dot exactly where the CSS one is (96.8% of dot pixels coincide, measured); only then
does the field make room, on the settle spring. Before 2026-10-02 the whole grid faded in a beat
after the page appeared, which was reported as an overlay arriving. Before that, the lens loaded as
ground, then pure black (an `alpha: false` context starts opaque black), then the shader. **If
either comes back, look at the CSS layer and `drawn` in `GravityField.tsx`.**

### Nothing on Capture may change the layout

The field rose 66px the first time anything was parked, because the peek stack was rendered
conditionally and shrank the centred block above it. That is the one screen that must never move,
moving, at the exact moment a person is watching to see whether their thought landed.

**Both variable regions are fixed-height slots that are always present:** the line under the field
(chips, or the confirm word, or nothing) and the peek-stack slot. Reserved space costs nothing on an
empty screen and it cannot shift.

### Do not put shell scripts in the build command

Every Vercel deployment on 2026-09-18 failed after `npm run build` was changed to
`npm run privacy:check && npm run tokens:check && tsc -b && vite build`. The commit before that
change deployed green; every commit after it errored, on both `main` and the branch.

**It did not reproduce locally.** A clean shallow clone with `npm ci` and `CI=1 VERCEL=1` built
green, at the first failing commit and at HEAD. `npm ci` was clean. The build logs were not readable
with the available credentials.

It was settled by changing exactly one thing, the build command, back to what was green. The next
deployment went `READY` immediately. **The cause was the bash scripts in the build command**, though
the precise mechanism is still unknown.

So: **`npm run build` stays `tsc -b && vite build`.** Verification lives in `npm run verify`, run
before pushing, and in `.github/workflows/verify.yml`, where the logs are readable. Never wedge a
shell script into the build command.

The wider lesson, and it is the second time this repo has taught it: **a green local build proves
nothing about Vercel.** The first time it was a sibling-repo path (`f1416d2`); this time it was a
shell script. Both looked fine locally.

**A third time on 2026-09-30, and this one was CI.** `scripts/check-docs.mjs` read the disk, where
a laptop that has built has `dist/`; CI runs the check before the build and has none. It was red
from `deb186e` for eight days while `npm run verify` passed here, and the steps behind it, including
the CSS leak assertion, never ran. **A check must read git, not the working tree.** Anything
gitignored is something CI cannot see.

### Vercel checks out this repo and nothing else

`vite.config.ts` once aliased a sibling `../nil-ds` checkout. `npm run build` passed here because the
sibling exists on this machine. The Vercel preview build failed, with no local signal at all.

**Never reference a path outside this repository.** Not in `vite.config.ts`, not in a CSS `@import`,
not in a build script. If something has to come from elsewhere, vendor it into the repo and commit
it. `git log f1416d2` is the write-up.

### Tailwind compiles class names out of prose, including this file

Tailwind v4 scans the repository and cannot tell documentation from markup. `ROADMAP.md` contains
an arbitrary-value class as an example of what *not* to write, and Tailwind compiled it into a real,
broken CSS rule that shipped to production.

It is not only arbitrary values. Adding two markdown files to the repo, with no code changed,
emitted fourteen more rules into production CSS from ordinary English words:

```
.backdrop-filter  .blur     .fixed    .font-sans  .grow   .inline  .invisible
.ring             .rounded  .rounded-card         .shadow .static  .transform
```

There is no way to write about a design system without using the words "shadow", "blur", "fixed",
"inline" and "static", so a writing rule cannot fix this.

**The fix is in `src/index.css`:**

```css
@source not "../*.md";
@source not "../docs/**/*.md";
@source not "../.cursorrules";
@source not "../.github/**";
```

`.github` is on the list because the CI job that asserts these rules never ship has to name them,
and naming them shipped them: 1.43 KB of junk CSS on 2026-09-18. **Any new file that discusses class
names needs a `@source not` line before it lands.**

Verified on `tailwindcss@4.3.3`. If those lines ever disappear, the leak comes straight back and
nothing will warn you: the rules are valid CSS, they just are not yours.

**A fifth directive covers `scripts/`, and finding out why is the useful part.** Phase 5 reported
five junk rules leaking from prose in `src/` comments and concluded no guard could reach them.
Phase 7 measured it properly and both halves were wrong. Fixed 2026-09-22, written up in D-024.

**Ask the scanner, do not reason about it.** `@tailwindcss/oxide` exports `Scanner`, and running it
per file names the exact source of every candidate in about a second. Guessing which English words
look like class names is how the wrong five got listed:

```js
import { Scanner } from "@tailwindcss/oxide";
new Scanner({ sources: [{ base: process.cwd(), pattern: file, negated: false }] }).scan();
```

**Only an exact utility name emits.** `shadows` is safe, `box-shadow` is safe, `round-cornered` is
safe, `Rounded` is safe. This file used to say no writing rule could avoid the words "shadow",
"blur", "fixed", "inline" and "static". That is nearly right and the gap matters: no writing rule
can avoid the **concepts**, and every one of them has a form the scanner does not match.

**`.fixed` is a real class**, used by `GravityField` on the canvas. It was on the junk list, which
is the same failure as the leak: a plausible list nobody checked against the markup. Never add
`fixed` to the CI assertion.

**`.shadow` came from `scripts/build-tokens.mjs`, not from a comment**, where `$type === "shadow"`
is a DTCG type name and cannot be reworded. `src/` genuinely cannot join the `@source not` list.
`scripts/` is not `src/`: it renders nothing and holds no class name, so it can, and does.

**The CI assertion was green throughout.** It named five utilities, not one of which has ever
leaked, while `.shadow` shipped for weeks. It now names the ones that have actually leaked here,
and **it was run against the leaky build before being trusted.** An assertion nobody has seen fail
is not evidence.

### Never add an unlayered global reset

Tailwind v4 puts every utility in `@layer utilities`, and **unlayered CSS beats layered CSS
regardless of specificity.** A plain `@import` of a stylesheet containing this:

```css
*, *::before, *::after { margin: 0; padding: 0; }
```

outranks every padding and margin utility in the app. NIL's `core.css` shipped exactly that, and it
silently neutralised **72** `p-*`, `px-*`, `m-*`, `mt-*` and `space-y-*` utilities across five files.
`px-4` computed to `0px`. `mx-auto` did nothing, so at 1280px the whole app sat in the top-left
corner. Nothing errored, nothing warned, and it survived months of work.

Tailwind's preflight already resets `margin` and `box-sizing`, inside `@layer base`, where utilities
correctly win. **Do not add another one.** If a third-party stylesheet must be imported, wrap it:
`@import "thing.css" layer(vendor);`

Symptom to watch for: utilities that "do nothing" while `gap-*` and inline styles still work. Check
the built CSS for a rule at brace depth 0. Written up in `docs/DECISIONS.md` D-005.

### Never partially override the spacing scale

Tailwind v4 derives the whole spacing scale from a single `--spacing` base. Defining some steps by
name in `@theme` and not others gives you two scales at once:

```
gap-2  ->  var(--spacing-2)            (named override)
gap-3  ->  calc(var(--spacing) * 3)    (derived)
```

`src/index.css` shipped exactly this for months and it was invisible only because the five overrides
happened to equal the defaults. Set the single `--spacing` base, or define the complete scale.

### `--duration-*` is not a theme namespace

The v4 namespaces are `--color`, `--font`, `--text`, `--spacing`, `--radius`, `--ease`, `--animate`,
`--shadow`, `--inset-shadow`, `--drop-shadow`, `--tracking`, `--leading`, `--breakpoint`,
`--container`, `--blur`, `--aspect`, `--perspective`. A `--duration-x` in `@theme` produces nothing.
Read durations as `var(--tl-spring-*-duration)` in a style attribute, not as a utility.

### Naming a font does not load it

`--nil-font-body` named `'IBM Plex Sans'` for months with no `@font-face`, no link and no package
anywhere. Every screen rendered in `system-ui` and nobody noticed, because the fallback was
plausible.

**After adding or changing a typeface, open the page and look at it.** If the headline is not
visibly the face you specified, it is not loading. Self-host fonts; do not link
`fonts.googleapis.com`, because that sends the user's IP to Google on every load and contradicts the
privacy promise in the Settings copy.

### An edit that reports success is not a verified result

The failure mode in this repo is plausible output, not errors. Nothing crashes, nothing logs, the
result is well formed and wrong. Render it, run it, read the file back, check the built CSS. Before
saying it works.

---

## Token contract

Tokens are the source of truth and this repo owns them outright. There is no upstream.

```
src/tokens/tokens.json            DTCG, hand-authored, the source of truth
        |  node scripts/build-tokens.mjs        (npm run tokens)
        v
src/styles/tokens.generated.css   committed. the ONLY file with a colour literal.
        |    --tl-ref-*   primitives   -> never read by a component
        |    --tl-*       semantics    -> the only thing a component reads
        v
src/index.css  @theme             maps semantics to Tailwind utilities
```

1. **Components read semantic tokens only.** `var(--tl-ink)`. Never `var(--tl-ref-color-ink-900)`,
   never a hex literal.
2. **`src/styles/tokens.generated.css` is generated.** Do not hand-edit it. The header says so and
   `npm run build` will catch it.
3. **`src/index.css` is the single exemption**, for the `@theme` block only, where Tailwind
   namespaces need a raw value and no role name exists.
4. **A new colour means a new token**, in order: add the primitive, add the semantic role,
   `npm run tokens`, then use it.
5. **Every motion token carries its reduced-motion counterpart in the same entry.**
6. **A boundary a user needs to see uses the structural rule token, never the decorative hairline.**
   The hairline is 1.49:1 and fails WCAG 1.4.11. This is the easiest mistake in the system to make.
7. **Motion springs are named for the moment in the arc they serve**, not for their shape:
   `focus`, `commit`, `settle`, `dismiss`. A token called `bouncy` has lost the plot.

**The direction is the gravity well**, approved 2026-09-18 and specified in `docs/LOOK.md`, drawn
since 2026-10-01 as a grid that makes room rather than a starfield that bends (D-027). Four
more rules apply, and none of them can be caught by an automated check:

8. **Depth is what an object does to its surroundings.** The grid makes room around the field;
   it is not raised, not recessed, and never carries a shadow attached to its edge. Same-colour-
   as-ground plus two soft shadows is neumorphism and is the one thing explicitly rejected.
9. **The field is static at rest.** The grid is drawn on demand and redrawn only at the four
   moments, plus once when the copy around it changes. No `requestAnimationFrame` loop, no drift, no shimmer. An ambient loop in
   the capture path breaks `PRODUCT.md`.
10. **Capture never waits on the GPU.** The field is real DOM and works the instant the page does;
    the grid layers in behind it. Roughly 2% of devices get no WebGL and must lose nothing
    functional. Since D-027 nothing depends on the canvas at all: the field draws its own edge.
11. **Scale is never a focus indicator**, and never animate `font-variation-settings`: it forces a
    text relayout every frame.
12. **The heavier edge is opt in and belongs to the capture field alone.** `<Field rim />`. It was
    briefly the default for every `Field`, which rested Settings with the one colour per screen
    appearing three times. Since D-027 it rests on the structural rule like every other field and
    turns accent only on focus, so at rest the one colour on Capture is the Park button.
13. **A reduced-motion override has to reach a SEMANTIC name.** Components may not read `--tl-ref-*`,
    so an override that only lands on the primitive reaches nothing. The generator now emits both.

**Two generated files, one solve.** `scripts/build-tokens.mjs` writes
`src/styles/tokens.generated.css` and `src/motion/springs.generated.ts`. The canvas cannot read a
CSS easing, and solving the springs twice is how a DOM arc and a WebGL arc drift apart.
`npm run tokens:check` diffs both.

**Depth Field is dead.** An earlier plan recommended it (planes at distances, a variable font width
axis carrying the z-axis, a `Plane` primitive). `docs/LOOK.md` superseded it. If you find an
instruction referencing planes, `distance` props or the width axis, it predates 2026-09-18. See
`docs/DECISIONS.md` D-007.

Enforced by **`npm run verify`**: privacy check, token check and lint. **Lint is clean and must
stay clean**, so any new problem fails the gate rather than joining a backlog. Separately,
`no-restricted-syntax` rules in `eslint.config.js` put a message at the point of the mistake.

**`verify` is deliberately NOT part of `npm run build`.** It was, and every Vercel deployment from
2026-09-18 failed while a clean local clone with `npm ci` and `CI=1 VERCEL=1` built green. Rather
than guess, the checks were moved off the deploy path as a controlled experiment. **Run
`npm run verify` before every push.** If the root cause is found and it was not these scripts, they
can go back into `build`.

---

## Motion

- **Zero runtime.** Springs are solved at build time into CSS `linear()` easings. No animation
  library is installed and none should be without a decision recorded in `docs/DECISIONS.md`.
- **Budget: JS ≤ 130 KB gzipped, CSS ≤ 12 KB gzipped, fonts ≤ 90 KB transfer.** Measured at D-027:
  **114.78 KB JS, 5.54 KB CSS, 44.5 KB fonts.** Roughly 15 KB of JS headroom and 6.5 KB of CSS.
  The grid gave back 3.35 KB of JS against the lens it replaced, and the sink cost 0.10 KB of CSS.
  Phase 7 measured 118.13 KB JS and 5.44 KB CSS; Phase 5 cost 1.08 KB of JS, D-019 and D-020 0.72 KB
  between them, and Phase 6 0.30 KB.

  **Phase 7 gave 0.28 KB of CSS back** by closing the prose leak (D-024), and left JS unmoved. This
  line said 117.99 KB JS and 5.71 KB CSS, which was never quite right: the tree at that commit built
  118.14 and 5.72. Small, and the point of writing it down is that it drifts silently otherwise.
  **Fonts are 44.5 KB, not the 89 KB a naive `du` reports**, because the same two files sit in
  `public/fonts/` and are copied into `dist/fonts/`. Count one of them.

  Two deliberate holds protect the rest: React is pinned at 19.2.8 (D-010) and zod uses the `mini`
  export (D-012). Record the numbers in the commit when they move.
- **Commit is where the budget goes.** If one moment is exceptional it is the handover. There is
  exactly one light event in the entire app and it lives here: the wave lifting the grid dots it
  passes, and it does not fire under reduced motion because a flash with no travel is a strobe. It
  is the `--tl-light-commit-peak` token, a gain of 1.1 that the media query sets to 0, read by the
  grid as a uniform. **It travels, it does not flash**: a lift applied to the whole grid at once
  would read as the page flashing rather than the field answering.
- **The words sink, and the field never waits for them.** On a park the field is cleared and
  refocused first, then a transient copy of the words sinks out of it a character at a time on
  `--tl-duration-sink` and `--tl-ease-sink`. The placeholder is held back until the copy has gone:
  two lines of text in the field at once is what made a park read as a glitch. Under reduced
  motion no copy is rendered and the words are simply gone.
- **Nothing rewards returning.** No celebration, no flourish, no "nice one". The reward is that the
  thought is gone.
- **Motion must never queue.** Commit animations run on transient elements keyed by capture id, and
  the field clears and refocuses synchronously before any animation exists. Two parks in quick
  succession must never make the second one wait.
- **Verify motion with a recording, not a screenshot**: the full arc, the same arc with
  `prefers-reduced-motion: reduce`, and a double-park.
- **"It looks still" is not evidence.** Wrap `requestAnimationFrame`, count the calls, and assert
  zero while the screen is idle. The grid must reach 0 at rest, 0 while focused and idle, and 0
  again once an arc has settled. Measured at D-027: 0, 0, 33 frames across a park, then 0.

---

## Do not touch

Not part of the design system work, and changing them is out of scope unless asked:

- The Dexie schema and stored data shape (`src/db/index.ts`, `src/types.ts`)
- The voice capture pipeline (`src/lib/voice.ts`)
- `src/lib/agent.ts` and the BYOK flow
- `src/lib/hands.ts` export behaviour
- Routing between the four views

---

## Delivery

- **One phase at a time.** The seven overhaul phases are done; each one's outcome and acceptance
  evidence is its own entry in `docs/DECISIONS.md`. `ROADMAP.md` carries what is next at the
  product level, which is a separate numbering and always has been.
- **A phase is done when someone has looked at it**, not when the build passed. Screenshot at 390px
  and 1280px against that phase's criteria before starting the next one.
- Imperative commit messages: "Add capture keyboard focus", "Wire semantic colour tokens".
- Explicit prop interfaces. Modular components. No broken relative imports.
- Never generate code referencing local machine paths, private keys or private files.

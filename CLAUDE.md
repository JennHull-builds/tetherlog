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

**The current work is the UI overhaul.** What is decided is in `docs/DECISIONS.md`; what is
specified but unbuilt is in `docs/BUILD-SPEC.md`. Start with `docs/DECISIONS.md`, which opens with a
status table and a map of which file does what.

**`docs/LOOK.md` is the visual direction and it is binding.** It was derived from reference images
rather than adjectives, which is the third attempt and the first one grounded in pictures. Read it
before any visual work. Three rules from it that contradict everything written before:

- **Radius is generous.** NIL's `0px` lock is dead.
- **Depth is what an object does to its surroundings**, never a shadow attached to its edge.
- **Never same-colour-as-ground plus two soft shadows.** That is neumorphism and it is the one thing
  explicitly rejected.

Phases 1 and 2 are **done and pushed**. Phase 3 onward needs the direction confirmed.

---

## What TetherLog is

An ND capture log. A thought hijacks you mid-task, you park it in under five seconds, you go back to
what you were doing. Review happens in the evening. Public, MIT, client-only, £0 to run.

`PRODUCT.md` is the product spec and it is binding. `ROADMAP.md` is the delivery order.

**`DESIGN.md` and `docs/UI-OVERHAUL.md` were deleted on 2026-09-18.** Both described states the code
had already left. Their live content is in `docs/DECISIONS.md` and `docs/BUILD-SPEC.md`; `git log`
has the originals. Any instruction referencing either file is out of date.

---

## Product rules, not open for redesign

1. **Capture is dumb, fast and silent.** Under five seconds. Zero AI, zero network, zero questions at
   park time. **Nothing animates in response to typing**: no keystroke pulse, no character effects,
   no ambient loop while the field is focused. Motion belongs at the state transitions, never inside
   them.
2. **No streaks, no guilt.** No overdue badges, no "you missed yesterday", no celebration, no
   confetti, no targets, no goals, no day-over-day comparison. Untriaged is parked, not failure.
3. **Four screens.** Capture, Review, Patterns, Settings. Never a fifth.
4. **Data stays on device.** Dexie and IndexedDB. No accounts in v1. BYOK for the agent, client-side
   only, key in localStorage, never on a server.
5. **The agent runs on Review only.** Never at capture.
6. **UK English** in UI copy, comments and commits. Colour, organise, initialise.
7. **`prefers-reduced-motion: reduce` is a contract, not a fallback.** Every motion token ships its
   reduced-motion counterpart in the same token entry. The generator throws if one is missing. The
   ND user base makes this correctness, not courtesy.

Tone: warm, literal, spare.

**Em dashes: zero in any heading, at most one per document in prose.** Use a colon, a full stop or a
bracket. This repo is public and the em dash is the current tell for AI-written text. Check with
`grep -c '—' <file>` before committing. `ROADMAP.md` carries 48 from before this rule and is the
known exception until someone sweeps it.

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

**If the direction is Depth Field** (recommended, not yet confirmed), four more rules apply, and none
of them can be caught by an automated check:

8. **Plane, type width and ink move together or not at all.** Use the `Plane` primitive and its
   `distance` prop. Setting a plane background without the matching width and ink breaks the depth
   illusion and looks like a bug nobody can name.
9. **`--tl-ink-far` is non-text only.** 3.50:1. Clears WCAG 1.4.11 for non-text, fails AA for body
   copy, deliberately. Anything the user must read moves forward a plane and gains contrast with it.
10. **Scale and width are never a focus indicator.** Focus is `--tl-focus-bar` at 8.33:1, always.
11. **Never animate `font-variation-settings`.** It forces a text relayout every frame. Width steps
    between token values at the transition boundary; it does not tween.

Enforced by **`npm run verify`**, which runs the privacy check and the token check. **It does not
run lint**, because `npm run lint` currently reports 9 pre-existing problems (4 errors, all
`react-hooks` findings in `SettingsView` and `ReviewView`) and a gate that always fails is a gate
nobody reads. Lint runs in CI non-blocking so the count stays visible. Clearing those 4 errors and
then folding lint into `verify` is outstanding work. Separately, `no-restricted-syntax` rules in
`eslint.config.js` put a message at the point of the mistake.

**`verify` is deliberately NOT part of `npm run build`.** It was, and every Vercel deployment from
2026-09-18 failed while a clean local clone with `npm ci` and `CI=1 VERCEL=1` built green. Rather
than guess, the checks were moved off the deploy path as a controlled experiment. **Run
`npm run verify` before every push.** If the root cause is found and it was not these scripts, they
can go back into `build`.

---

## Motion

- **Zero runtime.** Springs are solved at build time into CSS `linear()` easings. No animation
  library is installed and none should be without a decision recorded in `docs/DECISIONS.md`.
- **Budget: JS ≤ 130 KB gzipped, CSS ≤ 12 KB gzipped, fonts ≤ 90 KB transfer.** Baseline at
  `f1416d2` was 114.67 KB JS and 6.55 KB CSS. Record the numbers in the commit when they move.
- **Commit is where the budget goes.** If one moment is exceptional it is the handover. Under Depth
  Field there is exactly one light event in the entire app and it lives here: 320ms, peak 0.22 alpha,
  and it does not fire under reduced motion because a flash with no travel is a strobe.
- **Nothing rewards returning.** No celebration, no flourish, no "nice one". The reward is that the
  thought is gone.
- **Motion must never queue.** Commit animations run on transient elements keyed by capture id, and
  the field clears and refocuses synchronously before any animation exists. Two parks in quick
  succession must never make the second one wait.
- **Verify motion with a recording, not a screenshot**: the full arc, the same arc with
  `prefers-reduced-motion: reduce`, and a double-park.

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

- **One phase at a time.** `docs/BUILD-SPEC.md` section 3 has the phases and their acceptance
  criteria.
- **A phase is done when someone has looked at it**, not when the build passed. Screenshot at 390px
  and 1280px against that phase's criteria before starting the next one.
- Imperative commit messages: "Add capture keyboard focus", "Wire semantic colour tokens".
- Explicit prop interfaces. Modular components. No broken relative imports.
- Never generate code referencing local machine paths, private keys or private files.

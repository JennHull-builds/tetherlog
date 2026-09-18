# TetherLog UI overhaul

**Phase 0: audit, design direction, token specification.** No application code was written and no
component was changed in this phase.

Written 2026-09-18 against commit `f1416d2`. Every number below was measured in this session; the
sources are named where they are not the repo itself.

**This plan is not startable yet.** A design direction has to be chosen first (section 3). See
[Build session kickoff](#build-session-kickoff).

---

## Conflicts found

The brief asked that inconsistencies be reported rather than silently resolved. Two were known
going in. Six more turned up. None of them block the plan, and each is handled in the audit.

| # | Conflict | Status |
|---|---|---|
| 1 | `DESIGN.md` states bg `#EDECE8` / surface `#E2E1DC` / accent `#0241e3`. The rendered values are `#f3f2ee` / `#eae9e5` / `#3b6ef5`. | Known. Reconciled in 1.2. |
| 2 | `DESIGN.md` `## Hard rules` mandate NIL DS, which the decision removes. | Known. `DESIGN.md` is treated as historical. |
| 3 | **IBM Plex has never loaded.** `--nil-font-body` names `'IBM Plex Sans'` and there is no `@font-face`, no stylesheet link and no font package anywhere in the repo. Every screen renders in `system-ui`. | New. See 1.3. |
| 4 | **`.cursorrules` forbids `#ffffff`; the app ships it.** `--nil-color-accent-contrast: #ffffff` is the Park button's label colour. | New. Dies with NIL. |
| 5 | **Tailwind is compiling class names out of the documentation.** `.cursorrules:16` and `ROADMAP.md:62` both contain the literal string `bg-[var(--…)]` as an example of what *not* to write. Tailwind v4's content scan reads them and emits `.bg-\[var\(--…\)\]{background-color:var(--…)}` into production CSS, with a build warning. | New. See 1.6. |
| 6 | **The accent fails WCAG AA.** `text-mark` (`#3b6ef5`) on the page ground is **3.96:1**. It is the colour of the word "Logged." | New. See 1.4. |
| 7 | **PWA chrome does not match the app.** `index.html` and the manifest declare `#0241e3` and `#EDECE8`, which are `DESIGN.md`'s values, not the rendered ones. Installed on Android the browser chrome is a different blue from the accent inside it. | New. See 1.5. |
| 9 | **NIL's universal reset silently killed every spacing utility in the app.** `core.css` shipped an **unlayered** `*, *::before, *::after { margin: 0; padding: 0 }`. Unlayered rules beat every `@layer`, and Tailwind v4 puts utilities in `@layer utilities`, so all **72** padding, margin and `space-y` utilities across five files computed to zero. `px-4` on the capture screen measured `padding-left: 0px`. `mx-auto` on the app wrapper did nothing, so at 1280px the whole app sat pinned to the top-left corner. | **New. Fixed in Phase 1.** See 1.12. |
| 8 | **The spacing scale is half-overridden.** `@theme` defines `--spacing-1,2,4,6,8` only. Tailwind v4 derives every other step from a single `--spacing` base, so `gap-3` and `gap-10` resolve through a different mechanism from `gap-2` and `gap-4`. It is invisible today only because the five overrides happen to equal the defaults. | New. See 1.7. |

One further note rather than a conflict: `PRODUCT.md`'s triage schema includes a `write` bucket that
`src/types.ts` does not have. `ROADMAP.md` Phase 8 owns it. The token system leaves a slot for it and
nothing more.

---

## 1. Audit

### 1.1 What actually renders today

Read from `src/nil-ds/tokens/tokens.css` and `src/index.css`, not from `DESIGN.md`.

| Role | Tailwind utility | Rendered value | Where it comes from |
|---|---|---|---|
| Page ground | `bg-paper` | `#f3f2ee` | `--nil-color-bg` |
| Raised surface | `bg-raised` | `#eae9e5` | `--nil-color-surface` |
| Body text | `text-ink` | `#0a0a0a` | `--nil-color-text` |
| Secondary text | `text-muted` | `#4a4a4a` | `--nil-color-text-muted` |
| Borders | `border-line` | `#0a0a0a` | `--nil-color-border` |
| Accent | `bg-mark` / `text-mark` | `#3b6ef5` | `--nil-color-accent` |
| On-accent | `text-mark-text` | `#ffffff` | `--nil-color-accent-contrast` |
| Body face | `font-sans` | **`system-ui`** | `--nil-font-body` falls through, see 1.3 |
| Radius | everywhere | `0px` | `--nil-radius-none` |
| Border width | everywhere | `1.5px` | `--nil-border-width` |

Shape: hard rectangles, `0` radius, `1.5px` ink borders. `FileCard` adds a 6px left tone bar, a `[`
glyph, and a `3px 3px 0` hard offset shadow when in peek mode. `LogStack` places three offset peek
cards at 35% opacity behind the capture hero.

Note the border width. `DESIGN.md` says "`2px` borders everywhere". The rendered value is `1.5px`,
because components read `--nil-border-width` and not `--nil-border-width-thick`. `NavBar` is the one
exception: its Tailwind class says `border-t-2` and its inline style then overrides it back to
`1.5px`.

Bucket and tag hues are app-level, defined as raw hex in `src/index.css`:
`now #d4764e`, `later #d4a574`, `wonder #9b8fb8`, `do #6a9e6a`, `drop #8a8378`.
`--color-later` and `--color-wonder` duplicate `--color-tag-later` and `--color-tag-wonder` exactly.

### 1.2 The documentation drift, measured

| What `DESIGN.md` says | What renders | Difference |
|---|---|---|
| bg `#EDECE8` | `#f3f2ee` | Lighter and cooler by roughly 2% L |
| surface `#E2E1DC` | `#eae9e5` | Lighter by roughly 3% L |
| accent `#0241e3` | `#3b6ef5` | A visibly different, lighter, less saturated blue |
| `2px` borders everywhere | `1.5px` | Thinner |

The accent drift is the expensive one. `#0241e3` was chosen and locked by Jen. It passes AA as text
on the ground at 6.54:1 and AAA with white on it at 7.32:1. The rendered `#3b6ef5` fails both, at
3.96:1 and 4.44:1. **The documented decision was accessible and the shipped one is not**, and nobody
looked at the difference, because the doc was read instead of the tokens.

Cause: `DESIGN.md` records values copied from nil-ds at the time of writing. nil-ds moved. The sync
script copies CSS, not documentation, so the doc froze and the CSS did not.

### 1.3 The typeface has never been seen

```
--nil-primitive-type-font-body: 'IBM Plex Sans', system-ui, sans-serif;
--nil-primitive-type-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
```

Neither family is loaded. There is no `@font-face` rule, no `fonts.googleapis.com` link in
`index.html`, no `@fontsource` package in `package.json` and no font file in `public/`. Verified by
grep across `src/`, `index.html`, `public/` and `package.json`.

So the app renders in `system-ui`, which is Roboto on the Android device it is designed for and
SF Pro on the machine it is developed on. `Chip` and `FileCard` set `--nil-font-mono` for their
uppercase labels and bracket glyph, which resolves to `ui-monospace`.

Two consequences worth stating plainly. The design has never been evaluated as specified. And the
app currently ships **zero font bytes**, which is a real baseline that any new type decision has to
beat on merit, not on taste.

### 1.4 Contrast audit

Computed with the WCAG 2.x relative luminance formula against the rendered values.

| Pair | Ratio | Verdict |
|---|---|---|
| `text-ink` on ground | 17.67:1 | AAA |
| `text-muted` on ground | 7.91:1 | AAA |
| ink on `tag-later` fill | 8.89:1 | AAA |
| ink on `tag-wonder` fill | 6.61:1 | AA |
| ink on `do` fill | 6.33:1 | AA |
| ink on `tag-now` fill | 6.13:1 | AA |
| ink on `drop` fill | 5.28:1 | AA |
| **white on accent** (Park button label, 16px) | **4.44:1** | **fails AA** |
| **ink on accent** (selected neutral Chip, 12px) | **4.46:1** | **fails AA** |
| **`text-mark` on ground** ("Logged.", 14px) | **3.96:1** | **fails AA** |
| **`text-do` on ground** ("Carry forward", 14px) | **2.79:1** | **fails AA** |
| `tag-later` as text on ground | 1.99:1 | fails, currently unused |

Four live failures. The two that matter most are the two the product is built around: the Park
button and the confirm word. Both are fixed by the new palette, which is contrast-checked at source
(section 4.2) rather than after the fact.

### 1.5 PWA chrome

| File | Declares | Rendered equivalent |
|---|---|---|
| `index.html` `theme-color` | `#0241e3` | accent is `#3b6ef5` |
| `manifest.webmanifest` `theme_color` | `#0241e3` | accent is `#3b6ef5` |
| `manifest.webmanifest` `background_color` | `#EDECE8` | ground is `#f3f2ee` |
| `public/favicon.svg` | `#2d2d3a` ground, `#c4b5fd` strokes, `rx="8"` | matches nothing in the app |

The favicon is a survivor of the 2026-08-17 dark v0: a rounded purple-on-navy mark, in an app that
is light, warm and has zero radius. On Android, where `PRODUCT.md` puts the primary install path, the
favicon is the home-screen icon and `theme_color` is the status bar. Both are wrong.

### 1.6 Tailwind is compiling the documentation

`npm run build` at `f1416d2` emits a warning and ships this rule:

```css
.bg-\[var\(--…\)\]{background-color:var(--…)}
```

Tailwind v4's automatic content detection scans the repository. `.cursorrules:16` and
`ROADMAP.md:62` both quote `bg-[var(--…)]` as an anti-pattern. Tailwind cannot tell prose from
markup, so it compiles the example.

It is worse than one junk rule, and it was worth measuring rather than reasoning about. **Writing
this plan added fourteen more.** Building the repo with `docs/UI-OVERHAUL.md` and `CLAUDE.md` present
and nothing else changed, these appeared in production CSS:

```
.backdrop-filter  .blur     .fixed    .font-sans  .grow   .inline  .invisible
.ring             .rounded  .rounded-card         .shadow .static  .transform
```

Every one of them came from an ordinary English word in prose. This document discusses blur, shadow,
rings, rounded corners, fixed light sources and static images, because that is what a document about
a design system talks about. CSS gzip went from 6.55 KB to 7.14 KB.

So the mitigation is not a writing rule. There is no way to write about a design system without using
the words "shadow", "fixed", "inline" and "static", and a rule nobody can follow is not a rule.
**The fix is configuration**, verified end to end in an isolated Vite + Tailwind 4.3.3 project in this
session. A markdown file containing an arbitrary-value class emitted
`.bg-\[var\(--zzz\)\]{background-color:var(--zzz)}`; adding one directive removed it and left every
class from real markup intact:

```css
@source not "../*.md";
@source not "../docs/**/*.md";
@source not "../.cursorrules";
```

Paths are relative to the CSS file, so these are written from `src/index.css`. `@source not` is
supported in `tailwindcss@4.3.3`, checked against the installed package rather than recalled.

**This moves to Phase 1**, not Phase 7. The token work in Phase 2 adds more semantic colour names,
and every one of them makes more ordinary words compile into rules.

### 1.7 The spacing scale is half-overridden

`src/index.css` defines `--spacing-1, -2, -4, -6, -8` inside `@theme`. Tailwind v4 generates the rest
of the scale from a single `--spacing` base. The built CSS proves both paths are live:

```css
.gap-2  { gap: var(--spacing-2) }              /* overridden */
.gap-3  { gap: calc(var(--spacing) * 3) }      /* derived */
.gap-4  { gap: var(--spacing-4) }              /* overridden */
.gap-10 { gap: calc(var(--spacing) * 10) }     /* derived */
```

Nothing is visibly wrong today because `0.25 / 0.5 / 1 / 1.5 / 2rem` is exactly `0.25rem × n`, so the
two paths agree by coincidence. Change one override and the scale silently splits in half.

Correct in v4: set the single `--spacing` base, or define the complete scale. Never a partial
override. This goes in `CLAUDE.md`.

### 1.8 What NIL actually delivers

| Vendored | Lines | Consumed by the app |
|---|---|---|
| `src/nil-ds/tokens/tokens.css` | 163 | **20 distinct custom properties** |
| `src/nil-ds/core/core.css` | 663 | **one class** (`.nil-btn`) plus the body reset |

826 lines carrying 20 values and one button style. The 20, by use count:

```
11  --nil-border-width          4  --nil-color-text-muted     2  --nil-spacing-lg
 9  --nil-color-border          4  --nil-color-text           2  --nil-font-mono
 7  --nil-radius-none           4  --nil-color-surface        2  --nil-color-danger
 6  --nil-spacing-md            3  --nil-type-scale-base      2  --nil-color-bg
 4  --nil-spacing-sm            3  --nil-font-body            2  --nil-color-accent-contrast
                                3  --nil-color-accent         1  --nil-motion-easing-standard
 2  --nil-type-scale-xs         2  --nil-spacing-xs           1  --nil-motion-duration-base
```

The rest is dials, rings, lightboxes, demo navigation, a 12-column page grid and a blinking cursor,
none of which a four-screen capture app has any use for.

There is one thing in `core.css` the app genuinely depends on and would lose:

```css
body { background-color: var(--nil-color-bg); color: var(--nil-color-text); font-family: …; }
```

`App.tsx` paints its own `bg-paper text-ink` on a `max-w-lg` wrapper, so on a wide screen the area
outside that wrapper is painted by `body`, from `core.css`. Remove `core.css` naively and the page
gutters go white. Handled in section 2.

### 1.9 Files that die, files that change

**Deleted**

| Path | Why |
|---|---|
| `src/nil-ds/tokens/tokens.css` | Vendored copy of another repo's tokens |
| `src/nil-ds/core/core.css` | Vendored copy of another repo's core CSS |
| `src/nil-ds/` | The directory |
| `scripts/sync-nil-ds.sh` | Nothing left to sync |
| `package.json` → `"sync-nil-ds"` | Same |
| `DESIGN.md` → `## Hard rules` | Arrived with `fe9fbac`, leaves with it |
| `DESIGN.md` → `## Token stack` | Same |

**Changed**

| Path | What changes | Size |
|---|---|---|
| `src/index.css` | Import chain, whole `@theme`, keyframes | rewrite |
| `src/components/ui/Button.tsx` | 17 `--nil-*` references, `.nil-btn` class | rewrite |
| `src/components/ui/FileCard.tsx` | 9 `--nil-*` plus 5 `--color-*` | rewrite |
| `src/components/ui/Chip.tsx` | 8 `--nil-*` plus 5 `--color-*` | rewrite |
| `src/components/ui/Field.tsx` | 7 `--nil-*` in `FIELD_STYLE` | rewrite |
| `src/components/ui/Card.tsx` | 4 `--nil-*` | small |
| `src/components/NavBar.tsx` | 4 `--nil-*` inline | small |
| `src/views/SettingsView.tsx` | 1 `--nil-radius-none` inline | one line |
| `src/components/LogStack.tsx` | Composition changes with the direction | medium |
| `src/views/CaptureView.tsx` | Motion path, markup, `animate-file-into-stack` | medium |
| `src/views/ReviewView.tsx` | `text-do`, layout, triage card | medium |
| `src/views/PatternsView.tsx` | `bg-mark`, chart treatment | medium |
| `src/App.tsx` | `data-theme="light"` is NIL's hook | one line |
| `index.html` | `data-theme`, `theme-color`, font preload | small |
| `public/manifest.webmanifest` | `theme_color`, `background_color`, icons | small |
| `public/favicon.svg` | Dark v0 leftover | replace |
| `eslint.config.js` | Token discipline rules (4.7) | addition |
| `package.json` | `tokens`, `tokens:check` scripts; drop `sync-nil-ds` | small |
| `DESIGN.md` | Superseded by this document | rewrite |
| `.cursorrules` | Points at `DESIGN.md`; one example string feeds 1.6 | small |

**New**

`docs/UI-OVERHAUL.md` (this file) · `CLAUDE.md` · `src/tokens/tokens.json` ·
`scripts/build-tokens.mjs` · `scripts/check-tokens.sh` · `src/styles/tokens.generated.css`

### 1.10 Worth keeping

Not everything here should be thrown away.

- **`/` to focus the capture field, and Enter to park.** Correct, cheap, already working.
- **`hapticPark()`** — a 12ms vibrate, wrapped in try/catch because some browsers expose `vibrate`
  and then reject it. Keep the comment too.
- **Bucket colour as a category system.** The hues are wrong, the idea is right: one hue per bucket,
  applied consistently across chip, card edge and summary.
- **`aria-live="polite"` with `aria-atomic` on the confirm line**, and the fixed `h-5` that stops the
  layout jumping when the word appears and disappears. That reserved space is the difference between
  a confirm and a shove.
- **The peek stack as a concept.** Three offset cards behind the hero, showing that the log exists
  without showing what is in it. The execution changes with the direction; the restraint should not.
- **`prefers-reduced-motion` already handled at the source**, in `playLoggedMotion`, rather than only
  in CSS. It skips the slide and keeps the confirm. That is the right shape.
- **The `Field` auto-grow cap** at `1.5 × 16 × maxLines + 24` px. Deliberately not an essay box.

See 1.11 for the one behavioural change that goes with this work.

### 1.12 The reset that ate the layout

**Found by rendering the app, not by reading it**, which is the only way this class of bug is ever
found. Measured at 390px with the Chrome DevTools Protocol, then confirmed against the built CSS.

`src/nil-ds/core/core.css` opened with a reset that looks completely ordinary:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

It is imported into `src/index.css` with a plain `@import`, which means it lands **unlayered**.
Tailwind v4 puts every utility inside `@layer utilities`. The cascade rule is that **unlayered
styles beat layered styles regardless of specificity**, so a zero-specificity `*` selector outranked
every padding and margin utility in the application.

Confirmed in the built stylesheet by brace depth:

```
*,:before,:after { box-sizing:border-box; margin:0; padding:0 }   depth 0  ← unlayered, wins
.px-4           { padding-inline: var(--spacing-4) }              depth 1  ← @layer utilities, loses
```

**72 utilities across five files were dead:** every `p-*`, `px-*`, `py-*`, `pt-*`, `pb-*`, `m-*`,
`mt-*`, `mx-*` and `space-y-*` in `src/`. What still worked was `gap-*`, because flex and grid gap is
neither margin nor padding, and anything set through an inline `style` object, because inline styles
beat everything. That is precisely why the five UI primitives looked padded and the four screens did
not: the primitives set padding inline, the views used utilities.

Measured before the fix, at a true 390px viewport:

| Element | Class | Computed |
|---|---|---|
| `main > section` | `px-4 py-16` | `padding-left: 0px`, `padding-right: 0px` |
| `h1` | inside `px-4` | `x = 0`, flush to the screen edge |
| app wrapper | `mx-auto max-w-lg` | `margin-left: 0px`, pinned left at 1280px |

So at 1280px the entire application sat in a 512px column in the top-left corner with two-thirds of
the screen empty, and at 390px every screen ran edge to edge with no gutter. **This is a large part
of what "the UI looks the worst" was pointing at, and none of it is a taste problem.**

**Fixed in Phase 1** by deleting `core.css`. The reset is deliberately not re-created: Tailwind's
preflight already resets `margin` and `box-sizing` inside `@layer base`, where utilities correctly
win. The lesson is in `CLAUDE.md`: **never add an unlayered global reset to a Tailwind v4 project.**

### 1.11 The optimistic park

**Approved by Jen on 2026-09-18**, with one condition, in her words: *"Just make damn sure you
document that very well, because if that starts presenting problems we need to know where to look."*
This subsection is that documentation. It is deliberately longer than the change deserves, because
the failure it can produce is a **silently lost capture**, and a silently lost capture in a
capture app is the worst bug the product can have.

#### What it is today

`CaptureView.handlePark` awaits the database before it touches the UI:

```ts
await parkCapture(trimmed, parkedTag);   // field still full, user still waiting
playLoggedMotion(parkedTag);             // only now does it clear and refocus
```

Typically 1 to 5ms and invisible. Not invisible when the write carries a voice blob, when the
device is under memory pressure, when IndexedDB is mid-compaction, or when `session.stop()` sits in
the same await chain on the voice path. The product promise is under five seconds with nothing asked
of the user, and this makes the field's readiness a function of disk.

#### What it becomes

```ts
async function handlePark(event?: React.FormEvent) {
  event?.preventDefault();
  const trimmed = text.trim();
  if (!trimmed || recording) return;

  const parkedTag = tag;

  // 1. HOLD. The only copy of the user's words outside React state.
  //    Must be set before anything is cleared, and must survive re-render.
  inFlightRef.current.set(pendingId, { text: trimmed, tag: parkedTag });

  // 2. RELEASE. Synchronous. The field is ready from here on, and nothing
  //    below this point is allowed to gate it.
  setText("");
  setTag(undefined);
  inputRef.current?.focus();
  hapticPark();
  playCommitMotion(parkedTag);

  // 3. SETTLE. Behind the user.
  try {
    await parkCapture(trimmed, parkedTag);
    inFlightRef.current.delete(pendingId);
  } catch (err) {
    // 4. RECOVER. Put the words back where the user left them.
    inFlightRef.current.delete(pendingId);
    restoreFailedPark(trimmed, parkedTag, err);
  }
}
```

Four steps, and the order is the whole design. **Hold before release, release before settle,
recover on failure.** Any reordering reintroduces the bug this is built to avoid.

#### The rules

1. **Nothing between the hold and the release may be async.** Not a state read, not an await, not a
   `queueMicrotask`. The release must happen in the same synchronous block as the keypress handler,
   or the field's readiness is back to being a function of something else.
2. **`inFlightRef` is a ref, not state.** It must not trigger a re-render and it must survive one.
3. **A failed park restores the text into the field**, with the tag, and shows an error. It never
   clears silently and it never retries on its own, because a silent retry can double-write.
4. **If the field already has new text when a park fails**, the failed text is appended to the error
   message rather than overwriting what the user has since typed. Losing the new thought to recover
   the old one is not a fix.
5. **The commit animation never reads `inFlightRef`.** Motion and persistence are independent
   systems; coupling them is how a slow disk becomes a stuck animation.

#### If parks go missing, look here first

This is the table to read at 4am.

| Symptom | Likely cause | Where to look |
|---|---|---|
| A thought was typed, Park pressed, and it is not in Review | The write rejected and the recovery path did not run | `handlePark`'s catch, and whether `restoreFailedPark` is wired |
| The field clears but the count does not increment | Optimistic UI updated, write failed, error swallowed | Whether the catch is `catch {}` rather than handling |
| Captures go missing only on voice parks | `session.stop()` rejecting inside the same try | The voice path in `stopAndParkVoice`, which has its own hold/release |
| Captures go missing only on the phone | IndexedDB quota, likely from stored audio blobs | Browser storage inspector; `ROADMAP.md` flags quota as known future work |
| Two identical captures for one Park | A retry was added, or the hold was not cleared | `inFlightRef.current.delete` on both paths |
| The field does not clear at all | Something async crept in above the release | Step 2 of `handlePark` |

**Diagnostic that should exist from Phase 4:** a `console.warn` on every failed park including the
text, so the words are recoverable from the console even when the UI recovery fails. It costs one
line and it is the difference between a lost thought and an annoying one.

#### The trade, stated plainly

**Given up:** the guarantee that the UI never says "done" before the disk says "done".

**Gained:** a field that is ready in 0ms instead of in however long IndexedDB takes, which is the
single biggest contributor to whether a hijacked person parks a thought or gives up.

**Residual risk:** if the write fails *and* the recovery path fails, the capture is gone with no
trace. That is the one scenario this design cannot make safe, which is why the `console.warn` is
part of the change and not an optional extra.

---

## 2. Rip-out plan

The build must stay green at every step, and "green" here means the preview build on Vercel, not
`npm run build` on this machine. That distinction is what `f1416d2` was fixing.

```
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 0   baseline           npm run build  →  114.67 KB JS gz      │
  │                                                 6.55 KB CSS gz     │
  └────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   inline, do not delete
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 1   copy the 20 live --nil-* values into src/index.css as     │
  │          :root literals, keeping the same names                    │
  │          NIL imports still present, output byte-identical           │
  └────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   cut the imports
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 2   delete the two @import lines + src/nil-ds/                │
  │          re-add the body paint that core.css was doing             │
  │          components untouched, still reading --nil-* names          │
  │          ── THIS IS THE INTERIM STATE, written out below ──        │
  └────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   remove the plumbing
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 3   delete scripts/sync-nil-ds.sh + the npm script            │
  │          strip DESIGN.md ## Hard rules and ## Token stack          │
  └────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   new system arrives
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 4   tokens.json + generator + tokens.generated.css            │
  │          index.css imports the generated file, @theme maps it      │
  │          --nil-* aliases now point at --tl-* semantics             │
  └────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   one file at a time
  ┌────────────────────────────────────────────────────────────────────┐
  │ step 5   rewrite components to read --tl-* directly                │
  │          delete each --nil-* alias as its last reader goes          │
  │          lint rule turns on when the last alias is gone            │
  └────────────────────────────────────────────────────────────────────┘
```

The shape of it: **rename last**. Steps 1 and 2 change where the values live without changing the
values or the names, so the rendered output is identical and any visual difference is a mistake, not
a design choice. That makes step 2 checkable by screenshot diff rather than by judgement.

### Step 1, in detail

Paste the 20 consumed values into `src/index.css` above the `@theme` block, under their existing
names. Leave the NIL imports in place. Later definitions of the same custom property win in the
cascade, so the inlined values shadow the imported ones and the output does not move. Build and
screenshot: it must be pixel-identical.

### Step 2, the interim state

This is the moment the brief asks about: NIL gone, new tokens not yet in. `src/index.css` in full:

```css
@import "tailwindcss";

/* ── Interim. Values lifted verbatim from nil-ds at f1416d2. ──────────────
   Names are still --nil-* on purpose: nothing renames until the new token
   system lands in step 4, so any visual change here is a bug, not a choice.
   Replaced wholesale by src/styles/tokens.generated.css. ───────────────── */
:root {
  --nil-color-bg: #f3f2ee;
  --nil-color-surface: #eae9e5;
  --nil-color-text: #0a0a0a;
  --nil-color-text-muted: #4a4a4a;
  --nil-color-border: #0a0a0a;
  --nil-color-accent: #3b6ef5;
  --nil-color-accent-contrast: #ffffff;
  --nil-color-danger: #c62832;

  --nil-spacing-xs: 4px;
  --nil-spacing-sm: 8px;
  --nil-spacing-md: 16px;
  --nil-spacing-lg: 24px;

  --nil-radius-none: 0px;
  --nil-border-width: 1.5px;

  --nil-font-body: system-ui, sans-serif;
  --nil-font-mono: ui-monospace, monospace;
  --nil-type-scale-xs: 0.75rem;
  --nil-type-scale-base: 1rem;

  --nil-motion-duration-base: 200ms;
  --nil-motion-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root { --nil-motion-duration-base: 1ms; }
}

/* core.css painted the body. Tailwind preflight does not, and App.tsx only
   paints its own max-w-lg wrapper, so without this the page gutters go white
   on any screen wider than lg. */
body {
  background-color: var(--nil-color-bg);
  color: var(--nil-color-text);
  font-family: var(--nil-font-body);
  font-size: var(--nil-type-scale-base);
  line-height: 1.5;
  margin: 0;
  min-height: 100svh;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@theme {
  --color-paper: var(--nil-color-bg);
  --color-raised: var(--nil-color-surface);
  --color-line: var(--nil-color-border);
  --color-ink: var(--nil-color-text);
  --color-muted: var(--nil-color-text-muted);
  --color-mark: var(--nil-color-accent);
  --color-mark-text: var(--nil-color-accent-contrast);

  --color-tag-now: #d4764e;
  --color-tag-later: #d4a574;
  --color-tag-wonder: #9b8fb8;
  --color-do: #6a9e6a;
  --color-drop: #8a8378;

  --font-sans: var(--nil-font-body);
  --animate-file-into-stack: file-into-stack 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes file-into-stack {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(16rem) scale(0.62); opacity: 0.15; }
}

@media (prefers-reduced-motion: reduce) {
  .animate-file-into-stack { animation: none; }
}

html { color-scheme: light; }
#root { min-height: 100dvh; }

@media print {
  nav, .no-print { display: none !important; }
}
```

Four things were dropped on purpose and each is a deliberate choice, not an omission:

- **`--nil-type-scale-sm/lg/xl/2xl/3xl`, dial sizes, ring sizes, layout, breakpoints** — no reader.
- **`--color-later` and `--color-wonder`** — exact duplicates of the `tag-` versions. `ReviewView`
  passes bucket names to `FileCard` and `Chip`, which map them through `TONE_BAR` / `TONE_COLOR`, so
  the `tag-` tokens are the ones actually read.
- **`--radius-xl`, `--radius-card`** — `rounded-xl` and `rounded-card` appear nowhere in `src/`.
- **`--ease-file`, `--duration-file`** — defined, never referenced; the keyframe inlines its own
  timing. Note also that `--duration-*` is not a Tailwind v4 theme namespace, so `--duration-file`
  could never have produced a utility.

And **`--spacing-1` through `--spacing-8` are gone**, per 1.7. Removing them moves nothing, because
the values they set are identical to the ones Tailwind derives. Verify that on the step 2 screenshot
rather than trusting this sentence.

The `.nil-btn` class disappears with `core.css`. It carried hover, active and `:focus-visible`
states. `Button.tsx` keeps `className="nil-btn"` through step 2 where it now resolves to nothing, so
**the interim build has no button hover or focus ring**. That is expected and it is the one visible
regression in the interim state. It is closed in step 5, and the focus ring comes back as a token
rather than as a vendored class.

### Step 3

Delete `scripts/sync-nil-ds.sh`, drop `"sync-nil-ds"` from `package.json`. Strip `## Hard rules` and
`## Token stack` from `DESIGN.md` and add a line to its log pointing here.

Do **not** try to reuse nil-ds's own `tokens:build` script by relative path. That is exactly the bug
`f1416d2` fixed: Vercel checks out this repo only, so `../nil-ds` does not exist at build time while
`npm run build` passes locally and proves nothing.

### Steps 4 and 5

Section 4 specifies the token system. Step 5 rewrites components one file at a time, each with its
own screenshot. The `--nil-*` alias block stays in `index.css` until its last reader is gone, then
the whole block and the lint exemption go together.

---

## 3. Three design directions

**Superseded 2026-09-18, second pass.** The first pass proposed warm stock in three
variations. Jen ruled the warm palette out and lifted every remaining constraint:

> "All of the old things are out. You do not need to worry about any card stock or accent
> colours. I do not like the warm feel you currently got going. I imagine something a bit more
> like the illusion of depth and space, and dramatic but minimalist. Modern and sleek."

So: cool, dark, minimal, and depth is the whole subject. Nothing below carries anything over
from the first pass except the product constraints and the motion arc, which are not aesthetic
decisions.

**All three are rendered and interactive**, so this section is the specification rather than the
pitch: https://claude.ai/artifact/MzpBKe3epbTTkwE417nTko

The question is unchanged and it is still the only one that matters: **what makes depth, once
shadow and radius are off the table?** Three answers, three different physical claims.

---

### Direction A: Aperture

**Thesis.** Near-black space with a single light in it. The capture field is not an object, it is
the lit region, and the interface is that light opening and closing. Nothing has an edge, because
in a dark room you do not see edges, you see what is illuminated. The product metaphor is exact:
the app opens to take something and closes once it has it.

**The depth mechanism.** Luminance falloff from one source. A radial gradient centred on the
field, no border anywhere, no shadow, no blur filter. Hierarchy is distance from the light:
what is near it is legible, what is far from it recedes into the ground.

**Type.** Geist, weights 200 to 800, plus Geist Mono. **51.3 KB.** The idea is that weight is the
drama. A 200-weight headline at display size would be unreadable on almost any other ground; it
works here only because it sits inside the light, which means the type and the mechanism are the
same decision. One family and its own mono, so there is a single voice and a single counter-voice.

**Palette.** Ground `#08090c`, lit surface `#16181e`, ink `#f2f4f7` at 18.07:1, muted `#7e8592` at
5.36:1, light `#b8d4ff` at 13.18:1. Buckets sit in a cold range: `#8fd3ff`, `#9fb0d8`, `#b6a3e8`,
`#7fe0b8`, all above 8:1.

**Grounds.** Dark is its native and only comfortable home. **It does not invert.** A pool of light
on a light ground is a stain, not a light, so a light mode would need a different mechanism
entirely. If light mode is ever wanted, this direction cannot provide it.

**At 390px in daylight.** The weakest of the three, and this is its real cost. A gradient at
0.16 alpha is exactly what high ambient light destroys. Outdoors the glow flattens and the screen
reads as near-black with text on it, which still works but is no longer the design.

**What it costs.** 51.3 KB fonts, zero JS, one static gradient plus an opacity and transform
transition, which stays on the compositor. **The real cost is that it is the most fashionable of
the three.** A soft glow on near-black is the current house style of most developer tooling, so
it will read as competent and familiar rather than as TetherLog's own.

**The four moments.** At rest, a dim pool already sits on the field, which reads as ready without
looping. On focus the light brightens and widens on `spring.focus`. On commit the aperture closes
to a horizontal slit on `spring.commit`. After, it reopens to rest on `spring.settle`.
**Reduced motion:** the same four light levels, switched instantly. The light is a static property,
so this direction degrades better than it looks like it should.

---

### Direction B: Monolith

**Thesis.** Machined slabs in a dark room. Objects are solid, near-black on near-black, and you
only know one is there because a single hard edge catches light. Nothing is soft, nothing is
blurred, nothing has a radius. The whole interface is one material, cut precisely.

**The depth mechanism.** Edge relief. A hard 1px highlight on the top edge and a hard 1px shadow
beneath it, no blur and no spread, from a light source fixed above. Hierarchy is which edges are
lit and how brightly.

**Type.** Martian Mono for display, Archivo 300 to 800 for body. **57.1 KB.** The idea is a split
with a rule behind it: **mono for anything the machine says, grotesque for anything you wrote.**
Headings, chips, counts, timestamps and nav are mono, because they are the instrument talking.
Your parked thought is always Archivo, because it is yours. That is a system a reader can learn
without being told, and it is why this is not simply a font pairing.

**Palette.** Ground `#0c0d0f`, slab `#131417`, edge light `#666d79`, edge shadow `#050507`, ink
`#e8eaed` at 16.13:1, muted `#7d848d` at 5.15:1, accent `#4d7cff` at 5.22:1.

**Grounds.** Inverts cleanly, which is its structural advantage over Aperture. The light stays
above; on a light ground the top edge goes dark and the bottom edge goes light. Same mechanism,
same tokens, one table swapped.

**At 390px in daylight.** The strongest of the three. A hard 1px value step is the last thing
ambient light destroys, and the edge light at 3.53:1 against the slab is well clear of where
detail starts disappearing.

**What it costs.** 57.1 KB fonts, zero JS, two inset box-shadows. **The real cost is tone.** This
is a precise, industrial, cold register, and `PRODUCT.md` asks for copy that is warm, literal and
spare. A machined interface saying "Park it. Go back." is a tension that has to be managed in every
screen rather than solved once.

**The four moments.** At rest one lit top edge on a dark slab. On focus the edge turns accent and
a 2px bar lights the leading edge. On commit every edge light goes out and the slab seats flush
with the ground, which is the most literal "it has been absorbed" of the three. After, the edge
relights at rest level. **Reduced motion:** the edges switch rather than transition. All four
states remain distinct because they were always static properties.

---

### Direction C: Depth Field

**Thesis.** Not a surface at all, but a space with things at different distances in it. The capture
field is the near plane. The log sits further back, the navigation further still, and each plane is
flatter, smaller and narrower than the one in front of it, the way real distance works. There is no
shadow, no edge, no light and no blur. The depth is entirely optical.

**The depth mechanism.** Three things moving together, all of them free to paint: **contrast
compression** (a far plane's ink is closer in value to its ground), **scale** (each plane is a few
per cent smaller), and **type width**. Hierarchy is distance from the viewer.

**Type.** Anybody, width axis 75 to 125 and weight 300 to 800, plus DM Mono. **70.0 KB**, the most
expensive of the three, and the axis is the reason. **Width is the z-axis.** Near type is wide at
`wdth 108` to `118`; the middle plane is `92`; the far plane is `85`. The variable axis is not
styling, it is the depth cue, and it moves in lockstep with contrast and scale so the three read as
one effect. This is the strongest design-systems argument in the set: a variable font axis carrying
semantic meaning rather than decoration is the kind of thing a practice gets to point at.

**Palette.** Ground `#0a0b0e`, near plane `#1a1c21`, mid plane `#121419`. Near ink `#f5f6f8` at
18.20:1, mid ink `#9ca3ae` at 7.74:1, far ink `#616873` at 3.50:1, accent `#8b7bff` at 5.97:1.

The far ink deliberately sits at 3.50:1, which is below AA for body text. That is correct and it
is load-bearing: **the far plane never carries text you are meant to read.** It holds peek items
and the nav, and anything promoted to readable moves forward a plane and gains contrast with it.
Legibility and depth are the same control, which is the neatest property this direction has.

**Grounds.** Inverts, with one caveat. On a light ground atmospheric perspective runs the other
way, so far planes go *lighter* rather than darker, and the accent has to darken to hold 4.5:1.
Mechanically it is the same three controls.

**At 390px in daylight.** Middling. Scale and width survive ambient light completely; contrast
compression is the part that suffers, because a washed-out screen compresses everything anyway.
Mitigated by the fact that the near plane is at full contrast by definition.

**What it costs.** 70.0 KB fonts, zero JS, and **no paint effects at all**, which makes it the
cheapest of the three to render on a mid-range Android. The real costs are the font budget and
that it is the quietest at rest, so it is the least impressive in a still screenshot.

**The four moments.** At rest the near plane is at full contrast and full width, which is the
clearest "ready for me" in the set because it is the only thing in focus. On focus the plane comes
closer, scaling to 1.035 with contrast opening. On commit the thought recedes: it translates down,
scales to 0.92, narrows and loses contrast as it joins the mid plane. After, the near plane returns
and the log is one row deeper. **Reduced motion:** the planes do not move. The committed thought is
simply already in the mid plane at mid contrast and mid width. Every question is still answered,
because all three controls are static properties and none of them was ever motion.

---

### Recommendation: C, Depth Field, with one borrow

Her three words map cleanly onto the three directions, which is the useful way to choose.
**"Dramatic"** is Aperture. **"Sleek"** is Monolith. **"The illusion of depth and space"** is
Depth Field, and that is the one she led with.

Four reasons it should win:

1. **It is the only one where the depth is real.** Aperture simulates depth with a glow and
   Monolith simulates it with a bevel. Depth Field places things at distances and renders them
   the way distance actually looks. That is a stronger idea to build a system on and a much
   stronger one to publish.
2. **The width axis is the most original thing in the set.** A variable font axis carrying the
   z-axis is a design-systems argument, not a style, and this repo is the public artefact for a
   design-systems practice.
3. **Legibility and depth are the same control**, so the accessibility story is structural rather
   than bolted on. Anything you are meant to read is near, and near means high contrast, by
   construction.
4. **Cheapest to paint.** No gradient, no shadow, no filter. On the mid-range Android this installs
   to, the commit frame has nothing expensive in it.

Against it, honestly: 70 KB is the highest font cost of the three, and it is the quietest at rest.

**The borrow: take Aperture's light, for the commit moment only.** Depth Field is deliberately
calm at rest, which is right for a capture screen an ND user opens mid-hijack, and it leaves the
commit under-dramatised. Adding a brief light event at the handover puts the drama exactly where
the brief already says the budget goes, and nowhere else. Quiet at rest, dramatic at the handover,
gone in 420ms.

**Take nothing from Monolith.** Its edge light would fight the no-edges premise, and mixing the
two would leave a system with two competing depth mechanisms, which is how design systems rot.

**If one is close but not right**, the mechanisms are separable and worth saying out loud: Monolith's
edge relief on Depth Field's planes is coherent, and so is Aperture's light with Monolith's
precision. What is not coherent is all three at once.


## 4. Token specification

### 4.1 Layers

```
  src/tokens/tokens.json                  DTCG, hand-authored, the source of truth
        │
        │  node scripts/build-tokens.mjs
        ▼
  src/styles/tokens.generated.css         committed. the only file containing hex.
        │        --tl-ref-*   primitives      (never read by a component)
        │        --tl-*       semantics       (the only thing a component reads)
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
  src/index.css  @theme                components, inline styles
        --color-ground: var(--tl-ground)     var(--tl-ink), var(--tl-well-floor)
        │
        ▼
  Tailwind utilities: bg-ground, text-ink, border-rule
```

Two layers, one rule. **Primitives are raw values with no opinion. Semantics are roles that reference
primitives. Components read semantics only.** A component that reads `--tl-ref-*` or a hex literal
has reached past the system, and section 4.7 is the check that catches it.

Naming, so it is greppable:

| Layer | JSON path | CSS custom property |
|---|---|---|
| Primitive | `color.stock.50` | `--tl-ref-color-stock-50` |
| Primitive | `motion.spring.commit` | `--tl-ref-motion-spring-commit-*` |
| Semantic | `semantic.ground` | `--tl-ground` |
| Semantic | `semantic.well-floor-focus` | `--tl-well-floor-focus` |

The emit rule is mechanical: primitives get `--tl-ref-` plus the dotted path joined by hyphens;
semantics get `--tl-` plus the path with the leading `semantic.` stripped.

### 4.2 `src/tokens/tokens.json`

DTCG format, `$value` / `$type` / `$description`.

**These values are Direction C, Depth Field**, the recommendation. If Jen picks Aperture or
Monolith instead, the `color`, `type` and `elevation` primitives swap wholesale and everything else
in this section stands unchanged, which is the point of the two-layer split. The semantic role names
were chosen so they survive that swap: `near`, `mid`, `far` describe distance, not a specific
palette, and they read sensibly under any of the three directions.

Every colour was contrast-checked before it went in, and the ratio lives in the token's own
`$description` so it travels with the value instead of sitting in a document nobody rereads.

```jsonc
{
  "$schema": "https://tr.designtokens.org/format/",

  // ─── PRIMITIVE ─────────────────────────────────────────────────────────
  // Raw values. No component may read these.

  "color": {
    "$type": "color",
    "plane": {
      "ground": { "$value": "#0a0b0e", "$description": "Deep space. Everything is measured from here." },
      "far":    { "$value": "#0d0e11", "$description": "Furthest plane. Navigation, ambient chrome." },
      "mid":    { "$value": "#121419", "$description": "Middle distance. The log, parked thoughts." },
      "near":   { "$value": "#1a1c21", "$description": "Near plane. The capture field lives here." },
      "nearer": { "$value": "#1f2229", "$description": "Near plane, focused. One step closer." }
    },
    "ink": {
      "near": { "$value": "#f5f6f8", "$description": "18.20:1 on ground. Anything you are meant to read." },
      "mid":  { "$value": "#9ca3ae", "$description": "7.74:1 on ground, 7.25:1 on plane.mid." },
      "far":  { "$value": "#616873", "$description": "3.50:1. NON-TEXT ONLY. Clears WCAG 1.4.11, fails AA for body copy, deliberately. Text promoted to readable moves forward a plane." },
      "placeholder": { "$value": "#8b919c", "$description": "6.21:1 on ground." }
    },
    "accent": {
      "base": { "$value": "#8b7bff", "$description": "5.97:1 on ground; ground on it is 5.97:1. Appears on the near plane only, so colour itself encodes distance." },
      "high": { "$value": "#a99cff", "$description": "8.33:1 on ground. Focus bar and confirm." }
    },
    "bucket": {
      "now":    { "$value": "#ff9e7a", "$description": "9.77:1 on ground." },
      "later":  { "$value": "#e0c06a", "$description": "11.17:1 on ground." },
      "wonder": { "$value": "#b8a6ff", "$description": "9.31:1 on ground." },
      "do":     { "$value": "#6fd9a8", "$description": "11.40:1 on ground." },
      "drop":   { "$value": "#616873", "$description": "3.50:1. Marker only, never the sole carrier of a state." },
      "write":  { "$value": "#7ac4e8", "$description": "Reserved for ROADMAP Phase 8. 9.86:1 on ground." }
    },
    "danger": { "$value": "#ef8a76", "$description": "8.44:1 on ground. Destructive only, never a triage bucket." },

    // Light mode. Atmospheric perspective runs the other way: far planes go
    // LIGHTER, and the accent darkens to hold 4.5:1.
    "light": {
      "ground": { "$value": "#eceef2" },
      "far":    { "$value": "#e6e8ed" },
      "mid":    { "$value": "#f2f3f6" },
      "near":   { "$value": "#fbfbfd" },
      "ink":    { "$value": "#14161a", "$description": "15.82:1 on light ground." },
      "ink-mid":{ "$value": "#4d535d", "$description": "7.41:1." },
      "ink-far":{ "$value": "#878d97", "$description": "3.12:1. Non-text only, same rule as dark." },
      "accent": { "$value": "#4a35d6", "$description": "7.93:1 on light ground." }
    }
  },

  "space": {
    "$type": "dimension",
    "base":   { "$value": "0.25rem", "$description": "Tailwind v4 derives the whole scale from this. See CLAUDE.md: never partially override --spacing-N." },
    "gutter": { "$value": "1.125rem", "$description": "Page inset at 390px." },
    "plane":  { "$value": "0.75rem",  "$description": "Inner padding of a plane." }
  },

  "type": {
    "font": {
      "$type": "fontFamily",
      "display": { "$value": ["Anybody", "system-ui", "sans-serif"], "$description": "Variable, wdth 75-125 + wght 300-800. Self-hosted, 55.5 KB latin subset." },
      "body":    { "$value": ["Anybody", "system-ui", "sans-serif"], "$description": "Same file. One voice; width carries the depth, not family." },
      "data":    { "$value": ["DM Mono", "ui-monospace", "monospace"], "$description": "Self-hosted, 14.5 KB. Counts, timestamps, durations." }
    },
    "width": {
      "$type": "number",
      "$description": "THE DEPTH CUE. Moves in lockstep with plane and contrast; never set independently.",
      "near":   { "$value": 108, "$description": "Capture input, readable body." },
      "display":{ "$value": 118, "$description": "Screen headline and Patterns numerals." },
      "mid":    { "$value": 92,  "$description": "The log, secondary copy." },
      "far":    { "$value": 85,  "$description": "Peek items, chips at rest, navigation." }
    },
    "size": {
      "$type": "dimension",
      "xs":   { "$value": "0.75rem",  "$description": "Chips, mono readouts. 12px." },
      "sm":   { "$value": "0.875rem" },
      "base": { "$value": "1rem" },
      "lg":   { "$value": "1.125rem", "$description": "Capture input. Never below this." },
      "xl":   { "$value": "1.5rem" },
      "2xl":  { "$value": "1.875rem", "$description": "Screen headline at 390px." },
      "3xl":  { "$value": "3rem",     "$description": "Patterns numerals." }
    },
    "weight": {
      "$type": "fontWeight",
      "light":   { "$value": 300, "$description": "Far plane only." },
      "regular": { "$value": 400 },
      "medium":  { "$value": 500 },
      "bold":    { "$value": 700, "$description": "Display and the one action per screen." }
    }
  },

  "motion": {
    "spring": {
      "$type": "cubicBezier",
      "$description": "Named for the moment in the arc, never for the shape. Each carries its reduced-motion counterpart. linear() values are emitted by scripts/build-tokens.mjs.",
      "focus": {
        "$value": { "stiffness": 900, "damping": 60, "mass": 1 },
        "$description": "Is it listening? Zeta 1.000, 230ms, no overshoot. Certainty, not personality.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "commit": {
        "$value": { "stiffness": 480, "damping": 34, "mass": 1.1 },
        "$description": "Did it take it? Zeta 0.740, 320ms, 3.2% overshoot. The only token allowed to overshoot. Mass above 1 on purpose: a thought handed over should have weight.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "settle": {
        "$value": { "stiffness": 620, "damping": 50, "mass": 1 },
        "$description": "Can I go now? Zeta 1.004, 270ms. Starts at +120ms so it overlaps commit; total arc 420ms.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      },
      "dismiss": {
        "$value": { "stiffness": 1200, "damping": 70, "mass": 1 },
        "$description": "Leaving without ceremony: chip deselect, error clear, triage card exit. Zeta 1.010, 200ms.",
        "$extensions": { "tetherlog.reducedMotion": { "duration": "1ms", "easing": "linear" } }
      }
    },
    "duration": {
      "$type": "duration",
      "instant": { "$value": "1ms",   "$description": "The reduced-motion value for everything." },
      "confirm": { "$value": "600ms", "$description": "How long the confirm word holds under full motion." },
      "confirm-reduced": { "$value": "1200ms", "$description": "Longer under reduced motion: the word carries more of the answer." }
    },
    "easing": {
      "$type": "cubicBezier",
      "standard": { "$value": [0.2, 0, 0, 1], "$description": "Non-spring transitions: colour, opacity off the arc." }
    }
  },

  "elevation": {
    "$type": "number",
    "$description": "There are no shadows in this system. Depth is scale, and it moves with type.width and plane colour as one effect. Numbers are transform scale factors.",
    "near-rest":  { "$value": 1,     "$description": "The near plane at rest." },
    "near-focus": { "$value": 1.035, "$description": "One step closer on focus." },
    "recede":     { "$value": 0.92,  "$description": "Where a committed thought lands." },
    "mid":        { "$value": 0.965, "$description": "Second row of the log." },
    "far":        { "$value": 0.93,  "$description": "Third row and beyond." },
    "commit-light": {
      "$value": 0.22,
      "$description": "BORROWED FROM APERTURE. Peak alpha of the one light event in the system, at the handover. Radial, centred on the field, 320ms, nowhere else in the app."
    }
  },

  // ─── SEMANTIC ──────────────────────────────────────────────────────────
  // Roles. Components read ONLY these. Names describe distance, not palette,
  // so they survive a direction change.

  "semantic": {
    "ground":           { "$value": "{color.plane.ground}", "$type": "color" },
    "plane-near":       { "$value": "{color.plane.near}",   "$type": "color" },
    "plane-near-focus": { "$value": "{color.plane.nearer}", "$type": "color" },
    "plane-mid":        { "$value": "{color.plane.mid}",    "$type": "color" },
    "plane-far":        { "$value": "{color.plane.far}",    "$type": "color" },
    "ink":              { "$value": "{color.ink.near}",     "$type": "color", "$description": "Anything the user must read." },
    "ink-mid":          { "$value": "{color.ink.mid}",      "$type": "color" },
    "ink-far":          { "$value": "{color.ink.far}",      "$type": "color", "$description": "Non-text only. 3.50:1." },
    "ink-placeholder":  { "$value": "{color.ink.placeholder}", "$type": "color" },
    "mark":             { "$value": "{color.accent.base}",  "$type": "color" },
    "mark-high":        { "$value": "{color.accent.high}",  "$type": "color" },
    "on-mark":          { "$value": "{color.plane.ground}", "$type": "color" },
    "focus-bar":        { "$value": "{color.accent.high}",  "$type": "color", "$description": "2px leading edge, 8.33:1. The focus indicator. Scale and width changes are NOT a focus indicator." },
    "bucket-now":       { "$value": "{color.bucket.now}",    "$type": "color" },
    "bucket-later":     { "$value": "{color.bucket.later}",  "$type": "color" },
    "bucket-wonder":    { "$value": "{color.bucket.wonder}", "$type": "color" },
    "bucket-do":        { "$value": "{color.bucket.do}",     "$type": "color" },
    "bucket-drop":      { "$value": "{color.bucket.drop}",   "$type": "color" },
    "danger":           { "$value": "{color.danger}",        "$type": "color" }
  }
}
```

**The one rule that keeps this direction honest.** `plane`, `type.width` and `ink` move together or
not at all. A component that changes the plane colour without changing the width has broken the
illusion, and it will look like a bug nobody can name. The build-time check in 4.7 cannot catch it,
so it is written into `CLAUDE.md` as a rule and into the components as a single `Plane` primitive
that sets all three from one `distance` prop.

Dark mode is the same semantic names re-pointed at `color.dark.*` under a `[data-theme="dark"]`
block. The semantic layer is what makes that a table in the generator rather than a second design.

### 4.3 Motion tokens are values

The four springs, solved and measured this session. Damping ratio ζ, settle time at a rest threshold
of 1%, peak value, and the byte cost of the emitted `linear()` string:

| Token | stiffness | damping | mass | ζ | duration | overshoot | CSS bytes |
|---|---|---|---|---|---|---|---|
| `motion.spring.focus` | 900 | 60 | 1 | 1.000 | 230ms | 0% | 191 |
| `motion.spring.commit` | 480 | 34 | 1.1 | 0.740 | **320ms** | **3.2%** | 260 |
| `motion.spring.settle` | 620 | 50 | 1 | 1.004 | 270ms | 0% | 223 |
| `motion.spring.dismiss` | 1200 | 70 | 1 | 1.010 | 200ms | 0% | 166 |

840 bytes of CSS for the whole motion system before gzip. `commit` is the only one that overshoots,
which is the point: it is the one moment with a budget.

Emitted for each token, with the duration and the curve generated together from the same solve so
they cannot drift apart:

```css
--tl-spring-commit-duration: 320ms;
--tl-spring-commit-ease: linear(0, 0.0197, 0.0708, 0.143, 0.2281, 0.3195, 0.412, 0.5019,
  0.5865, 0.6641, 0.7336, 0.7946, 0.8471, 0.8913, 0.9279, 0.9574, 0.9807, 0.9985, 1.0116,
  1.0208, 1.0268, 1.0302, 1.0315, 1.0313, 1.03, 1.0279, 1.0254, 1.0225, 1.0196, 1.0167,
  1.014, 1.0115, 1);
```

And the reduced-motion counterpart, in the same generated file, from the same token entry:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --tl-spring-focus-duration: 1ms;   --tl-spring-focus-ease: linear;
    --tl-spring-commit-duration: 1ms;  --tl-spring-commit-ease: linear;
    --tl-spring-settle-duration: 1ms;  --tl-spring-settle-ease: linear;
    --tl-spring-dismiss-duration: 1ms; --tl-spring-dismiss-ease: linear;
    --tl-duration-confirm: 1200ms;
  }
}
```

Every motion token ships its reduced-motion counterpart from the same entry, which is what makes the
contract structural rather than a habit.

**Browser support.** CSS `linear()` easing: Chrome 113, Firefox 112, Safari 17.2, with Chrome Android,
Safari iOS and Samsung Internet mirroring their desktop versions. Source: MDN browser-compat-data,
`css/types/easing-function.json`, read this session. The target device in `PRODUCT.md` is Android
Chrome, where this has been available since May 2023. Older engines fall back to the browser default
easing over the same duration, which is a slightly different curve and not a broken interface.

### 4.4 The generator

`scripts/build-tokens.mjs`, run by `npm run tokens`. No dependencies.

The spring solver is the analytic damped-harmonic solution, about 30 lines. It was verified in this
session against `motion@13.4.0`'s own generator (`createGeneratorEasing` + `generateLinearEasing`) and
agrees to within **0.025 absolute across the whole curve**, which is visually identical. Writing it
out rather than taking the dependency is deliberate: `motion` would be 756 KB unpacked in
`node_modules` to produce four strings at build time, and `generateLinearEasing` is not headline API,
so a minor release could move it.

```js
#!/usr/bin/env node
// Reads src/tokens/tokens.json (DTCG) and writes src/styles/tokens.generated.css.
// Run: npm run tokens        Verify: npm run tokens:check

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SRC = "src/tokens/tokens.json";
const OUT = "src/styles/tokens.generated.css";
const REST_DELTA = 0.01;      // 1%: imperceptible on a 3px shadow or a 200px slide
const SAMPLE_MS  = 10;        // one linear() stop per 10ms

// ── spring ───────────────────────────────────────────────────────────────
// Analytic solution, 0 -> 1, initial velocity 0. Verified against motion@13.4.0
// to within 0.025 absolute across the curve.
function springAt(t, { stiffness: k, damping: c, mass: m }) {
  const w0 = Math.sqrt(k / m);
  const z  = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (Math.abs(z - 1) < 1e-9) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const r = w0 * Math.sqrt(z * z - 1);
  const a = -c / (2 * m) + r, b = -c / (2 * m) - r;
  return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
}

function springDurationMs(cfg) {
  for (let ms = 10; ms <= 4000; ms += 10) {
    const settled = (x) => Math.abs(1 - springAt(x / 1000, cfg)) < REST_DELTA;
    if (settled(ms) && settled(ms + 30)) return ms;   // +30ms guards a zero crossing
  }
  throw new Error(`Spring never settles: ${JSON.stringify(cfg)}`);
}

function linearEasing(cfg, ms) {
  const n = Math.max(2, Math.round(ms / SAMPLE_MS));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(Number(springAt((i / n) * (ms / 1000), cfg).toFixed(4)));
  pts[n] = 1;   // error bounded by REST_DELTA, so this snap is <=1% over the last 10ms
  return `linear(${pts.join(", ")})`;
}

// ── DTCG walk ────────────────────────────────────────────────────────────
const doc = JSON.parse(readFileSync(SRC, "utf8"));
const flat = new Map();                       // "color.stock.50" -> token node

(function walk(node, path) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const next = path ? `${path}.${key}` : key;
    if (child && typeof child === "object" && "$value" in child) flat.set(next, child);
    else if (child && typeof child === "object") walk(child, next);
  }
})(doc, "");

const isAlias = (v) => typeof v === "string" && v.startsWith("{") && v.endsWith("}");
function resolve(value, seen = new Set()) {
  if (!isAlias(value)) return value;
  const ref = value.slice(1, -1);
  if (seen.has(ref)) throw new Error(`Circular alias: ${ref}`);
  const target = flat.get(ref);
  if (!target) throw new Error(`Unknown alias: ${value}`);
  return resolve(target.$value, new Set(seen).add(ref));
}

const cssName = (p) =>
  p.startsWith("semantic.") ? `--tl-${p.slice(9).replace(/\./g, "-")}`
                            : `--tl-ref-${p.replace(/\./g, "-")}`;

// ── emit ─────────────────────────────────────────────────────────────────
const root = [], reduced = [];

for (const [path, token] of flat) {
  if (path.startsWith("motion.spring.")) {
    const name = path.split(".")[2];
    const ms = springDurationMs(token.$value);
    root.push(`  --tl-spring-${name}-duration: ${ms}ms;`);
    root.push(`  --tl-spring-${name}-ease: ${linearEasing(token.$value, ms)};`);
    const rm = token.$extensions?.["tetherlog.reducedMotion"];
    if (!rm) throw new Error(`Spring ${path} has no reduced-motion counterpart.`);
    reduced.push(`    --tl-spring-${name}-duration: ${rm.duration};`);
    reduced.push(`    --tl-spring-${name}-ease: ${rm.easing};`);
    continue;
  }

  const v = resolve(token.$value);

  if (token.$type === "shadow") {
    const parts = (Array.isArray(v) ? v : [v]).map((s) =>
      [s.inset ? "inset" : "", s.offsetX, s.offsetY, s.blur, s.spread, resolve(s.color)]
        .filter(Boolean).join(" "));
    root.push(`  ${cssName(path)}: ${parts.length ? parts.join(", ") : "none"};`);
    continue;
  }
  if (Array.isArray(v) && token.$type === "fontFamily") {
    root.push(`  ${cssName(path)}: ${v.map((f) => (/\s/.test(f) ? `'${f}'` : f)).join(", ")};`);
    continue;
  }
  if (Array.isArray(v) && token.$type === "cubicBezier") {
    root.push(`  ${cssName(path)}: cubic-bezier(${v.join(", ")});`);
    continue;
  }
  root.push(`  ${cssName(path)}: ${v};`);
}

// Dark mode: the same semantic names, re-pointed. One table, not a second design.
// Light mode: the same semantic names re-pointed. Atmospheric perspective
// inverts, so far planes go lighter rather than darker. One table, not a
// second design. Emitted under [data-theme='light'] because dark is the base.
const LIGHT = {
  "--tl-ground": "color.light.ground",     "--tl-plane-near": "color.light.near",
  "--tl-plane-near-focus": "color.light.near", "--tl-plane-mid": "color.light.mid",
  "--tl-plane-far": "color.light.far",     "--tl-ink": "color.light.ink",
  "--tl-ink-mid": "color.light.ink-mid",   "--tl-ink-far": "color.light.ink-far",
  "--tl-mark": "color.light.accent",       "--tl-focus-bar": "color.light.accent",
  "--tl-on-mark": "color.light.near",
};

const out = `/**
 * GENERATED FROM src/tokens/tokens.json. DO NOT EDIT BY HAND.
 * Regenerate: npm run tokens
 * Verify in CI/build: npm run tokens:check
 *
 * This is the only file in the repo that may contain a colour literal.
 * Components read --tl-<role>. Never --tl-ref-*. Never hex. See CLAUDE.md.
 */

:root {
${root.join("\n")}
}

[data-theme='light'] {
${Object.entries(LIGHT).map(([n, p]) => `  ${n}: ${resolve(flat.get(p).$value)};`).join("\n")}
}

@media (prefers-reduced-motion: reduce) {
  :root {
${reduced.join("\n")}
    --tl-duration-confirm: var(--tl-ref-motion-duration-confirm-reduced);
  }
}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`✓ ${OUT} — ${flat.size} tokens`);
```

**Where it runs, and why that choice.**

**Committed to git, regenerated by hand, verified on every build.** Not `prebuild`.

The reason is specific to this repo. `f1416d2` exists because a build step that passed locally failed
on Vercel, and the failure was silent from here. Every step added between `git push` and a rendered
page is another chance to repeat that. A committed CSS file cannot fail to generate on a machine that
never runs the generator.

The second reason is that it is the right artefact. A token change should show up as a reviewable
diff of actual CSS values. That is the visible record of a design decision, and `prebuild` hides it.

Drift is the obvious objection, and it is closed by making the build fail rather than by trusting
anyone to remember:

```jsonc
// package.json
"scripts": {
  "tokens":       "node scripts/build-tokens.mjs",
  "tokens:check": "bash scripts/check-tokens.sh",
  "build":        "npm run tokens:check && tsc -b && vite build"
}
```

```bash
#!/usr/bin/env bash
# scripts/check-tokens.sh
# 1. tokens.generated.css matches tokens.json
# 2. no component has reached past the semantic layer
set -uo pipefail
fail=0

tmp="$(mktemp -d)"
cp src/styles/tokens.generated.css "$tmp/committed.css"
node scripts/build-tokens.mjs >/dev/null
if ! diff -q "$tmp/committed.css" src/styles/tokens.generated.css >/dev/null; then
  echo "✗ tokens.generated.css is stale. Run: npm run tokens" >&2
  diff -u "$tmp/committed.css" src/styles/tokens.generated.css | head -40 >&2
  cp "$tmp/committed.css" src/styles/tokens.generated.css   # leave the tree as found
  fail=1
fi
rm -rf "$tmp"

hex=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' src \
      --include='*.ts' --include='*.tsx' --include='*.css' \
      | grep -v 'src/styles/tokens.generated.css' || true)
if [ -n "$hex" ]; then
  echo "✗ colour literal outside the generated token file:" >&2
  echo "$hex" >&2; fail=1
fi

prim=$(grep -rn -- '--tl-ref-' src \
       --include='*.ts' --include='*.tsx' --include='*.css' \
       | grep -v 'src/styles/tokens.generated.css' || true)
if [ -n "$prim" ]; then
  echo "✗ primitive token read outside the generated file. Components read --tl-<role>:" >&2
  echo "$prim" >&2; fail=1
fi

[ "$fail" -eq 0 ] && echo "✓ tokens in sync, no primitive or literal leaks"
exit "$fail"
```

Because it runs inside `build`, it fails identically on this machine and on Vercel, with no network
and no sibling repository. That is the property `f1416d2` was reaching for.

### 4.5 `@theme` mapping

`src/index.css` after step 4. `@theme` is the only place semantics become Tailwind utilities, so this
table is the contract between the token system and every `className` in the app.

```css
@import "tailwindcss";
@import "./styles/tokens.generated.css";

@theme {
  /* colour: semantic token -> utility */
  --color-ground:      var(--tl-ground);            /* bg-ground */
  --color-near:        var(--tl-plane-near);        /* bg-near */
  --color-near-focus:  var(--tl-plane-near-focus);  /* bg-near-focus */
  --color-mid:         var(--tl-plane-mid);         /* bg-mid */
  --color-far:         var(--tl-plane-far);         /* bg-far */
  --color-ink:         var(--tl-ink);               /* text-ink */
  --color-ink-mid:     var(--tl-ink-mid);           /* text-ink-mid */
  --color-ink-far:     var(--tl-ink-far);           /* text-ink-far, non-text only */
  --color-placeholder: var(--tl-ink-placeholder);   /* placeholder:text-placeholder */
  --color-mark:        var(--tl-mark);              /* bg-mark, text-mark */
  --color-on-mark:     var(--tl-on-mark);           /* text-on-mark */
  --color-now:         var(--tl-bucket-now);
  --color-later:       var(--tl-bucket-later);
  --color-wonder:      var(--tl-bucket-wonder);
  --color-do:          var(--tl-bucket-do);
  --color-drop:        var(--tl-bucket-drop);

  /* type */
  --font-display: var(--tl-ref-type-font-display);
  --font-sans:    var(--tl-ref-type-font-body);
  --font-mono:    var(--tl-ref-type-font-data);
  --text-lg:  var(--tl-ref-type-size-lg);
  --text-2xl: var(--tl-ref-type-size-2xl);
  --text-3xl: var(--tl-ref-type-size-3xl);

  /* spacing: the single base. See CLAUDE.md, never a partial --spacing-N override. */
  --spacing: var(--tl-ref-space-base);

  /* No shadow namespaces. This system has no shadows: depth is scale, applied
     as a transform by the Plane component, never as a Tailwind utility. */

  /* motion */
  --ease-focus:   var(--tl-spring-focus-ease);
  --ease-commit:  var(--tl-spring-commit-ease);
  --ease-settle:  var(--tl-spring-settle-ease);
  --ease-dismiss: var(--tl-spring-dismiss-ease);

  --radius-none: 0px;
}
```

`@theme` is the one sanctioned place a `--tl-ref-*` name appears outside the generated file, because
`--font-*`, `--text-*`, `--spacing` and the shadow namespaces need a value and there is no useful role
name for "the body typeface". `scripts/check-tokens.sh` exempts `src/index.css` from the primitive
check for exactly this reason and nothing else.

Verified against `tailwindcss@4.3.3`: `--color`, `--font`, `--text`, `--spacing`, `--radius`, `--ease`,
`--animate`, `--shadow`, `--inset-shadow`, `--tracking`, `--leading`, `--breakpoint` and `--container`
are theme namespaces. **`--duration-*` is not**, which is why the old `--duration-file: 700ms` never
produced a utility. Durations are read as `var(--tl-spring-*-duration)` in a style attribute or a
component class, not as a Tailwind utility.

### 4.6 Motion implementation: build-time `linear()`, zero runtime

**Budget: JS ≤ 130 KB gzipped, CSS ≤ 12 KB gzipped, fonts ≤ 90 KB transfer.**

Baseline at `f1416d2`, measured by `npm run build`: **114.67 KB JS gz, 6.55 KB CSS gz**. The budget
leaves about 15 KB of JS headroom for the entire overhaul. This is an installable PWA that a person
opens to park one thought, on Android, possibly on mobile data.

Options, with sizes measured in this session by bundling each entry point with esbuild, minified,
React marked external, so the number is the marginal cost of the library and nothing else:

| Option | Measured gz | Verdict |
|---|---|---|
| `motion/react` full (`motion`, `useAnimate`) | **46.1 KB** | 3.1× the entire budget headroom. No. |
| `LazyMotion` + `domAnimation` + `m` | **28.0 KB** | Still 1.9× the headroom, and it buys a runtime we do not need. No. |
| `motion/mini` `animate` (WAAPI-backed) | **3.9 KB** | Affordable. Held in reserve, see below. |
| Hand-rolled rAF spring hook | ~1 KB | Real cost is maintenance, not bytes. Held in reserve. |
| **Build-time `linear()`, generated into CSS** | **0 KB** | **Chosen.** |

For reference, bundlephobia reports `motion@13.4.0` at 47.7 KB gz for a full import, which agrees
with the 46.1 KB measured here.

**Why zero runtime is not a compromise.** The four springs are fixed design tokens, not behaviour. A
runtime solver earns its bytes when a spring has to start from an arbitrary position *and velocity*,
which is what a drag release needs. Nothing in the four moments is a drag release. Every transition
here starts from rest or from a known state, and CSS transitions with a generated `linear()` easing
are deterministic, run on the compositor, and are interruptible without a queue.

**What happens on interruption, precisely.** A CSS transition interrupted mid-flight restarts from
the current computed value over the full duration. It does not carry velocity. For this app that is
correct rather than merely acceptable, because of how the commit is structured:

- The **commit animation runs on a transient element keyed by capture id**. Two parks in quick
  succession mount two independent elements. Neither waits for the other.
- The **field is cleared and refocused synchronously**, before any animation exists. Readiness is
  never a function of motion, so there is nothing for a second park to queue behind.
- **Cap at two in flight.** A third mounts and the oldest unmounts immediately without animating, so
  fast repeated parks degrade to "instantly done" rather than to a pile-up.
- The field's own depth is the one shared, interruptible property. Focus during a settle re-eases
  from wherever the floor is. The easing discontinuity is invisible; a queue would not be.

**When to revisit.** One trigger, written down so it is a decision and not a drift: **if swipe-to-
triage lands on Review** (`PRODUCT.md` mentions it), that gesture needs velocity handoff from a drag,
and at that point the ~1 KB hand-rolled hook earns its place for that one interaction. `motion/mini`
at 3.9 KB is the fallback if the hook turns out to be more than a hook. Nothing else reopens this.

### 4.7 Agent contract

The rules a future build session follows. They are in `CLAUDE.md` too, because that is the file that
gets read before the code is touched.

1. **Components read semantic tokens only.** `var(--tl-ink)`, never `var(--tl-ref-color-ink-900)`,
   never `#17150f`.
2. **The only file that may contain a colour literal is `src/styles/tokens.generated.css`**, and it
   is generated, so nobody writes one by hand.
3. **`src/index.css` is the one exemption**, for `@theme` only, because Tailwind namespaces need raw
   values where no role name exists.
4. **A new colour means a new token.** Add the primitive, add the semantic role, regenerate, then use
   it. Three steps, in that order, no shortcuts.
5. **Every motion token carries its reduced-motion counterpart in the same entry.** The generator
   throws if one is missing, so the contract is enforced rather than remembered.
6. **Plane, width and ink move together or not at all.** A component that changes
   `--tl-plane-*` without changing `type.width` and the ink role has broken the depth illusion, and
   it will look like a bug nobody can name. Use the `Plane` primitive with its `distance` prop; do
   not set the three by hand. No automated check catches this, which is why it is a rule.
7. **`--tl-ink-far` is non-text only.** It is 3.50:1. It clears WCAG 1.4.11 for non-text and fails AA
   for body copy, deliberately. Anything the user must read moves forward a plane and gains contrast
   with it.
8. **Scale and width are never a focus indicator.** Focus is `--tl-focus-bar` at 8.33:1, always.
9. **Never animate `font-variation-settings`.** Width steps between token values at the transition
   boundary. Animating a variable axis forces a text relayout every frame.

**The check, and where it runs.** Two layers, both in the repo, both failing the build.

*Shell*, covering CSS and TypeScript together: `scripts/check-tokens.sh` above, wired into
`npm run build` so it runs locally and on Vercel identically.

*ESLint*, for a message at the point of the mistake rather than at build time. Appended to
`eslint.config.js`:

```js
{
  files: ["src/components/**/*.{ts,tsx}", "src/views/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": ["error",
      { selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
        message: "Colour literal. Components read semantic tokens: var(--tl-<role>). See CLAUDE.md." },
      { selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
        message: "Colour literal in a template literal. Use var(--tl-<role>)." },
      { selector: "Literal[value=/--tl-ref-/]",
        message: "Primitive token. Components read semantic roles only. See CLAUDE.md." },
      { selector: "TemplateElement[value.raw=/--tl-ref-/]",
        message: "Primitive token in a template literal. Use a semantic role." },
      { selector: "Literal[value=/--nil-/]",
        message: "NIL DS is removed. Use var(--tl-<role>)." }
    ]
  }
}
```

The ESLint rules catch the common case in the editor. The shell script is the backstop, because
ESLint does not read CSS and the build is the thing that must not pass.

---

## 5. Surface blueprints

Written for the recommended direction. Layout, type roles, elevation mechanism, motion and
reduced-motion behaviour for each surface.

### Capture

The only screen with a motion budget. At 390px the capture field is the only element above the fold.

**Layout.** Single column, `--tl-ref-space-gutter` inset, content vertically centred in the viewport
minus the nav. Order: headline, sub-line, the near plane holding the field, tag chips, Park, Mic, the parked-today
count, the peek stack. Max content width `32rem` on desktop, left-aligned rather than centred,
because a centred single field on a 1280px screen reads as a search engine.

**Type roles.** Headline `--font-display` at `--text-2xl`, weight 500. Sub-line `--font-sans` at
`--text-sm` in `--tl-ink-secondary`. The input `--font-sans` at `--text-lg`, which is the floor: the
capture field never goes below 18px, because it is the one place a person types while distracted.
Chips `--font-mono` at `--text-xs`, uppercase, tracked. Count `--font-mono` at `--text-xs`, tabular.

**Elevation.** There are no shadows and no borders. The field sits on `bg-near` at `wdth 108`, full
ink contrast and scale 1. Chips sit on `bg-mid` at `wdth 85` in `text-ink-far`, moving to `wdth 105`
and a bucket fill when selected, so selecting a chip visibly brings it forward. The peek stack is
`bg-mid` at scale 0.965 and 0.93 for successive rows. Park is the only element carrying `bg-mark`,
which is the one place accent appears on this screen.

**The boundary that carries WCAG 1.4.11.** Plane contrast is a depth cue, not an indicator: the near
plane measures 1.15:1 against the ground and is not trying to pass anything. The field is identified
by its placeholder at 6.21:1 and, on focus, by a 2px `--tl-focus-bar` at 8.33:1 on the leading edge.
**Scale and width changes are not a focus indicator** and must never be the only one; that rule is in
the token file and in `CLAUDE.md`, because it is the easiest thing to lose here.

**Motion.**

| State | What moves | Token |
|---|---|---|
| Idle | Nothing. No loop, no pulse, no ambient anything. | — |
| Typing | **Nothing.** No keystroke response of any kind. | — |
| Focus | Plane `bg-near` → `bg-near-focus`, scale 1 → 1.035, focus bar wipes in from the leading edge | `--ease-focus`, 230ms |
| Commit | Plane returns to scale 1. The thought leaves as a transient element, receding: translate down, scale to 0.92, width 108 → 92, ink near → mid. One radial light event peaks at 0.22 alpha and is gone. | `--ease-commit`, 320ms |
| Confirm | "Logged." fades in, holds, fades out. Count increments. | `--tl-duration-confirm`, 600ms |
| Settle | Near plane and light return to rest, starting at +120ms | `--ease-settle`, 270ms |

Depth animates as `transform: scale` and `opacity` only, both compositor properties. Plane background
colour transitions alongside, which is a paint, but on a single element with no children repainting.
`font-variation-settings` is **not** animated: width steps between discrete token values at the
transition boundary, because animating a variable axis forces a text relayout every frame and that is
the one thing the commit frame cannot afford.

**The light event.** Borrowed from Aperture and confined to this moment: a radial gradient centred on
the field, peaking at `elevation.commit-light` = 0.22 alpha, riding the commit spring and gone at
320ms. It exists nowhere else in the app. No ambient glow, no hover light, no focus light.

**Wall clock.** Field usable at **0ms**. Visual arc complete at **420ms** (commit 320ms; settle
starts at 120ms and runs 270ms). Confirm word gone at 600ms and it never blocks anything.

**Reduced motion.** All four values applied at 1ms, and the light event does not fire at all, because
a 320ms flash with no travel is a strobe rather than a cue. The planes still read near → nearer →
near, and the committed thought is simply already in the mid plane at mid contrast and mid width, so
all four questions are answered by state. The parked line appears in the peek stack without travelling,
the count still increments, and "Logged." holds 1200ms instead of 600ms because it is carrying more
of the answer. Nothing is removed that a user needed; the transitions between states are what go.

**Voice.** Recording replaces Park with "Stop and park" and shows elapsed time in the data face,
tabular so the digits do not jitter. The near plane holds its focus state throughout, because the app
is listening. No waveform: a waveform is an ambient animation in the capture path.

### Review

One at a time, and the flow does not change: wins, then triage, then summary, then Hands.

**Layout.** Vertical, one triage card in view at a time with the next peeking at the fold. Wins at the
top as a compact near plane plus Add. Hands at the bottom, `no-print` as now.

**Type roles.** Screen headline `--font-display` `--text-2xl`. The capture's own text is the hero of
each card: `--font-sans` at `--text-lg`, `--tl-ink`. The agent's reason is `--text-sm` in
`--tl-ink-secondary`, deliberately quieter than the thought it is about. Timestamps and voice
durations in `--font-mono` `--text-xs`.

**Elevation.** A triage card sits on the **near plane**, because the one thought you are deciding about
is the nearest thing in the app. Everything else on the screen drops to mid or far. The bucket colour is a 4px bar on the leading edge, which is the
`FileCard` idea with the tone bar doing real work. Confirm is the one `bg-mark` element per card; the
four override chips sit on the mid plane at `wdth 85` until chosen.

**Motion.** A confirmed card leaves on `--ease-dismiss`, 200ms, and the next rises into its place on
`--ease-settle`. Triage is repetitive by design, so the motion is the shortest in the system.

**Reduced motion.** Cards swap without travel. The bucket bar changing colour and the card leaving the
queue is the confirmation.

**Fix while here.** "Carry forward (max one)" currently uses `text-do` at **2.79:1**. It becomes
`--tl-ink` text with a `--tl-bucket-do` marker beside it. Colour stops being the only carrier, which
is right for a colour-coded system regardless of the ratio.

### Patterns

Data at a glance, on ruled ground borrowed from direction B. No axes, no gridlines: the page is the
grid.

**Layout.** Four stat readouts in a 2×2 at 390px and a row of four at 1280px. Then the 24-slot hour
distribution, then repeats, then the digest card.

**Type roles.** This is where the display face does its real work. Numerals in `--font-display` at
`--text-3xl`; labels in `--font-mono` `--text-xs`, uppercase, tracked, `--tl-ink-muted`. The
distribution's hour labels are mono because they must align to a column.

**Elevation.** Readouts are wells with no card around them: the number sits in the page. The ruled
ground handles separation, so there are no card borders anywhere on this screen.

**What may be shown.** Only the ten readouts listed in section 3. No dials, no gauges, no targets, no
change arrows, no day-over-day comparison, and `perDay` rendered as distribution and never as a
sequence. A row of daily bars with gaps in it is a streak display, whatever the heading says.

**Motion.** Bars grow once on mount with `--ease-settle`, staggered by 8ms. That is the one piece of
decorative motion in the app and it is defensible because Patterns is a screen you arrive at
deliberately to read, not one you pass through while distracted.

**Reduced motion.** Bars are drawn at full height. No stagger.

### Settings

The quietest screen. Nothing here needs character; it needs to be unambiguous.

**Layout.** Stacked sections with a rule between them rather than cards. BYOK key, reminder, backup,
Save.

**Type roles.** Section heads `--font-sans` weight 500 `--text-base`. Body copy `--text-sm`
`--tl-ink-secondary`. The BYOK honesty paragraph stays at `--tl-ink` rather than muted, because it is
a promise and muted text reads as fine print.

**Elevation.** Inputs sit on the near plane. Save is the one `bg-mark` element. Section bodies sit on
mid. The Import JSON label currently fakes a button with a border and an inline `--nil-radius-none`;
it becomes a real `Button` with a hidden file input inside it.

**Motion.** Focus only. "Saved." uses the same confirm token as "Logged." so the two agree.

**Reduced motion.** Focus states switch rather than transition. Nothing else moves here anyway.

---

## 6. Phased build roadmap

Each phase is independently shippable and ends with someone looking at a rendered screen. A phase is
not done because the code was written and the build passed.

Every phase ends with **a screenshot at 390px and at 1280px**, checked against that phase's criteria.
Phases marked ● also need **a screen recording of the full arc** (rest, focus, type, Park, back to
rest), **the same recording with `prefers-reduced-motion: reduce`**, and **a double-park** with two
thoughts committed in quick succession.

---

**Phase 1: inline NIL, restore the layout** — ✅ **DONE 2026-09-18**

*Evidence:* build green, no CSS warning, no junk rules. CSS **6.55 → 3.53 KB gzipped**. JS unchanged
at 114.67 KB. Screenshots at 390px and 1280px show the intended change from 1.12 and nothing else.

*Files:* `src/index.css`

*Does:* rip-out steps 1 to 3. The 20 live values inlined under their existing names, NIL imports
deleted, `src/nil-ds/` deleted, `scripts/sync-nil-ds.sh` and its npm script deleted, `DESIGN.md`
`## Hard rules` and `## Token stack` stripped. Plus the three `@source not` directives from 1.6,
because every later phase makes that leak larger.

*Acceptance:*

**Revised 2026-09-18.** This phase was specified as "no visual change". That was wrong, because of
1.12: deleting `core.css` also deletes the unlayered reset, which restores 72 spacing utilities at
once. **Expect a large and entirely intended change.** The check is that the change is the *right*
one.

- At 390px there is now a **16px gutter** on both sides. The headline no longer touches the screen
  edge. This is `px-4` working for the first time.
- At 1280px the app is **centred**, not pinned to the top-left. This is `mx-auto` working for the
  first time.
- Chips, nav and section rhythm all have their intended breathing room.
- Nothing else moved: same colours, same borders, same type, same components. Buttons lose their
  hover and focus ring, which is expected and closes in Phase 5.
- The page gutters at 1280px are still warm grey, not white.
- `grep -rn "nil-ds\|--nil-primitive" src/ scripts/ package.json` returns nothing.
- `npm run build` emits **no CSS warning**, and `dist` contains no `.bg-\[var` rule and none of the
  fourteen prose-leaked utilities from 1.6.
- CSS gzip is smaller than 6.55 KB. It should drop well below it: 826 lines of NIL leave, and so do
  the leaked rules.

---

**Phase 2: the token system, still wearing NIL's colours** — ✅ **DONE 2026-09-18**

*Evidence:* **pixel-identical to Phase 1.** 0 of 1,316,640 pixels differ at 390px and 0 of 1,024,000
at 1280px, measured by decoding both PNGs and comparing RGB per pixel. The phase provably changed
where values come from and not what they are. All five gate tests pass:

| Test | Result |
|---|---|
| `npm run tokens` run twice | byte-identical output |
| Hand-edit `tokens.generated.css`, then build | build fails, "tokens are stale" |
| Run the check | tree unchanged, no side effects |
| Add `#ff0000` to a component | build fails **and** lint flags it |
| Add an unlayered `* { padding: 0 }` | build fails |

Lint problems: **9 before, 9 after**, all pre-existing at `f1416d2`. No regressions introduced.

CSS gzip is 4.66 KB, up from Phase 1's 3.53 KB, because the token layer adds 61 custom properties
including four spring easings that no component reads yet. Still well under the 12 KB budget and
under the 6.55 KB original baseline.

*One thing found and removed:* `src/lib/hands.ts` exported `bucketColour()` with the four bucket
hexes hard-coded, and **had zero callers**. It was a fourth duplicate source of truth for those
hues, after `tokens.json`, the `@theme` block and the `TONE_` maps in `Chip` and `FileCard`. Deleted,
along with its now-unused `TriageBucket` import. `hands.ts` is on the do-not-touch list, so this is
flagged rather than buried: nothing called it, so no export behaviour changed.

*Files:* `src/tokens/tokens.json`, `scripts/build-tokens.mjs`, `scripts/check-tokens.sh`,
`src/styles/tokens.generated.css`, `src/index.css`, `package.json`, `eslint.config.js`

*Does:* the full token system with the **old** values, so the pipeline is proved before the design
changes. `--nil-*` aliases point at `--tl-*` semantics. Checks turned on.

*Acceptance:*
- Screenshots still match phase 1.
- `npm run tokens` is idempotent: running it twice leaves the tree clean.
- Editing a hex in `tokens.generated.css` by hand and running `npm run build` **fails** with "tokens
  are stale".
- Adding `color: "#ff0000"` to any component **fails** `npm run build` and `npm run lint`.
- `src/styles/tokens.generated.css` is the only file under `src/` containing a hex literal.

---

**Phase 3: the new palette and the new type**

*Files:* `src/tokens/tokens.json`, `index.html`, `public/manifest.webmanifest`,
`public/favicon.svg`, `public/fonts/*`

*Does:* the real colours from 4.2, self-hosted subset fonts, PWA chrome corrected, favicon replaced.
Components still structurally as they are, so this phase is a recolour and a retypeset only.

*Acceptance:*
- Every screen is **dark**. Side by side with phase 2 the difference is not subtle.
- Headlines are visibly **wider than the body text**. If they are not, the variable width axis is not
  applying, which is this direction's version of the font that never loaded.
- The near plane is distinguishable from the ground in the 390px screenshot. If the whole screen
  reads as one flat black, the plane values are too close and need opening up.
- No text on any screen fails AA. Check the Park button, "Logged.", and the carry-forward line
  specifically; those are the three that failed before.
- `theme-color` in `index.html`, `theme_color` in the manifest and `--tl-mark` are the same string.
- The favicon at 32px is warm, square-cornered, and recognisably the same product as the app.
- Font transfer on a cold load is **under 90 KB** total, from the network panel.

---

**Phase 4 ●: Capture, the planes and the arc**

*Files:* `src/components/ui/Field.tsx`, `src/components/ui/Button.tsx`,
`src/components/ui/Chip.tsx`, `src/views/CaptureView.tsx`, `src/components/LogStack.tsx`

*Does:* the `Plane` primitive and all four moments, plus the optimistic park from 1.11, which is
approved. `Plane` is the component that owns the depth illusion: one `distance` prop sets background,
type width, ink colour and scale together, so they can never drift apart.

*Acceptance, from the screenshots:*
- At 390px the capture field is **the only element above the fold**, with the headline. Park, chips
  and the peek stack are all below it or just at it.
- The bucket chips are **legible at 12px** in the 390px screenshot, without zooming.
- The **rest and focus screenshots are visibly different**: the focused plane is lighter, slightly
  larger, and the accent focus bar is present. Two PNGs settle this with no judgement call.
- The peek stack rows get **visibly narrower and dimmer** going down. If all three rows look the
  same, the depth mechanism is not wired.
- Accent appears in exactly **one** place on the screen, the Park button.
- At 1280px the content is left-aligned in a 32rem column, not centred.

*Acceptance, from the recordings:*
- Full arc: the field is typeable **before** the commit animation ends. Watch the caret, not the card.
- Nothing whatsoever moves while typing.
- Reduced-motion recording: rest, focus, commit and settle are all still distinguishable, the parked
  line appears in the stack, the count increments, and "Logged." holds for about a second.
- Double-park: two thoughts in under a second. **No queue, no pile-up, no delay before the second
  field is usable.** Two elements may be in flight at once; a third replaces the oldest with no
  animation.
- **Force a park failure** (throw from `parkCapture` in devtools) and record it: the text must come
  back into the field with an error, and a `console.warn` must carry the text. This is the 1.11
  recovery path and it is the one thing on this screen that cannot ship untested.

---

**Phase 5: Review**

*Files:* `src/views/ReviewView.tsx`, `src/components/ui/FileCard.tsx`, `src/components/ui/Card.tsx`

*Acceptance:*
- At 390px **one triage card fills the view** with the next just visible at the fold. Not a list.
- Bucket colour is visible as a leading-edge bar and is **never the only carrier** of a state: the
  carry-forward line reads without colour.
- Confirm is the one accent element per card; the override chips sit further back until chosen.
- The Hands row wraps without overflow at 390px.

---

**Phase 6: Patterns and Settings**

*Files:* `src/views/PatternsView.tsx`, `src/views/SettingsView.tsx`

*Acceptance:*
- Patterns numerals are in the display face at `--text-3xl` and legible from arm's length in the
  390px screenshot.
- The ruled ground is present and measures under 1.5:1 against the page. It should be perceptible and
  never something you read.
- **No dial, no gauge, no target, no change arrow, no day-over-day comparison, and no sequence chart
  of daily counts** anywhere in the screenshot.
- The 24-slot hour distribution is readable at 390px; empty hours are visible as empty, not absent.
- Settings has no card borders, only rules. The BYOK honesty paragraph is full-strength ink.

---

**Phase 7: sweep and document**

*Files:* `DESIGN.md`, `README.md`, `.cursorrules`, `CLAUDE.md`

*Does:* `DESIGN.md` rewritten to describe what is now true, with its log pointing here.
`.cursorrules` updated. README screenshot refreshed.

*Acceptance:*
- `npm run build` still emits no CSS warning and no prose-leaked utilities, with two more markdown
  files in the repo than Phase 1 had.
- `grep -rn -- "--nil-" src/` returns nothing and the alias block is gone from `index.css`.
- JS gzip **≤ 130 KB**, CSS gzip **≤ 12 KB**, fonts **≤ 90 KB**. Numbers recorded in the commit.
- `DESIGN.md`'s colour table matches `tokens.generated.css` exactly, which is the failure in
  conflict 1 closed for good.

---

## Build session kickoff

**Do not start Phase 3 yet.** A design direction has not been chosen. Section 3 proposes three dark
directions and recommends **C, Depth Field**; that recommendation is not a decision. Sections 4.2 and
5 carry Depth Field's values, so if the answer is Aperture or Monolith those two need reworking
first. Everything else in section 4 is direction-agnostic by design.

The three are rendered and interactive at
https://claude.ai/artifact/MzpBKe3epbTTkwE417nTko

**Phases 1 and 2 touch no design decision and can start immediately.**

Once a direction is chosen:

**Read first, in this order:** `CLAUDE.md` at the repo root, then this file's sections 1, 2 and 6,
then `PRODUCT.md`. `DESIGN.md` is historical and not binding; read it only to know what is being
replaced.

**Start on Phase 1**, the NIL rip-out. It is the only phase that touches no design decision, so it is
safe to build before the direction is confirmed if Jen wants progress while deciding.

**Phase 1 is accepted when** the 390px and 1280px screenshots are pixel-identical to the phase 0
baseline apart from missing button hover and focus states, the 1280px page gutters are still warm
grey rather than white, and `grep -rn "nil-ds\|--nil-primitive" src/ scripts/ package.json` returns
nothing.

**Already decided, do not reopen:**

- **The optimistic park is approved** (1.11). Build it exactly as specified, including the
  `console.warn` on failure, which is part of the change and not an optional extra.
- **NIL DS is out**, with no compatibility layer and no upstream.
- **Motion ships at 0 KB.** Springs are solved at build time. Do not install an animation library.

**Stop and ask about:**

- **Which design direction**, before Phase 3.
- **The 70 KB font cost** of Depth Field. The app currently ships zero font bytes. If that is too
  much, Anybody's width axis is the expensive part and the direction does not survive losing it, so
  the answer would be a different direction rather than a cheaper subset.
- **Anything that would add a fifth screen, a streak, a target, a goal, or a comparison with
  yesterday.** The answer is no, but flag the request rather than quietly designing around it.
- **Any request to animate `font-variation-settings`.** It forces a relayout per frame. Width steps
  at transition boundaries, it does not tween.

**Do not touch:** the Dexie schema and stored data shape, the voice capture pipeline,
`src/lib/agent.ts` and the BYOK flow, `src/lib/hands.ts`, and routing between the four views.

One phase per session. Screenshot before moving on. A phase is done when someone has looked at it.

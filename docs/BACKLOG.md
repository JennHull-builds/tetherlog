# Backlog

**Known, measured, deliberately not fixed yet.** This file exists so a finding does not have to stop
a build. Something lands here when it is real, has a number, and the fix is a decision rather than a
change. Nothing here is a bug report from a user: every entry was found by measuring.

Added to in the same session a thing is found. Reviewed when a phase closes. **Nothing here blocks
shipping unless it says so.**

| | |
|---|---|
| Owner of the call | Always the repo owner, never the agent that found it |
| Format | What, the number, what it would take, and what it is waiting on |

---

## B-001: Text on the bare starfield fails AA at some viewports

**CLOSED 2026-10-01 by D-027. The starfield is gone and nothing on Capture sits on a light source.**
The grid keeps clear of every run of text, so the brightest pixel behind any glyph is now the
ground. Measured the same way as below, over the same nine viewports, with the confirm word caught
mid-wave:

| Element | Needs | Last on the starfield | **On the grid** |
|---|---|---|---|
| Headline, 34px | 3.0 | 3.24 | **17.98** |
| Parked count, 11px mono | 4.5 | 1.43 | **8.60** |
| Confirm word, 15px | 4.5 | 3.10 | **8.55** |
| Tag chip label, 13px | 4.5 | 3.92 | **8.55** |

**The rule that keeps it closed:** the dots nearest the field measure only 3.19:1 under muted copy,
so any new text on Capture has to join `keepClear` in `GravityField`. The history below is kept
because the measuring method in it is still the right one.

**Found 2026-09-22 measuring D-019. Still open after Phase 7, deliberately: the call is the owner's
and all three options change a composition that D-014 settled.** Phase 7 changed nothing on Capture,
so every number below still stands.

Capture's remaining copy sits on the starfield with no surface under it, so the brightest star is
its background wherever one lands behind a glyph. Whether one does is luck of the star grid, so this
is viewport-dependent rather than constant: on most screen sizes most of the text is clean.

Worst case over nine viewport sizes and four states, sampled off rendered frames against the actual
glyph mask.

| Element | Needs | Phase 4 | After D-019 | After D-020 | **After D-022** |
|---|---|---|---|---|---|
| Headline, 34px | 3.0 | 6.62 | 2.97 | 3.06 | **3.24 passes** |
| Parked count, 11px mono | 4.5 | **3.61** | **1.43** | **1.43** | **1.43** |
| Confirm word, 15px | 4.5 | 4.57 | **2.80** | **2.95** | **3.10** |
| Tag chip label, 13px | 4.5 | 4.57 | **3.54** | **3.54** | **3.92** |
| Sub-line, 13px | 4.5 | **3.56** | removed in D-019 | gone | gone |

**Every element the atmosphere was lifting has improved twice**, once when the bloom turned blue
(D-020) and again when its reach was tightened (D-022). The headline is comfortably clear now.

**The parked count has not moved at all across either change, and that is the finding.** It sits low
on the screen where the bloom barely reaches, so its background is not the atmosphere: it is a star
landing behind an 11px glyph. Nothing done to the bloom will fix it. **The count is the whole of
this entry**, and of the options below only dimming the stars, putting a surface under it, or moving
it off the sky can touch it.

> **When re-measuring the tag chip, hide the label on the element that carries the colour.** `Chip`
> sets `color` inline on an inner span, so setting it on the button does nothing and the glyph mask
> picks up the chip's own `--tl-rule` border instead, which reports a stable, wrong 2.67:1 on every
> build. The 3.54 above came from a probe that hides the span.

**Two of these predate the new star tint.** The parked count and the sub-line were already under AA
on the grey starfield that shipped from Phase 4. D-015 recorded 4.71:1 for the sub-line and that was
one viewport, not the worst case; the number to trust is the sweep, not that entry.

**What it would take, measured, not guessed:**

| Option | Effect | Cost |
|---|---|---|
| Dim the stars | `sky()` gains 0.42 / 0.64 drop to about 0.19 / 0.29 | The brightest cool star then sits below the grey field's old peak. The colour survives and the crispness does not. |
| A surface under the copy | Stars keep full brightness | `docs/LOOK.md` has this copy on bare sky, and the reference it came from does too. A different composition, not a tuning. |
| Move the copy off the starfield | The only option that lets the stars get brighter | Reopens Capture's composition, which D-014 settled. |
| Brighten the ink | None | **Arithmetically impossible.** Clearing 4.5:1 against the brightest star needs an ink lighter than pure white. |
| Shrink the bloom | Headline only | Measured at bloom 0: the count and the confirm word still fail. Part of a combination, never the fix. |
| Resize the copy | None | Large text only lowers the bar to 3.0:1 and these sit below that. |

**Reproduce it:** the sweep script is not committed, deliberately, because it depends on a browser
driver this repo does not take as a dependency. The method is the one D-015 used and is worth
repeating rather than trusting: render the screen, hide the text, sample only the pixels the glyphs
covered, take the brightest, compute the ratio. Sweep viewport sizes; a single one will miss it.

---

## B-002: Prose in source-file comments leaks utilities into production CSS

**CLOSED 2026-09-22 in Phase 7. Fixed, and the entry below was wrong in two ways worth recording.**

It said five rules leaked and that every fix was a decision. Measured against the markup and the
scanner rather than read off a word list:

- **It was four, not five.** `.fixed` is a real class, used by `GravityField` on the canvas.
  Counting a used class as junk is the same mistake as the leak: a plausible list nobody checked.
- **`.shadow` never came from a comment.** It came from `scripts/build-tokens.mjs`, where
  `$type === "shadow"` is a DTCG type name and cannot be reworded at all.

So the guard could cover it after all. `src/` genuinely cannot join the `@source not` list;
`scripts/` is not `src/`, renders nothing and holds no class name, so a fifth directive took it.
The four comment-sourced words were reworded in the same pass, mildly, because only an exact
utility name emits: `shadows`, `box-shadow` and `round-cornered` are all safe.

Production CSS went from 5.72 KB to **5.44 KB** gzipped, with exactly four rules removed and none
added. The CI assertion, which had been green throughout while naming five utilities that have
never leaked, now names the ones that have, and was run against the leaky build before being
trusted. Written up in `docs/DECISIONS.md` D-024.

---

## B-003: Review's summary counts may belong in the display face

**CLOSED 2026-09-22 in Phase 6. Answered yes.** Review's four bucket totals are now a display-face
numeral with a mono label beneath, in the same grid Patterns uses for its readouts, because two
screens that both answer "how many" should answer it in the same voice. See `docs/DECISIONS.md`
D-021.

### B-003b, in its place

**CLOSED 2026-09-22 in Phase 7. Space won.** Settings separated its sections with a 1px `--tl-rule`
and Review's wrap-up did the same job with space alone.

**Patterns broke the tie**: it separates on space with no rule, using the same section-heading
treatment as the other two. Two screens of three already agreed, so Settings was the outlier. Its
rules are gone; the spacing did not change, so nothing regrouped. See `docs/DECISIONS.md` D-026.

---

## B-004: The recording timer announces four times a second

**Carried from D-014, still open.**

The voice recording timer carries `aria-live="polite"` and updates every 250ms, which is four
announcements a second on a screen reader. It shipped that way and no phase has changed it, because
it is not a composition question and should not be guessed at without testing on a real screen
reader.

---

## B-005: `docs/DECISIONS.md` is 18 em dashes over the limit

**Found 2026-09-22 sweeping Phase 7.**

`CLAUDE.md` allows zero em dashes in any heading and at most one per document in prose. Measured
across the repo, everything is clean except two files:

| File | Count | Note |
|---|---|---|
| `docs/DECISIONS.md` | 18 | All in prose. The one in a heading was fixed in Phase 7. |
| `PRODUCT.md` | 45 | Already a known hold: it is the binding spec and rewording risks meaning. |

**The good news is the part that mattered.** Shipped UI copy and `src/lib/hands.ts` were the real
exposure, because those strings leave the app in the export, the do list and the mailto subject.
Both are at **zero** now, down from 16 and 9, carried out by the view rebuilds in Phases 4 to 6
without anyone tracking it.

**Not swept here** because 18 rewordings inside a binding document is a decision, not a change, and
the risk is changing what an entry means. Every one is in prose, none in a heading, and the repo is
public so the tell is real but not urgent.

---

## B-006: The focus rim is dimmer on the path almost everyone takes

**CLOSED 2026-10-01 by D-027.** There is no shader-drawn rim any more: the field draws its own edge
in CSS on every device, the path that measured well below. A clean collar a few pixels wide keeps
the grid off the edge, so what sits next to it is always the ground. Sampled all the way round the
focused field over nine viewports, 1,134 samples:

| | Worst | **Median** | Best |
|---|---|---|---|
| Before, WebGL path | 1.00:1 | **1.79:1** | 6.01:1 |
| **After, every device** | **5.12:1** | **5.69:1** | 5.72:1 |

**Found 2026-09-22 in Phase 7, while re-shooting the README screenshot.**

Capture's field is `<Field rim glass={lensReady} />`. **In glass mode the CSS border is set to
`transparent` and the shader draws the rim instead**, which is right: two rims would double up. The
consequence was not measured until now.

Focus rim against the ground immediately outside it, sampled around the field's whole perimeter:

| Path | Who gets it | Worst | **Median** | Best |
|---|---|---|---|---|
| WebGL up, shader rim | ~98% of devices | 1.00:1 | **1.79:1** | 6.01:1 |
| No WebGL, CSS rim | ~2% of devices | 1.00:1 | **5.69:1** | 5.69:1 |

WCAG 1.4.11 wants **3:1** for a focus indicator. The shader rim clears it only on the upper-left
arc, where the lens's one light source falls; around the rest of the perimeter it is under 2:1. The
CSS rim is even the whole way round and clears it comfortably, close to the 5.53:1 that
`--tl-rim-focus` carries in its own `$description`.

**So the fallback is the accessible path and the primary one is not.** The token is contrast-checked
and correct; it just does not reach the screen on the 98% path, and nothing warned about it because
both paths render a rim and neither errors.

**It is not viewport-dependent.** Measured at 360, 390, 414, 430, 768 and 1280: the median is 1.78
to 1.79 at every one. Unlike B-001 this is not star luck, it is the shader's rim strength, so one
number describes it everywhere.

**Focus is not invisible**, which is why this is a backlog entry and not a stop. Focus changes 2.64%
of the screen: the rim brightens and the lens bends more deeply behind the field, and both are real.
The question is whether an indicator that measures 1.79:1 around most of its length is enough on its
own, and that is a decision about a visual that has been approved.

**What it would take:** raise `lens.rim-strength` (0.85 today) until the shader rim clears 3:1 at its
darkest point, or stop blanking the CSS border in glass mode and accept a doubled edge, or light the
rim evenly rather than from one direction, which contradicts `docs/LOOK.md` rule 2. All three change
an approved visual, so the call is the owner's.

---

## B-007: Capture's field reads as a raised tile, and the park is not the one LOOK.md specified

**CLOSED 2026-10-01: the owner picked the grid, and it is built (D-027).** Ported from the sketch's
own shader and timings rather than from a description of them. What remains is the owner's look on a
real phone, which is the same gate every phase has.

**Found 2026-09-30 by filming the live site, frame by frame, at 390px.**

Three things, all visible in a recording and none visible in the code review that shipped them:

| What LOOK.md says | What ships |
|---|---|
| The field is not raised and not recessed: it is heavy | The shader lights a convex glass body from the upper left, with a specular corner and a bright band along the top edge. It reads as a bevelled tile sitting on space. `GravityField.tsx` says so in a comment: the body should read "as a lit solid, never a hole cut in the scene". |
| On commit, the well briefly collapses inward and the thought falls in | The text clears instantly, then about 200ms later a blue wash lifts the top half of the screen and fades. Nothing moves, and nothing goes anywhere. |
| The starfield bends around the field | At rest the bend is not visible in a still. |

On load the field also changes identity: the CSS fallback paints first, then the glass body replaces it
once the lens is ready.

**The first replacement was ruled out on 2026-10-01.** A hole rather than a solid: darker than the
ground inside, a thin even ring, light bent round it in arcs, the words drawn into the centre on
park. It was built as a standalone sketch with a working park, looked at, and judged worse than what
ships. The next round started from a blank slate rather than from the space metaphor.

**Four directions from a blank slate are now sketched**, each with a working park, and none of them
is space:

| Direction | At rest | On park | WebGL |
|---|---|---|---|
| Fold | The field is a sheet with one crease, lit from above | The sheet folds shut over the words and drops away | No |
| Grid | A fine dot grid that keeps back from the field and from all text | The words sink and one wave runs out through the grid | Yes |
| Water | The field stands on dark water, its rim faintly reflected | The words drop under the waterline and rings spread | Yes |
| Tether | One thread under the field | The words become a tag that drops onto the thread, which dips and settles | No |

All four are static at rest, measured at zero animation frames, with a reduced-motion path and a
double park that never queues.

**Two backlog entries move with whichever is chosen.** None of the four keeps the starfield, which
is B-001's cause, and all four draw the focus rim as a CSS border rather than in the shader, which is
B-006's. Both should close by construction, and both have to be measured on the port, not assumed.

**Waiting on:** the owner's pick. Whatever is chosen is ported from the sketch's own code rather than
from a description of it: the last lens lost most of what was approved between the sketch and the
build (D-016).

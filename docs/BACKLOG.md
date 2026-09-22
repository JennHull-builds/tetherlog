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

**Found 2026-09-22 measuring D-019. Accepted as good enough for now, revisit after Phase 7.**

Capture's remaining copy sits on the starfield with no surface under it, so the brightest star is
its background wherever one lands behind a glyph. Whether one does is luck of the star grid, so this
is viewport-dependent rather than constant: on most screen sizes most of the text is clean.

Worst case over nine viewport sizes and four states, sampled off rendered frames against the actual
glyph mask.

| Element | Needs | Phase 4 | After D-019 | **After D-020** |
|---|---|---|---|---|
| Headline, 34px | 3.0 | 6.62 | 2.97 | **3.06 passes** |
| Parked count, 11px mono | 4.5 | **3.61** | **1.43** | **1.43** |
| Confirm word, 15px | 4.5 | 4.57 | **2.80** | **2.95** |
| Tag chip label, 13px | 4.5 | 4.57 | **3.54** | **3.54** |
| Sub-line, 13px | 4.5 | **3.56** | removed in D-019 | gone |

**D-020's blue bloom recovered the headline** and moved the confirm word a little. It did nothing
for the parked count, which sits low on the screen where the bloom is weakest: its worst case is a
star landing behind an 11px glyph, not the atmosphere. **The count is now the whole of this entry**
and the options below are unchanged for it.

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

**Found 2026-09-22 measuring Phase 5. Flagged for Phase 7.**

Five rules ship today, 582 bytes uncompressed, and none came from a markdown file:

```
.fixed   .inline   .ring   .rounded   .shadow
```

They come from ordinary English in `src/` comments. The four `@source not` directives are intact and
working; `src/` cannot join them, because `src/` is where the real class names live. `.shadow` is in
the production CSS of an app whose direction is that depth is never a shadow attached to an edge.

Every fix is a decision: reword comments across the codebase, or post-process the built CSS, and a
build script is what broke every Vercel deployment on 2026-09-18. The CI assertion in
`.github/workflows/verify.yml` names five different utilities and has been silent throughout, so
widening that list is the cheap half and does not need a decision.

---

## B-003: Review's summary counts may belong in the display face

**CLOSED 2026-09-22 in Phase 6. Answered yes.** Review's four bucket totals are now a display-face
numeral with a mono label beneath, in the same grid Patterns uses for its readouts, because two
screens that both answer "how many" should answer it in the same voice. See `docs/DECISIONS.md`
D-021.

### A new one, in its place

**Review's wrap-up separates its sections with space; Settings separates its with a 1px
`--tl-rule`.** Both are defensible and they disagree, and the disagreement is visible if you move
between the two screens. Phase 7 picks one. Not settled in Phase 6 because Review was already
approved and repainting it there would be scope creep in a phase that does not own it.

---

## B-004: The recording timer announces four times a second

**Carried from D-014, still open.**

The voice recording timer carries `aria-live="polite"` and updates every 250ms, which is four
announcements a second on a screen reader. It shipped that way and no phase has changed it, because
it is not a composition question and should not be guessed at without testing on a real screen
reader.

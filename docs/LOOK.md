# LOOK

**The visual direction, derived from images rather than adjectives.**

Written 2026-09-18 from twelve references Jen collected. This file exists because the look had been
described in words three times, in three tools, and words like "modern", "sleek" and "minimal" map
to hundreds of different screens. It is binding. `CLAUDE.md` points here.

The references themselves live in `docs/references/` and are **not committed**: they are third-party
images and video, and this repo is public and MIT. This file is the durable artefact.

---

## The one thing to get right

Jen's words: *"I am scared of this being thrown back to 2010s neumorphism, so I hope it makes sense
where I want to go with that, but more current and clever."*

Three of the twelve references *are* neumorphism. Five are sculptural. **The gap between them is the
whole brief**, and it is specific enough to write down:

| | Neumorphism (the fear) | Sculpture (the target) |
|---|---|---|
| Object colour | Same as the ground | Distinct in value or hue |
| Light | Two soft shadows, opposite corners | **One** source, one direction, consistent everywhere |
| Form | Extruded, puffy, radiused mush | Real geometry: facets, cuts, folds |
| Shadow | Soft halo hugging the object | One directional cast shadow, or none |
| Contrast | Deliberately low, everything murmurs | High. The object is unmistakably an object |
| Feels like | Pressed rubber | Machined metal, folded paper, a lit solid |

**The test:** if you removed the shadows, would you still know the object was there? Under
neumorphism, no, the object *is* the shadows. Under sculpture, yes, because it has a value, an edge
and a form.

Deep Yellow's sliced sphere and the folded-paper poster are both "soft shapes lit from one side",
which is superficially the neumorphic move. Neither reads as neumorphic, because the form is real and
the contrast is high.

---

## What the references actually say

**1. Depth comes from what the light does to real geometry.**
Five references: isometric stacked solids, a sphere with a flat slice cut through it, white hexagons
at varying extrusion, a clay-render kit of physical controls, a single vertical fold in a white page.
Every one is a single light source on a form that has actual shape. None of them uses a shadow *under
a rectangle* to suggest a card.

**2. Everything is rounded. Often fully.**
Pills, spheres, discs, capsules, rounded rectangles. Across twelve references there is **not one
sharp-cornered box**. This kills the `0px` radius that every previous proposal carried over from the
NIL era. Radius is back and it should be generous.

**3. Colour is one saturated object on a neutral ground.**
The yellow sphere. The blue toggle. The red badge. Never a palette, never a colour scheme: a neutral
near-monochrome field with exactly one thing in it that has colour. That maps cleanly onto TetherLog,
where there is exactly one primary action per screen.

**4. Type is a heavy grotesque, set large, with enormous space around it.**
"Slice". "13". "A new era". Tiny captions in the margins, often rotated or bottom-aligned. Huge
negative space. The type is confident and the page is mostly empty.

**5. The most interesting motion is small, low-profile and alive.**
The Next.js badge growing from a dot into a labelled pill with a count. The "Ask Agent" pill with a
pixel character clambering over it. Both are *utility controls with one moment of character*, which is
exactly the budget TetherLog has: nothing at rest, everything at the handover.

---

## The closest reference, and the direction

Jen sent one link separately, with enthusiasm: George Hastings on the **Krea agent** UI, captioned
*"I sure do like me some gravity distortion shaders."*

It is, almost exactly, TetherLog's home screen:

- Pure black ground with a fine starfield
- A light-weight headline and a one-line subtitle, centred
- **One large, fully-rounded input field**, barely lighter than the ground, with a luminous rim
- And the mechanism: **the starfield bends around the field.** Stars near it are dragged into arcs.
  The field has mass, and space curves around it.

That is the answer to "depth, but not neumorphism". The field is not raised and not recessed.
**It is heavy.** Depth is expressed by what the object does to its surroundings rather than by a
shadow attached to its edge. Nothing in the 2010s looked like this, and no amount of soft shadow
gets you there.

It also happens to be the right metaphor. TetherLog is a place to drop a thought so it stops pulling
at you. A gravity well is precisely that: something with enough mass to hold a thing you let go of.

### The four moments, in this direction

| Moment | What happens |
|---|---|
| **At rest** | The field has mass. Space is bent around it, held still. |
| **On focus** | It gains mass. The bend deepens, the rim brightens. |
| **On commit** | A pulse: the well briefly collapses inward and the thought falls in. |
| **After** | Space relaxes back to rest. The log below is one row longer. |

### The constraint this direction must respect

`PRODUCT.md` forbids ambient motion in the capture path: nothing animates in response to typing, and
nothing loops while the field is focused. **A drifting starfield is an ambient loop and is not
allowed.**

The resolution is not a compromise. **The field is static at rest.** Star positions are computed once
and the distortion is a still warp, redrawn only when the mass changes, which is at the four moments
and nowhere else. No `requestAnimationFrame` loop, no drift, no shimmer.

That also settles the cost question: **no WebGL, no shader, no library.** A Canvas 2D pass that
displaces pre-computed star positions by a lens function runs once per state change. It is a few
hundred bytes of maths and it is idle the rest of the time, which is what an installable PWA on a
mid-range Android needs.

---

## Open, and Jen decides

**Light ground or dark.** Eight of the nine still references are near-white. The video that matches
the product almost exactly is pure black. The mechanism works on both: on light, the field is a
depression that bends a fine grid or grain rather than a starfield. Dark is proposed, because it is
what she reacted to most strongly and because a warm-white ground is explicitly ruled out.

**Whether one moment of character is wanted.** The Ask Agent pill and the Next badge both put a small
piece of personality on a utility control. TetherLog's rules forbid celebration and anything that
rewards returning, so if this lands anywhere it is at rest, not at commit: something that makes the
field feel occupied rather than something that congratulates you for using it.

---

## Standing rules that come out of this

1. **Radius is generous.** The `0px` brutalist lock is dead. It came from NIL and it contradicts
   every reference.
2. **One light source, one direction, everywhere.** If two elements are lit from different angles the
   illusion collapses into neumorphism.
3. **Colour appears once per screen.** The primary action. Bucket hues are the exception and they are
   markers, not surfaces.
4. **Never the same colour as the ground plus two soft shadows.** That is the neumorphic move and it
   is the one thing explicitly rejected.
5. **Depth is what an object does to its surroundings**, not what is attached to its edge.
6. **Nothing loops.** Static at rest, always. The distortion redraws on state change only.

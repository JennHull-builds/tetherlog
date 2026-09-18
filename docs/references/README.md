# Visual references

**Drop images in this folder.** That is the whole job. Filenames do not matter.

This exists because TetherLog's look has been described in words three times now, in three
tools, and words like "modern", "sleek" and "minimal" map to hundreds of different screens.
Pictures do not. This folder is the fix, and it is committed to the repo so it survives a new
chat, a new tool and a new machine.

---

## What to drop in

**Anything visual, not only UI.** Editorial spreads, packaging, a film still, a poster, an app
screenshot, a website, a book cover. Non-UI references are often better, because they carry
feeling without carrying somebody else's layout.

**Aim for 8 to 15.** Fewer than 6 is not enough to triangulate. More than 20 starts averaging
out into mush.

**Include 2 or 3 you dislike.** This matters more than it sounds. Near-misses carry more signal
than favourites: two things can look nearly identical and one of them is wrong, and *that gap*
is the thing that cannot be recovered from adjectives.

---

## Annotating them

Optional, and it roughly triples what each image is worth. If you do it, keep it to one line.

Either rename the file:

```
yes-01-that-type-weight.png
yes-02-the-space-around-everything.png
no-01-too-corporate.png
```

Or add lines to `NOTES.md` in this folder:

```
IMG_4821.png    yes — the way the type is enormous and everything else is tiny
screenshot2.png yes — this exact amount of empty space
site-thing.png  no  — right colours, but it feels like a bank
```

**"I like this one, I don't know why" is a valid note.** Say that rather than inventing a reason.
Working out why is the job, and a wrong guess at the reason sends the whole thing sideways.

---

## What happens next

These get read and turned into `docs/LOOK.md`: the actual visual direction, in writing, derived
from these images rather than from adjectives. That file then becomes binding, `CLAUDE.md` points
at it, and no future session has to guess again.

Nothing visual gets built before that exists.

# Fonts

`Geist-latin.woff2` and `GeistMono-latin.woff2` are Geist and Geist Mono, vendored into this
repository and served from this origin.

**They are not loaded from a CDN on purpose.** Linking `fonts.googleapis.com` sends the user's IP
to Google on every page load, which contradicts the privacy promise in the Settings copy.

## What was done to them

Both are the variable `wght` faces from the `geist` npm package v1.7.2, subset to the standard
latin range with `pyftsubset`:

- layout features kept: `kern`, `liga`, `calt`, `tnum` (tabular numerals, so the parked count and
  the voice timer do not jitter)
- hinting dropped, CFF desubroutinized
- the full 100 to 900 weight axis is retained; the app uses 300, 400 and 500

Sans went 69,652 to 25,444 bytes. Mono went 71,368 to 20,124 bytes. **45.5 KB for both**, against a
90 KB budget.

To regenerate, subset the variable woff2 from the `geist` package to the Google Fonts latin unicode
range. There is no build step for this: the files are committed.

## Licence

SIL Open Font License 1.1. Full text in `LICENSE-Geist.txt`, which must stay with the fonts.

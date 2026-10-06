# Headless parity sweep results

Run on 2026-10-06 by `npm run verify:headless` (verify/headless.ts).

- Chromium 149.0.7827.55 (Playwright 1.61.0, headed), `<html lang="en">`
- harfbuzzjs 1.6.2 (HarfBuzz 14.5.0), wawoff2 2.0.1
- Pretext 0.0.9 (../pretext f10d888), `setLocale('en')` on both sides
- Node v24.4.1, macOS 14.6.1 (Darwin 23.6.0), arm64

Fonts: test/fonts, loaded in Chromium through `@font-face` from the same files the stand-in registers, each
awaited with `document.fonts.load` and checked `loaded`: Inter-Regular.ttf as 400 "HX Inter", Inter-Regular.woff2 as 400 "HX Inter WOFF2", Roboto-Regular.ttf as 400 "HX Roboto", ShantellSans-Regular.ttf as 400 "HX Shantell Sans", ShantellSans-Bold.ttf as 700 "HX Shantell Sans", inter-latin-wght-normal.woff2 as 100 900 "HX Inter Variable".
Every family name carries an "HX " prefix on both sides, so no installed Inter or Roboto can stand in for a file; the
family Canvas reads back must equal the one set. Inter and Roboto have one face, so Chromium synthesizes 600 and 700;
Shantell Sans has a 400 and a 700 face (added for this sweep so that a stand-in ignoring the requested weight can be
caught at all).

**Scope rule (fixed before the first run), decided without the stand-in.** After Canvas's own text preparation (ASCII
white space becomes U+0020; SHY, ZWSP, LRM, RLM, U+202A-U+202E, U+FEFF and U+FFFC become U+200B), a (text, font) case is
in scope exactly when every code point is in the cmap of the face CSS matching picks (HarfBuzz `collectUnicodes` on
the font file, WOFF2 decompressed), is Default_Ignorable_Code_Point, or is U+2028/U+2029 in a face with U+0020.
Anything else Chromium draws from an OS fallback font, which the stand-in does not claim to reproduce. The skip lists
below come from this rule. The stand-in is then checked against it case by case: it must throw
`HeadlessCoverageError` on every skipped case and on no other. 1572 cases checked, 0 disagreements.

**Stand-in bug this sweep found, fixed in src/headless/canvas.ts.** Under letter spacing the stand-in added the spacing
after U+200B and every character Canvas turns into it (SHY, LRM, RLM, U+202A-U+202E, U+FEFF), where Chromium adds none
(Blink skips characters it treats as zero-width spaces): 288 width cases were 0.5px per such character too wide, up to
2.5px for a five-SHY word. Regression test: "letter spacing skips ZWSP and what Canvas turns into it" in
test/headless/canvas.test.ts, which fails without the fix. Pretext's own line counts never showed it: Pretext measures
those characters as segments of their own.

**Stand-in bug the variable font found, fixed in src/headless/hvar.ts and canvas.ts.** HarfBuzz rounds a variable
font's HVAR advance delta to whole font units; Chrome on macOS (CoreText through Skia) keeps the fraction, so away
from the default instance every advance was off by up to half a unit (the space at wght 500: 546/2048 em against
545.76/2048 em): before the fix 232 widths beyond 0.02px (max 0.055115px) and 11 headless-mismatches, all in Inter
Variable at 300/500-800. The stand-in now hands HarfBuzz the unrounded advance, with the normalized coordinate
computed by OpenType 1.9.1's precision rules (16.16 normalization and avar, then F2Dot14), which CoreText follows
and HarfBuzz does not, and the px conversion Blink uses, and sums a run's advances in 1/65536 px as Blink does.
Regression tests: test/headless/variable.test.ts (Chromium widths pinned at six weights: 300/399/401/500/700/899),
which fail without the fix.

## Widths

54 strings × 5 families × weights 400/600/700 (HX Inter Variable: 300/400/500/600/700/800) × sizes 12/14/16/20px ×
letter spacing 0px/0.5px: **7344 cases, 6126 exact, max |Δ| 0.000427px,
0 beyond 0.02px.** Chromium's OffscreenCanvas `measureText` against the stand-in's.

Strings: "Speichern", "Zahlungspflichtig abonnieren", "„Zahlungspflichtig abonnieren“", "„Tagesabschlussbericht“", "Donaudampfschifffahrtskapitän", "Grundstücksverkehrsgenehmigung", "Übergrößenträger ÄÖÜ äöü ß ẞ", "Wird geladen…", "Benutzerkontoeinstellungen speichern", "Paramètres de confidentialité avancés", "Enregistrer les modifications ?", "L’anticonstitutionnalité", "Œuvre « complète » — été", "Ça coûte 12,50 €", "0123456789", "1 234 567,89", "2026-10-05 17:42:09", "3.14159 × 2 = 6.28318", "Hello, world! (test) [x] {y}", "“Quoted” ‘single’ — dash – en", "Wait... what?! Yes; no: maybe.", "AV AVA Tw To Ty Wa Yo", "LT LY P. F, T. Vo", "AVATAR WAVY TYPO", "A V", "x T x", "office affine fluffy", "fi fl ffi ffl", "The first staff", "© 2026 Acme", "Acme®", "Brand™", "A ↔ B", "Play ▶", "I ♥ it", " ", "a b", "a\u2028b", "a\u2029b", "x\u2028T\u2028x", "x\u2029T\u2029x", "\u2028", "\u2029", "A\u200BV", "Zahlungs\u200Bpflichtig\u200Babonnieren", "A\u200EV", "A\uFEFFV", "Auf\u200Clage", "a\u200Db", "A￼V", "AV", "a\u200B́b", "Zah\u00ADlungs\u00ADpflich\u00ADtig", "Ta\u00ADges\u00ADab\u00ADschluss\u00ADbe\u00ADricht".

Tripwire beside the bar: HX Inter, HX Inter WOFF2, HX Roboto (2048 units per em, so every advance is a dyadic fraction of a
pixel) must measure bit-exact; 0 inexact. Shantell Sans (1000 units per em) differs by under 0.0005px in
most cases: its advances are not dyadic fractions of a pixel, and Chromium rounds them differently from HarfBuzz's
1/65536 px; far below the bar and never a line count.

| family | cases | exact | max abs Δ px | > 0.02px |
|---|---:|---:|---:|---:|
| HX Inter | 1272 | 1272 | 0 | 0 |
| HX Inter WOFF2 | 1272 | 1272 | 0 | 0 |
| HX Roboto | 1176 | 1176 | 0 | 0 |
| HX Shantell Sans | 1272 | 122 | 0.000427 | 0 |
| HX Inter Variable | 2352 | 2284 | 0.000092 | 0 |

Variable font (@fontsource-variable/inter 5.3.0, its latin subset as one variable face, wght 100-900;
loaded in Chromium with `font-weight: 100 900`, registered in Node with no weight so the stand-in reads the axis) by
instance: widths as above, line counts as in the next section.

| instance | width cases | exact | max abs Δ px | > 0.02px | line cases | headless-mismatch | pretext-gap |
|---|---:|---:|---:|---:|---:|---:|---:|
| HX Inter Variable 300 | 392 | 352 | 0.000031 | 0 | 11568 | 0 | 13 |
| HX Inter Variable 400 | 392 | 392 | 0 | 0 | 11568 | 0 | 14 |
| HX Inter Variable 500 | 392 | 390 | 0.000031 | 0 | 11568 | 0 | 19 |
| HX Inter Variable 600 | 392 | 392 | 0 | 0 | 11568 | 0 | 21 |
| HX Inter Variable 700 | 392 | 366 | 0.000092 | 0 | 11568 | 0 | 19 |
| HX Inter Variable 800 | 392 | 392 | 0 | 0 | 11568 | 0 | 26 |

Skipped (out of scope): 54 string × font pairs.

- "umlauts" in 400 HX Roboto (8 cases): U+1E9E ẞ
- "umlauts" in 600 HX Roboto (8 cases): U+1E9E ẞ
- "umlauts" in 700 HX Roboto (8 cases): U+1E9E ẞ
- "umlauts" in 300 HX Inter Variable (8 cases): U+1E9E ẞ
- "umlauts" in 400 HX Inter Variable (8 cases): U+1E9E ẞ
- "umlauts" in 500 HX Inter Variable (8 cases): U+1E9E ẞ
- "umlauts" in 600 HX Inter Variable (8 cases): U+1E9E ẞ
- "umlauts" in 700 HX Inter Variable (8 cases): U+1E9E ẞ
- "umlauts" in 800 HX Inter Variable (8 cases): U+1E9E ẞ
- "A ↔ B" in 400 HX Roboto (8 cases): U+2194 ↔
- "A ↔ B" in 600 HX Roboto (8 cases): U+2194 ↔
- "A ↔ B" in 700 HX Roboto (8 cases): U+2194 ↔
- "A ↔ B" in 300 HX Inter Variable (8 cases): U+2194 ↔
- "A ↔ B" in 400 HX Inter Variable (8 cases): U+2194 ↔
- "A ↔ B" in 500 HX Inter Variable (8 cases): U+2194 ↔
- "A ↔ B" in 600 HX Inter Variable (8 cases): U+2194 ↔
- "A ↔ B" in 700 HX Inter Variable (8 cases): U+2194 ↔
- "A ↔ B" in 800 HX Inter Variable (8 cases): U+2194 ↔
- "Play ▶" in 400 HX Roboto (8 cases): U+25B6 ▶
- "Play ▶" in 600 HX Roboto (8 cases): U+25B6 ▶
- "Play ▶" in 700 HX Roboto (8 cases): U+25B6 ▶
- "Play ▶" in 300 HX Inter Variable (8 cases): U+25B6 ▶
- "Play ▶" in 400 HX Inter Variable (8 cases): U+25B6 ▶
- "Play ▶" in 500 HX Inter Variable (8 cases): U+25B6 ▶
- "Play ▶" in 600 HX Inter Variable (8 cases): U+25B6 ▶
- "Play ▶" in 700 HX Inter Variable (8 cases): U+25B6 ▶
- "Play ▶" in 800 HX Inter Variable (8 cases): U+25B6 ▶
- "I ♥ it" in 400 HX Roboto (8 cases): U+2665 ♥
- "I ♥ it" in 600 HX Roboto (8 cases): U+2665 ♥
- "I ♥ it" in 700 HX Roboto (8 cases): U+2665 ♥
- "I ♥ it" in 300 HX Inter Variable (8 cases): U+2665 ♥
- "I ♥ it" in 400 HX Inter Variable (8 cases): U+2665 ♥
- "I ♥ it" in 500 HX Inter Variable (8 cases): U+2665 ♥
- "I ♥ it" in 600 HX Inter Variable (8 cases): U+2665 ♥
- "I ♥ it" in 700 HX Inter Variable (8 cases): U+2665 ♥
- "I ♥ it" in 800 HX Inter Variable (8 cases): U+2665 ♥
- "C0 control" in 400 HX Inter (8 cases): U+0001 \u0001
- "C0 control" in 600 HX Inter (8 cases): U+0001 \u0001
- "C0 control" in 700 HX Inter (8 cases): U+0001 \u0001
- "C0 control" in 400 HX Inter WOFF2 (8 cases): U+0001 \u0001
- "C0 control" in 600 HX Inter WOFF2 (8 cases): U+0001 \u0001
- "C0 control" in 700 HX Inter WOFF2 (8 cases): U+0001 \u0001
- "C0 control" in 400 HX Roboto (8 cases): U+0001 \u0001
- "C0 control" in 600 HX Roboto (8 cases): U+0001 \u0001
- "C0 control" in 700 HX Roboto (8 cases): U+0001 \u0001
- "C0 control" in 400 HX Shantell Sans (8 cases): U+0001 \u0001
- "C0 control" in 600 HX Shantell Sans (8 cases): U+0001 \u0001
- "C0 control" in 700 HX Shantell Sans (8 cases): U+0001 \u0001
- "C0 control" in 300 HX Inter Variable (8 cases): U+0001 \u0001
- "C0 control" in 400 HX Inter Variable (8 cases): U+0001 \u0001
- "C0 control" in 500 HX Inter Variable (8 cases): U+0001 \u0001
- "C0 control" in 600 HX Inter Variable (8 cases): U+0001 \u0001
- "C0 control" in 700 HX Inter Variable (8 cases): U+0001 \u0001
- "C0 control" in 800 HX Inter Variable (8 cases): U+0001 \u0001

### Width misses

None.

## Line counts

586 text × font pairs (336 with soft hyphens) × 241 widths (120-600px step
2), 16px on 24px lines. Fonts: Inter 400, Inter 700, Inter 400 +0.5px, Roboto 400, Shantell Sans 400, Shantell Sans 700, Inter Variable 300, Inter Variable 400, Inter Variable 500, Inter Variable 600, Inter Variable 700, Inter Variable 800.
**141226 cases: 0 headless-mismatch, 288 pretext-gap,
0 unreliable, 140938 pass.** Pretext in Node against Chromium's DOM directly: 288 differ
(each one a pretext-gap above, or a headless-mismatch).

A `headless-mismatch` is Pretext in Node (stand-in) laying out a different line count from Pretext in Chromium
(real canvas); a `pretext-gap` is Pretext in Chromium differing from what Chromium paints, with Node agreeing with
Chromium-Pretext; `unreliable` is a painted height that is no whole number of lines.

| | cases | pass | headless-mismatch | pretext-gap | unreliable |
|---|---:|---:|---:|---:|---:|
| Inter 400 | 12050 | 12037 | 0 | 13 | 0 |
| Inter 700 | 12050 | 12037 | 0 | 13 | 0 |
| Inter 400 +0.5px | 12050 | 12035 | 0 | 15 | 0 |
| Roboto 400 | 11568 | 11562 | 0 | 6 | 0 |
| Shantell Sans 400 | 12050 | 11970 | 0 | 80 | 0 |
| Shantell Sans 700 | 12050 | 12001 | 0 | 49 | 0 |
| Inter Variable 300 | 11568 | 11555 | 0 | 13 | 0 |
| Inter Variable 400 | 11568 | 11554 | 0 | 14 | 0 |
| Inter Variable 500 | 11568 | 11549 | 0 | 19 | 0 |
| Inter Variable 600 | 11568 | 11547 | 0 | 21 | 0 |
| Inter Variable 700 | 11568 | 11549 | 0 | 19 | 0 |
| Inter Variable 800 | 11568 | 11542 | 0 | 26 | 0 |
| corpus latin | 34704 | 34696 | 0 | 8 | 0 |
| corpus german | 34704 | 34589 | 0 | 115 | 0 |
| corpus french | 34704 | 34594 | 0 | 110 | 0 |
| corpus specials | 37114 | 37059 | 0 | 55 | 0 |

Skipped (out of scope): 14 text × font pairs.

- specials "pictographic" in Roboto 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 300: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 500: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 600: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 700: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic" in Inter Variable 800: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Roboto 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 300: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 500: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 600: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 700: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Inter Variable 800: U+2194 ↔, U+25B6 ▶, U+2665 ♥

### headless-mismatch cases

None.

### pretext-gap cases

Not investigated case by case. Each is Pretext in Chromium against Chromium's painting, with Node agreeing with
Chromium-Pretext, so each is attributed to Pretext vs the DOM, not to the stand-in. That includes the Shantell Sans
cluster (most of the gaps, against about 0.1% of Inter cases), which is uninvestigated.

- Inter Variable 600 / latin "Latin update" @ 276px: Pretext 5, DOM 4
- Inter Variable 800 / latin "Latin update" @ 284px: Pretext 5, DOM 4
- Roboto 400 / latin "Latin short" @ 168px: Pretext 5, DOM 4
- Inter Variable 800 / latin "Latin short" @ 188px: Pretext 5, DOM 4
- Inter Variable 500 / latin "Latin punctuation" @ 134px: Pretext 10, DOM 9
- Roboto 400 / latin "Latin hyphenation" @ 198px: Pretext 5, DOM 4
- Inter Variable 600 / latin "Gatsby reserve" @ 128px: Pretext 13, DOM 12
- Inter Variable 800 / latin "Gatsby levity" @ 580px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Tagesabschluss" @ 140px: Pretext 7, DOM 6
- Shantell Sans 400 / german "Tagesabschluss" @ 204px: Pretext 5, DOM 4
- Shantell Sans 400 / german "Tagesabschluss" @ 380px: Pretext 3, DOM 2
- Inter 400 +0.5px / german "Nebenrollen" @ 222px: Pretext 5, DOM 4
- Inter 400 +0.5px / german "Nebenrollen" @ 418px: Pretext 3, DOM 2
- Shantell Sans 400 / german "Nebenrollen" @ 122px: Pretext 8, DOM 7
- Shantell Sans 400 / german "Nebenrollen" @ 212-214px: Pretext 5, DOM 4
- Shantell Sans 400 / german "Nebenrollen" @ 276px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Nebenrollen" @ 402px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Nebenrollen" @ 134px: Pretext 8, DOM 7
- Shantell Sans 700 / german "Nebenrollen" @ 232px: Pretext 5, DOM 4
- Shantell Sans 700 / german "Nebenrollen" @ 300px: Pretext 4, DOM 3
- Shantell Sans 700 / german "Nebenrollen" @ 436px: Pretext 3, DOM 2
- Inter Variable 300 / german "Nebenrollen" @ 120px: Pretext 8, DOM 7
- Inter Variable 400 / german "Nebenrollen" @ 122px: Pretext 8, DOM 7
- Inter Variable 500 / german "Nebenrollen" @ 270px: Pretext 4, DOM 3
- Inter Variable 600 / german "Nebenrollen" @ 214px: Pretext 5, DOM 4
- Inter Variable 600 / german "Nebenrollen" @ 272px: Pretext 4, DOM 3
- Inter Variable 600 / german "Nebenrollen" @ 402px: Pretext 3, DOM 2
- Inter Variable 700 / german "Nebenrollen" @ 216px: Pretext 5, DOM 4
- Inter Variable 700 / german "Nebenrollen" @ 276px: Pretext 4, DOM 3
- Inter Variable 700 / german "Nebenrollen" @ 406px: Pretext 3, DOM 2
- Inter Variable 800 / german "Nebenrollen" @ 278px: Pretext 4, DOM 3
- Inter Variable 800 / german "Nebenrollen" @ 410px: Pretext 3, DOM 2
- Inter 400 +0.5px / german "Datenschutz" @ 194px: Pretext 5, DOM 6
- Inter 400 +0.5px / german "Datenschutz" @ 466px: Pretext 2, DOM 3
- Shantell Sans 400 / german "Datenschutz" @ 126px: Pretext 10, DOM 9
- Shantell Sans 400 / german "Datenschutz" @ 190px: Pretext 6, DOM 5
- Shantell Sans 400 / german "Datenschutz" @ 328px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Datenschutz" @ 456px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Datenschutz" @ 148px: Pretext 8, DOM 7
- Inter Variable 300 / german "Datenschutz" @ 154px: Pretext 6, DOM 7
- Inter Variable 300 / german "Datenschutz" @ 430px: Pretext 2, DOM 3
- Inter Variable 400 / german "Datenschutz" @ 226px: Pretext 4, DOM 5
- Inter Variable 400 / german "Datenschutz" @ 316px: Pretext 3, DOM 4
- Inter Variable 500 / german "Datenschutz" @ 186px: Pretext 5, DOM 6
- Inter Variable 500 / german "Datenschutz" @ 444px: Pretext 2, DOM 3
- Inter Variable 600 / german "Datenschutz" @ 162px: Pretext 6, DOM 7
- Inter Variable 600 / german "Datenschutz" @ 450px: Pretext 2, DOM 3
- Inter Variable 800 / german "Datenschutz" @ 464px: Pretext 2, DOM 3
- Shantell Sans 400 / german "Umfrage" @ 134px: Pretext 8, DOM 7
- Shantell Sans 400 / german "Umfrage" @ 220px: Pretext 4, DOM 5
- Shantell Sans 400 / german "Umfrage" @ 412px: Pretext 3, DOM 2
- Inter 400 / german "Versicherung" @ 216px: Pretext 4, DOM 5
- Inter 700 / german "Versicherung" @ 216px: Pretext 4, DOM 5
- Shantell Sans 400 / german "Versicherung" @ 134px: Pretext 7, DOM 8
- Shantell Sans 400 / german "Versicherung" @ 152px: Pretext 6, DOM 7
- Shantell Sans 400 / german "Versicherung" @ 426-428px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Versicherung" @ 146px: Pretext 7, DOM 8
- Shantell Sans 700 / german "Versicherung" @ 466px: Pretext 3, DOM 2
- Inter 400 / german "Kapitän" @ 176px: Pretext 5, DOM 6
- Inter 700 / german "Kapitän" @ 176px: Pretext 5, DOM 6
- Inter 400 +0.5px / german "Kapitän" @ 186px: Pretext 5, DOM 6
- Shantell Sans 400 / german "Kapitän" @ 286px: Pretext 4, DOM 3
- Shantell Sans 700 / german "Kapitän" @ 148px: Pretext 7, DOM 8
- Inter Variable 400 / german "Kapitän" @ 136px: Pretext 7, DOM 8
- Inter Variable 400 / german "Kapitän" @ 178px: Pretext 5, DOM 6
- Inter Variable 500 / german "Kapitän" @ 180px: Pretext 5, DOM 6
- Inter Variable 600 / german "Kapitän" @ 182px: Pretext 5, DOM 6
- Inter Variable 700 / german "Kapitän" @ 132px: Pretext 8, DOM 9
- Inter Variable 700 / german "Kapitän" @ 184px: Pretext 5, DOM 6
- Shantell Sans 400 / german "Fehlermeldung" @ 120px: Pretext 7, DOM 6
- Shantell Sans 400 / german "Fehlermeldung" @ 326px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Fehlermeldung" @ 248px: Pretext 3, DOM 4
- Inter Variable 800 / german "Fehlermeldung" @ 336px: Pretext 2, DOM 3
- Inter 400 / german "Baustellen" @ 180px: Pretext 5, DOM 6
- Inter 400 / german "Baustellen" @ 284px: Pretext 3, DOM 4
- Inter 700 / german "Baustellen" @ 180px: Pretext 5, DOM 6
- Inter 700 / german "Baustellen" @ 284px: Pretext 3, DOM 4
- Inter 400 +0.5px / german "Baustellen" @ 302px: Pretext 3, DOM 4
- Shantell Sans 400 / german "Baustellen" @ 188px: Pretext 6, DOM 5
- Shantell Sans 400 / german "Baustellen" @ 296px: Pretext 4, DOM 3
- Shantell Sans 700 / german "Baustellen" @ 120px: Pretext 11, DOM 10
- Shantell Sans 700 / german "Baustellen" @ 130px: Pretext 8, DOM 9
- Shantell Sans 400 / german "Förderung" @ 160px: Pretext 7, DOM 6
- Shantell Sans 400 / german "Förderung" @ 186px: Pretext 5, DOM 6
- Shantell Sans 700 / german "Förderung" @ 176px: Pretext 7, DOM 6
- Shantell Sans 700 / german "Förderung" @ 488px: Pretext 2, DOM 3
- Inter Variable 800 / german "Förderung" @ 188px: Pretext 6, DOM 5
- Inter Variable 800 / german "Förderung" @ 244px: Pretext 4, DOM 5
- Shantell Sans 400 / german "Produktion" @ 126px: Pretext 7, DOM 8
- Shantell Sans 400 / german "Produktion" @ 272px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Produktion" @ 406px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Produktion" @ 236px: Pretext 5, DOM 4
- Inter Variable 700 / german "Produktion" @ 220px: Pretext 5, DOM 4
- Shantell Sans 400 / german "One word" @ 578-582px: Pretext 2, DOM 1
- Shantell Sans 700 / german "One word" @ 232px: Pretext 3, DOM 4
- Inter Variable 500 / german "One word" @ 582px: Pretext 1, DOM 2
- Inter 400 / german "Portal" @ 230px: Pretext 4, DOM 5
- Inter 400 / german "Portal" @ 420px: Pretext 2, DOM 3
- Inter 700 / german "Portal" @ 230px: Pretext 4, DOM 5
- Inter 700 / german "Portal" @ 420px: Pretext 2, DOM 3
- Inter 400 +0.5px / german "Portal" @ 140px: Pretext 7, DOM 8
- Shantell Sans 400 / german "Portal" @ 140px: Pretext 8, DOM 7
- Shantell Sans 400 / german "Portal" @ 164px: Pretext 7, DOM 6
- Shantell Sans 700 / german "Portal" @ 120px: Pretext 10, DOM 9
- Shantell Sans 700 / german "Portal" @ 476px: Pretext 2, DOM 3
- Inter Variable 300 / german "Portal" @ 226px: Pretext 4, DOM 5
- Inter Variable 400 / german "Portal" @ 422px: Pretext 2, DOM 3
- Inter Variable 500 / german "Portal" @ 156px: Pretext 6, DOM 7
- Inter Variable 500 / german "Portal" @ 428px: Pretext 2, DOM 3
- Inter Variable 600 / german "Portal" @ 136px: Pretext 7, DOM 8
- Inter Variable 600 / german "Portal" @ 158px: Pretext 6, DOM 7
- Inter Variable 600 / german "Portal" @ 182px: Pretext 5, DOM 6
- Inter Variable 600 / german "Portal" @ 434px: Pretext 2, DOM 3
- Inter Variable 700 / german "Portal" @ 138px: Pretext 7, DOM 8
- Inter Variable 700 / german "Portal" @ 302px: Pretext 3, DOM 4
- Inter Variable 700 / german "Portal" @ 440px: Pretext 2, DOM 3
- Inter Variable 800 / german "Portal" @ 164px: Pretext 6, DOM 7
- Inter Variable 800 / german "Portal" @ 188px: Pretext 5, DOM 6
- Inter Variable 800 / german "Portal" @ 308px: Pretext 3, DOM 4
- Shantell Sans 700 / french "Confidentialité" @ 324px: Pretext 2, DOM 1
- Shantell Sans 400 / french "Enregistrer" @ 162px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Enregistrer" @ 236px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Enregistrer" @ 464px: Pretext 2, DOM 1
- Shantell Sans 400 / french "Synchroniser" @ 156px: Pretext 6, DOM 5
- Shantell Sans 400 / french "Synchroniser" @ 362px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Synchroniser" @ 170px: Pretext 6, DOM 5
- Shantell Sans 700 / french "Synchroniser" @ 204px: Pretext 5, DOM 4
- Inter Variable 600 / french "Synchroniser" @ 252px: Pretext 3, DOM 4
- Shantell Sans 400 / french "Rappels" @ 194px: Pretext 5, DOM 4
- Shantell Sans 700 / french "Rappels" @ 120px: Pretext 9, DOM 8
- Inter 400 / french "Justificatifs" @ 264px: Pretext 3, DOM 2
- Inter 700 / french "Justificatifs" @ 264px: Pretext 3, DOM 2
- Inter 400 +0.5px / french "Justificatifs" @ 282px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Justificatifs" @ 120px: Pretext 6, DOM 5
- Shantell Sans 400 / french "Justificatifs" @ 522px: Pretext 2, DOM 1
- Shantell Sans 700 / french "Justificatifs" @ 568px: Pretext 2, DOM 1
- Inter Variable 400 / french "Justificatifs" @ 264px: Pretext 3, DOM 2
- Inter Variable 800 / french "Justificatifs" @ 540px: Pretext 2, DOM 1
- Inter 400 / french "Autorisations" @ 248px: Pretext 2, DOM 3
- Inter 700 / french "Autorisations" @ 248px: Pretext 2, DOM 3
- Inter 400 +0.5px / french "Autorisations" @ 264px: Pretext 2, DOM 3
- Roboto 400 / french "Autorisations" @ 452px: Pretext 1, DOM 2
- Shantell Sans 400 / french "Autorisations" @ 494-496px: Pretext 2, DOM 1
- Shantell Sans 700 / french "Autorisations" @ 192px: Pretext 4, DOM 3
- Shantell Sans 700 / french "Autorisations" @ 542px: Pretext 2, DOM 1
- Inter Variable 400 / french "Autorisations" @ 248px: Pretext 2, DOM 3
- Inter Variable 600 / french "Autorisations" @ 254px: Pretext 2, DOM 3
- Inter 400 +0.5px / french "Responsabilité" @ 148px: Pretext 7, DOM 8
- Inter 400 +0.5px / french "Responsabilité" @ 260px: Pretext 4, DOM 5
- Shantell Sans 400 / french "Responsabilité" @ 308px: Pretext 4, DOM 3
- Shantell Sans 700 / french "Responsabilité" @ 158px: Pretext 7, DOM 8
- Shantell Sans 700 / french "Responsabilité" @ 216px: Pretext 6, DOM 5
- Shantell Sans 700 / french "Responsabilité" @ 336px: Pretext 4, DOM 3
- Inter Variable 300 / french "Responsabilité" @ 156px: Pretext 6, DOM 7
- Inter Variable 300 / french "Responsabilité" @ 296px: Pretext 3, DOM 4
- Inter Variable 300 / french "Responsabilité" @ 454px: Pretext 3, DOM 2
- Inter Variable 500 / french "Responsabilité" @ 192px: Pretext 5, DOM 6
- Inter Variable 600 / french "Responsabilité" @ 162px: Pretext 6, DOM 7
- Inter Variable 800 / french "Responsabilité" @ 166px: Pretext 6, DOM 7
- Inter 400 / french "Syndicats" @ 160-164px: Pretext 5, DOM 6
- Inter 400 / french "Syndicats" @ 204px: Pretext 4, DOM 5
- Inter 700 / french "Syndicats" @ 160-164px: Pretext 5, DOM 6
- Inter 700 / french "Syndicats" @ 204px: Pretext 4, DOM 5
- Inter 400 +0.5px / french "Syndicats" @ 170-174px: Pretext 5, DOM 6
- Roboto 400 / french "Syndicats" @ 150px: Pretext 5, DOM 6
- Shantell Sans 400 / french "Syndicats" @ 142px: Pretext 7, DOM 6
- Shantell Sans 400 / french "Syndicats" @ 164-168px: Pretext 5, DOM 6
- Shantell Sans 400 / french "Syndicats" @ 208px: Pretext 5, DOM 4
- Shantell Sans 400 / french "Syndicats" @ 264px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Syndicats" @ 394px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Syndicats" @ 146px: Pretext 7, DOM 8
- Shantell Sans 700 / french "Syndicats" @ 178-184px: Pretext 5, DOM 6
- Inter Variable 300 / french "Syndicats" @ 158-164px: Pretext 5, DOM 6
- Inter Variable 400 / french "Syndicats" @ 160-166px: Pretext 5, DOM 6
- Inter Variable 500 / french "Syndicats" @ 162-168px: Pretext 5, DOM 6
- Inter Variable 600 / french "Syndicats" @ 164-170px: Pretext 5, DOM 6
- Inter Variable 700 / french "Syndicats" @ 166-172px: Pretext 5, DOM 6
- Inter Variable 800 / french "Syndicats" @ 170-174px: Pretext 5, DOM 6
- Inter Variable 800 / french "Syndicats" @ 218px: Pretext 4, DOM 5
- Shantell Sans 400 / french "Anticonstitutionnalité" @ 378px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Anticonstitutionnalité" @ 128px: Pretext 8, DOM 7
- Shantell Sans 700 / french "Anticonstitutionnalité" @ 214px: Pretext 4, DOM 5
- Inter Variable 300 / french "Anticonstitutionnalité" @ 246px: Pretext 4, DOM 3
- Inter Variable 800 / french "Anticonstitutionnalité" @ 260px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Conditions" @ 350px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Conditions" @ 142px: Pretext 6, DOM 7
- Shantell Sans 700 / french "Conditions" @ 382px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Mot de passe" @ 176px: Pretext 5, DOM 4
- Inter Variable 400 / french "Mot de passe" @ 136px: Pretext 5, DOM 6
- Inter Variable 500 / french "Mot de passe" @ 138px: Pretext 5, DOM 6
- Inter 400 +0.5px / french "Récit" @ 340px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Récit" @ 244px: Pretext 5, DOM 4
- Shantell Sans 700 / french "Récit" @ 132px: Pretext 10, DOM 9
- Shantell Sans 700 / french "Récit" @ 182px: Pretext 7, DOM 6
- Shantell Sans 700 / french "Récit" @ 530px: Pretext 3, DOM 2
- Inter Variable 300 / french "Récit" @ 312px: Pretext 4, DOM 3
- Inter Variable 700 / french "Récit" @ 124px: Pretext 10, DOM 9
- Inter Variable 700 / french "Récit" @ 332px: Pretext 4, DOM 3
- Inter Variable 800 / french "Récit" @ 126px: Pretext 10, DOM 9
- Inter Variable 800 / french "Récit" @ 138px: Pretext 9, DOM 8
- Inter 400 / specials "quoted labels" @ 120px: Pretext 9, DOM 8
- Inter 700 / specials "quoted labels" @ 120px: Pretext 9, DOM 8
- Shantell Sans 400 / specials "quoted labels" @ 120px: Pretext 10, DOM 8
- Shantell Sans 400 / specials "quoted labels" @ 156px: Pretext 8, DOM 7
- Shantell Sans 400 / specials "quoted labels" @ 458px: Pretext 3, DOM 2
- Shantell Sans 700 / specials "quoted labels" @ 128-130px: Pretext 10, DOM 9
- Inter Variable 400 / specials "quoted labels" @ 120px: Pretext 9, DOM 8
- Inter Variable 500 / specials "quoted labels" @ 122px: Pretext 9, DOM 8
- Inter Variable 500 / specials "quoted labels" @ 152px: Pretext 8, DOM 7
- Inter Variable 600 / specials "quoted labels" @ 124px: Pretext 9, DOM 8
- Inter Variable 600 / specials "quoted labels" @ 154px: Pretext 8, DOM 7
- Inter Variable 700 / specials "quoted labels" @ 126px: Pretext 9, DOM 8
- Inter Variable 700 / specials "quoted labels" @ 156px: Pretext 8, DOM 7
- Inter Variable 800 / specials "quoted labels" @ 128px: Pretext 10, DOM 9
- Inter Variable 800 / specials "quoted labels" @ 130px: Pretext 9, DOM 8
- Shantell Sans 400 / specials "quoted abonnieren" @ 120px: Pretext 3, DOM 2
- Roboto 400 / specials "ellipsis" @ 172px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "ellipsis" @ 188-190px: Pretext 6, DOM 5
- Shantell Sans 700 / specials "ellipsis" @ 206-208px: Pretext 6, DOM 5
- Inter Variable 500 / specials "ellipsis" @ 186px: Pretext 6, DOM 5
- Inter Variable 700 / specials "ellipsis" @ 192px: Pretext 6, DOM 5
- Inter Variable 800 / specials "ellipsis" @ 122px: Pretext 10, DOM 9
- Inter Variable 800 / specials "ellipsis" @ 196px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "ZWSP compound" @ 132px: Pretext 5, DOM 4
- Shantell Sans 400 / specials "ZWSP compound" @ 240px: Pretext 3, DOM 2
- Shantell Sans 400 / specials "ZWSP compound" @ 458px: Pretext 2, DOM 1
- Shantell Sans 700 / specials "ZWSP compound" @ 262px: Pretext 3, DOM 2
- Shantell Sans 400 / specials "ZWSP URL" @ 132px: Pretext 8, DOM 7
- Shantell Sans 400 / specials "ZWSP URL" @ 190px: Pretext 6, DOM 7
- Shantell Sans 400 / specials "ZWSP URL" @ 204px: Pretext 5, DOM 6
- Shantell Sans 400 / specials "ZWSP URL" @ 238px: Pretext 5, DOM 4
- Shantell Sans 400 / specials "ZWSP URL" @ 272px: Pretext 3, DOM 4
- Shantell Sans 400 / specials "ZWSP URL" @ 394px: Pretext 2, DOM 3
- Shantell Sans 700 / specials "ZWSP URL" @ 120px: Pretext 10, DOM 9
- Shantell Sans 700 / specials "ZWSP URL" @ 142px: Pretext 8, DOM 7
- Shantell Sans 700 / specials "ZWSP URL" @ 432px: Pretext 2, DOM 3
- Inter Variable 800 / specials "ZWSP URL" @ 142px: Pretext 8, DOM 7
- Roboto 400 / specials "quoted labels (SHY)" @ 156px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 132px: Pretext 7, DOM 8
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 156px: Pretext 7, DOM 6
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 174px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 222px: Pretext 5, DOM 4
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 286px: Pretext 4, DOM 3
- Shantell Sans 700 / specials "quoted labels (SHY)" @ 172px: Pretext 7, DOM 6
- Inter Variable 500 / specials "quoted labels (SHY)" @ 214px: Pretext 4, DOM 5
- Inter Variable 700 / specials "quoted labels (SHY)" @ 156px: Pretext 7, DOM 6
- Shantell Sans 700 / specials "quoted abonnieren (SHY)" @ 138px: Pretext 2, DOM 3
- Shantell Sans 400 / specials "quoted Tagesabschluss (SHY)" @ 184px: Pretext 2, DOM 1
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 150px: Pretext 6, DOM 7
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 300px: Pretext 4, DOM 3
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 442px: Pretext 3, DOM 2
- Inter Variable 500 / specials "ellipsis (SHY)" @ 438px: Pretext 2, DOM 3

### unreliable cases

None.

## U+2028 and U+2029

Chromium measures every U+2029 string exactly as the same string with U+2028 in 432 of
432 family × weight × size × spacing cases (U+2029 alone, "a¶b", "x¶T¶x"): it draws U+2029 with the space glyph
and without a word cut, as it does U+2028 (in Roboto "x¶T¶x" kerns T with the space glyph, narrower than "x T x").
The stand-in already treats U+2029 so; no change was needed.

Chromium / stand-in widths at 400 16px, no spacing (NaN: out of scope):

| family | " " | "a b" | "a⏎b" U+2028 | "a¶b" U+2029 | U+2028 | U+2029 | "x T x" | "x␤T␤x" U+2028 | "x¶T¶x" U+2029 |
|---|---|---|---|---|---|---|---|---|---|
| HX Inter | 4.5 / 4.5 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 4.5 / 4.5 | 4.5 / 4.5 | 36.796875 / 36.796875 | 36.796875 / 36.796875 | 36.796875 / 36.796875 |
| HX Inter WOFF2 | 4.5 / 4.5 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 4.5 / 4.5 | 4.5 / 4.5 | 36.796875 / 36.796875 | 36.796875 / 36.796875 | 36.796875 / 36.796875 |
| HX Roboto | 3.960938 / 3.960938 | 21.640625 / 21.640625 | 21.640625 / 21.640625 | 21.640625 / 21.640625 | 3.960938 / 3.960938 | 3.960938 / 3.960938 | 33.328125 / 33.328125 | 32.703125 / 32.703125 | 32.703125 / 32.703125 |
| HX Shantell Sans | 5.455994 / 5.455994 | 24.831985 / 24.831985 | 24.831985 / 24.831985 | 24.831985 / 24.831985 | 5.455994 / 5.455994 | 5.455994 / 5.455994 | 37.455978 / 37.455978 | 37.455978 / 37.455978 | 37.455978 / 37.455978 |
| HX Inter Variable | 4.5 / 4.5 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 4.5 / 4.5 | 4.5 / 4.5 | 36.796875 / 36.796875 | 36.796875 / 36.796875 | 36.796875 / 36.796875 |

## Synthetic bold

HX Inter, HX Inter WOFF2, HX Roboto at 600 and 700, synthesized by Chromium from the one 400 face, against Chromium's own 400 width of
the same string, size and spacing: 2480 of 2480 equal, so synthetic bold does not change Canvas advances
here. In the DOM, Inter 700 paints the same line count as Inter 400 in 12050 of 12050
text × width cases.

## Mutants

Each mutant is a copy of src/headless under verify/dist/mutants with one edit (src itself is never edited), run as the
Node side of the same sweep against the same Chromium data. A mutant is caught when it produces widths beyond the bar
or line-count headless-mismatches; the first two must produce line-count headless-mismatches. Dropping the U+0020
cut cannot change a Pretext line count: Pretext measures each space as a segment of its own and never hands Canvas a
U+0020 beside other text (0 of the 2254 distinct strings it measured for the line cases here),
so only the width sweep sees it, through Roboto, which kerns with the space glyph.

| mutant | edit in canvas.ts | width cases > 0.02px | max abs Δ px | headless-mismatch | caught |
|---|---|---:|---:|---:|---|
| drop kerning | `if (fontKerning === 'none') features.push(new Feature('kern', 0))` → `features.push(new Feature('kern', 0))` | 4332 | 14.700104 | 2283 | yes |
| ignore weight | `findFaces(parsed.families[i]!, parsed.weight, style)` → `findFaces(parsed.families[i]!, 400, style)` | 848 | 34.3797 | 2988 | yes |
| drop the U+0020 word cut | `return codePoint === 0x20 \|\| codePoint === ZWSP \|\|` → `return codePoint === ZWSP \|\|` | 192 | 2.58284 | 0 | yes |

- drop kerning, e.g. Inter 400 / latin "Latin update" @ 136px: Node 9, Chromium-Pretext 8
- ignore weight, e.g. Shantell Sans 700 / latin "Latin update" @ 128px: Node 10, Chromium-Pretext 11

## Variable-font advances against fontTools

`npm run verify:hvar` (verify/hvar-fonttools.py and verify/hvar-fonttools.ts), run 2026-10-06 with fontTools 4.62.1
(pinned; `pip install fonttools==4.62.1 brotli`) and the same Node and machine as above. Not a Chromium
measurement: fontTools evaluates hmtx + HVAR (VarStoreInstancer, unrounded) at fontTools' own normalized
coordinates, and `variedAdvance` in src/headless/hvar.ts is run on the same coordinates for every glyph.
Axis locations per font: each axis at min, default, max, three off-grid values, an integer grid of 17 points across
the axis and 30 seeded random fractional values, with the others at default, plus 40 seeded random combinations of
those, de-duplicated (so the `wght`-only file is checked at 50 distinct weights).

| font (@fontsource-variable/inter 5.3.0, latin) | axes | instances | glyph x instance | max advance diff |
|---|---|---:|---:|---:|
| inter-latin-wght-normal.woff2 | wght | 50 | 25900 | 0 |
| inter-latin-opsz-normal.woff2 | opsz, wght | 138 | 71484 | 0 |
| inter-latin-standard-normal.woff2 | opsz, wght | 138 | 71484 | 0 |
| **total** | | **326** | **168868** | **0 font units** |

`normalizedCoords` against fontTools' normalization: at most 1/16384 apart (OpenType 1.9.1's 16.16 precision rules
against fontTools' single rounding; the stand-in follows the former, as CoreText does), checked at the same
locations. The check fails above 1e-6 font units or 1 coordinate step.

Not covered by the committed set: `wdth` (Inter has no such axis) and axes beyond `opsz` and `wght`.

**Local-only, not reproducible from the repository:** `npm run verify:hvar -- /System/Library/Fonts/SFNS.ttf`
(macOS 14.6.1's San Francisco variable font; Apple's font is not in this repository and its result is not part of
any claim the package makes): axes wdth, opsz, GRAD, wght (avar 1), 2935 glyphs, 240 instances, 704400 glyph x
instance, max advance diff 0 font units, max coordinate diff 1/16384.

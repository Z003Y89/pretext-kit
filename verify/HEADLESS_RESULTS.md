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

## Widths

54 strings × 5 families × weights 400/600/700 (HX Inter Variable: 300/400/500/600/700/800) × sizes 12/14/16/20px ×
letter spacing 0px/0.5px: **7344 cases, 4268 exact, max |Δ| 0.055115px,
232 beyond 0.02px.** Chromium's OffscreenCanvas `measureText` against the stand-in's.

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
| HX Inter Variable | 2352 | 426 | 0.055115 | 232 |

Variable font (@fontsource-variable/inter 5.3.0, its latin subset as one variable face, wght 100-900;
loaded in Chromium with `font-weight: 100 900`, registered in Node with no weight so the stand-in reads the axis) by
instance: widths as above, line counts as in the next section.

| instance | width cases | exact | max abs Δ px | > 0.02px | line cases | headless-mismatch | pretext-gap |
|---|---:|---:|---:|---:|---:|---:|---:|
| HX Inter Variable 300 | 392 | 34 | 0.029114 | 6 | 11568 | 1 | 13 |
| HX Inter Variable 400 | 392 | 392 | 0 | 0 | 11568 | 0 | 14 |
| HX Inter Variable 500 | 392 | 0 | 0.052979 | 60 | 11568 | 4 | 19 |
| HX Inter Variable 600 | 392 | 0 | 0.04541 | 36 | 11568 | 0 | 21 |
| HX Inter Variable 700 | 392 | 0 | 0.040039 | 44 | 11568 | 3 | 17 |
| HX Inter Variable 800 | 392 | 0 | 0.055115 | 86 | 11568 | 3 | 25 |

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

- "abonnieren" 500 16px "HX Inter Variable" spacing 0px: Chromium 223.515274, stand-in 223.535934
- "abonnieren" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 237.515274, stand-in 237.535934
- "abonnieren" 500 20px "HX Inter Variable" spacing 0px: Chromium 279.394165, stand-in 279.419922
- "abonnieren" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 293.394165, stand-in 293.419922
- "abonnieren" 700 20px "HX Inter Variable" spacing 0px: Chromium 288.00708, stand-in 287.986328
- "abonnieren" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 302.00708, stand-in 301.986328
- "quoted abonnieren" 500 14px "HX Inter Variable" spacing 0px: Chromium 207.877243, stand-in 207.898636
- "quoted abonnieren" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 222.877243, stand-in 222.898636
- "quoted abonnieren" 500 16px "HX Inter Variable" spacing 0px: Chromium 237.573959, stand-in 237.598434
- "quoted abonnieren" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 252.573959, stand-in 252.598434
- "quoted abonnieren" 500 20px "HX Inter Variable" spacing 0px: Chromium 296.967529, stand-in 296.998047
- "quoted abonnieren" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 311.967529, stand-in 311.998047
- "quoted Tagesabschluss" 600 16px "HX Inter Variable" spacing 0px: Chromium 193.96582, stand-in 193.943756
- "quoted Tagesabschluss" 600 16px "HX Inter Variable" spacing 0.5px: Chromium 205.46582, stand-in 205.443756
- "quoted Tagesabschluss" 600 20px "HX Inter Variable" spacing 0px: Chromium 242.45726, stand-in 242.429688
- "quoted Tagesabschluss" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 253.95726, stand-in 253.929688
- "quoted Tagesabschluss" 700 20px "HX Inter Variable" spacing 0px: Chromium 247.182098, stand-in 247.160156
- "quoted Tagesabschluss" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 258.682098, stand-in 258.660156
- "quoted Tagesabschluss" 800 14px "HX Inter Variable" spacing 0px: Chromium 177.070435, stand-in 177.049408
- "quoted Tagesabschluss" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 188.570435, stand-in 188.549408
- "quoted Tagesabschluss" 800 16px "HX Inter Variable" spacing 0px: Chromium 202.366318, stand-in 202.342194
- "quoted Tagesabschluss" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 213.866318, stand-in 213.842194
- "quoted Tagesabschluss" 800 20px "HX Inter Variable" spacing 0px: Chromium 252.957947, stand-in 252.927734
- "quoted Tagesabschluss" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 264.457947, stand-in 264.427734
- "Donaudampf" 800 20px "HX Inter Variable" spacing 0px: Chromium 318.380981, stand-in 318.403931
- "Donaudampf" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 332.880981, stand-in 332.903931
- "Grundstück" 600 12px "HX Inter Variable" spacing 0px: Chromium 205.809341, stand-in 205.782181
- "Grundstück" 600 12px "HX Inter Variable" spacing 0.5px: Chromium 220.809341, stand-in 220.782181
- "Grundstück" 600 14px "HX Inter Variable" spacing 0px: Chromium 240.111008, stand-in 240.079224
- "Grundstück" 600 14px "HX Inter Variable" spacing 0.5px: Chromium 255.111008, stand-in 255.079224
- "Grundstück" 600 16px "HX Inter Variable" spacing 0px: Chromium 274.412598, stand-in 274.376251
- "Grundstück" 600 16px "HX Inter Variable" spacing 0.5px: Chromium 289.412598, stand-in 289.376251
- "Grundstück" 600 20px "HX Inter Variable" spacing 0px: Chromium 343.015717, stand-in 342.970306
- "Grundstück" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 358.015717, stand-in 357.970306
- "Grundstück" 800 12px "HX Inter Variable" spacing 0px: Chromium 212.859787, stand-in 212.827499
- "Grundstück" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 227.859787, stand-in 227.827499
- "Grundstück" 800 14px "HX Inter Variable" spacing 0px: Chromium 248.336456, stand-in 248.298752
- "Grundstück" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 263.336456, stand-in 263.298767
- "Grundstück" 800 16px "HX Inter Variable" spacing 0px: Chromium 283.813141, stand-in 283.77002
- "Grundstück" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 298.813141, stand-in 298.77002
- "Grundstück" 800 20px "HX Inter Variable" spacing 0px: Chromium 354.766479, stand-in 354.712494
- "Grundstück" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 369.766479, stand-in 369.712494
- "ellipsis" 500 20px "HX Inter Variable" spacing 0px: Chromium 145.005096, stand-in 145.025391
- "ellipsis" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 151.505096, stand-in 151.525391
- "Einstellungen" 500 12px "HX Inter Variable" spacing 0px: Chromium 221.247604, stand-in 221.277191
- "Einstellungen" 500 12px "HX Inter Variable" spacing 0.5px: Chromium 239.247604, stand-in 239.277191
- "Einstellungen" 500 14px "HX Inter Variable" spacing 0px: Chromium 258.122314, stand-in 258.156738
- "Einstellungen" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 276.122314, stand-in 276.156738
- "Einstellungen" 500 16px "HX Inter Variable" spacing 0px: Chromium 294.996948, stand-in 295.036255
- "Einstellungen" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 312.996948, stand-in 313.036255
- "Einstellungen" 500 20px "HX Inter Variable" spacing 0px: Chromium 368.746216, stand-in 368.795319
- "Einstellungen" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 386.746216, stand-in 386.795319
- "Einstellungen" 600 14px "HX Inter Variable" spacing 0px: Chromium 261.920624, stand-in 261.90036
- "Einstellungen" 600 14px "HX Inter Variable" spacing 0.5px: Chromium 279.920624, stand-in 279.900391
- "Einstellungen" 600 16px "HX Inter Variable" spacing 0px: Chromium 299.337891, stand-in 299.314697
- "Einstellungen" 600 16px "HX Inter Variable" spacing 0.5px: Chromium 317.337891, stand-in 317.314697
- "Einstellungen" 600 20px "HX Inter Variable" spacing 0px: Chromium 374.172241, stand-in 374.143372
- "Einstellungen" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 392.172241, stand-in 392.143372
- "Einstellungen" 800 12px "HX Inter Variable" spacing 0px: Chromium 231.738846, stand-in 231.705933
- "Einstellungen" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 249.738846, stand-in 249.705933
- "Einstellungen" 800 14px "HX Inter Variable" spacing 0px: Chromium 270.362122, stand-in 270.323608
- "Einstellungen" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 288.362122, stand-in 288.323608
- "Einstellungen" 800 16px "HX Inter Variable" spacing 0px: Chromium 308.985352, stand-in 308.941254
- "Einstellungen" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 326.985352, stand-in 326.941254
- "Einstellungen" 800 20px "HX Inter Variable" spacing 0px: Chromium 386.231689, stand-in 386.176575
- "Einstellungen" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 404.231689, stand-in 404.176575
- "confidentialité" 500 12px "HX Inter Variable" spacing 0px: Chromium 219.196365, stand-in 219.228287
- "confidentialité" 500 12px "HX Inter Variable" spacing 0.5px: Chromium 237.696365, stand-in 237.728287
- "confidentialité" 500 14px "HX Inter Variable" spacing 0px: Chromium 255.729202, stand-in 255.766342
- "confidentialité" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 274.229187, stand-in 274.266357
- "confidentialité" 500 16px "HX Inter Variable" spacing 0px: Chromium 292.261963, stand-in 292.304382
- "confidentialité" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 310.761963, stand-in 310.804382
- "confidentialité" 500 20px "HX Inter Variable" spacing 0px: Chromium 365.327515, stand-in 365.380493
- "confidentialité" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 383.827515, stand-in 383.880493
- "confidentialité" 600 20px "HX Inter Variable" spacing 0px: Chromium 369.688416, stand-in 369.667236
- "confidentialité" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 388.188416, stand-in 388.167236
- "confidentialité" 800 16px "HX Inter Variable" spacing 0px: Chromium 303.504425, stand-in 303.482178
- "confidentialité" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 322.004425, stand-in 321.982178
- "confidentialité" 800 20px "HX Inter Variable" spacing 0px: Chromium 379.380493, stand-in 379.352722
- "confidentialité" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 397.880493, stand-in 397.852722
- "Enregistrer" 500 14px "HX Inter Variable" spacing 0px: Chromium 202.197464, stand-in 202.220428
- "Enregistrer" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 217.697464, stand-in 217.720428
- "Enregistrer" 500 16px "HX Inter Variable" spacing 0px: Chromium 231.082794, stand-in 231.109055
- "Enregistrer" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 246.582794, stand-in 246.609055
- "Enregistrer" 500 20px "HX Inter Variable" spacing 0px: Chromium 288.853516, stand-in 288.886322
- "Enregistrer" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 304.353516, stand-in 304.386322
- "Enregistrer" 700 14px "HX Inter Variable" spacing 0px: Chromium 207.729355, stand-in 207.709137
- "Enregistrer" 700 14px "HX Inter Variable" spacing 0.5px: Chromium 223.229355, stand-in 223.209137
- "Enregistrer" 700 16px "HX Inter Variable" spacing 0px: Chromium 237.404968, stand-in 237.381866
- "Enregistrer" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 252.904968, stand-in 252.881866
- "Enregistrer" 700 20px "HX Inter Variable" spacing 0px: Chromium 296.756317, stand-in 296.727325
- "Enregistrer" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 312.256317, stand-in 312.227325
- "anticonstitutionnalité" 500 12px "HX Inter Variable" spacing 0px: Chromium 128.807327, stand-in 128.830093
- "anticonstitutionnalité" 500 12px "HX Inter Variable" spacing 0.5px: Chromium 140.807327, stand-in 140.830093
- "anticonstitutionnalité" 500 14px "HX Inter Variable" spacing 0px: Chromium 150.275284, stand-in 150.301773
- "anticonstitutionnalité" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 162.275284, stand-in 162.301773
- "anticonstitutionnalité" 500 16px "HX Inter Variable" spacing 0px: Chromium 171.743195, stand-in 171.773453
- "anticonstitutionnalité" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 183.743195, stand-in 183.773453
- "anticonstitutionnalité" 500 20px "HX Inter Variable" spacing 0px: Chromium 214.678955, stand-in 214.716812
- "anticonstitutionnalité" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 226.678955, stand-in 226.716812
- "guillemets" 300 14px "HX Inter Variable" spacing 0px: Chromium 171.8806, stand-in 171.901031
- "guillemets" 300 14px "HX Inter Variable" spacing 0.5px: Chromium 183.8806, stand-in 183.901031
- "guillemets" 300 16px "HX Inter Variable" spacing 0px: Chromium 196.435043, stand-in 196.458344
- "guillemets" 300 16px "HX Inter Variable" spacing 0.5px: Chromium 208.435043, stand-in 208.458344
- "guillemets" 300 20px "HX Inter Variable" spacing 0px: Chromium 245.543793, stand-in 245.572906
- "guillemets" 300 20px "HX Inter Variable" spacing 0.5px: Chromium 257.543793, stand-in 257.572906
- "guillemets" 500 12px "HX Inter Variable" spacing 0px: Chromium 151.662064, stand-in 151.68515
- "guillemets" 500 12px "HX Inter Variable" spacing 0.5px: Chromium 163.662064, stand-in 163.68515
- "guillemets" 500 14px "HX Inter Variable" spacing 0px: Chromium 176.939194, stand-in 176.966019
- "guillemets" 500 14px "HX Inter Variable" spacing 0.5px: Chromium 188.939194, stand-in 188.966019
- "guillemets" 500 16px "HX Inter Variable" spacing 0px: Chromium 202.216156, stand-in 202.246872
- "guillemets" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 214.216156, stand-in 214.246872
- "guillemets" 500 20px "HX Inter Variable" spacing 0px: Chromium 252.770279, stand-in 252.808594
- "guillemets" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 264.770264, stand-in 264.808594
- "guillemets" 800 12px "HX Inter Variable" spacing 0px: Chromium 155.451462, stand-in 155.421097
- "guillemets" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 167.451462, stand-in 167.421097
- "guillemets" 800 14px "HX Inter Variable" spacing 0px: Chromium 181.360046, stand-in 181.3246
- "guillemets" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 193.360046, stand-in 193.3246
- "guillemets" 800 16px "HX Inter Variable" spacing 0px: Chromium 207.268723, stand-in 207.228119
- "guillemets" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 219.268723, stand-in 219.228119
- "guillemets" 800 20px "HX Inter Variable" spacing 0px: Chromium 259.085876, stand-in 259.035156
- "guillemets" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 271.085876, stand-in 271.035156
- "digits" 600 20px "HX Inter Variable" spacing 0px: Chromium 122.051743, stand-in 122.03125
- "digits" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 127.051743, stand-in 127.03125
- "times" 800 16px "HX Inter Variable" spacing 0px: Chromium 170.447174, stand-in 170.426559
- "times" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 180.947174, stand-in 180.926559
- "times" 800 20px "HX Inter Variable" spacing 0px: Chromium 213.058914, stand-in 213.033203
- "times" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 223.558914, stand-in 223.533203
- "brackets" 700 12px "HX Inter Variable" spacing 0px: Chromium 148.788635, stand-in 148.764725
- "brackets" 700 12px "HX Inter Variable" spacing 0.5px: Chromium 162.788635, stand-in 162.764725
- "brackets" 700 14px "HX Inter Variable" spacing 0px: Chromium 173.586823, stand-in 173.558853
- "brackets" 700 14px "HX Inter Variable" spacing 0.5px: Chromium 187.586823, stand-in 187.558853
- "brackets" 700 16px "HX Inter Variable" spacing 0px: Chromium 198.384979, stand-in 198.352982
- "brackets" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 212.384979, stand-in 212.352982
- "brackets" 700 20px "HX Inter Variable" spacing 0px: Chromium 247.981247, stand-in 247.941223
- "brackets" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 261.981262, stand-in 261.941223
- "curly quotes" 800 20px "HX Inter Variable" spacing 0px: Chromium 294.037476, stand-in 294.015625
- "curly quotes" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 308.537537, stand-in 308.515625
- "marks" 600 20px "HX Inter Variable" spacing 0px: Chromium 291.36969, stand-in 291.391052
- "marks" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 306.36969, stand-in 306.391052
- "marks" 800 12px "HX Inter Variable" spacing 0px: Chromium 180.826797, stand-in 180.802979
- "marks" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 195.826797, stand-in 195.802979
- "marks" 800 14px "HX Inter Variable" spacing 0px: Chromium 210.9646, stand-in 210.936768
- "marks" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 225.9646, stand-in 225.936768
- "marks" 800 16px "HX Inter Variable" spacing 0px: Chromium 241.102509, stand-in 241.070618
- "marks" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 256.102509, stand-in 256.070618
- "marks" 800 20px "HX Inter Variable" spacing 0px: Chromium 301.378143, stand-in 301.338257
- "marks" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 316.378143, stand-in 316.338257
- "AV pairs" 500 16px "HX Inter Variable" spacing 0px: Chromium 182.744949, stand-in 182.767365
- "AV pairs" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 193.244949, stand-in 193.267365
- "AV pairs" 500 20px "HX Inter Variable" spacing 0px: Chromium 228.431305, stand-in 228.459198
- "AV pairs" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 238.931305, stand-in 238.959198
- "AV pairs" 700 20px "HX Inter Variable" spacing 0px: Chromium 231.563431, stand-in 231.539551
- "AV pairs" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 242.063431, stand-in 242.039551
- "AV pairs" 800 14px "HX Inter Variable" spacing 0px: Chromium 163.434601, stand-in 163.413345
- "AV pairs" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 173.934601, stand-in 173.913345
- "AV pairs" 800 16px "HX Inter Variable" spacing 0px: Chromium 186.782425, stand-in 186.758102
- "AV pairs" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 197.282425, stand-in 197.258102
- "AV pairs" 800 20px "HX Inter Variable" spacing 0px: Chromium 233.478073, stand-in 233.447632
- "AV pairs" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 243.978073, stand-in 243.947632
- "LT pairs" 600 20px "HX Inter Variable" spacing 0px: Chromium 152.459229, stand-in 152.482056
- "LT pairs" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 160.959229, stand-in 160.982056
- "LT pairs" 700 20px "HX Inter Variable" spacing 0px: Chromium 152.668289, stand-in 152.64386
- "LT pairs" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 161.168289, stand-in 161.14386
- "LT pairs" 800 16px "HX Inter Variable" spacing 0px: Chromium 122.339294, stand-in 122.316864
- "LT pairs" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 130.839294, stand-in 130.816864
- "LT pairs" 800 20px "HX Inter Variable" spacing 0px: Chromium 152.924103, stand-in 152.896072
- "LT pairs" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 161.424103, stand-in 161.396072
- "AVATAR" 500 16px "HX Inter Variable" spacing 0px: Chromium 161.747299, stand-in 161.768478
- "AVATAR" 500 16px "HX Inter Variable" spacing 0.5px: Chromium 169.747299, stand-in 169.768478
- "AVATAR" 500 20px "HX Inter Variable" spacing 0px: Chromium 202.184189, stand-in 202.210556
- "AVATAR" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 210.184189, stand-in 210.210556
- "AVATAR" 600 16px "HX Inter Variable" spacing 0px: Chromium 163.963486, stand-in 163.943176
- "AVATAR" 600 16px "HX Inter Variable" spacing 0.5px: Chromium 171.963486, stand-in 171.943176
- "AVATAR" 600 20px "HX Inter Variable" spacing 0px: Chromium 204.954361, stand-in 204.928909
- "AVATAR" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 212.954361, stand-in 212.928909
- "AVATAR" 800 12px "HX Inter Variable" spacing 0px: Chromium 126.666534, stand-in 126.641678
- "AVATAR" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 134.666534, stand-in 134.641678
- "AVATAR" 800 14px "HX Inter Variable" spacing 0px: Chromium 147.777679, stand-in 147.748688
- "AVATAR" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 155.777679, stand-in 155.748688
- "AVATAR" 800 16px "HX Inter Variable" spacing 0px: Chromium 168.888718, stand-in 168.855606
- "AVATAR" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 176.888718, stand-in 176.855606
- "AVATAR" 800 20px "HX Inter Variable" spacing 0px: Chromium 211.110992, stand-in 211.069519
- "AVATAR" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 219.110992, stand-in 219.069519
- "office" 700 16px "HX Inter Variable" spacing 0px: Chromium 140.580063, stand-in 140.55751
- "office" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 150.580063, stand-in 150.55751
- "office" 700 20px "HX Inter Variable" spacing 0px: Chromium 175.72522, stand-in 175.696899
- "office" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 185.72522, stand-in 185.696899
- "office" 800 16px "HX Inter Variable" spacing 0px: Chromium 143.064087, stand-in 143.084702
- "office" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 153.064087, stand-in 153.084702
- "office" 800 20px "HX Inter Variable" spacing 0px: Chromium 178.830109, stand-in 178.855865
- "office" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 188.830109, stand-in 188.855865
- "fi fl" 600 20px "HX Inter Variable" spacing 0px: Chromium 81.266998, stand-in 81.287506
- "fi fl" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 87.766998, stand-in 87.787506
- "fi fl" 700 12px "HX Inter Variable" spacing 0px: Chromium 49.409821, stand-in 49.387268
- "fi fl" 700 12px "HX Inter Variable" spacing 0.5px: Chromium 55.909821, stand-in 55.887268
- "fi fl" 700 14px "HX Inter Variable" spacing 0px: Chromium 57.644882, stand-in 57.6185
- "fi fl" 700 14px "HX Inter Variable" spacing 0.5px: Chromium 64.144882, stand-in 64.1185
- "fi fl" 700 16px "HX Inter Variable" spacing 0px: Chromium 65.879807, stand-in 65.849701
- "fi fl" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 72.379807, stand-in 72.349701
- "fi fl" 700 20px "HX Inter Variable" spacing 0px: Chromium 82.349838, stand-in 82.312134
- "fi fl" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 88.849838, stand-in 88.812134
- "fi fl" 800 14px "HX Inter Variable" spacing 0px: Chromium 58.571381, stand-in 58.593842
- "fi fl" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 65.071381, stand-in 65.093842
- "fi fl" 800 16px "HX Inter Variable" spacing 0px: Chromium 66.938736, stand-in 66.964386
- "fi fl" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 73.438736, stand-in 73.464386
- "fi fl" 800 20px "HX Inter Variable" spacing 0px: Chromium 83.673416, stand-in 83.705475
- "fi fl" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 90.173416, stand-in 90.205475
- "Th st" 700 16px "HX Inter Variable" spacing 0px: Chromium 106.201569, stand-in 106.178757
- "Th st" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 113.701569, stand-in 113.678757
- "Th st" 700 20px "HX Inter Variable" spacing 0px: Chromium 132.752045, stand-in 132.72345
- "Th st" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 140.252045, stand-in 140.22345
- "ZWSP compound" 500 20px "HX Inter Variable" spacing 0px: Chromium 274.064484, stand-in 274.087891
- "ZWSP compound" 500 20px "HX Inter Variable" spacing 0.5px: Chromium 287.564484, stand-in 287.587891
- "SHY compound" 700 20px "HX Inter Variable" spacing 0px: Chromium 172.532913, stand-in 172.509766
- "SHY compound" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 181.032913, stand-in 181.009766
- "SHY Tages" 600 16px "HX Inter Variable" spacing 0px: Chromium 180.348419, stand-in 180.326569
- "SHY Tages" 600 16px "HX Inter Variable" spacing 0.5px: Chromium 190.848419, stand-in 190.826569
- "SHY Tages" 600 20px "HX Inter Variable" spacing 0px: Chromium 225.435501, stand-in 225.408203
- "SHY Tages" 600 20px "HX Inter Variable" spacing 0.5px: Chromium 235.935501, stand-in 235.908203
- "SHY Tages" 700 16px "HX Inter Variable" spacing 0px: Chromium 183.12413, stand-in 183.103119
- "SHY Tages" 700 16px "HX Inter Variable" spacing 0.5px: Chromium 193.62413, stand-in 193.603119
- "SHY Tages" 700 20px "HX Inter Variable" spacing 0px: Chromium 228.905319, stand-in 228.878906
- "SHY Tages" 700 20px "HX Inter Variable" spacing 0.5px: Chromium 239.405319, stand-in 239.378906
- "SHY Tages" 800 12px "HX Inter Variable" spacing 0px: Chromium 139.888031, stand-in 139.867966
- "SHY Tages" 800 12px "HX Inter Variable" spacing 0.5px: Chromium 150.388031, stand-in 150.367966
- "SHY Tages" 800 14px "HX Inter Variable" spacing 0px: Chromium 163.202744, stand-in 163.179291
- "SHY Tages" 800 14px "HX Inter Variable" spacing 0.5px: Chromium 173.702744, stand-in 173.679291
- "SHY Tages" 800 16px "HX Inter Variable" spacing 0px: Chromium 186.517517, stand-in 186.490631
- "SHY Tages" 800 16px "HX Inter Variable" spacing 0.5px: Chromium 197.017517, stand-in 196.990631
- "SHY Tages" 800 20px "HX Inter Variable" spacing 0px: Chromium 233.146957, stand-in 233.113281
- "SHY Tages" 800 20px "HX Inter Variable" spacing 0.5px: Chromium 243.646957, stand-in 243.613281

## Line counts

586 text × font pairs (336 with soft hyphens) × 241 widths (120-600px step
2), 16px on 24px lines. Fonts: Inter 400, Inter 700, Inter 400 +0.5px, Roboto 400, Shantell Sans 400, Shantell Sans 700, Inter Variable 300, Inter Variable 400, Inter Variable 500, Inter Variable 600, Inter Variable 700, Inter Variable 800.
**141226 cases: 11 headless-mismatch, 285 pretext-gap,
0 unreliable, 140930 pass.** Pretext in Node against Chromium's DOM directly: 293 differ
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
| Inter Variable 300 | 11568 | 11554 | 1 | 13 | 0 |
| Inter Variable 400 | 11568 | 11554 | 0 | 14 | 0 |
| Inter Variable 500 | 11568 | 11545 | 4 | 19 | 0 |
| Inter Variable 600 | 11568 | 11547 | 0 | 21 | 0 |
| Inter Variable 700 | 11568 | 11548 | 3 | 17 | 0 |
| Inter Variable 800 | 11568 | 11540 | 3 | 25 | 0 |
| corpus latin | 34704 | 34692 | 4 | 8 | 0 |
| corpus german | 34704 | 34585 | 5 | 114 | 0 |
| corpus french | 34704 | 34594 | 2 | 108 | 0 |
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

- Inter Variable 300 / latin "Latin caching" @ 176px: Node 7, Chromium-Pretext 6, DOM 6
- Inter Variable 700 / latin "Latin caching" @ 276px: Node 4, Chromium-Pretext 5, DOM 5
- Inter Variable 800 / latin "Latin punctuation" @ 194px: Node 6, Chromium-Pretext 7, DOM 7
- Inter Variable 800 / latin "Gatsby reserve" @ 144px: Node 11, Chromium-Pretext 12, DOM 12
- Inter Variable 700 / german "Nebenrollen" @ 276px: Node 3, Chromium-Pretext 4, DOM 3
- Inter Variable 500 / german "Umfrage" @ 288px: Node 4, Chromium-Pretext 3, DOM 3
- Inter Variable 500 / german "Kapitän" @ 152px: Node 7, Chromium-Pretext 6, DOM 6
- Inter Variable 500 / german "Förderung" @ 306px: Node 4, Chromium-Pretext 3, DOM 3
- Inter Variable 500 / german "Produktion" @ 404px: Node 3, Chromium-Pretext 2, DOM 2
- Inter Variable 800 / french "Justificatifs" @ 540px: Node 1, Chromium-Pretext 2, DOM 1
- Inter Variable 700 / french "Récit" @ 332px: Node 3, Chromium-Pretext 4, DOM 3

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
| drop kerning | `if (fontKerning === 'none') features.push(new Feature('kern', 0))` → `features.push(new Feature('kern', 0))` | 4334 | 14.700104 | 2285 | yes |
| ignore weight | `findFace(parsed.families[i]!, parsed.weight, style)` → `findFace(parsed.families[i]!, 400, style)` | 1080 | 34.3797 | 2999 | yes |
| drop the U+0020 word cut | `return codePoint === 0x20 \|\| codePoint === ZWSP \|\|` → `return codePoint === ZWSP \|\|` | 398 | 2.61087 | 11 | yes |

- drop kerning, e.g. Inter 400 / latin "Latin update" @ 136px: Node 9, Chromium-Pretext 8
- ignore weight, e.g. Shantell Sans 700 / latin "Latin update" @ 128px: Node 10, Chromium-Pretext 11
- drop the U+0020 word cut, e.g. Inter Variable 300 / latin "Latin caching" @ 176px: Node 7, Chromium-Pretext 6

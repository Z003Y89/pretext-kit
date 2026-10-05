# Headless parity sweep results

Run on 2026-10-05 by `npm run verify:headless` (verify/headless.ts).

- Chromium 149.0.7827.55 (Playwright 1.61.0, headed), `<html lang="en">`
- harfbuzzjs 1.6.2 (HarfBuzz 14.5.0), wawoff2 2.0.1
- Pretext 0.0.9 (../pretext f10d888), `setLocale('en')` on both sides
- Node v24.4.1, macOS 14.6.1 (Darwin 23.6.0), arm64

Fonts: test/fonts, loaded in Chromium through `@font-face` from the same files the stand-in registers, each
awaited with `document.fonts.load` and checked `loaded`: Inter-Regular.ttf as 400 "Inter", Inter-Regular.woff2 as 400 "Inter WOFF2", Roboto-Regular.ttf as 400 "Roboto", ShantellSans-Regular.ttf as 400 "Shantell Sans", ShantellSans-Bold.ttf as 700 "Shantell Sans".
Inter and Roboto have one face, so Chromium synthesizes 600 and 700; Shantell Sans has a 400 and a 700 face
(added for this sweep so that a stand-in ignoring the requested weight can be caught at all).

**Scope rule (fixed before the first run).** A (text, font) case is in scope exactly when the stand-in measures the
text in that font without `HeadlessCoverageError`: every code point is in a registered face's cmap, is
default-ignorable, or is U+2028/U+2029 in a face with a space glyph. Anything else Chromium draws from an OS
fallback font, which the stand-in does not claim to reproduce.

**Stand-in bug this sweep found, fixed in src/headless/canvas.ts.** Under letter spacing the stand-in added the spacing
after U+200B and every character Canvas turns into it (SHY, LRM, RLM, U+202A-U+202E, U+FEFF), where Chromium adds none
(Blink skips characters it treats as zero-width spaces): 288 width cases were 0.5px per such character too wide, up to
2.5px for a five-SHY word. Regression test: "letter spacing skips ZWSP and what Canvas turns into it" in
test/headless/canvas.test.ts, which fails without the fix. Pretext's own line counts never showed it: Pretext measures
those characters as segments of their own.

## Widths

51 strings × 4 families × weights 400/600/700 × sizes 12/14/16/20px ×
letter spacing 0px/0.5px: **4800 cases, 3688 exact, max |Δ| 0.000427px,
0 beyond 0.02px.** Chromium's OffscreenCanvas `measureText` against the stand-in's.

Strings: "Speichern", "Zahlungspflichtig abonnieren", "„Zahlungspflichtig abonnieren“", "„Tagesabschlussbericht“", "Donaudampfschifffahrtskapitän", "Grundstücksverkehrsgenehmigung", "Übergrößenträger ÄÖÜ äöü ß ẞ", "Wird geladen…", "Benutzerkontoeinstellungen speichern", "Paramètres de confidentialité avancés", "Enregistrer les modifications ?", "L’anticonstitutionnalité", "Œuvre « complète » — été", "Ça coûte 12,50 €", "0123456789", "1 234 567,89", "2026-10-05 17:42:09", "3.14159 × 2 = 6.28318", "Hello, world! (test) [x] {y}", "“Quoted” ‘single’ — dash – en", "Wait... what?! Yes; no: maybe.", "AV AVA Tw To Ty Wa Yo", "LT LY P. F, T. Vo", "AVATAR WAVY TYPO", "A V", "x T x", "office affine fluffy", "fi fl ffi ffl", "The first staff", "© 2026 Acme", "Acme®", "Brand™", "A ↔ B", "Play ▶", "I ♥ it", " ", "a b", "a\u2028b", "a\u2029b", "x\u2028T\u2028x", "x\u2029T\u2029x", "\u2028", "\u2029", "A\u200BV", "Zahlungs\u200Bpflichtig\u200Babonnieren", "A\u200EV", "A\uFEFFV", "Auf\u200Clage", "a\u200Db", "Zah\u00ADlungs\u00ADpflich\u00ADtig", "Ta\u00ADges\u00ADab\u00ADschluss\u00ADbe\u00ADricht".

Inter and Roboto (2048 units per em) measure bit-exact. Shantell Sans (1000 units per em) differs by under 0.0005px in
most cases: its advances are not dyadic fractions of a pixel, and Chromium rounds them differently from HarfBuzz's
1/65536 px; far below the bar and never a line count.

| family | cases | exact | max abs Δ px | > 0.02px |
|---|---:|---:|---:|---:|
| Inter | 1224 | 1224 | 0 | 0 |
| Inter WOFF2 | 1224 | 1224 | 0 | 0 |
| Roboto | 1128 | 1128 | 0 | 0 |
| Shantell Sans | 1224 | 112 | 0.000427 | 0 |

Skipped (out of scope): 12 string × font pairs.

- "umlauts" in 400 Roboto (8 cases): U+1E9E ẞ
- "umlauts" in 600 Roboto (8 cases): U+1E9E ẞ
- "umlauts" in 700 Roboto (8 cases): U+1E9E ẞ
- "A ↔ B" in 400 Roboto (8 cases): U+2194 ↔
- "A ↔ B" in 600 Roboto (8 cases): U+2194 ↔
- "A ↔ B" in 700 Roboto (8 cases): U+2194 ↔
- "Play ▶" in 400 Roboto (8 cases): U+25B6 ▶
- "Play ▶" in 600 Roboto (8 cases): U+25B6 ▶
- "Play ▶" in 700 Roboto (8 cases): U+25B6 ▶
- "I ♥ it" in 400 Roboto (8 cases): U+2665 ♥
- "I ♥ it" in 600 Roboto (8 cases): U+2665 ♥
- "I ♥ it" in 700 Roboto (8 cases): U+2665 ♥

### Width misses

None.

## Line counts

298 text × font pairs (168 with soft hyphens) × 241 widths (120-600px step
2), 16px on 24px lines. Fonts: Inter 400, Inter 700, Inter 400 +0.5px, Roboto 400, Shantell Sans 400, Shantell Sans 700.
**71818 cases: 0 headless-mismatch, 176 pretext-gap,
0 unreliable, 71642 pass.** Pretext in Node against Chromium's DOM directly: 176 differ
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
| corpus latin | 17352 | 17350 | 0 | 2 | 0 |
| corpus german | 17352 | 17282 | 0 | 70 | 0 |
| corpus french | 17352 | 17286 | 0 | 66 | 0 |
| corpus specials | 19762 | 19724 | 0 | 38 | 0 |

Skipped (out of scope): 2 text × font pairs.

- specials "pictographic" in Roboto 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥
- specials "pictographic short" in Roboto 400: U+2194 ↔, U+25B6 ▶, U+2665 ♥

### headless-mismatch cases

None.

### pretext-gap cases

- Roboto 400 / latin "Latin short" @ 168px: Pretext 5, DOM 4
- Roboto 400 / latin "Latin hyphenation" @ 198px: Pretext 5, DOM 4
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
- Inter 400 +0.5px / german "Datenschutz" @ 194px: Pretext 5, DOM 6
- Inter 400 +0.5px / german "Datenschutz" @ 466px: Pretext 2, DOM 3
- Shantell Sans 400 / german "Datenschutz" @ 126px: Pretext 10, DOM 9
- Shantell Sans 400 / german "Datenschutz" @ 190px: Pretext 6, DOM 5
- Shantell Sans 400 / german "Datenschutz" @ 328px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Datenschutz" @ 456px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Datenschutz" @ 148px: Pretext 8, DOM 7
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
- Shantell Sans 400 / german "Fehlermeldung" @ 120px: Pretext 7, DOM 6
- Shantell Sans 400 / german "Fehlermeldung" @ 326px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Fehlermeldung" @ 248px: Pretext 3, DOM 4
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
- Shantell Sans 400 / german "Produktion" @ 126px: Pretext 7, DOM 8
- Shantell Sans 400 / german "Produktion" @ 272px: Pretext 4, DOM 3
- Shantell Sans 400 / german "Produktion" @ 406px: Pretext 3, DOM 2
- Shantell Sans 700 / german "Produktion" @ 236px: Pretext 5, DOM 4
- Shantell Sans 400 / german "One word" @ 578-582px: Pretext 2, DOM 1
- Shantell Sans 700 / german "One word" @ 232px: Pretext 3, DOM 4
- Inter 400 / german "Portal" @ 230px: Pretext 4, DOM 5
- Inter 400 / german "Portal" @ 420px: Pretext 2, DOM 3
- Inter 700 / german "Portal" @ 230px: Pretext 4, DOM 5
- Inter 700 / german "Portal" @ 420px: Pretext 2, DOM 3
- Inter 400 +0.5px / german "Portal" @ 140px: Pretext 7, DOM 8
- Shantell Sans 400 / german "Portal" @ 140px: Pretext 8, DOM 7
- Shantell Sans 400 / german "Portal" @ 164px: Pretext 7, DOM 6
- Shantell Sans 700 / german "Portal" @ 120px: Pretext 10, DOM 9
- Shantell Sans 700 / german "Portal" @ 476px: Pretext 2, DOM 3
- Shantell Sans 700 / french "Confidentialité" @ 324px: Pretext 2, DOM 1
- Shantell Sans 400 / french "Enregistrer" @ 162px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Enregistrer" @ 236px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Enregistrer" @ 464px: Pretext 2, DOM 1
- Shantell Sans 400 / french "Synchroniser" @ 156px: Pretext 6, DOM 5
- Shantell Sans 400 / french "Synchroniser" @ 362px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Synchroniser" @ 170px: Pretext 6, DOM 5
- Shantell Sans 700 / french "Synchroniser" @ 204px: Pretext 5, DOM 4
- Shantell Sans 400 / french "Rappels" @ 194px: Pretext 5, DOM 4
- Shantell Sans 700 / french "Rappels" @ 120px: Pretext 9, DOM 8
- Inter 400 / french "Justificatifs" @ 264px: Pretext 3, DOM 2
- Inter 700 / french "Justificatifs" @ 264px: Pretext 3, DOM 2
- Inter 400 +0.5px / french "Justificatifs" @ 282px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Justificatifs" @ 120px: Pretext 6, DOM 5
- Shantell Sans 400 / french "Justificatifs" @ 522px: Pretext 2, DOM 1
- Shantell Sans 700 / french "Justificatifs" @ 568px: Pretext 2, DOM 1
- Inter 400 / french "Autorisations" @ 248px: Pretext 2, DOM 3
- Inter 700 / french "Autorisations" @ 248px: Pretext 2, DOM 3
- Inter 400 +0.5px / french "Autorisations" @ 264px: Pretext 2, DOM 3
- Roboto 400 / french "Autorisations" @ 452px: Pretext 1, DOM 2
- Shantell Sans 400 / french "Autorisations" @ 494-496px: Pretext 2, DOM 1
- Shantell Sans 700 / french "Autorisations" @ 192px: Pretext 4, DOM 3
- Shantell Sans 700 / french "Autorisations" @ 542px: Pretext 2, DOM 1
- Inter 400 +0.5px / french "Responsabilité" @ 148px: Pretext 7, DOM 8
- Inter 400 +0.5px / french "Responsabilité" @ 260px: Pretext 4, DOM 5
- Shantell Sans 400 / french "Responsabilité" @ 308px: Pretext 4, DOM 3
- Shantell Sans 700 / french "Responsabilité" @ 158px: Pretext 7, DOM 8
- Shantell Sans 700 / french "Responsabilité" @ 216px: Pretext 6, DOM 5
- Shantell Sans 700 / french "Responsabilité" @ 336px: Pretext 4, DOM 3
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
- Shantell Sans 400 / french "Anticonstitutionnalité" @ 378px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Anticonstitutionnalité" @ 128px: Pretext 8, DOM 7
- Shantell Sans 700 / french "Anticonstitutionnalité" @ 214px: Pretext 4, DOM 5
- Shantell Sans 400 / french "Conditions" @ 350px: Pretext 3, DOM 2
- Shantell Sans 700 / french "Conditions" @ 142px: Pretext 6, DOM 7
- Shantell Sans 700 / french "Conditions" @ 382px: Pretext 3, DOM 2
- Shantell Sans 400 / french "Mot de passe" @ 176px: Pretext 5, DOM 4
- Inter 400 +0.5px / french "Récit" @ 340px: Pretext 4, DOM 3
- Shantell Sans 400 / french "Récit" @ 244px: Pretext 5, DOM 4
- Shantell Sans 700 / french "Récit" @ 132px: Pretext 10, DOM 9
- Shantell Sans 700 / french "Récit" @ 182px: Pretext 7, DOM 6
- Shantell Sans 700 / french "Récit" @ 530px: Pretext 3, DOM 2
- Inter 400 / specials "quoted labels" @ 120px: Pretext 9, DOM 8
- Inter 700 / specials "quoted labels" @ 120px: Pretext 9, DOM 8
- Shantell Sans 400 / specials "quoted labels" @ 120px: Pretext 10, DOM 8
- Shantell Sans 400 / specials "quoted labels" @ 156px: Pretext 8, DOM 7
- Shantell Sans 400 / specials "quoted labels" @ 458px: Pretext 3, DOM 2
- Shantell Sans 700 / specials "quoted labels" @ 128-130px: Pretext 10, DOM 9
- Shantell Sans 400 / specials "quoted abonnieren" @ 120px: Pretext 3, DOM 2
- Roboto 400 / specials "ellipsis" @ 172px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "ellipsis" @ 188-190px: Pretext 6, DOM 5
- Shantell Sans 700 / specials "ellipsis" @ 206-208px: Pretext 6, DOM 5
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
- Roboto 400 / specials "quoted labels (SHY)" @ 156px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 132px: Pretext 7, DOM 8
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 156px: Pretext 7, DOM 6
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 174px: Pretext 6, DOM 5
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 222px: Pretext 5, DOM 4
- Shantell Sans 400 / specials "quoted labels (SHY)" @ 286px: Pretext 4, DOM 3
- Shantell Sans 700 / specials "quoted labels (SHY)" @ 172px: Pretext 7, DOM 6
- Shantell Sans 700 / specials "quoted abonnieren (SHY)" @ 138px: Pretext 2, DOM 3
- Shantell Sans 400 / specials "quoted Tagesabschluss (SHY)" @ 184px: Pretext 2, DOM 1
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 150px: Pretext 6, DOM 7
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 300px: Pretext 4, DOM 3
- Shantell Sans 400 / specials "ellipsis (SHY)" @ 442px: Pretext 3, DOM 2

### unreliable cases

None.

## U+2028 and U+2029

Chromium measures every U+2029 string exactly as the same string with U+2028 in 288 of
288 family × weight × size × spacing cases (U+2029 alone, "a¶b", "x¶T¶x"): it draws U+2029 with the space glyph
and without a word cut, as it does U+2028 (in Roboto "x¶T¶x" kerns T with the space glyph, narrower than "x T x").
The stand-in already treats U+2029 so; no change was needed.

Chromium / stand-in widths at 400 16px, no spacing (NaN: out of scope):

| family | " " | "a b" | "a⏎b" U+2028 | "a¶b" U+2029 | U+2028 | U+2029 | "x T x" | "x␤T␤x" U+2028 | "x¶T¶x" U+2029 |
|---|---|---|---|---|---|---|---|---|---|
| Inter | 4.5 / 4.5 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 4.5 / 4.5 | 4.5 / 4.5 | 36.796875 / 36.796875 | 36.796875 / 36.796875 | 36.796875 / 36.796875 |
| Inter WOFF2 | 4.5 / 4.5 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 23.28125 / 23.28125 | 4.5 / 4.5 | 4.5 / 4.5 | 36.796875 / 36.796875 | 36.796875 / 36.796875 | 36.796875 / 36.796875 |
| Roboto | 3.960938 / 3.960938 | 21.640625 / 21.640625 | 21.640625 / 21.640625 | 21.640625 / 21.640625 | 3.960938 / 3.960938 | 3.960938 / 3.960938 | 33.328125 / 33.328125 | 32.703125 / 32.703125 | 32.703125 / 32.703125 |
| Shantell Sans | 5.455994 / 5.455994 | 24.831985 / 24.831985 | 24.831985 / 24.831985 | 24.831985 / 24.831985 | 5.455994 / 5.455994 | 5.455994 / 5.455994 | 37.455978 / 37.455978 | 37.455978 / 37.455978 | 37.455978 / 37.455978 |

## Synthetic bold

Inter, Inter WOFF2, Roboto at 600 and 700, synthesized by Chromium from the one 400 face, against Chromium's own 400 width of
the same string, size and spacing: 2384 of 2384 equal, so synthetic bold does not change Canvas advances
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
| drop kerning | `if (fontKerning === 'none') features.push(new Feature('kern', 0))` → `features.push(new Feature('kern', 0))` | 2868 | 14.700104 | 1594 | yes |
| ignore weight | `findFace(parsed.families[i]!, parsed.weight, style)` → `findFace(parsed.families[i]!, 400, style)` | 816 | 34.3797 | 2988 | yes |
| drop the U+0020 word cut | `return codePoint === 0x20 \|\| codePoint === ZWSP \|\|` → `return codePoint === ZWSP \|\|` | 96 | 1.171875 | 0 | yes |

- drop kerning, e.g. Inter 400 / latin "Latin update" @ 136px: Node 9, Chromium-Pretext 8
- ignore weight, e.g. Shantell Sans 700 / latin "Latin update" @ 128px: Node 10, Chromium-Pretext 11

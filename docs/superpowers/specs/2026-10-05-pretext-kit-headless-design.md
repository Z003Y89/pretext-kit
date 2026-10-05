# pretext-kit/headless: design

Sub-project 2 of 4. Status: draft for review, 2026-10-05. Evidence: `docs/research/2026-10-05-headless-harfbuzz.md`.

## What this is

A test-time and server-time `OffscreenCanvas` for Pretext, backed by HarfBuzz shaping the app's own font files. With
it, Pretext and every pretext-kit helper run unchanged in Node, Bun, vitest and jest (including jsdom) and on servers, with
no browser. The use it unlocks, asked for by three app teams: **"does „Zahlungspflichtig abonnieren“ fit this button at
160px?" as a free unit test, per language, in CI.**

It is not a new layout engine. Pretext keeps doing all line breaking with its ports of the browsers' rules; the stand-in
only answers what Canvas answers in a browser: the width of a string in a font.

## Claim and its limits

On macOS, Chrome 154: for code points covered by the registered fonts, `measureText` widths equal Chrome's Canvas
(320/352 bit-exact, max 0.019px), and Pretext's line counts equal Chrome's page wherever Pretext inside Chrome does
(2,021/2,024). The claim is scoped exactly so:

- **Registered fonts only.** A code point no registered font covers makes `measureText` throw a `HeadlessCoverageError`
  naming the character and the font list (Chrome would use an OS fallback font we can't reproduce). An opt-in
  `onMissingGlyph: 'notdef'` measures `.notdef` instead, for apps that accept the error.
- **Chromium profile.** `install()` sets a desktop Chrome user agent before Pretext loads, so Pretext uses its Blink
  rules. WebKit and Gecko profiles are out of v1 (their Canvas shapes differently around spaces and kerning).
- **Platforms.** Parity is claimed for macOS Chrome. Windows (DirectWrite) and Linux (FreeType; whole-px advances without
  subpixel positioning) each get one measured check before they are claimed; Linux gets a `rounding: 'whole-px'` mode
  if the check shows Chrome rounds.

## API

`import { registerFont, install } from 'pretext-kit/headless'`

```ts
registerFont(family: string, data: Uint8Array, face?: { weight?: number | [min: number, max: number], style?: 'normal' | 'italic' }): Promise<void>
// TTF/OTF/TTC, WOFF (node:zlib) or WOFF2 (wawoff2), detected by signature; async only because WOFF2 decompresses.
// A variable font registers its weight range; registration of the same family/weight/style twice throws.
install(options?: { onMissingGlyph?: 'throw' | 'notdef', rounding?: 'none' | 'whole-px' }): void
// Sets globalThis.OffscreenCanvas and a desktop Chrome navigator.userAgent. Must run before the first prepare(),
// since Pretext fixes its engine profile and canvas then; this order is documented, not detected (a load-time probe
// misfired on other libraries' feature detection). Throws if a non-headless OffscreenCanvas is already installed.
```

Apps register the same font files their CSS loads (`@font-face` sources), under the same family names, then use Pretext
and the kit as usual. A vitest example and a jest + jsdom example go in the README, including the jsdom emoji hazard
(jsdom's zero `getBoundingClientRect` makes Pretext's emoji correction zero emoji widths; the stand-in keeps emoji
within the bound so the correction never fires, and coverage rules apply to emoji like any glyph).

## What the stand-in implements (from Pretext's measurement path)

`getContext('2d')` returning a context with: `font` (CSS shorthand `[style] [variant] [weight] [stretch] size[/lh]
family-list`, per-character fallback across the list's registered families; generic names resolve only if registered);
`measureText(t)` → `{ width, actualBoundingBoxLeft, actualBoundingBoxRight }` (boxes from glyph extents, used by Han
kerning only); `letterSpacing` as a round-tripping px string; `fontKerning` (`'none'` disables `kern`); optional `lang`.
Blink Canvas behaviour: shape each run between U+0020 alone; U+2028 drawn with the space glyph without a cut; under
non-zero letter spacing disable `liga`/`clig`/`calt` and add spacing per grapheme; widths accumulated as float32;
`setScale(round(size × 65536))`; `wght` from the requested weight clamped to the axis, `opsz` = size in px.

## Structure

```
src/headless/
  fonts.ts       registry: parse, decompress, faces by family/weight/style    ~90 lines
  shorthand.ts   CSS font shorthand → { families, weight, style, stretch, size } ~50
  canvas.ts      the OffscreenCanvas / context stand-in                         ~110
  index.ts       registerFont, install                                          ~30
```
`harfbuzzjs` (MIT) and `wawoff2` (MIT) are optional peer dependencies, loaded only by `pretext-kit/headless`, so the
browser entry stays free of WASM.

## Verification

- **Logic tests** (`node --test`): shorthand parsing; coverage errors; WOFF/WOFF2 detection; letter spacing round trip;
  a pinned-width table for a bundled OFL font (Inter, from Pretext's `harness/fonts`).
- **Parity sweep** (`verify/headless.ts`): the same strings, fonts and widths are measured by the stand-in in Node and by
  Chromium's Canvas through Playwright; then Pretext line counts in Node vs Chromium's painted DOM over the v1 corpora
  restricted to covered text (Latin, German, French). Pass bar: widths within 0.02px; line counts equal wherever
  in-browser Pretext's are (the same attribution rule as v1: compare with Pretext-in-Chrome first). Results with builds
  and date in `verify/HEADLESS_RESULTS.md`; mutation check (drop kerning; ignore weight) must be caught.
- **One check each on Windows and Linux Chrome** before README claims them; until then README says macOS only.

## Not in this sub-project

WebKit/Gecko Canvas emulation; OS fallback fonts (CJK/emoji/Arabic stay browser-tested); React Native (sub-project 3);
fonts' `font-feature-settings` (Canvas can't express them anyway).

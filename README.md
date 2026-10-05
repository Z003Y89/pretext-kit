# pretext-kit

## Headless (Node, vitest, jest, CI)

`pretext-kit/headless` is a test-time and server-time `OffscreenCanvas` for Pretext, backed by HarfBuzz shaping your own
font files. Pretext and every pretext-kit helper then run in Node, Bun, vitest and jest (including jsdom) with no
browser, so "does „Zahlungspflichtig abonnieren“ fit this button at 160px?" becomes a unit test.

```sh
npm i -D harfbuzzjs@1.6.2 wawoff2@2.0.1   # optional peers, loaded only by pretext-kit/headless (wawoff2: WOFF2 fonts)
```

```ts
import { registerFont, install } from 'pretext-kit/headless'
import { readFileSync } from 'node:fs'

// The same files your CSS @font-face loads, under the same family names. TTF/OTF/TTC, WOFF or WOFF2.
await registerFont('Inter', new Uint8Array(readFileSync('fonts/Inter-Regular.ttf')))
install()

// Only now import and use Pretext / pretext-kit.
const { measureLineStats, prepareWithSegments } = await import('@chenglou/pretext')
```

A runnable version is `examples/vitest-label-fit.test.ts`, with the vitest equivalent in its header comment.

### The claim and its limits

On macOS, Chrome 154: for code points covered by the registered fonts, `measureText` widths equal Chrome's Canvas
(320/352 bit-exact, max 0.019px), and Pretext's line counts equal Chrome's page wherever Pretext inside Chrome does
(2,021/2,024). The claim is scoped exactly so:

- **Registered fonts only.** A code point no registered font covers makes `measureText` throw a `HeadlessCoverageError`
  naming the character and the font list (Chrome would use an OS fallback font we can't reproduce). An opt-in
  `install({ onMissingGlyph: 'notdef' })` measures `.notdef` instead, for apps that accept the error. Curly and German
  quotes and the ellipsis work with Latin fonts: Pretext's Han-kerning probe of U+300C gets a stand-in width (it has no
  effect on text without CJK), but real CJK text in a font lacking it still throws. Inherent case: a lone `「` or `「「`
  segment in such a font measures that stand-in rather than throwing, as the probe is the same `measureText` call. Note that
- **Chromium profile.** `install()` sets a desktop Chrome user agent before Pretext loads, so Pretext uses its Blink
  rules. WebKit and Gecko profiles are not supported.
- **Platforms.** Parity is measured for macOS Chrome. Windows (DirectWrite) and Linux (FreeType; whole-px advances
  without subpixel positioning) each still need one measured check before they are claimed.

### Install order

`install()` must run before the first `prepare()`: Pretext fixes its engine profile and canvas on first use. The order
is documented, not detected, so in a test setup file call `registerFont` and `install()` first (vitest `setupFiles`,
jest `setupFiles`) and load Pretext after. `install()` throws if another `OffscreenCanvas` is
already set.

### jsdom

jsdom has a `document.body` but its `getBoundingClientRect` returns zeros. Pretext measures emoji through a DOM span to
correct Canvas, which would zero every emoji width under jsdom. The stand-in keeps emoji within the bound so that
correction never fires, and coverage rules apply to emoji like any glyph: an emoji your registered fonts lack throws
`HeadlessCoverageError` instead of measuring as 0. Expose jsdom's `window`/`document` as globals before Pretext is
imported; see `test/headless/jsdom.test.ts`.

### Soft hyphens and invisible characters

Like Chrome's Canvas, the stand-in cuts words at U+0020, ZWSP, and the characters Chrome turns into ZWSP (SHY U+00AD,
LRM, RLM, U+202A-U+202E, U+FEFF, U+FFFC), so kerning does not apply across them: `width('A‎V')` is `A` plus `V`.
A soft hyphen that Pretext breaks at paints the font's own U+2010, or `-` when the font lacks U+2010.

One case is inherent: a standalone U+2010 segment in a font that lacks that glyph measures with `.notdef` (or the
generic stand-in) rather than throwing, because Pretext's hyphen probe and a real segment are the same `measureText`
call, so the two cannot be told apart.

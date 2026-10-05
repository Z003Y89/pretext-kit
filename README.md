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

A runnable version is `examples/vitest-label-fit.test.ts`.

### The claim and its limits

On macOS, Chrome 154: for code points covered by the registered fonts, `measureText` widths equal Chrome's Canvas
(320/352 bit-exact, max 0.019px), and Pretext's line counts equal Chrome's page wherever Pretext inside Chrome does
(2,021/2,024). The claim is scoped exactly so:

- **Registered fonts only.** A code point no registered font covers makes `measureText` throw a `HeadlessCoverageError`
  naming the character and the font list (Chrome would use an OS fallback font we can't reproduce). An opt-in
  `install({ onMissingGlyph: 'notdef' })` measures `.notdef` instead, for apps that accept the error. Curly and German
  quotes and the ellipsis work with Latin fonts: Pretext's Han-kerning probe of U+300C gets a stand-in width (it has no
  effect on text without CJK), but real CJK text in a font lacking it still throws. Inherent case: a lone `「` or `「「`
  segment in such a font measures that stand-in rather than throwing, as the probe is the same `measureText` call.
  Likewise Pretext's emoji correction probes U+1F600 for any Extended_Pictographic text (`©`, `®`, `™`, `↔`, `▶`, `♥`, `‼`), which
  gets a stand-in of exactly the font size; any other uncovered emoji, and U+1F600 inside a longer segment, still throws,
  and a standalone `😀` segment in a font lacking it measures that stand-in rather than throwing. A symbol your font
  lacks (Inter has no `✔`) throws for that glyph.
- **Weights.** A weight with no matching registered face (600 or 700 with only a Regular file) silently measures the
  nearest registered face, so register the bold file your CSS uses, with `{ weight: 700 }`.
- **Chromium profile.** `install()` sets a desktop Chrome user agent before Pretext loads, so Pretext uses its Blink
  rules. WebKit and Gecko profiles are not supported.
- **Platforms.** Parity is measured for macOS Chrome. Windows (DirectWrite) and Linux (FreeType; whole-px advances
  without subpixel positioning) each still need one measured check before they are claimed; if Linux's check shows
  Chrome rounds, `install({ rounding: 'whole-px' })` is the mode for it.

### Install order

`install()` must run before the first `prepare()`: Pretext fixes its engine profile and canvas on first use, not on
import. The order is documented, not detected. Static imports are fine: register fonts and call `install()` at the top
of the test file or in a setup file (vitest `setupFiles`, jest `setupFilesAfterEnv`). Import Pretext dynamically only when jsdom
globals must exist before it loads (below). `install()` throws if another `OffscreenCanvas` is already set.

vitest (`vitest.setup.ts` in `setupFiles`, then ordinary tests):

```ts
import { readFileSync } from 'node:fs'
import { registerFont, install } from 'pretext-kit/headless'
await registerFont('Inter', new Uint8Array(readFileSync('fonts/Inter-Regular.ttf')))
install()
```
```ts
import { it, expect } from 'vitest'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
it('fits one line at 160px', () => {
  const { lineCount } = measureLineStats(prepareWithSegments('Speichern', '600 14px Inter'), 160)
  expect(lineCount).toBe(1)
})
```

jest + jsdom (`jest.config`: `testEnvironment: 'jsdom'`, `setupFilesAfterEnv: ['./jest.setup.js']`, which runs inside the
jsdom environment before each test file, so `document` already exists and `beforeAll` is available):

```js
// jest.setup.js
const { readFileSync } = require('node:fs')
const { registerFont, install } = require('pretext-kit/headless')
beforeAll(async () => {
  await registerFont('Inter', new Uint8Array(readFileSync('fonts/Inter-Regular.ttf')))
  install()
})
```

### jsdom

jsdom has a `document.body`, but its `getBoundingClientRect` returns zeros. Pretext corrects Canvas emoji widths
against a DOM span (only when Canvas's emoji width exceeds the font size by more than 0.5px); under jsdom the span
measures 0, so that correction would zero every emoji it applies to. What the stand-in guarantees: Pretext's probe
string U+1F600 measures exactly the font size where no registered font has it, so the correction doesn't fire for text
like `© 2026`, and an emoji no registered font covers throws `HeadlessCoverageError` instead of measuring as 0. It does
not clamp the width of emoji your registered fonts do cover: a registered emoji font whose U+1F600 advance exceeds
size + 0.5px makes Pretext's correction run, and under jsdom it zeroes those emoji. So register an emoji font with an
advance of at most size + 0.5px (Apple Color Emoji is exactly 1em), or stub `getBoundingClientRect` on the jsdom
window, or don't expose jsdom's `document` to Pretext. To have jsdom's globals exist before Pretext loads, set them
and then `await import()` Pretext, as `test/headless/jsdom.test.ts` does.

### Soft hyphens and invisible characters

Like Chrome's Canvas, the stand-in cuts words at U+0020, ZWSP, and the characters Chrome turns into ZWSP (SHY U+00AD,
LRM, RLM, U+202A-U+202E, U+FEFF, U+FFFC), so kerning does not apply across them: `width('A\u200EV')` is `A` plus `V`.
A soft hyphen that Pretext breaks at paints the font's own U+2010, or `-` when the font lacks U+2010.

One case is inherent: a standalone U+2010 segment in a font that lacks that glyph measures with `.notdef` (or the
generic stand-in) rather than throwing, because Pretext's hyphen probe and a real segment are the same `measureText`
call, so the two cannot be told apart.

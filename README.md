# pretext-kit

Exact text-sizing helpers for web UIs, built on [Pretext](https://github.com/chenglou/pretext), in the browser and,
with no browser, in Node. pretext-kit is not part of Pretext and is not maintained by its authors; it calls Pretext's
public API and adds the answers apps keep re-deriving on top of it: the font size that fits a box, the width that
balances lines, clamped and middle-cut text, list heights. `shrinkwrap`, `balance`, `fitFontSize`,
`fitFontSizeRich`, `clamp`, `truncateMiddle` and `fontFromStyle` are checked against what Chromium, WebKit and Firefox
actually paint ([verify/RESULTS.md](verify/RESULTS.md)); `shrinkwrapRich`, `balanceRich`, `watchFonts` and the list
helpers (`stack`, `findIndexAt`, `anchorDelta`) are unit-tested only. [EVALUATION.md](EVALUATION.md) states the
claims, the confidence bounds, the threats to validity and the known limitations.

- **`pretext-kit/headless`**: Pretext and every helper in Node, vitest, jest (jsdom too) and CI, shaping your own
  font files with HarfBuzz, so "does „Zahlungspflichtig abonnieren“ fit this button at 160px?" becomes a unit test.
  Against Chromium on macOS, Linux and Windows with the same font files: every static Inter and Roboto width
  bit-exact, and of 71,818 line counts none differing from Pretext inside Chromium; on macOS also Inter Variable at
  weights 300-800, widths within 0.0001px and none of 69,408 more line counts differing. Variable fonts measure per
  target platform: `install({ platform })`, macOS by default. Registered fonts and Chromium's rules only
  ([the claim and its limits](#the-claim-and-its-limits)).
- **`pretext-kit/check`**: a test-time and CI check that every UI label fits its slot in every language, at every
  text scale and zoom you ship, with the policy each slot declares (as-is, shrink to a minimum, N lines, truncate), as
  Chromium lays it out. A function (`checkLabels`), a browser entry and the `check-labels` command. It makes no
  measurement beyond Pretext's: it runs `fitFontSize`, `clamp` and `prepareLabel` through `pretext-kit/headless`
  ([the checker, its evidence and its limits](#label-checker)).

What it adds that CSS can't do:

- **`fitFontSize` / `fitFontSizeRich`**: the largest whole-pixel size at which a label, or an icon and a label
  together, fits a box: on one line, in N lines, or in a height; and so one shared size for a whole toolbar or
  button row. CSS has no exact equivalent.
- **`truncateMiddle`**: `~/Projects/atlas/…/line-breaker.test.ts`, keeping as much of each end as fits, for any
  string. CSS can cut the middle only where you already know the split point.
- **Numbers before render**: heights, widths and line counts for text that isn't in the DOM yet (virtual lists,
  canvas, layout decided ahead of paint).

![A billing screen in German at 588px, side by side: pretext-kit keeps the toolbar on one row, tightens its padding and collapses only the settings button to its icon; best-effort CSS wraps the toolbar onto a second row](examples/screenshots/responsive-ui.png)

*The [examples](#examples): one screen laid out by the kit (left) and by best-effort CSS (right). Good CSS doesn't
overflow either; the kit decides things CSS can't. Here the toolbar stays on one row: tighter padding first, then
icon-only buttons in the app's priority order (settings first; the daily closing report, the screen's subject,
keeps its label).*

## Install

pretext-kit is not on npm yet. Each [GitHub release](https://github.com/Z003Y89/pretext-kit/releases) carries two
tarballs, installed by URL with no npm account or registry publish involved: the kit, and the Pretext it needs.

```sh
npm install https://github.com/Z003Y89/pretext-kit/releases/download/v0.1.2/chenglou-pretext-0.0.10-main.f10d888.tgz https://github.com/Z003Y89/pretext-kit/releases/download/v0.1.2/pretext-kit-0.1.2.tgz
npm i -D harfbuzzjs@1.6.2 wawoff2@2.0.1   # for pretext-kit/headless, pretext-kit/check and check-labels (optional peers; wawoff2 for WOFF2 fonts)
```

Check the downloads against the SHA-256 sums: `chenglou-pretext-0.0.10-main.f10d888.tgz` is
`9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`; `pretext-kit-0.1.2.tgz`'s sum is in
[CHANGELOG.md](CHANGELOG.md) and the release notes, not here, because this README ships inside that tarball and so
cannot hold its own hash. Both builds are reproducible in content: `npm run pack:release` from the tagged commits
gives tarballs whose contents are identical file for file on any machine, and whose compressed bytes (and so sums)
are identical when packed with the same Node and npm versions; gzip output differs across Node/zlib versions. The
release ships tarballs packed with Node 24.4.1 and npm 11.4.2. [verify/RELEASING.md](verify/RELEASING.md) is the release
procedure.

**The Pretext tarball is an unofficial, labelled snapshot, not a release by Pretext's authors.** The kit needs Pretext
from `main` at [f10d888](https://github.com/chenglou/pretext/commit/f10d888c0f3dfc5877fbca5e4570ee04111e7001)
(2026-10-05), since npm's `@chenglou/pretext` 0.0.9 predates the per-engine line breakers the kit is verified
against, and Pretext has not released since. `chenglou-pretext-0.0.10-main.f10d888.tgz` is that commit, unmodified,
built with Pretext's pinned TypeScript; only its `package.json` differs: version `0.0.10-main.f10d888`, a description
saying it is an unofficial snapshot, and no install or pack scripts. Its LICENSE (MIT) and README are Pretext's.
`verify/pack-release.sh` rebuilds both tarballs (and the release's CycloneDX SBOM) from the two repositories, and `verify/consumer-smoke.mjs` installs
them into a fresh project and runs the kit there (CI does both on every push). When Pretext publishes 0.0.10, install
it from npm instead and drop the snapshot.

Or build from source, the route the evaluation used:

```sh
# Pretext's build is tsc alone; its other dev dependencies float (no npm lockfile) and, on 2026-10-05, no longer
# resolve with `npm install` (oxlint peer conflict), so build with its pinned TypeScript directly:
git clone https://github.com/chenglou/pretext && (cd pretext && git checkout f10d888 && npx -y -p typescript@6.0.2 tsc -p tsconfig.build.json)
git clone https://github.com/Z003Y89/pretext-kit && (cd pretext-kit && npm install && npm run build)
npm install ./pretext ./pretext-kit
npm i -D harfbuzzjs@1.6.2 wawoff2@2.0.1   # for pretext-kit/headless, pretext-kit/check and check-labels (optional peers; wawoff2 for WOFF2 fonts)
```

`@chenglou/pretext` is a peer dependency: your app and the kit share one Pretext, and one cache. Its range is
`>=0.0.10-0 <0.0.11`: Pretext is pre-1.0, so each 0.0.x release may change what the kit is verified against, and 0.0.10
is the first release with the line breakers above. The `-0` admits 0.0.10's prereleases, so the labelled snapshot
`0.0.10-main.f10d888` satisfies it, as will a future 0.0.10, while npm's stale 0.0.9 does not. (A build from `main`
still says 0.0.9, which npm does not check for the folder installs above.) The optional peers are `harfbuzzjs`
`^1.6.2` and `wawoff2` `^2.0.1` (1.6.2 and 2.0.1 are the versions verified). The package declares Node `>=22`: CI
runs the tests on Node 22 and 24 on Linux, Windows and macOS, and the consumer smoke test on Node 22 and 24. Running
the repository's own TypeScript tests needs Node 22.18 or later, where type stripping is on by default.

## When CSS is enough

| Helper | Plain-CSS alternative | When CSS suffices | When you need the kit |
|---|---|---|---|
| `balance` | `text-wrap: balance` (Chrome 114, Safari 17.5, Firefox 121) | Displaying a headline with even lines; engines balance only short blocks (each caps the line count it will balance) | You need the width as a number (canvas, SVG, layout decided before render), or longer blocks, or older engines |
| `clamp` | `-webkit-line-clamp` (all three engines; the unprefixed `line-clamp` isn't everywhere yet, so ship both) | Displaying "3 lines then …" | You need the cut text itself, or the clamped height before render (virtual lists, cards) |
| `shrinkwrap` | none for multi-line (`fit-content` stays at the full width once text wraps) | Single-line bubbles | Multi-line bubbles and tooltips that hug their text |
| `truncateMiddle` | two spans in a flex row: the start with `min-width: 0; overflow: hidden; text-overflow: ellipsis`, the end `flex: none` | The split point is known (the extension, a date after the last `_`) and the end always fits | Any string, where the cut should keep as much of each end as fits, measured |
| `fitFontSize(Rich)` | none exact; fluid `clamp()` and container units only approximate | When "about right" is fine, or wrapping the row is acceptable | Labels, badges and buttons that must fit, one shared size per row, in every language and text size |
| `pretext-kit/headless` | a real browser in CI (Playwright) | You already run one, or your fonts aren't files you can register | Unit tests and servers without a browser, for registered fonts on Chromium's rules |

## When to measure with the DOM instead

For a handful of labels on screen, measure them in the DOM: the browser already knows exactly, icons and padding
included, and nothing can disagree with it. The kit pays off when there are many texts, when the answer is needed
on every resize frame, or before the text exists in the DOM at all (virtual lists, layout computed ahead of render,
server or test code).

## Helpers

Each helper takes Pretext's prepared handles, so the expensive part (measuring text) happens once and each resize is
arithmetic. Fonts are Canvas font strings, e.g. from [`fontFromStyle`](#fonts).

```ts
import { prepareWithSegments } from '@chenglou/pretext'
import {
  shrinkwrap, balance, clamp, measureTail, prepareLabel, truncateMiddle, prepareSizes, fitFontSize,
} from 'pretext-kit'

const font = '15px "Helvetica Neue"'
const p = prepareWithSegments('Ship the release notes before the freeze on Friday', font)

shrinkwrap(p, 320)          // { width, lineCount }: the width that paints the same lines with no slack
balance(p, 320)             // { width, lineCount }: the narrowest width that keeps the line count

const tail = measureTail('…', font)          // once per font
clamp(p, 240, 2, tail)                       // { truncated, lineCount, lines: [{ text, width }] }

const label = prepareLabel('~/Projects/atlas/src/core/line-breaker.test.ts', font)
truncateMiddle(label, 220, { from: label.text.lastIndexOf('/') })   // a start, '…', then '/line-breaker.test.ts' whole

const sizes = prepareSizes('Zahlungspflichtig abonnieren', px => `500 ${px}px "Helvetica Neue"`, { min: 11, max: 16 })
fitFontSize(sizes, { width: 180, maxLines: 1 }, px => Math.round(px * 1.3))   // { px, prepared, lineCount } | null
```

- `shrinkwrapRich` / `balanceRich` take a `PreparedRichInline` (mixed fonts, chips, icons).
- `maxWidth` for `shrinkwrap`, `balance` and their rich forms is a number of CSS px, at least 0, or `Infinity` for
  unbounded; a negative or NaN `maxWidth` throws a `RangeError` (Pretext would lay NaN out as unbounded and a negative
  width as narrower than any grapheme, and the answer would be NaN or negative). The answer never exceeds `maxWidth`.
- `clampStats(p, width, maxLines)` gives `{ truncated, lineCount }` without building lines: all a list needs for
  rows it doesn't paint. In both, `maxLines` is a whole number of at least 1; anything else throws a `RangeError`.
- `prepareLabel(text, font).text` is the label as Pretext prepared it, white space collapsed as CSS's `white-space:
  normal` does (runs of spaces, tabs and line breaks become one space, none at either end). `truncateMiddle` cuts and
  returns that text, and `keepEnd.from` is an index into it: write `label.text.lastIndexOf('/')`, not an index into the
  string you passed, which differs wherever white space collapsed.
- `prepareSizesRich(px => items, range)` / `fitFontSizeRich` fit an icon and a label as one row; see
  [Mixed rows](#mixed-rows).
- `stack(heights, gap, tops)`, `findIndexAt(tops, count, y)`, `anchorDelta(oldTops, newTops, anchor)` are the three
  pieces of a virtual list; see [Recipes](#recipes).
- `fontFromStyle(getComputedStyle(el))` and `watchFonts(onChange)`: see [Fonts](#fonts).

The browser reproduces every answer: a helper returns a width, a font size, a line count or the cut text of a line,
and the browser's own wrapping at that value paints the predicted lines.

## What's exact

`npm run verify` sweeps `shrinkwrap`, `balance`, `fitFontSize`, `fitFontSizeRich`, `clamp`, `truncateMiddle` and
`fontFromStyle` in Chromium, WebKit and Firefox (Playwright 1.61.0, macOS), at
deviceScaleFactor 1, 1.25 and 2, over Latin, CJK, Arabic, emoji chat, URLs, soft-hyphenated German and French, and
file paths, in four named fonts, at every width from 120 to 600px (80–400px for `truncateMiddle`; every fourth
width at 1.25 and 2). Each case is judged against Pretext's own numbers
first, then against the painted DOM. `shrinkwrapRich`, `balanceRich`, `watchFonts`, `stack`, `findIndexAt` and
`anchorDelta` are not swept: they are covered by `npm test` on a stand-in Canvas only. The recorded run has
**zero kit-mismatch cases** in every browser at every
factor. The remaining non-pass cases are where Pretext itself differs from the browser (`pretext-gap`), or a proven
browser quirk (`platform`: WebKit 26 floors fractional line heights); none is patched in the kit. Builds, counts and
every finding grouped by cause: [verify/RESULTS.md](verify/RESULTS.md). The [accuracy example](#examples) shows them
as a grid. [EVALUATION.md](EVALUATION.md) gives each helper's claim as a falsifiable property, 95% upper bounds on
the mismatch rate, mutation tests of the sweep itself, the threats to validity, and the known limitations (among
them soft-hyphenated text that overflows a fitted box in Chromium and Firefox where Pretext places the break
differently, and macOS as the only platform measured).

## Fonts

- Bundle your app's font with `@font-face`, and `await document.fonts.load(font)` before preparing; text prepared
  before a font loads is measured in the fallback.
- Read fonts from CSS rather than writing them twice: `fontFromStyle(getComputedStyle(el))` returns
  `{ font, letterSpacing, lineHeight }`. It throws on `line-height: normal` (set a number) and on `font-variant`
  values Canvas can't express.
- After a late font, `watchFonts(() => { /* prepare again, lay out again */ })` calls Pretext's `clearCache()` on
  each `loadingdone` and then your callback. Prepared handles keep the old widths, so prepare again inside it.
- Use named fonts. Never `system-ui` or `-apple-system` on macOS: see
  [Pretext's caveats](https://github.com/chenglou/pretext#caveats).
- `font-feature-settings` and `font-variant-numeric` (tabular figures and the like) aren't supported: the Canvas font
  string can't express them, so Pretext measures the default glyphs.

## Hyphenation

Browsers' `hyphens: auto` dictionaries differ per engine, so no measurer can know where they break. Put soft
hyphens (U+00AD) in once, measure that string, and paint the same string with `hyphens: manual`. Hyphenate only
where it's needed: a label or button can usually reflow or take a shared size instead, and a title needs soft
hyphens only in a word wider than its box, which the kit can measure:

```ts
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { balance } from 'pretext-kit'
import de from 'hyphen/de/index.js'   // TeX patterns (de-1996), the hyphen package

const title = 'Datenschutzeinstellungen geändert'
const hyphenated = de.hyphenateSync(title).split(' ')   // 'Da\u00ADten\u00ADschutz…'
const text = title.split(' ')
  .map((w, i) => measureNaturalWidth(prepareWithSegments(w, font)) > boxWidth ? hyphenated[i] : w)
  .join(' ')
const { width, lineCount } = balance(prepareWithSegments(text, font), boxWidth)
// paint `text`, soft hyphens included, at `width` with `hyphens: manual`
```

For UI labels, author the soft hyphens yourself at compound joints (`'Tages\u00ADabschluss\u00ADbericht'`):
dictionaries pick syllable breaks (Tagesab-schlussbericht) that a German reader finds wrong in a button. Use
`hyphen/de` for running text and titles.

The sweep's German and French corpora are hyphenated throughout and run through every swept helper: zero kit-mismatch
in all three browsers. Their pretext-gaps are under 0.5% of the German cases and under 1% of the French ones in
every browser and zoom factor (WebKit also has line-height `platform` cases, which are safe). See
[RESULTS.md](verify/RESULTS.md) for the per-browser counts. Pretext's README
also recommends conservative insertion for app text.

## Zoom and scale

- **Browser and Electron zoom need no correction.** Zoom changes device pixels per CSS px, not CSS px. The sweep
  ran at Playwright deviceScaleFactor 1, 1.25 and 2 with zero kit-mismatch at each, and identical counts at 1.25 and
  2 (both at a 4px width step; see [RESULTS.md](verify/RESULTS.md)). Caveat: that is emulation on macOS, not proof
  that Windows (DirectWrite) or Linux (FreeType hinting) measure alike, nor exactly what page zoom does to the
  layout viewport.
- **A text-size setting is a different font size**, so it needs its own prepared text: `prepareSizes` keeps one
  handle per size it has visited, and `fitFontSize` searches the scaled range.
- Sizes are whole pixels (Firefox measures Canvas text at rounded sizes). For exact fits in Safari 26, use
  whole-pixel line heights.

## Mixed rows

An icon, a case-number chip and a name, as one row:

```ts
import { prepareRichInline } from '@chenglou/pretext/rich-inline'
import { shrinkwrapRich } from 'pretext-kit'

const font = '13px "Helvetica Neue"'
const row = prepareRichInline([
  { width: 16 },                                                      // the icon's margin box
  { text: '207/0011', font, break: 'never', extraWidth: 12 },         // a chip: padding and border
  { text: ' Dr. Lind', font },                                        // the space before it collapses as in CSS
])
shrinkwrapRich(row, 240)   // { width, lineCount }
```

Give each box `vertical-align: top` and keep it no taller than the line. `fitFontSizeRich` takes the same items as a
function of the font size, so icon, chip and text scale together.

## Recipes

These are app code, not library features.

**A React virtual list.** Prepare once per text, recompute heights on width change, render only the visible rows,
and move `scrollTop` only when layout moved the row the reader is looking at.

```tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { layout, prepare } from '@chenglou/pretext'
import { anchorDelta, findIndexAt, stack } from 'pretext-kit'

const PAD = 12, GAP = 8

function Messages({ texts, font, lineHeight, width, height }: {
  texts: string[], font: string, lineHeight: number, width: number, height: number
}) {
  const prepared = useMemo(() => texts.map(t => prepare(t, font)), [texts, font])
  const { tops, total } = useMemo(() => {
    const heights = prepared.map(p => layout(p, width - 2 * PAD, lineHeight).height + 2 * PAD)
    const tops = new Float64Array(heights.length)
    return { tops, total: stack(heights, GAP, tops) }
  }, [prepared, width, lineHeight])

  const scroller = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const anchor = useRef<{ tops: Float64Array, row: number } | null>(null)
  useLayoutEffect(() => {
    const a = anchor.current
    if (a !== null && a.tops.length === tops.length) {
      const d = anchorDelta(a.tops, tops, a.row)
      if (d !== 0) scroller.current!.scrollTop += d
    }
    anchor.current = { tops, row: findIndexAt(tops, tops.length, scroller.current!.scrollTop) }
  }, [tops])

  const start = findIndexAt(tops, tops.length, scrollTop)
  const end = findIndexAt(tops, tops.length, scrollTop + height) + 1
  return (
    <div ref={scroller} style={{ height, overflowY: 'auto' }} onScroll={e => {
      const y = e.currentTarget.scrollTop
      setScrollTop(y)
      anchor.current = { tops, row: findIndexAt(tops, tops.length, y) }
    }}>
      <div style={{ position: 'relative', height: total }}>
        {texts.slice(start, end).map((t, k) => (
          <p key={start + k} style={{ position: 'absolute', top: tops[start + k], width, padding: PAD, margin: 0, font, lineHeight: `${lineHeight}px` }}>{t}</p>
        ))}
      </div>
    </div>
  )
}
```

**The visible window of a virtual list**, on its own:

```ts
const start = findIndexAt(tops, n, scrollTop)
const end = findIndexAt(tops, n, scrollTop + viewportHeight) + 1   // exclusive
```

**A calendar block** shows the most it can: title and time, else the title, else the time, else "…".

```ts
const maxLines = Math.floor(blockHeight / lineHeight)
const tail = measureTail('…', font)
function blockText(title: string, time: string): string[] {
  if (maxLines < 1) return []
  for (const text of [`${title} · ${time}`, title, time]) {
    const c = clamp(prepareWithSegments(text, font), blockWidth, maxLines, tail)
    if (!c.truncated) return c.lines.map(l => l.text)
  }
  return ['…']
}
```

**A German label check** (in a test, or before choosing a layout):

```ts
const fits = measureLineStats(prepareWithSegments('Zahlungspflichtig abonnieren', font), buttonContentWidth).lineCount === 1
```

**A card row's height** before render: each paragraph's `layout().height`, plus fixed boxes and padding, and the
tallest card wins.

```ts
const cardHeight = (c: Card) => PAD * 2 + c.paragraphs.reduce((h, p) => h + layout(p, contentWidth, LH).height, 0) + c.fixedBoxes
const rowHeight = Math.max(...row.map(cardHeight))
```

## Examples

`npm run examples` builds them into `examples/dist`; `npm run examples:serve` serves them on
http://localhost:4173. They cover only what the kit adds (Pretext's own demos show bubbles, ellipsis and a chat list),
each beside the same UI in best-effort CSS (wrapping rows, auto heights, `text-wrap: balance`, `line-clamp`, a
two-span middle cut, `clamp()` sizes), with live sizes and timings, in light and dark. Each page says which boxes
CSS handles equally well (titles, bodies, row heights):

- **Responsive UI**: a billing screen from 320 to 1440px: a toolbar and button pair in one shared size
  (`fitFontSizeRich`, content widths, then tighter padding, then icon-only buttons in the app's priority order, then
  two lines broken at spaces; on a phone, only the report keeps its label, on two lines at a space or else at a
  compound joint written into the string),
  badges that fit (`fitFontSize`, `shrinkwrap`), file names cut in the middle with no split point
  (`truncateMiddle`), and a 2,000-row list with exact heights and a scroll anchor (`stack`, `findIndexAt`,
  `anchorDelta`) beside CSS `content-visibility: auto`.
- **Text size**: an app-wide text-size setting from 0.8× to 1.5×. The kit reflows first and shrinks text by at
  most 10% (cf. WCAG 1.4.4).
- **Languages**: English, German and French; labels break only at hand-written compound joints and only when a
  word is wider than the room, soft hyphens from TeX patterns only in a title word wider than its card.
- **Accuracy**: the sweep as a browser × zoom × helper × corpus grid with sample cases
  (`npm run examples:data` re-exports it from `verify/`).
- **Headless parity**: 24 English, German and French UI labels at three widths and two sizes,
  computed in Node by `pretext-kit/headless` (`examples/build-headless-parity.ts`, Inter and Roboto from
  `test/fonts`) beside the same numbers computed live in the browser from the same font files: line count, widest
  line and the `fitFontSize` for a button, row by row, with the browser's name and an agreement count.

Fonts come from `fontFromStyle(getComputedStyle(el))`; the local server sends Inter 1.5 s late so `watchFonts`
visibly lays the page out again. `npm run examples:check` loads every page in headless Chromium at 360, 768 and
1280px (`npm run examples:screenshots` also rewrites `examples/screenshots/`) and fails on a console error or on a kit-side box that overflows for any reason other than a pretext-gap
(a paragraph the browser wraps differently from Pretext's own layout of it). In its last run neither side
overflowed anywhere; best-effort CSS wrapped the toolbar onto a second row in 8 of 21 settings at 1280px and in
every setting at 360px. It also fails unless every headless-parity case matches in Chromium, line count, fitted size and width
(288 of 288 in its last run, Chromium 149 on macOS, widths bit-exact), and reports WebKit and Firefox without
judging them, as they are outside the claim: WebKit 26.5 agrees in line count and fitted size in 287 of 288 (one
fitted size differs; 275 widths bit-exact), Firefox 151 in 288 of 288 (its Canvas widths differ from Chromium's in
every case, median 0.024px, max 3.09px).

| | |
|---|---|
| ![Text size at 1.3×](examples/screenshots/text-size.png) | ![Languages, German at 560px](examples/screenshots/languages.png) |
| ![Responsive UI in German at a 360px viewport: the kit's toolbar keeps one row, three icons and „Tages-/abschlussbericht“ broken at its compound joint](examples/screenshots/responsive-ui-360.png) | ![Accuracy explorer](examples/screenshots/accuracy.png) |
| ![2,000 rows with heights known before render, beside content-visibility: auto](examples/screenshots/numbers-before-render.png) | ![Headless parity in Chromium: line counts, widest lines and fitted sizes from pretext-kit/headless in Node beside the browser's own, every row agreeing](examples/screenshots/headless-parity.png) |

## Versions

pretext-kit is built and verified against Pretext `main` at
[f10d888](https://github.com/chenglou/pretext/commit/f10d888c0f3dfc5877fbca5e4570ee04111e7001); pin that commit until
Pretext's next release. It uses only Pretext's public exports: `prepareWithSegments`, `layout`, `layoutNextLine`,
`layoutNextLineRange`, `layoutWithLines`, `measureLineStats`, `measureNaturalWidth` and `clearCache`, and from
`@chenglou/pretext/rich-inline`, `prepareRichInline` and `measureRichInlineStats`. Of a prepared handle's fields it
reads only the documented `segments`.

## Headless (Node, vitest, jest, CI)

`pretext-kit/headless` is a test-time and server-time `OffscreenCanvas` for Pretext, backed by HarfBuzz shaping your own
font files. Pretext and every pretext-kit helper then run in Node, Bun, vitest and jest (including jsdom) with no
browser, so "does „Zahlungspflichtig abonnieren“ fit this button at 160px?" becomes a unit test.

```sh
npm i -D harfbuzzjs@1.6.2 wawoff2@2.0.1   # optional peers, loaded by pretext-kit/headless, pretext-kit/check and check-labels, not by the root or pretext-kit/check/browser (wawoff2: WOFF2 fonts)
```

wawoff2 is loaded only when a WOFF2 font is registered; without it, the entry loads and TTF, OTF, TTC and WOFF fonts
register, and registering a WOFF2 rejects with an error naming the package.

```ts
import { readFileSync } from 'node:fs'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { registerFont, install } from 'pretext-kit/headless'

// The same files your CSS @font-face loads, under the same family names. TTF/OTF/TTC, WOFF or WOFF2.
// Register each weight you measure: '600 14px Inter' needs the 600 file, registered with { weight: 600 }.
await registerFont('Inter', new Uint8Array(readFileSync('fonts/Inter-Regular.ttf')))
install() // Chrome on macOS; install({ platform: 'linux' }) or 'windows' for their variable-font widths

// Before the first prepare(): a static import of Pretext above is fine, as Pretext reads the engine only then.
const { lineCount } = measureLineStats(prepareWithSegments('Speichern', '14px Inter'), 160)
```

A runnable version is `examples/vitest-label-fit.test.ts`.

### The claim and its limits

On Chrome (Chromium 149 measured on macOS, Linux and Windows), for code points covered by the registered fonts, `measureText` widths equal Chrome's Canvas at the whole-pixel font sizes the sweep uses, and
Pretext's line counts equal Chrome's page wherever Pretext inside Chrome does. Fractional font sizes are outside this
claim; see below. Measured twice:

- **Parity sweep** (`npm run verify:headless`, [verify/HEADLESS_RESULTS.md](verify/HEADLESS_RESULTS.md)), Chromium
  149.0.7827.55 via Playwright 1.61.0 on macOS 14.6.1, fonts loaded by `@font-face` from the same files: 7,344 widths
  (Inter TTF and WOFF2, Roboto, Shantell Sans at weights 400/600/700, Inter Variable at 300-800; 12-20px, letter
  spacing 0/0.5px), 6,126 bit-exact (all static Inter and Roboto ones), max 0.000427px (Inter Variable: max
  0.000092px); 141,226 line counts (Latin, German with soft hyphens, French, quoted, pictographic and separator texts
  at 120-600px), 0 differing from Pretext inside Chromium.
- **Initial research**, Chrome 154: 320/352 widths bit-exact, max 0.019px; line counts 2,021/2,024.

The sweep launches Chromium headed, as users see it. `npm run verify:headless -- --headless` uses Playwright's
headless Chromium instead, for machines with no display, and says so in HEADLESS_RESULTS.md: on the Mac above it gave
the same widths and 0 headless-mismatch, but 179 pretext-gaps rather than 176 (0.1.1's sweep, before Inter Variable
was added), as headless Chromium's page wraps three more lines differently (so CI runs headed, under xvfb on Linux).

The claim is scoped exactly so:

- **Registered fonts only.** A code point no registered font covers makes `measureText` throw a `HeadlessCoverageError`
  naming the character and the font list (Chrome would use an OS fallback font we can't reproduce). An opt-in
  `install({ onMissingGlyph: 'notdef' })` measures `.notdef` instead, for apps that accept the error. Curly and German
  quotes and the ellipsis work with Latin fonts: Pretext's Han-kerning probe of U+300C gets a stand-in width (it has no
  effect on text without CJK), but real CJK text in a font lacking it still throws. Inherent case: a lone `「` or `「「`
  segment in such a font measures that stand-in rather than throwing, as the probe is the same `measureText` call.
  Likewise Pretext's emoji correction probes U+1F600 for any Extended_Pictographic text (`©`, `®`, `™`, `↔`, `▶`, `♥`, `‼`), which
  gets a stand-in of exactly the font size (plus any letter spacing, as the U+300C stand-in gets); any other uncovered emoji, and U+1F600 inside a longer segment, still throws,
  and a standalone `😀` segment in a font lacking it measures that stand-in rather than throwing. A symbol your font
  lacks (Inter has no `✔`) throws for that glyph.
- **small-caps.** A `small-caps` font (which `fontFromStyle` emits for `font-variant: small-caps`) throws when it is
  set on the context: Canvas widths change with small capitals, and the stand-in does not model them.
- **Weights.** A weight with no matching registered face (600 or 700 with only a Regular file) silently measures the
  nearest registered face, so register the bold file your CSS uses, with `{ weight: 700 }`.
- **Target platform: `install({ platform: 'macos' | 'windows' | 'linux' })`.** Chrome measures a variable font
  differently per OS away from its default instance. On macOS (CoreText) it keeps the fractional HVAR advance
  delta; Chromium 149 on Linux and Windows rounds it to whole font units, as HarfBuzz does (measured by CI run
  [37410732972](https://github.com/Z003Y89/pretext-kit/actions/runs/37410732972) as equal to HarfBuzz's rounding:
  the unrounded stand-in was off there by 232 widths beyond 0.02px, max 0.055115px, and 11 line counts). `'macos'`
  (the default) measures with the unrounded advances, `'windows'` and `'linux'` with HarfBuzz's own. Pick the
  platform whose Chrome your users run, not the one your tests run on: the default is fixed rather than read from
  `process.platform`, so a test gives the same widths on a Mac laptop and a Linux CI runner, and it stays the macOS
  profile the measurements below were first made for. Static fonts, and a variable font at its default instance,
  measure the same under all three. The option is independent of `rounding`: `'whole-px'` rounds whatever advances
  the platform gives. Like the other options, a later `install()` call sets it again (omitted, back to `'macos'`);
  call Pretext's `clearCache()` if widths it already measured should follow. Anything else throws a `RangeError`.
  Confirmed by CI run [37412616029](https://github.com/Z003Y89/pretext-kit/actions/runs/37412616029): with the option, Inter Variable is bit-exact on Linux and Windows (2,352/2,352 widths, 0 line-count headless-mismatches of 69,408), and the planted "unround variable-font advances" mutant is caught there (232 widths beyond 0.02px, 11 headless-mismatches).
- **Variable fonts and split families.** A variable font is shaped at the requested weight on its `wght` axis
  (and `opsz`, `wdth`), with its advances unrounded under `platform: 'macos'`, as Chrome on macOS keeps them. That is
  verified against Chromium for Inter Variable's `wght` axis only, on macOS: at 300-800, 2,352 widths within 0.0001px and 0 of 69,408 line
  counts differing (0.1.1 rounded the advances to whole font units: up to 0.055px off, 11 line counts differing).
  For other instances the unrounded advance is checked against fontTools 4.62.1, exact: Inter Variable's `wght`,
  `opsz`+`wght` and standard (`opsz`+`wght`) latin files, 326 instances, 50 of them distinct `wght` values in the
  `wght` file (`npm run verify:hvar`, results in verify/HEADLESS_RESULTS.md). Nothing committed covers `wdth`. A family your CSS splits into several files by
  `unicode-range` (Fontsource does) is registered file by file, each with its own @font-face unicode-range:
  `registerFont('Inter Variable', data, { unicodeRange: 'U+0000-00FF,U+0131,…' })`. Files sharing a family,
  weight and style must each have a range, or draw disjoint code points; where only one has a range, only its
  code points inside that range count, so a ranged subset beside an unranged file is accepted when they do not
  overlap there. An invalid `unicodeRange` (`U+00FF-0000`, a start past U+10FFFF, a malformed token) makes
  `registerFont` throw a `RangeError` rather than being dropped as CSS would; an end past U+10FFFF is clamped to
  U+10FFFF, as in CSS.
- **Variable fonts the stand-in does not unround.** A variable font with avar version 2, or without an HVAR table
  (or with one that fails its structural checks), keeps HarfBuzz's own advances, rounded to whole font units: under
  `platform: 'macos'`, away from the default instance each glyph can be up to ½ font unit off Chrome on macOS. A malformed HVAR never makes
  `measureText` throw.
- **Chromium profile.** `install()` sets a desktop Chrome user agent, which Pretext reads at the first `prepare()`,
  so Pretext uses its Blink rules. WebKit and Gecko profiles are not supported.
- **Platforms.** Parity is measured for Chromium 149 on macOS (locally), Linux and Windows (CI run
  [37407438278](https://github.com/Z003Y89/pretext-kit/actions/runs/37407438278), artifacts `headless-results-ubuntu-latest` and `headless-results-windows-latest`). The
  `parity` job runs the same sweep, headed, on `ubuntu-latest` (under xvfb) and `windows-latest` with Node 24.
  Linux: 3,720 of 4,992 widths bit-exact (every Inter and Roboto one), max |Δ| 0.001862px; 0 headless-mismatch in
  71,818 line counts (178 pretext-gap). Windows: 3,842 bit-exact, max |Δ| 0.000427px; 0 headless-mismatch (179
  pretext-gap). So `install({ rounding: 'whole-px' })` is not needed on either with Chromium 149. These CI numbers
  are 0.1.1's sweep, without Inter Variable. With Inter Variable, CI run
  [37410732972](https://github.com/Z003Y89/pretext-kit/actions/runs/37410732972) found Chromium on Linux and Windows
  equal to HarfBuzz's whole-unit rounding (the default instance exact), which `platform: 'linux'`/`'windows'` now
  uses; `verify:headless` installs the platform of the OS it runs on and prints it. With the option, CI run
  [37412616029](https://github.com/Z003Y89/pretext-kit/actions/runs/37412616029) measured Linux 6,072/7,344 widths bit-exact (max 0.001862px) and Windows 6,194/7,344
  (max 0.000427px), Inter Variable 2,352/2,352 on both, and 0 headless-mismatch in 141,226 line counts on each. An earlier
  independent Linux run on Chromium 141 (raw data not in the repository) gave the same tallies (EVALUATION §3).
- **Fractional font sizes on Linux.** On the `'linux'` profile the stand-in measures a fractional size (13.455px, for
  instance) by Chromium on Linux's own rule: the size in float32 hundredths, advances at that size
  truncated to 1/64 px (`sizedFor` in `src/headless/canvas.ts`, `test/headless/fractional-size.test.ts`). That rule was
  derived and measured on Chromium 141.0.7390.37 on Linux, not on the Chromium 149 quoted above, and it is exact for the
  first use of a size in a page. Later in the same page Chromium can reuse the glyph metrics of a nearby fractional size
  it measured earlier, in either direction, which the stand-in does not model: a page that uses two fractional sizes a
  few hundredths of a px apart can measure one 1/64 px advance step differently from the stand-in. Optical size
  (`opsz`) on a variable font takes that same hundredths size on this profile; how Chromium sets `opsz` from a
  fractional size is unmeasured. `'macos'` and `'windows'` measure at the size asked for, with no fractional-size
  evidence for either. The parity sweep (`HEADLESS_RESULTS.md`) uses whole-pixel sizes.

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
  const { lineCount } = measureLineStats(prepareWithSegments('Speichern', '14px Inter'), 160)
  expect(lineCount).toBe(1)
})
```

jest + jsdom. pretext-kit and Pretext are ESM only (no `require` condition), so use jest's ESM mode:
`NODE_OPTIONS=--experimental-vm-modules npx jest` (with `jest-environment-jsdom` installed).

```js
// jest.config.mjs
export default { transform: {}, testEnvironment: 'jsdom', setupFilesAfterEnv: ['./jest.setup.mjs'] }
```
```js
// jest.setup.mjs: runs inside the jsdom environment before each test file, so `document` already exists
import { readFileSync } from 'node:fs'
import { TextDecoder, TextEncoder } from 'node:util'

// jest-environment-jsdom has no TextDecoder/TextEncoder, which harfbuzzjs needs when it loads,
// so set them first and import the headless module dynamically after.
Object.assign(globalThis, { TextDecoder, TextEncoder })
const { registerFont, install } = await import('pretext-kit/headless')
await registerFont('Inter', new Uint8Array(readFileSync('fonts/Inter-Regular.ttf')))
install()
```

Verified by running jest 30 with `jest-environment-jsdom` on a copy of this repo (a test with `document.body` present
measured `'Speichern © 2026'` at 600 14px Inter, with only the Regular file registered and so measured in it, in one line at 160px).

### jsdom

jsdom has a `document.body`, but its `getBoundingClientRect` returns zeros. Pretext corrects Canvas emoji widths
against a DOM span (only when Canvas's emoji width exceeds the font size by more than 0.5px); under jsdom the span
measures 0, so that correction would zero every emoji it applies to. What the stand-in guarantees: Pretext's probe
string U+1F600 measures exactly the font size where no registered font has it, so the correction doesn't fire for text
like `© 2026`, and an emoji no registered font covers throws `HeadlessCoverageError` instead of measuring as 0. It does
not clamp the width of emoji your registered fonts do cover: a registered emoji font whose U+1F600 advance exceeds
size + 0.5px makes Pretext's correction run, and under jsdom it zeroes those emoji. So register an emoji font with an
advance of at most size + 0.5px (Apple Color Emoji is exactly 1em), or stub `getBoundingClientRect` on the jsdom
window, or don't expose jsdom's `document` to Pretext. Pretext reads `document` from the first `prepare()` on; to
reproduce a jest/vitest jsdom environment in a plain Node test, set jsdom's globals and then `await import()` Pretext,
as `test/headless/jsdom.test.ts` does.

### Soft hyphens and invisible characters

Like Chrome's Canvas, the stand-in cuts words at U+0020, ZWSP, and the characters Chrome turns into ZWSP (SHY U+00AD,
LRM, RLM, U+202A-U+202E, U+FEFF, U+FFFC), so kerning does not apply across them: `width('A\u200EV')` is `A` plus `V`.
A soft hyphen that Pretext breaks at paints the font's own U+2010, or `-` when the font lacks U+2010.

One case is inherent: a standalone U+2010 segment in a font that lacks that glyph measures with `.notdef` (or the
generic stand-in) rather than throwing, because Pretext's hyphen probe and a real segment are the same `measureText`
call, so the two cannot be told apart.

The [headless parity example](#examples) runs the same comparison live, in whichever browser opens it. In
Chromium on macOS every line count, fitted size and width matches; in WebKit and Firefox, which are outside the claim
(Pretext there uses that engine's rules and Canvas), it compares line counts and fitted sizes, and shows the widths
apart.

## Label checker

`pretext-kit/check` answers, for a whole catalogue at once, "does „Zahlungspflichtig abonnieren“ fit the 160px button
at 130% text size?", and for each failure says what is missing: the px of width, or the font size that would fit. It
is a test-time and CI check. It runs `fitFontSize`, `prepareSizes`, `clamp` and `prepareLabel` (middle truncation
uses `prepareLabel`'s white-space collapse and its own fit test, not `truncateMiddle`), and Pretext's `measureNaturalWidth`
and `measureLineStats` for widths, line counts and row totals, through `pretext-kit/headless`, so its verdicts carry the
headless parity evidence ([the claim](#the-claim-and-its-limits)) and add the checker's own, in [verify/CHECK_RESULTS.md](verify/CHECK_RESULTS.md) and EVALUATION.md C11.

It needs `harfbuzzjs` (and `wawoff2` for WOFF2 fonts) installed: `pretext-kit/check` and the `check-labels` command import the headless stand-in. Without it the command prints `npm i -D harfbuzzjs@1.6.2` and exits 2. The root entry and `pretext-kit/check/browser` need neither.

```ts
import { checkLabels, conditionGrid } from 'pretext-kit/check'

const report = await checkLabels({
  fonts: [{ family: 'Inter', path: 'fonts/Inter-Regular.ttf' }],      // what registerFont gets, plus featureSettings
  labels: { de: { button: { pay: 'Zahlungspflichtig abonnieren' } }, en: { button: { pay: 'Subscribe and pay' } } },
  slots: { button: { width: 160, reserve: 20, font: '15px Inter', policy: 'as-is', uses: ['button.*'] } },
  conditions: conditionGrid({ textScale: [1, 1.15, 1.3] }),
})
if (report.failures.length > 0) throw new Error(JSON.stringify(report.failures, null, 2))
```

| `CheckInput` field | what it is |
|---|---|
| `fonts` | the font files, `{ family, path \| data, weight?, style?, unicodeRange?, featureSettings? }` as `registerFont` takes them |
| `labels` | parsed i18n files, a list of labels or a function returning one (below) |
| `slots` | where each label is shown (below), or a function returning them |
| `rows` | several slots sharing one line ([Rows](#rows)) |
| `conditions` | text scale, zoom, viewport and slot overrides ([Conditions](#conditions-text-size-and-zoom-are-different)); default one condition, `default` |
| `platforms` | `'macos'`, `'windows'`, `'linux'`; default all three ([Where it runs](#where-it-runs)) |
| `samples` | placeholder values per key ([The report](#the-report)) |
| `nearMiss` | px, off by default: a label or row that passes with less slack than this is the warning `near-miss` ([Policies](#policies)); a finite number above 0, else a `RangeError` |

`labels` is parsed i18n files (`{ locale: { key: text } }`, nested objects flatten to dotted keys), a list of
`{ key, text, slot, locale? }`, or a function returning one. A slot says where a label is shown: `width` (content box
px at zoom 1, or a function of the window width), `reserve` (an icon and its gap, which scale with the text), `font`
(CSS shorthand at scale 1), `letterSpacing`, `lineHeight` (optional; no verdict uses it, `slotFromStyle` records it), `whiteSpace`,
`overflowWrap` (`'break-word'`, the default, or `'normal'`: whether a word wider than the box may break inside, see
[Policies](#policies)), `numeric` (`'tabular'` for `font-variant-numeric: tabular-nums`), `textTransform` (applied with
the label's locale: uppercase tabs are much wider than their source text), `policy`, and `uses` (key patterns such as
`'toolbar.*'` that bind i18n keys to the slot). Slots that live in CSS come from
`slotFromStyle(getComputedStyle(el), el.getBoundingClientRect(), policy, { reserve, uses }?)`, run once in a browser
test (or from the async `slots` hook), so they follow the design instead of drifting from it; the checker does not
parse CSS.

`overflowWrap` defaults differ by where the slot comes from. A slot written by hand defaults to `'break-word'`, which
is how Pretext lays text out. `slotFromStyle` returns what the element's computed style does: `'break-word'` for
`overflow-wrap: break-word` (Tailwind's `break-words`) or `anywhere`, or for `word-break: break-all` or `break-word`, and
otherwise `'normal'`, CSS's initial value. So a slot taken from an element with plain CSS is `'normal'`, and a long word
in its `{ lines: 2 }` slot fails, as the browser overflows it, where the same slot written by hand would pass by
breaking the word mid-word.

### Policies

Each slot declares what its design does with a label that is too long. The box is `width − reserve`.

| policy | passes when | otherwise |
|---|---|---|
| `'as-is'` | the label is one line wide enough at the slot's size | failure `overflow`, with `missing.px` |
| `{ shrinkTo: 12 }` | the label fits on one line at some size from 12px to the slot's size (the minimum scales with text scale and zoom: 15.6px at text 130%) | failure `below-min-size`, with `missing.px` at the minimum and `missing.fitsAtPx` |
| `{ lines: 2 }` | at most 2 lines at the slot's size; with `overflowWrap: 'normal'`, also every word fits the box | failure `too-many-lines`; a word wider than the box under `'normal'`: failure `overflow`, with `missing.px` |
| `{ truncate: 'end', lines?: 1 }` | `clamp` does not cut it; with `overflowWrap: 'normal'`, also every word fits the box | warning `truncated` |
| `{ truncate: 'middle' }` | the white-space-collapsed text fits on one line | warning `truncated` |

A "word" under `overflowWrap: 'normal'` is the text between two of the browser's break opportunities (spaces, the break
after a hyphen-minus, soft hyphens, CJK breaks; Pretext's own segmentation): an unbroken word paints at its natural
width, so it fits when that width is at most the box plus 1/64 px (lines are then counted and clamped at that width too,
so such a word stays whole), and a word ending at a soft hyphen fits only with the hyphen it paints when the line breaks
there. That 1/64 px then applies to every line of the text, not only the word's: a line within 1/64 px of the box can pass
where Chromium, whose width is 1/64 px wider than Pretext's, wraps it (a probe found 48 of 3,000 adversarial `lines: 2`
cases at 20.8px, none at 16px). The issue's `missing.px` is the widest failing word's width less the box,
`measured.width` that word's width, and its `detail` names the word. `measured.lines` on such an `overflow` is the line
count Pretext gives at the box with words broken mid-word (`'break-word'`), not what the browser paints under
`'normal'`, where the word stays whole and can take fewer lines. Under `'break-word'`
(as Pretext lays text out) such a word breaks between letters, which is how a `{ lines: 2 }` slot with `break-words`
holds „Benachrichtigungen“ in two lines. Under truncate end, Chromium cuts an unbreakable word at the box with an
ellipsis on whichever line of the clamp it sits (`text-overflow` applies to every line), so the label is `truncated`
even when it takes no more lines than allowed. `'as-is'`, `shrinkTo` and middle truncation are one line already and
ignore `overflowWrap`.

**Near-miss.** With `nearMiss` set (px), a label that passes with less than that much slack is the warning
`near-miss`, so a label that fits with 0.1px to spare, and can break with the next font or locale change, shows up
before it does. The slack is taken in the box the verdict used (`width − reserve`, scaled by text scale and zoom as above),
rounded to 1/64 px as the report is, and compared in the report's px (zoomed px under `zoom`):

| policy | slack |
|---|---|
| `'as-is'`, `{ truncate: 'middle' }` | the box less the label's natural width (middle: of the white-space-collapsed text) |
| `{ shrinkTo }` | the box less the label's width at the size it fits at: the slot's size, or the size it shrank to |
| `{ lines }`, `{ truncate: 'end' }` (not cut) | the box less the widest line, laid out as the verdict lays it out; under `overflowWrap: 'normal'` no less than the widest word |
| a row (passing, or collapsed) | the row's width less its items and gaps at the stage it fits at (0, or the collapse stage) |

A pass only within the fit tolerance (Pretext's 0.005 px on one line; 1/64 px for `overflowWrap` words and rows) has 0px to spare, the most fragile case, so it is always a near-miss when `nearMiss` is set. A
failing verdict is never a near-miss, a near-miss is never a failure, and the label is checked (and counted in
`checked`) once either way. A label checked with a placeholder left in (`missing-sample`) gets no near-miss: its text
is not what the app shows. A collapsed row can carry both its `row-collapsed` note and a `near-miss`.

For `lines` and `truncate: 'end'` the slack is how far the box can shrink before the layout changes (a line takes a
word or a letter less), not how far before the label fails: a text that would wrap again and still fit is flagged.
„Speichern unter“ in `{ lines: 2 }` at its natural width less 0.004px still takes one line and is a near-miss with
0px; at 0.006px less it wraps into two lines with room to spare and is none. In Pretext's model that is conservative:
a near-miss never misses a real failure, it can flag a label that would still fit.

Truncation is a warning because cutting is what the design asked for; `--strict` turns warnings into a failing exit.
A code point the registered font does not cover is the failure `uncovered`, never a thrown error. `shrinkTo` tries the
slot's size, every whole pixel below it down to the minimum, and the minimum itself.

### Conditions: text size and zoom are different

A condition names a combination the app ships (names must be unique); conditions are listed, not multiplied out, and
`conditionGrid({ textScale: [1, 1.15, 1.3], zoom: [1, 1.3], viewport: [1024, 1440] })` builds the full product when you
want it (names like `text 115% · zoom 130% · 1024px`). `slots` per condition overrides slot fields (a compact theme
with another base size); `viewport` is passed to `width` functions (default 1440).

- **`textScale`** is a text-size setting: font size, letter spacing, line height, `reserve` and a `shrinkTo` minimum grow
  (12px becomes 15.6px at 1.3); boxes, rows and gaps keep their px width.
- **`zoom`** is CSS `zoom` or page zoom: everything grows, boxes and gaps too, so the boundary stays where it was at zoom 1.

For a 160px slot with a 20px icon reserve and a label about 120px wide at 16px: at `textScale: 1.3` the label is about
156px and the box is 160 − 20 × 1.3 = 134px, so it overflows; at `zoom: 1.3` the label is about 156px and the box is
160 × 1.3 − 20 × 1.3 = 182px, so it fits. Treating zoom as a text scale would report the second as a failure. The
sweep renders both in Chromium (a font-size change in a fixed box, and CSS `zoom` on the container) and the planted
bug "treat zoom as textScale" is caught ([EVALUATION.md](EVALUATION.md) C11).

### Rows

A `rows` entry is several slots sharing one line (a toolbar), with the row's `width`, the `gap` between items, and per
item the label `key`, its `slot`, optionally `collapse: { order, iconWidth }` (it may drop to icon only; lower
`order` collapses first) and `shortKey` (a shorter label tried before icon only). Stage 0 is every item with its
label; each later stage applies the next step in collapse order to one item. The row passes at the first stage whose
widths and gaps fit. If that is a later stage the report holds a note, `row-collapsed`, naming the stage: information, not a failure. If even the last
stage does not fit it is the failure `row-overflow`. A row issue uses the row's name as its slot and, as its text, the item texts joined by ` | `.

### The report

```ts
type Report = {
  schema: 1
  failures: Issue[]    // overflow, too-many-lines, below-min-size, row-overflow, uncovered
  warnings: Issue[]    // truncated, missing-sample, unsupported-message, unverifiable, near-miss
  notes: Issue[]       // row-collapsed
  unchecked: string[]  // 'locale:key' of labels no slot or row uses
  checked: number      // label verdicts and row verdicts, per condition and platform
}
```

An `Issue` has `kind`, `locale`, `key`, `slot`, `condition`, `platforms` (issues for different platforms are merged
into one when their numbers differ by at most 1/64 px, showing the worst platform's numbers; larger differences stay
separate; the grouping is greedy in platform order, so a spread of 2/64 px across platforms can split into two issues),
`text` (with samples filled in), `measured` (`width`, `box`, `lines`, `fontPx`, and `stage` for rows)
and, where it applies, `missing: { px?, fitsAtPx? }` and a `detail`. For `near-miss`, `missing.px` is the slack to
spare, not what is missing, and `measured` is what the passing verdict measured; issues of different platforms merge
with the smallest slack as the worst. The order is stable: by slot or row, condition,
locale, key, platform; numbers are rounded to 1/64 px; there are no timestamps or paths. Two runs, before and after a
font change, diff line by line.

`samples` gives a key's placeholder values (`{ 'cart.items': [{ count: 1 }, { count: 12345 }] }`); every sample is
checked. Placeholders are `{name}` and i18next's `{{name}}` (the whole group is replaced by the sample). A placeholder with no sample is the warning `missing-sample` and is checked as written. ICU
`plural` and `select` messages are not expanded: they give the warning `unsupported-message` and are not checked
(so are `{n, number}` placeholders).

### Where it runs

- **Node** (`pretext-kit/check`): fonts from `fonts` through `pretext-kit/headless`, checked on the `'macos'`,
  `'windows'` and `'linux'` profiles by default (`platforms`); the report names which platforms an issue holds on.
  Measurement differs between platforms, so a label can fit on one and not another. A tabular slot (`numeric:
  'tabular'`) is measured with a second registration of its font under an internal alias family with `tnum` on
  (`featureSettings` on `registerFont` is the `@font-face` descriptor), because Canvas cannot express
  `font-variant-numeric`. `textTransform` is applied with the label's locale.
- **Browser** (`pretext-kit/check/browser`, for Playwright or the app's own test runner): the page's own fonts and
  canvas, so `fonts` must be absent (it throws a `RangeError` otherwise); one platform, `'browser'`. What one mode
  cannot check is reported, not passed: Canvas cannot apply `font-variant-numeric`, so in the browser a `tabular` slot
  (and a row containing one) gives the warning `unverifiable` and is not counted in `checked`.

### `npx pretext-kit check-labels`

```sh
npx pretext-kit check-labels [--config labels.config.mjs] [--json] [--strict] [--platform macos,windows,linux] [--near-miss <px>]
```

The config module default-exports a `CheckInput`; `labels` may also be `{ files: 'locales/*.json', locale?: (path) => name }`
(the locale defaults to the file name without `.json`; several files of one locale merge, and a repeated top-level key
is an error), and `fonts[].path` is resolved from the config's directory. Output: failures, then warnings, then notes,
grouped by slot and condition, one line each with the locale, key, text and what is missing, then a count line.
`--json` prints the Report. Exit codes: 0 no failures (and, with `--strict`, no warnings), 1 failures (or warnings with
`--strict`), 2 a usage or config error (bad flag, unreadable config, no file matches, `labels` of the wrong type, harfbuzzjs not installed, or nothing checked because no key matched a slot or row). The line `N keys matched no slot or row` follows the count when N is not 0. `--help` prints the usage. `--platform` limits the run;
`--config` defaults to `labels.config.mjs`. `--near-miss <px>` (or `--near-miss=<px>`) sets the config's `nearMiss` or
overrides it; a value that is not a finite number above 0 is exit 2. A near-miss prints as `near-miss: 0.09375px to
spare` and counts as a warning, so it exits 0, and 1 with `--strict`. A value that starts with `--` needs the `=` form (`--config=--x.mjs`).
The repository's own fixture, `test/check/fixtures/labels.config.mjs` with its two locale files:

```js
export default {
  fonts: [{ family: 'Inter', path: '../../fonts/Inter-Regular.ttf' }],
  labels: { files: 'locales/*.json' },
  slots: {
    button: { width: 90, font: '16px Inter', policy: 'as-is', uses: ['button.*'] },
    title: { width: 200, font: '16px Inter', policy: { truncate: 'end', lines: 1 }, uses: ['title.*'] },
    tool: { width: 100, font: '16px Inter', policy: 'as-is' },
  },
  rows: {
    toolbar: {
      width: 220,
      gap: 8,
      items: [
        { key: 'toolbar.save', slot: 'tool' },
        { key: 'toolbar.share', slot: 'tool', collapse: { order: 1, iconWidth: 20 } },
      ],
    },
  },
  conditions: [{ name: 'default' }],
}
```

```sh
$ npx pretext-kit check-labels --config test/check/fixtures/labels.config.mjs
button · default
  de button.export  "Als Datei exportieren"  overflow: 67.515625px too wide
  en button.export  "Export as file"  overflow: 8.6875px too wide

title · default
  de title.intro  "Willkommen zurück in Ihrem Arbeitsbereich"  truncated: cut at 200px
  en title.intro  "Welcome back to your workspace"  truncated: cut at 200px

toolbar · default
  de toolbar  "Speichern | Freigeben und Zusammenarbeiten"  row-collapsed: stage 1

30 checked, 2 failures, 2 warnings
$ echo $?
1
```

Under the fixture's `button` slot (90px, `as-is`) the German "Als Datei exportieren" is 67.515625px too wide; the `title`
slot (200px, `truncate: 'end'`, one line) cuts both introductions; the toolbar collapses to its stage 1, which is a
note and is neither a failure nor a warning (so it is not in the counts).

### Limits

- **Platforms differ.** The three Chromium profiles measure differently (variable-font advances; fractional sizes on
  Linux), which is why an issue lists its platforms. Chromium only: no WebKit or Gecko profile.
- **Linux fractional font sizes.** See [the headless limits](#the-claim-and-its-limits). Exact for the first use of a
  size in a page; Chromium reuses the glyph metrics of a nearby fractional size measured earlier in the same page,
  which the stand-in does not model, so a page with two fractional sizes a few hundredths of a px apart can differ by
  one 1/64 px step. The model was derived on Chromium 141, not 149; `opsz` on Linux is unmeasured.
- **Text at a box exactly the measured width.** In the sweep (EVALUATION.md C11, verify/CHECK_RESULTS.md) 6,300 of the
  7,292 pretext-gaps of the verdict cases sit at the exact boundary box, 72 at 1.1 times it, 12 are rows and 908 are `overflowWrap: 'normal'`
  slots within 1/32 px of the widest word's own width (all under zoom 130%, none at zoom 100%), from Chromium
  behaviour the checker does not model: at text 130% · zoom 130% Chromium lays out the zoomed 20.8px like an unzoomed 27.02 to
  27.03px, not 27.04px (322 per policy; the Linux fractional-size model covers sizes, not zoom), and the rest is
  consistent with Chromium snapping zoomed slot, icon and text widths to its 1/64 px layout grid, which is confirmed
  for the box widths only (the DOM box less the checker's box is −0.0156 to +0.0094 zoomed px over those 908 cases, 0 at zoom 100%). Mostly, not only, soft-hyphenated text: 5,027 involve soft hyphens (2,445 `nowrap` width cases (as-is, truncate middle,
  shrinkTo), where Chromium's text is wider than Pretext's natural width (for as-is at text 100% and zoom 100%, 0.125 to
  0.828px, most often 0.25px; up to 1.23 zoomed px over all conditions), and 2,582 line-break cases (lines and truncate
  end, with either `overflowWrap`), where Chromium breaks differently); the other 2,265 have none (English "Just tried":
  DOM 3 lines, Pretext 2). At a box exactly as wide as
  Pretext's width the checker can pass a label that overflows in the DOM. Leave slack of up to about 1px on boxes sized
  from a measured width, most of all for soft-hyphenated German and French.
- **Near-miss slack is Pretext's.** The slack `nearMiss` is compared with is Pretext's width, so it carries Pretext's
  gaps. In the sweep's near-miss family (98,172 cases, `nearMiss: 2`) the checker's decision and slack equal the
  reference's in every case; for one-line text without soft hyphens at zoom 100% Chromium's slack is 0 to 1/64px less
  than Pretext's, but for the compound below. Chromium's free space falls on the other side of the margin in 1,565 cases. The largest cause is
  Pretext's width for the pieces of a word: a word broken mid-word (`overflowWrap: 'break-word'`) or at a soft hyphen
  is measured as the sum of its pieces, without the kerning and ligatures between them („d’offres.“ breaks as „d’off“ /
  „res.“ in Chromium too, and Pretext's „d’off“ is 1.6px wider: the `ff` ligature), and a hyphen-minus compound as its
  two halves („Nebenrollen-Takes“ loses the `-T` kerning, 1.2px at 16px, 0.27 to 2.12px over the sweep). That makes
  Pretext's line wider and its slack smaller, so the label is flagged sooner: the safe direction. The others:
  soft-hyphenated one-line text (Chromium's slack −1.26 to +2.17px from Pretext's), soft-hyphenated lines Chromium
  places differently, one-line text and rows under zoom (text 130% · zoom 130%: +0.26 to +0.66px; one shrinkTo case at
  text 115% · zoom 130%, 1/32px less room), and 8 cases where Chromium breaks a line at another place („of library. If
  you can't“ with a line 1/64px past the box, „unequally at birth.“). The comparison resolves 1/4px: the sweep's boxes
  sit that far from the margin (CHECK_RESULTS.md, "Resolution"). Choose a margin wider than the gap you want to absorb.
- **Near-miss for `lines` and `truncate: 'end'`** means the layout would change, not that the label would fail (see
  [Policies](#policies)), so it can flag a label that would wrap again and still fit.
- **`shrinkTo` is whole pixels** (`fitFontSize`'s): the checker tries the slot's size, whole pixels and the minimum, never a
  size between two whole pixels, so a design that shrinks continuously fits at sizes the checker does not try.
- **`truncate: 'end'`** passes a single character (grapheme) wider than the box (an `W` in an 8px box): `clamp` flags
  that case and the checker does not turn the flag into a verdict. Under `overflowWrap: 'break-word'` a long word breaks
  and is `truncated` only when that makes too many lines; under `'normal'` a word wider than the box is `truncated`.
- **`overflowWrap` has two values.** `overflow-wrap: anywhere` and `word-break: break-all` map to `'break-word'`, which
  breaks a word only where it does not fit; `break-all` breaks between any two letters to fill each line, so its line
  counts can be lower than the checker's. `word-break: keep-all` (CJK) is not modelled, nor is `hyphens: auto`: Chromium
  may hyphenate a word the checker reports as `overflow` under `'normal'`. Words are Pretext's segments, and a boundary
  between two text segments counts as a break opportunity; the flag Pretext keeps internally for the rare boundary that
  is not one (around zero-width glue and controls, which the checker joins to the text beside them) is not read.
- **`truncate: 'middle'`** collapses white space as `truncateMiddle` does, then measures the collapsed text with the slot's
  `letterSpacing` and `whiteSpace` and applies the same fit test as the other policies; `truncateMiddle`'s own result can
  disagree with it within 1/64 px above the box width, which the checker's fit test (the kit's, 1/64 px) allows.
- **One call at a time (Node).** `checkLabels` uses Pretext's and the headless stand-in's global state: the font
  registry and install options are shared, so concurrent calls corrupt each other. Each call starts from an empty font
  registry, so **fonts you registered through `pretext-kit/headless` are wiped**, and it leaves the `OffscreenCanvas`
  stand-in installed afterwards. Await each call before the next; use `fonts` rather than `registerFont` beforehand.
- **The CLI's glob is its own** and minimal: `*`, `**` and `?`; it skips dot entries and `node_modules`.
- **Not in this version:** ICU plural/select expansion, CSS parsing, WebKit and Gecko profiles, React Native.
- **Evidence.** The sweep ran on Linux, Chromium 141, with Inter Regular only; macOS and Windows
  runs of `verify:check` have not been made (CI produces the artifact), so the macOS and Windows verdicts are
  unverified until it exists. [EVALUATION.md](EVALUATION.md) C11 and its threats list what else.

## Not in v1

- **Masonry and flow around shapes**: shortest-column placement is a few lines of app code once heights are exact.
- **Hyphenation, carets and selection, bidi visual order**: engine work that belongs in Pretext itself. (Soft
  hyphens you insert are supported; see [Hyphenation](#hyphenation).)
- **Non-web engines** (React Native, Flutter, native): later sub-projects.
- **Framework bindings**: a React hook is a few lines of app code; see [Recipes](#recipes).

## Credit and licence

pretext-kit is built on [Pretext](https://github.com/chenglou/pretext) (Cheng Lou and the Pretext contributors), and
is not part of it. `src/clamp.ts`, `src/middle.ts` and `src/cut.ts` derive from Pretext's `pages/demos/ellipsis.model.ts`;
each file says so in its header.

[MIT](LICENSE). The LICENSE file also reproduces Pretext's MIT notice. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
lists what ships, what is needed at runtime (Pretext, MIT; the optional peers harfbuzzjs and wawoff2, MIT) and the
test-only fonts, which are not shipped; each release also carries a CycloneDX SBOM of the package's runtime tree,
`pretext-kit-<version>.sbom.cdx.json`, built by `verify/pack-release.sh`. The examples bundle Inter
([SIL Open Font License 1.1](examples/fonts/inter-OFL.txt)) and ship strings hyphenated at build time by the
[hyphen](https://github.com/ytiurin/hyphen) package (ISC; its TeX hyph-utf8 patterns are MIT-licensed). The German
patterns stay out of the pages. The headless tests, the parity sweep and the headless-parity example use the test
fonts in `test/fonts`: Inter ([OFL 1.1](test/fonts/OFL.txt)), Roboto ([Apache 2.0](test/fonts/Roboto-LICENSE.txt))
and Shantell Sans ([OFL 1.1](test/fonts/ShantellSans-OFL.txt)).

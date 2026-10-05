# pretext-kit

Exact text-sizing helpers for web UIs, built on [Pretext](https://github.com/chenglou/pretext). pretext-kit is not
part of Pretext and is not maintained by its authors; it calls Pretext's public API and adds the answers apps keep
re-deriving on top of it: the font size that fits a box, the width that balances lines, clamped and middle-cut text,
list heights. Every helper is checked against what Chromium, WebKit and Firefox actually paint
([verify/RESULTS.md](verify/RESULTS.md)).

What it adds that CSS can't do:

- **`fitFontSize` / `fitFontSizeRich`**: the largest whole-pixel size at which a label, or an icon and a label
  together, fits a box: on one line, in N lines, or in a height; and so one shared size for a whole toolbar or
  button row. CSS has no exact equivalent.
- **`truncateMiddle`**: `~/Projects/atlas/…/line-breaker.test.ts`, keeping as much of each end as fits, for any
  string. CSS can cut the middle only where you already know the split point.
- **Numbers before render**: heights, widths and line counts for text that isn't in the DOM yet (virtual lists,
  canvas, layout decided ahead of paint).

Coming, not shipped yet: **pretext-kit/headless**, the same answers in Node and CI with no browser
([below](#headless-coming)).

![A billing screen in German, side by side: pretext-kit puts the toolbar in one row with one label collapsed to its icon; best-effort CSS wraps the toolbar onto a second row](examples/screenshots/responsive-ui.png)

*The [examples](#examples): one screen laid out by the kit (left) and by best-effort CSS (right). Good CSS doesn't
overflow either; the kit decides things CSS can't, such as one shared size for the toolbar and which labels
collapse to icons.*

## Install

pretext-kit is not on npm yet. It needs Pretext from `main` at
[f10d888](https://github.com/chenglou/pretext/commit/f10d888c0f3dfc5877fbca5e4570ee04111e7001) (2026-10-05), since
npm's `@chenglou/pretext` 0.0.9 predates the per-engine line breakers the kit is verified against:

```sh
git clone https://github.com/chenglou/pretext && (cd pretext && git checkout f10d888 && npm install && npm run build:package)
git clone <this repo> pretext-kit && (cd pretext-kit && npm install && npm run build)
npm install ./pretext ./pretext-kit
```

`@chenglou/pretext` is a peer dependency: your app and the kit share one Pretext, and one cache.

## When CSS is enough

| Helper | Plain-CSS alternative | When CSS suffices | When you need the kit |
|---|---|---|---|
| `balance` | `text-wrap: balance` (Chrome 114, Safari 17.5, Firefox 121) | Displaying a headline with even lines; engines balance only short blocks (each caps the line count it will balance) | You need the width as a number (canvas, SVG, layout decided before render), or longer blocks, or older engines |
| `clamp` | `-webkit-line-clamp` (all three engines; the unprefixed `line-clamp` isn't everywhere yet, so ship both) | Displaying "3 lines then …" | You need the cut text itself, or the clamped height before render (virtual lists, cards) |
| `shrinkwrap` | none for multi-line (`fit-content` stays at the full width once text wraps) | Single-line bubbles | Multi-line bubbles and tooltips that hug their text |
| `truncateMiddle` | two spans in a flex row: the start with `min-width: 0; overflow: hidden; text-overflow: ellipsis`, the end `flex: none` | The split point is known (the extension, a date after the last `_`) and the end always fits | Any string, where the cut should keep as much of each end as fits, measured |
| `fitFontSize(Rich)` | none exact; fluid `clamp()` and container units only approximate | When "about right" is fine, or wrapping the row is acceptable | Labels, badges and buttons that must fit, one shared size per row, in every language and text size |
| headless (coming) | a real browser in CI (Playwright) | You already run one | Unit tests and servers without a browser |

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

const path = prepareLabel('~/Projects/atlas/src/core/line-breaker.test.ts', font)
truncateMiddle(path, 220, { from: path.text.lastIndexOf('/') })   // a start, '…', then '/line-breaker.test.ts' whole

const sizes = prepareSizes('Zahlungspflichtig abonnieren', px => `500 ${px}px "Helvetica Neue"`, { min: 11, max: 16 })
fitFontSize(sizes, { width: 180, maxLines: 1 }, px => Math.round(px * 1.3))   // { px, prepared, lineCount } | null
```

- `shrinkwrapRich` / `balanceRich` take a `PreparedRichInline` (mixed fonts, chips, icons).
- `clampStats(p, width, maxLines)` gives `{ truncated, lineCount }` without building lines: all a list needs for
  rows it doesn't paint.
- `prepareSizesRich(px => items, range)` / `fitFontSizeRich` fit an icon and a label as one row; see
  [Mixed rows](#mixed-rows).
- `stack(heights, gap, tops)`, `findIndexAt(tops, count, y)`, `anchorDelta(oldTops, newTops, anchor)` are the three
  pieces of a virtual list; see [Recipes](#recipes).
- `fontFromStyle(getComputedStyle(el))` and `watchFonts(onChange)`: see [Fonts](#fonts).

The browser reproduces every answer: a helper returns a width, a font size, a line count or the cut text of a line,
and the browser's own wrapping at that value paints the predicted lines.

## What's exact

`npm run verify` sweeps every helper in Chromium, WebKit and Firefox (Playwright 1.61.0, macOS), at
deviceScaleFactor 1, 1.25 and 2, over Latin, CJK, Arabic, emoji chat, URLs, soft-hyphenated German and French, and
file paths, in four named fonts, at every width from 120 to 600px (80–400px for `truncateMiddle`; every fourth
width at 1.25 and 2). Each case is judged against Pretext's own numbers
first, then against the painted DOM. The recorded run has **zero kit-mismatch cases** in every browser at every
factor. The remaining non-pass cases are where Pretext itself differs from the browser (`pretext-gap`), or a proven
browser quirk (`platform`: WebKit 26 floors fractional line heights); none is patched in the kit. Builds, counts and
every finding grouped by cause: [verify/RESULTS.md](verify/RESULTS.md). The [accuracy example](#examples) shows them
as a grid.

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

The sweep's German and French corpora are hyphenated throughout and run through every helper: zero kit-mismatch
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
  (`fitFontSizeRich`, content widths, then icon-only for the widest labels, then two lines broken at spaces),
  badges that fit (`fitFontSize`, `shrinkwrap`), file names cut in the middle with no split point
  (`truncateMiddle`), and a 2,000-row list with exact heights and a scroll anchor (`stack`, `findIndexAt`,
  `anchorDelta`) beside CSS `content-visibility: auto`.
- **Text size**: an app-wide text-size setting from 0.8× to 1.5×. The kit reflows first and shrinks text by at
  most 10% (cf. WCAG 1.4.4).
- **Languages**: English, German and French; no hyphens in labels, soft hyphens only in a title word wider than
  its card.
- **Accuracy**: the sweep as a browser × zoom × helper × corpus grid with sample cases
  (`npm run examples:data` re-exports it from `verify/`).
- **Headless parity**: coming with pretext-kit/headless.

Fonts come from `fontFromStyle(getComputedStyle(el))`; the local server sends Inter 1.5 s late so `watchFonts`
visibly lays the page out again. `npm run examples:check` loads every page in headless Chromium at 360, 768 and
1280px and fails on a console error or on a kit-side box that overflows for any reason other than a pretext-gap
(a paragraph the browser wraps differently from Pretext's own layout of it). In its last run neither side
overflowed anywhere; best-effort CSS wrapped the toolbar onto a second row in 8 of 21 settings at 1280px and in
every setting at 360px.

| | |
|---|---|
| ![Text size at 1.3×](examples/screenshots/text-size.png) | ![Languages, German at 560px](examples/screenshots/languages.png) |
| ![Responsive UI at a 360px viewport](examples/screenshots/responsive-ui-360.png) | ![Accuracy explorer](examples/screenshots/accuracy.png) |
| ![2,000 rows with heights known before render, beside content-visibility: auto](examples/screenshots/numbers-before-render.png) | |

## Versions

pretext-kit is built and verified against Pretext `main` at
[f10d888](https://github.com/chenglou/pretext/commit/f10d888c0f3dfc5877fbca5e4570ee04111e7001); pin that commit until
Pretext's next release. It uses only Pretext's public exports: `prepareWithSegments`, `layout`, `layoutNextLine`,
`layoutNextLineRange`, `layoutWithLines`, `measureLineStats`, `measureNaturalWidth` and `clearCache`, and from
`@chenglou/pretext/rich-inline`, `prepareRichInline` and `measureRichInlineStats`. Of a prepared handle's fields it
reads only the documented `segments`.

## Headless (coming)

**pretext-kit/headless — coming in this repo; not shipped yet.** A Node-side measurer so Pretext and every helper
run in tests and on servers without a browser.

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

[MIT](LICENSE). The LICENSE file also reproduces Pretext's MIT notice. The examples bundle Inter
([SIL Open Font License 1.1](examples/fonts/inter-OFL.txt)) and ship strings hyphenated at build time by the
[hyphen](https://github.com/ytiurin/hyphen) package (ISC; its TeX hyph-utf8 patterns are MIT-licensed). The German
patterns stay out of the pages.

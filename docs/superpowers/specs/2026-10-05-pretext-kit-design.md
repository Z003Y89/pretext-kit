# pretext-kit: design

Sub-project 1 of 3. Status: draft for review, 2026-10-05.

## What this is

Pretext answers one question exactly and cheaply: *where does the browser break this text at this width?* Apps keep
re-deriving the same five answers on top of it, by hand, in demo code:

| App need | Today | pretext-kit |
|---|---|---|
| Chat bubble / tooltip hugs its text | `walkLineRanges` + max + `Math.ceil` + cap rule from README prose | `shrinkwrap()` |
| Headline / card title with even lines | binary search copied from `bubbles-shared.ts` | `balance()` |
| "3 lines then …", "… more" | 230-line `ellipsis.model.ts`, four workarounds (TODO.md, #42, #59) | `clamp()` |
| File name / path that keeps its end | grapheme-by-grapheme loop in the same demo | `truncateMiddle()` |
| Label, badge, button, poster text that fills a box | not covered: one `prepare()` per size, by hand | `fitFontSize()` |
| Virtualized list: heights, visible range, scroll anchor | 978-line `markdown-chat.model.ts` | `stack()`, `findIndexAt()`, `anchorDelta()` |

Each row is a pattern the maintainer already built, debugged against three browsers, and wrote down. pretext-kit
turns them into tested functions with the subtle parts encoded once (the 1/64 px fit tolerance, the `Math.ceil` and cap
rule, the space before an ellipsis, the clamp's first-grapheme rule), so app code calls one function instead of
porting a demo.

It targets every app shell whose UI is a web view: Electron and WebView2 (Chromium), Tauri (WKWebView on macOS,
WebView2 on Windows), Capacitor/Ionic and PWAs (WKWebView and Android WebView), and plain web. Pretext already models all
three engines, so the kit inherits that reach.

## The rules it keeps

These are Pretext's own rules (RESEARCH.md Part 1, AGENTS.md), adopted so the kit could be upstreamed piece by piece:

1. **The browser reproduces every answer.** A helper returns something the app hands back to the browser: a width, a
   font size, a line count, or the cut text of a line. The browser's own wrapping then gives the predicted lines.
   Nothing is estimated, so nothing needs patching later. `balance()` returns a *width*, not lines the browser wouldn't
   choose, so `width: Npx` on a normal element paints exactly the lines `balance()` saw.
2. **Prepare once, ask many.** Helpers take prepared handles. Searches (`balance`, `fitFontSize`) run on
   `measureLineStats()`: no strings, no allocation per probe. Only `clamp()` and `truncateMiddle()` build strings, and
   only for the lines they return.
3. **Tiny, plain and exact.** Plain functions and fixed-shape objects with no classes. Indexed loops and typed arrays
   for lists. No framework adapters in v1: a React hook is three lines of app code, so it isn't a library feature.
4. **No API without a user.** Every export above maps to a demo or open issue that already needs it. Masonry, flow
   around shapes and hyphenation are out (see Not in v1).
5. **Claims rest on browser runs.** Every helper is swept against the real DOM in Chromium, WebKit and Firefox, and the
   numbers are written down with build and date, Pretext-style.

## API

`import { … } from 'pretext-kit'` (depends on `@chenglou/pretext` as a peer). Until Pretext's next release it builds
against Pretext `main` (f10d888, 2026-10-05): npm's 0.0.9 predates the ports of each engine's line breaker.

### Width

```ts
shrinkwrap(prepared: PreparedTextWithSegments, maxWidth: number): { width: number, lineCount: number }
```
`maxWidth` is at least 0 (or `Infinity`); a negative or NaN one throws a `RangeError`, as Pretext does for its own
bad numbers. The width that paints the same lines as `maxWidth` and wastes no space: the widest line from `measureLineStats`,
`Math.ceil`'d and capped at `maxWidth` (the README's rule, encoded). One line walk, no search.

```ts
balance(prepared: PreparedTextWithSegments, maxWidth: number): { width: number, lineCount: number }
```
The narrowest whole-pixel width that still gives `maxWidth`'s line count, found by binary search over
`measureLineStats` (about 9 walks at 400 px). Line counts can rise when the width grows (RESEARCH.md, Width ranges), so
the search uses the count at `maxWidth` as its bound and checks the width it returns before returning it. An
already-one-line text returns its shrinkwrap without searching.

Both have `…Rich` twins over `PreparedRichInline` (`measureRichInlineStats`), for chat messages with inline code and
chips.

### Clamp and truncate

```ts
clamp(prepared: PreparedTextWithSegments, width: number, maxLines: number, tail?: Tail): Clamped
type Tail = { text: string, font: string, options?: PrepareOptions, width: number }
                                                  // what the painter appends after the cut (an ellipsis, "… more"), in its font;
                                                  // the cut is measured joined with it, so kerning and shaping across the seam count
measureTail(text: string, font: string, options?: PrepareOptions): Tail  // e.g. measureTail('…', FONT), measured once
```
`maxLines` (here and in `clampStats`) is a whole number of at least 1, else a `RangeError`. Matches `-webkit-line-clamp`. The clamped line breaks where it would without the clamp; the tail follows it if it
fits; otherwise the line is cut after the last grapheme that leaves the tail room, inside a word if need be, keeping at
least one grapheme. That is the rule browsers apply, per RESEARCH.md, Line Clamp And Ellipsis, which also gives the
demo's 8,025-layout agreement. Ported from `ellipsis.model.ts` (`clampLines`), with its constants becoming parameters. The browser sweep showed
that summing pieces misplaces the cut (Pretext ends a fresh line at the first soft hyphen even when it overflows,
Arabic and kerned text shape differently joined), so the cut is the longest grapheme prefix that, measured joined
with the tail as one text, fits: a binary search of a few `prepare()` calls (`src/cut.ts`, shared with `truncateMiddle`).

```ts
prepareLabel(text: string, font: string): PreparedLabel           // grapheme starts found once
truncateMiddle(label: PreparedLabel, width: number, keepEnd?: { from: number }): string
```
One-line middle truncation for file names, paths and IDs: `~/Projects/atlas/…/line-breaker.test.ts`. `label.text` is
the text as Pretext prepared it, white space collapsed (`white-space: normal`), and is what the result is cut from.
`keepEnd.from` is a code-unit offset into `label.text` the end must start at or before, e.g.
`label.text.lastIndexOf('/')`, so a file name is never cut.
Lifted from `layoutMiddle`. This is the desktop-app case Finder and Explorer solve natively.

### Font size

```ts
prepareSizes(text: string, font: (px: number) => string, range: { min: number, max: number }, options?: PrepareOptions): PreparedSizes
fitFontSize(sizes: PreparedSizes, box: { width: number, height?: number, maxLines?: number }, lineHeight: (px: number) => number):
  { px: number, prepared: PreparedTextWithSegments, lineCount: number } | null   // null: even `min` doesn't fit
```
The largest whole-pixel size whose text fits the box: no unbreakable piece wider than `width` (under
`overflow-wrap: break-word` that is when the browser overflows; Pretext can report a soft-hyphen or other line slightly
past `width` that the browser still paints inside it), total height within `height`, and at most `maxLines` lines. Sizes are whole pixels because Firefox measures Canvas at rounded sizes (README, Caveats).

Fit isn't monotonic in size for wrapped text, which is why sizes are searched and never scaled. The search binary-searches
sizes, then checks the size above the answer. `PreparedSizes` prepares a size the first time a search asks for it and
keeps it, bounded by `max - min + 1` handles for one text. On resize, only `fitFontSize()` runs again, typically with
no new preparing. This is Pretext's prepare/layout split applied to size. It's also the use case behind TODO.md's
parked "font given at `layout()`" idea, so this helper is the evidence for or against that idea.

### Lists

```ts
stack(heights: ArrayLike<number>, gap: number, tops: Float64Array): number  // fills tops, returns total height
findIndexAt(tops: Float64Array, count: number, y: number): number            // binary search: row at offset y
anchorDelta(oldTops: Float64Array, newTops: Float64Array, anchor: number): number // scrollTop change keeping row `anchor` still
```
The three pieces of `markdown-chat.model.ts` that every virtualized list needs and that aren't chat-specific. Heights
come from the app (`layout(p, w, lh).height` plus its own padding), so the kit doesn't own a row model. The arrays are
caller-owned and reused across frames, so there's no garbage on resize. `pages/demos/markdown-chat.md`'s rules carry
over unchanged: scroll only when layout moved the anchor, never clamp, and read back what the browser reports.

## Structure

```
src/
  width.ts        shrinkwrap, balance (+ rich)        ~80 lines
  clamp.ts        clamp, clampStats, measureTail       ~120
  middle.ts       prepareLabel, truncateMiddle         ~70
  font-size.ts    prepareSizes, fitFontSize            ~90
  list.ts         stack, findIndexAt, anchorDelta      ~50
  index.ts        re-exports
test/             node --test (Node 24 runs the .ts directly), logic on a stand-in measurer (fixed per-char widths)
verify/           browser sweep pages + Playwright runner
demo/             one page: each helper next to the plain-CSS result, resizable
```

Each file depends on Pretext's public exports only, never on its internals, so a Pretext release can't break the kit
silently. Of the handle's fields, only the README-documented `segments`/`kinds` are read (to find soft-hyphen breaks).

**Later engines (sub-projects 2-3).** The helpers call six Pretext functions: `measureLineStats`, `walkLineRanges`,
`layoutNextLine`, `layoutNextLineRange`, `layout` and `prepareWithSegments`. A React Native or native backend only has
to provide those six over its own text engine. v1 doesn't add an engine abstraction: it would be an API with no second
user (rule 4). The six-function list is written down so sub-project 2 can introduce the abstraction against a real
second engine.

## Verification

**Logic (`node --test`).** On a stand-in measurer with known widths, so the answers are computable by hand:
- shrinkwrap/balance return a width whose line count equals `maxWidth`'s, and `width - 1` gives more lines
  (balance), or `width` equals the ceil of the widest line (shrinkwrap).
- clamp: line count, truncation, the tail fitting, the first-grapheme rule, and empty and one-line text.
- truncateMiddle never cuts before `keepEnd.from` while the end fits.
- fitFontSize: the answer fits and `px + 1` doesn't (or is `max`), including a non-monotonic fixture.
- list: `findIndexAt` against a linear scan on random heights; `anchorDelta` keeps the anchor's on-screen offset.

**Browser truth (`verify/`).** A Playwright runner drives Chromium, WebKit and Firefox (the engines in Electron,
WebView2, WKWebView/Tauri/Capacitor). It sweeps 5 corpora (Latin prose, CJK, Arabic, emoji-mixed chat, long
URLs/paths), 4 named fonts, widths 120-600 px in 1 px steps and 1-5 lines. It paints each helper's output as an app
would, then reads the DOM:
- shrinkwrap/balance: an element at the returned width has the predicted line count and doesn't wrap again.
- clamp: `-webkit-line-clamp` box truncation and height agree, and each returned line painted with `white-space: pre`
  plus the tail fits the width. Comparing the cut against the browser's own ellipsis needs RESEARCH.md's SVG probe;
  v1 leans on the ellipsis demo's 8,025-layout result for the cut rule it ports, and adds the probe only if a case
  disagrees.
- truncateMiddle: the painted line fits the width and ends with the kept end.
- fitFontSize: the painted element at `px` fits the box, and at `px + 1` it doesn't.

**Pass bar:** the kit adds no mismatch. A case may fail only where Pretext's own `layout()` already disagrees with
that browser (a known Pretext gap, e.g. Arabic in-word cuts in Chrome and Firefox). Those are listed by cause, never
patched in the kit. Results are recorded in `verify/RESULTS.md` with browser builds and date.

**Cost.** A bench page reports µs per call for 1,000 chat messages: shrinkwrap, balance and fitFontSize on a resize, warm
and first-sight. The numbers are reported, not targeted. The structural bound is that balance costs about
log2(maxWidth) `measureLineStats` walks and fitFontSize about log2(max − min) plus 1.

## Not in v1

- **Masonry, flow around shapes**: shortest-column placement is a few lines of userland once heights are exact;
  the kit adds nothing exact to it.
- **Hyphenation, carets/selection, bidi visual order**: these are engine work in Pretext itself (TODO.md, Open design
  questions).
- **Non-web engines** (React Native, Flutter, native): sub-projects 2 and 3, see Structure.
- **Framework bindings**: app code.

## Path upstream

Each helper is self-contained, so each can be offered to Pretext separately with its verify numbers. The order would be
clamp/truncateMiddle (an open TODO item), then fitFontSize (evidence for the parked API idea), then
shrinkwrap/balance (the README and bubbles demo would call them). If none lands upstream, the kit is still a normal npm
package on top of Pretext.

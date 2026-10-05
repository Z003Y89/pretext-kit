# pretext-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six exact text-sizing helpers on Pretext's public API (shrinkwrap, balance, clamp, truncateMiddle,
fitFontSize, list stacking), verified against Chromium, WebKit and Firefox.

**Architecture:** One small file per helper family in `src/`, each importing only Pretext's public exports. Logic
tests run in Node on a stand-in Canvas with hand-computable widths. A Playwright runner paints each helper's output
in three real engines and counts mismatches, attributing each to either Pretext or the kit.

**Tech Stack:** TypeScript 6, Node 24 (`node --test`, native type stripping), `@chenglou/pretext` built from the local
clone at `../pretext` (f10d888), esbuild (browser bundle for verify/demo), Playwright (verify and bench only).

**Spec:** `docs/superpowers/specs/2026-10-05-pretext-kit-design.md`

## Global Constraints

- Imports from `@chenglou/pretext` and `@chenglou/pretext/rich-inline` public exports only; never `../pretext/src/*`.
- Plain functions and fixed-shape objects; no classes. Indexed `for` loops; no `.map`/`.forEach` chains in `src/`.
- No allocation inside search loops (`balance`, `fitFontSize`): probes call `measureLineStats` / `measureRichInlineStats` only.
- Widths returned to the app are whole pixels, except when capped at a fractional `maxWidth` (then exactly `maxWidth`).
- Font sizes are whole pixels.
- Relative imports in `.ts` use `.ts` specifiers (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions`).
- Fit tolerance for a line is Pretext's: `FIT_TOLERANCE = 1 / 64` px, defined once in `src/fit.ts`.
- Each code comment says why, in the voice of Pretext's demos; no comment restates the code.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Width narrower than one grapheme** (`maxWidth` 5px): balance/shrinkwrap/clamp must terminate and return the
   browser's lines (one grapheme per line); balance must not search below 1px. → Task 2, Task 3 tests.
2. **Fractional `maxWidth`** (300.5): no returned width may exceed it. → Task 2 test.
3. **Hard breaks in `pre-wrap`**: narrowing can never drop below the forced line count; balance must keep the count
   at `maxWidth`, not chase fewer. → Task 2 test.
4. **`maxLines` ≥ line count, or tail wider than the width**: clamp returns the lines untruncated; a huge tail still
   keeps one grapheme on the last line. `maxLines < 1` throws `RangeError`. → Task 3 tests.
5. **Empty text**: shrinkwrap/balance → `{ width: 0, lineCount: 0 }`; clamp → no lines, not truncated; fitFontSize
   returns `max` (an empty box fits anything). → Tasks 2, 3, 5 tests.

---

### Task 1: Scaffold, stand-in Canvas, list helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `test/setup.ts`, `src/list.ts`, `src/index.ts`, `test/list.test.ts`, `test/setup.test.ts`

**Interfaces:**
- Produces: `stack(heights: ArrayLike<number>, gap: number, tops: Float64Array): number`,
  `findIndexAt(tops: Float64Array, count: number, y: number): number`,
  `anchorDelta(oldTops: Float64Array, newTops: Float64Array, anchor: number): number`.
  Stand-in Canvas: any font `"<N>px …"` measures each code point at `0.5 * N`, except U+0020 and U+00A0 at `0.25 * N`
  (20px: letters 10, spaces 5). Every later test file starts with `import './setup.ts'`.

- [ ] **Step 1: Build Pretext.** In `../pretext`: `npm install && npx tsc -p tsconfig.build.json`. Expected: `../pretext/dist/layout.js` and `dist/rich-inline.js` exist.
- [ ] **Step 2: Write `package.json`**: `"name": "pretext-kit"`, `"type": "module"`, `"sideEffects": false`, `peerDependencies: { "@chenglou/pretext": ">=0.0.10" }`, devDependencies `"@chenglou/pretext": "file:../pretext"`, `"typescript": "^6.0.2"`, `"esbuild"`; scripts `test: "node --test --import ./test/setup.ts test/*.test.ts"`, `check: "tsc --noEmit"`, `build: "rm -rf dist && tsc -p tsconfig.json --noEmit false --outDir dist"`. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `module/moduleResolution: "nodenext"`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`, `declaration`, `noEmit: true`, `include: ["src", "test"]`. Run `npm install`.
- [ ] **Step 3: Write `test/setup.ts`**: sets `globalThis.OffscreenCanvas` to a stand-in whose context's `measureText` implements the widths above, before anything imports Pretext.
- [ ] **Step 4: Write failing tests.**

```ts
// test/setup.test.ts
test('stand-in widths reach Pretext', () => {
  const p = prepareWithSegments('aa bb', '20px Test')
  assert.equal(measureNaturalWidth(p), 45)
})
// test/list.test.ts
test('stack fills tops with gaps and returns the total', () => {
  const tops = new Float64Array(3)
  assert.equal(stack([10, 20, 30], 4, tops), 68)
  assert.deepEqual([...tops], [0, 14, 38])
})
test('stack of nothing is 0', () => assert.equal(stack([], 4, new Float64Array(0)), 0))
test('findIndexAt is the last row whose top is at or above y', () => {
  // random heights 1-50, gap 3, 500 rows; compare against a linear scan for 2,000 random y in [-10, total + 10]
  // y above the first top → 0; empty list → -1; tops longer than count is ignored past count
})
test('anchorDelta keeps the anchor row still', () => {
  assert.equal(anchorDelta(Float64Array.of(0, 14, 38), Float64Array.of(0, 30, 70), 1), 16)
})
```

- [ ] **Step 5: Run** `npm test`. Expected: FAIL, `stack` not exported.
- [ ] **Step 6: Implement `src/list.ts`** per the Interfaces block; `findIndexAt` is a binary search over `tops[0..count)`. Export from `src/index.ts`.
- [ ] **Step 7: Run** `npm test && npm run check`. Expected: all pass, no type errors.
- [ ] **Step 8: Commit** `feat: scaffold, stand-in canvas, list stacking helpers`.

### Task 2: shrinkwrap and balance (+ rich twins)

**Files:**
- Create: `src/fit.ts`, `src/width.ts`, `test/width.test.ts`; Modify: `src/index.ts`

**Interfaces:**
- Consumes: `test/setup.ts` widths.
- Produces: `FIT_TOLERANCE` (in `src/fit.ts`);
  `type WidthFit = { width: number, lineCount: number }`;
  `shrinkwrap(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit`;
  `balance(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit`;
  `shrinkwrapRich(prepared: PreparedRichInline, maxWidth: number): WidthFit`;
  `balanceRich(prepared: PreparedRichInline, maxWidth: number): WidthFit`.

- [ ] **Step 1: Write failing tests** (font `20px Test` unless stated):

```ts
test('shrinkwrap hugs the widest line', () =>
  assert.deepEqual(shrinkwrap(p('aa bb cc dd ee'), 100), { width: 95, lineCount: 2 }))
test('balance is the narrowest width with the same line count', () =>
  assert.deepEqual(balance(p('aa bb cc dd ee'), 100), { width: 70, lineCount: 2 }))
test('a width one pixel under balance adds a line', () =>
  assert.equal(measureLineStats(p('aa bb cc dd ee'), 69).lineCount, 3))
test('never wider than a fractional maxWidth', () => {
  const nine = prepareWithSegments('aaaaaaaaa', '21px Test') // 94.5px
  assert.deepEqual(shrinkwrap(nine, 94.5), { width: 94.5, lineCount: 1 })
  assert.ok(balance(p('aa bb cc dd ee'), 94.5).width <= 94.5)
})
test('narrower than a grapheme terminates with one grapheme a line', () =>
  assert.deepEqual(balance(p('abc'), 5), { width: 5, lineCount: 3 }))
test('pre-wrap hard breaks keep their count', () => {
  const t = prepareWithSegments('aa bb cc\ndd', '20px Test', { whiteSpace: 'pre-wrap' })
  assert.deepEqual(balance(t, 200), { width: 70, lineCount: 2 })
})
test('empty text', () => {
  assert.deepEqual(shrinkwrap(p(''), 100), { width: 0, lineCount: 0 })
  assert.deepEqual(balance(p(''), 100), { width: 0, lineCount: 0 })
})
test('rich twins agree with plain text for one item', () => {
  const r = prepareRichInline([{ text: 'aa bb cc dd ee', font: '20px Test' }])
  assert.deepEqual(balanceRich(r, 100), balance(p('aa bb cc dd ee'), 100))
  assert.deepEqual(shrinkwrapRich(r, 100), shrinkwrap(p('aa bb cc dd ee'), 100))
})
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, not exported.
- [ ] **Step 3: Implement.** `shrinkwrap`: one `measureLineStats(prepared, maxWidth)`; width `min(ceil(maxLineWidth), maxWidth)`. `balance`:

```
target = lineCount at maxWidth; if target <= 1 return shrinkwrap
lo = 1, hi = floor(maxWidth)            // if lineCount(hi) > target (fractional maxWidth), return shrinkwrap(maxWidth)
while lo < hi: mid = (lo+hi)>>1; if lineCount(mid) <= target: hi = mid else lo = mid+1
stats = measureLineStats(prepared, lo)  // lineCount is target by the loop's invariant
return { width: min(maxWidth, max(lo, ceil(stats.maxLineWidth))), lineCount: stats.lineCount }
```
The `max` matters only when a grapheme is wider than `lo`. Lines there are one grapheme each at any width, so the
search would reach 1px; the width returned must still hold the widest line, capped at `maxWidth` as the browser
would overflow it.
Probes use `measureLineStats(...).lineCount` only. The rich twins are the same bodies over `measureRichInlineStats`; share the search as one function that takes the stats function, not two copies.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: shrinkwrap and balance`.

### Task 3: clamp

**Files:**
- Create: `src/clamp.ts`, `test/clamp.test.ts`; Modify: `src/index.ts`

**Interfaces:**
- Consumes: `FIT_TOLERANCE` from `src/fit.ts`.
- Produces: `type Tail = { width: number, spaceWidth: number }`;
  `type ClampedLine = { text: string, width: number }`;
  `type Clamped = { truncated: boolean, lineCount: number, lines: ClampedLine[] }`;
  `measureTail(text: string, font: string): Tail`;
  `clamp(prepared: PreparedTextWithSegments, width: number, maxLines: number, tail?: Tail): Clamped`
  (`lineCount` = lines shown, `≤ maxLines`; no tail = `{ width: 0, spaceWidth: 0 }`, and then the cut is the plain line);
  `clampStats(prepared: PreparedTextWithSegments, width: number, maxLines: number): { truncated: boolean, lineCount: number }`;
  `fillLine(prepared, start: LayoutCursor, room: number, spaceWidth: number): ClampedLine` (exported for Task 4).

- [ ] **Step 1: Write failing tests** (`20px Test`, text `'aa bb cc dd ee ff'`, width 50 → three lines of `aa bb`, `cc dd`, `ee ff`):

```ts
test('cuts inside a word to leave the tail room', () => {
  const c = clamp(p(T), 50, 2, { width: 10, spaceWidth: 5 })
  assert.equal(c.truncated, true); assert.equal(c.lineCount, 2)
  assert.equal(c.lines[0]!.text.trimEnd(), 'aa bb')
  assert.deepEqual(c.lines[1], { text: 'cc d', width: 35 })
})
test('the tail follows the line when both fit', () =>
  assert.deepEqual(clamp(p(T), 50, 2, { width: 5, spaceWidth: 5 }).lines[1], { text: 'cc dd', width: 45 }))
test('not truncated when maxLines covers the text', () => {
  const c = clamp(p(T), 50, 3, { width: 10, spaceWidth: 5 })
  assert.equal(c.truncated, false); assert.equal(c.lineCount, 3)
})
test('a tail wider than the width keeps one grapheme', () =>
  assert.equal(clamp(p(T), 50, 1, { width: 80, spaceWidth: 5 }).lines[0]!.text, 'a'))
test('maxLines below 1 throws', () => assert.throws(() => clamp(p(T), 50, 0), RangeError))
test('empty text', () => assert.deepEqual(clamp(p(''), 50, 2), { truncated: false, lineCount: 0, lines: [] }))
test('clampStats agrees with clamp without building lines', () =>
  assert.deepEqual(clampStats(p(T), 50, 2), { truncated: true, lineCount: 2 }))
test('measureTail measures in the font', () =>
  assert.deepEqual(measureTail('…', '20px Test'), { width: 10, spaceWidth: 5 }))
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** by porting `clampLines`, `fillLine` and `trimEndSpace` from `../pretext/pages/demos/ellipsis.model.ts:120-176`, with `ELLIPSIS_WIDTH` → `tail.width` and `SPACE_WIDTH` → `tail.spaceWidth`. `fillLine` additionally returns the accumulated `x` as `width`. Unlike the demo, a cut that would be empty keeps the line's first grapheme, as Blink's `LineTruncator` keeps one character whatever the room (RESEARCH.md, Line Clamp And Ellipsis); the huge-tail test pins it. `clampStats` uses `layout(prepared, width, 1).lineCount` only. Keep the demo's comments on the browser rule (they cite `line_truncator.cc`).
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: clamp with a tail, as -webkit-line-clamp ends a box`.

### Task 4: truncateMiddle

**Files:**
- Create: `src/middle.ts`, `test/middle.test.ts`; Modify: `src/index.ts`

**Interfaces:**
- Consumes: `fillLine` from `src/clamp.ts`.
- Produces: `type PreparedLabel = { text: string, prepared: PreparedTextWithSegments, starts: LayoutCursor[], offsets: number[], ellipsisWidth: number, spaceWidth: number }`
  (`offsets[i]` = code-unit offset of `starts[i]`);
  `prepareLabel(text: string, font: string): PreparedLabel`;
  `truncateMiddle(label: PreparedLabel, width: number, keepEnd?: { from: number }): string` (the ellipsis is `'…'`).

- [ ] **Step 1: Write failing tests** (`20px Test`, label `'src/text/layout.ts'`, 180px, `from = 8`):

```ts
test('fits whole: unchanged', () => assert.equal(truncateMiddle(L, 200), 'src/text/layout.ts'))
test('keeps the end from keepEnd.from when it fits', () =>
  assert.equal(truncateMiddle(L, 120, { from: 8 }), 's…/layout.ts'))
test('falls back to half the room when the kept end does not fit', () =>
  assert.equal(truncateMiddle(L, 60, { from: 8 }), 'src…ts'))
test('without keepEnd, the end gets half the room', () =>
  assert.equal(truncateMiddle(L, 60), 'src…ts'))
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** by porting `createLabel` and `layoutMiddle` from `../pretext/pages/demos/ellipsis.model.ts:93-105,191-211`. `nameStart` becomes the last index `i` with `offsets[i] <= keepEnd.from`. Without `keepEnd` there is no kept end.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: truncateMiddle for paths and file names`.

### Task 5: fitFontSize

**Files:**
- Create: `src/font-size.ts`, `test/font-size.test.ts`; Modify: `src/index.ts`

**Interfaces:**
- Consumes: `FIT_TOLERANCE`.
- Produces: `type PreparedSizes = { text: string, font: (px: number) => string, min: number, max: number, options: PrepareOptions | undefined, handles: (PreparedTextWithSegments | undefined)[] }` (`handles[px - min]`, filled on first use);
  `prepareSizes(text, font, range: { min: number, max: number }, options?): PreparedSizes` (throws `RangeError` unless `min` and `max` are integers with `1 <= min <= max`);
  `type FitBox = { width: number, height?: number, maxLines?: number }`;
  `fitFontSize(sizes: PreparedSizes, box: FitBox, lineHeight: (px: number) => number): { px: number, prepared: PreparedTextWithSegments, lineCount: number } | null`.
  "Fits" at `px` means `stats = measureLineStats(h, box.width)`: `maxLineWidth <= box.width + FIT_TOLERANCE`, and `lineCount <= maxLines`, and `lineCount * lineHeight(px) <= height` (each absent constraint passes).

- [ ] **Step 1: Write failing tests** (`font = px => px + 'px Test'`, `lh = px => px * 1.5`, text `'aa bb cc dd ee'`):

```ts
test('one line: the largest size whose line fits', () =>   // 6px of width per px of size
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, maxLines: 1 }, lh)!.px, 16))
test('the answer fits and one size up does not', () => {
  // box { width: 100, height: 60 }: assert fits(px) and !fits(px + 1) via measureLineStats directly
})
test('a local maximum under a non-monotonic line height', () => {
  // lh2 = px => (px === 12 ? 1000 : px * 1.2); box { width: 100, height: 80 }: result fits, result + 1 doesn't or is max
})
test('null when even min does not fit', () =>
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 30, max: 40 }), { width: 10, maxLines: 1 }, lh), null))
test('empty text fits at max', () =>
  assert.equal(fitFontSize(prepareSizes('', font, { min: 8, max: 40 }), { width: 10 }, lh)!.px, 40))
test('a second fit reuses the prepared handle', () => {
  const s = prepareSizes(T, font, { min: 8, max: 40 })
  assert.equal(fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared, fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared)
})
test('bad ranges throw', () => assert.throws(() => prepareSizes(T, font, { min: 0, max: 4 }), RangeError))
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** If `min` doesn't fit, return `null`. Otherwise binary search for the largest fitting `px` in `[min, max]` treating fit as monotone, then step up while `px + 1 <= max` fits. This gives the spec's guarantee: the answer fits, and `px + 1` doesn't or is `max`. Handles are prepared lazily into `handles`.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: fitFontSize over sizes prepared once`.

### Task 6: Browser sweep runner (width and font size)

**Files:**
- Create: `verify/corpora.ts`, `verify/sweep.ts`, `verify/sweep.html`, `verify/run.ts`; Modify: `package.json` (devDependency `playwright`, script `verify: "node verify/run.ts"`), `.gitignore` (`verify/dist`)

**Interfaces:**
- Consumes: `shrinkwrap`, `balance`, `fitFontSize`, `prepareSizes` from `src/index.ts`.
- Produces: `window.sweep(helper: 'shrinkwrap' | 'balance' | 'fitFontSize' | 'clamp' | 'truncateMiddle'): Promise<CaseResult[]>`, where
  `type CaseResult = { helper: string, corpus: string, font: string, width: number, lines?: number, outcome: 'pass' | 'pretext-gap' | 'kit-mismatch', detail?: string }`.
  The runner writes `verify/RESULTS.md`. Task 7 adds two helpers to the same `sweep`.

- [ ] **Step 1: Ask the user before installing.** `npm i -D playwright && npx playwright install chromium webkit firefox` downloads about 500 MB of browsers. Proceed only on a yes.
- [ ] **Step 2: Write `verify/corpora.ts`.** Five corpora, about 12 texts each: Latin prose, CJK (Chinese and Japanese), Arabic, emoji-mixed chat, long URLs/paths. Take them from `../pretext/src/test-data.ts` where it has them. Four font stacks: `"Helvetica Neue", "PingFang SC", "Geeza Pro", sans-serif`; `Arial, "PingFang SC", "Geeza Pro", sans-serif`; `Georgia, "Hiragino Mincho ProN", serif`; `"Times New Roman", "Songti SC", serif`, all at 16px with line height 24. Widths 120-600 step 1.
- [ ] **Step 3: Write `verify/sweep.html` + `verify/sweep.ts`.** `<html lang="en">`, `<!DOCTYPE html>`. Bundle with `esbuild verify/sweep.ts --bundle --format=iife --outfile=verify/dist/sweep.js` (so `file://` works). The page awaits `document.fonts.ready`. Each case paints a `div` with `font`, `line-height: 24px`, `overflow-wrap: break-word`, `width: <W>px` and reads `Math.round(div.getBoundingClientRect().height / 24)` as the DOM line count. It is reused across cases, with no layout thrash concerns since this is a test.
  - Baseline: if DOM lines at `maxWidth` ≠ `layout(prepared, maxWidth, 24).lineCount`, the case is `pretext-gap` (no kit judgement possible).
  - shrinkwrap/balance: paint at the returned width; `pass` iff DOM lines = returned `lineCount`, else `kit-mismatch`.
  - fitFontSize: box `{ width: W, height: 96 }`, sizes 8-48, line height `px * 1.5`. Paint at `px`: `pass` iff height ≤ 96 and `scrollWidth ≤ W`, and at `px + 1` (if ≤ 48) it overflows one of them.
- [ ] **Step 4: Write `verify/run.ts`**: for each of `chromium`, `webkit`, `firefox`, launch headed, open `file://…/verify/sweep.html`, call `sweep` per helper, and tally by outcome and by corpus. Write `verify/RESULTS.md` with a table per browser, the browser version (`browser.version()`), the date, and every `kit-mismatch` listed with its case. Exit code 1 if any `kit-mismatch`.
- [ ] **Step 5: Run** `npm run verify`. Expected: zero `kit-mismatch` for shrinkwrap, balance and fitFontSize in all three browsers. Any mismatch is a bug in Tasks 2/5: fix it there with a regression test, not in the runner.
- [ ] **Step 6: Commit** `test: browser sweep for widths and font sizes` with `verify/RESULTS.md`.

### Task 7: Sweep clamp and truncateMiddle

**Files:**
- Modify: `verify/sweep.ts`, `verify/corpora.ts` (add 20 path/file-name labels)

**Interfaces:**
- Consumes: `clamp`, `clampStats`, `measureTail`, `prepareLabel`, `truncateMiddle`; `CaseResult` from Task 6.

- [ ] **Step 1: Add the clamp case** for lines 1-5 with tail `measureTail('…', font)`. Paint a `display: -webkit-box; -webkit-line-clamp: N; -webkit-box-orient: vertical; overflow: hidden` box. `pass` iff:
  - browser truncation (`scrollHeight > clientHeight`) equals `clamp().truncated`;
  - the clamped height / 24 equals `lineCount`;
  - each returned line, painted in a `white-space: pre` span with the last one followed by `…`, has `getBoundingClientRect().width ≤ W + 1/64`.
- [ ] **Step 2: Add the truncateMiddle case** for labels at widths 80-400 with `keepEnd = { from: text.lastIndexOf('/') }`. Paint the result in `white-space: pre`. `pass` iff its width ≤ W + 1/64, and, when it isn't the whole label and the file name fits in W minus the ellipsis, it ends with the file name.
- [ ] **Step 3: German soft hyphens.** Add devDependency `hyphen` (check and record its pattern licence in the report). Add a `german` corpus of about 12 texts dense with compounds („Tagesabschlussbericht“, „Nebenrollen-Takes“, „Synchronsprecherinnen“), hyphenated once with `hyphen/de`'s `hyphenateSync` so they hold U+00AD. Paint them with `hyphens: manual` (never `auto`: each browser's own dictionary differs). Every helper sweeps it like the other corpora. Add a `french` corpus the same way with `hyphen/fr` (UI-label-like and prose texts), for the languages that run 20-40% longer.
- [ ] **Step 4: Zoom.** `run.ts` runs the whole sweep at Playwright `deviceScaleFactor` 1, 1.25 and 2 (browser/Electron zoom changes the device pixel ratio, not CSS px). `RESULTS.md` gets one table per browser × factor.
- [ ] **Step 5: Run** `npm run verify`. Expected: zero `kit-mismatch` across all five helpers, three browsers and three factors. `RESULTS.md` lists `pretext-gap` counts by corpus (expected mostly Arabic and CJK, per Pretext's ENGINE_FOLLOWUPS.md).
- [ ] **Step 6: Commit** `test: browser sweep for clamp and truncateMiddle` with the updated `RESULTS.md`.

### Task 8: Bench, demo page, README

**Files:**
- Create: `verify/bench.ts`, `verify/bench.html`, `demo/index.html`, `demo/demo.ts`, `README.md`; Modify: `verify/run.ts` (`--bench` flag)

**Interfaces:**
- Consumes: every export from `src/index.ts`.

- [ ] **Step 1: Bench.** 1,000 chat messages from the corpora at `16px Helvetica Neue…`. Report the median of 20 runs, in µs per message, for: `prepareWithSegments` (first sight), `shrinkwrap`, `balance`, `clamp(…, 3)`, and `fitFontSize` (cold and warm `PreparedSizes`), each at a resize from 400 → 399 px. `npm run verify -- --bench` runs it in all three browsers and appends a "Cost" table to `RESULTS.md` with builds and date. There are no thresholds (spec: reported, not targeted).
- [ ] **Step 2: Demo** `demo/index.html`: a width slider over sections for bubbles (shrinkwrap vs CSS `fit-content`), headline (balance vs CSS `text-wrap: balance`), card (clamp vs `-webkit-line-clamp`), file list (truncateMiddle vs `text-overflow: ellipsis`), badge (fitFontSize) and a 10,000-row virtual list (stack/findIndexAt/anchorDelta). Follow Pretext's demo rule: the model owns every measured value, the painter writes them inline, and the demo never corrects what the kit reports. Bundle with esbuild like `verify/`. Check it by hand at three widths in the built-in browser.
- [ ] **Step 3: README.** Install (note the Pretext `main` dependency until its next release); one short example per helper; "What's exact" pointing at `verify/RESULTS.md` numbers; "Not in v1" from the spec. Copy no Pretext caveats: link to its README. Also these sections, short:
  - **When to measure with the DOM instead**: a handful of labels on screen. The browser already knows exactly, with icons and padding. The kit pays off for many texts, every resize frame, or before the text exists (virtual lists).
  - **Fonts**: bundle the app's font with `@font-face` and await `document.fonts.load(font)` before preparing. Call `clearCache()` and prepare again after a late font. Never `system-ui`/`-apple-system` on macOS (link Pretext's caveat).
  - **Hyphenation**: German example with `hyphen/de` → soft hyphens → the same string measured and painted with `hyphens: manual`, citing the german corpus numbers.
  - **Zoom and scale**: browser/Electron zoom needs no correction (cite the deviceScaleFactor runs). A text-size setting is a different font px: prepare per size (`prepareSizes` covers it). Fonts aren't supported through `font-feature-settings`/`font-variant-numeric` (e.g. tabular figures): Canvas can't express them.
  - **Mixed rows**: an icon + badge + text row with `prepareRichInline([{ width: 16 }, { text: '207/0011', font, break: 'never', extraWidth: 12 }, { text: 'Dr. Lind', font }])` and `shrinkwrapRich`.
  - **Versions**: pin the Pretext commit; the kit calls six Pretext functions (list them).
  - **Credit and licence**: the README's first paragraph says the kit is built on Pretext (link) and is not part of it; `LICENSE` is MIT and also reproduces Pretext's MIT notice (copy from `../pretext/LICENSE`), since `src/clamp.ts` and `src/middle.ts` port code from Pretext's `pages/demos/ellipsis.model.ts` (each file's header comment says so). `package.json` gets `"license": "MIT"`.
  - **Recipes** (code in the README, not the library): a React virtual list (a `useMemo` of prepared handles keyed by text, heights → `stack` on width change, `findIndexAt` for the visible range, `anchorDelta` applied to `scrollTop` only when layout moved the anchor); a calendar block choosing the first of `[title + time, title, time, '…']` whose `clamp(…, maxLines = floor(blockHeight / lineHeight))` isn't truncated; a German label fit check (`measureLineStats(prepare(label, font), buttonContentWidth).lineCount === 1`); the visible window of a virtual list (`start = findIndexAt(tops, n, scrollTop)`, `end = findIndexAt(tops, n, scrollTop + viewportHeight) + 1`); a card row's height from several paragraphs and fixed boxes (the sum of each paragraph's `layout().height`, the boxes' heights and the card's padding, taking the max across side-by-side columns).
- [ ] **Step 4: Run** `npm test && npm run check && npm run build`. Expected: all pass, `dist/index.js` and `.d.ts` emitted.
- [ ] **Step 5: Commit** `docs: README, demo and bench`.

### Task 9: fontFromStyle

**Files:**
- Create: `src/style.ts`, `test/style.test.ts`; Modify: `src/index.ts`, `README.md` (Fonts section uses it), `demo/demo.ts` and `verify/sweep.ts` (derive their fonts with it instead of hand-built strings)

**Interfaces:**
- Produces: `fontFromStyle(style: Pick<CSSStyleDeclaration, 'fontStyle' | 'fontVariant' | 'fontWeight' | 'fontStretch' | 'fontSize' | 'fontFamily' | 'letterSpacing' | 'lineHeight'>): { font: string, letterSpacing: number, lineHeight: number }`. Takes a `getComputedStyle()` result, read once per style, not per text, where the browser has already resolved `rem`/`em` to px. `font` is the Canvas shorthand `"<style> <weight> <stretch?> <size> <family>"`, leaving out `normal` parts. `letterSpacing` is the px number (`normal` → 0). `lineHeight` is the px number; `normal` throws a `RangeError` whose message says to set a numeric line-height, since `normal` depends on font metrics Pretext doesn't read.

- [ ] **Step 1: Write failing tests** with plain objects standing in for computed styles: `{ fontStyle: 'italic', fontWeight: '700', fontStretch: '100%', fontSize: '16px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.5px', lineHeight: '24px', fontVariant: 'normal' }` → `{ font: 'italic 700 16px Inter, sans-serif', letterSpacing: 0.5, lineHeight: 24 }`; all-normal → `'400 16px Inter'`-style output with `letterSpacing: 0`; `lineHeight: 'normal'` throws `RangeError`; condensed stretch (`'75%'`) maps to the Canvas keyword `condensed` (75% condensed, 87.5% semi-condensed, 112.5% semi-expanded, 125% expanded; other percentages throw `RangeError`, as the Canvas shorthand has only keywords).
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/style.ts` and export it.
- [ ] **Step 4: Use it** in `verify/sweep.ts` and `demo/demo.ts`: each takes its font, letter spacing and line height from a styled element's computed style. Re-run `npm run verify` and expect the same zero `kit-mismatch` (this proves the helper in three browsers).
- [ ] **Step 5: Run** `npm test && npm run check`. Expected: PASS. **Commit** `feat: fontFromStyle reads the font from computed style`.


### Task 10: fitFontSizeRich (text, icons and badges scaling together)

**Files:**
- Modify: `src/font-size.ts` (share the search), `src/index.ts`, `test/font-size.test.ts`, `verify/sweep.ts`, `verify/corpora.ts`, `README.md` (if Task 8 has written it; else Task 8 picks this up)

**Interfaces:**
- Consumes: `FIT_TOLERANCE`; the bisection in `fitFontSize` (Task 5); `prepareRichInline`, `measureRichInlineStats`, `RichInlineItem`, `RichInlineBox`, `RichInlineOptions`, `PreparedRichInline` from `@chenglou/pretext/rich-inline`.
- Produces: `type PreparedSizesRich = { items: (px: number) => Array<RichInlineItem | RichInlineBox>, min: number, max: number, options: RichInlineOptions | undefined, handles: (PreparedRichInline | undefined)[] }`;
  `prepareSizesRich(items, range: { min: number, max: number }, options?): PreparedSizesRich` (same `RangeError` rules as `prepareSizes`);
  `fitFontSizeRich(sizes: PreparedSizesRich, box: FitBox, lineHeight: (px: number) => number): { px: number, prepared: PreparedRichInline, lineCount: number } | null`.
  The row at size `px` is whatever `items(px)` returns, e.g. `px => [{ width: Math.round(px * 1.25) }, { text: label, font: \`600 ${px}px Inter\`, extraWidth: Math.round(px * 0.5) }]`: an icon box, then a label with its gap counted as `extraWidth`. "Fits" is the same rule as `fitFontSize`, over `measureRichInlineStats`. Heights count `lineCount * lineHeight(px)`; a box taller than the line height makes its line taller in the browser (Pretext README), so the doc comment says callers keep icon heights at or below the line height.

- [ ] **Step 1: Write failing tests** (stand-in widths; `row = px => [{ width: px }, { text: 'aa bb', font: \`${px}px Test\` }]`, whose one-line width is `px + 2.25·px = 3.25·px`):
  - `fitFontSizeRich(prepareSizesRich(row, { min: 8, max: 40 }), { width: 100, maxLines: 1 }, px => px * 1.5)!.px === 30` (97.5px; 31 gives 100.75px)
  - The same independent `fitsDirect` property as Task 5, built on `prepareRichInline` + `measureRichInlineStats`: the result fits, and `px + 1` doesn't or is `max`.
  - With a single text item and no boxes, it agrees with `fitFontSize` for the same text and box at five widths.
  - `null` when even `min` doesn't fit; a second fit reuses the prepared handle; a bad range throws `RangeError`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** One bisection shared by `fitFontSize` and `fitFontSizeRich`, taking the probe as a parameter (the pattern `src/width.ts` uses for its rich twins), not two copies. Lazy handles per size as in Task 5.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS. **Commit** `feat: fitFontSizeRich sizes icons and text as one row`.
- [ ] **Step 5: Sweep.** Add helper `'fitFontSizeRich'` to `sweep()`. Rows: an icon (`display: inline-block; vertical-align: top; width: round(1.25·px)px; height: px`), then a label from the Latin, German, French and emoji corpora with `margin-left: round(0.5·px)px` (matching `extraWidth`), in one `white-space: normal; overflow-wrap: break-word` container of width W, with box `{ width: W, maxLines: 1 }` and `{ width: W, height: 3 × lineHeight }`, sizes 8-32, line height `round(1.5·px)`. `pass` iff the painted row at `px` fits (lines ≤ maxLines or height ≤ box height, and `scrollWidth ≤ W`) and at `px + 1` it doesn't (or `px` is max). The same `pretext-gap` and `platform` attribution rules as Task 6 apply. Run `npm run verify`, expect zero `kit-mismatch`, and commit `test: browser sweep for icon and label rows` with `RESULTS.md`.

### Task 11: Evaluation report (institutional grade)

Runs after Tasks 7, 10, 8 and 9's step 4, before the final review.

**Files:**
- Create: `EVALUATION.md`; `verify/reproduce.sh`; Modify: `README.md` (link it), `verify/run.ts` (only if a needed number isn't recorded yet)

**Requirements** (every number comes from a committed run artifact, with the command that regenerates it):
- [ ] **Step 1: Write `EVALUATION.md`** with these sections:
  1. **Claims under test**, one per helper, stated as a falsifiable property, e.g. "`balance(p, W)` returns the narrowest whole-px width at which the browser paints `layout(p, W).lineCount` lines."
  2. **Method**: corpora (sources, counts, languages, scripts), fonts (families, files present, probe result), widths, sizes, line heights, zoom factors; the oracle (the browser's painted DOM), how lines and widths are read from it, and how each outcome is assigned. The attribution rule, in order: kit vs Pretext's own numbers → kit-mismatch; else property vs DOM → pretext-gap; proven platform causes → platform; unreadable paint → unreliable. Browser builds, Playwright pin, OS, device, date.
  3. **Results**: per helper × browser × zoom, the counts of pass, pretext-gap, platform, unreliable and kit-mismatch, with rates and **95% Wilson upper bounds on the kit-mismatch rate**. With 0 mismatches in n cases, the bound is about 3.7/n; state that number. Where the cases are clustered (the same text at adjacent widths), also report the bound over distinct texts × fonts, which is the conservative unit, and say which bound a reader should quote.
  4. **Sensitivity (mutation testing)**: plant at least four bugs, run the sweep, and record that each is caught and by how many cases. Revert each one. The bugs: shrinkwrap +1px; balance returning shrinkwrap; fitFontSize returning px−1; clamp without the tail; truncateMiddle ignoring keepEnd; fontFromStyle dropping the weight. A check that catches none of them is a defect to fix before the report is written.
  5. **Cost**: the Task 8 bench numbers (median and p95 over runs), machine, and builds.
  6. **Threats to validity**:
     - one OS (macOS 14) and one machine;
     - Playwright builds trail stable releases (and WebKit 26, not Safari 27);
     - system fonts only, no web fonts;
     - stand-in text corpora rather than app text;
     - clustered cases;
     - the oracle is the painted DOM, not pixels (the SVG probe was not used for clamp's cut);
     - pretext-gaps are attributed to Pretext but not root-caused;
     - logic tests run on a stand-in Canvas.
     Name what would reduce each threat.
  7. **Reproduction**: `verify/reproduce.sh` (clone at pinned commits, build Pretext, `npm ci`, install pinned browsers, `npm test`, `npm run verify`) and the expected outputs.
  8. **Known limitations** as user-facing statements (Safari 26 line heights, the macOS system font, CJK/emoji fallback, the Pretext gaps by cluster).
- [ ] **Step 2: Run the mutation tests** (Section 4) on a throwaway branch, record the results, and delete the branch.
- [ ] **Step 3: Run `verify/reproduce.sh` once** from a fresh clone in the scratchpad, and confirm the tallies match `RESULTS.md`.
- [ ] **Step 4: Commit** `docs: evaluation report`.

### Task 12: watchFonts

Runs with Task 9's step 4 (after Task 8).

**Files:**
- Create: `src/fonts.ts`, `test/fonts.test.ts`; Modify: `src/index.ts`, `README.md` (Fonts section), `demo/demo.ts` (use it)

**Interfaces:**
- Consumes: `clearCache` from `@chenglou/pretext`.
- Produces: `watchFonts(onChange: () => void, fonts?: FontFaceSet): () => void`. `fonts` defaults to `document.fonts`. On each `loadingdone` event whose `fontfaces` is non-empty, it calls `clearCache()` and then `onChange()` once. The app prepares its text again in `onChange`, since handles keep the old widths (Pretext README). It returns an unsubscribe function. When `fonts` is absent (Node, a worker without `self.fonts`), it does nothing and returns a no-op.

- [ ] **Step 1: Write failing tests** with a stand-in `FontFaceSet` (an `EventTarget` that dispatches `loadingdone` events carrying a `fontfaces` array):
  - `onChange` runs once per event with faces;
  - an event with an empty `fontfaces` is ignored;
  - after unsubscribe, nothing runs;
  - `clearCache` is called before `onChange`. Check this by preparing text at a stand-in width, changing the stand-in measurer's width, firing the event, and asserting that a fresh `prepare()` inside `onChange` sees the new width;
  - with no `fonts` and no `document`, it returns a function and throws nothing.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run check`. Expected: PASS.
- [ ] **Step 5: Use it** in `demo/demo.ts`, load one web font late in the demo, and check by hand in the built-in browser that the layout updates. **Commit** `feat: watchFonts re-measures after fonts load`.

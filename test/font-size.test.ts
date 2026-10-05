import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats, prepareRichInline } from '@chenglou/pretext/rich-inline'
import { fitFontSize, fitFontSizeRich, prepareSizes, prepareSizesRich } from '../src/font-size.ts'
import { FIT_TOLERANCE } from '../src/fit.ts'

const T = 'aa bb cc dd ee'
const font = (px: number) => px + 'px Test'
const lh = (px: number) => px * 1.5

// Independent of the implementation: lays out directly with Pretext at each size.
function fitsDirect(px: number, width: number, height: number, lineHeight: (px: number) => number): boolean {
  const s = measureLineStats(prepareWithSegments(T, font(px)), width)
  return s.maxLineWidth <= width + FIT_TOLERANCE && s.lineCount * lineHeight(px) <= height
}

test('one line: the largest size whose line fits', () =>   // 6px of width per px of size
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, maxLines: 1 }, lh)!.px, 16))
test('the answer fits and one size up does not', () => {
  const r = fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, height: 60 }, lh)!
  assert.ok(fitsDirect(r.px, 100, 60, lh))
  assert.ok(!fitsDirect(r.px + 1, 100, 60, lh))
})
test('a local maximum under a non-monotonic line height', () => {
  // Width 100, height 80: sizes 8..28 fit (2 lines at 28), 29+ wrap to 3 lines and do not. The dip at 24 sits on
  // the first bisection midpoint for 8..40, so the search drops to 8..23 and answers 23 although 25..28 also fit.
  const lh2 = (px: number) => (px === 24 ? 1000 : px * 1.2)
  const maxima: number[] = []
  for (let px = 8; px <= 40; px++) if (fitsDirect(px, 100, 80, lh2) && (px === 40 || !fitsDirect(px + 1, 100, 80, lh2))) maxima.push(px)
  assert.deepEqual(maxima, [23, 28])
  const r = fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, height: 80 }, lh2)!
  assert.ok(maxima.includes(r.px))
  assert.equal(r.px, 23)
  assert.ok(fitsDirect(28, 100, 80, lh2))
})
test('a NaN line height fits nowhere', () =>
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, height: 80 }, () => NaN), null))
test('null when even min does not fit', () =>
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 30, max: 40 }), { width: 10, maxLines: 1 }, lh), null))
test('empty text fits at max', () =>
  assert.equal(fitFontSize(prepareSizes('', font, { min: 8, max: 40 }), { width: 10 }, lh)!.px, 40))
test('a second fit reuses the prepared handle', () => {
  const s = prepareSizes(T, font, { min: 8, max: 40 })
  assert.equal(fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared, fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared)
  assert.equal(s.handles.length, 40 - 8 + 1)
  assert.ok(s.handles.some(h => h === undefined))  // sizes the search never visited are never prepared
})
test('bad ranges throw', () => {
  assert.throws(() => prepareSizes(T, font, { min: 0, max: 4 }), RangeError)
  assert.throws(() => prepareSizes(T, font, { min: 5, max: 4 }), RangeError)
  assert.throws(() => prepareSizes(T, font, { min: 1.5, max: 4 }), RangeError)
})
test('a NaN width throws', () =>
  assert.throws(() => fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: NaN }, lh), RangeError))
test('an infinite width never constrains', () =>
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: Infinity, maxLines: 1 }, lh)!.px, 40))

// Found by the browser sweep's German corpus: Pretext fits a line ending at a soft hyphen whose
// syllables measure narrower joined than apart (here 'ts' kerns) and reports its width apart, past
// the box, so the size was refused though the line fits; the browser paints it fitting.
test('a soft-hyphen line Pretext fits counts as fitting though its width apart is wider', () => {
  const sizes = prepareSizes('aat\u00ADsaa\u00ADbb cc', px => `${px}px Kern`, { min: 10, max: 20 })
  const fit = fitFontSize(sizes, { width: 65, height: 60 }, () => 30)
  assert.equal(fit?.px, 20)
  assert.equal(fit?.lineCount, 2)
})
test('a grapheme wider than the box still does not fit', () => {
  const sizes = prepareSizes('ab', px => `${px}px Test`, { min: 10, max: 20 })
  assert.equal(fitFontSize(sizes, { width: 7 }, () => 30)?.px, 14)
})

const row = (px: number) => [{ width: px }, { text: 'aa bb', font: font(px) }]
const rowFits = (px: number, width: number) => {
  const s = measureRichInlineStats(prepareRichInline(row(px)), width)
  return s.lineCount <= 1 && s.maxLineWidth <= width + FIT_TOLERANCE
}

test('rich: an icon box and a label scale together', () =>   // 3.25px of width per px of size
  assert.equal(fitFontSizeRich(prepareSizesRich(row, { min: 8, max: 40 }), { width: 100, maxLines: 1 }, lh)!.px, 30))
test('rich: the answer fits and one size up does not', () => {
  for (const w of [60, 100, 137]) {
    const r = fitFontSizeRich(prepareSizesRich(row, { min: 8, max: 40 }), { width: w, maxLines: 1 }, lh)!
    assert.ok(rowFits(r.px, w))
    assert.ok(r.px === 40 || !rowFits(r.px + 1, w))
  }
})
test('rich: text only agrees with fitFontSize', () => {
  for (const w of [40, 70, 100, 150, 400]) {
    const a = fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: w, height: 60 }, lh)
    const b = fitFontSizeRich(prepareSizesRich(px => [{ text: T, font: font(px) }], { min: 8, max: 40 }), { width: w, height: 60 }, lh)
    assert.equal(b?.px, a?.px)
    assert.equal(b?.lineCount, a?.lineCount)
  }
})
test('rich: null when even min does not fit', () =>
  assert.equal(fitFontSizeRich(prepareSizesRich(row, { min: 30, max: 40 }), { width: 10, maxLines: 1 }, lh), null))
test('rich: a second fit reuses the prepared handle', () => {
  const s = prepareSizesRich(row, { min: 8, max: 40 })
  assert.equal(fitFontSizeRich(s, { width: 100, maxLines: 1 }, lh)!.prepared, fitFontSizeRich(s, { width: 100, maxLines: 1 }, lh)!.prepared)
  assert.ok(s.handles.some(h => h === undefined))
})
test('rich: bad ranges throw, and a NaN width throws', () => {
  assert.throws(() => prepareSizesRich(row, { min: 0, max: 4 }), RangeError)
  assert.throws(() => prepareSizesRich(row, { min: 5, max: 4 }), RangeError)
  assert.throws(() => prepareSizesRich(row, { min: 1.5, max: 4 }), RangeError)
  assert.throws(() => fitFontSizeRich(prepareSizesRich(row, { min: 8, max: 40 }), { width: NaN }, lh), RangeError)
})

// Mirrors the soft-hyphen test above for a row: an icon then 'aat-saa-bb cc' at 20px in a 75px box.
// Pretext fits 'aat­saa-' beside the icon and reports that line at its syllables' width apart (80px),
// though no unbreakable piece is wider than 75px; fitFontSizeRich must judge it as fitFontSize does.
test('rich: a soft-hyphen line Pretext fits counts as fitting though its width apart is wider', () => {
  const kernRow = (px: number) => [{ width: px / 2 }, { text: 'aat­saa­bb cc', font: `${px}px Kern` }]
  const reported = measureRichInlineStats(prepareRichInline(kernRow(20)), 75)
  assert.ok(reported.maxLineWidth > 75 + FIT_TOLERANCE)
  const fit = fitFontSizeRich(prepareSizesRich(kernRow, { min: 10, max: 20 }), { width: 75, height: 60 }, () => 30)
  assert.equal(fit?.px, 20)
  assert.equal(fit?.lineCount, 2)
})

import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { fitFontSize, prepareSizes } from '../src/font-size.ts'
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
  const lh2 = (px: number) => (px === 12 ? 1000 : px * 1.2)
  const r = fitFontSize(prepareSizes(T, font, { min: 8, max: 40 }), { width: 100, height: 80 }, lh2)!
  assert.ok(fitsDirect(r.px, 100, 80, lh2))
  assert.ok(r.px === 40 || !fitsDirect(r.px + 1, 100, 80, lh2))
})
test('null when even min does not fit', () =>
  assert.equal(fitFontSize(prepareSizes(T, font, { min: 30, max: 40 }), { width: 10, maxLines: 1 }, lh), null))
test('empty text fits at max', () =>
  assert.equal(fitFontSize(prepareSizes('', font, { min: 8, max: 40 }), { width: 10 }, lh)!.px, 40))
test('a second fit reuses the prepared handle', () => {
  const s = prepareSizes(T, font, { min: 8, max: 40 })
  assert.equal(fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared, fitFontSize(s, { width: 100, maxLines: 1 }, lh)!.prepared)
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

import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { prepareLabel, truncateMiddle } from '../src/middle.ts'

const L = prepareLabel('src/text/layout.ts', '20px Test')

test('fits whole: unchanged', () => assert.equal(truncateMiddle(L, 200), 'src/text/layout.ts'))
test('keeps the end from keepEnd.from when it fits', () =>
  assert.equal(truncateMiddle(L, 120, { from: 8 }), 's…/layout.ts'))
test('falls back to half the room when the kept end does not fit', () =>
  assert.equal(truncateMiddle(L, 60, { from: 8 }), 'src…ts'))
test('without keepEnd, the end gets half the room', () =>
  assert.equal(truncateMiddle(L, 60), 'src…ts'))
test('the result never exceeds the width', () => {
  for (let width = 30; width <= 200; width += 10) {
    for (const keepEnd of [undefined, { from: 8 }]) {
      const out = truncateMiddle(L, width, keepEnd)
      const w = measureNaturalWidth(prepareWithSegments(out, '20px Test'))
      assert.ok(w <= width, `${out} is ${w} wide at ${width}`)
    }
  }
})
// Found by the browser sweep: the name was measured grapheme by grapheme from inside the label's
// segment, wider than it paints, so a name that fits with the ellipsis and a grapheme was dropped.
test('the kept end is measured as the text it paints', () =>
  assert.equal(truncateMiddle(prepareLabel('src/text/layout.ts', '20px Kern'), 115, { from: 8 }), 's…/layout.ts'))
// Found by the browser sweep's German corpus: the start was cut at a soft hyphen and kept its hyphen.
test('the start holds no hyphen where it passes a soft hyphen', () =>
  assert.equal(truncateMiddle(prepareLabel('aaaa\u00ADbbbb\u00ADcccc', '20px Test'), 100), 'aaaab…cccc'))
// Found by the browser sweep: the start and end were measured apart, and the joined result,
// which kerns across the ellipsis, came out up to a quarter pixel wider than the width.
test('the result is measured whole, and the start gives up what kerning adds', () =>
  assert.equal(truncateMiddle(prepareLabel('yyyyyyyy zzzzzzzz', '20px Kern'), 100), 'yyyy…zzzz'))

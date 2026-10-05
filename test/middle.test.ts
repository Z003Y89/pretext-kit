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

import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareWithSegments } from '@chenglou/pretext'
import { clamp, clampStats, measureTail } from '../src/clamp.ts'

const p = (text: string) => prepareWithSegments(text, '20px Test')
const T = 'aa bb cc dd ee ff'

test('cuts inside a word to leave the tail room', () => {
  const c = clamp(p(T), 50, 2, { width: 10, spaceWidth: 5, hyphenWidth: 10 })
  assert.equal(c.truncated, true); assert.equal(c.lineCount, 2)
  assert.equal(c.lines[0]!.text.trimEnd(), 'aa bb')
  assert.deepEqual(c.lines[1], { text: 'cc d', width: 35 })
})
test('the tail follows the line when both fit', () => {
  const c = clamp(p(T), 50, 2, { width: 5, spaceWidth: 5, hyphenWidth: 10 })
  assert.equal(c.truncated, true); assert.equal(c.lineCount, 2)
  assert.deepEqual(c.lines[1], { text: 'cc dd', width: 45 })
})
test('a line within 1/64px of the width still takes the tail', () =>
  assert.deepEqual(clamp(p(T), 50, 2, { width: 5 + 1 / 128, spaceWidth: 5, hyphenWidth: 10 }).lines[1], { text: 'cc dd', width: 45 }))
test('no tail: the cut is the plain line', () => {
  const c = clamp(p(T), 50, 2)
  assert.equal(c.truncated, true)
  assert.deepEqual(c.lines[1], { text: 'cc dd', width: 45 })
})
const PW = () => prepareWithSegments(' aa bb cc dd ee ff', '20px Test', { whiteSpace: 'pre-wrap' })
test('a leading space is kept when there is no room', () =>
  assert.deepEqual(clamp(PW(), 50, 1, { width: 50, spaceWidth: 5, hyphenWidth: 10 }).lines[0], { text: ' ', width: 5 }))
test('a kept first grapheme reports its painted width', () => {
  const l = clamp(p(T), 50, 1, { width: 80, spaceWidth: 5, hyphenWidth: 10 }).lines[0]!
  assert.deepEqual(l, { text: 'a', width: 10 })
})
test('not truncated when maxLines covers the text', () => {
  const c = clamp(p(T), 50, 3, { width: 10, spaceWidth: 5, hyphenWidth: 10 })
  assert.equal(c.truncated, false); assert.equal(c.lineCount, 3)
})
test('a tail wider than the width keeps one grapheme', () =>
  assert.equal(clamp(p(T), 50, 1, { width: 80, spaceWidth: 5, hyphenWidth: 10 }).lines[0]!.text, 'a'))
test('maxLines below 1 throws', () => assert.throws(() => clamp(p(T), 50, 0), RangeError))
test('empty text', () => assert.deepEqual(clamp(p(''), 50, 2), { truncated: false, lineCount: 0, lines: [] }))
test('clampStats agrees with clamp without building lines', () => {
  const texts = [T, '']
  const widths = [5, 30, 50, 75, 200]
  for (let a = 0; a < texts.length; a++) for (let b = 0; b < widths.length; b++) for (let m = 1; m <= 4; m++) {
    const c = clamp(p(texts[a]!), widths[b]!, m)
    assert.deepEqual(clampStats(p(texts[a]!), widths[b]!, m), { truncated: c.truncated, lineCount: c.lineCount })
  }
})
test('measureTail measures in the font', () =>
  assert.deepEqual(measureTail('…', '20px Test'), { width: 10, spaceWidth: 5, hyphenWidth: 10 }))
// Found by the browser sweep's German corpus: the cut was built from pieces Pretext ended at soft
// hyphens, so it held a hyphen mid-line ('aabb-') that the line's text has nowhere there.
test('a cut passing a soft hyphen paints no hyphen there and counts none', () => {
  const c = clamp(p('aa\u00ADbb\u00ADcc dd ee'), 100, 1, { width: 45, spaceWidth: 5, hyphenWidth: 10 })
  assert.equal(c.truncated, true)
  assert.deepEqual(c.lines[0], { text: 'aabbc', width: 50 })
})
test('the full line keeps the hyphen it ends with when the tail fits', () => {
  const c = clamp(p('aa\u00ADbb\u00ADcc dd ee'), 55, 1, { width: 5, spaceWidth: 5, hyphenWidth: 10 })
  assert.deepEqual(c.lines[0], { text: 'aabb-', width: 50 })
})

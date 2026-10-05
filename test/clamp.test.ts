import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareWithSegments } from '@chenglou/pretext'
import { clamp, clampStats, measureTail } from '../src/clamp.ts'

const p = (text: string) => prepareWithSegments(text, '20px Test')
const T = 'aa bb cc dd ee ff'

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

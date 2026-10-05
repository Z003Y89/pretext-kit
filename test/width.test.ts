import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareWithSegments, measureLineStats } from '@chenglou/pretext'
import { prepareRichInline } from '@chenglou/pretext/rich-inline'
import { shrinkwrap, balance, shrinkwrapRich, balanceRich } from '../src/width.ts'

const p = (text: string) => prepareWithSegments(text, '20px Test')

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

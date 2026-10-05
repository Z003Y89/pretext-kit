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
  assert.deepEqual(balance(p('aa bb cc dd ee'), 94.5), { width: 70, lineCount: 2 })
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

test('balance terminates on an infinite maxWidth', () => {
  const t = prepareWithSegments('aa\nbb', '20px Test', { whiteSpace: 'pre-wrap' })
  assert.deepEqual(balance(t, Infinity), { width: 20, lineCount: 2 })
})

// Deterministic generator so a failure reproduces.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('returned widths reproduce their line count and never exceed maxWidth', () => {
  const next = rng(99)
  for (let n = 0; n < 500; n++) {
    const wordCount = 1 + Math.floor(next() * 12)
    let text = ''
    for (let w = 0; w < wordCount; w++) {
      const len = 1 + Math.floor(next() * 8)
      if (w > 0) text += next() < 0.1 ? '\n' : ' '
      for (let c = 0; c < len; c++) text += 'abcdefgh'[Math.floor(next() * 8)]
    }
    const t = prepareWithSegments(text, '20px Test', { whiteSpace: 'pre-wrap' })
    const maxWidth = 5 + next() * 395
    const mw = n % 2 === 0 ? Math.floor(maxWidth) : maxWidth
    const target = measureLineStats(t, mw).lineCount
    for (const r of [balance(t, mw), shrinkwrap(t, mw)]) {
      const ctx = `${JSON.stringify(text)} @ ${mw}: ${JSON.stringify(r)}`
      assert.ok(r.width <= mw, ctx)
      assert.equal(r.lineCount, target, ctx)
      assert.equal(measureLineStats(t, r.width).lineCount, r.lineCount, ctx)
    }
  }
})

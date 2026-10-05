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
test('balance keeps a width whose line Pretext fits within its tolerance', () => {
  // 'aa bb cc' measures 70.003px: Pretext fits it at 70, so 71 would be a pixel wider than needed.
  const t = prepareWithSegments('aa bb cc dd ee', `${70.003 / 3.5}px Test`)
  assert.equal(measureLineStats(t, 70).lineCount, 2)
  assert.deepEqual(balance(t, 100), { width: 70, lineCount: 2 })
})
test('shrinkwrap keeps a whole pixel its widest line overshoots within tolerance', () => {
  const t = prepareWithSegments('aa bb cc dd ee', `${70.003 / 3.5}px Test`)
  assert.deepEqual(shrinkwrap(t, 80), { width: 70, lineCount: 2 })
})
test('shrinkwrap rounds up when the pixel below would change the lines', () => {
  // 70.01px is past the slack Pretext gives a line, so 70 would break 'aa bb cc'.
  const t = prepareWithSegments('aa bb cc dd ee', `${70.01 / 3.5}px Test`)
  assert.equal(measureLineStats(t, 70).lineCount, 3)
  assert.deepEqual(shrinkwrap(t, 80), { width: 71, lineCount: 2 })
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

// Found by the browser sweep's German corpus: Pretext fits a line ending at a soft hyphen whose
// syllables measure narrower joined than apart (here 'ts' kerns), and reports its width apart,
// past the width it fits at. Balance rounded that width up, a pixel or more wider than needed.
test('balance keeps the narrowest width Pretext fits a soft-hyphen line at', () => {
  const t = prepareWithSegments('aat\u00ADsaa\u00ADbb cc', '20px Kern')
  assert.equal(measureLineStats(t, 65).lineCount, 2)
  assert.equal(measureLineStats(t, 64).lineCount, 3)
  assert.deepEqual(balance(t, 100), { width: 65, lineCount: 2 })
})
// Review round 1: the soft-hyphen fix above returned lo for any lo > 1, so a grapheme wider than
// lo overflowed the answer. Whether to round up is decided by the widest unbreakable piece.
test('balance still contains a grapheme wider than the narrowest fitting width', () => {
  const t = p('a' + '\u0301'.repeat(9) + ' xyz uvw') // one 100px grapheme
  assert.deepEqual(balance(t, 100), { width: 100, lineCount: 2 })
})
test('balance caps that grapheme at maxWidth', () => {
  const t = p('…\u0301\u0301\u0301\u0301 xy') // one 50px grapheme
  assert.deepEqual(balance(t, 44), { width: 44, lineCount: 2 })
})

// Final review: Pretext lays out a NaN maxWidth as unbounded and a negative one as narrower than
// any grapheme, so the helpers would answer a NaN or negative width; they reject both instead, as
// Pretext rejects a NaN letterSpacing or a negative box width.
test('a negative or NaN maxWidth throws a RangeError', () => {
  const rich = prepareRichInline([{ text: 'aa bb', font: '20px Test' }])
  for (const bad of [-1, -0.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => shrinkwrap(p('aa bb'), bad), RangeError, `shrinkwrap ${bad}`)
    assert.throws(() => balance(p('aa bb'), bad), RangeError, `balance ${bad}`)
    assert.throws(() => shrinkwrapRich(rich, bad), RangeError, `shrinkwrapRich ${bad}`)
    assert.throws(() => balanceRich(rich, bad), RangeError, `balanceRich ${bad}`)
  }
})

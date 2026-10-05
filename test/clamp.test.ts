import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutNextLine, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { clamp, clampStats, measureTail } from '../src/clamp.ts'

const FONT = '20px Test'
const p = (text: string) => prepareWithSegments(text, FONT)
const T = 'aa bb cc dd ee ff'
// Stand-in widths: a character 10px, a space 5px, so n ellipses are a 10n px tail.
const tail = (n: number) => measureTail('…'.repeat(n), FONT)

test('cuts inside a word to leave the tail room', () => {
  const c = clamp(p(T), 50, 2, tail(1))
  assert.equal(c.truncated, true); assert.equal(c.lineCount, 2)
  assert.equal(c.lines[0]!.text.trimEnd(), 'aa bb')
  assert.deepEqual(c.lines[1], { text: 'cc d', width: 35 })
})
test('the tail follows the line when both fit', () => {
  const c = clamp(p(T), 55, 2, tail(1))
  assert.equal(c.truncated, true); assert.equal(c.lineCount, 2)
  assert.deepEqual(c.lines[1], { text: 'cc dd', width: 45 })
})
test('a line within 1/64px of the width still takes the tail', () =>
  assert.deepEqual(clamp(p(T), 55 - 1 / 128, 2, tail(1)).lines[1], { text: 'cc dd', width: 45 }))
test('no tail: the cut is the plain line', () => {
  const c = clamp(p(T), 50, 2)
  assert.equal(c.truncated, true)
  assert.deepEqual(c.lines[1], { text: 'cc dd', width: 45 })
})
test('a leading space is kept when there is no room', () => {
  const opts = { whiteSpace: 'pre-wrap' as const }
  const pw = prepareWithSegments(' aa bb cc dd ee ff', FONT, opts)
  assert.deepEqual(clamp(pw, 50, 1, measureTail('…'.repeat(5), FONT, opts)).lines[0], { text: ' ', width: 5 })
})
test('a kept first grapheme reports its painted width', () =>
  assert.deepEqual(clamp(p(T), 50, 1, tail(8)).lines[0], { text: 'a', width: 10 }))
test('not truncated when maxLines covers the text', () => {
  const c = clamp(p(T), 50, 3, tail(1))
  assert.equal(c.truncated, false); assert.equal(c.lineCount, 3)
})
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
test('measureTail measures in the font and keeps what the cut is measured with', () =>
  assert.deepEqual(measureTail('…', FONT), { text: '…', font: FONT, options: undefined, width: 10, spaceWidth: 5 }))
// Found by the browser sweep's German corpus: the cut was built from pieces Pretext ended at soft
// hyphens, so it held a hyphen mid-line that the line's text has nowhere there.
test('a cut of a line ending at a soft hyphen paints no hyphen', () =>
  assert.deepEqual(clamp(p('aa­bb­cc dd ee'), 55, 1, tail(1)).lines[0], { text: 'aabb', width: 40 }))
test('the full line keeps the hyphen it ends with when the tail fits', () =>
  assert.deepEqual(clamp(p('aa­bb­cc dd ee'), 55, 1, measureTail(' ', FONT)).lines[0], { text: 'aabb-', width: 50 }))
// Review round 1: a cut was judged by the sum of its pieces and the tail. Painted, the cut and the
// tail are one text, which here kerns 'y…' a quarter em looser, so the whole line overran.
test('the cut and the tail are measured as the one text they paint as', () =>
  assert.deepEqual(clamp(prepareWithSegments('yyyyyy zz', '20px Kern'), 70, 1, measureTail('…', '20px Kern')).lines[0], { text: 'yyyyy', width: 50 }))
// Review round 1: the cut must be the longest that fits. Pretext ends a piece at the first soft
// hyphen of a fresh line even where it overflows, so cutting by pieces stopped a syllable short.
test('the cut is the longest that fits, soft hyphens or not', () => {
  const text = 'xx aaaa­bbbbbb­cc­dd ee ff gg'
  const fits = (s: string, w: number) => measureNaturalWidth(prepareWithSegments(s, FONT)) <= w + 1 / 64
  for (let w = 30; w <= 200; w++) {
    const c = clamp(p(text), w, 1, tail(1))
    if (!c.truncated) continue
    const full = layoutNextLine(p(text), { segmentIndex: 0, graphemeIndex: 0 }, w)!.text.replace(/-$/, '').trimEnd()
    const cut = c.lines[0]!.text
    if (cut === full || cut === full + '-') continue
    assert.ok(full.startsWith(cut), `${w}: ${cut} / ${full}`)
    assert.ok(cut.length === 1 || fits(cut + '…', w), `${w}: ${cut}… overruns`)
    const next = /^\s*\S/.exec(full.slice(cut.length))![0]
    assert.ok(!fits(cut + next + '…', w), `${w}: ${cut} stops short of ${cut + next}…`)
  }
})

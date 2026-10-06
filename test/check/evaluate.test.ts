import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { measureLineStats, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { conditionGrid, resolveSlot } from '../../src/check/conditions.ts'
import { evaluateLabel, naturalWidth } from '../../src/check/evaluate.ts'
import type { Condition, Slot } from '../../src/check/types.ts'
import { install, registerFont } from '../../src/headless/index.ts'
import { fitFontSize, prepareLabel, prepareSizes, shrinkwrap, truncateMiddle } from '../../src/index.ts'

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
install()

const FONT = '16px Inter'
const natural = (text: string, font = FONT) => measureNaturalWidth(prepareWithSegments(text, font))
const slotOf = (width: Slot['width'], policy: Slot['policy'], more: Partial<Slot> = {}, condition: Condition = { name: 'default' }) =>
  resolveSlot('s', { width, font: FONT, policy, ...more }, condition)
const near = (actual: number | undefined, expected: number, eps = 1 / 64) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`)

const TEXT = 'Speichern unter'

test('as-is passes at the natural width and overflows by 1px below it', () => {
  const n = natural(TEXT)
  const pass = evaluateLabel(TEXT, slotOf(n, 'as-is'), 'de')
  assert.equal(pass.kind, 'pass')
  assert.equal(pass.measured.lines, 1)
  const over = evaluateLabel(TEXT, slotOf(n - 1, 'as-is'), 'de')
  assert.equal(over.kind, 'overflow')
  near(over.missing?.px, 1)
})

test('shrinkTo passes by shrinking and is below-min-size when even shrinkTo overflows', () => {
  const n16 = natural(TEXT)
  const n10 = natural(TEXT, '10px Inter')
  const shrunk = evaluateLabel(TEXT, slotOf(n16 * 0.8, { shrinkTo: 10 }), 'de')
  assert.equal(shrunk.kind, 'pass')
  assert.ok(shrunk.measured.fontPx < 16 && shrunk.measured.fontPx >= 10)
  assert.equal(evaluateLabel(TEXT, slotOf(n10, { shrinkTo: 10 }), 'de').measured.fontPx, 10)
  const below = evaluateLabel(TEXT, slotOf(n10 - 1, { shrinkTo: 10 }), 'de')
  assert.equal(below.kind, 'below-min-size')
  near(below.missing?.px, 1)
  assert.ok(below.missing?.fitsAtPx !== undefined && below.missing.fitsAtPx < 10 && below.missing.fitsAtPx >= 1)
})

test('lines: n passes at the narrowest width and is too-many-lines 1px below it', () => {
  const text = 'Alpha beta gamma delta epsilon zeta'
  const prepared = prepareWithSegments(text, FONT)
  let w = 1
  while (measureLineStats(prepared, w).lineCount > 2) w++
  assert.equal(evaluateLabel(text, slotOf(w, { lines: 2 }), 'en').kind, 'pass')
  const many = evaluateLabel(text, slotOf(w - 1, { lines: 2 }), 'en')
  assert.equal(many.kind, 'too-many-lines')
  assert.equal(many.measured.lines, 3)
  assert.ok(many.missing?.px !== undefined && many.missing.px > 0 && many.missing.px <= 1 + 1 / 64)
})

test('truncate end is a truncated warning, middle with lines 2 is a RangeError', () => {
  const n = natural(TEXT)
  assert.equal(evaluateLabel(TEXT, slotOf(n, { truncate: 'end' }), 'de').kind, 'pass')
  assert.equal(evaluateLabel(TEXT, slotOf(n - 1, { truncate: 'end' }), 'de').kind, 'truncated')
  assert.equal(evaluateLabel(TEXT, slotOf(n - 1, { truncate: 'middle' }), 'de').kind, 'truncated')
  assert.throws(() => slotOf(n, { truncate: 'middle', lines: 2 }), RangeError)
})

test('resolveSlot exposes the reserve scaled by textScale and zoom', () => {
  const s = slotOf(300, 'as-is', { reserve: 20 }, { name: 'c', textScale: 1.5, zoom: 2 })
  assert.equal(s.reserve, 60)
  assert.equal(s.box, 540)
  assert.equal(slotOf(300, 'as-is').reserve, 0)
})

test('reserve subtracts from the box', () => {
  const n = natural(TEXT)
  assert.equal(evaluateLabel(TEXT, slotOf(n + 24, 'as-is', { reserve: 24 }), 'de').kind, 'pass')
  assert.equal(evaluateLabel(TEXT, slotOf(n + 23, 'as-is', { reserve: 24 }), 'de').kind, 'overflow')
})

test('textScale grows the text but not the box, zoom grows both', () => {
  const n = natural(TEXT)
  const width = n + 1
  assert.equal(evaluateLabel(TEXT, slotOf(width, 'as-is'), 'de').kind, 'pass')
  const big = slotOf(width, 'as-is', {}, { name: 't130', textScale: 1.3 })
  assert.equal(big.box, width)
  assert.equal(evaluateLabel(TEXT, big, 'de').kind, 'overflow')
  const zoomed = slotOf(width, 'as-is', {}, { name: 'z130', zoom: 1.3 })
  assert.equal(evaluateLabel(TEXT, zoomed, 'de').kind, 'pass')
})

test('a viewport function gives its width at the condition viewport', () => {
  const s = slotOf((vw) => vw / 10, 'as-is', {}, { name: 'v', viewport: 1024 })
  near(s.box, 102.4, 1e-9)
})

test('slot overrides and shrinkTo scaling', () => {
  const s = resolveSlot('s', { width: 100, font: FONT, policy: { shrinkTo: 10 } }, { name: 'c', textScale: 1.5, zoom: 2, slots: { s: { width: 200 } } })
  assert.equal(s.box, 400)
  assert.deepEqual(s.policy, { shrinkTo: 30 })
  assert.equal(s.sizePx, 48)
  assert.equal(s.fontAt(12), '12px Inter')
  assert.throws(() => resolveSlot('s', { width: 100, font: 'Inter', policy: 'as-is' }, { name: 'c' }), RangeError)
  assert.throws(() => slotOf(100, 'as-is', {}, { name: 'bad', zoom: 0 }), /slot "s".*bad/)
})

test('an uncovered character is an issue, not a throw', () => {
  const v = evaluateLabel('Fertig ✅', slotOf(400, 'as-is'), 'de')
  assert.equal(v.kind, 'uncovered')
  assert.match(v.detail ?? '', /U\+2705/)
})

test('an empty label passes every policy with width 0', () => {
  for (const policy of ['as-is', { shrinkTo: 10 }, { lines: 2 }, { truncate: 'end' }, { truncate: 'middle' }] as Slot['policy'][]) {
    for (const text of ['', '  ']) {
      const v = evaluateLabel(text, slotOf(50, policy), 'de')
      assert.equal(v.kind, 'pass')
      assert.equal(v.measured.width, 0)
    }
  }
})

test('a box of 0 or less throws a RangeError naming slot and condition', () => {
  assert.throws(() => slotOf(20, 'as-is', { reserve: 24 }, { name: 'tiny' }), /slot "s".*condition "tiny"/)
})

test('conditionGrid is the product with distinct names', () => {
  const grid = conditionGrid({ textScale: [1, 1.3], viewport: [1024, 1440] })
  assert.equal(grid.length, 4)
  assert.equal(new Set(grid.map((c) => c.name)).size, 4)
  assert.equal(grid[1]!.name, 'text 100% · 1440px')
  assert.deepEqual(grid[2], { name: 'text 130% · 1024px', textScale: 1.3, viewport: 1024 })
  assert.deepEqual(conditionGrid({}), [{ name: 'default' }])
})

test('naturalWidth applies the slot text size and transform', () => {
  near(naturalWidth(TEXT, slotOf(100, 'as-is'), 'de'), natural(TEXT))
  near(naturalWidth('abc', slotOf(100, 'as-is', { textTransform: 'uppercase' }), 'de'), natural('ABC'))
})

// The one fit test: a verdict never differs from what the kit's helpers decide.
const direct = (text: string, font: (px: number) => string, min: number, max: number, width: number, maxLines = 1) =>
  fitFontSize(prepareSizes(text, font, { min, max }), { width, maxLines }, () => 0)

test('a width within 1/128 px of the natural width agrees with fitFontSize and shrinkwrap', () => {
  for (const text of [TEXT, 'Speicherort', 'Alpha beta gamma delta']) {
    const n = natural(text)
    for (const delta of [0.02, 1 / 128, 0.004, 0.001, 0, -0.001, -1 / 128]) {
      const width = n - delta
      const pass = evaluateLabel(text, slotOf(width, 'as-is'), 'de').kind === 'pass'
      assert.equal(pass, direct(text, (px) => `${px}px Inter`, 16, 16, width) !== null, `${text} at -${delta}`)
      const wrap = shrinkwrap(prepareWithSegments(text, FONT), width)
      assert.equal(pass, wrap.lineCount === 1 && measureLineStats(prepareWithSegments(text, FONT), width).maxLineWidth <= width + 1 / 64, `${text} at -${delta}`)
    }
  }
})

test('shrinkTo at exactly the shrinkTo size and exactly the slot size agrees with fitFontSize', () => {
  const at = (px: number) => `${px}px Inter`
  for (const px of [10, 16]) {
    const n = natural(TEXT, at(px))
    for (const delta of [0, 1 / 128, -1 / 128, 0.001, -0.001]) {
      const width = n - delta
      const v = evaluateLabel(TEXT, slotOf(width, { shrinkTo: 10 }), 'de')
      const d = direct(TEXT, at, 10, 16, width)
      assert.equal(v.kind, d === null ? 'below-min-size' : 'pass', `${px}px at -${delta}`)
      if (d !== null) assert.equal(v.measured.fontPx, d.px)
    }
  }
})

test('middle truncation collapses white space as prepareLabel does', () => {
  const raw = 'a   b\n c'
  const label = prepareLabel(raw, FONT)
  assert.equal(label.text, 'a b c')
  const n = natural(label.text)
  assert.equal(evaluateLabel(raw, slotOf(n + 10, { truncate: 'middle' }), 'en').kind, 'pass')
  for (const width of [n, n - 1, n - 3]) {
    const cut = truncateMiddle(label, width)
    assert.equal(evaluateLabel(raw, slotOf(width, { truncate: 'middle' }), 'en').kind, cut === label.text ? 'pass' : 'truncated')
  }
})

test('truncate end with lines 2 clamps at two lines', () => {
  const text = 'Alpha beta gamma delta epsilon zeta'
  const prepared = prepareWithSegments(text, FONT)
  let w = 1
  while (measureLineStats(prepared, w).lineCount > 2) w++
  assert.equal(evaluateLabel(text, slotOf(w, { truncate: 'end', lines: 2 }), 'en').kind, 'pass')
  assert.equal(evaluateLabel(text, slotOf(w - 1, { truncate: 'end', lines: 2 }), 'en').kind, 'truncated')
})

test('letterSpacing changes an as-is verdict and middle truncation does not pass it falsely', () => {
  const n = natural(TEXT)
  assert.equal(evaluateLabel(TEXT, slotOf(n + 1, 'as-is'), 'de').kind, 'pass')
  const spaced = { letterSpacing: 2 }
  const asIs = evaluateLabel(TEXT, slotOf(n + 1, 'as-is', spaced), 'de')
  assert.equal(asIs.kind, 'overflow')
  assert.ok(asIs.measured.width > n + 10)
  const middle = evaluateLabel(TEXT, slotOf(n + 1, { truncate: 'middle' }, spaced), 'de')
  assert.equal(middle.kind, 'truncated')
  assert.equal(middle.measured.width, asIs.measured.width)
})

test('middle truncation under pre-wrap judges the collapsed text with the slot options', () => {
  const raw = 'Speichern   unter\nJetzt'
  const n = natural('Speichern unter Jetzt')
  const keep = { whiteSpace: 'pre-wrap' as const }
  assert.equal(evaluateLabel(raw, slotOf(n + 1, { truncate: 'middle' }, keep), 'de').kind, 'pass')
  const cut = evaluateLabel(raw, slotOf(n - 1, { truncate: 'middle' }, keep), 'de')
  assert.equal(cut.kind, 'truncated')
  near(cut.measured.width, n)
})

test('below-min-size omits missing.px when the text is not too wide', () => {
  const v = evaluateLabel('a\nb', slotOf(500, { shrinkTo: 10 }, { whiteSpace: 'pre-wrap' }), 'en')
  assert.equal(v.kind, 'below-min-size')
  assert.equal(v.missing, undefined)
})

test('fitsAtPx is the largest whole size below shrinkTo that fits', () => {
  const n10 = natural(TEXT, '10px Inter')
  const width = n10 - 1
  let expected = 0
  for (let px = 9; px >= 1; px--) {
    if (direct(TEXT, (p) => `${p}px Inter`, px, px, width) !== null) {
      expected = px
      break
    }
  }
  assert.ok(expected > 0)
  assert.equal(evaluateLabel(TEXT, slotOf(width, { shrinkTo: 10 }), 'de').missing?.fitsAtPx, expected)
})

test('a verdict at the 102.4 box agrees with fitFontSize', () => {
  const s = slotOf((vw) => vw / 10, 'as-is', {}, { name: 'v', viewport: 1024 })
  const v = evaluateLabel(TEXT, s, 'de')
  assert.equal(v.kind === 'pass', direct(TEXT, (px) => `${px}px Inter`, 16, 16, 102.4) !== null)
  assert.equal(v.measured.box, 102.40625)
})

test('shrinkTo scales with textScale and zoom', () => {
  const n13 = natural(TEXT, '13px Inter')
  const scaled = (condition: Condition, width: number) => slotOf(width, { shrinkTo: 10 }, {}, condition)
  const text = scaled({ name: 't', textScale: 1.3 }, n13)
  assert.deepEqual(text.policy, { shrinkTo: 13 })
  assert.equal(evaluateLabel(TEXT, text, 'de').measured.fontPx, 13)
  const tight = evaluateLabel(TEXT, scaled({ name: 't', textScale: 1.3 }, n13 - 1), 'de')
  assert.equal(tight.kind, 'below-min-size')
  assert.ok(tight.missing?.fitsAtPx !== undefined && tight.missing.fitsAtPx < 13)
  const zoomed = evaluateLabel(TEXT, scaled({ name: 'z', zoom: 1.3 }, n13 / 1.3), 'de')
  assert.equal(zoomed.kind, 'pass')
  assert.equal(zoomed.measured.fontPx, 13)
})

test('shrinkTo must be positive, finite and not above the font size', () => {
  for (const shrinkTo of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 17]) {
    assert.throws(() => slotOf(100, { shrinkTo }), /slot "s".*shrinkTo/, String(shrinkTo))
  }
  slotOf(100, { shrinkTo: 16 })
})

test('conditionGrid omits an empty axis and keeps names distinct', () => {
  assert.deepEqual(conditionGrid({ textScale: [] }), [{ name: 'default' }])
  assert.equal(conditionGrid({ textScale: [], zoom: [1.5] }).length, 1)
  const close = conditionGrid({ textScale: [1.125, 1.13] })
  assert.equal(new Set(close.map((c) => c.name)).size, 2)
  assert.equal(conditionGrid({ textScale: [1.3] })[0]!.name, 'text 130%')
})

test('a font size written as .5px reads as 0.5px', () => {
  const s = resolveSlot('s', { width: 100, font: '.5px Inter', policy: 'as-is' }, { name: 'c' })
  assert.equal(s.sizePx, 0.5)
  assert.equal(s.fontAt(12), '12px Inter')
})

// overflow-wrap: normal: a word fits as an as-is label of it would.
const WORD = 'Benachrichtigungen'
const normal = { overflowWrap: 'normal' as const }

test('overflowWrap defaults to break-word, is overridable per condition and validated', () => {
  assert.equal(slotOf(100, { lines: 2 }).overflowWrap, 'break-word')
  assert.equal(slotOf(100, { lines: 2 }, normal).overflowWrap, 'normal')
  const back = resolveSlot('s', { width: 100, font: FONT, policy: { lines: 2 }, ...normal }, { name: 'c', slots: { s: { overflowWrap: 'break-word' } } })
  assert.equal(back.overflowWrap, 'break-word')
  assert.throws(() => slotOf(100, { lines: 2 }, { overflowWrap: 'anywhere' as never }), /slot "s".*overflowWrap/)
})

test('lines with overflowWrap normal: a word fits by its natural width plus 1/64 px, else overflows by its excess', () => {
  const w = natural(WORD)
  assert.equal(w * 64, Math.round(w * 64))
  for (const box of [w, w - 1 / 64]) assert.equal(evaluateLabel(WORD, slotOf(box, { lines: 2 }, normal), 'de').kind, 'pass', String(box))
  const hair = evaluateLabel(WORD, slotOf(w - 1 / 64 - 0.002, { lines: 2 }, normal), 'de')
  assert.equal(hair.kind, 'overflow')
  near(hair.missing?.px, 1 / 64)
  const over = evaluateLabel(WORD, slotOf(w - 1, { lines: 2 }, normal), 'de')
  assert.equal(over.kind, 'overflow')
  near(over.missing?.px, 1)
  near(over.measured.width, w)
  // Pretext's break-word line count at the box, not what overflow-wrap: normal paints (README, Policies).
  assert.equal(over.measured.lines, 2)
  assert.match(over.detail ?? '', /"Benachrichtigungen" does not break \(overflow-wrap: normal\)/)
})

test('a word that cannot break is judged by its natural width, not by where Pretext keeps it on one line', () => {
  const word = 'Mitarbeiterportal'
  const w = natural(word)
  const v = evaluateLabel(word, slotOf(w - 0.25, { lines: 2 }, normal), 'de')
  assert.equal(v.kind, 'overflow')
  near(v.missing?.px, 0.25)
  assert.equal(evaluateLabel(word, slotOf(w - 0.25, { truncate: 'end', lines: 2 }, normal), 'de').kind, 'truncated')
})

test('a word within 1/64 px past the box stays whole: the line count and the clamp agree with the word rule', () => {
  const word = 'improvements'
  const w = natural(word)
  const box = w - 1 / 128
  assert.equal(measureLineStats(prepareWithSegments(word, FONT), box).lineCount, 2)
  const one = evaluateLabel(word, slotOf(box, { lines: 1 }, normal), 'en')
  assert.equal(one.kind, 'pass')
  assert.equal(one.measured.lines, 1)
  assert.equal(evaluateLabel(word, slotOf(box, { truncate: 'end', lines: 1 }, normal), 'en').kind, 'pass')
  assert.equal(evaluateLabel(`${word} ${word}`, slotOf(box, { lines: 2 }, normal), 'en').kind, 'pass')
  assert.equal(evaluateLabel(word, slotOf(box, { lines: 1 }), 'en').kind, 'too-many-lines')
})

test('break-word, the default, still passes a long word in lines 2 by breaking it, as before', () => {
  const w = natural(WORD)
  for (const more of [{}, { overflowWrap: 'break-word' as const }]) {
    const v = evaluateLabel(WORD, slotOf(w - 1, { lines: 2 }, more), 'de')
    assert.equal(v.kind, 'pass')
    assert.equal(v.measured.lines, 2)
    assert.equal(v.detail, undefined)
  }
})

test('only the longest of several words decides, and missing.px is its excess', () => {
  const text = `Neue ${WORD} anzeigen`
  const w = natural(WORD)
  assert.equal(evaluateLabel(text, slotOf(w, { lines: 3 }, normal), 'de').kind, 'pass')
  const v = evaluateLabel(text, slotOf(w - 2, { lines: 3 }, normal), 'de')
  assert.equal(v.kind, 'overflow')
  near(v.missing?.px, 2)
  assert.match(v.detail ?? '', /"Benachrichtigungen"/)
})

test('a soft hyphen is a break opportunity: its halves are the pieces', () => {
  const text = 'Benach­richtigungen'
  const w = natural(WORD)
  assert.ok(natural('Benach-') < w - 20 && natural('richtigungen') < w - 20)
  assert.equal(evaluateLabel(text, slotOf(w - 20, { lines: 2 }, normal), 'de').kind, 'pass')
  const v = evaluateLabel(text, slotOf(natural('richtigungen') - 1, { lines: 2 }, normal), 'de')
  assert.equal(v.kind, 'overflow')
  assert.match(v.detail ?? '', /"richtigungen"/)
})

test('a piece that fits but not with the hyphen its soft hyphen paints overflows by the hyphen', () => {
  const text = 'Bit\u00ADte'
  const box = natural('Bit')
  const v = evaluateLabel(text, slotOf(box, { lines: 2 }, normal), 'de')
  assert.equal(v.kind, 'overflow')
  near(v.measured.width, natural('Bit\u2010'))
  near(v.missing?.px, natural('Bit\u2010') - box)
  assert.match(v.detail ?? '', /"Bit-" does not break/)
  assert.equal(evaluateLabel(text, slotOf(natural('Bit\u2010'), { lines: 2 }, normal), 'de').kind, 'pass')
  assert.equal(evaluateLabel(text, slotOf(box, { lines: 2 }), 'de').kind, 'pass')
})

test('a hyphen-minus compound breaks after its hyphen', () => {
  const text = 'Nebenrollen-Takes'
  const first = natural('Nebenrollen-')
  assert.equal(evaluateLabel(text, slotOf(first, { lines: 2 }, normal), 'de').kind, 'pass')
  const v = evaluateLabel(text, slotOf(first - 1, { lines: 2 }, normal), 'de')
  assert.equal(v.kind, 'overflow')
  near(v.missing?.px, 1)
  assert.match(v.detail ?? '', /"Nebenrollen-"/)
})

test('truncate end with overflowWrap normal: a word too wide is cut, however few lines it takes', () => {
  const w = natural(WORD)
  assert.equal(evaluateLabel(WORD, slotOf(w, { truncate: 'end', lines: 2 }, normal), 'de').kind, 'pass')
  const cut = evaluateLabel(WORD, slotOf(w - 1, { truncate: 'end', lines: 2 }, normal), 'de')
  assert.equal(cut.kind, 'truncated')
  assert.match(cut.detail ?? '', /"Benachrichtigungen"/)
  assert.equal(evaluateLabel(WORD, slotOf(w - 1, { truncate: 'end', lines: 2 }), 'de').kind, 'pass')
})

test('one-line policies are unchanged by overflowWrap', () => {
  const n = natural(WORD)
  for (const policy of ['as-is', { shrinkTo: 10 }, { truncate: 'middle' }] as Slot['policy'][]) {
    for (const width of [n + 1, n - 1, n - 30]) {
      assert.deepEqual(evaluateLabel(WORD, slotOf(width, policy, normal), 'de'), evaluateLabel(WORD, slotOf(width, policy), 'de'), `${JSON.stringify(policy)} at ${width}`)
    }
  }
})

// A word in the window (natural width within 1/64 px past the box) lays every line out at the box plus 1/64 px, so a
// line of several words that is as wide stays on one line too, where Chromium, whose width is 1/64 px wider than
// Pretext's, can wrap it (README, Policies).
test('lines 2 with overflowWrap normal: with one word in the window, a line of several words at box + 1/64 stays whole', () => {
  const word = 'improvements'
  const line = 'add mom now'
  assert.equal(natural(line), natural(word))
  const box = natural(word) - 1 / 128
  const both = evaluateLabel(`${word} ${line}`, slotOf(box, { lines: 2 }, normal), 'en')
  assert.equal(both.kind, 'pass')
  assert.equal(both.measured.lines, 2)
  assert.equal(evaluateLabel(line, slotOf(box, { lines: 1 }, normal), 'en').kind, 'too-many-lines')
  assert.equal(evaluateLabel(`${word} ${line}`, slotOf(box, { lines: 2 }), 'en').kind, 'too-many-lines')
})

test('slack: as-is, truncate middle and shrinkTo at the slot size are the box less the natural width', () => {
  const n = natural(TEXT)
  for (const policy of ['as-is', { truncate: 'middle' }, { shrinkTo: 10 }] as Slot['policy'][]) {
    near(evaluateLabel(TEXT, slotOf(n + 3, policy), 'de').slack, 3, 1e-9)
    const zoomed = slotOf(n + 23, policy, { reserve: 20 }, { name: 'z', zoom: 1.3 })
    near(evaluateLabel(TEXT, zoomed, 'de').slack, zoomed.box - naturalWidth(TEXT, zoomed, 'de'), 1e-9)
  }
  for (const policy of ['as-is', { truncate: 'middle' }] as Slot['policy'][]) assert.equal(evaluateLabel(TEXT, slotOf(n - 3, policy), 'de').slack, undefined)
})

test('slack: a pass within the tolerance has 0 to spare', () => {
  const n = natural(TEXT)
  for (const policy of ['as-is', { truncate: 'middle' }, { shrinkTo: 10 }, { lines: 1 }, { truncate: 'end' }] as Slot['policy'][]) {
    const v = evaluateLabel(TEXT, slotOf(n - 0.004, policy), 'de')
    assert.equal(v.kind, 'pass', JSON.stringify(policy))
    assert.equal(v.slack, 0, JSON.stringify(policy))
  }
})

test('slack: shrinkTo that passes by shrinking is the box less the width at the fitted size', () => {
  const box = natural(TEXT) * 0.8
  const v = evaluateLabel(TEXT, slotOf(box, { shrinkTo: 10 }), 'de')
  assert.equal(v.kind, 'pass')
  assert.ok(v.measured.fontPx < 16)
  near(v.slack, box - natural(TEXT, `${v.measured.fontPx}px Inter`), 1e-9)
})

test('slack: lines and truncate end are the box less the widest line', () => {
  const text = 'Alpha beta gamma delta epsilon zeta'
  const box = natural(text) * 0.6
  const widest = measureLineStats(prepareWithSegments(text, FONT), box).maxLineWidth
  for (const policy of [{ lines: 2 }, { truncate: 'end', lines: 2 }] as Slot['policy'][]) {
    const v = evaluateLabel(text, slotOf(box, policy), 'en')
    assert.equal(v.kind, 'pass')
    near(v.slack, box - widest, 1e-9)
  }
  assert.equal(evaluateLabel(text, slotOf(box, { lines: 1 }), 'en').slack, undefined)
  assert.equal(evaluateLabel(text, slotOf(box, { truncate: 'end', lines: 1 }), 'en').slack, undefined)
})

test('slack: under overflowWrap normal a word in the window leaves 0 to spare', () => {
  const word = 'improvements'
  const box = natural(word) - 1 / 128
  for (const policy of [{ lines: 2 }, { truncate: 'end', lines: 2 }] as Slot['policy'][]) {
    const v = evaluateLabel(`${word} add mom now`, slotOf(box, policy, normal), 'en')
    assert.equal(v.kind, 'pass')
    assert.equal(v.slack, 0)
  }
})

test('an empty label has no slack', () => {
  assert.equal(evaluateLabel(' ', slotOf(50, 'as-is'), 'en').slack, undefined)
})

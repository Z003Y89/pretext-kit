import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseFont } from '../../src/headless/shorthand.ts'

test('parses a bare size and family', () => {
  assert.deepEqual(parseFont('16px Inter'), { style: 'normal', weight: 400, stretch: 100, sizePx: 16, families: ['Inter'] })
})

test('parses style, weight, stretch, pt size and a quoted family list', () => {
  assert.deepEqual(parseFont('italic 600 condensed 12pt "Inter Display", Inter, sans-serif'), {
    style: 'italic',
    weight: 600,
    stretch: 75,
    sizePx: 16,
    families: ['Inter Display', 'Inter', 'sans-serif'],
  })
})

test('bold is 700 and line-height is ignored', () => {
  const f = parseFont('bold 16px/24px Inter')
  assert.equal(f.weight, 700)
  assert.equal(f.sizePx, 16)
})

test('maps every stretch keyword to a percentage', () => {
  const expected: Record<string, number> = {
    'ultra-condensed': 50, 'extra-condensed': 62.5, condensed: 75, 'semi-condensed': 87.5, normal: 100,
    'semi-expanded': 112.5, expanded: 125, 'extra-expanded': 150, 'ultra-expanded': 200,
  }
  for (const k of Object.keys(expected)) assert.equal(parseFont(`${k} 10px A`).stretch, expected[k])
})

test('accepts numeric weights, oblique, small-caps and normal placeholders', () => {
  assert.equal(parseFont('1 10px A').weight, 1)
  assert.equal(parseFont('1000 10px A').weight, 1000)
  assert.equal(parseFont('oblique small-caps normal 10px A').style, 'oblique')
  assert.equal(parseFont('normal normal normal 10px A').weight, 400)
})

test('handles single quotes and fractional sizes', () => {
  const f = parseFont("12.5px 'My, Font', serif")
  assert.equal(f.sizePx, 12.5)
  assert.deepEqual(f.families, ['My, Font', 'serif'])
})

test('throws RangeError on a missing size or family', () => {
  assert.throws(() => parseFont('Inter'), RangeError)
  assert.throws(() => parseFont('16px'), RangeError)
  assert.throws(() => parseFont(''), RangeError)
  assert.throws(() => parseFont('1001 10px A'), RangeError)
  assert.throws(() => parseFont('10px A,'), RangeError)
})

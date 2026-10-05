import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fontFromStyle } from '../src/style.ts'

const base = {
  fontStyle: 'normal',
  fontVariant: 'normal',
  fontWeight: '400',
  fontStretch: '100%',
  fontSize: '16px',
  fontFamily: 'Inter',
  letterSpacing: 'normal',
  lineHeight: '24px',
}

test('italic bold with family list, px letter spacing and line height', () => {
  const r = fontFromStyle({
    ...base,
    fontStyle: 'italic',
    fontWeight: '700',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.5px',
  })
  assert.deepEqual(r, { font: 'italic 700 16px Inter, sans-serif', letterSpacing: 0.5, lineHeight: 24 })
})

test('all-normal style keeps the weight and drops the rest', () => {
  assert.deepEqual(fontFromStyle(base), { font: '400 16px Inter', letterSpacing: 0, lineHeight: 24 })
})

test('small-caps is kept, other variants throw', () => {
  assert.equal(fontFromStyle({ ...base, fontVariant: 'small-caps' }).font, 'small-caps 400 16px Inter')
  assert.throws(() => fontFromStyle({ ...base, fontVariant: 'all-small-caps' }), RangeError)
})

test('stretch percentages map to Canvas keywords', () => {
  const cases: Array<[string, string]> = [
    ['75%', 'condensed'],
    ['87.5%', 'semi-condensed'],
    ['112.5%', 'semi-expanded'],
    ['125%', 'expanded'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const [pct, kw] = cases[i]!
    assert.equal(fontFromStyle({ ...base, fontStretch: pct }).font, `400 ${kw} 16px Inter`)
  }
  assert.throws(() => fontFromStyle({ ...base, fontStretch: '90%' }), RangeError)
})

test('style, variant, stretch order follows the shorthand', () => {
  const r = fontFromStyle({ ...base, fontStyle: 'italic', fontVariant: 'small-caps', fontStretch: '75%', fontWeight: '600' })
  assert.equal(r.font, 'italic small-caps 600 condensed 16px Inter')
})

test('line-height normal throws and says to set a numeric one', () => {
  assert.throws(() => fontFromStyle({ ...base, lineHeight: 'normal' }), (e: unknown) => {
    return e instanceof RangeError && /numeric line-height/.test(e.message)
  })
})

test('non-px sizes and spacings throw', () => {
  assert.throws(() => fontFromStyle({ ...base, fontSize: '1rem' }), RangeError)
  assert.throws(() => fontFromStyle({ ...base, letterSpacing: '0.1em' }), RangeError)
  assert.throws(() => fontFromStyle({ ...base, lineHeight: '1.5' }), RangeError)
})

test('negative letter spacing parses', () => {
  assert.equal(fontFromStyle({ ...base, letterSpacing: '-0.25px' }).letterSpacing, -0.25)
})

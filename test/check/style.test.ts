import assert from 'node:assert/strict'
import { test } from 'node:test'
import { slotFromStyle } from '../../src/check/style.ts'

const style = {
  fontStyle: 'normal',
  fontVariant: 'normal',
  fontWeight: '600',
  fontStretch: '100%',
  fontSize: '15px',
  fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.5px',
  lineHeight: '20px',
  fontVariantNumeric: 'normal',
  textTransform: 'none',
  whiteSpace: 'normal',
}

test('a computed style becomes a slot', () => {
  assert.deepEqual(slotFromStyle(style, { width: 160 }, 'as-is'), {
    width: 160,
    font: '600 15px Inter, sans-serif',
    letterSpacing: 0.5,
    lineHeight: 20,
    whiteSpace: 'normal',
    numeric: 'proportional',
    textTransform: 'none',
    policy: 'as-is',
  })
})

test('uppercase, tabular-nums, pre-wrap, reserve and uses are carried', () => {
  const slot = slotFromStyle(
    { ...style, textTransform: 'uppercase', fontVariantNumeric: 'lining-nums tabular-nums', whiteSpace: 'pre-wrap' },
    { width: 90 },
    { lines: 2 },
    { reserve: 18, uses: ['tab.*'] },
  )
  assert.equal(slot.textTransform, 'uppercase')
  assert.equal(slot.numeric, 'tabular')
  assert.equal(slot.whiteSpace, 'pre-wrap')
  assert.equal(slot.reserve, 18)
  assert.deepEqual(slot.uses, ['tab.*'])
  assert.deepEqual(slot.policy, { lines: 2 })
})

test('other white-space values and text-transform keywords the checker lacks fall back to normal and none', () => {
  const slot = slotFromStyle({ ...style, whiteSpace: 'nowrap', textTransform: 'full-width' }, { width: 50 }, 'as-is')
  assert.equal(slot.whiteSpace, 'normal')
  assert.equal(slot.textTransform, 'none')
})

test('a style the kit cannot turn into a font throws as fontFromStyle does', () => {
  assert.throws(() => slotFromStyle({ ...style, lineHeight: 'normal' }, { width: 50 }, 'as-is'), RangeError)
})

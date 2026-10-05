import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'

test('stand-in widths reach Pretext', () => {
  const p = prepareWithSegments('aa bb', '20px Test')
  assert.equal(measureNaturalWidth(p), 45)
})

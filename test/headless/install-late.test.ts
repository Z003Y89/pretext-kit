// A process of its own: Pretext prepares before install(), which fixes its engine profile.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepare } from '@chenglou/pretext'
import { install } from '../../src/headless/index.ts'

test('install() after Pretext already looked for a canvas throws, saying to call it first', () => {
  // Without a canvas Pretext throws, but only after caching an engine profile from Node's user agent.
  assert.throws(() => prepare('Speichern', '16px Inter'))
  assert.throws(() => install(), /before/)
})

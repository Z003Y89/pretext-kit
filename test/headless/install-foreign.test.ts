// A process of its own: it sets a foreign OffscreenCanvas before install().
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install } from '../../src/headless/index.ts'

test('install() throws when another OffscreenCanvas is already set', () => {
  class Foreign {}
  Reflect.set(globalThis, 'OffscreenCanvas', Foreign)
  assert.throws(() => install(), /OffscreenCanvas/)
  assert.equal(Reflect.get(globalThis, 'OffscreenCanvas'), Foreign)
})

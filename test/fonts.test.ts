import { standIn } from './setup.ts'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { prepareWithSegments, measureLineStats } from '@chenglou/pretext'
import { watchFonts } from '../src/fonts.ts'

afterEach(() => {
  standIn.scale = 1
})

function standInFonts(): { fonts: FontFaceSet; fire: (faces: unknown[]) => void } {
  const target = new EventTarget()
  return {
    fonts: target as unknown as FontFaceSet,
    fire: (faces) => target.dispatchEvent(Object.assign(new Event('loadingdone'), { fontfaces: faces })),
  }
}

test('onChange runs once per event with faces', () => {
  const { fonts, fire } = standInFonts()
  let calls = 0
  watchFonts(() => calls++, fonts)
  fire([{}])
  assert.equal(calls, 1)
  fire([{}, {}])
  assert.equal(calls, 2)
})

test('an event with no faces is ignored', () => {
  const { fonts, fire } = standInFonts()
  let calls = 0
  watchFonts(() => calls++, fonts)
  fire([])
  assert.equal(calls, 0)
})

test('nothing runs after unsubscribe', () => {
  const { fonts, fire } = standInFonts()
  let calls = 0
  const stop = watchFonts(() => calls++, fonts)
  stop()
  fire([{}])
  assert.equal(calls, 0)
})

test('the width cache is cleared before onChange', () => {
  const { fonts, fire } = standInFonts()
  const font = '20px Cleared'
  const width = () => measureLineStats(prepareWithSegments('aaaa', font), 1000).maxLineWidth
  assert.equal(width(), 40)
  standIn.scale = 2
  assert.equal(width(), 40) // stale: Pretext still holds the old measurement
  let seen = 0
  watchFonts(() => (seen = width()), fonts)
  fire([{}])
  assert.equal(seen, 80)
})

test('with no fonts and no document it returns a no-op', () => {
  const stop = watchFonts(() => assert.fail('must not run'))
  assert.equal(typeof stop, 'function')
  stop()
})

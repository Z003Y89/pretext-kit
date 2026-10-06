import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseFeatureSettings } from '../../src/headless/fonts.ts'
import { install, registerFont } from '../../src/headless/index.ts'
import { sharedState } from '../../src/headless/shared.ts'

const inter = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url)))
await registerFont('Inter', inter)
await registerFont('Inter TNUM', inter, { featureSettings: '"tnum" 1' })
await registerFont('Inter Bare', inter, { featureSettings: '"tnum"' })
await registerFont('Inter Normal', inter, { featureSettings: 'normal' })
install()
const ctx = new OffscreenCanvas(1, 1).getContext('2d')!

function width(family: string, text: string): number {
  ctx.font = `16px "${family}"`
  return ctx.measureText(text).width
}

test('tnum makes digits equally wide', () => {
  assert.equal(width('Inter TNUM', '1111'), width('Inter TNUM', '0000'))
  assert.notEqual(width('Inter TNUM', '1111'), width('Inter', '1111'))
})

test('a bare tag means 1', () => {
  assert.equal(width('Inter Bare', '1111'), width('Inter TNUM', '1111'))
})

test('normal measures like no option', () => {
  assert.equal(width('Inter Normal', '1111'), width('Inter', '1111'))
})

test('invalid syntax throws', async () => {
  await assert.rejects(registerFont('Bad', inter, { featureSettings: 'tnum' }), RangeError)
  assert.throws(() => parseFeatureSettings('"tnum" x'), RangeError)
  assert.deepEqual(parseFeatureSettings('"tnum" 1, "ss01", "liga" off'), [
    { tag: 'tnum', value: 1 },
    { tag: 'ss01', value: 1 },
    { tag: 'liga', value: 0 },
  ])
})

test('a face registered by an older copy without a features field still measures', async () => {
  await registerFont('Inter Old', inter)
  const face = sharedState().faces.find((f) => f.family === 'Inter Old')!
  delete (face as { features?: unknown }).features
  assert.equal(width('Inter Old', '1111'), width('Inter', '1111'))
})

test('single-quoted tags are valid CSS', () => {
  assert.deepEqual(parseFeatureSettings("'tnum' 1, \"ss01\", 'liga' off"), [
    { tag: 'tnum', value: 1 },
    { tag: 'ss01', value: 1 },
    { tag: 'liga', value: 0 },
  ])
  assert.throws(() => parseFeatureSettings(`'tnum" 1`), RangeError)
})

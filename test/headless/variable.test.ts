// Advances of a variable font away from its default instance. The expected widths are Chromium
// 149.0.7827.55 (Playwright chromium-1228, headed) on macOS 14, OffscreenCanvas measureText, with
// @fontsource-variable/inter 5.3.0's inter-latin-wght-normal.woff2 as `font-weight: 100 900`.
// HarfBuzz alone rounds each HVAR advance delta to a whole font unit (the space at wght 500 is
// 546/2048 em); Chrome on macOS keeps the fraction (545.7613/2048 em).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { install, registerFont } from '../../src/headless/index.ts'

const file = new URL('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url)
await registerFont('Inter Variable', new Uint8Array(readFileSync(file)))
install()
const ctx = new OffscreenCanvas(1, 1).getContext('2d')!

function width(font: string, text: string): number {
  ctx.font = font
  return ctx.measureText(text).width
}

// [font, text, Chromium's width]
const chromium: [string, string, number][] = [
  ['500 16px "Inter Variable"', ' ', 4.2637481689453125],
  ['500 16px "Inter Variable"', 'a', 9.085617065429688],
  ['700 16px "Inter Variable"', 'W', 16.60089111328125],
  ['300 16px "Inter Variable"', 'a', 8.791671752929688],
  // The normalized coordinate: Chrome (CoreText) gets 16344 at 899 and -54 at 399 where
  // HarfBuzz's own normalization gets 16345 and -55.
  ['899 16px "Inter Variable"', 'n', 10.388336181640625],
  ['399 16px "Inter Variable"', 'm', 14.015106201171875],
  ['401 1000px "Inter Variable"', ' ', 281.10479736328125],
  ['500 1000px "Inter Variable"', ' ', 266.4849853515625],
  // Whole words, kerned: GPOS deltas come from HarfBuzz as in Chrome.
  ['500 1000px "Inter Variable"', 'abonnieren', 5388.2294921875],
  ['500 1000px "Inter Variable"', 'AV', 1345.7994384765625],
  ['700 1000px "Inter Variable"', 'To', 1202.85009765625],
  ['300 1000px "Inter Variable"', 'AV', 1277.996826171875],
]

for (const [font, text, expected] of chromium) {
  test(`${font} ${JSON.stringify(text)} measures ${expected} as in Chromium`, () => {
    assert.equal(width(font, text), expected)
  })
}

test('the default instance (wght 400) and the axis ends keep whole-unit advances', () => {
  assert.equal(width('400 1000px "Inter Variable"', ' '), 281.25)
  assert.equal(width('100 1000px "Inter Variable"', 'AV'), 1210.9375)
  assert.equal(width('900 1000px "Inter Variable"', 'abonnieren'), 5726.5625)
})

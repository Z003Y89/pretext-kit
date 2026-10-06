// Fractional font sizes on the 'linux' profile, against Chromium 141.0.7390.37 on Linux (Playwright 1.61.0,
// OffscreenCanvas measureText, Inter Regular from test/fonts by @font-face, each size measured first in a fresh page).
// The model (canvas.ts sizedFor) is exact for the first use of a size in a document. Later in the same document
// Chromium can reuse the glyph metrics of a nearby fractional size measured before, which the stand-in does not
// model; nothing here measures Chromium in that order. 'macos' measures at the size asked for; 'windows' is pinned in
// fractional-size-windows.test.ts.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { install, registerFont } from '../../src/headless/index.ts'

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))

const width = (size: number, text: string): number => {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = `${size}px Inter`
  return ctx.measureText(text).width
}

// 'APERÇU': on-grid, quarter-pixel, hundredth and the label checker sweep's sizes (16 and 13px, and the shrinkTo
// minima 12 and 9px, at text scales 1/1.15/1.3 by zoom 1/1.3); every value confirmed alone in a fresh page.
const APERCU: [number, number][] = [
  [9, 36.4306640625],
  [10.11, 40.858001708984375],
  [10.15, 40.9844970703125],
  [10.35, 41.869964599609375],
  [10.390625, 41.9964599609375],
  [10.875, 43.9571533203125],
  [11.1, 44.905853271484375],
  [11.700000000000001, 47.30926513671875],
  [12, 48.57421875],
  [12.3, 49.77593994140625],
  [12.5, 50.59814453125],
  [12.625, 51.0408935546875],
  [13, 52.6220703125],
  [13.454999999999998, 54.39300537109375],
  [13.455, 54.39300537109375],
  [13.799999999999999, 55.84771728515625],
  [14.2, 57.42889404296875],
  [14.375, 58.1246337890625],
  [14.95, 60.46478271484375],
  [15.21, 61.540008544921875],
  [15.600000000000001, 63.121185302734375],
  [15.75, 63.753662109375],
  [16, 64.765625],
  [16.01, 64.765625],
  [16.015625, 64.765625],
  [16.05, 64.89212036132812],
  [16.125, 65.2083740234375],
  [16.25, 65.777587890625],
  [16.890625, 68.3074951171875],
  [16.9, 68.37075805664062],
  [16.900000000000002, 68.37075805664062],
  [16.984375, 68.68698120117188],
  [17.13, 69.2562255859375],
  [17.939999999999998, 72.60833740234375],
  [18.4, 74.44253540039062],
  [19.435, 78.61688232421875],
  [19.88, 80.3878173828125],
  [20.28, 82.03225708007812],
  [20.796875, 84.11941528320312],
  [20.8, 84.18267822265625],
  [21.7, 87.78778076171875],
  [21.970000000000002, 88.92623901367188],
  [23.919999999999998, 96.76895141601562],
  [25.35, 102.58773803710938],
  [27.040000000000003, 109.41848754882812],
  [29.99, 121.372314453125],
  [31.5, 127.50732421875],
]

// 'Hamburgefonstiv 0123456789' kerns, so it also pins the size GPOS is scaled by.
const KERNED: [number, number][] = [
  [10.015625, 143.27088928222656],
  [10.390625, 148.6432647705078],
  [13.455, 192.52029418945312],
  [16.125, 230.8008575439453],
  [16.9, 241.9940185546875],
  [18.4, 263.4847412109375],
  [20.8, 297.9598388671875],
]

// More sizes, each measured alone in a fresh page: 'APERÇU', then the kerned string. Among them the sizes an earlier
// probe, which measured many sizes in one document, had recorded as misses.
const FIRST_USE: [number, number, number][] = [
  [10.15625, 41.047760009765625, 145.2857666015625],
  [16.21875, 65.58786010742188, 232.14425659179688],
  [16.46875, 66.59982299804688, 235.72604370117188],
  [17.21875, 69.63571166992188, 246.47140502929688],
  [20.46875, 82.79122924804688, 293.0346374511719],
  [16.052, 64.95538330078125, 229.90586853027344],
  [10.1546875, 41.047760009765625, 145.2857666015625],
  [18.7, 75.64422607421875, 267.7378234863281],
  [18.72, 75.70748901367188, 267.9621276855469],
  [19.21875, 77.73141479492188, 275.1257019042969],
  [11.37, 45.9810791015625, 162.7469024658203],
  [12.83, 51.926361083984375, 183.79042053222656],
  [14.06, 56.85968017578125, 201.25096130371094],
  [22.41, 90.69717407226562, 321.0174560546875],
  [24.88, 100.6903076171875, 356.38751220703125],
  [28.13, 113.8458251953125, 402.95074462890625],
  [30.5, 123.45947265625, 436.97802734375],
  [33.33, 134.90731811523438, 477.4969482421875],
  [40.17, 162.54653930664062, 575.3243408203125],
  [45.9, 185.75845336914062, 657.4813232421875],
  [9.7, 39.21356201171875, 138.79348754882812],
  [16.0546875, 64.95538330078125, 229.90586853027344],
  [17.4609375, 70.64767456054688, 250.05319213867188],
]

test('the linux profile measures fractional sizes as Chromium on Linux does', () => {
  install({ platform: 'linux' })
  for (const [size, expected] of APERCU) assert.equal(width(size, 'APERÇU'), expected, `APERÇU at ${size}px`)
  for (const [size, expected] of KERNED) assert.equal(width(size, 'Hamburgefonstiv 0123456789'), expected, `kerned at ${size}px`)
})

test('the linux profile is exact for the first use of a size in a document', () => {
  install({ platform: 'linux' })
  for (const [size, apercu, kerned] of FIRST_USE) {
    assert.equal(width(size, 'APERÇU'), apercu, `APERÇU at ${size}px`)
    assert.equal(width(size, 'Hamburgefonstiv 0123456789'), kerned, `kerned at ${size}px`)
  }
})

test('ctx.font still reads back the size asked for', () => {
  install({ platform: 'linux' })
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = '16.9px Inter'
  assert.equal(ctx.font, '16.9px Inter')
})

test('the macos profile measures at the size asked for', () => {
  install({ platform: 'macos' })
  assert.equal(width(16.900000000000002, 'A'), 11.660003662109375)
  assert.equal(width(16.900000000000002, 'APERÇU'), 68.40867614746094)
  assert.notEqual(width(16.9, 'A'), width(16.890625, 'A'))
})

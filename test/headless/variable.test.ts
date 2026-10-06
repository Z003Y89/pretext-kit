// Advances of a variable font away from its default instance. The expected widths are Chromium
// 149.0.7827.55 (Playwright chromium-1228, headed) on macOS 14, OffscreenCanvas measureText, with
// @fontsource-variable/inter 5.3.0's inter-latin-wght-normal.woff2 as `font-weight: 100 900`.
// HarfBuzz alone rounds each HVAR advance delta to a whole font unit (the space at wght 500 is
// 546/2048 em); Chrome on macOS keeps the fraction (545.7613/2048 em).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Blob, Buffer, Face, Font, Variation, shape } from 'harfbuzzjs'
import { decompress } from 'wawoff2'
import { install, registerFont } from '../../src/headless/index.ts'

const file = new URL('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url)
await registerFont('Inter Variable', new Uint8Array(readFileSync(file)))

// Copies of the font with HVAR broken in one way each, in memory.
const sfnt = new Uint8Array(await decompress(readFileSync(file)))
function hvarAt(font: Uint8Array): number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  for (let i = 0; i < view.getUint16(4, false); i++) {
    const record = 12 + 16 * i
    if (String.fromCharCode(...font.subarray(record, record + 4)) === 'HVAR') return view.getUint32(record + 8, false)
  }
  throw new Error('no HVAR')
}
const malformed: [string, (view: DataView, hvar: number) => void][] = [
  ['an ItemVariationStore offset past the table', (view, hvar) => view.setUint32(hvar + 4, 0xffffff00, false)],
  ['an ItemVariationStore of format 2', (view, hvar) => view.setUint16(hvar + view.getUint32(hvar + 4, false), 2, false)],
  ['a region list with the wrong axis count', (view, hvar) => {
    const store = hvar + view.getUint32(hvar + 4, false)
    view.setUint16(store + view.getUint32(store + 2, false), 3, false)
  }],
  ['a VarData with more word deltas than regions', (view, hvar) => {
    const store = hvar + view.getUint32(hvar + 4, false)
    view.setUint16(store + view.getUint32(store + 8, false) + 2, 0x7fff, false)
  }],
  ['a VarData with more rows than the table holds', (view, hvar) => {
    const store = hvar + view.getUint32(hvar + 4, false)
    view.setUint16(store + view.getUint32(store + 8, false), 0xffff, false)
  }],
  ['an advance map past the table', (view, hvar) => view.setUint32(hvar + 8, 0xffffff00, false)],
]
const broken: [string, Uint8Array][] = []
for (const [what, breakIt] of malformed) {
  const copy = sfnt.slice()
  breakIt(new DataView(copy.buffer), hvarAt(copy))
  broken.push([what, copy])
  await registerFont(`Broken ${broken.length}`, copy)
}
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

// HarfBuzz's own width of a word: its advances, summed in 1/65536 px.
function harfBuzzWidth(font: Uint8Array, weight: number, sizePx: number, text: string): number {
  const hb = new Font(new Face(new Blob(font), 0))
  const scale = Math.round(sizePx * 65536)
  hb.setScale(scale, scale)
  hb.setVariations([new Variation('wght', weight)])
  const buffer = new Buffer()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  shape(hb, buffer)
  let sum = 0
  for (const position of buffer.getGlyphPositions()) sum += position.xAdvance
  return Math.fround(sum / 65536)
}

test('a malformed HVAR measures with HarfBuzz\'s own advances rather than throw', () => {
  for (let i = 0; i < broken.length; i++) {
    const [what, font] = broken[i]!
    for (const weight of [400, 700]) {
      const measured = width(`${weight} 16px "Broken ${i + 1}"`, 'abonnieren')
      assert.equal(measured, harfBuzzWidth(font, weight, 16, 'abonnieren'), `${what} at wght ${weight}`)
    }
  }
  // At 700 that is HarfBuzz's whole-unit rounding, not the unrounded width of the intact font.
  assert.notEqual(width('700 16px "Broken 1"', 'abonnieren'), width('700 16px "Inter Variable"', 'abonnieren'))
})

// Chromium 149.0.7827.55 on Linux (ubuntu-latest) and Windows (windows-latest), CI run 37410732972,
// sentence widths from verify:headless (same file as "HX Inter Variable"): HarfBuzz's whole-unit
// HVAR rounding, where macOS keeps the fraction.
const chromiumLinuxWindows: [string, string, number][] = [
  ['500 16px "Inter Variable"', 'Zahlungspflichtig abonnieren', 223.5359344482422],
  ['500 20px "Inter Variable"', 'Zahlungspflichtig abonnieren', 279.419921875],
  ['700 20px "Inter Variable"', 'Zahlungspflichtig abonnieren', 287.986328125],
  ['500 14px "Inter Variable"', '„Zahlungspflichtig abonnieren“', 207.8986358642578],
]

for (const platform of ['linux', 'windows'] as const) {
  test(`platform '${platform}' measures a varied instance with HarfBuzz's whole-unit advances`, () => {
    install({ platform })
    try {
      // The space at wght 500 is 546/2048 em, not 545.7613/2048 em.
      assert.equal(width('500 16px "Inter Variable"', ' '), 4.265625)
      assert.equal(width('500 16px "Inter Variable"', 'a'), 9.0859375)
      assert.equal(width('700 16px "Inter Variable"', 'W'), 16.6015625)
      assert.equal(width('300 16px "Inter Variable"', 'a'), 8.7890625)
      assert.equal(width('500 1000px "Inter Variable"', 'abonnieren'), 5388.96484375)
      assert.equal(width('500 1000px "Inter Variable"', 'AV'), 1346.0938720703125)
      assert.equal(width('700 1000px "Inter Variable"', 'To'), 1202.63671875)
      for (const weight of [300, 500, 700]) {
        assert.equal(width(`${weight} 16px "Inter Variable"`, 'abonnieren'), harfBuzzWidth(sfnt, weight, 16, 'abonnieren'), `wght ${weight}`)
      }
      for (const [font, text, expected] of chromiumLinuxWindows) assert.equal(width(font, text), expected, `${font} ${text}`)
      // The default instance and the axis ends are the same on every platform.
      assert.equal(width('400 1000px "Inter Variable"', ' '), 281.25)
      assert.equal(width('100 1000px "Inter Variable"', 'AV'), 1210.9375)
      assert.equal(width('900 1000px "Inter Variable"', 'abonnieren'), 5726.5625)
    } finally {
      install()
    }
  })
}

test("platform 'macos' is the default, and a later install() switches back and forth", () => {
  install({ platform: 'macos' })
  assert.equal(width('500 16px "Inter Variable"', ' '), 4.2637481689453125)
  install({ platform: 'linux' })
  assert.equal(width('500 16px "Inter Variable"', ' '), 4.265625)
  // install() without a platform resets it to 'macos', as with the other options.
  install()
  assert.equal(width('500 16px "Inter Variable"', ' '), 4.2637481689453125)
  for (const [font, text, expected] of chromiumLinuxWindows) assert.notEqual(width(font, text), expected, `${font} ${text}`)
})

test("platform is independent of rounding 'whole-px'", () => {
  install({ platform: 'linux', rounding: 'whole-px' })
  try {
    // 16.6015625 rounds to 17 either way; at 1000px the whole-px advances differ by platform.
    assert.equal(width('700 16px "Inter Variable"', 'W'), 17)
    const linux = width('500 1000px "Inter Variable"', ' ')
    install({ platform: 'macos', rounding: 'whole-px' })
    assert.equal(linux, 267)
    assert.equal(width('500 1000px "Inter Variable"', ' '), 266)
  } finally {
    install()
  }
})

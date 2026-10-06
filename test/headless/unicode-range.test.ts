// A family split into several files by unicode-range, as @fontsource-variable/inter 5.3.0 ships Inter
// Variable (its wght.css: one @font-face per subset, each `font-weight: 100 900` with a unicode-range).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { HeadlessCoverageError, install, registerFont } from '../../src/headless/index.ts'

const subset = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../node_modules/@fontsource-variable/inter/files/inter-${name}-wght-normal.woff2`, import.meta.url)))
// From that package's wght.css, in its order (latin-ext before latin).
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

await registerFont('Split', subset('latin-ext'), { unicodeRange: LATIN_EXT })
await registerFont('Split', subset('latin'), { unicodeRange: LATIN })
await registerFont('Latin only', subset('latin'))
await registerFont('Latin-ext only', subset('latin-ext'))
// Overlapping ranges with files whose widths tell them apart: Inter Regular, then Roboto over A-Z.
const inter = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url)))
const roboto = new Uint8Array(readFileSync(new URL('../fonts/Roboto-Regular.ttf', import.meta.url)))
await registerFont('Overlap', inter, { unicodeRange: 'U+0000-00FF' })
await registerFont('Overlap', roboto, { unicodeRange: 'U+0041-005A' })
await registerFont('Inter only', inter)
await registerFont('Roboto only', roboto)
install()
const ctx = new OffscreenCanvas(1, 1).getContext('2d')!

function width(font: string, text: string): number {
  ctx.font = font
  return ctx.measureText(text).width
}

test('each code point is drawn by the file whose range has it', () => {
  // Basic Latin from the latin file, Ł and ż from the latin-ext file, at a non-default weight too.
  for (const weight of [400, 500]) {
    assert.equal(width(`${weight} 16px Split`, 'Zahlung'), width(`${weight} 16px "Latin only"`, 'Zahlung'))
    assert.equal(width(`${weight} 16px Split`, 'Łż'), width(`${weight} 16px "Latin-ext only"`, 'Łż'))
  }
})

test('where ranges overlap, the file registered last draws the code point', () => {
  // A-Z are in both ranges: Roboto, registered last, draws them; the rest of Basic Latin is Inter's.
  assert.notEqual(width('16px "Inter only"', 'H'), width('16px "Roboto only"', 'H'))
  assert.equal(width('16px Overlap', 'HAMBURG'), width('16px "Roboto only"', 'HAMBURG'))
  assert.equal(width('16px Overlap', 'hamburg'), width('16px "Inter only"', 'hamburg'))
})

test('a word mixing the files is shaped in runs of one file each', () => {
  const mixed = width('16px Split', 'aŁa')
  const runs = width('16px "Latin only"', 'a') + width('16px "Latin-ext only"', 'Ł') + width('16px "Latin only"', 'a')
  assert.equal(mixed, Math.fround(runs))
})

test('a code point in no file\'s range still throws, though a cmap has it', () => {
  // The latin-ext file's cmap has U+0041, but its range does not, and U+0400 is in neither.
  assert.throws(() => width('16px "Split"', 'Ѐ'), HeadlessCoverageError)
})

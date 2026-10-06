import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, test } from 'node:test'
import { Font } from 'harfbuzzjs'
import { decompress } from 'wawoff2'
import { clearFonts, findFace, findFaces, parseUnicodeRange, registerFont } from '../../src/headless/fonts.ts'

const ttf = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url)))
const woff2 = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.woff2', import.meta.url)))
const roboto = new Uint8Array(readFileSync(new URL('../fonts/Roboto-Regular.ttf', import.meta.url)))

// No WOFF1 fixture is committed, so one is built from the TTF's own tables (every table deflated).
function ttfToWoff(sfnt: Uint8Array): Uint8Array {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  const n = view.getUint16(4, false)
  const tables: Uint8Array[] = []
  let size = 44 + 20 * n
  for (let i = 0; i < n; i++) {
    const rec = 12 + 16 * i
    const off = view.getUint32(rec + 8, false)
    const len = view.getUint32(rec + 12, false)
    const z = new Uint8Array(deflateSync(sfnt.subarray(off, off + len)))
    tables.push(z)
    size += (z.length + 3) & ~3
  }
  const out = new Uint8Array(size)
  const ov = new DataView(out.buffer)
  out.set([0x77, 0x4f, 0x46, 0x46], 0)
  ov.setUint32(4, view.getUint32(0, false), false)
  ov.setUint32(8, size, false)
  ov.setUint16(12, n, false)
  let cursor = 44 + 20 * n
  for (let i = 0; i < n; i++) {
    const rec = 12 + 16 * i
    const e = 44 + 20 * i
    out.set(sfnt.subarray(rec, rec + 4), e)
    ov.setUint32(e + 4, cursor, false)
    ov.setUint32(e + 8, tables[i]!.length, false)
    ov.setUint32(e + 12, view.getUint32(rec + 12, false), false)
    ov.setUint32(e + 16, view.getUint32(rec + 4, false), false)
    out.set(tables[i]!, cursor)
    cursor += (tables[i]!.length + 3) & ~3
  }
  return out
}

function advanceOfA(family: string): number {
  const face = findFace(family, 400, 'normal')
  assert.ok(face !== undefined)
  const font = new Font(face.face)
  const glyph = font.nominalGlyph('A'.codePointAt(0)!)
  assert.ok(glyph !== undefined)
  return font.glyphHAdvance(glyph)
}

describe('font registry', () => {
  afterEach(() => clearFonts())

  test('TTF and WOFF2 give the same advance for A at upem', async () => {
    await registerFont('InterTtf', ttf)
    await registerFont('InterWoff2', woff2)
    const a = advanceOfA('InterTtf')
    assert.ok(a > 0)
    assert.equal(advanceOfA('InterWoff2'), a)
    assert.equal(findFace('InterWoff2', 400, 'normal')?.upem, findFace('InterTtf', 400, 'normal')?.upem)
  })

  test('WOFF1 gives the same advance as the TTF', async () => {
    await registerFont('InterTtf', ttf)
    await registerFont('InterWoff', ttfToWoff(ttf))
    assert.equal(advanceOfA('InterWoff'), advanceOfA('InterTtf'))
  })

  test('reads metadata from the font when not given', async () => {
    await registerFont('Inter', ttf)
    const face = findFace('inter', 400, 'normal')
    assert.equal(face?.family, 'Inter')
    assert.deepEqual([face?.weightMin, face?.weightMax], [400, 400])
    assert.equal(face?.style, 'normal')
    assert.deepEqual(face?.axes, [])
  })

  test('weight 650 picks 700 and 450 picks 400 when both are registered', async () => {
    await registerFont('Inter', ttf, { weight: 400 })
    await registerFont('Inter', ttf, { weight: 700 })
    assert.equal(findFace('Inter', 650, 'normal')?.weightMin, 700)
    assert.equal(findFace('Inter', 450, 'normal')?.weightMin, 400)
    assert.equal(findFace('Inter', 700, 'normal')?.weightMin, 700)
  })

  test('weights below 400 go lighter first, above 500 heavier first', async () => {
    await registerFont('F', ttf, { weight: 300 })
    await registerFont('F', ttf, { weight: 500 })
    await registerFont('F', ttf, { weight: 900 })
    assert.equal(findFace('F', 200, 'normal')?.weightMin, 300)
    assert.equal(findFace('F', 400, 'normal')?.weightMin, 500)
    assert.equal(findFace('F', 600, 'normal')?.weightMin, 900)
    assert.equal(findFace('F', 350, 'normal')?.weightMin, 300)
  })

  test('a weight range matches any weight inside it', async () => {
    await registerFont('V', ttf, { weight: [300, 800] })
    assert.equal(findFace('V', 650, 'normal')?.weightMax, 800)
    assert.equal(findFace('V', 900, 'normal')?.weightMax, 800)
  })

  test('style is matched, falling back to the other style', async () => {
    await registerFont('S', ttf, { style: 'italic' })
    assert.equal(findFace('S', 400, 'italic')?.style, 'italic')
    assert.equal(findFace('S', 400, 'normal')?.style, 'italic')
  })

  test('unknown family returns undefined', () => {
    assert.equal(findFace('Nope', 400, 'normal'), undefined)
  })

  test('registering the same family, weight and style twice throws', async () => {
    await registerFont('Inter', ttf)
    await assert.rejects(registerFont('inter', ttf), /already registered/)
  })

  test('two files of one family, weight and style register when each has a unicodeRange', async () => {
    await registerFont('Split', ttf, { unicodeRange: 'U+0000-00FF' })
    await registerFont('Split', roboto, { unicodeRange: 'U+0100-024F, U+0041' })
    const faces = findFaces('Split', 400, 'normal')
    // The last registered first, as CSS checks the last-defined @font-face rule first.
    assert.deepEqual(faces.map(face => face.unicodeRange), [[[0x41, 0x41], [0x100, 0x24f]], [[0, 0xff]]])
    assert.equal(findFace('Split', 400, 'normal'), faces[0])
  })

  test('two files whose cmaps overlap need a unicodeRange each', async () => {
    await registerFont('Split', ttf, { unicodeRange: 'U+0000-00FF' })
    await assert.rejects(registerFont('Split', roboto), /already registered, and both files have U\+0000.*unicode-range/)
    await assert.rejects(registerFont('Split', roboto, { weight: 400, style: 'normal' }), /already registered/)
  })

  test('a ranged file beside an unranged one is checked within its range only', async () => {
    // Fontsource's latin-ext subset of Inter Variable also maps 5 Basic Latin code points (U+0041 among
    // them), which its unicode-range leaves out; the latin subset has them too. Within the range the
    // files are disjoint, so CSS draws each code point from one of them: accepted in either order.
    const subset = async (name: string) =>
      new Uint8Array(await decompress(readFileSync(new URL(`../../node_modules/@fontsource-variable/inter/files/inter-${name}-wght-normal.woff2`, import.meta.url))))
    const latin = await subset('latin')
    const latinExt = await subset('latin-ext')
    const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
    await registerFont('Split', latin)
    await registerFont('Split', latinExt, { unicodeRange: LATIN_EXT })
    clearFonts()
    await registerFont('Split', latinExt, { unicodeRange: LATIN_EXT })
    await registerFont('Split', latin)
    assert.equal(findFaces('Split', 400, 'normal').length, 2)
    // A range that takes in those shared code points is still an overlap, in either order.
    clearFonts()
    await registerFont('Split', latin)
    await assert.rejects(registerFont('Split', latinExt, { unicodeRange: 'U+0000-024F' }), /both files have U\+00/)
    clearFonts()
    await registerFont('Split', latinExt, { unicodeRange: 'U+0000-024F' })
    await assert.rejects(registerFont('Split', latin), /both files have U\+00/)
  })

  test('the same file with the same unicodeRange twice is a duplicate', async () => {
    await registerFont('Split', ttf, { unicodeRange: 'U+0000-00FF' })
    await assert.rejects(registerFont('split', ttf, { unicodeRange: 'u+0000-00ff' }), /already registered with this file and unicode-range/)
    // The same file under another range is a split, as is another file under the same range.
    await registerFont('Split', ttf, { unicodeRange: 'U+0100-024F' })
    await registerFont('Split', roboto, { unicodeRange: 'U+0000-00FF' })
    assert.equal(findFaces('Split', 400, 'normal').length, 3)
  })

  test('parseUnicodeRange reads single code points, ranges and wildcards, and rejects the rest', () => {
    assert.deepEqual(parseUnicodeRange('U+0131, u+0000-00ff,U+4??'), [[0, 0xff], [0x131, 0x131], [0x400, 0x4ff]])
    // An end past U+10FFFF is clamped to it, as in CSS; a start past it is invalid.
    assert.deepEqual(parseUnicodeRange('U+10FF00-1FFFFF'), [[0x10ff00, 0x10ffff]])
    assert.deepEqual(parseUnicodeRange('U+??????'), [[0, 0x10ffff]])
    assert.deepEqual(parseUnicodeRange('U+1?????'), [[0x100000, 0x10ffff]])
    for (const bad of ['U+00FF-0000', 'U+11FFFF', 'U+110000-120000', '0041', 'U+0?1', 'U+4??-4FF', '']) {
      assert.throws(() => parseUnicodeRange(bad), RangeError, bad)
    }
  })

  test('rejects data that is not a font', async () => {
    await assert.rejects(registerFont('Bad', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /not a recognised font/)
  })
})

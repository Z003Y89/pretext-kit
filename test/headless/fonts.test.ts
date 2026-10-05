import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, test } from 'node:test'
import { Font } from 'harfbuzzjs'
import { clearFonts, findFace, registerFont } from '../../src/headless/fonts.ts'

const ttf = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url)))
const woff2 = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.woff2', import.meta.url)))

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

  test('rejects data that is not a font', async () => {
    await assert.rejects(registerFont('Bad', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /not a recognised font/)
  })
})

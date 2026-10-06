// hvar.ts on Inter Variable (@fontsource-variable/inter 5.3.0, latin) and on copies of it with one
// table edited in memory.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decompress } from 'wawoff2'
import { normalizedCoords, readAdvanceVariations, readAxisNormalization, type AxisNormalization } from '../../src/headless/hvar.ts'

const file = new URL('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url)
const sfnt = new Uint8Array(await decompress(readFileSync(file)))

function tableAt(font: Uint8Array, tag: string): number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  for (let i = 0; i < view.getUint16(4, false); i++) {
    const record = 12 + 16 * i
    if (String.fromCharCode(...font.subarray(record, record + 4)) === tag) return view.getUint32(record + 8, false)
  }
  throw new Error(`no ${tag}`)
}

const wght = (value: number) => new Map([['wght', value]])

test('a DeltaSetIndexMap with no entries maps glyph g to (0, g), as in HarfBuzz', () => {
  assert.notEqual(readAdvanceVariations(sfnt, 0, 1)?.map, null)
  const copy = sfnt.slice()
  const view = new DataView(copy.buffer)
  const hvar = tableAt(copy, 'HVAR')
  const map = hvar + view.getUint32(hvar + 8, false)
  if (view.getUint8(map) === 0) view.setUint16(map + 2, 0, false)
  else view.setUint32(map + 2, 0, false)
  const variations = readAdvanceVariations(copy, 0, 1)
  assert.ok(variations !== null)
  assert.equal(variations.map, null)
})

test('an avar segment map without -1 → -1, 0 → 0 and 1 → 1 is the identity', () => {
  // Inter's own map moves wght 700 (0.6) to 0.54.
  assert.deepEqual([...normalizedCoords(readAxisNormalization(sfnt, 0)!, wght(700))], [8847])
  const copy = sfnt.slice()
  const view = new DataView(copy.buffer)
  const avar = tableAt(copy, 'avar')
  // Its second pair is 0 → 0; make it 0 → 0.006.
  assert.equal(view.getInt16(avar + 10 + 4, false), 0)
  view.setInt16(avar + 10 + 6, 100, false)
  const axes = readAxisNormalization(copy, 0)
  assert.ok(axes !== null)
  assert.deepEqual(axes.avar, [null])
  assert.deepEqual([...normalizedCoords(axes, wght(700))], [9830])
})

test('a coordinate avar maps beyond 1 is clamped to 1', () => {
  const axes: AxisNormalization = {
    axisTags: ['wght'],
    axisMin: [100 * 65536],
    axisDefault: [400 * 65536],
    axisMax: [900 * 65536],
    // -1 → -1, 0 → 0, 0.5 → 1.5, 1 → 1
    avar: [new Int16Array([-16384, -16384, 0, 0, 8192, 24576, 16384, 16384])],
  }
  assert.deepEqual([...normalizedCoords(axes, wght(650))], [16384])
  assert.deepEqual([...normalizedCoords(axes, wght(400))], [0])
})

test('fvar or avar that do not fit their tables read as null', () => {
  const copy = sfnt.slice()
  const view = new DataView(copy.buffer)
  const fvar = tableAt(copy, 'fvar')
  view.setUint16(fvar + 8, 0xffff, false) // axisCount
  assert.equal(readAxisNormalization(copy, 0), null)
  const copy2 = sfnt.slice()
  const view2 = new DataView(copy2.buffer)
  view2.setUint16(tableAt(copy2, 'avar') + 8, 0xffff, false) // the first map's positionMapCount
  assert.equal(readAxisNormalization(copy2, 0), null)
})

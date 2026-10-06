// hvar.ts on Inter Variable (@fontsource-variable/inter 5.3.0, latin) and on copies of it with one
// table edited in memory.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decompress } from 'wawoff2'
import { normalizedCoords, readAdvanceVariations, readAxisNormalization, variedAdvance, type AxisNormalization } from '../../src/headless/hvar.ts'

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

// A minimal sfnt with maxp, hhea, hmtx and the given HVAR: two glyphs advancing 500 and 600.
function sfntWith(hvar: Uint8Array): Uint8Array {
  const maxp = new Uint8Array(6)
  new DataView(maxp.buffer).setUint16(4, 2, false)
  const hhea = new Uint8Array(36)
  new DataView(hhea.buffer).setUint16(34, 2, false)
  const hmtx = new Uint8Array(8)
  new DataView(hmtx.buffer).setUint16(0, 500, false)
  new DataView(hmtx.buffer).setUint16(4, 600, false)
  const tables: [string, Uint8Array][] = [['HVAR', hvar], ['hhea', hhea], ['hmtx', hmtx], ['maxp', maxp]]
  let at = 12 + 16 * tables.length
  const font = new Uint8Array(at + tables.reduce((sum, [, t]) => sum + t.length + 3, 0))
  const view = new DataView(font.buffer)
  view.setUint32(0, 0x00010000, false)
  view.setUint16(4, tables.length, false)
  tables.forEach(([tag, table], i) => {
    const record = 12 + 16 * i
    for (let c = 0; c < 4; c++) font[record + c] = tag.charCodeAt(c)
    view.setUint32(record + 8, at, false)
    view.setUint32(record + 12, table.length, false)
    font.set(table, at)
    at += (table.length + 3) & ~3
  })
  return font
}

// An HVAR with one region (wght 0 → 1, peak 1) and a store of dataCount subtable offsets, subtable
// d at offsetOf(d) into body, which follows the region list. No DeltaSetIndexMap.
function hvarWith(dataCount: number, offsetOf: (d: number) => number, body: Uint8Array): { table: Uint8Array; dataAt: number } {
  const storeAt = 20
  const regionsAt = storeAt + 8 + 4 * dataCount
  const dataAt = regionsAt + 10
  const table = new Uint8Array(dataAt + body.length)
  const view = new DataView(table.buffer)
  view.setUint16(0, 1, false)
  view.setUint32(4, storeAt, false)
  view.setUint16(storeAt, 1, false)
  view.setUint32(storeAt + 2, regionsAt - storeAt, false)
  view.setUint16(storeAt + 6, dataCount, false)
  for (let d = 0; d < dataCount; d++) view.setUint32(storeAt + 8 + 4 * d, dataAt + offsetOf(d) - storeAt, false)
  view.setUint16(regionsAt, 1, false) // axisCount
  view.setUint16(regionsAt + 2, 1, false) // regionCount
  view.setInt16(regionsAt + 4, 0, false)
  view.setInt16(regionsAt + 6, 16384, false)
  view.setInt16(regionsAt + 8, 16384, false)
  table.set(body, dataAt)
  return { table, dataAt }
}

test('many store offsets naming one VarData parse it once', () => {
  // One subtable, 4000 region indexes (all region 0), two items: glyph 0 a delta of 1 per region,
  // glyph 1 of -1. Named by 4000 offsets, it was copied 4000 times (16 MB here; a crafted 504 KB
  // font made 8.6 GB).
  const regionIndexCount = 4000
  const body = new Uint8Array(6 + 2 * regionIndexCount + 2 * regionIndexCount)
  const view = new DataView(body.buffer)
  view.setUint16(0, 2, false) // itemCount
  view.setUint16(2, 0, false) // wordDeltaCount: all 8-bit deltas
  view.setUint16(4, regionIndexCount, false)
  const rowsAt = 6 + 2 * regionIndexCount
  for (let i = 0; i < regionIndexCount; i++) {
    body[rowsAt + i] = 1
    view.setInt8(rowsAt + regionIndexCount + i, -1)
  }
  const { table } = hvarWith(4000, () => 0, body)
  const started = performance.now()
  const variations = readAdvanceVariations(sfntWith(table), 0, 1)
  assert.ok(performance.now() - started < 2000)
  assert.ok(variations !== null)
  assert.equal(variations.varData.length, 4000)
  const first = variations.varData[0]
  assert.ok(variations.varData.every((data) => data === first), 'one VarData object, shared')
  const full = new Int16Array([16384])
  const half = new Int16Array([8192])
  assert.equal(variedAdvance(variations, full, 0), 500 + regionIndexCount)
  assert.equal(variedAdvance(variations, full, 1), 600 - regionIndexCount)
  assert.equal(variedAdvance(variations, half, 0), 500 + regionIndexCount / 2)
  assert.equal(variedAdvance(variations, new Int16Array([0]), 1), 600)
})

test('overlapping VarData whose region indexes exceed the table read as null', () => {
  // 600 subtables 6 bytes apart, each reading (itemCount 0, wordDeltaCount 0, regionIndexCount
  // 3000) and so claiming the next 6000 bytes as its region indexes: 1.8 million indexes from a
  // table of about 12 KB. Within half the table's length they would be accepted.
  const subtables = 600
  const regionIndexCount = 3000
  const body = new Uint8Array(6 * subtables + 2 * regionIndexCount)
  const view = new DataView(body.buffer)
  for (let k = 0; k < body.length / 6; k++) view.setUint16(6 * k + 4, regionIndexCount, false)
  const { table } = hvarWith(subtables, (d) => 6 * d, body)
  const started = performance.now()
  assert.ok(readAdvanceVariations(sfntWith(table), 0, 1) === null, 'past the bound')
  assert.ok(performance.now() - started < 2000)

  // The same layout with few enough indexes to fit is read, each subtable once.
  const small = new Uint8Array(6 * 20 + 2 * 2)
  const smallView = new DataView(small.buffer)
  for (let k = 0; k < 20; k++) smallView.setUint16(6 * k + 4, 2, false)
  const smallTable = hvarWith(40, (d) => 6 * (d % 20), small).table
  const fits = readAdvanceVariations(sfntWith(smallTable), 0, 1)
  assert.ok(fits !== null, 'within the bound')
  assert.equal(new Set(fits.varData).size, 20)
  const indexes = [...new Set(fits.varData)].reduce((sum, data) => sum + data!.regionIndexes.length, 0)
  assert.equal(indexes, 40)
  assert.ok(indexes <= smallTable.length / 2)
})

test('a DeltaSetIndexMap outer index past 65535 selects no subtable rather than wrapping', () => {
  // One VarData (two items, delta +7 and +9) at outer 0; the map has 4-byte entries with one inner
  // bit, so entry 0x00020000 is outer 0x10000 (65536), which a 16-bit store wraps to 0.
  const body = new Uint8Array(6 + 2 + 2)
  const view = new DataView(body.buffer)
  view.setUint16(0, 2, false)
  view.setUint16(4, 1, false)
  body[8] = 7
  body[9] = 9
  const { table } = hvarWith(1, () => 0, body)
  const mapAt = table.length
  const withMap = new Uint8Array(mapAt + 4 + 8)
  withMap.set(table)
  const mapView = new DataView(withMap.buffer)
  mapView.setUint32(8, mapAt, false) // advanceWidthMappingOffset
  mapView.setUint8(mapAt, 0) // format 0
  mapView.setUint8(mapAt + 1, 0x30) // 4-byte entries, 1 inner bit
  mapView.setUint16(mapAt + 2, 2, false)
  mapView.setUint32(mapAt + 4, 0x00020000, false) // glyph 0: outer 65536, inner 0
  mapView.setUint32(mapAt + 8, 0x00000001, false) // glyph 1: outer 0, inner 1
  const variations = readAdvanceVariations(sfntWith(withMap), 0, 1)
  assert.ok(variations !== null && variations.map !== null)
  assert.equal(variations.map.outer[0], 65536)
  const full = new Int16Array([16384])
  assert.equal(variedAdvance(variations, full, 0), 500)
  assert.equal(variedAdvance(variations, full, 1), 609)
})

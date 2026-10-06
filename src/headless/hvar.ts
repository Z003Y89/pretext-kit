// Unrounded advances of a variable font instance, from hmtx + HVAR.
//
// HarfBuzz (14.5.0, as harfbuzzjs 1.6.2 builds it) rounds the HVAR advance delta to a whole font
// unit before scaling (hmtx's get_advance_with_var_unscaled: advance + roundf(delta)), so at any
// font scale a varied advance is a multiple of 1/upem em. Chrome on macOS takes advances from
// CoreText through Skia, which keeps the delta's fraction: at Inter's wght 500 the space is
// 576 - 30.2387 = 545.7613 units in Chrome, 546 in HarfBuzz. This module computes the advance as
// CoreText does (normalized coordinates with OpenType's precision rules, avar applied, region
// scalars and deltas in floating point, nothing rounded), for the stand-in to hand HarfBuzz
// through a font function.
//
// Only what the stand-in needs is read: fvar, avar version 1, hhea, hmtx and HVAR. A face with
// avar version 2, or without HVAR (advances from gvar phantom points), returns null and keeps
// HarfBuzz's own advances. So does any face whose tables fail the structural checks below: HarfBuzz
// sanitizes a malformed HVAR away and measures with its own advances, and so does the stand-in,
// rather than throw from measureText.

type Region = Int16Array // start, peak, end per axis, in F2Dot14 units

// One ItemVariationStore subtable, its delta rows read from the table on demand.
type VarData = {
  regionIndexes: Uint16Array
  itemCount: number
  rowsAt: number
  rowSize: number
  wordCount: number
  longWords: boolean
}

// fvar's axes and avar version 1's segment maps: what normalizing a design coordinate needs.
export type AxisNormalization = {
  axisTags: string[]
  // In 16.16 Fixed, as fvar stores them.
  axisMin: number[]
  axisDefault: number[]
  axisMax: number[]
  // avar segment maps per axis, as [from, to, from, to, ...] in F2Dot14 units; null when absent
  // or when the map is not a usable one (treated as identity).
  avar: (Int16Array | null)[] | null
}

export type AdvanceVariations = {
  advances: Uint16Array
  regions: Region[]
  varData: (VarData | null)[]
  hvar: DataView
  // DeltaSetIndexMap as [outer, inner] per glyph; null maps glyph g to (0, g). outer is 32-bit:
  // an entry can name an outer index past 65535, which matches no subtable (no delta, as in
  // HarfBuzz) rather than wrapping onto one.
  map: { outer: Uint32Array; inner: Uint16Array } | null
}

class Malformed extends Error {}

function check(condition: boolean): void {
  if (!condition) throw new Malformed()
}

function tableDirectory(sfnt: Uint8Array, index: number): Map<string, Uint8Array> {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  let base = 0
  check(sfnt.length >= 12)
  if (view.getUint32(0, false) === 0x74746366) {
    // 'ttcf'
    check(12 + 4 * index + 4 <= sfnt.length)
    base = view.getUint32(12 + 4 * index, false)
  }
  check(base + 12 <= sfnt.length)
  const numTables = view.getUint16(base + 4, false)
  check(base + 12 + 16 * numTables <= sfnt.length)
  const tables = new Map<string, Uint8Array>()
  for (let i = 0; i < numTables; i++) {
    const record = base + 12 + 16 * i
    const tag = String.fromCharCode(sfnt[record]!, sfnt[record + 1]!, sfnt[record + 2]!, sfnt[record + 3]!)
    const offset = view.getUint32(record + 8, false)
    const length = view.getUint32(record + 12, false)
    // A table that does not fit the file is treated as absent.
    if (offset + length <= sfnt.length) tables.set(tag, sfnt.subarray(offset, offset + length))
  }
  return tables
}

function viewOf(table: Uint8Array): DataView {
  return new DataView(table.buffer, table.byteOffset, table.byteLength)
}

// avar requires each non-empty segment map to hold -1 → -1, 0 → 0 and 1 → 1; a map without them
// is not usable and is treated as identity.
function usableSegmentMap(map: Int16Array): boolean {
  let minusOne = false
  let zero = false
  let one = false
  for (let i = 0; i < map.length; i += 2) {
    const from = map[i]!
    const to = map[i + 1]!
    if (from === -16384 && to === -16384) minusOne = true
    if (from === 0 && to === 0) zero = true
    if (from === 16384 && to === 16384) one = true
  }
  return minusOne && zero && one
}

function readNormalization(tables: Map<string, Uint8Array>): AxisNormalization | null {
  const fvarTable = tables.get('fvar')
  if (fvarTable === undefined) return null
  const fvar = viewOf(fvarTable)
  check(fvarTable.length >= 16)
  const axesAt = fvar.getUint16(4, false)
  const axisCount = fvar.getUint16(8, false)
  const axisSize = fvar.getUint16(10, false)
  check(axisSize >= 20 && axesAt + axisCount * axisSize <= fvarTable.length)
  const axisTags: string[] = []
  const axisMin: number[] = []
  const axisDefault: number[] = []
  const axisMax: number[] = []
  for (let a = 0; a < axisCount; a++) {
    const at = axesAt + a * axisSize
    axisTags.push(String.fromCharCode(fvarTable[at]!, fvarTable[at + 1]!, fvarTable[at + 2]!, fvarTable[at + 3]!))
    const min = fvar.getInt32(at + 4, false)
    const def = fvar.getInt32(at + 8, false)
    const max = fvar.getInt32(at + 12, false)
    // fvar requires min <= default <= max; HarfBuzz clamps the others into that order.
    const d = Math.min(Math.max(min, def), max)
    axisMin.push(Math.min(min, d))
    axisDefault.push(d)
    axisMax.push(Math.max(max, d))
  }

  let avar: AxisNormalization['avar'] = null
  const avarTable = tables.get('avar')
  if (avarTable !== undefined) {
    const view = viewOf(avarTable)
    check(avarTable.length >= 8)
    if (view.getUint16(0, false) !== 1) return null
    avar = []
    let p = 8
    const mapped = Math.min(axisCount, view.getUint16(6, false))
    for (let a = 0; a < mapped; a++) {
      check(p + 2 <= avarTable.length)
      const count = view.getUint16(p, false)
      check(p + 2 + 4 * count <= avarTable.length)
      const map = new Int16Array(2 * count)
      for (let i = 0; i < 2 * count; i++) map[i] = view.getInt16(p + 2 + 2 * i, false)
      avar.push(count === 0 || !usableSegmentMap(map) ? null : map)
      p += 2 + 4 * count
    }
  }
  return { axisTags, axisMin, axisDefault, axisMax, avar }
}

// The axes and avar of a face, or null where it has no fvar, has avar version 2, or the tables are
// malformed.
export function readAxisNormalization(sfnt: Uint8Array, index: number): AxisNormalization | null {
  try {
    return readNormalization(tableDirectory(sfnt, index))
  } catch {
    return null
  }
}

function readStore(hvar: DataView, storeOffset: number, axisCount: number): { regions: Region[]; varData: (VarData | null)[] } {
  const length = hvar.byteLength
  check(storeOffset + 8 <= length)
  check(hvar.getUint16(storeOffset, false) === 1) // ItemVariationStore format
  const regionListRelative = hvar.getUint32(storeOffset + 2, false)
  const dataCount = hvar.getUint16(storeOffset + 6, false)
  check(storeOffset + 8 + 4 * dataCount <= length)

  const regions: Region[] = []
  if (regionListRelative !== 0) {
    const regionListOffset = storeOffset + regionListRelative
    check(regionListOffset + 4 <= length)
    const regionAxisCount = hvar.getUint16(regionListOffset, false)
    const regionCount = hvar.getUint16(regionListOffset + 2, false)
    check(regionAxisCount === axisCount)
    check(regionListOffset + 4 + regionCount * regionAxisCount * 6 <= length)
    for (let r = 0; r < regionCount; r++) {
      const region = new Int16Array(3 * axisCount)
      for (let a = 0; a < axisCount; a++) {
        const at = regionListOffset + 4 + (r * regionAxisCount + a) * 6
        region[3 * a] = hvar.getInt16(at, false)
        region[3 * a + 1] = hvar.getInt16(at + 2, false)
        region[3 * a + 2] = hvar.getInt16(at + 4, false)
      }
      regions.push(region)
    }
  }

  // Several offsets may name one subtable; it is parsed once. Copying region indexes is bounded
  // by the table: in a well-formed store the distinct subtables do not overlap, so their region
  // index lists together hold at most length / 2 entries. A store that asks for more (subtables
  // overlapping each other to multiply the work) is malformed, and the face keeps HarfBuzz's
  // advances.
  const byOffset = new Map<number, VarData>()
  let regionIndexBudget = Math.floor(length / 2)
  const varData: (VarData | null)[] = []
  for (let d = 0; d < dataCount; d++) {
    const relative = hvar.getUint32(storeOffset + 8 + 4 * d, false)
    // A null offset is an empty subtable: its items have no deltas.
    if (relative === 0) {
      varData.push(null)
      continue
    }
    const at = storeOffset + relative
    const parsed = byOffset.get(at)
    if (parsed !== undefined) {
      varData.push(parsed)
      continue
    }
    check(at + 6 <= length)
    const itemCount = hvar.getUint16(at, false)
    const wordDeltaCount = hvar.getUint16(at + 2, false)
    const regionIndexCount = hvar.getUint16(at + 4, false)
    const longWords = (wordDeltaCount & 0x8000) !== 0
    const wordCount = wordDeltaCount & 0x7fff
    check(wordCount <= regionIndexCount)
    const rowsAt = at + 6 + 2 * regionIndexCount
    const wordSize = longWords ? 4 : 2
    const rowSize = wordCount * wordSize + (regionIndexCount - wordCount) * (wordSize / 2)
    check(rowsAt + itemCount * rowSize <= length)
    regionIndexBudget -= regionIndexCount
    check(regionIndexBudget >= 0)
    const regionIndexes = new Uint16Array(regionIndexCount)
    for (let i = 0; i < regionIndexCount; i++) regionIndexes[i] = hvar.getUint16(at + 6 + 2 * i, false)
    const data = { regionIndexes, itemCount, rowsAt, rowSize, wordCount, longWords }
    byOffset.set(at, data)
    varData.push(data)
  }
  return { regions, varData }
}

function readMap(hvar: DataView, at: number, numGlyphs: number): AdvanceVariations['map'] {
  const length = hvar.byteLength
  check(at + 2 <= length)
  const format = hvar.getUint8(at)
  check(format === 0 || format === 1)
  const entryFormat = hvar.getUint8(at + 1)
  const headerSize = format === 0 ? 4 : 6
  check(at + headerSize <= length)
  const mapCount = format === 0 ? hvar.getUint16(at + 2, false) : hvar.getUint32(at + 2, false)
  // An empty map is the identity, as in HarfBuzz: glyph g is (0, g).
  if (mapCount === 0) return null
  const entriesAt = at + headerSize
  const innerBits = (entryFormat & 0x0f) + 1
  const entrySize = ((entryFormat & 0x30) >> 4) + 1
  check(entriesAt + mapCount * entrySize <= length)
  const outer = new Uint32Array(numGlyphs)
  const inner = new Uint16Array(numGlyphs)
  for (let g = 0; g < numGlyphs; g++) {
    // Glyphs past the map use its last entry.
    const p = entriesAt + Math.min(g, mapCount - 1) * entrySize
    let entry = 0
    for (let b = 0; b < entrySize; b++) entry = entry * 256 + hvar.getUint8(p + b)
    outer[g] = Math.floor(entry / 2 ** innerBits)
    inner[g] = entry % 2 ** innerBits
  }
  return { outer, inner }
}

function readAdvances(tables: Map<string, Uint8Array>, axisCount: number): AdvanceVariations | null {
  const hvarTable = tables.get('HVAR')
  const hhea = tables.get('hhea')
  const hmtx = tables.get('hmtx')
  const maxp = tables.get('maxp')
  if (hvarTable === undefined || hhea === undefined || hmtx === undefined || maxp === undefined) return null
  check(maxp.length >= 6 && hhea.length >= 36)
  const numGlyphs = viewOf(maxp).getUint16(4, false)
  const numberOfHMetrics = viewOf(hhea).getUint16(34, false)
  check(numberOfHMetrics >= 1)
  const metrics = viewOf(hmtx)
  const advances = new Uint16Array(numGlyphs)
  for (let g = 0; g < numGlyphs; g++) {
    const at = 4 * Math.min(g, numberOfHMetrics - 1)
    advances[g] = at + 2 <= hmtx.length ? metrics.getUint16(at, false) : 0
  }

  const hvar = viewOf(hvarTable)
  check(hvarTable.length >= 20)
  check(hvar.getUint16(0, false) === 1) // majorVersion
  const storeOffset = hvar.getUint32(4, false)
  const mapOffset = hvar.getUint32(8, false)
  if (storeOffset === 0) return null
  const { regions, varData } = readStore(hvar, storeOffset, axisCount)
  const map = mapOffset === 0 ? null : readMap(hvar, mapOffset, numGlyphs)
  return { advances, regions, varData, hvar, map }
}

// hmtx and HVAR of a face, or null where it has no HVAR or they are malformed (the stand-in then
// keeps HarfBuzz's own advances). axisCount is fvar's: HVAR's regions must have as many axes.
export function readAdvanceVariations(sfnt: Uint8Array, index: number, axisCount: number): AdvanceVariations | null {
  try {
    return readAdvances(tableDirectory(sfnt, index), axisCount)
  } catch {
    return null
  }
}

// avar version 1 segment map in 16.16 Fixed (the map's F2Dot14 points scaled by 4), the
// interpolation truncated toward zero.
function mapAvar(value: number, map: Int16Array): number {
  const len = map.length / 2
  const from = (i: number): number => map[2 * i]! * 4
  const to = (i: number): number => map[2 * i + 1]! * 4
  if (value <= from(0)) return value - from(0) + to(0)
  let i = 1
  while (i < len - 1 && value > from(i)) i++
  if (value >= from(i)) return value - from(i) + to(i)
  if (from(i - 1) === from(i)) return to(i - 1)
  return to(i - 1) + Math.trunc(((to(i) - to(i - 1)) * (value - from(i - 1))) / (from(i) - from(i - 1)))
}

// Design coordinates by axis tag to normalized F2Dot14 coordinates, in fvar order, with the
// precision rules of OpenType 1.9.1 (otvaroverview, "Coordinate scales and normalization"): the
// design value converted to 16.16 Fixed (rounded), normalized and mapped through avar in 16.16,
// clamped to [-1, 1], and only then converted to F2Dot14 ((x + 2) >> 2). CoreText follows these
// rules; HarfBuzz rounds to F2Dot14 before avar and after it, so at Inter's wght 899 it gets
// 16345 where this gets 16344, at 399 -55 against -54. The one choice the spec leaves open is the
// rounding of the 16.16 division and avar interpolation: truncation toward zero, the one variant
// that reproduces the coordinate Chrome 149's widths imply at all 23 wght values tried across
// 100-900 of Inter (each pinned by 95 exact glyph widths).
export function normalizedCoords(axes: AxisNormalization, design: ReadonlyMap<string, number>): Int16Array {
  const coords = new Int16Array(axes.axisTags.length)
  for (let a = 0; a < coords.length; a++) {
    const min = axes.axisMin[a]!
    const def = axes.axisDefault[a]!
    const max = axes.axisMax[a]!
    const wanted = design.get(axes.axisTags[a]!)
    let fixed = 0
    if (wanted !== undefined) {
      const clamped = Math.min(max, Math.max(min, Math.round(wanted * 65536)))
      if (clamped < def) fixed = Math.trunc(((clamped - def) * 65536) / (def - min))
      else if (clamped > def) fixed = Math.trunc(((clamped - def) * 65536) / (max - def))
    }
    const map = axes.avar?.[a]
    if (map !== undefined && map !== null) fixed = Math.min(65536, Math.max(-65536, mapAvar(fixed, map)))
    coords[a] = Math.floor((fixed + 2) / 4)
  }
  return coords
}

function regionScalar(region: Region, coords: Int16Array): number {
  let scalar = 1
  for (let a = 0; a < coords.length; a++) {
    const start = region[3 * a]!
    const peak = region[3 * a + 1]!
    const end = region[3 * a + 2]!
    const coord = coords[a]!
    if (start > peak || peak > end) continue
    if (start < 0 && end > 0 && peak !== 0) continue
    if (peak === 0 || coord === peak) continue
    if (coord <= start || end <= coord) return 0
    scalar *= coord < peak ? (coord - start) / (peak - start) : (end - coord) / (end - peak)
  }
  return scalar
}

// A glyph's advance in font units at the normalized coordinates, with the delta unrounded.
export function variedAdvance(variations: AdvanceVariations, coords: Int16Array, glyph: number): number {
  const advances = variations.advances
  if (glyph >= advances.length) return 0
  const outer = variations.map === null ? 0 : variations.map.outer[glyph]!
  const inner = variations.map === null ? glyph : variations.map.inner[glyph]!
  const data = variations.varData[outer]
  if (data === undefined || data === null || inner >= data.itemCount) return advances[glyph]!
  const hvar = variations.hvar
  let delta = 0
  let p = data.rowsAt + inner * data.rowSize
  for (let i = 0; i < data.regionIndexes.length; i++) {
    let value: number
    if (i < data.wordCount) {
      value = data.longWords ? hvar.getInt32(p, false) : hvar.getInt16(p, false)
      p += data.longWords ? 4 : 2
    } else {
      value = data.longWords ? hvar.getInt16(p, false) : hvar.getInt8(p)
      p += data.longWords ? 2 : 1
    }
    const region = variations.regions[data.regionIndexes[i]!]
    if (region === undefined) continue
    const scalar = regionScalar(region, coords)
    if (scalar !== 0) delta += scalar * value
  }
  return advances[glyph]! + delta
}

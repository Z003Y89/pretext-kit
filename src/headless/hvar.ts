// Unrounded advances of a variable font instance, from hmtx + HVAR.
//
// HarfBuzz (14.5.0, as harfbuzzjs 1.6.2 builds it) rounds the HVAR advance delta to a whole font
// unit before scaling (hmtx's get_advance_with_var_unscaled: advance + roundf(delta)), so at any
// font scale a varied advance is a multiple of 1/upem em. Chrome on macOS takes advances from
// CoreText through Skia, which keeps the delta's fraction: at Inter's wght 500 the space is
// 576 - 30.2387 = 545.7613 units in Chrome, 546 in HarfBuzz. This module computes the advance as
// CoreText does (normalized coordinates in F2Dot14, avar applied, region scalars and deltas in
// floating point, nothing rounded), for the stand-in to hand HarfBuzz through a font function.
//
// Only what the stand-in needs is read: fvar, avar version 1, hhea, hmtx and HVAR. A face with
// avar version 2, or without HVAR (advances from gvar phantom points), returns null and keeps
// HarfBuzz's own advances.

type Region = Int16Array // start, peak, end per axis, in F2Dot14 units
type VarData = { regionIndexes: Uint16Array; rows: number[][] }

export type AdvanceVariations = {
  axisTags: string[]
  axisMin: number[]
  axisDefault: number[]
  axisMax: number[]
  // avar segment maps per axis, as [from, to, from, to, ...] in F2Dot14 units; null when absent.
  avar: (Int16Array | null)[] | null
  advances: Uint16Array
  regions: Region[]
  varData: VarData[]
  // DeltaSetIndexMap as [outer, inner] per glyph; null maps glyph g to (0, g).
  map: { outer: Uint16Array; inner: Uint16Array } | null
}

function tableDirectory(sfnt: Uint8Array, index: number): Map<string, Uint8Array> {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  let base = 0
  if (view.getUint32(0, false) === 0x74746366) base = view.getUint32(12 + 4 * index, false) // 'ttcf'
  const numTables = view.getUint16(base + 4, false)
  const tables = new Map<string, Uint8Array>()
  for (let i = 0; i < numTables; i++) {
    const record = base + 12 + 16 * i
    const tag = String.fromCharCode(sfnt[record]!, sfnt[record + 1]!, sfnt[record + 2]!, sfnt[record + 3]!)
    const offset = view.getUint32(record + 8, false)
    const length = view.getUint32(record + 12, false)
    tables.set(tag, sfnt.subarray(offset, offset + length))
  }
  return tables
}

function viewOf(table: Uint8Array): DataView {
  return new DataView(table.buffer, table.byteOffset, table.byteLength)
}

function readStore(hvar: DataView, storeOffset: number, axisCount: number): { regions: Region[]; varData: VarData[] } {
  const regionListOffset = storeOffset + hvar.getUint32(storeOffset + 2, false)
  const dataCount = hvar.getUint16(storeOffset + 6, false)
  const regionAxisCount = hvar.getUint16(regionListOffset, false)
  const regionCount = hvar.getUint16(regionListOffset + 2, false)
  const regions: Region[] = []
  for (let r = 0; r < regionCount; r++) {
    const region = new Int16Array(3 * axisCount)
    for (let a = 0; a < Math.min(axisCount, regionAxisCount); a++) {
      const at = regionListOffset + 4 + (r * regionAxisCount + a) * 6
      region[3 * a] = hvar.getInt16(at, false)
      region[3 * a + 1] = hvar.getInt16(at + 2, false)
      region[3 * a + 2] = hvar.getInt16(at + 4, false)
    }
    regions.push(region)
  }
  const varData: VarData[] = []
  for (let d = 0; d < dataCount; d++) {
    const at = storeOffset + hvar.getUint32(storeOffset + 8 + 4 * d, false)
    const itemCount = hvar.getUint16(at, false)
    const wordDeltaCount = hvar.getUint16(at + 2, false)
    const regionIndexCount = hvar.getUint16(at + 4, false)
    const regionIndexes = new Uint16Array(regionIndexCount)
    for (let i = 0; i < regionIndexCount; i++) regionIndexes[i] = hvar.getUint16(at + 6 + 2 * i, false)
    const longWords = (wordDeltaCount & 0x8000) !== 0
    const wordCount = wordDeltaCount & 0x7fff
    const wordSize = longWords ? 4 : 2
    const rowSize = wordCount * wordSize + (regionIndexCount - wordCount) * (wordSize / 2)
    const rows: number[][] = []
    let cursor = at + 6 + 2 * regionIndexCount
    for (let item = 0; item < itemCount; item++) {
      const row: number[] = []
      let p = cursor
      for (let i = 0; i < regionIndexCount; i++) {
        if (i < wordCount) {
          row.push(longWords ? hvar.getInt32(p, false) : hvar.getInt16(p, false))
          p += wordSize
        } else {
          row.push(longWords ? hvar.getInt16(p, false) : hvar.getInt8(p))
          p += wordSize / 2
        }
      }
      rows.push(row)
      cursor += rowSize
    }
    varData.push({ regionIndexes, rows })
  }
  return { regions, varData }
}

function readMap(hvar: DataView, at: number, numGlyphs: number): AdvanceVariations['map'] {
  const format = hvar.getUint8(at)
  const entryFormat = hvar.getUint8(at + 1)
  const mapCount = format === 0 ? hvar.getUint16(at + 2, false) : hvar.getUint32(at + 2, false)
  const entriesAt = at + (format === 0 ? 4 : 6)
  const innerBits = (entryFormat & 0x0f) + 1
  const entrySize = ((entryFormat & 0x30) >> 4) + 1
  const outer = new Uint16Array(numGlyphs)
  const inner = new Uint16Array(numGlyphs)
  if (mapCount === 0) return { outer, inner }
  for (let g = 0; g < numGlyphs; g++) {
    // Glyphs past the map use its last entry.
    const p = entriesAt + Math.min(g, mapCount - 1) * entrySize
    let entry = 0
    for (let b = 0; b < entrySize; b++) entry = entry * 256 + hvar.getUint8(p + b)
    outer[g] = Math.floor(entry / 2 ** innerBits)
    inner[g] = entry & ((1 << innerBits) - 1)
  }
  return { outer, inner }
}

export function readAdvanceVariations(sfnt: Uint8Array, index: number): AdvanceVariations | null {
  const tables = tableDirectory(sfnt, index)
  const fvarTable = tables.get('fvar')
  const hvarTable = tables.get('HVAR')
  const hhea = tables.get('hhea')
  const hmtx = tables.get('hmtx')
  const maxp = tables.get('maxp')
  if (fvarTable === undefined || hvarTable === undefined || hhea === undefined || hmtx === undefined || maxp === undefined) return null
  const fvar = viewOf(fvarTable)
  const axesAt = fvar.getUint16(4, false)
  const axisCount = fvar.getUint16(8, false)
  const axisSize = fvar.getUint16(10, false)
  const axisTags: string[] = []
  const axisMin: number[] = []
  const axisDefault: number[] = []
  const axisMax: number[] = []
  for (let a = 0; a < axisCount; a++) {
    const at = axesAt + a * axisSize
    axisTags.push(String.fromCharCode(fvarTable[at]!, fvarTable[at + 1]!, fvarTable[at + 2]!, fvarTable[at + 3]!))
    axisMin.push(fvar.getInt32(at + 4, false) / 65536)
    axisDefault.push(fvar.getInt32(at + 8, false) / 65536)
    axisMax.push(fvar.getInt32(at + 12, false) / 65536)
  }

  let avar: AdvanceVariations['avar'] = null
  const avarTable = tables.get('avar')
  if (avarTable !== undefined) {
    const view = viewOf(avarTable)
    if (view.getUint16(0, false) !== 1) return null
    avar = []
    let p = 8
    for (let a = 0; a < Math.min(axisCount, view.getUint16(6, false)); a++) {
      const count = view.getUint16(p, false)
      const map = new Int16Array(2 * count)
      for (let i = 0; i < 2 * count; i++) map[i] = view.getInt16(p + 2 + 2 * i, false)
      avar.push(count === 0 ? null : map)
      p += 2 + 4 * count
    }
  }

  const numGlyphs = viewOf(maxp).getUint16(4, false)
  const numberOfHMetrics = viewOf(hhea).getUint16(34, false)
  const metrics = viewOf(hmtx)
  const advances = new Uint16Array(numGlyphs)
  for (let g = 0; g < numGlyphs; g++) {
    const at = 4 * Math.min(g, numberOfHMetrics - 1)
    advances[g] = at + 2 <= hmtx.length ? metrics.getUint16(at, false) : 0
  }

  const hvar = viewOf(hvarTable)
  const storeOffset = hvar.getUint32(4, false)
  const mapOffset = hvar.getUint32(8, false)
  const { regions, varData } = readStore(hvar, storeOffset, axisCount)
  const map = mapOffset === 0 ? null : readMap(hvar, mapOffset, numGlyphs)
  return { axisTags, axisMin, axisDefault, axisMax, avar, advances, regions, varData, map }
}

// avar version 1 segment map in 16.16 Fixed (the map's F2Dot14 points scaled by 4), the
// interpolation truncated toward zero.
function mapAvar(value: number, map: Int16Array): number {
  const len = map.length / 2
  const from = (i: number): number => map[2 * i]! * 4
  const to = (i: number): number => map[2 * i + 1]! * 4
  if (len < 2) return len === 0 ? value : value - from(0) + to(0)
  if (value <= from(0)) return value - from(0) + to(0)
  let i = 1
  while (i < len - 1 && value > from(i)) i++
  if (value >= from(i)) return value - from(i) + to(i)
  if (from(i - 1) === from(i)) return to(i - 1)
  return to(i - 1) + Math.trunc(((to(i) - to(i - 1)) * (value - from(i - 1))) / (from(i) - from(i - 1)))
}

// Design coordinates by axis tag to normalized F2Dot14 coordinates, in fvar order, as CoreText
// computes them: the normalized value in 16.16 Fixed truncated toward zero, avar applied in
// 16.16, then rounded to F2Dot14 ((x + 2) >> 2). Fitted to Chrome 149 on macOS: it is the one
// pipeline among the plain variants (F2Dot14 or 16.16; round, trunc or floor at each step) that
// reproduces the coordinate Chrome's widths imply at all 23 wght values tried across 100-900 of
// Inter (each pinned by 95 exact glyph widths). HarfBuzz rounds to F2Dot14 before avar and after
// it: wght 899 is 16344 here and 16345 there, 399 is -54 here and -55 there.
export function normalizedCoords(variations: AdvanceVariations, design: ReadonlyMap<string, number>): Int16Array {
  const coords = new Int16Array(variations.axisTags.length)
  for (let a = 0; a < coords.length; a++) {
    const min = variations.axisMin[a]!
    const def = variations.axisDefault[a]!
    const max = variations.axisMax[a]!
    const wanted = design.get(variations.axisTags[a]!)
    let v = 0
    if (wanted !== undefined) {
      const clamped = Math.min(max, Math.max(min, wanted))
      if (clamped < def) v = (clamped - def) / (def - min)
      else if (clamped > def) v = (clamped - def) / (max - def)
    }
    let fixed = Math.trunc(v * 65536)
    const map = variations.avar?.[a]
    if (map !== undefined && map !== null) fixed = mapAvar(fixed, map)
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
  const row = data?.rows[inner]
  if (data === undefined || row === undefined) return advances[glyph]!
  let delta = 0
  for (let i = 0; i < row.length; i++) {
    const region = variations.regions[data.regionIndexes[i]!]
    if (region === undefined) continue
    const scalar = regionScalar(region, coords)
    if (scalar !== 0) delta += scalar * row[i]!
  }
  return advances[glyph]! + delta
}

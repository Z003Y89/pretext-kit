import { inflateSync } from 'node:zlib'
import { Blob, Face } from 'harfbuzzjs'
import * as wawoff2 from 'wawoff2'

export type FontStyle = 'normal' | 'italic'

export type FaceOptions = {
  weight?: number | [number, number]
  style?: FontStyle
  // Which font of a .ttc/.otc collection to register; ignored for single-font files.
  index?: number
}

export type FaceAxis = { tag: string; min: number; default: number; max: number }

export type FontFace = {
  family: string
  weightMin: number
  weightMax: number
  style: FontStyle
  upem: number
  axes: FaceAxis[]
  face: Face
}

const faces: FontFace[] = []

function tagAt(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!)
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, false)
}

// HarfBuzz reads sfnt only, so WOFF1 is rebuilt into a plain sfnt: a table directory followed by
// each table (inflated when its stored size differs from its original size), padded to 4 bytes.
function woffToSfnt(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const numTables = view.getUint16(12, false)
  const tables: Uint8Array[] = []
  let total = 12 + 16 * numTables
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + 20 * i
    const offset = u32(view, entry + 4)
    const compLength = u32(view, entry + 8)
    const origLength = u32(view, entry + 12)
    const stored = data.subarray(offset, offset + compLength)
    const table = compLength === origLength ? stored : new Uint8Array(inflateSync(stored))
    tables.push(table)
    total += (origLength + 3) & ~3
  }
  const out = new Uint8Array(total)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, u32(view, 4), false)
  outView.setUint16(4, numTables, false)
  let searchRange = 1
  let entrySelector = 0
  while (searchRange * 2 <= numTables) {
    searchRange *= 2
    entrySelector++
  }
  outView.setUint16(6, searchRange * 16, false)
  outView.setUint16(8, entrySelector, false)
  outView.setUint16(10, numTables * 16 - searchRange * 16, false)
  let cursor = 12 + 16 * numTables
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + 20 * i
    const table = tables[i]!
    const dir = 12 + 16 * i
    out.set(data.subarray(entry, entry + 4), dir)
    outView.setUint32(dir + 4, u32(view, entry + 16), false)
    outView.setUint32(dir + 8, cursor, false)
    outView.setUint32(dir + 12, table.length, false)
    out.set(table, cursor)
    cursor += (table.length + 3) & ~3
  }
  return out
}

async function toSfnt(data: Uint8Array): Promise<Uint8Array> {
  if (data.length >= 4) {
    const signature = tagAt(data, 0)
    // Raw WOFF2 handed to HarfBuzz fails silently, so it must be decompressed here.
    if (signature === 'wOF2') return new Uint8Array(await wawoff2.decompress(data))
    if (signature === 'wOFF') return woffToSfnt(data)
    if (signature === 'ttcf' || signature === 'OTTO' || signature === 'true' || signature === 'typ1') return data
    if (data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0) return data
  }
  throw new Error('registerFont: data is not a recognised font (expected TTF, OTF, TTC, WOFF or WOFF2)')
}

function familyKey(family: string): string {
  return family.toLowerCase()
}

function sameSlot(a: FontFace, family: string, min: number, max: number, style: FontStyle): boolean {
  return familyKey(a.family) === familyKey(family) && a.weightMin === min && a.weightMax === max && a.style === style
}

export async function registerFont(family: string, data: Uint8Array, face?: FaceOptions): Promise<void> {
  const sfnt = await toSfnt(data)
  const hbFace = new Face(new Blob(sfnt), face?.index ?? 0)
  const infos = hbFace.getAxisInfos()
  const axes: FaceAxis[] = []
  const tags = Object.keys(infos)
  for (let i = 0; i < tags.length; i++) {
    const info = infos[tags[i]!]!
    axes.push({ tag: info.tag, min: info.min, default: info.default, max: info.max })
  }

  let weightMin: number
  let weightMax: number
  const weight = face?.weight
  if (weight !== undefined) {
    weightMin = typeof weight === 'number' ? weight : weight[0]
    weightMax = typeof weight === 'number' ? weight : weight[1]
  } else {
    let wght: FaceAxis | undefined
    for (let i = 0; i < axes.length; i++) if (axes[i]!.tag === 'wght') wght = axes[i]
    const os2 = hbFace.referenceTable('OS/2')
    if (wght !== undefined) {
      weightMin = wght.min
      weightMax = wght.max
    } else {
      // usWeightClass is the font's own declared weight; 400 when the table is absent.
      weightMin = weightMax = os2 !== undefined && os2.length >= 6 ? (os2[4]! << 8) | os2[5]! : 400
    }
  }

  let style = face?.style
  if (style === undefined) {
    const os2 = hbFace.referenceTable('OS/2')
    // fsSelection bit 0 is italic.
    style = os2 !== undefined && os2.length >= 64 && (os2[63]! & 1) === 1 ? 'italic' : 'normal'
  }

  for (let i = 0; i < faces.length; i++) {
    if (sameSlot(faces[i]!, family, weightMin, weightMax, style)) {
      throw new Error(`registerFont: "${family}" ${weightMin}-${weightMax} ${style} is already registered`)
    }
  }
  faces.push({ family, weightMin, weightMax, style, upem: hbFace.upem, axes, face: hbFace })
}

// CSS font matching preference order as a sortable rank: lower wins. Weights are compared by
// the candidate's closest weight to the request, so a range counts as its nearest edge.
function rank(face: FontFace, weight: number): number {
  const closest = weight < face.weightMin ? face.weightMin : weight > face.weightMax ? face.weightMax : weight
  if (closest === weight) return 0
  const heavier = closest > weight
  const gap = Math.abs(closest - weight)
  if (weight >= 400 && weight <= 500) {
    if (heavier && closest <= 500) return 1 + gap
    if (!heavier) return 1000 + gap
    return 2000 + gap
  }
  if (weight < 400) return (heavier ? 2000 : 0) + 1 + gap
  return (heavier ? 0 : 2000) + 1 + gap
}

export function findFace(family: string, weight: number, style: FontStyle): FontFace | undefined {
  const key = familyKey(family)
  let best: FontFace | undefined
  let bestScore = Infinity
  for (let i = 0; i < faces.length; i++) {
    const candidate = faces[i]!
    if (familyKey(candidate.family) !== key) continue
    // Style outranks weight: CSS picks the style first, then the weight within it.
    const score = (candidate.style === style ? 0 : 100000) + rank(candidate, weight)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

export function clearFonts(): void {
  faces.length = 0
}

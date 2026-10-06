// `npm run verify:hvar [extra font paths]`: the unrounded HVAR advances of src/headless/hvar.ts against fontTools.
//
// Needs python3 with fontTools 4.62.1 (pinned) and brotli for the WOFF2 files:
//   pip install fonttools==4.62.1 brotli
// (in a venv if you like; set PYTHON=/path/to/venv/bin/python3 to use it).
//
// verify/hvar-fonttools.py picks axis locations and evaluates hmtx + HVAR with fontTools. This script then checks,
// for every glyph at every location, that variedAdvance (given the same F2Dot14 coordinates) agrees with fontTools
// to within 1e-6 font units (both unrounded; the difference is float noise), and reports how far normalizedCoords
// is from fontTools' own normalization, which is allowed to differ by 1 F2Dot14 unit: the kit follows OpenType
// 1.9.1's 16.16 precision rules (what CoreText does), fontTools rounds once at the end.
//
// Default fonts: @fontsource-variable/inter 5.3.0's latin files (a devDependency, not committed here):
// wght, opsz, and standard (wght + opsz). Extra paths on the command line (.ttf, .otf or .woff2) are checked the
// same way, e.g. /System/Library/Fonts/SFNS.ttf on macOS (wdth, opsz, GRAD, wght); no such font is part of this repo.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decompress } from 'wawoff2'
import { normalizedCoords, readAdvanceVariations, readAxisNormalization, variedAdvance } from '../src/headless/hvar.ts'

const PINNED = '4.62.1'
const TOLERANCE = 1e-6
const inter = (name: string): string =>
  fileURLToPath(new URL(`../node_modules/@fontsource-variable/inter/files/inter-latin-${name}-normal.woff2`, import.meta.url))
const defaults = [inter('wght'), inter('opsz'), inter('standard')]
const paths = [...defaults, ...process.argv.slice(2)]

const python = process.env.PYTHON ?? 'python3'
const run = spawnSync(python, [fileURLToPath(new URL('./hvar-fonttools.py', import.meta.url)), ...paths], {
  encoding: 'utf8',
  maxBuffer: 1 << 30,
})
if (run.status !== 0) {
  console.error(run.stderr || run.error?.message)
  console.error(`verify:hvar needs python3 with fontTools ${PINNED} and brotli: pip install fonttools==${PINNED} brotli`)
  process.exit(2)
}
type Instance = { design: Record<string, number>, coords: number[], advances: number[] }
type Reference = { fontTools: string, fonts: Record<string, { skipped: string } | { axes: string[], avar: boolean, advWidthMap: boolean, glyphs: number, instances: Instance[] }> }
const reference: Reference = JSON.parse(run.stdout)
if (reference.fontTools !== PINNED) {
  console.error(`fontTools ${reference.fontTools} is installed, ${PINNED} is pinned: pip install fonttools==${PINNED}`)
  process.exit(2)
}

console.log(`fontTools ${reference.fontTools}`)
let failed = false
let instances = 0
let cells = 0
let maxDiff = 0
let maxCoordDiff = 0
for (const path of paths) {
  const font = reference.fonts[path]!
  const name = basename(path)
  if ('skipped' in font) {
    console.log(`${name}: skipped (${font.skipped})`)
    if (defaults.includes(path)) failed = true
    continue
  }
  const raw = readFileSync(path)
  const sfnt = path.endsWith('.woff2') ? new Uint8Array(await decompress(raw)) : new Uint8Array(raw)
  const axes = readAxisNormalization(sfnt, 0)
  const variations = axes === null ? null : readAdvanceVariations(sfnt, 0, axes.axisTags.length)
  if (axes === null || variations === null) {
    console.log(`${name}: the kit reads no axes or HVAR from it`)
    failed = true
    continue
  }
  let fontMax = 0
  let fontCoordMax = 0
  let fontCells = 0
  for (const instance of font.instances) {
    const coords = Int16Array.from(instance.coords)
    const mine = normalizedCoords(axes, new Map(Object.entries(instance.design)))
    for (let i = 0; i < coords.length; i++) fontCoordMax = Math.max(fontCoordMax, Math.abs(mine[i]! - coords[i]!))
    for (let g = 0; g < instance.advances.length; g++) {
      fontMax = Math.max(fontMax, Math.abs(variedAdvance(variations, coords, g) - instance.advances[g]!))
      fontCells++
    }
  }
  console.log(`${name}: axes ${font.axes.join(',')}${font.avar ? ' (avar 1)' : ''}, ${font.glyphs} glyphs, ${font.instances.length} instances, ` +
    `${fontCells} glyph x instance, max advance diff ${fontMax} font units, max normalized-coordinate diff ${fontCoordMax}/16384`)
  if (fontMax > TOLERANCE || fontCoordMax > 1) failed = true
  instances += font.instances.length
  cells += fontCells
  maxDiff = Math.max(maxDiff, fontMax)
  maxCoordDiff = Math.max(maxCoordDiff, fontCoordMax)
}
console.log(`total: ${paths.length} fonts, ${instances} instances, ${cells} glyph x instance, max advance diff ${maxDiff}, max coordinate diff ${maxCoordDiff}`)
console.log(failed ? 'FAIL' : 'ok')
process.exit(failed ? 1 : 0)

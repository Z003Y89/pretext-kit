// Parity sweep of pretext-kit/headless against Chromium: `npm run verify:headless`.
//
// 1. Widths: every string of headless-cases.ts in every family, weight, size and letter spacing,
//    measured by Chromium's OffscreenCanvas (fonts loaded by @font-face from test/fonts) and by the
//    stand-in in Node (the same files registered). Pass bar |Δ| <= 0.02px.
// 2. Line counts: the Latin, German (soft hyphens), French and specials corpora at widths 120-600
//    step 2, laid out by Pretext in Node (stand-in) and by Pretext in Chromium (real canvas), and
//    painted by Chromium's DOM. v1's attribution order: Node vs Chromium-Pretext first, where a
//    difference is a headless-mismatch; then Chromium-Pretext vs the DOM, where it is a pretext-gap.
// 3. Mutants: the Node side again with a mutated copy of src/headless; each must be caught.
//
// Scope rule, fixed before any run and decided without the stand-in: after Canvas's own text
// preparation (ASCII white space becomes U+0020; SHY, ZWSP, LRM, RLM, U+202A-U+202E, U+FEFF and
// U+FFFC become U+200B, plain_text_node.cc), a (text, family, weight) case is in scope exactly when
// every code point is in the cmap of the face CSS matching picks (read here with HarfBuzz's
// collectUnicodes), is Default_Ignorable_Code_Point, or is U+2028/U+2029 in a face with U+0020.
// Anything else Chromium draws from an OS fallback font, which the stand-in does not claim. Skipped
// cases are counted with the code points that put them out of scope, and the stand-in must agree
// case by case: throw HeadlessCoverageError on every skipped case and on no other.
//
// Exits 1 on any width beyond the bar, any inexact width in a 2048-upem family, any headless-mismatch,
// any scope disagreement, any face Chromium did not load, and any mutant not caught.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { release } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Blob, Face, versionString } from 'harfbuzzjs'
import { chromium } from 'playwright'
import * as wawoff2 from 'wawoff2'
import { HeadlessCoverageError, install, registerFont } from '../src/headless/index.ts'
import {
  EXACT_FAMILIES, FACES, LINE_CORPORA, LINE_FONTS, LINE_HEIGHT, LINE_SIZE, LINE_WIDTH_MAX, LINE_WIDTH_MIN, LINE_WIDTH_STEP,
  SIZES, SPACINGS, VARIABLE_FAMILIES, VARIABLE_WEIGHTS, WEIGHTS, WIDTH_FAMILIES, WIDTH_STRINGS, WIDTH_TOLERANCE, cssWeight, weightsOf,
} from './headless-cases.ts'
import type { FaceFile } from './headless-cases.ts'
import { canvasFont } from './headless-measure.ts'
import type { LineCase, WidthCase } from './headless-measure.ts'
import type { NodeInput, NodeOutput } from './headless-node.ts'
import type { LoadedFace, Painted } from './headless-page.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const facePath = (f: FaceFile): string => join(root, f.dir ?? 'test/fonts', f.file)
const dist = join(here, 'dist')
const pkg = (name: string): string => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version

const failures: string[] = []

// ---- Scope, decided without the stand-in -----------------------------------------------------------

const cmaps = new Map<FaceFile, Set<number>>()
for (const face of FACES) {
  let data = new Uint8Array(readFileSync(facePath(face)))
  if (face.format === 'woff2') data = new Uint8Array(await wawoff2.decompress(data))
  const hb = new Face(new Blob(data), 0)
  cmaps.set(face, new Set(hb.collectUnicodes()))
  // A variable face's CSS range must be its wght axis, which is what the stand-in registers it with.
  if (typeof face.weight !== 'number') {
    const wght = Object.values(hb.getAxisInfos()).find(a => a.tag === 'wght')
    if (wght === undefined || wght.min !== face.weight[0] || wght.max !== face.weight[1]) {
      failures.push(`${face.file}: wght axis ${wght === undefined ? 'missing' : `${wght.min}-${wght.max}`}, CSS declares ${cssWeight(face)}`)
    }
  }
}
const inRange = (f: FaceFile, weight: number): boolean =>
  typeof f.weight === 'number' ? f.weight === weight : f.weight[0] <= weight && weight <= f.weight[1]
const nominal = (f: FaceFile): number => (typeof f.weight === 'number' ? f.weight : f.weight[0])

// The face CSS font matching picks: the exact weight, else above 500 the nearest heavier face first,
// at or below it the nearest lighter first (CSS Fonts 4, 5.2; the 400-500 band only matters for
// requests of 400-500 between faces, which this sweep never makes).
function matchFace(family: string, weight: number): FaceFile {
  const faces = FACES.filter(f => f.family === family)
  const exact = faces.find(f => inRange(f, weight))
  if (exact !== undefined) return exact
  const heavier = faces.filter(f => nominal(f) > weight).sort((a, b) => nominal(a) - nominal(b))
  const lighter = faces.filter(f => nominal(f) < weight).sort((a, b) => nominal(b) - nominal(a))
  const pick = (weight > 500 ? [...heavier, ...lighter] : [...lighter, ...heavier])[0]
  if (pick === undefined) throw new Error(`no face for ${weight} ${family}`)
  return pick
}

const CANVAS_SPACE = [0x09, 0x0a, 0x0c, 0x0d]
const CANVAS_ZWSP = new Set([0xad, 0x200b, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0xfeff, 0xfffc])
const defaultIgnorable = /^\p{Default_Ignorable_Code_Point}$/u
const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

// The code points of a text the font does not cover, or [] when the text is in scope.
function uncovered(text: string, family: string, weight: number): string[] {
  const cmap = cmaps.get(matchFace(family, weight))!
  const out = new Set<string>()
  for (const ch of text) {
    let cp = ch.codePointAt(0)!
    if (CANVAS_SPACE.includes(cp)) cp = 0x20
    if (CANVAS_ZWSP.has(cp)) cp = 0x200b
    if (cmap.has(cp) || defaultIgnorable.test(String.fromCodePoint(cp))) continue
    if ((cp === 0x2028 || cp === 0x2029) && cmap.has(0x20)) continue
    out.add(`${hex(ch.codePointAt(0)!)} ${JSON.stringify(ch).slice(1, -1)}`)
  }
  return [...out]
}

// The stand-in, checked against that rule on every case, in scope or not.
for (const face of FACES) {
  await registerFont(face.family, new Uint8Array(readFileSync(facePath(face))), typeof face.weight === 'number' ? { weight: face.weight } : {})
}
install()
const scopeCtx = new OffscreenCanvas(1, 1).getContext('2d')!
let scopeChecked = 0
const scopeDisagreements: string[] = []
function checkScope(what: string, text: string, family: string, weight: number, inScope: boolean): void {
  scopeCtx.font = canvasFont(family, weight, 16)
  let throws = false
  try {
    scopeCtx.measureText(text)
  } catch (error) {
    if (!(error instanceof HeadlessCoverageError)) throw error
    throws = true
  }
  scopeChecked++
  if (throws === inScope) {
    scopeDisagreements.push(`${what}: the rule calls it ${inScope ? 'covered' : 'uncovered'}, the stand-in ${throws ? 'throws' : 'measures it'}`)
  }
}

type Skip = { what: string, codePoints: string[] }
const skips: { widths: Skip[], lines: Skip[] } = { widths: [], lines: [] }

type WidthMeta = { label: string }
const widthCases: (WidthCase & WidthMeta)[] = []
for (const { label, text } of WIDTH_STRINGS) {
  for (const family of WIDTH_FAMILIES) {
    for (const weight of weightsOf(family)) {
      const missing = uncovered(text, family, weight)
      checkScope(`"${label}" in ${weight} ${family}`, text, family, weight, missing.length === 0)
      if (missing.length > 0) {
        skips.widths.push({ what: `"${label}" in ${weight} ${family} (${SIZES.length * SPACINGS.length} cases)`, codePoints: missing })
        continue
      }
      for (const size of SIZES) for (const spacing of SPACINGS) widthCases.push({ label, text, family, weight, size, spacing })
    }
  }
}

type LineMeta = { corpus: string, label: string, font: string }
const lineCases: (LineCase & LineMeta)[] = []
for (const corpus of LINE_CORPORA) {
  for (const { label, text } of corpus.texts) {
    for (const f of LINE_FONTS) {
      const missing = uncovered(text, f.family, f.weight)
      checkScope(`${corpus.name} "${label}" in ${f.label}`, text, f.family, f.weight, missing.length === 0)
      if (missing.length > 0) {
        skips.lines.push({ what: `${corpus.name} "${label}" in ${f.label}`, codePoints: missing })
        continue
      }
      lineCases.push({
        corpus: corpus.name, label, font: f.label, text, family: f.family, weight: f.weight,
        size: LINE_SIZE, lineHeight: LINE_HEIGHT, letterSpacing: f.letterSpacing,
      })
    }
  }
}
const widths: number[] = []
for (let w = LINE_WIDTH_MIN; w <= LINE_WIDTH_MAX; w += LINE_WIDTH_STEP) widths.push(w)
for (const d of scopeDisagreements) failures.push(`scope: ${d}`)
const shy = lineCases.filter(c => c.text.includes('\u00AD')).length
console.log(`${widthCases.length} width cases (${skips.widths.length} string × font pairs skipped); ` +
  `${lineCases.length} texts × fonts (${shy} with soft hyphens, ${skips.lines.length} skipped) × ${widths.length} widths`)

// ---- Chromium -------------------------------------------------------------------------------

await build({
  entryPoints: [join(here, 'headless-page.ts')],
  bundle: true,
  format: 'iife',
  outfile: join(dist, 'headless-page.js'),
  logLevel: 'warning',
})

const fontFace = (f: (typeof FACES)[number]): string =>
  `@font-face { font-family: "${f.family}"; src: url("fonts/${f.file}") format("${f.format}"); font-weight: ${cssWeight(f)}; font-display: block; }`
// The probe pins every property Pretext models, as v1's sweep.html does.
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>pretext-kit headless sweep</title>
<style>
${FACES.map(fontFace).join('\n')}
body { margin: 0; }
#probe {
  position: absolute; top: 0; left: 0; margin: 0; padding: 0; border: 0;
  font-style: normal; font-variant: normal; font-stretch: normal; font-kerning: auto;
  word-spacing: normal; white-space: normal; overflow-wrap: break-word; word-break: normal;
  line-break: auto; hyphens: manual; text-align: start;
  -webkit-text-size-adjust: none; text-size-adjust: none;
}
</style>
</head>
<body>
<div id="probe"></div>
<script src="headless-page.js"></script>
</body>
</html>
`

// Served over http rather than file://, where Chromium refuses @font-face files as cross-origin.
const server = createServer((req, res) => {
  const url = req.url ?? '/'
  let body: Buffer | string | undefined
  let type = 'text/html; charset=utf-8'
  if (url === '/') body = html
  else if (url === '/headless-page.js') {
    body = readFileSync(join(dist, 'headless-page.js'))
    type = 'text/javascript; charset=utf-8'
  } else {
    const face = FACES.find(f => url === `/fonts/${f.file}`)
    if (face !== undefined) {
      body = readFileSync(facePath(face))
      type = face.format === 'woff2' ? 'font/woff2' : 'font/ttf'
    }
  }
  if (body === undefined) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': type }).end(body)
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

// Headed, as v1: headless builds differ in font fallback from what users see. `--headless` (for machines with no
// display; CI on Linux runs headed under xvfb-run instead) launches Playwright's headless Chromium, and says so in
// HEADLESS_RESULTS.md.
const headless = process.argv.includes('--headless')
const browser = await chromium.launch({ headless })
const browserVersion = browser.version()
const page = await browser.newPage()
page.on('pageerror', e => failures.push(`page error: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') console.error(`[chromium] ${m.text()}`) })
await page.goto(origin)
const loaded: LoadedFace[] = await page.evaluate(faces => window.hx.load(faces), FACES.map(f => ({ family: f.family, weight: nominal(f) })))
for (const f of FACES) {
  const hit = loaded.find(l => l.family.replace(/"/g, '') === f.family && l.weight === cssWeight(f))
  if (hit?.status !== 'loaded') failures.push(`Chromium did not load ${f.file} as ${cssWeight(f)} "${f.family}" (${hit?.status ?? 'not declared'})`)
}
const strip = <T extends object>(cases: T[], keys: string[]): T[] =>
  cases.map(c => Object.fromEntries(Object.entries(c).filter(([k]) => !keys.includes(k))) as T)
const plainWidthCases: WidthCase[] = strip(widthCases, ['label'])
const plainLineCases: LineCase[] = strip(lineCases, ['corpus', 'label', 'font'])
let t0 = performance.now()
const chromeWidths: number[] = await page.evaluate(cases => window.hx.widths(cases), plainWidthCases)
const chromePretext: number[][] = await page.evaluate(([cases, ws]) => window.hx.pretextLines(cases, ws), [plainLineCases, widths] as const)
const dom: Painted[][] = await page.evaluate(([cases, ws]) => window.hx.domLines(cases, ws), [plainLineCases, widths] as const)
console.log(`Chromium ${browserVersion}: ${((performance.now() - t0) / 1000).toFixed(1)}s`)
await browser.close()
server.close()

// ---- Node: the stand-in, then each mutant -----------------------------------------------------

mkdirSync(dist, { recursive: true })
const inputPath = join(dist, 'headless-input.json')
const input: NodeInput = { root, faces: FACES, widthCases: plainWidthCases, lineCases: plainLineCases, widths }
writeFileSync(inputPath, JSON.stringify(input))

function runNode(modulePath: string, name: string): NodeOutput {
  const out = join(dist, `headless-output-${name}.json`)
  execFileSync(process.execPath, [join(here, 'headless-node.ts'), modulePath, inputPath, out], { stdio: 'inherit' })
  return JSON.parse(readFileSync(out, 'utf8'))
}

// lines: whether the mutant must also change a Pretext line count. Dropping the U+0020 cut cannot:
// Pretext measures every space as a segment of its own and never hands Canvas a U+0020 beside other
// text (the Node run records this; it fails below if that ever changes), so only the width sweep,
// which measures strings with spaces, can see it.
type Mutant = { name: string, file: string, from: string, to: string, lines: boolean }
const MUTANTS: Mutant[] = [
  {
    name: 'drop kerning',
    file: 'canvas.ts',
    from: "if (fontKerning === 'none') features.push(new Feature('kern', 0))",
    to: "features.push(new Feature('kern', 0))",
    lines: true,
  },
  {
    name: 'ignore weight',
    file: 'canvas.ts',
    from: 'findFace(parsed.families[i]!, parsed.weight, style)',
    to: 'findFace(parsed.families[i]!, 400, style)',
    lines: true,
  },
  {
    name: 'drop the U+0020 word cut',
    file: 'canvas.ts',
    from: 'return codePoint === 0x20 || codePoint === ZWSP ||',
    to: 'return codePoint === ZWSP ||',
    lines: false,
  },
]

// A mutated copy of src/headless under verify/dist, so src is never edited and nothing needs reverting.
function mutate(m: Mutant): string {
  const dir = join(dist, 'mutants', m.name.replace(/\W+/g, '-'))
  cpSync(join(root, 'src/headless'), dir, { recursive: true })
  const path = join(dir, m.file)
  const source = readFileSync(path, 'utf8')
  const parts = source.split(m.from)
  if (parts.length !== 2) throw new Error(`mutant "${m.name}": expected one occurrence in ${m.file}, found ${parts.length - 1}`)
  writeFileSync(path, parts.join(m.to))
  return join(dir, 'index.ts')
}

t0 = performance.now()
const node = runNode(join(root, 'src/headless/index.ts'), 'stand-in')
console.log(`Node stand-in: ${((performance.now() - t0) / 1000).toFixed(1)}s`)

// ---- Comparison ---------------------------------------------------------------------------------

type WidthMiss = { c: WidthCase & WidthMeta, chrome: number, node: number }
function compareWidths(nodeWidths: number[]): { exact: number, max: number, misses: WidthMiss[] } {
  let exact = 0
  let max = 0
  const misses: WidthMiss[] = []
  widthCases.forEach((c, i) => {
    const delta = Math.abs(nodeWidths[i]! - chromeWidths[i]!)
    if (delta === 0) exact++
    max = Math.max(max, delta)
    if (!(delta <= WIDTH_TOLERANCE)) misses.push({ c, chrome: chromeWidths[i]!, node: nodeWidths[i]! })
  })
  return { exact, max, misses }
}

type Outcome = 'pass' | 'headless-mismatch' | 'pretext-gap' | 'unreliable'
type LineResult = { c: LineCase & LineMeta, width: number, outcome: Outcome, node: number, chrome: number, dom: Painted }
function compareLines(nodeLines: number[][]): LineResult[] {
  const out: LineResult[] = []
  lineCases.forEach((c, i) => {
    widths.forEach((width, j) => {
      const n = nodeLines[i]![j]!
      const ch = chromePretext[i]![j]!
      const d = dom[i]![j]!
      const outcome: Outcome = n !== ch ? 'headless-mismatch' : d.lines < 0 ? 'unreliable' : ch !== d.lines ? 'pretext-gap' : 'pass'
      out.push({ c, width, outcome, node: n, chrome: ch, dom: d })
    })
  })
  return out
}

const widthResult = compareWidths(node.widths)
const lineResults = compareLines(node.lines)
const count = (rs: LineResult[], o: Outcome): number => rs.filter(r => r.outcome === o).length

type MutantResult = { m: Mutant, widthMisses: number, maxDelta: number, mismatches: number, example?: LineResult }
const mutantResults: MutantResult[] = []
for (const m of MUTANTS) {
  const out = runNode(mutate(m), m.name.replace(/\W+/g, '-'))
  const w = compareWidths(out.widths)
  const l = compareLines(out.lines).filter(r => r.outcome === 'headless-mismatch')
  const r: MutantResult = { m, widthMisses: w.misses.length, maxDelta: w.max, mismatches: l.length }
  if (l[0] !== undefined) r.example = l[0]
  mutantResults.push(r)
  console.log(`mutant "${m.name}": ${w.misses.length} width misses (max ${w.max.toFixed(4)}px), ${l.length} headless-mismatches`)
  // Caught: Node differs from Chromium somewhere, and in line counts too where it can.
  if (w.misses.length + l.length === 0) failures.push(`mutant "${m.name}" changed no width and no line count`)
  if (m.lines && l.length === 0) failures.push(`mutant "${m.name}" produced no line-count headless-mismatch`)
}

// The word-cut mutant is exempt from line counts only while Pretext measures no U+0020 beside text.
if (node.spaced.length > 0) failures.push(`Pretext measured ${node.spaced.length} strings with a U+0020 beside text, e.g. ${JSON.stringify(node.spaced[0])}; make the word-cut mutant's lines true`)
if (widthResult.misses.length > 0) failures.push(`${widthResult.misses.length} widths beyond ${WIDTH_TOLERANCE}px`)
// The bit-exactness tripwire for the 2048-upem families.
const inexact = widthCases.flatMap((c, i) => (EXACT_FAMILIES.includes(c.family) && node.widths[i] !== chromeWidths[i] ? [{ c, i }] : []))
if (inexact.length > 0) failures.push(`${inexact.length} inexact widths in ${EXACT_FAMILIES.join(', ')}, e.g. "${inexact[0]!.c.label}"`)
const mismatches = count(lineResults, 'headless-mismatch')
if (mismatches > 0) failures.push(`${mismatches} headless-mismatch cases`)

// ---- Findings Chromium alone answers --------------------------------------------------------------

// Invisible and separator characters spelled as escapes, so listings stay readable.
const show = (text: string): string =>
  '"' + text.replace(/[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\uFEFF]/g, ch => `\\u${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`) + '"'
const px = (n: number): string => `${Number(n.toFixed(6))}`
const chromeAt = (text: string, family: string, weight = 400, size = 16, spacing = 0): number | undefined => {
  const i = widthCases.findIndex(c => c.text === text && c.family === family && c.weight === weight && c.size === size && c.spacing === spacing)
  return i < 0 ? undefined : chromeWidths[i]
}
const nodeAt = (text: string, family: string): number | undefined => {
  const i = widthCases.findIndex(c => c.text === text && c.family === family && c.weight === 400 && c.size === 16 && c.spacing === 0)
  return i < 0 ? undefined : node.widths[i]
}

// Synthetic bold: HX Inter and HX Roboto have one face each, so Chromium synthesizes 600 and 700 from it.
const singleFace = WIDTH_FAMILIES.filter(f => {
  const faces = FACES.filter(face => face.family === f)
  return faces.length === 1 && typeof faces[0]!.weight === 'number'
})
const boldChanged: string[] = []
let boldCompared = 0
widthCases.forEach((c, i) => {
  if (!singleFace.includes(c.family) || c.weight === 400) return
  const regular = chromeAt(c.text, c.family, 400, c.size, c.spacing)
  if (regular === undefined) return
  boldCompared++
  if (regular !== chromeWidths[i]) boldChanged.push(`${c.label} ${c.weight} ${c.size}px ${c.family}: ${px(chromeWidths[i]!)} vs 400 ${px(regular)}`)
})

// U+2029 against U+2028 in Chromium itself, in every family, weight, size and spacing: alone, between
// letters, and between Roboto's x and T, which kern with the space glyph only when no word cut separates them.
const PAIRS: [string, string][] = [['\u2029', '\u2028'], ['a\u2029b', 'a\u2028b'], ['x\u2029T\u2029x', 'x\u2028T\u2028x']]
let separatorCompared = 0
const separatorDiffer: string[] = []
widthCases.forEach((c, i) => {
  const pair = PAIRS.find(([ps]) => ps === c.text)
  if (pair === undefined) return
  const j = widthCases.findIndex(o => o.text === pair[1] && o.family === c.family && o.weight === c.weight && o.size === c.size && o.spacing === c.spacing)
  if (j < 0) return
  separatorCompared++
  if (chromeWidths[i] !== chromeWidths[j]) separatorDiffer.push(`${c.label} ${canvasFont(c.family, c.weight, c.size)} spacing ${c.spacing}px: ${px(chromeWidths[i]!)} vs U+2028 ${px(chromeWidths[j]!)}`)
})

// Synthetic bold in the DOM: Inter 700's painted line counts against Inter 400's, text by text.
let domBoldCompared = 0
let domBoldSame = 0
lineCases.forEach((c, i) => {
  if (c.font !== 'Inter 700') return
  const j = lineCases.findIndex(o => o.font === 'Inter 400' && o.corpus === c.corpus && o.label === c.label)
  if (j < 0) return
  widths.forEach((_, k) => {
    domBoldCompared++
    if (dom[i]![k]!.lines === dom[j]![k]!.lines) domBoldSame++
  })
})

const separatorRows: string[] = []
for (const family of WIDTH_FAMILIES) {
  const cells = [' ', 'a b', 'a\u2028b', 'a\u2029b', '\u2028', '\u2029', 'x T x', 'x\u2028T\u2028x', 'x\u2029T\u2029x']
    .map(t => `${px(chromeAt(t, family) ?? NaN)} / ${px(nodeAt(t, family) ?? NaN)}`)
  separatorRows.push(`| ${family} | ${cells.join(' | ')} |`)
}

// ---- HEADLESS_RESULTS.md --------------------------------------------------------------------------

function ranged(rs: LineResult[]): string[] {
  const out: string[] = []
  let open: { head: string, detail: string, from: number, to: number } | undefined
  const flush = (): void => {
    if (open !== undefined) out.push(`- ${open.head} @ ${open.from === open.to ? `${open.from}px` : `${open.from}-${open.to}px`}: ${open.detail}`)
  }
  for (const r of rs) {
    const head = `${r.c.font} / ${r.c.corpus} "${r.c.label}"`
    const detail = r.outcome === 'headless-mismatch'
      ? `Node ${r.node}, Chromium-Pretext ${r.chrome}, DOM ${r.dom.lines}`
      : r.outcome === 'unreliable' ? `height ${r.dom.height}` : `Pretext ${r.chrome}, DOM ${r.dom.lines}`
    if (open !== undefined && open.head === head && open.detail === detail && open.to + LINE_WIDTH_STEP === r.width) {
      open.to = r.width
      continue
    }
    flush()
    open = { head, detail, from: r.width, to: r.width }
  }
  flush()
  return out
}

// The OS line of HEADLESS_RESULTS.md: macOS's product version, or the platform and kernel release elsewhere.
const osLabel = (() => {
  if (process.platform === 'darwin') {
    return `macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()} (Darwin ${release()})`
  }
  return `${process.platform === 'win32' ? 'Windows' : process.platform === 'linux' ? 'Linux' : process.platform} ${release()}`
})()
const pretextCommit = (() => {
  try {
    return execFileSync('git', ['-C', join(root, '../pretext'), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown commit'
  }
})()

const fonts = [...new Set(lineCases.map(c => c.font))]
const corpora = [...new Set(lineCases.map(c => c.corpus))]
const lineTable = (label: string, rs: LineResult[]): string =>
  `| ${label} | ${rs.length} | ${count(rs, 'pass')} | ${count(rs, 'headless-mismatch')} | ${count(rs, 'pretext-gap')} | ${count(rs, 'unreliable')} |`
const familyTable = WIDTH_FAMILIES.map(family => {
  const idx = widthCases.map((c, i) => (c.family === family ? i : -1)).filter(i => i >= 0)
  const deltas = idx.map(i => Math.abs(node.widths[i]! - chromeWidths[i]!))
  const exact = deltas.filter(d => d === 0).length
  const max = deltas.reduce((a, b) => Math.max(a, b), 0)
  const misses = deltas.filter(d => !(d <= WIDTH_TOLERANCE)).length
  return `| ${family} | ${idx.length} | ${exact} | ${px(max)} | ${misses} |`
})
// The variable family by instance: the default (400) and the interpolated ones.
const variableTable = VARIABLE_FAMILIES.flatMap(family => VARIABLE_WEIGHTS.map(weight => {
  const idx = widthCases.map((c, i) => (c.family === family && c.weight === weight ? i : -1)).filter(i => i >= 0)
  const deltas = idx.map(i => Math.abs(node.widths[i]! - chromeWidths[i]!))
  const max = deltas.reduce((a, b) => Math.max(a, b), 0)
  const lines = lineResults.filter(r => r.c.family === family && r.c.weight === weight)
  return `| ${family} ${weight} | ${idx.length} | ${deltas.filter(d => d === 0).length} | ${px(max)} | ${deltas.filter(d => !(d <= WIDTH_TOLERANCE)).length} | ` +
    `${lines.length} | ${count(lines, 'headless-mismatch')} | ${count(lines, 'pretext-gap')} |`
}))
const nodeVsDom = lineResults.filter(r => r.dom.lines >= 0 && r.node !== r.dom.lines).length

// A | inside a table cell ends the cell, even in a code span.
const cell = (text: string): string => text.replaceAll('|', '\\|')
const caught = (r: MutantResult): boolean => r.widthMisses + r.mismatches > 0 && (!r.m.lines || r.mismatches > 0)

const md: string[] = [
  '# Headless parity sweep results',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} by \`npm run verify:headless\` (verify/headless.ts).`,
  '',
  `- Chromium ${browserVersion} (Playwright ${pkg('playwright')}, ${headless ? 'headless' : 'headed'}), \`<html lang="en">\``,
  `- harfbuzzjs ${pkg('harfbuzzjs')} (HarfBuzz ${versionString()}), wawoff2 ${pkg('wawoff2')}`,
  `- Pretext ${pkg('@chenglou/pretext')} (../pretext ${pretextCommit}), \`setLocale('en')\` on both sides`,
  `- Node ${process.version}, ${osLabel}, ${process.arch}`,
  '',
  'Fonts: test/fonts, loaded in Chromium through `@font-face` from the same files the stand-in registers, each',
  'awaited with `document.fonts.load` and checked `loaded`: ' +
    FACES.map(f => `${f.file} as ${cssWeight(f)} "${f.family}"`).join(', ') + '.',
  'Every family name carries an "HX " prefix on both sides, so no installed Inter or Roboto can stand in for a file; the',
  'family Canvas reads back must equal the one set. Inter and Roboto have one face, so Chromium synthesizes 600 and 700;',
  'Shantell Sans has a 400 and a 700 face (added for this sweep so that a stand-in ignoring the requested weight can be',
  'caught at all).',
  '',
  '**Scope rule (fixed before the first run), decided without the stand-in.** After Canvas\'s own text preparation (ASCII',
  'white space becomes U+0020; SHY, ZWSP, LRM, RLM, U+202A-U+202E, U+FEFF and U+FFFC become U+200B), a (text, font) case is',
  'in scope exactly when every code point is in the cmap of the face CSS matching picks (HarfBuzz `collectUnicodes` on',
  'the font file, WOFF2 decompressed), is Default_Ignorable_Code_Point, or is U+2028/U+2029 in a face with U+0020.',
  'Anything else Chromium draws from an OS fallback font, which the stand-in does not claim to reproduce. The skip lists',
  'below come from this rule. The stand-in is then checked against it case by case: it must throw',
  `\`HeadlessCoverageError\` on every skipped case and on no other. ${scopeChecked} cases checked, ${scopeDisagreements.length} disagreements` +
    (scopeDisagreements.length === 0 ? '.' : ':'),
  ...scopeDisagreements.map(d => `- ${d}`),
  '',
  '**Stand-in bug this sweep found, fixed in src/headless/canvas.ts.** Under letter spacing the stand-in added the spacing',
  'after U+200B and every character Canvas turns into it (SHY, LRM, RLM, U+202A-U+202E, U+FEFF), where Chromium adds none',
  '(Blink skips characters it treats as zero-width spaces): 288 width cases were 0.5px per such character too wide, up to',
  '2.5px for a five-SHY word. Regression test: "letter spacing skips ZWSP and what Canvas turns into it" in',
  'test/headless/canvas.test.ts, which fails without the fix. Pretext\'s own line counts never showed it: Pretext measures',
  'those characters as segments of their own.',
  '',
  '## Widths',
  '',
  `${WIDTH_STRINGS.length} strings × ${WIDTH_FAMILIES.length} families × weights ${WEIGHTS.join('/')} (${VARIABLE_FAMILIES.join(', ')}: ${VARIABLE_WEIGHTS.join('/')}) × sizes ${SIZES.join('/')}px ×`,
  `letter spacing ${SPACINGS.map(s => `${s}px`).join('/')}: **${widthCases.length} cases, ${widthResult.exact} exact, max |Δ| ${px(widthResult.max)}px,`,
  `${widthResult.misses.length} beyond ${WIDTH_TOLERANCE}px.** Chromium's OffscreenCanvas \`measureText\` against the stand-in's.`,
  '',
  `Strings: ${WIDTH_STRINGS.map(s => show(s.text)).join(', ')}.`,
  '',
  `Tripwire beside the bar: ${EXACT_FAMILIES.join(', ')} (2048 units per em, so every advance is a dyadic fraction of a`,
  `pixel) must measure bit-exact; ${inexact.length} inexact. Shantell Sans (1000 units per em) differs by under 0.0005px in`,
  'most cases: its advances are not dyadic fractions of a pixel, and Chromium rounds them differently from HarfBuzz\'s',
  '1/65536 px; far below the bar and never a line count.',
  '',
  '| family | cases | exact | max abs Δ px | > 0.02px |',
  '|---|---:|---:|---:|---:|',
  ...familyTable,
  '',
  'Variable font (@fontsource-variable/inter ' + pkg('@fontsource-variable/inter') + ', its latin subset as one variable face, wght 100-900;',
  'loaded in Chromium with `font-weight: 100 900`, registered in Node with no weight so the stand-in reads the axis) by',
  'instance: widths as above, line counts as in the next section.',
  '',
  '| instance | width cases | exact | max abs Δ px | > 0.02px | line cases | headless-mismatch | pretext-gap |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...variableTable,
  '',
  `Skipped (out of scope): ${skips.widths.length} string × font pairs.`,
  '',
  ...skips.widths.map(s => `- ${s.what}: ${s.codePoints.join(', ')}`),
  '',
  '### Width misses',
  '',
  ...(widthResult.misses.length === 0
    ? ['None.']
    : widthResult.misses.map(m => `- "${m.c.label}" ${canvasFont(m.c.family, m.c.weight, m.c.size)} spacing ${m.c.spacing}px: Chromium ${px(m.chrome)}, stand-in ${px(m.node)}`)),
  '',
  '## Line counts',
  '',
  `${lineCases.length} text × font pairs (${shy} with soft hyphens) × ${widths.length} widths (${LINE_WIDTH_MIN}-${LINE_WIDTH_MAX}px step`,
  `${LINE_WIDTH_STEP}), ${LINE_SIZE}px on ${LINE_HEIGHT}px lines. Fonts: ${LINE_FONTS.map(f => f.label).join(', ')}.`,
  `**${lineResults.length} cases: ${count(lineResults, 'headless-mismatch')} headless-mismatch, ${count(lineResults, 'pretext-gap')} pretext-gap,`,
  `${count(lineResults, 'unreliable')} unreliable, ${count(lineResults, 'pass')} pass.** Pretext in Node against Chromium's DOM directly: ${nodeVsDom} differ`,
  '(each one a pretext-gap above, or a headless-mismatch).',
  '',
  'A `headless-mismatch` is Pretext in Node (stand-in) laying out a different line count from Pretext in Chromium',
  '(real canvas); a `pretext-gap` is Pretext in Chromium differing from what Chromium paints, with Node agreeing with',
  'Chromium-Pretext; `unreliable` is a painted height that is no whole number of lines.',
  '',
  '| | cases | pass | headless-mismatch | pretext-gap | unreliable |',
  '|---|---:|---:|---:|---:|---:|',
  ...fonts.map(f => lineTable(f, lineResults.filter(r => r.c.font === f))),
  ...corpora.map(c => lineTable(`corpus ${c}`, lineResults.filter(r => r.c.corpus === c))),
  '',
  `Skipped (out of scope): ${skips.lines.length} text × font pairs.`,
  '',
  ...skips.lines.map(s => `- ${s.what}: ${s.codePoints.join(', ')}`),
  '',
  '### headless-mismatch cases',
  '',
  ...(mismatches === 0 ? ['None.'] : ranged(lineResults.filter(r => r.outcome === 'headless-mismatch'))),
  '',
  '### pretext-gap cases',
  '',
  'Not investigated case by case. Each is Pretext in Chromium against Chromium\'s painting, with Node agreeing with',
  'Chromium-Pretext, so each is attributed to Pretext vs the DOM, not to the stand-in. That includes the Shantell Sans',
  'cluster (most of the gaps, against about 0.1% of Inter cases), which is uninvestigated.',
  '',
  ...(count(lineResults, 'pretext-gap') === 0 ? ['None.'] : ranged(lineResults.filter(r => r.outcome === 'pretext-gap'))),
  '',
  '### unreliable cases',
  '',
  ...(count(lineResults, 'unreliable') === 0 ? ['None.'] : ranged(lineResults.filter(r => r.outcome === 'unreliable'))),
  '',
  '## U+2028 and U+2029',
  '',
  `Chromium measures every U+2029 string exactly as the same string with U+2028 in ${separatorCompared - separatorDiffer.length} of`,
  `${separatorCompared} family × weight × size × spacing cases (U+2029 alone, "a¶b", "x¶T¶x"): it draws U+2029 with the space glyph`,
  'and without a word cut, as it does U+2028 (in Roboto "x¶T¶x" kerns T with the space glyph, narrower than "x T x").',
  'The stand-in already treats U+2029 so; no change was needed.',
  ...(separatorDiffer.length === 0 ? [] : ['', ...separatorDiffer.map(s => `- ${s}`)]),
  '',
  'Chromium / stand-in widths at 400 16px, no spacing (NaN: out of scope):',
  '',
  '| family | " " | "a b" | "a⏎b" U+2028 | "a¶b" U+2029 | U+2028 | U+2029 | "x T x" | "x␤T␤x" U+2028 | "x¶T¶x" U+2029 |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...separatorRows,
  '',
  '## Synthetic bold',
  '',
  `${singleFace.join(', ')} at 600 and 700, synthesized by Chromium from the one 400 face, against Chromium's own 400 width of`,
  `the same string, size and spacing: ${boldCompared - boldChanged.length} of ${boldCompared} equal, so synthetic bold does not change Canvas advances`,
  `here${boldChanged.length === 0 ? '' : ' except as listed'}. In the DOM, Inter 700 paints the same line count as Inter 400 in ${domBoldSame} of ${domBoldCompared}`,
  'text × width cases.',
  ...(boldChanged.length === 0 ? [] : ['', ...boldChanged.map(s => `- ${s}`)]),
  '',
  '## Mutants',
  '',
  'Each mutant is a copy of src/headless under verify/dist/mutants with one edit (src itself is never edited), run as the',
  'Node side of the same sweep against the same Chromium data. A mutant is caught when it produces widths beyond the bar',
  'or line-count headless-mismatches; the first two must produce line-count headless-mismatches. Dropping the U+0020',
  'cut cannot change a Pretext line count: Pretext measures each space as a segment of its own and never hands Canvas a',
  `U+0020 beside other text (${node.spaced.length} of the ${node.measured} distinct strings it measured for the line cases here),`,
  'so only the width sweep sees it, through Roboto, which kerns with the space glyph.',
  '',
  '| mutant | edit in canvas.ts | width cases > 0.02px | max abs Δ px | headless-mismatch | caught |',
  '|---|---|---:|---:|---:|---|',
  ...mutantResults.map(r =>
    `| ${r.m.name} | \`${cell(r.m.from)}\` → \`${cell(r.m.to)}\` | ${r.widthMisses} | ${px(r.maxDelta)} | ${r.mismatches} | ${caught(r) ? 'yes' : '**no**'} |`),
  '',
  ...mutantResults.filter(r => r.example !== undefined).map(r =>
    `- ${r.m.name}, e.g. ${r.example!.c.font} / ${r.example!.c.corpus} "${r.example!.c.label}" @ ${r.example!.width}px: Node ${r.example!.node}, Chromium-Pretext ${r.example!.chrome}`),
  '',
]
writeFileSync(join(here, 'HEADLESS_RESULTS.md'), md.join('\n'))
console.log('wrote verify/HEADLESS_RESULTS.md')
console.log(`widths: ${widthCases.length} cases, ${widthResult.exact} exact, max ${px(widthResult.max)}px, ${widthResult.misses.length} misses`)
console.log(`lines: ${lineResults.length} cases, ${mismatches} headless-mismatch, ${count(lineResults, 'pretext-gap')} pretext-gap, ${count(lineResults, 'unreliable')} unreliable`)
for (const f of failures) console.log(`FAIL ${f}`)
if (failures.length > 0) process.exitCode = 1

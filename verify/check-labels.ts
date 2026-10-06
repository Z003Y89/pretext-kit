// Oracle sweep of the label checker (pretext-kit/check) against Chromium: `npm run verify:check`.
//
// About 2,300 label texts (every run of whole words of at most 40 characters in the Latin, German and French
// corpora, plus 60 toolbar and tab labels) in seven slots each, one per policy (as-is, shrinkTo, lines, truncate
// end, truncate middle, and lines and truncate end again with overflow-wrap: normal), at 0.9/1/1.1 of the width
// where that policy changes its verdict, under text scales
// 1/1.15/1.3 by zoom 1/1.3; and a five-item toolbar row per locale at every collapse stage's boundary.
//
// Each case is judged three ways: by the checker (checkLabels in Node, the stand-in measuring Inter from
// test/fonts); by the reference, the spec's rule recomputed with the kit's own helpers on Pretext inside Chromium
// (real canvas, the same file by @font-face); and by Chromium's DOM, a real element styled as the slot (text scale as
// a font-size change in a fixed-width box, zoom as CSS zoom on the container). Attribution as EVALUATION §2: the
// checker against the reference first, where a difference is a check-mismatch; then the reference against the DOM,
// where a difference is a pretext-gap. Mutants: the checker side again from a mutated copy of src under
// verify/dist/mutants; each must produce check-mismatches.
//
// Exits 1 on any check-mismatch, any mutant not caught, a font Chromium did not load and a page error.
//
//   npm run verify:check [-- --headless]       PW_CHROMIUM=<path> picks the Chromium executable
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { availableParallelism, release } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import type { Label, Platform, RowMap, Slot } from '../src/check/types.ts'
import { clopperPearsonUpper, pct, wilsonUpper } from './bounds.ts'
import {
  FACTORS, FAMILY, FONT_FILE, HAND_LABELS, ICON_WIDTH, LINE_HEIGHT_RATIO, LINES, MAX_CHARS, MUTANTS, NORMAL_WRAP, POLICIES, ROW_FAMILY, ROW_GAP,
  ROW_STYLE, SHRINK_BY, TEXT_SCALES, TNUM_FAMILY, ZOOMS, applyMutant, conditions, rowTotal, rowWidths, slotCases, stageWidths,
  sweepTexts, vacuousCells,
} from './check-labels-cases.ts'
import type { ConditionKind, Locale, Mutant, PolicyName, SlotCase, Style, SweepCondition } from './check-labels-cases.ts'
import type { NodeGroup, NodeInput, NodeOutput } from './check-labels-node.ts'
import type { LoadedFace, PageCase, PageResult, PageRow, RowResult } from './check-labels-page.ts'
import { CORPORA } from './corpora.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dist = join(here, 'dist')
const fontPath = join(root, 'test/fonts', FONT_FILE)
const pkg = (name: string): string => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version
const failures: string[] = []

const platform: Platform | null = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : process.platform === 'linux' ? 'linux' : null
if (platform === null) throw new Error(`verify:check: no checker platform for ${process.platform}; run it on macOS, Windows or Linux`)

// The commit the sweep runs from, read before anything runs, and whether the working tree (this file's output
// aside) differs from it.
const kitCommit = (() => {
  try {
    const head = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
    const status = ['-C', root, 'status', '--porcelain', '--untracked-files=no', '--', '.', ':!verify/CHECK_RESULTS.md']
    const dirty = execFileSync('git', status, { encoding: 'utf8' }).trim() !== ''
    return dirty ? `${head} with uncommitted changes` : head
  } catch {
    return 'unknown commit'
  }
})()
const texts = sweepTexts(CORPORA)
const conds = conditions()

// ---- Chromium -------------------------------------------------------------------------------------------

await build({ entryPoints: [join(here, 'check-labels-page.ts')], bundle: true, format: 'iife', outfile: join(dist, 'check-labels-page.js'), logLevel: 'warning' })

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>pretext-kit label checker sweep</title>
<style>
@font-face { font-family: "${FAMILY}"; src: url("fonts/${FONT_FILE}") format("truetype"); font-weight: 400; font-display: block; }
@font-face { font-family: "${TNUM_FAMILY}"; src: url("fonts/${FONT_FILE}") format("truetype"); font-weight: 400; font-display: block; font-feature-settings: "tnum" 1; }
body { margin: 0; }
#host { position: absolute; top: 0; left: 0; }
.slot, .row {
  font-family: "${FAMILY}"; font-weight: 400; font-style: normal; font-variant: normal; font-stretch: normal; font-kerning: auto;
  word-spacing: normal; text-align: start; margin: 0; padding: 0; border: 0;
  -webkit-text-size-adjust: none; text-size-adjust: none;
}
.slot { display: flex; }
.icon { flex: none; display: block; height: 1px; }
.text { flex: 1 1 0; min-width: 0; margin: 0; padding: 0; border: 0; }
.nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; line-break: auto; hyphens: manual; }
.clamp {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${LINES}; overflow: hidden; text-overflow: ellipsis;
  white-space: normal; overflow-wrap: break-word; word-break: normal; line-break: auto; hyphens: manual;
}
.wrap.normal, .clamp.normal { overflow-wrap: normal; }
.row { display: flex; flex-wrap: nowrap; overflow: hidden; white-space: nowrap; }
.item { flex: none; display: flex; }
</style>
</head>
<body>
<div id="host"></div>
<script src="check-labels-page.js"></script>
</body>
</html>
`

// Served over http rather than file://, where Chromium refuses @font-face files as cross-origin (as headless.ts).
const server = createServer((req, res) => {
  const url = req.url ?? '/'
  const found: [Buffer | string, string] | undefined = url === '/'
    ? [html, 'text/html; charset=utf-8']
    : url === '/check-labels-page.js'
      ? [readFileSync(join(dist, 'check-labels-page.js')), 'text/javascript; charset=utf-8']
      : url === `/fonts/${FONT_FILE}` ? [readFileSync(fontPath), 'font/ttf'] : undefined
  if (found === undefined) res.writeHead(404).end()
  else res.writeHead(200, { 'content-type': found[1] }).end(found[0])
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

// Headed, as verify:headless (CI on Linux runs it under xvfb-run); --headless for a machine with no display, and
// CHECK_RESULTS.md says which.
const headless = process.argv.includes('--headless')
const executablePath = process.env.PW_CHROMIUM
const browser = await chromium.launch({ headless, ...(executablePath === undefined ? {} : { executablePath }) })
const browserVersion = browser.version()
const page = await browser.newPage()
page.on('pageerror', e => failures.push(`page error: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') console.error(`[chromium] ${m.text()}`) })
await page.goto(origin)
const loaded: LoadedFace[] = await page.evaluate(fs => window.ck.load(fs), [FAMILY, TNUM_FAMILY])
for (const family of [FAMILY, TNUM_FAMILY]) {
  const hit = loaded.find(l => l.family === family)
  if (hit?.status !== 'loaded') failures.push(`Chromium did not load ${FONT_FILE} as "${family}" (${hit?.status ?? 'not declared'})`)
}

let t0 = performance.now()
// Each text scale's slots sit at that scale's boundaries, measured by the kit on Pretext in the page (never by
// src/check); a slot is run in its text scale's conditions, zoom 100% and 130%.
const items = texts.map(t => ({ text: t.text, locale: t.locale, style: t.style }))
const measured = []
for (const scale of TEXT_SCALES) measured.push(await page.evaluate(([xs, s]) => window.ck.measure(xs, s), [items, scale] as const))
// A slot whose icon would leave no box if zoom grew the icon but not the box is invalid to the zoom mutant (the
// checker throws on a box of 0 or less): not run, listed in CHECK_RESULTS.md.
const MAX_ZOOM = Math.max(...ZOOMS)
const allCases = slotCases(texts, measured)
const zoomMutantBox = (c: SlotCase): number => c.width - texts[c.text]!.style.reserve * c.scale * MAX_ZOOM
const cases = allCases.filter(c => zoomMutantBox(c) > 0)
const invalid = allCases.filter(c => !(zoomMutantBox(c) > 0))

// The row family: one row per locale, text scale and width, its widths from the items measured at that text scale.
type RowCase = { name: string, locale: Locale, scale: number, width: number, stages: number }
const rowCases: RowCase[] = []
for (const scale of TEXT_SCALES) {
  for (const locale of Object.keys(ROW_FAMILY) as Locale[]) {
    const defs = ROW_FAMILY[locale]
    const all = defs.flatMap(i => [i.text, ...(i.short === undefined ? [] : [i.short])])
    const widths = await page.evaluate(([xs, s]) => window.ck.naturals(xs, s), [all.map(text => ({ text, locale, style: ROW_STYLE })), scale] as const)
    const of = (text: string): number => widths[all.indexOf(text)]! + ROW_STYLE.reserve * scale
    const stages = stageWidths(defs, defs.map(i => of(i.text)), defs.map(i => (i.short === undefined ? undefined : of(i.short))), ICON_WIDTH * scale)
    rowWidths(stages.map(s => rowTotal(s, ROW_GAP))).forEach((width, i) => rowCases.push({ name: `row.${locale}.${scale}.${i}`, locale, scale, width, stages: stages.length - 1 }))
  }
}
const casesAt = conds.map(c => cases.filter(x => x.scale === c.textScale))
const rowsAt = conds.map(c => rowCases.filter(r => r.scale === c.textScale))
const rowOf = (r: RowCase): PageRow => ({
  locale: r.locale, width: r.width, gap: ROW_GAP, iconWidth: ICON_WIDTH, style: ROW_STYLE,
  items: ROW_FAMILY[r.locale].map(i => ({ text: i.text, ...(i.short === undefined ? {} : { short: i.short }), ...(i.order === undefined ? {} : { order: i.order }) })),
})

const pageCase = (c: SlotCase): PageCase => {
  const t = texts[c.text]!
  return { text: t.text, locale: t.locale, style: t.style, policy: c.policy, width: c.width }
}
const CHUNK = 3000
const pageLabels: PageResult[][] = []
const pageRows: RowResult[][] = []
for (const [j, cond] of conds.entries()) {
  const out: PageResult[] = []
  for (let i = 0; i < casesAt[j]!.length; i += CHUNK) {
    const chunk = casesAt[j]!.slice(i, i + CHUNK).map(pageCase)
    out.push(...await page.evaluate(([cs, c]) => window.ck.labels(cs, c), [chunk, cond] as const))
  }
  pageLabels.push(out)
  pageRows.push(await page.evaluate(([rs, c]) => window.ck.rows(rs, c), [rowsAt[j]!.map(rowOf), cond] as const))
  console.log(`Chromium ${cond.name}: ${out.length} slot cases, ${rowsAt[j]!.length} rows (${((performance.now() - t0) / 1000).toFixed(1)}s)`)
}
const chromiumSeconds = (performance.now() - t0) / 1000
await browser.close()
server.close()

// ---- Node: the checker, then each mutant ---------------------------------------------------------------

const fontOf = (style: Style): string => `${style.size}px "${FAMILY}"`
const policyOf = (p: PolicyName, style: Style): Slot['policy'] =>
  p === 'as-is' ? 'as-is'
    : p === 'shrinkTo' ? { shrinkTo: style.size - SHRINK_BY }
      : p === 'lines' || p === 'lines (normal)' ? { lines: LINES }
        : p === 'truncate end' || p === 'truncate end (normal)' ? { truncate: 'end', lines: LINES } : { truncate: 'middle' }
const slotOf = (style: Style, width: number, policy: Slot['policy'], overflowWrap?: Slot['overflowWrap']): Slot => ({
  width, font: fontOf(style), lineHeight: style.size * LINE_HEIGHT_RATIO, policy,
  ...(overflowWrap === undefined ? {} : { overflowWrap }),
  ...(style.reserve === 0 ? {} : { reserve: style.reserve }),
  ...(style.letterSpacing === 0 ? {} : { letterSpacing: style.letterSpacing }),
  ...(style.transform === 'none' ? {} : { textTransform: style.transform }),
  ...(style.numeric === 'proportional' ? {} : { numeric: style.numeric }),
})

// One checkLabels call per text scale. The row items' own texts are labels too (rows look their texts up among the
// labels), in a slot wide enough to pass; their verdicts are not part of the sweep.
const ROW_SLOT = 'row-item'
const groups: NodeGroup[] = TEXT_SCALES.map(scale => {
  const labels: Label[] = []
  const slots: Record<string, Slot> = { [ROW_SLOT]: slotOf(ROW_STYLE, 4000, 'as-is') }
  const mine = cases.filter(c => c.scale === scale)
  for (const c of mine) {
    const t = texts[c.text]!
    labels.push({ key: c.key, text: t.text, slot: c.key, locale: t.locale })
    slots[c.key] = slotOf(t.style, c.width, policyOf(c.policy, t.style), NORMAL_WRAP.includes(c.policy) ? 'normal' : undefined)
  }
  for (const locale of Object.keys(ROW_FAMILY) as Locale[]) {
    for (const i of ROW_FAMILY[locale]) {
      labels.push({ key: `${locale}.${i.id}`, text: i.text, slot: ROW_SLOT, locale })
      if (i.short !== undefined) labels.push({ key: `${locale}.${i.id}.short`, text: i.short, slot: ROW_SLOT, locale })
    }
  }
  const rows: RowMap = {}
  for (const r of rowCases.filter(x => x.scale === scale)) {
    rows[r.name] = {
      width: r.width, gap: ROW_GAP,
      items: ROW_FAMILY[r.locale].map(i => ({
        key: `${r.locale}.${i.id}`, slot: ROW_SLOT,
        ...(i.order === undefined ? {} : { collapse: { order: i.order, iconWidth: ICON_WIDTH } }),
        ...(i.short === undefined ? {} : { shortKey: `${r.locale}.${i.id}.short` }),
      })),
    }
  }
  const conditions = conds.filter(c => c.textScale === scale).map(c => ({ name: c.name, textScale: c.textScale, zoom: c.zoom }))
  return { labels, slots, rows, conditions, shrink: mine.filter(c => c.policy === 'shrinkTo').map(c => c.key) }
})

mkdirSync(dist, { recursive: true })
const inputPath = join(dist, 'check-input.json')
const input: NodeInput = { fontPath, family: FAMILY, platform, groups }
writeFileSync(inputPath, JSON.stringify(input))

const slug = (name: string): string => name.replace(/\W+/g, '-').replace(/^-|-$/g, '')
// A mutated copy of src under verify/dist, so src is never edited and nothing needs reverting (as headless.ts).
function mutate(m: Mutant): string {
  const dir = join(dist, 'mutants', slug(m.name), 'src')
  rmSync(dir, { recursive: true, force: true })
  cpSync(join(root, 'src'), dir, { recursive: true })
  applyMutant(m, file => readFileSync(join(dir, file), 'utf8'), (file, source) => writeFileSync(join(dir, file), source))
  return dir
}

function runNode(srcDir: string, name: string): Promise<NodeOutput> {
  const out = join(dist, `check-output-${name}.json`)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, 'check-labels-node.ts'), srcDir, inputPath, out], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => (code === 0 ? resolve(JSON.parse(readFileSync(out, 'utf8'))) : reject(new Error(`checker run "${name}" exited ${code}`))))
  })
}

// The control and the mutants, as many at once as the machine has cores.
t0 = performance.now()
const jobs: { name: string, src: () => string }[] = [
  { name: 'control', src: () => join(root, 'src') },
  ...MUTANTS.map(m => ({ name: slug(m.name), src: () => mutate(m) })),
]
const outputs = new Map<string, NodeOutput>()
let next = 0
await Promise.all(Array.from({ length: Math.min(jobs.length, Math.max(1, availableParallelism())) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++]!
    const s = performance.now()
    outputs.set(job.name, await runNode(job.src(), job.name))
    console.log(`checker ${job.name}: ${((performance.now() - s) / 1000).toFixed(1)}s`)
  }
}))
const nodeSeconds = (performance.now() - t0) / 1000

// ---- Comparison -----------------------------------------------------------------------------------------

const round64 = (x: number): number => Math.round(x * 64) / 64
type Outcome = 'pass' | 'check-mismatch' | 'pretext-gap' | 'excluded'
// verdict: the checker's kind; cross: the DOM's overflow by fractional widths and by scrollWidth disagree.
type Result = {
  what: string, policy: PolicyName | 'row', cond: SweepCondition, unit: string, outcome: Outcome, cause: string,
  checker: string, reference: string, verdict: string, cross: boolean,
}

function labelResult(out: NodeOutput, c: SlotCase, i: number, j: number): Result {
  const cond = conds[j]!
  const t = texts[c.text]!
  const { ref, dom } = pageLabels[j]![i]!
  const v = out.verdicts[cond.name]![c.key]
  const kind = v?.kind ?? 'pass'
  const fitted = c.policy === 'shrinkTo' ? out.fitted[cond.name]![c.key]! : undefined
  const checker = fitted === undefined ? kind : `${kind} at ${round64(fitted)}px`
  const reference = c.policy === 'shrinkTo' ? `${ref.kind} at ${round64(ref.fontPx)}px` : ref.kind
  const cross = dom.scrollOverflow !== undefined && (dom.overflow !== dom.scrollOverflow || (dom.overflowNext !== undefined && dom.overflowNext !== dom.scrollOverflowNext))
  const base = { what: `${c.key} ${JSON.stringify(t.text)} (${t.locale}, ${t.style.name}) @ ${c.width}px`, policy: c.policy, cond, unit: t.id, checker, reference, verdict: kind, cross }
  if (kind === 'uncovered') return { ...base, outcome: 'excluded', cause: `uncovered ${v!.detail ?? ''}`.trim() }
  if (kind !== ref.kind || (fitted !== undefined && round64(fitted) !== round64(ref.fontPx))) return { ...base, outcome: 'check-mismatch', cause: `checker ${checker}, reference ${reference}` }
  let agrees: boolean
  let cause: string
  switch (c.policy) {
    case 'as-is':
    case 'truncate middle':
      agrees = dom.overflow === (ref.kind !== 'pass')
      cause = `${c.policy}: DOM ${dom.overflow ? 'overflows' : 'fits'} where Pretext ${ref.kind === 'pass' ? 'fits' : 'overflows'}`
      break
    case 'lines':
    case 'lines (normal)':
      if (dom.lines !== dom.heightLines) return { ...base, outcome: 'excluded', cause: `unreliable: ${dom.lines} line rects, height of ${dom.heightLines} lines` }
      agrees = (dom.lines! <= LINES && dom.overflow === false) === (ref.kind === 'pass')
      cause = `${c.policy}: DOM ${dom.lines} lines${dom.overflow ? ', one wider than the box' : ''}, Pretext ${ref.lines}${ref.kind === 'pass' ? '' : ' (and a line past the box, or more than ' + LINES + ')'}`
      break
    case 'truncate end':
      agrees = dom.clamped === (ref.kind === 'truncated')
      cause = `truncate end: DOM ${dom.clamped ? 'clamps' : 'does not clamp'} where Pretext ${ref.kind === 'truncated' ? 'cuts' : 'does not'}`
      break
    case 'truncate end (normal)': {
      const cut = dom.clamped === true || dom.overflow === true
      agrees = cut === (ref.kind === 'truncated')
      cause = `truncate end (normal): DOM ${dom.clamped ? 'clamps' : dom.overflow ? 'cuts a line at the box' : 'does not cut'} where Pretext ${ref.kind === 'truncated' ? 'cuts' : 'does not'}`
      break
    }
    case 'shrinkTo':
      if (ref.kind === 'below-min-size') {
        agrees = dom.overflow === true
        cause = 'shrinkTo: DOM fits at the minimum where Pretext overflows'
      } else {
        agrees = dom.overflow === false && (ref.next === null || dom.overflowNext === true)
        cause = dom.overflow ? 'shrinkTo: DOM overflows at the fitted size' : 'shrinkTo: DOM also fits at the next size'
      }
      break
  }
  const px = (n: number | undefined): string => (n === undefined ? '?' : `${+n.toFixed(4)}`)
  const detail = dom.textWidth === undefined
    ? ''
    : ` (DOM text ${px(dom.textWidth)} in ${px(dom.boxWidth)}${dom.textWidthNext === undefined ? '' : `, next size ${px(dom.textWidthNext)}`}, zoomed px; scrollWidth ${dom.scrollWidth}, clientWidth ${dom.clientWidth})`
  return { ...base, what: agrees ? base.what : base.what + detail, outcome: agrees ? 'pass' : 'pretext-gap', cause: agrees ? '' : cause }
}

function rowResult(out: NodeOutput, r: RowCase, i: number, j: number): Result {
  const cond = conds[j]!
  const { ref, dom } = pageRows[j]![i]!
  const v = out.verdicts[cond.name]![r.name]
  const kind = v?.kind ?? 'pass'
  const stage = v?.stage ?? 0
  const checker = `${kind} stage ${stage}`
  const reference = `${ref.kind} stage ${ref.stage}`
  const cross = dom.overflow !== dom.scrollOverflow || (dom.overflowBefore !== null && dom.overflowBefore !== dom.scrollOverflowBefore)
  const base = { what: `${r.name} @ ${r.width}px`, policy: 'row' as const, cond, unit: `row.${r.locale}`, checker, reference, verdict: kind, cross }
  if (kind === 'uncovered') return { ...base, outcome: 'excluded', cause: `uncovered ${v!.detail ?? ''}`.trim() }
  if (kind !== ref.kind || stage !== ref.stage) return { ...base, outcome: 'check-mismatch', cause: `checker ${checker}, reference ${reference}` }
  const fitsAt = ref.kind === 'row-overflow' ? dom.overflow : !dom.overflow
  const before = dom.overflowBefore === null || dom.overflowBefore
  const cause = !fitsAt ? `row: DOM ${dom.overflow ? 'overflows' : 'fits'} at stage ${ref.stage}` : 'row: DOM fits at the stage before'
  const detail = ` (DOM content ${+dom.textWidth.toFixed(4)} in ${+dom.boxWidth.toFixed(4)}, zoomed px)`
  return { ...base, what: fitsAt && before ? base.what : base.what + detail, outcome: fitsAt && before ? 'pass' : 'pretext-gap', cause: fitsAt && before ? '' : cause }
}

function compare(out: NodeOutput): Result[] {
  const results: Result[] = []
  conds.forEach((_, j) => {
    casesAt[j]!.forEach((c, i) => results.push(labelResult(out, c, i, j)))
    rowsAt[j]!.forEach((r, i) => results.push(rowResult(out, r, i, j)))
  })
  return results
}

const control = outputs.get('control')!
const results = compare(control)
const vacuous = vacuousCells(results.map(r => ({ policy: r.policy, kind: r.cond.kind, verdict: r.verdict === 'pass' ? 'pass' : 'fail' })))
for (const v of vacuous) failures.push(`vacuous cell ${v}: every checker verdict is the same`)
const count = (rs: Result[], o: Outcome): number => rs.filter(r => r.outcome === o).length
const mismatches = results.filter(r => r.outcome === 'check-mismatch')
if (mismatches.length > 0) failures.push(`${mismatches.length} check-mismatch cases`)

// A mutant is caught by check-mismatches of its own: cases the control does not already mismatch.
const id = (r: Result): string => `${r.cond.name}|${r.what}`
const controlIds = new Set(mismatches.map(id))
type MutantResult = { m: Mutant, mismatches: Result[] }
const mutantResults: MutantResult[] = MUTANTS.map(m => {
  const rs = compare(outputs.get(slug(m.name))!).filter(r => r.outcome === 'check-mismatch' && !controlIds.has(id(r)))
  console.log(`mutant "${m.name}": ${rs.length} check-mismatches`)
  if (rs.length === 0) failures.push(`mutant "${m.name}" produced no check-mismatch`)
  return { m, mismatches: rs }
})

// ---- CHECK_RESULTS.md -----------------------------------------------------------------------------------

const osLabel = (() => {
  if (process.platform === 'darwin') return `macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()} (Darwin ${release()})`
  return `${process.platform === 'win32' ? 'Windows' : process.platform === 'linux' ? 'Linux' : process.platform} ${release()}`
})()
const pretextCommit = (() => {
  try {
    return execFileSync('git', ['-C', join(root, '../pretext'), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown commit'
  }
})()
const display = headless ? 'headless (`--headless`)' : process.env.DISPLAY !== undefined && process.platform === 'linux' ? `headed on X display ${process.env.DISPLAY}` : 'headed'

const KINDS: ConditionKind[] = ['none', 'text scale', 'zoom', 'text scale + zoom']
const POLICY_ROWS: (PolicyName | 'row')[] = [...POLICIES, 'row']
const cell = (text: string): string => text.replaceAll('|', '\\|')
const tableRow = (label: string, rs: Result[]): string =>
  `| ${label} | ${rs.length} | ${count(rs, 'pass')} | ${count(rs, 'check-mismatch')} | ${count(rs, 'pretext-gap')} | ${count(rs, 'excluded')} |`
const agreement = POLICY_ROWS.flatMap(p => KINDS.map(k => tableRow(`${p} · ${k}`, results.filter(r => r.policy === p && r.cond.kind === k))))

// The checker's verdicts per policy and condition kind, to show the widths put each policy on both sides of its
// boundary in every kind of condition (a cell with one verdict only fails the run).
const verdictSplit = POLICY_ROWS.flatMap(p => KINDS.map(k => {
  const rs = results.filter(r => r.policy === p && r.cond.kind === k)
  const tally = new Map<string, number>()
  for (const r of rs) tally.set(r.verdict, (tally.get(r.verdict) ?? 0) + 1)
  const pass = tally.get('pass') ?? 0
  return `| ${p} · ${k} | ${pass} | ${rs.length - pass} | ${[...tally].filter(([v]) => v !== 'pass').sort().map(([v, n]) => `${v} ${n}`).join(', ')} |`
}))
const crossChecked = results.filter(r => r.cross)

const units = [...new Set(results.map(r => r.unit))]
const failedUnits = new Set(mismatches.map(r => r.unit))
const judged = results.filter(r => r.outcome !== 'excluded')
const bound = (x: number, n: number): string => `Wilson ${pct(wilsonUpper(x, n))}, Clopper-Pearson ${pct(clopperPearsonUpper(x, n))}`

// CHECK_RESULTS.md (committed) lists EXAMPLES cases per cause; verify/dist/check-cases.md (not committed, uploaded by CI)
// lists every case.
const EXAMPLES = 10
const FULL_LISTING = 'verify/dist/check-cases.md'
const shown = <T>(list: T[], limit: number, line: (x: T) => string): string[] => [
  ...list.slice(0, limit).map(line),
  ...(list.length > limit ? [`- … and ${list.length - limit} more in ${FULL_LISTING}`] : []),
]
const byCause = (rs: Result[], limit: number): string[] => {
  const groups = new Map<string, Result[]>()
  for (const r of rs) {
    const list = groups.get(r.cause)
    if (list === undefined) groups.set(r.cause, [r])
    else list.push(r)
  }
  return [...groups].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)).flatMap(([cause, list]) => [
    '', `**${cell(cause)}** (${list.length}):`, '', ...shown(list, limit, r => `- ${r.cond.name}: ${r.what}`),
  ])
}
const gaps = results.filter(r => r.outcome === 'pretext-gap')
const excluded = results.filter(r => r.outcome === 'excluded')
const invalidLines = invalid.map(c => {
  const t = texts[c.text]!
  return `- ${c.key} ${JSON.stringify(t.text)} (${t.locale}, ${t.style.name}) @ ${c.width}px: less the icon grown ${+(c.scale * MAX_ZOOM).toFixed(2)}× leaves ${+zoomMutantBox(c).toFixed(4)}px`
})
// The fractional font sizes the checker measures here: each style's size and shrinkTo minimum under each condition.
const fractional = [...new Set([...new Set([...texts.map(t => t.style), ROW_STYLE].flatMap(st => [st.size, st.size - SHRINK_BY]))]
  .flatMap(size => conds.map(c => size * (c.textScale * c.zoom))).filter(px => !Number.isInteger(px)))].sort((a, b) => a - b)
const sources = [...new Set(texts.map(t => t.source))]

const render = (limit: number): string[] => [
  '# Label checker oracle sweep results',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} by \`npm run verify:check\` (verify/check-labels.ts), pretext-kit ${kitCommit}.`,
  '',
  `- Chromium ${browserVersion} (Playwright ${pkg('playwright')}, ${display}${executablePath === undefined ? '' : `, executable ${executablePath} from PW_CHROMIUM`}), \`<html lang="en">\`, each slot \`lang\` its label's locale`,
  `- Pretext ${pkg('@chenglou/pretext')} (../pretext ${pretextCommit}); harfbuzzjs ${pkg('harfbuzzjs')}`,
  `- Node ${process.version}, ${osLabel}, ${process.arch}`,
  `- checker: \`checkLabels\` in Node, \`platforms: ['${platform}']\` (this OS's), font ${FONT_FILE} from test/fonts registered as "${FAMILY}"`,
  `- Chromium ${chromiumSeconds.toFixed(0)}s; checker runs (control and ${MUTANTS.length} mutants, ${Math.min(jobs.length, availableParallelism())} at a time) ${nodeSeconds.toFixed(0)}s`,
  '',
  '## Method',
  '',
  `Fonts: ${FONT_FILE} (test/fonts), loaded in Chromium by \`@font-face\` from the same file as "${FAMILY}", and again as`,
  `"${TNUM_FAMILY}" with \`font-feature-settings: "tnum" 1\` for the kit's own measurements of tabular slots (Canvas has no`,
  '`font-variant-numeric`; the DOM itself sets `font-variant-numeric: tabular-nums` on the plain family), each checked',
  '`loaded`. The checker registers the file under its own name and makes its tabular twin itself.',
  '',
  'Each case is judged three ways. **Checker:** `checkLabels` in Node (the stand-in), its verdict the issue the report',
  'holds for the label (none is a pass), and for shrinkTo the fitted size from its own `evaluateLabel` (a pass reports',
  'none). **Reference:** the spec\'s rule recomputed in the page with the kit\'s helpers on Pretext with real canvas, from',
  'the CSS the element gets: text scale multiplies font size, letter spacing, line height and the icon width,',
  'zoom then everything; the box is the slot width less the icon. as-is and truncate middle: one line at the box',
  '(`fitFontSize` at the one size, so with FIT_TOLERANCE; middle after `prepareLabel`\'s white-space collapse); lines:',
  `the same with ${LINES} lines; truncate end: \`clamp(…, ${LINES}).truncated\`; the "(normal)" policies, a slot with \`overflowWrap: 'normal'\`:`,
  'first, each piece between two of Pretext\'s break opportunities (its segments; zero-width glue and controls join the',
  'text around them), a piece that fails making lines (normal) `overflow` and truncate end (normal)',
  '`truncated` (a piece fails when its natural width, which an unbroken word paints, or its line ending at its soft hyphen,',
  'is past the box by more than FIT_TOLERANCE), then the rule without the suffix; shrinkTo: the largest of the slot size, every whole px',
  'below it and the minimum that fits one line; rows: each stage\'s natural widths, icon reserves, icons and gaps, the',
  'first stage within the row (plus FIT_TOLERANCE). **DOM:** a flex box of the slot width holding the icon and the text',
  'element: as-is, shrinkTo and truncate middle `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`;',
  'lines `overflow-wrap: break-word; hyphens: manual` (lines (normal) `overflow-wrap: normal`), line count from the tops of',
  '`getClientRects()` of a range over the text (checked against height ÷ line height; a disagreement is `unreliable`);',
  `truncate end \`display: -webkit-box; -webkit-line-clamp: ${LINES}\`, clamped when \`scrollHeight > clientHeight\` (truncate end (normal)`,
  '`overflow-wrap: normal`, cut when clamped or when a line is wider than the box, which `text-overflow: ellipsis` cuts on',
  'any line of the clamp in Chromium); shrinkTo',
  'rendered at the reference\'s size, which must fit, and at the next candidate size up, which must not (none at the',
  'slot size); rows a flex line (`gap`, items `flex: none`) at the reference\'s stage, which must fit (overflow for',
  'row-overflow), and at the stage before, which must not. Text scale is a font-size change in the fixed-width box, zoom',
  'CSS `zoom` on the container. Overflow (nowrap policies, a line wider than the box, rows) is judged on fractional',
  'widths: the bounding width of a range over the content past the element\'s box by more than 1/64 px (zoomed px).',
  '`scrollWidth > clientWidth`, which Chromium snaps to whole pixels, is a cross-check: it disagrees in',
  `${crossChecked.length} of ${results.length} cases (${crossChecked.filter(r => r.outcome === 'pretext-gap').length} of them pretext-gaps).`,
  '',
  'Outcome, in this order (EVALUATION §2): `excluded` when the checker cannot judge the text (`uncovered`); `check-mismatch`',
  'when the checker\'s verdict (kind, shrinkTo size to 1/64 px, row stage) differs from the reference; `excluded` as',
  '`unreliable` when the DOM\'s two line counts disagree; `pretext-gap` when the DOM contradicts the reference; else',
  '`pass`. Pass bar: 0 check-mismatch.',
  '',
  `Fractional font sizes: the checker measures ${fractional.length} here (${fractional.map(px => +px.toFixed(4)).join(', ')}px; whole-pixel`,
  `shrinkTo candidates besides). On the 'linux' profile (this run: '${platform}') the stand-in measures a fractional size with`,
  `Chromium on Linux's own rule (src/headless/canvas.ts sizedFor: the size in float32 hundredths, advances at it truncated to`,
  `26.6), exact for the first use of a size in a document (Chromium 141; test/headless/fractional-size.test.ts). Later in a`,
  `document Chromium can reuse the glyph metrics of a nearby fractional size measured before, in either direction, which`,
  `the stand-in does not model: a page using two fractional sizes within a few hundredths of a px can differ from it by one`,
  `1/64 px advance step. None of this sweep's nearby pairs (17.94 and 18, 27 and 27.04, 21.97 and 22, 16.9 and 17px)`,
  `shares a cache entry in Chromium 141. 'macos' and 'windows' measure at the size asked for.`,
  '',
  'shrinkTo\'s "next size": the checker searches the slot size, whole pixels and the minimum (`fitFontSize` takes whole',
  'pixels), so the claim the DOM can test is that the chosen size fits and the next candidate up does not; sizes between',
  'two whole pixels are not a claim the checker makes.',
  '',
  '## Cases',
  '',
  `Texts: ${texts.length}. ${sources.map(s => `${s} ${texts.filter(t => t.source === s).length}`).join(', ')}. Corpus texts are every`,
  `run of whole words of at most ${MAX_CHARS} characters (soft hyphens not counted; German and French keep the corpora's soft`,
  'hyphens), in locale en, de and fr; every other one has a 20px icon reserve (`corpus + icon`). The hand-written',
  'labels: ' + HAND_LABELS.map(g => `${g.group} (${g.style.name}: ${g.style.size}px${g.style.reserve === 0 ? '' : `, reserve ${g.style.reserve}`}${g.style.letterSpacing === 0 ? '' : `, letter spacing ${g.style.letterSpacing}px`}${g.style.transform === 'none' ? '' : `, ${g.style.transform}`}${g.style.numeric === 'tabular' ? ', tabular-nums' : ''})`).join(', ') + '.',
  '',
  `Slots: each text in ${POLICIES.length} policies (as-is; shrinkTo the size less ${SHRINK_BY}px; lines ${LINES}; truncate end ${LINES} lines;`,
  `truncate middle; lines and truncate end again with overflow-wrap: normal), and each text scale (${TEXT_SCALES.join('/')}) its own slots, at ${FACTORS.join('/')} × the box where the policy changes its`,
  `verdict at that text scale (one line at the scaled size and letter spacing; one line at the scaled shrinkTo size; the`,
  `narrowest width in ${LINES} lines; for the "(normal)" policies that or the widest unbreakable piece's natural width,`,
  `whichever is wider), and for the "(normal)" policies also at the widest unbreakable piece's own boundary w: w, w less`,
  `1/64 px and a hair rounded down to 1/64 px, and w less 0.25px, where the checker's word rule decides; plus the reserve grown with the text, rounded up to 1/64 px; measured by the kit on Pretext`,
  `in the page. A slot runs in its text scale's conditions, zoom ${ZOOMS.join(' and ')} (zoom grows the box too, so the boundary`,
  `stays): ${cases.length} slots run (${invalid.length} not run, below). Line height ${LINE_HEIGHT_RATIO} × the size. Conditions: ${conds.map(c => c.name).join(', ')}.`,
  `Rows: a five-item toolbar per locale (${Object.keys(ROW_FAMILY).join(', ')}) and text scale, gap ${ROW_GAP}px, icon reserve ${ROW_STYLE.reserve}px, collapsed icon`,
  `${ICON_WIDTH}px, ${rowCases[0]!.stages} collapse stages, at each stage's total at that text scale, halfway to the next and 0.9 of the last:`,
  `${rowCases.length} rows. **${results.length} cases** (${results.filter(r => r.policy !== 'row').length} slot, ${results.filter(r => r.policy === 'row').length} row).`,
  '',
  'The checker\'s verdicts (control run) per policy and condition kind; the run fails if a cell has one verdict only:',
  '',
  '| policy · condition kind | pass | fail | fail kinds |',
  '|---|---:|---:|---|',
  ...verdictSplit,
  '',
  '## Agreement',
  '',
  `**${results.length} cases: ${count(results, 'check-mismatch')} check-mismatch, ${count(results, 'pretext-gap')} pretext-gap, ${count(results, 'excluded')} excluded, ${count(results, 'pass')} pass.**`,
  '',
  '| policy · condition kind | cases | pass | check-mismatch | pretext-gap | excluded |',
  '|---|---:|---:|---:|---:|---:|',
  ...agreement,
  '',
  `Statistics (PROTOCOL §4), one unit per label text (a text's slots, widths and conditions are one unit; each locale's`,
  `row is one): ${units.length} units, ${failedUnits.size} with a check-mismatch, 95% upper bound on the rate ${bound(failedUnits.size, units.length)}`,
  `(quoted). Per case, naive: ${judged.length} judged cases, ${mismatches.length} check-mismatch, ${bound(mismatches.length, judged.length)}.`,
  '',
  '### check-mismatch cases',
  '',
  ...(mismatches.length === 0 ? ['None.'] : byCause(mismatches, limit).slice(1)),
  '',
  '### pretext-gap cases, by cause',
  '',
  'Each is the reference (the kit on Pretext in Chromium) against Chromium\'s painting with the checker agreeing with the',
  'reference, so each is attributed to Pretext vs the DOM, not to the checker.',
  ...(limit === Infinity ? [] : ['', `Every case is listed in ${FULL_LISTING} (not committed; CI uploads it with this file); below,`, `up to ${limit} per cause.`]),
  ...(gaps.length === 0 ? ['', 'None.'] : byCause(gaps, limit)),
  '',
  '### Excluded cases, by cause',
  ...(excluded.length === 0 ? ['', 'None.'] : byCause(excluded, limit)),
  '',
  `**Not run: slots with no box left beside the icon grown with the text scale and ${MAX_ZOOM}× zoom, as the zoom mutant grows it`,
  `without the box** (${invalid.length} slots, so ${invalid.length * ZOOMS.length} cases; the checker rejects a slot with no box with a RangeError):`,
  '',
  ...(invalid.length === 0 ? ['None.'] : shown(invalidLines, limit, l => l)),
  '',
  '## Mutants',
  '',
  'Each mutant is a copy of src under verify/dist/mutants with the edits below (each must match exactly once, or the',
  'harness fails), run as the checker side of the same sweep against the same Chromium data. Caught: at least one',
  'check-mismatch of its own (a case the control does not already mismatch; the counts below leave those out).',
  '',
  '| mutant | edits | check-mismatch | by policy | caught |',
  '|---|---|---:|---|---|',
  ...mutantResults.map(({ m, mismatches: ms }) => {
    const by = POLICY_ROWS.map(p => [p, ms.filter(r => r.policy === p).length] as const).filter(([, n]) => n > 0).map(([p, n]) => `${p} ${n}`).join(', ')
    const edits = m.edits.map(e => `${e.file}: \`${cell(e.from.trim())}\` → \`${cell(e.to.trim())}\``).join('; ')
    return `| ${m.name} | ${edits} | ${ms.length} | ${by} | ${ms.length > 0 ? 'yes' : '**no**'} |`
  }),
  '',
  ...mutantResults.filter(r => r.mismatches.length > 0).map(({ m, mismatches: ms }) => `- ${m.name}, e.g. ${ms[0]!.cond.name}: ${ms[0]!.what}: ${ms[0]!.cause}`),
  '',
]
writeFileSync(join(here, 'CHECK_RESULTS.md'), render(EXAMPLES).join('\n'))
writeFileSync(join(root, FULL_LISTING), render(Infinity).join('\n'))
// Every case's outcome, for anything that wants to re-read the run without repeating it.
writeFileSync(join(dist, 'check-results.json.gz'), gzipSync(JSON.stringify({
  results: results.map(({ cond, ...r }) => ({ ...r, condition: cond.name })),
  mutants: mutantResults.map(({ m, mismatches: ms }) => ({ name: m.name, mismatches: ms.map(({ cond, ...r }) => ({ ...r, condition: cond.name })) })),
})))
console.log(`wrote verify/CHECK_RESULTS.md, ${FULL_LISTING} and verify/dist/check-results.json.gz`)
console.log(`${results.length} cases: ${count(results, 'check-mismatch')} check-mismatch, ${count(results, 'pretext-gap')} pretext-gap, ${count(results, 'excluded')} excluded, ${count(results, 'pass')} pass`)
for (const f of failures) console.log(`FAIL ${f}`)
if (failures.length > 0) process.exitCode = 1

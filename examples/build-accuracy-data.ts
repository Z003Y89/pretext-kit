// npm run examples:data: exports the browser sweep's results for the accuracy explorer, as
// examples/accuracy-data.json (committed, so the examples build without a sweep).
//
// Sources, all written by `npm run verify`:
//   verify/results/latest.json.gz  every non-pass case (browser, factor, helper, corpus, font, width, …)
//   verify/RESULTS.md              browser builds, run date, width steps, and the per-helper totals
//   verify/baseline.json           the gated pretext-gap and unreliable counts
// The sweep writes no pass cases, so the cases per browser × factor × helper × corpus are counted
// from the sweep's own corpora and width steps (verify/corpora.ts), and checked against RESULTS.md's
// per-helper totals. A helper whose cases can't be counted that way (one this script doesn't know, or
// a sweep changed since) is shown as one cell over all its corpora, with RESULTS.md's totals, and a
// warning, rather than with per-corpus counts that might be wrong.

import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORPORA, FONT_STACKS, LABEL_WIDTH_MAX, LABEL_WIDTH_MIN, LABELS, UI_LABELS, widths } from '../verify/corpora.ts'

const here = dirname(fileURLToPath(import.meta.url))
const verify = process.env.VERIFY_DIR ?? join(here, '../verify')

type Case = {
  browser: string, factor: number, helper: string, corpus: string, font: string, width: number, outcome: string,
  maxLines?: number, lines?: number, detail?: string, cause?: string
}
const OUTCOMES = ['pass', 'pretext-gap', 'platform', 'unreliable', 'kit-mismatch'] as const
type Outcome = typeof OUTCOMES[number]
// verify/sweep.ts: clamp runs at maxLines 1-5 (CLAMP_MAX_LINES there).
const CLAMP_MAX_LINES = 5
const SAMPLES_PER_OUTCOME = 8
// verify/sweep.ts: fitFontSizeRich runs each width in two boxes (RICH_BOXES there: maxLines 1, and a
// fixed height) over the corpora an icon row holds and the real UI labels (RICH_CORPORA there).
const RICH_BOXES = 2
const RICH_CORPORA = [...CORPORA.filter(c => ['latin', 'german', 'french', 'emoji-chat'].includes(c.name)), UI_LABELS]

const cases: Case[] = JSON.parse(gunzipSync(readFileSync(join(verify, 'results/latest.json.gz'))).toString('utf8'))
const results = readFileSync(join(verify, 'RESULTS.md'), 'utf8')
const baseline: Record<string, Record<string, number>> = JSON.parse(readFileSync(join(verify, 'baseline.json'), 'utf8'))

// --- RESULTS.md: run line, builds, steps and per-helper totals ----------------------------------
const runLine = /^Run on .*$/m.exec(results)?.[0] ?? ''
const steps = new Map<number, Record<string, number>>()
for (const m of results.matchAll(/^Width step per helper at factor ([\d.]+): (.*)\.$/gm)) {
  const per: Record<string, number> = {}
  for (const part of m[2]!.split(', ')) {
    const [h, n] = part.split(' ')
    per[h!] = Number(n)
  }
  steps.set(Number(m[1]), per)
}
type Run = { browser: string, version: string, factor: number, helpers: Record<string, Record<Outcome | 'cases', number>> }
const runs: Run[] = []
const sections = results.split(/^## /m).slice(1)
for (const s of sections) {
  const head = /^(\w+) (.*) at deviceScaleFactor ([\d.]+)$/m.exec(s.split('\n')[0]!)
  if (head === null) continue
  const helpers: Run['helpers'] = {}
  const byHelper = s.split('By corpus')[0]!
  for (const row of byHelper.matchAll(/^\| (\w+) \([\d.]+s\) \| (.*) \|$/gm)) {
    const n = row[2]!.split(' | ').map(Number)
    helpers[row[1]!] = { cases: n[0]!, pass: n[1]!, 'pretext-gap': n[2]!, platform: n[3]!, unreliable: n[4]!, 'kit-mismatch': n[5]! }
  }
  runs.push({ browser: head[1]!, version: head[2]!, factor: Number(head[3]), helpers })
}
if (runs.length === 0) throw new Error('RESULTS.md: no browser sections found')

// --- Cases per helper × corpus, from the sweep's own definitions ----------------------------------
// The helpers whose cases per corpus this script can count, from verify/sweep.ts's loops.
const COUNTABLE = ['shrinkwrap', 'balance', 'fitFontSize', 'fitFontSizeRich', 'clamp', 'truncateMiddle']
// Every helper RESULTS.md reports, in its order.
const HELPERS = [...new Set(runs.flatMap(r => Object.keys(r.helpers)))]
const corporaFor = (helper: string) =>
  helper === 'truncateMiddle' ? [LABELS, ...CORPORA.filter(c => c.name === 'german' || c.name === 'french')]
    : helper === 'fitFontSizeRich' ? RICH_CORPORA
    : helper === 'fontFromStyle' ? [] : CORPORA
const CORPUS_NAMES = [...new Set([...CORPORA.map(c => c.name), LABELS.name, UI_LABELS.name, ...cases.map(c => c.corpus)])]
const NO_CORPUS = 'all'

function totalsFor(helper: string, factor: number, fromResults: number): Map<string, number> {
  const out = new Map<string, number>()
  if (!COUNTABLE.includes(helper)) { out.set(NO_CORPUS, fromResults); return out }
  const step = steps.get(factor)?.[helper]
  if (step === undefined) throw new Error(`RESULTS.md gives no width step for ${helper} at factor ${factor}`)
  const ws = helper === 'truncateMiddle' ? widths(step, LABEL_WIDTH_MIN, LABEL_WIDTH_MAX) : widths(step)
  const perText = ws.length * FONT_STACKS.length * (helper === 'clamp' ? CLAMP_MAX_LINES : helper === 'fitFontSizeRich' ? RICH_BOXES : 1)
  for (const c of corporaFor(helper)) out.set(c.name, c.texts.length * perText)
  return out
}

// --- Cells -----------------------------------------------------------------------------------------
type Sample = { o: string, font: string, width: number, maxLines?: number, cause?: string, detail: string }
type Cell = { total: number } & Record<Outcome, number> & { samples: Sample[] }
const cells: Record<string, Cell> = {}
const key = (where: string, helper: string, corpus: string) => `${where}|${helper}|${corpus}`

const grouped = new Map<string, Case[]>()
for (const c of cases) {
  const k = key(`${c.browser}@${c.factor}`, c.helper, c.corpus)
  let list = grouped.get(k)
  if (list === undefined) grouped.set(k, list = [])
  list.push(c)
}

const problems: string[] = []
const warnings: string[] = []
const uncounted = new Set<string>()

function cellOf(list: Case[], total: number): Cell {
  const cell = { total, pass: 0, 'pretext-gap': 0, platform: 0, unreliable: 0, 'kit-mismatch': 0, samples: [] } as Cell
  for (const c of list) cell[c.outcome as Outcome]++
  cell.pass = total - list.length
  // A few cases per outcome, spread over the list (which runs font by font, text by text, width by width).
  for (const o of OUTCOMES) {
    const of = list.filter(c => c.outcome === o)
    const n = Math.min(SAMPLES_PER_OUTCOME, of.length)
    for (let i = 0; i < n; i++) {
      const c = of[Math.floor(i * of.length / n)]!
      const s: Sample = { o, font: c.font, width: c.width, detail: c.detail ?? '' }
      if (c.maxLines !== undefined) s.maxLines = c.maxLines
      if (c.cause !== undefined) s.cause = c.cause
      cell.samples.push(s)
    }
  }
  return cell
}

for (const run of runs) {
  const where = `${run.browser}@${run.factor}`
  for (const helper of HELPERS) {
    const fromResults = run.helpers[helper]
    if (fromResults === undefined) { problems.push(`${where}: RESULTS.md has no ${helper} row`); continue }
    const all = cases.filter(c => `${c.browser}@${c.factor}` === where && c.helper === helper)
    let made: Record<string, Cell> = {}
    const totals = totalsFor(helper, run.factor, fromResults.cases)
    for (const [corpus, total] of totals) {
      made[corpus] = cellOf(corpus === NO_CORPUS ? all : grouped.get(key(where, helper, corpus)) ?? [], total)
    }
    const sum = (k: Outcome | 'total') => Object.values(made).reduce((n, c) => n + c[k], 0)
    const off = (['cases', ...OUTCOMES] as const).filter(k => sum(k === 'cases' ? 'total' : k) !== fromResults[k])
    if (off.length > 0 && COUNTABLE.includes(helper)) {
      warnings.push(`${where} ${helper}: per-corpus counts disagree with RESULTS.md (${off.join(', ')}); shown as one cell`)
      uncounted.add(helper)
      made = { [NO_CORPUS]: cellOf(all, fromResults.cases) }
    }
    for (const k of OUTCOMES) {
      const n = Object.values(made).reduce((a, c) => a + c[k], 0)
      if (n !== fromResults[k]) problems.push(`${where} ${helper}: ${k} ${n} in latest.json.gz, ${fromResults[k]} in RESULTS.md`)
    }
    for (const [corpus, cell] of Object.entries(made)) cells[key(where, helper, corpus)] = cell
    const b = baseline[`${where}/${helper}`]
    if (b !== undefined && b['pretext-gap'] !== fromResults['pretext-gap']) {
      problems.push(`${where} ${helper}: RESULTS.md pretext-gap ${fromResults['pretext-gap']}, baseline.json ${b['pretext-gap']}`)
    }
  }
}
// A helper shown as one cell anywhere is shown as one cell everywhere, so its rows line up.
for (const helper of uncounted) {
  for (const run of runs) {
    const where = `${run.browser}@${run.factor}`
    for (const k of Object.keys(cells)) if (k.startsWith(`${where}|${helper}|`)) delete cells[k]
    cells[key(where, helper, NO_CORPUS)] = cellOf(cases.filter(c => `${c.browser}@${c.factor}` === where && c.helper === helper), run.helpers[helper]!.cases)
  }
}
for (const w of warnings) console.warn('warning: ' + w)
if (problems.length > 0) throw new Error('accuracy data disagrees with the sweep:\n' + problems.join('\n'))

const browsers = [...new Map(runs.map(r => [r.browser, r.version])).entries()].map(([name, version]) => ({ name, version }))
const factors = [...new Set(runs.map(r => r.factor))]
const out = {
  source: 'verify/results/latest.json.gz, verify/RESULTS.md and verify/baseline.json, exported by examples/build-accuracy-data.ts',
  run: runLine,
  steps: Object.fromEntries(steps),
  browsers,
  factors,
  helpers: HELPERS,
  corpora: CORPUS_NAMES,
  noCorpus: NO_CORPUS,
  baseline,
  cells,
}
writeFileSync(join(here, 'accuracy-data.json'), JSON.stringify(out) + '\n')
let total = 0
for (const c of Object.values(cells)) total += c.total
console.log(`wrote examples/accuracy-data.json: ${Object.keys(cells).length} cells, ${total} cases, ${cases.length} non-pass`)

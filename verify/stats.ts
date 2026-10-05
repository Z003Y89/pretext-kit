// node verify/stats.ts: the statistics EVALUATION.md quotes, regenerated from the committed run artifacts.
//
// Reads, all written by one `npm run verify`:
//   verify/RESULTS.md              per browser × factor × helper totals (the sweep lists no pass cases)
//   verify/results/latest.json.gz  every non-pass case
//   verify/baseline.json           the gated pretext-gap and unreliable counts
// and verify/corpora.ts for the texts, fonts and widths the sweep ran. It first checks that the three
// artifacts agree with each other and with the corpora (exit 1 if not), then prints:
//   1. per helper × browser × factor: outcomes, and 95% upper bounds on the kit-mismatch rate with the
//      case as the unit (Wilson score, and exact Clopper-Pearson for comparison);
//   2. per helper × browser: the same bound with the distinct text × font stack as the unit (all
//      factors pooled), the conservative one, since a text's cases at adjacent widths are not independent;
//   3. the at-answer overflow sentences for fitFontSize and fitFontSizeRich (verify/overflow.ts).
//
// node verify/stats.ts --compare-log=<file> instead compares the per-helper tallies `npm run verify`
// printed to <file> (for any browser × factor it ran) against RESULTS.md, for verify/reproduce.sh.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLAMP_MAX_LINES, FONT_STACKS, LABEL_WIDTH_MAX, LABEL_WIDTH_MIN, RICH_BOXES, corporaFor, widths,
} from './corpora.ts'
import { atAnswer, overflowsAtAnswer } from './overflow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUTCOMES = ['pass', 'pretext-gap', 'platform', 'unreliable', 'kit-mismatch'] as const
type Outcome = typeof OUTCOMES[number]
type Tally = Record<Outcome | 'cases', number>
type Listed = {
  browser: string, factor: number, helper: string, corpus: string, font: string, width: number, outcome: Outcome,
  detail?: string, box?: string, maxLines?: number, cause?: string,
}

const results = readFileSync(join(here, 'RESULTS.md'), 'utf8')

// ---- RESULTS.md: width steps and per-helper tables -------------------------------------------------
const steps = new Map<number, Record<string, number>>()
for (const m of results.matchAll(/^Width step per helper at factor ([\d.]+): (.*)\.$/gm)) {
  const per: Record<string, number> = {}
  for (const part of m[2]!.split(', ')) {
    const [h, n] = part.split(' ')
    per[h!] = Number(n)
  }
  steps.set(Number(m[1]), per)
}
type Run = { browser: string, version: string, factor: number, helpers: Map<string, Tally> }
const runs: Run[] = []
for (const s of results.split(/^## /m).slice(1)) {
  const head = /^(\w+) (.*) at deviceScaleFactor ([\d.]+)$/.exec(s.split('\n')[0]!)
  if (head === null) continue
  const helpers = new Map<string, Tally>()
  for (const row of s.split('By corpus')[0]!.matchAll(/^\| (\w+) \([\d.]+s\) \| (.*) \|$/gm)) {
    const n = row[2]!.split(' | ').map(Number)
    helpers.set(row[1]!, { cases: n[0]!, pass: n[1]!, 'pretext-gap': n[2]!, platform: n[3]!, unreliable: n[4]!, 'kit-mismatch': n[5]! })
  }
  runs.push({ browser: head[1]!, version: head[2]!, factor: Number(head[3]), helpers })
}
if (runs.length === 0) throw new Error('RESULTS.md: no browser sections')

// ---- --compare-log ------------------------------------------------------------------------------------
function compareLog(path: string): void {
  const log = readFileSync(path, 'utf8')
  const line = /^(\w+)@([\d.]+) (\w+): (\d+) cases in [\d.]+s \(pass (\d+), pretext-gap (\d+), platform (\d+), unreliable (\d+), kit-mismatch (\d+)\)$/gm
  let compared = 0
  let differ = 0
  for (const m of log.matchAll(line)) {
    const [browser, factor, helper] = [m[1]!, Number(m[2]), m[3]!]
    const got = [4, 5, 6, 7, 8, 9].map(i => Number(m[i]))
    const want = runs.find(r => r.browser === browser && r.factor === factor)?.helpers.get(helper)
    const wantRow = want === undefined ? undefined : [want.cases, ...OUTCOMES.map(o => want[o])]
    const same = wantRow !== undefined && wantRow.every((v, i) => v === got[i])
    compared++
    if (!same) differ++
    console.log(`${same ? 'same' : 'DIFFERENT'} ${browser}@${factor} ${helper}: this run ${got.join('/')}, RESULTS.md ${wantRow?.join('/') ?? 'absent'} (cases/pass/pretext-gap/platform/unreliable/kit-mismatch)`)
  }
  if (compared === 0) {
    console.log(`no per-helper tallies found in ${path}`)
    process.exitCode = 1
  } else {
    console.log(`${compared - differ} of ${compared} browser × factor × helper tallies equal RESULTS.md`)
    if (differ > 0) process.exitCode = 1
  }
}

// ---- Bounds -----------------------------------------------------------------------------------------
const Z = 1.959963984540054 // two-sided 95%

// Wilson score interval, upper end.
function wilsonUpper(x: number, n: number): number {
  if (n === 0) return 1
  const p = x / n
  const z2 = Z * Z
  return (p + z2 / (2 * n) + Z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n)
}

// Exact (Clopper-Pearson) two-sided 95% interval, upper end: the p at which P(X <= x) = 0.025.
function binomCdf(x: number, n: number, p: number): number {
  let logTerm = n * Math.log1p(-p) // k = 0
  let sum = Math.exp(logTerm)
  for (let k = 1; k <= x; k++) {
    logTerm += Math.log(n - k + 1) - Math.log(k) + Math.log(p) - Math.log1p(-p)
    sum += Math.exp(logTerm)
  }
  return sum
}
function clopperPearsonUpper(x: number, n: number): number {
  if (n === 0 || x >= n) return 1
  if (x === 0) return 1 - Math.pow(0.025, 1 / n)
  let lo = x / n
  let hi = 1
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (binomCdf(x, n, mid) > 0.025) lo = mid
    else hi = mid
  }
  return hi
}

const pct = (v: number): string => v >= 0.01 ? `${(v * 100).toFixed(2)}%` : v >= 0.0001 ? `${(v * 100).toFixed(3)}%` : `${(v * 100).toFixed(4)}%`

// ---- Report -------------------------------------------------------------------------------------------
function report(): void {
  const listed: Listed[] = JSON.parse(gunzipSync(readFileSync(join(here, 'results/latest.json.gz'))).toString('utf8'))
  const baseline: Record<string, Record<string, number>> = JSON.parse(readFileSync(join(here, 'baseline.json'), 'utf8'))
  const problems: string[] = []
  const baselineNotes: string[] = []

  // 1. The listing, the tables and the baseline agree.
  const listedTally = new Map<string, Record<string, number>>()
  for (const c of listed) {
    const key = `${c.browser}@${c.factor}/${c.helper}`
    const t = listedTally.get(key) ?? {}
    t[c.outcome] = (t[c.outcome] ?? 0) + 1
    listedTally.set(key, t)
  }
  for (const r of runs) for (const [helper, t] of r.helpers) {
    const key = `${r.browser}@${r.factor}/${helper}`
    const l = listedTally.get(key) ?? {}
    for (const o of OUTCOMES) {
      if (o === 'pass') continue
      if ((l[o] ?? 0) !== t[o]) problems.push(`${key} ${o}: RESULTS.md ${t[o]}, latest.json.gz ${l[o] ?? 0}`)
    }
    if (OUTCOMES.reduce((s, o) => s + t[o], 0) !== t.cases) problems.push(`${key}: outcomes do not sum to ${t.cases}`)
    // The baseline is a gate (a count may exceed it by max(5, 5%)), not a copy, so a difference is reported, not fatal.
    for (const o of ['pretext-gap', 'unreliable'] as const) {
      const base = baseline[key]?.[o]
      if (base === undefined) problems.push(`${key} ${o}: no baseline`)
      else if (base !== t[o]) baselineNotes.push(`${key} ${o}: RESULTS.md ${t[o]}, baseline.json ${base}`)
    }
  }

  // 2. Units (text × font stack) per helper, and cases per unit per factor, from the corpora.
  const casesPerUnit = (helper: string, factor: number): number => {
    if (helper === 'fontFromStyle') return 1
    const step = steps.get(factor)?.[helper]
    if (step === undefined) throw new Error(`RESULTS.md gives no width step for ${helper} at factor ${factor}`)
    const ws = helper === 'truncateMiddle' ? widths(step, LABEL_WIDTH_MIN, LABEL_WIDTH_MAX) : widths(step)
    return ws.length * (helper === 'clamp' ? CLAMP_MAX_LINES : helper === 'fitFontSizeRich' ? RICH_BOXES.length : 1)
  }
  const labelsOf = new Map<string, string[]>()
  const unitsOf = (helper: string, total: number): number => {
    if (helper === 'fontFromStyle') return total // one case per stack and size: each case is its own unit
    const labels = corporaFor(helper).flatMap(c => c.texts.map(t => `${c.name}/${t.label}`))
    labelsOf.set(helper, labels)
    return labels.length * FONT_STACKS.length
  }
  for (const r of runs) for (const [helper, t] of r.helpers) {
    const units = unitsOf(helper, t.cases)
    if (units * casesPerUnit(helper, r.factor) !== t.cases) {
      problems.push(`${r.browser}@${r.factor}/${helper}: ${units} units × ${casesPerUnit(helper, r.factor)} cases each ≠ ${t.cases} in RESULTS.md`)
    }
  }
  for (const labels of labelsOf.values()) {
    for (const l of labels) if (l.includes(': ')) problems.push(`label ${l} contains ": ", so details cannot name it`)
  }

  if (problems.length > 0) {
    for (const p of problems) console.log(`INCONSISTENT ${p}`)
    process.exitCode = 1
    return
  }

  const browsers = [...new Set(runs.map(r => r.browser))]
  const factors = [...new Set(runs.map(r => r.factor))]
  const helpers = [...runs[0]!.helpers.keys()]
  console.log(`Checked: RESULTS.md and verify/results/latest.json.gz (${listed.length} non-pass cases) agree for ${runs.length} browser × factor runs; units × widths reproduce every case count; verify/baseline.json ${baselineNotes.length === 0 ? 'equals the gated counts' : `differs in ${baselineNotes.length} gated counts (within its gate, or verify would have failed): ${baselineNotes.join('; ')}`}.`)
  console.log('')

  // Table 1: case unit.
  console.log('### Per helper, browser and factor (case unit)')
  console.log('')
  console.log('Against Pretext\'s own numbers every case is judged (n = cases); against the painting only cases that are')
  console.log('neither pretext-gap nor unreliable (n = judged). 95% upper bounds on the kit-mismatch rate.')
  console.log('')
  console.log('| helper | browser@factor | cases | pass | pretext-gap | platform | unreliable | kit-mismatch | judged | upper, vs Pretext (Wilson) | upper, vs painting (Wilson) | upper, vs painting (exact) |')
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const helper of helpers) for (const browser of browsers) for (const factor of factors) {
    const t = runs.find(r => r.browser === browser && r.factor === factor)?.helpers.get(helper)
    if (t === undefined) continue
    const judged = t.cases - t['pretext-gap'] - t.unreliable
    const x = t['kit-mismatch']
    console.log(`| ${helper} | ${browser}@${factor} | ${t.cases} | ${t.pass} | ${t['pretext-gap']} | ${t.platform} | ${t.unreliable} | ${x} | ${judged} | ${pct(wilsonUpper(x, t.cases))} | ${pct(wilsonUpper(x, judged))} | ${pct(clopperPearsonUpper(x, judged))} |`)
  }
  console.log('')

  // Table 2: text × font unit, factors pooled.
  console.log('### Per helper and browser (text × font stack unit, factors pooled)')
  console.log('')
  console.log('A unit fails if any of its cases, at any width, line count, box or factor, is a kit-mismatch. A unit')
  console.log('none of whose cases could be judged against the painting (all pretext-gap or unreliable) is left out.')
  console.log('')
  console.log('| helper | browser | units | cases per unit | units never judged | failing units | upper (Wilson) | upper (exact) |')
  console.log('|---|---|---:|---:|---:|---:|---:|---:|')
  for (const helper of helpers) for (const browser of browsers) {
    const bRuns = runs.filter(r => r.browser === browser && r.helpers.has(helper))
    if (bRuns.length === 0) continue
    const perUnit = bRuns.reduce((s, r) => s + casesPerUnit(helper, r.factor), 0)
    const unitKey = (c: Listed): string => {
      if (helper === 'fontFromStyle') return `${c.font}|${c.corpus}|${c.width}`
      const label = labelsOf.get(helper)!.find(l => c.detail?.startsWith(`${l.split('/').slice(1).join('/')}: `) && l.startsWith(`${c.corpus}/`))
      if (label === undefined) throw new Error(`cannot name the text of ${JSON.stringify(c)}`)
      return `${c.font}|${label}`
    }
    const unjudgedCases = new Map<string, number>()
    const failing = new Set<string>()
    for (const c of listed) {
      if (c.helper !== helper || c.browser !== browser) continue
      const k = unitKey(c)
      if (c.outcome === 'pretext-gap' || c.outcome === 'unreliable') unjudgedCases.set(k, (unjudgedCases.get(k) ?? 0) + 1)
      if (c.outcome === 'kit-mismatch') failing.add(k)
    }
    const units = unitsOf(helper, bRuns[0]!.helpers.get(helper)!.cases)
    const never = [...unjudgedCases.values()].filter(n => n === perUnit).length
    const n = units - never
    console.log(`| ${helper} | ${browser} | ${units} | ${perUnit} | ${never} | ${failing.size} | ${pct(wilsonUpper(failing.size, n))} | ${pct(clopperPearsonUpper(failing.size, n))} |`)
  }
  console.log('')

  // Pooled across browsers, for the headline.
  let allCases = 0
  let allJudged = 0
  let allMismatch = 0
  let allPlatform = 0
  for (const r of runs) for (const t of r.helpers.values()) {
    allCases += t.cases
    allJudged += t.cases - t['pretext-gap'] - t.unreliable
    allMismatch += t['kit-mismatch']
    allPlatform += t.platform
  }
  console.log(`All runs: ${allCases} cases, ${allJudged} judged against the painting, ${allMismatch} kit-mismatch, ${allPlatform} platform.`)
  console.log('')

  // Headless parity (verify/HEADLESS_RESULTS.md, from `npm run verify:headless`).
  const hr = readFileSync(join(here, 'HEADLESS_RESULTS.md'), 'utf8')
  const w = /\*\*(\d+) cases, (\d+) exact, max \|Δ\| ([\d.]+)px,\s+(\d+) beyond ([\d.]+)px\.\*\*/.exec(hr)
  const lp = /^(\d+) text × font pairs .* × (\d+) widths/m.exec(hr)
  const lc = /\*\*(\d+) cases: (\d+) headless-mismatch, (\d+) pretext-gap,\s+(\d+) unreliable, (\d+) pass\.\*\*/.exec(hr)
  const wm = /^Skipped \(out of scope\): (\d+) string × font pairs\.$/m.exec(hr)
  if (w === null || lp === null || lc === null || wm === null) throw new Error('HEADLESS_RESULTS.md: summary lines not found')
  const [wCases, wMiss] = [Number(w[1]), Number(w[4])]
  // Width cases per string × face: 4 sizes × 2 letter spacings (HEADLESS_RESULTS.md, Widths).
  const wUnits = wCases / 8
  const [lUnits, lWidths, lCases, lMis, lGap, lUnrel] = [Number(lp[1]), Number(lp[2]), Number(lc[1]), Number(lc[2]), Number(lc[3]), Number(lc[4])]
  if (lUnits * lWidths !== lCases) throw new Error(`HEADLESS_RESULTS.md: ${lUnits} pairs × ${lWidths} widths ≠ ${lCases}`)
  const lJudged = lCases - lGap - lUnrel
  console.log('### Headless parity (verify/HEADLESS_RESULTS.md)')
  console.log('')
  console.log('| check | unit | n | failures | upper (Wilson) | upper (exact) |')
  console.log('|---|---|---:|---:|---:|---:|')
  console.log(`| widths within ${w[5]}px of Chromium's Canvas | case | ${wCases} | ${wMiss} | ${pct(wilsonUpper(wMiss, wCases))} | ${pct(clopperPearsonUpper(wMiss, wCases))} |`)
  // Failing units can't be told from the summary when there are failures, so the unit bound is given only at zero.
  const unitRow = (what: string, unit: string, n: number, fails: number): string => fails === 0
    ? `| ${what} | ${unit} | ${n} | 0 | ${pct(wilsonUpper(0, n))} | ${pct(clopperPearsonUpper(0, n))} |`
    : `| ${what} | ${unit} | ${n} | ≥ 1 (see HEADLESS_RESULTS.md) | – | – |`
  console.log(unitRow(`widths within ${w[5]}px of Chromium's Canvas`, 'string × face (8 cases each)', wUnits, wMiss))
  console.log(`| line count equal to Pretext in Chromium (judged: not pretext-gap or unreliable) | case | ${lJudged} | ${lMis} | ${pct(wilsonUpper(lMis, lJudged))} | ${pct(clopperPearsonUpper(lMis, lJudged))} |`)
  console.log(unitRow('line count equal to Pretext in Chromium', `text × font (${lWidths} widths each)`, lUnits, lMis))
  console.log('')
  console.log(`Skipped as out of scope by the fixed coverage rule: ${wm[1]} string × face pairs (widths).`)
  console.log('')

  // 3. At-answer overflows.
  console.log('### At-answer overflows')
  console.log('')
  for (const h of ['fitFontSize', 'fitFontSizeRich'] as const) {
    const a = atAnswer(h, listed)
    console.log(`${h}: ${a.length} cases paint more lines than Pretext at the answer; ${a.filter(x => x.overBox).length} of them exceed the box.`)
    console.log('')
    console.log(overflowsAtAnswer(h, listed))
    console.log('')
  }
}

// Run last, so every constant above is initialised.
const logArg = process.argv.slice(2).find(a => a.startsWith('--compare-log='))?.slice(14)
if (logArg !== undefined) compareLog(logArg)
else report()

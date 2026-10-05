import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserType } from 'playwright'
import { WIDTH_MAX, WIDTH_MIN } from './corpora.ts'
import type { CaseResult, Helper } from './sweep.ts'

const here = dirname(fileURLToPath(import.meta.url))

// An IIFE bundle, because file:// pages cannot load ES modules in every browser.
await build({
  entryPoints: [join(here, 'sweep.ts')],
  bundle: true,
  format: 'iife',
  outfile: join(here, 'dist/sweep.js'),
  logLevel: 'warning',
})

const args = process.argv.slice(2)
// --only=<browser>[,<browser>] and --helpers=<helper>[,...] narrow a run while investigating;
// RESULTS.md is written only by a full run so it never records a partial sweep as the result.
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',')
const helperArg = args.find(a => a.startsWith('--helpers='))?.slice(10).split(',') as Helper[] | undefined
// Width steps per helper, e.g. --steps=fitFontSize:4, for when step 1 is too slow in a browser.
const stepArg = args.find(a => a.startsWith('--steps='))?.slice(8).split(',')
const steps: Record<string, number> = { shrinkwrap: 1, balance: 1, fitFontSize: 1 }
for (const s of stepArg ?? []) {
  const [k, v] = s.split(':')
  if (k !== undefined && v !== undefined) steps[k] = Number(v)
}

const BROWSERS: [string, BrowserType][] = [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]
const HELPERS: Helper[] = helperArg ?? ['shrinkwrap', 'balance', 'fitFontSize']
const OUTCOMES = ['pass', 'pretext-gap', 'kit-mismatch'] as const

type Run = { browser: string, version: string, helper: Helper, seconds: number, results: CaseResult[] }
const runs: Run[] = []

for (const [name, type] of BROWSERS) {
  if (only !== undefined && !only.includes(name)) continue
  // Headed, because headless builds differ in font fallback and emoji rendering from what users see.
  const browser = await type.launch({ headless: false })
  // The Playwright build directory goes beside the version because a frozen build (WebKit on
  // macOS 14) reports a marketing version that does not say which engine snapshot ran.
  const build = type.executablePath().split('ms-playwright/')[1]?.split('/')[0]
  const version = build === undefined ? browser.version() : `${browser.version()} (${build})`
  const page = await browser.newPage()
  page.on('pageerror', e => console.error(`[${name}] page error: ${e.message}`))
  await page.goto(pathToFileURL(join(here, 'sweep.html')).href)
  await page.evaluate(s => { window.sweepWidthStep = s }, steps)
  for (const helper of HELPERS) {
    const t0 = performance.now()
    const results = await page.evaluate(h => window.sweep(h), helper)
    const seconds = (performance.now() - t0) / 1000
    runs.push({ browser: name, version, helper, seconds, results })
    const tally = OUTCOMES.map(o => `${o} ${results.filter(r => r.outcome === o).length}`).join(', ')
    console.log(`${name} ${version} ${helper}: ${results.length} cases in ${seconds.toFixed(1)}s (${tally})`)
  }
  await browser.close()
}

function count(rs: CaseResult[], outcome: string): number {
  let n = 0
  for (const r of rs) if (r.outcome === outcome) n++
  return n
}

function table(rows: [string, CaseResult[]][]): string[] {
  const out = ['| | cases | pass | pretext-gap | kit-mismatch |', '|---|---:|---:|---:|---:|']
  for (const [label, rs] of rows) {
    out.push(`| ${label} | ${rs.length} | ${count(rs, 'pass')} | ${count(rs, 'pretext-gap')} | ${count(rs, 'kit-mismatch')} |`)
  }
  return out
}

const mismatches = runs.flatMap(r => r.results.filter(c => c.outcome === 'kit-mismatch').map(c => ({ run: r, c })))

const full = only === undefined && helperArg === undefined
if (full) {
  const md: string[] = [
    '# Browser sweep results',
    '',
    `Run on ${new Date().toISOString().slice(0, 10)} by \`npm run verify\` (headed, deviceScaleFactor 1, \`<html lang="en">\`).`,
    `Widths ${WIDTH_MIN}-${WIDTH_MAX}px, step per helper: ${Object.entries(steps).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    'A `pretext-gap` case is one where Pretext\'s own line count differs from the browser\'s at the width (or, for',
    'fitFontSize, at a size) the judgement needs, so the kit cannot be judged there. A `kit-mismatch` is the kit',
    'answering wrongly where Pretext was right.',
    '',
  ]
  for (const [name] of BROWSERS) {
    const browserRuns = runs.filter(r => r.browser === name)
    if (browserRuns.length === 0) continue
    md.push(`## ${name} ${browserRuns[0]!.version}`, '')
    md.push('By helper:', '')
    md.push(...table(browserRuns.map(r => [`${r.helper} (${r.seconds.toFixed(0)}s)`, r.results])), '')
    md.push('By corpus (all helpers):', '')
    const all = browserRuns.flatMap(r => r.results)
    const corpora = [...new Set(all.map(r => r.corpus))]
    md.push(...table(corpora.map(c => [c, all.filter(r => r.corpus === c)])), '')
    const gaps = all.filter(r => r.outcome === 'pretext-gap')
    if (gaps.length > 0) {
      md.push('Pretext gaps by text (count of cases):', '')
      const byText = new Map<string, number>()
      for (const g of gaps) {
        const key = `${g.helper} / ${g.corpus} / ${g.font} / ${g.detail?.split(':')[0]}`
        byText.set(key, (byText.get(key) ?? 0) + 1)
      }
      for (const [k, n] of [...byText].sort((a, b) => b[1] - a[1])) md.push(`- ${k}: ${n}`)
      md.push('')
    }
  }
  md.push('## kit-mismatch cases', '')
  if (mismatches.length === 0) md.push('None.')
  else md.push(`${mismatches.length} cases; consecutive widths with the same finding share a line.`, '')
  // Runs of adjacent widths usually share one cause, so they are listed as a range: every case
  // still appears, but a few thousand of them stay readable.
  let open: { key: string, from: number, to: number } | undefined
  const flush = (): void => {
    if (open === undefined) return
    const [head, detail] = open.key.split('\u0000')
    const at = open.from === open.to ? `${open.from}px` : `${open.from}-${open.to}px`
    md.push(`- ${head} @ ${at}: ${detail}`)
  }
  for (const { run, c } of mismatches) {
    const key = `${run.browser} ${c.helper} ${c.corpus} / ${c.font}\u0000${c.detail}`
    if (open !== undefined && open.key === key && open.to + steps[c.helper]! === c.width) {
      open.to = c.width
      continue
    }
    flush()
    open = { key, from: c.width, to: c.width }
  }
  flush()
  md.push('')
  writeFileSync(join(here, 'RESULTS.md'), md.join('\n'))
  console.log('wrote verify/RESULTS.md')
}

for (const { run, c } of mismatches.slice(0, 50)) {
  console.log(`kit-mismatch ${run.browser} ${c.helper} ${c.corpus} / ${c.font} @ ${c.width}px: ${c.detail}`)
}
if (mismatches.length > 0) process.exitCode = 1

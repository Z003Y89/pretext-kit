import { build } from 'esbuild'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserType } from 'playwright'
import { WIDTH_MAX, WIDTH_MIN } from './corpora.ts'
import { WEBKIT_LINE_HEIGHT_FLOOR } from './causes.ts'
import type { CaseResult, FontPresence, Helper } from './sweep.ts'

const here = dirname(fileURLToPath(import.meta.url))
const playwrightVersion: string = JSON.parse(
  readFileSync(join(here, '../node_modules/playwright/package.json'), 'utf8'),
).version

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
// RESULTS.md and the baseline are written only by a full run so neither records a partial sweep.
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',')
const helperArg = args.find(a => a.startsWith('--helpers='))?.slice(10).split(',') as Helper[] | undefined
// Width steps per helper, e.g. --steps=fitFontSize:4, for when step 1 is too slow in a browser.
const stepArg = args.find(a => a.startsWith('--steps='))?.slice(8).split(',')
const steps: Record<string, number> = { shrinkwrap: 1, balance: 1, fitFontSize: 1 }
for (const s of stepArg ?? []) {
  const [k, v] = s.split(':')
  if (k !== undefined && v !== undefined) steps[k] = Number(v)
}
// `npm run verify --update-baseline` hands the flag to npm, which passes it on as an environment
// variable rather than an argument, so both spellings are read.
const updateBaseline = args.includes('--update-baseline') || process.env.npm_config_update_baseline === 'true'

const BROWSERS: [string, BrowserType][] = [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]
const HELPERS: Helper[] = helperArg ?? ['fontFromStyle', 'shrinkwrap', 'balance', 'fitFontSize']
const OUTCOMES = ['pass', 'pretext-gap', 'platform', 'unreliable', 'kit-mismatch'] as const
// Outcomes that hide whether the kit is right; a rise in either could be a kit bug in disguise,
// so their counts are held to a committed baseline.
const GATED = ['pretext-gap', 'unreliable'] as const
const BASELINE = join(here, 'baseline.json')

type Run = { browser: string, version: string, helper: Helper, seconds: number, results: CaseResult[] }
type BrowserInfo = { version: string, dpr: number, fonts: FontPresence[] }
const runs: Run[] = []
const infos = new Map<string, BrowserInfo>()
const failures: string[] = []

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
  await page.evaluate(([s, b]) => { window.sweepWidthStep = s; window.sweepBrowser = b }, [steps, name] as const)
  const dpr = await page.evaluate(() => window.devicePixelRatio)
  const fonts = await page.evaluate(() => window.fontPresence())
  infos.set(name, { version, dpr, fonts })
  for (const f of fonts) if (!f.present) failures.push(`${name}: pinned font family ${f.family} is not installed`)
  console.log(`${name} ${version}, devicePixelRatio ${dpr}, fonts: ${fonts.map(f => `${f.family} ${f.present ? 'present' : 'ABSENT'}`).join(', ')}`)
  for (const helper of HELPERS) {
    const t0 = performance.now()
    const results = await page.evaluate(h => window.sweep(h), helper)
    const seconds = (performance.now() - t0) / 1000
    runs.push({ browser: name, version, helper, seconds, results })
    const tally = OUTCOMES.map(o => `${o} ${results.filter(r => r.outcome === o).length}`).join(', ')
    console.log(`${name} ${helper}: ${results.length} cases in ${seconds.toFixed(1)}s (${tally})`)
  }
  await browser.close()
}

function count(rs: CaseResult[], outcome: string): number {
  let n = 0
  for (const r of rs) if (r.outcome === outcome) n++
  return n
}

function table(rows: [string, CaseResult[]][]): string[] {
  const out = [`| | cases | ${OUTCOMES.join(' | ')} |`, `|---|---:|${OUTCOMES.map(() => '---:').join('|')}|`]
  for (const [label, rs] of rows) out.push(`| ${label} | ${rs.length} | ${OUTCOMES.map(o => count(rs, o)).join(' | ')} |`)
  return out
}

// Runs of adjacent widths usually share one finding, so they are listed as a range: every case
// still appears, but thousands of them stay readable.
function ranged(cases: { browser: string, c: CaseResult }[]): string[] {
  const out: string[] = []
  let open: { head: string, detail: string, step: number, from: number, to: number } | undefined
  const flush = (): void => {
    if (open === undefined) return
    const at = open.from === open.to ? `${open.from}px` : `${open.from}-${open.to}px`
    out.push(`- ${open.head} @ ${at}: ${open.detail}`)
  }
  for (const { browser, c } of cases) {
    const head = `${browser} ${c.helper} ${c.corpus} / ${c.font}`
    const detail = (c.cause === undefined ? '' : `[${c.cause}] `) + (c.detail ?? '')
    if (open !== undefined && open.head === head && open.detail === detail && open.to + open.step === c.width) {
      open.to = c.width
      continue
    }
    flush()
    open = { head, detail, step: steps[c.helper] ?? 1, from: c.width, to: c.width }
  }
  flush()
  return out
}

function casesOf(outcome: string): { browser: string, c: CaseResult }[] {
  return runs.flatMap(r => r.results.filter(c => c.outcome === outcome).map(c => ({ browser: r.browser, c })))
}

const mismatches = casesOf('kit-mismatch')
if (mismatches.length > 0) failures.push(`${mismatches.length} kit-mismatch cases`)

const full = only === undefined && helperArg === undefined

// Gap and unreliable counts may drift a little with a browser update, but a jump is a finding.
type Baseline = Record<string, Record<string, number>>
const counts: Baseline = {}
for (const r of runs) {
  const entry: Record<string, number> = {}
  for (const o of GATED) entry[o] = count(r.results, o)
  counts[`${r.browser}/${r.helper}`] = entry
}
if (updateBaseline) {
  if (!full) throw new Error('--update-baseline needs a full run (no --only or --helpers)')
  // A baseline written over a kit bug would bless the gaps that bug produced.
  if (mismatches.length > 0) throw new Error('--update-baseline refused: the run has kit-mismatch cases')
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n')
  console.log('wrote verify/baseline.json')
}
const baseline: Baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
for (const [key, entry] of Object.entries(counts)) {
  for (const o of GATED) {
    const base = baseline[key]?.[o]
    if (base === undefined) {
      failures.push(`${key}: no ${o} baseline; run with --update-baseline after checking the cases`)
      continue
    }
    const allowed = base + Math.max(5, base * 0.05)
    if (entry[o]! > allowed) failures.push(`${key}: ${entry[o]} ${o} cases, baseline ${base} allows at most ${Math.floor(allowed)}`)
  }
}

if (full) {
  const md: string[] = [
    '# Browser sweep results',
    '',
    `Run on ${new Date().toISOString().slice(0, 10)} by \`npm run verify\`, headed, \`<html lang="en">\`.`,
    `Widths ${WIDTH_MIN}-${WIDTH_MAX}px, step per helper: ${Object.entries(steps).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    'fontFromStyle cases are one per font stack and pinned size (16px/24px, then 8-48px at 1.5 line height); their',
    '"width" column is the font size.',
    '',
    'A `pretext-gap` case is one where Pretext\'s own line count differs from the browser\'s at a width (or, for',
    'fitFontSize, a size) the judgement needs, so the kit cannot be judged there. A `kit-mismatch` is the kit',
    'answering wrongly where Pretext was right. A `platform` case is a kit-mismatch whose cause is proven, case by',
    'case, to be a browser painting something its CSS does not say; only the cause below is recognised. An',
    '`unreliable` case painted a height that is no whole number of lines, so lines could not be counted.',
    '',
    'Each kit answer is judged against Pretext\'s own numbers first, and any failure there is a kit-mismatch whatever',
    'the browser paints: shrinkwrap and balance must fit the box with Pretext\'s line count at the box width and at their',
    'own width, shrinkwrap must equal Pretext\'s widest line rounded up (one pixel less exactly when Pretext lays out the',
    'same lines there), balance one pixel narrower must cost Pretext a line, and fitFontSize must fit by Pretext at its',
    'size and not at the next. Only then is the painting compared, where a disagreement is a pretext-gap: line counts at',
    'each width probed, shrinkwrap\'s width against the ceiling of the widest painted line (measured per line from the',
    'text\'s non-white-space fragments; one pixel less passes only if the browser paints the identical layout there,',
    'since engines let a line overshoot by up to 1/64 px), and balance one pixel narrower painting more lines.',
    `\`npm run verify\` fails on any kit-mismatch, on a pinned font family that is absent, and when a`,
    'browser×helper\'s pretext-gap or unreliable count exceeds `verify/baseline.json` by more than max(5, 5%).',
    '',
    `Playwright is pinned to ${playwrightVersion}: on macOS 14 Playwright ships a frozen WebKit build`,
    '(webkit_mac14_arm64_special-2251), and Playwright 1.62 and later send it a protocol setting it rejects',
    '(`Page.overrideSetting`: "Unknown setting: PushAPIEnabled"), so no WebKit page opens.',
    '',
    `**\`${WEBKIT_LINE_HEIGHT_FLOOR}\`.** WebKit 26 lays line boxes out at whole pixels, so a fractional`,
    '`line-height` paints as its floor (16.5px paints 16px lines) while `getComputedStyle` still reports 16.5px;',
    'Pretext\'s `PLATFORM_BUGS.md` ("Engine rules Pretext models") records that Safari 27 moved line boxes to the',
    '1/64 px grid where Safari 26 did not. fitFontSize, given the CSS line height, then models a taller box than',
    'WebKit paints and can answer one size below the largest that fits; it never answers a size that overflows. A case',
    'gets this cause only in WebKit, and only if its line height is fractional, the contradicting painting is exactly',
    'lines × the floored line height, and the same judgement passes when the kit is rerun with floored line heights.',
    'For exact fits in Safari 26, use whole-px line heights.',
    '',
  ]
  for (const [name] of BROWSERS) {
    const browserRuns = runs.filter(r => r.browser === name)
    const info = infos.get(name)
    if (browserRuns.length === 0 || info === undefined) continue
    md.push(`## ${name} ${info.version}`, '')
    md.push(`devicePixelRatio ${info.dpr}. Fonts: ${info.fonts.map(f => `${f.family} ${f.present ? 'present' : '**absent**'}`).join(', ')}.`, '')
    md.push('By helper:', '')
    md.push(...table(browserRuns.map(r => [`${r.helper} (${r.seconds.toFixed(0)}s)`, r.results])), '')
    md.push('By corpus (sweep helpers):', '')
    const all = browserRuns.flatMap(r => r.results).filter(r => r.helper !== 'fontFromStyle')
    const corpora = [...new Set(all.map(r => r.corpus))]
    md.push(...table(corpora.map(c => [c, all.filter(r => r.corpus === c)])), '')
  }
  const sections: [string, string][] = [
    ['kit-mismatch', 'kit-mismatch cases'],
    ['unreliable', 'unreliable cases'],
    ['platform', 'platform cases'],
    ['pretext-gap', 'pretext-gap cases'],
  ]
  for (const [outcome, title] of sections) {
    const cases = casesOf(outcome)
    md.push(`## ${title}`, '')
    if (cases.length === 0) md.push('None.')
    else md.push(`${cases.length} cases; consecutive widths with the same finding share a line.`, '', ...ranged(cases))
    md.push('')
  }
  writeFileSync(join(here, 'RESULTS.md'), md.join('\n'))
  console.log('wrote verify/RESULTS.md')
}

for (const { browser, c } of mismatches.slice(0, 50)) {
  console.log(`kit-mismatch ${browser} ${c.helper} ${c.corpus} / ${c.font} @ ${c.width}px: ${c.detail}`)
}
for (const f of failures) console.log(`FAIL ${f}`)
if (failures.length > 0) process.exitCode = 1

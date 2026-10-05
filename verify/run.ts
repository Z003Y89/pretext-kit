import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserType } from 'playwright'
import { LABEL_WIDTH_MAX, LABEL_WIDTH_MIN, WIDTH_MAX, WIDTH_MIN } from './corpora.ts'
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
const steps: Record<string, number> = { shrinkwrap: 1, balance: 1, fitFontSize: 1, fitFontSizeRich: 1, clamp: 1, truncateMiddle: 1 }
for (const s of stepArg ?? []) {
  const [k, v] = s.split(':')
  if (k !== undefined && v !== undefined) steps[k] = Number(v)
}
// Every factor runs the whole sweep: browser and Electron zoom change the device pixel ratio, not
// CSS px, so the same widths are painted onto a finer or coarser device grid. --factors narrows it.
const FACTORS = [1, 1.25, 2]
const factorArg = args.find(a => a.startsWith('--factors='))?.slice(10).split(',').map(Number)
const factors = factorArg ?? FACTORS
// Factors other than 1 sweep at width step 4 (--zoom-step=<n> to change it): the full step-1 run
// at every factor (28 min) gave identical counts at 1, 1.25 and 2 in every browser, so the
// zoomed runs are a sampled check that zoom still changes nothing, not a second full sweep.
const zoomStep = Number(args.find(a => a.startsWith('--zoom-step='))?.slice(12) ?? 4)
const stepsAt = (factor: number): Record<string, number> =>
  factor === 1 || zoomStep === 1 ? steps : Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v * zoomStep]))
// `npm run verify --update-baseline` hands the flag to npm, which passes it on as an environment
// variable rather than an argument, so both spellings are read.
const updateBaseline = args.includes('--update-baseline') || process.env.npm_config_update_baseline === 'true'

const BROWSERS: [string, BrowserType][] = [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]
const HELPERS: Helper[] = helperArg ?? ['fontFromStyle', 'shrinkwrap', 'balance', 'fitFontSize', 'fitFontSizeRich', 'clamp', 'truncateMiddle']
const OUTCOMES = ['pass', 'pretext-gap', 'platform', 'unreliable', 'kit-mismatch'] as const
// Outcomes that hide whether the kit is right; a rise in either could be a kit bug in disguise,
// so their counts are held to a committed baseline.
const GATED = ['pretext-gap', 'unreliable'] as const
const BASELINE = join(here, 'baseline.json')

type Run = { browser: string, factor: number, version: string, helper: Helper, seconds: number, results: CaseResult[] }
type BrowserInfo = { version: string, dpr: number, fonts: FontPresence[], seconds: number }
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
  for (const factor of factors) {
    const where = `${name}@${factor}`
    const tf = performance.now()
    const context = await browser.newContext({ deviceScaleFactor: factor })
    const page = await context.newPage()
    page.on('pageerror', e => console.error(`[${where}] page error: ${e.message}`))
    await page.goto(pathToFileURL(join(here, 'sweep.html')).href)
    await page.evaluate(([s, b]) => { window.sweepWidthStep = s; window.sweepBrowser = b }, [stepsAt(factor), name] as const)
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    if (dpr !== factor) failures.push(`${where}: devicePixelRatio is ${dpr}, not the requested ${factor}`)
    const fonts = await page.evaluate(() => window.fontPresence())
    for (const f of fonts) if (!f.present) failures.push(`${where}: pinned font family ${f.family} is not installed`)
    console.log(`${where} ${version}, devicePixelRatio ${dpr}, fonts: ${fonts.map(f => `${f.family} ${f.present ? 'present' : 'ABSENT'}`).join(', ')}`)
    for (const helper of HELPERS) {
      const t0 = performance.now()
      const corpora = await page.evaluate(h => window.sweepCorpora(h), helper)
      const results: CaseResult[] = []
      if (corpora.length === 0) results.push(...await page.evaluate(h => window.sweep(h), helper))
      for (const corpus of corpora) results.push(...await page.evaluate(([h, c]) => window.sweep(h, c), [helper, corpus] as const))
      const seconds = (performance.now() - t0) / 1000
      runs.push({ browser: name, factor, version, helper, seconds, results })
      const tally = OUTCOMES.map(o => `${o} ${results.filter(r => r.outcome === o).length}`).join(', ')
      console.log(`${where} ${helper}: ${results.length} cases in ${seconds.toFixed(1)}s (${tally})`)
    }
    infos.set(where, { version, dpr, fonts, seconds: (performance.now() - tf) / 1000 })
    await context.close()
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

type Located = { browser: string, factor: number, c: CaseResult }
// Findings grouped by what they are: helper, corpus, text and the detail's pattern (numbers and
// quoted text stand in as N and "…"), with how many cases each browser@factor had, the fonts and
// widths they span and one example. The cases themselves are in verify/results/latest.json.gz.
function grouped(cases: Located[]): string[] {
  type Group = { head: string, pattern: string, where: Map<string, number>, fonts: Set<string>, min: number, max: number, example: string }
  const groups = new Map<string, Group>()
  for (const { browser, factor, c } of cases) {
    const detail = (c.cause === undefined ? '' : `[${c.cause}] `) + (c.detail ?? '')
    const colon = detail.indexOf(': ')
    const label = c.cause === undefined && colon >= 0 ? detail.slice(0, colon) : ''
    const rest = c.cause === undefined && colon >= 0 ? detail.slice(colon + 2) : detail
    const pattern = rest.replace(/"(?:[^"\\]|\\.)*"/g, '"…"').replace(/-?\d+(\.\d+)?(e-?\d+)?/g, 'N')
    const head = `${c.helper} ${c.corpus}${label === '' ? '' : ` "${label}"`}`
    const key = `${head}|${pattern}`
    let g = groups.get(key)
    if (g === undefined) {
      g = { head, pattern, where: new Map(), fonts: new Set(), min: c.width, max: c.width, example: `${browser}@${factor} ${c.font} @ ${c.width}px${c.maxLines === undefined ? '' : ` maxLines ${c.maxLines}`}${c.box === undefined ? '' : ` box ${c.box}`}: ${rest}` }
      groups.set(key, g)
    }
    const at = `${browser}@${factor}`
    g.where.set(at, (g.where.get(at) ?? 0) + 1)
    g.fonts.add(c.font)
    g.min = Math.min(g.min, c.width)
    g.max = Math.max(g.max, c.width)
  }
  return [...groups.values()].map(g => {
    const where = [...g.where].map(([k, n]) => `${k} ${n}`).join(', ')
    return `- ${g.head}: ${g.pattern} (${where}; ${[...g.fonts].join(', ')}; ${g.min}-${g.max}px). E.g. ${g.example}`
  })
}

function casesOf(outcome: string): Located[] {
  return runs.flatMap(r => r.results.filter(c => c.outcome === outcome).map(c => ({ browser: r.browser, factor: r.factor, c })))
}

const mismatches = casesOf('kit-mismatch')
if (mismatches.length > 0) failures.push(`${mismatches.length} kit-mismatch cases`)

const full = only === undefined && helperArg === undefined && factorArg === undefined

// Gap and unreliable counts may drift a little with a browser update, but a jump is a finding.
type Baseline = Record<string, Record<string, number>>
const counts: Baseline = {}
for (const r of runs) {
  const entry: Record<string, number> = {}
  for (const o of GATED) entry[o] = count(r.results, o)
  counts[`${r.browser}@${r.factor}/${r.helper}`] = entry
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
    `Widths ${WIDTH_MIN}-${WIDTH_MAX}px (truncateMiddle ${LABEL_WIDTH_MIN}-${LABEL_WIDTH_MAX}px), at Playwright deviceScaleFactor ${factors.join(', ')}.`,
    ...factors.map(f => `Width step per helper at factor ${f}: ${Object.entries(stepsAt(f)).map(([k, v]) => `${k} ${v}`).join(', ')}.`),
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
    'same lines there), balance one pixel narrower must cost Pretext a line (unless a piece no width breaks, a',
    'grapheme, is wider than that, which balance then contains), and fitFontSize must fit by Pretext at its size and',
    'not at the next. fitFontSize\'s step-1 "fits" predicate mirrors the kit\'s own (no line overflows: every line within',
    'the width, or no unbreakable piece wider than it, since Pretext keeps some lines it reports wider than they',
    'paint), so step 1 checks the search, not the criterion; the painting is what tests the criterion: the painted',
    'height and scrollWidth, and, where Pretext reports a line past the width, the widest painted line to the fraction.',
    'Only then is the painting compared, where a disagreement is a pretext-gap: line counts at',
    'each width probed, shrinkwrap\'s width against the ceiling of the widest painted line (measured per line from the',
    'text\'s non-white-space fragments; one pixel less passes only if the browser paints the identical layout there,',
    'since engines let a line overshoot by up to 1/64 px), and balance one pixel narrower painting more lines.',
    '',
    'clamp runs at maxLines 1-5 with the tail `measureTail(\'…\', font)`. By Pretext: the tail must match Pretext\'s',
    'widths of `…` and a no-break space; the line count must be min(Pretext\'s, maxLines) and truncated exactly when',
    'Pretext lays out more; clampStats must agree; every line but a cut one must be Pretext\'s line at the same cursor;',
    'a cut last line must keep a grapheme, be the whole line when that line and `…` measured as one text fit, else a',
    'prefix of it whose text with `…`, measured as one text, fits W + 1/64 (unless it is one grapheme) while one more',
    'grapheme (with any white space before it; a soft hyphen\'s hyphen is none) would not. Then the',
    'painting, in a `display: -webkit-box; -webkit-line-clamp: N` box: truncation (scrollHeight > clientHeight) and',
    'clamped height must match, and every line painted in a `white-space: pre` span (the cut one followed by `…`) must',
    'be no wider than W + 1/64.',
    '',
    'fitFontSizeRich sizes an icon and its label as one row, at 8-32px with line height round(1.5·px): an',
    '`inline-block; vertical-align: top` icon round(1.25·px) wide and px tall, then the label with',
    '`margin-left: round(0.5·px)px` (the row\'s `extraWidth`, and `box-decoration-break: clone`, since Pretext charges',
    'a wrapped item\'s extraWidth on every line), in a `white-space: normal; overflow-wrap: break-word` box of width W,',
    `with the boxes { width: W, maxLines: 1 } and { width: W, height: 72 } (three 24px lines). Corpora: latin, german,`,
    'french, emoji-chat and ui-labels (real labels such as "Zahlungspflichtig abonnieren", not hyphenated). By Pretext,',
    'computed in the harness from `prepareRichInline` and `measureRichInlineStats` (never the kit): the handle and',
    'lineCount must match Pretext\'s count at W, the size must fit (no line past W + 1/64 unless no unbreakable piece,',
    'the row at width 0, is wider than that; the count within maxLines or count × line height within the height) and',
    'the next size must not; null only when 8px does not fit. Then the painting: at the answer and the next size, the',
    'painted line count must match Pretext\'s (else pretext-gap), and the answer must fit the box (lines or height,',
    'scrollWidth ≤ W and, where Pretext reports a line past W, the widest painted line, from the box\'s left edge to',
    'the rightmost icon or text fragment on it, within W + 1/64) while the next size must not.',
    '',
    `truncateMiddle runs on path labels, and on the German and French corpora, at widths ${LABEL_WIDTH_MIN}-${LABEL_WIDTH_MAX}px, with`,
    'keepEnd from the last `/` where there is one. By Pretext: the whole label exactly when its natural width fits;',
    'otherwise a start of the label, `…` and an end of it (compared without soft hyphens, which Pretext\'s line text',
    'leaves out), measuring no more than W + 1/64 as one text, where one more grapheme of the start would not fit;',
    'and the end must hold the file name when the name,',
    '`…` and the first grapheme, measured as one text, fit. Then the painting: the result in a `white-space: pre`',
    'span no wider than W + 1/64, and the name kept wherever the painted name, `…` and first grapheme fit.',
    '',
    'The german and french corpora carry soft hyphens (U+00AD) put in once by the `hyphen` package (hyphen/de, which',
    'is de-1996, and hyphen/fr; TeX hyph-utf8 patterns under the MIT licence; the package itself ISC) and are painted',
    'with `hyphens: manual`. Every helper sweeps them.',
    '',
    `\`npm run verify\` fails on any kit-mismatch, on a pinned font family that is absent, on a devicePixelRatio`,
    'other than the factor asked for, and when a browser×factor×helper\'s pretext-gap or unreliable count exceeds',
    '`verify/baseline.json` by more than max(5, 5%).',
    '',
    'The clamp paint check paints each line in a `white-space: pre` span on its own, which is an upper bound on what',
    'the clamped paragraph paints: Blink trims CJK punctuation at a line\'s edges (text-spacing-trim) in the paragraph,',
    'but not in an unconstrained span. So CJK clamp gaps such as "Zhufu quotes" (a line Pretext fits at 368px painting',
    '376px in the span) are false positives of the span, never missed ones; their details give Pretext\'s own line',
    'width for full lines and the joined width for a cut line with its `…`.',
    '',
    'Zoom is Playwright\'s deviceScaleFactor emulation on macOS: it shows that a finer device grid changes nothing',
    'here, not that Windows (DirectWrite) or Linux (FreeType hinting) measure alike, nor exactly what a user\'s page',
    'zoom does (which also changes CSS px per device pixel through the layout viewport).',
    '',
    'Every non-pass case is in `verify/results/latest.json.gz` (gzipped JSON: browser, factor and the case); below,',
    'findings are grouped by text and pattern.',
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
  for (const [name] of BROWSERS) for (const factor of factors) {
    const browserRuns = runs.filter(r => r.browser === name && r.factor === factor)
    const info = infos.get(`${name}@${factor}`)
    if (browserRuns.length === 0 || info === undefined) continue
    md.push(`## ${name} ${info.version} at deviceScaleFactor ${factor}`, '')
    md.push(`Measured devicePixelRatio ${info.dpr}; ${(info.seconds / 60).toFixed(1)} min. Fonts: ${info.fonts.map(f => `${f.family} ${f.present ? 'present' : '**absent**'}`).join(', ')}.`, '')
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
    else md.push(`${cases.length} cases in ${new Set(cases.map(x => x.c.detail)).size} distinct findings, grouped by text and pattern, with the cases per browser@factor.`, '', ...grouped(cases))
    md.push('')
  }
  writeFileSync(join(here, 'RESULTS.md'), md.join('\n'))
  mkdirSync(join(here, 'results'), { recursive: true })
  const listing = runs.flatMap(r => r.results.filter(c => c.outcome !== 'pass').map(c => ({ browser: r.browser, factor: r.factor, ...c })))
  // mtime 0 in the gzip header, so an unchanged listing writes an unchanged file.
  writeFileSync(join(here, 'results/latest.json.gz'), gzipSync(JSON.stringify(listing), { level: 9 }))
  console.log('wrote verify/results/latest.json.gz')
  console.log('wrote verify/RESULTS.md')
}

for (const { browser, factor, c } of mismatches.slice(0, 50)) {
  const maxLines = (c.maxLines === undefined ? '' : ` maxLines ${c.maxLines}`) + (c.box === undefined ? '' : ` box ${c.box}`)
  console.log(`kit-mismatch ${browser}@${factor} ${c.helper}${maxLines} ${c.corpus} / ${c.font} @ ${c.width}px: ${c.detail}`)
}
for (const f of failures) console.log(`FAIL ${f}`)
if (failures.length > 0) process.exitCode = 1

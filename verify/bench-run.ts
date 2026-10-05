// `npm run bench`: the cost bench (bench.ts) in Chromium, WebKit and Firefox, one browser at a time, headed, writing
// verify/BENCH.md and verify/results/bench.json. Separate from run.ts (the correctness sweep) so neither run waits on
// the other. Options: --sessions=<n> (default 3), --rounds=<n> timed rounds per session (default 20), --warmup=<n>
// discarded rounds (default 3, the first of which calibrates), --only=<browser>[,...]. A run with --only writes
// verify/results/BENCH-partial.md and bench-partial.json instead, so BENCH.md only ever holds a run of all three.
// --report re-renders BENCH.md from verify/results/bench.json, measuring nothing.
import { build } from 'esbuild'
import type { Plugin } from 'esbuild'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, loadavg, release, totalmem } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserType, Page } from 'playwright'
import type { Check, Counts, CountSummary, DomFirstPass, FirstPass, OpInfo, PerCall, Sample, SetupInfo } from './bench.ts'

const here = dirname(fileURLToPath(import.meta.url))
const readVersion = (path: string): string => JSON.parse(readFileSync(path, 'utf8')).version
const playwrightVersion = readVersion(join(here, '../node_modules/playwright/package.json'))
const pretextVersion = readVersion(join(here, '../node_modules/@chenglou/pretext/package.json'))
const sh = (cmd: string, cwd = here): string => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}
const pretextCommit = sh('git log -1 --format="%h %cs"', join(here, '../node_modules/@chenglou/pretext'))
const kitCommitNow = sh('git log -1 --format="%h %cs"')

const args = process.argv.slice(2)
const arg = (name: string): string | undefined => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
// --report re-renders BENCH.md from verify/results/bench.json without measuring anything.
const reportOnly = args.includes('--report')
type Saved = { date: string, playwrightVersion: string, pretextVersion: string, pretextCommit: string, kitCommit: string, dirty: boolean, results: BrowserResult[], config?: { sessions: number, rounds: number, warmup: number } }
const saved: Saved | undefined = reportOnly ? JSON.parse(readFileSync(join(here, 'results/bench.json'), 'utf8')) : undefined
const kitCommit = saved?.kitCommit ?? kitCommitNow
const pretextAt = saved?.pretextCommit ?? pretextCommit
const playwrightAt = saved?.playwrightVersion ?? playwrightVersion
const pretextVersionAt = saved?.pretextVersion ?? pretextVersion
const runDate = saved?.date ?? new Date().toISOString()
const SESSIONS = saved?.config?.sessions ?? saved?.results[0]?.sessions.length ?? Number(arg('sessions') ?? 3)
const ROUNDS = saved?.config?.rounds ?? Number(arg('rounds') ?? 20)
const WARMUP = saved?.config?.warmup ?? Math.max(1, Number(arg('warmup') ?? 3))
const only = arg('only')?.split(',')

// The timed bundle, and the count bundle in which Pretext's entries resolve to counting wrappers for every importer
// but the wrappers themselves.
const countPretext = join(here, 'bench-count-pretext.ts')
const countRich = join(here, 'bench-count-rich.ts')
const counting: Plugin = {
  name: 'count-pretext',
  setup(b) {
    b.onResolve({ filter: /^@chenglou\/pretext$/ }, a => a.importer === countPretext ? undefined : { path: countPretext })
    b.onResolve({ filter: /^@chenglou\/pretext\/rich-inline$/ }, a => a.importer === countRich ? undefined : { path: countRich })
  },
}
const common = { entryPoints: [join(here, 'bench.ts')], bundle: true, format: 'iife' as const, logLevel: 'warning' as const }
if (!reportOnly) {
  await build({ ...common, outfile: join(here, 'dist/bench.js') })
  await build({ ...common, outfile: join(here, 'dist/bench-count.js'), plugins: [counting] })
}

// Served cross-origin isolated (COOP and COEP) from 127.0.0.1, which gives every engine its finest performance.now();
// a file:// page gets a coarser one.
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
const server = createServer((req, res) => {
  const path = normalize(join(here, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)))
  if (!path.startsWith(here)) { res.writeHead(403).end(); return }
  try {
    const body = readFileSync(path)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
if (!reportOnly) await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
const origin = reportOnly ? '' : `http://127.0.0.1:${(server.address() as AddressInfo).port}`

type Probe = { minMs: number, medianMs: number }
type SessionResult = {
  session: number, setup: SetupInfo, first: FirstPass, domFirst: DomFirstPass, helveticaNeue: boolean, targetMs: number,
  reps: Record<string, number>, samples: Sample[], check: Check, perCall: PerCall | undefined,
  loadBefore: number[], loadAfter: number[], probeBefore: Probe, probeAfter: Probe, seconds: number,
}
// quiet: no other Playwright browser process (another agent's sweep, a headless check) was seen at the start of the
// measured run or in any poll during it (every 10 s); a run that saw one is thrown away and the browser run again.
// frontmost: the OS's frontmost app at each poll (lsappinfo), since page-level focus checks are emulated by Playwright.
type Quiet = {
  quiet: boolean, attempts: number, waitedSeconds: number, foreignMax: number, polls: number, loadStart: string, loadEnd: string,
  frontmost: Record<string, number>, snapshot: string[],
}
type BrowserResult = { name: string, version: string, ops: OpInfo[], sessions: SessionResult[], counts: Counts, quiet: Quiet, seconds: number }

const BROWSERS: [string, BrowserType][] = [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]
const results: BrowserResult[] = []
const ATTEMPTS = 3
const WAIT_POLL_MS = 60_000
const WAIT_MAX_MS = 30 * 60_000
const sysLoad = (): string => sh('sysctl -n vm.loadavg').replace(/[{}]/g, '').trim()
// The working tree's state, outside what the bench itself writes.
const dirtyNow = sh('git status --porcelain').split('\n').filter(l => l.trim() !== '' && !/verify\/(BENCH|results\/)/.test(l)).length > 0
const dirty = saved?.dirty ?? dirtyNow

// A fixed arithmetic loop timed in this process before and after each session, as a control for machine speed:
// Pretext's RESEARCH.md (Evaluation Traps, Timing) used such a probe to show a loaded machine (60.7 ms against
// 29.1 ms); its harness ships none, so this one is the bench's own. Seven runs; the minimum and median are kept.
let probeSink = 0
function arithmeticProbe(): Probe {
  const runs: number[] = []
  for (let r = 0; r < 7; r++) {
    const t = performance.now()
    let x = r
    for (let i = 0; i < 20_000_000; i++) x = (Math.imul(x, 1664525) + i) | 0
    probeSink ^= x
    runs.push(performance.now() - t)
  }
  runs.sort((a, b) => a - b)
  return { minMs: runs[0]!, medianMs: runs[3]! }
}

type Proc = { pid: number, ppid: number, pcpu: number, args: string }
function processes(): Proc[] {
  const out: Proc[] = []
  for (const line of sh('ps -Ao pid=,ppid=,pcpu=,args=').split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/.exec(line)
    if (m !== null) out.push({ pid: Number(m[1]), ppid: Number(m[2]), pcpu: Number(m[3]), args: m[4]! })
  }
  return out
}
function mineOf(ps: Proc[]): (pid: number) => boolean {
  const parent = new Map(ps.map(p => [p.pid, p.ppid]))
  return pid => {
    for (let p: number | undefined = pid, hops = 0; p !== undefined && p > 1 && hops < 64; p = parent.get(p), hops++) if (p === process.pid) return true
    return false
  }
}
// Playwright browser processes on this machine that this run did not start (not descendants of this process). The
// executable must live in Playwright's browser cache (a shell whose command line mentions it is no browser), and
// processes reparented to launchd (ppid 1) are skipped: Chromium's crashpad handlers daemonize and outlive their
// browser, this run's included, while another run's browser shows up through its main process.
function foreignBrowsers(): number {
  const ps = processes()
  const mine = mineOf(ps)
  return ps.filter(p => /^\/\S*\/ms-playwright\//.test(p.args) && p.ppid !== 1 && !mine(p.pid)).length
}
// The busiest processes other than this run's, by name only (no paths), for BENCH.md.
function snapshot(): string[] {
  const ps = processes()
  const mine = mineOf(ps)
  return ps.filter(p => !mine(p.pid) && p.pid !== process.pid).sort((a, b) => b.pcpu - a.pcpu).slice(0, 6)
    .map(p => `${p.pcpu.toFixed(1)}% ${(p.args.split(/ -{1,2}\w/)[0] ?? p.args).split('/').pop()!.trim()}`)
}
function frontmostApp(): string {
  const list = sh(`perl -e 'alarm 5; exec @ARGV' lsappinfo visibleProcessList`)
  return /"([^"]+)"/.exec(list)?.[1]?.replace(/_/g, ' ') ?? 'unknown'
}

async function waitForQuiet(name: string): Promise<number> {
  const t0 = Date.now()
  while (foreignBrowsers() > 0 && Date.now() - t0 < WAIT_MAX_MS) {
    console.log(`${name}: ${foreignBrowsers()} other Playwright browser processes running; waiting`)
    await new Promise(done => setTimeout(done, WAIT_POLL_MS))
  }
  return (Date.now() - t0) / 1000
}

async function openPage(type: BrowserType, name: string, query = ''): Promise<{ close: () => Promise<void>, page: Page, version: string }> {
  const browser = await type.launch({ headless: false })
  // DPR 1 in every engine: unpinned, Firefox took the display's 2 while Chromium and WebKit took 1.
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage()
  page.on('pageerror', e => console.error(`[${name}] page error: ${e.message}`))
  await page.goto(`${origin}/bench.html${query}`)
  await page.waitForFunction(() => typeof window.benchSetup === 'function')
  await page.bringToFront()
  return { close: () => browser.close(), page, version: browser.version() }
}

async function runSessions(name: string, type: BrowserType): Promise<{ version: string, ops: OpInfo[], sessions: SessionResult[] }> {
  let version = ''
  let ops: OpInfo[] = []
  const sessions: SessionResult[] = []
  for (let s = 1; s <= SESSIONS; s++) {
    const probeBefore = arithmeticProbe()
    // A browser launched per session, so each session's first pass meets a browser that has measured no text.
    const { close, page, version: v } = await openPage(type, name)
    version = v
    const loadBefore = loadavg()
    const t0 = performance.now()
    const setup = await page.evaluate(n => window.benchSetup(n), s)
    const first = await page.evaluate(() => window.benchFirstPass())
    const helveticaNeue = await page.evaluate(() => window.benchFontPresence())
    ops = await page.evaluate(() => window.benchInit())
    const targetMs = Math.max(25, 100 * setup.timerStep)
    const reps = await page.evaluate(t => window.benchCalibrate(t), targetMs)
    for (let w = 1; w < WARMUP; w++) await page.evaluate(r => window.benchRound(r), -w)
    const samples: Sample[] = []
    for (let r = 0; r < ROUNDS; r++) samples.push(...await page.evaluate(n => window.benchRound(n), r))
    const check = await page.evaluate(() => window.benchCheck())
    const perCall = s === 1 ? await page.evaluate(() => window.benchPerCall()) : undefined
    const seconds = (performance.now() - t0) / 1000
    const loadAfter = loadavg()
    await close()
    // The DOM's first pass needs a browser of its own: the kit's first pass has already warmed this one.
    const dom = await openPage(type, name)
    await dom.page.evaluate(n => window.benchSetup(n), s + 100)
    const domFirst = await dom.page.evaluate(() => window.benchDomFirstPass())
    await dom.close()
    const probeAfter = arithmeticProbe()
    console.log(`${name} ${version} session ${s}: ${samples.length} samples in ${seconds.toFixed(0)}s, timer ${setup.timerStep} ms, isolated ${setup.crossOriginIsolated}, dpr ${setup.dpr}, load ${loadBefore[0]!.toFixed(2)} → ${loadAfter[0]!.toFixed(2)}, probe ${probeBefore.minMs.toFixed(1)} → ${probeAfter.minMs.toFixed(1)} ms`)
    sessions.push({ session: s, setup, first, domFirst, helveticaNeue, targetMs, reps, samples, check, perCall, loadBefore, loadAfter, probeBefore, probeAfter, seconds })
  }
  return { version, ops, sessions }
}

if (saved !== undefined) results.push(...saved.results)
for (const [name, type] of reportOnly ? [] : BROWSERS) {
  if (only !== undefined && !only.includes(name)) continue
  const buildDir = type.executablePath().split('ms-playwright/')[1]?.split('/')[0]
  let run: { version: string, ops: OpInfo[], sessions: SessionResult[] } | undefined
  let quiet: Quiet | undefined
  let waitedSeconds = 0
  const tb = performance.now()
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    waitedSeconds += await waitForQuiet(name)
    const snap = snapshot()
    const loadStart = sysLoad()
    let foreignMax = foreignBrowsers()
    let polls = 1
    const frontmost: Record<string, number> = {}
    const timer = setInterval(() => {
      foreignMax = Math.max(foreignMax, foreignBrowsers())
      polls++
      const app = frontmostApp()
      frontmost[app] = (frontmost[app] ?? 0) + 1
    }, 10_000)
    try {
      run = await runSessions(name, type)
    } finally {
      clearInterval(timer)
    }
    foreignMax = Math.max(foreignMax, foreignBrowsers())
    polls++
    quiet = { quiet: foreignMax === 0, attempts: attempt, waitedSeconds, foreignMax, polls, loadStart, loadEnd: sysLoad(), frontmost, snapshot: snap }
    console.log(`${name}: attempt ${attempt} ${quiet.quiet ? 'quiet' : `NOT quiet (up to ${foreignMax} other Playwright browser processes)`}, load ${loadStart} → ${quiet.loadEnd}, frontmost ${JSON.stringify(frontmost)}`)
    if (quiet.quiet) break
  }
  const { close, page } = await openPage(type, name, '?count')
  await page.evaluate(() => window.benchSetup(0))
  const counts = await page.evaluate(() => window.benchCounts())
  await close()
  const version = buildDir === undefined ? run!.version : `${run!.version} (${buildDir})`
  results.push({ name, version, ops: run!.ops, sessions: run!.sessions, counts, quiet: quiet!, seconds: (performance.now() - tb) / 1000 })
}
if (!reportOnly) server.close()

// --- Statistics: µs per unit. Each sample is a mean over its repetitions; the tables give the median and p95 of those
// sample means across sessions, so the spread is sample to sample, not call to call (the per-call table is that). ---
const perUnit = (x: Sample): number => x.ms * 1000 / x.units
function quantile(sorted: number[], q: number): number {
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!
}
// Sessions disagree when their medians differ by more than this factor; such a row's headline is the session range.
const DISAGREE = 1.25
type Row = { op: OpInfo, median: number, p95: number, sessionMedians: number[], n: number, disagree: boolean }
function rows(b: BrowserResult): Row[] {
  return b.ops.map(op => {
    const ok = b.sessions.flatMap(s => s.samples.filter(x => x.op === op.id)).map(perUnit).sort((a, c) => a - c)
    const sessionMedians = b.sessions.map(s => {
      const v = s.samples.filter(x => x.op === op.id).map(perUnit).sort((a, c) => a - c)
      return v.length === 0 ? NaN : quantile(v, 0.5)
    })
    const disagree = Math.max(...sessionMedians) / Math.min(...sessionMedians) > DISAGREE
    return { op, median: quantile(ok, 0.5), p95: quantile(ok, 0.95), sessionMedians, n: ok.length, disagree }
  })
}
// Three significant figures, decided after rounding (9.996 is "10.0", not "10.00").
function fmt(us: number): string {
  if (!Number.isFinite(us)) return '–'
  const r = Number(us.toPrecision(3))
  return r >= 100 ? r.toFixed(0) : r >= 10 ? r.toFixed(1) : r >= 1 ? r.toFixed(2) : r.toFixed(3)
}
// Two significant figures, zeros kept ("2.0", not "2").
const sig2 = (x: number): string => { const r = Number(x.toPrecision(2)); return r >= 10 ? r.toFixed(0) : r.toFixed(1) }
const sum = (c: CountSummary): string => `${c.mean.toFixed(2)} (${c.min}–${c.max})`
const range = (xs: number[]): string => `${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))}`

const partial = only !== undefined
if (!reportOnly) {
  const json = { date: runDate, playwrightVersion, pretextVersion, pretextCommit, kitCommit, dirty, config: { sessions: SESSIONS, rounds: ROUNDS, warmup: WARMUP }, results }
  mkdirSync(join(here, 'results'), { recursive: true })
  writeFileSync(join(here, partial ? 'results/bench-partial.json' : 'results/bench.json'), JSON.stringify(json) + '\n')
}

const table = new Map(results.map(b => [b.name, rows(b)]))
for (const b of results) {
  console.log(`\n${b.name} ${b.version}`)
  for (const r of table.get(b.name)!) console.log(`  ${r.op.label}: median ${fmt(r.median)} µs, p95 ${fmt(r.p95)} µs per ${r.op.unit}${r.disagree ? ` (sessions disagree: ${range(r.sessionMedians)})` : ''}`)
}

const os = `macOS ${sh('sw_vers -productVersion')} (${sh('sw_vers -buildVersion')}), Darwin ${release()}`
const cpu = cpus()
const allSessions = results.flatMap(b => b.sessions)
const loads1 = allSessions.flatMap(s => [s.loadBefore[0]!, s.loadAfter[0]!])
const probes = allSessions.flatMap(s => [s.probeBefore.minMs, s.probeAfter.minMs])
const snapAll = results.flatMap(b => b.quiet.snapshot).join('\n')
const loaders: string[] = []
if (/replayd/.test(snapAll)) loaders.push('screen recording (replayd)')
if (/ComputerUse|computer-use/i.test(snapAll)) loaders.push('a UI-driving agent service (computer use)')
const fronts = results.map(b => {
  const total = Object.values(b.quiet.frontmost).reduce((a, c) => a + c, 0)
  const own = Object.entries(b.quiet.frontmost).filter(([k]) => /Chrom|Testing|WebKit|Playwright|Nightly|Firefox|MiniBrowser/i.test(k)).reduce((a, [, c]) => a + c, 0)
  return { name: b.name, own, total }
})
const frontNote = fronts.every(f => f.total > 0 && f.own === f.total) ? ''
  : `The browser was frontmost at only ${fronts.map(f => `${f.own}/${f.total}`).join(', ')} polls (${fronts.map(f => f.name).join(', ')}${fronts.some(f => f.own === 0) ? `; ${fronts.filter(f => f.own === 0).map(f => f.name).join(' and ')} never` : ''});\n> OS background throttling cannot be ruled out. `
const minutes = results.reduce((t, b) => t + b.seconds, 0) / 60
const med = (b: string, id: string): number => table.get(b)!.find(r => r.op.id === id)!.median
const val = (b: string, id: string): string => {
  const r = table.get(b)!.find(x => x.op.id === id)!
  return r.disagree ? `${range(r.sessionMedians)} µs (sessions disagree)` : `${fmt(r.median)} µs`
}

const md: string[] = [
  partial ? `# Cost bench (partial run: ${only!.join(', ')})` : '# Cost bench',
  '',
  `> **Measured on a loaded machine; every timing here is an upper bound.** ${loaders.length > 0 ? `${loaders.join(' and ').replace(/^./, c => c.toUpperCase())} ${loaders.length > 1 ? 'were' : 'was'} running, ` : ''}other agents' sessions were`,
  `> active (their Playwright browsers were waited out and polled for; see Machine state), and the 1-min load average`,
  `> ran ${Math.min(...loads1).toFixed(1)}-${Math.max(...loads1).toFixed(1)} on ${cpu.length} cores across the sessions. A fixed arithmetic probe took ${Math.min(...probes).toFixed(1)}-${Math.max(...probes).toFixed(1)} ms`,
  `> (fastest of 7) before and after the sessions. ${frontNote}To reproduce on a quiet machine: quit other apps, stop screen`,
  `> recording, run \`npm install && npx playwright install chromium webkit firefox && npm run bench\` from the`,
  `> repository root, and leave the Mac untouched for about ${Math.ceil(minutes)} minutes (this run's length).`,
  '',
  `Run on ${runDate.slice(0, 10)} by \`npm run bench\` (verify/bench-run.ts, verify/bench.ts), kit at ${kitCommit}${dirty ? ' with uncommitted changes' : ''},`,
  `Pretext ${pretextVersionAt} at ${pretextAt}, Playwright ${playwrightAt}.`,
  `Machine: ${cpu[0]?.model ?? 'unknown CPU'}, ${cpu.length} cores, ${(totalmem() / 2 ** 30).toFixed(0)} GB RAM; ${os}.`,
  '',
  `Each browser ran ${SESSIONS} sessions, one after another and never side by side, each in a newly launched headed`,
  'browser serving `bench.html` cross-origin isolated from 127.0.0.1.',
  `A session runs ${WARMUP} discarded warm-up rounds (the first sizes every operation's repetitions) and ${ROUNDS} timed`,
  'rounds; a round runs every operation once, in an order shuffled per round, each sample after a MessageChannel',
  'yield. A sample repeats its operation until it takes the target time (25 ms, or 100 timer steps where the timer is',
  'coarser), so timer coarsening and single GC pauses cannot decide it. Each sample is therefore a **mean per',
  'message** (or label, row or call); the tables give the **median and p95 of those sample means** over the',
  `${SESSIONS * ROUNDS} samples of the sessions (sample to sample, not call to call; the per-call table gives calls), with`,
  'each session\'s median beside them, since sessions drift apart (Pretext, RESEARCH.md, Evaluation Traps, Timing). A row',
  `whose session medians differ by more than ${DISAGREE}× is flagged, and its headline is the range of the session medians.`,
  'These numbers are reported, not targeted.',
  '',
  '## Workload',
  '',
]
const s0 = results[0]!.sessions[0]!.setup
md.push(
  `- **Messages**: ${s0.messages.n} distinct chat-like messages cut at word boundaries from the sweep's corpora`,
  `  (verify/corpora.ts), one corpus a message: ${Object.entries(s0.messages.byCorpus).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
  `  Lengths follow Pretext's bench: ${s0.messages.short} under 20 UTF-16 units, ${s0.messages.medium} of 20-100, ${s0.messages.long} over 100`,
  `  (median ${s0.messages.medianLength}); a fifth end with an emoji. Font \`${s0.font}\`, line height ${s0.lineHeight}px, from`,
  '  `fontFromStyle` on a styled element (Helvetica Neue was ' + (allSessions.every(s => s.helveticaNeue) ? 'present in every browser' : '**absent** in a browser') + ', probed after the first pass).',
  '- **Resize**: `layout()`, shrinkwrap and balance are timed at 399 px on handles prepared once. They keep no state',
  '  per width and measure nothing new (they walk cached widths), so repeating 399 is the resize. clamp and',
  '  truncateMiddle measure their cut texts through Pretext, whose caches would hold a width\'s cuts after one',
  '  repetition, so each repetition takes a width the session has not used, stepping down a pixel from 399 (or 200),',
  '  1/64 px lower on each pass through 100 (or 50) px; nearby widths can still cut the same text, as during a drag.',
  '  fitFontSize and fitFontSizeRich get a warm row (a second call, 400 then 399, on the same PreparedSizes) and cold',
  '  rows (a new PreparedSizes, with Pretext\'s caches warm or cleared).',
  '- **clamp**: `clamp(prepared, w, 3, measureTail(\'…\', font))`.',
  '- **truncateMiddle**: 200 distinct path labels recombined from the sweep\'s labels\' directories and file names,',
  '  `keepEnd` from the last `/`; `prepareLabel` timed apart.',
  `- **fitFontSize**: the messages in a { width: 399, height: 96 } box, sizes 8-48, line height round(1.5 × px).`,
  '- **fitFontSizeRich**: 200 icon-and-label rows (the sweep\'s UI labels and 8-40 unit runs of its Latin, German,',
  '  French and emoji corpora): an icon round(1.25 × px) wide, then the label with extraWidth round(0.5 × px), in a',
  '  { width: 399, height: 72 } box, sizes 8-32.',
  '- **List**: `stack` over 10,000 heights (the messages\' heights at 399, repeated), and `findIndexAt` for 1,000',
  '  random offsets into those 10,000 tops; µs per call.',
  '- **Pretext\'s caches**: Pretext keeps every segment width it measures, per font, until `clearCache()`. In the rows',
  '  marked "caches warm" they hold every word of the workload at every size a search has probed; that memory grows',
  '  with the distinct words and sizes an app measures, and it was not measured here.',
  '',
  '**First sight.** The cold prepare row clears Pretext\'s caches (`clearCache()`) before each batch and prepares 1,000',
  'new message strings. The corpora are small, so new strings are not new words, and short messages recur across',
  'batches; the browser\'s own caches are as earlier batches left them. The "first pass in a fresh browser" table',
  'times the first 1,000 messages a newly launched browser measures, and, as a control, a second new batch right',
  'after it with Pretext\'s caches cleared again; the DOM gets the same in a browser launched for it alone.',
  '',
  '**DOM baselines**, written as a competent implementation would: `dom.resize` sets the width of a box holding the',
  '1,000 message divs (already laid out at the other width) and then reads every height, so a resize costs one',
  'reflow and no read forces another; `dom.first` creates and appends 1,000 new message divs and reads their heights',
  '(again one reflow). For fitting, the common loop binary-searches each message in one fixed-size box,',
  '`overflow: hidden`, reading `scrollHeight` and `scrollWidth` after each size (a reflow per size tried, as most',
  'code does); the lockstep variant searches all 1,000 boxes at once from scratch, writing every box\'s next size and',
  'then reading them all, a reflow per search step for all boxes; and the warm-started variant, the fair comparison',
  'for a resize, sets the boxes from 400 to 399 px and has each try the size it had at 400, then one pixel larger, and',
  'bisect only where that does not settle it. None includes paint, which the kit also avoids; all include the style',
  'recalculation a font-size change costs. The kit and the DOM must answer alike for the comparison to hold; the',
  'agreement table says how often they did.',
  '',
)

md.push('## Machine state', '')
md.push(
  'Pretext\'s guidance is a quiet machine; this one was shared with other agents. Before each browser\'s measured run',
  'the bench waited (polling every 60 s, up to 30 min) until no Playwright browser it had not started was running, then',
  'polled every 10 s during the run; a run that saw one was thrown away and the browser run again (up to',
  `${ATTEMPTS} attempts). The column "no other Playwright browser" says whether none was seen at the start or in any poll.`,
  'Other load (apps, system daemons, other agents\' non-browser work) was not controlled: the load averages',
  '(`sysctl -n vm.loadavg`, 1, 5 and 15 min) at the start and end of each browser\'s measured run, the busiest other',
  'processes just before it, and the arithmetic probe (a fixed 20M-step integer loop in the runner, fastest of 7)',
  'before and after each session are recorded so the numbers can be read as what they are: upper bounds.',
  '',
  'Focus: Playwright emulates page focus, so the page\'s own focus checks prove nothing. The runner instead polled the',
  'OS\'s frontmost app (`lsappinfo visibleProcessList`) every 10 s; the tallies are below. A browser that was not',
  'frontmost may have been throttled by the OS; the bench does not drop samples for it.',
  '',
  '| browser | no other Playwright browser | attempts | waited | polls | load at start | load at end | probe ms per session (before → after) | frontmost app at polls |',
  '|---|---|---:|---:|---:|---|---|---|---|',
  ...results.map(b => `| ${b.name} | ${b.quiet.quiet ? 'yes' : `**no** (up to ${b.quiet.foreignMax} processes)`} | ${b.quiet.attempts} | ${b.quiet.waitedSeconds.toFixed(0)} s | ${b.quiet.polls} | ${b.quiet.loadStart} | ${b.quiet.loadEnd} | ${b.sessions.map(s => `${s.probeBefore.minMs.toFixed(1)} → ${s.probeAfter.minMs.toFixed(1)}`).join(', ')} | ${Object.entries(b.quiet.frontmost).map(([k, v]) => `${k} ${v}`).join(', ')} |`),
  '',
)
for (const b of results) md.push(`Busiest other processes before ${b.name} (%CPU, name): ${b.quiet.snapshot.join('; ')}.`, '')

md.push('## Browsers and timers', '')
md.push('| browser | build | cross-origin isolated | devicePixelRatio | timer step (ms) | target per sample (ms) | 1-min load before → after each session |', '|---|---|---|---:|---:|---:|---|')
for (const b of results) {
  const uniq = <T>(f: (s: SessionResult) => T): string => [...new Set(b.sessions.map(f))].join(', ')
  const load = b.sessions.map(s => `${s.loadBefore[0]!.toFixed(1)}→${s.loadAfter[0]!.toFixed(1)}`).join(', ')
  md.push(`| ${b.name} | ${b.version} | ${uniq(s => s.setup.crossOriginIsolated)} | ${uniq(s => s.setup.dpr)} | ${uniq(s => Number(s.setup.timerStep.toPrecision(3)))} | ${uniq(s => s.targetMs)} | ${load} |`)
}
md.push('', 'The timer step is the smallest nonzero difference between two `performance.now()` readings in 1,000 tries.',
  'Browsers coarsen the timer and add jitter, so the sample length, not the step, sets the resolution of the tables.', '')

for (const b of results) {
  md.push(`## ${b.name} ${b.version}`, '')
  md.push(`| operation | per | median of sample means, µs | p95 of sample means, µs | session medians, µs | samples |`, '|---|---|---:|---:|---|---:|')
  let group = ''
  for (const r of table.get(b.name)!) {
    if (r.op.group !== group) {
      group = r.op.group
      md.push(`| **${{ prepare: 'a) prepare', layout: 'b) Pretext layout', helpers: 'c) kit helpers', list: 'd) list helpers', dom: 'e) DOM baselines' }[group] ?? group}** | | | | | |`)
    }
    const head = r.disagree ? `**${range(r.sessionMedians)}** (sessions disagree)` : fmt(r.median)
    md.push(`| ${r.op.label} | ${r.op.unit} | ${head} | ${fmt(r.p95)} | ${r.sessionMedians.map(fmt).join(', ')} | ${r.n} |`)
  }
  md.push('')
}
const flagged = results.flatMap(b => table.get(b.name)!.filter(r => r.disagree).map(r => `${b.name} ${r.op.id}`))
md.push(flagged.length === 0 ? `No row\'s session medians differ by more than ${DISAGREE}×.` : `Rows whose session medians differ by more than ${DISAGREE}×: ${flagged.join(', ')}. Why they differ was not established; read their range, not a single number.`, '')

md.push('## Per call', '', 'Session 1 of each browser, outside the timed rounds: each call timed alone, at widths the session had not',
  'used, in µs. Every reading is quantised to the timer step (above), and browsers add jitter to it (readings land on',
  'multiples of the step, often several steps apart), so a call shorter than a few steps is not resolved: read the',
  'tails (p95, max), which show the calls that pay prepares or a GC, not the typical call, which the tables above give.', '')
md.push('| browser | call | calls | p50 | p95 | max |', '|---|---|---:|---:|---:|---:|')
for (const b of results) {
  const pc = b.sessions[0]!.perCall
  if (pc === undefined) continue
  const step = b.sessions[0]!.setup.timerStep * 1000
  // A reading of 0 is a call shorter than the timer could see, not a free one.
  const cell = (us: number): string => us === 0 ? `< ${sig2(step)} (below the timer)` : fmt(us)
  for (const [k, c] of Object.entries(pc)) md.push(`| ${b.name} | ${k} | ${c.n} | ${cell(c.p50)} | ${cell(c.p95)} | ${cell(c.max)} |`)
}
md.push('')

md.push('## First pass in a fresh browser', '', 'µs per message, one value per session. The kit: the first 1,000 messages a newly launched browser prepares and lays',
  'out (at 399), then a second batch of new strings right after with Pretext\'s caches cleared (the control). The DOM:',
  'the first 1,000 new message divs another newly launched browser creates, appends and reads, then a second batch.',
  'The gap between a first pass and its control is what an engine and browser warm on first use (JIT, the canvas, font',
  'loading, shaping caches); this bench does not take it apart.', '')
md.push('| browser | kit: first prepare | kit: first layout | kit: second prepare (control) | DOM: first pass | DOM: second pass (control) |', '|---|---|---|---|---|---|')
for (const b of results) {
  const per = (f: (s: SessionResult) => number, n: (s: SessionResult) => number): string => {
    const v = b.sessions.map(s => f(s) * 1000 / n(s))
    const cell = v.map(fmt).join(', ')
    return Math.max(...v) / Math.min(...v) > DISAGREE ? `${cell} (**sessions disagree**, ${sig2(Math.max(...v) / Math.min(...v))}×)` : cell
  }
  md.push(`| ${b.name} | ${per(s => s.first.prepareMs, s => s.first.n)} | ${per(s => s.first.layoutMs, s => s.first.n)} | ${per(s => s.first.secondPrepareMs, s => s.first.n)} | ${per(s => s.domFirst.firstMs, s => s.domFirst.n)} | ${per(s => s.domFirst.secondMs, s => s.domFirst.n)} |`)
}
md.push('')

// The structural bounds, from src/width.ts and src/font-size.ts: balance walks once for its target, once at
// floor(maxWidth), ceil(log2(floor(maxWidth))) times in its bisection, once for the widest piece and once to check, so
// ceil(log2 W) + 4, and its shrinkwrap fallback adds up to 2 when the check fails: ceil(log2 W) + 6 in all. A cold fitFontSize prepares min, then at
// most ceil(log2(max - min + 1)) more sizes; each probe is a walk, plus one walk for the answer and one per size whose
// widest line is past the width (the widest piece).
const balanceBound = Math.ceil(Math.log2(399)) + 6
const fitPrep = 1 + Math.ceil(Math.log2(48 - 8 + 1))
const richPrep = 1 + Math.ceil(Math.log2(32 - 8 + 1))
const verdict = (ok: boolean): string => ok ? 'within' : '**over**'
md.push('## Structural counts', '', 'Pretext calls per kit call, from the count bundle, in which `@chenglou/pretext` and its rich-inline entry resolve',
  'to counting wrappers (verify/bench-count-pretext.ts, verify/bench-count-rich.ts) for the kit\'s own imports; src/ is',
  'not touched and the counted bundle is never timed. Mean (min–max) over the workload at 399.', '')
md.push('| browser | balance: measureLineStats walks | shrinkwrap walks | fitFontSize cold: prepares / walks | fitFontSize warm: prepares / walks | fitFontSizeRich cold: prepares / walks | fitFontSizeRich warm: prepares / walks |', '|---|---|---|---|---|---|---|')
for (const b of results) {
  const c = b.counts
  md.push(`| ${b.name} | ${sum(c.balanceWalks)} | ${sum(c.shrinkwrapWalks)} | ${sum(c.fitColdPrepares)} / ${sum(c.fitColdWalks)} | ${sum(c.fitWarmPrepares)} / ${sum(c.fitWarmWalks)} | ${sum(c.richColdPrepares)} / ${sum(c.richColdWalks)} | ${sum(c.richWarmPrepares)} / ${sum(c.richWarmWalks)} |`)
}
md.push('', 'Against the bounds the code gives (the spec\'s "about log2(maxWidth)" and "about log2(max − min) + 1"):', '')
for (const b of results) {
  const c = b.counts
  md.push(`- ${b.name}: balance at most ${c.balanceWalks.max} walks, ${verdict(c.balanceWalks.max <= balanceBound)} ceil(log2 399) + 6 = ${balanceBound}, and ${verdict(c.balanceWalks.max <= balanceBound - 2)} ${balanceBound - 2}, the bound when the shrinkwrap fallback is not taken` +
    ` (mean ${c.balanceWalks.mean.toFixed(2)} against log2 399 = ${Math.log2(399).toFixed(2)}); fitFontSize cold at most ${c.fitColdPrepares.max} prepares,` +
    ` ${verdict(c.fitColdPrepares.max <= fitPrep)} 1 + ceil(log2 41) = ${fitPrep}; fitFontSizeRich cold at most ${c.richColdPrepares.max},` +
    ` ${verdict(c.richColdPrepares.max <= richPrep)} 1 + ceil(log2 25) = ${richPrep}.`)
}
md.push('', 'Prepares per call at resize time, where the kit measures a cut text joined to its ellipsis as one prepared text (src/cut.ts):', '')
md.push('| browser | clamp(…, 399, 3) | truncateMiddle at 399 | truncateMiddle at 200 |', '|---|---|---|---|')
for (const b of results) {
  const c = b.counts
  md.push(`| ${b.name} | ${sum(c.clampPrepares)} | ${sum(c.middlePrepares399)} | ${sum(c.middlePrepares200)} |`)
}
md.push('')

md.push('## Kit and DOM agreement on this workload', '', 'From each browser\'s first session, at 399. Not a correctness gate (that is `npm run verify`); it says the', 'timed DOM baselines did the same job.', '')
md.push('| browser | heights equal (kit layout vs DOM) | fitFontSize px equal (kit vs DOM lockstep) | warm kit vs DOM lockstep | warm-started DOM vs DOM lockstep (reflow steps) | DOM loop vs DOM lockstep | clamp truncated | truncateMiddle cut at 399 / 200 |', '|---|---|---|---|---|---|---|---|')
for (const b of results) {
  const c = b.sessions[0]!.check
  md.push(`| ${b.name} | ${c.heightsAgree}/${c.heightsN} | ${c.fitAgree}/${c.fitN} | ${c.fitWarmAgree}/${c.fitN} | ${c.fitWarmDomAgree}/${c.fitN} (${c.domWarmSteps}) | ${c.fitLoopAgree}/${c.fitN} | ${c.clampTruncated}/${c.heightsN} | ${c.middleTruncated399}/${c.labelsN} / ${c.middleTruncated200}/${c.labelsN} |`)
}
md.push('')

const dprs = results.map(b => ({ name: b.name, dpr: [...new Set(b.sessions.map(s => s.setup.dpr))].join('/') }))
const dprCaveat = new Set(dprs.map(d => d.dpr)).size > 1
  ? ` This run's devicePixelRatio differed between browsers (${dprs.map(d => `${d.name} ${d.dpr}`).join(', ')}; later runs pin 1), so the DOM rows, which lay out at that ratio, should not be compared across browsers.`
  : ''

// The interpretation is computed from this run's medians, so it stays true when the bench is run again.
md.push('## Reading the numbers', '')
// Within 5% either way is not called faster or slower: sessions alone drift that far.
const times = (a: number, b: number): string => Math.abs(a / b - 1) <= 0.05 ? 'about as fast as'
  : a > b ? `${sig2(a / b)}× slower than` : `${sig2(b / a)}× faster than`
for (const b of results) {
  const n = b.name
  const L = med(n, 'layout.399')
  const P = med(n, 'prepare.cold')
  const Pn = med(n, 'prepare.new')
  md.push(`- **${n}.** On a resize, Pretext's layout() (what a kit-built list uses for its heights) is ${times(L, med(n, 'dom.resize'))} the batched`,
    `  DOM read of the same heights (${val(n, 'layout.399')} against ${val(n, 'dom.resize')} per message); shrinkwrap costs ${val(n, 'shrinkwrap.399')}, balance`,
    `  ${val(n, 'balance.399')} (${sig2(med(n, 'balance.399') / L)}× layout()), clamp ${val(n, 'clamp.399')}. At first sight, Pretext's cold prepare plus layout`,
    `  (${fmt(P + L)} µs per message) is ${times(P + L, med(n, 'dom.first'))} creating, appending and reading as many new DOM messages`,
    `  (${val(n, 'dom.first')}); with Pretext's caches warm, new strings cost ${fmt(Pn + L)} µs. On a resize, fitFontSize's second call at`,
    `  the new width (${val(n, 'fit.warm')}) is ${times(med(n, 'fit.warm'), med(n, 'dom.fit.warm'))} the warm-started DOM search (${val(n, 'dom.fit.warm')}).`,
    `  For a new text, fitFontSize with a new PreparedSizes (${val(n, 'fit.cold')}) is ${times(med(n, 'fit.cold'), med(n, 'dom.fit.lockstep'))} the DOM lockstep search`,
    `  from scratch (${val(n, 'dom.fit.lockstep')}), and ${times(med(n, 'fit.cleared'), med(n, 'dom.fit.lockstep'))} it with Pretext's caches cleared too`,
    `  (${val(n, 'fit.cleared')}); the common per-box DOM loop costs ${val(n, 'dom.fit.loop')}.`)
}
md.push('', '**What dominates.**', '')
const PREPARING = ['prepare.cold', 'prepareLabel', 'fit.cleared', 'fit.cold', 'rich.cleared', 'rich.cold']
const RESIZING = ['shrinkwrap.399', 'balance.399', 'clamp.399', 'truncateMiddle.399', 'truncateMiddle.200', 'fit.warm', 'rich.warm']
const SHORT: Record<string, string> = {
  'prepare.cold': 'cold prepareWithSegments', prepareLabel: 'prepareLabel', 'fit.cleared': 'fitFontSize with Pretext\'s caches cleared',
  'fit.cold': 'fitFontSize with a new PreparedSizes', 'rich.cleared': 'fitFontSizeRich with Pretext\'s caches cleared',
  'rich.cold': 'fitFontSizeRich with a new PreparedSizesRich', 'shrinkwrap.399': 'shrinkwrap', 'balance.399': 'balance', 'clamp.399': 'clamp',
  'truncateMiddle.399': 'truncateMiddle near 399', 'truncateMiddle.200': 'truncateMiddle near 200', 'fit.warm': 'fitFontSize\'s second call',
  'rich.warm': 'fitFontSizeRich\'s second call',
}
for (const b of results) {
  const n = b.name
  const resize = RESIZING.map(id => ({ id, us: med(n, id) })).sort((x, y) => x.us - y.us)
  const prep = PREPARING.map(id => ({ id, us: med(n, id) })).sort((x, y) => y.us - x.us)
  const mid = (f: (s: SessionResult) => number): number => {
    const v = b.sessions.map(f).sort((x, y) => x - y)
    return v[v.length >> 1]!
  }
  const first = mid(s => s.first.prepareMs * 1000 / s.first.n)
  const second = mid(s => s.first.secondPrepareMs * 1000 / s.first.n)
  const top = prep.slice(0, 3).map(p => `${SHORT[p.id]} ${val(n, p.id)}`).join(', ')
  const lead = prep[0]!.us > resize[resize.length - 1]!.us ? `The costliest calls are ones that prepare: ${top}.` : `The calls that prepare cost ${top}.`
  md.push(`- **${n}.** ${lead} A cold prepare is ${sig2(med(n, 'prepare.cold') / med(n, 'layout.399'))}× a layout() of the same message.`,
    `  At resize time the helpers cost ${val(n, resize[0]!.id)} (${SHORT[resize[0]!.id]}) to ${val(n, resize[resize.length - 1]!.id)} (${SHORT[resize[resize.length - 1]!.id]}), against`,
    `  layout()'s ${val(n, 'layout.399')}. The first pass in a fresh browser prepared at ${fmt(first)} µs per message and the control batch right`,
    `  after it at ${fmt(second)} µs (medians of the sessions), against ${val(n, 'prepare.cold')} for the cleared-cache row.`)
}
md.push('',
  'First-sight preparation is the cost the kit inherits from Pretext. A cold fitFontSize prepares the text at each',
  'size its search probes (the structural counts), so it is several first-sight prepares, not one; its second call at',
  'a new width is a few walks over the handles the first call left, and the counts show it prepares almost nothing.',
  'balance is a binary search of walks, so it costs about as many layouts as its count. clamp and truncateMiddle find',
  'a cut by bisection, measuring each candidate joined to the ellipsis as one prepared text (src/cut.ts), so a',
  'truncated row pays several small prepares at resize time (the prepares table); prepareLabel lays the label out at',
  'width 0 to find every cut point and measures the ellipsis, once per label. The list helpers cost nanoseconds per row.',
  '',
  '**Where the DOM is the better tool.** The DOM numbers here are for an app that would lay these elements out',
  'anyway: a DOM read after a width change measures many boxes in one reflow, and the first-sight comparison charges',
  'the DOM for creating elements an app may already have. Where the DOM row is faster, the kit\'s case is that it',
  'answers without the elements existing (virtualised lists, a worker, before first paint) and without forcing',
  'reflow mid-frame, not raw speed. A DOM measurement also includes text the kit does not model (it is exact only',
  'within what Pretext models; see RESULTS.md).',
  '',
  '**Caveats.** One machine, one OS, one font stack; Windows and Linux text stacks were not timed. Sessions differ',
  '(see the session medians); compare rows within a run, never across machines. On a loaded machine the numbers are',
  'upper bounds.' + dprCaveat,
  '')
const out = partial ? 'results/BENCH-partial.md' : 'BENCH.md'
writeFileSync(join(here, out), md.join('\n'))
console.log(reportOnly ? `wrote verify/${out} from verify/results/bench.json` : `wrote verify/${out} and verify/results/${partial ? 'bench-partial.json' : 'bench.json'}`)

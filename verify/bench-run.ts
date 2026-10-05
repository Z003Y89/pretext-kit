// `npm run bench`: the cost bench (bench.ts) in Chromium, WebKit and Firefox, one browser at a time, headed and in
// the foreground, writing verify/BENCH.md and verify/results/bench.json. Separate from run.ts (the correctness sweep)
// so neither run waits on the other. Options: --sessions=<n> (default 3), --rounds=<n> timed rounds per session
// (default 20), --warmup=<n> discarded rounds (default 3, the first of which calibrates), --only=<browser>[,...]; only a
// run of all three browsers writes BENCH.md.
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
import type { BrowserType } from 'playwright'
import type { Check, Counts, CountSummary, FirstPass, OpInfo, Sample, SetupInfo } from './bench.ts'

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
const kitCommit = sh('git log -1 --format="%h %cs"')

const args = process.argv.slice(2)
const arg = (name: string): string | undefined => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const SESSIONS = Number(arg('sessions') ?? 3)
const ROUNDS = Number(arg('rounds') ?? 20)
const WARMUP = Math.max(1, Number(arg('warmup') ?? 3))
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
await build({ ...common, outfile: join(here, 'dist/bench.js') })
await build({ ...common, outfile: join(here, 'dist/bench-count.js'), plugins: [counting] })

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
await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

type SessionResult = {
  session: number, setup: SetupInfo, first: FirstPass, targetMs: number, reps: Record<string, number>,
  samples: Sample[], check: Check, loadBefore: number[], loadAfter: number[], seconds: number,
}
// quiet: no other Playwright browser process (another agent's sweep, a headless check) was seen at the start of the
// measured run or in any poll during it (every 10 s); a run that saw one is thrown away and the browser run again.
type Quiet = { quiet: boolean, attempts: number, waitedSeconds: number, foreignMax: number, polls: number, loadStart: string, loadEnd: string }
type BrowserResult = { name: string, version: string, ops: OpInfo[], sessions: SessionResult[], counts: Counts, quiet: Quiet }

const BROWSERS: [string, BrowserType][] = [['chromium', chromium], ['webkit', webkit], ['firefox', firefox]]
const results: BrowserResult[] = []
const machineLoad = sh('ps -Ao pcpu,comm -r | head -6 | tail -5')
const ATTEMPTS = 3
const WAIT_POLL_MS = 60_000
const WAIT_MAX_MS = 30 * 60_000
const sysLoad = (): string => sh('sysctl -n vm.loadavg').replace(/[{}]/g, '').trim()

// Playwright browser processes on this machine that this run did not start (not descendants of this process).
// Processes reparented to launchd (ppid 1) are skipped: Chromium's crashpad handlers daemonize and outlive their
// browser, this run's included, while another run's browser shows up through its main process, whose parent is
// the run that launched it.
function foreignBrowsers(): number {
  const parent = new Map<number, number>()
  const args = new Map<number, string>()
  for (const line of sh('ps -Ao pid=,ppid=,args=').split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (m === null) continue
    parent.set(Number(m[1]), Number(m[2]))
    args.set(Number(m[1]), m[3]!)
  }
  const mine = (pid: number): boolean => {
    for (let p: number | undefined = pid, hops = 0; p !== undefined && p > 1 && hops < 64; p = parent.get(p), hops++) if (p === process.pid) return true
    return false
  }
  let n = 0
  // The executable itself must live in Playwright's browser cache: a shell whose command line merely mentions the
  // cache (a `ps | grep ms-playwright`) is no browser.
  for (const [pid, a] of args) if (/^\/\S*\/ms-playwright\//.test(a) && parent.get(pid) !== 1 && !mine(pid)) n++
  return n
}

async function waitForQuiet(name: string): Promise<number> {
  const t0 = Date.now()
  while (foreignBrowsers() > 0 && Date.now() - t0 < WAIT_MAX_MS) {
    console.log(`${name}: ${foreignBrowsers()} other Playwright browser processes running; waiting`)
    await new Promise(done => setTimeout(done, WAIT_POLL_MS))
  }
  return (Date.now() - t0) / 1000
}

async function runSessions(name: string, type: BrowserType, buildDir: string | undefined): Promise<{ version: string, ops: OpInfo[], sessions: SessionResult[] }> {
  let version = ''
  let ops: OpInfo[] = []
  const sessions: SessionResult[] = []
  for (let s = 1; s <= SESSIONS; s++) {
    // A browser launched per session, so each session's first pass meets a browser that has measured no text.
    const browser = await type.launch({ headless: false })
    version = buildDir === undefined ? browser.version() : `${browser.version()} (${buildDir})`
    const page = await (await browser.newContext()).newPage()
    page.on('pageerror', e => console.error(`[${name}] page error: ${e.message}`))
    await page.goto(`${origin}/bench.html`)
    await page.waitForFunction(() => typeof window.benchSetup === 'function')
    await page.bringToFront()
    const loadBefore = loadavg()
    const t0 = performance.now()
    const setup = await page.evaluate(n => window.benchSetup(n), s)
    const first = await page.evaluate(() => window.benchFirstPass())
    ops = await page.evaluate(() => window.benchInit())
    const targetMs = Math.max(25, 100 * setup.timerStep)
    const reps = await page.evaluate(t => window.benchCalibrate(t), targetMs)
    for (let w = 1; w < WARMUP; w++) await page.evaluate(r => window.benchRound(r), -w)
    const samples: Sample[] = []
    for (let r = 0; r < ROUNDS; r++) samples.push(...await page.evaluate(n => window.benchRound(n), r))
    const check = await page.evaluate(() => window.benchCheck())
    const seconds = (performance.now() - t0) / 1000
    const loadAfter = loadavg()
    await browser.close()
    const unfocused = samples.filter(x => !x.focused).length
    console.log(`${name} ${version} session ${s}: ${samples.length} samples in ${seconds.toFixed(0)}s, timer ${setup.timerStep} ms, isolated ${setup.crossOriginIsolated}, ${unfocused} unfocused, load ${loadBefore[0]!.toFixed(2)} → ${loadAfter[0]!.toFixed(2)}`)
    sessions.push({ session: s, setup, first, targetMs, reps, samples, check, loadBefore, loadAfter, seconds })
  }
  return { version, ops, sessions }
}

for (const [name, type] of BROWSERS) {
  if (only !== undefined && !only.includes(name)) continue
  const buildDir = type.executablePath().split('ms-playwright/')[1]?.split('/')[0]
  let run: { version: string, ops: OpInfo[], sessions: SessionResult[] } | undefined
  let quiet: Quiet | undefined
  let waitedSeconds = 0
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    waitedSeconds += await waitForQuiet(name)
    const loadStart = sysLoad()
    let foreignMax = foreignBrowsers()
    let polls = 1
    const timer = setInterval(() => { foreignMax = Math.max(foreignMax, foreignBrowsers()); polls++ }, 10_000)
    try {
      run = await runSessions(name, type, buildDir)
    } finally {
      clearInterval(timer)
    }
    foreignMax = Math.max(foreignMax, foreignBrowsers())
    polls++
    quiet = { quiet: foreignMax === 0, attempts: attempt, waitedSeconds, foreignMax, polls, loadStart, loadEnd: sysLoad() }
    console.log(`${name}: attempt ${attempt} ${quiet.quiet ? 'quiet' : `NOT quiet (up to ${foreignMax} other Playwright browser processes)`}, load ${loadStart} → ${quiet.loadEnd}`)
    if (quiet.quiet) break
  }
  const browser = await type.launch({ headless: false })
  const page = await (await browser.newContext()).newPage()
  page.on('pageerror', e => console.error(`[${name}] page error: ${e.message}`))
  await page.goto(`${origin}/bench.html?count`)
  await page.waitForFunction(() => typeof window.benchCounts === 'function')
  await page.evaluate(() => window.benchSetup(0))
  const counts = await page.evaluate(() => window.benchCounts())
  await browser.close()
  results.push({ name, version: run!.version, ops: run!.ops, sessions: run!.sessions, counts, quiet: quiet! })
}
server.close()

// --- Statistics: µs per unit, from focused samples only. ---
const perUnit = (x: Sample): number => x.ms * 1000 / x.units
function quantile(sorted: number[], q: number): number {
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!
}
type Row = { op: OpInfo, median: number, p95: number, sessionMedians: number[], n: number, excluded: number }
function rows(b: BrowserResult): Row[] {
  return b.ops.map(op => {
    const all = b.sessions.flatMap(s => s.samples.filter(x => x.op === op.id))
    const ok = all.filter(x => x.focused).map(perUnit).sort((a, c) => a - c)
    const sessionMedians = b.sessions.map(s => {
      const v = s.samples.filter(x => x.op === op.id && x.focused).map(perUnit).sort((a, c) => a - c)
      return v.length === 0 ? NaN : quantile(v, 0.5)
    })
    return { op, median: quantile(ok, 0.5), p95: quantile(ok, 0.95), sessionMedians, n: ok.length, excluded: all.length - ok.length }
  })
}
const fmt = (us: number): string => !Number.isFinite(us) ? '–' : us >= 100 ? us.toFixed(0) : us >= 10 ? us.toFixed(1) : us >= 1 ? us.toFixed(2) : us.toFixed(3)
const sum = (c: CountSummary): string => `${c.mean.toFixed(2)} (${c.min}–${c.max})`

const json = { date: new Date().toISOString(), playwrightVersion, pretextVersion, pretextCommit, kitCommit, results }
mkdirSync(join(here, 'results'), { recursive: true })
writeFileSync(join(here, 'results/bench.json'), JSON.stringify(json) + '\n')
console.log('wrote verify/results/bench.json')

const table = new Map(results.map(b => [b.name, rows(b)]))
for (const b of results) {
  console.log(`\n${b.name} ${b.version}`)
  for (const r of table.get(b.name)!) console.log(`  ${r.op.label}: median ${fmt(r.median)} µs, p95 ${fmt(r.p95)} µs per ${r.op.unit}`)
}

if (only === undefined) {
  const os = `macOS ${sh('sw_vers -productVersion')} (${sh('sw_vers -buildVersion')}), Darwin ${release()}`
  const cpu = cpus()
  const md: string[] = [
    '# Cost bench',
    '',
    `Run on ${new Date().toISOString().slice(0, 10)} by \`npm run bench\` (verify/bench-run.ts, verify/bench.ts), kit at ${kitCommit},`,
    `Pretext ${pretextVersion} at ${pretextCommit}, Playwright ${playwrightVersion}.`,
    `Machine: ${cpu[0]?.model ?? 'unknown CPU'}, ${cpu.length} cores, ${(totalmem() / 2 ** 30).toFixed(0)} GB RAM; ${os}.`,
    '',
    `Each browser ran ${SESSIONS} sessions, one after another and never side by side, each in a newly launched headed`,
    `browser in the foreground (Playwright's \`bringToFront\`), serving \`bench.html\` cross-origin isolated from 127.0.0.1.`,
    `A session runs ${WARMUP} discarded warm-up rounds (the first sizes every operation's repetitions) and ${ROUNDS} timed`,
    'rounds; a round runs every operation once, in an order shuffled per round, each sample after a MessageChannel',
    'yield. A sample repeats its operation until it takes the target time (25 ms, or 100 timer steps where the timer is',
    'coarser), so timer coarsening and single GC pauses cannot decide it; the tables give µs per unit (per message,',
    `label, row or call) as the median and p95 over all ${SESSIONS * ROUNDS} samples of the sessions, with each session's`,
    'median beside them, since sessions drift apart (Pretext, RESEARCH.md, Evaluation Traps, Timing). Samples taken',
    'while the page was hidden or unfocused are dropped and counted. These numbers are reported, not targeted.',
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
    '  `fontFromStyle` on a styled element (Helvetica Neue was ' + (results.every(b => b.sessions.every(s => s.setup.helveticaNeue)) ? 'present in every browser' : '**absent** in a browser') + ').',
    '- **Resize**: every helper is timed at 399 px on handles last used at 400 px. None keeps state per width except',
    '  fitFontSize\'s PreparedSizes, so for the others the call at 399 is the resize; fitFontSize and fitFontSizeRich',
    '  get a warm row (a second call, 400 then 399, on the same PreparedSizes) and cold rows (a new PreparedSizes).',
    '- **clamp**: `clamp(prepared, 399, 3, measureTail(\'…\', font))`.',
    '- **truncateMiddle**: 200 distinct path labels recombined from the sweep\'s labels\' directories and file names,',
    '  `keepEnd` from the last `/`, at 399 and at 200 px (where more of them are cut); `prepareLabel` timed apart.',
    `- **fitFontSize**: the messages in a { width: 399, height: 96 } box, sizes 8-48, line height round(1.5 × px).`,
    '- **fitFontSizeRich**: 200 icon-and-label rows (the sweep\'s UI labels and 8-40 unit runs of its Latin, German,',
    '  French and emoji corpora): an icon round(1.25 × px) wide, then the label with extraWidth round(0.5 × px), in a',
    '  { width: 399, height: 72 } box, sizes 8-32.',
    '- **List**: `stack` over 10,000 heights (the messages\' heights at 399, repeated), and `findIndexAt` for 1,000',
    '  random offsets into those 10,000 tops; µs per call.',
    '',
    '**First sight.** The cold prepare row clears Pretext\'s caches (`clearCache()`) before each batch and prepares 1,000',
    'new message strings. The corpora are small, so new strings are not new words: the browser\'s own shaping and',
    'font caches (shared by canvas and the DOM in every engine) have seen these words in earlier batches, and short',
    'messages recur across batches. The row is therefore Pretext\'s full first-sight work over warm browser caches. The',
    '"first pass in a fresh browser" table is the coldest case there is: the first 1,000 messages a newly launched',
    'browser measures, one sample per session, including the first canvas and font load. The "new strings, Pretext',
    'caches warm" row is the steady state of a chat receiving messages: words mostly seen, strings new.',
    '',
    '**DOM baselines**, written as a competent implementation would: `dom.resize` sets the width of a box holding the',
    '1,000 message divs (already laid out at the other width) and then reads every height, so a resize costs one',
    'reflow and no read forces another; `dom.first` creates and appends 1,000 new message divs and reads their heights',
    '(again one reflow). For fitting, the common loop binary-searches each message in one fixed-size box,',
    '`overflow: hidden`, reading `scrollHeight` and `scrollWidth` after each size (a reflow per size tried, as most',
    'code does), and the lockstep variant searches all 1,000 boxes at once, writing every box\'s next size and then',
    'reading them all, a reflow per search step for all boxes. Neither includes paint, which the kit also avoids;',
    'both include the style recalculation a font-size change costs. The kit and the DOM must answer alike for the',
    'comparison to hold; the agreement table says how often they did.',
    '',
  )

  md.push('## Machine state', '')
  md.push(
    'Pretext\'s guidance is a quiet machine, and this one is shared with other agents\' browser runs. Before each',
    'browser\'s measured run the bench waited (polling every 60 s, up to 30 min) until no Playwright browser process it',
    'had not started was running, then polled every 10 s during the run; a run that saw one was thrown away and the',
    `browser run again (up to ${ATTEMPTS} attempts). "Quiet" below means none was seen at the start or in any poll. Other`,
    'load (apps, system daemons) is not controlled: the load averages (`sysctl -n vm.loadavg`, 1, 5 and 15 min) at the',
    'start and end of each measured run, and the busiest processes when the bench started, are recorded so the numbers',
    'can be read as what they are: on a loaded machine, upper bounds.',
    '',
    '| browser | quiet (no other Playwright browser) | attempts | waited before measuring | polls | load at start | load at end |',
    '|---|---|---:|---:|---:|---|---|',
    ...results.map(b => `| ${b.name} | ${b.quiet.quiet ? 'yes' : `**no** (up to ${b.quiet.foreignMax} processes)`} | ${b.quiet.attempts} | ${b.quiet.waitedSeconds.toFixed(0)} s | ${b.quiet.polls} | ${b.quiet.loadStart} | ${b.quiet.loadEnd} |`),
    '',
    'Busiest processes when the bench started (%CPU, command):',
    '',
    '```',
    machineLoad,
    '```',
    '',
  )

  md.push('## Browsers and timers', '')
  md.push('| browser | build | cross-origin isolated | timer step (ms) | target per sample (ms) | 1-min load before → after each session | dropped samples |', '|---|---|---|---:|---:|---|---:|')
  for (const b of results) {
    const steps = [...new Set(b.sessions.map(s => Number(s.setup.timerStep.toPrecision(3))))].join(', ')
    const iso = [...new Set(b.sessions.map(s => s.setup.crossOriginIsolated))].join(', ')
    const target = [...new Set(b.sessions.map(s => s.targetMs))].join(', ')
    const load = b.sessions.map(s => `${s.loadBefore[0]!.toFixed(1)}→${s.loadAfter[0]!.toFixed(1)}`).join(', ')
    const dropped = b.sessions.reduce((n, s) => n + s.samples.filter(x => !x.focused).length, 0)
    md.push(`| ${b.name} | ${b.version} | ${iso} | ${steps} | ${target} | ${load} | ${dropped} |`)
  }
  md.push('', 'The timer step is the smallest nonzero difference between two `performance.now()` readings in 1,000 tries.',
    'Browsers coarsen the timer and add jitter (Firefox and WebKit more than Chromium), so the sample length, not the',
    'step, sets the resolution: a sample is at least 25 ms, or 100 steps.', '')

  for (const b of results) {
    md.push(`## ${b.name} ${b.version}`, '')
    md.push(`| operation | per | median µs | p95 µs | session medians µs | samples |`, '|---|---|---:|---:|---|---:|')
    let group = ''
    for (const r of table.get(b.name)!) {
      if (r.op.group !== group) {
        group = r.op.group
        md.push(`| **${{ prepare: 'a) prepare', layout: 'b) Pretext layout', helpers: 'c) kit helpers', list: 'd) list helpers', dom: 'e) DOM baselines' }[group] ?? group}** | | | | | |`)
      }
      md.push(`| ${r.op.label} | ${r.op.unit} | ${fmt(r.median)} | ${fmt(r.p95)} | ${r.sessionMedians.map(fmt).join(', ')} | ${r.n}${r.excluded > 0 ? ` (${r.excluded} dropped)` : ''} |`)
    }
    md.push('')
  }

  md.push('## First pass in a fresh browser', '', 'The first 1,000 messages each newly launched browser prepares and lays out (at 399), before it has measured any text; one sample per session, µs per message.', '')
  md.push('| browser | prepareWithSegments per session | layout() per session |', '|---|---|---|')
  for (const b of results) {
    md.push(`| ${b.name} | ${b.sessions.map(s => fmt(s.first.prepareMs * 1000 / s.first.n)).join(', ')} | ${b.sessions.map(s => fmt(s.first.layoutMs * 1000 / s.first.n)).join(', ')} |`)
  }
  md.push('')

  md.push('## Structural counts', '', 'Pretext calls per kit call, from the count bundle, in which `@chenglou/pretext` and its rich-inline entry resolve',
    'to counting wrappers (verify/bench-count-pretext.ts, verify/bench-count-rich.ts) for the kit\'s own imports; src/ is',
    'not touched and the counted bundle is never timed. Mean (min–max) over the workload at 399. The spec\'s bound:',
    `balance costs about log2(maxWidth) walks (log2 399 = ${Math.log2(399).toFixed(2)}, plus the target count, the widest piece and the`,
    `check), and fitFontSize about log2(max − min) + 1 probes (${(Math.log2(48 - 8) + 1).toFixed(2)} for 8-48; ${(Math.log2(32 - 8) + 1).toFixed(2)} for the rich rows' 8-32), each a`,
    'walk and, cold, a prepare; the answer is walked once more to report its line count.', '')
  md.push('| browser | balance: measureLineStats walks | shrinkwrap walks | fitFontSize cold: prepares / walks | fitFontSize warm: prepares / walks | fitFontSizeRich cold: prepares / walks | fitFontSizeRich warm: prepares / walks |', '|---|---|---|---|---|---|---|')
  for (const b of results) {
    const c = b.counts
    md.push(`| ${b.name} | ${sum(c.balanceWalks)} | ${sum(c.shrinkwrapWalks)} | ${sum(c.fitColdPrepares)} / ${sum(c.fitColdWalks)} | ${sum(c.fitWarmPrepares)} / ${sum(c.fitWarmWalks)} | ${sum(c.richColdPrepares)} / ${sum(c.richColdWalks)} | ${sum(c.richWarmPrepares)} / ${sum(c.richWarmWalks)} |`)
  }
  md.push('', 'Prepares per call at resize time, where the kit measures a cut text joined to its ellipsis as one prepared text (src/cut.ts):', '')
  md.push('| browser | clamp(…, 399, 3) | truncateMiddle at 399 | truncateMiddle at 200 |', '|---|---|---|---|')
  for (const b of results) {
    const c = b.counts
    md.push(`| ${b.name} | ${sum(c.clampPrepares)} | ${sum(c.middlePrepares399)} | ${sum(c.middlePrepares200)} |`)
  }
  md.push('')

  md.push('## Kit and DOM agreement on this workload', '', 'From each browser\'s first session, at 399. Not a correctness gate (that is `npm run verify`); it says the', 'timed DOM baselines did the same job.', '')
  md.push('| browser | heights equal (kit layout vs DOM) | fitFontSize px equal (kit vs DOM lockstep) | DOM loop equals DOM lockstep | clamp truncated | truncateMiddle cut at 399 / 200 |', '|---|---|---|---|---|---|')
  for (const b of results) {
    const c = b.sessions[0]!.check
    md.push(`| ${b.name} | ${c.heightsAgree}/${c.heightsN} | ${c.fitAgree}/${c.fitN} | ${c.fitLoopAgree}/${c.fitN} | ${c.clampTruncated}/${c.heightsN} | ${c.middleTruncated399}/${c.labelsN} / ${c.middleTruncated200}/${c.labelsN} |`)
  }
  md.push('')

  // The interpretation is computed from this run's medians, so it stays true when the bench is run again.
  md.push('## Reading the numbers', '')
  const med = (b: string, id: string): number => table.get(b)!.find(r => r.op.id === id)!.median
  // Within 5% either way is not called faster or slower: sessions alone drift that far.
  const times = (a: number, b: number): string => Math.abs(a / b - 1) <= 0.05 ? 'about as fast as'
    : a > b ? `${(a / b).toFixed(1)}× slower than` : `${(b / a).toFixed(1)}× faster than`
  for (const b of results) {
    const n = b.name
    const L = med(n, 'layout.399')
    const P = med(n, 'prepare.cold')
    const Pn = med(n, 'prepare.new')
    md.push(`- **${n}.** On a resize Pretext's layout(), which gives a kit-built list its heights, is ${times(L, med(n, 'dom.resize'))} the batched DOM read of the same heights`,
      `  (layout() ${fmt(L)} µs against ${fmt(med(n, 'dom.resize'))} µs per message); shrinkwrap costs ${fmt(med(n, 'shrinkwrap.399'))} µs, balance ${fmt(med(n, 'balance.399'))} µs`,
      `  (${(med(n, 'balance.399') / L).toFixed(0)}× layout()), clamp ${fmt(med(n, 'clamp.399'))} µs. At first sight, Pretext's cold prepare plus layout`,
      `  (${fmt(P + L)} µs per message) is ${times(P + L, med(n, 'dom.first'))} creating, appending and reading the same number of new DOM`,
      `  messages (${fmt(med(n, 'dom.first'))} µs); with Pretext's caches warm, new strings cost ${fmt(Pn + L)} µs. fitFontSize is`,
      `  ${times(med(n, 'fit.warm'), med(n, 'dom.fit.lockstep'))} the lockstep DOM search warm (${fmt(med(n, 'fit.warm'))} against ${fmt(med(n, 'dom.fit.lockstep'))} µs),`,
      `  ${times(med(n, 'fit.cold'), med(n, 'dom.fit.lockstep'))} it with a new PreparedSizes (${fmt(med(n, 'fit.cold'))} µs) and ${times(med(n, 'fit.cleared'), med(n, 'dom.fit.lockstep'))} it`,
      `  with Pretext's caches cleared too (${fmt(med(n, 'fit.cleared'))} µs); the common per-box DOM loop costs ${fmt(med(n, 'dom.fit.loop'))} µs.`)
  }
  md.push('', '**What dominates.**', '')
  const PREPARING = ['prepare.cold', 'prepareLabel', 'fit.cleared', 'fit.cold', 'rich.cleared', 'rich.cold']
  const RESIZING = ['shrinkwrap.399', 'balance.399', 'clamp.399', 'truncateMiddle.399', 'truncateMiddle.200', 'fit.warm', 'rich.warm']
  const SHORT: Record<string, string> = {
    'prepare.cold': 'cold prepareWithSegments', prepareLabel: 'prepareLabel', 'fit.cleared': 'fitFontSize with Pretext\'s caches cleared',
    'fit.cold': 'fitFontSize with a new PreparedSizes', 'rich.cleared': 'fitFontSizeRich with Pretext\'s caches cleared',
    'rich.cold': 'fitFontSizeRich with a new PreparedSizesRich', 'shrinkwrap.399': 'shrinkwrap', 'balance.399': 'balance', 'clamp.399': 'clamp',
    'truncateMiddle.399': 'truncateMiddle at 399', 'truncateMiddle.200': 'truncateMiddle at 200', 'fit.warm': 'warm fitFontSize',
    'rich.warm': 'warm fitFontSizeRich',
  }
  for (const b of results) {
    const n = b.name
    const resize = RESIZING.map(id => ({ id, us: med(n, id) })).sort((x, y) => x.us - y.us)
    const prep = PREPARING.map(id => ({ id, us: med(n, id) })).sort((x, y) => y.us - x.us)
    const firsts = b.sessions.map(s => s.first.prepareMs * 1000 / s.first.n).sort((x, y) => x - y)
    const first = firsts[firsts.length >> 1]!
    const top = prep.slice(0, 3).map(p => `${SHORT[p.id]} ${fmt(p.us)} µs`).join(', ')
    const lead = prep[0]!.us > resize[resize.length - 1]!.us ? `The costliest calls are ones that prepare: ${top}.` : `The calls that prepare cost ${top}.`
    md.push(`- **${n}.** ${lead} A cold prepare is ${(med(n, 'prepare.cold') / med(n, 'layout.399')).toFixed(0)}× a layout() of the same message.`,
      `  At resize time the helpers cost ${fmt(resize[0]!.us)} µs (${SHORT[resize[0]!.id]}) to ${fmt(resize[resize.length - 1]!.us)} µs (${SHORT[resize[resize.length - 1]!.id]}), against`,
      `  layout()'s ${fmt(med(n, 'layout.399'))} µs. A first pass in a fresh browser prepared at ${fmt(first)} µs per message (median of the`,
      `  sessions), ${(first / med(n, 'prepare.cold')).toFixed(1)}× the cleared-cache row, whose batches find most words in the browser's caches.`)
  }
  md.push('',
    'First-sight preparation is the cost the kit inherits from Pretext. A cold fitFontSize prepares the text at each',
    'size its search probes (the structural counts), so it is several first-sight prepares, not one; warm, the same',
    'search is a few walks over cached handles, and the counts show the warm call at 399 prepares almost nothing. balance',
    'is a binary search of walks, so it costs about as many layouts as its count. clamp and truncateMiddle find a cut by',
    'bisection, measuring each candidate joined to the ellipsis as one prepared text (src/cut.ts), so a truncated row',
    'pays several small prepares at resize time (the prepares table); prepareLabel lays the label out at width 0 to find',
    'every cut point and measures the ellipsis, once per label.',
    'The list helpers cost nanoseconds per row.',
    '',
    '**Where the DOM is the better tool.** The DOM numbers here are for an app that would lay these elements out',
    'anyway: a DOM read after a width change measures many boxes in one reflow, and the first-sight comparison charges',
    'the DOM for creating elements an app may already have. Where the DOM row is faster, the kit\'s case is that it',
    'answers without the elements existing (virtualised lists, a worker, before first paint) and without forcing',
    'reflow mid-frame, not raw speed. A DOM measurement also includes text the kit does not model (it is exact only',
    'within what Pretext models; see RESULTS.md).',
    '',
    '**Caveats.** One machine, one OS, one font stack; Windows and Linux text stacks were not timed. Sessions differ',
    '(see the session medians); compare rows within a session or a run, never across machines. On a loaded machine the',
    'numbers are upper bounds. A row whose session medians split far apart (one session several times the others)',
    'shows a speed one compiled copy of the code kept for a whole document, as Pretext\'s RESEARCH.md (Timing, "A copy',
    'keeps a speed for a document") records; its pooled median is then one of two speeds, not a typical one.',
    '')
  writeFileSync(join(here, 'BENCH.md'), md.join('\n'))
  console.log('wrote verify/BENCH.md')
}

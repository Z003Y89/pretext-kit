// node verify/mutants.ts: the mutation table in EVALUATION.md, section 4.
//
// Plants one bug at a time in src/ of a throwaway detached worktree of HEAD (this checkout's src is never
// touched), and runs against each: `npm test`, and the browser sweep reduced to one browser and factor and
// the affected helper (`node verify/run.ts --only=<browser> --factors=<factor> --helpers=<helper>`, which
// writes no RESULTS.md and no baseline). A control run of the unmutated worktree comes first. The worktree is
// removed at the end. A mutant the sweep does not catch makes the exit code 1.
//
//   node verify/mutants.ts [--browser=chromium] [--factor=1]
//
// Takes about 8 minutes for Chromium at factor 1. Run it with no other Playwright browser open.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const browser = args.find(a => a.startsWith('--browser='))?.slice(10) ?? 'chromium'
const factor = args.find(a => a.startsWith('--factor='))?.slice(9) ?? '1'

type Mutant = { name: string, helper: string, file: string, from: string, to: string }
const MUTANTS: Mutant[] = [
  {
    name: 'shrinkwrap +1px', helper: 'shrinkwrap', file: 'src/width.ts',
    from: '  return { width: Math.min(width, maxWidth), lineCount: s.lineCount }',
    to: '  return { width: Math.min(width + 1, maxWidth), lineCount: s.lineCount }',
  },
  {
    name: 'balance returns shrinkwrap', helper: 'balance', file: 'src/width.ts',
    from: 'export function balance(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit {\n  return balanceWith(',
    to: 'export function balance(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit {\n  return shrinkwrapWith(',
  },
  {
    name: 'fitFontSize returns px − 1 (min stays min)', helper: 'fitFontSize', file: 'src/font-size.ts',
    from: '  return { px, prepared: handleAt(sizes, px), lineCount: probe(px) }',
    to: '  const q = px > sizes.min ? px - 1 : px\n  return { px: q, prepared: handleAt(sizes, q), lineCount: probe(q) }',
  },
  {
    name: 'fitFontSizeRich ignores the icon box', helper: 'fitFontSizeRich', file: 'src/font-size.ts',
    from: '    h = prepareRichInline(sizes.items(px), sizes.options)',
    to: '    h = prepareRichInline(sizes.items(px).filter(item => item.text !== undefined), sizes.options)',
  },
  {
    name: 'clamp without the tail', helper: 'clamp', file: 'src/clamp.ts',
    from: '  if (measureText(tail, whole + tail.text) <= width + FIT_TOLERANCE) {',
    to: '  if (measureText(tail, whole) <= width + FIT_TOLERANCE) {',
  },
  {
    name: 'truncateMiddle ignores keepEnd', helper: 'truncateMiddle', file: 'src/middle.ts',
    from: '  if (keepEnd !== undefined) {',
    to: '  if (keepEnd !== undefined && false) {',
  },
  {
    name: 'fontFromStyle drops the weight', helper: 'fontFromStyle', file: 'src/style.ts',
    from: "  font += style.fontWeight + ' '\n",
    to: '',
  },
]

const dir = mkdtempSync(join(tmpdir(), 'pretext-kit-mutants-'))
const tree = join(dir, 'kit')
const git = (...a: string[]): string => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
git('worktree', 'add', '--detach', tree, 'HEAD')
// The worktree shares this checkout's installed packages (Pretext through its file: link).
symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'))
const head = git('rev-parse', '--short', 'HEAD').trim()

type Tally = { cases: number, pass: number, gap: number, platform: number, unreliable: number, mismatch: number }
function sweep(helpers: string[]): Map<string, Tally> {
  const r = spawnSync('node', ['verify/run.ts', `--only=${browser}`, `--factors=${factor}`, `--helpers=${helpers.join(',')}`], { cwd: tree, encoding: 'utf8' })
  const out = new Map<string, Tally>()
  const re = new RegExp(`^${browser}@${factor} (\\w+): (\\d+) cases in [\\d.]+s \\(pass (\\d+), pretext-gap (\\d+), platform (\\d+), unreliable (\\d+), kit-mismatch (\\d+)\\)$`, 'gm')
  for (const m of r.stdout.matchAll(re)) {
    const n = m.slice(2).map(Number)
    out.set(m[1]!, { cases: n[0]!, pass: n[1]!, gap: n[2]!, platform: n[3]!, unreliable: n[4]!, mismatch: n[5]! })
  }
  return out
}
function unitTests(): string {
  const r = spawnSync('npm', ['test'], { cwd: tree, encoding: 'utf8' })
  const fails = [...(r.stdout + r.stderr).matchAll(/^ℹ fail (\d+)$/gm)].reduce((s, m) => s + Number(m[1]), 0)
  return r.status === 0 ? 'passes' : `fails (${fails} failing)`
}

const rows: string[] = []
let escaped = 0
try {
  console.log(`worktree of ${head} at ${tree}; ${browser}@${factor}`)
  const helpers = [...new Set(MUTANTS.map(m => m.helper))]
  const control = sweep(helpers)
  const controlTests = unitTests()
  for (const h of helpers) {
    const t = control.get(h)
    if (t === undefined) throw new Error(`control: no tally for ${h}`)
    console.log(`control ${h}: ${t.cases} cases, ${t.mismatch} kit-mismatch; npm test ${controlTests}`)
    if (t.mismatch !== 0) throw new Error(`control: ${h} has kit-mismatch cases without a mutant`)
  }
  for (const m of MUTANTS) {
    execFileSync('git', ['checkout', '--', 'src'], { cwd: tree })
    const path = join(tree, m.file)
    const source = readFileSync(path, 'utf8')
    const parts = source.split(m.from)
    if (parts.length !== 2) throw new Error(`mutant "${m.name}": expected one occurrence in ${m.file}, found ${parts.length - 1}`)
    writeFileSync(path, parts.join(m.to))
    const t = sweep([m.helper]).get(m.helper)
    if (t === undefined) throw new Error(`mutant "${m.name}": the sweep printed no tally (did it crash?)`)
    const tests = unitTests()
    if (t.mismatch === 0) escaped++
    const row = `| ${m.name} | ${m.helper} | ${t.cases} | ${t.mismatch}${t.mismatch === 0 ? ' (**not caught**)' : ''} | ${t.pass} | ${tests} |`
    rows.push(row)
    console.log(row)
  }
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', tree], { cwd: root })
  rmSync(dir, { recursive: true, force: true })
}

console.log('')
console.log(`Mutants planted in a worktree of ${head}; sweep: ${browser}@${factor}, the affected helper only.`)
console.log('')
console.log('| planted bug | helper swept | cases | kit-mismatch (caught) | pass | npm test |')
console.log('|---|---|---:|---:|---:|---|')
for (const r of rows) console.log(r)
if (escaped > 0) {
  console.log(`\n${escaped} mutant(s) not caught by the sweep`)
  process.exitCode = 1
}

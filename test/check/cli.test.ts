import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { Issue, Report } from '../../src/check/types.ts'
import { formatReport, glob, main } from '../../src/check/cli.ts'
import { importFailure, launch } from '../../src/check/launch.ts'

const dir = fileURLToPath(new URL('./fixtures/', import.meta.url))
const golden = (name: string) => readFileSync(`${dir}${name}`, 'utf8')

async function run(...argv: string[]) {
  const out = { stdout: '', stderr: '' }
  const code = await main(argv, { stdout: (s) => (out.stdout += s), stderr: (s) => (out.stderr += s), cwd: dir })
  return { code, ...out }
}

test('the fixture run prints the golden text and exits 1 on failures', async () => {
  const r = await run('check-labels', '--config', 'labels.config.mjs')
  assert.equal(r.stdout, golden('report.txt'))
  assert.equal(r.stderr, '')
  assert.equal(r.code, 1)
})

test('--json prints the Report', async () => {
  const r = await run('check-labels', '--json')
  assert.equal(r.code, 1)
  assert.equal(r.stdout, golden('report.json'))
  assert.equal(JSON.parse(r.stdout).failures.length, 2)
})

test('warnings alone exit 0, and 1 with --strict', async () => {
  const lenient = await run('check-labels', '--config', 'warnings.config.mjs')
  assert.equal(lenient.code, 0)
  assert.match(lenient.stdout, /0 failures, 2 warnings\n10 keys matched no slot or row\n$/)
  assert.equal((await run('check-labels', '--config', 'warnings.config.mjs', '--strict')).code, 1)
})

test('--platform limits the run and is validated', async () => {
  const one = await run('check-labels', '--platform', 'linux')
  assert.equal(one.code, 1)
  assert.match(one.stdout, /\n10 checked, 2 failures, 2 warnings\n$/)
  const bad = await run('check-labels', '--platform', 'linux,beos')
  assert.equal(bad.code, 2)
  assert.match(bad.stderr, /"beos"/)
})

test('a missing config, an unknown option or a bad config is exit 2 with the message on stderr', async () => {
  for (const argv of [['check-labels', '--config', 'nope.mjs'], ['check-labels', '--bogus'], ['check-labels', '--config'], ['check-labels', '--config', '../cli.test.ts']]) {
    const r = await run(...argv)
    assert.equal(r.code, 2, argv.join(' '))
    assert.equal(r.stdout, '')
    assert.notEqual(r.stderr, '')
    assert.doesNotMatch(r.stderr, /\n\s+at /)
  }
})

test('no command and an unknown command print usage and exit 2', async () => {
  for (const argv of [[], ['lint']]) {
    const r = await run(...argv)
    assert.equal(r.code, 2)
    assert.match(r.stderr, /usage: pretext-kit check-labels/)
  }
})

test('glob supports * and ** relative to the base, sorted, with / separators', () => {
  assert.deepEqual(glob(dir, 'locales/*.json'), ['locales/de.json', 'locales/en.json'])
  assert.deepEqual(glob(dir, './locales/**/*.json'), ['locales/de.json', 'locales/en.json'])
  assert.deepEqual(glob(dir, 'nothing/*.json'), [])
})

test('the bin shim starts with a node shebang', () => {
  const first = readFileSync(new URL('../../bin/pretext-kit.mjs', import.meta.url), 'utf8').split('\n')[0]
  assert.equal(first, '#!/usr/bin/env node')
})

const issue = (kind: Issue['kind'], more: Partial<Issue> = {}): Issue => ({
  kind,
  locale: 'de',
  key: 'a.b',
  slot: 's',
  condition: 'c',
  platforms: ['macos', 'windows', 'linux'],
  text: 'Text',
  measured: { width: 120, box: 100, lines: 1, fontPx: 16 },
  ...more,
})
const report = (failures: Issue[], warnings: Issue[] = [], notes: Issue[] = []): Report => ({ schema: 1, failures, warnings, notes, unchecked: [], checked: 7 })
const ALL = ['macos', 'windows', 'linux']
const lineOf = (i: Issue, platforms = ALL) => formatReport(report([i]), platforms).split('\n')[1]

test('formatReport renders what each kind is missing', () => {
  assert.equal(lineOf(issue('overflow', { missing: { px: 12.5 } })), '  de a.b  "Text"  overflow: 12.5px too wide')
  assert.equal(lineOf(issue('too-many-lines', { measured: { width: 90, box: 100, lines: 3, fontPx: 16 } })), '  de a.b  "Text"  too-many-lines: 3 lines in a box of 100px')
  assert.equal(lineOf(issue('too-many-lines', { measured: { width: 90, box: 100, lines: 3, fontPx: 16 }, missing: { px: 4 } })), '  de a.b  "Text"  too-many-lines: 3 lines in a box of 100px; 4px too wide')
  assert.equal(lineOf(issue('below-min-size', { missing: { fitsAtPx: 11 } })), '  de a.b  "Text"  below-min-size: fits at 11px')
  assert.equal(lineOf(issue('below-min-size', { missing: { fitsAtPx: 11, px: 2.5 } })), '  de a.b  "Text"  below-min-size: fits at 11px; needs 2.5px more')
  assert.equal(lineOf(issue('truncated')), '  de a.b  "Text"  truncated: cut at 100px')
  assert.equal(lineOf(issue('row-overflow')), '  de a.b  "Text"  row-overflow: 120px in 100px')
  assert.equal(lineOf(issue('row-collapsed', { measured: { width: 90, box: 100, lines: 1, fontPx: 16, stage: 2 } })), '  de a.b  "Text"  row-collapsed: stage 2')
  assert.equal(lineOf(issue('uncovered', { detail: 'no glyph for U+2010' })), '  de a.b  "Text"  uncovered: no glyph for U+2010')
  for (const kind of ['missing-sample', 'unsupported-message', 'unverifiable'] as const) assert.equal(lineOf(issue(kind)), `  de a.b  "Text"  ${kind}`)
})

test('formatReport sections, headings and summary', () => {
  const out = formatReport(report([issue('overflow', { missing: { px: 1 } })], [issue('truncated', { slot: 't' })], [issue('row-collapsed', { slot: 'r', measured: { width: 90, box: 100, lines: 1, fontPx: 16, stage: 1 } })]), ALL)
  assert.equal(
    out,
    's \u00b7 c\n  de a.b  "Text"  overflow: 1px too wide\n\nt \u00b7 c\n  de a.b  "Text"  truncated: cut at 100px\n\nr \u00b7 c\n  de a.b  "Text"  row-collapsed: stage 1\n\n7 checked, 1 failures, 1 warnings\n',
  )
  assert.equal(formatReport(report([]), ALL), '7 checked, 0 failures, 0 warnings\n')
})

test('formatReport shows platforms only for a subset of the run or for browser', () => {
  assert.equal(lineOf(issue('truncated', { platforms: ['macos'] })), '  de a.b  "Text"  truncated: cut at 100px  [macos]')
  assert.equal(lineOf(issue('truncated', { platforms: ['macos', 'linux'] })), '  de a.b  "Text"  truncated: cut at 100px  [macos, linux]')
  assert.equal(lineOf(issue('truncated', { platforms: ['linux'] }), ['linux']), '  de a.b  "Text"  truncated: cut at 100px')
  assert.equal(lineOf(issue('truncated', { platforms: ['browser'] }), ['browser']), '  de a.b  "Text"  truncated: cut at 100px  [browser]')
})

test('formatReport keeps quoted text with quotes and newlines on one line', () => {
  const out = formatReport(report([issue('truncated', { text: 'Say "hi"\nnow' })]), ALL)
  assert.equal(out.split('\n')[1], '  de a.b  "Say \\"hi\\"\\nnow"  truncated: cut at 100px')
})

test('--platform linux merges to the run platform and prints no suffix', async () => {
  const r = await run('check-labels', '--platform', 'linux')
  assert.doesNotMatch(r.stdout, /\[/)
  assert.match(r.stdout, /overflow: 67\.515625px too wide\n/)
})

test('config validation gives clear exit-2 messages', async () => {
  for (const [file, message] of [
    ['bad-no-labels.config.mjs', /labels/],
    ['bad-fonts.config.mjs', /fonts/],
    ['bad-no-slots.config.mjs', /slots/],
    ['bad-duplicate.config.mjs', /button/],
    ['bad-locale.config.mjs', /locale/],
  ] as const) {
    const r = await run('check-labels', '--config', `bad/${file}`)
    assert.equal(r.code, 2, file)
    assert.match(r.stderr, message, file)
    assert.doesNotMatch(r.stderr, /Cannot read properties/)
  }
})

test('flags accept = form, need their value, and unknown options print usage', async () => {
  assert.equal((await run('check-labels', '--config=labels.config.mjs', '--platform=linux')).code, 1)
  for (const argv of [['check-labels', '--config'], ['check-labels', '--config', '--json'], ['check-labels', '--platform=']]) {
    const r = await run(...argv)
    assert.equal(r.code, 2, argv.join(' '))
    assert.match(r.stderr, /needs a value|not one of/)
  }
  const unknown = await run('check-labels', '--bogus')
  assert.equal(unknown.code, 2)
  assert.match(unknown.stderr, /unknown option "--bogus"\nusage: /)
})

test('glob skips dot entries and node_modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'glob-'))
  for (const path of ['a.json', '.hidden.json', '.git/x.json', 'node_modules/p/x.json', 'sub/b.json']) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), '{}')
  }
  assert.deepEqual(glob(root, '**/*.json'), ['a.json', 'sub/b.json'])
  assert.deepEqual(glob(root, '*.json'), ['a.json'])
  rmSync(root, { recursive: true })
})

test('labels given as a string is exit 2 with a hint to use { files }', async () => {
  const r = await run('check-labels', '--config', 'bad/bad-labels-string.config.mjs')
  assert.equal(r.code, 2)
  assert.match(r.stderr, /labels must be .*string.*\{ files: /)
  assert.equal(r.stdout, '')
})

test('a run that checked nothing because no key matched is exit 2 naming the count', async () => {
  const r = await run('check-labels', '--config', 'bad/bad-uses-typo.config.mjs')
  assert.equal(r.code, 2)
  assert.match(r.stderr, /nothing was checked: 2 keys matched no slot or row/)
  assert.match(r.stdout, /^0 checked, 0 failures, 0 warnings\n2 keys matched no slot or row\n$/)
})

test('the unmatched-keys line appears only when keys went unmatched', async () => {
  const some = await run('check-labels', '--config', 'bad/some-unchecked.config.mjs')
  assert.equal(some.code, 0)
  assert.equal(some.stdout, '3 checked, 0 failures, 0 warnings\n2 keys matched no slot or row\n')
  assert.doesNotMatch(golden('report.txt'), /matched no slot/)
  assert.equal(formatReport(report([]), ALL), '7 checked, 0 failures, 0 warnings\n')
})

test('--help and -h print usage on stdout and exit 0', async () => {
  for (const argv of [['--help'], ['-h'], ['check-labels', '--help']]) {
    const r = await run(...argv)
    assert.equal(r.code, 0, argv.join(' '))
    assert.match(r.stdout, /^usage: pretext-kit check-labels /)
    assert.equal(r.stderr, '')
  }
})

test('importFailure maps a missing harfbuzzjs to an install hint and keeps other messages', () => {
  const missing = Object.assign(new Error("Cannot find package 'harfbuzzjs' imported from /x/dist/headless/canvas.js"), { code: 'ERR_MODULE_NOT_FOUND' })
  assert.match(importFailure(missing), /^check-labels needs harfbuzzjs \(and wawoff2 for WOFF2 fonts\): npm i -D harfbuzzjs@1\.6\.2$/)
  const other = Object.assign(new Error("Cannot find package 'left-pad' imported from /x"), { code: 'ERR_MODULE_NOT_FOUND' })
  assert.equal(importFailure(other), other.message)
  assert.equal(importFailure(new Error('boom')), 'boom')
})

test('launch exits 2 with the hint when the CLI cannot be loaded, and runs main otherwise', async () => {
  const out = { stdout: '', stderr: '' }
  const io = { stdout: (s: string) => (out.stdout += s), stderr: (s: string) => (out.stderr += s), cwd: dir }
  const missing = Object.assign(new Error("Cannot find package 'harfbuzzjs' imported from /x"), { code: 'ERR_MODULE_NOT_FOUND' })
  assert.equal(await launch([], io, () => Promise.reject(missing)), 2)
  assert.match(out.stderr, /npm i -D harfbuzzjs@1\.6\.2\n$/)
  assert.doesNotMatch(out.stderr, /\n\s+at /)
  assert.equal(await launch(['x'], io, async () => ({ main: async (argv) => argv.length })), 1)
})

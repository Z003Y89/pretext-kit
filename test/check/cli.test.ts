import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { glob, main } from '../../src/check/cli.ts'

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
  assert.deepEqual(JSON.parse(r.stdout).failures.length, 2)
})

test('warnings alone exit 0, and 1 with --strict', async () => {
  const lenient = await run('check-labels', '--config', 'warnings.config.mjs')
  assert.equal(lenient.code, 0)
  assert.match(lenient.stdout, /0 failures, 2 warnings\n$/)
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
  assert.deepEqual(glob(dir, './**/*.json'), ['locales/de.json', 'locales/en.json', 'report.json'])
  assert.deepEqual(glob(dir, 'nothing/*.json'), [])
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkLabels } from '../../src/check/browser.ts'
import { install, registerFont } from '../../src/headless/index.ts'

const root = fileURLToPath(new URL('../../src/', import.meta.url))
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g

function graph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3]!
      if (spec.startsWith('.')) visit(resolve(dirname(file), spec))
      else packages.add(spec)
    }
  }
  visit(entry)
  return { files, packages }
}

test('the browser entry reaches nothing under src/headless or harfbuzzjs', () => {
  const { files, packages } = graph(resolve(root, 'check/browser.ts'))
  assert.ok(files.size > 3, 'the walk found the checker modules')
  for (const file of files) assert.ok(!file.startsWith(resolve(root, 'headless')), `${file} is under src/headless`)
  for (const name of packages) assert.ok(!/harfbuzzjs|wawoff2|headless/.test(name), `imports ${name}`)
  assert.ok(packages.has('@chenglou/pretext'))
})

test('src/index.ts reaches nothing under src/check', () => {
  const { files } = graph(resolve(root, 'index.ts'))
  for (const file of files) assert.ok(!file.startsWith(resolve(root, 'check')), `${file} is under src/check`)
})

test('fonts are refused', async () => {
  await assert.rejects(
    checkLabels({ fonts: [{ family: 'Inter', path: 'x.ttf' }], labels: [], slots: {} }),
    (e: Error) => e instanceof RangeError && /uses the page's fonts/.test(e.message),
  )
})

test('a tabular slot is unverifiable and not counted, others are checked on platform browser', async () => {
  await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
  install()
  const report = await checkLabels({
    labels: [
      { key: 'time', text: '12:30', slot: 'n' },
      { key: 'save', text: 'Save', slot: 'p' },
    ],
    slots: {
      n: { width: 200, font: '16px Inter', numeric: 'tabular', policy: 'as-is' },
      p: { width: 200, font: '16px Inter', policy: 'as-is' },
    },
    platforms: ['macos'],
  })
  assert.deepEqual(report.warnings.map((i) => [i.kind, i.key, i.platforms]), [['unverifiable', 'time', ['browser']]])
  assert.equal(report.checked, 1)
  assert.deepEqual(report.failures, [])
})

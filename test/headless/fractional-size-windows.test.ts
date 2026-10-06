// Fractional font sizes on the 'windows' profile, against Chromium 149.0.7827.55 on Windows: `npm run verify:fractional`
// on a GitHub Actions windows-latest runner (OffscreenCanvas measureText, Inter Regular from test/fonts by @font-face,
// each size in a fresh browser context, so each value is the first use of its size in a document). The fixture is a
// sample of 57 of that run's 488 sizes: integer sizes, the label checker sweep's text-scale sizes, the sizes where the
// stand-in had been off most (10.15, 10.265625, 10.53125px) and least, and every 25th size. Its linux and macos columns
// are the stand-in's own outputs in that run, pinned so the Windows model leaves those profiles alone.
// WINDOWS_FRACTIONAL_JSONL=<path to the run's fractional.jsonl> also checks every recorded size.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { install, registerFont } from '../../src/headless/index.ts'

type Recorded = { size: number; chromium: number[]; linux: number[]; macos: number[] }
type Fixture = { strings: string[]; sizes: Recorded[] }

const fixture = JSON.parse(readFileSync(new URL('./fixtures/windows-fractional.json', import.meta.url), 'utf8')) as Fixture

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))

const width = (size: number, text: string): number => {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = `${size}px Inter`
  return ctx.measureText(text).width
}

const check = (platform: 'windows' | 'linux' | 'macos', column: 'chromium' | 'linux' | 'macos', rows: Recorded[]): void => {
  install({ platform })
  for (const row of rows) {
    fixture.strings.forEach((text, i) => assert.equal(width(row.size, text), row[column][i], `${platform} ${text} at ${row.size}px`))
  }
}

test('the fixture covers integer sizes, the sweep sizes and the sizes the old model missed most', () => {
  const sizes = fixture.sizes.map(row => row.size)
  assert.ok(sizes.length >= 40)
  for (const size of [9, 16, 24, 10.15, 10.265625, 10.53125, 10.05, 18.4, 20.8, 19.435, 13.455, 23.919999999999998, 27.040000000000003]) {
    assert.ok(sizes.includes(size), `${size}px`)
  }
})

test('the windows profile measures fractional sizes as Chromium on Windows does', () => {
  check('windows', 'chromium', fixture.sizes)
})

test('the linux and macos profiles are unchanged', () => {
  check('linux', 'linux', fixture.sizes)
  check('macos', 'macos', fixture.sizes)
})

test('every size the Windows run recorded', { skip: process.env.WINDOWS_FRACTIONAL_JSONL === undefined }, () => {
  const keys = ['s1', 's2', 's3'] as const
  const rows = readFileSync(process.env.WINDOWS_FRACTIONAL_JSONL!, 'utf8').trim().split('\n').map(line => {
    const recorded = JSON.parse(line) as { size: number } & Record<'chromium' | 'linux' | 'macos', Record<(typeof keys)[number], number>>
    return {
      size: recorded.size,
      chromium: keys.map(k => recorded.chromium[k]),
      linux: keys.map(k => recorded.linux[k]),
      macos: keys.map(k => recorded.macos[k]),
    }
  })
  check('windows', 'chromium', rows)
  check('linux', 'linux', rows)
  check('macos', 'macos', rows)
})

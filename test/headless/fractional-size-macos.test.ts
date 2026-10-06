// Fractional font sizes on the 'macos' profile. Chromium 149.0.7827.55 (headed) on a GitHub Actions macos-latest runner
// (CI run https://github.com/Z003Y89/pretext-kit/actions/runs/37505556735, PR #8, `npm run verify:fractional`, process
// platform darwin, Inter Regular from test/fonts, each size in a fresh browser context) measured every one of the 488
// sizes × 3 strings exactly as the 'windows' profile does, so the Windows recording in fixtures/windows-fractional.json
// holds for macOS too (the 50 macOS Chromium values that run's log prints are equal to it). Static Inter only: variable
// fonts at fractional sizes on macOS are unmeasured. Whole sizes are pinned to the profile's values before this model.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { install, registerFont } from '../../src/headless/index.ts'

type Recorded = { size: number; chromium: number[]; linux: number[]; macos: number[] }
type Fixture = { strings: string[]; sizes: Recorded[] }

const fixture = JSON.parse(readFileSync(new URL('./fixtures/windows-fractional.json', import.meta.url), 'utf8')) as Fixture

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
const variable = new URL('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url)
await registerFont('Inter Variable', new Uint8Array(readFileSync(variable)))

const width = (font: string, text: string): number => {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = font
  return ctx.measureText(text).width
}
const widths = (font: string): number[] => fixture.strings.map(text => width(font, text))

test('the macos profile measures fractional sizes as Chromium on macOS does', () => {
  install({ platform: 'macos' })
  for (const row of fixture.sizes) assert.deepEqual(widths(`${row.size}px Inter`), row.chromium, `${row.size}px`)
})

test('macos and windows agree on static Inter at every fixture size', () => {
  for (const row of fixture.sizes) {
    install({ platform: 'macos' })
    const macos = widths(`${row.size}px Inter`)
    install({ platform: 'windows' })
    assert.deepEqual(macos, widths(`${row.size}px Inter`), `${row.size}px`)
  }
})

test('the linux profile is unchanged', () => {
  install({ platform: 'linux' })
  for (const row of fixture.sizes) assert.deepEqual(widths(`${row.size}px Inter`), row.linux, `${row.size}px`)
})

// The 'macos' profile's widths before the fractional-size model.
const WHOLE: [string, number[]][] = [
  ['12px Inter', [48.57421875, 46.236328125, 106.76953125]],
  ['14px Inter', [56.669921875, 53.9423828125, 124.564453125]],
  ['16px Inter', [64.765625, 61.6484375, 142.359375]],
  ['18px Inter', [72.861328125, 69.3544921875, 160.154296875]],
  ['20px Inter', [80.95703125, 77.060546875, 177.94921875]],
  ['24px Inter', [97.1484375, 92.47265625, 213.5390625]],
  // Unrounded HVAR advances.
  ['500 16px "Inter Variable"', [65.20710754394531, 62.740997314453125, 144.1985626220703]],
]

test('whole sizes on the macos profile are unchanged', () => {
  install({ platform: 'macos' })
  for (const [font, expected] of WHOLE) assert.deepEqual(widths(font), expected, font)
})

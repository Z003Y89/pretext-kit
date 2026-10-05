// "Does this label fit the button?" as a unit test, with no browser: the app registers the font
// files its CSS loads, install()s the headless canvas, and uses pretext-kit as usual.
//
// This file uses node:test so it runs in this repo. In vitest (or jest) the same test reads:
//
//   import { describe, expect, it, beforeAll } from 'vitest'
//   beforeAll(async () => { await registerFont('Inter', fontBytes); install() })
//   it('Speichern fits', () => { expect(fits('Speichern').ok).toBe(true) })
//
// install() must run before the first prepare(): Pretext fixes its engine profile on first use.
// So import Pretext/pretext-kit dynamically after install(), or run install() in a setup file
// (vitest `setupFiles`), as done here with top-level await.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { fitFontSize, prepareSizes } from '../src/index.ts'
import { HeadlessCoverageError, install, registerFont } from '../src/headless/index.ts'

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../test/fonts/Inter-Regular.ttf', import.meta.url))))
install()

const BUTTON_CONTENT_WIDTH = 160
const FONT = '600 14px Inter'
const LABELS = [
  'Speichern',
  'Zahlungspflichtig abonnieren',
  'Tagesabschlussbericht',
  'Abbrechen und zurückgehen',
  'Save changes',
  'Continue to checkout',
  'Enregistrer les modifications',
  'Valider la commande',
]
// Labels that genuinely overflow one line at 160px. Asserted, not hidden: if a font or copy
// change moves a label across the line, this test fails and shows which.
const EXPECTED_OVERFLOW = new Set([
  'Zahlungspflichtig abonnieren',
  'Abbrechen und zurückgehen',
  'Enregistrer les modifications',
])

function check(label: string) {
  const stats = measureLineStats(prepareWithSegments(label, FONT), BUTTON_CONTENT_WIDTH)
  const best = fitFontSize(
    prepareSizes(label, (px) => `600 ${px}px Inter`, { min: 8, max: 16 }),
    { width: BUTTON_CONTENT_WIDTH, maxLines: 1 },
    (px) => px * 1.2,
  )
  return { label, width: stats.maxLineWidth, lines: stats.lineCount, fits: stats.lineCount === 1, bestPx: best?.px ?? null }
}

test('labels fit a 160px button in one line at 600 14px Inter, except the documented ones', () => {
  const rows = LABELS.map(check)
  const table = rows.map((r) =>
    `${r.label.padEnd(32)} ${r.width.toFixed(2).padStart(7)}px  ${r.lines} line(s)  ${r.fits ? 'fits    ' : 'OVERFLOWS'}  largest fitting size <=16: ${r.bestPx ?? 'none >= 8'}`)
  console.log(`\nButton content width ${BUTTON_CONTENT_WIDTH}px, ${FONT}\n${table.join('\n')}\n`)

  const overflowing = new Set(rows.filter((r) => !r.fits).map((r) => r.label))
  assert.deepEqual([...overflowing].sort(), [...EXPECTED_OVERFLOW].sort())
  for (const r of rows) {
    // The size search never reports a size larger than 16, and the fitting labels keep at least 14.
    if (r.fits) assert.ok(r.bestPx !== null && r.bestPx >= 14, r.label)
  }
})

test('curly quotes need a font that covers U+300C, or the measurement throws instead of guessing', () => {
  // Pretext probes U+300C (for Han punctuation kerning) whenever a text holds U+2018-U+301F, which
  // includes „ “ ‘ ’ and the ellipsis. Chrome draws that probe with an OS fallback font; Inter has no
  // such glyph, so the headless canvas throws HeadlessCoverageError. Apps register a font that covers
  // it (any CJK face, after Inter in the family list) or use plain quotes in labels under test.
  assert.throws(() => check('„Tagesabschlussbericht“'), (e: unknown) => e instanceof HeadlessCoverageError && /U\+300C/.test(e.message))
})

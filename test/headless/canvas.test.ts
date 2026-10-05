// Runs without test/setup.ts: install() must be the only OffscreenCanvas, and Pretext keeps
// its engine profile and context per process, so this file is a process of its own.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { HeadlessCoverageError, install, registerFont } from '../../src/headless/index.ts'

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
install()

function context(font = '16px Inter'): OffscreenCanvasRenderingContext2D {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = font
  return ctx
}

const width = (text: string, ctx = context()) => ctx.measureText(text).width

test('install sets a desktop Chrome user agent and the stand-in', () => {
  assert.equal(
    navigator.userAgent,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  )
  assert.equal(typeof OffscreenCanvas, 'function')
})

test('16px Inter "Speichern" measures as in Chrome', () => {
  assert.equal(width('Speichern'), 76.921875)
})

test('"AV" is kerned', () => {
  assert.ok(width('AV') < width('A') + width('V'))
})

test('no kerning across a space', () => {
  assert.equal(width('A V'), width('A') + width(' ') + width('V'))
})

test('fontKerning "none" turns kerning off', () => {
  const ctx = context()
  ctx.fontKerning = 'none'
  assert.equal(ctx.fontKerning, 'none')
  assert.equal(width('AV', ctx), width('A') + width('V'))
  ctx.fontKerning = 'auto'
  assert.equal(width('AV', ctx), width('AV'))
})

test('U+2028 is drawn with the space glyph, kerned with its neighbours', () => {
  assert.equal(width(' '), width(' '))
  const ctx = context()
  ctx.fontKerning = 'none'
  const unkerned = width('A ', ctx)
  assert.equal(unkerned, width('A') + width(' '))
})

test('letter spacing is added per grapheme, with ligatures off', () => {
  const ctx = context()
  ctx.letterSpacing = '0.5px'
  assert.equal(width('fi', ctx), width('f') + width('i') + 2 * 0.5)
  // A combining mark is part of its base's grapheme and takes no spacing of its own.
  assert.equal(width('é', ctx), width('é') + 0.5)
})

test('letter spacing round-trips as a string', () => {
  const ctx = context()
  assert.equal(ctx.letterSpacing, '0px')
  ctx.letterSpacing = '0.5px'
  assert.equal(ctx.letterSpacing, '0.5px')
  assert.equal(Number.parseFloat(ctx.letterSpacing), 0.5)
  ctx.letterSpacing = '0.000001px'
  assert.equal(Number.parseFloat(ctx.letterSpacing), 0.000001)
  // Blink adds spacing in 1/65536 px, so this shapes letter-spaced but adds nothing.
  assert.equal(width('Speichern', ctx), 76.921875)
  ctx.letterSpacing = 'wide'
  assert.equal(ctx.letterSpacing, '0.000001px')
})

test('an invalid font is ignored, as Canvas does', () => {
  const ctx = context()
  ctx.font = 'Inter'
  assert.equal(ctx.font, '16px Inter')
  assert.equal(width('Speichern', ctx), 76.921875)
})

test('the size scales the width', () => {
  assert.equal(width('Speichern', context('32px Inter')), 2 * 76.921875)
})

test('the first registered family in the list measures; unregistered names are skipped', () => {
  assert.equal(width('Speichern', context('16px "Not Registered", Inter, sans-serif')), 76.921875)
})

test('ink bounds come from the glyph outlines', () => {
  const metrics = context().measureText('Speichern')
  assert.ok(metrics.actualBoundingBoxRight > 70 && metrics.actualBoundingBoxRight <= 76.921875)
  // S's ink starts right of the origin, which Canvas reports as a negative left.
  assert.ok(metrics.actualBoundingBoxLeft < 0 && metrics.actualBoundingBoxLeft > -2)
  const space = context().measureText(' ')
  assert.deepEqual([space.actualBoundingBoxLeft, space.actualBoundingBoxRight], [0, 0])
})

test('the context takes a lang', () => {
  const ctx = context()
  assert.ok('lang' in ctx)
  ctx.lang = 'de'
  assert.equal(ctx.lang, 'de')
  assert.equal(width('Speichern', ctx), 76.921875)
})

test('default ignorables a font lacks are zero-width, not a coverage error', () => {
  assert.equal(width('a‍b'), width('ab'))
  assert.equal(width('a️'), width('a'))
})

test('a code point no registered font covers throws HeadlessCoverageError', () => {
  assert.throws(() => width('a中'), (error: unknown) => {
    assert.ok(error instanceof HeadlessCoverageError)
    assert.match(error.message, /U\+4E2D/)
    assert.match(error.message, /Inter/)
    return true
  })
  assert.throws(() => width('Speichern', context('16px Missing')), HeadlessCoverageError)
})

test("onMissingGlyph 'notdef' measures the .notdef glyph instead", () => {
  install({ onMissingGlyph: 'notdef' })
  try {
    assert.equal(typeof width('中'), 'number')
    assert.ok(width('中') > 0)
  } finally {
    install()
  }
  assert.throws(() => width('中'), HeadlessCoverageError)
})

test("rounding 'whole-px' rounds each advance before summing", () => {
  const exact = [...'Speichern'].map(ch => width(ch))
  install({ rounding: 'whole-px' })
  try {
    // Inter kerns no pair in the word, so its width is the sum of the rounded advances.
    assert.equal(width('Speichern'), exact.reduce((sum, w) => sum + Math.round(w), 0))
    assert.equal(width('S'), Math.round(exact[0]!))
  } finally {
    install()
  }
  assert.equal(width('Speichern'), 76.921875)
})

test('install() twice is idempotent', () => {
  const before = OffscreenCanvas
  install()
  install()
  assert.equal(OffscreenCanvas, before)
  assert.equal(width('Speichern'), 76.921875)
})

test('install() rejects unknown options', () => {
  assert.throws(() => install({ onMissingGlyph: 'skip' as 'throw' }), RangeError)
  assert.throws(() => install({ rounding: 'half-px' as 'none' }), RangeError)
})

test('Pretext lays out on the stand-in', () => {
  const prepared = prepareWithSegments('Zahlungspflichtig abonnieren', '600 16px Inter')
  assert.equal(measureLineStats(prepared, 160).lineCount, 2)
  assert.equal(measureLineStats(prepared, 260).lineCount, 1)
})

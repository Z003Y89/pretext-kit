// Runs without test/setup.ts: install() must be the only OffscreenCanvas, and Pretext keeps
// its engine profile and context per process, so this file is a process of its own.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { layoutWithLines, measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { HeadlessCoverageError, install, registerFont } from '../../src/headless/index.ts'
import { instanceWeight } from '../../src/headless/canvas.ts'
import type { FontFace } from '../../src/headless/fonts.ts'

const font = (name: string) => new Uint8Array(readFileSync(new URL(`../fonts/${name}`, import.meta.url)))
await registerFont('Inter', font('Inter-Regular.ttf'))
// Roboto (Apache 2.0) kerns T with the space glyph, which Inter does with nothing.
await registerFont('Roboto', font('Roboto-Regular.ttf'))
// Inter subset to U+0020-007E and U+00A0 (pyftsubset, all layout features kept): a font
// without U+2010, for the soft hyphen's '-' path.
await registerFont('NoHyphen', font('Inter-Latin-NoU2010.ttf'))
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

test('Canvas words are cut at U+0020, so kerning with the space glyph is lost', () => {
  const roboto = context('16px Roboto')
  const cut = width('x T x', roboto)
  assert.equal(cut, width('x', roboto) * 2 + width(' ', roboto) * 2 + width('T', roboto))
  // U+2028, which Roboto lacks, draws the space glyph without a cut, so there T kerns with it.
  assert.equal(width('\u2028', roboto), width(' ', roboto))
  assert.ok(width('x\u2028T\u2028x', roboto) < cut)
})

test('ZWSP and TAB cut a word too', () => {
  assert.equal(width('A\u200BV'), width('A') + width('V'))
  assert.equal(width('A\tV'), width('A V'))
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

test('any letter spacing turns contextual alternates off', () => {
  const ctx = context()
  assert.equal(width('->', ctx), 15.265625)
  ctx.letterSpacing = '0.000001px'
  assert.equal(width('->', ctx), 17.9453125)
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

test('generic families measure only Pretext\'s hyphen probes, differently from each other', () => {
  for (const probe of [' ', '\u2010']) {
    assert.notEqual(width(probe, context('16px monospace')), width(probe, context('16px serif')))
  }
  // A registered family that covers the probe measures it for real.
  assert.equal(width(' ', context('16px Inter, monospace')), width(' '))
  // Real text never reaches a generic stand-in.
  assert.throws(() => width('a', context('16px monospace')), HeadlessCoverageError)
  assert.throws(() => width('a中', context('16px Inter, sans-serif')), HeadlessCoverageError)
})

test('a lone U+2010 a font lacks measures as .notdef instead of throwing', () => {
  assert.equal(typeof width('\u2010', context('16px NoHyphen')), 'number')
  assert.throws(() => width('a\u2010', context('16px NoHyphen')), HeadlessCoverageError)
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

test('a variable face is shaped at its registered weight range, then its axis', () => {
  const face = (weightMin: number, weightMax: number, axis: [number, number] | null) =>
    ({ weightMin, weightMax, axes: axis === null ? [] : [{ tag: 'wght', min: axis[0], default: 400, max: axis[1] }] }) as unknown as FontFace
  assert.equal(instanceWeight(face(400, 500, [100, 900]), 700), 500)
  assert.equal(instanceWeight(face(400, 500, [100, 900]), 300), 400)
  assert.equal(instanceWeight(face(100, 900, [300, 700]), 800), 700)
  assert.equal(instanceWeight(face(100, 900, [100, 900]), 650), 650)
  assert.equal(instanceWeight(face(400, 400, null), 700), null)
})

test('a second copy of the module installs without throwing and shares the options', async () => {
  const copy = (await import(new URL('../../src/headless/canvas.ts?copy', import.meta.url).href)) as { install: typeof install }
  const before = OffscreenCanvas
  copy.install({ onMissingGlyph: 'notdef' })
  try {
    assert.equal(OffscreenCanvas, before)
    assert.equal(typeof width('中'), 'number')
  } finally {
    copy.install()
  }
  assert.throws(() => width('中'), HeadlessCoverageError)
})

test('Pretext breaks at a soft hyphen with the font\'s own U+2010', () => {
  const prepared = prepareWithSegments('Zahlungs\u00ADpflichtig abonnieren', '16px Inter')
  // Only "Zahlungs" and a hyphen fit on the first line.
  const lines = layoutWithLines(prepared, 100, 20).lines
  assert.equal(lines[0]!.text, 'Zahlungs-')
  assert.equal(lines[0]!.width, width('Zahlungs\u2010'))
  assert.notEqual(width('Zahlungs\u2010'), width('Zahlungs-'))
  assert.equal(lines.length, 3)
})

test('Pretext breaks at a soft hyphen with "-" in a font without U+2010', () => {
  const prepared = prepareWithSegments('Zahlungs\u00ADpflichtig abonnieren', '16px NoHyphen')
  const lines = layoutWithLines(prepared, 100, 20).lines
  assert.equal(lines[0]!.text, 'Zahlungs-')
  assert.equal(lines[0]!.width, width('Zahlungs-', context('16px NoHyphen')))
  assert.equal(lines.length, 3)
})

test('Pretext lays out on the stand-in', () => {
  const prepared = prepareWithSegments('Zahlungspflichtig abonnieren', '600 16px Inter')
  assert.equal(measureLineStats(prepared, 160).lineCount, 2)
  assert.equal(measureLineStats(prepared, 260).lineCount, 1)
})

test('LRM, RLM, SHY, U+202A-E, U+FEFF and U+FFFC cut a word like ZWSP', () => {
  for (const c of ['‎', '‏', '­', '‪', '‫', '‬', '‭', '‮', '﻿', '￼']) {
    assert.equal(width(`A${c}V`), width('A') + width('V'), `U+${c.codePointAt(0)!.toString(16)}`)
  }
})

// Quotes and the ellipsis make Pretext probe U+300C (Han kerning), which Inter lacks.
const inter16 = '16px Inter'

test('German quotes and the ellipsis prepare in Inter, measured with Inter\'s own glyphs', () => {
  for (const text of ['„Zahlungspflichtig abonnieren“', '„Tagesabschlussbericht“', 'Wird geladen…']) {
    const { maxLineWidth } = measureLineStats(prepareWithSegments(text, inter16), 10_000)
    // The Canvas width of the whole string: Inter's glyphs for the quotes, cut at spaces. No Han trim applies.
    assert.ok(Math.abs(maxLineWidth - width(text, context(inter16))) < 0.02, text)
  }
  assert.ok(width('„', context(inter16)) > 0)
})

test('real CJK text in Inter still throws, also with the probe stand-in present', () => {
  assert.throws(() => prepareWithSegments('中文', inter16), HeadlessCoverageError)
  assert.throws(() => width('「中文」'), HeadlessCoverageError)
})

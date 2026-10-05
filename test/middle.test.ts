import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { prepareLabel, truncateMiddle } from '../src/middle.ts'

const L = prepareLabel('src/text/layout.ts', '20px Test')

test('fits whole: unchanged', () => assert.equal(truncateMiddle(L, 200), 'src/text/layout.ts'))
test('keeps the end from keepEnd.from when it fits', () =>
  assert.equal(truncateMiddle(L, 120, { from: 8 }), 's…/layout.ts'))
test('falls back to half the room when the kept end does not fit', () =>
  assert.equal(truncateMiddle(L, 60, { from: 8 }), 'src…ts'))
test('without keepEnd, the end gets half the room', () =>
  assert.equal(truncateMiddle(L, 60), 'src…ts'))
test('the result never exceeds the width', () => {
  for (let width = 30; width <= 200; width += 10) {
    for (const keepEnd of [undefined, { from: 8 }]) {
      const out = truncateMiddle(L, width, keepEnd)
      const w = measureNaturalWidth(prepareWithSegments(out, '20px Test'))
      assert.ok(w <= width, `${out} is ${w} wide at ${width}`)
    }
  }
})
// Found by the browser sweep: the name was measured grapheme by grapheme from inside the label's
// segment, wider than it paints, so a name that fits with the ellipsis and a grapheme was dropped.
test('the kept end is measured as the text it paints', () =>
  assert.equal(truncateMiddle(prepareLabel('src/text/layout.ts', '20px Kern'), 115, { from: 8 }), 's…/layout.ts'))
// Found by the browser sweep's German corpus: the start was cut at a soft hyphen and kept its hyphen.
test('the start holds no hyphen where it passes a soft hyphen', () =>
  assert.equal(truncateMiddle(prepareLabel('aaaa\u00ADbbbb\u00ADcccc', '20px Test'), 100), 'aaaab…cccc'))
// Found by the browser sweep: the start and end were measured apart, and the joined result,
// which kerns across the ellipsis, came out up to a quarter pixel wider than the width.
test('the result is measured whole, and the start gives up what kerning adds', () =>
  assert.equal(truncateMiddle(prepareLabel('yyyyyyyy zzzzzzzz', '20px Kern'), 100), 'yyyy…zzzz'))
// Review round 1: the test above passes without measuring the name as its own text; this one does
// not, since the kerned name only fits when measured whole.
test('a kerned name that fits only measured whole is kept', () =>
  assert.equal(truncateMiddle(prepareLabel('src/a/tstststs.ts', '20px Kern'), 115, { from: 5 }), 's…/tstststs.ts'))
// Review round 1: the start must be the longest that fits before its end, measured as the one text
// the result paints as. Summed apart, the kerned 'ts' pairs left graphemes of room unused.
test('the start is the longest that fits before the end', () => {
  const label = 'tstststststs/tstsxx/ts.ts'
  const L = prepareLabel(label, '20px Kern')
  const fits = (s: string, w: number) => measureNaturalWidth(prepareWithSegments(s, '20px Kern')) <= w + 1 / 64
  for (let w = 40; w <= 220; w++) for (const keepEnd of [undefined, { from: label.lastIndexOf('/') }]) {
    const out = truncateMiddle(L, w, keepEnd)
    if (out === label) continue
    const [head, end] = out.split('…') as [string, string]
    assert.ok(label.startsWith(head) && label.endsWith(end), `${w}: ${out}`)
    assert.ok(head.length === 1 || fits(out, w), `${w}: ${out} overruns`)
    const next = label.slice(head.length, head.length + 1)
    if (head.length + 1 <= label.length - end.length) assert.ok(!fits(head + next + '…' + end, w), `${w}: ${out} stops short`)
  }
})
// Review round 1: a start holding soft hyphens measured as syllables apart, wider than it paints
// joined (here 'ts' kerns across them), so the start stopped a grapheme short.
test('a start is measured without its soft hyphens', () =>
  assert.equal(truncateMiddle(prepareLabel('at\u00ADsat\u00ADsat\u00ADs zz yy', '20px Kern'), 100), 'atsat…zz yy'))

// Review round 1 of the evaluation: a cut at code points rather than grapheme clusters passed every
// test and the browser sweep. Each label here puts a multi-code-point grapheme where cuts fall: a ZWJ
// family, a flag, a skin-tone sequence, decomposed accents, Hangul jamo.
test('the start and the end are cut only at grapheme boundaries', () => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const labels = [
    'photos/👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦/family-👨‍👩‍👧‍👦.png',
    'trips/🇯🇵🇫🇷🇩🇪🇧🇷🇨🇦/flags-🇯🇵🇫🇷.txt',
    'team/👋🏽👋🏿👍🏻👍🏾/hello-👋🏽.md',
    'docs/résumé-café-née/fiancéé.txt',
    'ko/한글한/한.txt',
  ]
  for (const text of labels) {
    const boundaries = new Set([0, text.length])
    for (const g of segmenter.segment(text)) boundaries.add(g.index)
    const label = prepareLabel(text, '20px Test')
    for (let width = 20; width <= 400; width += 3) {
      for (const keepEnd of [undefined, { from: text.lastIndexOf('/') }]) {
        const out = truncateMiddle(label, width, keepEnd)
        if (out === text) continue
        const cut = out.indexOf('…')
        assert.ok(cut > 0, `${out}: no ellipsis`)
        const head = out.slice(0, cut)
        const tail = out.slice(cut + 1)
        assert.ok(text.startsWith(head) && boundaries.has(head.length), `${JSON.stringify(out)} at ${width}: the start ends inside a grapheme`)
        assert.ok(text.endsWith(tail) && boundaries.has(text.length - tail.length), `${JSON.stringify(out)} at ${width}: the end starts inside a grapheme`)
        const oneGrapheme = [...segmenter.segment(head)].length === 1
        if (!oneGrapheme) {
          const w = measureNaturalWidth(prepareWithSegments(out, '20px Test'))
          assert.ok(w <= width + 1 / 64, `${JSON.stringify(out)} is ${w} wide at ${width}`)
        }
      }
    }
  }
})

// Evaluation review: found by the sweep's Hangul jamo label in WebKit. The end is measured alone, and
// joined to a start already down to one grapheme it overran; it now gives up graphemes instead.
test('an end that overruns once joined to the shortest start is shortened', () => {
  const label = prepareLabel('yaaaaaaaay', '20px Kern')
  for (let width = 25; width <= 60; width++) {
    const out = truncateMiddle(label, width)
    const w = measureNaturalWidth(prepareWithSegments(out, '20px Kern'))
    assert.ok(w <= width, `${out} is ${w} wide at ${width}`)
  }
})

// Final review I-1: Pretext collapses white space, so the cut points index the collapsed text, and
// keepEnd.from indexes label.text, which is that collapsed text.
test('label.text is the collapsed text, and keepEnd.from indexes it', () => {
  const label = prepareLabel('docs/My  Project  Notes/2026  plan.md', '20px Test')
  assert.equal(label.text, 'docs/My Project Notes/2026 plan.md')
  const from = label.text.lastIndexOf('/')
  for (let width = 150; width < 325; width += 5) {
    const out = truncateMiddle(label, width, { from })
    assert.ok(out.endsWith('…/2026 plan.md'), `${width}: ${out}`)
    assert.ok(label.text.startsWith(out.slice(0, out.indexOf('…'))), `${width}: ${out}`)
  }
  assert.equal(truncateMiddle(label, 400, { from }), label.text)
})
test('leading and trailing spaces collapse out of label.text', () => {
  const label = prepareLabel('   src/a/file.ts  ', '20px Test')
  assert.equal(label.text, 'src/a/file.ts')
  assert.equal(truncateMiddle(label, 110, { from: label.text.lastIndexOf('/') }), 'sr…/file.ts')
})
test('a CRLF collapses to one space in label.text', () => {
  const label = prepareLabel('src\r\nlib/name.ts', '20px Test')
  assert.equal(label.text, 'src lib/name.ts')
  assert.equal(truncateMiddle(label, 110, { from: label.text.lastIndexOf('/') }), 'sr…/name.ts')
})

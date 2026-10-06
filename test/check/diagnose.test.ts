// The label checker sweep's console diagnostic (verify/check-diagnose.ts), on hand-built cases: what a CI log shows of
// the check-mismatches and pretext-gaps.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDom, formatExample, formatSide, groupCounts, groupKey, groupTable, mismatchDiagnostic, spreadExamples, truncateText } from '../../verify/check-diagnose.ts'
import type { DiagCase, Grouped } from '../../verify/check-diagnose.ts'

const g = (policy: string, condKind: string, family = 'verdict', platform = 'windows'): Grouped => ({ policy, condKind, platform, family })

test('group keys name policy, condition kind and platform, and the near-miss family when it is that', () => {
  assert.equal(groupKey(g('as-is', 'text scale')), 'as-is · text scale · windows')
  assert.equal(groupKey(g('row', 'zoom', 'near-miss', 'linux')), 'row · zoom · linux · near-miss family')
})

test('group counts: largest first, then by name', () => {
  const cases = [g('lines', 'zoom'), g('as-is', 'zoom'), g('lines', 'zoom'), g('as-is', 'none'), g('as-is', 'zoom')]
  assert.deepEqual(groupCounts(cases), [['as-is · zoom · windows', 2], ['lines · zoom · windows', 2], ['as-is · none · windows', 1]])
})

test('examples are spread across groups: one from each in turn, largest group first, up to the limit', () => {
  const cases = [
    ...Array.from({ length: 50 }, (_, i) => ({ ...g('as-is', 'text scale'), n: `a${i}` })),
    ...Array.from({ length: 3 }, (_, i) => ({ ...g('lines', 'zoom'), n: `b${i}` })),
    { ...g('row', 'none'), n: 'c0' },
  ]
  assert.deepEqual(spreadExamples(cases, 7).map(c => c.n), ['a0', 'b0', 'c0', 'a1', 'b1', 'a2', 'b2'])
  const all = spreadExamples(cases, 60)
  assert.equal(all.length, 54)
  assert.equal(new Set(all.map(c => c.n)).size, 54)
  assert.deepEqual(spreadExamples(cases, 0), [])
  assert.deepEqual(spreadExamples([], 60), [])
})

test('texts are JSON-quoted and cut to 60 characters (code points) with an ellipsis', () => {
  assert.equal(truncateText('Aperçu "x"'), '"Aperçu \\"x\\""')
  assert.equal(truncateText('x'.repeat(60)), JSON.stringify('x'.repeat(60)))
  assert.equal(truncateText('x'.repeat(61)), JSON.stringify(`${'x'.repeat(59)}…`))
  assert.equal(truncateText('😀'.repeat(61)), JSON.stringify(`${'😀'.repeat(59)}…`))
})

test('a side shows its kind and the fields it has, to 4 decimals; the DOM its defined fields', () => {
  assert.equal(formatSide({ kind: 'overflow', width: 74.44253540039062, box: 74.4375, lines: 1, fontPx: 18.4, missing: 0.005 }), 'overflow w=74.4425 box=74.4375 lines=1 font=18.4 missing=0.005')
  assert.equal(formatSide({ kind: 'pass' }), 'pass')
  assert.equal(formatSide({ kind: 'row-collapsed', stage: 2, slack: 0.25, near: 0.25 }), 'row-collapsed slack=0.25 stage=2 near=0.25')
  assert.equal(formatSide(null), '?')
  assert.equal(formatDom({ overflow: true, textWidth: 74.123456, boxWidth: 74.4375, next: null, lines: undefined }), 'overflow=true textWidth=74.1235 boxWidth=74.4375 next=null')
  assert.equal(formatDom(null), '?')
})

const example: DiagCase = {
  id: 't2301.as-is.1.15.1', policy: 'as-is', condKind: 'text scale', platform: 'windows', family: 'verdict', textScale: 1.15, zoom: 1,
  text: 'Aperçu', box: 52.5,
  checker: { kind: 'overflow', width: 52.53125, box: 52.5, lines: 1, fontPx: 14.95, missing: 0.03125 },
  reference: { kind: 'pass', width: 52.49, maxLine: 52.49, box: 52.5, lines: 1, fontPx: 14.95 },
  dom: { overflow: false, textWidth: 52.49, boxWidth: 52.5 },
}

test('an example is one line: id, group, condition, text, box, then the checker, the reference and the DOM', () => {
  assert.equal(
    formatExample(example),
    't2301.as-is.1.15.1 [as-is · text scale · windows] text 115% zoom 100% "Aperçu" box 52.5px' +
      ' | checker overflow w=52.5313 box=52.5 lines=1 font=14.95 missing=0.0313' +
      ' | reference pass w=52.49 maxLine=52.49 box=52.5 lines=1 font=14.95' +
      ' | dom overflow=false textWidth=52.49 boxWidth=52.5',
  )
  assert.ok(!formatExample({ ...example, text: 'a\nb' }).includes('\n'))
})

test('the mismatch block: the group table over every mismatch, then the examples, each indented', () => {
  const all = [g('as-is', 'text scale'), g('as-is', 'text scale'), g('lines', 'zoom', 'near-miss')]
  assert.deepEqual(mismatchDiagnostic([example], all), [
    'check-mismatch by policy · condition kind · platform (3 cases, 2 groups):',
    '  2  as-is · text scale · windows',
    '  1  lines · zoom · windows · near-miss family',
    'check-mismatch examples (1 of 3, spread across groups):',
    `  ${formatExample(example)}`,
  ])
  assert.deepEqual(groupTable('pretext-gap', []), ['pretext-gap (0 cases, 0 groups):'])
  assert.deepEqual(groupTable('x', [...Array(10)].map(() => g('a', 'none')).concat([g('b', 'none')])), ['x (11 cases, 2 groups):', '  10  a · none · windows', '   1  b · none · windows'])
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { clearCache, measureLineStats, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { round64 } from '../../src/check/evaluate.ts'
import { checkLabels } from '../../src/check/index.ts'
import type { CheckInput, Issue, Slot } from '../../src/check/types.ts'
import { clearFonts } from '../../src/headless/fonts.ts'
import { install, registerFont } from '../../src/headless/index.ts'

const data = new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url)))
const inter = { family: 'Inter', data }
const TEXT = 'Speichern unter'
const LONG = 'Alpha beta gamma delta epsilon zeta'

// checkLabels leaves its own fonts registered, so each measurement starts from an empty registry as it does.
async function measure<T>(f: () => T): Promise<T> {
  clearFonts()
  await registerFont('Inter', data)
  install({ platform: 'linux', rounding: 'none' })
  clearCache()
  return f()
}
const natural = (text: string, px = 16) => measure(() => measureNaturalWidth(prepareWithSegments(text, `${px}px Inter`)))
const widest = (text: string, box: number) => measure(() => measureLineStats(prepareWithSegments(text, '16px Inter'), box).maxLineWidth)

const check = (text: string, slot: Omit<Slot, 'font'>, more: Partial<CheckInput> = {}) =>
  checkLabels({ fonts: [inter], labels: [{ key: 'k', text, slot: 's', locale: 'de' }], slots: { s: { font: '16px Inter', ...slot } }, platforms: ['linux'], ...more })

const nearMisses = (issues: Issue[]) => issues.filter((i) => i.kind === 'near-miss')

type Case = { name: string, text: string, slot: (box: number) => Omit<Slot, 'font'>, slack: (box: number) => Promise<number> }
const oneLine = (text: string) => async (box: number) => box - (await natural(text))
const CASES: Case[] = [
  { name: 'as-is', text: TEXT, slot: (width) => ({ width, policy: 'as-is' }), slack: oneLine(TEXT) },
  { name: 'shrinkTo at the slot size', text: TEXT, slot: (width) => ({ width, policy: { shrinkTo: 10 } }), slack: oneLine(TEXT) },
  { name: 'truncate middle', text: TEXT, slot: (width) => ({ width, policy: { truncate: 'middle' } }), slack: oneLine(TEXT) },
  { name: 'truncate end, one line', text: TEXT, slot: (width) => ({ width, policy: { truncate: 'end' } }), slack: oneLine(TEXT) },
  { name: 'lines 2', text: LONG, slot: (width) => ({ width, policy: { lines: 2 } }), slack: async (box) => box - (await widest(LONG, box)) },
  { name: 'truncate end, 2 lines', text: LONG, slot: (width) => ({ width, policy: { truncate: 'end', lines: 2 } }), slack: async (box) => box - (await widest(LONG, box)) },
  { name: 'lines 2, overflowWrap normal', text: LONG, slot: (width) => ({ width, policy: { lines: 2 }, overflowWrap: 'normal' }), slack: async (box) => box - (await widest(LONG, box)) },
]

for (const c of CASES) {
  test(`${c.name}: a pass with less slack than nearMiss is a near-miss warning, as much or more is not`, async () => {
    const box = c.text === LONG ? (await natural(LONG)) * 0.6 : (await natural(TEXT)) + 1.3
    const slack = round64(await c.slack(box))
    assert.ok(slack > 0)
    const plain = await check(c.text, c.slot(box))
    assert.deepEqual([...plain.failures, ...plain.warnings], [])

    const under = await check(c.text, c.slot(box), { nearMiss: slack + 1 / 64 })
    assert.deepEqual(under.failures, [])
    assert.equal(under.warnings.length, 1)
    const [issue] = under.warnings
    assert.equal(issue!.kind, 'near-miss')
    assert.deepEqual(issue!.missing, { px: slack })
    assert.equal(issue!.measured.box, round64(box))
    assert.equal(under.checked, plain.checked)

    for (const nearMiss of [slack, slack - 1 / 64, slack / 2]) {
      const report = await check(c.text, c.slot(box), { nearMiss })
      assert.deepEqual([...report.failures, ...report.warnings, ...report.notes], [], `nearMiss ${nearMiss}`)
    }
  })
}

test('shrinkTo that passes by shrinking: the slack is at the fitted size', async () => {
  const box = (await natural(TEXT)) * 0.8
  const report = await check(TEXT, { width: box, policy: { shrinkTo: 10 } }, { nearMiss: 100 })
  const [issue] = report.warnings
  assert.equal(issue!.kind, 'near-miss')
  assert.ok(issue!.measured.fontPx < 16)
  assert.equal(issue!.missing!.px, round64(box - (await natural(TEXT, issue!.measured.fontPx))))
})

test('a failing verdict never gives a near-miss, whatever the margin', async () => {
  const n = await natural(TEXT)
  for (const policy of ['as-is', { shrinkTo: 16 }, { truncate: 'middle' }, { truncate: 'end' }, { lines: 1 }] as Slot['policy'][]) {
    const report = await check(TEXT, { width: n - 3, policy }, { nearMiss: 1000 })
    assert.equal(nearMisses([...report.failures, ...report.warnings, ...report.notes]).length, 0, JSON.stringify(policy))
    assert.equal(report.failures.length + report.warnings.length, 1, JSON.stringify(policy))
  }
})

test('without nearMiss no near-miss is ever reported, even at no slack', async () => {
  const n = await natural(TEXT)
  for (const width of [n, n - 0.004, n + 0.1]) {
    const report = await check(TEXT, { width, policy: 'as-is' })
    assert.deepEqual([...report.failures, ...report.warnings, ...report.notes], [])
  }
})

// One line holds the text down to Pretext's own layout epsilon (0.005px) below its width; a word under overflowWrap
// 'normal' stays whole down to 1/64 px below it.
test('a pass only within the tolerance is a near-miss with 0px to spare', async () => {
  const n = await natural(TEXT)
  for (const policy of ['as-is', { truncate: 'middle' }, { shrinkTo: 10 }, { lines: 1 }, { truncate: 'end' }] as Slot['policy'][]) {
    const report = await check(TEXT, { width: n - 0.004, policy }, { nearMiss: 0.5 })
    assert.deepEqual(report.failures, [])
    assert.deepEqual(report.warnings.map((i) => [i.kind, i.missing]), [['near-miss', { px: 0 }]], JSON.stringify(policy))
  }
  const word = 'improvements'
  const report = await check(word, { width: (await natural(word)) - 1 / 128, policy: { lines: 1 }, overflowWrap: 'normal' }, { nearMiss: 0.5 })
  assert.deepEqual([...report.failures, ...report.warnings].map((i) => [i.kind, i.missing]), [['near-miss', { px: 0 }]])
})

test('a missing sample and a near-miss are both reported, and the label is checked once', async () => {
  const n = await natural('Hallo {name}')
  const report = await checkLabels({
    fonts: [inter],
    labels: [{ key: 'k', text: 'Hallo {name}', slot: 's', locale: 'de' }],
    slots: { s: { width: n + 0.5, font: '16px Inter', policy: 'as-is' } },
    platforms: ['linux'],
    nearMiss: 1,
  })
  assert.deepEqual(report.warnings.map((i) => i.kind), ['missing-sample', 'near-miss'])
  assert.equal(report.checked, 1)
})

test('a static font gives one near-miss with every platform listed', async () => {
  const n = await natural(TEXT)
  const report = await check(TEXT, { width: n + 0.5, policy: 'as-is' }, { nearMiss: 1, platforms: undefined })
  assert.equal(report.warnings.length, 1)
  assert.deepEqual(report.warnings[0]!.platforms, ['macos', 'windows', 'linux'])
  assert.equal(report.checked, 3)
})

test('rows: a near-miss at stage 0 and at the collapse stage, besides the row-collapsed note', async () => {
  const file = await natural('File')
  const edit = await natural('Edit settings')
  const short = await natural('Edit')
  const full = file + edit + 8
  const base = {
    fonts: [inter],
    labels: { en: { file: 'File', edit: 'Edit settings', 'edit.short': 'Edit' } },
    slots: { bar: { width: 9999, font: '16px Inter', policy: 'as-is' } },
    platforms: ['linux'],
  } satisfies Partial<CheckInput>
  const row = (width: number) => ({
    top: { width, gap: 8, items: [{ key: 'file', slot: 'bar' }, { key: 'edit', slot: 'bar', collapse: { order: 1, iconWidth: 20 }, shortKey: 'edit.short' }] },
  })
  const plain = await checkLabels({ ...base, rows: row(full + 1) })
  const zero = await checkLabels({ ...base, rows: row(full + 1), nearMiss: 2 })
  assert.equal(zero.checked, plain.checked)
  assert.deepEqual(zero.warnings.map((i) => [i.kind, i.key, i.measured.stage, i.missing]), [['near-miss', 'top', 0, { px: round64(1 + full - (file + edit + 8)) }]])
  assert.deepEqual(zero.notes, [])
  assert.deepEqual((await checkLabels({ ...base, rows: row(full + 1), nearMiss: 1 })).warnings, [])

  const collapsedAt = file + short + 8 + 0.75
  const collapsed = await checkLabels({ ...base, rows: row(collapsedAt), nearMiss: 1 })
  assert.deepEqual(collapsed.notes.map((i) => [i.kind, i.measured.stage]), [['row-collapsed', 1]])
  assert.deepEqual(collapsed.warnings.map((i) => [i.kind, i.measured.stage, i.missing]), [['near-miss', 1, { px: 0.75 }]])
  assert.equal(collapsed.checked, plain.checked)
})

test('nearMiss must be a finite number above 0', async () => {
  for (const nearMiss of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '2' as unknown as number, null as unknown as number]) {
    await assert.rejects(check(TEXT, { width: 200, policy: 'as-is' }, { nearMiss }), (e: Error) => e instanceof RangeError && /nearMiss/.test(e.message), String(nearMiss))
  }
})

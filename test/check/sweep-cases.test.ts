// The oracle sweep's inputs and mutation applier (verify/check-labels-cases.ts): the sweep itself is the oracle,
// these pin what it is fed and that every mutant applies to the current source.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  FACTORS, HAND_LABELS, MUTANTS, POLICIES, ROW_FAMILY, STYLES, TEXT_SCALES, applyEdit, applyMutant, conditions, grid64, rowTotal,
  rowWidths, shortLines, slotCases, stageWidths, sweepTexts, vacuousCells,
} from '../../verify/check-labels-cases.ts'
import { CORPORA } from '../../verify/corpora.ts'

test('short lines are runs of whole words of at most 40 characters, soft hyphens not counted, first occurrence kept', () => {
  const corpus = { name: 'x', texts: [{ label: 'a', text: 'aa bb aa bb' }, { label: 'b', text: `${'x'.repeat(39)}­­y zz` }] }
  assert.deepEqual(shortLines(corpus), ['aa', 'aa bb', 'aa bb aa', 'aa bb aa bb', 'bb', 'bb aa', 'bb aa bb', `${'x'.repeat(39)}­­y`, 'zz'])
})

test('the sweep texts: the three corpora then the 60 hand-written labels, ids in order', () => {
  const texts = sweepTexts(CORPORA)
  assert.equal(HAND_LABELS.reduce((n, g) => n + g.items.length, 0), 60)
  assert.ok(texts.length >= 2000 && texts.length <= 2500, `${texts.length} texts`)
  texts.forEach((t, i) => assert.equal(t.id, `t${i}`))
  assert.equal(new Set(texts.map(t => `${t.locale}|${t.text}|${t.style.name}`)).size, texts.length)
  assert.ok(texts.every(t => t.text.replaceAll('­', '').length <= 40))
  assert.deepEqual([...new Set(texts.map(t => t.source))], ['latin', 'german', 'french', 'German compounds', 'French', 'uppercase tabs', 'digits'])
  assert.equal(texts.filter(t => t.style === STYLES.tab).length, 15)
  assert.equal(texts.filter(t => t.style === STYLES.digits).length, 15)
  assert.deepEqual(sweepTexts(CORPORA), texts)
})

test('slot widths: each policy at 0.9/1/1.1 of its own boundary at each text scale, on the 1/64 px grid, with the reserve scaled', () => {
  const texts = [{ id: 't0', source: 's', text: 'a b', locale: 'en' as const, style: STYLES.corpusIcon }]
  const at1 = { natural: 100.3, naturalMin: 75.2, twoLines: 50.1 }
  const at13 = { natural: 130.39, naturalMin: 97.76, twoLines: 65.13 }
  const cases = slotCases(texts, [[at1], [at1], [at13]])
  assert.equal(cases.length, POLICIES.length * FACTORS.length * TEXT_SCALES.length)
  const at = (policy: string, factor: number, scale: number) => cases.find(c => c.policy === policy && c.factor === factor && c.scale === scale)!.width
  assert.equal(at('as-is', 1, 1), grid64(100.3 + 20))
  assert.equal(at('truncate middle', 0.9, 1), grid64(100.3 * 0.9 + 20))
  assert.equal(at('shrinkTo', 1.1, 1), grid64(75.2 * 1.1 + 20))
  assert.equal(at('lines', 1, 1), grid64(50.1 + 20))
  assert.equal(at('truncate end', 0.9, 1), grid64(50.1 * 0.9 + 20))
  assert.equal(at('as-is', 1, 1.3), grid64(130.39 + 20 * 1.3))
  assert.equal(at('lines', 1.1, 1.3), grid64(65.13 * 1.1 + 20 * 1.3))
  assert.equal(new Set(cases.map(c => c.key)).size, cases.length)
  assert.equal(grid64(10), 10)
  assert.equal(grid64(10 + 1 / 128), 10 + 1 / 64)
  assert.throws(() => slotCases(texts, [[at1], [at1]]))
  assert.throws(() => slotCases(texts, [[], [at1], [at13]]))
})

test('the vacuity guard names every policy and condition kind cell whose verdicts are all the same', () => {
  const cell = (policy: string, kind: string, verdict: string) => ({ policy, kind, verdict })
  assert.deepEqual(vacuousCells([
    cell('as-is', 'none', 'pass'), cell('as-is', 'none', 'overflow'),
    cell('as-is', 'zoom', 'overflow'), cell('as-is', 'zoom', 'overflow'),
    cell('lines', 'none', 'pass'),
  ]), ['as-is · zoom', 'lines · none'])
  assert.deepEqual(vacuousCells([]), [])
})

test('conditions: text scales 1/1.15/1.3 by zoom 1/1.3, each with its kind', () => {
  const cs = conditions()
  assert.equal(cs.length, 6)
  assert.deepEqual(cs.map(c => c.kind), ['none', 'text scale', 'text scale', 'zoom', 'text scale + zoom', 'text scale + zoom'])
  assert.equal(cs[4]!.name, 'text 115% · zoom 130%')
})

test('row stages follow collapse order, short label before icon, and widths sit on each boundary', () => {
  const items = ROW_FAMILY.en
  const stages = stageWidths(items, [10, 20, 30, 40, 50], [undefined, undefined, undefined, 25, undefined], 5)
  assert.deepEqual(stages, [
    [10, 20, 30, 40, 50], [10, 20, 30, 40, 5], [10, 20, 30, 25, 5], [10, 20, 30, 5, 5], [10, 5, 30, 5, 5], [10, 5, 5, 5, 5],
  ])
  assert.equal(rowTotal([10, 20], 8), 38)
  assert.deepEqual(rowWidths([100, 80]), [100, 90, 80, 72])
})

test('applyEdit takes exactly one occurrence, or throws', () => {
  const edit = { file: 'f.ts', from: 'a < b', to: 'a <= b' }
  assert.equal(applyEdit('if (a < b) x', edit, 'm'), 'if (a <= b) x')
  assert.throws(() => applyEdit('if (c) x', edit, 'm'), /expected one occurrence in f.ts, found 0/)
  assert.throws(() => applyEdit('a < b; a < b', edit, 'm'), /found 2/)
})

test('applyEdit matches a CRLF source as LF, exactly once, and returns LF', () => {
  const edit = { file: 'f.ts', from: 'const box = a\n', to: 'const box = b\n' }
  assert.equal(applyEdit('x\r\nconst box = a\r\ny\r\n', edit, 'm'), 'x\nconst box = b\ny\n')
  assert.throws(() => applyEdit('x\r\ny\r\n', edit, 'm'), /found 0/)
  assert.throws(() => applyEdit('const box = a\r\nconst box = a\r\n', edit, 'm'), /found 2/)
})

test('every mutant applies to a CRLF checkout of src too', () => {
  const read = (file: string) => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')
  for (const m of MUTANTS) applyMutant(m, read, () => {})
})

test('applyMutant applies edits to one file in order and writes each file once', () => {
  const written: [string, string][] = []
  applyMutant(
    { name: 'm', edits: [{ file: 'f', from: 'x', to: 'y' }, { file: 'f', from: 'y1', to: 'z' }] },
    () => 'x1 x2'.replace('x2', 'w'),
    (file, source) => written.push([file, source]),
  )
  assert.deepEqual(written, [['f', 'z w']])
})

test('every mutant applies to the current src exactly once per edit', () => {
  const read = (file: string) => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8')
  assert.equal(MUTANTS.length, 6)
  for (const m of MUTANTS) {
    let changed = 0
    applyMutant(m, read, (file, source) => {
      assert.notEqual(source, read(file))
      changed++
    })
    assert.ok(changed >= 1, m.name)
  }
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { evaluateRow } from '../../src/check/rows.ts'
import type { Row, Slot } from '../../src/check/types.ts'
import { install, registerFont } from '../../src/headless/index.ts'

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
install()

const natural = (text: string, px = 16) => measureNaturalWidth(prepareWithSegments(text, `${px}px Inter`))
const slots: Record<string, Slot> = {
  bar: { width: 9999, reserve: 10, font: '16px Inter', policy: 'as-is' },
  plain: { width: 9999, font: '16px Inter', policy: 'as-is' },
}
const texts = new Map([
  ['file', 'File'],
  ['edit', 'Edit settings'],
  ['view', 'View options'],
  ['share', 'Share this document'],
  ['help', 'Help and support'],
  ['edit.short', 'Edit'],
  ['view.short', 'View'],
  ['share.short', 'Share'],
])
const GAP = 8
const width = (key: string, reserve = 10) => natural(texts.get(key)!) + reserve
const full = ['file', 'edit', 'view', 'share', 'help'].reduce((sum, k) => sum + width(k), 0) + 4 * GAP
const itemsOf = (): Row['items'] => [
  { key: 'file', slot: 'bar' },
  { key: 'edit', slot: 'bar', collapse: { order: 1, iconWidth: 20 }, shortKey: 'edit.short' },
  { key: 'view', slot: 'bar', collapse: { order: 2, iconWidth: 20 }, shortKey: 'view.short' },
  { key: 'share', slot: 'bar', collapse: { order: 3, iconWidth: 20 }, shortKey: 'share.short' },
  { key: 'help', slot: 'bar' },
]
const rowOf = (w: Row['width'], items = itemsOf()): Row => ({ width: w, gap: GAP, items })
const run = (row: Row, condition = { name: 'c' } as Parameters<typeof evaluateRow>[4], map = texts) =>
  evaluateRow(row, 'bar', map, slots, condition, 'en')
const near = (actual: number, expected: number, eps = 1 / 64) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`)

test('a row that fits is a pass at stage 0', () => {
  const r = run(rowOf(full + 1))
  assert.equal(r.kind, 'pass')
  assert.equal(r.stage, 0)
  near(r.width, full)
  near(r.box, full + 1)
  assert.deepEqual(r.skipped, [])
})

test('narrowed by 30px collapses at the stage whose item frees at least 30px', () => {
  const frees = (k: string) => width(k) - (natural(texts.get(`${k}.short`)!) + 10)
  assert.ok(frees('edit') >= 30)
  const r = run(rowOf(full - 30))
  assert.equal(r.kind, 'row-collapsed')
  assert.equal(r.stage, 1)
  near(r.width, full - frees('edit'))
})

test('shortKey is tried before the icon', () => {
  const edit = width('edit') - (natural('Edit') + 10)
  const r = run(rowOf(full - edit + 0.5))
  assert.equal(r.stage, 1)
  const next = run(rowOf(full - edit - 0.5))
  assert.equal(next.stage, 2)
  const icon = width('edit') - 20
  assert.ok(icon > edit)
  near(next.width, full - width('edit') + 20)
})

test('too narrow even with every icon is row-overflow at the last stage', () => {
  const r = run(rowOf(50))
  assert.equal(r.kind, 'row-overflow')
  assert.equal(r.stage, 6)
  near(r.width, width('file') + width('help') + 3 * 20 + 4 * GAP)
  assert.equal(r.box, 50)
})

test('textScale collapses earlier, zoom does not', () => {
  const box = full + 1
  assert.equal(run(rowOf(box), { name: 'a' }).stage, 0)
  const scaled = run(rowOf(box), { name: 'a', textScale: 1.3 })
  assert.ok(scaled.stage > 0)
  near(scaled.box, box)
  const zoomed = run(rowOf(box), { name: 'a', zoom: 1.3 })
  assert.equal(zoomed.stage, 0)
  near(zoomed.box, box * 1.3)
})

test('zoom scales gaps and icon width, textScale scales icon width but not gaps', () => {
  const only = [{ key: 'file', slot: 'plain', collapse: { order: 1, iconWidth: 20 } }, { key: 'help', slot: 'plain' }]
  const tight = (cond: Parameters<typeof run>[1]) => run(rowOf(5, only), cond)
  near(tight({ name: 'z', zoom: 2 }).width, 40 + natural('Help and support', 32) + GAP * 2)
  near(tight({ name: 't', textScale: 2 }).width, 40 + natural('Help and support', 32) + GAP)
})

test('a width function receives the condition viewport, default 1440', () => {
  const seen: number[] = []
  const w = (v: number) => (seen.push(v), full + 1)
  run(rowOf(w))
  run(rowOf(w), { name: 'v', viewport: 1024 })
  assert.deepEqual(seen, [1440, 1024])
})

test('equal order ties collapse by item index', () => {
  const items = itemsOf()
  items[1]!.collapse!.order = 5
  items[2]!.collapse!.order = 5
  items[3]!.collapse!.order = 5
  const r = run(rowOf(full - 1, items))
  assert.equal(r.stage, 1)
  near(r.width, full - (width('edit') - (natural('Edit') + 10)))
  const swapped = itemsOf()
  swapped[1]!.collapse!.order = 9
  const s = run(rowOf(full - 1, swapped))
  near(s.width, full - (width('view') - (natural('View') + 10)))
})

test('an item whose text is missing is skipped and reported', () => {
  const map = new Map(texts)
  map.delete('help')
  const r = run(rowOf(9999), { name: 'c' }, map)
  assert.deepEqual(r.skipped, ['help'])
  near(r.width, full - width('help') - GAP)
})

test('a missing shortKey text goes straight to the icon step', () => {
  const map = new Map(texts)
  map.delete('edit.short')
  const r = run(rowOf(full - 30), { name: 'c' }, map)
  assert.equal(r.stage, 1)
  near(r.width, full - width('edit') + 20)
})

test('the fit tolerance is 1/64 px', () => {
  assert.equal(run(rowOf(full - 1 / 64 + 1e-6)).stage, 0)
  assert.equal(run(rowOf(full - 1 / 64 - 1e-6)).stage, 1)
})

test('misconfigured rows throw a RangeError naming the row', () => {
  assert.throws(() => run(rowOf(500, [])), /row "bar"/)
  assert.throws(() => run(rowOf(500, [{ key: 'file', slot: 'nope' }])), (e: Error) => e instanceof RangeError && /row "bar".*"nope"/.test(e.message))
  assert.throws(() => run(rowOf(0)), (e: Error) => e instanceof RangeError && /row "bar"/.test(e.message))
  assert.throws(() => run(rowOf(500), { name: 'bad', zoom: 0 }), (e: Error) => e instanceof RangeError && /row "bar".*"bad"/.test(e.message))
  assert.throws(() => run(rowOf(500), { name: 'bad', textScale: -1 }), RangeError)
})

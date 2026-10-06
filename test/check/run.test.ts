import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { clearCache, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import { setLocale } from '@chenglou/pretext'
import { localeSwitches } from '../../src/check/evaluate.ts'
import { checkLabels } from '../../src/check/index.ts'
import { mergeClose, runCheck, tabularFont } from '../../src/check/run.ts'
import type { CheckInput, Issue, Slot } from '../../src/check/types.ts'
import { install, registerFont } from '../../src/headless/index.ts'

const fontFile = (name: string) => new URL(`../fonts/${name}`, import.meta.url)
const inter = { family: 'Inter', data: new Uint8Array(readFileSync(fontFile('Inter-Regular.ttf'))) }
const variablePath = fileURLToPath(new URL('../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url))
const ALL = ['macos', 'windows', 'linux']

const tight = (more: Partial<Slot> = {}): Slot => ({ width: 40, font: '16px Inter', policy: 'as-is', ...more })

test('a static font gives each issue once with every platform listed', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: { de: { save: 'Speichern unter' }, en: { save: 'Save as' } },
    slots: { button: tight({ uses: ['save'] }) },
    conditions: [{ name: 'a' }, { name: 'b', textScale: 1.25 }],
  })
  assert.equal(report.schema, 1)
  assert.equal(report.failures.length, 4)
  for (const issue of report.failures) {
    assert.equal(issue.kind, 'overflow')
    assert.deepEqual(issue.platforms, ALL)
  }
  assert.deepEqual(report.failures.map((i) => `${i.condition}/${i.locale}`), ['a/de', 'a/en', 'b/de', 'b/en'])
  assert.equal(report.checked, 12)
  assert.deepEqual(report.unchecked, [])
})

// A fractional size (16px at 130%) is measured on the linux profile as Chromium on Linux measures it, at its float32
// hundredths with advances at 26.6 (test/headless/fractional-size.test.ts), so a static font's issue there gives
// linux its own measured width.
test('a fractional text scale gives the linux profile its own issue', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: [{ key: 'save', text: 'Speichern unter', slot: 'button' }],
    slots: { button: tight() },
    conditions: [{ name: 'b', textScale: 1.3 }],
  })
  assert.deepEqual(report.failures.map((i) => i.platforms), [['macos', 'windows'], ['linux']])
  assert.ok(report.failures[1]!.measured.width < report.failures[0]!.measured.width)
})

const sample = 'Zahlungspflichtig abonnieren und weiter. '.repeat(3).trim()

test('a variable font at its macOS and Linux boundary gives per-platform issues', async () => {
  await registerFont('Probe', new Uint8Array(readFileSync(variablePath)))
  const width = (platform: 'macos' | 'linux') => {
    install({ platform })
    clearCache()
    return measureNaturalWidth(prepareWithSegments(sample, '500 16px Probe'))
  }
  const mac = width('macos')
  const linux = width('linux')
  assert.ok(Math.abs(mac - linux) > 3 / 64, `macos ${mac} and linux ${linux} are too close to split`)
  const box = (mac + linux) / 2
  const report = await checkLabels({
    fonts: [{ family: 'Inter V', path: variablePath, weight: [100, 900] }],
    labels: [{ key: 'k', text: sample, slot: 's' }],
    slots: { s: { width: box, font: '500 16px Inter V', policy: 'as-is' } },
  })
  assert.equal(report.failures.length, 1)
  const [failure] = report.failures
  assert.equal(failure?.kind, 'overflow')
  assert.deepEqual(failure?.platforms, mac > linux ? ['macos'] : ['windows', 'linux'])
  assert.equal(report.checked, 3)
})

test('switching platform inside one process needs the cache cleared', async () => {
  await registerFont('Probe2', new Uint8Array(readFileSync(variablePath)))
  const at = (platform: 'macos' | 'linux', clear: boolean) => {
    install({ platform })
    if (clear) clearCache()
    return measureNaturalWidth(prepareWithSegments(sample, '500 16px Probe2'))
  }
  clearCache()
  const mac = at('macos', true)
  assert.equal(at('linux', false), mac)
  assert.notEqual(at('linux', true), mac)
})

test('issues are ordered by slot, condition, locale, key and platform', async () => {
  await registerFont('Probe3', new Uint8Array(readFileSync(variablePath)))
  const width = (platform: 'macos' | 'linux') => {
    install({ platform })
    clearCache()
    return measureNaturalWidth(prepareWithSegments(sample, '500 16px Probe3'))
  }
  const mac = width('macos')
  const linux = width('linux')
  assert.ok(Math.abs(mac - linux) > 3 / 64)
  const input: CheckInput = {
    fonts: [inter, { family: 'Inter V', path: variablePath, weight: [100, 900] }],
    labels: { en: { x: 'Save', 'v.k': sample }, de: { x: 'Speichern' } },
    slots: {
      b: tight({ width: 20, uses: ['x'] }),
      v: { width: (mac + linux) / 2, font: '500 16px Inter V', policy: 'as-is', uses: ['v.k'] },
      a: tight({ width: 20, uses: ['x'] }),
    },
    conditions: [{ name: 'c1' }, { name: 'c2', textScale: 1.25 }],
  }
  const report = await checkLabels(input)
  const sequence = report.failures.map((i) => [i.slot, i.condition, i.locale, i.key, i.platforms[0]])
  const split = mac > linux ? 'macos' : 'windows'
  assert.deepEqual(sequence, [
    ['a', 'c1', 'de', 'x', 'macos'],
    ['a', 'c1', 'en', 'x', 'macos'],
    ['a', 'c2', 'de', 'x', 'macos'],
    ['a', 'c2', 'en', 'x', 'macos'],
    ['b', 'c1', 'de', 'x', 'macos'],
    ['b', 'c1', 'en', 'x', 'macos'],
    ['b', 'c2', 'de', 'x', 'macos'],
    ['b', 'c2', 'en', 'x', 'macos'],
    ['v', 'c1', 'en', 'v.k', split],
    ['v', 'c2', 'en', 'v.k', 'macos'],
    ['v', 'c2', 'en', 'v.k', 'windows'],
  ])
  assert.equal(JSON.stringify(await checkLabels(input)), JSON.stringify(report))
})

test('each call starts from a clean font registry', async () => {
  const roboto = new Uint8Array(readFileSync(fontFile('Roboto-Regular.ttf')))
  const text = 'Zahlungspflichtig abonnieren'
  const run = (fonts: CheckInput['fonts']) =>
    checkLabels({ fonts, labels: [{ key: 'k', text, slot: 's' }], slots: { s: { width: 1, font: '400 16px Brand', policy: 'as-is' } }, platforms: ['linux'] })
  const first = await run([{ family: 'Brand', data: roboto }])
  const second = await run([{ family: 'Brand', path: variablePath, weight: [100, 900] }])
  assert.notEqual(first.failures[0]?.measured.width, second.failures[0]?.measured.width)
  const third = await run([{ family: 'Brand', data: roboto }])
  assert.deepEqual(third, first)
  const dropped = await run([{ family: 'Other', data: roboto }])
  assert.equal(dropped.failures[0]?.kind, 'uncovered')
})

test('the caller keeps the install options it had', async () => {
  install({ platform: 'windows', onMissingGlyph: 'notdef' })
  await checkLabels({ fonts: [inter], labels: [], slots: {} })
  const ctx = new OffscreenCanvas(1, 1).getContext('2d') as unknown as { font: string; measureText: (t: string) => { width: number } }
  ctx.font = '16px Inter'
  assert.ok(ctx.measureText('\u4fdd').width > 0)
  install()
})

test('an ICU row item warns for its row and locale and the row is not evaluated', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: { en: { file: 'File', count: '{n, plural, one {# file} other {# files}}' } },
    slots: { bar: { width: 9999, font: '16px Inter', policy: 'as-is' } },
    rows: { top: { width: 1, gap: 0, items: [{ key: 'file', slot: 'bar' }, { key: 'count', slot: 'bar' }] } },
    platforms: ['linux'],
  })
  assert.deepEqual(report.warnings.map((i) => [i.kind, i.slot, i.locale, i.key]), [['unsupported-message', 'top', 'en', 'count']])
  assert.deepEqual(report.failures, [])
  assert.equal(report.checked, 0)
})

test('a row item with an unknown slot throws even when no locale has its text', async () => {
  await assert.rejects(
    checkLabels({ fonts: [inter], labels: {}, slots: {}, rows: { top: { width: 100, gap: 0, items: [{ key: 'k', slot: 'ghost' }] } } }),
    (e: Error) => e instanceof RangeError && /"top"/.test(e.message) && /"ghost"/.test(e.message),
  )
})

test('a tabular slot measures 1111 and 0000 equally and a proportional slot does not', async () => {
  const slots = (numeric: Slot['numeric']): CheckInput['slots'] => ({ n: tight({ width: 1, numeric, uses: ['*'] }) })
  const labels = { und: { ones: '1111', zeros: '0000' } }
  const tab = await checkLabels({ fonts: [inter], labels, slots: slots('tabular'), platforms: ['linux'] })
  assert.equal(tab.failures.length, 2)
  assert.equal(tab.failures[0]?.measured.width, tab.failures[1]?.measured.width)
  const prop = await checkLabels({ fonts: [inter], labels, slots: slots('proportional'), platforms: ['linux'] })
  assert.notEqual(prop.failures[0]?.measured.width, prop.failures[1]?.measured.width)
})

const environment = (tabular: (family: string) => string | null) => ({
  platforms: ['browser' as const],
  select: () => {},
  tabularFamily: tabular,
})

test('checked excludes unverifiable labels', async () => {
  install()
  await registerFont('Plain', inter.data)
  const report = await runCheck(
    {
      fonts: [],
      labels: [
        { key: 'a', text: '12:30', slot: 'n' },
        { key: 'b', text: 'Save', slot: 'p' },
      ],
      slots: { n: tight({ numeric: 'tabular', font: '16px Plain' }), p: tight({ font: '16px Plain', width: 10 }) },
    },
    environment(() => null),
  )
  assert.equal(report.checked, 1)
  assert.deepEqual(report.warnings.map((i) => [i.kind, i.key, i.platforms]), [['unverifiable', 'a', ['browser']]])
  assert.deepEqual(report.failures.map((i) => i.key), ['b'])
})

test('ICU messages warn and are not evaluated; a missing sample warns and is evaluated', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: [
      { key: 'plural', text: '{n, plural, one {# file} other {# files}}', slot: 's' },
      { key: 'hello', text: 'Hello {name}', slot: 's' },
      { key: 'bye', text: 'Bye {name}', slot: 's' },
    ],
    slots: { s: tight({ width: 400 }) },
    samples: { bye: [{ name: 'Ada' }, { name: 'Bartholomew' }] },
    platforms: ['linux'],
  })
  assert.deepEqual(report.warnings.map((i) => [i.kind, i.key]), [['missing-sample', 'hello'], ['unsupported-message', 'plural']])
  assert.equal(report.warnings[1]?.measured.width, 0)
  assert.equal(report.checked, 3)
})

test('a code point the font cannot draw is an uncovered failure, not a throw', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: [{ key: 'jp', text: '保存', slot: 's' }],
    slots: { s: tight({ width: 400 }) },
    platforms: ['linux'],
  })
  assert.equal(report.failures.length, 1)
  assert.equal(report.failures[0]?.kind, 'uncovered')
  assert.match(report.failures[0]?.detail ?? '', /U\+/)
})

test('rows report collapse notes and overflow, and missing labels become unchecked', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: { en: { file: 'File', edit: 'Edit settings', 'edit.short': 'Edit', orphan: 'x' }, de: { file: 'Datei' } },
    slots: { bar: { width: 9999, font: '16px Inter', policy: 'as-is' } },
    rows: {
      top: {
        width: 80,
        gap: 8,
        items: [
          { key: 'file', slot: 'bar' },
          { key: 'edit', slot: 'bar', collapse: { order: 1, iconWidth: 20 }, shortKey: 'edit.short' },
        ],
      },
    },
    platforms: ['linux'],
  })
  assert.deepEqual(report.notes.map((i) => [i.kind, i.slot, i.locale, i.measured.stage]), [['row-collapsed', 'top', 'en', 1]])
  assert.deepEqual(report.unchecked, ['de:edit', 'en:orphan'])
  const narrow = await checkLabels({
    fonts: [inter],
    labels: { en: { file: 'File', edit: 'Edit settings' } },
    slots: { bar: { width: 9999, font: '16px Inter', policy: 'as-is' } },
    rows: { top: { width: 20, gap: 8, items: [{ key: 'file', slot: 'bar' }, { key: 'edit', slot: 'bar' }] } },
    platforms: ['linux'],
  })
  assert.equal(narrow.failures[0]?.kind, 'row-overflow')
  assert.ok((narrow.failures[0]?.missing?.px ?? 0) > 0)
})

test('misconfiguration throws a RangeError naming the slot', async () => {
  const base = { fonts: [inter], labels: [{ key: 'k', text: 'x', slot: 's' }], platforms: ['linux' as const] }
  await assert.rejects(checkLabels({ ...base, slots: { s: tight() }, conditions: [{ name: 'c', slots: { nope: { width: 5 } } }] }), (e: Error) => e instanceof RangeError && /"nope"/.test(e.message))
  await assert.rejects(checkLabels({ ...base, slots: { s: tight({ width: 0 }) } }), (e: Error) => e instanceof RangeError && /"s"/.test(e.message))
})

test('tabularFont rewrites quoted, unquoted and listed families and leaves generics', () => {
  const alias = (family: string) => (family === 'Inter' || family === 'My Font' ? `${family} __tnum` : null)
  assert.equal(tabularFont('600 15px Inter', alias), '600 15px "Inter __tnum"')
  assert.equal(tabularFont('600 15px/20px "My Font", Inter, sans-serif', alias), '600 15px/20px "My Font __tnum", "Inter __tnum", sans-serif')
  assert.equal(tabularFont("italic 12.5px 'My Font'", alias), 'italic 12.5px "My Font __tnum"')
  assert.equal(tabularFont('16px Other, Inter', alias), '16px Other, "Inter __tnum"')
  assert.equal(tabularFont('16px Other', alias), null)
  assert.equal(tabularFont('16px Inter', () => null), null)
})

test('label order does not change the report and interleaved locales do not switch per label', async () => {
  const locales = ['de', 'en', 'fr']
  const keys = ['a', 'b', 'c', 'd']
  const labels = keys.flatMap((key) => locales.map((locale) => ({ key, text: `${locale} ${key} Speichern unter`, slot: 'button', locale })))
  const input = (list: typeof labels): CheckInput => ({ fonts: [inter], labels: list, slots: { button: tight() }, conditions: [{ name: 'a' }, { name: 'b' }] })
  const before = localeSwitches()
  const interleaved = await checkLabels(input(labels))
  const switches = localeSwitches() - before
  const grouped = await checkLabels(input([...labels].sort((x, y) => (x.locale < y.locale ? -1 : 1))))
  assert.deepEqual(interleaved, grouped)
  assert.equal(interleaved.checked, labels.length * 2 * 3)
  assert.ok(switches <= 2 * 3 * locales.length, `${switches} locale switches`)
})

test('a locale the caller set between runs does not leave the cache stale', async () => {
  const input: CheckInput = { fonts: [inter], labels: [{ key: 'a', text: 'Save as', slot: 'button', locale: 'en' }], slots: { button: tight() } }
  await checkLabels(input)
  setLocale('tr')
  const before = localeSwitches()
  await checkLabels(input)
  assert.ok(localeSwitches() > before)
})

test('samples that fill to the same text are checked and reported once', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: [{ key: 'files', text: '{n} files in the folder', slot: 'button', locale: 'en' }],
    slots: { button: tight() },
    samples: { files: [{ n: 5 }, { n: '5' }, { n: 7 }] },
  })
  assert.equal(report.checked, 6)
  for (const issue of report.failures) {
    assert.equal(new Set(issue.platforms).size, issue.platforms.length)
  }
  assert.deepEqual(report.failures.map((i) => i.platforms), [ALL, ALL])
})

test('row samples that differ only in an unshown way are not planned twice', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: { en: { 'row.a': 'Save {n}', 'row.b': 'Share' } },
    slots: { tool: tight({ width: 200 }) },
    rows: { bar: { width: 30, gap: 4, items: [{ key: 'row.a', slot: 'tool' }, { key: 'row.b', slot: 'tool' }] } },
    samples: { 'row.a': [{ n: 1 }, { n: '1' }] },
  })
  assert.equal(report.checked, 3)
  assert.deepEqual(report.failures.map((i) => i.platforms), [ALL])
})

test('condition names must be unique', async () => {
  await assert.rejects(
    checkLabels({ fonts: [inter], labels: [{ key: 'a', text: 'Hi', slot: 'button' }], slots: { button: tight() }, conditions: [{ name: 'x' }, { name: 'y' }, { name: 'x', zoom: 2 }] }),
    (error: Error) => error instanceof RangeError && /condition "x".*(twice|more than once|unique)/.test(error.message),
  )
})

test('a font with featureSettings normal or single-quoted tags still gets tabular digits', async () => {
  const slots: CheckInput['slots'] = { n: tight({ width: 1, numeric: 'tabular', uses: ['*'] }) }
  const labels = { und: { ones: '1111', zeros: '0000' } }
  for (const featureSettings of ['normal', "'liga' 1", '"liga" 1']) {
    const report = await checkLabels({ fonts: [{ ...inter, featureSettings }], labels, slots, platforms: ['linux'] })
    assert.equal(report.failures.length, 2, featureSettings)
    assert.equal(report.failures[0]?.measured.width, report.failures[1]?.measured.width, featureSettings)
  }
})

const pair = (a: number, b: number, kind = 'overflow'): Issue[] => [
  { kind, locale: 'en', key: 'k', slot: 's', condition: 'c', platforms: ['macos'], text: 't', measured: { width: a, box: 40, lines: 1, fontPx: 16 }, missing: { px: a - 40 } } as Issue,
  { kind, locale: 'en', key: 'k', slot: 's', condition: 'c', platforms: ['linux'], text: 't', measured: { width: b, box: 40, lines: 1, fontPx: 16 }, missing: { px: b - 40 } } as Issue,
]

test('platforms 1/64 px apart merge into one issue with the worse numbers', () => {
  const merged = mergeClose(pair(50, 50 + 1 / 64))
  assert.equal(merged.length, 1)
  assert.deepEqual(merged[0]!.platforms, ['macos', 'linux'])
  assert.equal(merged[0]!.measured.width, 50 + 1 / 64)
  assert.equal(merged[0]!.missing?.px, 10 + 1 / 64)
})

test('platforms 2/64 px apart stay separate', () => {
  assert.equal(mergeClose(pair(50, 50 + 2 / 64)).length, 2)
})

test('different kinds stay separate', () => {
  const [a] = pair(50, 50)
  const [, b] = pair(50, 50, 'row-overflow')
  assert.equal(mergeClose([a!, b!]).length, 2)
})

const U = 1 / 64
const at = (platform: Issue['platforms'][number], offset: number, extra: Partial<Issue> = {}): Issue => ({
  kind: 'overflow', locale: 'en', key: 'k', slot: 's', condition: 'c', platforms: [platform], text: 't',
  measured: { width: 50 + offset * U, box: 40, lines: 1, fontPx: 16 }, missing: { px: 10 + offset * U }, ...extra,
})
const permutations = <T>(items: T[]): T[][] =>
  items.length < 2 ? [items] : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]))
const stable = (issues: Issue[]): string[] => [...new Set(permutations(issues).map((p) => JSON.stringify(mergeClose(p))))]

test('a tie keeps the first platform whatever the input order', () => {
  const mac = at('macos', 0, { missing: { px: 10, fitsAtPx: 12 } })
  const linux = at('linux', 0, { missing: { px: 10, fitsAtPx: 12 + U } })
  for (const input of [[mac, linux], [linux, mac]]) {
    const merged = mergeClose(input)
    assert.equal(merged.length, 1)
    assert.equal(merged[0]!.missing?.fitsAtPx, 12)
    assert.deepEqual(merged[0]!.platforms, ['macos', 'linux'])
  }
})

test('merging does not depend on input order', () => {
  const same = stable([at('macos', 0), at('windows', 1), at('linux', 1)])
  assert.equal(same.length, 1)
  const [one] = JSON.parse(same[0]!) as Issue[]
  assert.deepEqual(one!.platforms, ['macos', 'windows', 'linux'])
  assert.equal(one!.measured.width, 50 + U)

  const chain = stable([at('macos', 0), at('windows', 1), at('linux', 2), at('browser', 3)])
  assert.equal(chain.length, 1)
  assert.deepEqual((JSON.parse(chain[0]!) as Issue[]).map((i) => i.platforms), [['macos', 'windows'], ['linux', 'browser']])

  const gap = stable([at('macos', 0), at('linux', 0, { missing: undefined })])
  assert.equal(gap.length, 1)
  assert.equal(JSON.parse(gap[0]!).length, 2)
})

test('platform order does not change a merged report', async () => {
  await registerFont('Probe4', new Uint8Array(readFileSync(variablePath)))
  const widthOf = (platform: 'macos' | 'linux') => {
    install({ platform })
    clearCache()
    return Math.round(measureNaturalWidth(prepareWithSegments('Settings', '500 16px Probe4')) * 64)
  }
  assert.equal(Math.abs(widthOf('macos') - widthOf('linux')), 1, 'the probe label must sit exactly 1/64 px apart')
  const run = (platforms: ('macos' | 'linux')[]) =>
    checkLabels({
      fonts: [{ family: 'Inter V', path: variablePath, weight: [100, 900] }],
      labels: [{ key: 'k', text: 'Settings', slot: 's' }],
      slots: { s: { width: 20, font: '500 16px Inter V', policy: 'as-is' } },
      platforms,
    })
  const forward = await run(['macos', 'linux'])
  assert.equal(JSON.stringify(forward), JSON.stringify(await run(['linux', 'macos'])))
  assert.equal(forward.failures.length, 1)
  assert.deepEqual(forward.failures[0]!.platforms, ['macos', 'linux'])
})

// The repro from review: 20.8px is 16px at 130%, measured on the linux profile as Chromium on Linux does; the word's
// natural width is within 1/64 px past the box, where Chromium shows it whole on one line.
test('linux, 20.8px: a word within the tolerance past the box passes lines 1 under overflowWrap normal', async () => {
  const report = await checkLabels({
    fonts: [inter],
    labels: [{ key: 'k', text: 'improvements', slot: 's', locale: 'en' }],
    slots: { s: { width: 139.140625, font: '20.8px Inter', policy: { lines: 1 }, overflowWrap: 'normal' } },
    platforms: ['linux'],
  })
  assert.deepEqual(report.failures, [])
  assert.equal(report.checked, 1)
})

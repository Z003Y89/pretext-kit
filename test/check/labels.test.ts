import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fillSamples, normalizeLabels, transformText } from '../../src/check/labels.ts'
import type { Label, Slot } from '../../src/check/types.ts'

const slot = (uses: string[]): Slot => ({ width: 100, font: '15px Inter', policy: 'as-is', uses })

test('nested i18n maps flatten to dotted keys', () => {
  const toolbar = slot(['toolbar.*'])
  const r = normalizeLabels({ de: { toolbar: { save: 'Speichern' } } }, { toolbar })
  assert.deepEqual(r.labels, [{ key: 'toolbar.save', text: 'Speichern', locale: 'de', slot: 'toolbar' }])
  assert.deepEqual(r.unchecked, [])
})

test('a key in two slots gives two labels', () => {
  const r = normalizeLabels({ de: { toolbar: { save: 'Speichern' } } }, { a: slot(['toolbar.*']), b: slot(['*.save']) })
  assert.deepEqual(r.labels.map((l) => [l.key, l.slot]), [['toolbar.save', 'a'], ['toolbar.save', 'b']])
})

test('star matches dots and the pattern is anchored', () => {
  const r = normalizeLabels({ en: { 'a.b.c': 'x', 'xa.b': 'y' } }, { s: slot(['a.*']) })
  assert.deepEqual(r.labels.map((l) => l.key), ['a.b.c'])
  assert.deepEqual(r.unchecked, ['en:xa.b'])
})

test('regex characters in a pattern are literal', () => {
  const r = normalizeLabels({ en: { 'a+b': 'x', aab: 'y' } }, { s: slot(['a+b']) })
  assert.deepEqual(r.labels.map((l) => l.key), ['a+b'])
})

test('unmatched keys are unchecked, sorted and de-duplicated', () => {
  const r = normalizeLabels({ en: { menu: { open: 'Open' }, zed: 'z' }, de: { menu: { open: 'Öffnen' } } }, { s: slot(['toolbar.*']) })
  assert.deepEqual(r.labels, [])
  assert.deepEqual(r.unchecked, ['de:menu.open', 'en:menu.open', 'en:zed'])
  const dup = normalizeLabels({ en: { 'a.b': 'x', a: { b: 'y' } } }, { s: slot(['toolbar.*']) })
  assert.deepEqual(dup.unchecked, ['en:a.b'])
})

test('label arrays pass through', () => {
  const labels: Label[] = [{ key: 'k', text: 'T', slot: 's' }]
  assert.deepEqual(normalizeLabels(labels, { s: slot([]) }).labels, labels)
})

test('a label with an unknown slot throws RangeError naming it', () => {
  assert.throws(
    () => normalizeLabels([{ key: 'k', text: 'T', slot: 'nope' }], { s: slot([]) }),
    (e) => e instanceof RangeError && e.message.includes('nope'),
  )
})

test('every sample yields one text', () => {
  const label: Label = { key: 'cart.items', text: '{count} Artikel', slot: 's' }
  const r = fillSamples(label, { 'cart.items': [{ count: 9999 }, { count: 1 }] })
  assert.deepEqual(r, [{ text: '9999 Artikel', issues: [] }, { text: '1 Artikel', issues: [] }])
})

test('a placeholder with no sample stays and is reported', () => {
  const label: Label = { key: 'cart.items', text: '{count} Artikel', slot: 's' }
  assert.deepEqual(fillSamples(label, undefined), [{ text: '{count} Artikel', issues: ['missing-sample'] }])
  assert.deepEqual(fillSamples(label, { 'cart.items': [{ other: 1 }] }), [{ text: '{count} Artikel', issues: ['missing-sample'] }])
})

test('text without placeholders needs no samples', () => {
  assert.deepEqual(fillSamples({ key: 'k', text: 'Speichern', slot: 's' }, undefined), [{ text: 'Speichern', issues: [] }])
})

test('ICU messages yield no text', () => {
  for (const text of [
    '{n, plural, one {#} other {#}}',
    '{g, select, male {Er} other {Sie}}',
    '{n, selectordinal, one {#st} other {#th}}',
    '{n, number}',
    '{d, date, short}',
    'Preis: {p, number, currency}',
  ]) {
    assert.deepEqual(fillSamples({ key: 'k', text, slot: 's' }, { k: [{ n: 1, g: 'x', d: 1, p: 2 }] }), [{ text: '', issues: ['unsupported-message'] }], text)
  }
})

test('transformText: identity cases', () => {
  assert.equal(transformText('Save', undefined, 'en'), 'Save')
  assert.equal(transformText('Save', 'none', 'en'), 'Save')
})

test('uppercase uses the locale', () => {
  assert.equal(transformText('Straße', 'uppercase', 'de'), 'STRASSE')
  assert.equal(transformText('iptal', 'uppercase', 'tr'), 'İPTAL')
  assert.equal(transformText('IPTAL', 'lowercase', 'tr'), 'ıptal')
  assert.equal(transformText('Straße', 'uppercase', 'und'), 'STRASSE')
})

test('capitalize upper-cases the first letter of each word', () => {
  assert.equal(transformText('save all changes', 'capitalize', 'en'), 'Save All Changes')
  assert.equal(transformText('iptal et', 'capitalize', 'tr'), 'İptal Et')
})

test('repeated placeholders are all replaced', () => {
  const label: Label = { key: 'k', text: '{a} {a} {b}', slot: 's' }
  assert.deepEqual(fillSamples(label, { k: [{ a: 1, b: 2 }] }), [{ text: '1 1 2', issues: [] }])
  assert.deepEqual(fillSamples(label, { k: [{ a: 1 }] }), [{ text: '1 1 {b}', issues: ['missing-sample'] }])
})

test('inherited property names are not sample lists', () => {
  for (const key of ['constructor', 'hasOwnProperty', 'valueOf']) {
    assert.deepEqual(fillSamples({ key, text: '{n} x', slot: 's' }, {}), [{ text: '{n} x', issues: ['missing-sample'] }], key)
  }
})

test('locale tags that are not BCP 47 never throw', () => {
  assert.equal(transformText('iptal', 'uppercase', 'tr_TR'), 'İPTAL')
  assert.equal(transformText('Straße', 'uppercase', 'en_US'), transformText('Straße', 'uppercase', 'en-US'))
  for (const locale of ['', 'xx!!', 'pt_BR']) {
    for (const t of ['uppercase', 'lowercase', 'capitalize'] as const) {
      assert.doesNotThrow(() => transformText('save all', t, locale), `${locale} ${t}`)
    }
  }
  assert.equal(transformText('save all', 'capitalize', 'en_US'), 'Save All')
})

test('{{name}} is one placeholder, replaced whole', () => {
  assert.deepEqual(fillSamples({ key: 'k', text: '{{count}} files', slot: 's' }, { k: [{ count: 5 }] }), [{ text: '5 files', issues: [] }])
  assert.deepEqual(fillSamples({ key: 'k', text: '{{ count }} of {total}', slot: 's' }, { k: [{ count: 1, total: 2 }] }), [{ text: '1 of 2', issues: [] }])
  assert.deepEqual(fillSamples({ key: 'k', text: '{{count}} files', slot: 's' }, undefined), [{ text: '{{count}} files', issues: ['missing-sample'] }])
})

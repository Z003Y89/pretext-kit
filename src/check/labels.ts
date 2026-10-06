import type { CheckInput, Issue, Label, LabelSource, Slot } from './types.ts'

type Texts = { text: string; issues: Issue['kind'][] }[]

function flatten(value: unknown, prefix: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([prefix, value])
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix === '' ? k : `${prefix}.${k}`, out)
  }
}

function pattern(glob: string): RegExp {
  const body = glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${body}$`, 's')
}

export function normalizeLabels(
  source: Exclude<LabelSource, () => unknown>,
  slots: Record<string, Slot>,
): { labels: Label[]; unchecked: string[] } {
  if (Array.isArray(source)) {
    for (const label of source) {
      if (!Object.hasOwn(slots, label.slot)) throw new RangeError(`label ${label.key}: slot "${label.slot}" is not defined`)
    }
    return { labels: source, unchecked: [] }
  }
  const matchers = Object.entries(slots).map(([name, slot]) => ({ name, patterns: (slot.uses ?? []).map(pattern) }))
  const labels: Label[] = []
  const unchecked = new Set<string>()
  for (const [locale, messages] of Object.entries(source)) {
    const flat: [string, string][] = []
    flatten(messages, '', flat)
    for (const [key, text] of flat) {
      const hits = matchers.filter((m) => m.patterns.some((p) => p.test(key)))
      for (const hit of hits) labels.push({ key, text, locale, slot: hit.name })
      if (hits.length === 0) unchecked.add(`${locale}:${key}`)
    }
  }
  return { labels, unchecked: [...unchecked].sort() }
}

// Every text by locale and key, whether or not a slot uses it (rows look their items up by key).
export function localeTexts(source: Exclude<LabelSource, () => unknown>): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>()
  const into = (locale: string): Map<string, string> => {
    let found = out.get(locale)
    if (found === undefined) out.set(locale, (found = new Map()))
    return found
  }
  if (Array.isArray(source)) {
    for (const label of source) into(label.locale ?? 'und').set(label.key, label.text)
    return out
  }
  for (const [locale, messages] of Object.entries(source)) {
    const flat: [string, string][] = []
    flatten(messages, '', flat)
    const map = into(locale)
    for (const [key, text] of flat) map.set(key, text)
  }
  return out
}

// Any brace group with a comma is an ICU argument ({n, plural, …}, {n, number}, {d, date, short}).
const ICU = /\{[^{}]*,/
// {name} and the i18next style {{name}}.
const PLACEHOLDER = /\{\{\s*([^{},\s]+)\s*\}\}|\{\s*([^{},\s]+)\s*\}/g

export function fillSamples(label: Label, samples: CheckInput['samples']): Texts {
  if (ICU.test(label.text)) return [{ text: '', issues: ['unsupported-message'] }]
  const names = [...label.text.matchAll(PLACEHOLDER)].map((m) => m[1] ?? m[2])
  if (names.length === 0) return [{ text: label.text, issues: [] }]
  const tries = samples !== undefined && Object.hasOwn(samples, label.key) ? samples[label.key] : undefined
  const sets = tries === undefined || tries.length === 0 ? [{}] : tries
  return sets.map((values: Record<string, string | number>) => {
    let missing = false
    const text = label.text.replace(PLACEHOLDER, (whole, double: string | undefined, single: string | undefined) => {
      const name = double ?? single!
      if (!Object.hasOwn(values, name)) {
        missing = true
        return whole
      }
      return String(values[name])
    })
    return { text, issues: missing ? ['missing-sample'] : [] }
  })
}

export function localeTag(locale: string): string | undefined {
  if (locale === 'und') return undefined
  try {
    return Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0]
  } catch {
    return undefined
  }
}

export function transformText(text: string, transform: Slot['textTransform'], locale: string): string {
  const tag = localeTag(locale)
  if (transform === 'uppercase') return text.toLocaleUpperCase(tag)
  if (transform === 'lowercase') return text.toLocaleLowerCase(tag)
  if (transform !== 'capitalize') return text
  const words = new Intl.Segmenter(tag, { granularity: 'word' })
  const graphemes = new Intl.Segmenter(tag, { granularity: 'grapheme' })
  let out = ''
  for (const { segment, isWordLike } of words.segment(text)) {
    if (!isWordLike) {
      out += segment
      continue
    }
    const first = graphemes.segment(segment)[Symbol.iterator]().next().value
    const head = first === undefined ? '' : first.segment
    out += head.toLocaleUpperCase(tag) + segment.slice(head.length)
  }
  return out
}

import { DEFAULT_CONDITION, resolveSlot } from './conditions.ts'
import type { ResolvedSlot } from './conditions.ts'
import { evaluateLabel, forgetLocale, round64 } from './evaluate.ts'
import { fillSamples, localeTexts, normalizeLabels } from './labels.ts'
import { evaluateRow } from './rows.ts'
import type { CheckInput, CheckPlatform, Condition, Issue, Report, Slot } from './types.ts'

export type CheckEnv = {
  platforms: CheckPlatform[]
  select: (platform: CheckPlatform) => void
  tabularFamily: (family: string) => string | null
}

const PLATFORM_ORDER: CheckPlatform[] = ['macos', 'windows', 'linux', 'browser']
const FAILURES = new Set<Issue['kind']>(['overflow', 'too-many-lines', 'below-min-size', 'row-overflow', 'uncovered'])
const NOTES = new Set<Issue['kind']>(['row-collapsed'])
const GENERIC = /^(?:serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-[a-z-]+)$/i
const SIZE = /(\d*\.?\d+)px(?:\s*\/\s*[^\s,]+)?/

function splitFont(font: string): { head: string; families: string[] } {
  const found = SIZE.exec(font)
  if (found === null) return { head: font, families: [] }
  const end = found.index + found[0].length
  const families: string[] = []
  let current = ''
  let quote = ''
  for (const ch of font.slice(end)) {
    if (quote !== '') {
      if (ch === quote) quote = ''
      else current += ch
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === ',') {
      families.push(current)
      current = ''
    } else current += ch
  }
  families.push(current)
  return { head: font.slice(0, end), families: families.map((f) => f.trim().replace(/\s+/g, ' ')).filter((f) => f !== '') }
}

export function fontFamilies(font: string): string[] {
  return splitFont(font).families.filter((family) => !GENERIC.test(family))
}

// Each family the environment has a tabular twin for is replaced by it, quoted, the others stay as
// they are; null when none has one, which is a font that cannot be checked with tabular digits.
export function tabularFont(font: string, tabularFamily: (family: string) => string | null): string | null {
  const { head, families } = splitFont(font)
  let any = false
  const out = families.map((family) => {
    const alias = GENERIC.test(family) ? null : tabularFamily(family)
    if (alias === null) return /[\s,]/.test(family) ? `"${family}"` : family
    any = true
    return `"${alias}"`
  })
  return any ? `${head} ${out.join(', ')}` : null
}

type Prepared = { resolved: Map<string, ResolvedSlot>; effective: Record<string, Slot>; unverifiable: Set<string>; bare: Condition }

function prepare(slots: Record<string, Slot>, condition: Condition, env: CheckEnv): Prepared {
  for (const name of Object.keys(condition.slots ?? {})) {
    if (!Object.hasOwn(slots, name)) throw new RangeError(`condition "${condition.name}": override for unknown slot "${name}"`)
  }
  const bare: Condition = { ...condition, slots: undefined }
  const resolved = new Map<string, ResolvedSlot>()
  const effective: Record<string, Slot> = {}
  const unverifiable = new Set<string>()
  for (const [name, slot] of Object.entries(slots)) {
    const override = condition.slots?.[name]
    const merged: Slot = { ...slot, ...override }
    if (merged.numeric === 'tabular') {
      const font = tabularFont(merged.font, env.tabularFamily)
      if (font === null) unverifiable.add(name)
      else merged.font = font
    }
    effective[name] = merged
    resolved.set(name, resolveSlot(name, merged, bare))
  }
  return { resolved, effective, unverifiable, bare }
}

type Fields = Pick<Issue, 'kind' | 'locale' | 'key' | 'slot' | 'condition' | 'text' | 'measured' | 'missing' | 'detail'>

export async function runCheck(input: CheckInput, env: CheckEnv): Promise<Report> {
  forgetLocale()
  try {
    return await run(input, env)
  } finally {
    forgetLocale()
  }
}

const sortByLocale = <T extends { locale: string }>(list: T[]): T[] => list.sort((a, b) => (a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0))

function distinct<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    const id = key(item)
    return seen.has(id) ? false : (seen.add(id), true)
  })
}

async function run(input: CheckInput, env: CheckEnv): Promise<Report> {
  const slots = typeof input.slots === 'function' ? await input.slots() : input.slots
  const source = typeof input.labels === 'function' ? await input.labels() : input.labels
  const conditions = input.conditions ?? [DEFAULT_CONDITION]
  const names = new Set<string>()
  for (const { name } of conditions) {
    if (names.has(name)) throw new RangeError(`condition "${name}" is named twice; condition names must be unique`)
    names.add(name)
  }
  const platforms = input.platforms ?? env.platforms
  const rows = input.rows ?? {}
  const { labels, unchecked: unusedKeys } = normalizeLabels(source, slots)
  // Switching Pretext's locale clears its caches, so each pass runs one locale at a time; the report is sorted afterwards.
  const planned = sortByLocale(
    labels.map((label) => ({
      label,
      locale: label.locale ?? 'und',
      variants: distinct(fillSamples(label, input.samples), (v) => JSON.stringify([v.text, v.issues])),
    })),
  )

  const byLocale = localeTexts(source)
  const rowKeys = new Set<string>()
  const unchecked = new Set<string>()
  const rowPlans: { name: string; locale: string; texts: Map<string, string>; shown: string; blocked?: string }[] = []
  for (const [name, row] of Object.entries(rows)) {
    for (const item of row.items) {
      if (!Object.hasOwn(slots, item.slot)) throw new RangeError(`row "${name}": item "${item.key}" uses unknown slot "${item.slot}"`)
      rowKeys.add(item.key)
      if (item.shortKey !== undefined) rowKeys.add(item.shortKey)
    }
    for (const [locale, messages] of byLocale) {
      const tries = new Map<string, string[]>()
      let blocked: string | undefined
      for (const key of rowKeys) {
        const text = messages.get(key)
        if (text === undefined || !row.items.some((i) => i.key === key || i.shortKey === key)) continue
        const variants = fillSamples({ key, text, slot: '', locale }, input.samples)
        if (variants.some((v) => v.issues.includes('unsupported-message'))) {
          blocked ??= key
          continue
        }
        tries.set(key, variants.map((v) => v.text))
      }
      if (blocked !== undefined) {
        rowPlans.push({ name, locale, texts: new Map(), shown: messages.get(blocked)!, blocked })
        continue
      }
      if (!row.items.some((i) => tries.has(i.key))) continue
      const count = Math.max(...[...tries.values()].map((t) => t.length))
      for (let n = 0; n < count; n++) {
        const texts = new Map([...tries].map(([key, t]) => [key, t[Math.min(n, t.length - 1)]!]))
        const shown = row.items.map((i) => texts.get(i.key)).filter((t) => t !== undefined).join(' | ')
        if (!rowPlans.some((p) => p.name === name && p.locale === locale && p.blocked === undefined && [...texts].every(([key, text]) => p.texts.get(key) === text))) {
          rowPlans.push({ name, locale, texts, shown })
        }
      }
    }
  }
  sortByLocale(rowPlans)

  const found = new Map<string, Issue>()
  let checked = 0
  const add = (fields: Fields, platform: CheckPlatform): void => {
    const rounded: Fields = {
      ...fields,
      ...(fields.missing === undefined
        ? {}
        : { missing: { ...(fields.missing.px === undefined ? {} : { px: round64(fields.missing.px) }), ...(fields.missing.fitsAtPx === undefined ? {} : { fitsAtPx: round64(fields.missing.fitsAtPx) }) } }),
    }
    const id = JSON.stringify(rounded)
    const existing = found.get(id)
    if (existing === undefined) found.set(id, { ...rounded, platforms: [platform] })
    else if (!existing.platforms.includes(platform)) existing.platforms.push(platform)
  }

  for (const condition of conditions) {
    const prep = prepare(slots, condition, env)
    for (const platform of platforms) {
      env.select(platform)
      for (const { label, locale, variants } of planned) {
        const slot = prep.resolved.get(label.slot)!
        const base = { locale, key: label.key, slot: label.slot, condition: condition.name }
        const zero = { width: 0, box: round64(slot.box), lines: 0, fontPx: round64(slot.sizePx) }
        if (prep.unverifiable.has(label.slot)) {
          add({ ...base, kind: 'unverifiable', text: label.text, measured: zero }, platform)
          continue
        }
        for (const variant of variants) {
          if (variant.issues.includes('unsupported-message')) {
            add({ ...base, kind: 'unsupported-message', text: label.text, measured: zero }, platform)
            continue
          }
          const verdict = evaluateLabel(variant.text, slot, locale)
          checked++
          if (variant.issues.includes('missing-sample')) add({ ...base, kind: 'missing-sample', text: variant.text, measured: verdict.measured }, platform)
          if (verdict.kind === 'pass') continue
          add(
            {
              ...base,
              kind: verdict.kind,
              text: variant.text,
              measured: verdict.measured,
              ...(verdict.missing === undefined ? {} : { missing: verdict.missing }),
              ...(verdict.detail === undefined ? {} : { detail: verdict.detail }),
            },
            platform,
          )
        }
      }
      for (const plan of rowPlans) {
        const row = rows[plan.name]!
        const base = { locale: plan.locale, key: plan.name, slot: plan.name, condition: condition.name, text: plan.shown }
        if (plan.blocked !== undefined) {
          add({ ...base, key: plan.blocked, kind: 'unsupported-message', measured: { width: 0, box: 0, lines: 0, fontPx: 0 } }, platform)
          continue
        }
        if (row.items.some((i) => prep.unverifiable.has(i.slot))) {
          add({ ...base, kind: 'unverifiable', measured: { width: 0, box: 0, lines: 0, fontPx: 0 } }, platform)
          continue
        }
        const result = evaluateRow(row, plan.name, plan.texts, prep.effective, prep.bare, plan.locale)
        for (const key of result.skipped) unchecked.add(`${plan.locale}:${key}`)
        checked++
        if (result.kind === 'pass') continue
        const first = prep.resolved.get(row.items[0]!.slot)
        add(
          {
            ...base,
            kind: result.kind,
            measured: { width: result.width, box: result.box, lines: 1, fontPx: round64(first?.sizePx ?? 0), stage: result.stage },
            ...(result.kind === 'row-overflow' ? { missing: { px: result.width - result.box } } : {}),
            ...(result.detail === undefined ? {} : { detail: result.detail }),
          },
          platform,
        )
      }
    }
  }

  for (const key of unusedKeys) if (!rowKeys.has(key.slice(key.indexOf(':') + 1))) unchecked.add(key)
  const rank = (issue: Issue): number => PLATFORM_ORDER.indexOf(issue.platforms[0]!)
  const before = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
  const issues = [...found.values()]
  for (const issue of issues) issue.platforms.sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b))
  issues.sort(
    (a, b) =>
      before(a.slot, b.slot) || before(a.condition, b.condition) || before(a.locale, b.locale) || before(a.key, b.key) ||
      rank(a) - rank(b) || before(a.kind, b.kind) || before(a.text, b.text),
  )
  return {
    schema: 1,
    failures: issues.filter((i) => FAILURES.has(i.kind)),
    warnings: issues.filter((i) => !FAILURES.has(i.kind) && !NOTES.has(i.kind)),
    notes: issues.filter((i) => NOTES.has(i.kind)),
    unchecked: [...unchecked].sort(before),
    checked,
  }
}

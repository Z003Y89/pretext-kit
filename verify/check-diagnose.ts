// The label checker sweep's console diagnostic (verify/check-labels.ts): counts of check-mismatch and pretext-gap cases
// by policy, condition kind and platform, and one line per example check-mismatch. The CI log is all a CI run leaves
// readable, so what the run judged goes there too. Pure and import-free.

// A verdict as one side saw it: the checker (an issue's measured, or evaluateLabel's when it passes) or the reference.
export type DiagSide = {
  kind: string
  width?: number
  maxLine?: number
  box?: number
  lines?: number
  fontPx?: number
  missing?: number
  fitsAtPx?: number
  slack?: number
  stage?: number
  near?: number
}

export type DiagCase = {
  id: string
  policy: string
  condKind: string
  platform: string
  family: string
  textScale: number
  zoom: number
  text: string
  box: number
  checker: DiagSide | null
  reference: DiagSide
  dom: Record<string, number | boolean | null | undefined> | null
}

export type Grouped = { policy: string, condKind: string, platform: string, family: string }

export const groupKey = (c: Grouped): string => `${c.policy} · ${c.condKind} · ${c.platform}${c.family === 'verdict' ? '' : ` · ${c.family} family`}`

// Group names and their counts, largest first, then by name.
export function groupCounts(cases: Grouped[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const c of cases) counts.set(groupKey(c), (counts.get(groupKey(c)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
}

// Up to `limit` cases spread across the groups: one from each group in turn (largest group first), then the next
// from each, until the limit or the cases run out.
export function spreadExamples<T extends Grouped>(cases: T[], limit: number): T[] {
  const groups = new Map<string, T[]>()
  for (const c of cases) {
    const list = groups.get(groupKey(c))
    if (list === undefined) groups.set(groupKey(c), [c])
    else list.push(c)
  }
  const order = groupCounts(cases).map(([k]) => groups.get(k)!)
  const out: T[] = []
  for (let i = 0; out.length < limit; i++) {
    const before = out.length
    for (const list of order) {
      if (out.length >= limit) break
      if (i < list.length) out.push(list[i]!)
    }
    if (out.length === before) break
  }
  return out
}

const num = (n: number): string => `${+n.toFixed(4)}`

export function truncateText(text: string, max = 60): string {
  const chars = [...text]
  return JSON.stringify(chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text)
}

const FIELDS: [keyof DiagSide, string][] = [
  ['width', 'w'], ['maxLine', 'maxLine'], ['box', 'box'], ['lines', 'lines'], ['fontPx', 'font'], ['missing', 'missing'],
  ['fitsAtPx', 'fitsAt'], ['slack', 'slack'], ['stage', 'stage'], ['near', 'near'],
]
export function formatSide(s: DiagSide | null): string {
  if (s === null) return '?'
  const parts = [s.kind]
  for (const [field, name] of FIELDS) {
    const v = s[field]
    if (typeof v === 'number') parts.push(`${name}=${num(v)}`)
  }
  return parts.join(' ')
}

export function formatDom(dom: DiagCase['dom']): string {
  if (dom === null) return '?'
  const parts: string[] = []
  for (const [k, v] of Object.entries(dom)) {
    if (v === undefined) continue
    parts.push(`${k}=${typeof v === 'number' ? num(v) : String(v)}`)
  }
  return parts.join(' ')
}

export function formatExample(c: DiagCase): string {
  return `${c.id} [${groupKey(c)}] text ${Math.round(c.textScale * 100)}% zoom ${Math.round(c.zoom * 100)}% ${truncateText(c.text)} ` +
    `box ${num(c.box)}px | checker ${formatSide(c.checker)} | reference ${formatSide(c.reference)} | dom ${formatDom(c.dom)}`
}

// One line per group: "  <count>  <group>".
export function groupTable(title: string, cases: Grouped[]): string[] {
  const rows = groupCounts(cases)
  const width = Math.max(1, ...rows.map(([, n]) => String(n).length))
  return [`${title} (${cases.length} cases, ${rows.length} groups):`, ...rows.map(([k, n]) => `  ${String(n).padStart(width)}  ${k}`)]
}

// The block printed after the summary line when the run has check-mismatches: the groups, then the examples.
export function mismatchDiagnostic(examples: DiagCase[], all: Grouped[]): string[] {
  return [
    ...groupTable('check-mismatch by policy · condition kind · platform', all),
    `check-mismatch examples (${examples.length} of ${all.length}, spread across groups):`,
    ...examples.map(c => `  ${formatExample(c)}`),
  ]
}

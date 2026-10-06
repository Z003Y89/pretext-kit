import { FIT_TOLERANCE } from '../fit.ts'
import { resolveSlot } from './conditions.ts'
import { naturalWidth, round64, uncoveredDetail } from './evaluate.ts'
import type { Condition, Row, Slot } from './types.ts'

export type RowResult = {
  kind: 'pass' | 'row-collapsed' | 'row-overflow' | 'uncovered'
  stage: number
  width: number
  box: number
  skipped: string[]
  detail?: string
}

type Step = { item: number; width: number }

export function evaluateRow(
  row: Row,
  rowName: string,
  texts: Map<string, string>,
  slots: Record<string, Slot>,
  condition: Condition,
  locale: string,
): RowResult {
  const where = (message: string) => `row "${rowName}", condition "${condition.name}": ${message}`
  if (row.items.length === 0) throw new RangeError(where('has no items'))
  const textScale = condition.textScale ?? 1
  const zoom = condition.zoom ?? 1
  for (const [what, value] of [['textScale', textScale], ['zoom', zoom]] as const) {
    if (!(value > 0) || !Number.isFinite(value)) throw new RangeError(where(`${what} must be a positive number, not ${value}`))
  }
  const rowWidth = typeof row.width === 'number' ? row.width : row.width(condition.viewport ?? 1440)
  const box = rowWidth * zoom
  if (!(box > 0) || !Number.isFinite(box)) throw new RangeError(where(`box is ${box}px`))
  if (!(row.gap >= 0) || !Number.isFinite(row.gap)) throw new RangeError(where(`gap must be a finite number of at least 0, not ${row.gap}`))
  const gap = row.gap * zoom

  const skipped: string[] = []
  const widths: number[] = []
  const kept: number[] = []
  const resolved = row.items.map((item) => {
    if (!Object.hasOwn(slots, item.slot)) throw new RangeError(where(`item "${item.key}" uses unknown slot "${item.slot}"`))
    return resolveSlot(item.slot, slots[item.slot]!, condition)
  })
  const steps: Step[] = []
  try {
    row.items.forEach((item, i) => {
      const text = texts.get(item.key)
      if (text === undefined) {
        skipped.push(item.key)
        return
      }
      kept.push(i)
      widths[i] = naturalWidth(text, resolved[i]!, locale) + resolved[i]!.reserve
    })

    const collapsible = kept.filter((i) => row.items[i]!.collapse !== undefined)
    collapsible.sort((a, b) => row.items[a]!.collapse!.order - row.items[b]!.collapse!.order || a - b)
    for (const i of collapsible) {
      const item = row.items[i]!
      const short = item.shortKey === undefined ? undefined : texts.get(item.shortKey)
      if (short !== undefined) steps.push({ item: i, width: naturalWidth(short, resolved[i]!, locale) + resolved[i]!.reserve })
      steps.push({ item: i, width: item.collapse!.iconWidth * textScale * zoom })
    }
  } catch (error) {
    const detail = uncoveredDetail(error)
    if (detail === null) throw error
    return { kind: 'uncovered', stage: 0, width: 0, box: round64(box), skipped, detail }
  }

  const total = (): number => kept.reduce((sum, i) => sum + widths[i]!, 0) + Math.max(0, kept.length - 1) * gap
  const result = (kind: RowResult['kind'], stage: number): RowResult => ({ kind, stage, width: round64(total()), box: round64(box), skipped })
  if (total() <= box + FIT_TOLERANCE) return result('pass', 0)
  for (let k = 0; k < steps.length; k++) {
    widths[steps[k]!.item] = steps[k]!.width
    if (total() <= box + FIT_TOLERANCE) return result('row-collapsed', k + 1)
  }
  return result('row-overflow', steps.length)
}

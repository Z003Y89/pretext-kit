import type { Condition, Slot } from './types.ts'

export type ResolvedSlot = {
  name: string
  box: number
  fontAt: (px: number) => string
  sizePx: number
  letterSpacing: number
  lineHeight: number | null
  whiteSpace: 'normal' | 'pre-wrap'
  numeric: 'proportional' | 'tabular'
  textTransform: NonNullable<Slot['textTransform']>
  policy: Slot['policy']
}

export const DEFAULT_CONDITION: Condition = { name: 'default' }

const PX = /(\d+(?:\.\d+)?)px/

function positive(value: number, what: string, slot: string, condition: string): number {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`slot "${slot}", condition "${condition}": ${what} must be a positive number, not ${value}`)
  }
  return value
}

export function resolveSlot(name: string, slot: Slot, condition: Condition): ResolvedSlot {
  const override = condition.slots !== undefined && Object.hasOwn(condition.slots, name) ? condition.slots[name] : undefined
  const merged: Slot = { ...slot, ...override }
  const where = (message: string) => `slot "${name}", condition "${condition.name}": ${message}`
  const textScale = positive(condition.textScale ?? 1, 'textScale', name, condition.name)
  const zoom = positive(condition.zoom ?? 1, 'zoom', name, condition.name)
  const scale = textScale * zoom
  const viewport = condition.viewport ?? 1440
  const width = typeof merged.width === 'number' ? merged.width : merged.width(viewport)
  const box = width * zoom - (merged.reserve ?? 0) * scale
  if (!(box > 0)) throw new RangeError(where(`box is ${box}px (width ${width * zoom} less reserve ${(merged.reserve ?? 0) * scale})`))
  const found = PX.exec(merged.font)
  if (found === null) throw new RangeError(where(`font "${merged.font}" has no px size`))
  const policy = merged.policy
  if (typeof policy === 'object' && 'truncate' in policy && policy.truncate === 'middle' && (policy.lines ?? 1) > 1) {
    throw new RangeError(where("truncate: 'middle' is one line; lines must be 1"))
  }
  const lines = typeof policy === 'object' && ('lines' in policy || 'truncate' in policy) ? policy.lines : undefined
  if (lines !== undefined && (!Number.isInteger(lines) || lines < 1)) throw new RangeError(where(`lines must be an integer of at least 1, not ${lines}`))
  return {
    name,
    box,
    fontAt: (px) => merged.font.replace(PX, `${px}px`),
    sizePx: Number(found[1]) * scale,
    letterSpacing: (merged.letterSpacing ?? 0) * scale,
    lineHeight: merged.lineHeight === undefined ? null : merged.lineHeight * scale,
    whiteSpace: merged.whiteSpace ?? 'normal',
    numeric: merged.numeric ?? 'proportional',
    textTransform: merged.textTransform ?? 'none',
    policy: typeof policy === 'object' && 'shrinkTo' in policy ? { shrinkTo: policy.shrinkTo * scale } : policy,
  }
}

export function conditionGrid(axes: { textScale?: number[]; zoom?: number[]; viewport?: number[] }): Condition[] {
  let grid: Condition[] = [{ name: '' }]
  const cross = (values: number[] | undefined, key: 'textScale' | 'zoom' | 'viewport', label: (v: number) => string) => {
    if (values === undefined) return
    grid = grid.flatMap((c) => values.map((v) => ({ ...c, [key]: v, name: c.name === '' ? label(v) : `${c.name} · ${label(v)}` })))
  }
  cross(axes.textScale, 'textScale', (v) => `text ${Math.round(v * 100)}%`)
  cross(axes.zoom, 'zoom', (v) => `zoom ${Math.round(v * 100)}%`)
  cross(axes.viewport, 'viewport', (v) => `${v}px`)
  return grid[0]!.name === '' ? [DEFAULT_CONDITION] : grid
}

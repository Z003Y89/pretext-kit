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

const PX = /(\d*\.?\d+)px/

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
  if (typeof policy === 'object' && 'shrinkTo' in policy) {
    if (!(policy.shrinkTo > 0) || !Number.isFinite(policy.shrinkTo)) throw new RangeError(where(`shrinkTo must be a positive number, not ${policy.shrinkTo}`))
    if (policy.shrinkTo > Number(found[1])) throw new RangeError(where(`shrinkTo ${policy.shrinkTo} is above the font size ${found[1]}px`))
  }
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

function percents(values: number[]): string[] {
  const whole = values.map((v) => `${Math.round(v * 100)}%`)
  if (new Set(whole).size === new Set(values).size) return whole
  return values.map((v) => `${+(v * 100).toFixed(1)}%`)
}

export function conditionGrid(axes: { textScale?: number[]; zoom?: number[]; viewport?: number[] }): Condition[] {
  let grid: Condition[] = [{ name: '' }]
  const cross = (values: number[] | undefined, key: 'textScale' | 'zoom' | 'viewport', labels: string[]) => {
    if (values === undefined || values.length === 0) return
    grid = grid.flatMap((c) => values.map((v, i) => ({ ...c, [key]: v, name: c.name === '' ? labels[i]! : `${c.name} · ${labels[i]}` })))
  }
  const scale = axes.textScale ?? []
  const zoom = axes.zoom ?? []
  cross(axes.textScale, 'textScale', percents(scale).map((p) => `text ${p}`))
  cross(axes.zoom, 'zoom', percents(zoom).map((p) => `zoom ${p}`))
  cross(axes.viewport, 'viewport', (axes.viewport ?? []).map((v) => `${v}px`))
  return grid[0]!.name === '' ? [DEFAULT_CONDITION] : grid
}

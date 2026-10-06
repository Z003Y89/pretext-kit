import { measureLineStats, measureNaturalWidth, prepareWithSegments, setLocale } from '@chenglou/pretext'
import type { PrepareOptions, PreparedTextWithSegments } from '@chenglou/pretext'
import { clamp, fitFontSize, prepareLabel, prepareSizes } from '../index.ts'
import type { ResolvedSlot } from './conditions.ts'
import { localeTag, transformText } from './labels.ts'
import type { Issue } from './types.ts'

export type Verdict = {
  kind: Issue['kind'] | 'pass'
  measured: Issue['measured']
  missing?: Issue['missing']
  detail?: string
}

const round64 = (x: number): number => Math.round(x * 64) / 64
const noHeight = (): number => 0

function options(slot: ResolvedSlot): PrepareOptions {
  return { whiteSpace: slot.whiteSpace, letterSpacing: slot.letterSpacing }
}

function prepareAt(text: string, slot: ResolvedSlot, px: number): PreparedTextWithSegments {
  return prepareWithSegments(text, slot.fontAt(px), options(slot))
}

// Every rule decides "fits" with fitFontSize's own test (Pretext's layout at the box width plus the
// kit's FIT_TOLERANCE). A single size is a one-entry range whose font function ignores the index,
// which also allows the fractional sizes a textScale or zoom produces.
function fitsAt(text: string, slot: ResolvedSlot, px: number, width: number, maxLines: number): boolean {
  const sizes = prepareSizes(text, () => slot.fontAt(px), { min: 1, max: 1 }, options(slot))
  return fitFontSize(sizes, { width, maxLines }, noHeight) !== null
}

function largestFit(text: string, slot: ResolvedSlot, min: number, max: number): number | null {
  if (min > max) return null
  const found = fitFontSize(prepareSizes(text, slot.fontAt, { min, max }, options(slot)), { width: slot.box, maxLines: 1 }, noHeight)
  return found === null ? null : found.px
}

function measured(slot: ResolvedSlot, width: number, lines: number, fontPx: number): Issue['measured'] {
  return { width: round64(width), box: round64(slot.box), lines, fontPx: round64(fontPx) }
}

// setLocale clears Pretext's caches, so it runs only when the locale changes.
let lastLocale: string | undefined | null = null
function useLocale(locale: string): void {
  const tag = localeTag(locale)
  if (tag === lastLocale) return
  setLocale(tag)
  lastLocale = tag
}

export function naturalWidth(text: string, slot: ResolvedSlot, locale: string): number {
  useLocale(locale)
  return measureNaturalWidth(prepareAt(transformText(text, slot.textTransform, locale), slot, slot.sizePx))
}

function asIs(text: string, slot: ResolvedSlot): Verdict {
  const prepared = prepareAt(text, slot, slot.sizePx)
  const width = measureNaturalWidth(prepared)
  if (fitsAt(text, slot, slot.sizePx, slot.box, 1)) return { kind: 'pass', measured: measured(slot, width, 1, slot.sizePx) }
  const lines = measureLineStats(prepared, slot.box).lineCount
  const over = round64(width - slot.box)
  return { kind: 'overflow', measured: measured(slot, width, lines, slot.sizePx), ...(over > 0 ? { missing: { px: over } } : {}) }
}

function shrink(text: string, slot: ResolvedSlot, shrinkTo: number): Verdict {
  const min = Math.min(shrinkTo, slot.sizePx)
  const size = slot.sizePx
  // A fractional size is searched alone; the whole pixels between are fitFontSize's search.
  let hit: number | null = null
  if (!Number.isInteger(size) && fitsAt(text, slot, size, slot.box, 1)) hit = size
  else hit = largestFit(text, slot, Math.max(1, Math.ceil(min)), Math.floor(size))
  if (hit === null && !Number.isInteger(min) && fitsAt(text, slot, min, slot.box, 1)) hit = min
  if (hit !== null) {
    return { kind: 'pass', measured: measured(slot, measureNaturalWidth(prepareAt(text, slot, hit)), 1, hit) }
  }
  const width = measureNaturalWidth(prepareAt(text, slot, min))
  const below = Math.ceil(min) - 1
  const fitsAtPx = below >= 1 ? largestFit(text, slot, 1, below) : null
  const short = round64(width - slot.box)
  const missing: NonNullable<Issue['missing']> = {
    ...(short > 0 ? { px: short } : {}),
    ...(fitsAtPx === null ? {} : { fitsAtPx }),
  }
  return {
    kind: 'below-min-size',
    measured: measured(slot, width, measureLineStats(prepareAt(text, slot, min), slot.box).lineCount, min),
    ...(missing.px === undefined && missing.fitsAtPx === undefined ? {} : { missing }),
  }
}

function lines(text: string, slot: ResolvedSlot, max: number): Verdict {
  const prepared = prepareAt(text, slot, slot.sizePx)
  const sizes = prepareSizes(text, () => slot.fontAt(slot.sizePx), { min: 1, max: 1 }, options(slot))
  const fits = (width: number): boolean => fitFontSize(sizes, { width, maxLines: max }, noHeight) !== null
  const stats = measureLineStats(prepared, slot.box)
  if (fits(slot.box)) return { kind: 'pass', measured: measured(slot, stats.maxLineWidth, stats.lineCount, slot.sizePx) }
  const out: Verdict = { kind: 'too-many-lines', measured: measured(slot, stats.maxLineWidth, stats.lineCount, slot.sizePx) }
  // The narrowest width that holds the text in max lines lies between the box and the natural width;
  // search it on a 1/64 px grid from the box.
  const steps = Math.ceil((measureNaturalWidth(prepared) - slot.box) * 64)
  if (steps >= 1 && fits(slot.box + steps / 64)) {
    let lo = 0
    let hi = steps
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2)
      if (fits(slot.box + mid / 64)) hi = mid
      else lo = mid
    }
    out.missing = { px: hi / 64 }
  }
  return out
}

function truncateEnd(text: string, slot: ResolvedSlot, max: number): Verdict {
  const prepared = prepareAt(text, slot, slot.sizePx)
  const cut = clamp(prepared, slot.box, max)
  return {
    kind: cut.truncated ? 'truncated' : 'pass',
    measured: measured(slot, measureNaturalWidth(prepared), cut.lineCount, slot.sizePx),
  }
}

// prepareLabel collapses white space as truncateMiddle does but takes no prepare options, so the
// collapsed text it returns is measured again with the slot's letterSpacing and whiteSpace and
// judged by the same fit test as the other policies.
function truncateCenter(text: string, slot: ResolvedSlot): Verdict {
  const collapsed = prepareLabel(text, slot.fontAt(slot.sizePx)).text
  const width = measureNaturalWidth(prepareAt(collapsed, slot, slot.sizePx))
  const fits = fitsAt(collapsed, slot, slot.sizePx, slot.box, 1)
  return { kind: fits ? 'pass' : 'truncated', measured: measured(slot, width, 1, slot.sizePx) }
}

function judge(text: string, slot: ResolvedSlot): Verdict {
  const policy = slot.policy
  if (policy === 'as-is') return asIs(text, slot)
  if ('shrinkTo' in policy) return shrink(text, slot, policy.shrinkTo)
  if ('truncate' in policy) return policy.truncate === 'middle' ? truncateCenter(text, slot) : truncateEnd(text, slot, policy.lines ?? 1)
  return lines(text, slot, policy.lines)
}

export function evaluateLabel(text: string, slot: ResolvedSlot, locale: string): Verdict {
  const transformed = transformText(text, slot.textTransform, locale)
  if (transformed.trim() === '') return { kind: 'pass', measured: measured(slot, 0, 0, slot.sizePx) }
  useLocale(locale)
  try {
    return judge(transformed, slot)
  } catch (error) {
    // Matched by name: src/check must not import src/headless, which the browser entry stays free of.
    if (!(error instanceof Error) || error.name !== 'HeadlessCoverageError') throw error
    const codePoint = /U\+[0-9A-F]{4,6}/.exec(error.message)
    return { kind: 'uncovered', measured: measured(slot, 0, 0, slot.sizePx), detail: codePoint === null ? error.message : codePoint[0] }
  }
}

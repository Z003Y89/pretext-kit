import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import type { PrepareOptions, PreparedTextWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats, prepareRichInline } from '@chenglou/pretext/rich-inline'
import type { PreparedRichInline, RichInlineBox, RichInlineItem, RichInlineOptions } from '@chenglou/pretext/rich-inline'
import { FIT_TOLERANCE } from './fit.ts'

export type PreparedSizes = {
  text: string
  font: (px: number) => string
  min: number
  max: number
  options: PrepareOptions | undefined
  // handles[px - min], created on first use: preparing every size up front would measure sizes the search never visits.
  handles: (PreparedTextWithSegments | undefined)[]
  // units[px - min]: the widest piece no width breaks (a grapheme), measured on first need.
  units: (number | undefined)[]
}
export type FitBox = { width: number, height?: number, maxLines?: number }
export type FitResult = { px: number, prepared: PreparedTextWithSegments, lineCount: number }

export function prepareSizes(
  text: string,
  font: (px: number) => string,
  range: { min: number, max: number },
  options?: PrepareOptions,
): PreparedSizes {
  const { min, max } = range
  checkRange(min, max)
  return {
    text, font, min, max, options,
    handles: emptySlots<PreparedTextWithSegments>(min, max),
    units: emptySlots<number>(min, max),
  }
}

function checkRange(min: number, max: number): void {
  // Whole pixels only: Firefox measures Canvas text at rounded sizes, so fractional sizes would disagree with rendering.
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
    throw new RangeError('font size range needs integers with 1 <= min <= max')
  }
}

function emptySlots<T>(min: number, max: number): (T | undefined)[] {
  const slots: (T | undefined)[] = []
  for (let i = 0; i <= max - min; i++) slots.push(undefined)
  return slots
}

function handleAt(sizes: PreparedSizes, px: number): PreparedTextWithSegments {
  const i = px - sizes.min
  let h = sizes.handles[i]
  if (h === undefined) {
    h = prepareWithSegments(sizes.text, sizes.font(px), sizes.options)
    sizes.handles[i] = h
  }
  return h
}

// A line no wider than 0 holds one unbreakable piece, so the widest such line is the widest piece.
function widestUnit(sizes: PreparedSizes, px: number): number {
  const i = px - sizes.min
  let w = sizes.units[i]
  if (w === undefined) {
    w = measureLineStats(handleAt(sizes, px), 0).maxLineWidth
    sizes.units[i] = w
  }
  return w
}

type Stats = { lineCount: number, maxLineWidth: number }

// Returns the line count when the stats fit the box at px, else -1, so the search needs no result object per probe.
// unit(px) is the widest unbreakable piece at px, called only when a line is reported past the width, so most probes
// never measure it. Callers build unit once per fit, so the search allocates nothing per probe.
function judge(s: Stats, unit: (px: number) => number, px: number, box: FitBox, lineHeight: (px: number) => number): number {
  // Written as negated <= so a NaN (from a caller's lineHeight, height or maxLines) fails closed instead of passing.
  // A line Pretext laid out past the width either overflows, holding a piece wider than the width that no break
  // can split, or is one Pretext fitted there and reports wider than it paints (one ending at a soft hyphen whose
  // syllables measure narrower joined than apart, or any other line Pretext accepts past its reported width).
  // Only the first fails to fit: Pretext's layout, not its reported width, decides the rest.
  if (!(s.maxLineWidth <= box.width + FIT_TOLERANCE) && !(unit(px) <= box.width + FIT_TOLERANCE)) return -1
  if (box.maxLines !== undefined && !(s.lineCount <= box.maxLines)) return -1
  if (box.height !== undefined && !(s.lineCount * lineHeight(px) <= box.height)) return -1
  return s.lineCount
}

// Plain and rich rows differ only in how a size is measured, so the search takes that as a parameter (as src/width.ts does).
// Returns the best size, or -1 when even min does not fit; lineCount is read back by probing the answer once more.
function searchSize(min: number, max: number, width: number, probe: (px: number) => number): number {
  // NaN would make every comparison false and report a fit at every size; Infinity is a legitimate "unconstrained".
  if (Number.isNaN(width)) throw new RangeError('box.width must not be NaN')
  if (probe(min) < 0) return -1
  // Searched, not scaled from one measurement: wrapping makes fit non-monotonic in size, so no formula gives the answer.
  let lo = min
  let hi = max
  // Invariant: lo fits, and hi + 1 is max + 1 or a size probed and found not fitting. When lo === hi, size lo + 1
  // therefore failed (or lo is max), which is the guarantee even when fit is non-monotonic: the answer is a local maximum.
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2)
    if (probe(mid) >= 0) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function fitFontSize(
  sizes: PreparedSizes,
  box: FitBox,
  lineHeight: (px: number) => number,
): FitResult | null {
  const unit = (px: number) => widestUnit(sizes, px)
  const probe = (px: number) => judge(measureLineStats(handleAt(sizes, px), box.width), unit, px, box, lineHeight)
  const px = searchSize(sizes.min, sizes.max, box.width, probe)
  if (px < 0) return null
  return { px, prepared: handleAt(sizes, px), lineCount: probe(px) }
}

export type PreparedSizesRich = {
  items: (px: number) => Array<RichInlineItem | RichInlineBox>
  min: number
  max: number
  options: RichInlineOptions | undefined
  // handles[px - min], created on first use, for the same reason as PreparedSizes.
  handles: (PreparedRichInline | undefined)[]
  // units[px - min]: the widest piece no width breaks (a grapheme or a box), measured on first need.
  units: (number | undefined)[]
}
export type FitResultRich = { px: number, prepared: PreparedRichInline, lineCount: number }

export function prepareSizesRich(
  items: (px: number) => Array<RichInlineItem | RichInlineBox>,
  range: { min: number, max: number },
  options?: RichInlineOptions,
): PreparedSizesRich {
  const { min, max } = range
  checkRange(min, max)
  return {
    items, min, max, options,
    handles: emptySlots<PreparedRichInline>(min, max),
    units: emptySlots<number>(min, max),
  }
}

function handleAtRich(sizes: PreparedSizesRich, px: number): PreparedRichInline {
  const i = px - sizes.min
  let h = sizes.handles[i]
  if (h === undefined) {
    h = prepareRichInline(sizes.items(px), sizes.options)
    sizes.handles[i] = h
  }
  return h
}

// As widestUnit: a row laid out at width 0 puts each unbreakable piece on its own line.
function widestUnitRich(sizes: PreparedSizesRich, px: number): number {
  const i = px - sizes.min
  let w = sizes.units[i]
  if (w === undefined) {
    w = measureRichInlineStats(handleAtRich(sizes, px), 0).maxLineWidth
    sizes.units[i] = w
  }
  return w
}

// Callers keep icon (box) heights at or below the line height: a taller box makes its line taller in the browser,
// and only lineHeight(px) is counted here, so the height check would then be optimistic.
export function fitFontSizeRich(
  sizes: PreparedSizesRich,
  box: FitBox,
  lineHeight: (px: number) => number,
): FitResultRich | null {
  const unit = (px: number) => widestUnitRich(sizes, px)
  const probe = (px: number) => judge(measureRichInlineStats(handleAtRich(sizes, px), box.width), unit, px, box, lineHeight)
  const px = searchSize(sizes.min, sizes.max, box.width, probe)
  if (px < 0) return null
  return { px, prepared: handleAtRich(sizes, px), lineCount: probe(px) }
}

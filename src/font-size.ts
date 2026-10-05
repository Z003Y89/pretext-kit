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
  return { text, font, min, max, options, handles: emptyHandles<PreparedTextWithSegments>(min, max) }
}

function checkRange(min: number, max: number): void {
  // Whole pixels only: Firefox measures Canvas text at rounded sizes, so fractional sizes would disagree with rendering.
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
    throw new RangeError('font size range needs integers with 1 <= min <= max')
  }
}

function emptyHandles<P>(min: number, max: number): (P | undefined)[] {
  const handles: (P | undefined)[] = []
  for (let i = 0; i <= max - min; i++) handles.push(undefined)
  return handles
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

type Stats = { lineCount: number, maxLineWidth: number }

// Returns the line count when the stats fit the box at px, else -1, so the search needs no result object per probe.
function judge(s: Stats, px: number, box: FitBox, lineHeight: (px: number) => number): number {
  // Written as negated <= so a NaN (from a caller's lineHeight, height or maxLines) fails closed instead of passing.
  if (!(s.maxLineWidth <= box.width + FIT_TOLERANCE)) return -1
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
  const probe = (px: number) => judge(measureLineStats(handleAt(sizes, px), box.width), px, box, lineHeight)
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
}
export type FitResultRich = { px: number, prepared: PreparedRichInline, lineCount: number }

export function prepareSizesRich(
  items: (px: number) => Array<RichInlineItem | RichInlineBox>,
  range: { min: number, max: number },
  options?: RichInlineOptions,
): PreparedSizesRich {
  const { min, max } = range
  checkRange(min, max)
  return { items, min, max, options, handles: emptyHandles<PreparedRichInline>(min, max) }
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

// Callers keep icon (box) heights at or below the line height: a taller box makes its line taller in the browser,
// and only lineHeight(px) is counted here, so the height check would then be optimistic.
export function fitFontSizeRich(
  sizes: PreparedSizesRich,
  box: FitBox,
  lineHeight: (px: number) => number,
): FitResultRich | null {
  const probe = (px: number) => judge(measureRichInlineStats(handleAtRich(sizes, px), box.width), px, box, lineHeight)
  const px = searchSize(sizes.min, sizes.max, box.width, probe)
  if (px < 0) return null
  return { px, prepared: handleAtRich(sizes, px), lineCount: probe(px) }
}

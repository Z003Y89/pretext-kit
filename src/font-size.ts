import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import type { PrepareOptions, PreparedTextWithSegments } from '@chenglou/pretext'
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
  // Whole pixels only: Firefox measures Canvas text at rounded sizes, so fractional sizes would disagree with rendering.
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
    throw new RangeError('font size range needs integers with 1 <= min <= max')
  }
  const handles: (PreparedTextWithSegments | undefined)[] = []
  for (let i = 0; i <= max - min; i++) handles.push(undefined)
  return { text, font, min, max, options, handles }
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

// Returns the line count when the text fits at px, else -1, so the search needs no result object per probe.
function probe(sizes: PreparedSizes, px: number, box: FitBox, lineHeight: (px: number) => number): number {
  const s = measureLineStats(handleAt(sizes, px), box.width)
  // Written as negated <= so a NaN (from a caller's lineHeight, height or maxLines) fails closed instead of passing.
  if (!(s.maxLineWidth <= box.width + FIT_TOLERANCE)) return -1
  if (box.maxLines !== undefined && !(s.lineCount <= box.maxLines)) return -1
  if (box.height !== undefined && !(s.lineCount * lineHeight(px) <= box.height)) return -1
  return s.lineCount
}

export function fitFontSize(
  sizes: PreparedSizes,
  box: FitBox,
  lineHeight: (px: number) => number,
): FitResult | null {
  // NaN would make every comparison false and report a fit at every size; Infinity is a legitimate "unconstrained".
  if (Number.isNaN(box.width)) throw new RangeError('box.width must not be NaN')
  if (probe(sizes, sizes.min, box, lineHeight) < 0) return null
  // Searched, not scaled from one measurement: wrapping makes fit non-monotonic in size, so no formula gives the answer.
  let lo = sizes.min
  let hi = sizes.max
  // Invariant: lo fits, and hi + 1 is max + 1 or a size probed and found not fitting. When lo === hi, size lo + 1
  // therefore failed (or lo is max), which is the guarantee even when fit is non-monotonic: the answer is a local maximum.
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2)
    if (probe(sizes, mid, box, lineHeight) >= 0) lo = mid
    else hi = mid - 1
  }
  return { px: lo, prepared: handleAt(sizes, lo), lineCount: probe(sizes, lo, box, lineHeight) }
}

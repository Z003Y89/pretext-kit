import { measureLineStats } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats } from '@chenglou/pretext/rich-inline'
import { FIT_TOLERANCE } from './fit.ts'
import type { PreparedRichInline } from '@chenglou/pretext/rich-inline'

export type WidthFit = { width: number, lineCount: number }

type Stats = { lineCount: number, maxLineWidth: number }

// Plain and rich text differ only in how a probe is measured, so the searches take that as a parameter.
type StatsFn<P> = (prepared: P, maxWidth: number) => Stats

function shrinkwrapWith<P>(stats: StatsFn<P>, prepared: P, maxWidth: number): WidthFit {
  const s = stats(prepared, maxWidth)
  let width = Math.ceil(s.maxLineWidth)
  // A widest line a hair over a whole pixel (within the slack Pretext gives a line) may still fit
  // at that pixel, as it does in the browser. Pretext's own layout there decides, since its slack
  // differs per engine: the pixel is taken only if the lines come out the same.
  const below = width - 1
  if (below >= 1 && s.maxLineWidth - below <= FIT_TOLERANCE) {
    const t = stats(prepared, below)
    // The widest line is compared loosely because Pretext sums a line's widths in a different
    // order at another width, which moves the last float digits of the same line.
    if (t.lineCount === s.lineCount && Math.abs(t.maxLineWidth - s.maxLineWidth) < 1e-6) width = below
  }
  // Capped because a fractional maxWidth must never be exceeded by rounding the widest line up.
  return { width: Math.min(width, maxWidth), lineCount: s.lineCount }
}

function balanceWith<P>(stats: StatsFn<P>, prepared: P, maxWidth: number): WidthFit {
  const target = stats(prepared, maxWidth).lineCount
  // An unbounded width has no search range, and one line needs no balancing.
  if (target <= 1 || !Number.isFinite(maxWidth)) return shrinkwrapWith(stats, prepared, maxWidth)
  let lo = 1
  let hi = Math.floor(maxWidth)
  // Rounding a fractional maxWidth down can add a line; no whole-pixel width then matches the target.
  if (hi < 1 || stats(prepared, hi).lineCount > target) return shrinkwrapWith(stats, prepared, maxWidth)
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (stats(prepared, mid).lineCount <= target) hi = mid
    else lo = mid + 1
  }
  // A line Pretext fitted at lo may measure up to its fit tolerance past lo, and lo still holds it;
  // rounding that up would answer a pixel wider than needed. Only a grapheme wider than lo, which
  // lines hold one each at any width (so the search bottoms out at 1px), needs the wider result,
  // capped at maxWidth where a browser would overflow it.
  const widest = stats(prepared, lo).maxLineWidth
  const width = Math.min(maxWidth, widest <= lo + FIT_TOLERANCE ? lo : Math.ceil(widest))
  // Line counts are not monotone in width, so the search result is not guaranteed to reproduce the
  // target at the width actually returned; verify it and fall back to the always-correct shrinkwrap.
  const check = stats(prepared, width)
  if (check.lineCount !== target) return shrinkwrapWith(stats, prepared, maxWidth)
  return { width, lineCount: check.lineCount }
}

export function shrinkwrap(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit {
  return shrinkwrapWith(measureLineStats, prepared, maxWidth)
}

export function balance(prepared: PreparedTextWithSegments, maxWidth: number): WidthFit {
  return balanceWith(measureLineStats, prepared, maxWidth)
}

export function shrinkwrapRich(prepared: PreparedRichInline, maxWidth: number): WidthFit {
  return shrinkwrapWith(measureRichInlineStats, prepared, maxWidth)
}

export function balanceRich(prepared: PreparedRichInline, maxWidth: number): WidthFit {
  return balanceWith(measureRichInlineStats, prepared, maxWidth)
}

import { measureLineStats } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats } from '@chenglou/pretext/rich-inline'
import type { PreparedRichInline } from '@chenglou/pretext/rich-inline'

export type WidthFit = { width: number, lineCount: number }

type Stats = { lineCount: number, maxLineWidth: number }

// Plain and rich text differ only in how a probe is measured, so the searches take that as a parameter.
type StatsFn<P> = (prepared: P, maxWidth: number) => Stats

function shrinkwrapWith<P>(stats: StatsFn<P>, prepared: P, maxWidth: number): WidthFit {
  const s = stats(prepared, maxWidth)
  // Capped because a fractional maxWidth must never be exceeded by rounding the widest line up.
  return { width: Math.min(Math.ceil(s.maxLineWidth), maxWidth), lineCount: s.lineCount }
}

function balanceWith<P>(stats: StatsFn<P>, prepared: P, maxWidth: number): WidthFit {
  const target = stats(prepared, maxWidth).lineCount
  if (target <= 1) return shrinkwrapWith(stats, prepared, maxWidth)
  let lo = 1
  let hi = Math.floor(maxWidth)
  // Rounding a fractional maxWidth down can add a line; no whole-pixel width then matches the target.
  if (hi < 1 || stats(prepared, hi).lineCount > target) return shrinkwrapWith(stats, prepared, maxWidth)
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (stats(prepared, mid).lineCount <= target) hi = mid
    else lo = mid + 1
  }
  const s = stats(prepared, lo)
  // The max matters only when a grapheme is wider than lo: lines are one grapheme each at any width,
  // so the search bottoms out at 1px, yet the result must hold the widest line (capped at maxWidth,
  // where a browser would overflow it).
  return { width: Math.min(maxWidth, Math.max(lo, Math.ceil(s.maxLineWidth))), lineCount: s.lineCount }
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

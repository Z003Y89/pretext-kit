// The grapheme-prefix cut shared by clamp.ts and middle.ts, which derive from Pretext's
// pages/demos/ellipsis.model.ts (MIT licence, Copyright (c) 2026 Pretext contributors; see LICENSE).

import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { PrepareOptions } from '@chenglou/pretext'
import { FIT_TOLERANCE } from './fit.ts'

// What a cut text is measured in: a cut and the text around it paint as one run, which kerns
// and shapes across the seams (Arabic joins, CJK punctuation spaces, Latin pairs kern), so the
// cut is measured as that one text, prepared alone, rather than as pieces of the paragraph
// measured apart: within a segment Pretext measures it whole, kerning included.
export type Measure = { font: string, options?: PrepareOptions | undefined }

export function measureText(m: Measure, text: string): number {
  return measureNaturalWidth(prepareWithSegments(text, m.font, m.options))
}

// A text's width where its trailing spaces paint (before an ellipsis or as all there is); a lone
// space collapses to nothing, so no-break spaces stand in for them.
export function paintedWidth(m: Measure, text: string): number {
  return measureText(m, text.replace(/ +$/, s => '\u00A0'.repeat(s.length)))
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Code-unit ends of each grapheme of `text`: prefix k is text.slice(0, ends[k - 1]).
export function graphemeEnds(text: string): number[] {
  const ends: number[] = []
  for (const g of graphemeSegmenter.segment(text)) ends.push(g.index + g.segment.length)
  return ends
}

// The most of `ends` (at least one) for which `compose(prefix)` measures within `width`, as
// Pretext measures the composed text alone (segment widths summed, kerning applied within a
// segment, not across segments). A bisection finds the place and a walk forward settles it where
// shaping does not grow monotonically: the answer fits (unless only one grapheme is left) and the
// next grapheme would overrun, so it is the longest cut locally, not necessarily globally.
export function longestPrefix(
  m: Measure,
  text: string,
  ends: number[],
  width: number,
  compose: (prefix: string) => string,
): string {
  if (ends.length === 0) return ''
  const fits = (k: number): boolean => measureText(m, compose(text.slice(0, ends[k - 1]))) <= width + FIT_TOLERANCE
  // Invariant: lo fits or lo is 1; hi + 1 overruns or is past the end.
  let lo = 1
  let hi = ends.length
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  while (lo < ends.length && fits(lo + 1)) lo++
  return text.slice(0, ends[lo - 1])
}

// A cut that ends in white space drops it, as a browser's truncation does, unless that empties it.
export function trimCut(cut: string): string {
  const trimmed = cut.replace(/\s+$/, '')
  return trimmed === '' ? cut : trimmed
}

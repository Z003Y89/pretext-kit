// The instrumented copy of Pretext's entry for the bench's count bundle only: bench-run.ts resolves
// '@chenglou/pretext' to this module for every importer but this one, so the kit's own calls in
// src/ are counted without touching src/. The timed bundle never includes it.
import * as pretext from '@chenglou/pretext'
import type { PrepareOptions, PreparedTextWithSegments } from '@chenglou/pretext'

export * from '@chenglou/pretext'

export const pretextCounts = { prepareWithSegments: 0, measureLineStats: 0, prepareRichInline: 0, measureRichInlineStats: 0 }
;(globalThis as { pretextCounts?: typeof pretextCounts }).pretextCounts = pretextCounts

export function prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments {
  pretextCounts.prepareWithSegments++
  return pretext.prepareWithSegments(text, font, options)
}

export function measureLineStats(prepared: PreparedTextWithSegments, maxWidth: number): ReturnType<typeof pretext.measureLineStats> {
  pretextCounts.measureLineStats++
  return pretext.measureLineStats(prepared, maxWidth)
}

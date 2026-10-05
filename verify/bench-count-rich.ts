// As bench-count-pretext.ts, for '@chenglou/pretext/rich-inline': counted in the count bundle only.
import * as rich from '@chenglou/pretext/rich-inline'
import type { PreparedRichInline, RichInlineBox, RichInlineItem, RichInlineOptions } from '@chenglou/pretext/rich-inline'
import { pretextCounts } from './bench-count-pretext.ts'

export * from '@chenglou/pretext/rich-inline'

export function prepareRichInline(items: Array<RichInlineItem | RichInlineBox>, options?: RichInlineOptions): PreparedRichInline {
  pretextCounts.prepareRichInline++
  return rich.prepareRichInline(items, options)
}

export function measureRichInlineStats(prepared: PreparedRichInline, maxWidth: number): ReturnType<typeof rich.measureRichInlineStats> {
  pretextCounts.measureRichInlineStats++
  return rich.measureRichInlineStats(prepared, maxWidth)
}

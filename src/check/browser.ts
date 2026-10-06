import { runCheck } from './run.ts'
import type { CheckInput, Report } from './types.ts'

export { conditionGrid } from './conditions.ts'
export { slotFromStyle } from './style.ts'
export type * from './types.ts'

export type BrowserCheckInput = Omit<CheckInput, 'fonts'> & { fonts?: CheckInput['fonts'] }

// Canvas cannot apply font-variant-numeric, so a tabular slot has no twin family to measure with.
export async function checkLabels(input: BrowserCheckInput): Promise<Report> {
  if (input.fonts !== undefined) throw new RangeError("the browser entry uses the page's fonts; remove fonts")
  return runCheck(
    { ...input, fonts: [], platforms: undefined },
    { platforms: ['browser'], select: () => {}, tabularFamily: () => null },
  )
}

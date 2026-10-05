// Cases where the browser paints more lines at a fit helper's own answer than Pretext lays out there.
// They are pretext-gaps (Pretext's count is the cause and the kit agreed with it). Whether the extra
// line takes the text out of its box is decided from what the case records: the painted line count
// times the size's CSS line height against the box's height, or the painted count against maxLines.
// Shared by run.ts (RESULTS.md) and stats.ts (EVALUATION.md), so both say the same.
import { FIT_HEIGHT, FIT_LINE_HEIGHT_RATIO, RICH_HEIGHT, richLineHeight } from './corpora.ts'

export type ListedCase = { browser: string, helper: string, outcome: string, font: string, detail?: string, box?: string }

const AT_ANSWER = /^returned (\d+)px, at (\d+)px: DOM (\d+) lines, Pretext (\d+)$/

export type AtAnswer = { label: string, font: string, browser: string, px: number, dom: number, pretext: number, overBox: boolean }

export function atAnswer(helper: 'fitFontSize' | 'fitFontSizeRich', cases: ListedCase[]): AtAnswer[] {
  const out: AtAnswer[] = []
  for (const c of cases) {
    if (c.helper !== helper || c.outcome !== 'pretext-gap' || c.detail === undefined) continue
    const colon = c.detail.indexOf(': ')
    const m = AT_ANSWER.exec(c.detail.slice(colon + 2))
    if (m === null || m[1] !== m[2] || Number(m[3]) <= Number(m[4])) continue
    const px = Number(m[1])
    const dom = Number(m[3])
    let overBox: boolean
    if (helper === 'fitFontSize') overBox = dom * px * FIT_LINE_HEIGHT_RATIO > FIT_HEIGHT
    else if (c.box === 'maxLines 1') overBox = dom > 1
    else if (c.box === `height ${RICH_HEIGHT}`) overBox = dom * richLineHeight(px) > RICH_HEIGHT
    else throw new Error(`fitFontSizeRich case with an unknown box: ${c.box}`)
    out.push({ label: c.detail.slice(0, colon), font: c.font, browser: c.browser, px, dom, pretext: Number(m[4]), overBox })
  }
  return out
}

export function overflowsAtAnswer(helper: 'fitFontSize' | 'fitFontSizeRich', cases: ListedCase[]): string {
  const found = atAnswer(helper, cases)
  if (found.length === 0) return `In no case does the browser paint more lines at ${helper}'s answer than Pretext.`
  const byText = new Map<string, { n: number, over: number, fonts: Set<string>, where: Set<string> }>()
  for (const a of found) {
    let e = byText.get(a.label)
    if (e === undefined) byText.set(a.label, e = { n: 0, over: 0, fonts: new Set(), where: new Set() })
    e.n++
    if (a.overBox) e.over++
    e.fonts.add(a.font)
    e.where.add(a.browser)
  }
  const over = found.filter(a => a.overBox).length
  const parts = [...byText].map(([label, e]) =>
    `${label} ${e.n}${e.over === e.n ? '' : `, ${e.over} over the box`} (${[...e.fonts].join('/')}; ${[...e.where].join(', ')})`)
  const box = helper === 'fitFontSize'
    ? `the painted lines × the size's line height exceed the ${FIT_HEIGHT}px box`
    : `the painted lines exceed the box (more than maxLines, or lines × line height over ${RICH_HEIGHT}px)`
  const split = over === found.length
    ? `In all ${over}, ${box}: a visible overflow.`
    : `In ${over} of them ${box}: a visible overflow. In the other ${found.length - over} the extra line still fits the box.`
  return `In ${found.length} cases the browser paints more lines at ${helper}'s own answer than Pretext lays out there: `
    + `${parts.join('; ')}. ${split} They are pretext-gaps, since Pretext's own line count is the cause and the kit `
    + 'agreed with it, but the overflows are ones a user sees.'
}

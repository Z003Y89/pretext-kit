import { layout, layoutNextLine, measureLineStats, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor, PreparedTextWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats, prepareRichInline } from '@chenglou/pretext/rich-inline'
import type { PreparedRichInline, RichInlineBox, RichInlineItem } from '@chenglou/pretext/rich-inline'
import {
  balance, clamp, clampStats, fitFontSize, fitFontSizeRich, fontFromStyle, measureTail, prepareLabel, prepareSizes, prepareSizesRich, shrinkwrap, truncateMiddle,
} from '../src/index.ts'
import type { Clamped, FitResult, FitResultRich, PreparedLabel, PreparedSizesRich, StyleFont, Tail } from '../src/index.ts'
import { CORPORA, FONT_SIZE, FONT_STACKS, LABEL_WIDTH_MAX, LABEL_WIDTH_MIN, LABELS, LINE_HEIGHT, UI_LABELS, widths } from './corpora.ts'
import type { FontStack } from './corpora.ts'
import { WEBKIT_LINE_HEIGHT_FLOOR } from './causes.ts'

export type Helper = 'shrinkwrap' | 'balance' | 'fitFontSize' | 'fitFontSizeRich' | 'fontFromStyle' | 'clamp' | 'truncateMiddle'
// 'platform' is a case the kit got wrong only because the browser paints something its CSS does
// not say, with the mechanism proven for that case; cause names the mechanism. 'unreliable' is a
// case whose painted height matched no line count, so the sweep could not count lines at all.
export type Outcome = 'pass' | 'pretext-gap' | 'kit-mismatch' | 'platform' | 'unreliable'
export type CaseResult = {
  helper: string
  corpus: string
  font: string
  width: number
  // clamp only: the maxLines the case was run with.
  maxLines?: number
  // fitFontSizeRich only: the box the case was run with, 'maxLines 1' or 'height N'.
  box?: string
  lines?: number
  outcome: Outcome
  detail?: string
  cause?: string
}
export type FontPresence = { family: string, present: boolean }

declare global {
  interface Window {
    // One corpus per call when named: a whole clamp sweep is too large to hand back at once.
    sweep: (helper: Helper, corpus?: string) => Promise<CaseResult[]>
    sweepCorpora: (helper: Helper) => string[]
    sweepWidthStep: Record<string, number>
    // Set by run.ts: a platform cause is only credited in the engine known to have it.
    sweepBrowser: string
    fontPresence: () => Promise<FontPresence[]>
  }
}

// 96px holds four 24px lines, so the box is tight enough at 16px that most texts must shrink or
// grow to fit, which is where a wrong size would show.
const FIT_HEIGHT = 96
const FIT_MIN = 8
const FIT_MAX = 48
const FIT_LINE_HEIGHT_RATIO = 1.5
// Line boxes sit on at most a 1/64 px grid in every engine, so a height within this of n lines is n lines.
const GRID = 1 / 64
// Pretext lets a line exceed its width by this much. The harness pins its own copy rather than
// importing the kit's, so a changed constant in src cannot move the kit and its judge together.
const FIT = 1 / 64
const ELLIPSIS = '…'
const CLAMP_MAX_LINES = 5

// Step 1 everywhere unless a run overrides it; run.ts sets this when a browser is too slow at step 1.
window.sweepWidthStep = { shrinkwrap: 1, balance: 1, fitFontSize: 1, fitFontSizeRich: 1, clamp: 1, truncateMiddle: 1 }
window.sweepBrowser = ''

const probe = document.getElementById('probe') as HTMLDivElement
// A -webkit-line-clamp box, and a white-space: pre span that paints one line as given.
const clampBox = document.getElementById('clamp') as HTMLDivElement
const lineSpan = document.getElementById('line') as HTMLSpanElement

// Only what varies per case is set here; sweep.html pins every other property Pretext models,
// so nothing inherited separates what is painted from what was measured.
function styleEl(el: HTMLElement, stack: FontStack, px: number, lineHeight: number): void {
  const s = el.style
  if (s.fontFamily !== stack.family) s.fontFamily = stack.family
  s.fontSize = `${px}px`
  s.lineHeight = `${lineHeight}px`
}
function styleProbe(stack: FontStack, px: number, lineHeight: number): void {
  styleEl(probe, stack, px, lineHeight)
}

// Each font comes from computed style, as the kit's users are told to get it, so a sweep that
// passes also shows fontFromStyle produces a Canvas font each browser measures like it paints.
const fontCache = new Map<string, StyleFont>()
function fontAt(stack: FontStack, px: number, lineHeight: number): StyleFont {
  const key = `${stack.label}|${px}|${lineHeight}`
  let f = fontCache.get(key)
  if (f === undefined) {
    styleProbe(stack, px, lineHeight)
    f = fontFromStyle(getComputedStyle(probe))
    fontCache.set(key, f)
  }
  return f
}

const preparedCache = new Map<string, PreparedTextWithSegments>()
function prepared(text: string, f: StyleFont): PreparedTextWithSegments {
  const key = `${f.font}|${f.letterSpacing}|${text}`
  let p = preparedCache.get(key)
  if (p === undefined) {
    p = prepareWithSegments(text, f.font, { letterSpacing: f.letterSpacing })
    preparedCache.set(key, p)
  }
  return p
}

// Thrown when a painted height is no whole number of lines, so the case is reported instead of
// being judged on a rounded guess.
class Unreliable extends Error {}

// 'floor' means the height is lines × floor(line-height): an engine laying lines on whole pixels.
type Painted = { lines: number, height: number, scrollWidth: number, grid: 'exact' | 'floor' }

function countLines(height: number, lineHeight: number): { lines: number, grid: 'exact' | 'floor' } {
  const exact = Math.round(height / lineHeight)
  if (Math.abs(height - exact * lineHeight) <= GRID) return { lines: exact, grid: 'exact' }
  const whole = Math.floor(lineHeight)
  if (whole > 0) {
    const floored = Math.round(height / whole)
    if (Math.abs(height - floored * whole) <= GRID) return { lines: floored, grid: 'floor' }
  }
  throw new Unreliable(`height ${height} is no whole number of ${lineHeight}px or ${whole}px lines`)
}

function paint(stack: FontStack, text: string, px: number, lineHeight: number, width: number): Painted {
  styleProbe(stack, px, lineHeight)
  probe.style.width = `${width}px`
  if (probe.textContent !== text) probe.textContent = text
  const height = probe.getBoundingClientRect().height
  return { ...countLines(height, lineHeight), height, scrollWidth: probe.scrollWidth }
}

// The widest painted line, from the fragments of each run of non-white-space characters. A
// range over the whole text would include the white space a line ends with, which hangs past the
// line and is not part of its width (as Pretext's widths leave it out). A line can be split into
// several rects (bidi runs, fallback fonts), so its extent runs from its leftmost to rightmost
// fragment; fragments are assigned to a line by their vertical centre, since fallback fonts give
// fragments of one line different tops.
const NON_SPACE = /\S+/g
function widestPaintedLine(lineHeight: number): number {
  const node = probe.firstChild
  if (node === null) return 0
  const text = node.textContent ?? ''
  const range = document.createRange()
  const top = probe.getBoundingClientRect().top
  const extents = new Map<number, { left: number, right: number }>()
  for (const m of text.matchAll(NON_SPACE)) {
    range.setStart(node, m.index)
    range.setEnd(node, m.index + m[0].length)
    for (const r of range.getClientRects()) {
      if (r.width === 0) continue
      const line = Math.floor((r.top + r.height / 2 - top) / lineHeight)
      const e = extents.get(line)
      if (e === undefined) extents.set(line, { left: r.left, right: r.right })
      else {
        e.left = Math.min(e.left, r.left)
        e.right = Math.max(e.right, r.right)
      }
    }
  }
  let widest = 0
  for (const e of extents.values()) widest = Math.max(widest, e.right - e.left)
  return widest
}

// Pretext's own count beside the browser's: where they differ the kit, which only builds on
// Pretext's counts, cannot be judged.
function gapAt(dom: number, model: number, where: string): string | undefined {
  return dom === model ? undefined : `${where}: DOM ${dom} lines, Pretext ${model}`
}

// What the kit should answer by Pretext's own numbers, computed here rather than taken from the
// kit: the widest line rounded up, or one pixel less exactly when Pretext lays out the same lines
// there (a line within Pretext's slack of a whole pixel), capped at the box.
function modelShrinkwrap(p: PreparedTextWithSegments, width: number): number {
  const m = measureLineStats(p, width)
  let w = Math.ceil(m.maxLineWidth)
  if (w - 1 >= 1 && m.maxLineWidth - (w - 1) <= FIT) {
    const t = measureLineStats(p, w - 1)
    if (t.lineCount === m.lineCount && Math.abs(t.maxLineWidth - m.maxLineWidth) < 1e-6) w -= 1
  }
  return Math.min(width, w)
}

// Balance answers at least the widest piece no width breaks (a grapheme, a line at width 0), so the
// box contains it; one pixel narrower is then no claim of minimality, as the kit's contract says.
function holdsWiderPiece(p: PreparedTextWithSegments, width: number): boolean {
  return measureLineStats(p, 0).maxLineWidth > width - 1 + FIT
}

function widthCase(
  helper: 'shrinkwrap' | 'balance',
  stack: FontStack,
  text: string,
  width: number,
): { outcome: Outcome, lines?: number, detail?: string } {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  const p = prepared(text, f)
  const fit = (helper === 'shrinkwrap' ? shrinkwrap : balance)(p, width)
  const said = `returned width ${fit.width} with ${fit.lineCount} lines`

  // The kit against Pretext's own numbers first: any failure here is the kit's, whatever the
  // browser paints, so a kit bug cannot pass as a Pretext gap.
  const modelAtW = layout(p, width, LINE_HEIGHT).lineCount
  const modelAtFit = layout(p, fit.width, LINE_HEIGHT).lineCount
  if (!(fit.width <= width)) return { outcome: 'kit-mismatch', detail: `${said}, wider than the box` }
  if (fit.lineCount !== modelAtW || modelAtFit !== fit.lineCount) {
    return { outcome: 'kit-mismatch', detail: `${said}, Pretext lays out ${modelAtW} lines at ${width}px and ${modelAtFit} there` }
  }
  if (helper === 'shrinkwrap') {
    const want = modelShrinkwrap(p, width)
    if (fit.width !== want) return { outcome: 'kit-mismatch', detail: `${said}, Pretext's widest line gives ${want}` }
  } else if (fit.width > 1 && !holdsWiderPiece(p, fit.width)) {
    const narrower = layout(p, fit.width - 1, LINE_HEIGHT).lineCount
    if (narrower <= fit.lineCount) {
      return { outcome: 'kit-mismatch', detail: `${said}, but Pretext lays out ${narrower} lines at ${fit.width - 1}px` }
    }
  }

  // Then the browser. The kit matched Pretext, so where the painting disagrees it is Pretext's gap.
  const atW = paint(stack, text, FONT_SIZE, LINE_HEIGHT, width)
  const widest = helper === 'shrinkwrap' ? widestPaintedLine(LINE_HEIGHT) : 0
  const gapW = gapAt(atW.lines, modelAtW, 'baseline')
  if (gapW !== undefined) return { outcome: 'pretext-gap', detail: gapW }
  const atFit = paint(stack, text, FONT_SIZE, LINE_HEIGHT, fit.width)
  const gapFit = gapAt(atFit.lines, modelAtFit, `at returned ${fit.width}px`)
  if (gapFit !== undefined) return { outcome: 'pretext-gap', detail: gapFit }

  if (helper === 'shrinkwrap') {
    // Firefox hands app-unit positions back through floats with noise near 1e-5 px; 1/1024 px is
    // far below any engine's layout unit, so it removes the noise without hiding a real overshoot.
    const expected = Math.min(width, Math.ceil(widest - 1 / 1024))
    if (fit.width === expected) return { outcome: 'pass', lines: atFit.lines }
    // Engines let a line overshoot its box by a sliver (Chromium 1/128 px, WebKit 1/64 px seen
    // here), so a line painted just past a pixel can still sit at that pixel. The answer is then
    // right exactly when the browser paints the identical layout there: the same lines and the
    // same widest line.
    if (fit.width === expected - 1 && Math.abs(widestPaintedLine(LINE_HEIGHT) - widest) <= 1 / 1024) {
      return { outcome: 'pass', lines: atFit.lines }
    }
    const modelWidest = measureLineStats(p, width).maxLineWidth
    return {
      outcome: 'pretext-gap',
      lines: atFit.lines,
      detail: `widest line: DOM ${widest}px (wants ${expected}), Pretext ${modelWidest}px (gave ${fit.width})`,
    }
  }
  if (fit.width > 1 && !holdsWiderPiece(p, fit.width)) {
    // Balance's claim is minimality: one pixel narrower must cost a line in the browser too.
    const narrower = paint(stack, text, FONT_SIZE, LINE_HEIGHT, fit.width - 1)
    if (narrower.lines <= fit.lineCount) {
      return { outcome: 'pretext-gap', lines: atFit.lines, detail: `at ${fit.width - 1}px: DOM ${narrower.lines} lines, Pretext ${layout(p, fit.width - 1, LINE_HEIGHT).lineCount}` }
    }
  }
  return { outcome: 'pass', lines: atFit.lines }
}

type SizeCheck = { fits: boolean, gap?: string, painted: Painted, widest?: number }

// Judges one size the way the box would: the painted height and any horizontal overflow decide
// the fit. Pretext's count at that size must match the painting, or the kit's answer was built
// on a wrong count and the case is Pretext's gap rather than the kit's.
function checkSize(stack: FontStack, text: string, px: number, width: number): SizeCheck {
  const lh = px * FIT_LINE_HEIGHT_RATIO
  const f = fontAt(stack, px, lh)
  const painted = paint(stack, text, px, lh, width)
  let fits = painted.height <= FIT_HEIGHT && painted.scrollWidth <= width
  // Where Pretext lays out a line it reports past the width (and the kit admits it, as no piece
  // overflows), scrollWidth, a whole pixel, cannot show a sliver of overrun: the painted lines
  // themselves must fit, measured to the fraction.
  let widest: number | undefined
  if (measureLineStats(prepared(text, f), width).maxLineWidth > width + FIT) {
    widest = widestPaintedLine(lh)
    fits = fits && widest <= width + FIT
  }
  const gap = gapAt(painted.lines, layout(prepared(text, f), width, lh).lineCount, `at ${px}px`)
  const check: SizeCheck = { fits, painted }
  if (widest !== undefined) check.widest = widest
  if (gap !== undefined) check.gap = gap
  return check
}

// Reports the painted per-line height beside the CSS one, since an engine that snaps line boxes
// paints a different height from lines × line-height, and that is the first thing to rule out.
function describe(px: number, c: SizeCheck, width: number): string {
  const lh = px * FIT_LINE_HEIGHT_RATIO
  const perLine = c.painted.lines > 0 ? c.painted.height / c.painted.lines : 0
  const overflow = (c.painted.scrollWidth > width ? `, scrollWidth ${c.painted.scrollWidth}` : '')
    + (c.widest !== undefined ? `, widest painted line ${c.widest}` : '')
  return `${px}px paints ${c.painted.lines} lines × ${perLine} (CSS line-height ${lh}) = ${c.painted.height}${overflow}`
}

const sizesCache = new Map<string, ReturnType<typeof prepareSizes>>()

type Verdict = {
  outcome: Outcome
  lines?: number
  detail?: string
  // The size whose painting contradicted the kit, kept so a mismatch can be attributed.
  evidence?: { px: number, check: SizeCheck }
}

// The kit is judged against Pretext's own numbers first, with the box's rule from the kit's
// contract: fits means no line overflows the width and lines × line height within the height. A
// line overflows only where Pretext could not break it: every line within the width (Pretext's
// slack included), or else no unbreakable piece (a line at width 0) wider than the width, since
// Pretext keeps a line ending at a soft hyphen whose syllables measure narrower joined than apart
// and reports it at its width apart. A failure here is the kit's whatever the browser paints, so
// no kit bug can pass as a Pretext gap.
function judgeModel(
  result: FitResult | null,
  stack: FontStack,
  text: string,
  width: number,
  lhOf: (px: number) => number,
): Verdict | undefined {
  const modelFits = (px: number): boolean => {
    const p = prepared(text, fontAt(stack, px, px * FIT_LINE_HEIGHT_RATIO))
    const s = measureLineStats(p, width)
    const overflows = s.maxLineWidth > width + FIT && measureLineStats(p, 0).maxLineWidth > width + FIT
    return !overflows && s.lineCount * lhOf(px) <= FIT_HEIGHT
  }
  if (result === null) {
    return modelFits(FIT_MIN) ? { outcome: 'kit-mismatch', detail: `null, but Pretext fits ${FIT_MIN}px` } : undefined
  }
  const px = result.px
  const said = `returned ${px}px with ${result.lineCount} lines`
  const model = layout(prepared(text, fontAt(stack, px, px * FIT_LINE_HEIGHT_RATIO)), width, lhOf(px)).lineCount
  const handle = layout(result.prepared, width, lhOf(px)).lineCount
  if (result.lineCount !== model || handle !== model) {
    return { outcome: 'kit-mismatch', detail: `${said}, its handle lays out ${handle}, Pretext ${model}` }
  }
  if (!modelFits(px)) return { outcome: 'kit-mismatch', detail: `${said}, which Pretext does not fit` }
  if (px < FIT_MAX && modelFits(px + 1)) return { outcome: 'kit-mismatch', detail: `${said}, but Pretext fits ${px + 1}px` }
  return undefined
}

// Then the browser: the kit agreed with Pretext, so a line count the DOM paints differently is
// Pretext's gap, and a fit the DOM judges differently with the same count is attributed below.
function judgeDom(result: FitResult | null, stack: FontStack, text: string, width: number): Verdict {
  if (result === null) {
    const at = checkSize(stack, text, FIT_MIN, width)
    if (at.gap !== undefined) return { outcome: 'pretext-gap', detail: `null, ${at.gap}` }
    if (!at.fits) return { outcome: 'pass', lines: at.painted.lines }
    return { outcome: 'kit-mismatch', lines: at.painted.lines, detail: `null, but ${describe(FIT_MIN, at, width)}`, evidence: { px: FIT_MIN, check: at } }
  }
  const at = checkSize(stack, text, result.px, width)
  if (at.gap !== undefined) return { outcome: 'pretext-gap', detail: `returned ${result.px}px, ${at.gap}` }
  const lines = at.painted.lines
  if (!at.fits) {
    return { outcome: 'kit-mismatch', lines, detail: `returned ${result.px}px, but ${describe(result.px, at, width)}`, evidence: { px: result.px, check: at } }
  }
  if (result.px < FIT_MAX) {
    const next = checkSize(stack, text, result.px + 1, width)
    if (next.gap !== undefined) return { outcome: 'pretext-gap', detail: `returned ${result.px}px, ${next.gap}` }
    if (next.fits) {
      return {
        outcome: 'kit-mismatch',
        lines,
        detail: `returned ${result.px}px, but ${describe(result.px + 1, next, width)} and fits`,
        evidence: { px: result.px + 1, check: next },
      }
    }
  }
  return { outcome: 'pass', lines }
}

function fitCase(stack: FontStack, text: string, width: number): Verdict & { cause?: string } {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  // Prepared once per text and font and reused across widths, as the kit intends.
  const key = `${stack.label}|${text}`
  let sizes = sizesCache.get(key)
  if (sizes === undefined) {
    const lhOf = (px: number): number => px * FIT_LINE_HEIGHT_RATIO
    sizes = prepareSizes(text, px => fontAt(stack, px, lhOf(px)).font, { min: FIT_MIN, max: FIT_MAX }, {
      letterSpacing: f.letterSpacing,
    })
    sizesCache.set(key, sizes)
  }
  const box = { width, height: FIT_HEIGHT }
  const lineHeight = (px: number): number => fontAt(stack, px, px * FIT_LINE_HEIGHT_RATIO).lineHeight
  const result = fitFontSize(sizes, box, lineHeight)
  const wrong = judgeModel(result, stack, text, width, lineHeight)
  if (wrong !== undefined) return wrong

  const atW = paint(stack, text, FONT_SIZE, LINE_HEIGHT, width)
  const gap = gapAt(atW.lines, layout(prepared(text, f), width, LINE_HEIGHT).lineCount, 'baseline')
  if (gap !== undefined) return { outcome: 'pretext-gap', detail: gap }
  const v = judgeDom(result, stack, text, width)
  if (v.outcome !== 'kit-mismatch' || v.evidence === undefined || window.sweepBrowser !== 'webkit') return v

  // Safari 26 lays line boxes out at whole pixels (Pretext's PLATFORM_BUGS.md). A mismatch is put
  // down to that only when all three hold for this case: the line height is fractional, the
  // contradicting painting is exactly lines × its floor, and the kit's answer, recomputed with
  // floored line heights, passes the same judgement. Anything less stays a kit-mismatch.
  const { px, check } = v.evidence
  const lh = lineHeight(px)
  if (Number.isInteger(lh) || check.painted.grid !== 'floor') return v
  const flooredLh = (p: number): number => Math.floor(lineHeight(p))
  const floored = fitFontSize(sizes, box, flooredLh)
  if (judgeModel(floored, stack, text, width, flooredLh) !== undefined) return v
  if (judgeDom(floored, stack, text, width).outcome !== 'pass') return v
  return { ...v, outcome: 'platform', cause: WEBKIT_LINE_HEIGHT_FLOOR }
}

// ---- fitFontSizeRich: an icon and its label scaling together ----

// Sizes 8-32 with whole-px line heights, so the WebKit 26 floor (a fractional line height) has
// nothing to act on here. The height box holds three lines of the sweep's base 16px/24px text, so it
// is fixed across the sizes searched, as a real box is. Three times each size's own line height would
// make it the same test as maxLines 3.
const RICH_MIN = 8
const RICH_MAX = 32
const RICH_HEIGHT = 3 * LINE_HEIGHT
type RichBox = { width: number, maxLines?: number, height?: number }
const RICH_BOXES: { name: string, of: (width: number) => RichBox }[] = [
  { name: 'maxLines 1', of: width => ({ width, maxLines: 1 }) },
  { name: `height ${RICH_HEIGHT}`, of: width => ({ width, height: RICH_HEIGHT }) },
]
const richLh = (px: number): number => Math.round(px * 1.5)
const iconWidth = (px: number): number => Math.round(px * 1.25)
const iconGap = (px: number): number => Math.round(px * 0.5)

const rich = document.getElementById('rich') as HTMLDivElement
const richIcon = document.getElementById('rich-icon') as HTMLSpanElement
const richLabel = document.getElementById('rich-label') as HTMLSpanElement

// The row as the kit is handed it and as the harness measures it: the icon's box, then the label
// with its gap as extraWidth, in the font computed style gives at that size. The kit and the model
// judge share this row, so a bug here (a width or font that does not match what paintRich paints)
// cannot show as a kit-mismatch: Pretext's count then disagrees with the painting, a pretext-gap.
function richRow(stack: FontStack, text: string, px: number): Array<RichInlineItem | RichInlineBox> {
  const f = fontAt(stack, px, richLh(px))
  return [{ width: iconWidth(px) }, { text, font: f.font, letterSpacing: f.letterSpacing, extraWidth: iconGap(px) }]
}

// Pretext's own preparation of the row, made here and never taken from the kit.
const richCache = new Map<string, { p: PreparedRichInline, unit: number }>()
function richModel(stack: FontStack, text: string, px: number): { p: PreparedRichInline, unit: number } {
  const key = `${stack.label}|${px}|${text}`
  let m = richCache.get(key)
  if (m === undefined) {
    const p = prepareRichInline(richRow(stack, text, px))
    // The widest piece no width breaks: the row laid out at width 0.
    m = { p, unit: measureRichInlineStats(p, 0).maxLineWidth }
    richCache.set(key, m)
  }
  return m
}

function paintRich(stack: FontStack, text: string, px: number, width: number): Painted {
  const lh = richLh(px)
  styleEl(rich, stack, px, lh)
  rich.style.width = `${width}px`
  richIcon.style.width = `${iconWidth(px)}px`
  richIcon.style.height = `${px}px`
  richLabel.style.marginLeft = `${iconGap(px)}px`
  if (richLabel.textContent !== text) richLabel.textContent = text
  const height = rich.getBoundingClientRect().height
  return { ...countLines(height, lh), height, scrollWidth: rich.scrollWidth }
}

// The widest painted line of the row, measured from the container's left edge (the row is left to
// right and every line starts there: the icon on the first, the cloned margin on the rest) to the
// rightmost fragment of the icon or of a non-white-space run on that line. Fragments are assigned to
// lines by their vertical centre.
function widestPaintedRow(lh: number): number {
  const box = rich.getBoundingClientRect()
  const right = new Map<number, number>()
  const add = (r: DOMRect): void => {
    if (r.width === 0) return
    const line = Math.floor((r.top + r.height / 2 - box.top) / lh)
    right.set(line, Math.max(right.get(line) ?? -Infinity, r.right))
  }
  add(richIcon.getBoundingClientRect())
  const node = richLabel.firstChild
  if (node !== null) {
    const text = node.textContent ?? ''
    const range = document.createRange()
    for (const m of text.matchAll(NON_SPACE)) {
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      for (const r of range.getClientRects()) add(r)
    }
  }
  let widest = 0
  for (const r of right.values()) widest = Math.max(widest, r - box.left)
  return widest
}

// The kit's "fits", mirrored from Pretext's numbers: no line overflows (every line within W + 1/64,
// or no unbreakable piece wider than that) and the line count within the box.
function richModelFits(stack: FontStack, text: string, px: number, box: RichBox): boolean {
  const { p, unit } = richModel(stack, text, px)
  const s = measureRichInlineStats(p, box.width)
  if (s.maxLineWidth > box.width + FIT && unit > box.width + FIT) return false
  if (box.maxLines !== undefined && s.lineCount > box.maxLines) return false
  if (box.height !== undefined && s.lineCount * richLh(px) > box.height) return false
  return true
}

function judgeRichModel(result: FitResultRich | null, stack: FontStack, text: string, box: RichBox): Verdict | undefined {
  if (result === null) {
    return richModelFits(stack, text, RICH_MIN, box) ? { outcome: 'kit-mismatch', detail: `null, but Pretext fits ${RICH_MIN}px` } : undefined
  }
  const px = result.px
  const said = `returned ${px}px with ${result.lineCount} lines`
  if (!Number.isInteger(px) || px < RICH_MIN || px > RICH_MAX) return { outcome: 'kit-mismatch', detail: `${said}, outside ${RICH_MIN}-${RICH_MAX}` }
  const model = measureRichInlineStats(richModel(stack, text, px).p, box.width).lineCount
  const handle = measureRichInlineStats(result.prepared, box.width).lineCount
  if (result.lineCount !== model || handle !== model) {
    return { outcome: 'kit-mismatch', detail: `${said}, its handle lays out ${handle}, Pretext ${model}` }
  }
  if (!richModelFits(stack, text, px, box)) return { outcome: 'kit-mismatch', detail: `${said}, which Pretext does not fit` }
  if (px < RICH_MAX && richModelFits(stack, text, px + 1, box)) return { outcome: 'kit-mismatch', detail: `${said}, but Pretext fits ${px + 1}px` }
  return undefined
}

// The painted row at one size judged as the box would judge it, with Pretext's count beside it.
function checkRich(stack: FontStack, text: string, px: number, box: RichBox): SizeCheck {
  const lh = richLh(px)
  const painted = paintRich(stack, text, px, box.width)
  let fits = painted.scrollWidth <= box.width
  if (box.maxLines !== undefined) fits = fits && painted.lines <= box.maxLines
  if (box.height !== undefined) fits = fits && painted.height <= box.height
  const { p } = richModel(stack, text, px)
  const s = measureRichInlineStats(p, box.width)
  let widest: number | undefined
  if (s.maxLineWidth > box.width + FIT) {
    widest = widestPaintedRow(lh)
    fits = fits && widest <= box.width + FIT
  }
  const check: SizeCheck = { fits, painted }
  if (widest !== undefined) check.widest = widest
  const gap = gapAt(painted.lines, s.lineCount, `at ${px}px`)
  if (gap !== undefined) check.gap = gap
  return check
}

function describeRich(px: number, c: SizeCheck, width: number): string {
  const overflow = (c.painted.scrollWidth > width ? `, scrollWidth ${c.painted.scrollWidth}` : '')
    + (c.widest !== undefined ? `, widest painted line ${c.widest}` : '')
  return `${px}px paints ${c.painted.lines} lines of ${richLh(px)} = ${c.painted.height}${overflow}`
}

function judgeRichDom(result: FitResultRich | null, stack: FontStack, text: string, box: RichBox): Verdict {
  if (result === null) {
    const at = checkRich(stack, text, RICH_MIN, box)
    if (at.gap !== undefined) return { outcome: 'pretext-gap', detail: `null, ${at.gap}` }
    if (!at.fits) return { outcome: 'pass', lines: at.painted.lines }
    return { outcome: 'kit-mismatch', lines: at.painted.lines, detail: `null, but ${describeRich(RICH_MIN, at, box.width)}` }
  }
  const at = checkRich(stack, text, result.px, box)
  if (at.gap !== undefined) return { outcome: 'pretext-gap', detail: `returned ${result.px}px, ${at.gap}` }
  const lines = at.painted.lines
  if (!at.fits) return { outcome: 'kit-mismatch', lines, detail: `returned ${result.px}px, but ${describeRich(result.px, at, box.width)}` }
  if (result.px < RICH_MAX) {
    const next = checkRich(stack, text, result.px + 1, box)
    if (next.gap !== undefined) return { outcome: 'pretext-gap', detail: `returned ${result.px}px, ${next.gap}` }
    if (next.fits) return { outcome: 'kit-mismatch', lines, detail: `returned ${result.px}px, but ${describeRich(result.px + 1, next, box.width)} and fits` }
  }
  return { outcome: 'pass', lines }
}

const richSizesCache = new Map<string, PreparedSizesRich>()
function richCase(stack: FontStack, text: string, box: RichBox): Verdict {
  // Prepared once per text and font and reused across widths and boxes, as the kit intends.
  const key = `${stack.label}|${text}`
  let sizes = richSizesCache.get(key)
  if (sizes === undefined) {
    sizes = prepareSizesRich(px => richRow(stack, text, px), { min: RICH_MIN, max: RICH_MAX })
    richSizesCache.set(key, sizes)
  }
  const lineHeight = (px: number): number => fontAt(stack, px, richLh(px)).lineHeight
  const result = fitFontSizeRich(sizes, box, lineHeight)
  return judgeRichModel(result, stack, text, box) ?? judgeRichDom(result, stack, text, box)
}

// ---- clamp and truncateMiddle ----

type CaseVerdict = { outcome: Outcome, lines?: number, detail?: string, cause?: string }

const START: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
function graphemeCount(text: string): number {
  let n = 0
  for (const _ of graphemes.segment(text)) n++
  return n
}
function firstGrapheme(text: string): string {
  for (const g of graphemes.segment(text)) return g.segment
  return ''
}

// Pretext's width of a text set alone on one line, in the case's font.
function naturalWidth(text: string, f: StyleFont): number {
  return measureNaturalWidth(prepared(text, f))
}
// The same for texts that occur once (cuts with their tail), kept out of the prepared cache.
function joinedWidth(text: string, f: StyleFont): number {
  return measureNaturalWidth(prepareWithSegments(text, f.font, { letterSpacing: f.letterSpacing }))
}

// The text a cut could have kept one grapheme more of: the next grapheme of `rest`, with the
// white space before it, since a cut that ends at a space would add the space and a grapheme.
// Undefined when nothing visible follows.
function oneMore(rest: string): string | undefined {
  const m = /^\s*/.exec(rest)!
  const after = rest.slice(m[0].length)
  if (after === '') return undefined
  return m[0] + firstGrapheme(after)
}

// What a painted line measures: the text in a white-space: pre span, so it neither wraps nor
// collapses, read from its box. Widths repeat across widths and maxLines, so they are cached.
const spanCache = new Map<string, number>()
function paintedWidth(stack: FontStack, text: string): number {
  const key = `${stack.label}|${text}`
  let w = spanCache.get(key)
  if (w === undefined) {
    styleEl(lineSpan, stack, FONT_SIZE, LINE_HEIGHT)
    lineSpan.textContent = text
    w = lineSpan.getBoundingClientRect().width
    spanCache.set(key, w)
  }
  return w
}

type ClampPaint = { lines: number, height: number, truncated: boolean, scrollHeight: number, clientHeight: number }
function paintClamp(stack: FontStack, text: string, width: number, maxLines: number): ClampPaint {
  styleEl(clampBox, stack, FONT_SIZE, LINE_HEIGHT)
  clampBox.style.width = `${width}px`
  clampBox.style.webkitLineClamp = String(maxLines)
  if (clampBox.textContent !== text) clampBox.textContent = text
  const height = clampBox.getBoundingClientRect().height
  const { scrollHeight, clientHeight } = clampBox
  return { ...countLines(height, LINE_HEIGHT), height, truncated: scrollHeight > clientHeight, scrollHeight, clientHeight }
}

const tailCache = new Map<string, Tail>()
function tailOf(f: StyleFont): Tail {
  let t = tailCache.get(f.font)
  if (t === undefined) {
    // With the paragraph's own prepare options, so the cut is measured as the paragraph is.
    t = measureTail(ELLIPSIS, f.font, { letterSpacing: f.letterSpacing })
    tailCache.set(f.font, t)
  }
  return t
}

// clamp by Pretext's own numbers, every one computed here from Pretext rather than by the kit.
function judgeClampModel(p: PreparedTextWithSegments, f: StyleFont, width: number, maxLines: number, tail: Tail, c: Clamped): string | undefined {
  // The tail is the kit's measurement too, so it is checked against Pretext's widths first.
  const ellipsis = naturalWidth(ELLIPSIS, f)
  const nbsp = naturalWidth('\u00A0', f)
  if (tail.text !== ELLIPSIS || tail.font !== f.font || tail.options?.letterSpacing !== f.letterSpacing || tail.width !== ellipsis || tail.spaceWidth !== nbsp) {
    return `measureTail gave ${JSON.stringify(tail)}, Pretext measures '…' ${ellipsis} and a no-break space ${nbsp}`
  }
  const total = layout(p, width, LINE_HEIGHT).lineCount
  const said = `returned ${c.lineCount} lines, truncated ${c.truncated}`
  if (c.lineCount !== Math.min(total, maxLines) || c.truncated !== total > maxLines || c.lines.length !== c.lineCount) {
    return `${said} (${c.lines.length} built), Pretext lays out ${total} lines`
  }
  const stats = clampStats(p, width, maxLines)
  if (stats.truncated !== c.truncated || stats.lineCount !== c.lineCount) {
    return `clampStats gave ${JSON.stringify(stats)}, clamp ${said}`
  }
  let cursor = START
  for (let i = 0; i < c.lines.length; i++) {
    const full = layoutNextLine(p, cursor, width)
    if (full === null) return `line ${i + 1}: Pretext has no line there`
    const got = c.lines[i]!
    const isCut = c.truncated && i === c.lines.length - 1
    if (!isCut) {
      if (got.text.trimEnd() !== full.text.trimEnd()) return `line ${i + 1} is ${JSON.stringify(got.text)}, Pretext's is ${JSON.stringify(full.text)}`
      cursor = full.end
      continue
    }
    if (graphemeCount(got.text) < 1) return `the last line is empty, Pretext's is ${JSON.stringify(full.text)}`
    // The cut and its tail are judged as the one text they paint as, never by the kit's own width.
    const wholeWithTail = joinedWidth(full.text.trimEnd() + ELLIPSIS, f)
    if (wholeWithTail <= width + FIT) {
      if (got.text.trimEnd() !== full.text.trimEnd()) {
        return `Pretext's last line with its tail ${JSON.stringify(full.text.trimEnd() + ELLIPSIS)} is ${wholeWithTail} wide and fits, but the kit cut it to ${JSON.stringify(got.text)}`
      }
      continue
    }
    if (!full.text.startsWith(got.text)) {
      return `the last line ${JSON.stringify(got.text)} is no prefix of Pretext's ${JSON.stringify(full.text)}`
    }
    const cutWithTail = joinedWidth(got.text + ELLIPSIS, f)
    // A single kept grapheme may overrun: there is nothing left to cut.
    const lone = graphemeCount(got.text) === 1
    if (!lone && cutWithTail > width + FIT) {
      return `the last line with its tail ${JSON.stringify(got.text + ELLIPSIS)} is ${cutWithTail} wide and overruns ${width}`
    }
    // And it is the longest such cut: one more grapheme (a discretionary hyphen is none) would not fit.
    const endsAtSoftHyphen = full.end.graphemeIndex === 0 && p.kinds[full.end.segmentIndex - 1] === 'soft-hyphen'
    const rest = full.text.slice(got.text.length)
    const more = endsAtSoftHyphen && rest === '-' ? undefined : oneMore(endsAtSoftHyphen ? rest.replace(/-$/, '') : rest)
    if (more !== undefined) {
      const longer = joinedWidth(got.text + more + ELLIPSIS, f)
      if (longer <= width + FIT) {
        return `the cut ${JSON.stringify(got.text)} stops short: ${JSON.stringify(got.text + more + ELLIPSIS)} is ${longer} wide and fits ${width}`
      }
    }
  }
  return undefined
}

function clampCase(stack: FontStack, text: string, width: number, maxLines: number): CaseVerdict {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  const p = prepared(text, f)
  const tail = tailOf(f)
  const c = clamp(p, width, maxLines, tail)
  const wrong = judgeClampModel(p, f, width, maxLines, tail, c)
  if (wrong !== undefined) return { outcome: 'kit-mismatch', detail: wrong }

  // Then the browser: what it truncates and how tall the clamped box is, then each line as painted.
  const box = paintClamp(stack, text, width, maxLines)
  if (box.truncated !== c.truncated || box.lines !== c.lineCount) {
    const unclamped = paint(stack, text, FONT_SIZE, LINE_HEIGHT, width).lines
    return {
      outcome: 'pretext-gap',
      lines: box.lines,
      detail: `DOM clamps to ${box.lines} lines (truncated ${box.truncated}: scrollHeight ${box.scrollHeight}, clientHeight ${box.clientHeight}; ${unclamped} unclamped), `
        + `Pretext ${c.lineCount} (truncated ${c.truncated}; ${layout(p, width, LINE_HEIGHT).lineCount} unclamped)`,
    }
  }
  for (let i = 0; i < c.lines.length; i++) {
    const line = c.lines[i]!
    const isCut = c.truncated && i === c.lines.length - 1
    // A full line's trailing space hangs past the box, so only the cut line keeps what it ends with.
    const shown = isCut ? line.text + ELLIPSIS : line.text.trimEnd()
    const dom = paintedWidth(stack, shown)
    if (dom <= width + FIT) continue
    // A cut line is reported as the one text it paints as; a full line by Pretext's own width.
    const model = isCut ? joinedWidth(shown, f) : line.width
    if (isCut && graphemeCount(line.text) === 1 && model > width + FIT) continue
    return {
      outcome: 'pretext-gap',
      lines: box.lines,
      detail: `line ${i + 1} ${JSON.stringify(shown)} paints ${dom}px, Pretext ${model}px, box ${width}px`,
    }
  }
  return { outcome: 'pass', lines: box.lines }
}

const labelCache = new Map<string, PreparedLabel>()
function labelOf(text: string, f: StyleFont): PreparedLabel {
  const key = `${f.font}|${text}`
  let l = labelCache.get(key)
  if (l === undefined) {
    l = prepareLabel(text, f.font)
    labelCache.set(key, l)
  }
  return l
}

// Pretext's line text leaves soft hyphens out (they show only as a line-end hyphen), and so does
// what the kit builds from it; the label is compared without them. No label holds one.
const SOFT_HYPHEN = /\u00AD/g

function truncateMiddleCase(stack: FontStack, text: string, width: number): CaseVerdict {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  const from = text.lastIndexOf('/')
  const keepEnd = from >= 0 ? { from } : undefined
  const out = truncateMiddle(labelOf(text, f), width, keepEnd)
  const said = `returned ${JSON.stringify(out)}`

  // By Pretext's numbers first.
  const whole = naturalWidth(text, f)
  if (whole <= width) {
    return out === text ? { outcome: 'pass' } : { outcome: 'kit-mismatch', detail: `${said}, but the whole label is ${whole} wide` }
  }
  const plain = text.replace(SOFT_HYPHEN, '')
  const cut = out.replace(SOFT_HYPHEN, '')
  const at = cut.indexOf(ELLIPSIS)
  if (out === text || at < 0) return { outcome: 'kit-mismatch', detail: `${said}, but the whole label is ${whole} wide` }
  const head = cut.slice(0, at)
  const tail = cut.slice(at + ELLIPSIS.length)
  if (!plain.startsWith(head) || !plain.endsWith(tail) || head.length + tail.length >= plain.length) {
    return { outcome: 'kit-mismatch', detail: `${said}: not a start, '…' and an end of the label` }
  }
  const outWidth = naturalWidth(out, f)
  if (outWidth > width + FIT) return { outcome: 'kit-mismatch', detail: `${said}, ${outWidth} wide` }
  // The start is the longest that fits before this end: one grapheme more would not.
  const more = oneMore(plain.slice(head.length))
  if (more !== undefined && head.length + more.length <= plain.length - tail.length) {
    const longer = head + more + ELLIPSIS + tail
    const longerWidth = joinedWidth(longer, f)
    if (longerWidth <= width + FIT) return { outcome: 'kit-mismatch', detail: `${said}, but ${JSON.stringify(longer)} is ${longerWidth} wide and fits` }
  }
  // The shortest result that keeps the name: one grapheme, the ellipsis and the name, measured
  // as the one text it would be, as the result's own width is.
  const name = from >= 0 ? text.slice(from) : ''
  const shortest = firstGrapheme(text) + ELLIPSIS + name
  const shortestWidth = naturalWidth(shortest, f)
  if (from >= 0 && shortestWidth <= width + FIT && tail.length < name.length) {
    return { outcome: 'kit-mismatch', detail: `${said}, but ${JSON.stringify(shortest)} is ${shortestWidth} wide and fits` }
  }

  // Then the painting.
  const dom = paintedWidth(stack, out)
  if (dom > width + FIT) return { outcome: 'pretext-gap', detail: `${said} paints ${dom}px, Pretext ${outWidth}px, box ${width}px` }
  if (from >= 0 && tail.length < name.length) {
    const domShortest = paintedWidth(stack, shortest)
    if (domShortest <= width + FIT) {
      return { outcome: 'pretext-gap', detail: `${said}, but ${JSON.stringify(shortest)} paints ${domShortest}px in ${width}px, Pretext ${shortestWidth}px` }
    }
  }
  return { outcome: 'pass' }
}

// fontFromStyle is what every other case's font comes from, so a wrong font would show up only
// as Pretext gaps; it is checked directly against what the pinned style says it should be.
// Canvas normalises a font string, so both sides go through one context to be compared.
const canvas = document.createElement('canvas').getContext('2d')!
function canonicalFont(font: string): string | undefined {
  canvas.font = '1px sweep-sentinel'
  canvas.font = font
  return canvas.font === '1px sweep-sentinel' ? undefined : canvas.font
}

function fontFromStyleCases(): CaseResult[] {
  const out: CaseResult[] = []
  const styles: [number, number][] = [[FONT_SIZE, LINE_HEIGHT]]
  for (let px = FIT_MIN; px <= FIT_MAX; px++) styles.push([px, px * FIT_LINE_HEIGHT_RATIO])
  for (const stack of FONT_STACKS) {
    for (const [px, lh] of styles) {
      styleProbe(stack, px, lh)
      const got = fontFromStyle(getComputedStyle(probe))
      // Built from the pinned values in sweep.html and the stack as written, not from computed style.
      const expected = { font: `400 ${px}px ${stack.family}`, letterSpacing: 0, lineHeight: lh }
      const gotFont = canonicalFont(got.font)
      const wantFont = canonicalFont(expected.font)
      const ok = gotFont !== undefined && gotFont === wantFont
        && got.letterSpacing === expected.letterSpacing && got.lineHeight === expected.lineHeight
      const base = { helper: 'fontFromStyle', corpus: '-', font: stack.label, width: px }
      out.push(ok ? { ...base, outcome: 'pass' } : {
        ...base,
        outcome: 'kit-mismatch',
        detail: `${px}px/${lh}px: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
      })
    }
  }
  return out
}

// Named families only: a generic's width says nothing. A family is present when text set in it
// measures differently from the same text in a generic fallback; two fallbacks guard against a
// family that happens to match one of them. The string mixes the scripts the stacks are named for.
const PRESENCE_TEXT = 'mmmmmmmmmmlli WQ 中文字体排版 日本語のかな العربية'
window.fontPresence = async (): Promise<FontPresence[]> => {
  await document.fonts.ready
  const families = new Set<string>()
  for (const stack of FONT_STACKS) {
    for (const part of stack.family.split(',')) {
      const name = part.trim()
      if (!['serif', 'sans-serif', 'monospace'].includes(name)) families.add(name)
    }
  }
  const out: FontPresence[] = []
  for (const family of families) {
    let present = false
    for (const generic of ['monospace', 'serif']) {
      canvas.font = `32px ${generic}`
      const fallback = canvas.measureText(PRESENCE_TEXT).width
      canvas.font = `32px ${family}, ${generic}`
      if (canvas.measureText(PRESENCE_TEXT).width !== fallback) present = true
    }
    out.push({ family: family.replace(/"/g, ''), present })
  }
  return out
}

// truncateMiddle sweeps the labels it is for, and the soft-hyphenated corpora as every helper does.
const MIDDLE_CORPORA = [LABELS, ...CORPORA.filter(c => c.name === 'german' || c.name === 'french')]

// fitFontSizeRich sweeps the left-to-right corpora an icon row holds, and real UI labels.
const RICH_CORPORA = [...CORPORA.filter(c => ['latin', 'german', 'french', 'emoji-chat'].includes(c.name)), UI_LABELS]

const corporaFor = (helper: Helper) => helper === 'truncateMiddle' ? MIDDLE_CORPORA
  : helper === 'fitFontSizeRich' ? RICH_CORPORA
  : helper === 'fontFromStyle' ? [] : CORPORA
window.sweepCorpora = (helper: Helper): string[] => corporaFor(helper).map(c => c.name)

window.sweep = async (helper: Helper, only?: string): Promise<CaseResult[]> => {
  await document.fonts.ready
  if (helper === 'fontFromStyle') return fontFromStyleCases()
  const step = window.sweepWidthStep[helper] ?? 1
  const ws = helper === 'truncateMiddle' ? widths(step, LABEL_WIDTH_MIN, LABEL_WIDTH_MAX) : widths(step)
  const maxLinesList = helper === 'clamp' ? Array.from({ length: CLAMP_MAX_LINES }, (_, i) => i + 1) : [undefined]
  const boxes = helper === 'fitFontSizeRich' ? RICH_BOXES : [undefined]
  const out: CaseResult[] = []
  for (const corpus of corporaFor(helper).filter(c => only === undefined || c.name === only)) {
    for (const stack of FONT_STACKS) {
      for (const { label, text } of corpus.texts) {
        for (const maxLines of maxLinesList) for (const box of boxes) {
          for (const w of ws) {
            const base: CaseResult = { helper, corpus: corpus.name, font: stack.label, width: w, outcome: 'pass' }
            if (maxLines !== undefined) base.maxLines = maxLines
            if (box !== undefined) base.box = box.name
            let v: CaseVerdict
            try {
              if (helper === 'fitFontSize') v = fitCase(stack, text, w)
              else if (helper === 'fitFontSizeRich') v = richCase(stack, text, box!.of(w))
              else if (helper === 'clamp') v = clampCase(stack, text, w, maxLines!)
              else if (helper === 'truncateMiddle') v = truncateMiddleCase(stack, text, w)
              else v = widthCase(helper, stack, text, w)
            } catch (e) {
              if (!(e instanceof Unreliable)) throw e
              v = { outcome: 'unreliable', detail: e.message }
            }
            const r: CaseResult = { ...base, outcome: v.outcome }
            if (v.lines !== undefined) r.lines = v.lines
            // Every non-pass case names its text first, so listings can group by it.
            if (v.detail !== undefined) r.detail = `${label}: ${v.detail}`
            if (v.cause !== undefined) r.cause = v.cause
            out.push(r)
          }
        }
        // Yield between texts so a headed browser stays responsive and does not flag the page as hung.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
  }
  return out
}

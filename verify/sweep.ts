import { layout, measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import { balance, FIT_TOLERANCE, fitFontSize, fontFromStyle, prepareSizes, shrinkwrap } from '../src/index.ts'
import type { FitResult, StyleFont } from '../src/index.ts'
import { CORPORA, FONT_SIZE, FONT_STACKS, LINE_HEIGHT, widths } from './corpora.ts'
import type { FontStack } from './corpora.ts'
import { WEBKIT_LINE_HEIGHT_FLOOR } from './causes.ts'

export type Helper = 'shrinkwrap' | 'balance' | 'fitFontSize' | 'fontFromStyle' | 'clamp' | 'truncateMiddle'
// 'platform' is a case the kit got wrong only because the browser paints something its CSS does
// not say, with the mechanism proven for that case; cause names the mechanism. 'unreliable' is a
// case whose painted height matched no line count, so the sweep could not count lines at all.
export type Outcome = 'pass' | 'pretext-gap' | 'kit-mismatch' | 'platform' | 'unreliable'
export type CaseResult = {
  helper: string
  corpus: string
  font: string
  width: number
  lines?: number
  outcome: Outcome
  detail?: string
  cause?: string
}
export type FontPresence = { family: string, present: boolean }

declare global {
  interface Window {
    sweep: (helper: Helper) => Promise<CaseResult[]>
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

// Step 1 everywhere unless a run overrides it; run.ts sets this when a browser is too slow at step 1.
window.sweepWidthStep = { shrinkwrap: 1, balance: 1, fitFontSize: 1 }
window.sweepBrowser = ''

const probe = document.getElementById('probe') as HTMLDivElement

// Only what varies per case is set here; sweep.html pins every other property Pretext models,
// so nothing inherited separates what is painted from what was measured.
function styleProbe(stack: FontStack, px: number, lineHeight: number): void {
  const s = probe.style
  s.fontFamily = stack.family
  s.fontSize = `${px}px`
  s.lineHeight = `${lineHeight}px`
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
  if (w - 1 >= 1 && m.maxLineWidth - (w - 1) <= FIT_TOLERANCE) {
    const t = measureLineStats(p, w - 1)
    if (t.lineCount === m.lineCount && Math.abs(t.maxLineWidth - m.maxLineWidth) < 1e-6) w -= 1
  }
  return Math.min(width, w)
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
  } else if (fit.width > 1) {
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
  if (fit.width > 1) {
    // Balance's claim is minimality: one pixel narrower must cost a line in the browser too.
    const narrower = paint(stack, text, FONT_SIZE, LINE_HEIGHT, fit.width - 1)
    if (narrower.lines <= fit.lineCount) {
      return { outcome: 'pretext-gap', lines: atFit.lines, detail: `at ${fit.width - 1}px: DOM ${narrower.lines} lines, Pretext ${layout(p, fit.width - 1, LINE_HEIGHT).lineCount}` }
    }
  }
  return { outcome: 'pass', lines: atFit.lines }
}

type SizeCheck = { fits: boolean, gap?: string, painted: Painted }

// Judges one size the way the box would: the painted height and any horizontal overflow decide
// the fit. Pretext's count at that size must match the painting, or the kit's answer was built
// on a wrong count and the case is Pretext's gap rather than the kit's.
function checkSize(stack: FontStack, text: string, px: number, width: number): SizeCheck {
  const lh = px * FIT_LINE_HEIGHT_RATIO
  const f = fontAt(stack, px, lh)
  const painted = paint(stack, text, px, lh, width)
  const fits = painted.height <= FIT_HEIGHT && painted.scrollWidth <= width
  const gap = gapAt(painted.lines, layout(prepared(text, f), width, lh).lineCount, `at ${px}px`)
  return gap === undefined ? { fits, painted } : { fits, painted, gap }
}

// Reports the painted per-line height beside the CSS one, since an engine that snaps line boxes
// paints a different height from lines × line-height, and that is the first thing to rule out.
function describe(px: number, c: SizeCheck, width: number): string {
  const lh = px * FIT_LINE_HEIGHT_RATIO
  const perLine = c.painted.lines > 0 ? c.painted.height / c.painted.lines : 0
  const overflow = c.painted.scrollWidth > width ? `, scrollWidth ${c.painted.scrollWidth}` : ''
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
// contract: fits means every line within the width (Pretext's slack included) and lines × line
// height within the height. A failure here is the kit's whatever the browser paints, so no kit
// bug can pass as a Pretext gap.
function judgeModel(
  result: FitResult | null,
  stack: FontStack,
  text: string,
  width: number,
  lhOf: (px: number) => number,
): Verdict | undefined {
  const modelFits = (px: number): boolean => {
    const s = measureLineStats(prepared(text, fontAt(stack, px, px * FIT_LINE_HEIGHT_RATIO)), width)
    return s.maxLineWidth <= width + FIT_TOLERANCE && s.lineCount * lhOf(px) <= FIT_HEIGHT
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

window.sweep = async (helper: Helper): Promise<CaseResult[]> => {
  if (helper === 'clamp' || helper === 'truncateMiddle') throw new Error(`sweep: ${helper} has no cases yet`)
  await document.fonts.ready
  if (helper === 'fontFromStyle') return fontFromStyleCases()
  const ws = widths(window.sweepWidthStep[helper] ?? 1)
  const out: CaseResult[] = []
  for (const corpus of CORPORA) {
    for (const stack of FONT_STACKS) {
      for (const { label, text } of corpus.texts) {
        for (const w of ws) {
          const base = { helper, corpus: corpus.name, font: stack.label, width: w }
          let v: { outcome: Outcome, lines?: number, detail?: string, cause?: string }
          try {
            v = helper === 'fitFontSize' ? fitCase(stack, text, w) : widthCase(helper, stack, text, w)
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
        // Yield between texts so a headed browser stays responsive and does not flag the page as hung.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
  }
  return out
}

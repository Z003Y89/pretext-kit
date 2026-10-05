import { layout, prepareWithSegments } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import { balance, fitFontSize, fontFromStyle, prepareSizes, shrinkwrap } from '../src/index.ts'
import type { StyleFont } from '../src/index.ts'
import { CORPORA, FONT_SIZE, FONT_STACKS, LINE_HEIGHT, widths } from './corpora.ts'
import type { FontStack } from './corpora.ts'

export type Helper = 'shrinkwrap' | 'balance' | 'fitFontSize' | 'clamp' | 'truncateMiddle'
export type Outcome = 'pass' | 'pretext-gap' | 'kit-mismatch'
export type CaseResult = {
  helper: string
  corpus: string
  font: string
  width: number
  lines?: number
  outcome: Outcome
  detail?: string
}

declare global {
  interface Window {
    sweep: (helper: Helper) => Promise<CaseResult[]>
    sweepWidthStep: Record<string, number>
  }
}

// 96px holds four 24px lines, so the box is tight enough at 16px that most texts must shrink or
// grow to fit, which is where a wrong size would show.
const FIT_HEIGHT = 96
const FIT_MIN = 8
const FIT_MAX = 48
const FIT_LINE_HEIGHT_RATIO = 1.5

// Step 1 everywhere unless a run overrides it; run.ts sets this when a browser is too slow at step 1.
window.sweepWidthStep = { shrinkwrap: 1, balance: 1, fitFontSize: 1 }

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

type Painted = { lines: number, height: number, scrollWidth: number }

function paint(stack: FontStack, text: string, px: number, lineHeight: number, width: number): Painted {
  styleProbe(stack, px, lineHeight)
  probe.style.width = `${width}px`
  if (probe.textContent !== text) probe.textContent = text
  const height = probe.getBoundingClientRect().height
  return { lines: Math.round(height / lineHeight), height, scrollWidth: probe.scrollWidth }
}

// Wrapping, the line count, is all a height depends on, so a case where Pretext's own count at
// the container width differs from the browser's cannot say anything about the kit.
function baselineGap(stack: FontStack, text: string, f: StyleFont, width: number): string | undefined {
  const dom = paint(stack, text, FONT_SIZE, LINE_HEIGHT, width).lines
  const model = layout(prepared(text, f), width, LINE_HEIGHT).lineCount
  return dom === model ? undefined : `baseline at ${width}px: DOM ${dom} lines, Pretext ${model}`
}

function widthCase(
  helper: 'shrinkwrap' | 'balance',
  corpus: string,
  stack: FontStack,
  label: string,
  text: string,
  width: number,
): CaseResult {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  const base = { helper, corpus, font: stack.label, width }
  const gap = baselineGap(stack, text, f, width)
  if (gap !== undefined) return { ...base, outcome: 'pretext-gap', detail: `${label}: ${gap}` }
  const fit = (helper === 'shrinkwrap' ? shrinkwrap : balance)(prepared(text, f), width)
  const dom = paint(stack, text, FONT_SIZE, LINE_HEIGHT, fit.width).lines
  if (dom === fit.lineCount) return { ...base, lines: dom, outcome: 'pass' }
  return {
    ...base,
    lines: dom,
    outcome: 'kit-mismatch',
    detail: `${label}: returned width ${fit.width} with ${fit.lineCount} lines, DOM paints ${dom} lines there`,
  }
}

type SizeCheck = { fits: boolean, gap?: string, painted: Painted }

// Judges one size the way the box would: the painted height and any horizontal overflow decide
// the fit. Pretext's count at that size must match the painting, or the kit's answer was built
// on a wrong count and the case is Pretext's gap rather than the kit's.
function checkSize(stack: FontStack, text: string, px: number, width: number): SizeCheck {
  const lh = px * FIT_LINE_HEIGHT_RATIO
  const f = fontAt(stack, px, lh)
  const painted = paint(stack, text, px, lh, width)
  const model = layout(prepared(text, f), width, lh).lineCount
  const fits = painted.height <= FIT_HEIGHT && painted.scrollWidth <= width
  if (painted.lines !== model) return { fits, painted, gap: `at ${px}px: DOM ${painted.lines} lines, Pretext ${model}` }
  return { fits, painted }
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

function fitCase(corpus: string, stack: FontStack, label: string, text: string, width: number): CaseResult {
  const f = fontAt(stack, FONT_SIZE, LINE_HEIGHT)
  const base = { helper: 'fitFontSize', corpus, font: stack.label, width }
  const gap = baselineGap(stack, text, f, width)
  if (gap !== undefined) return { ...base, outcome: 'pretext-gap', detail: `${label}: ${gap}` }

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
  const result = fitFontSize(sizes, { width, height: FIT_HEIGHT }, px => fontAt(stack, px, px * FIT_LINE_HEIGHT_RATIO).lineHeight)

  if (result === null) {
    const at = checkSize(stack, text, FIT_MIN, width)
    if (at.gap !== undefined) return { ...base, outcome: 'pretext-gap', detail: `${label}: null, ${at.gap}` }
    if (!at.fits) return { ...base, lines: at.painted.lines, outcome: 'pass' }
    return { ...base, lines: at.painted.lines, outcome: 'kit-mismatch', detail: `${label}: null, but ${describe(FIT_MIN, at, width)}` }
  }

  const at = checkSize(stack, text, result.px, width)
  if (at.gap !== undefined) return { ...base, outcome: 'pretext-gap', detail: `${label}: returned ${result.px}px, ${at.gap}` }
  if (!at.fits) {
    return { ...base, lines: at.painted.lines, outcome: 'kit-mismatch', detail: `${label}: returned ${result.px}px, but ${describe(result.px, at, width)}` }
  }
  if (result.px < FIT_MAX) {
    const next = checkSize(stack, text, result.px + 1, width)
    if (next.gap !== undefined) return { ...base, outcome: 'pretext-gap', detail: `${label}: returned ${result.px}px, ${next.gap}` }
    if (next.fits) {
      return {
        ...base,
        lines: at.painted.lines,
        outcome: 'kit-mismatch',
        detail: `${label}: returned ${result.px}px, but ${describe(result.px + 1, next, width)} and fits`,
      }
    }
  }
  return { ...base, lines: at.painted.lines, outcome: 'pass' }
}

window.sweep = async (helper: Helper): Promise<CaseResult[]> => {
  if (helper === 'clamp' || helper === 'truncateMiddle') throw new Error(`sweep: ${helper} has no cases yet`)
  await document.fonts.ready
  const ws = widths(window.sweepWidthStep[helper] ?? 1)
  const out: CaseResult[] = []
  for (const corpus of CORPORA) {
    for (const stack of FONT_STACKS) {
      for (const { label, text } of corpus.texts) {
        for (const w of ws) {
          out.push(helper === 'fitFontSize'
            ? fitCase(corpus.name, stack, label, text, w)
            : widthCase(helper, corpus.name, stack, label, text, w))
        }
        // Yield between texts so a headed browser stays responsive and does not flag the page as hung.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
  }
  return out
}

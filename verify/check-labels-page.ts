// The Chromium side of the label checker's oracle sweep, bundled by verify/check-labels.ts into
// verify/dist/check-labels-page.js and served with its generated page. Two things per case, both independent of
// src/check: the reference verdict, recomputed from the spec with the kit's own helpers on Pretext in this page
// (real canvas), and what Chromium's DOM does with a real element styled as the slot.
import { layoutNextLineRange, measureLineStats, measureNaturalWidth, prepareWithSegments, setLocale } from '@chenglou/pretext'
import { clamp, fitFontSize, prepareLabel, prepareSizes } from '../src/index.ts'
import { FIT_TOLERANCE } from '../src/fit.ts'
import { FAMILY, LINE_HEIGHT_RATIO, LINES, SHRINK_BY, TNUM_FAMILY, unbreakablePieces } from './check-labels-cases.ts'
import type { Piece, PolicyName, Style, SweepCondition } from './check-labels-cases.ts'
import type { PreparedTextWithSegments } from '@chenglou/pretext'

export type LoadedFace = { family: string, status: string }
export type MeasureItem = { text: string, locale: string, style: Style }
// slack: also measure the room the text leaves in the box (the near-miss family).
export type PageCase = { text: string, locale: string, style: Style, policy: PolicyName, width: number, slack?: boolean }
export type RefKind = 'pass' | 'overflow' | 'below-min-size' | 'too-many-lines' | 'truncated'
// fontPx: the shrinkTo size chosen (or its minimum when none fits); next: the next larger size the search would
// have taken, null at the slot size.
// slack: on a pass of a case that asks for it, the box less the widest line, word or one-line width, at least 0 (zoomed px).
export type Ref = { kind: RefKind, fontPx: number, lines: number, next: number | null, slack?: number }
// overflow: the text element's content wider than its box (overflow(), below), at the slot size, or for shrinkTo at
// ref.fontPx; overflowNext at ref.next; scrollOverflow*: the same by scrollWidth > clientWidth, a cross-check. lines:
// the text's line boxes (rects of a range over it, by top), and heightLines its height over the line height (-1 when
// no whole number, each line allowed 1/64 px of layout rounding); overflow, for lines too, a line wider than the box.
// clamped: scrollHeight > clientHeight under -webkit-line-clamp; for truncate end (normal) overflow too, a line
// cut at the box by text-overflow. textWidth and boxWidth: zoomed px. slack: the box less the text's width (one line) or
// its widest line (the rects of a range over it grouped by top, which leave out a line's trailing space and take in a
// painted soft hyphen), zoomed px.
export type Dom = {
  overflow?: boolean, overflowNext?: boolean, lines?: number, heightLines?: number, clamped?: boolean, slack?: number,
  scrollOverflow?: boolean, scrollOverflowNext?: boolean,
  scrollWidth?: number, clientWidth?: number, textWidth?: number, boxWidth?: number, textWidthNext?: number,
}
export type PageResult = { ref: Ref, dom: Dom }

export type PageRowItem = { text: string, short?: string, order?: number }
export type PageRow = { locale: string, items: PageRowItem[], width: number, gap: number, iconWidth: number, style: Style, slack?: boolean }
// stage: the first stage that fits, or the last when none does (overflow); dom: whether the row overflows at that
// stage and at the one before it (null at stage 0).
// slack: when the row fits at its stage, the row box less the stage's total (zoomed px), for a row that asks for it.
export type RowRef = { kind: 'pass' | 'row-collapsed' | 'row-overflow', stage: number, stages: number, slack?: number }
export type RowResult = {
  ref: RowRef
  dom: { overflow: boolean, scrollOverflow: boolean, overflowBefore: boolean | null, scrollOverflowBefore: boolean | null, textWidth: number, boxWidth: number }
}

declare global {
  interface Window {
    ck: {
      load: (families: string[]) => Promise<LoadedFace[]>
      measure: (items: MeasureItem[], scale: number) => { natural: number, naturalMin: number, twoLines: number, widestPiece: number }[]
      naturals: (items: MeasureItem[], scale: number) => number[]
      labels: (cases: PageCase[], condition: SweepCondition) => PageResult[]
      rows: (rows: PageRow[], condition: SweepCondition) => RowResult[]
    }
  }
}

// ---- The reference: the spec's rules on the kit's helpers ----------------------------------------------

const transform = (text: string, style: Style, locale: string): string => (style.transform === 'uppercase' ? text.toLocaleUpperCase(locale) : text)
const family = (style: Style): string => (style.numeric === 'tabular' ? TNUM_FAMILY : FAMILY)
const fontAt = (style: Style, px: number): string => `${px}px "${family(style)}"`

let locale: string | null = null
function useLocale(tag: string): void {
  if (tag === locale) return
  setLocale(tag)
  locale = tag
}

// The CSS the DOM gets, in CSS px before zoom: text scale grows font size, letter spacing, line height and the
// icon; zoom then grows everything, boxes too.
type Geometry = { cssSize: number, px: number, spacing: number, box: number }
function geometry(style: Style, width: number, c: SweepCondition): Geometry {
  const cssSize = style.size * c.textScale
  return {
    cssSize,
    px: cssSize * c.zoom,
    spacing: style.letterSpacing * c.textScale * c.zoom,
    box: (width - style.reserve * c.textScale) * c.zoom,
  }
}

// The kit's fit test (Pretext's layout at the width, plus FIT_TOLERANCE) through fitFontSize at one size.
function fits(text: string, style: Style, px: number, spacing: number, width: number, maxLines: number): boolean {
  const sizes = prepareSizes(text, () => fontAt(style, px), { min: 1, max: 1 }, { letterSpacing: spacing })
  return fitFontSize(sizes, { width, maxLines }, () => 0) !== null
}

// The width Pretext gives the line laid out from a piece at `width` when that line ends at the soft hyphen after
// the piece (so the hyphen is painted), else null.
function hyphenLine(prepared: PreparedTextWithSegments, piece: Piece, width: number): number | null {
  if (prepared.kinds[piece.end] !== 'soft-hyphen') return null
  const line = layoutNextLineRange(prepared, { segmentIndex: piece.start, graphemeIndex: 0 }, width)
  return line !== null && line.end.segmentIndex === piece.end + 1 && line.end.graphemeIndex === 0 ? line.width : null
}

// overflow-wrap: normal: whether a piece no break opportunity splits is wider than the box (plus FIT_TOLERANCE) at its
// natural width, which is what an unbroken word paints, or, before a soft hyphen, its line at the box ends there wider
// than the box (plus FIT_TOLERANCE). at: the width lines are laid out at, the box plus FIT_TOLERANCE when a word that
// passes is wider than the box, since the browser shows it whole.
function normalWrap(prepared: PreparedTextWithSegments, style: Style, px: number, spacing: number, width: number): { tooWide: boolean, at: number, widest: number } {
  let tooWide = false
  let widest = 0
  for (const piece of unbreakablePieces(prepared.segments, prepared.kinds)) {
    const natural = measureNaturalWidth(prepareWithSegments(piece.text, fontAt(style, px), { letterSpacing: spacing }))
    widest = Math.max(widest, natural)
    const hyphen = hyphenLine(prepared, piece, width)
    if (natural > width + FIT_TOLERANCE || (hyphen !== null && hyphen > width + FIT_TOLERANCE)) tooWide = true
  }
  return { tooWide, at: widest > width ? width + FIT_TOLERANCE : width, widest }
}

// The near-miss slack of a pass: the box less what the policy fits in it, measured at the size the verdict took.
function slackOf(c: PageCase, cond: SweepCondition, ref: Ref): number {
  const g = geometry(c.style, c.width, cond)
  const text = transform(c.text, c.style, c.locale)
  const opts = { letterSpacing: g.spacing }
  const one = (t: string, px: number): number => measureNaturalWidth(prepareWithSegments(t, fontAt(c.style, px), opts))
  const prepared = prepareWithSegments(text, fontAt(c.style, g.px), opts)
  let used: number
  switch (c.policy) {
    case 'as-is': used = one(text, g.px); break
    case 'truncate middle': used = one(prepareLabel(text, fontAt(c.style, g.px)).text, g.px); break
    case 'shrinkTo': used = one(text, ref.fontPx); break
    case 'lines':
    case 'truncate end': used = measureLineStats(prepared, g.box).maxLineWidth; break
    case 'lines (normal)':
    case 'truncate end (normal)': {
      const n = normalWrap(prepared, c.style, g.px, g.spacing, g.box)
      used = Math.max(n.widest, measureLineStats(prepared, n.at).maxLineWidth)
      break
    }
  }
  return Math.max(0, g.box - used)
}

function reference(c: PageCase, cond: SweepCondition): Ref {
  const ref = verdict(c, cond)
  return c.slack === true && ref.kind === 'pass' ? { ...ref, slack: slackOf(c, cond, ref) } : ref
}

function verdict(c: PageCase, cond: SweepCondition): Ref {
  const g = geometry(c.style, c.width, cond)
  const text = transform(c.text, c.style, c.locale)
  const prepared = prepareWithSegments(text, fontAt(c.style, g.px), { letterSpacing: g.spacing })
  const lines = measureLineStats(prepared, g.box).lineCount
  const plain = (kind: RefKind): Ref => ({ kind, fontPx: g.px, lines, next: null })
  switch (c.policy) {
    case 'as-is':
      return plain(fits(text, c.style, g.px, g.spacing, g.box, 1) ? 'pass' : 'overflow')
    case 'lines':
      return plain(fits(text, c.style, g.px, g.spacing, g.box, LINES) ? 'pass' : 'too-many-lines')
    case 'truncate end':
      return plain(clamp(prepared, g.box, LINES).truncated ? 'truncated' : 'pass')
    case 'lines (normal)': {
      const n = normalWrap(prepared, c.style, g.px, g.spacing, g.box)
      if (n.tooWide) return plain('overflow')
      return plain(fits(text, c.style, g.px, g.spacing, n.at, LINES) ? 'pass' : 'too-many-lines')
    }
    case 'truncate end (normal)': {
      const n = normalWrap(prepared, c.style, g.px, g.spacing, g.box)
      return plain(n.tooWide || clamp(prepared, n.at, LINES).truncated ? 'truncated' : 'pass')
    }
    case 'truncate middle': {
      const collapsed = prepareLabel(text, fontAt(c.style, g.px)).text
      return plain(fits(collapsed, c.style, g.px, g.spacing, g.box, 1) ? 'pass' : 'truncated')
    }
    case 'shrinkTo': {
      // Candidates from the slot size down: the size itself, every whole px, the minimum itself; the largest that
      // fits one line wins. Letter spacing is CSS px, so it stays g.spacing at every size, as in the DOM.
      const min = Math.min((c.style.size - SHRINK_BY) * cond.textScale * cond.zoom, g.px)
      const sizes = [g.px]
      for (let s = Math.floor(g.px); s >= Math.ceil(min); s--) if (s !== g.px) sizes.push(s)
      if (sizes.at(-1) !== min) sizes.push(min)
      const hit = sizes.findIndex(s => fits(text, c.style, s, g.spacing, g.box, 1))
      if (hit < 0) return { kind: 'below-min-size', fontPx: min, lines, next: null }
      return { kind: 'pass', fontPx: sizes[hit]!, lines, next: hit === 0 ? null : sizes[hit - 1]! }
    }
  }
}

type ItemState = 'label' | 'short' | 'icon'

// The stages as what each item shows: stage 0 every label; each later one moves one item, by collapse order, to
// its short label and then to its icon.
function rowStages(r: PageRow): ItemState[][] {
  const stages: ItemState[][] = [r.items.map(() => 'label')]
  const order = r.items.map((_, i) => i).filter(i => r.items[i]!.order !== undefined)
  order.sort((a, b) => r.items[a]!.order! - r.items[b]!.order! || a - b)
  for (const i of order) {
    const steps: ItemState[] = r.items[i]!.short === undefined ? ['icon'] : ['short', 'icon']
    for (const state of steps) stages.push(stages.at(-1)!.map((s, j) => (j === i ? state : s)))
  }
  return stages
}

function rowReference(r: PageRow, cond: SweepCondition): RowRef & { states: ItemState[][] } {
  const g = geometry(r.style, 0, cond)
  const natural = (text: string): number =>
    measureNaturalWidth(prepareWithSegments(transform(text, r.style, r.locale), fontAt(r.style, g.px), { letterSpacing: g.spacing })) +
    r.style.reserve * cond.textScale * cond.zoom
  const icon = r.iconWidth * cond.textScale * cond.zoom
  const states = rowStages(r)
  const width = (item: PageRowItem, s: ItemState): number => (s === 'icon' ? icon : natural(s === 'short' ? item.short! : item.text))
  const gap = r.gap * cond.zoom
  const total = (ss: ItemState[]): number => ss.reduce((sum, s, j) => sum + width(r.items[j]!, s), 0) + (ss.length - 1) * gap
  const box = r.width * cond.zoom
  const stage = states.findIndex(ss => total(ss) <= box + FIT_TOLERANCE)
  const last = states.length - 1
  if (stage < 0) return { kind: 'row-overflow', stage: last, stages: last, states }
  const slack = r.slack === true ? { slack: Math.max(0, box - total(states[stage]!)) } : {}
  return { kind: stage === 0 ? 'pass' : 'row-collapsed', stage, stages: last, states, ...slack }
}

// ---- The DOM ----------------------------------------------------------------------------------------------

const host = (): HTMLDivElement => document.getElementById('host') as HTMLDivElement

// A slot: a flex box of the slot's width holding the icon (when the slot reserves one, grown with the text scale
// but not with a shrinkTo size, which only the text takes) and the text element, which takes the rest.
function slotElement(c: PageCase, cond: SweepCondition, cssSize: number): { slot: HTMLDivElement, text: HTMLDivElement } {
  const slot = document.createElement('div')
  slot.className = 'slot'
  slot.lang = c.locale
  const s = slot.style
  s.width = `${c.width}px`
  s.fontSize = `${cssSize}px`
  s.letterSpacing = `${c.style.letterSpacing * cond.textScale}px`
  s.lineHeight = `${c.style.size * LINE_HEIGHT_RATIO * cond.textScale}px`
  s.textTransform = c.style.transform
  s.fontVariantNumeric = c.style.numeric === 'tabular' ? 'tabular-nums' : 'normal'
  if (c.style.reserve > 0) {
    const icon = document.createElement('span')
    icon.className = 'icon'
    icon.style.width = `${c.style.reserve * cond.textScale}px`
    slot.append(icon)
  }
  const text = document.createElement('div')
  const classes: Record<PolicyName, string> = {
    'as-is': 'nowrap', 'shrinkTo': 'nowrap', 'truncate middle': 'nowrap', 'lines': 'wrap', 'truncate end': 'clamp',
    'lines (normal)': 'wrap normal', 'truncate end (normal)': 'clamp normal',
  }
  text.className = `text ${classes[c.policy]}`
  text.textContent = c.text
  slot.append(text)
  return { slot, text }
}

function rectLines(el: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  const tops = new Set<number>()
  for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top * 64))
  return tops.size
}

// Overflow judged on fractional widths: the content's bounding width (a range over it, zoomed px) past the element's
// box by more than OVERFLOW_TOLERANCE. scrollWidth > clientWidth, which Chromium snaps to whole pixels, is kept as
// a cross-check.
const OVERFLOW_TOLERANCE = 1 / 64
type Overflow = { overflow: boolean, scrollOverflow: boolean, textWidth: number, boxWidth: number, scrollWidth: number, clientWidth: number }
function overflow(el: HTMLElement): Overflow {
  const range = document.createRange()
  range.selectNodeContents(el)
  const textWidth = range.getBoundingClientRect().width
  const boxWidth = el.getBoundingClientRect().width
  return {
    overflow: textWidth > boxWidth + OVERFLOW_TOLERANCE, scrollOverflow: el.scrollWidth > el.clientWidth,
    textWidth, boxWidth, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
  }
}

// The widest line of an element's text: its range's rects grouped by top, each line from its leftmost to its rightmost rect.
function widestLine(el: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  const lines = new Map<number, { left: number, right: number }>()
  for (const r of range.getClientRects()) {
    if (r.width <= 0) continue
    const top = Math.round(r.top * 64)
    const line = lines.get(top)
    if (line === undefined) lines.set(top, { left: r.left, right: r.right })
    else lines.set(top, { left: Math.min(line.left, r.left), right: Math.max(line.right, r.right) })
  }
  return Math.max(0, ...[...lines.values()].map(l => l.right - l.left))
}

// Line boxes sit on at most a 1/64 px grid, so a height within this per line of n lines is n lines.
const GRID = 1 / 64

if (typeof window !== 'undefined') {
  window.ck = {
    async load(families) {
      for (const f of families) await document.fonts.load(`16px "${f}"`)
      await document.fonts.ready
      return [...document.fonts].map(f => ({ family: f.family.replace(/"/g, ''), status: f.status }))
    },

    measure(items, scale) {
      return items.map(({ text, locale, style }) => {
        useLocale(locale)
        const t = transform(text, style, locale)
        const opts = { letterSpacing: style.letterSpacing * scale }
        const prepared = prepareWithSegments(t, fontAt(style, style.size * scale), opts)
        const natural = measureNaturalWidth(prepared)
        const naturalMin = measureNaturalWidth(prepareWithSegments(t, fontAt(style, (style.size - SHRINK_BY) * scale), opts))
        // The narrowest 1/64 px width with at most LINES lines, searched from the natural width down, and no
        // narrower than the widest grapheme (a text of one or two graphemes takes LINES lines at any width).
        let hi = Math.ceil(natural * 64)
        let lo = 0
        while (hi - lo > 1) {
          const mid = lo + Math.floor((hi - lo) / 2)
          if (measureLineStats(prepared, mid / 64).lineCount <= LINES) hi = mid
          else lo = mid
        }
        // Each piece's natural width, or with the hyphen its soft hyphen paints when the line breaks there.
        const widestPiece = Math.max(0, ...unbreakablePieces(prepared.segments, prepared.kinds).map(piece => {
          const alone = measureNaturalWidth(prepareWithSegments(piece.text, fontAt(style, style.size * scale), opts))
          return Math.max(alone, hyphenLine(prepared, piece, alone) ?? 0)
        }))
        return { natural, naturalMin, twoLines: Math.max(hi / 64, measureLineStats(prepared, 0).maxLineWidth), widestPiece }
      })
    },

    naturals(items, scale) {
      return items.map(({ text, locale, style }) => {
        useLocale(locale)
        const opts = { letterSpacing: style.letterSpacing * scale }
        return measureNaturalWidth(prepareWithSegments(transform(text, style, locale), fontAt(style, style.size * scale), opts))
      })
    },

    labels(cases, cond) {
      const refs = cases.map(c => {
        useLocale(c.locale)
        return reference(c, cond)
      })
      const root = host()
      root.replaceChildren()
      root.style.zoom = String(cond.zoom)
      // shrinkTo renders at the reference's size and at the next one up; the others at the slot size.
      const els = cases.map((c, i) => {
        const r = refs[i]!
        const cssSize = c.policy === 'shrinkTo' ? r.fontPx / cond.zoom : c.style.size * cond.textScale
        const at = slotElement(c, cond, cssSize)
        root.append(at.slot)
        let next: HTMLDivElement | undefined
        if (c.policy === 'shrinkTo' && r.next !== null) {
          const n = slotElement(c, cond, r.next / cond.zoom)
          root.append(n.slot)
          next = n.text
        }
        return { ...at, next }
      })
      return cases.map((c, i) => {
        const { text, next } = els[i]!
        const dom: Dom = {}
        if (c.policy === 'lines' || c.policy === 'lines (normal)') {
          const lh = c.style.size * LINE_HEIGHT_RATIO * cond.textScale * cond.zoom
          const h = text.getBoundingClientRect().height
          const n = Math.round(h / lh)
          dom.lines = rectLines(text)
          dom.heightLines = Math.abs(h - n * lh) <= n * GRID * cond.zoom ? n : -1
          Object.assign(dom, overflow(text))
        } else if (c.policy === 'truncate end') {
          dom.clamped = text.scrollHeight > text.clientHeight
        } else if (c.policy === 'truncate end (normal)') {
          dom.clamped = text.scrollHeight > text.clientHeight
          Object.assign(dom, overflow(text))
        } else {
          Object.assign(dom, overflow(text))
          if (c.slack === true) dom.slack = dom.boxWidth! - dom.textWidth!
          if (next !== undefined) {
            const n = overflow(next)
            dom.overflowNext = n.overflow
            dom.scrollOverflowNext = n.scrollOverflow
            dom.textWidthNext = n.textWidth
          }
        }
        if (c.slack === true && dom.slack === undefined) dom.slack = text.getBoundingClientRect().width - widestLine(text)
        return { ref: refs[i]!, dom }
      })
    },

    rows(rows, cond) {
      const refs = rows.map(r => {
        useLocale(r.locale)
        return rowReference(r, cond)
      })
      const root = host()
      root.replaceChildren()
      root.style.zoom = String(cond.zoom)
      const build = (i: number, stage: number): HTMLDivElement => {
        const r = rows[i]!
        const row = document.createElement('div')
        row.className = 'row'
        row.lang = r.locale
        row.style.width = `${r.width}px`
        row.style.columnGap = `${r.gap}px`
        row.style.fontSize = `${r.style.size * cond.textScale}px`
        refs[i]!.states[stage]!.forEach((state, j) => {
          const item = r.items[j]!
          const el = document.createElement('div')
          el.className = 'item'
          const icon = document.createElement('span')
          icon.className = 'icon'
          icon.style.width = `${(state === 'icon' ? r.iconWidth : r.style.reserve) * cond.textScale}px`
          el.append(icon)
          if (state !== 'icon') {
            const label = document.createElement('span')
            label.textContent = state === 'short' ? item.short! : item.text
            el.append(label)
          }
          row.append(el)
        })
        root.append(row)
        return row
      }
      const els = rows.map((_, i) => {
        const s = refs[i]!.stage
        return { at: build(i, s), before: s > 0 ? build(i, s - 1) : null }
      })
      return rows.map((_, i) => {
        const { at, before } = els[i]!
        const { states: _states, ...ref } = refs[i]!
        const o = overflow(at)
        const b = before === null ? null : overflow(before)
        return {
          ref,
          dom: { ...o, overflowBefore: b === null ? null : b.overflow, scrollOverflowBefore: b === null ? null : b.scrollOverflow },
        }
      })
    },
  }
}

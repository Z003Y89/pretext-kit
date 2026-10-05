// One realistic app screen (a billing view), laid out twice: by pretext-kit, where the model below
// owns every measured value and the painter writes them inline, and by best-effort CSS: the same
// screen as a competent stylesheet would do it (wrapping rows, auto heights, text-wrap: balance,
// line-clamp, a two-span middle cut, clamp() sizes), with the browser deciding everything.
//
// Pretext's demo rules hold (pretext/AGENTS.md, Demos): the model owns every value a layout width
// depends on (fonts, the text as painted, padding, breakpoints); the painter writes them inline; a
// border inside a model width is an inset box-shadow; nothing corrects what the kit reports. The
// only DOM reads are the computed styles the fonts come from (fontFromStyle) and, after painting,
// the overflow counts shown to the reader, which feed nothing back into layout.

import { measureLineStats, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import { measureRichInlineStats, prepareRichInline } from '@chenglou/pretext/rich-inline'
import type { PreparedRichInline, RichInlineBox, RichInlineItem } from '@chenglou/pretext/rich-inline'
import {
  FIT_TOLERANCE, balance, clamp, fitFontSize, fitFontSizeRich, fontFromStyle, measureTail, prepareLabel,
  prepareSizes, prepareSizesRich, shrinkwrap, shrinkwrapRich, truncateMiddle,
} from '../../src/index.ts'
import type { ClampedLine, PreparedLabel, PreparedSizes, PreparedSizesRich, StyleInput, Tail } from '../../src/index.ts'
import type { Lang, ScreenText } from './strings.ts'

// ---------------------------------------------------------------------------------------------
// Fonts: one probe element per text role, styled by the same classes the screen uses, read once
// with getComputedStyle and turned into Canvas fonts by fontFromStyle.

export const ROLES = ['app', 'label', 'chip', 'meta', 'badge', 'title', 'body', 'file', 'button'] as const
export type Role = typeof ROLES[number]
export type RoleFont = { style: StyleInput, size: number, lineHeight: number }
export type Fonts = Record<Role, RoleFont>

export function createProbes(): HTMLElement {
  const probes = document.createElement('div')
  probes.className = 'probes'
  probes.setAttribute('aria-hidden', 'true')
  for (const role of ROLES) {
    const span = document.createElement('span')
    span.className = `role-${role}`
    span.textContent = 'Probe'
    probes.append(span)
  }
  document.body.append(probes)
  return probes
}

export function readFonts(probes: HTMLElement): Fonts {
  const out = {} as Fonts
  for (const role of ROLES) {
    const el = probes.querySelector(`.role-${role}`)!
    const cs = getComputedStyle(el)
    // A snapshot: a live CSSStyleDeclaration would change under the model when the page restyles.
    const style: StyleInput = {
      fontStyle: cs.fontStyle, fontVariant: cs.fontVariant, fontWeight: cs.fontWeight, fontStretch: cs.fontStretch,
      fontSize: cs.fontSize, fontFamily: cs.fontFamily, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
    }
    const f = fontFromStyle(style)
    out[role] = { style, size: Number.parseFloat(cs.fontSize), lineHeight: f.lineHeight }
  }
  return out
}

// A role's line height at another size keeps the stylesheet's ratio, in whole pixels (Safari 26 floors
// fractional line boxes; see verify/RESULTS.md, webkit-26-line-height-floor).
export function lineHeightAt(r: RoleFont, px: number): number {
  return Math.round(px * r.lineHeight / r.size)
}

// The role's computed style at another size, through fontFromStyle again, so weight, style and
// family stay exactly what the stylesheet says.
export function fontAt(r: RoleFont, px: number): string {
  return fontFromStyle({ ...r.style, fontSize: `${px}px`, lineHeight: `${lineHeightAt(r, px)}px` }).font
}

// ---------------------------------------------------------------------------------------------
// Geometry the model owns. The CSS side uses the same numbers in examples/style.css.

export const SCREEN_PAD = 16
const TOOLBAR_GAP = 8
const BUTTON_PAD_X = 10
const BUTTON_PAD_Y = 8
const CARD_GAP = 12
const CARD_PAD = 14
const SECTION_GAP = 10
const HEAD_GAP = 8
const HEAD_ROW_GAP = 6
const BADGE_PAD_X = 8
const BADGE_PAD_Y = 2
const BADGE_CAP = 0.4
const CHIP_PAD_X = 5
const FILE_ICON = 16
const FILE_ICON_GAP = 6
const FOOTER_GAP = 8
const FOOTER_PAD_X = 16
const FOOTER_PAD_Y = 10
const FOOTER_MAX = 260
const BODY_LINES = 3
const ANY = [1, 2, Number.POSITIVE_INFINITY]

// Text never shrinks below 90% of the size the stylesheet (and the reader's text-size setting) asks
// for: the kit reflows first (wrapping rows, icon-only buttons, a second line) and shrinks only
// within this band. Cf. WCAG 1.4.4, Resize text.
export const SHRINK_FLOOR = 0.9
const floorOf = (max: number) => Math.min(max, Math.ceil(max * SHRINK_FLOOR))

// Breakpoints are the model's: the kit side paints the column count it is given.
export function columnsAt(width: number): number {
  return width >= 1040 ? 3 : width >= 700 ? 2 : 1
}

// Icons scale with the text they sit in, as one rich row (fitFontSizeRich).
export const iconAt = (px: number) => Math.round(px * 1.15)
export const iconGapAt = (px: number) => Math.round(px * 0.45)

// ---------------------------------------------------------------------------------------------
// The model.

export type Fit = { px: number, lineHeight: number, lines: number }
// A button of a row (toolbar or footer): its width, and its label's fit, or null for icon-only.
export type RowButton = { width: number, contentWidth: number, fit: Fit | null }
// natural: every label at full size, widths from their text; shared: one smaller size for all;
// icons: the widest labels collapsed to icons; two-lines: equal widths, labels on up to two lines
// broken at spaces; all-icons: every button icon-only; stacked: buttons one under another.
export type RowMode = 'natural' | 'shared' | 'icons' | 'two-lines' | 'all-icons' | 'stacked'
export type Row = { mode: RowMode, height: number, icon: number, buttons: RowButton[] }
export type CardLayout = {
  meta: Fit & { width: number }
  badge: Fit & { width: number, contentWidth: number }
  headWrapped: boolean
  headHeight: number
  title: { text: string, width: number, lines: number, px: number, lineHeight: number }
  body: { lines: ClampedLine[], truncated: boolean, px: number, lineHeight: number }
  file: { text: string, width: number, px: number, lineHeight: number }
  height: number
}
export type ScreenLayout = {
  width: number
  scale: number
  columns: number
  cardWidth: number
  cardContentWidth: number
  app: { px: number, lineHeight: number }
  toolbar: Row
  cards: CardLayout[]
  footer: Row
  micros: number
}

export type ModelInput = { width: number, scale: number, lang: Lang, text: ScreenText, titles: string[], fonts: Fonts }

export type Model = {
  layout(input: ModelInput): ScreenLayout
  // After a web font arrives: watchFonts has cleared Pretext's cache, and every handle here holds the
  // fallback font's widths, so all of them go.
  reset(): void
  handles(): number
}

export function createModel(): Model {
  const texts = new Map<string, PreparedTextWithSegments>()
  const sizes = new Map<string, PreparedSizes>()
  const rich = new Map<string, PreparedSizesRich>()
  const richAt = new Map<string, PreparedRichInline>()
  const labels = new Map<string, PreparedLabel>()
  const tails = new Map<string, Tail>()

  function text(t: string, font: string): PreparedTextWithSegments {
    const key = font + '\n' + t
    let p = texts.get(key)
    if (p === undefined) { p = prepareWithSegments(t, font); texts.set(key, p) }
    return p
  }
  function sized(t: string, r: RoleFont, min: number, max: number): PreparedSizes {
    const key = `${r.style.fontFamily}|${r.style.fontWeight}|${min}|${max}\n${t}`
    let s = sizes.get(key)
    if (s === undefined) { s = prepareSizes(t, px => fontAt(r, px), { min, max }); sizes.set(key, s) }
    return s
  }
  function sizedRich(key: string, items: (px: number) => Array<RichInlineItem | RichInlineBox>, min: number, max: number): PreparedSizesRich {
    const k = `${min}|${max}\n${key}`
    let s = rich.get(k)
    if (s === undefined) { s = prepareSizesRich(items, { min, max }); rich.set(k, s) }
    return s
  }
  function richOne(key: string, items: Array<RichInlineItem | RichInlineBox>): PreparedRichInline {
    let p = richAt.get(key)
    if (p === undefined) { p = prepareRichInline(items); richAt.set(key, p) }
    return p
  }
  function label(t: string, font: string): PreparedLabel {
    const key = font + '\n' + t
    let l = labels.get(key)
    if (l === undefined) { l = prepareLabel(t, font); labels.set(key, l) }
    return l
  }
  function tail(font: string): Tail {
    let t = tails.get(font)
    if (t === undefined) { t = measureTail('…', font); tails.set(font, t) }
    return t
  }
  const natural = (t: string, font: string) => measureNaturalWidth(text(t, font))

  function fitPlain(s: PreparedSizes, r: RoleFont, width: number, tries: number[]): Fit | null {
    const lh = (px: number) => lineHeightAt(r, px)
    for (const maxLines of tries) {
      const f = fitFontSize(s, { width, maxLines }, lh)
      if (f !== null) return { px: f.px, lineHeight: lh(f.px), lines: f.lineCount }
    }
    return null
  }
  // One size for a set of labels: each label is fitted at or below the current candidate until they
  // all agree. The candidate only falls, and it stops where every label's own fit returned it, so
  // every label fits at it by the kit's own answer; nothing is assumed about smaller sizes fitting.
  function fitTogether(fitAt: (i: number, max: number) => Fit | null, n: number, max: number): Fit[] | null {
    let u = max
    for (;;) {
      const fits: Fit[] = []
      for (let i = 0; i < n; i++) {
        const f = fitAt(i, u)
        if (f === null) return null
        fits.push(f)
      }
      const lowest = Math.min(...fits.map(f => f.px))
      if (fits.every(f => f.px === u)) return fits
      u = lowest
    }
  }
  // Every box on this screen holds its text at its smallest size somehow; if one didn't, the layout
  // would have no height for it, and guessing one would be correcting the kit.
  function must<T>(f: T | null, what: string): T {
    if (f === null) throw new Error(`${what} does not fit its box even at the smallest size`)
    return f
  }

  // A row of buttons (toolbar, footer), decided in this order:
  //   1. natural: each label at full size, buttons as wide as their content, spare room shared out;
  //   2. shared: one smaller size for every label, down to the floor, still one line, still content widths;
  //   3. icons (toolbar): the widest labels become icon-only, at most half of them;
  //   4. two-lines: equal widths, every label on up to two lines, broken at spaces only;
  //   5. all-icons (toolbar) or stacked (footer).
  // Steps 1 and 2 are one fitFontSizeRich call over the whole row as one line (each label an item that
  // never breaks, padding and gaps as extra width), so the shared size is the kit's answer.
  function layoutRow(o: {
    key: string, labels: string[], role: RoleFont, max: number, inner: number, gap: number, padX: number, padY: number,
    icons: boolean, capWidth: number,
  }): Row {
    const { labels: ls, role, max, inner, gap, padX, padY, icons } = o
    const n = ls.length
    const floor = floorOf(max)
    const lh = (px: number) => lineHeightAt(role, px)
    const font = (px: number) => fontAt(role, px)
    const lead = (px: number) => icons ? iconAt(px) + iconGapAt(px) : 0
    const own = (i: number, px: number): Array<RichInlineItem | RichInlineBox> =>
      icons ? [{ width: lead(px) }, { text: ls[i]!, font: font(px) }] : [{ text: ls[i]!, font: font(px) }]
    const ownWidth = (i: number, px: number) => shrinkwrapRich(richOne(`${o.key}|own|${i}|${px}|${role.style.fontFamily}\n${ls[i]}`, own(i, px)), Number.POSITIVE_INFINITY).width

    // Steps 1-3: one line, content widths, some labels possibly collapsed to icons.
    const order = ls.map((_, i) => i).sort((a, b) => ownWidth(b, max) - ownWidth(a, max))
    const maxCollapsed = icons ? Math.floor(n / 2) : 0
    for (let k = 0; k <= maxCollapsed; k++) {
      const collapsed = new Set(order.slice(0, k))
      const items = (px: number): Array<RichInlineItem | RichInlineBox> => ls.flatMap((s, i) => {
        const after = i < n - 1 ? gap : 0
        if (collapsed.has(i)) return [{ width: 2 * padX + iconAt(px) + after }]
        return [
          { width: padX + lead(px) },
          { text: s, font: font(px), break: 'never' as const, extraWidth: padX + after },
        ]
      })
      let u = max
      while (u >= floor) {
        const f = fitFontSizeRich(sizedRich(`${o.key}|row|${[...collapsed].join(',')}|${role.style.fontFamily}\n${ls.join('\n')}`, items, floor, u), { width: inner, maxLines: 1 }, lh)
        if (f === null) break
        // Each button is its own text's width, whole pixels, so check the rounded sum still fits.
        const widths = ls.map((_, i) => collapsed.has(i) ? 2 * padX + iconAt(f.px) : ownWidth(i, f.px) + 2 * padX)
        const used = widths.reduce((a, b) => a + b, 0) + gap * (n - 1)
        if (used <= inner) {
          const share = Math.floor((inner - used) / n)
          const buttons = widths.map((w, i) => {
            const width = Math.min(w + share, Math.max(w, o.capWidth))
            return { width, contentWidth: width - 2 * padX, fit: collapsed.has(i) ? null : { px: f.px, lineHeight: lh(f.px), lines: 1 } }
          })
          const mode: RowMode = k > 0 ? 'icons' : f.px === max ? 'natural' : 'shared'
          return { mode, icon: iconAt(f.px), height: Math.max(lh(f.px), iconAt(f.px)) + 2 * padY, buttons }
        }
        u = f.px - 1
      }
    }

    // Step 4: equal widths, up to two lines, every break at a space: no word (nor the icon and the
    // first word) may be wider than the button.
    const equal = Math.floor((inner - gap * (n - 1)) / n)
    const content = equal - 2 * padX
    const wordsFit = (i: number, px: number) => {
      const words = ls[i]!.split(' ')
      return words.every((w, j) => (j === 0 ? lead(px) : 0) + natural(w, font(px)) <= content + FIT_TOLERANCE)
    }
    const spaces = (i: number, u: number): Fit | null => {
      while (u >= floor) {
        const items = (px: number) => own(i, px)
        const f = fitFontSizeRich(sizedRich(`${o.key}|two|${i}|${role.style.fontFamily}\n${ls[i]}`, items, floor, u), { width: content, maxLines: 2 }, lh)
        if (f === null) return null
        if (wordsFit(i, f.px)) return { px: f.px, lineHeight: lh(f.px), lines: f.lineCount }
        u = f.px - 1
      }
      return null
    }
    const two = fitTogether(spaces, n, max)
    if (two !== null) {
      const tallest = Math.max(...two.map(f => f.lines * f.lineHeight))
      return {
        mode: 'two-lines', icon: iconAt(two[0]!.px), height: tallest + 2 * padY,
        buttons: two.map(f => ({ width: equal, contentWidth: content, fit: f })),
      }
    }

    // Step 5.
    if (icons) {
      return {
        mode: 'all-icons', icon: iconAt(floor), height: iconAt(floor) + 2 * padY,
        buttons: ls.map(() => ({ width: equal, contentWidth: content, fit: null })),
      }
    }
    const full = inner - 2 * padX
    const stacked = must(fitTogether((i, u) => fitPlain(sized(ls[i]!, role, floor, u), role, full, ANY), n, max), o.key)
    return {
      mode: 'stacked', icon: 0, height: 0,
      buttons: stacked.map(f => ({ width: inner, contentWidth: full, fit: f })),
    }
  }

  function layout({ width, scale, text: t, titles, fonts }: ModelInput): ScreenLayout {
    const t0 = performance.now()
    const at = (base: number) => Math.max(1, Math.round(base * scale))
    const inner = width - 2 * SCREEN_PAD

    const appPx = at(fonts.app.size)
    const app = { px: appPx, lineHeight: lineHeightAt(fonts.app, appPx) }

    const toolbar = layoutRow({
      key: 'toolbar', labels: [...t.toolbar], role: fonts.label, max: at(fonts.label.size), inner, gap: TOOLBAR_GAP,
      padX: BUTTON_PAD_X, padY: BUTTON_PAD_Y, icons: true, capWidth: Number.POSITIVE_INFINITY,
    })

    // Cards: the model's columns, equal widths.
    const columns = columnsAt(width)
    const cardWidth = Math.floor((inner - CARD_GAP * (columns - 1)) / columns)
    const cw = cardWidth - 2 * CARD_PAD
    const titlePx = at(fonts.title.size)
    const titleFont = fontAt(fonts.title, titlePx)
    const titleLh = lineHeightAt(fonts.title, titlePx)
    const bodyPx = at(fonts.body.size)
    const bodyFont = fontAt(fonts.body, bodyPx)
    const bodyLh = lineHeightAt(fonts.body, bodyPx)
    const filePx = at(fonts.file.size)
    const fileFont = fontAt(fonts.file, filePx)
    const fileLh = lineHeightAt(fonts.file, filePx)
    const metaMax = at(fonts.meta.size)
    const badgeMax = at(fonts.badge.size)
    const badgeFloor = floorOf(badgeMax)
    const badgeFont = (px: number) => fontAt(fonts.badge, px)

    // Badges: one size for the list. A badge sits beside the case row, at most 40% of the card wide;
    // one that doesn't fit there even at the floor moves under the case row (the head wraps) and gets
    // the card's width. Its box is then its text's width at the shared size.
    const cap = Math.round(cw * BADGE_CAP) - 2 * BADGE_PAD_X
    const wrapped = t.cards.map(c =>
      natural(c.badge, badgeFont(badgeMax)) > cap + FIT_TOLERANCE
      && fitFontSize(sized(c.badge, fonts.badge, badgeFloor, badgeMax), { width: cap, maxLines: 1 }, px => lineHeightAt(fonts.badge, px)) === null)
    const roomFor = (i: number) => wrapped[i] ? cw - 2 * BADGE_PAD_X : cap
    const badgeFits = must(
      fitTogether((i, u) => fitPlain(sized(t.cards[i]!.badge, fonts.badge, badgeFloor, u), fonts.badge, roomFor(i), [1]), t.cards.length, badgeMax)
        ?? fitTogether((i, u) => fitPlain(sized(t.cards[i]!.badge, fonts.badge, badgeFloor, u), fonts.badge, roomFor(i), ANY), t.cards.length, badgeMax),
      'the badges')

    const cards: CardLayout[] = t.cards.map((c, i) => {
      const badgeFit = badgeFits[i]!
      const badgeContent = shrinkwrap(text(c.badge, badgeFont(badgeFit.px)), roomFor(i)).width
      const badgeWidth = badgeContent + 2 * BADGE_PAD_X
      const badgeHeight = badgeFit.lines * badgeFit.lineHeight + 2 * BADGE_PAD_Y

      // The case row: an icon, the case number as a chip that never breaks, then the name, beside
      // the badge or above it.
      const metaWidth = wrapped[i] ? cw : cw - badgeWidth - HEAD_GAP
      const metaItems = (px: number): Array<RichInlineItem | RichInlineBox> => [
        { width: iconAt(px) + iconGapAt(px) },
        { text: c.id, font: fontAt(fonts.chip, px), break: 'never', extraWidth: 2 * CHIP_PAD_X },
        { text: ' ' + c.name, font: fontAt(fonts.meta, px) },
      ]
      const metaFloor = floorOf(metaMax)
      const meta = must(fitPlainRich(sizedRich(`meta|${fonts.meta.style.fontFamily}\n${c.id}\n${c.name}`, metaItems, metaFloor, metaMax), fonts.meta, metaWidth), c.id)
      const metaHeight = meta.lines * meta.lineHeight
      const headHeight = wrapped[i] ? metaHeight + HEAD_ROW_GAP + badgeHeight : Math.max(metaHeight, badgeHeight)

      // Title: soft hyphens only inside a word wider than the card; then the narrowest width that
      // keeps the line count, so no line ends on an orphan.
      const plain = c.title.split(' ')
      const hyph = titles[i]!.split(' ')
      const titleText = plain.map((w, j) => natural(w, titleFont) > cw + FIT_TOLERANCE ? hyph[j] ?? w : w).join(' ')
      // balance may answer narrower than the widest word, which overflow-wrap would then cut without a
      // hyphen; below that width the title is shrinkwrapped at the widest word's width instead.
      let widestWord = 0
      for (const w of titleText.split(' ')) if (!w.includes('\u00AD')) widestWord = Math.max(widestWord, natural(w, titleFont))
      const balanced = balance(text(titleText, titleFont), cw)
      const bal = balanced.width + FIT_TOLERANCE >= widestWord
        ? balanced
        : shrinkwrap(text(titleText, titleFont), Math.min(cw, Math.ceil(widestWord)))

      // Body: three lines, cut with an ellipsis measured in the body's font.
      const cl = clamp(text(c.body, bodyFont), cw, BODY_LINES, tail(bodyFont))

      // Attachment: the middle cut keeps as much of each end as fits, for any file name; no split
      // point (an underscore, the extension) has to be known.
      const fileWidth = cw - FILE_ICON - FILE_ICON_GAP
      const fileText = truncateMiddle(label(c.file, fileFont), fileWidth)

      const height = 2 * CARD_PAD + headHeight + SECTION_GAP + bal.lineCount * titleLh + SECTION_GAP
        + cl.lineCount * bodyLh + SECTION_GAP + fileLh
      return {
        meta: { ...meta, width: metaWidth },
        badge: { ...badgeFit, width: badgeWidth, contentWidth: badgeContent },
        headWrapped: wrapped[i]!,
        headHeight,
        title: { text: titleText, width: bal.width, lines: bal.lineCount, px: titlePx, lineHeight: titleLh },
        body: { lines: cl.lines, truncated: cl.truncated, px: bodyPx, lineHeight: bodyLh },
        file: { text: fileText, width: fileWidth, px: filePx, lineHeight: fileLh },
        height,
      }
    })
    // A card row is as tall as its tallest card, known before anything paints.
    for (let i = 0; i < cards.length; i += columns) {
      let h = 0
      for (let j = i; j < Math.min(i + columns, cards.length); j++) h = Math.max(h, cards[j]!.height)
      for (let j = i; j < Math.min(i + columns, cards.length); j++) cards[j]!.height = h
    }

    const footer = layoutRow({
      key: 'footer', labels: [t.secondary, t.primary], role: fonts.button, max: at(fonts.button.size), inner, gap: FOOTER_GAP,
      padX: FOOTER_PAD_X, padY: FOOTER_PAD_Y, icons: false, capWidth: FOOTER_MAX,
    })

    return {
      width, scale, columns, cardWidth, cardContentWidth: cw, app, toolbar, cards, footer,
      micros: (performance.now() - t0) * 1000,
    }
  }

  function fitPlainRich(s: PreparedSizesRich, r: RoleFont, width: number): Fit | null {
    const lh = (px: number) => lineHeightAt(r, px)
    for (const maxLines of ANY) {
      const f = fitFontSizeRich(s, { width, maxLines }, lh)
      if (f !== null) return { px: f.px, lineHeight: lh(f.px), lines: f.lineCount }
    }
    return null
  }

  return {
    layout,
    reset() { texts.clear(); sizes.clear(); rich.clear(); richAt.clear(); labels.clear(); tails.clear() },
    handles() { return texts.size + sizes.size + rich.size + richAt.size + labels.size },
  }
}

// ---------------------------------------------------------------------------------------------
// The DOM: one structure for both sides, built when the strings change, never per frame.

const ICONS = [
  'M8 3v10M3 8h10', // new
  'M4 2.5h5l3 3v8h-8zM9 2.5v3h3', // report
  'M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10', // export
  'M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2', // settings
]
const CASE_ICON = 'M2.5 4.5h11v8h-11zM6 4.5v-2h4v2'
const FILE_ICON_PATH = 'M4 2.5h5l3 3v8h-8zM9 2.5v3h3'

function icon(path: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'icon'
  span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`
  return span
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

export type ScreenDom = {
  root: HTMLElement
  labels: string[]
  toolbarBox: HTMLElement
  toolbar: { button: HTMLElement, content: HTMLElement, icon: HTMLElement, text: HTMLElement }[]
  app: HTMLElement
  cardsBox: HTMLElement
  cards: {
    card: HTMLElement, head: HTMLElement, meta: HTMLElement, metaIcon: HTMLElement, chip: HTMLElement, badge: HTMLElement,
    badgeText: HTMLElement, title: HTMLElement, body: HTMLElement, file: HTMLElement, fileName: HTMLElement
  }[]
  footer: HTMLElement
  footerButtons: { button: HTMLElement, label: HTMLElement }[]
}

// 'kit' gets inline sizes from the model; 'css' gets the stylesheet. Same strings on both sides.
export function buildScreen(side: 'kit' | 'css', lang: Lang, t: ScreenText): ScreenDom {
  const root = el('div', `screen ${side}`)
  root.lang = lang
  const bar = el('div', 'appbar')
  const app = el('div', 'app-title role-app', t.app)
  bar.append(app)
  const toolbarBox = el('div', 'toolbar')
  const toolbar = t.toolbar.map((s, i) => {
    const button = el('div', 'tb')
    button.setAttribute('role', 'button')
    const content = el('div', 'tb-content role-label')
    const ic = icon(ICONS[i]!)
    const text = el('span', 'tb-text', s)
    content.append(ic, text)
    button.append(content)
    button.dataset.check = ''
    toolbarBox.append(button)
    return { button, content, icon: ic, text }
  })
  const cardsBox = el('div', 'cards')
  const cards = t.cards.map(c => {
    const card = el('article', 'card')
    card.dataset.check = ''
    const head = el('div', 'card-head')
    head.dataset.check = ''
    const meta = el('div', 'meta role-meta')
    const metaIcon = icon(CASE_ICON)
    const chip = el('span', 'chip role-chip', c.id)
    meta.append(metaIcon, chip, document.createTextNode(' ' + c.name))
    const badge = el('div', 'badge')
    const badgeText = el('div', 'badge-text role-badge', c.badge)
    badgeText.dataset.check = ''
    badge.append(badgeText)
    head.append(meta, badge)
    const title = el('h3', 'title role-title', c.title)
    const body = el('div', 'body role-body')
    if (side === 'css') body.textContent = c.body
    const file = el('div', 'file role-file')
    file.title = c.file
    let fileName: HTMLElement
    if (side === 'kit') {
      fileName = el('span', 'file-name', c.file)
      fileName.dataset.check = ''
      file.append(icon(FILE_ICON_PATH), fileName)
    } else {
      // The CSS middle cut: two spans, split where this app's names are known to put the date.
      const cut = c.file.lastIndexOf('_')
      fileName = el('span', 'file-name')
      fileName.append(el('span', 'file-start', c.file.slice(0, cut)), el('span', 'file-end', c.file.slice(cut)))
      file.append(icon(FILE_ICON_PATH), fileName)
    }
    card.append(head, title, body, file)
    cardsBox.append(card)
    return { card, head, meta, metaIcon, chip, badge, badgeText, title, body, file, fileName }
  })
  const footer = el('div', 'footer')
  const footerButtons = [t.secondary, t.primary].map((s, i) => {
    const button = el('div', `btn ${i === 0 ? 'secondary' : 'primary'}`)
    button.setAttribute('role', 'button')
    const label = el('div', 'btn-label role-button', s)
    button.dataset.check = ''
    button.append(label)
    footer.append(button)
    return { button, label }
  })
  root.append(bar, toolbarBox, cardsBox, footer)
  return { root, labels: [...t.toolbar], toolbarBox, toolbar, app, cardsBox, cards, footer, footerButtons }
}

// ---------------------------------------------------------------------------------------------
// Independent checks: for each kit paragraph, Pretext's own line count for the text as painted, at
// the width it is painted at, computed straight from Pretext (not through the kit). measureOverflow
// uses it to tell a pretext-gap (Pretext agrees with the kit, the browser doesn't) from a kit error.

const pretextOwn = new WeakMap<HTMLElement, () => number>()

export function ownPlain(e: HTMLElement, textOf: () => string, font: string, width: number): void {
  pretextOwn.set(e, () => measureLineStats(prepareWithSegments(textOf(), font), width).lineCount)
}
function ownRich(e: HTMLElement, items: Array<RichInlineItem | RichInlineBox>, width: number): void {
  pretextOwn.set(e, () => measureRichInlineStats(prepareRichInline(items), width).lineCount)
}

// ---------------------------------------------------------------------------------------------
// Painters.

const px = (n: number) => `${n}px`

// An icon is a box in the rich row: its width (with the gap) is what the model counted, its height
// stays within the line, centred by a top margin inside it.
function paintIcon(e: HTMLElement, size: number, gap: number, lineHeight: number): void {
  e.style.width = px(size)
  e.style.height = px(size)
  e.style.marginRight = px(gap)
  e.style.marginTop = px(Math.max(0, Math.floor((lineHeight - size) / 2)))
}

function setText(e: HTMLElement, s: string): void {
  if (e.textContent !== s) e.textContent = s
}

export function paintKit(d: ScreenDom, L: ScreenLayout, body: string[][], fonts: Fonts): void {
  d.root.style.width = px(L.width)
  d.app.style.fontSize = px(L.app.px)
  d.app.style.lineHeight = px(L.app.lineHeight)

  d.toolbarBox.dataset.mode = L.toolbar.mode
  for (let i = 0; i < d.toolbar.length; i++) {
    const b = d.toolbar[i]!
    const r = L.toolbar.buttons[i]!
    const fit = r.fit
    b.button.style.width = px(r.width)
    b.button.style.height = px(L.toolbar.height)
    b.content.style.width = px(r.contentWidth)
    if (fit === null) {
      // Icon-only: the label stays as the button's accessible name and tooltip.
      b.text.style.display = 'none'
      b.button.setAttribute('aria-label', d.labels[i]!)
      b.button.title = d.labels[i]!
      b.content.style.fontSize = ''
      b.content.style.lineHeight = px(L.toolbar.icon)
      b.content.style.textAlign = 'center'
      b.content.style.height = px(L.toolbar.icon)
      paintIcon(b.icon, L.toolbar.icon, 0, L.toolbar.icon)
      delete b.content.dataset.lines
      pretextOwn.delete(b.content)
    } else {
      b.text.style.display = ''
      b.button.removeAttribute('aria-label')
      b.button.removeAttribute('title')
      b.content.style.textAlign = ''
      b.content.style.height = ''
      b.content.style.fontSize = px(fit.px)
      b.content.style.lineHeight = px(fit.lineHeight)
      paintIcon(b.icon, iconAt(fit.px), iconGapAt(fit.px), fit.lineHeight)
      b.content.dataset.lines = String(fit.lines)
      ownRich(b.content, [{ width: iconAt(fit.px) + iconGapAt(fit.px) }, { text: d.labels[i]!, font: fontAt(fonts.label, fit.px) }], r.contentWidth)
    }
  }

  d.cardsBox.style.gridTemplateColumns = `repeat(${L.columns}, ${px(L.cardWidth)})`
  for (let i = 0; i < d.cards.length; i++) {
    const c = d.cards[i]!
    const k = L.cards[i]!
    c.card.style.height = px(k.height)
    c.head.style.height = px(k.headHeight)
    c.meta.style.width = px(k.meta.width)
    c.meta.style.fontSize = px(k.meta.px)
    c.meta.style.lineHeight = px(k.meta.lineHeight)
    c.meta.dataset.lines = String(k.meta.lines)
    c.chip.style.fontSize = px(k.meta.px)
    c.chip.style.lineHeight = px(k.meta.lineHeight)
    paintIcon(c.metaIcon, iconAt(k.meta.px), iconGapAt(k.meta.px), k.meta.lineHeight)
    ownRich(c.meta, [
      { width: iconAt(k.meta.px) + iconGapAt(k.meta.px) },
      { text: c.chip.textContent ?? '', font: fontAt(fonts.chip, k.meta.px), break: 'never', extraWidth: 2 * CHIP_PAD_X },
      { text: c.meta.lastChild?.textContent ?? '', font: fontAt(fonts.meta, k.meta.px) },
    ], k.meta.width)
    c.badge.style.width = px(k.badge.width)
    c.badgeText.style.width = px(k.badge.contentWidth)
    c.badgeText.style.fontSize = px(k.badge.px)
    c.badgeText.style.lineHeight = px(k.badge.lineHeight)
    c.badgeText.dataset.lines = String(k.badge.lines)
    ownPlain(c.badgeText, () => c.badgeText.textContent ?? '', fontAt(fonts.badge, k.badge.px), k.badge.contentWidth)
    setText(c.title, k.title.text)
    c.title.style.width = px(k.title.width)
    c.title.style.fontSize = px(k.title.px)
    c.title.style.lineHeight = px(k.title.lineHeight)
    c.title.dataset.lines = String(k.title.lines)
    ownPlain(c.title, () => c.title.textContent ?? '', fontAt(fonts.title, k.title.px), k.title.width)
    c.body.style.fontSize = px(k.body.px)
    c.body.style.lineHeight = px(k.body.lineHeight)
    c.body.style.width = px(L.cardContentWidth)
    const lines = body[i]!
    const next = k.body.lines.map((l, j) => l.text + (k.body.truncated && j === k.body.lines.length - 1 ? '…' : ''))
    if (lines.length !== next.length || lines.some((s, j) => s !== next[j])) {
      c.body.replaceChildren(...next.map(s => { const line = el('div', 'line', s); line.dataset.check = ''; line.dataset.lines = '1'; return line }))
      body[i] = next
    }
    for (const line of c.body.children) {
      const e = line as HTMLElement
      e.style.lineHeight = px(k.body.lineHeight)
      ownPlain(e, () => e.textContent ?? '', fontAt(fonts.body, k.body.px), L.cardContentWidth)
    }
    c.file.style.fontSize = px(k.file.px)
    c.file.style.lineHeight = px(k.file.lineHeight)
    c.fileName.style.width = px(k.file.width)
    setText(c.fileName, k.file.text)
  }

  d.footer.dataset.mode = L.footer.mode
  d.footer.style.height = L.footer.mode === 'stacked' ? '' : px(L.footer.height)
  for (let i = 0; i < d.footerButtons.length; i++) {
    const b = d.footerButtons[i]!
    const r = L.footer.buttons[i]!
    const f = r.fit!
    b.button.style.width = px(r.width)
    b.label.style.width = px(r.contentWidth)
    b.label.style.fontSize = px(f.px)
    b.label.style.lineHeight = px(f.lineHeight)
    b.label.dataset.lines = String(f.lines)
    b.label.dataset.check = ''
    ownPlain(b.label, () => b.label.textContent ?? '', fontAt(fonts.button, f.px), r.contentWidth)
  }
}

// The CSS side: only the screen width (the slider) and the text-size setting come from the page.
export function paintCss(d: ScreenDom, width: number, scale: number): void {
  d.root.style.width = px(width)
  d.root.style.setProperty('--s', String(scale))
}

// ---------------------------------------------------------------------------------------------
// Boxes whose content doesn't fit them: clipped, cut by an ellipsis, or spilling out. Read after
// painting, for the reader only; nothing here feeds back into the layout.
//
// A kit paragraph painted in a different number of lines than the kit said is a pretext-gap only if
// Pretext's own layout of the painted text at the painted width agrees with the kit (the browser is
// the odd one out); otherwise it is the kit's error, and counted with the overflowing boxes.
export type Overflow = { boxes: number, gaps: number, detail: string[] }

function over(e: HTMLElement): boolean {
  return e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5
}

function describe(e: HTMLElement): string {
  return `${e.className.split(' ')[0]} "${(e.textContent ?? '').replace(/­/g, '').slice(0, 48)}"`
}

// `padY` is the vertical padding of the checked paragraphs (none on the screen; the list's rows have some).
export function measureOverflow(root: HTMLElement, padY = 0): Overflow {
  const seen: HTMLElement[] = []
  const detail: string[] = []
  let boxes = 0
  let gaps = 0
  for (const e of root.querySelectorAll<HTMLElement>('[data-lines]')) {
    const lh = Number.parseFloat(e.style.lineHeight)
    const painted = Math.round((Math.max(e.getBoundingClientRect().height, e.scrollHeight) - padY) / lh)
    const predicted = Number(e.dataset.lines)
    const wide = e.scrollWidth > e.clientWidth + 0.5
    if (painted === predicted && !wide) continue
    const own = pretextOwn.get(e)?.()
    seen.push(e)
    if (own === predicted) {
      gaps++
      detail.push(`pretext-gap: ${describe(e)} paints ${painted} lines${wide ? ` ${e.scrollWidth}px wide in ${e.clientWidth}px` : ''}; Pretext's own layout gives ${own}, as the kit said`)
    } else {
      boxes++
      detail.push(`kit error: ${describe(e)} paints ${painted} lines; the kit said ${predicted}, Pretext's own layout gives ${own}`)
    }
  }
  for (const e of root.querySelectorAll<HTMLElement>('[data-check]')) {
    if (!over(e) || seen.some(g => e === g || e.contains(g))) continue
    boxes++
    detail.push(`overflow: ${describe(e)} ${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight}`)
  }
  return { boxes, gaps, detail }
}

export function summary(L: ScreenLayout): { label: string, value: string }[] {
  const list = (xs: (number | string)[]) => xs.join(' / ')
  const row = (r: Row) => `${r.mode}: ${list(r.buttons.map(b => b.fit === null ? 'icon' : `${b.fit.px}px${b.fit.lines > 1 ? '×2' : ''}`))}`
  return [
    { label: 'Screen', value: `${L.width}px, ${L.columns} col` },
    { label: 'Toolbar', value: row(L.toolbar) },
    { label: 'Badges (one size)', value: `${L.cards[0]!.badge.px}px; widths ${list(L.cards.map(c => `${c.badge.width}${c.headWrapped ? ' (own row)' : ''}`))}` },
    { label: 'Case rows', value: list(L.cards.map(c => `${c.meta.px}px${c.meta.lines > 1 ? '×' + c.meta.lines : ''}`)) },
    { label: 'Titles (balanced)', value: list(L.cards.map(c => `${c.title.width}px·${c.title.lines}`)) },
    { label: 'Card rows', value: list(L.cards.map(c => `${c.height}px`)) },
    { label: 'Buttons', value: row(L.footer) },
  ]
}

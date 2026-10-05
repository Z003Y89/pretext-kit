// One realistic app screen (a billing view), laid out twice: by pretext-kit, where the model below
// owns every measured value and the painter writes them inline, and by fixed-size CSS, where the
// stylesheet's sizes stand and the browser does what it does with them.
//
// Pretext's demo rules hold (pretext/AGENTS.md, Demos): the model owns every value a layout width
// depends on (fonts, the text as painted, padding, breakpoints); the painter writes them inline; a
// border inside a model width is an inset box-shadow; nothing corrects what the kit reports. The
// only DOM reads are the computed styles the fonts come from (fontFromStyle) and, after painting,
// the overflow counts shown to the reader, which feed nothing back into layout.

import { prepareWithSegments } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import type { RichInlineBox, RichInlineItem } from '@chenglou/pretext/rich-inline'
import {
  balance, clamp, fitFontSize, fitFontSizeRich, fontFromStyle, measureTail, prepareLabel, prepareSizes,
  prepareSizesRich, truncateMiddle,
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
const BADGE_PAD_X = 8
const BADGE_PAD_Y = 2
const CHIP_PAD_X = 5
const FILE_ICON = 16
const FILE_ICON_GAP = 6
const FOOTER_GAP = 8
const FOOTER_TOP = 16
const FOOTER_PAD_X = 16
const FOOTER_PAD_Y = 10
const BODY_LINES = 3
const ANY = [1, 2, Number.POSITIVE_INFINITY]

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
export type ToolbarButton = { fit: Fit | null } // null: no size fits, the button shows its icon only
export type CardLayout = {
  meta: Fit & { width: number }
  badge: Fit & { width: number, contentWidth: number }
  headHeight: number
  title: { width: number, lines: number, px: number, lineHeight: number }
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
  toolbar: { buttonWidth: number, contentWidth: number, height: number, iconOnly: number, buttons: ToolbarButton[] }
  cards: CardLayout[]
  footer: { buttonWidth: number, contentWidth: number, height: number, buttons: Fit[] }
  micros: number
}

export type ModelInput = { width: number, scale: number, lang: Lang, text: ScreenText, fonts: Fonts }

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

  // The largest size on one line if any size allows it, else on two, else on as many lines as it
  // takes; null when no size in the range fits at all (a piece no width breaks is wider than the box).
  function fitPlain(s: PreparedSizes, r: RoleFont, width: number, tries: number[]): Fit | null {
    const lh = (px: number) => lineHeightAt(r, px)
    for (const maxLines of tries) {
      const f = fitFontSize(s, { width, maxLines }, lh)
      if (f !== null) return { px: f.px, lineHeight: lh(f.px), lines: f.lineCount }
    }
    return null
  }
  function fitRich(s: PreparedSizesRich, r: RoleFont, width: number, tries: number[]): Fit | null {
    const lh = (px: number) => lineHeightAt(r, px)
    for (const maxLines of tries) {
      const f = fitFontSizeRich(s, { width, maxLines }, lh)
      if (f !== null) return { px: f.px, lineHeight: lh(f.px), lines: f.lineCount }
    }
    return null
  }
  // One size for a row of labels (a toolbar, a pair of buttons), as a design system would want:
  // the largest size at which every label fits, found by fitting each label below the current
  // candidate until they all agree. Each fit is at or below the candidate, so the candidate only
  // falls, and it stops where every label's own fit returned it, so every label fits at it by the
  // kit's own answer; nothing is assumed about smaller sizes fitting. One line for all if that
  // works, else up to two lines for all; null if not even that.
  function fitTogether(fitAt: (i: number, max: number, maxLines: number) => Fit | null, n: number, min: number, max: number, tries: number[]): Fit[] | null {
    for (const maxLines of tries) {
      let u = max
      let fits: Fit[] | null = []
      for (;;) {
        fits = []
        for (let i = 0; i < n; i++) {
          const f = fitAt(i, u, maxLines)
          if (f === null) { fits = null; break }
          fits.push(f)
        }
        if (fits === null) break
        const lowest = Math.min(...fits.map(f => f.px))
        if (fits.every(f => f.px === u) || lowest < min) break
        u = lowest
      }
      if (fits !== null) return fits
    }
    return null
  }

  // Every box on this screen holds its text at the smallest size; if one didn't, the layout below
  // would have no height for it, and guessing one would be correcting the kit.
  function must<T>(f: T | null, what: string): T {
    if (f === null) throw new Error(`${what} does not fit its box even at the smallest size`)
    return f
  }

  function layout({ width, scale, text: t, fonts }: ModelInput): ScreenLayout {
    const t0 = performance.now()
    const at = (base: number) => Math.max(1, Math.round(base * scale))
    const inner = width - 2 * SCREEN_PAD

    const appPx = at(fonts.app.size)
    const app = { px: appPx, lineHeight: lineHeightAt(fonts.app, appPx) }

    // Toolbar: four equal buttons; each label with its icon is one rich row fitted between the
    // stylesheet's size and a floor, on one line if it can, else two.
    const buttonWidth = Math.floor((inner - TOOLBAR_GAP * (t.toolbar.length - 1)) / t.toolbar.length)
    const contentWidth = buttonWidth - 2 * BUTTON_PAD_X
    const labelMax = at(fonts.label.size)
    const labelMin = Math.min(labelMax, at(11))
    const together = fitTogether((i, max, maxLines) => {
      const s = t.toolbar[i]!
      const items = (px: number): Array<RichInlineItem | RichInlineBox> =>
        [{ width: iconAt(px) + iconGapAt(px) }, { text: s, font: fontAt(fonts.label, px) }]
      return fitRich(sizedRich(`label|${fonts.label.style.fontFamily}\n${s}`, items, labelMin, max), fonts.label, contentWidth, [maxLines])
    }, t.toolbar.length, labelMin, labelMax, [1, 2])
    // No common size fits even on two lines: every button shows its icon only.
    const buttons: ToolbarButton[] = t.toolbar.map((_, i) => ({ fit: together === null ? null : together[i]! }))
    let toolbarInner = 0
    const iconOnly = iconAt(labelMin)
    for (const b of buttons) toolbarInner = Math.max(toolbarInner, b.fit === null ? iconOnly : b.fit.lines * b.fit.lineHeight)
    const toolbar = { buttonWidth, contentWidth, height: toolbarInner + 2 * BUTTON_PAD_Y, iconOnly, buttons }

    // Cards: the model's columns, equal widths.
    const columns = columnsAt(width)
    const cardWidth = Math.floor((inner - CARD_GAP * (columns - 1)) / columns)
    const cw = cardWidth - 2 * CARD_PAD
    const titlePx = at(fonts.title.size)
    const titleFont = fontAt(fonts.title, titlePx)
    const bodyPx = at(fonts.body.size)
    const bodyFont = fontAt(fonts.body, bodyPx)
    const filePx = at(fonts.file.size)
    const fileFont = fontAt(fonts.file, filePx)
    const metaMax = at(fonts.meta.size)
    const metaMin = Math.min(metaMax, at(10))
    const badgeMax = at(fonts.badge.size)
    const badgeMin = Math.min(badgeMax, at(9))
    const badgeWidth = Math.min(Math.max(Math.round(cw * 0.36), 88), 150)
    const badgeContent = badgeWidth - 2 * BADGE_PAD_X
    const metaWidth = cw - badgeWidth - HEAD_GAP

    const cards: CardLayout[] = t.cards.map(c => {
      // The case row: an icon, the case number as a chip that never breaks, then the name.
      const metaItems = (px: number): Array<RichInlineItem | RichInlineBox> => [
        { width: iconAt(px) + iconGapAt(px) },
        { text: c.id, font: fontAt(fonts.chip, px), break: 'never', extraWidth: 2 * CHIP_PAD_X },
        { text: ' ' + c.name, font: fontAt(fonts.meta, px) },
      ]
      const metaFit = must(fitRich(sizedRich(`meta|${fonts.meta.style.fontFamily}\n${c.id}\n${c.name}`, metaItems, metaMin, metaMax), fonts.meta, metaWidth, ANY), c.id)
      const badgeFit = must(fitPlain(sized(c.badge, fonts.badge, badgeMin, badgeMax), fonts.badge, badgeContent, ANY), c.badge)
      const headHeight = Math.max(metaFit.lines * metaFit.lineHeight, badgeFit.lines * badgeFit.lineHeight + 2 * BADGE_PAD_Y)

      // Title: the narrowest width that keeps its line count, so no line ends on an orphan.
      const titleLh = lineHeightAt(fonts.title, titlePx)
      const bal = balance(text(c.title, titleFont), cw)

      // Body: three lines, cut with an ellipsis measured in the body's font.
      const bodyLh = lineHeightAt(fonts.body, bodyPx)
      const cl = clamp(text(c.body, bodyFont), cw, BODY_LINES, tail(bodyFont))

      // Attachment: the file name keeps its date and extension, the cut falls in the middle.
      const fileWidth = cw - FILE_ICON - FILE_ICON_GAP
      const fileText = truncateMiddle(label(c.file, fileFont), fileWidth, { from: c.file.lastIndexOf('_') })
      const fileLh = lineHeightAt(fonts.file, filePx)

      const height = 2 * CARD_PAD + headHeight + SECTION_GAP + bal.lineCount * titleLh + SECTION_GAP
        + cl.lineCount * bodyLh + SECTION_GAP + fileLh
      return {
        meta: { ...metaFit, width: metaWidth },
        badge: { ...badgeFit, width: badgeWidth, contentWidth: badgeContent },
        headHeight,
        title: { width: bal.width, lines: bal.lineCount, px: titlePx, lineHeight: titleLh },
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

    // Footer: two buttons, each label fitted to its button.
    const footerButton = Math.min(260, Math.floor((inner - FOOTER_GAP) / 2))
    const footerContent = footerButton - 2 * FOOTER_PAD_X
    const buttonMax = at(fonts.button.size)
    const buttonMin = Math.min(buttonMax, at(12))
    const footerLabels = [t.secondary, t.primary]
    const footerButtons = must(fitTogether((i, max, maxLines) =>
      fitPlain(sized(footerLabels[i]!, fonts.button, buttonMin, max), fonts.button, footerContent, [maxLines]),
    footerLabels.length, buttonMin, buttonMax, ANY), 'the footer buttons')
    let footerInner = 0
    for (const b of footerButtons) footerInner = Math.max(footerInner, b.lines * b.lineHeight)

    return {
      width, scale, columns, cardWidth, cardContentWidth: cw, app, toolbar, cards,
      footer: { buttonWidth: footerButton, contentWidth: footerContent, height: footerInner + 2 * FOOTER_PAD_Y, buttons: footerButtons },
      micros: (performance.now() - t0) * 1000,
    }
  }

  return {
    layout,
    reset() { texts.clear(); sizes.clear(); rich.clear(); labels.clear(); tails.clear() },
    handles() { return texts.size + sizes.size + rich.size + labels.size },
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

// side 'kit' gets the soft-hyphenated strings and inline sizes; 'css' gets the plain strings and the stylesheet.
export function buildScreen(side: 'kit' | 'css', lang: Lang, t: ScreenText): ScreenDom {
  const root = el('div', `screen ${side}`)
  root.lang = lang
  const bar = el('div', 'appbar')
  const app = el('div', 'app-title role-app', t.app)
  bar.append(app)
  const toolbarBox = el('div', 'toolbar')
  const toolbar = t.toolbar.map((s, i) => {
    const button = el('div', 'tb')
    const content = el('div', 'tb-content role-label')
    const ic = icon(ICONS[i]!)
    const text = el('span', 'tb-text', s)
    content.append(ic, text)
    button.append(content)
    button.dataset.check = ''
    if (side === 'kit') content.dataset.check = ''
    toolbarBox.append(button)
    return { button, content, icon: ic, text }
  })
  const cardsBox = el('div', 'cards')
  const cards = t.cards.map(c => {
    const card = el('article', 'card')
    card.dataset.check = ''
    const head = el('div', 'card-head')
    const meta = el('div', 'meta role-meta')
    meta.dataset.check = ''
    const metaIcon = icon(CASE_ICON)
    const chip = el('span', 'chip role-chip', c.id)
    meta.append(metaIcon, chip, document.createTextNode(' ' + c.name))
    const badge = el('div', 'badge')
    const badgeText = el('div', 'badge-text role-badge', c.badge)
    badgeText.dataset.check = ''
    badge.append(badgeText)
    head.append(meta, badge)
    const title = el('h3', 'title role-title', c.title)
    if (side === 'kit') title.dataset.check = ''
    const body = el('div', 'body role-body')
    if (side === 'css') body.textContent = c.body
    const file = el('div', 'file role-file')
    const fileName = el('span', 'file-name', c.file)
    if (side === 'kit') fileName.dataset.check = ''
    file.append(icon(FILE_ICON_PATH), fileName)
    card.append(head, title, body, file)
    cardsBox.append(card)
    return { card, head, meta, metaIcon, chip, badge, badgeText, title, body, file, fileName }
  })
  const footer = el('div', 'footer')
  const footerButtons = [t.secondary, t.primary].map((s, i) => {
    const button = el('div', `btn ${i === 0 ? 'secondary' : 'primary'}`)
    const label = el('div', 'btn-label role-button', s)
    button.dataset.check = ''
    if (side === 'kit') label.dataset.check = ''
    button.append(label)
    footer.append(button)
    return { button, label }
  })
  root.append(bar, toolbarBox, cardsBox, footer)
  return { root, toolbar, app, cardsBox, cards, footer, footerButtons }
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

export function paintKit(d: ScreenDom, L: ScreenLayout, body: string[][]): void {
  d.root.style.width = px(L.width)
  d.app.style.fontSize = px(L.app.px)
  d.app.style.lineHeight = px(L.app.lineHeight)

  for (let i = 0; i < d.toolbar.length; i++) {
    const b = d.toolbar[i]!
    const fit = L.toolbar.buttons[i]!.fit
    b.button.style.width = px(L.toolbar.buttonWidth)
    b.button.style.height = px(L.toolbar.height)
    b.content.style.width = px(L.toolbar.contentWidth)
    if (fit === null) {
      // No size fits: the model drops the label and keeps the icon, sized for the smallest label.
      b.text.style.display = 'none'
      delete b.content.dataset.lines
      b.content.style.fontSize = ''
      b.content.style.lineHeight = px(L.toolbar.iconOnly)
      b.content.style.textAlign = 'center'
      paintIcon(b.icon, L.toolbar.iconOnly, 0, L.toolbar.iconOnly)
      b.content.style.height = px(L.toolbar.iconOnly)
    } else {
      b.text.style.display = ''
      b.content.style.textAlign = ''
      b.content.style.height = ''
      b.content.style.fontSize = px(fit.px)
      b.content.style.lineHeight = px(fit.lineHeight)
      b.content.dataset.lines = String(fit.lines)
      paintIcon(b.icon, iconAt(fit.px), iconGapAt(fit.px), fit.lineHeight)
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
    paintIcon(c.metaIcon, iconAt(k.meta.px), iconGapAt(k.meta.px), k.meta.lineHeight)
    c.badge.style.width = px(k.badge.width)
    c.badgeText.style.width = px(k.badge.contentWidth)
    c.badgeText.style.fontSize = px(k.badge.px)
    c.badgeText.style.lineHeight = px(k.badge.lineHeight)
    c.badgeText.dataset.lines = String(k.badge.lines)
    c.title.style.width = px(k.title.width)
    c.title.style.fontSize = px(k.title.px)
    c.title.style.lineHeight = px(k.title.lineHeight)
    c.title.dataset.lines = String(k.title.lines)
    c.body.style.fontSize = px(k.body.px)
    c.body.style.lineHeight = px(k.body.lineHeight)
    c.body.style.width = px(L.cardContentWidth)
    const lines = body[i]!
    const next = k.body.lines.map((l, j) => l.text + (k.body.truncated && j === k.body.lines.length - 1 ? '…' : ''))
    if (lines.length !== next.length || lines.some((s, j) => s !== next[j])) {
      c.body.replaceChildren(...next.map(s => { const line = el('div', 'line', s); line.dataset.pretextLine = ''; return line }))
      body[i] = next
    }
    c.file.style.fontSize = px(k.file.px)
    c.file.style.lineHeight = px(k.file.lineHeight)
    c.fileName.style.width = px(k.file.width)
    c.fileName.textContent = k.file.text
  }

  d.footer.style.height = px(L.footer.height)
  for (let i = 0; i < d.footerButtons.length; i++) {
    const b = d.footerButtons[i]!
    const f = L.footer.buttons[i]!
    b.button.style.width = px(L.footer.buttonWidth)
    b.label.style.width = px(L.footer.contentWidth)
    b.label.style.fontSize = px(f.px)
    b.label.style.lineHeight = px(f.lineHeight)
    b.label.dataset.lines = String(f.lines)
  }
}

// The CSS side: only the screen width (the slider) and the text-size setting come from the page.
export function paintCss(d: ScreenDom, width: number, scale: number): void {
  d.root.style.width = px(width)
  d.root.style.setProperty('--s', String(scale))
}

// Boxes whose content doesn't fit them: clipped, cut by an ellipsis, or spilling out. Read after
// painting, for the reader only; nothing here feeds back into the layout.
//
// On the kit side an overflow has two possible causes, told apart the way verify/RESULTS.md does:
// a paragraph the browser wrapped into a different number of lines than Pretext laid out (or a line
// Pretext fitted that paints wider), which is a pretext-gap, and anything else, which would be the
// kit's own mistake. Each kit paragraph carries Pretext's line count in data-lines.
export type Overflow = { boxes: number, gaps: number, detail: string[] }

function over(e: HTMLElement): boolean {
  return e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5
}

function describe(e: HTMLElement): string {
  return `${e.className.split(' ')[0]} "${(e.textContent ?? '').replace(/\u00AD/g, '').slice(0, 48)}"`
}

export function measureOverflow(root: HTMLElement): Overflow {
  const gapEls: HTMLElement[] = []
  const detail: string[] = []
  for (const e of root.querySelectorAll<HTMLElement>('[data-lines]')) {
    const lh = Number.parseFloat(e.style.lineHeight)
    const painted = Math.round(e.getBoundingClientRect().height / lh)
    const predicted = Number(e.dataset.lines)
    if (painted !== predicted) {
      gapEls.push(e)
      detail.push(`pretext-gap: ${describe(e)} painted ${painted} lines, Pretext laid out ${predicted} at ${e.style.width}`)
    }
  }
  for (const e of root.querySelectorAll<HTMLElement>('[data-pretext-line]')) {
    if (over(e)) {
      gapEls.push(e)
      detail.push(`pretext-gap: ${describe(e)} paints ${e.scrollWidth}px in ${e.clientWidth}px; Pretext fitted it`)
    }
  }
  let boxes = 0
  for (const e of root.querySelectorAll<HTMLElement>('[data-check]')) {
    if (!over(e) || gapEls.some(g => e === g || e.contains(g))) continue
    boxes++
    detail.push(`overflow: ${describe(e)} ${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight}`)
  }
  return { boxes, gaps: gapEls.length, detail }
}

export function summary(L: ScreenLayout): { label: string, value: string }[] {
  const list = (xs: (number | string)[]) => xs.join(' / ')
  return [
    { label: 'Screen', value: `${L.width}px, ${L.columns} col` },
    { label: 'Toolbar labels', value: list(L.toolbar.buttons.map(b => b.fit === null ? 'icon' : `${b.fit.px}px${b.fit.lines > 1 ? '×2' : ''}`)) },
    { label: 'Case rows', value: list(L.cards.map(c => `${c.meta.px}px`)) },
    { label: 'Badges', value: list(L.cards.map(c => `${c.badge.px}px${c.badge.lines > 1 ? '×2' : ''}`)) },
    { label: 'Titles (balanced)', value: list(L.cards.map(c => `${c.title.width}px·${c.title.lines}`)) },
    { label: 'Body lines', value: list(L.cards.map(c => `${c.body.lines.length}${c.body.truncated ? '…' : ''}`)) },
    { label: 'Buttons', value: list(L.footer.buttons.map(b => `${b.px}px${b.lines > 1 ? '×2' : ''}`)) },
  ]
}

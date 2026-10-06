// The kit's screen and the best-effort CSS screen, side by side (or stacked when the page is narrow).

import { buildScreen, measureOverflow, paintCss, paintKit } from './screen.ts'
import type { Fonts, Overflow, ScreenDom, ScreenLayout } from './screen.ts'
import { STRINGS } from './strings.ts'
import type { Lang } from './strings.ts'

export type CssFacts = { toolbarRows: number, footerRows: number, badgesCut: number }
export type Pair = {
  lang: Lang
  setLang(lang: Lang): void
  paint(L: ScreenLayout, fonts: Fonts): { kit: Overflow, css: Overflow, facts: CssFacts }
}

// What the best-effort CSS did, read from the DOM after painting, for the reader: how many rows its
// toolbar and buttons wrapped into, and how many badges an ellipsis cut.
function rowsOf(els: Iterable<HTMLElement>): number {
  return new Set([...els].map(e => Math.round(e.offsetTop))).size
}
function factsOf(root: HTMLElement): CssFacts {
  return {
    toolbarRows: rowsOf(root.querySelectorAll<HTMLElement>('.tb')),
    footerRows: rowsOf(root.querySelectorAll<HTMLElement>('.btn')),
    badgesCut: [...root.querySelectorAll<HTMLElement>('.badge-text')].filter(e => e.scrollWidth > e.clientWidth + 0.5).length,
  }
}

function frame(name: string, note: string): { section: HTMLElement, count: HTMLElement, slot: HTMLElement } {
  const section = document.createElement('section')
  section.className = 'frame'
  const head = document.createElement('header')
  head.className = 'frame-head'
  const title = document.createElement('span')
  title.className = 'frame-name'
  title.textContent = name
  const sub = document.createElement('span')
  sub.className = 'frame-note'
  sub.textContent = note
  const count = document.createElement('span')
  count.className = 'frame-count'
  head.append(title, sub, count)
  const slot = document.createElement('div')
  slot.className = 'frame-slot'
  section.append(head, slot)
  return { section, count, slot }
}

export function createPair(host: HTMLElement, lang: Lang): Pair {
  const kitFrame = frame('pretext-kit', 'sizes from the model')
  const cssFrame = frame('best-effort CSS', 'wrapping, auto heights, balance, line-clamp')
  kitFrame.section.dataset.side = 'kit'
  cssFrame.section.dataset.side = 'css'
  host.append(kitFrame.section, cssFrame.section)
  let kit: ScreenDom
  let css: ScreenDom
  let body: string[][] = []
  const pair: Pair = {
    lang,
    setLang(l) {
      pair.lang = l
      kit = buildScreen('kit', l, STRINGS[l])
      css = buildScreen('css', l, STRINGS[l])
      body = [[], [], []]
      kitFrame.slot.replaceChildren(kit.root)
      cssFrame.slot.replaceChildren(css.root)
    },
    paint(L, fonts) {
      paintKit(kit, L, body, fonts)
      paintCss(css, L.width, L.scale)
      const k = measureOverflow(kit.root)
      const c = measureOverflow(css.root)
      show(kitFrame, k)
      show(cssFrame, c)
      return { kit: k, css: c, facts: factsOf(css.root) }
    },
  }
  pair.setLang(lang)
  return pair
}

function show(f: { section: HTMLElement, count: HTMLElement }, o: Overflow): void {
  const parts: string[] = []
  if (o.boxes > 0) parts.push(`${o.boxes} ${o.boxes === 1 ? 'box' : 'boxes'} clipped or overflowing`)
  if (o.gaps > 0) parts.push(`${o.gaps} where the browser wrapped other than Pretext's own layout (pretext-gap)`)
  const text = parts.length === 0 ? 'everything fits' : parts.join(', ')
  if (f.count.textContent !== text) f.count.textContent = text
  f.count.title = o.detail.join('\n')
  f.count.classList.toggle('bad', o.boxes > 0)
  f.count.classList.toggle('gap', o.boxes === 0 && o.gaps > 0)
  // For examples/check.ts.
  f.section.dataset.boxes = String(o.boxes)
  f.section.dataset.gaps = String(o.gaps)
  f.section.dataset.detail = JSON.stringify(o.detail)
}

export function cssFactsText(f: CssFacts): string {
  const rows = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`
  return `toolbar in ${rows(f.toolbarRows)}, buttons in ${rows(f.footerRows)}, ${f.badgesCut} ${f.badgesCut === 1 ? 'badge' : 'badges'} cut by an ellipsis`
}

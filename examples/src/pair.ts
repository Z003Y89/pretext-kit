// The kit's screen and the fixed-size CSS screen, side by side (or stacked when the page is narrow).

import { buildScreen, measureOverflow, paintCss, paintKit } from './screen.ts'
import type { Overflow, ScreenDom, ScreenLayout } from './screen.ts'
import { STRINGS, kitStrings } from './strings.ts'
import type { Lang } from './strings.ts'

export type Pair = {
  lang: Lang
  setLang(lang: Lang): void
  paint(L: ScreenLayout): { kit: Overflow, css: Overflow }
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
  const cssFrame = frame('fixed-size CSS', 'sizes from the stylesheet')
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
      kit = buildScreen('kit', l, kitStrings(l))
      css = buildScreen('css', l, STRINGS[l])
      body = [[], [], []]
      kitFrame.slot.replaceChildren(kit.root)
      cssFrame.slot.replaceChildren(css.root)
    },
    paint(L) {
      paintKit(kit, L, body)
      paintCss(css, L.width, L.scale)
      const k = measureOverflow(kit.root)
      const c = measureOverflow(css.root)
      show(kitFrame, k)
      show(cssFrame, c)
      return { kit: k, css: c }
    },
  }
  pair.setLang(lang)
  return pair
}

function show(f: { section: HTMLElement, count: HTMLElement }, o: Overflow): void {
  const parts: string[] = []
  if (o.boxes > 0) parts.push(`${o.boxes} ${o.boxes === 1 ? 'box' : 'boxes'} clipped or overflowing`)
  if (o.gaps > 0) parts.push(`${o.gaps} where the browser wrapped other than Pretext (pretext-gap)`)
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

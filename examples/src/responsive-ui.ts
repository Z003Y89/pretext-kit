// responsive-ui: one app screen at a draggable width, laid out by the kit beside fixed-size CSS.

import { byId, columnWidth, createTimer, frameCost, setReadout, startPage } from './page.ts'
import { createPair } from './pair.ts'
import { summary } from './screen.ts'
import { kitStrings } from './strings.ts'
import type { Lang } from './strings.ts'

const MIN = 320
const MAX = 1440

const slider = byId<HTMLInputElement>('width')
const widthOut = byId<HTMLOutputElement>('width-out')
const stage = byId<HTMLElement>('stage')
const readout = byId<HTMLElement>('readout')
const langBox = byId<HTMLElement>('lang')

const st = { requested: Number(slider.value), lang: 'en' as Lang }
const timer = createTimer()
const pair = createPair(stage, st.lang)
const page = startPage(render)

slider.addEventListener('input', () => { st.requested = Number(slider.value); page.schedule() })
for (const b of langBox.querySelectorAll<HTMLButtonElement>('button')) {
  b.addEventListener('click', () => {
    st.lang = b.value as Lang
    for (const o of langBox.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b))
    page.schedule()
  })
}
render()

function render(): void {
  // The widest screen the page column can show; the slider never asks for more.
  const max = Math.max(MIN, Math.min(MAX, columnWidth(stage)))
  if (Number(slider.max) !== max) slider.max = String(max)
  const width = Math.max(MIN, Math.min(st.requested, max))
  if (pair.lang !== st.lang) pair.setLang(st.lang)
  const before = page.model.handles()
  const L = page.model.layout({ width, scale: 1, lang: st.lang, text: kitStrings(st.lang), fonts: page.fonts() })
  const counts = pair.paint(L)
  widthOut.textContent = `${width}px`
  setReadout(readout, [
    ...summary(L),
    { label: 'Kit time this frame', value: frameCost(L.micros, page.model.handles() - before, timer) },
    { label: 'Boxes that overflow', value: `kit ${counts.kit.boxes} (pretext-gap ${counts.kit.gaps}), CSS ${counts.css.boxes}` },
  ])
  document.documentElement.dataset.ready = 'true'
}

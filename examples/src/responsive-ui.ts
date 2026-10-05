// responsive-ui: one app screen at a draggable width, laid out by the kit beside best-effort CSS,
// and a 2,000-row list whose heights the kit knows before rendering.

import { byId, columnWidth, createTimer, frameCost, setReadout, startPage } from './page.ts'
import { createPair, cssFactsText } from './pair.ts'
import { summary } from './screen.ts'
import { STRINGS, hyphenatedTitles } from './strings.ts'
import type { Lang } from './strings.ts'
import { createListPanel } from './vlist.ts'

const MIN = 320
const MAX = 1440

const slider = byId<HTMLInputElement>('width')
const widthOut = byId<HTMLOutputElement>('width-out')
const stage = byId<HTMLElement>('stage')
const readout = byId<HTMLElement>('readout')
const langBox = byId<HTMLElement>('lang')
const listStage = byId<HTMLElement>('list-stage')

const st = { requested: Number(slider.value), lang: 'en' as Lang }
const timer = createTimer()
const pair = createPair(stage, st.lang)
const page = startPage(render)
const list = createListPanel(listStage, () => page.schedule())

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
  const column = columnWidth(stage)
  const max = Math.max(MIN, Math.min(MAX, column))
  if (Number(slider.max) !== max) slider.max = String(max)
  const width = Math.max(MIN, Math.min(st.requested, max))
  if (pair.lang !== st.lang) pair.setLang(st.lang)
  const before = page.model.handles()
  const L = page.model.layout({ width, scale: 1, lang: st.lang, text: STRINGS[st.lang], titles: hyphenatedTitles(st.lang), fonts: page.fonts() })
  const counts = pair.paint(L, page.fonts())
  // The list follows the slider too (40% of the screen width), so a width change shows the anchor.
  list.paint(Math.min(column, Math.max(280, Math.min(480, Math.round(width * 0.4)))), page.fonts(), page.epoch())
  widthOut.textContent = `${width}px`
  setReadout(readout, [
    ...summary(L),
    { label: 'Kit time this frame', value: frameCost(L.micros, page.model.handles() - before, timer) },
    { label: 'Boxes that overflow', value: `kit ${counts.kit.boxes} (pretext-gap ${counts.kit.gaps}), CSS ${counts.css.boxes}` },
    { label: 'Best-effort CSS did', value: cssFactsText(counts.facts) },
  ])
  document.documentElement.dataset.ready = 'true'
}

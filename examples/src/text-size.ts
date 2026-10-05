// text-size: an app-wide text-size setting (0.8–1.5×) on a screen of fixed width. The kit fits every
// label again within the scaled range; the fixed-size CSS keeps its boxes and lets the text spill.

import { byId, columnWidth, createTimer, frameCost, setReadout, startPage } from './page.ts'
import { createPair } from './pair.ts'
import { summary } from './screen.ts'
import { kitStrings } from './strings.ts'
import type { Lang } from './strings.ts'

const SCREEN_MAX = 600
const SCREEN_MIN = 320
const GAP = 24

const slider = byId<HTMLInputElement>('scale')
const scaleOut = byId<HTMLOutputElement>('scale-out')
const stage = byId<HTMLElement>('stage')
const readout = byId<HTMLElement>('readout')
const langBox = byId<HTMLElement>('lang')

const st = { scale: Number(slider.value), lang: 'de' as Lang }
const timer = createTimer()
const pair = createPair(stage, st.lang)
const page = startPage(render)

slider.addEventListener('input', () => { st.scale = Number(slider.value); page.schedule() })
for (const b of langBox.querySelectorAll<HTMLButtonElement>('button')) {
  b.addEventListener('click', () => {
    st.lang = b.value as Lang
    for (const o of langBox.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b))
    page.schedule()
  })
}
render()

function render(): void {
  // A phone-to-small-tablet width: half the page column where both screens fit side by side, else all of it.
  const column = columnWidth(stage)
  const half = Math.floor((column - GAP) / 2)
  const width = Math.max(SCREEN_MIN, Math.min(SCREEN_MAX, half >= 360 ? half : column))
  if (pair.lang !== st.lang) pair.setLang(st.lang)
  const before = page.model.handles()
  const L = page.model.layout({ width, scale: st.scale, lang: st.lang, text: kitStrings(st.lang), fonts: page.fonts() })
  const counts = pair.paint(L)
  scaleOut.textContent = `${st.scale.toFixed(2)}×`
  setReadout(readout, [
    { label: 'Text size', value: `${st.scale.toFixed(2)}× (title ${L.cards[0]!.title.px}px, body ${L.cards[0]!.body.px}px)` },
    ...summary(L),
    { label: 'Kit time this frame', value: frameCost(L.micros, page.model.handles() - before, timer) },
    { label: 'Boxes that overflow', value: `kit ${counts.kit.boxes} (pretext-gap ${counts.kit.gaps}), CSS ${counts.css.boxes}` },
  ])
  document.documentElement.dataset.ready = 'true'
}

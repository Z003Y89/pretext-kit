// languages: the same screen in English, German and French at one width. The kit side prepares
// soft-hyphenated strings (hyphenated once, at build time, by the `hyphen` package) and paints them
// with `hyphens: manual`; the CSS side paints the plain strings with `hyphens: auto` and its `lang`.

import { byId, columnWidth, createTimer, frameCost, setReadout, startPage } from './page.ts'
import { createPair } from './pair.ts'
import type { Pair } from './pair.ts'
import type { ScreenLayout } from './screen.ts'
import { LANGS, LANG_NAMES, kitStrings } from './strings.ts'

const MIN = 320
const MAX = 760

const slider = byId<HTMLInputElement>('width')
const widthOut = byId<HTMLOutputElement>('width-out')
const stage = byId<HTMLElement>('stage')
const readout = byId<HTMLElement>('readout')

const st = { requested: Number(slider.value) }
const timer = createTimer()

const blocks: { pair: Pair, lang: typeof LANGS[number] }[] = LANGS.map(lang => {
  const block = document.createElement('section')
  block.className = 'lang-block'
  const h = document.createElement('h2')
  h.textContent = LANG_NAMES[lang]
  const hy = document.createElement('p')
  hy.className = 'hyph'
  // The break points the kit was given: each soft hyphen shown as a middle dot.
  const t = kitStrings(lang)
  hy.textContent = lang === 'en'
    ? 'English strings carry no soft hyphens here; both sides break at spaces only.'
    : `Soft hyphens from hyphen/${lang}: ${[t.toolbar[1], t.primary, t.secondary].map(s => s.replace(/\u00AD/g, '·')).join(';  ')}`
  const host = document.createElement('div')
  host.className = 'stage'
  block.append(h, hy, host)
  stage.append(block)
  return { pair: createPair(host, lang), lang }
})

const page = startPage(render)
slider.addEventListener('input', () => { st.requested = Number(slider.value); page.schedule() })
render()

function render(): void {
  const max = Math.max(MIN, Math.min(MAX, columnWidth(stage)))
  if (Number(slider.max) !== max) slider.max = String(max)
  const width = Math.max(MIN, Math.min(st.requested, max))
  let micros = 0
  const before = page.model.handles()
  const rows: { label: string, value: string }[] = []
  const counts = { kit: 0, gaps: 0, css: 0 }
  for (const { pair, lang } of blocks) {
    const L: ScreenLayout = page.model.layout({ width, scale: 1, lang, text: kitStrings(lang), fonts: page.fonts() })
    micros += L.micros
    const c = pair.paint(L)
    counts.kit += c.kit.boxes
    counts.gaps += c.kit.gaps
    counts.css += c.css.boxes
    rows.push({
      label: LANG_NAMES[lang],
      value: `toolbar ${L.toolbar.buttons.map(b => b.fit === null ? 'icon' : `${b.fit.px}${b.fit.lines > 1 ? '×2' : ''}`).join('/')}, `
        + `buttons ${L.footer.buttons.map(b => `${b.px}${b.lines > 1 ? '×2' : ''}`).join('/')} px`,
    })
  }
  widthOut.textContent = `${width}px`
  setReadout(readout, [
    { label: 'Screen', value: `${width}px` },
    ...rows,
    { label: 'Kit time this frame (3 screens)', value: frameCost(micros, page.model.handles() - before, timer) },
    { label: 'Boxes that overflow', value: `kit ${counts.kit} (pretext-gap ${counts.gaps}), CSS ${counts.css}` },
  ])
  document.documentElement.dataset.ready = 'true'
}

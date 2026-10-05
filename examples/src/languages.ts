// languages: the same screen in English, German and French at one width. Both sides get the same
// strings. Badges are never hyphenated, and labels and buttons only at compound joints written into
// the German strings, which the kit uses only for a word wider than the room: it reflows its rows first. A title
// word wider than the card gets the soft hyphens the build put in (`hyphen` TeX patterns), and only
// that word; the CSS side uses hyphens: auto on titles, with each block's lang.

import { byId, columnWidth, createTimer, frameCost, setReadout, startPage } from './page.ts'
import { createPair } from './pair.ts'
import type { Pair } from './pair.ts'
import type { Row, ScreenLayout } from './screen.ts'
import { LANGS, LANG_NAMES, STRINGS, hyphenatedTitles } from './strings.ts'

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
  // The break points the kit may use, for the long title words only: each soft hyphen as a middle dot.
  const long = hyphenatedTitles(lang).flatMap(t => t.split(' ')).filter(w => w.replace(/\u00AD/g, '').length >= 13)
  hy.textContent = long.length === 0
    ? 'No title word here is long enough to need hyphenation.'
    : `Title words the kit may hyphenate, only when one is wider than its card: ${long.map(w => w.replace(/\u00AD/g, '·')).join(', ')}`
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
    const L: ScreenLayout = page.model.layout({ width, scale: 1, lang, text: STRINGS[lang], titles: hyphenatedTitles(lang), fonts: page.fonts() })
    micros += L.micros
    const c = pair.paint(L, page.fonts())
    counts.kit += c.kit.boxes
    counts.gaps += c.kit.gaps
    counts.css += c.css.boxes
    rows.push({
      label: LANG_NAMES[lang],
      value: `toolbar ${rowText(L.toolbar)}; buttons ${rowText(L.footer)}`,
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

function rowText(r: Row): string {
  return `${r.mode} ${r.buttons.map(b => b.fit === null ? 'icon' : `${b.fit.px}${b.fit.lines > 1 ? '×2' : ''}`).join('/')}`
}

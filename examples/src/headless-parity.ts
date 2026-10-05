// headless-parity: loads the Node side's numbers (headless-parity-data.json, written by
// pretext-kit/headless) and computes the same cases here, in this browser's Canvas, from the same
// font files loaded through @font-face under the same family aliases. Each row shows both and says
// whether they agree: the same line count and the same fitted size. Widths are a second readout.

import { agrees, compute, FACES, LABELS, SIZES, WIDTHS, WIDTH_TOLERANCE } from './parity.ts'
import type { Agreement, Case, ParityData, Result } from './parity.ts'
import { byId, setReadout } from './page.ts'

const st = { face: 0, size: SIZES[0]!, only: 'all' }
const summaryBox = byId<HTMLElement>('summary')
const browserLine = byId<HTMLElement>('browser')
const scopeLine = byId<HTMLElement>('scope')
const tableBox = byId<HTMLElement>('table')
const faceBox = byId<HTMLElement>('face-filter')
const sizeBox = byId<HTMLElement>('size-filter')
const onlyBox = byId<HTMLElement>('only-filter')

type Engine = 'chromium' | 'webkit' | 'firefox' | 'other'
function detect(): { name: string, engine: Engine, mac: boolean } {
  const ua = navigator.userAgent
  const mac = /Macintosh|Mac OS X/.test(ua)
  const m = (re: RegExp) => re.exec(ua)?.[1]
  const firefox = m(/Firefox\/([\d.]+)/)
  if (firefox !== undefined) return { name: `Firefox ${firefox}`, engine: 'firefox', mac }
  const edge = m(/Edg\/([\d.]+)/)
  if (edge !== undefined) return { name: `Edge ${edge} (Chromium)`, engine: 'chromium', mac }
  const chrome = m(/(?:Chrome|Chromium)\/([\d.]+)/)
  if (chrome !== undefined) return { name: `Chromium ${chrome}`, engine: 'chromium', mac }
  if (/AppleWebKit/.test(ua)) {
    const safari = m(/Version\/([\d.]+).*Safari/)
    return { name: `WebKit${safari !== undefined ? ` (Safari ${safari})` : ''}`, engine: 'webkit', mac }
  }
  return { name: ua, engine: 'other', mac }
}

function scopeOf(engine: Engine, mac: boolean): string {
  if (engine === 'chromium' && mac) return 'Chromium on macOS: the engine and platform measured; every number should match, widths included.'
  if (engine === 'chromium') return 'Chromium, not on macOS: the claim is measured on macOS; Windows and Linux are pending one check each, so a difference here is a finding, not a bug report yet.'
  return 'Outside the claim: Pretext here uses this engine\'s rules and Canvas, so line counts and fitted sizes are what to compare; widths differ by design.'
}

type Row = { node: Case, here: Case, ok: Agreement }
let rows: Row[] = []

async function loadFonts(): Promise<void> {
  for (const f of FACES) {
    const loaded = await document.fonts.load(`16px "${f.family}"`)
    if (loaded.length === 0 || loaded.some(x => x.status !== 'loaded')) throw new Error(`${f.file} did not load as "${f.family}"`)
  }
}

Promise.all([
  fetch('headless-parity-data.json').then(r => {
    if (!r.ok) throw new Error(`headless-parity-data.json: HTTP ${r.status}`)
    return r.json() as Promise<ParityData>
  }),
  loadFonts(),
]).then(([data]) => {
  const browser = detect()
  const t0 = performance.now()
  const here = compute()
  const ms = performance.now() - t0
  const key = (c: Case) => `${c.label}|${c.face}|${c.size}|${c.width}`
  const byKey = new Map(here.map(c => [key(c), c]))
  rows = data.cases.map(node => {
    const h = byKey.get(key(node))
    if (h === undefined) throw new Error(`no browser case for ${key(node)}`)
    return { node, here: h, ok: agrees(node, h) }
  })
  if (rows.length !== here.length) throw new Error(`${rows.length} Node cases, ${here.length} browser cases`)
  buildFilters()
  const agree = count(r => r.ok.primary)
  summarize(data, ms)
  browserLine.textContent = `${agree} of ${rows.length} agree in ${browser.name}: the same line count and the same fitted size.`
  browserLine.classList.toggle('done', agree === rows.length)
  scopeLine.textContent = scopeOf(browser.engine, browser.mac)
  render()
  const root = document.documentElement
  root.dataset.browser = browser.name
  root.dataset.agree = String(agree)
  root.dataset.strict = String(count(r => r.ok.strict))
  root.dataset.exact = String(count(r => r.ok.exact))
  root.dataset.within = String(count(r => r.ok.widest))
  root.dataset.total = String(rows.length)
  root.dataset.ready = 'true'
})

function seg(box: HTMLElement, values: string[], labels: string[], get: () => string, set: (v: string) => void): void {
  box.replaceChildren(...values.map((v, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.value = v
    b.textContent = labels[i]!
    b.setAttribute('aria-pressed', String(v === get()))
    b.addEventListener('click', () => {
      set(v)
      for (const o of box.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b))
      render()
    })
    return b
  }))
}

function buildFilters(): void {
  seg(faceBox, FACES.map((_, i) => String(i)), FACES.map(f => f.name), () => String(st.face), v => { st.face = Number(v) })
  seg(sizeBox, SIZES.map(String), SIZES.map(s => `${s}px`), () => String(st.size), v => { st.size = Number(v) })
  seg(onlyBox, ['all', 'differ'], ['All rows', 'Differences only'], () => st.only, v => { st.only = v })
}

const count = (f: (r: Row) => boolean) => rows.filter(f).length
// "0px" for no difference; otherwise enough digits to see how small it is.
const px = (d: number) => d === 0 ? '0px' : `${d < 0.001 ? d.toExponential(1) : d.toFixed(3)}px`

function summarize(data: ParityData, ms: number): void {
  const n = rows.length
  const deltas = rows.map(r => Math.abs(r.node.widest - r.here.widest)).sort((a, b) => a - b)
  const median = n % 2 === 1 ? deltas[(n - 1) / 2]! : (deltas[n / 2 - 1]! + deltas[n / 2]!) / 2
  const labelsOff = new Set(rows.filter(r => !r.ok.primary).map(r => r.node.label))
  setReadout(summaryBox, [
    { label: 'Agree', value: `${count(r => r.ok.primary)} of ${n}` },
    { label: 'Line counts equal', value: `${count(r => r.ok.lines)} of ${n}` },
    { label: 'Fitted sizes equal', value: `${count(r => r.ok.fit)} of ${n}` },
    { label: 'Labels with a difference', value: `${labelsOff.size} of ${LABELS.length}` },
    { label: `Widest line (tolerance ${WIDTH_TOLERANCE}px)`, value: `${count(r => r.ok.exact)} bit-exact, ${count(r => r.ok.widest)} within; median |Δ| ${px(median)}, max ${px(deltas[n - 1]!)}` },
    { label: 'Node side', value: `Node ${data.generated.node}, harfbuzzjs ${data.generated.harfbuzzjs}, Pretext ${data.generated.pretext}` },
    { label: 'This browser', value: `${n} cases in ${ms.toFixed(0)} ms` },
  ])
}

const fmtFit = (p: number | null) => p === null ? 'none' : `${p}px`
const visible = (s: string) => s.replaceAll('­', '·').replaceAll(' ', '⍽')

function render(): void {
  const shown = rows.filter(r => r.node.face === st.face && r.node.size === st.size)
  const table = document.createElement('table')
  table.className = 'grid parity'
  const head = table.createTHead().insertRow()
  head.append(th('Label'), ...WIDTHS.map(w => th(`${w}px box`)))
  const body = table.createTBody()
  const fontFamily = `"${FACES[st.face]!.family}"`
  let n = 0
  for (let label = 0; label < LABELS.length; label++) {
    const cells = WIDTHS.map(w => shown.find(r => r.node.label === label && r.node.width === w)!)
    const ok = cells.every(c => c.ok.primary)
    if (st.only === 'differ' && ok) continue
    n++
    const tr = body.insertRow()
    tr.className = ok ? 'agree' : 'differ'
    const name = document.createElement('th')
    name.scope = 'row'
    const tag = document.createElement('span')
    tag.className = 'lang'
    tag.textContent = LABELS[label]!.lang
    const text = document.createElement('span')
    text.className = 'label-text'
    text.style.fontFamily = fontFamily
    text.lang = LABELS[label]!.lang
    text.textContent = visible(LABELS[label]!.text)
    const mark = document.createElement('span')
    mark.className = ok ? 'mark ok' : 'mark bad'
    mark.textContent = ok ? 'agree' : 'differ'
    name.append(tag, text, mark)
    tr.append(name)
    for (const c of cells) tr.append(cell(c))
  }
  if (n === 0) {
    const tr = body.insertRow()
    const td = tr.insertCell()
    td.colSpan = WIDTHS.length + 1
    td.className = 'empty'
    td.textContent = 'No differences for this font and size.'
  }
  const wrap = document.createElement('div')
  wrap.className = 'grid-wrap parity-wrap'
  wrap.append(table)
  const cue = document.createElement('p')
  cue.className = 'scroll-cue'
  cue.textContent = 'The table scrolls sideways: three box widths.'
  tableBox.replaceChildren(cue, wrap)
}

function cell(r: Row): HTMLTableCellElement {
  const td = document.createElement('td')
  const box = document.createElement('div')
  box.className = `pc ${r.ok.primary ? 'c-pass' : 'c-mismatch'}`
  const line = (who: string, x: Result) => {
    const d = document.createElement('div')
    d.className = 'pc-line'
    const w = document.createElement('span')
    w.className = 'who'
    w.textContent = who
    const parts = [
      [`${x.lines} ${x.lines === 1 ? 'line' : 'lines'}`, r.ok.lines ? '' : 'off'],
      [`fit ${fmtFit(x.fit)}`, r.ok.fit ? '' : 'off'],
      [x.widest.toFixed(3), r.ok.widest ? '' : 'drift'],
    ] as const
    d.append(w, ...parts.map(([t, cls]) => {
      const s = document.createElement('span')
      s.textContent = t
      if (cls !== '') s.className = cls
      return s
    }))
    return d
  }
  box.append(line('Node', r.node), line('here', r.here))
  box.title = `${r.ok.primary ? 'agree' : 'differ'}; widest line |Δ| ${px(Math.abs(r.node.widest - r.here.widest))} (tolerance ${WIDTH_TOLERANCE}px)`
  td.append(box)
  return td
}

function th(text: string): HTMLTableCellElement {
  const e = document.createElement('th')
  e.textContent = text
  return e
}

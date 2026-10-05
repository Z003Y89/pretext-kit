// headless-parity: loads the Node side's numbers (headless-parity-data.json, written by
// pretext-kit/headless) and computes the same cases here, in this browser's Canvas, from the same
// font files loaded through @font-face under the same family aliases. Each row shows both and says
// whether they agree.

import { agrees, compute, FACES, LABELS, SIZES, WIDTHS, WIDTH_TOLERANCE } from './parity.ts'
import type { Case, ParityData, Result } from './parity.ts'
import { byId, setReadout } from './page.ts'

const st = { face: 0, size: SIZES[0]!, only: 'all' }
const summaryBox = byId<HTMLElement>('summary')
const browserLine = byId<HTMLElement>('browser')
const tableBox = byId<HTMLElement>('table')
const faceBox = byId<HTMLElement>('face-filter')
const sizeBox = byId<HTMLElement>('size-filter')
const onlyBox = byId<HTMLElement>('only-filter')

// The engine the claim is about is Chromium's; the page names the one it runs in.
export function browserName(): string {
  const ua = navigator.userAgent
  const m = (re: RegExp) => re.exec(ua)?.[1]
  const firefox = m(/Firefox\/([\d.]+)/)
  if (firefox !== undefined) return `Firefox ${firefox}`
  const edge = m(/Edg\/([\d.]+)/)
  if (edge !== undefined) return `Edge ${edge} (Chromium)`
  const chrome = m(/(?:Chrome|Chromium)\/([\d.]+)/)
  if (chrome !== undefined) return `Chromium ${chrome}`
  const safari = m(/Version\/([\d.]+).*Safari/)
  if (/AppleWebKit/.test(ua)) return `WebKit${safari !== undefined ? ` (Safari ${safari})` : ''}`
  return ua
}
const isChromium = (name: string) => name.startsWith('Chromium') || name.startsWith('Edge')

type Row = { node: Case, here: Case, ok: ReturnType<typeof agrees> }
let rows: Row[] = []
let browser = ''

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
  browser = browserName()
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
  summarize(data, ms)
  render()
  const agree = rows.filter(r => r.ok.all).length
  const root = document.documentElement
  root.dataset.browser = browser
  root.dataset.agree = String(agree)
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

function summarize(data: ParityData, ms: number): void {
  const n = rows.length
  const agree = count(r => r.ok.all)
  const maxDelta = Math.max(...rows.map(r => Math.abs(r.node.widest - r.here.widest)))
  const exact = count(r => r.node.widest === r.here.widest)
  const labelRows = new Set(rows.filter(r => !r.ok.all).map(r => r.node.label))
  setReadout(summaryBox, [
    { label: 'Agree', value: `${agree} of ${n} cases` },
    { label: 'Labels with a difference', value: `${labelRows.size} of ${LABELS.length}` },
    { label: 'Line counts equal', value: `${count(r => r.ok.lines)} of ${n}` },
    { label: 'Fitted sizes equal', value: `${count(r => r.ok.fit)} of ${n}` },
    { label: 'Widest line', value: `${exact} of ${n} bit-exact; max |Δ| ${maxDelta.toPrecision(3)}px` },
    { label: 'Node side', value: `Node ${data.generated.node}, harfbuzzjs ${data.generated.harfbuzzjs}, Pretext ${data.generated.pretext}` },
    { label: 'This browser', value: `${n} cases in ${ms.toFixed(0)} ms` },
  ])
  const verdict = agree === n
    ? `All ${n} of ${n} agree in ${browser}.`
    : `${agree} of ${n} agree in ${browser}.`
  const scope = isChromium(browser)
    ? ' This is the engine the claim covers.'
    : ' The stand-in follows Chromium\'s rules (it sets a Chrome user agent before Pretext loads); in this browser Pretext uses this engine\'s own rules and fonts are shaped by its own text stack, so differences here are expected and are not covered by the claim.'
  browserLine.textContent = verdict + scope
  browserLine.classList.toggle('done', agree === n)
}

const fmtWidth = (w: number) => w.toFixed(3)
const fmtFit = (px: number | null) => px === null ? 'none' : `${px}px`
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
    const ok = cells.every(c => c.ok.all)
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
  wrap.className = 'grid-wrap'
  wrap.append(table)
  tableBox.replaceChildren(wrap)
}

function cell(r: Row): HTMLTableCellElement {
  const td = document.createElement('td')
  const box = document.createElement('div')
  box.className = `pc ${r.ok.all ? 'c-pass' : 'c-mismatch'}`
  const line = (who: string, x: Result) => {
    const d = document.createElement('div')
    d.className = 'pc-line'
    const w = document.createElement('span')
    w.className = 'who'
    w.textContent = who
    const parts = [
      [`${x.lines} ${x.lines === 1 ? 'line' : 'lines'}`, r.ok.lines],
      [fmtWidth(x.widest), r.ok.widest],
      [`fit ${fmtFit(x.fit)}`, r.ok.fit],
    ] as const
    d.append(w, ...parts.map(([t, ok]) => {
      const s = document.createElement('span')
      s.textContent = t
      if (!ok) s.className = 'off'
      return s
    }))
    return d
  }
  box.append(line('Node', r.node), line('here', r.here))
  box.title = `${r.ok.all ? 'agree' : 'differ'}: widest |Δ| ${Math.abs(r.node.widest - r.here.widest).toPrecision(3)}px (tolerance ${WIDTH_TOLERANCE}px)`
  td.append(box)
  return td
}

function th(text: string): HTMLTableCellElement {
  const e = document.createElement('th')
  e.textContent = text
  return e
}

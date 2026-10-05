// accuracy: the browser sweep's results (verify/RESULTS.md) as a grid of browser × zoom factor ×
// helper × corpus. Each cell is coloured by the worst outcome in it; a click lists sample cases.

import { byId, setReadout } from './page.ts'

const OUTCOMES = ['pass', 'pretext-gap', 'platform', 'unreliable', 'kit-mismatch'] as const
type Outcome = typeof OUTCOMES[number]
type Sample = { o: Outcome, font: string, width: number, maxLines?: number, cause?: string, detail: string }
type Cell = { total: number, samples: Sample[] } & Record<Outcome, number>
type Data = {
  run: string
  steps: Record<string, Record<string, number>>
  browsers: { name: string, version: string }[]
  factors: number[]
  helpers: string[]
  corpora: string[]
  noCorpus: string
  cells: Record<string, Cell>
}

const SHORT: Record<Outcome, string> = { pass: 'pass', 'pretext-gap': 'gap', platform: 'platform', unreliable: 'unreliable', 'kit-mismatch': 'mismatch' }
const CLASS: Record<Outcome, string> = { pass: 'c-pass', 'pretext-gap': 'c-gap', platform: 'c-platform', unreliable: 'c-gap', 'kit-mismatch': 'c-mismatch' }
const DESCRIBE: Record<string, string> = {
  fontFromStyle: 'one case per font stack and pinned size; the width column is the font size',
  shrinkwrap: 'widths 120–600px',
  balance: 'widths 120–600px',
  fitFontSize: 'boxes 120–600px wide',
  clamp: 'widths 120–600px × maxLines 1–5',
  truncateMiddle: 'widths 80–400px, path labels and the soft-hyphenated corpora',
  fitFontSizeRich: 'icon and label rows, boxes 120–600px wide',
}

const st = { helper: 'all', factor: 'all', open: '' }
const grid = byId<HTMLElement>('grid')
const summaryBox = byId<HTMLElement>('summary')
const metaLine = byId<HTMLElement>('meta')
const helperBox = byId<HTMLElement>('helper-filter')
const factorBox = byId<HTMLElement>('factor-filter')
let data: Data

fetch('accuracy-data.json').then(r => {
  if (!r.ok) throw new Error(`accuracy-data.json: HTTP ${r.status}`)
  return r.json() as Promise<Data>
}).then(d => {
  data = d
  buildFilters()
  render()
  document.documentElement.dataset.ready = 'true'
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
  seg(helperBox, ['all', ...data.helpers], ['All', ...data.helpers], () => st.helper, v => { st.helper = v })
  seg(factorBox, ['all', ...data.factors.map(String)], ['All', ...data.factors.map(f => `${f}×`)], () => st.factor, v => { st.factor = v })
  metaLine.textContent = `${data.run} ${data.browsers.map(b => `${b.name} ${b.version}`).join(', ')}.`
}

function worst(c: Cell): Outcome {
  for (const o of ['kit-mismatch', 'platform', 'unreliable', 'pretext-gap'] as const) if (c[o] > 0) return o
  return 'pass'
}

const fmt = (n: number) => n.toLocaleString('en-US')

function render(): void {
  const helpers = st.helper === 'all' ? data.helpers : [st.helper]
  const factors = st.factor === 'all' ? data.factors : [Number(st.factor)]
  const wheres = data.browsers.flatMap(b => factors.map(f => `${b.name}@${f}`))

  // Totals over what is shown.
  const sum: Record<Outcome, number> & { total: number } = { total: 0, pass: 0, 'pretext-gap': 0, platform: 0, unreliable: 0, 'kit-mismatch': 0 }
  for (const [k, c] of Object.entries(data.cells)) {
    const [where, helper] = k.split('|')
    if (!wheres.includes(where!) || !helpers.includes(helper!)) continue
    sum.total += c.total
    for (const o of OUTCOMES) sum[o] += c[o]
  }
  setReadout(summaryBox, [
    { label: 'Cases shown', value: fmt(sum.total) },
    { label: 'Pass', value: `${fmt(sum.pass)} (${(100 * sum.pass / Math.max(1, sum.total)).toFixed(2)}%)` },
    { label: 'Pretext gap', value: fmt(sum['pretext-gap']) },
    { label: 'Platform', value: fmt(sum.platform) },
    { label: 'Unreliable', value: fmt(sum.unreliable) },
    { label: 'Kit mismatch', value: fmt(sum['kit-mismatch']) },
  ])

  grid.replaceChildren(...helpers.map(helper => {
    const block = document.createElement('section')
    block.className = 'helper-block'
    const h = document.createElement('h2')
    h.textContent = helper
    const small = document.createElement('small')
    small.textContent = DESCRIBE[helper] ?? ''
    h.append(small)
    const wrap = document.createElement('div')
    wrap.className = 'grid-wrap'
    const table = document.createElement('table')
    table.className = 'grid'
    const corpora = [data.noCorpus, ...data.corpora].filter(c => wheres.some(w => data.cells[`${w}|${helper}|${c}`] !== undefined))
    const thead = table.createTHead().insertRow()
    thead.append(th(''), ...corpora.map(c => th(c !== data.noCorpus ? c : helper === 'fontFromStyle' ? 'font stacks' : 'all corpora')))
    const tbody = table.createTBody()
    const panel = document.createElement('div')
    for (const where of wheres) {
      const row = tbody.insertRow()
      row.append(th(where.replace('@', ' @ ') + '×', 'row'))
      for (const corpus of corpora) {
        const td = row.insertCell()
        const k = `${where}|${helper}|${corpus}`
        const c = data.cells[k]
        if (c === undefined) continue
        const b = document.createElement('button')
        b.type = 'button'
        const w = worst(c)
        b.className = CLASS[w]
        const bad = OUTCOMES.filter(o => o !== 'pass' && c[o] > 0).map(o => `${fmt(c[o])} ${SHORT[o]}`)
        b.innerHTML = ''
        const top = document.createElement('span')
        // Rounded down, so a cell with any non-pass case never reads 100%.
        top.textContent = c.pass === c.total ? '100%' : `${(Math.floor(10000 * c.pass / c.total) / 100).toFixed(2)}%`
        const n = document.createElement('span')
        n.className = 'n'
        n.textContent = bad.length === 0 ? `${fmt(c.total)} pass` : bad.join(', ')
        b.append(top, n)
        b.title = `${where} ${helper} ${corpus}: ${fmt(c.total)} cases`
        b.setAttribute('aria-pressed', String(st.open === k))
        b.addEventListener('click', () => {
          st.open = st.open === k ? '' : k
          render()
        })
        td.append(b)
        if (st.open === k) panel.append(casesPanel(k, c))
      }
    }
    wrap.append(table)
    block.append(h, wrap, panel)
    return block
  }))
}

function th(text: string, scope?: string): HTMLTableCellElement {
  const e = document.createElement('th')
  e.textContent = text
  if (scope !== undefined) e.scope = scope
  return e
}

function casesPanel(k: string, c: Cell): HTMLElement {
  const [where, helper, corpus] = k.split('|')
  const box = document.createElement('div')
  box.className = 'cases'
  const h = document.createElement('h3')
  const parts = OUTCOMES.filter(o => c[o] > 0).map(o => `${fmt(c[o])} ${o}`)
  h.textContent = `${where} · ${helper}${corpus === data.noCorpus ? '' : ` · ${corpus}`}: ${fmt(c.total)} cases, ${parts.join(', ')}`
  box.append(h)
  if (c.samples.length === 0) {
    const p = document.createElement('p')
    p.className = 'empty'
    p.textContent = 'Every case passed: the kit agreed with Pretext, and the browser painted what both predicted.'
    box.append(p)
    return box
  }
  const ol = document.createElement('ol')
  for (const s of c.samples) {
    const li = document.createElement('li')
    const lines = s.maxLines === undefined ? '' : `, maxLines ${s.maxLines}`
    li.textContent = `[${s.cause ?? s.o}] ${s.font} @ ${s.width}px${lines}: ${s.detail}`
    ol.append(li)
  }
  const note = document.createElement('p')
  note.className = 'meta-line'
  note.textContent = 'Up to 8 cases per outcome, spread across fonts, texts and widths. Every case is in verify/results/latest.json.gz; findings are grouped in verify/RESULTS.md.'
  box.append(ol, note)
  return box
}

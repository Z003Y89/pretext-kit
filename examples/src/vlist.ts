// Numbers before render: 2,000 messages in a scroller. The kit side knows every row's height from
// Pretext before anything paints, so it renders only the rows in view, its scrollbar is exact from
// the start, and a width change keeps the row being read where it was (stack, findIndexAt,
// anchorDelta). The CSS side is the best CSS can do without measuring: every row in the DOM with
// content-visibility: auto and an estimated contain-intrinsic-size, so its total height is a guess
// until each row has been rendered once.

import { layout, prepare } from '@chenglou/pretext'
import type { PreparedText } from '@chenglou/pretext'
import { anchorDelta, findIndexAt, stack } from '../../src/index.ts'
import { fontAt, lineHeightAt, measureOverflow, ownPlain } from './screen.ts'
import type { Fonts } from './screen.ts'
import { LANGS, STRINGS } from './strings.ts'

const COUNT = 2000
const PAD_X = 12
const PAD_Y = 8
const VIEW = 360
const OVERSCAN = 4
const ESTIMATE = 60

// Deterministic messages of varied length, made of whole sentences (and whole titles) from the
// screen's own copy in all three languages, so no message reads as cut off.
function messages(): string[] {
  // Split after a period that doesn't follow a digit ("am 1. November" stays whole); titles get one.
  const pool = LANGS.flatMap(l => STRINGS[l].cards.flatMap(c => [c.title + '.', ...c.body.split(/(?<=[^\d]\.)\s+/)]))
  const out: string[] = []
  for (let i = 0; i < COUNT; i++) {
    const start = (i * 7) % pool.length
    const n = 1 + ((i * 37) % 3)
    const parts: string[] = []
    for (let k = 0; k < n; k++) parts.push(pool[(start + k) % pool.length]!)
    out.push(`#${i + 1} ` + parts.join(' '))
  }
  return out
}

function frame(name: string, note: string, side: string): { section: HTMLElement, count: HTMLElement, readout: HTMLElement, scroller: HTMLElement } {
  const section = document.createElement('section')
  section.className = 'frame list-frame'
  section.dataset.side = side
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
  const readout = document.createElement('p')
  readout.className = 'list-readout'
  const scroller = document.createElement('div')
  scroller.className = 'vl-scroller'
  scroller.tabIndex = 0
  section.append(head, readout, scroller)
  return { section, count, readout, scroller }
}

export type ListPanel = { paint(width: number, fonts: Fonts, epoch: number): void }

export function createListPanel(host: HTMLElement, schedule: () => void): ListPanel {
  const texts = messages()
  const kit = frame('pretext-kit', 'heights from the model, rows in view only', 'kit-list')
  const css = frame('best-effort CSS', 'every row in the DOM, content-visibility: auto', 'css-list')
  host.append(kit.section, css.section)

  // Kit side: an inner box as tall as the list, rows positioned at their tops.
  const inner = document.createElement('div')
  inner.className = 'vl-inner'
  kit.scroller.append(inner)
  kit.scroller.addEventListener('scroll', schedule, { passive: true })
  css.scroller.addEventListener('scroll', schedule, { passive: true })
  // CSS side: all rows, in flow.
  const cssList = document.createElement('div')
  cssList.className = 'vl-css role-body'
  for (const t of texts) {
    const row = document.createElement('div')
    row.className = 'vl-row'
    row.textContent = t
    cssList.append(row)
  }
  css.scroller.append(cssList)

  // The scrollbar's width is the platform's, read once like the viewport; the model then owns the
  // rows' text width.
  const gutter = kit.scroller.offsetWidth - kit.scroller.clientWidth

  let prepared: PreparedText[] = []
  let preparedFor = ''
  let tops = new Float64Array(COUNT)
  let spare = new Float64Array(COUNT)
  const heights = new Float64Array(COUNT)
  let laidOutAt = -1
  let total = 0
  let micros = 0
  let lastAnchor = -1
  const rows: HTMLElement[] = []

  const panel: ListPanel = {
    paint(width, fonts, epoch) {
      const px = Math.round(fonts.body.size)
      const font = fontAt(fonts.body, px)
      const lh = lineHeightAt(fonts.body, px)
      const textWidth = width - gutter - 2 * PAD_X
      kit.section.style.width = `${width}px`
      css.section.style.width = `${width}px`
      cssList.style.width = `${width - gutter}px`

      const t0 = performance.now()
      const key = `${font}|${epoch}`
      if (key !== preparedFor) {
        prepared = texts.map(t => prepare(t, font))
        preparedFor = key
        laidOutAt = -1
      }
      if (laidOutAt !== textWidth) {
        for (let i = 0; i < COUNT; i++) heights[i] = layout(prepared[i]!, textWidth, lh).height + 2 * PAD_Y
        const old = tops
        tops = spare
        spare = old
        total = stack(heights, 0, tops)
        // Keep the row at the top of the view where it was: move scrollTop only when layout moved it.
        if (laidOutAt >= 0) {
          const anchor = findIndexAt(spare, COUNT, kit.scroller.scrollTop)
          inner.style.height = `${total}px`
          const delta = anchorDelta(spare, tops, anchor)
          if (delta !== 0) kit.scroller.scrollTop += delta
          lastAnchor = anchor
        }
        laidOutAt = textWidth
        micros = (performance.now() - t0) * 1000
      }
      inner.style.height = `${total}px`

      const y = kit.scroller.scrollTop
      const start = Math.max(0, findIndexAt(tops, COUNT, y) - OVERSCAN)
      const end = Math.min(COUNT, findIndexAt(tops, COUNT, y + VIEW) + 1 + OVERSCAN)
      while (rows.length < end - start) {
        const r = document.createElement('div')
        r.className = 'vl-row role-body'
        r.dataset.check = ''
        rows.push(r)
        inner.append(r)
      }
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k]!
        const i = start + k
        if (i >= end) { r.style.display = 'none'; delete r.dataset.lines; continue }
        r.style.display = ''
        r.style.top = `${tops[i]}px`
        r.style.height = `${heights[i]}px`
        r.style.width = `${textWidth + 2 * PAD_X}px`
        r.style.fontSize = `${px}px`
        r.style.lineHeight = `${lh}px`
        if (r.textContent !== texts[i]) r.textContent = texts[i]!
      }

      const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
      kit.readout.textContent = `${fmt(COUNT)} rows, total ${fmt(total)}px, known before any row painted `
        + `(all 2,000 heights at this width: ${fmt(micros)} µs, preparing included the first time). `
        + `${end - start} rows in the DOM.`
        + (lastAnchor >= 0 ? ` On the last width change, row #${lastAnchor + 1} stayed in place.` : '')
      const cssHeight = css.scroller.scrollHeight
      css.readout.textContent = `${fmt(COUNT)} rows in the DOM. scrollHeight ${fmt(cssHeight)}px: an estimate `
        + `(${ESTIMATE}px per row not yet rendered), ${fmt(Math.abs(cssHeight - total))}px from the exact total; `
        + 'it changes as rows are scrolled into view, and the scrollbar with it.'

      // Rows' painted line counts against the model's, and against Pretext's own layout.
      for (const r of rows) {
        if (r.style.display === 'none') continue
        const lines = Math.round((Number.parseFloat(r.style.height) - 2 * PAD_Y) / lh)
        r.dataset.lines = String(lines)
        ownPlain(r, () => r.textContent ?? '', font, textWidth)
      }
      const o = measureOverflow(inner, PAD_Y * 2)
      const text = o.boxes === 0 && o.gaps === 0 ? 'every row fits its height' : o.detail[0] ?? ''
      if (kit.count.textContent !== text) kit.count.textContent = text
      kit.count.classList.toggle('bad', o.boxes > 0)
      kit.section.dataset.boxes = String(o.boxes)
      kit.section.dataset.gaps = String(o.gaps)
      kit.section.dataset.detail = JSON.stringify(o.detail)
      css.count.textContent = ''
    },
  }
  return panel
}

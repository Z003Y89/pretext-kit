// What every screen page shares: reading the fonts, re-preparing after a late web font, a
// requestAnimationFrame render loop, and the live readouts.

import { watchFonts } from '../../src/index.ts'
import { createModel, createProbes, readFonts } from './screen.ts'
import type { Fonts, Model } from './screen.ts'

export function byId<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id)
  if (e === null) throw new Error(`#${id} not found`)
  return e as T
}

// A mean over the last frames: one frame's performance.now() difference is too coarse to read.
export function createTimer(size = 30): { add(us: number): void, mean(): number, count(): number } {
  const xs: number[] = []
  return {
    add(us) { xs.push(us); if (xs.length > size) xs.shift() },
    count() { return xs.length },
    mean() { let s = 0; for (const x of xs) s += x; return xs.length === 0 ? 0 : s / xs.length },
  }
}

export type Shared = {
  model: Model
  fonts(): Fonts
  schedule(): void
}

// `render` runs at most once per frame. Fonts come from the probes' computed styles; when a web
// font arrives, watchFonts clears Pretext's cache, the model drops its handles, the fonts are read
// again and the page lays out again.
export function startPage(render: () => void): Shared {
  const model = createModel()
  const probes = createProbes()
  let fonts = readFonts(probes)
  let raf: number | null = null
  const schedule = () => {
    if (raf !== null) return
    raf = requestAnimationFrame(() => { raf = null; render() })
  }
  const status = document.getElementById('font-status')
  const t0 = performance.now()
  const root = document.documentElement
  root.dataset.fontState = 'loading'
  watchFonts(() => {
    const t = performance.now()
    model.reset()
    fonts = readFonts(probes)
    root.dataset.fontState = 'loaded'
    schedule()
    if (status !== null) {
      status.textContent = `Inter arrived after ${((t - t0) / 1000).toFixed(1)} s. watchFonts cleared Pretext's cache; `
        + 'every label, title and paragraph was prepared again in Inter and the screen laid out again.'
      status.classList.add('done')
    }
  })
  // Already loaded (a cached font, or a server that doesn't delay it): nothing will fire.
  document.fonts.ready.then(() => {
    if (root.dataset.fontState === 'loading' && document.fonts.check('14px Inter')) {
      root.dataset.fontState = 'loaded'
      if (status !== null) { status.textContent = 'Inter was already loaded when the page started.'; status.classList.add('done') }
    }
  })
  window.addEventListener('resize', schedule)
  return { model, fonts: () => fonts, schedule }
}

// Each label and value pair sits in its own <div> inside the <dl>, so the grid keeps them together.
export function setReadout(box: HTMLElement, rows: { label: string, value: string }[]): void {
  if (box.childElementCount !== rows.length) {
    box.replaceChildren(...rows.map(() => {
      const d = document.createElement('div')
      d.append(document.createElement('dt'), document.createElement('dd'))
      return d
    }))
  }
  rows.forEach((r, i) => {
    const dt = box.children[i]!.children[0]!
    const dd = box.children[i]!.children[1]!
    if (dt.textContent !== r.label) dt.textContent = r.label
    if (dd.textContent !== r.value) dd.textContent = r.value
  })
}

// "312 µs" for a frame that only laid out; a frame that also prepared new text (first sight of a
// string, font or size) says so, since preparing is the expensive, once-only part.
// The mean covers layout-only frames (the steady state of a resize), so a cold first frame doesn't
// hide in it.
export function frameCost(micros: number, prepared: number, timer: { add(us: number): void, mean(): number, count(): number }): string {
  if (prepared === 0) timer.add(micros)
  const now = prepared > 0 ? `${Math.round(micros)} µs, incl. ${prepared} new prepared ${prepared === 1 ? 'handle' : 'handles'}` : `${Math.round(micros)} µs`
  return timer.count() === 0 ? now : `${now}; layout-only mean ${Math.round(timer.mean())} µs`
}

// The width a screen may take: the slider's value, never wider than the page column.
export function columnWidth(stage: HTMLElement): number {
  return Math.floor(stage.clientWidth)
}

// The Chromium side of the headless parity sweep, bundled by verify/headless.ts into
// verify/dist/headless-page.js and served with verify/headless.ts's generated page.
import * as pretext from '@chenglou/pretext'
import { measureWidths, pretextLines } from './headless-measure.ts'
import type { LineCase, WidthCase } from './headless-measure.ts'

export type LoadedFace = { family: string, weight: string, status: string }
// A painted line count, or -1 with the height when the height is no whole number of lines.
export type Painted = { lines: number, height: number }

declare global {
  interface Window {
    hx: {
      load: (faces: { family: string, weight: number }[]) => Promise<LoadedFace[]>
      widths: (cases: WidthCase[]) => number[]
      pretextLines: (cases: LineCase[], widths: number[]) => number[][]
      domLines: (cases: LineCase[], widths: number[]) => Painted[][]
    }
  }
}

// Line boxes sit on at most a 1/64 px grid, so a height within this of n lines is n lines (as v1).
const GRID = 1 / 64

const probe = document.getElementById('probe') as HTMLDivElement

window.hx = {
  // Waits for every face the page declares, each by its own weight, so nothing is measured in a fallback.
  async load(faces) {
    for (const f of faces) await document.fonts.load(`${f.weight} 16px "${f.family}"`)
    await document.fonts.ready
    return [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status }))
  },
  widths: cases => measureWidths(OffscreenCanvas, cases),
  pretextLines: (cases, widths) => pretextLines(pretext, cases, widths),
  domLines(cases, widths) {
    return cases.map(c => {
      const s = probe.style
      s.fontFamily = `"${c.family}"`
      s.fontWeight = String(c.weight)
      s.fontSize = `${c.size}px`
      s.lineHeight = `${c.lineHeight}px`
      s.letterSpacing = `${c.letterSpacing}px`
      probe.textContent = c.text
      return widths.map(w => {
        s.width = `${w}px`
        const height = probe.getBoundingClientRect().height
        const lines = Math.round(height / c.lineHeight)
        return { lines: Math.abs(height - lines * c.lineHeight) <= GRID ? lines : -1, height }
      })
    })
  },
}

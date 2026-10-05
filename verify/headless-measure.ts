// The measuring code of the headless parity sweep, run unchanged on both sides: in Chromium (real
// OffscreenCanvas, Pretext bundled into the page) and in Node (the stand-in, Pretext from
// node_modules). Imports nothing, so the page bundle and the Node child share it as is.

export type WidthCase = { text: string, family: string, weight: number, size: number, spacing: number }
export type LineCase = { text: string, family: string, weight: number, size: number, lineHeight: number, letterSpacing: number }

type Pretext = {
  prepare: (text: string, font: string, options?: { letterSpacing?: number }) => unknown
  layout: (prepared: never, maxWidth: number, lineHeight: number) => { lineCount: number }
  setLocale: (locale?: string) => void
}

type Canvas = new (w: number, h: number) => { getContext(kind: '2d'): unknown }
type Context = { font: string, letterSpacing: string, measureText(text: string): { width: number } }

export function canvasFont(family: string, weight: number, size: number): string {
  return `${weight} ${size}px "${family}"`
}

// Canvas widths, as Pretext gets them: one OffscreenCanvas context, font and letterSpacing set per case.
export function measureWidths(OffscreenCanvasImpl: Canvas, cases: WidthCase[]): number[] {
  const ctx = new OffscreenCanvasImpl(1, 1).getContext('2d') as Context
  return cases.map(c => {
    const font = canvasFont(c.family, c.weight, c.size)
    ctx.font = font
    ctx.letterSpacing = `${c.spacing}px`
    // A font Canvas rejects would silently measure in the previous one, so the family read back must
    // be exactly the one set (Chromium serializes it with or without quotes).
    const family = /\d+(?:\.\d+)?px\s+(.*)$/.exec(ctx.font)?.[1]?.replace(/^"(.*)"$/, '$1')
    if (family !== c.family) throw new Error(`font not taken: ${font} reads back ${ctx.font}`)
    if (parseFloat(ctx.letterSpacing) !== c.spacing) throw new Error(`letterSpacing not taken: ${c.spacing}px`)
    return ctx.measureText(c.text).width
  })
}

// Pretext's line count of each case at each width.
export function pretextLines(pretext: Pretext, cases: LineCase[], widths: number[]): number[][] {
  pretext.setLocale('en')
  return cases.map(c => {
    const prepared = pretext.prepare(c.text, canvasFont(c.family, c.weight, c.size), { letterSpacing: c.letterSpacing }) as never
    return widths.map(w => pretext.layout(prepared, w, c.lineHeight).lineCount)
  })
}

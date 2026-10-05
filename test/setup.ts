// Pretext measures through OffscreenCanvas; Node has none, and real font metrics would make
// expected widths machine-dependent. A fixed-width stand-in keeps every assertion exact. A font
// named Kern also kerns, as real fonts do, so a run measures other than its graphemes summed:
// each "ts" a quarter em tighter and each "y…" a quarter em looser.
// A web font swapping in changes widths; tests flip this to simulate it.
export const standIn = { scale: 1 }

class StandInContext {
  font = ''

  measureText(text: string): { width: number } {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font)
    const size = match === null ? 16 : Number(match[1])
    let width = 0
    for (const ch of text) {
      width += ch === ' ' || ch === '\u00A0' ? 0.25 * size : 0.5 * size
    }
    if (this.font.includes('Kern')) {
      width -= 0.25 * size * (text.split('ts').length - 1)
      width += 0.25 * size * (text.split('y…').length - 1)
    }
    return { width: width * standIn.scale }
  }
}

class StandInCanvas {
  constructor(_width: number, _height: number) {}

  getContext(_kind: string): StandInContext {
    return new StandInContext()
  }
}

Reflect.set(globalThis, 'OffscreenCanvas', StandInCanvas)

// Pretext measures through OffscreenCanvas; Node has none, and real font metrics would make
// expected widths machine-dependent. A fixed-width stand-in keeps every assertion exact.
// A web font swapping in changes widths; tests flip this to simulate it.
export const standIn = { scale: 1 }

class StandInContext {
  font = ''

  measureText(text: string): { width: number } {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font)
    const size = match === null ? 16 : Number(match[1])
    let width = 0
    for (const ch of text) {
      width += ch === ' ' || ch === ' ' ? 0.25 * size : 0.5 * size
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

import type { FontFace } from './fonts.ts'

// One key for the stand-in's brand and its shared state. Symbol.for() gives every copy of this
// package the same symbol: test runners load modules more than once (vi.resetModules,
// jest.isolateModules, src beside dist), and all copies must see one stand-in, one set of
// options and one font registry.
export const HEADLESS = Symbol.for('pretext-kit.headless')

export type HeadlessOptions = {
  onMissingGlyph: 'throw' | 'notdef'
  rounding: 'none' | 'whole-px'
}

export type SharedState = {
  options: HeadlessOptions
  faces: FontFace[]
}

// Created on first use, not at module load, so importing the package changes no global.
export function sharedState(): SharedState {
  let state = Reflect.get(globalThis, HEADLESS) as SharedState | undefined
  if (state === undefined) {
    state = { options: { onMissingGlyph: 'throw', rounding: 'none' }, faces: [] }
    Object.defineProperty(globalThis, HEADLESS, { value: state, configurable: true, enumerable: false, writable: false })
  }
  return state
}

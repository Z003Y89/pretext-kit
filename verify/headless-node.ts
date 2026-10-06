// The Node side of the headless parity sweep, a process of its own (Pretext fixes its engine profile
// and canvas per process): `node verify/headless-node.ts <headless index.ts> <input.json> <output.json>`.
// The first argument is src/headless/index.ts, or a mutated copy of it for a mutant run.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { measureWidths, pretextLines } from './headless-measure.ts'
import type { LineCase, WidthCase } from './headless-measure.ts'
import type { FaceFile } from './headless-cases.ts'

// platform: install()'s, the OS the sweep runs on (Chromium's own widths are that OS's).
export type NodeInput = { root: string, faces: FaceFile[], widthCases: WidthCase[], lineCases: LineCase[], widths: number[], platform: 'macos' | 'windows' | 'linux' }
// measured: the distinct strings Pretext handed the stand-in while preparing the line cases;
// spaced: those holding a U+0020 beside other text, the only ones the U+0020 word cut can change.
export type NodeOutput = { widths: number[], lines: number[][], measured: number, spaced: string[] }

const [modulePath, inputPath, outputPath] = process.argv.slice(2)
if (modulePath === undefined || inputPath === undefined || outputPath === undefined) {
  throw new Error('usage: node verify/headless-node.ts <headless index.ts> <input.json> <output.json>')
}
const input: NodeInput = JSON.parse(readFileSync(inputPath, 'utf8'))
const headless: typeof import('../src/headless/index.ts') = await import(pathToFileURL(modulePath).href)
for (const face of input.faces) {
  const data = new Uint8Array(readFileSync(join(input.root, face.dir ?? 'test/fonts', face.file)))
  // A variable face is registered with no weight: the stand-in reads the range from its wght axis.
  await headless.registerFont(face.family, data, typeof face.weight === 'number' ? { weight: face.weight } : {})
}
headless.install({ platform: input.platform })
const widths = measureWidths(OffscreenCanvas, input.widthCases)

// Records what Pretext measures: every context made from here on (Pretext makes its own on first
// preparation) reports each string it is asked to measure.
const measured = new Set<string>()
type Recordable = { getContext(kind: string): { measureText(text: string): unknown } | null }
const proto = Object.getPrototypeOf(new OffscreenCanvas(1, 1)) as Recordable
const getContext = proto.getContext
proto.getContext = function (this: Recordable, kind: string) {
  const ctx = getContext.call(this, kind)
  if (ctx !== null) {
    const measure = ctx.measureText.bind(ctx)
    ctx.measureText = (text: string) => {
      measured.add(text)
      return measure(text)
    }
  }
  return ctx
}
// Pretext is loaded only after install(), as the README tells apps to.
const pretext = await import('@chenglou/pretext')
const output: NodeOutput = {
  widths,
  lines: pretextLines(pretext, input.lineCases, input.widths),
  measured: measured.size,
  spaced: [...measured].filter(t => t.includes(' ') && t.trim() !== ''),
}
writeFileSync(outputPath, JSON.stringify(output))

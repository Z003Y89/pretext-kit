// npm run examples:data (second half): computes the headless-parity page's Node column with
// pretext-kit/headless and writes examples/headless-parity-data.json (committed, so the examples
// build without running it). The page computes the same cases live in the browser from the same font
// files and compares them row by row.
//
// The fonts are test/fonts' Inter and Roboto Regular, registered under the aliases the page's
// @font-face rules use. install() runs before the first prepare(), as the README requires.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { install, registerFont } from '../src/headless/index.ts'
import { compute, FACES, LABELS, SIZES, WIDTHS } from './src/parity.ts'
import type { ParityData } from './src/parity.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fonts = join(here, '../test/fonts')
const pkg = (name: string): string => JSON.parse(readFileSync(join(here, '../node_modules', name, 'package.json'), 'utf8')).version

// The kit is built against Pretext main (README, Versions), so the commit says more than the version.
function pretextBuild(): string {
  try {
    return execFileSync('git', ['-C', join(here, '../node_modules/@chenglou/pretext'), 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return pkg('@chenglou/pretext')
  }
}

for (const f of FACES) await registerFont(f.family, new Uint8Array(readFileSync(join(fonts, f.file))))
install()

const cases = compute()
const data: ParityData = {
  source: 'examples/build-headless-parity.ts: pretext-kit/headless in Node, fonts from test/fonts',
  generated: {
    node: process.version,
    harfbuzzjs: pkg('harfbuzzjs'),
    pretext: pretextBuild(),
    kit: JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')).version,
  },
  faces: FACES,
  widths: WIDTHS,
  sizes: SIZES,
  labels: LABELS,
  cases,
}
writeFileSync(join(here, 'headless-parity-data.json'), JSON.stringify(data) + '\n')
console.log(`wrote examples/headless-parity-data.json: ${LABELS.length} labels × ${FACES.length} fonts × ${SIZES.length} sizes × ${WIDTHS.length} widths = ${cases.length} cases`)

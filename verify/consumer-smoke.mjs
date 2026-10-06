// Consumer smoke test of the release tarballs: installs them into a fresh npm project the way an app would, then
// runs Pretext and pretext-kit there in Node through pretext-kit/headless.
//
//   node verify/consumer-smoke.mjs <chenglou-pretext-….tgz> <pretext-kit-….tgz> [--dir=DIR]
//
// --dir  the scratch project to create (must not exist; default: a new directory under the OS temp directory).
//
// Steps: `npm init -y`, "type": "module", `npm install <both tarballs> harfbuzzjs@1.6.2` with no --legacy-peer-deps
// (npm 7+ refuses a peer range the Pretext tarball does not satisfy), `npm ls` (fails on an invalid peer), then a
// script that registers Inter (test/fonts in this repository), calls install(), and runs prepareWithSegments,
// measureLineStats, fitFontSize and truncateMiddle, printing and checking the results. Exits non-zero on any failure.
// Needs Node >= 22, npm, and network access for harfbuzzjs unless npm's cache has it.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const dirArg = args.find(a => a.startsWith('--dir='))
const tarballs = args.filter(a => !a.startsWith('--')).map(a => resolve(a))
if (tarballs.length !== 2 || tarballs.some(t => !existsSync(t))) {
  console.error('usage: node verify/consumer-smoke.mjs <chenglou-pretext-….tgz> <pretext-kit-….tgz> [--dir=DIR]')
  process.exit(2)
}
let dir
if (dirArg !== undefined) {
  dir = resolve(dirArg.slice('--dir='.length))
  if (existsSync(dir)) {
    console.error(`${dir} already exists`)
    process.exit(2)
  }
  mkdirSync(dir, { recursive: true })
} else {
  dir = mkdtempSync(join(tmpdir(), 'pretext-kit-consumer-'))
}

const npm = (...npmArgs) => {
  console.log(`$ npm ${npmArgs.join(' ')}`)
  // npm is npm.cmd on Windows, which only runs through a shell; the paths are quoted for it.
  const win = process.platform === 'win32'
  execFileSync('npm', win ? npmArgs.map(a => `"${a}"`) : npmArgs, { cwd: dir, stdio: 'inherit', shell: win })
}

console.log(`consumer project: ${dir}; node ${process.version}`)
npm('init', '-y')
const pkgPath = join(dir, 'package.json')
writeFileSync(pkgPath, JSON.stringify({ ...JSON.parse(readFileSync(pkgPath, 'utf8')), type: 'module' }, null, 2) + '\n')
npm('install', '--no-audit', '--no-fund', ...tarballs, 'harfbuzzjs@1.6.2')
npm('ls', '--all')

copyFileSync(join(here, '../test/fonts/Inter-Regular.ttf'), join(dir, 'Inter-Regular.ttf'))
writeFileSync(join(dir, 'smoke.js'), `\
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext'
import { fitFontSize, prepareLabel, prepareSizes, truncateMiddle } from 'pretext-kit'
import { install, registerFont } from 'pretext-kit/headless'

// Read from node_modules: pretext-kit's exports map does not expose its package.json.
const version = name => JSON.parse(readFileSync('node_modules/' + name + '/package.json', 'utf8')).version
console.log('installed: @chenglou/pretext', version('@chenglou/pretext'), '| pretext-kit', version('pretext-kit'), '| harfbuzzjs', version('harfbuzzjs'))

await registerFont('Inter', new Uint8Array(readFileSync('Inter-Regular.ttf')))
install()

const short = measureLineStats(prepareWithSegments('Speichern', '14px Inter'), 160)
console.log('measureLineStats("Speichern", 14px Inter, 160px):', short)
assert.equal(short.lineCount, 1)
const long = measureLineStats(prepareWithSegments('Ship the release notes before the freeze on Friday', '15px Inter'), 120)
console.log('measureLineStats(release-notes sentence, 15px Inter, 120px):', long)
assert.ok(long.lineCount > 1 && long.maxLineWidth <= 120)

const sizes = prepareSizes('Zahlungspflichtig abonnieren', px => px + 'px Inter', { min: 11, max: 16 })
const fit = fitFontSize(sizes, { width: 180, maxLines: 1 }, px => Math.round(px * 1.3))
console.log('fitFontSize("Zahlungspflichtig abonnieren", 180px, 1 line, 11-16px):', fit && { px: fit.px, lineCount: fit.lineCount })
assert.ok(fit !== null && fit.px >= 11 && fit.px <= 16 && fit.lineCount === 1)
if (fit.px < 16) {
  const up = measureLineStats(prepareWithSegments('Zahlungspflichtig abonnieren', (fit.px + 1) + 'px Inter'), 180)
  assert.ok(up.lineCount > 1, 'one size up must not fit')
}

const label = prepareLabel('~/Projects/atlas/src/core/line-breaker.test.ts', '14px Inter')
const cut = truncateMiddle(label, 220, { from: label.text.lastIndexOf('/') })
console.log('truncateMiddle(path, 14px Inter, 220px):', JSON.stringify(cut))
assert.ok(cut.includes('…') && cut.endsWith('/line-breaker.test.ts'))
assert.ok(measureLineStats(prepareWithSegments(cut, '14px Inter'), Infinity).maxLineWidth <= 220)

console.log('consumer smoke: ok')
`)
execFileSync(process.execPath, ['smoke.js'], { cwd: dir, stdio: 'inherit' })

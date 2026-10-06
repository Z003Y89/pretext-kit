// Fractional font sizes: what this machine's Chromium measures against the headless stand-in's profiles.
// `npm run verify:fractional [-- --headless]` (PW_CHROMIUM=<path> picks the Chromium executable).
//
// For each size, canvas measureText (OffscreenCanvas, as Pretext measures) of three whole strings in Inter Regular
// (test/fonts, by @font-face from the same file, as verify/check-labels.ts loads it), each size in a fresh browser
// context, since Chromium reuses glyph metrics between nearby fractional sizes within one page (EVALUATION.md). Then
// the same strings at the same sizes with the stand-in, install({ platform }) 'windows', 'linux' and 'macos'. One JSON
// line per size on stdout and in verify/dist/fractional.jsonl; then, per profile, how many sizes match Chromium exactly.
// A diagnostic: exits 0 whatever it finds.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { install, registerFont } from '../src/headless/index.ts'
import { FAMILY, FONT_FILE, ROW_STYLE, SHRINK_BY, STYLES, TEXT_SCALES, ZOOMS } from './check-labels-cases.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dist = join(here, 'dist')
const fontPath = join(root, 'test/fonts', FONT_FILE)

const STRINGS = { s1: 'APERÇU', s2: 'Settings', s3: 'Nebenrollen-Takes' }
type Key = keyof typeof STRINGS
type Widths = Record<Key, number>
const KEYS = Object.keys(STRINGS) as Key[]
const PROFILES = ['windows', 'linux', 'macos'] as const

// Every k/64 px for k = 640..1920 step 17; every 0.05 px from 10 to 30; the label checker sweep's sizes (each style's
// size and shrinkTo minimum times text scale and zoom, multiplied in the page's order and in the checker's); and a few
// whole sizes.
function sizes(): number[] {
  const out = new Set<number>()
  for (let k = 640; k <= 1920; k += 17) out.add(k / 64)
  for (let i = 0; i <= 400; i++) out.add(Math.round((10 + i * 0.05) * 100) / 100)
  const bases = new Set([...Object.values(STYLES), ROW_STYLE].flatMap(s => [s.size, s.size - SHRINK_BY]))
  for (const base of bases) {
    for (const textScale of TEXT_SCALES) {
      for (const zoom of ZOOMS) {
        out.add(base * textScale * zoom)
        out.add(base * (textScale * zoom))
      }
    }
  }
  for (const s of [9, 12, 13, 14, 15, 16, 18, 20, 24, 32]) out.add(s)
  return [...out].sort((a, b) => a - b)
}
const SIZES = sizes()

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>pretext-kit fractional size probe</title>
<style>
@font-face { font-family: "${FAMILY}"; src: url("fonts/${FONT_FILE}") format("truetype"); font-weight: 400; font-display: block; }
body { margin: 0; }
</style>
</head>
<body></body>
</html>
`
const server = createServer((req, res) => {
  const url = req.url ?? '/'
  if (url === '/') res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
  else if (url === `/fonts/${FONT_FILE}`) res.writeHead(200, { 'content-type': 'font/ttf' }).end(readFileSync(fontPath))
  else res.writeHead(404).end()
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  await probe(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
} catch (error) {
  // A diagnostic: say what stopped it and exit 0 (process.exit, as a browser left open would keep the process alive).
  console.log(`verify:fractional did not finish: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exit(0)
}
server.close()

async function probe(origin: string): Promise<void> {
  const headless = process.argv.includes('--headless')
  const executablePath = process.env.PW_CHROMIUM
  const browser = await chromium.launch({ headless, ...(executablePath === undefined ? {} : { executablePath }) })
  const browserVersion = browser.version()
  console.log(`Chromium ${browserVersion} (${headless ? 'headless' : 'headed'}), process.platform ${process.platform}, ${SIZES.length} sizes`)

  // One size in a context of its own: load the face at that size, check it loaded, then measure.
  async function chromiumAt(size: number): Promise<Widths> {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto(origin)
      return await page.evaluate(async ([px, family, strings]) => {
        const font = `${px}px "${family}"`
        const faces = await document.fonts.load(font)
        if (faces.length === 0 || faces.some(f => f.status !== 'loaded')) throw new Error(`${family} not loaded for ${font}`)
        const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
        ctx.font = font
        const out: Record<string, number> = {}
        for (const [k, text] of Object.entries(strings)) out[k] = ctx.measureText(text).width
        return out as Widths
      }, [size, FAMILY, STRINGS] as const)
    } finally {
      await context.close()
    }
  }

  const t0 = performance.now()
  const measured = new Map<number, Widths | string>()
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < SIZES.length) {
      const size = SIZES[next++]!
      try {
        measured.set(size, await chromiumAt(size))
      } catch (error) {
        measured.set(size, error instanceof Error ? error.message : String(error))
      }
    }
  }))
  await browser.close()
  console.log(`Chromium: ${SIZES.length} sizes in ${((performance.now() - t0) / 1000).toFixed(1)}s`)

  // The stand-in, one profile at a time.
  await registerFont(FAMILY, new Uint8Array(readFileSync(fontPath)))
  const standIn: Record<(typeof PROFILES)[number], Map<number, Widths>> = { windows: new Map(), linux: new Map(), macos: new Map() }
  for (const platform of PROFILES) {
    install({ platform, onMissingGlyph: 'throw', rounding: 'none' })
    for (const size of SIZES) {
      const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
      ctx.font = `${size}px "${FAMILY}"`
      const out = {} as Widths
      for (const k of KEYS) out[k] = ctx.measureText(STRINGS[k]).width
      standIn[platform].set(size, out)
    }
  }

  mkdirSync(dist, { recursive: true })
  const lines: string[] = []
  for (const size of SIZES) {
    const c = measured.get(size)!
    lines.push(JSON.stringify({ size, chromium: typeof c === 'string' ? { error: c } : c, windows: standIn.windows.get(size), linux: standIn.linux.get(size), macos: standIn.macos.get(size) }))
  }
  for (const line of lines) console.log(line)
  writeFileSync(join(dist, 'fractional.jsonl'), lines.join('\n') + '\n')

  const failed = SIZES.filter(s => typeof measured.get(s) === 'string')
  console.log('')
  console.log(`Summary: Chromium ${browserVersion}, process.platform ${process.platform}; strings ${KEYS.map(k => `${k} ${JSON.stringify(STRINGS[k])}`).join(', ')}`)
  console.log(`${SIZES.length} sizes, ${failed.length} not measured in Chromium${failed.length === 0 ? '' : ` (${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ', …' : ''}: ${measured.get(failed[0]!)})`}`)
  const ok = SIZES.filter(s => typeof measured.get(s) !== 'string')
  const fractional = ok.filter(s => !Number.isInteger(s))
  for (const platform of PROFILES) {
    const same = (size: number, k: Key): boolean => Math.abs((measured.get(size) as Widths)[k] - standIn[platform].get(size)![k]) <= 1e-9
    const counts = KEYS.map(k => `${k} ${ok.filter(s => same(s, k)).length}/${ok.length} (fractional ${fractional.filter(s => same(s, k)).length}/${fractional.length})`)
    const allSame = ok.filter(s => KEYS.every(k => same(s, k))).length
    console.log(`profile '${platform}': exact match ${counts.join(', ')}; all three ${allSame}/${ok.length}`)
    const misses = ok.flatMap(s => KEYS.filter(k => !same(s, k)).map(k => ({ s, k })))
    for (const { s, k } of misses.slice(0, 25)) {
      const c = (measured.get(s) as Widths)[k]
      const p = standIn[platform].get(s)![k]
      console.log(`  ${platform} miss: ${s}px ${k} chromium ${c} ${platform} ${p} (diff ${+(p - c).toFixed(9)})`)
    }
    if (misses.length > 25) console.log(`  … and ${misses.length - 25} more in verify/dist/fractional.jsonl`)
  }
  console.log(`Chromium ${browserVersion}, process.platform ${process.platform}`)
}

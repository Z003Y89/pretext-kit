// npm run examples:check (after npm run examples): loads every page in headless Chromium at 360,
// 768 and 1280px, fails on any console error or page error and on any kit-side box whose content
// doesn't fit it at the slider settings below, and writes the README's screenshots.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import type { Page } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = 4174
const base = `http://localhost:${PORT}/`
const VIEWPORTS = [360, 768, 1280]
const shots = join(here, 'screenshots')
mkdirSync(shots, { recursive: true })

const server = spawn(process.execPath, [join(here, 'serve.ts')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' })
await new Promise<void>((resolve, reject) => {
  server.stdout.on('data', (d: Buffer) => { if (d.toString().includes('http://')) resolve() })
  server.on('exit', code => reject(new Error(`server exited with ${code}`)))
})

const failures: string[] = []
const log: string[] = []
const gapLog: string[] = []
const browser = await chromium.launch()

type Setting = { label: string, apply: (page: Page) => Promise<void> }
const slider = (id: string, value: number | string): Setting['apply'] => async page => {
  await page.evaluate(([id, v]) => {
    const e = document.getElementById(id as string) as HTMLInputElement
    e.value = String(v)
    e.dispatchEvent(new Event('input'))
  }, [id, value])
}
const lang = (l: string): Setting['apply'] => async page => { await page.click(`#lang button[value="${l}"]`) }
const both = (...fs: Setting['apply'][]): Setting['apply'] => async page => { for (const f of fs) await f(page) }

const SCREEN_PAGES: { name: string, settings: Setting[] }[] = [
  {
    name: 'responsive-ui',
    settings: ['en', 'de', 'fr'].flatMap(l => [320, 420, 560, 700, 900, 1040, 1440].map(w =>
      ({ label: `${l} ${w}px`, apply: both(lang(l), slider('width', w)) }))),
  },
  {
    name: 'text-size',
    settings: ['en', 'de', 'fr'].flatMap(l => [0.8, 1, 1.15, 1.25, 1.4, 1.5].map(s =>
      ({ label: `${l} ${s}×`, apply: both(lang(l), slider('scale', s)) }))),
  },
  { name: 'languages', settings: [320, 380, 480, 600, 760].map(w => ({ label: `${w}px`, apply: slider('width', w) })) },
]

async function frame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}

// The pages measure their own overflow after each paint (src/screen.ts, measureOverflow) and leave
// it on each frame; a kit-side box that overflows for any reason but a pretext-gap fails the check.
async function overflow(page: Page): Promise<{ kit: string[], gaps: string[], css: number }> {
  return page.evaluate(() => {
    const kit: string[] = []
    const gaps: string[] = []
    let css = 0
    for (const f of document.querySelectorAll<HTMLElement>('.frame')) {
      const detail: string[] = JSON.parse(f.dataset.detail ?? '[]')
      if (f.dataset.side === 'kit') {
        for (const d of detail) (d.startsWith('pretext-gap') ? gaps : kit).push(d)
      } else css += Number(f.dataset.boxes ?? 0)
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
      kit.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`)
    }
    return { kit, gaps, css }
  })
}

for (const vw of VIEWPORTS) {
  for (const p of ['index', 'accuracy', ...SCREEN_PAGES.map(s => s.name)]) {
    const context = await browser.newContext({ viewport: { width: vw, height: 900 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const where = `${p} @ ${vw}px`
    page.on('console', m => { if (m.type() === 'error') failures.push(`${where}: console error: ${m.text()}`) })
    page.on('pageerror', e => failures.push(`${where}: page error: ${e.message}`))
    await page.goto(base + (p === 'index' ? '' : `${p}.html`))
    if (p !== 'index') await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    const screen = SCREEN_PAGES.find(s => s.name === p)
    if (screen !== undefined) {
      // Inter is held back 1.5 s by the server; the page must relayout when it lands.
      await page.waitForFunction(() => document.documentElement.dataset.fontState === 'loaded', null, { timeout: 10_000 })
      await frame(page)
      const relaid = await page.evaluate(() => document.getElementById('font-status')?.textContent ?? '')
      if (!relaid.includes('watchFonts')) failures.push(`${where}: no relayout after the late font (status: ${relaid})`)
      const initial = await overflow(page)
      for (const k of initial.kit) failures.push(`${where} default: kit overflow: ${k}`)
      for (const g of initial.gaps) gapLog.push(`${where} default: ${g}`)
      if (vw === 1280 || (vw === 360 && p === 'responsive-ui')) {
        // A state where the two sides differ: German, and side by side where the page allows.
        if (p === 'responsive-ui') {
          const half = await page.evaluate(() => Math.floor((document.getElementById('stage')!.clientWidth - 24) / 2))
          await both(lang('de'), slider('width', vw === 360 ? 320 : half))(page)
        }
        if (p === 'text-size') await slider('scale', 1.3)(page)
        await frame(page)
        await page.evaluate(p => (document.querySelector(p === 'languages' ? '.lang-block:nth-child(2)' : '#stage') as HTMLElement).scrollIntoView(), p)
        await page.screenshot({ path: join(shots, `${p}${vw === 360 ? '-360' : ''}.png`), fullPage: false })
        await page.evaluate(() => window.scrollTo(0, 0))
      }
      let cssTotal = 0
      for (const s of screen.settings) {
        await s.apply(page)
        await frame(page)
        const o = await overflow(page)
        cssTotal += o.css
        for (const k of o.kit) failures.push(`${where} ${s.label}: kit overflow: ${k}`)
        for (const g of o.gaps) gapLog.push(`${where} ${s.label}: ${g}`)
      }
      // A drag: many nearby widths (or sizes), then the page's own steady-state cost readout.
      if (p !== 'text-size') for (let w = 700; w >= 400; w -= 5) { await slider('width', w)(page); await frame(page) }
      else for (let x = 0.8; x <= 1.5; x += 0.05) { await slider('scale', x.toFixed(2))(page); await frame(page) }
      const cost = await page.evaluate(() => [...document.querySelectorAll('#readout div')]
        .find(d => d.querySelector('dt')?.textContent?.startsWith('Kit time'))?.querySelector('dd')?.textContent ?? '')
      log.push(`${where}: ${screen.settings.length} settings, kit boxes overflowing 0, CSS boxes overflowing (summed) ${cssTotal}; after a drag: ${cost}`)
    } else if (vw === 1280 && p === 'accuracy') {
      await page.click('#factor-filter button[value="1"]')
      await page.click('table.grid button.c-platform >> nth=0')
      await page.screenshot({ path: join(shots, `${p}.png`), fullPage: false })
      log.push(`${where}: loaded`)
    } else {
      const o = await overflow(page)
      for (const k of o.kit) failures.push(`${where}: ${k}`)
      log.push(`${where}: loaded`)
    }
    await context.close()
  }
}

await browser.close()
server.kill()
console.log(log.join('\n'))
console.log(`\n${gapLog.length} kit-side pretext-gaps (the browser wrapped other than Pretext; not the kit's to correct):`)
console.log(gapLog.join('\n'))
if (failures.length > 0) {
  console.error(`\n${failures.length} failures:\n` + failures.slice(0, 60).join('\n'))
  process.exit(1)
}
console.log('\nexamples check passed')

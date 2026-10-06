// WIP diagnostic (v0.1.1-variable-font): widths of single glyphs and one word in Inter Variable at
// 1000px, Chromium Canvas / stand-in, per wght instance: `node verify/variable-probe.ts`.
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { install, registerFont } from '../src/headless/index.ts'
const file = 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
await registerFont('V', new Uint8Array(readFileSync(file)))
install()
const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
const chars = ['a', 'n', 'o', 'H', 'W', ' ', 'm', 'abonnieren']
const weights = [300, 400, 500, 600, 700, 800, 450, 401]
const node = weights.map(w => chars.map(c => { ctx.font = `${w} 1000px V`; return ctx.measureText(c).width }))
const server = createServer((req, res) => {
  if (req.url === '/f.woff2') res.writeHead(200, { 'content-type': 'font/woff2' }).end(readFileSync(file))
  else res.writeHead(200, { 'content-type': 'text/html' }).end(`<style>@font-face{font-family:V;src:url(/f.woff2) format("woff2");font-weight:100 900}</style>`)
}).listen(0)
await new Promise(r => server.once('listening', r))
const b = await chromium.launch({ headless: false }); const p = await b.newPage()
await p.goto(`http://127.0.0.1:${(server.address() as any).port}/`)
const chrome: number[][] = await p.evaluate(async ([chars, weights]) => {
  await document.fonts.load('400 16px V'); const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  return weights.map(w => chars.map(c => { ctx.font = `${w} 1000px V`; return ctx.measureText(c).width }))
}, [chars, weights] as const)
await b.close(); server.close()
weights.forEach((w, i) => console.log(w, chars.map((c, j) => `${JSON.stringify(c)} ${chrome[i]![j]!.toFixed(3)}/${node[i]![j]!.toFixed(3)}`).join('  ')))

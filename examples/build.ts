// npm run examples: bundles each page into examples/dist with esbuild, beside the HTML, the
// stylesheet, the bundled fonts and the accuracy and headless-parity data. The dist is plain static files.

import { build } from 'esbuild'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import de from 'hyphen/de/index.js'
import en from 'hyphen/en-us/index.js'
import fr from 'hyphen/fr/index.js'
import { STRINGS } from './src/strings.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const PAGES = ['responsive-ui', 'text-size', 'languages', 'accuracy', 'headless-parity']

// Card titles are hyphenated once, here, by TeX patterns (hyphen/de is de-1996), and shipped as soft
// hyphens; the pages use them only for a word wider than its card. The patterns stay out of the pages.
const hyphenatedTitles = {
  en: STRINGS.en.cards.map(c => en.hyphenateSync(c.title)),
  de: STRINGS.de.cards.map(c => de.hyphenateSync(c.title)),
  fr: STRINGS.fr.cards.map(c => fr.hyphenateSync(c.title)),
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

await build({
  entryPoints: PAGES.map(p => join(here, 'src', `${p}.ts`)),
  outdir: dist,
  bundle: true,
  // An IIFE per page: it runs from file:// as well as over http.
  format: 'iife',
  target: 'es2022',
  minify: true,
  sourcemap: 'linked',
  define: { __HYPHENATED_TITLES__: JSON.stringify(hyphenatedTitles) },
  logLevel: 'warning',
})

for (const f of readdirSync(here)) {
  if (f.endsWith('.html') || f === 'style.css' || f === 'accuracy-data.json' || f === 'headless-parity-data.json') cpSync(join(here, f), join(dist, f))
}
cpSync(join(here, 'fonts'), join(dist, 'fonts'), { recursive: true })
// headless-parity loads the very files the Node side registered (test/fonts), with their licences.
mkdirSync(join(dist, 'fonts/parity'), { recursive: true })
for (const f of ['Inter-Regular.ttf', 'OFL.txt', 'Roboto-Regular.ttf', 'Roboto-LICENSE.txt']) {
  cpSync(join(here, '../test/fonts', f), join(dist, 'fonts/parity', f))
}
console.log(`examples built into ${dist}`)

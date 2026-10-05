// npm run examples: bundles each page into examples/dist with esbuild, beside the HTML, the
// stylesheet, the bundled font and the accuracy data. The dist is plain static files.

import { build } from 'esbuild'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import de from 'hyphen/de/index.js'
import fr from 'hyphen/fr/index.js'
import { STRINGS, mapWords } from './src/strings.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const PAGES = ['responsive-ui', 'text-size', 'languages', 'accuracy']

// German and French are hyphenated once, here, by TeX patterns (hyphen/de is de-1996), and shipped
// as soft hyphens; the 750 KB of German patterns stay out of the pages.
const hyphenated = {
  de: mapWords(STRINGS.de, de.hyphenateSync),
  fr: mapWords(STRINGS.fr, fr.hyphenateSync),
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
  define: { __HYPHENATED__: JSON.stringify(hyphenated) },
  logLevel: 'warning',
})

for (const f of readdirSync(here)) {
  if (f.endsWith('.html') || f === 'style.css' || f === 'accuracy-data.json') cpSync(join(here, f), join(dist, f))
}
cpSync(join(here, 'fonts'), join(dist, 'fonts'), { recursive: true })
console.log(`examples built into ${dist}`)

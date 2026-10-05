// npm run examples:serve: a small static server for examples/dist on http://localhost:4173.
// `?delay=<ms>` on any file holds the response that long (at most 10 s), so a page can load a web
// font late on purpose and show watchFonts re-laying out.

import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT ?? 4173)
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let path = normalize(decodeURIComponent(url.pathname))
  if (path.endsWith(sep) || path.endsWith('/')) path += 'index.html'
  const file = join(root, path)
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return }
  let size: number
  try {
    const s = statSync(file)
    if (!s.isFile()) throw new Error('not a file')
    size = s.size
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
    return
  }
  const delay = Math.min(10_000, Math.max(0, Number(url.searchParams.get('delay') ?? 0) || 0))
  setTimeout(() => {
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': size,
      'cache-control': 'no-store',
    })
    createReadStream(file).pipe(res)
  }, delay)
}).listen(port, () => console.log(`pretext-kit examples on http://localhost:${port}/`))

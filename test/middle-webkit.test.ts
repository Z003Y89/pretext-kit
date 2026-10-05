import { test } from 'node:test'
import assert from 'node:assert/strict'

// Pretext reads the engine from the user agent once, so this file, which node --test runs in a
// process of its own, poses as Safari before Pretext loads (hence the dynamic imports).
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15' },
  configurable: true,
})
await import('./setup.ts')
const { prepareLabel, truncateMiddle } = await import('../src/middle.ts')

// Found by the browser sweep in WebKit: in text above U+00FF WebKit keeps a `/` on the line of an
// overflowing first character, so lines at width 0 are not one grapheme each there, the label's
// cut points skipped the slash, and keepEnd kept '3/bb.ts' instead of the name.
test('every grapheme is a cut point, so keepEnd starts at the slash in WebKit too', () => {
  const label = prepareLabel('āaaa 3/bb.ts', '20px Test')
  assert.ok(label.offsets.includes(6))
  assert.equal(truncateMiddle(label, 90, { from: 6 }), 'āa…/bb.ts')
})

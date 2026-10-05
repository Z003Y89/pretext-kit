// A process of its own. jsdom's window is exposed as globals BEFORE Pretext is imported, as in a
// jest/vitest jsdom environment where `document` exists before any test module loads.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><body></body>')
Reflect.set(globalThis, 'window', dom.window)
Reflect.set(globalThis, 'document', dom.window.document)

// Dynamic imports: static ones are hoisted above the globals set here.
const { prepare, prepareWithSegments, measureLineStats } = await import('@chenglou/pretext')
const { HeadlessCoverageError, install, registerFont } = await import('../../src/headless/index.ts')

await registerFont('Inter', new Uint8Array(readFileSync(new URL('../fonts/Inter-Regular.ttf', import.meta.url))))
install()

const FONT = '16px Inter'
const lineWidth = (text: string) => measureLineStats(prepareWithSegments(text, FONT), 10_000).maxLineWidth

test('jsdom provides a document.body, whose spans measure 0 (the hazard)', () => {
  assert.ok(document.body)
  const span = document.createElement('span')
  document.body.appendChild(span)
  span.textContent = 'Speichern'
  assert.equal(span.getBoundingClientRect().width, 0)
  span.remove()
})

test('a covered string measures as it does without jsdom', () => {
  // 76.921875 is what test/headless/canvas.test.ts asserts for the same text in a process without jsdom.
  assert.equal(lineWidth('Speichern'), 76.921875)
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
  ctx.font = FONT
  assert.equal(ctx.measureText('Speichern').width, 76.921875)
})

test('an emoji Inter does not cover throws instead of measuring 0 through the DOM correction', () => {
  // Without the coverage error, Pretext would replace the emoji's width with the jsdom span's 0.
  assert.throws(() => prepare('Weiter 🎉', FONT), HeadlessCoverageError)
})

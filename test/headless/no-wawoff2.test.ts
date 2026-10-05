// Final review I-2: wawoff2 is an optional peer, so pretext-kit/headless must load, and register
// TTF, WOFF and the rest, where it is not installed. A resolve hook makes it unresolvable here, so
// this file is a process of its own (node --test runs each file in one).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'wawoff2') {
      throw Object.assign(new Error(`Cannot find package 'wawoff2'`), { code: 'ERR_MODULE_NOT_FOUND' })
    }
    return next(specifier, context)
  },
})

const font = (name: string) => new Uint8Array(readFileSync(new URL(`../fonts/${name}`, import.meta.url)))

test('the headless entry loads and registers a TTF without wawoff2', async () => {
  const { registerFont } = await import('../../src/headless/index.ts')
  await registerFont('Inter', font('Inter-Regular.ttf'))
})

test('a WOFF2 font without wawoff2 rejects, naming the package to install', async () => {
  const { registerFont } = await import('../../src/headless/index.ts')
  await assert.rejects(registerFont('Inter2', font('Inter-Regular.woff2')), /npm i -D wawoff2/)
})

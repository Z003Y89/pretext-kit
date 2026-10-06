import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { clearCache } from '@chenglou/pretext'
import { install, registerFont } from '../headless/index.ts'
import { fontFamilies, runCheck } from './run.ts'
import type { CheckPlatform, CheckInput, FontSource, Report } from './types.ts'

export { conditionGrid } from './conditions.ts'
export { slotFromStyle } from './style.ts'
export type * from './types.ts'

const TNUM = '"tnum" 1'
const registered = new Set<string>()

async function register(family: string, source: FontSource, data: Uint8Array, featureSettings: string | undefined): Promise<void> {
  const id = JSON.stringify([family, source.weight, source.style, source.unicodeRange, featureSettings, createHash('sha1').update(data).digest('hex')])
  try {
    await registerFont(family, data, { weight: source.weight, style: source.style, unicodeRange: source.unicodeRange, featureSettings })
    registered.add(id)
  } catch (error) {
    if (!registered.has(id)) throw error
  }
}

export async function checkLabels(input: CheckInput): Promise<Report> {
  const slots = typeof input.slots === 'function' ? await input.slots() : input.slots
  const tabular = new Set<string>()
  for (const [name, slot] of Object.entries(slots)) {
    const variants = [slot, ...(input.conditions ?? []).map((c) => ({ ...slot, ...c.slots?.[name] }))]
    for (const variant of variants) {
      if (variant.numeric === 'tabular') for (const family of fontFamilies(variant.font)) tabular.add(family.toLowerCase())
    }
  }
  for (const source of input.fonts) {
    const data = source.data ?? (source.path === undefined ? undefined : new Uint8Array(readFileSync(source.path)))
    if (data === undefined) throw new RangeError(`font "${source.family}": give data or path`)
    await register(source.family, source, data, source.featureSettings)
    if (tabular.has(source.family.toLowerCase())) {
      const features = source.featureSettings === undefined ? TNUM : `${source.featureSettings}, ${TNUM}`
      await register(`${source.family} __tnum`, source, data, features)
    }
  }
  return runCheck(
    { ...input, slots },
    {
      platforms: ['macos', 'windows', 'linux'],
      select: (platform: CheckPlatform) => {
        if (platform === 'browser') throw new RangeError("platform 'browser' is for the browser entry")
        install({ platform, onMissingGlyph: 'throw', rounding: 'none' })
        clearCache()
      },
      tabularFamily: (family) => (tabular.has(family.toLowerCase()) ? `${family} __tnum` : null),
    },
  )
}

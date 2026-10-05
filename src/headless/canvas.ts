import { Buffer, Feature, Font, Variation, shape } from 'harfbuzzjs'
import { findFace, type FontFace } from './fonts.ts'
import { parseFont, type ParsedFont } from './shorthand.ts'

// Pretext picks its engine profile from the user agent; Node's and jsdom's pick Blink but not
// desktop Blink, whose profile the stand-in's widths are Chrome's for.
export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'

export type InstallOptions = {
  // 'throw' (default): a code point no registered family covers throws HeadlessCoverageError.
  // 'notdef': it measures as the .notdef glyph of the first registered family in the list.
  onMissingGlyph?: 'throw' | 'notdef'
  // 'whole-px' rounds each glyph advance to a whole px before summing, as Linux Chrome
  // (FreeType without subpixel positioning) is expected to; 'none' (default) keeps them exact.
  rounding?: 'none' | 'whole-px'
}

const options: { onMissingGlyph: 'throw' | 'notdef'; rounding: 'none' | 'whole-px' } = {
  onMissingGlyph: 'throw',
  rounding: 'none',
}

// A class so `instanceof` tells it from other errors; it carries what was missing.
export class HeadlessCoverageError extends Error {
  readonly codePoint: number
  readonly families: readonly string[]

  constructor(codePoint: number, families: readonly string[]) {
    const hex = codePoint.toString(16).toUpperCase().padStart(4, '0')
    const names = families.map(family => `"${family}"`).join(', ')
    super(
      `No registered font covers U+${hex} (${JSON.stringify(String.fromCodePoint(codePoint))}) in ${names}. ` +
        "Register a font that has it, or call install({ onMissingGlyph: 'notdef' }) to measure it as .notdef.",
    )
    this.name = 'HeadlessCoverageError'
    this.codePoint = codePoint
    this.families = families
  }
}

export type HeadlessTextMetrics = {
  width: number
  actualBoundingBoxLeft: number
  actualBoundingBoxRight: number
}

const DEFAULT_FONT = '10px sans-serif'
const LINE_SEPARATOR = 0x2028
const PARAGRAPH_SEPARATOR = 0x2029
// Canvas replaces ASCII white space with U+0020 before measuring (HTML, "text preparation algorithm").
const asciiWhiteSpaceRe = /[\t\n\f\r]/g
const defaultIgnorableRe = /\p{Default_Ignorable_Code_Point}/u
const markRe = /\p{M}/u
const lengthRe = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|pt|em|rem)\s*$/i
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// What each registered face covers, read once per face.
const coverage = new WeakMap<FontFace, Set<number>>()
// HarfBuzz fonts per face, by size and variation instance.
const fonts = new WeakMap<FontFace, Map<string, Font>>()

function covers(face: FontFace, codePoint: number): boolean {
  let set = coverage.get(face)
  if (set === undefined) {
    set = new Set(face.face.collectUnicodes())
    coverage.set(face, set)
  }
  return set.has(codePoint)
}

function axisValue(face: FontFace, tag: string, wanted: number): number | null {
  for (let i = 0; i < face.axes.length; i++) {
    const axis = face.axes[i]!
    if (axis.tag === tag) return Math.min(axis.max, Math.max(axis.min, wanted))
  }
  return null
}

// A registered weight only picks the face; on a variable face the weight, optical size
// (Chrome applies font-optical-sizing: auto to Canvas) and stretch are set on its axes.
function fontFor(face: FontFace, parsed: ParsedFont): Font {
  const wght = axisValue(face, 'wght', parsed.weight)
  const opsz = axisValue(face, 'opsz', parsed.sizePx)
  const wdth = axisValue(face, 'wdth', parsed.stretch)
  const key = `${parsed.sizePx}|${wght}|${opsz}|${wdth}`
  let bySize = fonts.get(face)
  if (bySize === undefined) {
    bySize = new Map()
    fonts.set(face, bySize)
  }
  let font = bySize.get(key)
  if (font === undefined) {
    font = new Font(face.face)
    const scale = Math.round(parsed.sizePx * 65536)
    font.setScale(scale, scale)
    const variations: Variation[] = []
    if (wght !== null) variations.push(new Variation('wght', wght))
    if (opsz !== null) variations.push(new Variation('opsz', opsz))
    if (wdth !== null) variations.push(new Variation('wdth', wdth))
    if (variations.length > 0) font.setVariations(variations)
    bySize.set(key, font)
  }
  return font
}

// The face each family in the list resolves to, in order; unregistered names drop out.
function resolveFaces(parsed: ParsedFont): FontFace[] {
  const style = parsed.style === 'normal' ? 'normal' : 'italic'
  const faces: FontFace[] = []
  for (let i = 0; i < parsed.families.length; i++) {
    const face = findFace(parsed.families[i]!, parsed.weight, style)
    if (face !== undefined && !faces.includes(face)) faces.push(face)
  }
  return faces
}

// Which face draws a code point: the first in the list that covers it. Default ignorables
// (ZWJ, ZWNJ, ZWSP, variation selectors…) stay in the run they are in, and HarfBuzz makes them
// zero-width when the face lacks them: browsers don't fall back to another font for an
// invisible character, so a missing one is no coverage error. A combining mark stays with its
// base's face when that face has it. Blink draws U+2028 and U+2029 with the space glyph
// where the font has none (harfbuzz_face.cc), so a face with a space covers them.
function faceFor(codePoint: number, faces: FontFace[], current: FontFace | null, families: readonly string[]): FontFace {
  const char = String.fromCodePoint(codePoint)
  if (defaultIgnorableRe.test(char)) {
    if (current !== null) return current
    for (let i = 0; i < faces.length; i++) if (covers(faces[i]!, codePoint)) return faces[i]!
    if (faces.length > 0) return faces[0]!
  } else {
    if (current !== null && markRe.test(char) && covers(current, codePoint)) return current
    const separator = codePoint === LINE_SEPARATOR || codePoint === PARAGRAPH_SEPARATOR
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i]!
      if (covers(face, codePoint) || (separator && covers(face, 0x20))) return face
    }
    if (options.onMissingGlyph === 'notdef' && faces.length > 0) return current ?? faces[0]!
  }
  throw new HeadlessCoverageError(codePoint, families)
}

// Blink's Canvas shapes text word by word (CachingWordShaper): each U+0020 is a word of its
// own, so nothing kerns across a space, and so is each CJK ideograph and kana
// (NextWordEndIndex, plain_text_node.cc; the letter ranges Pretext's takesNoSpaceKerning lists).
function isWordOfItsOwn(codePoint: number): boolean {
  return codePoint === 0x20 ||
    (codePoint >= 0x3041 && codePoint <= 0x3096) || (codePoint >= 0x30a1 && codePoint <= 0x30fa) ||
    (codePoint >= 0x3400 && codePoint <= 0x9fff) || (codePoint >= 0xf900 && codePoint <= 0xfaff)
}

type Shaping = {
  parsed: ParsedFont
  faces: FontFace[]
  features: Feature[]
  spacing: number
  language: string | null
}

// Where each glyph was put, for the ink bounds, which only Pretext's Han kerning asks for.
type Placed = { fonts: Font[]; glyphs: number[]; xs: number[] }

function advancePx(xAdvance: number): number {
  const px = Math.fround(xAdvance / 65536)
  return options.rounding === 'whole-px' ? Math.round(px) : px
}

// Shapes one word in runs of one face each and returns the width so far, accumulated as
// Blink does, in float32. Spacing is added after each grapheme the word ends.
function shapeWord(codePoints: number[], graphemeEnds: Uint8Array, start: number, end: number, shaping: Shaping, width: number, placed: Placed): number {
  let runStart = start
  let runFace: FontFace | null = null
  const flush = (runEnd: number): void => {
    if (runFace === null || runEnd === runStart) return
    const font = fontFor(runFace, shaping.parsed)
    // The whole word is the run's context, as Blink gives HarfBuzz.
    const context = codePoints.slice(start, end)
    for (let i = 0; i < context.length; i++) {
      const cp = context[i]!
      if ((cp === LINE_SEPARATOR || cp === PARAGRAPH_SEPARATOR) && !covers(runFace, cp)) context[i] = 0x20
    }
    const buffer = new Buffer()
    buffer.addCodePoints(context, runStart - start, runEnd - runStart)
    buffer.guessSegmentProperties()
    if (shaping.language !== null) buffer.setLanguage(shaping.language)
    shape(font, buffer, shaping.features)
    const infos = buffer.getGlyphInfos()
    const positions = buffer.getGlyphPositions()
    for (let i = 0; i < infos.length; i++) {
      const cluster = start + infos[i]!.cluster
      placed.fonts.push(font)
      placed.glyphs.push(infos[i]!.codepoint)
      placed.xs.push(width + positions[i]!.xOffset / 65536)
      width = Math.fround(width + advancePx(positions[i]!.xAdvance))
      // Spacing goes after the last glyph of a grapheme's cluster.
      const next = i + 1 < infos.length ? start + infos[i + 1]!.cluster : runEnd
      if (shaping.spacing !== 0 && next !== cluster) {
        for (let c = cluster; c < next; c++) if (graphemeEnds[c] === 1) width = Math.fround(width + shaping.spacing)
      }
    }
    runStart = runEnd
  }
  for (let i = start; i < end; i++) {
    const face = faceFor(codePoints[i]!, shaping.faces, runFace, shaping.parsed.families)
    if (face !== runFace) {
      flush(i)
      runFace = face
      runStart = i
    }
  }
  flush(end)
  return width
}

function measure(text: string, shaping: Shaping): HeadlessTextMetrics {
  const normalized = text.replace(asciiWhiteSpaceRe, ' ')
  const codePoints: number[] = []
  const graphemeEnds: number[] = []
  for (const { segment } of graphemes.segment(normalized)) {
    for (const ch of segment) {
      codePoints.push(ch.codePointAt(0)!)
      graphemeEnds.push(0)
    }
    graphemeEnds[graphemeEnds.length - 1] = 1
  }
  const ends = Uint8Array.from(graphemeEnds)
  const placed: Placed = { fonts: [], glyphs: [], xs: [] }
  let width = 0
  let wordStart = 0
  for (let i = 0; i <= codePoints.length; i++) {
    if (i < codePoints.length && !isWordOfItsOwn(codePoints[i]!)) continue
    width = shapeWord(codePoints, ends, wordStart, i, shaping, width, placed)
    if (i < codePoints.length) width = shapeWord(codePoints, ends, i, i + 1, shaping, width, placed)
    wordStart = i + 1
  }
  // As in Chrome, measured from the text's start: actualBoundingBoxLeft is negative when the ink
  // starts right of it, and both are 0 for text without ink.
  let measured = false
  let left = 0
  let right = 0
  const bounds = (): void => {
    if (measured) return
    measured = true
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < placed.glyphs.length; i++) {
      const extents = placed.fonts[i]!.glyphExtents(placed.glyphs[i]!)
      if (extents === undefined || extents.width === 0) continue
      const x0 = placed.xs[i]! + extents.xBearing / 65536
      const x1 = x0 + extents.width / 65536
      minX = Math.min(minX, x0, x1)
      maxX = Math.max(maxX, x0, x1)
    }
    if (minX <= maxX) {
      left = -minX
      right = maxX
    }
  }
  return {
    width,
    get actualBoundingBoxLeft() {
      bounds()
      return left
    },
    get actualBoundingBoxRight() {
      bounds()
      return right
    },
  }
}

// Canvas keeps letterSpacing as the CSS length it was given and ignores what doesn't parse.
function parseLength(value: string, sizePx: number): { text: string; px: number } | null {
  const match = lengthRe.exec(value)
  if (match === null) return null
  const n = Number(match[1])
  const unit = match[2]!.toLowerCase()
  const px = unit === 'px' ? n : unit === 'pt' ? (n * 4) / 3 : unit === 'em' ? n * sizePx : n * 16
  return Number.isFinite(px) ? { text: `${n}${unit}`, px } : null
}

export type HeadlessContext = {
  font: string
  letterSpacing: string
  fontKerning: 'auto' | 'normal' | 'none'
  lang: string
  measureText(text: string): HeadlessTextMetrics
}

function createContext(): HeadlessContext {
  let font = DEFAULT_FONT
  let parsed = parseFont(DEFAULT_FONT)
  let letterSpacing = '0px'
  let spacingPx = 0
  let fontKerning: HeadlessContext['fontKerning'] = 'auto'
  let lang = 'inherit'
  return {
    get font() {
      return font
    },
    set font(value: string) {
      try {
        parsed = parseFont(String(value))
        font = String(value)
      } catch (error) {
        if (!(error instanceof RangeError)) throw error
      }
    },
    get letterSpacing() {
      return letterSpacing
    },
    set letterSpacing(value: string) {
      const length = parseLength(String(value), parsed.sizePx)
      if (length === null) return
      letterSpacing = length.text
      spacingPx = length.px
    },
    get fontKerning() {
      return fontKerning
    },
    set fontKerning(value: HeadlessContext['fontKerning']) {
      if (value === 'auto' || value === 'normal' || value === 'none') fontKerning = value
    },
    get lang() {
      return lang
    },
    set lang(value: string) {
      lang = String(value)
    },
    measureText(text: string): HeadlessTextMetrics {
      const features: Feature[] = []
      // fontKerning 'none' turns the kern feature off (font_features.cc).
      if (fontKerning === 'none') features.push(new Feature('kern', 0))
      // Under any non-zero letter spacing Blink turns optional ligatures off, even spacing
      // too small to add width (Pretext's LETTER_SPACED_SHAPING relies on this).
      if (spacingPx !== 0) features.push(new Feature('liga', 0), new Feature('clig', 0), new Feature('calt', 0))
      const faces = resolveFaces(parsed)
      return measure(String(text), {
        parsed,
        faces,
        features,
        // Blink adds spacing in units of 1/65536 px (ShapeResultSpacing::SetSpacing).
        spacing: Math.fround(Math.round(spacingPx * 65536) / 65536),
        language: lang === 'inherit' || lang === '' ? null : lang,
      })
    },
  }
}

// A class because Pretext constructs it: `new OffscreenCanvas(1, 1).getContext('2d')`.
export class HeadlessOffscreenCanvas {
  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  getContext(kind: string): HeadlessContext | null {
    return kind === '2d' ? createContext() : null
  }
}

// Until install(), a lookup of OffscreenCanvas is recorded: Pretext looks for one when it first
// prepares text, right after fixing its engine profile from the user agent, so a lookup before
// install() means the profile may already be Node's. Assigning a value replaces the trap.
let lookedUpBeforeInstall = false

function lookupTrap(): undefined {
  lookedUpBeforeInstall = true
  return undefined
}

function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: false })
}

if (!('OffscreenCanvas' in globalThis)) {
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    configurable: true,
    enumerable: false,
    get: lookupTrap,
    set(value: unknown) {
      defineGlobal('OffscreenCanvas', value)
    },
  })
}

function currentOffscreenCanvas(): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas')
  if (descriptor?.get === lookupTrap) return undefined
  return descriptor === undefined ? Reflect.get(globalThis, 'OffscreenCanvas') : descriptor.value ?? descriptor.get?.call(globalThis)
}

function setUserAgent(): void {
  const nav: unknown = Reflect.get(globalThis, 'navigator')
  if (typeof nav === 'object' && nav !== null) {
    Object.defineProperty(nav, 'userAgent', { value: CHROME_USER_AGENT, configurable: true, enumerable: true })
  } else {
    defineGlobal('navigator', { userAgent: CHROME_USER_AGENT })
  }
}

// Installs the stand-in as globalThis.OffscreenCanvas and a desktop Chrome user agent. Call it
// before Pretext first prepares text. Calling it again only changes the options; clear Pretext's
// caches (clearCache()) if widths it already measured should follow them.
export function install(installOptions: InstallOptions = {}): void {
  const onMissingGlyph = installOptions.onMissingGlyph ?? 'throw'
  const rounding = installOptions.rounding ?? 'none'
  if (onMissingGlyph !== 'throw' && onMissingGlyph !== 'notdef') {
    throw new RangeError(`install: onMissingGlyph must be 'throw' or 'notdef', not ${JSON.stringify(onMissingGlyph)}`)
  }
  if (rounding !== 'none' && rounding !== 'whole-px') {
    throw new RangeError(`install: rounding must be 'none' or 'whole-px', not ${JSON.stringify(rounding)}`)
  }
  const existing = currentOffscreenCanvas()
  if (existing !== undefined && existing !== HeadlessOffscreenCanvas) {
    throw new Error(
      'install: globalThis.OffscreenCanvas is already another implementation; remove it (or the test setup ' +
        'that sets it) so the headless stand-in measures.',
    )
  }
  if (lookedUpBeforeInstall) {
    throw new Error(
      'install: Pretext already looked for a canvas, so its engine profile is fixed from the old user agent. ' +
        'Call install() before Pretext first prepares text, at the top of the test setup.',
    )
  }
  options.onMissingGlyph = onMissingGlyph
  options.rounding = rounding
  setUserAgent()
  defineGlobal('OffscreenCanvas', HeadlessOffscreenCanvas)
}

import { Buffer, Feature, Font, FontFuncs, Variation, shape } from 'harfbuzzjs'
import { findFaces, hbFace, inUnicodeRange, type FontFace } from './fonts.ts'
import { normalizedCoords, readAdvanceVariations, variedAdvance, type AdvanceVariations } from './hvar.ts'
import { HEADLESS, sharedState } from './shared.ts'
import { parseFont, type ParsedFont } from './shorthand.ts'

// Pretext picks its engine profile from the user agent; Node's and jsdom's pick Blink but not
// desktop Blink, whose profile the stand-in's widths are Chrome's for.
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'

export type InstallOptions = {
  // 'throw' (default): a code point no registered family covers throws HeadlessCoverageError.
  // 'notdef': it measures as .notdef, from the face of the run it is in, or else from the first
  // registered family in the list.
  onMissingGlyph?: 'throw' | 'notdef'
  // 'whole-px' rounds each glyph advance to a whole px before summing, as Linux Chrome
  // (FreeType without subpixel positioning) is expected to; 'none' (default) keeps them exact.
  rounding?: 'none' | 'whole-px'
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
const ZWSP = 0x200b
const HYPHEN = '\u2010'
// Canvas replaces ASCII white space with U+0020 before measuring (HTML, "text preparation algorithm").
const asciiWhiteSpaceRe = /[\t\n\f\r]/g
// Chrome's Canvas turns SHY, ZWSP, LRM, RLM, U+202A-U+202E, U+FEFF and U+FFFC into U+200B, which
// ends a Canvas word (plain_text_node.cc:47-62, character.h:167-175; Pretext RESEARCH.md).
const zwspLikeRe = /[\u00AD\u200B\u200E\u200F\u202A-\u202E\uFEFF\uFFFC]/g
const defaultIgnorableRe = /\p{Default_Ignorable_Code_Point}/u
const markRe = /\p{M}/u
const lengthRe = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|pt|em|rem)\s*$/i
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// What each registered face covers (its cmap, within its unicode-range), read once per face.
const coverage = new WeakMap<FontFace, Set<number>>()
// HarfBuzz fonts per face, by size and variation instance.
const fonts = new WeakMap<FontFace, Map<string, Font>>()

function covers(face: FontFace, codePoint: number): boolean {
  let set = coverage.get(face)
  if (set === undefined) {
    set = new Set()
    const cmap = hbFace(face).collectUnicodes()
    for (let i = 0; i < cmap.length; i++) if (inUnicodeRange(face, cmap[i]!)) set.add(cmap[i]!)
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

// The wght a variable face is shaped at: as Chrome does, the requested weight clamped to the
// weight range the face was registered with (its @font-face descriptor), then to the axis.
export function instanceWeight(face: FontFace, weight: number): number | null {
  return axisValue(face, 'wght', Math.min(face.weightMax, Math.max(face.weightMin, weight)))
}

// Each face's hmtx + HVAR, read once, or null where it has none (or avar version 2).
const advanceVariations = new WeakMap<FontFace, AdvanceVariations | null>()

function advanceVariationsOf(face: FontFace): AdvanceVariations | null {
  let variations = advanceVariations.get(face)
  if (variations === undefined) {
    variations = face.axes.length === 0 ? null : readAdvanceVariations(face.data, face.index)
    advanceVariations.set(face, variations)
  }
  return variations
}

// The advances of a varied instance, by the HarfBuzz font that shapes it.
type VariedAdvances = { variations: AdvanceVariations; coords: Int16Array; pxPerUnit: number; byGlyph: Map<number, number> }
const variedFonts = new Map<number, VariedAdvances>()
const forgetVaried = new FinalizationRegistry<number>(ptr => variedFonts.delete(ptr))
let variedFuncs: FontFuncs | undefined

// A glyph's advance in Chrome on macOS, in 1/65536 px: CoreText's unrounded advance in font units
// (hvar.ts), scaled to px in float32 (Skia's SkScalar) and truncated to HarfBuzz's 16.16 position
// (Blink's SkiaScalarToHarfBuzzPosition). Fitted to Chrome 149: 6549 of 6555 single-glyph widths
// of Inter Variable (95 glyphs, 23 weights, 16, 13.5 and 1000px) bit-exact, the rest 1/65536 px off.
function variedAdvanceFunc(font: Font, glyph: number): number {
  const varied = variedFonts.get(font.ptr)!
  let advance = varied.byGlyph.get(glyph)
  if (advance === undefined) {
    const units = variedAdvance(varied.variations, varied.coords, glyph)
    advance = Math.trunc(Math.fround(Math.fround(units) * varied.pxPerUnit) * 65536)
    varied.byGlyph.set(glyph, advance)
  }
  return advance
}

// HarfBuzz rounds a variable font's HVAR delta to whole font units (hvar.ts); a varied instance
// is therefore shaped with a sub font whose horizontal advances are Chrome's, everything else
// (glyphs, GPOS with its variation deltas, extents) coming from HarfBuzz's own font. The default
// instance, where every delta is 0, and static faces keep HarfBuzz's font as it is.
function withVariedAdvances(font: Font, face: FontFace, sizePx: number, design: Map<string, number>): Font {
  const variations = advanceVariationsOf(face)
  if (variations === null) return font
  const coords = normalizedCoords(variations, design)
  if (coords.every(coord => coord === 0)) return font
  variedFuncs ??= (() => {
    const funcs = new FontFuncs()
    funcs.setGlyphHAdvanceFunc(variedAdvanceFunc)
    return funcs
  })()
  const sub = font.subFont()
  sub.setFuncs(variedFuncs)
  variedFonts.set(sub.ptr, { variations, coords, pxPerUnit: Math.fround(sizePx / face.upem), byGlyph: new Map() })
  forgetVaried.register(sub, sub.ptr)
  return sub
}

// A registered weight picks the face; on a variable face the weight, optical size (Chrome
// applies font-optical-sizing: auto to Canvas) and stretch are also set on its axes.
function fontFor(face: FontFace, parsed: ParsedFont): Font {
  const wght = instanceWeight(face, parsed.weight)
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
    font = new Font(hbFace(face))
    const scale = Math.round(parsed.sizePx * 65536)
    font.setScale(scale, scale)
    const variations: Variation[] = []
    const design = new Map<string, number>()
    if (wght !== null) design.set('wght', wght)
    if (opsz !== null) design.set('opsz', opsz)
    if (wdth !== null) design.set('wdth', wdth)
    for (const [tag, value] of design) variations.push(new Variation(tag, value))
    if (variations.length > 0) {
      font.setVariations(variations)
      font = withVariedAdvances(font, face, parsed.sizePx, design)
    }
    bySize.set(key, font)
  }
  return font
}

// The faces each family in the list resolves to, in order (a family split by unicode-range
// resolves to all its files of the matched weight and style); unregistered names drop out.
function resolveFaces(parsed: ParsedFont): FontFace[] {
  const style = parsed.style === 'normal' ? 'normal' : 'italic'
  const faces: FontFace[] = []
  for (let i = 0; i < parsed.families.length; i++) {
    const matched = findFaces(parsed.families[i]!, parsed.weight, style)
    for (let j = 0; j < matched.length; j++) if (!faces.includes(matched[j]!)) faces.push(matched[j]!)
  }
  return faces
}

// Which face draws a code point: the first in the list that covers it. Default ignorables
// (ZWJ, ZWNJ, ZWSP, variation selectors…) stay in the run they are in, and HarfBuzz makes them
// zero-width when the face lacks them: browsers don't fall back to another font for an
// invisible character, so a missing one is no coverage error. A combining mark stays with its
// base's face when that face has it. Blink draws U+2028 and U+2029 with the space glyph
// where the font has none (harfbuzz_face.cc), so a face with a space covers them.
function faceFor(codePoint: number, faces: FontFace[], current: FontFace | null, families: readonly string[], notdef: boolean): FontFace {
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
    if (notdef && faces.length > 0) return current ?? faces[0]!
  }
  throw new HeadlessCoverageError(codePoint, families)
}

// Blink's Canvas shapes text word by word (NextWordEndIndex, plain_text_node.cc:84-155): each
// U+0020 (TAB has become one) and U+200B is a word of its own, so nothing kerns across them,
// and so is each CJK ideograph and kana: here the letter ranges Pretext's takesNoSpaceKerning
// lists. Blink's set (IsCJKIdeographOrSymbol) also cuts around CJK symbols and punctuation;
// that is not implemented, being outside the registered-Latin-fonts claim.
function isWordOfItsOwn(codePoint: number): boolean {
  return codePoint === 0x20 || codePoint === ZWSP ||
    (codePoint >= 0x3041 && codePoint <= 0x3096) || (codePoint >= 0x30a1 && codePoint <= 0x30fa) ||
    (codePoint >= 0x3400 && codePoint <= 0x9fff) || (codePoint >= 0xf900 && codePoint <= 0xfaff)
}

type Shaping = {
  parsed: ParsedFont
  notdef: boolean // Measure what no face covers as .notdef instead of throwing
  rounding: 'none' | 'whole-px'
  faces: FontFace[]
  features: Feature[]
  spacing: number
  language: string | null
}

// Where each glyph was put, for the ink bounds, which only Pretext's Han kerning asks for.
type Placed = { fonts: Font[]; glyphs: number[]; xs: number[] }

// A glyph advance in 1/65536 px, the unit Blink keeps glyph advances in (TextRunLayoutUnit).
function advanceUnits(xAdvance: number, rounding: Shaping['rounding']): number {
  return rounding === 'whole-px' ? Math.round(Math.fround(xAdvance / 65536)) * 65536 : xAdvance
}

// Shapes one word in runs of one face each and returns the width so far, accumulated as Blink
// does: a run's glyph advances and spacing are summed in 1/65536 px (TextRunLayoutUnit) and the
// run's width is added to the total in float32. Summing glyph by glyph in float32 instead loses
// the low bits of fractional advances (a variable font's, measured with Inter Variable at wght
// 500, 1000px: "abonnieren" is fround(sum) in Chrome, one float32 step above the float sum).
// Spacing is added after each grapheme the word ends.
function shapeWord(codePoints: number[], graphemeEnds: Uint8Array, start: number, end: number, shaping: Shaping, width: number, placed: Placed): number {
  let runStart = start
  let runFace: FontFace | null = null
  const spacingUnits = Math.round(shaping.spacing * 65536)
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
    let run = 0
    for (let i = 0; i < infos.length; i++) {
      const cluster = start + infos[i]!.cluster
      placed.fonts.push(font)
      placed.glyphs.push(infos[i]!.codepoint)
      placed.xs.push(width + (run + positions[i]!.xOffset) / 65536)
      run += advanceUnits(positions[i]!.xAdvance, shaping.rounding)
      // Spacing goes after the last glyph of a grapheme's cluster.
      const next = i + 1 < infos.length ? start + infos[i + 1]!.cluster : runEnd
      if (spacingUnits !== 0 && next !== cluster) {
        for (let c = cluster; c < next; c++) if (graphemeEnds[c] === 1) run += spacingUnits
      }
    }
    width = Math.fround(width + Math.fround(run / 65536))
    runStart = runEnd
  }
  for (let i = start; i < end; i++) {
    const face = faceFor(codePoints[i]!, shaping.faces, runFace, shaping.parsed.families, shaping.notdef)
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
  const normalized = text.replace(asciiWhiteSpaceRe, ' ').replace(zwspLikeRe, '\u200B')
  const codePoints: number[] = []
  const graphemeEnds: number[] = []
  for (const { segment } of graphemes.segment(normalized)) {
    for (const ch of segment) {
      codePoints.push(ch.codePointAt(0)!)
      graphemeEnds.push(0)
    }
    // Chrome adds no letter spacing after a character it treats as a zero-width space (measured in
    // verify/HEADLESS_RESULTS.md); every one Canvas knows has become U+200B by now.
    if (segment.codePointAt(0) !== ZWSP || segment.length !== 1) graphemeEnds[graphemeEnds.length - 1] = 1
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

// Why generic families get stand-in widths. Before Pretext breaks at a soft hyphen it asks which
// hyphen Chrome draws (getHyphenText, Pretext's measurement.ts): where U+2010 and '-' measure
// differently in the font, it measures ' ' and U+2010 in bare `16px monospace` and `16px serif`,
// and then in `<family>, monospace` against `<family>, serif`. A family whose font draws the
// character measures it alike in both; one that lacks it falls through to the two generics,
// which measure it differently. So Chrome's decision (the font's own U+2010 where it has one,
// else '-') needs the generics to measure, and to measure differently from each other, though
// nothing registers them. Each unregistered generic therefore measures every code point at a
// fixed fraction of the size, different per generic, but only for those probes: the text ' ' or
// U+2010 alone, where no registered family before the generic covers it. Any other text never
// reaches a generic stand-in: it is shaped with registered faces or throws HeadlessCoverageError.
// U+2010 alone is also lenient where no registered family has it and no generic follows: it
// measures as .notdef instead of throwing, which is what lets Pretext go on to the probes.
const GENERIC_STAND_IN_EM = new Map<string, number>([
  ['serif', 0.25],
  ['sans-serif', 0.3],
  ['monospace', 0.6],
  ['cursive', 0.35],
  ['fantasy', 0.4],
  ['system-ui', 0.45],
  ['ui-serif', 0.26],
  ['ui-sans-serif', 0.31],
  ['ui-monospace', 0.61],
  ['ui-rounded', 0.36],
  ['math', 0.27],
  ['emoji', 0.5],
  ['fangsong', 0.55],
])

function isHyphenProbe(text: string): boolean {
  return text === ' ' || text === HYPHEN
}

// The stand-in width of a probe in the first unregistered generic of the list, or null where a
// registered family before it covers the probe (or no generic is listed) and real shaping measures.
function genericProbeWidth(text: string, parsed: ParsedFont, spacing: number): number | null {
  const codePoint = text.charCodeAt(0)
  const style = parsed.style === 'normal' ? 'normal' : 'italic'
  for (let i = 0; i < parsed.families.length; i++) {
    const family = parsed.families[i]!
    const matched = findFaces(family, parsed.weight, style)
    if (matched.length > 0) {
      if (matched.some(face => covers(face, codePoint))) return null
      continue
    }
    const em = GENERIC_STAND_IN_EM.get(family.toLowerCase())
    if (em !== undefined) return Math.fround(Math.fround(em * parsed.sizePx) + spacing)
  }
  return null
}

// Why U+300C gets stand-in widths. Whenever a text holds a character in U+2018-U+301F (curly and
// German quotes, the ellipsis, CJK marks: han-kerning.ts maybeHanKerningRe) and the profile is
// Blink, Pretext's getFontData (han-kerning.ts:127-131) first measures '「' and '「「' and takes
// trim = 2 W(「) - W(「「). When trim <= 1e-3 it stores null for the font and applies no Han
// kerning at all. Chrome measures that probe in an OS CJK fallback font, which we can't
// reproduce, and Inter has no U+300C, so without a stand-in „Tagesabschlussbericht“ would throw.
// The decision doesn't matter for text without CJK: a pair is halted only between types OPEN,
// MIDDLE, CLOSE or narrow ones (han-kerning.ts haltedSide), and in Latin text the only types are
// MIDDLE (U+00B7, U+2027: it halts only before an OPEN, which Latin lacks), OPEN_NARROW/CLOSE_NARROW (Ps/Pe that are not fullwidth) and the curly quotes, which become
// OPEN/CLOSE only when quoteFullwidth is true, i.e. when the font's own curly quotes sit in a
// fullwidth cell (getFontData, from ink bounds of the registered face, never from this stand-in).
// The pair loop also skips Latin-only neighbours (isCanvasCjkSymbol equal on both sides), and the
// segment-start and line-end trims need OPEN/CLOSE types, which Latin text lacks. So trim 0 (null,
// no Han kerning) gives Latin text the widths and breaks Chrome gives with a trim > 0.
// The stand-in is linear (W(「「) = 2 W(「), trim 0) and applies only to those two exact strings
// where no registered face in the list has U+300C. Any other text, like '「中文」' or '中文', is
// shaped with registered faces and throws HeadlessCoverageError. Inherent case: a real lone '「'
// or '「「' segment in a font lacking it is the same measureText call as the probe, so it measures
// the stand-in instead of throwing.
function isHanProbe(text: string): boolean {
  return text === '\u300C' || text === '\u300C\u300C'
}

function hanProbeWidth(text: string, faces: FontFace[], parsed: ParsedFont, spacing: number): number | null {
  for (let i = 0; i < faces.length; i++) if (covers(faces[i]!, 0x300c)) return null
  return Math.fround(Math.fround(parsed.sizePx * text.length) + spacing * text.length)
}

// Why U+1F600 gets a stand-in width. Any Extended_Pictographic character in a text (©, ®, ™, ↔, ▶,
// ♥, ✔, ‼ …) makes Pretext's getEmojiCorrection measure '\u{1F600}' once per font (measurement.js
// emojiWidth) and compare it with a DOM span's width; a width of at most size + 0.5 means Canvas and
// the DOM agree, so no correction is computed and the DOM is never touched. Chrome measures it in
// an emoji fallback font, which we can't reproduce, and Inter lacks it, so without a stand-in
// '© 2026 Acme' would throw. The stand-in is exactly the font size in px (the em of Apple Color
// Emoji), applied only to that exact string where no registered face in the list covers it. Any
// other uncovered emoji, or U+1F600 inside a longer segment, is shaped with registered faces and
// throws. Inherent case: a real standalone '\u{1F600}' segment in such a font is the same
// measureText call as the probe, so it measures the stand-in instead of throwing.
function isEmojiProbe(text: string): boolean {
  return text === '\u{1F600}'
}

// Letter spacing is added after the one glyph, as for the U+300C probe's glyphs (Chrome spaces
// every glyph, fallback ones too); Pretext measures the probe at '0px' or its 1e-6 shaping spacing,
// which rounds to nothing, so this matters only to a caller measuring U+1F600 letter-spaced itself.
function emojiProbeWidth(faces: FontFace[], parsed: ParsedFont, spacing: number): number | null {
  for (let i = 0; i < faces.length; i++) if (covers(faces[i]!, 0x1f600)) return null
  return Math.fround(Math.fround(parsed.sizePx) + spacing)
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
    // 'normal' is treated as 'auto'. In Chrome it can also make Canvas shape whole strings for
    // fonts whose GPOS involves the space glyph (Pretext RESEARCH.md, How Canvas shapes); Pretext
    // only sets 'none' and 'auto'.
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
      const content = String(text)
      // Blink adds spacing in units of 1/65536 px (ShapeResultSpacing::SetSpacing).
      const spacing = Math.fround(Math.round(spacingPx * 65536) / 65536)
      if (isHyphenProbe(content)) {
        const width = genericProbeWidth(content, parsed, spacing)
        if (width !== null) return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }
      }
      const { options } = sharedState()
      const faces = resolveFaces(parsed)
      if (isHanProbe(content)) {
        const width = hanProbeWidth(content, faces, parsed, spacing)
        if (width !== null) return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }
      }
      if (isEmojiProbe(content)) {
        const width = emojiProbeWidth(faces, parsed, spacing)
        if (width !== null) return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }
      }
      return measure(content, {
        parsed,
        notdef: options.onMissingGlyph === 'notdef' || content === HYPHEN,
        rounding: options.rounding,
        faces,
        features,
        spacing,
        language: lang === 'inherit' || lang === '' ? null : lang,
      })
    },
  }
}

// A class because Pretext constructs it: `new OffscreenCanvas(1, 1).getContext('2d')`. Branded
// with a Symbol.for() key so every copy of this package knows a stand-in from another copy.
export class HeadlessOffscreenCanvas {
  static readonly [HEADLESS] = true
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

function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: false })
}

function isHeadless(implementation: unknown): boolean {
  return typeof implementation === 'function' && Reflect.get(implementation, HEADLESS) === true
}

function setUserAgent(): void {
  const nav: unknown = Reflect.get(globalThis, 'navigator')
  if (typeof nav === 'object' && nav !== null) {
    Object.defineProperty(nav, 'userAgent', { value: CHROME_USER_AGENT, configurable: true, enumerable: true })
  } else {
    defineGlobal('navigator', { userAgent: CHROME_USER_AGENT })
  }
}

/**
 * Installs the HarfBuzz stand-in as `globalThis.OffscreenCanvas` and sets a desktop Chrome
 * `navigator.userAgent`.
 *
 * Call it before Pretext first prepares text (before the first `prepare()` or
 * `prepareWithSegments()`): Pretext fixes its engine profile from the user agent on its first
 * preparation and keeps it for the process, so a later install() cannot correct it. It is not
 * detected.
 *
 * Calling it again, from this or another copy of the package, keeps the installed stand-in and
 * only changes the options, which all copies share; call Pretext's `clearCache()` if widths it
 * already measured should follow them. It throws if `globalThis.OffscreenCanvas` is another
 * implementation.
 */
export function install(installOptions: InstallOptions = {}): void {
  const onMissingGlyph = installOptions.onMissingGlyph ?? 'throw'
  const rounding = installOptions.rounding ?? 'none'
  if (onMissingGlyph !== 'throw' && onMissingGlyph !== 'notdef') {
    throw new RangeError(`install: onMissingGlyph must be 'throw' or 'notdef', not ${JSON.stringify(onMissingGlyph)}`)
  }
  if (rounding !== 'none' && rounding !== 'whole-px') {
    throw new RangeError(`install: rounding must be 'none' or 'whole-px', not ${JSON.stringify(rounding)}`)
  }
  const existing: unknown = Reflect.get(globalThis, 'OffscreenCanvas')
  if (existing !== undefined && !isHeadless(existing)) {
    throw new Error(
      'install: globalThis.OffscreenCanvas is already another implementation; remove it (or the test setup ' +
        'that sets it) so the headless stand-in measures. Call install() before Pretext first prepares text.',
    )
  }
  const { options } = sharedState()
  options.onMissingGlyph = onMissingGlyph
  options.rounding = rounding
  setUserAgent()
  if (existing === undefined) defineGlobal('OffscreenCanvas', HeadlessOffscreenCanvas)
}

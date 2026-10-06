export type ParsedFont = {
  style: 'normal' | 'italic' | 'oblique'
  weight: number
  stretch: number
  sizePx: number
  // The px size glyph advances are taken at, where a platform's differs from sizePx (canvas.ts sizedFor).
  advancePx?: number
  // How glyph advances are rounded to 1/65536 px where a platform's differs from HarfBuzz's (canvas.ts sizedFor).
  advanceRounding?: 'float32-trunc'
  families: string[]
}

const STRETCH = new Map<string, number>(Object.entries({
  'ultra-condensed': 50,
  'extra-condensed': 62.5,
  condensed: 75,
  'semi-condensed': 87.5,
  normal: 100,
  'semi-expanded': 112.5,
  expanded: 125,
  'extra-expanded': 150,
  'ultra-expanded': 200,
}))

// The size may be glued to the slash ("16px/24px"); the lookahead leaves it for the line-height step.
const SIZE = /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)(px|pt)(?=\/|$)/i
const ANGLE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:deg|grad|rad|turn)$/i
const WS = /\s/

// A font Canvas would reject: the context ignores it, as Canvas does.
function fail(font: string, why: string): never {
  throw new RangeError(`parseFont: ${why} in "${font}"`)
}

// A font Canvas accepts but the stand-in can't measure as Chrome does: an Error, not a RangeError,
// so the context's font setter lets it through instead of ignoring the font, which would measure
// the text silently in the previous font.
function unsupported(font: string, why: string): never {
  throw new Error(`pretext-kit/headless: ${why} in "${font}"`)
}

// Family names may be quoted and contain commas or spaces, so the list is
// split by hand rather than with String.split.
function parseFamilies(rest: string, font: string): string[] {
  const families: string[] = []
  let i = 0
  for (;;) {
    while (i < rest.length && /\s/.test(rest[i]!)) i++
    let name = ''
    const q = rest[i]
    if (q === '"' || q === "'") {
      const end = rest.indexOf(q, i + 1)
      if (end < 0) fail(font, 'unterminated quote')
      name = rest.slice(i + 1, end)
      i = end + 1
      while (i < rest.length && /\s/.test(rest[i]!)) i++
    } else {
      const start = i
      while (i < rest.length && rest[i] !== ',') i++
      name = rest.slice(start, i).trim().replace(/\s+/g, ' ')
    }
    if (name === '') fail(font, 'empty font family')
    families.push(name)
    if (i >= rest.length) return families
    if (rest[i] !== ',') fail(font, 'expected "," between families')
    i++
  }
}

function skipWs(text: string, pos: number): number {
  while (pos < text.length && WS.test(text[pos]!)) pos++
  return pos
}

function tokenEnd(text: string, pos: number, stopAtComma: boolean): number {
  while (pos < text.length && !WS.test(text[pos]!) && !(stopAtComma && text[pos] === ',')) pos++
  return pos
}

export function parseFont(font: string): ParsedFont {
  const text = font.trim()
  let style: ParsedFont['style'] = 'normal'
  let weight = 400
  let stretch = 100
  let pos = 0
  for (;;) {
    pos = skipWs(text, pos)
    let end = tokenEnd(text, pos, false)
    const token = text.slice(pos, end)
    if (token === '') fail(font, 'missing font size')
    const size = SIZE.exec(token)
    if (size !== null) {
      // CSS px is 3/4 pt, so pt converts by 4/3.
      const value = Number(size[1])
      const sizePx = size[2]!.toLowerCase() === 'pt' ? (value * 4) / 3 : value
      end = pos + size[0].length
      // Line-height is irrelevant to measuring, but CSS allows spaces around the slash.
      let p = skipWs(text, end)
      if (text[p] === '/') {
        p = skipWs(text, p + 1)
        end = tokenEnd(text, p, true)
        if (end === p) fail(font, 'missing line-height after "/"')
      }
      const rest = text.slice(end).trim()
      if (rest === '') fail(font, 'missing font family')
      return { style, weight, stretch, sizePx, families: parseFamilies(rest, font) }
    }
    const lower = token.toLowerCase()
    if (lower === 'italic') style = 'italic'
    else if (lower === 'oblique') {
      style = 'oblique'
      // getComputedStyle reports a slant as "oblique 10deg"; measuring ignores the angle.
      const next = skipWs(text, end)
      const nextEnd = tokenEnd(text, next, false)
      if (ANGLE.test(text.slice(next, nextEnd))) end = nextEnd
    } else if (lower === 'bold') weight = 700
    else if (/^\d+(\.\d+)?$/.test(token)) {
      weight = Number(token)
      if (weight < 1 || weight > 1000) fail(font, `font-weight ${token} out of range 1-1000`)
    } else if (STRETCH.has(lower)) stretch = STRETCH.get(lower)!
    // Canvas widths change with small-caps (the font's smcp glyphs or synthesised small capitals),
    // which the stand-in doesn't model, so it is refused rather than measured as normal caps.
    else if (lower === 'small-caps') unsupported(font, 'small-caps is not supported (Canvas widths change with it, and the headless stand-in does not model it)')
    // 'normal' does not affect measurement, so it is accepted and dropped.
    else if (lower !== 'normal') fail(font, `missing font size (unexpected "${token}")`)
    pos = end
  }
}

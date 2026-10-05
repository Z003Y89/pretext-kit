export type ParsedFont = {
  style: 'normal' | 'italic' | 'oblique'
  weight: number
  stretch: number
  sizePx: number
  families: string[]
}

const STRETCH: Record<string, number> = {
  'ultra-condensed': 50,
  'extra-condensed': 62.5,
  condensed: 75,
  'semi-condensed': 87.5,
  normal: 100,
  'semi-expanded': 112.5,
  expanded: 125,
  'extra-expanded': 150,
  'ultra-expanded': 200,
}

const SIZE = /^(\d+(?:\.\d+)?|\.\d+)(px|pt)(?:\/\S+)?$/

function fail(font: string, why: string): never {
  throw new RangeError(`parseFont: ${why} in "${font}"`)
}

// Family names may be quoted and contain commas or spaces, so the list is
// split by hand rather than with String.split.
function parseFamilies(rest: string, font: string): string[] {
  const families: string[] = []
  let i = 0
  for (;;) {
    while (i < rest.length && rest[i] === ' ') i++
    let name = ''
    const q = rest[i]
    if (q === '"' || q === "'") {
      const end = rest.indexOf(q, i + 1)
      if (end < 0) fail(font, 'unterminated quote')
      name = rest.slice(i + 1, end)
      i = end + 1
      while (i < rest.length && rest[i] === ' ') i++
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

export function parseFont(font: string): ParsedFont {
  const text = font.trim()
  let style: ParsedFont['style'] = 'normal'
  let weight = 400
  let stretch = 100
  let pos = 0
  for (;;) {
    while (pos < text.length && text[pos] === ' ') pos++
    let end = pos
    while (end < text.length && text[end] !== ' ') end++
    const token = text.slice(pos, end)
    if (token === '') fail(font, 'missing font size')
    const size = SIZE.exec(token)
    if (size !== null) {
      // CSS px is 3/4 pt, so pt converts by 4/3.
      const sizePx = size[2] === 'pt' ? (Number(size[1]) * 4) / 3 : Number(size[1])
      const rest = text.slice(end).trim()
      if (rest === '') fail(font, 'missing font family')
      return { style, weight, stretch, sizePx, families: parseFamilies(rest, font) }
    }
    if (token === 'italic' || token === 'oblique') style = token
    else if (token === 'bold') weight = 700
    else if (/^\d+(\.\d+)?$/.test(token)) {
      weight = Number(token)
      if (weight < 1 || weight > 1000) fail(font, `font-weight ${token} out of range 1-1000`)
    } else if (token in STRETCH) stretch = STRETCH[token]!
    // 'normal' and small-caps do not affect measurement, so they are accepted and dropped.
    else if (token !== 'normal' && token !== 'small-caps') fail(font, `missing font size (unexpected "${token}")`)
    pos = end
  }
}

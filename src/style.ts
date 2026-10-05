export type StyleInput = Pick<
  CSSStyleDeclaration,
  'fontStyle' | 'fontVariant' | 'fontWeight' | 'fontStretch' | 'fontSize' | 'fontFamily' | 'letterSpacing' | 'lineHeight'
>

export type StyleFont = { font: string; letterSpacing: number; lineHeight: number }

const PX = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)px$/

// The Canvas font shorthand only accepts stretch keywords, never the
// percentages getComputedStyle reports, so each percentage is mapped by hand.
function stretchKeyword(stretch: string): string {
  if (stretch === '100%' || stretch === 'normal') return ''
  if (stretch === '75%') return 'condensed'
  if (stretch === '87.5%') return 'semi-condensed'
  if (stretch === '112.5%') return 'semi-expanded'
  if (stretch === '125%') return 'expanded'
  throw new RangeError(`fontFromStyle: font-stretch ${stretch} has no Canvas keyword; use 75%, 87.5%, 100%, 112.5% or 125%`)
}

function px(value: string, what: string): number {
  const m = PX.exec(value)
  if (m === null) throw new RangeError(`fontFromStyle: ${what} must be in px (from getComputedStyle), got "${value}"`)
  return Number(m[1])
}

export function fontFromStyle(style: StyleInput): StyleFont {
  // Canvas font only understands small-caps among the font-variant values.
  if (style.fontVariant !== 'normal' && style.fontVariant !== 'small-caps') {
    throw new RangeError(`fontFromStyle: font-variant ${style.fontVariant} is not supported by the Canvas font shorthand`)
  }
  // 'normal' depends on font metrics Pretext doesn't read, so it can't be resolved to px here.
  if (style.lineHeight === 'normal') {
    throw new RangeError('fontFromStyle: line-height is normal; set a numeric line-height, since normal depends on font metrics Pretext does not read')
  }
  const size = px(style.fontSize, 'font-size')
  const lineHeight = px(style.lineHeight, 'line-height')
  const letterSpacing = style.letterSpacing === 'normal' ? 0 : px(style.letterSpacing, 'letter-spacing')

  // Parts are joined in shorthand order; 'normal' parts are omitted because they are the defaults.
  let font = ''
  if (style.fontStyle !== 'normal') font += style.fontStyle + ' '
  if (style.fontVariant !== 'normal') font += style.fontVariant + ' '
  font += style.fontWeight + ' '
  const stretch = stretchKeyword(style.fontStretch)
  if (stretch !== '') font += stretch + ' '
  font += style.fontSize + ' ' + style.fontFamily
  return { font, letterSpacing, lineHeight }
}

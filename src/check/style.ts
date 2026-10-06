import { fontFromStyle } from '../style.ts'
import type { StyleInput } from '../style.ts'
import type { Slot } from './types.ts'

type SlotStyle = StyleInput & Pick<CSSStyleDeclaration, 'fontVariantNumeric' | 'textTransform' | 'whiteSpace'>

const TRANSFORMS = new Set(['uppercase', 'lowercase', 'capitalize'])

export function slotFromStyle(
  style: SlotStyle,
  rect: { width: number },
  policy: Slot['policy'],
  extra: { reserve?: number; uses?: string[] } = {},
): Slot {
  const { font, letterSpacing, lineHeight } = fontFromStyle(style)
  return {
    width: rect.width,
    font,
    letterSpacing,
    lineHeight,
    whiteSpace: style.whiteSpace === 'pre-wrap' ? 'pre-wrap' : 'normal',
    numeric: style.fontVariantNumeric.split(/\s+/).includes('tabular-nums') ? 'tabular' : 'proportional',
    textTransform: TRANSFORMS.has(style.textTransform) ? (style.textTransform as Slot['textTransform']) : 'none',
    policy,
    ...(extra.reserve === undefined ? {} : { reserve: extra.reserve }),
    ...(extra.uses === undefined ? {} : { uses: extra.uses }),
  }
}

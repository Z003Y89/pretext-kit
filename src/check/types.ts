export type Platform = 'macos' | 'windows' | 'linux'
export type CheckPlatform = Platform | 'browser'

export type FontSource = {
  family: string
  data?: Uint8Array
  path?: string
  weight?: number | [number, number]
  style?: 'normal' | 'italic'
  unicodeRange?: string
  featureSettings?: string
}

export type Label = { key: string; text: string; slot: string; locale?: string }

export type LabelSource =
  | Record<string, Record<string, unknown>>
  | Label[]
  | (() => Label[] | Promise<Label[]>)

export type Slot = {
  width: number | ((viewport: number) => number)
  reserve?: number
  font: string
  letterSpacing?: number
  lineHeight?: number
  whiteSpace?: 'normal' | 'pre-wrap'
  numeric?: 'proportional' | 'tabular'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  policy: 'as-is' | { shrinkTo: number } | { lines: number } | { truncate: 'end' | 'middle'; lines?: number }
  uses?: string[]
}

export type SlotMap = Record<string, Slot>

export type Condition = {
  name: string
  textScale?: number
  zoom?: number
  viewport?: number
  slots?: Partial<Record<string, Partial<Slot>>>
}

export type RowItem = {
  key: string
  slot: string
  collapse?: { order: number; iconWidth: number }
  shortKey?: string
}

export type Row = {
  width: number | ((viewport: number) => number)
  gap: number
  items: RowItem[]
}

export type RowMap = Record<string, Row>

export type CheckInput = {
  fonts: FontSource[]
  labels: LabelSource
  slots: SlotMap | (() => SlotMap | Promise<SlotMap>)
  rows?: RowMap
  conditions?: Condition[]
  platforms?: Platform[]
  samples?: Record<string, Record<string, string | number>[]>
}

export type Issue = {
  kind:
    | 'overflow'
    | 'too-many-lines'
    | 'below-min-size'
    | 'truncated'
    | 'row-overflow'
    | 'row-collapsed'
    | 'uncovered'
    | 'missing-sample'
    | 'unsupported-message'
    | 'unverifiable'
  locale: string
  key: string
  slot: string
  condition: string
  platforms: CheckPlatform[]
  text: string
  measured: { width: number; box: number; lines: number; fontPx: number; stage?: number }
  missing?: { px?: number; fitsAtPx?: number }
  detail?: string
}

export type Report = {
  schema: 1
  failures: Issue[]
  warnings: Issue[]
  notes: Issue[]
  unchecked: string[]
  checked: number
}

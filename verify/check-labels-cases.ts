// Inputs of the label checker's oracle sweep (verify/check-labels.ts): texts, slot styles, policies, conditions,
// the row family and the mutants. Pure and import-free, so the page bundle (check-labels-page.ts) takes its
// constants from here without pulling in the corpora; the corpora are passed in by the caller.
import type { Corpus } from './corpora.ts'

export type Locale = 'en' | 'de' | 'fr'

// How a text is set: one style for all five of its slots.
export type Style = {
  name: string
  size: number
  reserve: number
  letterSpacing: number
  transform: 'none' | 'uppercase'
  numeric: 'proportional' | 'tabular'
}

export type SweepText = { id: string, source: string, text: string, locale: Locale, style: Style }

// The two "(normal)" policies are lines and truncate end in a slot with overflow-wrap: normal (the others
// break-word, as a hand-built slot's default).
export type PolicyName = 'as-is' | 'shrinkTo' | 'lines' | 'truncate end' | 'truncate middle' | 'lines (normal)' | 'truncate end (normal)'

// What the case widths are chosen from, measured at one text scale (zoom 100%):
// natural: one line at the slot size; naturalMin: one line at the shrinkTo size; twoLines: the narrowest
// width (1/64 px grid) at which Pretext lays the text out in LINES lines; widestPiece: the natural width of the
// widest piece no break opportunity splits (unbreakablePieces).
export type Measured = { natural: number, naturalMin: number, twoLines: number, widestPiece: number }

// scale: the text scale whose conditions (zoom 100% and 130%) the slot is run in, and whose boundary it sits at.
export type SlotCase = { key: string, text: number, policy: PolicyName, scale: number, factor: number, width: number }

export type ConditionKind = 'none' | 'text scale' | 'zoom' | 'text scale + zoom'
export type SweepCondition = { name: string, kind: ConditionKind, textScale: number, zoom: number }

// The checker sees "CK Inter" (Inter-Regular.ttf, registered by path); the page declares it by @font-face from
// the same file, and again as TNUM_FAMILY with `font-feature-settings: "tnum" 1` for the kit's own measurements
// of tabular slots (the DOM itself uses `font-variant-numeric: tabular-nums` on FAMILY).
export const FAMILY = 'CK Inter'
export const TNUM_FAMILY = 'CK Inter tnum'
export const FONT_FILE = 'Inter-Regular.ttf'

export const MAX_CHARS = 40
export const FACTORS = [0.9, 1, 1.1]
export const TEXT_SCALES = [1, 1.15, 1.3]
export const ZOOMS = [1, 1.3]
export const SHRINK_BY = 4
export const LINES = 2
export const LINE_HEIGHT_RATIO = 1.5
export const POLICIES: PolicyName[] = ['as-is', 'shrinkTo', 'lines', 'truncate end', 'truncate middle', 'lines (normal)', 'truncate end (normal)']
export const NORMAL_WRAP: PolicyName[] = ['lines (normal)', 'truncate end (normal)']

const plain = (name: string, reserve: number): Style => ({ name, size: 16, reserve, letterSpacing: 0, transform: 'none', numeric: 'proportional' })
export const STYLES = {
  corpus: plain('corpus', 0),
  corpusIcon: plain('corpus + icon', 20),
  button: plain('button + icon', 20),
  tab: { name: 'uppercase tab', size: 13, reserve: 0, letterSpacing: 0.5, transform: 'uppercase', numeric: 'proportional' } satisfies Style,
  digits: { name: 'tabular digits', size: 16, reserve: 0, letterSpacing: 0, transform: 'none', numeric: 'tabular' } satisfies Style,
}

// Every run of whole words (split at U+0020) of at most MAX_CHARS characters, soft hyphens not counted, in
// corpus order, first occurrence kept.
export function shortLines(corpus: Corpus): string[] {
  const out = new Set<string>()
  for (const { text } of corpus.texts) {
    const words = text.split(' ')
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        const line = words.slice(i, j).join(' ')
        if (line.replaceAll('­', '').length > MAX_CHARS) break
        out.add(line)
      }
    }
  }
  return [...out]
}

// Toolbar and tab labels written for this sweep, DubFlow-style: 15 each of German compounds, French, uppercase
// tabs (set with text-transform: uppercase in the label's locale) and digits (tabular).
export const HAND_LABELS: { group: string, style: Style, items: [Locale, string][] }[] = [
  {
    group: 'German compounds', style: STYLES.button, items: ([
      'Speichern', 'Zahlungspflichtig abonnieren', 'Benutzerkontoeinstellungen', 'Tagesabschlussbericht',
      'Datenschutzeinstellungen', 'Rückgängig machen', 'Wiederherstellen', 'Lesezeichen hinzufügen',
      'Synchronisierung läuft…', 'Freigabeeinstellungen', 'Projektübersicht', 'Nebenrollen-Takes',
      'Endabmischung exportieren', 'Einfügen', 'Seitenansicht',
    ] as const).map(t => ['de', t]),
  },
  {
    group: 'French', style: STYLES.button, items: ([
      'Enregistrer', 'Enregistrer sous…', 'Paramètres avancés', 'Annuler', 'Rétablir', 'Partager le document',
      'Mettre à jour', 'Télécharger', 'Aperçu avant impression', 'Préférences', 'Supprimer définitivement',
      'Rechercher et remplacer', 'Gérer les autorisations', 'Coller', 'Ajouter aux favoris',
    ] as const).map(t => ['fr', t]),
  },
  {
    group: 'uppercase tabs', style: STYLES.tab, items: [
      ['de', 'Übersicht'], ['de', 'Straße'], ['de', 'Einstellungen'], ['de', 'Größe'], ['de', 'Maßnahmen'],
      ['fr', 'Aperçu'], ['fr', 'Éléments'], ['fr', 'Données'], ['fr', 'Activité'], ['fr', 'Équipe'],
      ['en', 'Overview'], ['en', 'Settings'], ['en', 'Billing'], ['en', 'Notifications'], ['en', 'Integrations'],
    ],
  },
  {
    group: 'digits', style: STYLES.digits, items: [
      ['de', '1.234.567,89 €'], ['fr', '1 234 567,89 €'], ['en', '00:42:17'], ['en', '2026-10-06'], ['en', '3 of 128'],
      ['de', 'Seite 12 / 340'], ['en', 'v0.1.2'], ['de', '+49 30 1234567'], ['fr', '100 %'], ['de', 'Take 07'],
      ['de', 'Folge 03 – 12:45'], ['en', '1111'], ['en', '16:9'], ['en', 'Track 01/24'], ['en', '98.6 °F'],
    ],
  },
]

// The corpora's short lines (every other one with an icon reserve), then the hand-written labels; ids are the
// order, so a text keeps its id as long as the corpora and this file are unchanged.
export function sweepTexts(corpora: Corpus[]): SweepText[] {
  const out: SweepText[] = []
  const locales: Record<string, Locale> = { latin: 'en', german: 'de', french: 'fr' }
  for (const name of ['latin', 'german', 'french']) {
    const corpus = corpora.find(c => c.name === name)
    if (corpus === undefined) throw new Error(`no corpus ${name}`)
    shortLines(corpus).forEach((text, i) => {
      out.push({ id: `t${out.length}`, source: name, text, locale: locales[name]!, style: i % 2 === 0 ? STYLES.corpus : STYLES.corpusIcon })
    })
  }
  for (const { group, style, items } of HAND_LABELS) {
    for (const [locale, text] of items) out.push({ id: `t${out.length}`, source: group, text, locale, style })
  }
  return out
}

// Up to the 1/64 px layout grid, so the DOM box is the width asked for, not one rounded below it.
export const grid64 = (x: number): number => Math.ceil(x * 64 - 1e-9) / 64

// Under overflow-wrap: normal the verdict also changes where the widest unbreakable piece stops fitting.
function basis(policy: PolicyName, m: Measured): number {
  if (policy === 'shrinkTo') return m.naturalMin
  if (policy === 'lines' || policy === 'truncate end') return m.twoLines
  if (NORMAL_WRAP.includes(policy)) return Math.max(m.twoLines, m.widestPiece)
  return m.natural
}

// The pieces of a prepared text no line breaks under overflow-wrap: normal: Pretext's segments run between break
// opportunities, and zero-width glue and controls, which hold none, join the text around them.
export function unbreakablePieces(segments: string[], kinds: string[]): string[] {
  const out: string[] = []
  let piece = ''
  kinds.forEach((kind, i) => {
    const joins = kind === 'text' || kind === 'zero-width-glue' || kind === 'control'
    if ((kind === 'text' && kinds[i - 1] === 'text') || !joins) {
      if (piece !== '') out.push(piece)
      piece = ''
    }
    if (joins) piece += segments[i]
  })
  if (piece !== '') out.push(piece)
  return out
}

export const policyKey = (policy: PolicyName): string => policy.replace(/\W+/g, '-').replace(/-$/, '')

// Each text in each policy at FACTORS times the box where that policy changes its verdict at each text scale
// (measured[scale][text], at the scaled size and letter spacing), plus the reserve grown with the text, on the
// 1/64 px grid.
export function slotCases(texts: SweepText[], measured: Measured[][]): SlotCase[] {
  if (measured.length !== TEXT_SCALES.length) throw new Error(`${measured.length} text scales measured for ${TEXT_SCALES.length}`)
  const out: SlotCase[] = []
  TEXT_SCALES.forEach((scale, s) => {
    if (measured[s]!.length !== texts.length) throw new Error(`${measured[s]!.length} measurements for ${texts.length} texts at ${scale}`)
    texts.forEach((t, i) => {
      for (const policy of POLICIES) {
        for (const factor of FACTORS) {
          const width = grid64(basis(policy, measured[s]![i]!) * factor + t.style.reserve * scale)
          out.push({ key: `${t.id}.${policyKey(policy)}.${scale}.${factor}`, text: i, policy, scale, factor, width })
        }
      }
    })
  })
  return out
}

// The cells (policy · condition kind) where every verdict is the same: a sweep whose widths put a policy on one
// side of its boundary only tests nothing there.
export function vacuousCells(verdicts: { policy: string, kind: string, verdict: string }[]): string[] {
  const seen = new Map<string, Set<string>>()
  for (const v of verdicts) {
    const cell = `${v.policy} · ${v.kind}`
    seen.set(cell, (seen.get(cell) ?? new Set()).add(v.verdict))
  }
  return [...seen].filter(([, kinds]) => kinds.size === 1).map(([cell]) => cell)
}

export function conditions(): SweepCondition[] {
  const out: SweepCondition[] = []
  for (const zoom of ZOOMS) {
    for (const textScale of TEXT_SCALES) {
      const kind: ConditionKind = textScale === 1 ? (zoom === 1 ? 'none' : 'zoom') : zoom === 1 ? 'text scale' : 'text scale + zoom'
      out.push({ name: `text ${Math.round(textScale * 100)}% · zoom ${Math.round(zoom * 100)}%`, kind, textScale, zoom })
    }
  }
  return out
}

// ---- The row family -------------------------------------------------------------------------------

export type RowItemDef = { id: string, text: string, short?: string, order?: number }
export const ROW_STYLE: Style = { name: 'toolbar item', size: 16, reserve: 20, letterSpacing: 0, transform: 'none', numeric: 'proportional' }
export const ROW_GAP = 8
export const ICON_WIDTH = 24
// A five-item toolbar per locale: "new" never collapses; settings goes to its icon first, export to its short
// label and then its icon, then open and save.
export const ROW_FAMILY: Record<Locale, RowItemDef[]> = {
  en: [
    { id: 'new', text: 'New document' }, { id: 'open', text: 'Open recent', order: 3 }, { id: 'save', text: 'Save changes', order: 4 },
    { id: 'export', text: 'Export as PDF', short: 'Export', order: 2 }, { id: 'settings', text: 'Settings', order: 1 },
  ],
  de: [
    { id: 'new', text: 'Neues Dokument' }, { id: 'open', text: 'Zuletzt geöffnet', order: 3 }, { id: 'save', text: 'Änderungen speichern', order: 4 },
    { id: 'export', text: 'Als PDF exportieren', short: 'Exportieren', order: 2 }, { id: 'settings', text: 'Einstellungen', order: 1 },
  ],
  fr: [
    { id: 'new', text: 'Nouveau document' }, { id: 'open', text: 'Ouverts récemment', order: 3 }, { id: 'save', text: 'Enregistrer', order: 4 },
    { id: 'export', text: 'Exporter en PDF', short: 'Exporter', order: 2 }, { id: 'settings', text: 'Paramètres', order: 1 },
  ],
}

// The items' widths at each stage (one entry per item; a step replaces one width), in the spec's order: by
// collapse order, each item first to its short label, then to its icon.
export function stageWidths(items: RowItemDef[], full: number[], short: (number | undefined)[], icon: number): number[][] {
  const stages = [full.slice()]
  const order = items.map((_, i) => i).filter(i => items[i]!.order !== undefined)
  order.sort((a, b) => items[a]!.order! - items[b]!.order! || a - b)
  for (const i of order) {
    if (short[i] !== undefined) stages.push(stages.at(-1)!.map((w, j) => (j === i ? short[i]! : w)))
    stages.push(stages.at(-1)!.map((w, j) => (j === i ? icon : w)))
  }
  return stages
}

export const rowTotal = (widths: number[], gap: number): number => widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * gap

// Row widths that put the row at every stage boundary: each stage's total (fits there, not before), halfway to
// the next stage, and 0.9 of the last stage's (overflows even fully collapsed).
export function rowWidths(totals: number[]): number[] {
  const out: number[] = []
  totals.forEach((t, k) => {
    out.push(grid64(t))
    if (k + 1 < totals.length) out.push(grid64((t + totals[k + 1]!) / 2))
  })
  out.push(grid64(totals.at(-1)! * 0.9))
  return out
}

// ---- Mutants --------------------------------------------------------------------------------------

export type Edit = { file: string, from: string, to: string }
export type Mutant = { name: string, edits: Edit[] }

// Each edit's `from` must occur exactly once in its file under src/; applyEdits throws otherwise, so a mutant
// that would silently not apply fails the harness instead.
export const MUTANTS: Mutant[] = [
  {
    name: 'ignore reserve',
    edits: [
      { file: 'check/conditions.ts', from: 'const box = width * zoom - (merged.reserve ?? 0) * scale\n', to: 'const box = width * zoom\n' },
      { file: 'check/conditions.ts', from: 'reserve: (merged.reserve ?? 0) * scale,', to: 'reserve: 0,' },
    ],
  },
  {
    name: 'treat zoom as textScale',
    edits: [
      { file: 'check/conditions.ts', from: 'const box = width * zoom - (merged.reserve ?? 0) * scale\n', to: 'const box = width - (merged.reserve ?? 0) * scale\n' },
      { file: 'check/rows.ts', from: 'const box = rowWidth * zoom\n', to: 'const box = rowWidth\n' },
      { file: 'check/rows.ts', from: 'const gap = row.gap * zoom\n', to: 'const gap = row.gap\n' },
    ],
  },
  {
    name: 'ignore textTransform',
    edits: [{ file: 'check/evaluate.ts', from: 'const transformed = transformText(text, slot.textTransform, locale)', to: 'const transformed = text' }],
  },
  {
    name: 'lines off by one (< for <=)',
    edits: [{ file: 'check/evaluate.ts', from: 'fitFontSize(sizes, { width, maxLines: max }, noHeight)', to: 'fitFontSize(sizes, { width, maxLines: max - 1 }, noHeight)' }],
  },
  {
    name: 'skip the last collapse stage',
    edits: [{ file: 'check/rows.ts', from: 'for (let k = 0; k < steps.length; k++) {', to: 'for (let k = 0; k < steps.length - 1; k++) {' }],
  },
  {
    name: 'tabular ignored (alias not used)',
    edits: [{ file: 'check/run.ts', from: '      else merged.font = font\n', to: '' }],
  },
  {
    name: 'ignore overflowWrap',
    edits: [{ file: 'check/conditions.ts', from: "overflowWrap: merged.overflowWrap ?? 'break-word',", to: "overflowWrap: 'break-word'," }],
  },
]

// Matched on LF line endings whatever the checkout has (Windows checks out CRLF); the result keeps LF.
export function applyEdit(source: string, edit: Edit, mutant: string): string {
  const parts = source.replaceAll('\r\n', '\n').split(edit.from)
  if (parts.length !== 2) throw new Error(`mutant "${mutant}": expected one occurrence in ${edit.file}, found ${parts.length - 1}: ${JSON.stringify(edit.from)}`)
  return parts.join(edit.to)
}

// Applies a mutant's edits to the files it names, read and written through the given functions (so tests can
// run it on strings); edits to one file apply in order.
export function applyMutant(m: Mutant, read: (file: string) => string, write: (file: string, source: string) => void): void {
  const files = new Map<string, string>()
  for (const edit of m.edits) files.set(edit.file, applyEdit(files.get(edit.file) ?? read(edit.file), edit, m.name))
  for (const [file, source] of files) write(file, source)
}


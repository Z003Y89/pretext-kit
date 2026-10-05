// headless-parity: what both sides compute, shared by the Node build (examples/build-headless-parity.ts,
// under pretext-kit/headless) and the page (examples/src/headless-parity.ts, in the browser's own
// Canvas). Nothing here touches the DOM or the canvas until compute() runs.

import { measureLineStats, prepareWithSegments, setLocale } from '@chenglou/pretext'
import { fitFontSize, prepareSizes } from '../../src/index.ts'

// Unique family aliases, on both sides: no installed Inter or Roboto can stand in for the files.
export const FACES = [
  { family: 'PK Parity Inter', file: 'Inter-Regular.ttf', name: 'Inter' },
  { family: 'PK Parity Roboto', file: 'Roboto-Regular.ttf', name: 'Roboto' },
] as const
export const WIDTHS = [100, 150, 220]
export const SIZES = [14, 16]
// The button box: one line, the largest whole-pixel size from 8px up to the label's own size.
export const FIT_MIN = 8
export const fitLineHeight = (px: number): number => Math.round(px * 1.25)

export type Lang = 'en' | 'de' | 'fr'
export const LABELS: { lang: Lang, text: string }[] = [
  { lang: 'en', text: 'Save changes' },
  { lang: 'en', text: 'Continue to checkout' },
  { lang: 'en', text: 'Download invoice (PDF)' },
  { lang: 'en', text: 'Delete account' },
  { lang: 'en', text: '© 2026 Acme' },
  { lang: 'en', text: '“Quarterly report” is ready' },
  { lang: 'en', text: 'Retrying in 5 s…' },
  { lang: 'en', text: 'Notifi­cations and privacy' },
  { lang: 'de', text: 'Speichern' },
  { lang: 'de', text: 'Zahlungspflichtig abonnieren' },
  { lang: 'de', text: '„Tagesabschlussbericht“' },
  { lang: 'de', text: 'Tages­abschluss­bericht' },
  { lang: 'de', text: 'Zahlungs­pflichtig abonnieren' },
  { lang: 'de', text: 'Abbrechen und zurückgehen' },
  { lang: 'de', text: 'Datenschutz­einstellungen öffnen' },
  { lang: 'de', text: '© 2026 Acme GmbH' },
  { lang: 'fr', text: 'Enregistrer les modifications' },
  { lang: 'fr', text: 'Valider la commande' },
  { lang: 'fr', text: '« Rapport quotidien »' },
  { lang: 'fr', text: 'Annuler l’abonnement' },
  { lang: 'fr', text: 'Paramètres de confidentialité' },
  { lang: 'fr', text: 'Télé­charger la facture' },
  { lang: 'fr', text: 'Réinitialiser le mot de passe' },
  { lang: 'fr', text: 'Continuer ?' },
]

// One case: a label in one face and size at one width.
export type Result = { lines: number, widest: number, fit: number | null }
export type Case = { label: number, face: number, size: number, width: number } & Result

export const font = (family: string, px: number): string => `${px}px "${family}"`

// Each label prepared under its own language, as a page with lang="de" would.
export function compute(): Case[] {
  const out: Case[] = []
  for (const lang of ['en', 'de', 'fr'] as const) {
    setLocale(lang)
    LABELS.forEach((l, label) => {
      if (l.lang !== lang) return
      FACES.forEach((f, face) => {
        for (const size of SIZES) {
          const p = prepareWithSegments(l.text, font(f.family, size))
          const sizes = prepareSizes(l.text, px => font(f.family, px), { min: FIT_MIN, max: size })
          for (const width of WIDTHS) {
            const s = measureLineStats(p, width)
            const fit = fitFontSize(sizes, { width, maxLines: 1 }, fitLineHeight)
            out.push({ label, face, size, width, lines: s.lineCount, widest: s.maxLineWidth, fit: fit?.px ?? null })
          }
        }
      })
    })
  }
  setLocale(undefined)
  return out
}

// Agreement: the same line count, the same fitted size, and the widest line within a thousandth of
// a pixel (the headless sweep finds Inter and Roboto bit-exact in Chromium; this leaves room only
// for float summation order).
export const WIDTH_TOLERANCE = 0.001
export function agrees(a: Result, b: Result): { lines: boolean, widest: boolean, fit: boolean, all: boolean } {
  const lines = a.lines === b.lines
  const widest = Math.abs(a.widest - b.widest) <= WIDTH_TOLERANCE
  const fit = a.fit === b.fit
  return { lines, widest, fit, all: lines && widest && fit }
}

export type ParityData = {
  source: string
  generated: { node: string, harfbuzzjs: string, pretext: string, kit: string }
  faces: typeof FACES
  widths: number[]
  sizes: number[]
  labels: typeof LABELS
  cases: Case[]
}

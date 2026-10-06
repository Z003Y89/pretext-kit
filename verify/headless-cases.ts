// Inputs of the headless parity sweep (verify/headless.ts). Fonts are the test fonts the stand-in's
// tests register, loaded in Chromium through @font-face from the very same files.

import de from 'hyphen/de/index.js'
import { CORPORA } from './corpora.ts'
import type { Corpus, Text } from './corpora.ts'

// One registered face: the file under test/fonts, the family it is registered and declared as, and
// the weight its @font-face rule declares (the stand-in reads the same weight from OS/2).
// A variable face declares its weight range ([min, max], `font-weight: min max` in CSS) and is
// registered in Node with no weight, so the stand-in reads the range from the font's own wght axis
// (headless.ts checks the two agree). dir: the file's directory relative to the repository, when
// not test/fonts.
export type FaceFile = { family: string, file: string, format: 'truetype' | 'woff2', weight: number | [number, number], dir?: string }

// Family names carry an "HX " prefix in both Chromium (@font-face) and Node (registerFont), so no
// installed font of the same name can stand in for a file that failed to load.
// Shantell Sans is the only family here with two weights: Inter and Roboto ship one face each, so
// 600 and 700 are synthesized from it in Chromium and nothing could show the stand-in ignoring the
// requested weight.
export const FACES: FaceFile[] = [
  { family: 'HX Inter', file: 'Inter-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'HX Inter WOFF2', file: 'Inter-Regular.woff2', format: 'woff2', weight: 400 },
  { family: 'HX Roboto', file: 'Roboto-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'HX Shantell Sans', file: 'ShantellSans-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'HX Shantell Sans', file: 'ShantellSans-Bold.ttf', format: 'truetype', weight: 700 },
  // @fontsource-variable/inter (exact-pinned devDependency, OFL-1.1): the latin subset of 'Inter
  // Variable' as that package's CSS loads it, one variable face with a wght axis of 100-900. Loaded
  // in Chromium without the package's unicode-range, so the cmap alone decides coverage on both sides.
  {
    family: 'HX Inter Variable', file: 'inter-latin-wght-normal.woff2', format: 'woff2', weight: [100, 900],
    dir: 'node_modules/@fontsource-variable/inter/files',
  },
]

// The CSS font-weight descriptor of a face: '400', or '100 900' for a variable face.
export const cssWeight = (f: FaceFile): string => (typeof f.weight === 'number' ? String(f.weight) : f.weight.join(' '))

export const WIDTH_FAMILIES = ['HX Inter', 'HX Inter WOFF2', 'HX Roboto', 'HX Shantell Sans', 'HX Inter Variable']
// 2048 units per em: every advance is a dyadic fraction of a pixel at these sizes, so Chromium and
// HarfBuzz must agree bit for bit. A tripwire beside the formal bar: any inexact width here fails.
export const EXACT_FAMILIES = ['HX Inter', 'HX Inter WOFF2', 'HX Roboto']
export const WEIGHTS = [400, 600, 700]
// Instances of the variable family: its default (400) and the non-default ones an app uses. Not in
// EXACT_FAMILIES: a variable instance's advances are interpolated (HVAR), so they need not be dyadic
// fractions of a pixel; the formal bar still applies.
export const VARIABLE_FAMILIES = ['HX Inter Variable']
export const VARIABLE_WEIGHTS = [300, 400, 500, 600, 700, 800]
export const weightsOf = (family: string): number[] => (VARIABLE_FAMILIES.includes(family) ? VARIABLE_WEIGHTS : WEIGHTS)
export const SIZES = [12, 14, 16, 20]
export const SPACINGS = [0, 0.5]
// Pass bar for a width, in px.
export const WIDTH_TOLERANCE = 0.02

// Strings of the width sweep. Every one is also measured in every family; a (string, family) pair
// whose text the family does not cover is skipped by the rule in headless.ts.
export const WIDTH_STRINGS: Text[] = [
  // German compounds and labels
  { label: 'Speichern', text: 'Speichern' },
  { label: 'abonnieren', text: 'Zahlungspflichtig abonnieren' },
  { label: 'quoted abonnieren', text: '„Zahlungspflichtig abonnieren“' },
  { label: 'quoted Tagesabschluss', text: '„Tagesabschlussbericht“' },
  { label: 'Donaudampf', text: 'Donaudampfschifffahrtskapitän' },
  { label: 'Grundstück', text: 'Grundstücksverkehrsgenehmigung' },
  { label: 'umlauts', text: 'Übergrößenträger ÄÖÜ äöü ß ẞ' },
  { label: 'ellipsis', text: 'Wird geladen…' },
  { label: 'Einstellungen', text: 'Benutzerkontoeinstellungen speichern' },
  // French
  { label: 'confidentialité', text: 'Paramètres de confidentialité avancés' },
  { label: 'Enregistrer', text: 'Enregistrer les modifications ?' },
  { label: 'anticonstitutionnalité', text: 'L’anticonstitutionnalité' },
  { label: 'guillemets', text: 'Œuvre « complète » — été' },
  { label: 'euro', text: 'Ça coûte 12,50 €' },
  // Digits
  { label: 'digits', text: '0123456789' },
  { label: 'grouped', text: '1 234 567,89' },
  { label: 'timestamp', text: '2026-10-05 17:42:09' },
  { label: 'times', text: '3.14159 × 2 = 6.28318' },
  // Punctuation
  { label: 'brackets', text: 'Hello, world! (test) [x] {y}' },
  { label: 'curly quotes', text: '“Quoted” ‘single’ — dash – en' },
  { label: 'marks', text: 'Wait... what?! Yes; no: maybe.' },
  // Kerning pairs
  { label: 'AV pairs', text: 'AV AVA Tw To Ty Wa Yo' },
  { label: 'LT pairs', text: 'LT LY P. F, T. Vo' },
  { label: 'AVATAR', text: 'AVATAR WAVY TYPO' },
  { label: 'A V', text: 'A V' },
  { label: 'x T x', text: 'x T x' },
  // Ligatures
  { label: 'office', text: 'office affine fluffy' },
  { label: 'fi fl', text: 'fi fl ffi ffl' },
  { label: 'Th st', text: 'The first staff' },
  // Extended_Pictographic: each makes Pretext probe U+1F600
  { label: '© Acme', text: '© 2026 Acme' },
  { label: 'Acme®', text: 'Acme®' },
  { label: 'Brand™', text: 'Brand™' },
  { label: 'A ↔ B', text: 'A ↔ B' },
  { label: 'Play ▶', text: 'Play ▶' },
  { label: 'I ♥ it', text: 'I ♥ it' },
  // U+2028 and U+2029, beside the space they are drawn with
  { label: 'space', text: ' ' },
  { label: 'a b', text: 'a b' },
  { label: 'a LS b', text: 'a\u2028b' },
  { label: 'a PS b', text: 'a\u2029b' },
  { label: 'x LS T LS x', text: 'x\u2028T\u2028x' },
  { label: 'x PS T PS x', text: 'x\u2029T\u2029x' },
  { label: 'LS alone', text: '\u2028' },
  { label: 'PS alone', text: '\u2029' },
  // ZWSP, characters Canvas turns into it, ZWNJ/ZWJ, and soft hyphens
  { label: 'A ZWSP V', text: 'A\u200BV' },
  { label: 'ZWSP compound', text: 'Zahlungs\u200Bpflichtig\u200Babonnieren' },
  { label: 'LRM', text: 'A\u200EV' },
  { label: 'BOM', text: 'A\uFEFFV' },
  { label: 'ZWNJ', text: 'Auf\u200Clage' },
  { label: 'ZWJ', text: 'a\u200Db' },
  { label: 'U+FFFC', text: 'A\uFFFCV' },
  { label: 'C0 control', text: 'A\u0001V' },
  { label: 'ZWSP + mark', text: 'a\u200B\u0301b' },
  { label: 'SHY compound', text: 'Zah\u00ADlungs\u00ADpflich\u00ADtig' },
  { label: 'SHY Tages', text: 'Ta\u00ADges\u00ADab\u00ADschluss\u00ADbe\u00ADricht' },
]

// A Pretext + DOM configuration of the line-count sweep: font size 16px, line height 24px.
export type LineFont = { label: string, family: string, weight: number, letterSpacing: number }
export const LINE_FONTS: LineFont[] = [
  { label: 'Inter 400', family: 'HX Inter', weight: 400, letterSpacing: 0 },
  { label: 'Inter 700', family: 'HX Inter', weight: 700, letterSpacing: 0 },
  { label: 'Inter 400 +0.5px', family: 'HX Inter', weight: 400, letterSpacing: 0.5 },
  { label: 'Roboto 400', family: 'HX Roboto', weight: 400, letterSpacing: 0 },
  { label: 'Shantell Sans 400', family: 'HX Shantell Sans', weight: 400, letterSpacing: 0 },
  { label: 'Shantell Sans 700', family: 'HX Shantell Sans', weight: 700, letterSpacing: 0 },
  ...VARIABLE_WEIGHTS.map(weight => ({ label: `Inter Variable ${weight}`, family: 'HX Inter Variable', weight, letterSpacing: 0 })),
]
export const LINE_SIZE = 16
export const LINE_HEIGHT = 24
export const LINE_WIDTH_MIN = 120
export const LINE_WIDTH_MAX = 600
export const LINE_WIDTH_STEP = 2

function hyphenated(hyphenateSync: (text: string) => string, texts: Text[]): Text[] {
  return texts.map(({ label, text }) => ({ label, text: hyphenateSync(text) }))
}

// Written for this sweep: the texts that set off Pretext's own probes (U+300C for anything in
// U+2018-U+301F, U+1F600 for Extended_Pictographic, U+2010 for soft hyphens) and the separators.
const SPECIALS: Text[] = [
  { label: 'quoted labels', text: 'Jetzt „Zahlungspflichtig abonnieren“ und den „Tagesabschlussbericht“ jeden Morgen per E-Mail erhalten.' },
  { label: 'quoted abonnieren', text: '„Zahlungspflichtig abonnieren“' },
  { label: 'quoted Tagesabschluss', text: '„Tagesabschlussbericht“' },
  { label: 'ellipsis', text: 'Wird geladen… Bitte warten Sie, bis die Synchronisierung der Benutzerkontoeinstellungen abgeschlossen ist…' },
  { label: 'pictographic', text: '© 2026 Acme Corporation. Acme® and Brand™ are trademarks; map A ↔ B, then Play ▶ and say I ♥ it.' },
  { label: 'pictographic short', text: '© 2026 Acme · Acme® · Brand™ · A ↔ B · Play ▶ · I ♥ it' },
  { label: 'line separators', text: 'Erste Zeile des Absatzes\u2028zweite Zeile mit etwas mehr Text darin\u2028und eine dritte' },
  { label: 'paragraph separators', text: 'Erste Zeile des Absatzes\u2029zweite Zeile mit etwas mehr Text darin\u2029und eine dritte' },
  { label: 'ZWSP compound', text: 'Zahlungs\u200Bpflichtig\u200Babonnieren\u200Bund\u200BTages\u200Babschluss\u200Bbericht\u200Blesen' },
  { label: 'ZWSP URL', text: 'Siehe https://example.com/\u200Bberichte/\u200Btagesabschluss/\u200B2026-10-05/\u200Bzusammenfassung.pdf für Details.' },
]

export const LINE_CORPORA: Corpus[] = [
  // v1's corpora from verify/corpora.ts, german and french already hyphenated there.
  ...['latin', 'german', 'french'].map(name => CORPORA.find(c => c.name === name)!),
  { name: 'specials', texts: [...SPECIALS, ...hyphenated(de.hyphenateSync, SPECIALS.slice(0, 4).map(t => ({ ...t, label: `${t.label} (SHY)` })))] },
]

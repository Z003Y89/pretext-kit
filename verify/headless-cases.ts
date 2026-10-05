// Inputs of the headless parity sweep (verify/headless.ts). Fonts are the test fonts the stand-in's
// tests register, loaded in Chromium through @font-face from the very same files.

import de from 'hyphen/de/index.js'
import fr from 'hyphen/fr/index.js'
import { CORPORA } from './corpora.ts'
import type { Corpus, Text } from './corpora.ts'

// One registered face: the file under test/fonts, the family it is registered and declared as, and
// the weight its @font-face rule declares (the stand-in reads the same weight from OS/2).
export type FaceFile = { family: string, file: string, format: 'truetype' | 'woff2', weight: number }

// Shantell Sans is the only family here with two weights: Inter and Roboto ship one face each, so
// 600 and 700 are synthesized from it in Chromium and nothing could show the stand-in ignoring the
// requested weight.
export const FACES: FaceFile[] = [
  { family: 'Inter', file: 'Inter-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'Inter WOFF2', file: 'Inter-Regular.woff2', format: 'woff2', weight: 400 },
  { family: 'Roboto', file: 'Roboto-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'Shantell Sans', file: 'ShantellSans-Regular.ttf', format: 'truetype', weight: 400 },
  { family: 'Shantell Sans', file: 'ShantellSans-Bold.ttf', format: 'truetype', weight: 700 },
]

export const WIDTH_FAMILIES = ['Inter', 'Inter WOFF2', 'Roboto', 'Shantell Sans']
export const WEIGHTS = [400, 600, 700]
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
  { label: 'SHY compound', text: 'Zah\u00ADlungs\u00ADpflich\u00ADtig' },
  { label: 'SHY Tages', text: 'Ta\u00ADges\u00ADab\u00ADschluss\u00ADbe\u00ADricht' },
]

// A Pretext + DOM configuration of the line-count sweep: font size 16px, line height 24px.
export type LineFont = { label: string, family: string, weight: number, letterSpacing: number }
export const LINE_FONTS: LineFont[] = [
  { label: 'Inter 400', family: 'Inter', weight: 400, letterSpacing: 0 },
  { label: 'Inter 700', family: 'Inter', weight: 700, letterSpacing: 0 },
  { label: 'Inter 400 +0.5px', family: 'Inter', weight: 400, letterSpacing: 0.5 },
  { label: 'Roboto 400', family: 'Roboto', weight: 400, letterSpacing: 0 },
  { label: 'Shantell Sans 400', family: 'Shantell Sans', weight: 400, letterSpacing: 0 },
  { label: 'Shantell Sans 700', family: 'Shantell Sans', weight: 700, letterSpacing: 0 },
]
export const LINE_SIZE = 16
export const LINE_HEIGHT = 24
export const LINE_WIDTH_MIN = 120
export const LINE_WIDTH_MAX = 600
export const LINE_WIDTH_STEP = 2

function hyphenated(hyphenateSync: (text: string) => string, texts: Text[]): Text[] {
  return texts.map(({ label, text }) => ({ label, text: hyphenateSync(text) }))
}

// v1's german and french corpora (pretext-kit verify/corpora.ts on kit-v1, where they are
// hyphenated with hyphen/de and hyphen/fr; copied here, as this branch's corpora.ts predates them).
const GERMAN: Text[] = [
  { label: 'Tagesabschluss', text: 'Der Tagesabschlussbericht der Synchronsprecherinnen liegt seit gestern Abend im Projektordner.' },
  { label: 'Nebenrollen', text: 'Bitte die Nebenrollen-Takes vor der Endabmischung noch einmal mit der Regieassistentin durchhören.' },
  { label: 'Datenschutz', text: 'Die Datenschutzgrundverordnung verlangt eine nachvollziehbare Einwilligungsverwaltung für alle Benutzerkonten.' },
  { label: 'Umfrage', text: 'Kundenzufriedenheitsumfrage: Rückmeldungen bitte bis Monatsende an die Qualitätssicherungsabteilung.' },
  { label: 'Versicherung', text: 'Haftpflichtversicherungsbedingungen und Rechtsschutzversicherungsunterlagen bitte getrennt ablegen.' },
  { label: 'Kapitän', text: 'Der Donaudampfschifffahrtskapitän verschob die Hafenrundfahrt wegen anhaltender Hochwasserwarnungen.' },
  { label: 'Fehlermeldung', text: 'Fehlermeldung: Die Benutzerkontoeinstellungen konnten nicht gespeichert werden.' },
  { label: 'Baustellen', text: 'Geschwindigkeitsbegrenzungen auf Autobahnbaustellen gelten ausdrücklich auch während der Nachtarbeiten.' },
  { label: 'Förderung', text: 'Die Ausbildungsförderungsgesetzänderung tritt zum Wintersemester in Kraft, Übergangsregelungen inbegriffen.' },
  { label: 'Produktion', text: 'Aufnahmeleiterin, Tonmeister und Cutterin besprechen am Freitag die Wochenendproduktionsplanung.' },
  { label: 'One word', text: 'Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung' },
  { label: 'Portal', text: 'Arbeitszeiterfassung, Urlaubsantragsformulare und Reisekostenabrechnungen findest du im Mitarbeiterportal.' },
]

const FRENCH: Text[] = [
  { label: 'Confidentialité', text: 'Paramètres de confidentialité avancés' },
  { label: 'Enregistrer', text: 'Enregistrer les modifications avant de quitter l’application ?' },
  { label: 'Synchroniser', text: 'Impossible de synchroniser vos documents : vérifiez votre connexion internet et réessayez.' },
  { label: 'Rappels', text: 'Notifications de rappel pour les rendez-vous hebdomadaires et les échéances contractuelles' },
  { label: 'Justificatifs', text: 'Télécharger l’intégralité des pièces justificatives de remboursement' },
  { label: 'Autorisations', text: 'Gestionnaire des autorisations d’accès aux répertoires partagés' },
  { label: 'Responsabilité', text: 'La responsabilité environnementale des entreprises internationales est devenue incontournable dans les appels d’offres.' },
  { label: 'Syndicats', text: 'Les représentantes syndicales ont présenté une contre-proposition particulièrement circonstanciée.' },
  { label: 'Anticonstitutionnalité', text: 'L’anticonstitutionnalité de la mesure a été soulevée par plusieurs parlementaires expérimentés.' },
  { label: 'Conditions', text: 'Conditions générales d’utilisation et politique de protection des données personnelles' },
  { label: 'Mot de passe', text: 'Réinitialisation du mot de passe : un courriel de confirmation vous a été envoyé.' },
  { label: 'Récit', text: 'Au petit matin, les marchandes installaient leurs étals sur la place, et l’odeur du pain chaud remontait jusqu’aux mansardes.' },
]

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
  CORPORA.find(c => c.name === 'latin')!,
  { name: 'german', texts: hyphenated(de.hyphenateSync, GERMAN) },
  { name: 'french', texts: hyphenated(fr.hyphenateSync, FRENCH) },
  { name: 'specials', texts: [...SPECIALS, ...hyphenated(de.hyphenateSync, SPECIALS.slice(0, 4).map(t => ({ ...t, label: `${t.label} (SHY)` })))] },
]

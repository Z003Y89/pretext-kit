// The app screen's strings in three languages. Real UI copy, not lorem ipsum: German compounds and
// French phrases are what break fixed-size layouts in practice.
//
// Both sides get the same strings. Soft hyphens enter in two places: German UI labels carry soft hyphens
// written by hand at their compound joints (Tages|abschluss|bericht), where a German reader splits
// them; a dictionary picks syllable breaks (Tagesab-schlussbericht) that read wrong in a button.
// Titles get theirs from TeX patterns at build time; see hyphenatedTitles below.

export type Lang = 'en' | 'de' | 'fr'
export const LANGS: Lang[] = ['en', 'de', 'fr']
export const LANG_NAMES: Record<Lang, string> = { en: 'English', de: 'Deutsch', fr: 'Français' }

export type CardText = {
  // A case number shown as a chip, then a name: a mixed row.
  id: string
  name: string
  badge: string
  title: string
  body: string
  file: string
}

export type ScreenText = {
  app: string
  toolbar: [string, string, string, string]
  cards: [CardText, CardText, CardText]
  secondary: string
  primary: string
}

export const STRINGS: Record<Lang, ScreenText> = {
  en: {
    app: 'Billing',
    toolbar: ['New invoice', 'Daily closing report', 'Export', 'Settings'],
    cards: [
      {
        id: '207/0011',
        name: 'Dr. Lind',
        badge: 'Overdue · 14 days',
        title: 'Quarterly subscription renewal for the Northwind practice',
        body: 'The card on file was declined twice. Ask the practice to update its payment method before the next billing run on 1 November, or the subscription pauses and the booking page goes offline.',
        file: 'Invoice_207-0011_Dr-Lind_2026-10-05.pdf',
      },
      {
        id: '118/0420',
        name: 'Branch North',
        badge: 'Ready',
        title: 'Daily closing report for Branch North',
        body: 'Cash, card and voucher totals match the till. Two refunds are waiting for a second signature; the report locks automatically at midnight.',
        file: 'Daily-closing-report_Branch-North_2026-10-04.xlsx',
      },
      {
        id: '311/0007',
        name: 'M. Okafor',
        badge: 'Action needed',
        title: 'Privacy settings changed by an administrator',
        body: 'Marketing emails were switched off for 38 customers after a data request. Review the change log and confirm that exports no longer include their addresses.',
        file: 'Privacy-settings_change-log_2026-10-03.csv',
      },
    ],
    secondary: 'Save changes',
    primary: 'Subscribe and pay',
  },
  de: {
    app: 'Abrechnung',
    toolbar: ['Neue Rechnung', '„Tages\u00ADabschluss\u00ADbericht“', 'Exportieren', 'Einstellungen'],
    cards: [
      {
        id: '207/0011',
        name: 'Dr. Lind',
        badge: 'Überfällig · 14 Tage',
        title: 'Verlängerung des Quartalsabonnements für die Praxis Nordwind',
        body: 'Die hinterlegte Kreditkarte wurde zweimal abgelehnt. Bitten Sie die Praxis, ihre Zahlungsmethode vor dem nächsten Abrechnungslauf am 1. November zu aktualisieren, sonst wird das Abonnement pausiert.',
        file: 'Rechnung_207-0011_Dr-Lind_2026-10-05.pdf',
      },
      {
        id: '118/0420',
        name: 'Filiale Nord',
        badge: 'Bereit',
        title: '„Tagesabschlussbericht“ der Filiale Nord',
        body: 'Bargeld-, Karten- und Gutscheinsummen stimmen mit der Kasse überein. Zwei Rückerstattungen warten auf eine Zweitunterschrift; der Bericht wird um Mitternacht automatisch gesperrt.',
        file: 'Tagesabschlussbericht_Filiale-Nord_2026-10-04.xlsx',
      },
      {
        id: '311/0007',
        name: 'M. Okafor',
        badge: 'Handlungsbedarf',
        title: 'Datenschutzeinstellungen von einem Administrator geändert',
        body: 'Nach einer Datenauskunftsanfrage wurden Werbe-E-Mails für 38 Kundinnen und Kunden deaktiviert. Prüfen Sie das Änderungsprotokoll und bestätigen Sie, dass Exporte ihre Adressen nicht mehr enthalten.',
        file: 'Datenschutzeinstellungen_Änderungsprotokoll_2026-10-03.csv',
      },
    ],
    secondary: 'Änderungen speichern',
    primary: 'Zahlungs\u00ADpflichtig abonnieren',
  },
  fr: {
    app: 'Facturation',
    toolbar: ['Nouvelle facture', 'Rapport de clôture journalière', 'Exporter', 'Paramètres'],
    cards: [
      {
        id: '207/0011',
        name: 'Dr. Lind',
        badge: 'En retard · 14 jours',
        title: 'Renouvellement de l’abonnement trimestriel du cabinet Nordwind',
        body: 'La carte enregistrée a été refusée deux fois. Demandez au cabinet de mettre à jour son moyen de paiement avant la prochaine facturation du 1er novembre, sinon l’abonnement sera suspendu.',
        file: 'Facture_207-0011_Dr-Lind_2026-10-05.pdf',
      },
      {
        id: '118/0420',
        name: 'Agence Nord',
        badge: 'Prêt',
        title: 'Rapport de clôture journalière de l’agence Nord',
        body: 'Les totaux espèces, cartes et bons d’achat correspondent à la caisse. Deux remboursements attendent une seconde signature ; le rapport se verrouille automatiquement à minuit.',
        file: 'Rapport-de-cloture_Agence-Nord_2026-10-04.xlsx',
      },
      {
        id: '311/0007',
        name: 'M. Okafor',
        badge: 'Action requise',
        title: 'Paramètres de confidentialité modifiés par un administrateur',
        body: 'Les e-mails marketing ont été désactivés pour 38 clients à la suite d’une demande d’accès. Vérifiez le journal des modifications et confirmez que les exports n’incluent plus leurs adresses.',
        file: 'Parametres-de-confidentialite_journal_2026-10-03.csv',
      },
    ],
    secondary: 'Enregistrer les modifications',
    primary: 'S’abonner avec obligation de paiement',
  },
}

// Hyphenation policy: on both sides, badges and bodies are not hyphenated, and labels only at the
// joints written into them above. The kit ignores those joints (paints the label without them) except in
// one step: on a phone, the toolbar label it keeps last may break at a joint when one of its words is
// wider than the room beside the icons. The CSS side keeps them (hyphens: manual). Kit titles
// get soft hyphens only in a word wider than the card, where the alternative is an arbitrary
// overflow-wrap break; the kit knows which words those are because it measures them. CSS titles use
// hyphens: auto, which depends on the browser having a dictionary for the language. The hyphenated
// titles come from the build (examples/build.ts, `hyphen` TeX patterns: en-us, de-1996, fr), one
// string per card, the same words as the plain title with U+00AD inside some of them.
declare const __HYPHENATED_TITLES__: Record<Lang, string[]>

export function hyphenatedTitles(lang: Lang): string[] {
  return __HYPHENATED_TITLES__[lang]
}

// Sweep inputs, kept apart from the sweep so later tasks add corpora, fonts and widths here
// without touching how cases are judged. Texts marked "test-data" are copied from Pretext's
// src/test-data.ts and "corpora/<file>" from Pretext's corpora (public-domain prose); the
// kit may not import either, since they are not part of Pretext's published package.

import de from 'hyphen/de/index.js'
import fr from 'hyphen/fr/index.js'

export type Text = { label: string, text: string }
export type Corpus = { name: string, texts: Text[] }
// family is CSS font-family syntax: the sweep sets it on an element and reads the font back
// through fontFromStyle, so the font string Pretext gets is the one the browser computed.
export type FontStack = { label: string, family: string }

export const FONT_SIZE = 16
export const LINE_HEIGHT = 24

// Named macOS fonts only: a bare generic family resolves per browser and per language
// setting, which would make a case's expected answer depend on the machine.
export const FONT_STACKS: FontStack[] = [
  { label: 'Helvetica Neue', family: '"Helvetica Neue", "PingFang SC", "Geeza Pro", sans-serif' },
  { label: 'Arial', family: 'Arial, "PingFang SC", "Geeza Pro", sans-serif' },
  { label: 'Georgia', family: 'Georgia, "Hiragino Mincho ProN", serif' },
  { label: 'Times New Roman', family: '"Times New Roman", "Songti SC", serif' },
]

export const WIDTH_MIN = 120
export const WIDTH_MAX = 600
// truncateMiddle's widths: labels sit in narrow cells, so the range starts lower and ends sooner.
export const LABEL_WIDTH_MIN = 80
export const LABEL_WIDTH_MAX = 400

export function widths(step: number, min = WIDTH_MIN, max = WIDTH_MAX): number[] {
  const out: number[] = []
  for (let w = min; w <= max; w += step) out.push(w)
  return out
}

// Soft hyphens (U+00AD) are put in once, here, by TeX patterns, and painted with hyphens: manual:
// each browser's own hyphens: auto dictionary differs, so only explicit soft hyphens give every
// engine and Pretext the same break opportunities.
function hyphenated(hyphenateSync: (text: string) => string, texts: Text[]): Text[] {
  return texts.map(({ label, text }) => ({ label, text: hyphenateSync(text) }))
}

export const CORPORA: Corpus[] = [
  {
    name: 'latin',
    texts: [
      // test-data
      { label: 'Latin update', text: "Just tried the new update and it's so much better. The performance improvements are really noticeable, especially on older devices." },
      { label: 'Latin compatibility', text: "Does anyone know if this works with the latest version? I've been having some issues since the upgrade." },
      { label: 'Latin short', text: "This is exactly what I was looking for. Simple, clean, and does exactly what it says on the tin." },
      { label: 'Latin caching', text: "The key insight is that you can cache word measurements separately from layout results. This gives you the best of both worlds." },
      { label: 'Latin punctuation', text: "Performance is critical for this kind of library. If you can't measure hundreds of text blocks per frame, it's not useful for real applications." },
      { label: 'Latin hyphenation', text: "One thing I noticed is that the line breaking algorithm doesn't handle hyphenation. Is that on the roadmap?" },
      // corpora/en-gatsby-opening.txt
      { label: 'Gatsby advice', text: 'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.' },
      { label: 'Gatsby criticizing', text: '“Whenever you feel like criticizing anyone,” he told me, “just remember that all the people in this world haven’t had the advantages that you’ve had.”' },
      { label: 'Gatsby reserve', text: 'In consequence, I’m inclined to reserve all judgements, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.' },
      { label: 'Gatsby hope', text: 'Reserving judgements is a matter of infinite hope.' },
      { label: 'Gatsby levity', text: 'Most of the confidences were unsought—frequently I have feigned sleep, preoccupation, or a hostile levity when I realized by some unmistakable sign that an intimate revelation was quivering on the horizon.' },
      { label: 'Gatsby decencies', text: 'I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth.' },
    ],
  },
  {
    name: 'cjk',
    texts: [
      // test-data
      { label: 'Chinese', text: '这是一段中文文本，用于测试文本布局库对中日韩字符的支持。每个字符之间都可以断行。' },
      { label: 'Chinese short', text: '性能测试显示，新的文本测量方法比传统方法快了将近一千五百倍。' },
      { label: 'Japanese', text: 'これはテキストレイアウトライブラリのテストです。日本語のテキストを正しく処理できるか確認します。' },
      { label: 'Japanese short', text: 'パフォーマンスは非常に重要です。フレームごとに数百のテキストブロックを測定する必要があります。' },
      // corpora/zh-guxiang.txt
      { label: 'Guxiang return', text: '我冒了嚴寒，回到相隔二千餘里，別了二十餘年的故鄕去。' },
      { label: 'Guxiang winter', text: '時候既然是深冬；漸近故鄕時，天氣又陰晦了，冷風吹進船艙中，嗚嗚的響，從篷隙向外一望，蒼黃的天底下，遠近橫着幾個蕭索的荒村，沒有一些活氣。' },
      { label: 'Guxiang memory', text: '阿！這不是我二十年來時時記得的故鄕？我所記得的故鄕全不如此。我的故鄕好得多了。' },
      // corpora/zh-zhufu.txt
      { label: 'Zhufu year end', text: '舊曆的年底畢竟最像年底，村鎮上不必說，就在天空中也顯出將到新年的氣象來。' },
      { label: 'Zhufu quotes', text: '一見面是寒暄，寒暄之後說我「胖了」，說我「胖了」之後即大罵其新黨。' },
      // corpora/ja-rashomon.txt
      { label: 'Rashomon dusk', text: '或日の暮方の事である。一人の下人が、羅生門の下で雨やみを待つてゐた。' },
      { label: 'Rashomon gate', text: '廣い門の下には、この男の外に誰もゐない。唯、所々丹塗の剝げた、大きな圓柱に、蟋蟀が一匹とまつてゐる。' },
      // corpora/ja-kumo-no-ito.txt
      { label: 'Kumo no ito', text: 'ある日の事でございます。御釈迦様は極楽の蓮池のふちを、独りでぶらぶら御歩きになっていらっしゃいました。' },
    ],
  },
  {
    name: 'arabic',
    texts: [
      // test-data
      { label: 'Arabic', text: 'هذا النص باللغة العربية لاختبار دعم الاتجاه من اليمين إلى اليسار في مكتبة تخطيط النص' },
      { label: 'Arabic short', text: 'مرحبا بالعالم، هذه تجربة لقياس النص العربي وكسر الأسطر بشكل صحيح' },
      { label: 'Mixed en+ar', text: 'The meeting is scheduled for يوم الثلاثاء at the main office. Please bring your مستندات with you.' },
      { label: 'Mixed report', text: 'According to the report by محمد الأحمد, the results show significant improvement in performance.' },
      { label: 'Numbers+RTL', text: 'The price is $42.99 (approximately ٤٢٫٩٩ ريال or ₪158.50) including tax.' },
      { label: 'Long mixed', text: "In the heart of القاهرة القديمة, you can find ancient mosques alongside modern cafés. The city's history spans millennia. كل شارع يحكي قصة مختلفة about the rich cultural heritage." },
      // corpora/ar-al-bukhala.txt
      { label: 'Bukhala opening', text: 'تولاك الله بحفظه وأعانك على شكره ووفقك لطاعته وجعلك من الفائزين برحمته' },
      { label: 'Bukhala book', text: 'ذكرت - حفظك الله أنك قرأت كتابي في تصنيف حيل لصوص النهار وفي تفصيل حيل سراق الليل وأنك سددت به كل خلل وحصنت به كل عورة' },
      { label: 'Bukhala names', text: 'وذكرت ملح الحزامي واحتجاج الكندي ورسالة سهل بن هارون وكلام ابن غزوان وخطبة الحارثي وكل ما حضرني من أعاجيبهم' },
      // corpora/ar-risalat-al-ghufran-part-1.txt
      { label: 'Ghufran waves', text: 'وغرقت في أمواج بدعها الزاخرة، وعجبت من اتسِّاق عقودها الفاخرة، ومثلها شفع ونفع، وقرّب عند الله ورفع.' },
      { label: 'Ghufran tree', text: 'وهذه الكلمة الطيبة كأنّها المعنيّة بقوله: ألم تر كيف ضرب الله مثلاً كلمّة طيّبةً كشجرةً طيّبةٍ، أصلها ثابت وفرعها في السّمّاء، تؤتي أكلها كلّ حينٍ بإذن ربها.' },
      // corpora/mixed-app-text.txt
      { label: 'Support thread', text: 'The Arabic support thread said: "هذا جيد، ولكن لا تكسر العبارة «فيقول: وعليك السلام» داخل البطاقة."' },
    ],
  },
  {
    name: 'emoji-chat',
    texts: [
      // test-data
      { label: 'Emoji mixed', text: 'The quick 🦊 jumped over the lazy 🐕 and then went home 🏠 to rest 😴 for the night.' },
      { label: 'Emoji dense', text: 'Great work! 👏👏👏 This is exactly what we needed 🎯 for the project 🚀' },
      // corpora/mixed-app-text.txt
      { label: 'Status emoji', text: 'Status emoji stayed consistent: 👩‍💻, 👨🏽‍🔬, and family 👨‍👩‍👧‍👦 should not distort line counts.' },
      // Written for the sweep: chat shapes the two above lack (ZWJ and skin-tone sequences, flags,
      // keycaps, emoji-only messages, emoji glued to words and punctuation).
      { label: 'Lunch plans', text: 'lunch at 12:30? 🍜🍣 or the taco place 🌮 again lol' },
      { label: 'Ship it', text: 'Deploy went out 🚢✅ — dashboards look green 📈 so far, ping me if anything 🔥s' },
      { label: 'Reactions only', text: '😂😂😂🙌🙌💯💯💯🔥🔥🔥🎉🎉' },
      { label: 'Skin tones', text: 'thanks team 👍🏻👍🏽👍🏿 you all crushed it 💪🏼 this sprint' },
      { label: 'Flags', text: 'Offsite attendees from 🇺🇸 🇬🇧 🇯🇵 🇧🇷 🇩🇪 🇮🇳 confirmed, still waiting on 🇫🇷 and 🇰🇷' },
      { label: 'Keycaps', text: 'Vote: 1️⃣ ship Friday, 2️⃣ ship Monday, 3️⃣ wait for QA ✋' },
      { label: 'ZWJ family', text: 'Happy holidays from the whole crew 👨‍👩‍👧 👩‍👩‍👦 🧑‍🤝‍🧑 see you in January! ❄️⛄' },
      { label: 'Glued emoji', text: 'brb☕️ back in 5min🏃‍♀️ dont merge without me🙏' },
      { label: 'Weather report', text: 'Mon ☀️ 24° · Tue 🌤️ 22° · Wed 🌧️ 17° · Thu ⛈️ 15° · Fri 🌈 20°' },
    ],
  },
  {
    name: 'urls',
    texts: [
      // corpora/mixed-app-text.txt
      { label: 'Backup URL', text: 'keep the backup URL https://example.com/reports/q3?lang=ar&mode=full readable when the card shrinks' },
      // Written for the sweep: unbroken runs longer than most widths, so overflow-wrap does the breaking.
      { label: 'Bare URL', text: 'https://github.com/chenglou/pretext/blob/main/src/line-break.ts#L120-L184' },
      { label: 'Query string', text: 'See https://www.example.org/search?q=text+layout+engine&sort=relevance&page=3&utm_source=newsletter&utm_medium=email for more.' },
      { label: 'Unix path', text: 'Logs are in /var/lib/docker/containers/3f9a1c2b7e4d/3f9a1c2b7e4d-json.log on the build host.' },
      { label: 'Windows path', text: 'Open C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\Windows\\INetCache\\IE\\settings.ini and restart.' },
      { label: 'macOS path', text: '/Users/someone/Library/Application Support/Code/User/workspaceStorage/a1b2c3d4e5f6/state.vscdb' },
      { label: 'Hash', text: 'commit 9fceb02d0ae598e95dc970b74767f19372d61af8 fixes the regression from 4b825dc642cb6eb9a060e54bf8d69288fbee4904' },
      { label: 'Data URI', text: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
      { label: 'npm scope', text: 'Install @chenglou/pretext and node_modules/@chenglou/pretext/dist/rich-inline.d.ts has the types.' },
      { label: 'Email list', text: 'cc: release-engineering@example.com, platform-infrastructure-oncall@example.com, j.doe@example.co.uk' },
      { label: 'Snake case', text: 'Set MAX_CONCURRENT_BACKGROUND_COMPILATION_JOBS_PER_WORKER=4 and REQUEST_TIMEOUT_MILLISECONDS=30000.' },
      { label: 'Path with spaces', text: '~/Documents/Client Projects/2026 Q3 Rebrand/Final Final v7 (approved)/export@2x.png' },
    ],
  },
  {
    name: 'german',
    // Written for the sweep: compound-dense UI and production text, hyphenated with hyphen/de.
    texts: hyphenated(de.hyphenateSync, [
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
    ]),
  },
  {
    name: 'french',
    // Written for the sweep: UI labels and prose, which run 20-40% longer than English, hyphenated with hyphen/fr.
    texts: hyphenated(fr.hyphenateSync, [
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
    ]),
  },
]

// truncateMiddle's labels: paths and file names, each with a slash, so keepEnd can keep the name.
// Written for the sweep. Not hyphenated: a file name is not a word.
export const LABELS: Corpus = {
  name: 'labels',
  texts: [
    { label: 'Component', text: 'src/components/Button/Button.tsx' },
    { label: 'VS Code settings', text: '/Users/someone/Library/Application Support/Code/User/settings.json' },
    { label: 'Typings', text: 'node_modules/@chenglou/pretext/dist/rich-inline.d.ts' },
    { label: 'Export', text: '~/Documents/Client Projects/2026 Q3 Rebrand/export@2x.png' },
    { label: 'Route', text: 'packages/server/src/routes/api/v2/users/[id]/preferences.ts' },
    { label: 'ADR', text: 'docs/architecture/decisions/0042-use-event-sourcing-for-the-audit-log.md' },
    { label: 'Log', text: '/var/log/nginx/access.log.2026-10-04.gz' },
    { label: 'Font file', text: 'assets/fonts/NotoSansJP-VariableFont_wght.ttf' },
    { label: 'German take', text: 'Projekte/Synchronisation/Staffel 3/Folge 07 – Nebenrollen-Takes.wav' },
    { label: 'French invoice', text: 'Documents/Factures/2026/Facture fournisseur n° 1842 – réglée.pdf' },
    { label: 'Windows temp', text: 'C:/Users/Administrator/AppData/Local/Temp/installer-log.txt' },
    { label: 'Photo', text: 'Photos/2026/Summer trip 🏖️/IMG_20260714_183245.HEIC' },
    { label: 'Xcode', text: 'apps/mobile/ios/Runner.xcodeproj/project.pbxproj' },
    { label: 'Fixture', text: 'tests/fixtures/very-long-fixture-name-that-goes-on-and-on-and-on.json' },
    { label: 'Deep', text: 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/index.ts' },
    { label: 'Brand', text: 'design/Brand Refresh/Final Final v7 (approved)/logo-horizontal-dark.svg' },
    { label: 'Chinese', text: 'src/中文文档/排版测试/标点挤压与避头尾规则.md' },
    { label: 'Arabic', text: 'وثائق/التقارير السنوية/التقرير المالي للربع الثالث.pdf' },
    { label: 'Unbroken name', text: 'lib/extremely_long_filename_without_any_breaks_whatsoever_v2_final.config.js' },
    { label: 'Short', text: 'docs/README.md' },
  ],
}

// fitFontSizeRich's own labels: real UI labels set beside an icon, as given (not hyphenated: a
// button label carries no soft hyphens unless its author put them in). Written for the sweep.
export const UI_LABELS: Corpus = {
  name: 'ui-labels',
  texts: [
    { label: 'Record', text: '207/0011 Dr. Lind' },
    { label: 'Abonnieren', text: 'Zahlungspflichtig abonnieren' },
    { label: 'Tagesabschlussbericht', text: '„Tagesabschlussbericht“' },
    { label: 'Enregistrer', text: 'Enregistrer les modifications' },
    { label: 'Speichern', text: 'Speichern' },
  ],
}

// What the sweep runs per helper beyond corpora and widths, shared with examples/build-accuracy-data.ts
// so the accuracy explorer counts cases exactly as the sweep makes them.

// clamp runs at maxLines 1 to CLAMP_MAX_LINES.
export const CLAMP_MAX_LINES = 5

// fitFontSizeRich runs each width in two boxes. The height box holds three lines of the sweep's base
// 16px/24px text, so it is fixed across the sizes searched, as a real box is.
export const RICH_HEIGHT = 3 * LINE_HEIGHT
export type RichBox = { width: number, maxLines?: number, height?: number }
export const RICH_BOXES: { name: string, of: (width: number) => RichBox }[] = [
  { name: 'maxLines 1', of: width => ({ width, maxLines: 1 }) },
  { name: `height ${RICH_HEIGHT}`, of: width => ({ width, height: RICH_HEIGHT }) },
]

// fitFontSizeRich sweeps the left-to-right corpora an icon row holds, and real UI labels.
export const RICH_CORPORA: Corpus[] = [...CORPORA.filter(c => ['latin', 'german', 'french', 'emoji-chat'].includes(c.name)), UI_LABELS]

// fitFontSize's box: 96px holds four 24px lines, so the box is tight enough at 16px that most texts
// must shrink or grow to fit, which is where a wrong size would show. Sizes FIT_MIN-FIT_MAX with
// line height px × FIT_LINE_HEIGHT_RATIO (fractional at odd sizes, which WebKit 26 floors).
export const FIT_HEIGHT = 96
export const FIT_MIN = 8
export const FIT_MAX = 48
export const FIT_LINE_HEIGHT_RATIO = 1.5

// fitFontSizeRich's sizes, with whole-px line heights, so the WebKit 26 floor (a fractional line
// height) has nothing to act on there.
export const RICH_MIN = 8
export const RICH_MAX = 32
export const richLineHeight = (px: number): number => Math.round(px * 1.5)

// The corpora each helper sweeps: truncateMiddle its labels and the soft-hyphenated corpora, as every
// helper does; fitFontSizeRich RICH_CORPORA; fontFromStyle none (its cases are one per stack and size).
export function corporaFor(helper: string): Corpus[] {
  if (helper === 'truncateMiddle') return [LABELS, ...CORPORA.filter(c => c.name === 'german' || c.name === 'french')]
  if (helper === 'fitFontSizeRich') return RICH_CORPORA
  if (helper === 'fontFromStyle') return []
  return CORPORA
}

// Sweep inputs, kept apart from the sweep so later tasks add corpora, fonts and widths here
// without touching how cases are judged. Texts marked "test-data" are copied from Pretext's
// src/test-data.ts and "corpora/<file>" from Pretext's corpora (public-domain prose); the
// kit may not import either, since they are not part of Pretext's published package.

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

export function widths(step: number): number[] {
  const out: number[] = []
  for (let w = WIDTH_MIN; w <= WIDTH_MAX; w += step) out.push(w)
  return out
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
]

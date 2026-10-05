// The cost bench's page (bench.html): what the kit's helpers cost per message on 1,000 chat-like messages, next to
// Pretext's own layout() and to the DOM measurements an app would otherwise make. bench-run.ts drives it, one browser
// at a time, headed and in the foreground, as Pretext's bench guidance asks (its AGENTS.md, Validation; RESEARCH.md,
// Evaluation Traps, Timing): every round runs each operation once in a shuffled order, each sample after a
// MessageChannel yield and long enough (25 ms, or 100 timer steps where the timer is coarser) that timer coarsening
// and a GC pause cannot decide it. Numbers are reported, never targeted.
//
// Built twice by bench-run.ts: dist/bench.js, the timed page, and dist/bench-count.js, in which '@chenglou/pretext'
// and its rich-inline entry resolve to counting wrappers (bench-count-pretext.ts, bench-count-rich.ts), so the kit's
// own calls into Pretext are counted without editing src/. Only benchCounts reads the counters, and only that bundle
// is never timed.
import { clearCache, layout, prepareWithSegments } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import type { RichInlineBox, RichInlineItem } from '@chenglou/pretext/rich-inline'
import {
  balance, clamp, findIndexAt, fitFontSize, fitFontSizeRich, fontFromStyle, measureTail, prepareLabel, prepareSizes, prepareSizesRich, shrinkwrap, stack, truncateMiddle,
} from '../src/index.ts'
import type { PreparedLabel, PreparedSizes, PreparedSizesRich, Tail } from '../src/index.ts'
import { CORPORA, FONT_SIZE, LABELS, LINE_HEIGHT, UI_LABELS } from './corpora.ts'

export type OpInfo = { id: string, group: string, label: string, unit: string, n: number }
export type Sample = { op: string, ms: number, units: number, focused: boolean }
export type SetupInfo = {
  font: string, lineHeight: number, timerStep: number, crossOriginIsolated: boolean, dpr: number, userAgent: string,
  messages: { n: number, medianLength: number, short: number, medium: number, long: number, byCorpus: Record<string, number> },
}
// The first batch a fresh browser prepares, and, as a control, a second batch of new strings right after it with
// Pretext's caches cleared again: the gap between them is everything a browser warms on first use (JIT, the canvas,
// font loading, its shaping caches), which this bench does not take apart.
export type FirstPass = { n: number, prepareMs: number, layoutMs: number, secondPrepareMs: number }
// The DOM's equivalent in another freshly launched browser: create, append and read 1,000 new message divs, then a
// second batch right after as the control.
export type DomFirstPass = { n: number, firstMs: number, secondMs: number }
export type CallStats = { n: number, p50: number, p95: number, max: number }
export type PerCall = Record<string, CallStats>
export type Check = {
  heightsAgree: number, heightsN: number, fitAgree: number, fitN: number, fitLoopAgree: number, fitWarmAgree: number, fitWarmDomAgree: number, domWarmSteps: number,
  clampTruncated: number, middleTruncated399: number, middleTruncated200: number, labelsN: number,
}
export type CountSummary = { mean: number, min: number, max: number }
export type Counts = {
  balanceWalks: CountSummary, balanceLines: CountSummary, shrinkwrapWalks: CountSummary,
  fitColdPrepares: CountSummary, fitColdWalks: CountSummary, fitWarmPrepares: CountSummary, fitWarmWalks: CountSummary,
  richColdPrepares: CountSummary, richColdWalks: CountSummary, richWarmPrepares: CountSummary, richWarmWalks: CountSummary,
  clampPrepares: CountSummary, middlePrepares399: CountSummary, middlePrepares200: CountSummary,
}

declare global {
  interface Window {
    benchSetup: (session: number) => Promise<SetupInfo>
    benchFirstPass: () => FirstPass
    benchDomFirstPass: () => DomFirstPass
    benchFontPresence: () => boolean
    benchPerCall: () => PerCall
    benchInit: () => OpInfo[]
    benchCalibrate: (targetMs: number) => Promise<Record<string, number>>
    benchRound: (round: number) => Promise<Sample[]>
    benchCheck: () => Check
    benchCounts: () => Promise<Counts>
    benchSink: number
  }
}

const N = 1000
const LABEL_N = 200
const RICH_N = 200
const LIST_N = 10_000
const WIDTH = 400
const RESIZED = 399
const NARROW = 200
const FIT = { min: 8, max: 48, height: 96 }
const RICH = { min: 8, max: 32, height: 72 }
const fitLh = (px: number): number => Math.round(px * 1.5)
const MIN_CALIBRATION_MS = 5
// A new width per call for the helpers whose cut texts Pretext caches (clamp, truncateMiddle): stepping down a pixel a
// call from the start, and a 1/64 px lower on each pass through the range, so no width repeats within a session.
// Nearby widths can still cut the same text, as they do while a user drags a window edge.
function stepper(start: number, span: number): () => number {
  let k = 0
  return () => {
    const w = start - (k % span) - Math.floor(k / span) / 64
    k++
    return w
  }
}
const clampWidth = stepper(RESIZED, 100)
const middleWidth = stepper(RESIZED, 100)
const narrowWidth = stepper(NARROW, 50)

// --- Seeded randomness (mulberry32), so a session's workload is reproducible from its seed. ---
function rngFrom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

// --- The workload: chat-like messages cut from the sweep's corpora at word boundaries, one corpus a message. ---
const MESSAGE_CORPORA = ['latin', 'cjk', 'arabic', 'emoji-chat', 'urls', 'german', 'french']
const EMOJI_TAILS = ['👍', '😂', '🎉', '🙏', '🔥', '❤️', '👀', '✅']
type Source = { corpus: string, joiner: string, texts: { segments: string[], starts: number[] }[] }
const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' })
function sourceOf(name: string, texts: string[]): Source {
  return {
    corpus: name,
    joiner: name === 'cjk' ? '' : ' ',
    texts: texts.map(text => {
      const segments: string[] = []
      const starts: number[] = []
      for (const s of wordSegmenter.segment(text)) {
        if (s.isWordLike === true) starts.push(segments.length)
        segments.push(s.segment)
      }
      if (starts.length === 0) starts.push(0)
      return { segments, starts }
    }),
  }
}
const SOURCES = MESSAGE_CORPORA.map(name => sourceOf(name, CORPORA.find(c => c.name === name)!.texts.map(t => t.text)))
const RICH_SOURCES = ['latin', 'german', 'french', 'emoji-chat'].map(name => sourceOf(name, CORPORA.find(c => c.name === name)!.texts.map(t => t.text)))

// Pretext's bench lengths for chat (its harness/bench/texts.ts): a quarter 5-19 units, half 20-100, a quarter 101-400.
function chatLength(rng: () => number): number {
  const r = rng()
  if (r < 0.25) return 5 + Math.floor(rng() * 15)
  if (r < 0.75) return 20 + Math.floor(rng() * 81)
  return 101 + Math.floor(rng() * 300)
}

// Words from random places in random texts of one corpus, until the message reaches its length.
function cut(rng: () => number, source: Source, target: number): string {
  let out = ''
  while (out.length < target) {
    const t = pick(rng, source.texts)
    let i = pick(rng, t.starts)
    let piece = ''
    while (i < t.segments.length && out.length + piece.length < target) piece += t.segments[i++]
    piece = piece.trim()
    if (piece === '') continue
    out = out === '' ? piece : out + source.joiner + piece
  }
  return out.trim()
}

type Message = { text: string, corpus: string }
// n messages, distinct within the batch. Short messages recur across batches (the corpora are small), so a batch is
// new strings, not new words: see BENCH.md on what "first sight" means here.
function messages(rng: () => number, n: number): Message[] {
  const seen = new Set<string>()
  const out: Message[] = []
  while (out.length < n) {
    const source = pick(rng, SOURCES)
    let text = cut(rng, source, chatLength(rng))
    if (rng() < 0.2) text += ' ' + pick(rng, EMOJI_TAILS)
    if (seen.has(text)) continue
    seen.add(text)
    out.push({ text, corpus: source.corpus })
  }
  return out
}

// Path labels for truncateMiddle: the sweep's labels' directories and file names recombined.
function paths(rng: () => number, n: number): string[] {
  const dirs: string[] = []
  const names: string[] = []
  for (const { text } of LABELS.texts) {
    const parts = text.split('/')
    names.push(parts.pop()!)
    for (const p of parts) if (p !== '') dirs.push(p)
  }
  const seen = new Set<string>()
  while (seen.size < n) {
    const depth = 1 + Math.floor(rng() * 6)
    const parts: string[] = []
    for (let i = 0; i < depth; i++) parts.push(pick(rng, dirs))
    seen.add(parts.join('/') + '/' + pick(rng, names))
  }
  return [...seen]
}

// Icon-and-label rows: the sweep's UI labels and short runs of words from its left-to-right corpora.
function richLabels(rng: () => number, n: number): string[] {
  const seen = new Set<string>(UI_LABELS.texts.map(t => t.text))
  while (seen.size < n) seen.add(cut(rng, pick(rng, RICH_SOURCES), 8 + Math.floor(rng() * 33)))
  return [...seen]
}

// --- The page. ---
const probe = document.getElementById('probe') as HTMLDivElement
const messagesBox = document.getElementById('messages') as HTMLDivElement
const freshBox = document.getElementById('fresh') as HTMLDivElement
const fitBox = document.getElementById('fit') as HTMLDivElement
const fitOne = document.getElementById('fit-one') as HTMLDivElement
const fonts = new Map<number, string>()
// The font Pretext gets is the one the browser computed for a styled element, through fontFromStyle.
function fontPx(px: number): string {
  let f = fonts.get(px)
  if (f === undefined) {
    probe.style.fontSize = `${px}px`
    probe.style.lineHeight = `${fitLh(px)}px`
    f = fontFromStyle(getComputedStyle(probe)).font
    fonts.set(px, f)
  }
  return f
}

let sink = 0
let session = 0
let freshRng = rngFrom(1)
let font = ''
const base = messages(rngFrom(0x5eed), N)
const labels = paths(rngFrom(0x1abe1), LABEL_N)
const richTexts = richLabels(rngFrom(0x51c4), RICH_N)
let handles: PreparedTextWithSegments[] = []
let prepLabels: PreparedLabel[] = []
let tail: Tail
const heights = new Float64Array(LIST_N)
const tops = new Float64Array(LIST_N)
let ys: number[] = []
let fitEls: HTMLDivElement[] = []
let messageEls: HTMLDivElement[] = []
let resizeToggle = 0

function timerStep(): number {
  let step = Infinity
  for (let k = 0; k < 1000; k++) {
    const a = performance.now()
    let b = a
    while (b === a) b = performance.now()
    step = Math.min(step, b - a)
  }
  return step
}

const presenceText = 'mmmmmmmmmmlli WQ'
function helveticaNeuePresent(): boolean {
  const ctx = document.createElement('canvas').getContext('2d')!
  for (const generic of ['monospace', 'serif']) {
    ctx.font = `32px ${generic}`
    const fallback = ctx.measureText(presenceText).width
    ctx.font = `32px "Helvetica Neue", ${generic}`
    if (ctx.measureText(presenceText).width !== fallback) return true
  }
  return false
}

window.benchSetup = async (s: number): Promise<SetupInfo> => {
  await document.fonts.ready
  session = s
  freshRng = rngFrom(0x9e3779b9 ^ (s * 7919))
  probe.style.fontSize = `${FONT_SIZE}px`
  probe.style.lineHeight = `${LINE_HEIGHT}px`
  const style = fontFromStyle(getComputedStyle(probe))
  font = style.font
  fonts.set(FONT_SIZE, font)
  const lengths = base.map(m => m.text.length).sort((a, b) => a - b)
  const byCorpus: Record<string, number> = {}
  for (const m of base) byCorpus[m.corpus] = (byCorpus[m.corpus] ?? 0) + 1
  return {
    font, lineHeight: style.lineHeight, timerStep: timerStep(), crossOriginIsolated: window.crossOriginIsolated === true,
    dpr: devicePixelRatio, userAgent: navigator.userAgent,
    messages: {
      n: base.length, medianLength: lengths[lengths.length >> 1]!,
      short: lengths.filter(l => l < 20).length, medium: lengths.filter(l => l >= 20 && l <= 100).length, long: lengths.filter(l => l > 100).length,
      byCorpus,
    },
  }
}

// The first prepare a fresh browser makes: no Pretext cache, no canvas yet. Run once, right after benchSetup in a
// newly launched browser, before anything else measures text (benchSetup reads computed styles only; the page holds
// no text; the font-presence probe runs after this).
window.benchFirstPass = (): FirstPass => {
  const batch = messages(freshRng, N)
  const t0 = performance.now()
  const hs = batch.map(m => prepareWithSegments(m.text, font))
  const t1 = performance.now()
  for (const h of hs) sink += layout(h, RESIZED, LINE_HEIGHT).height
  const t2 = performance.now()
  const second = messages(freshRng, N)
  clearCache()
  const t3 = performance.now()
  for (const m of second) sink += prepareWithSegments(m.text, font).segments.length
  const t4 = performance.now()
  return { n: N, prepareMs: t1 - t0, layoutMs: t2 - t1, secondPrepareMs: t4 - t3 }
}

// In a browser of its own, launched for this alone: the first 1,000 new messages the DOM lays out and reads.
window.benchDomFirstPass = (): DomFirstPass => {
  const pass = (): number => {
    const batch = messages(freshRng, N)
    freshBox.replaceChildren()
    freshBox.style.width = `${RESIZED}px`
    sink += freshBox.offsetHeight
    const t = performance.now()
    const frag = document.createDocumentFragment()
    const els: HTMLDivElement[] = []
    for (const m of batch) {
      const d = document.createElement('div')
      d.textContent = m.text
      frag.appendChild(d)
      els.push(d)
    }
    freshBox.appendChild(frag)
    for (const d of els) sink += d.getBoundingClientRect().height
    return performance.now() - t
  }
  const firstMs = pass()
  const secondMs = pass()
  return { n: N, firstMs, secondMs }
}

window.benchFontPresence = (): boolean => helveticaNeuePresent()

// --- Operations. A repeat op runs its body `reps` times in one timed span; a fresh op times `reps` passes, each after
// an untimed setup that hands it new state (new strings, new PreparedSizes, cleared caches). ---
type Op = OpInfo & (
  | { kind: 'repeat', body: (reps: number) => void }
  | { kind: 'fresh', setup: () => void, timed: () => void, clears?: boolean }
)
const ops: Op[] = []
const reps = new Map<string, number>()

const sizesFor = (text: string): PreparedSizes => prepareSizes(text, fontPx, { min: FIT.min, max: FIT.max })
const richItems = (text: string) => (px: number): Array<RichInlineItem | RichInlineBox> =>
  [{ width: Math.round(px * 1.25) }, { text, font: fontPx(px), extraWidth: Math.round(px * 0.5) }]
const richSizesFor = (text: string): PreparedSizesRich => prepareSizesRich(richItems(text), { min: RICH.min, max: RICH.max })
const fitAt = (width: number) => ({ width, height: FIT.height })
const richAt = (width: number) => ({ width, height: RICH.height })

// Untimed, after an op that cleared Pretext's caches: every op after it in the round must meet the caches as the
// ones before it did, or the shuffled order would decide which op pays for refilling them.
function rewarm(): void {
  for (const m of base) sink += prepareWithSegments(m.text, font).segments.length
  for (const l of labels) sink += prepareLabel(l, font).starts.length
  for (const m of base) {
    const s = sizesFor(m.text)
    sink += fitFontSize(s, fitAt(WIDTH), fitLh)?.px ?? 0
    sink += fitFontSize(s, fitAt(RESIZED), fitLh)?.px ?? 0
  }
  for (const t of richTexts) {
    const s = richSizesFor(t)
    sink += fitFontSizeRich(s, richAt(WIDTH), fitLh)?.px ?? 0
    sink += fitFontSizeRich(s, richAt(RESIZED), fitLh)?.px ?? 0
  }
}

// DOM: does the box fit at its current font size, checked the usual way.
function domFits(el: HTMLElement, width = RESIZED): boolean {
  return el.scrollHeight <= FIT.height && el.scrollWidth <= width
}
function setPx(el: HTMLElement, px: number): void {
  el.style.fontSize = `${px}px`
  el.style.lineHeight = `${fitLh(px)}px`
}
// The common DOM loop: one box, each message's binary search reading the box after every size it tries, the same
// search the kit makes (min checked first, then halving with the larger half kept on a fit).
function domFitLoop(text: string): number {
  fitOne.textContent = text
  setPx(fitOne, FIT.min)
  if (!domFits(fitOne)) return -1
  let lo = FIT.min
  let hi = FIT.max
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2)
    setPx(fitOne, mid)
    if (domFits(fitOne)) lo = mid
    else hi = mid - 1
  }
  return lo
}
// The same search for every box at once: all sizes written, then all boxes read, so each step costs one layout of
// the boxes rather than one per box, as a competent batched implementation would do.
function domFitLockstep(els: HTMLElement[], width = RESIZED): Int32Array {
  const n = els.length
  const lo = new Int32Array(n)
  const hi = new Int32Array(n)
  for (const el of els) setPx(el, FIT.min)
  for (let i = 0; i < n; i++) {
    if (domFits(els[i]!, width)) { lo[i] = FIT.min; hi[i] = FIT.max }
    else { lo[i] = -1; hi[i] = -1 }
  }
  bisectLockstep(els, lo, hi, width)
  return lo
}
// Halves every box's range [lo, hi] at once, lo a size known to fit (or min - 1, standing for none), until lo === hi:
// all sizes written, then all boxes read, one reflow a step. Returns the number of steps.
function bisectLockstep(els: HTMLElement[], lo: Int32Array, hi: Int32Array, width: number): number {
  const n = els.length
  const mid = new Int32Array(n)
  let steps = 0
  for (;;) {
    let active = 0
    for (let i = 0; i < n; i++) {
      if (lo[i]! < hi[i]!) { mid[i] = lo[i]! + Math.ceil((hi[i]! - lo[i]!) / 2); setPx(els[i]!, mid[i]!); active++ }
    }
    if (active === 0) return steps
    steps++
    for (let i = 0; i < n; i++) {
      if (lo[i]! < hi[i]!) {
        if (domFits(els[i]!, width)) lo[i] = mid[i]!
        else hi[i] = mid[i]! - 1
      }
    }
  }
}
// The warm-started DOM search a careful app makes on a resize: every box tries the size it had before; one that still
// fits and does not fit a pixel larger is done in those two reflows, and the rest bisect the range on their side.
let warmSteps = 0
function domFitWarm(els: HTMLElement[], seeds: Int32Array, width: number): Int32Array {
  const n = els.length
  const lo = new Int32Array(n)
  const hi = new Int32Array(n)
  const at = new Int32Array(n)
  for (let i = 0; i < n; i++) { at[i] = seeds[i]! < 0 ? FIT.min : seeds[i]!; setPx(els[i]!, at[i]!) }
  const fitsAt = new Uint8Array(n)
  for (let i = 0; i < n; i++) fitsAt[i] = domFits(els[i]!, width) ? 1 : 0
  let up = 0
  for (let i = 0; i < n; i++) {
    if (fitsAt[i] === 1 && at[i]! < FIT.max) { setPx(els[i]!, at[i]! + 1); up++ }
  }
  for (let i = 0; i < n; i++) {
    const a = at[i]!
    if (fitsAt[i] === 1) {
      if (a === FIT.max || !domFits(els[i]!, width)) { lo[i] = a; hi[i] = a }
      else { lo[i] = a + 1; hi[i] = FIT.max }
    } else {
      // min - 1 stands for "no size fits" and comes back as min - 1, read as null.
      lo[i] = FIT.min - 1
      hi[i] = a - 1
    }
  }
  warmSteps = 1 + (up > 0 ? 1 : 0) + bisectLockstep(els, lo, hi, width)
  for (let i = 0; i < n; i++) if (lo[i]! < FIT.min) lo[i] = -1
  return lo
}

window.benchInit = (): OpInfo[] => {
  handles = base.map(m => prepareWithSegments(m.text, font))
  prepLabels = labels.map(l => prepareLabel(l, font))
  tail = measureTail('…', font)
  for (let i = 0; i < LIST_N; i++) heights[i] = layout(handles[i % N]!, RESIZED, LINE_HEIGHT).height
  const total = stack(heights, 8, tops)
  const yr = rngFrom(0xf1d)
  ys = Array.from({ length: N }, () => yr() * total)
  // DOM: the base messages, one div each, in a box whose width the resize baseline toggles.
  messagesBox.style.width = `${WIDTH}px`
  messageEls = base.map(m => {
    const d = document.createElement('div')
    d.textContent = m.text
    return d
  })
  messagesBox.replaceChildren(...messageEls)
  fitEls = base.map(m => {
    const d = document.createElement('div')
    d.textContent = m.text
    return d
  })
  fitBox.replaceChildren(...fitEls)
  sink += messagesBox.offsetHeight + fitBox.offsetHeight
  rewarm()

  const repeat = (id: string, group: string, label: string, unit: string, n: number, body: (reps: number) => void): void => {
    ops.push({ id, group, label, unit, n, kind: 'repeat', body })
  }
  const fresh = (id: string, group: string, label: string, unit: string, n: number, setup: () => void, timed: () => void, clears = false): void => {
    ops.push({ id, group, label, unit, n, kind: 'fresh', setup, timed, clears })
  }

  // a) prepare
  let batch: Message[] = []
  // The handles a prepare pass makes are kept, as an app keeps them, so the engine cannot drop the work; the next
  // pass's untimed setup releases them, though their collection may land in a later timed span of any op.
  let kept: PreparedTextWithSegments[] = []
  fresh('prepare.cold', 'prepare', 'prepareWithSegments, first sight (Pretext caches cleared, new strings)', 'message', N,
    () => { kept = []; batch = messages(freshRng, N); clearCache() },
    () => { for (const m of batch) kept.push(prepareWithSegments(m.text, font)) }, true)
  fresh('prepare.new', 'prepare', 'prepareWithSegments, new strings, Pretext caches warm', 'message', N,
    () => { kept = []; batch = messages(freshRng, N) },
    () => { for (const m of batch) kept.push(prepareWithSegments(m.text, font)) })
  repeat('prepare.again', 'prepare', 'prepareWithSegments, the same strings again', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const m of base) sink += prepareWithSegments(m.text, font).segments.length
  })

  // b) Pretext's own layout, the baseline every helper builds on
  repeat('layout.400', 'layout', 'layout() at 400', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const h of handles) sink += layout(h, WIDTH, LINE_HEIGHT).lineCount
  })
  repeat('layout.399', 'layout', 'layout() at 399 (resize)', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const h of handles) sink += layout(h, RESIZED, LINE_HEIGHT).lineCount
  })

  // c) helpers at the resized width. None of them keeps state per width except fitFontSize's PreparedSizes, so the
  // call at 399 on handles last used at 400 is the resize.
  repeat('shrinkwrap.399', 'helpers', 'shrinkwrap at 399', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const h of handles) sink += shrinkwrap(h, RESIZED).width
  })
  repeat('balance.399', 'helpers', 'balance at 399', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const h of handles) sink += balance(h, RESIZED).width
  })
  // clamp and truncateMiddle measure their cut text through Pretext, whose caches would hold a width's cuts after one
  // repetition, so every repetition takes a width the session has not used (stepper above).
  repeat('clamp.399', 'helpers', 'clamp(…, 3, measureTail(\'…\')) at a new width each repetition, 399 down', 'message', N, r => {
    for (let k = 0; k < r; k++) {
      const w = clampWidth()
      for (const h of handles) sink += clamp(h, w, 3, tail).lineCount
    }
  })
  repeat('prepareLabel', 'helpers', 'prepareLabel (path labels, Pretext caches warm)', 'label', LABEL_N, r => {
    for (let k = 0; k < r; k++) for (const l of labels) sink += prepareLabel(l, font).starts.length
  })
  repeat('truncateMiddle.399', 'helpers', 'truncateMiddle at a new width each repetition, 399 down; keepEnd at the last /', 'label', LABEL_N, r => {
    for (let k = 0; k < r; k++) {
      const w = middleWidth()
      for (const p of prepLabels) sink += truncateMiddle(p, w, { from: p.text.lastIndexOf('/') }).length
    }
  })
  repeat('truncateMiddle.200', 'helpers', 'truncateMiddle at a new width each repetition, 200 down; keepEnd at the last /', 'label', LABEL_N, r => {
    for (let k = 0; k < r; k++) {
      const w = narrowWidth()
      for (const p of prepLabels) sink += truncateMiddle(p, w, { from: p.text.lastIndexOf('/') }).length
    }
  })
  let sizes: PreparedSizes[] = []
  fresh('fit.cleared', 'helpers', 'fitFontSize, new PreparedSizes, Pretext caches cleared', 'message', N,
    () => { sizes = base.map(m => sizesFor(m.text)); clearCache() },
    () => { for (const s of sizes) sink += fitFontSize(s, fitAt(RESIZED), fitLh)?.px ?? 0 }, true)
  fresh('fit.cold', 'helpers', 'fitFontSize, new PreparedSizes (cold), Pretext caches warm', 'message', N,
    () => { sizes = base.map(m => sizesFor(m.text)) },
    () => { for (const s of sizes) sink += fitFontSize(s, fitAt(RESIZED), fitLh)?.px ?? 0 })
  fresh('fit.warm', 'helpers', 'fitFontSize, warm PreparedSizes: second call, 400 then 399', 'message', N,
    () => { sizes = base.map(m => sizesFor(m.text)); for (const s of sizes) sink += fitFontSize(s, fitAt(WIDTH), fitLh)?.px ?? 0 },
    () => { for (const s of sizes) sink += fitFontSize(s, fitAt(RESIZED), fitLh)?.px ?? 0 })
  let richSizes: PreparedSizesRich[] = []
  fresh('rich.cleared', 'helpers', 'fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared', 'row', RICH_N,
    () => { richSizes = richTexts.map(richSizesFor); clearCache() },
    () => { for (const s of richSizes) sink += fitFontSizeRich(s, richAt(RESIZED), fitLh)?.px ?? 0 }, true)
  fresh('rich.cold', 'helpers', 'fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm', 'row', RICH_N,
    () => { richSizes = richTexts.map(richSizesFor) },
    () => { for (const s of richSizes) sink += fitFontSizeRich(s, richAt(RESIZED), fitLh)?.px ?? 0 })
  fresh('rich.warm', 'helpers', 'fitFontSizeRich, warm: second call, 400 then 399', 'row', RICH_N,
    () => { richSizes = richTexts.map(richSizesFor); for (const s of richSizes) sink += fitFontSizeRich(s, richAt(WIDTH), fitLh)?.px ?? 0 },
    () => { for (const s of richSizes) sink += fitFontSizeRich(s, richAt(RESIZED), fitLh)?.px ?? 0 })

  // d) list helpers over 10,000 rows
  repeat('list.stack', 'list', 'stack over 10,000 heights', 'call', 1, r => {
    for (let k = 0; k < r; k++) sink += stack(heights, 8, tops)
  })
  repeat('list.find', 'list', 'findIndexAt over 10,000 tops', 'call', N, r => {
    for (let k = 0; k < r; k++) for (const y of ys) sink += findIndexAt(tops, LIST_N, y)
  })

  // e) DOM baselines
  let fresh1: Message[] = []
  fresh('dom.first', 'dom', 'DOM: create and append new message divs at 399, read every height', 'message', N,
    () => { fresh1 = messages(freshRng, N); freshBox.replaceChildren(); freshBox.style.width = `${RESIZED}px`; sink += freshBox.offsetHeight },
    () => {
      const frag = document.createDocumentFragment()
      const els: HTMLDivElement[] = []
      for (const m of fresh1) {
        const d = document.createElement('div')
        d.textContent = m.text
        frag.appendChild(d)
        els.push(d)
      }
      freshBox.appendChild(frag)
      for (const d of els) sink += d.getBoundingClientRect().height
    })
  repeat('dom.resize', 'dom', 'DOM: resize the box 400↔399, read every height (one reflow, batched reads)', 'message', N, r => {
    for (let k = 0; k < r; k++) {
      resizeToggle ^= 1
      messagesBox.style.width = `${resizeToggle === 1 ? RESIZED : WIDTH}px`
      for (const d of messageEls) sink += d.getBoundingClientRect().height
    }
  })
  repeat('dom.fit.loop', 'dom', 'DOM fitFontSize: the common loop, one box, a read per size tried', 'message', N, r => {
    for (let k = 0; k < r; k++) for (const m of base) sink += domFitLoop(m.text)
  })
  repeat('dom.fit.lockstep', 'dom', 'DOM fitFontSize: all boxes searched in lockstep from scratch (a reflow per step)', 'message', N, r => {
    for (let k = 0; k < r; k++) {
      setWidths(fitEls, RESIZED)
      sink += domFitLockstep(fitEls)[0]!
    }
  })
  let seeds: Int32Array = new Int32Array(0)
  fresh('dom.fit.warm', 'dom', 'DOM fitFontSize warm-started on a resize, 400 then 399: each box tries its previous size first', 'message', N,
    () => { setWidths(fitEls, WIDTH); seeds = domFitLockstep(fitEls, WIDTH); sink += fitBox.offsetHeight },
    () => { setWidths(fitEls, RESIZED); sink += domFitWarm(fitEls, seeds, RESIZED)[0]! })
  for (const op of ops) reps.set(op.id, 1)
  return ops.map(({ id, group, label, unit, n }) => ({ id, group, label, unit, n }))
}

function setWidths(els: HTMLElement[], width: number): void {
  for (const el of els) el.style.width = `${width}px`
}

const pause = (): Promise<void> => new Promise(done => {
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    done()
  }
  channel.port2.postMessage(null)
})
const inFront = (): boolean => document.visibilityState === 'visible' && document.hasFocus()

async function sample(op: Op, r: number): Promise<Sample> {
  await pause()
  const before = inFront()
  let ms = 0
  if (op.kind === 'repeat') {
    const t = performance.now()
    op.body(r)
    ms = performance.now() - t
  } else {
    for (let k = 0; k < r; k++) {
      op.setup()
      const t = performance.now()
      op.timed()
      ms += performance.now() - t
    }
    if (op.clears === true) rewarm()
  }
  window.benchSink = sink
  return { op: op.id, ms, units: r * op.n, focused: before && inFront() }
}

// Doubles an op's repetitions until a sample takes MIN_CALIBRATION_MS, then scales them to the target. Its samples
// are the first warm-up round, and are discarded.
window.benchCalibrate = async (targetMs: number): Promise<Record<string, number>> => {
  for (const op of ops) {
    let r = 1
    let s = await sample(op, r)
    while (s.ms < MIN_CALIBRATION_MS) {
      r *= 2
      s = await sample(op, r)
    }
    reps.set(op.id, Math.max(1, Math.ceil(r * targetMs / s.ms)))
  }
  return Object.fromEntries(reps)
}

window.benchRound = async (round: number): Promise<Sample[]> => {
  const rng = rngFrom(session * 100_003 + round)
  const order = ops.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  const out: Sample[] = []
  for (const i of order) out.push(await sample(ops[i]!, reps.get(ops[i]!.id)!))
  return out
}

// Whether the kit and the DOM baselines answer alike on this workload, so the timings compare like with like.
// Per-call cost, outside the timed rounds: each call timed alone, so each reading is quantised to the timer step and
// the distribution, not any one reading, is the result. Widths come from steppers of their own, offset by 1/128 px
// from the timed rows', so these calls also meet widths the session has not used.
window.benchPerCall = (): PerCall => {
  const stats = (xs: number[]): CallStats => {
    const v = xs.map(x => x * 1000).sort((a, b) => a - b)
    const q = (f: number): number => v[Math.max(0, Math.ceil(f * v.length) - 1)]!
    return { n: v.length, p50: q(0.5), p95: q(0.95), max: v[v.length - 1]! }
  }
  const time = (f: () => number): number => {
    const t = performance.now()
    sink += f()
    return performance.now() - t
  }
  const cw = stepper(RESIZED - 1 / 128, 100)
  const mw = stepper(RESIZED - 1 / 128, 100)
  const nw = stepper(NARROW - 1 / 128, 50)
  const clampMs: number[] = [], middleMs: number[] = [], narrowMs: number[] = [], coldMs: number[] = [], warmMs: number[] = []
  for (let pass = 0; pass < 3; pass++) {
    const w = cw()
    for (const h of handles) clampMs.push(time(() => clamp(h, w, 3, tail).lineCount))
  }
  for (let pass = 0; pass < 5; pass++) {
    const w = mw()
    const v = nw()
    for (const p of prepLabels) {
      middleMs.push(time(() => truncateMiddle(p, w, { from: p.text.lastIndexOf('/') }).length))
      narrowMs.push(time(() => truncateMiddle(p, v, { from: p.text.lastIndexOf('/') }).length))
    }
  }
  for (const m of base) {
    const sz = sizesFor(m.text)
    coldMs.push(time(() => fitFontSize(sz, fitAt(RESIZED), fitLh)?.px ?? 0))
    const s2 = sizesFor(m.text)
    sink += fitFontSize(s2, fitAt(WIDTH), fitLh)?.px ?? 0
    warmMs.push(time(() => fitFontSize(s2, fitAt(RESIZED), fitLh)?.px ?? 0))
  }
  return {
    'clamp': stats(clampMs), 'truncateMiddle ≈399': stats(middleMs), 'truncateMiddle ≈200': stats(narrowMs),
    'fitFontSize, new PreparedSizes (Pretext caches warm)': stats(coldMs), 'fitFontSize, second call 400 then 399': stats(warmMs),
  }
}

window.benchCheck = (): Check => {
  messagesBox.style.width = `${RESIZED}px`
  let heightsAgree = 0
  for (let i = 0; i < N; i++) {
    if (Math.abs(messageEls[i]!.getBoundingClientRect().height - layout(handles[i]!, RESIZED, LINE_HEIGHT).height) < 0.5) heightsAgree++
  }
  setWidths(fitEls, RESIZED)
  const dom = domFitLockstep(fitEls)
  let fitAgree = 0
  let fitLoopAgree = 0
  let fitWarmAgree = 0
  let fitWarmDomAgree = 0
  setWidths(fitEls, WIDTH)
  const seeds = domFitLockstep(fitEls, WIDTH)
  setWidths(fitEls, RESIZED)
  const warmDom = domFitWarm(fitEls, seeds, RESIZED)
  const domWarmSteps = warmSteps
  for (let i = 0; i < N; i++) {
    const kit = fitFontSize(sizesFor(base[i]!.text), fitAt(RESIZED), fitLh)?.px ?? -1
    if (kit === dom[i]) fitAgree++
    if (domFitLoop(base[i]!.text) === dom[i]) fitLoopAgree++
    const s = sizesFor(base[i]!.text)
    fitFontSize(s, fitAt(WIDTH), fitLh)
    if ((fitFontSize(s, fitAt(RESIZED), fitLh)?.px ?? -1) === dom[i]) fitWarmAgree++
    if (warmDom[i] === dom[i]) fitWarmDomAgree++
  }
  let clampTruncated = 0
  for (const h of handles) if (clamp(h, RESIZED, 3, tail).truncated) clampTruncated++
  let middleTruncated399 = 0
  let middleTruncated200 = 0
  for (const p of prepLabels) {
    if (truncateMiddle(p, RESIZED, { from: p.text.lastIndexOf('/') }) !== p.text) middleTruncated399++
    if (truncateMiddle(p, NARROW, { from: p.text.lastIndexOf('/') }) !== p.text) middleTruncated200++
  }
  return { heightsAgree, heightsN: N, fitAgree, fitN: N, fitLoopAgree, fitWarmAgree, fitWarmDomAgree, domWarmSteps, clampTruncated, middleTruncated399, middleTruncated200, labelsN: LABEL_N }
}

// Count bundle only: Pretext calls per kit call, read from the wrappers bench-run.ts swaps in for Pretext's entries.
window.benchCounts = async (): Promise<Counts> => {
  const c = (globalThis as { pretextCounts?: Record<'prepareWithSegments' | 'measureLineStats' | 'prepareRichInline' | 'measureRichInlineStats', number> }).pretextCounts
  if (c === undefined) throw new Error('benchCounts needs the count bundle (bench.html?count)')
  window.benchInit()
  const summary = (xs: number[]): CountSummary => ({ mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs) })
  const reset = (): void => { c.prepareWithSegments = 0; c.measureLineStats = 0; c.prepareRichInline = 0; c.measureRichInlineStats = 0 }
  const balanceWalks: number[] = []
  const balanceLines: number[] = []
  const shrinkwrapWalks: number[] = []
  for (const h of handles) {
    reset()
    balanceLines.push(balance(h, RESIZED).lineCount)
    balanceWalks.push(c.measureLineStats)
    reset()
    shrinkwrap(h, RESIZED)
    shrinkwrapWalks.push(c.measureLineStats)
  }
  const cp: number[] = []
  for (const h of handles) {
    reset()
    clamp(h, RESIZED, 3, tail)
    cp.push(c.prepareWithSegments)
  }
  const mp399: number[] = [], mp200: number[] = []
  for (const p of prepLabels) {
    reset()
    truncateMiddle(p, RESIZED, { from: p.text.lastIndexOf('/') })
    mp399.push(c.prepareWithSegments)
    reset()
    truncateMiddle(p, NARROW, { from: p.text.lastIndexOf('/') })
    mp200.push(c.prepareWithSegments)
  }
  const fc: number[] = [], fcw: number[] = [], fw: number[] = [], fww: number[] = []
  for (const m of base) {
    let s = sizesFor(m.text)
    reset()
    fitFontSize(s, fitAt(RESIZED), fitLh)
    fc.push(c.prepareWithSegments)
    fcw.push(c.measureLineStats)
    s = sizesFor(m.text)
    fitFontSize(s, fitAt(WIDTH), fitLh)
    reset()
    fitFontSize(s, fitAt(RESIZED), fitLh)
    fw.push(c.prepareWithSegments)
    fww.push(c.measureLineStats)
  }
  const rc: number[] = [], rcw: number[] = [], rw: number[] = [], rww: number[] = []
  for (const t of richTexts) {
    let s = richSizesFor(t)
    reset()
    fitFontSizeRich(s, richAt(RESIZED), fitLh)
    rc.push(c.prepareRichInline)
    rcw.push(c.measureRichInlineStats)
    s = richSizesFor(t)
    fitFontSizeRich(s, richAt(WIDTH), fitLh)
    reset()
    fitFontSizeRich(s, richAt(RESIZED), fitLh)
    rw.push(c.prepareRichInline)
    rww.push(c.measureRichInlineStats)
  }
  return {
    balanceWalks: summary(balanceWalks), balanceLines: summary(balanceLines), shrinkwrapWalks: summary(shrinkwrapWalks),
    fitColdPrepares: summary(fc), fitColdWalks: summary(fcw), fitWarmPrepares: summary(fw), fitWarmWalks: summary(fww),
    richColdPrepares: summary(rc), richColdWalks: summary(rcw), richWarmPrepares: summary(rw), richWarmWalks: summary(rww),
    clampPrepares: summary(cp), middlePrepares399: summary(mp399), middlePrepares200: summary(mp200),
  }
}

# pretext-kit/check: label checker design

Status: draft for review, 2026-10-06. Asked for by CueFlow (v0.1.0 review, item 5), DubFlow, which built the same
thing by hand (`ui/src/labelFit`) and would replace it with this (its two rounds of review are folded in), and
SoundVault's text-expansion roadmap item (nested i18n files, once its new languages exist).

## What this is

A test-time and CI check that every UI label fits the place it is shown, in every language, at every text scale and
theme the app supports, as the browser would lay it out. It answers "does „Zahlungspflichtig abonnieren“ fit the
160px button at 130% text size in the dark theme?" for the whole catalogue at once, and for each failure says what
is missing (px of width, or the font size that would fit).

It adds no measurement. It runs the kit's existing helpers (`shrinkwrap`, `fitFontSize`, `clamp`, `truncateMiddle`)
through `pretext-kit/headless`, so its verdicts carry the headless parity evidence in HEADLESS_RESULTS.md.

## Decisions taken with the user

- A function for tests and a CLI for CI (both).
- Each slot declares its own policy; a failure is a policy that cannot hold the label; truncation is a warning.
- Platforms: Chrome's `'macos'`, `'windows'`, `'linux'` profiles (`install({ platform })`), all three by default; the
  report names the worst.

## API

`import { checkLabels, slotFromStyle } from 'pretext-kit/check'`

```ts
checkLabels(input: CheckInput): Promise<Report>

type CheckInput = {
  fonts: FontSource[]                 // what registerFont gets: { family, data | path, weight?, style?, unicodeRange?, featureSettings? }
  labels: LabelSource                 // see below
  slots: SlotMap | (() => SlotMap | Promise<SlotMap>)
  rows?: RowMap                       // several slots sharing one line
  conditions?: Condition[]            // default [{ name: 'default' }]
  platforms?: Platform[]              // default ['macos', 'windows', 'linux']
  samples?: Record<string, Record<string, string | number>[]>   // per key: placeholder values to try
}

type LabelSource =
  | Record<string /* locale */, Record<string /* key */, string>>   // parsed i18n files, flat or nested
  | Label[]                                                          // labels kept in code
  | (() => Label[] | Promise<Label[]>)
type Label = { key: string, text: string, slot: string, locale?: string }   // locale defaults to 'und'

type Slot = {
  width: number | ((viewport: number) => number)   // content box px at zoom 1; a function of the window width
  reserve?: number                    // px taken by an icon and gap, scaled with the text
  font: string                        // CSS shorthand at scale 1, e.g. '600 15px Inter'
  letterSpacing?: number              // px at scale 1
  lineHeight?: number                 // px at scale 1; needed for lines policies
  whiteSpace?: 'normal' | 'pre-wrap'
  numeric?: 'proportional' | 'tabular'  // 'tabular' = font-variant-numeric: tabular-nums
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'   // applied with the label's locale
  policy: 'as-is' | { shrinkTo: number } | { lines: number } | { truncate: 'end' | 'middle', lines?: number }
  uses?: string[]                     // key patterns ('toolbar.*') when labels come from i18n files
}

type Condition = {
  name: string
  textScale?: number                  // a text-size setting: font size, letter spacing, line height and reserve
                                      // grow; boxes, rows and gaps keep their px width
  zoom?: number                       // CSS zoom / page zoom: everything grows, boxes and gaps too
  viewport?: number                   // window width in CSS px, passed to width functions (default 1440)
  slots?: Partial<Record<string, Partial<Slot>>>   // per-condition overrides (a theme with another base size)
}
// Conditions are listed, not multiplied out: an app names the combinations it ships
// (e.g. 130% text × 1024px window × compact theme). `conditionGrid({ textScale: [...], viewport: [...] })`
// builds the full product when that is wanted.

type Row = {
  width: number | ((viewport: number) => number), gap: number
  items: RowItem[]
}
type RowItem = {
  key: string, slot: string
  collapse?: { order: number, iconWidth: number }   // may drop to icon only; lower order collapses first
  shortKey?: string                                  // optional shorter label tried before icon only
}
// Stage 0: every item with its label. Each later stage applies the next step in collapse order (short label,
// then icon only) to one item. The row passes at the first stage whose widths and gaps fit; the report names
// that stage (`row-collapsed`, information, not a failure) and fails (`row-overflow`) only when the last stage
// still does not fit, as DubFlow's top bar does.

type Report = {
  schema: 1
  failures: Issue[], warnings: Issue[], notes: Issue[]        // notes: row-collapsed
  unchecked: string[]                                         // keys no slot or row uses
  checked: number                                             // label and row verdicts, per condition and platform
}
// Stable: issues sorted by slot or row, condition, locale, key, platform; numbers rounded to 1/64 px; no
// timestamps or paths. Two runs (before and after a font change) diff line by line.
type Issue = {
  kind: 'overflow' | 'too-many-lines' | 'below-min-size' | 'truncated' | 'row-overflow' | 'row-collapsed'
      | 'uncovered' | 'missing-sample' | 'unsupported-message' | 'unverifiable'
  locale: string, key: string, slot: string, condition: string, platforms: Platform[]
  text: string                                   // with samples filled in
  measured: { width: number, box: number, lines: number, fontPx: number, stage?: number }
  missing?: { px?: number, fitsAtPx?: number }   // what would make it fit
}
```

`slotFromStyle(style: CSSStyleDeclaration-like, rect: { width: number }, policy): Slot` builds a slot from a
computed style, using the kit's `fontFromStyle` (font, letter spacing, line height) plus `font-variant-numeric` and
`text-transform` (uppercase tabs are much wider than their source text). Apps that
define widths and fonts in CSS run it once in a browser test (Playwright, or the app's own) over the real elements and
save the slots as JSON, or call it from the async `slots` hook; either way slots follow the design instead of
drifting from it. The CLI does not parse CSS itself.

### Per-label evaluation

For each label × condition × platform: fill placeholders from `samples` (every sample is checked; `{name}` with no
sample → `missing-sample` warning, checked with the placeholder text); ICU `plural`/`select` → `unsupported-message`
warning, not checked. Then by policy, with `width − reserve` as the box:
- `'as-is'`: `shrinkwrap` at the slot size; one line wide enough, else `overflow` with `missing.px`.
- `{ shrinkTo }`: `fitFontSize` between `shrinkTo` and the slot size, one line; below `shrinkTo` → `below-min-size`
  with `missing.px` at `shrinkTo`.
- `{ lines }`: line count at the slot size ≤ `lines`, else `too-many-lines`.
- `{ truncate }`: `clamp` / `truncateMiddle`; cut → `truncated` (a warning).
An uncovered code point → `uncovered` (a failure: the app's font can't draw it), never a thrown error. Issues for
different platforms are merged into one with the platforms listed when their numbers differ by at most 1/64 px, showing
the worst platform's numbers; larger differences stay separate.

### Where it runs

In Node through `pretext-kit/headless` (fonts from `fonts`), or in a browser test runner with the page's own fonts
(no `fonts`). What one mode cannot check is reported, never passed: in a browser, Canvas cannot apply
`font-variant-numeric`, so a `numeric: 'tabular'` slot gives `unverifiable` (a warning; a failure with `--strict`)
and is not counted in `checked`.

### Tabular digits

Canvas cannot express `font-variant-numeric`, so in the browser Pretext measures proportional digits. In headless,
`registerFont` gains `featureSettings` (the CSS `@font-face` descriptor), and the checker registers each font a slot
uses with `numeric: 'tabular'` a second time under an internal alias family with `tnum` on. Fonts are cached per
family string, so the alias keeps tabular and proportional widths apart. Covered by the headless parity sweep with a
tabular row against Chromium's DOM (`font-variant-numeric: tabular-nums`).

## CLI

`npx pretext-kit check-labels [--config labels.config.mjs] [--json] [--strict] [--platform macos,linux]`

The config module default-exports a `CheckInput`, where `labels` may also be a glob of JSON files (locale from the
file name) and `fonts[].path` a file path. Output: failures then warnings, grouped by slot and condition, one line
each with the key, locale, text and what is missing. Exit 1 on failures (and on warnings with `--strict`), 0
otherwise; `--json` prints the Report. `bin` in package.json; Node only.

## Structure

```
src/check/
  index.ts      checkLabels, slotFromStyle                ~60 lines
  labels.ts     label sources, nested JSON, placeholders  ~80
  evaluate.ts   policy → verdict per label/condition      ~120
  rows.ts       row checks                                 ~40
  cli.ts        config loading, output, exit codes        ~90
```
`pretext-kit/check` imports `pretext-kit/headless`; the browser entry stays free of both.

## Verification (per PROTOCOL.md)

- **Unit tests:** each policy's pass and fail at the boundary (±1px), conditions and overrides, samples, ICU
  detection, rows, uncovered text, merged platforms, `slotFromStyle` on a fixture style, CLI exit codes and a golden
  report.
- **Oracle sweep** (`verify/check-labels.ts`): about 2,000 labels (the German, French and Latin corpora plus
  DubFlow-style toolbar labels) × the four policies × scales 1/1.15/1.3, rendered as real elements in Chromium on
  this Mac (Playwright, the same fonts by `@font-face`); every checker verdict compared with what the element does
  (overflow by `scrollWidth`, lines by rects, font size by the fitted style, truncation by text). Rows rendered as a
  flex line. Pass bar: verdicts equal wherever the kit agrees with Pretext-in-Chromium (PROTOCOL §2); disagreements
  attributed as in EVALUATION §2. Linux and Windows through CI as for the headless sweep.
- **Zoom vs text size:** the sweep renders both (CSS `zoom` on the container, and a font-size change with fixed
  boxes) and must agree with the checker in each.
- **Mutants:** ignore `reserve`; treat `zoom` as `textScale`; ignore `textTransform`; off-by-one in `lines`; skip a
  row collapse stage; tabular ignored. Each must be caught.
- **Statistics:** one unit per label text (PROTOCOL §4).

## Not in this version

ICU plural/select expansion; parsing CSS files; WebKit and Gecko profiles (headless is Chromium-only); React Native.

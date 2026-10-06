# pretext-kit: evaluation

What is claimed, how it was tested, what the tests found, how sensitive they are, what it costs, and what could make
the results wrong. The standard these checks follow, and the gate a release must pass, is in
[PROTOCOL.md](PROTOCOL.md). Every number names the file it comes from and the command that regenerates that file. Dated
2026-10-05; kit at the commit that adds this file, Pretext at
[f10d888](https://github.com/chenglou/pretext/commit/f10d888c0f3dfc5877fbca5e4570ee04111e7001).

**In one paragraph.** Over 7,029,756 browser cases (seven helpers × Chromium 149, WebKit 26.5, Firefox 151 × three
zoom factors, on one Mac), the kit never answered differently from what Pretext's own numbers require, and wherever
Pretext agreed with the browser, the browser painted what the kit predicted, apart from 12,931 WebKit cases with one
proven browser cause (fractional line heights, §8): 0 kit-mismatch cases. The bound to quote (§3) treats each text
as one unit: the 95% upper bound on the share of texts like these that would show any kit-mismatch is 4.4% to 7.4%
per helper and browser (1.1% to 2.0% if text × font pairs are taken as independent). Seven planted bugs were each
caught; six by 6,688 to 161,581 cases, and the seventh (`fontFromStyle` dropping the weight) only after this
evaluation added the cases that see it, since the sweep as it stood missed it (§4). Four subtler bugs (1/64 px or
one code point) were each caught by some helper's cases. A zero fit tolerance is caught by no balance or
fitFontSize case (§6). Cuts inside grapheme clusters were caught by no truncateMiddle case and no unit test until
this evaluation added a unit test, a sweep check and four labels for them; the labels then exposed a truncateMiddle
overrun in WebKit, fixed (§4). The kit inherits every
disagreement between Pretext and a browser (21,978 cases, 0.31%), among them 19 + 66 fitted sizes on soft-hyphenated
text that visibly overflow their box in Chromium and Firefox (§8). The browser sweep ran on macOS 14 only; headless parity also ran on Linux and Windows in CI (§7). The label checker, `pretext-kit/check` (C11, §3), was swept on Linux: 473,736 cases (375,564 verdict and 98,172 near-miss cases), 0 check-mismatch, 10,255 pretext-gap, 8 of 8 planted bugs caught (verify/CHECK_RESULTS.md, Chromium 141; the same tallies in CI with Chromium 149, run [37493529824](https://github.com/Z003Y89/pretext-kit/actions/runs/37493529824)), and on Windows in CI (Chromium 149): 0 check-mismatch, 12,424 pretext-gap, 8 of 8; not yet on macOS.

## 1. Claims under test

Each claim holds for the inputs in §2 (four named macOS font stacks, the corpora, widths and sizes listed there) in
the three browser builds named there. A single counterexample in that scope falsifies it; outside that scope nothing
is claimed. "Fits W" means no line paints wider than W + 1/64 px (engines let a line overshoot by up to 1/64 px).

Each claim has two halves, tested in order (§2). Against Pretext's own numbers it is unconditional: any case where
the kit's answer is not what Pretext's layout requires falsifies it. Against the painting it is conditional on
Pretext agreeing with the browser at the widths or sizes the judgement needs; where Pretext does not, the case is a
`pretext-gap`, counted and listed but evidence neither for nor against the kit. So the painting claims below are
"the kit adds no error to Pretext's", not "the browser always paints what the kit says" (§8 lists where it doesn't).

| # | helper | claim | tested by |
|---|---|---|---|
| C1 | `shrinkwrap(p, W)` | Returns `{ width, lineCount }` with `lineCount` equal to Pretext's line count at W and `width` = ⌈widest line Pretext lays out at W⌉ (one less only when Pretext lays out the same lines there), capped at W. The browser, at `width`, paints `lineCount` lines, and `width` is the ceiling of its widest painted line (one less only where the browser paints the same lines there). | browser sweep |
| C2 | `balance(p, W)` | Returns the narrowest whole-px `width` at which the browser paints `layout(p, W).lineCount` lines: at `width` it paints that many, at `width − 1` more (unless a grapheme wider than `width − 1` forces the width). Where line counts are not monotone in width and the search's width does not reproduce the count, balance falls back to shrinkwrap, which is not claimed narrowest; the sweep checks minimality at every answer wider than 1px (none failed), and skips it at 1px, where nothing is narrower. | browser sweep |
| C3 | `fitFontSize(sizes, box, lh)` | Returns the largest whole-px size in [min, max] at which the browser's painting fits the box (height ≤ `box.height`, lines ≤ `maxLines`, no overflow past the width), such that one px larger does not fit; `null` exactly when `min` does not fit. Judged at the box `{ W, height: 96 }`, sizes 8-48, line height 1.5 × size. | browser sweep |
| C4 | `fitFontSizeRich(sizes, box, lh)` | As C3, for an icon box followed by a label (one row, `extraWidth` as margin), sizes 8-32, boxes `{ W, maxLines: 1 }` and `{ W, height: 72 }`. | browser sweep |
| C5 | `clamp(p, W, N, tail)`, `clampStats`, `measureTail` | Line count = min(Pretext's, N) and `truncated` exactly when Pretext lays out more than N; this matches a `-webkit-line-clamp: N` box's truncation and height. Every returned line, the cut one followed by the tail, paints within W + 1/64. The cut is the longest grapheme prefix whose text joined to the tail, measured as one text, fits. Floor: a cut keeps at least one grapheme, so where W is narrower than the tail plus the first grapheme the line paints past W, and the claim is only that it is one grapheme. *Not claimed:* that the cut falls where the browser's own ellipsis does (the SVG probe that would test it was not run). | browser sweep |
| C6 | `truncateMiddle(label, W, keepEnd)` | The whole label (`label.text`: the text as Pretext prepared it, white space collapsed as under `white-space: normal`) exactly when its natural width fits W; otherwise start + `…` + end of `label.text`, cut only between graphemes, which paints within W + 1/64, where one more grapheme of the start would not fit, and whose end holds everything from `keepEnd.from`, an index into `label.text`, whenever that end, `…` and the first grapheme fit. The start keeps at least one grapheme, so where W is narrower than that grapheme and `…`, the result paints past W. | browser sweep |
| C7 | `fontFromStyle(getComputedStyle(el))` | Returns a Canvas font string that Canvas parses to the same font as the element's weight, style, size and family, with `letterSpacing` and `lineHeight` in px. Tested at the pinned style (weight 400, normal, no letter spacing) at 16px and 8-48px, and three single-property variants at 16px only: weight 700, italic, 0.5px letter spacing; not a cross of them (§4 explains why the variants were added). Indirectly, every other case's font comes from it. | browser sweep |
| C8 | `pretext-kit/headless` | In Node, for code points the registered fonts cover: `measureText` widths within 0.02px of Chromium's Canvas at the whole-pixel sizes of the sweep, measured on macOS, Linux and Windows (fractional sizes are modelled on the `'linux'` profile, Chromium 141 and 149 (CI run [37500166670](https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670)), and the `'windows'` profile, Chromium 149, exact on their data for the first use of a size in a page; `'macos'` fractional sizes are unmeasured; all outside this claim, §3 and §6), and Pretext's line counts equal Pretext's inside Chromium; `HeadlessCoverageError` thrown on exactly the cases a fixed coverage rule puts out of scope. Chromium's rules, macOS (and, since 0.1.1, Linux and Windows in CI), registered fonts only; variable fonts (since 0.1.2) for Inter Variable's `wght` axis on macOS only, under `install({ platform: 'macos' })` (the default); Linux and Windows Chromium measured equal to HarfBuzz's whole-unit rounding, which `platform: 'linux'`/`'windows'` uses (confirmed by CI run 37412616029: bit-exact on both). | headless parity sweep |
| C9 | `watchFonts` | On each `loadingdone` event with at least one face, calls Pretext's `clearCache()` and then the callback; never after unsubscribing. | unit tests only (stand-in `FontFaceSet`) |
| C10 | `stack`, `findIndexAt`, `anchorDelta`; `shrinkwrapRich`, `balanceRich` | Arithmetic over heights and tops; the rich twins are C1/C2 over `measureRichInlineStats`. | unit tests only; **not browser-swept** |
| C11 | `pretext-kit/check` (`checkLabels`, Node entry) | For the inputs in §3, "Label checker": the checker's verdict for a label under a policy (`overflow`, `too-many-lines`, `below-min-size`, `truncated`, none), for a `shrinkTo` slot its fitted size to 1/64 px, and for a row its collapse stage, and with `nearMiss` set its `near-miss` decision and slack (to 1/64 px), equal the verdict of the spec's rule recomputed in Chromium with the kit's helpers on Pretext with real Canvas, under text scale, zoom, and both together; against the painting it is conditional on Pretext agreeing with Chromium (the first half's `pretext-gap`s as above). `uncovered` text is excluded, not judged. Swept on Linux (Chromium 141 in a container, Chromium 149 in CI) under `platforms: ['linux']` and on Windows (Chromium 149, CI) under `platforms: ['windows']`, font Inter Regular; the macOS profile is not swept. Tabular digits (`numeric: 'tabular'`) are checked in the Node entry only. | label checker oracle sweep (`npm run verify:check`) |

C9 and C10 rest on `npm test` alone (194 tests, 90 + 104, on a stand-in Canvas, §6), not on a browser. The sweep's
labels hold no white space that collapses, so `label.text` is the label as given there; the collapsed-text rule
(and `keepEnd.from` indexing it, with doubled spaces, leading spaces and CRLF) is tested by `npm test` only.

## 2. Method

**Oracle.** The browser's painted DOM, read through Playwright 1.61.0 in headed browsers: Chromium 149.0.7827.55
(chromium-1228), WebKit 26.5 (webkit_mac14_arm64_special-2251), Firefox 151.0 (firefox-1532), on macOS 14.6.1
(23G93), Apple M2, `<html lang="en">`. Line counts are the painted height divided by the line height (a height that is
no whole number of lines, to 1/64 px, makes the case `unreliable`); widest lines are the union of
`Range.getClientRects()` over each run of non-white-space characters; widths, `scrollWidth` and
`scrollHeight > clientHeight` come from the elements. No pixels are compared. Harness: `verify/sweep.ts`,
`verify/sweep.html`, `verify/run.ts`.

**Inputs** (`verify/corpora.ts`).

| corpus | texts | source | swept by |
|---|---:|---|---|
| latin | 12 | Pretext's `src/test-data.ts` and Gatsby opening (public domain) | all but truncateMiddle |
| cjk (Chinese, Japanese) | 12 | test-data; Lu Xun, Akutagawa corpora | shrinkwrap, balance, fitFontSize, clamp |
| arabic (and mixed en/ar) | 12 | test-data; al-Jahiz, al-Ma'arri corpora | same |
| emoji-chat | 12 | test-data, mixed-app-text, written for the sweep | all but truncateMiddle |
| urls (unbroken runs) | 12 | mixed-app-text, written for the sweep | shrinkwrap, balance, fitFontSize, clamp |
| german, soft-hyphenated | 12 | written for the sweep; `hyphen/de` (de-1996) | all |
| french, soft-hyphenated | 12 | written for the sweep; `hyphen/fr` | all |
| labels (paths, incl. CJK, Arabic, emoji sequences, decomposed accents, Hangul jamo) | 24 | written for the sweep | truncateMiddle |
| ui-labels | 5 | real UI labels | fitFontSizeRich |

Fonts: four stacks, `"Helvetica Neue", "PingFang SC", "Geeza Pro", sans-serif`; `Arial, "PingFang SC", "Geeza Pro",
sans-serif`; `Georgia, "Hiragino Mincho ProN", serif`; `"Times New Roman", "Songti SC", serif`; all eight families
probed present in every run. 16px on 24px lines unless a helper varies size. Widths 120-600px (truncateMiddle
80-400px) in 1px steps at deviceScaleFactor 1 and 4px steps at 1.25 and 2 (`--zoom-step`, Ruling 24 in the ledger:
an earlier full step-1 run gave identical counts at all three factors). clamp at maxLines 1-5 with the tail
`measureTail('…', font)`; fitFontSize sizes 8-48; fitFontSizeRich sizes 8-32 in two boxes. Soft-hyphenated text is
painted with `hyphens: manual`. Every font string is the one `fontFromStyle` builds from the element's computed style.

**Outcome of a case**, assigned in this order (the full per-helper rules are in `verify/RESULTS.md`, header):

1. **kit vs Pretext.** The kit's answer is recomputed from Pretext's own numbers in the harness, never from the kit
(shrinkwrap's widest line, balance's line count one px narrower, the fit at px and px + 1, the clamp's lines and
  cut,
   the middle cut's widths). Any failure is a `kit-mismatch`, whatever the browser paints.
2. **Pretext vs browser.** If Pretext's line count (or widest line) differs from the painting at a width or size the
   judgement needs, the case is a `pretext-gap`: the kit cannot be judged there, and the disagreement is Pretext's.
3. **platform.** A painting that contradicts the kit is `platform` only when one named, proven cause explains it case
   by case. One cause is recognised, `webkit-26-line-height-floor` (§8): WebKit only, fractional line height, painted
   height exactly lines × the floored line height, and the same judgement passing with floored line heights.
4. **unreliable.** Painted height not a whole number of lines.
5. Otherwise the painting is compared with the kit's answer: agreement is `pass`, disagreement `kit-mismatch`.

`npm run verify` exits non-zero on any kit-mismatch, an absent font, a devicePixelRatio other than the factor, or a
browser × factor × helper whose pretext-gap or unreliable count exceeds `verify/baseline.json` by more than
max(5, 5%) (so a kit bug cannot hide as a rise in gaps).

**Headless parity** (`npm run verify:headless`, `verify/headless.ts`, `verify/HEADLESS_RESULTS.md`): the stand-in in
Node against Chromium 149 (same Playwright), with the test fonts (Inter TTF and WOFF2, Roboto, Shantell Sans 400/700)
and, since 0.1.2, Inter Variable (`@fontsource-variable/inter` 5.3.0, latin, wght 100-900) loaded by `@font-face`
from the same files. Widths: 54 strings × 4 families × weights 400/600/700 × 12/14/16/20px × letter spacing
0/0.5px = 5,184, less 24 string × family × weight pairs (192 cases) out of scope = 4,992 cases; plus Inter Variable,
54 strings × weights 300/400/500/600/700/800 × the same sizes and spacings = 2,592, less 30 pairs (240 cases) out of
scope = 2,352; 7,344 cases in all. The 918 string × family × weight units are not 918 distinct faces: Inter and
Roboto have one face, so their 600 and 700 (synthesised by Chromium) measure the 400 face, and Shantell Sans 600
takes its 700 face; Inter Variable's six weights are instances of one file. Counted by distinct face, they are 310
string × face pairs (Inter TTF 53, Inter WOFF2 53, Roboto 49, Shantell Sans 2 × 53, Inter Variable 49), for
which 0 misses bound the rate at 1.22% (Wilson; printed by `node verify/stats.ts`, which derives the faces from
HEADLESS_RESULTS.md). The instances of one variable file count as one unit, not six: they share the file, its HVAR
store and the stand-in's code path, so their failures are correlated (the one bug 0.1.2 fixed failed at every
non-default weight at once), and counting each would let the number of weights sampled set n. Line counts: 586 text
× font pairs (Latin, German and French from the corpora, 336 with soft hyphens, plus special characters; 288 of
them in Inter Variable at its six weights) × 241 widths (141,226 cases); with Inter Variable's instances as one font,
346 text × font units, 0 misses, Wilson 1.10%. The scope rule was fixed before the first
run, from the font files' cmaps, not from the stand-in.

**Statistics** (`node verify/stats.ts`). It reads `verify/RESULTS.md`, `verify/results/latest.json.gz`,
`verify/baseline.json`, `verify/HEADLESS_RESULTS.md` and `verify/corpora.ts`, checks that they agree (case counts
recomputed from the corpora, non-pass counts from the listing), and prints the tables in §3. Bounds are two-sided 95%
intervals' upper ends, i.e. one-sided 97.5%: Wilson score (≈ 3.84/n at 0 failures for large n) and, beside it, exact
Clopper-Pearson (≈ 3.69/n at 0; the "3.7/n" often quoted is this one). "Judged against the painting" counts every
case that is neither pretext-gap nor unreliable, so it includes the 12,931 platform cases as judged and not failing.
Logic tests: `npm test`, 194 tests (90 + 104, `node --test`; 160 in 0.1.1, 150 when the sweeps below were run, before the final
review's fixes added ten).

## 3. Results

From `node verify/stats.ts` over the run recorded in `verify/RESULTS.md` (`npm run verify`, 2026-10-05).

**No kit-mismatch in any helper, browser or factor.** 7,029,756 cases; 7,007,778 judged against the painting (the
others are 21,978 pretext-gap; no unreliable); 12,931 platform (all WebKit fitFontSize, §8).

**The bound to quote: one per helper and browser, with the text as the unit.** Cases of one text at adjacent widths,
line counts, zoom factors, and in the four font stacks, are not independent: a bug tied to a text shows at many of
its cases at once, and the stacks share the text's segmentation, scripts and break opportunities. Treating 160,000
such cases as independent draws gives bounds like 0.0024%, which overstate the evidence by two to three orders of
magnitude. Two clustered units are reported. The text × font stack pair (all its widths, line counts, boxes and
factors pooled; it fails if any of its cases is a kit-mismatch) is a conservative unit, assuming text × font pairs
are independent. The text alone (all four stacks pooled too) does not assume that, and gives the wider bound, which
is the one to quote: 4.4% (84 texts), 6.8% (fitFontSizeRich, 53) and 7.4% (truncateMiddle, 48) per browser.

All bounds below are the upper ends of two-sided 95% intervals, so each is a one-sided 97.5% upper bound; the 21
per-helper-and-browser bounds in a table are not simultaneous (with no correction, the chance that at least one is
exceeded is higher than 2.5%). At 0 failures Wilson gives z²/(n + z²) and Clopper-Pearson 1 − 0.025^(1/n): Wilson is
the larger for n above about 50, Clopper-Pearson below it (fontFromStyle's 16 units); quote the larger.

Text × font stack unit:

| helper | browser | units | cases per unit | units never judged | failing units | upper (Wilson) | upper (exact) |
|---|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle | chromium | 16 | 3 or 126 | 0 | 0 | 19.36% | 20.59% |
| fontFromStyle | webkit | 16 | 3 or 126 | 0 | 0 | 19.36% | 20.59% |
| fontFromStyle | firefox | 16 | 3 or 126 | 0 | 0 | 19.36% | 20.59% |
| shrinkwrap | chromium | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| shrinkwrap | webkit | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| shrinkwrap | firefox | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| balance | chromium | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| balance | webkit | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| balance | firefox | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| fitFontSize | chromium | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| fitFontSize | webkit | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| fitFontSize | firefox | 336 | 723 | 0 | 0 | 1.13% | 1.09% |
| fitFontSizeRich | chromium | 212 | 1446 | 0 | 0 | 1.78% | 1.72% |
| fitFontSizeRich | webkit | 212 | 1446 | 0 | 0 | 1.78% | 1.72% |
| fitFontSizeRich | firefox | 212 | 1446 | 0 | 0 | 1.78% | 1.72% |
| clamp | chromium | 336 | 3615 | 0 | 0 | 1.13% | 1.09% |
| clamp | webkit | 336 | 3615 | 0 | 0 | 1.13% | 1.09% |
| clamp | firefox | 336 | 3615 | 0 | 0 | 1.13% | 1.09% |
| truncateMiddle | chromium | 192 | 483 | 0 | 0 | 1.96% | 1.90% |
| truncateMiddle | webkit | 192 | 483 | 0 | 0 | 1.96% | 1.90% |
| truncateMiddle | firefox | 192 | 483 | 0 | 0 | 1.96% | 1.90% |

Text unit (the bound to quote):

| helper | browser | units | cases per unit | units never judged | failing units | upper (Wilson) | upper (exact) |
|---|---|---:|---:|---:|---:|---:|---:|
| shrinkwrap | chromium | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| shrinkwrap | webkit | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| shrinkwrap | firefox | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| balance | chromium | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| balance | webkit | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| balance | firefox | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| fitFontSize | chromium | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| fitFontSize | webkit | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| fitFontSize | firefox | 84 | 2892 | 0 | 0 | 4.37% | 4.30% |
| fitFontSizeRich | chromium | 53 | 5784 | 0 | 0 | 6.76% | 6.72% |
| fitFontSizeRich | webkit | 53 | 5784 | 0 | 0 | 6.76% | 6.72% |
| fitFontSizeRich | firefox | 53 | 5784 | 0 | 0 | 6.76% | 6.72% |
| clamp | chromium | 84 | 14460 | 0 | 0 | 4.37% | 4.30% |
| clamp | webkit | 84 | 14460 | 0 | 0 | 4.37% | 4.30% |
| clamp | firefox | 84 | 14460 | 0 | 0 | 4.37% | 4.30% |
| truncateMiddle | chromium | 48 | 1932 | 0 | 0 | 7.41% | 7.40% |
| truncateMiddle | webkit | 48 | 1932 | 0 | 0 | 7.41% | 7.40% |
| truncateMiddle | firefox | 48 | 1932 | 0 | 0 | 7.41% | 7.40% |

Read: "at 97.5% one-sided confidence, fewer than 4.37% of texts like these would show any shrinkwrap mismatch in
Chromium 149". fontFromStyle has no text: its unit is a stack × style variant (the pinned style pooled over 42 sizes,
or one of the three variants), 16 units, so 0 failures bound its rate only at about 20%; read it as a check of the
listed variants rather than a population bound. Its cases are judged against the expected font string, not a
painting.

**Per case** (unit: one case; for comparison only). Against Pretext's own numbers every case is judged
(n = cases); against the painting, n = cases that are neither pretext-gap nor unreliable.

<details><summary>Per helper × browser × factor (63 rows)</summary>

| helper | browser@factor | cases | pass | pretext-gap | platform | unreliable | kit-mismatch | judged | upper, vs Pretext (Wilson) | upper, vs painting (Wilson) | upper, vs painting (exact) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fontFromStyle | chromium@1 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | chromium@1.25 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | chromium@2 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | webkit@1 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | webkit@1.25 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | webkit@2 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | firefox@1 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | firefox@1.25 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| fontFromStyle | firefox@2 | 180 | 180 | 0 | 0 | 0 | 0 | 180 | 2.09% | 2.09% | 2.03% |
| shrinkwrap | chromium@1 | 161616 | 156575 | 5041 | 0 | 0 | 0 | 156575 | 0.0024% | 0.0025% | 0.0024% |
| shrinkwrap | chromium@1.25 | 40656 | 39384 | 1272 | 0 | 0 | 0 | 39384 | 0.0094% | 0.0098% | 0.0094% |
| shrinkwrap | chromium@2 | 40656 | 39384 | 1272 | 0 | 0 | 0 | 39384 | 0.0094% | 0.0098% | 0.0094% |
| shrinkwrap | webkit@1 | 161616 | 160601 | 1015 | 0 | 0 | 0 | 160601 | 0.0024% | 0.0024% | 0.0023% |
| shrinkwrap | webkit@1.25 | 40656 | 40396 | 260 | 0 | 0 | 0 | 40396 | 0.0094% | 0.0095% | 0.0091% |
| shrinkwrap | webkit@2 | 40656 | 40396 | 260 | 0 | 0 | 0 | 40396 | 0.0094% | 0.0095% | 0.0091% |
| shrinkwrap | firefox@1 | 161616 | 160303 | 1313 | 0 | 0 | 0 | 160303 | 0.0024% | 0.0024% | 0.0023% |
| shrinkwrap | firefox@1.25 | 40656 | 40326 | 330 | 0 | 0 | 0 | 40326 | 0.0094% | 0.0095% | 0.0091% |
| shrinkwrap | firefox@2 | 40656 | 40326 | 330 | 0 | 0 | 0 | 40326 | 0.0094% | 0.0095% | 0.0091% |
| balance | chromium@1 | 161616 | 156946 | 4670 | 0 | 0 | 0 | 156946 | 0.0024% | 0.0024% | 0.0024% |
| balance | chromium@1.25 | 40656 | 39483 | 1173 | 0 | 0 | 0 | 39483 | 0.0094% | 0.0097% | 0.0093% |
| balance | chromium@2 | 40656 | 39483 | 1173 | 0 | 0 | 0 | 39483 | 0.0094% | 0.0097% | 0.0093% |
| balance | webkit@1 | 161616 | 161616 | 0 | 0 | 0 | 0 | 161616 | 0.0024% | 0.0024% | 0.0023% |
| balance | webkit@1.25 | 40656 | 40656 | 0 | 0 | 0 | 0 | 40656 | 0.0094% | 0.0094% | 0.0091% |
| balance | webkit@2 | 40656 | 40656 | 0 | 0 | 0 | 0 | 40656 | 0.0094% | 0.0094% | 0.0091% |
| balance | firefox@1 | 161616 | 160603 | 1013 | 0 | 0 | 0 | 160603 | 0.0024% | 0.0024% | 0.0023% |
| balance | firefox@1.25 | 40656 | 40401 | 255 | 0 | 0 | 0 | 40401 | 0.0094% | 0.0095% | 0.0091% |
| balance | firefox@2 | 40656 | 40401 | 255 | 0 | 0 | 0 | 40401 | 0.0094% | 0.0095% | 0.0091% |
| fitFontSize | chromium@1 | 161616 | 161312 | 304 | 0 | 0 | 0 | 161312 | 0.0024% | 0.0024% | 0.0023% |
| fitFontSize | chromium@1.25 | 40656 | 40585 | 71 | 0 | 0 | 0 | 40585 | 0.0094% | 0.0095% | 0.0091% |
| fitFontSize | chromium@2 | 40656 | 40585 | 71 | 0 | 0 | 0 | 40585 | 0.0094% | 0.0095% | 0.0091% |
| fitFontSize | webkit@1 | 161616 | 153057 | 0 | 8559 | 0 | 0 | 161616 | 0.0024% | 0.0024% | 0.0023% |
| fitFontSize | webkit@1.25 | 40656 | 38470 | 0 | 2186 | 0 | 0 | 40656 | 0.0094% | 0.0094% | 0.0091% |
| fitFontSize | webkit@2 | 40656 | 38470 | 0 | 2186 | 0 | 0 | 40656 | 0.0094% | 0.0094% | 0.0091% |
| fitFontSize | firefox@1 | 161616 | 161565 | 51 | 0 | 0 | 0 | 161565 | 0.0024% | 0.0024% | 0.0023% |
| fitFontSize | firefox@1.25 | 40656 | 40644 | 12 | 0 | 0 | 0 | 40644 | 0.0094% | 0.0095% | 0.0091% |
| fitFontSize | firefox@2 | 40656 | 40644 | 12 | 0 | 0 | 0 | 40644 | 0.0094% | 0.0095% | 0.0091% |
| fitFontSizeRich | chromium@1 | 203944 | 203723 | 221 | 0 | 0 | 0 | 203723 | 0.0019% | 0.0019% | 0.0018% |
| fitFontSizeRich | chromium@1.25 | 51304 | 51244 | 60 | 0 | 0 | 0 | 51244 | 0.0075% | 0.0075% | 0.0072% |
| fitFontSizeRich | chromium@2 | 51304 | 51244 | 60 | 0 | 0 | 0 | 51244 | 0.0075% | 0.0075% | 0.0072% |
| fitFontSizeRich | webkit@1 | 203944 | 203944 | 0 | 0 | 0 | 0 | 203944 | 0.0019% | 0.0019% | 0.0018% |
| fitFontSizeRich | webkit@1.25 | 51304 | 51304 | 0 | 0 | 0 | 0 | 51304 | 0.0075% | 0.0075% | 0.0072% |
| fitFontSizeRich | webkit@2 | 51304 | 51304 | 0 | 0 | 0 | 0 | 51304 | 0.0075% | 0.0075% | 0.0072% |
| fitFontSizeRich | firefox@1 | 203944 | 203718 | 226 | 0 | 0 | 0 | 203718 | 0.0019% | 0.0019% | 0.0018% |
| fitFontSizeRich | firefox@1.25 | 51304 | 51247 | 57 | 0 | 0 | 0 | 51247 | 0.0075% | 0.0075% | 0.0072% |
| fitFontSizeRich | firefox@2 | 51304 | 51247 | 57 | 0 | 0 | 0 | 51247 | 0.0075% | 0.0075% | 0.0072% |
| clamp | chromium@1 | 808080 | 807503 | 577 | 0 | 0 | 0 | 807503 | 0.0005% | 0.0005% | 0.0005% |
| clamp | chromium@1.25 | 203280 | 203132 | 148 | 0 | 0 | 0 | 203132 | 0.0019% | 0.0019% | 0.0018% |
| clamp | chromium@2 | 203280 | 203132 | 148 | 0 | 0 | 0 | 203132 | 0.0019% | 0.0019% | 0.0018% |
| clamp | webkit@1 | 808080 | 807997 | 83 | 0 | 0 | 0 | 807997 | 0.0005% | 0.0005% | 0.0005% |
| clamp | webkit@1.25 | 203280 | 203255 | 25 | 0 | 0 | 0 | 203255 | 0.0019% | 0.0019% | 0.0018% |
| clamp | webkit@2 | 203280 | 203255 | 25 | 0 | 0 | 0 | 203255 | 0.0019% | 0.0019% | 0.0018% |
| clamp | firefox@1 | 808080 | 807991 | 89 | 0 | 0 | 0 | 807991 | 0.0005% | 0.0005% | 0.0005% |
| clamp | firefox@1.25 | 203280 | 203258 | 22 | 0 | 0 | 0 | 203258 | 0.0019% | 0.0019% | 0.0018% |
| clamp | firefox@2 | 203280 | 203258 | 22 | 0 | 0 | 0 | 203258 | 0.0019% | 0.0019% | 0.0018% |
| truncateMiddle | chromium@1 | 61632 | 61629 | 3 | 0 | 0 | 0 | 61629 | 0.0062% | 0.0062% | 0.0060% |
| truncateMiddle | chromium@1.25 | 15552 | 15551 | 1 | 0 | 0 | 0 | 15551 | 0.025% | 0.025% | 0.024% |
| truncateMiddle | chromium@2 | 15552 | 15551 | 1 | 0 | 0 | 0 | 15551 | 0.025% | 0.025% | 0.024% |
| truncateMiddle | webkit@1 | 61632 | 61632 | 0 | 0 | 0 | 0 | 61632 | 0.0062% | 0.0062% | 0.0060% |
| truncateMiddle | webkit@1.25 | 15552 | 15552 | 0 | 0 | 0 | 0 | 15552 | 0.025% | 0.025% | 0.024% |
| truncateMiddle | webkit@2 | 15552 | 15552 | 0 | 0 | 0 | 0 | 15552 | 0.025% | 0.025% | 0.024% |
| truncateMiddle | firefox@1 | 61632 | 61632 | 0 | 0 | 0 | 0 | 61632 | 0.0062% | 0.0062% | 0.0060% |
| truncateMiddle | firefox@1.25 | 15552 | 15552 | 0 | 0 | 0 | 0 | 15552 | 0.025% | 0.025% | 0.024% |
| truncateMiddle | firefox@2 | 15552 | 15552 | 0 | 0 | 0 | 0 | 15552 | 0.025% | 0.025% | 0.024% |

</details>

**Headless parity** (`verify/HEADLESS_RESULTS.md`):

| check | unit | n | failures | upper (Wilson) | upper (exact) |
|---|---|---:|---:|---:|---:|
| widths within 0.02px of Chromium's Canvas | case | 7344 | 0 | 0.052% | 0.050% |
| widths within 0.02px of Chromium's Canvas | string × family × weight (8 cases each) | 918 | 0 | 0.417% | 0.401% |
| widths within 0.02px of Chromium's Canvas | string × distinct face | 310 | 0 | 1.22% | 1.18% |
| line count equal to Pretext in Chromium (judged: not pretext-gap or unreliable) | case | 140938 | 0 | 0.0027% | 0.0026% |
| line count equal to Pretext in Chromium | text × font (241 widths each; a variable file once) | 346 | 0 | 1.10% | 1.06% |

Inter Variable alone (0.1.2; HEADLESS_RESULTS.md, by instance): 2,352 widths, 2,284 bit-exact, max |Δ| 0.000092px;
69,408 line counts, 0 headless-mismatch, 112 pretext-gap. Before the fix (0.1.1's stand-in, which rounds the
interpolated advances to whole font units), the same cases gave 232 widths beyond 0.02px (max 0.055115px) and 11
headless-mismatches (§8). The unrounded advances also match fontTools 4.62.1 exactly on 168,868 glyph × instance
pairs (326 instances, 50 of them distinct `wght` values in the `wght`-only file) in three Inter Variable files
(`npm run verify:hvar`, HEADLESS_RESULTS.md).

**Variable fonts per platform (0.1.2).** CI run [37410732972](https://github.com/Z003Y89/pretext-kit/actions/runs/37410732972)
ran the sweep with Inter Variable on `ubuntu-latest` and `windows-latest` (headed Chromium 149.0.7827.55, Node
v24.21.0) against the unrounded stand-in. Both gave exactly the pre-fix macOS numbers: Inter Variable 232 of 2,352
widths beyond 0.02px, max 0.055115px, 11 line-count headless-mismatches, the default instance (400) bit-exact, and
the same width misses with the same Chromium values on both (e.g. "Zahlungspflichtig abonnieren" at 500 16px:
Chromium 223.535934px, which is HarfBuzz's whole-unit width). So Chromium on Linux and Windows rounds the HVAR delta to
whole font units, as HarfBuzz does, and only macOS (CoreText) keeps the fraction. `install({ platform })` now picks:
`'macos'` (default) the unrounded advances measured above, `'windows'` and `'linux'` HarfBuzz's own; the sweep
installs the platform of the OS it runs on. Linux/Windows variable-font parity: measured by CI run 37410732972 as
equal to HarfBuzz's rounding; the option's own CI confirmation: run [37412616029](https://github.com/Z003Y89/pretext-kit/actions/runs/37412616029),
Inter Variable 2,352/2,352 widths bit-exact and 0 headless-mismatch in 141,226 line counts on each of Linux and Windows.

**Linux, independently reported (raw data not in the repo; Chromium 141, not 149; two local patches).** An
independent agent ran this headless parity sweep once on Linux and reported the tallies below; we have not reproduced
the run and do not have its HEADLESS_RESULTS.md. Environment: Chromium 141.0.7390.37 headed under Xvfb, Node 22.22,
Ubuntu 24.04, x64; same corpus (4,992 width cases; 298 texts × 241 widths). Its scratch copy had two local patches:
the launch pointed at a preinstalled Chromium (so not Playwright 1.61.0's Chromium 149), and the OS line of the
results no longer called macOS `sw_vers` (0.1.1 makes that change in the repository). Reported: widths 3,720 of
4,992 bit-exact, max |Δ| 0.001862px, 0 beyond 0.02px; Inter TTF, Inter WOFF2 and Roboto all bit-exact (Δ 0),
Shantell Sans within 0.0019px (so the 1,272 inexact widths, against macOS's 1,150, are Shantell Sans, all within
the bar). Line counts: 71,818 cases, 0 headless-mismatch, 178 pretext-gap (macOS: 176), 0 unreliable. All three
mutants caught. The agent concluded that `install({ rounding: 'whole-px' })` is not needed for that Chromium build on
Linux. It is one run, on an older Chromium than the one the claim names, so Linux is not claimed on it; it is also
a data point that the sweep runs on Node 22. CI's `parity` job then measured Linux with the pinned Chromium 149 and
got the same tallies exactly (3,720 exact, max 0.001862px, 178 pretext-gap; §7).

Both runs also record findings that are not kit-mismatches: 21,978 pretext-gap cases in 1,893 distinct findings
(RESULTS.md, "pretext-gap cases"), and 288 headless pretext-gap cases (HEADLESS_RESULTS.md; 176 in the static fonts, 112 in Inter Variable). Their counts per helper
are in the table above; their causes are in §6 and §8.

### Label checker (C11)

From `npm run verify:check` (`verify/check-labels.ts`), recorded in `verify/CHECK_RESULTS.md`: 2026-10-06, pretext-kit
at 4069db5, after the `nearMiss` margin and the sweep's near-miss family were added. The verdict cases are those of the
run before, at 320262f (after the slot option `overflowWrap` and the two policies that sweep it were added), and give
the same counts, cause by cause. The run before them, at
79a4b05 (not in the published history), gave 208,740 cases, 0 check-mismatch, 5,260 pretext-gap and 6 of 6 mutants
caught, and the five older policies give the same per-cause pretext-gap counts here; that run had been rerun on the final code after the review fixes (src/check and src/headless changed after 0a55e12, where it was first run: labels grouped by locale, duplicate samples planned once, font-feature edge cases, CLI robustness) with the same totals, and `git diff 0a55e12 7a6d38d -- src verify/check-labels*.ts test` showed `src` unchanged and the harness unchanged except 3 lines in `verify/check-labels-cases.ts` (`applyEdit` matches mutant sources on LF endings, commit 2b27623; no change to what is measured) and one test file modified for it (`test/check/sweep-cases.test.ts`, 12 lines; none added); Chromium 141.0.7390.37 (Playwright 1.61.0, headed on an X display, executable from `PW_CHROMIUM`), Pretext
0.0.9 (f10d888), harfbuzzjs 1.6.2, Node v22.22.0, Linux 6.18.44-fc-v70 x64; the checker is `checkLabels` in Node with
`platforms: ['linux']`, font Inter-Regular.ttf registered as "CK Inter". This is not the maintainer's Mac and not the
Chromium 149 the other sections use (§6).

Each case is judged three ways: the checker; a reference (the spec's rule recomputed in the page with the kit's helpers
on Pretext with real Canvas, from the CSS the element gets); the DOM (a flex box of the slot width, `white-space:
nowrap` or `-webkit-line-clamp` as the policy needs, text scale as a font-size change in a fixed box, zoom as CSS `zoom`
on the container). Outcome in the order of §2, with `check-mismatch` for the checker against the reference. The pass bar is 0
check-mismatch. The harness is verify/check-labels.ts, and the CHECK_RESULTS.md Method section gives every rule.

**473,736 cases: 0 check-mismatch, 10,255 pretext-gap, 0 excluded, 463,481 pass** (CHECK_RESULTS.md, "Agreement"):
375,564 verdict cases (375,348 slot, 216 row; 7,292 pretext-gap, 368,272 pass) and 98,172 near-miss cases (below; 2,963
pretext-gap, 95,209 pass). The verdict cases: The cases are 2,317 texts (latin 1,498, german 269, french 490, German compounds 15, French 15, uppercase
tabs 15, digits 15) in seven policies (as-is, shrinkTo, lines 2, truncate end 2 lines, truncate middle, and lines 2 and
truncate end 2 lines again in a slot with `overflowWrap: 'normal'`, rendered with `overflow-wrap: normal`, the
"(normal)" policies), each text scale (1, 1.15, 1.3) with its own slots at 0.9, 1 and 1.1 times the box where the
policy changes its verdict (for the "(normal)" policies the narrowest two-line width or the widest unbreakable piece,
whichever is wider), the "(normal)" policies also at the widest unbreakable piece's own width w: w, w less 1/64 px and a
hair rounded down to the 1/64 px grid (past the 1/64 px tolerance), and w less 0.25px, each
slot run in its own text scale's two zoom conditions (zoom 100% and 130%; six conditions in all: text 100/115/130% × zoom
100/130%), plus 108 toolbar rows (three locales × text scale, collapse stages 0 to
5 at, between and below each stage's total). The CHECK_RESULTS.md table gives each policy by condition kind; summed over
the policies from that table:

| condition kind | cases | pass | check-mismatch | pretext-gap |
|---|---:|---:|---:|---:|
| none (text 100%, zoom 100%) | 62,594 | 61,668 | 0 | 926 |
| text scale only | 125,188 | 123,151 | 0 | 2,037 |
| zoom only | 62,594 | 61,512 | 0 | 1,082 |
| text scale and zoom | 125,188 | 121,941 | 0 | 3,247 |

(Not run: 3 slots, so 6 cases, with no box left beside the icon grown with the text scale and 1.3x zoom, as the zoom
mutant grows it without the box; the checker rejects a slot with no box with a `RangeError`: CHECK_RESULTS.md, "Not run".) The checker's verdicts were not one-sided in any policy by condition
cell (the run fails if a cell has one verdict only), so each cell has both passes and failures.

**The bound to quote.** One unit per label text (PROTOCOL §4): a text's slots, widths and conditions are one unit, and
each locale's row is one, 2,320 units, 0 with a check-mismatch: 95% upper bound on the share of such texts that would
show one, Wilson 0.165%, Clopper-Pearson 0.159% (CHECK_RESULTS.md, "Agreement"; Wilson, the larger, is the one to quote). Per case, naive: 375,564 judged cases, Wilson 0.0010%, Clopper-Pearson 0.0010%,
which overstates the evidence as §3 explains. The texts are the corpora of §2 and hand-written labels, not an app's.

**pretext-gap, by cause** (7,292; CHECK_RESULTS.md, "pretext-gap cases, by cause"; each is the reference against Chromium's
painting with the checker agreeing with the reference. For the five older policies that makes it Pretext against the DOM,
not the checker. For the "(normal)" policies the word model (which text is one unbreakable piece, measured how) is the
kit's own, shared by checker and reference, so a gap there can also be that model against the DOM; the boundary boxes
below are what test it):
truncate end, DOM clamps where Pretext does not 1,160; lines, DOM 3 lines where Pretext 2: 1,154; as-is, DOM overflows
where Pretext fits 778; truncate middle, DOM overflows where Pretext fits 778; shrinkTo, DOM overflows at the fitted size
741; shrinkTo, DOM fits at the minimum where Pretext overflows 607; shrinkTo, DOM also fits at the next size 10; row, DOM
overflows at stage 0, 1, 2: 7, 3, 2; lines, DOM 4 lines where Pretext 2: 6; lines, DOM 2 lines where Pretext 3: 4;
truncate end, DOM does not clamp where Pretext cuts 4; as-is, DOM fits where Pretext overflows 3; truncate middle, DOM fits
where Pretext overflows 3; and 1,016 + 1,016 for lines (normal) and truncate end (normal), by cause in CHECK_RESULTS.md.
Of the 7,292, 6,300 slot cases are at the exact boundary box (box factor 1), 72 at 1.1 times it, none at 0.9, 12 are rows
and 908 are "(normal)" slots at the widest word's own width (counted from the full listing, verify/dist/check-cases.md,
by case id); 5,027 involve soft-hyphenated text (U+00AD in the text, counted the same way): by policy as-is 778, truncate
middle 778, shrinkTo 889, lines 695, truncate end 695, lines (normal) 596, truncate end (normal) 596, that is 2,445
nowrap-width cases (as-is, truncate middle, shrinkTo), where Chromium's text is wider than Pretext's natural width, and
2,582 line-break cases (lines and truncate end, either `overflowWrap`), where Chromium breaks differently.

The "(normal)" policies, 1,016 gaps each. At the factor boxes (562 each, all at factor 1): 551 are the soft-hyphen line
placement of the lines rows (re-rendered in Chromium 141 with `overflow-wrap: break-word` instead, the 83 at text 100% ·
zoom 100% give the same line count as with `normal`, so `overflowWrap` is not their cause); 7 are soft-hyphenated words at
zoom 130% whose hyphenated line Chromium paints about 0.03 zoomed px wider than Pretext's; 4 are uppercase tabs at text
115% · zoom 130% painted 1/32 zoomed px past the box where the checker passes. At the word's own width (454 each): w less
0.25px fails in the checker and overflows (lines) or is cut (truncate end) in the DOM in every case, 13,902 each, no gap;
at w and at w less 1/64 px and a hair there is no gap at zoom 100% (the DOM agrees on all 41,706 word-width cases at
zoom 100%, text 100/115/130%), and the 12 + 442 gaps are all under zoom 130% (DOM text minus box −0.047 to +0.031 zoomed px),
322 of them at text 130% · zoom 130%. One cause is measured: at text 130% · zoom 130% Chromium lays out the zoomed 20.8px like an unzoomed 27.02 to 27.03px rather than 27.04px ('improvements': 180.7656 zoomed px under zoom, 180.875 at 27.04px), which the Linux fractional-size model does not cover (it models sizes, not zoom). The rest is consistent with Chromium snapping zoomed slot, icon and text widths to its 1/64 px layout grid, which would put these boxes, within 1/32 px of the word, on
either side of it; that is confirmed for the box widths only: over the 908 cases the DOM box less the checker's box is
−0.0156 to +0.0094 zoomed px (0 at zoom 100%, recomputed from the full listing), and the snapping of text widths is
not measured. Words whose natural width is within 1/64 px past the box are laid out at the box plus 1/64 px since
320262f (in the run before, at 1c43ee5, Pretext's layout at the bare box split them, and there were 142 more gaps at these boxes). Before the fix
to the word rule (13acc40), the checker judged a word by Pretext's one-line layout instead of its natural width and passed
words that overflow in Chromium by up to 0.74px at 16px ('Mitarbeiterportal'; a reviewer's probe over 661 corpus words in
Chromium 141 found 65 such); the sweep then had no box below the natural width and a reference with the same rule, so it
could not show it. Recomputed from the listing: the 131
as-is cases at text 100% · zoom 100% show the DOM text 0.125 to 0.828px wider than the box (most often 0.25px, 73 cases;
mean 0.31px); over as-is and truncate middle in all conditions the largest is 1.23 zoomed px; the 702 shrinkTo "DOM
overflows at the fitted size" cases among them show 0.031 to 1.016 zoomed px. At the exact
boundary the checker can therefore pass a label that overflows in the DOM (§8).

Under `overflowWrap: 'normal'` the 1/64 px window applies to every line of a text that has a word in it (lines are laid
out at the box plus 1/64 px), so a line within 1/64 px of the box can pass where Chromium, whose width is 1/64 px wider
than Pretext's, wraps it. A probe of 3,000 adversarial `lines: 2` cases found 48 such at 20.8px and none at 16px; the
sweep's boxes are not built to hit it, and `test/check/evaluate.test.ts` pins the behaviour at box + 1/64.

**Near-miss** (`nearMiss`, the warning `near-miss`; CHECK_RESULTS.md, "Near-miss family"). Every sixth text (387) in
the seven policies at each text scale, at the policy's boundary box plus −0.5, 0, 2/1.3 ± 0.25 and 2 ± 0.25 px, and the
toolbar rows at each stage's total plus the same offsets, run with `nearMiss: 2` in checkLabels calls of their own:
48,762 slots and 324 rows, 98,172 cases (97,524 slot, 648 row). Each is judged as a verdict case; then, on a pass (a
row also at a collapse stage), the checker's near-miss and `missing.px` against the slack recomputed in the page (the
box less the natural width, the width at the fitted size, Pretext's widest line and, under `'normal'`, the widest word,
or the row's total at its stage), and that against the DOM's free space (the box less the text's width, or its widest
line from a range's rects grouped by top), agreeing within 1/64 px of the margin. **0 check-mismatch** (no near-miss on
a failing verdict, no different decision; the checker's `missing.px` equals the reference's rounded slack in all
51,083 near-misses); 2,963 pretext-gaps, of which 1,398 are the verdict gaps of §3's kinds at these boxes and 1,565 are
slack gaps. Each slack gap was re-laid out (lines from Pretext at the case's box, each line's text measured again as
a whole, compared with the DOM's slack; Chromium's own breaks read character by character for the zoom-100% examples):

| slack-gap cause | cases | DOM slack less Pretext's (zoomed px) |
|---|---:|---|
| Pretext's width for the pieces of a word broken across lines: the line's pieces are measured apart and summed, so kerning and ligatures across them are lost ("d’offres." breaks as "d’off" / "res." in Chromium too, 35.41 vs 33.78 px for "d’off" at 16px, the `ff` ligature; "key" as "ke" / "y", 18.11 vs 17.75); the line measured whole matches the DOM within 1/32 px | 680: 232 without a soft hyphen, 448 at a soft hyphen | without: +0.26 to +2.77, all positive; at a soft hyphen: −0.77 to +0.91, negative in 304, positive in 144 |
| one-line soft-hyphenated text (the soft-hyphen width gap of §3) | 638 | −1.26 to +2.17 |
| soft-hyphenated lines that do not match the DOM even measured whole: 64 cases of 4 texts outside text 130% · zoom 130%, consistent with Chromium breaking them differently; 80 cases of 17 texts at text 130% · zoom 130%, confounded with the zoomed-size cause (some break identically in both engines) | 144 | −0.77 to +2.58 |
| "Nebenrollen-Takes" on one line: Pretext measures "Nebenrollen-" and "Takes" apart and loses the `-T` kerning (99.20 + 44.34 = 143.54 vs 142.36 px whole at 16px) | 37 (53 with its lines cases above) | +0.27 to +2.12 over all 53 |
| one-line text and rows at text 130% · zoom 130% (the zoomed-size cause above) | 36 + 15 rows | +0.26 to +0.31; rows +0.28 to +0.66 |
| one-line text at text 115% · zoom 130% ("Most of the", shrinkTo: DOM 1.9688, Pretext 1.9949, which the checker rounds to 2, so no near-miss) | 1 | −0.026 |
| lines Chromium breaks at another place ("of library. If you can't" at text 130% · zoom 100%, a line 1/64 px past the box; "unequally at birth." at text 100% · zoom 130%) | 8 | −2.27 to +2.28 |
| broken-word pieces at text 130% · zoom 130%, where the zoomed-size cause adds to them, so the whole-line measure does not match within 1/32 px ("d’offres.", "Paramètres avancés", "Nebenrollen-Takes") | 6 | +0.51 to +0.94 |

The broken-word cause is a Pretext gap in plain text too, up to about 1.6 px at 16px. In plain text and in the
"Nebenrollen-Takes" compound it is in the safe direction: Pretext's line is wider, so its slack is smaller and the label
is flagged sooner. At a soft hyphen the sign is mixed (−0.77 to +0.91 px, Pretext's slack the larger in 304 of the 448),
so there a label can be flagged later than Chromium's room would warrant. **What the DOM check resolves.** The boxes sit
1/4 px either side of the margin (and of the margin ÷ 1.3), so a systematic slack error under 1/4 px moves no decision
and cannot show as a gap; CHECK_RESULTS.md, "Resolution", gives the DOM's slack less the reference's over the 80,582
passes whose verdict the DOM agrees with: median −0.0078 px, 29,184 beyond ±1/64 px, 13,900 beyond ±1/16 px and 6,130
beyond ±1/4 px (without a soft hyphen 59,822 cases, 18,212, 6,412 and 1,242). Of the 18,212 without a soft hyphen beyond
±1/64 px, 17,524 are at zoom 130% (10,196 `lines` and truncate end, 7,328 one-line policies and rows), which points at
Chromium's 1/64 px grid snapping and the zoomed-size cause rather than at line breaking; 688 are at zoom 100%.
For one-line text without a soft hyphen at zoom 100% (as-is, truncate middle, shrinkTo) Chromium's slack is 0 to 1/64 px
less than Pretext's, "Nebenrollen-Takes" aside (recomputed from verify/dist/check-results.json.gz). None is the checker's: in each it agrees with the reference. The vacuity guard requires passes with
and without a near-miss in every policy by condition kind, and holds. The verdict-only runs report no near-miss (the
harness fails if they do).

**Mutants** (CHECK_RESULTS.md, "Mutants"; each a copy of `src` with the edits listed there, run as the checker side of the same sweep;
caught means at least one check-mismatch of its own; the counts include the near-miss family's): 8 of 8 caught.

| planted bug | check-mismatch | of them near-miss family | caught |
|---|---:|---:|---|
| ignore `reserve` | 93,562 | 16,472 | yes |
| treat zoom as text scale | 148,617 | 40,796 | yes |
| ignore `textTransform` | 1,634 | 360 | yes |
| lines off by one (`<` for `<=`) | 76,753 | 21,898 | yes |
| skip the last collapse stage | 144 | 108 | yes |
| tabular ignored (alias not used) | 1,041 | 547 | yes |
| ignore `overflowWrap` (every slot `'break-word'`) | 39,898 | 1,108 | yes |
| ignore `nearMiss` | 51,083 | 51,083 | yes |

The verdict cases alone give the counts of the run before (77,090, 107,821, 1,274, 54,855, 36, 494 and 38,790).

**Excluded**: none. **Check-mismatch cases**: none. The Linux profile needed the headless fix in this release first: the first run exposed a stand-in
rounding defect for fractional sizes on Linux; the model (CHANGELOG 0.2.0) fixed it, and the sweep records, as a limit, that in-page metric sharing between nearby fractional sizes is not
modelled and that none of the sweep's nearby pairs shares an entry (17.94 and 18, 27 and 27.04, 21.97 and 22, 16.9 and 17px).

**Per platform.** The same sweep (same cases, same harness) on each platform, the checker under that platform's profile:

| platform | Chromium | where | check-mismatch | pretext-gap (verdict + near-miss) | mutants |
|---|---|---|---:|---:|---:|
| Linux | 141.0.7390.37 | container, verify/CHECK_RESULTS.md | 0 | 10,255 (7,292 + 2,963) | 8 of 8 |
| Linux | 149.0.7827.55 | CI run [37493529824](https://github.com/Z003Y89/pretext-kit/actions/runs/37493529824) (PR #6 at 1ee0797), `ubuntu-latest` | 0 | 10,255 | 8 of 8: 93,562 / 148,617 / 1,634 / 76,753 / 144 / 1,041 / 39,898 / 51,083 |
| Windows | 149.0.7827.55 | CI run [37500166670](https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670) (PR #7 at f91d817), `windows-latest` | 0 | 12,424 (9,335 + 3,089) | 8 of 8: 94,966 / 147,021 / 1,476 / 75,822 / 144 / 1,062 / 41,326 / 51,082 |
| Windows, before the size model | 149.0.7827.55 | CI run [37496691054](https://github.com/Z003Y89/pretext-kit/actions/runs/37496691054) (PR #7 at a383360) | 472 | 12,380 | not read (the log prints totals, not which are the mutant's own) |
| macOS | — | not run | — | — | — |

Mutant counts are each mutant's own check-mismatches, in the order of the mutant table above (ignore reserve, treat zoom as
textScale, ignore textTransform, lines off by one, skip the last collapse stage, tabular ignored, ignore
`overflowWrap`, ignore `nearMiss`); the controls had 0 check-mismatch. Linux on Chromium 149 in CI gave the same
tallies as the container's Chromium 141, every total and mutant count equal; Windows differs from both.

The first Windows run's 472 check-mismatches (404 verdict, 68 near-miss) were all under text scale (with or without
zoom), all in `lines` and `truncate: 'end'` (both `overflowWrap` values) except 6 near-miss `as-is`, `shrinkTo` and
`truncate: 'middle'` cases: the
`'windows'` profile then measured a fractional font size at the size asked for, while Chromium on Windows keys the font
by its size in float32 hundredths and scales advances in float32 (README, "Fractional font sizes on Linux and
Windows"), so a width within a few thousandths of a px of the box flipped the line count (checker 3 lines, reference 2).
The model, derived from `npm run verify:fractional` on Windows (1,464 of 1,464 widths exact; 411 before), took them to
0. Pretext-gaps rose by 44 (12,380 to 12,424), all in groups that held the mismatches (`lines` and `truncate: 'end'`
under text scale + zoom: 36 verdict and 8 near-miss cases), consistent with those cases now being judged and some of
them disagreeing with the DOM, as on Linux.

Why Windows has 2,169 more pretext-gaps than Linux (12,424 against 10,255; 2,043 verdict and 126 near-miss), from the
Windows log's gap table by policy and condition kind against CHECK_RESULTS.md's: with neither text scale nor zoom
every group has the same count on both (926 verdict and 372 near-miss cases). The difference is all under text scale
or zoom: text scale alone +96, zoom alone +330, both +1,743. By policy: `lines (normal)` and `truncate: 'end'
(normal)` +975 each (the largest group, text scale + zoom, 1,423 against 572), `lines` and `truncate: 'end'` +442 each,
`as-is` and `truncate: 'middle'` −28 each, `shrinkTo` −586 (text scale + zoom: 301 against 835) and rows −23. The
platforms differ in the DOM side as well as in the stand-in (Chromium's own text stack, DirectWrite against FreeType),
and the Windows log prints groups, not causes; which causes make up the difference was not analysed (the Windows
`check-cases.md` in the CI artifact `check-results-windows-latest` lists every case).

## 4. Sensitivity (mutation testing)

`node verify/mutants.ts` plants each bug below, one at a time, in `src/` of a throwaway detached worktree of HEAD
(this checkout's `src` is never edited; the worktree is removed at the end), and runs `npm test` and a reduced sweep:
Chromium at factor 1, the affected helpers only (`node verify/run.ts --only=chromium --factors=1 --helpers=…`, which
writes no RESULTS.md and never touches the baseline). An unmutated control run comes first and must have no
kit-mismatch. Its output, run at 79908ea, is committed as `verify/results/mutants.txt`; the control gave every
helper's tally as in RESULTS.md and `npm test` passing. The rows from 79908ea predate the four labels added below and the
truncateMiddle fix (5d108be), so their truncateMiddle counts are over 56,496 cases of the earlier code, not 61,632.

| planted bug | helper swept | cases | kit-mismatch (caught) | pass | npm test |
|---|---|---:|---:|---:|---|
| shrinkwrap +1px | shrinkwrap | 161616 | 150273 | 10744 | fails (5 failing) |
| balance returns shrinkwrap | balance | 161616 | 120948 | 40115 | fails (4 failing) |
| fitFontSize returns px − 1 (min stays min) | fitFontSize | 161616 | 161581 | 35 | fails (8 failing) |
| fitFontSizeRich ignores the icon box | fitFontSizeRich | 203944 | 59725 | 144168 | fails (3 failing) |
| clamp without the tail | clamp | 808080 | 158851 | 648730 | fails (6 failing) |
| truncateMiddle ignores keepEnd | truncateMiddle | 56496 | 6688 | 49807 | fails (4 failing) |
| fontFromStyle drops the weight | fontFromStyle | 180 | 4 | 176 | fails (5 failing) |
| FIT_TOLERANCE removed (0 instead of 1/64) (subtle) | shrinkwrap | 161616 | 54 | 156521 | fails (2 failing) |
| FIT_TOLERANCE removed (0 instead of 1/64) (subtle) | balance | 161616 | 0 (not caught here) | 156946 | fails (2 failing) |
| FIT_TOLERANCE removed (0 instead of 1/64) (subtle) | fitFontSize | 161616 | 0 (not caught here) | 161312 | fails (2 failing) |
| FIT_TOLERANCE removed (0 instead of 1/64) (subtle) | clamp | 808080 | 267 | 807241 | fails (2 failing) |
| FIT_TOLERANCE removed (0 instead of 1/64) (subtle) | truncateMiddle | 56496 | 74 | 56422 | fails (2 failing) |
| cuts at code points, not grapheme clusters (subtle), rerun at 5dee1bf | clamp | 808080 | 43 | 807460 | fails (1 failing) |
| cuts at code points, not grapheme clusters (subtle), rerun at 5dee1bf | truncateMiddle | 61632 | 128 | 61501 | fails (1 failing) |
| fontFromStyle drops italic (subtle) | fontFromStyle | 180 | 4 | 176 | fails (2 failing) |
| fontFromStyle drops letter spacing (subtle) | fontFromStyle | 180 | 4 | 176 | fails (3 failing) |

The first seven are gross bugs; every one is caught by the sweep and by `npm test`, fontFromStyle's only by its 4
weight-700 cases. Their other cases are pretext-gaps, or pass where the bug changes nothing the checks see (for
instance a +1px width capped at W, a one-line text whose balance is its shrinkwrap, an answer already at the minimum
size); they were not analysed case by case.

The four marked subtle change an answer by at most 1/64 px or one code point. Each is caught somewhere, but not
everywhere, and the zeros are findings:

- **The fit tolerance set to 0** is caught by shrinkwrap (54 cases), clamp (267) and truncateMiddle (74), and by
  `npm test`, but by **no balance or fitFontSize case**: at the sweep's inputs no answer of theirs turns on a line
  within 1/64 px of the width, so for those two helpers the sweep cannot tell 0 from 1/64.
- **Cutting at code points instead of grapheme clusters** was at first caught only by clamp (43 cases, emoji
  sequences in the chat corpus): **not by truncateMiddle (0 of 56,496) and not by `npm test`**. The harness never
  checked where truncateMiddle's cuts fall, and only one label (a 🏖️ path) had a multi-code-point grapheme. Since a
  split emoji or accent is visible, this was closed: a unit test cuts labels with ZWJ families, flags, skin tones,
  decomposed accents and Hangul jamo at many widths and checks both cuts against `Intl.Segmenter`
  (`test/middle.test.ts`); the sweep checks both cuts against its own `Intl.Segmenter` (a cut inside a grapheme is a
  kit-mismatch); and four such labels joined the path corpus (`verify/corpora.ts`). Rerun at 5dee1bf, the mutant is
  caught by 128 truncateMiddle cases and the new unit test (the same at b96cf7f, after the fix below); the rows above are that run's
  (`verify/results/mutants.txt` notes the replaced ones). The full sweep was rerun with the four labels (§3).
- **The new labels found a kit bug.** In WebKit 26.5 the Hangul jamo label in Georgia and Times New Roman at
  80-84px (18 cases over the three factors) came back as `한….txt`, 84.30 and 84.84px wide by Pretext's own
  measure: the end was measured alone, and joined to a start already down to its one grapheme and the ellipsis it
  overran. truncateMiddle now shortens the end until the result fits (a regression test reproduces it with the
  stand-in's kerning font); every truncateMiddle case then passed in all three browsers, and §3 is the full sweep
  rerun with the fix.
- **fontFromStyle dropping italic, or letter spacing**, is caught by the variant cases (4 each), and only by them.

**One mutant escaped the sweep, and that was a defect.** A first round of the gross mutants, against the harness as
it stood at 35f3e2e (a throwaway branch `mutants-tmp` in a separate worktree, since deleted), gave the same counts as
above for the other six. But with fontFromStyle cases at weight 400, normal style and no letter spacing only,
dropping the weight from `fontFromStyle`'s font string changed nothing
the sweep could see: Canvas serialises weight 400 away, so `"16px Georgia"` and `"400 16px Georgia"` compare equal,
and every painted case used weight 400. Only `npm test` (5 failing tests) caught it. The sweep now also runs, per
stack, weight 700, italic and 0.5px letter spacing at 16px/24px (`verify/sweep.ts`, `STYLE_VARIANTS`; 180 cases per
browser × factor instead of 168), which catches it in 4 cases, one per stack (the weight-700 case). The run in §3 is
the full sweep rerun with those cases; every other count in it, and the listing of all 34,909 non-pass cases
(`verify/results/latest.json.gz`, byte for byte), came out as in the run before. The other helpers' painted cases
still use weight 400 only.

The headless sweep plants its own mutants on every run (`verify/headless.ts`, HEADLESS_RESULTS.md, "Mutants"):

| planted bug (src/headless/canvas.ts) | width cases > 0.02px | line-count headless-mismatch | caught |
|---|---:|---:|---|
| drop kerning (`kern` off always) | 4332 | 2283 | yes |
| ignore weight (always the 400 face) | 848 | 2988 | yes |
| round variable-font advances (HarfBuzz's own, HVAR delta rounded to whole units; on macOS) | 232 | 11 | yes |
| drop the U+0020 word cut | 192 | 0 | yes (widths only) |

(0.1.2 counts, with Inter Variable in the sweep. "Ignore weight" picks the face, not the instance, so the variable
face is unaffected by it. "Round variable-font advances", added in 0.1.2, undoes 0.1.2's fix (no sub font with the
unrounded advances) and gives back exactly the pre-fix numbers, 232 widths beyond 0.02px and 11 line-count
headless-mismatches, so the sweep checks 0.1.2's main change on every run; the pinned Chromium widths in
test/headless/variable.test.ts guard it in `npm test` as well. On Linux and Windows, where `platform` makes the
stand-in round, the sweep plants the inverse, "unround variable-font advances" (`const unrounded = true`, macOS's
advances forced); CI run 37412616029 caught it on both, 232 widths and 11 headless-mismatches.)

Dropping the U+0020 word cut cannot change a Pretext line count (Pretext never hands Canvas a space beside other
text: 0 of 2,254 measured strings), so only the width sweep sees it (Ruling H-8 in the headless ledger).

What the mutants do not show: that the sweep would catch a bug confined to inputs it never runs (other fonts,
weights in the painted helpers, scripts beyond the corpora, `white-space: pre-wrap`, rich rows other than icon +
label), or bugs in the rich twins, `watchFonts` or the list helpers, which no browser case exercises.

## 5. Cost

From `verify/BENCH.md` (`npm run bench`, `verify/bench-run.ts`, `verify/bench.ts`), merged into kit-v1 at 79908ea;
it was rendered at 1225678 from the same measurements as the reviewed e55f319 (the numbers are identical). BENCH.md
records its run as of c7db50a "with uncommitted changes". Machine: Apple M2, 8 cores, 16 GB, macOS 14.6.1; browser
builds as in §2.

**It was measured on a loaded machine, so every timing is an upper bound.** Screen recording (replayd, 79-93% CPU)
and a UI-automation service ran throughout, other agents' sessions were active (their Playwright browsers were
waited out: none ran during measurement, polled every 10 s), and the 1-minute load average was 3.0-4.1 on 8 cores.
The browser under test was frontmost at only 8 of 22 polls (Chromium), 0 of 32 (WebKit) and 14 of 26 (Firefox), so
OS background throttling cannot be ruled out. Firefox ran at devicePixelRatio 2, Chromium and WebKit at 1: Firefox's
DOM rows, and so both Firefox comparisons below where the kit loses, were measured against DOM layout at a ratio of 2,
and DOM rows should not be compared across browsers. The user could not provide a quiet window (Ruling 34). A
quiet-machine rerun at one pinned ratio is the remedy (§6).

Median of sample means (p95 in brackets), µs; each browser 3 sessions × 20 rounds = 60 samples:

| per message, unless noted | Chromium 149 | WebKit 26.5 | Firefox 151 |
|---|---:|---:|---:|
| `layout()` at 399 (Pretext, the resize floor) | 0.233 (0.239) | 0.217 (0.237) | 0.466 (0.503) |
| `shrinkwrap` at 399 | 0.243 (0.258) | 0.257 (0.273) | 0.584 (0.661) |
| `balance` at 399 | 4.22 (4.42) | 4.15 (4.51) | 9.40 (9.84) |
| `clamp(…, 3)` at a new width | 9.16 (9.95) | 11.3 (12.3) | 21.9 (28.8) |
| `truncateMiddle`, new width near 200, per label | 26.6 (30.9) | 30.0 (35.0) | 60.8 (78.2) |
| `prepareLabel`, per label | 297 (316) | 268 (377) | 107 (142) |
| `fitFontSize`, second call on a resize (warm `PreparedSizes`) | 3.43 (3.66) | 3.32 (3.57) | 6.62 (8.60) |
| DOM: same fit, warm-started search on a resize | 55.9 (61.4) | 148 (155) | 44.9 (48.4) |
| `fitFontSize`, new `PreparedSizes`, Pretext caches warm | 82.9 (87.3) | 80.5 (84.4) | 144 (160) |
| `fitFontSize`, new `PreparedSizes`, Pretext caches cleared | 124 (141) | 318 (334) | 278 (295) |
| DOM: fit search from scratch, all boxes in lockstep | 211 (232) | 464 (486) | 164 (173) |
| Pretext prepare + layout, first sight (caches cleared) | 14.8 | 26.4 | 29.1 |
| DOM: create, append and read new message divs | 29.6 (32.0) | 72.3 (77.1) | 20.0 (21.4) |
| `stack` over 10,000 heights, per call | 12.6-78.2 (sessions disagree) | 11.0 (11.2) | 10.5 (10.8) |

**Where the kit loses.**

- **Firefox, first sight** (DOM at devicePixelRatio 2): Pretext's prepare + layout of 1,000 new messages costs
  29.1 µs each against the DOM's 20.0 µs (1.5× slower). In a freshly launched Firefox the kit's first batch prepared
  at 74.9-98.4 µs per message (plus 5.1-5.3 µs layout), against 47.2-53.7 µs for the DOM's first pass in its own
  fresh browser (BENCH.md, "First pass in a fresh browser", one value per session).
- **Chromium, first pass in a fresh browser**: the kit's first prepare + layout costs 49.4-56.5 µs per message over
  the three sessions (prepare 46.6-53.1 plus layout 2.8-3.4), against 43.0-45.5 µs for the DOM's first pass. Only
  once the browser is warm does the kit win (14.8 against 29.6 µs). WebKit's fresh-browser kit pass (69.2-80.4 µs)
  beat its DOM's (78.1-103 µs) in two of three sessions.
- **Firefox, fitFontSize with Pretext's caches cleared** (DOM at devicePixelRatio 2): 278 µs against the DOM
  lockstep search's 164 µs (1.7× slower);
  with warm caches the kit is only 1.1× faster (144 against 164).
- **`prepareLabel`** costs 107-297 µs per label (it lays the label out at width 0 to find every cut point), the
  costliest call in Chromium; a list of 1,000 paths pays it per path once.
- **balance** is a binary search: about 18-20× a `layout()`; clamp and truncateMiddle prepare cut candidates at resize
  time (1.3-6.7 prepares per call, BENCH.md "Structural counts").
- **Chromium `stack`** had one session at 78 µs and two at 13 µs per 10,000 heights; the cause was not established.

Where the DOM row is faster, the kit's case is answering without the elements existing (virtual lists, workers,
before paint), not speed. The kit and the DOM baselines agreed on every height and fitted size in the bench workload
(1000/1000 in each browser; BENCH.md, "Kit and DOM agreement").

## 6. Threats to validity

| threat | effect on the results | what would reduce it |
|---|---|---|
| **One OS, one machine.** macOS 14.6.1 on an Apple M2; Core Text shaping and rasterisation only. | No claim for Windows (DirectWrite), Linux (FreeType, hinting), Android or iOS. | The same sweep on Windows and Linux runners; Pretext's own accuracy pages show those engines differ. Since 0.1.1, CI runs the headless parity sweep (not the browser sweep) on `ubuntu-latest` and `windows-latest`; its first run ([37407438278](https://github.com/Z003Y89/pretext-kit/actions/runs/37407438278)) agreed with macOS on both (§7). The browser sweep remains macOS only. |
| **Playwright builds, not shipped browsers.** Chromium 149 and Firefox 151 trail stable; WebKit 26.5 is a frozen macOS 14 build, not Safari 27 (Playwright 1.62+ cannot drive it here; Ruling 13). | Engine changes since (Safari 27's 1/64 px line boxes, for one) are untested. Electron's and WebView2's Chromium builds were not checked. | Rerun on current stable browsers on a current macOS with a newer Playwright; add Electron. |
| **System fonts only.** Four named macOS stacks at weight 400 (plus fontFromStyle's variants); no web fonts, no `font-feature-settings`. | Web fonts (the common case in apps) change metrics, loading and fallback; bold or variable fonts in the painted helpers are untested. | Sweep with `@font-face` web fonts, bold and a variable font; headless parity already uses web-font files, in Chromium only. |
| **Stand-in corpora.** 84 sweep texts (plus 24 paths and 5 labels) written or chosen for coverage, not drawn from apps. | The clustered bound assumes app text resembles these; it may not (long tables, code, mixed scripts beyond en/ar). | Corpora sampled from real app strings, with consent; more scripts (Thai, Devanagari, Hebrew, Korean). |
| **Clustered cases.** Millions of cases come from 48-84 texts (192-336 text × font pairs) per helper. | Per-case bounds overstate confidence; even the text × font bound assumes pairs are independent. | Quote the text-unit bound (§3); add texts rather than widths. |
| **A sub-pixel bug the sweep misses in two helpers.** A fit tolerance of 0 instead of 1/64 px is caught by no balance or fitFontSize case (§4). (Cuts inside grapheme clusters, which also escaped truncateMiddle's sweep and every unit test, are now checked.) | An error in balance or fitFontSize at a line within 1/64 px of the width could pass the sweep; it changes an answer by at most a pixel at such edges. | Texts whose lines end within 1/64 px of the width. Grapheme coverage is still Latin, emoji, decomposed accents and Hangul; Indic and Thai clusters are untested. |
| **Common-mode error.** The kit and the harness share definitions from the spec, such as the 1/64 px fit tolerance and "fits" meaning no unbreakable piece wider than the box. The harness pins its own copy of 1/64 and computes from Pretext, never from the kit, and a review checked the judge for circularity (Task 6, fix round 2: independent), but a wrong shared definition would make both agree. | A definitional error common to both is invisible to the sweep. | Judge a sample against pixels or against the browser's own APIs where they exist (`text-wrap: balance`, `-webkit-line-clamp`'s ellipsis). |
| **One language setting.** Every page ran with `<html lang="en">`. | Language-dependent line breaking (CJK punctuation rules, hyphenation dictionaries, Thai) under other `lang` values is untested. | Sweep CJK and German texts under their own `lang`. |
| **The oracle is the DOM, not pixels.** Lines and widths are read from layout boxes and ranges; no pixel comparison. clamp's cut is compared with a span painted on its own, not with the browser's own ellipsis (the SVG probe in Pretext's RESEARCH.md was not used). | A cut that differs from where the browser would put its ellipsis is not detected; a painting that differs from layout boxes is not detected. | Run the SVG ellipsis probe for clamp; pixel diffs for a sample. |
| **pretext-gaps are attributed, not root-caused.** 21,978 cases (0.31%) are put down to Pretext because Pretext's own count disagrees with the browser; the Chromium pool (about 3% of shrinkwrap and balance cases: CJK in Georgia, Arabic, long URLs) and the headless Shantell Sans cluster were not investigated. | A kit bug that also moves Pretext's count could hide here, bounded by the baseline gate (max(5, 5%) per cell). The kit cannot be judged in those cases at all. | Root-cause the large clusters with Pretext's own harness; file what is new upstream. |
| **Logic tests run on a stand-in Canvas** (fixed per-character widths, `test/setup.ts`). | `npm test` checks the algorithms, not real metrics; C9 and C10 rest on it alone. | Browser cases for the rich twins and `watchFonts` (a real `FontFaceSet` with a late web font). |
| **Zoom is emulated.** deviceScaleFactor 1.25 and 2 via Playwright, at a 4px width step. | Real page zoom also changes CSS px per device pixel through the layout viewport; a zoom-only bug at a width not divisible by 4 would be missed. | A step-1 run at every factor (about 28 minutes); a real browser-zoom run. |
| **The bench ran on a loaded machine**, of a commit with uncommitted changes, with the browser rarely frontmost, and Firefox at devicePixelRatio 2. | Timings are upper bounds; ratios within one browser are more trustworthy than absolute values; Firefox's kit-versus-DOM ratios compare against DOM layout at ratio 2. | `npm run bench` on a quiet machine at one pinned ratio, the browser frontmost (quit apps, stop screen recording, leave it about 15 minutes). |
| **Headless scope.** Chromium's rules, registered fonts, one Chromium build (149) on macOS, Linux and Windows, variable fonts only for Inter Variable's `wght` axis, on macOS (§8); on Linux and Windows Chromium measured equal to HarfBuzz's rounding (CI run 37410732972), which `install({ platform: 'linux' \| 'windows' })` uses, confirmed by CI run 37412616029 (Inter Variable bit-exact on both). Fractional sizes: modelled for `'linux'` and `'windows'`, first use of a size in a page only, not for `'macos'` (§3, §8). | Nothing is claimed for WebKit or Gecko profiles, OS fallback fonts, variable fonts beyond that (other axes, other fonts; variable fonts at fractional sizes on Windows), fractional sizes on macOS, or other Chromium builds. | One measured check each on Windows and Linux Chrome before claiming them (the spec requires it). One independent Linux run on Chromium 141 agreed (§3, independently reported, raw data not in the repo). Since 0.1.1 CI makes that check on every push: the `parity` job (headed Chromium 149, Node 24; xvfb on Linux) uploads HEADLESS_RESULTS.md as `headless-results-ubuntu-latest` and `headless-results-windows-latest`, and a headless-mismatch there is recorded rather than failing CI. First run ([37407438278](https://github.com/Z003Y89/pretext-kit/actions/runs/37407438278)): Linux 3,720/4,992 widths bit-exact, max 0.001862px, 0 headless-mismatch, 178 pretext-gap; Windows 3,842/4,992, max 0.000427px, 0 headless-mismatch, 179 pretext-gap (§7). |
| **Label checker: Linux and Windows only.** `verify:check` ran on a Linux container (Chromium 141.0.7390.37, Node 22.22.0; the committed CHECK_RESULTS.md) and in CI on `ubuntu-latest` and `windows-latest` (Chromium 149.0.7827.55; run [37493529824](https://github.com/Z003Y89/pretext-kit/actions/runs/37493529824) for Linux, [37500166670](https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670) for Windows), each under its own platform's profile; not on the maintainer's Mac. | Nothing is claimed for the checker's `'macos'` profile beyond the headless parity evidence (C8). Windows: 0 check-mismatch, 12,424 pretext-gap (§3, per platform). | `npm run verify:check` (and `npm run verify:fractional`) on a Mac. |
| **Label checker: fonts.** Inter Regular for every sweep case; one language setting (`lang` = the label's locale on the slot, `en` on the page). | Other fonts, weights, variable fonts' `opsz` and web-font loading are untested by the checker's own sweep. `opsz` on the `'linux'` profile takes the stand-in's hundredths size and is unmeasured against Chromium. | Add fonts and a variable font to `verify:check`; measure `opsz` on Linux. |
| **Label checker: the fractional-size models.** The stand-in measures a fractional size by Chromium on Linux's rule (float32 hundredths, advances truncated to 1/64 px), derived on Chromium 141, and by Chromium on Windows's (float32 hundredths, advances scaled in float32 and truncated to 1/65536 px), fitted to 1,464 widths measured with Chromium 149 (static Inter, upem 2048; the kerning part rests on one string, and the advance formula is pinned only for power-of-two upem). Chromium on Linux reuses glyph metrics of a nearby fractional size measured earlier in the same page, in either direction; the stand-in does not model that, and on Windows it is unmeasured. `'macos'` measures at the size asked for, with no data. | Exact for the first use of a size in a page; on Linux a page with two fractional sizes a few hundredths of a px apart can differ by one 1/64 px advance step. The sweep's sizes avoid shared entries, which was checked, so the sweep cannot see it. Fonts with another upem, variable fonts at fractional sizes on Windows and `opsz` are unmeasured. | Model Chromium's metric cache; sweep pages with nearby fractional sizes; `verify:fractional` with more fonts and on a Mac. |
| **Label checker: gaps at the exact boundary box.** 5,027 of 7,292 pretext-gaps involve soft-hyphenated text, of which 2,445 are nowrap-width cases (Chromium's text wider than Pretext's natural width: 0.125 to 0.828px for as-is at text 100% · zoom 100%, up to 1.23 zoomed px over all conditions) and 2,582 are line-break cases (lines, truncate end, with either `overflowWrap`); the other 2,265 have no soft hyphen (e.g. English "Just tried": DOM 3 lines, Pretext 2), and 6,300 of the 7,292 sit at the exact boundary box and 908 at an `overflowWrap: 'normal'` word's own width, all under zoom 130%; all recomputed from verify/dist/check-cases.md (§3). | At a box exactly as wide as the measured width the checker can pass a label that overflows in the DOM, by up to about 1px; the sweep tests that exact boundary, so it records the gap, but a real app's boxes are rarely exactly there. | The upstream soft-hyphen report (§8); a tolerance option. |
| **Label checker: `overflowWrap: 'normal'` approximations and zoomed layout.** Words are Pretext's segments: a boundary between two text segments counts as a break opportunity, and Pretext's internal no-break flag for the rare one that is not (around zero-width glue and controls) is not read; `hyphens: auto` and `word-break: keep-all` are not modelled, and `anywhere`/`break-all` map to `'break-word'`. The sweep's 908 "(normal)" gaps at the word's own width are all under zoom 130%: Chromium lays out text 130% · zoom 130% (20.8px × 1.3) like an unzoomed 27.02 to 27.03px, not 27.04px, which the Linux fractional-size model does not cover, and the rest is consistent with snapping zoomed slot, icon and text widths to its 1/64 px layout grid (confirmed for box widths only: DOM box less box −0.0156 to +0.0094 zoomed px). With one word in the 1/64 px window every line of that text is laid out at the box plus 1/64 px: a line within 1/64 px of the box can pass where Chromium, whose width is 1/64 px wider than Pretext's, wraps it (a probe: 48 of 3,000 adversarial `lines: 2` cases at 20.8px, 0 at 16px). | A label whose words Chromium hyphenates (`hyphens: auto`) or joins across a no-break boundary can get the wrong verdict; under zoom a word within about 1/32 px of the box can go either way; under `'normal'` a line within 1/64 px of the box can pass and wrap in Chromium. | Read Pretext's break flags through a public API; model `hyphens: auto` and zoomed font sizes. |
| **Label checker: near-miss slack.** The slack `nearMiss` is compared with is Pretext's: a word broken across lines (or at a soft hyphen) is measured as the sum of its pieces and a hyphen-minus compound as its halves, losing kerning and ligatures across them (up to about 1.6 px at 16px in plain text, 2.1 px for "Nebenrollen-Takes" at text 130% · zoom 130%); soft-hyphen widths and zoomed sizes add their own gaps. For `lines` and `truncate: 'end'` the slack means how far the box can shrink before the greedy layout changes, not before the label fails. The sweep's boxes sit 1/4 px from the margin, so the DOM comparison cannot resolve a systematic slack error under 1/4 px (CHECK_RESULTS.md, "Resolution", gives the measured spread). | 1,565 of 98,172 near-miss cases fall on the other side of the 2 px margin in Chromium (§3); in plain text the broken-word and compound gaps make Pretext's slack smaller, so labels are flagged sooner; at a soft hyphen the sign is mixed (−0.77 to +0.91 px), so a label can be flagged later; and a `lines` label that would wrap again and still fit is flagged. | Measure a line's pieces as a whole in Pretext (kerning across a mid-word break); boxes nearer the margin in the sweep. |
| **Label checker: ICU not expanded, `shrinkTo` oracle whole-pixel.** `plural` and `select` messages are a warning, not checked; the sweep's shrinkTo oracle checks that the chosen size fits and the next candidate up (a whole pixel, or the slot size) does not. | Sizes between two whole pixels are not a claim the checker makes; ICU variants are not measured. | Expand ICU variants; a finer `fitFontSize`. |
| **One-off probes.** The `box-decoration-break: slice` probe for fitFontSizeRich (RESULTS.md, "Painting") ran once and its "168 + 1 err small" figure cannot be recomputed from stored data. | Its numbers are anecdotal. | Make it a flagged sweep mode whose output is stored. |
| **Run-to-run determinism** is shown by repeats, not argued: the full three-browser sweep, rerun in this evaluation, reproduced every count and the non-pass listing byte for byte (§4); a reviewer reproduced the headless sweep byte for byte; §7's fresh clone reproduced Chromium at factor 1. All repeats were on this one machine. | A case that flips between runs, or between machines, would not have shown. | Rerun from a fresh clone on another Mac and diff RESULTS.md and the listing. |

## 7. Reproduction

```sh
verify/reproduce.sh                        # everything: about 25 minutes with the browsers cached (before the label checker's step, which took 207 s of Chromium and 197 s of checker runs on the machine in CHECK_RESULTS.md)
verify/reproduce.sh --sweep=chromium@1     # the browser sweep in Chromium at factor 1 only: about 3 minutes
```

It clones this repository at its HEAD (or `--kit-repo`, `--kit-commit`) and Pretext at f10d888 side by side into a new
temporary directory (or `--dir`), builds Pretext with its pinned TypeScript (`npx -p typescript@6.0.2 tsc -p
tsconfig.build.json`, which is what its
`build:package` runs), runs
`npm ci` and `npx playwright install chromium webkit firefox` (Playwright 1.61.0's pinned builds), then `npm test`,
`npm run check`, the browser sweep, `node verify/stats.ts --compare-log=…` (each browser × factor × helper tally it
ran against RESULTS.md) and `npm run verify:headless`, and prints the tallies. It needs macOS 14 (the sweep's pinned
fonts are macOS fonts), Node 24 and network access. The comparison reads the committed RESULTS.md
(`git show HEAD:verify/RESULTS.md`, saved before the sweep), since a full sweep rewrites the working copy. Expected:
every step passes; every compared tally equals the committed RESULTS.md; `widths: 7344 cases, 6126 exact`,
`lines: 141226 cases, 0 headless-mismatch, 288 pretext-gap` (0.1.1, without Inter Variable: `widths: 4992 cases,
3842 exact`, `lines: 71818 cases, 0 headless-mismatch, 176 pretext-gap`); all four headless mutants caught (three
in 0.1.1). After a full run,
`git diff` in the clone should show in RESULTS.md only timings and the run date, and in HEADLESS_RESULTS.md the date
and Pretext's abbreviated hash, whose length git chooses per repository (the recorded run below showed exactly that
hash difference). Not checked by a full run: that claim, since only the Chromium factor-1 mode was run from a fresh
clone; the in-place full rerun in §4 changed nothing in RESULTS.md beyond timings and what this evaluation's harness
changes changed (the fontFromStyle cases and the overflow sentences).

**Label checker sweep (C11).** `npm run verify:check` (`verify/check-labels.ts`; `verify/reproduce.sh` runs it after the
headless sweep) renders the cases in headed Chromium and runs the checker against the same data; `PW_CHROMIUM=<path>`
picks the Chromium executable (the recorded run used `/opt/pw-browsers/chromium`, Chromium 141.0.7390.37), and on Linux
without a display run it as `xvfb-run -a npm run verify:check`. It writes `verify/CHECK_RESULTS.md` (committed summary), the full
per-case listing `verify/dist/check-cases.md` and `verify/dist/check-results.json.gz` (neither committed; CI uploads
`check-cases.md` with `CHECK_RESULTS.md` and `check-run.log` as `check-results-<os>`), and exits non-zero on any
check-mismatch or uncaught mutant. Expected, on the recorded environment: `473736 cases: 0 check-mismatch, 10255 pretext-gap,
0 excluded, 463481 pass` (verdict cases 375,564 with 7,292 pretext-gap, near-miss family 98,172 with 2,963), eight mutants caught (93,562 / 148,617 / 1,634 / 76,753 / 144 / 1,041 / 39,898 / 51,083 check-mismatches); the run took
Chromium 207 s and the checker runs 197 s. On another OS, platform or Chromium the tallies differ and that is the measurement (§6);
CI records the Linux and Windows runs (§3, per platform); a macOS run has not been recorded. The unit tests are `npm run test:check`.

**Continuous integration** (`.github/workflows/ci.yml`, since 0.1.1) lays the two repositories out the same way and
builds Pretext the same way on every push and pull request. It runs `npm test` and `npm run check` on Linux, Windows
and macOS under Node 22 and 24 (these must pass); the headless parity sweep, headed, on Linux (under xvfb) and
Windows under Node 24, uploading each HEADLESS_RESULTS.md as an artifact without failing on a headless-mismatch,
since off macOS that is what is being measured; and `verify/consumer-smoke.mjs` against freshly packed release
tarballs on Linux under Node 22 and 24. In the same `parity` job it runs `npm run verify:check` (the label checker's sweep, C11), headed, on Linux under xvfb and on Windows, uploading `check-results-<os>` without failing on a check-mismatch. It does not run the browser sweep, whose pinned fonts are macOS fonts.
Node 22 was also checked locally before the 0.1.1 change to `engines`: Node 22.23.3 on the Mac above passed `npm
test` (90 + 70 tests) and the consumer smoke test.

CI run [37407438278](https://github.com/Z003Y89/pretext-kit/actions/runs/37407438278) (PR #1, all 10 jobs green), artifacts `headless-results-ubuntu-latest` and `headless-results-windows-latest`, each a HEADLESS_RESULTS.md written in CI by headed Chromium 149.0.7827.55 (Playwright 1.61.0) under Node v24.21.0: **Linux** (Linux 6.17.0-1022-azure, x64, xvfb): widths 4,992 cases, 3,720 bit-exact, max |Δ| 0.001862px, 0 beyond 0.02px (Inter, Inter WOFF2 and Roboto all bit-exact; Shantell Sans max 0.001862px); line counts 71,818 cases, 0 headless-mismatch, 178 pretext-gap, 0 unreliable. **Windows** (10.0.26100, x64): widths 4,992 cases, 3,842 bit-exact, max |Δ| 0.000427px, 0 beyond 0.02px (Inter, Inter WOFF2 and Roboto bit-exact); line counts 71,818 cases, 0 headless-mismatch, 179 pretext-gap, 0 unreliable. So neither platform needs `rounding: 'whole-px'` with Chromium 149, and headless parity is claimed for macOS, Linux and Windows Chromium 149. That run is 0.1.1's sweep, before Inter Variable was added. CI run [37410732972](https://github.com/Z003Y89/pretext-kit/actions/runs/37410732972) ran 0.1.2's sweep with Inter Variable: on both Linux and Windows the unrounded stand-in was off by exactly the pre-fix macOS numbers (232 widths beyond 0.02px, max 0.055115px, 11 headless-mismatches; default instance exact), i.e. Chromium there equals HarfBuzz's whole-unit rounding (§3). Hence `install({ platform })`; the option's own CI confirmation on Linux and Windows: pending.

**The one run made for this evaluation** used `--sweep=chromium@1` to bound its time, so it confirms the Chromium
factor-1 tallies, not WebKit's, Firefox's or the zoomed ones:

Run 2026-10-06 on the same Mac (macOS 14.6.1, Node 24.4.1, npm 11.4.2, Playwright's browsers already cached), into
a new directory under the session's scratch space: `verify/reproduce.sh --kit-commit=4f43610 --sweep=chromium@1`,
169 s wall time. Its output is committed as `verify/results/reproduce-chromium1.txt` (paths shortened to `<dir>`
and `<kit-repo>`; the per-step logs stayed in the scratch directory). Earlier runs at 9f4525d and 1d60eb6, before
the four new path labels, gave the same results with the earlier truncateMiddle count. Every step passed:

- `npm test`: 85 + 65 tests, 0 failing; `npm run check` clean.
- The Chromium factor-1 sweep: 7 of 7 helper tallies equal RESULTS.md (for example clamp 808080 cases: 807503 pass,
  577 pretext-gap, 0 kit-mismatch; truncateMiddle 61632 cases: 61629 pass, 3 pretext-gap, 0 kit-mismatch).
- `npm run verify:headless`: `widths: 4992 cases, 3842 exact, max 0.000427px, 0 misses`;
  `lines: 71818 cases, 0 headless-mismatch, 176 pretext-gap, 0 unreliable`; the three mutants caught with the
  counts in §4. The HEADLESS_RESULTS.md it wrote differs from the committed one in one character: Pretext's
  abbreviated commit hash (`f10d888c` for `f10d888`, git's abbreviation length in a fresh clone).

The first attempt, at 554f857, failed at its first build step: Pretext's `npm install` no longer resolves (its dev
dependencies float without a lockfile, and an oxlint release now conflicts with a pinned peer), which also broke the
README's install line. Both now run Pretext's pinned `tsc` directly (9f4525d); the dist it builds is identical, file
for file, to the one the recorded runs used. Not reproduced from a fresh clone: WebKit, Firefox, the zoom factors,
and any other machine.

## 8. Known limitations

What a user of the kit should know, in order of how likely it is to matter.

- **Browser sweep on macOS only.** Everything above except headless parity was measured on macOS 14. Windows and Linux text stacks were not tested
  by the browser sweep; expect Pretext's own per-platform accuracy there, not more. Headless parity on Linux and
  Windows is measured by CI since 0.1.1 (§6, §7): 0 headless-mismatch on either, widths within 0.002px (§7).
- **Soft-hyphenated text can overflow in Chromium and Firefox.** Where Pretext places a soft-hyphen break differently
  from the browser, a fitted size can paint an extra line. In the sweep: fitFontSize 23 cases paint an extra line at
  its answer, 19 of them past the 96px box (Kapitän, Synchroniser, Responsabilité in Helvetica Neue/Arial);
  fitFontSizeRich 66, all past their box (also Nebenrollen in Georgia/Times, Anticonstitutionnalité in Arial). WebKit
  showed none. The cause is Pretext's soft-hyphen line placement, partly known upstream (ENGINE_FOLLOWUPS, "Line
  edges") and partly possibly new; a report is prepared for the maintainer at
  `docs/upstream/pretext-soft-hyphen-issue-draft.md` (not committed, not yet filed). No workaround was tested; the
  README's advice to hyphenate only words wider than the box reduces how much text carries soft hyphens.
- **Safari 26 and fractional line heights.** WebKit 26 paints `line-height: 16.5px` as 16px lines, so with fractional
  line heights fitFontSize can answer one size smaller than the largest that fits (12,931 sweep cases, all safe: never
an overflow). Use whole-pixel line heights. Safari 27 is reported fixed by Pretext's PLATFORM_BUGS.md, not tested
  here.
- **Every Pretext gap is the kit's too.** Where Pretext's line count or widest line differs from the browser (0.31% of
  cases: mostly CJK in Georgia, Arabic and long URLs in Chromium, soft hyphens in Chromium and Firefox), the kit
  answers for Pretext's layout, not the browser's: a width, size or cut that is right for the lines Pretext lays out
and may be off by a line, or a pixel of width, in what the browser paints. RESULTS.md lists them grouped by text and
  pattern.
- **Fonts.** Use named fonts loaded with `@font-face` and awaited; never `system-ui` or `-apple-system` on macOS.
  CJK and emoji come from OS fallback fonts, which the sweep covered only through the four stacks above. Canvas cannot
  express `font-feature-settings` or tabular figures.
- **clamp's cut** is the longest prefix that fits with the tail, measured joined; that it matches where the browser
  itself would cut was not tested.
- **Variable fonts in headless.** Fixed in 0.1.2: 0.1.1's stand-in rounded each glyph's interpolated advance to
  whole font units (HarfBuzz rounds the HVAR delta) where Chromium on macOS keeps the fraction, so a sweep of Inter
  Variable (`@fontsource-variable/inter` 5.3.0, latin subset, wght 100-900) at weights 300-800 found only the default
  instance (400) bit-exact: max |Δ| 0.055px, 232 of 2,352 widths beyond 0.02px, 11 of 69,408 line counts differing.
  The stand-in now computes the unrounded advance (fvar, avar, hmtx, HVAR, with the normalized coordinate as CoreText
  computes it) and sums a run's advances in 1/65536 px as Blink does: max |Δ| 0.000092px, 0 line counts differing
  (§3). Chromium on Linux and Windows instead rounds as HarfBuzz does (CI run 37410732972, §3), so the unrounded
  advances are `install({ platform: 'macos' })`'s, the default; `'linux'` and `'windows'` keep HarfBuzz's (confirmed
  bit-exact by CI run 37412616029). Limits: unrounded advances verified against Chromium for Inter Variable's
  `wght` axis only, on macOS only; the unrounded advances
  are exact against fontTools 4.62.1 for what `npm run verify:hvar` covers (Inter Variable's latin `wght`,
  `opsz`+`wght` and standard files, 326 instances, 50 of them `wght`-only), and nothing committed covers `wdth`. A font with avar version 2,
  without HVAR, or with an HVAR that fails its structural checks keeps HarfBuzz's whole-unit advances (up to ½ font
  unit per glyph off Chrome on macOS away from the default instance); a malformed HVAR never makes `measureText`
  throw.
- **Label checker** (C11): measured on Linux (Chromium 141 and 149) and Windows (Chromium 149, CI), Inter Regular
  only; the macOS run of `verify:check` is pending, so `'macos'` verdicts are unverified. Its verdicts are the kit's on Pretext's layout, so
  every Pretext gap is its too: at a box exactly at the measured width (mostly, not only, soft-hyphenated text) it can pass a label that overflows in the DOM
  by up to about 1px (6,300 of 7,292 pretext-gaps sit at that exact boundary box and 908 at an `overflowWrap: 'normal'` word's own width under zoom 130%; 5,027 involve soft hyphens: 2,445 nowrap-width and 2,582 line-break cases; 2,265 do not, §3). The Linux and Windows fractional-size models are exact for the first use of a size in a page
  only (`'macos'` has none); `opsz` on Linux and Windows is unmeasured; `shrinkTo` tries whole pixels, the exact slot size and its (scaled) minimum; `truncate: 'end'` passes a
  single character (grapheme) wider than the box (`clamp`'s flag; under `overflowWrap: 'normal'` a word wider than the box is reported `truncated`); `overflowWrap` has two values (`anywhere` and `break-all` map to `'break-word'`, `keep-all` and `hyphens: auto` are not modelled, so Chromium may hyphenate a word reported as `overflow`); words are Pretext's segments, and Pretext's internal flag for the rare text-segment boundary that is no break opportunity is not read; the `near-miss` slack is Pretext's, so it carries Pretext's gaps, mostly a broken word's pieces measured without kerning or ligatures between them, which flags labels sooner in plain text but can flag them later at a soft hyphen (1,565 of the 98,172 near-miss cases fall on the other side of the margin in Chromium, §3), and for `lines` and `truncate: 'end'` it measures when the layout would change, not when the label would fail; under `overflowWrap: 'normal'` a line within 1/64 px of the box can pass where Chromium wraps it; ICU plural/select is not expanded; a Node call runs
  alone and wipes fonts registered through `pretext-kit/headless`; no WebKit or Gecko profile and no CSS parsing.
  README "Label checker, Limits" has the same list.
- **Headless** is Chromium's rules with registered fonts, measured on macOS, Linux and Windows with Chromium 149 at whole-pixel sizes (variable fonts per `install({ platform })`, default `'macos'`). On the `'linux'` and `'windows'` profiles a fractional font size is modelled by that platform's Chromium rule (Linux derived on Chromium 141 and confirmed on 149 in CI run [37500166670](https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670); Windows fitted to 1,464 widths on Chromium 149, static Inter, its kerning part resting on one string and its advance formula pinned only for power-of-two upem), exact only for the first use of a size in a page: Chromium on Linux reuses glyph metrics from a nearby fractional size measured earlier in the same page, which the stand-in does not model (unmeasured on Windows); `'macos'` measures at the size asked for, unmeasured; and the committed headless sweep uses whole pixels only: an uncovered code point throws
  `HeadlessCoverageError`; a weight with no registered face measures the nearest one; a `small-caps` font throws.
- **truncateMiddle works on the collapsed text.** `prepareLabel` collapses white space as CSS does, so the result,
  and `keepEnd.from`, refer to `label.text`, not to the string passed in; an index taken from the original string
  is off wherever spaces collapsed.
- **Not browser-tested:** `shrinkwrapRich`, `balanceRich`, `watchFonts`, `stack`, `findIndexAt`, `anchorDelta`.
- **`watchFonts` in a worker**: by default it listens to `document.fonts`, which a worker lacks, so there it does
  nothing unless given the worker's `self.fonts` as its second argument.
- **Very narrow boxes.** clamp and truncateMiddle keep at least one grapheme, so below the width of one grapheme
  plus the ellipsis the result paints past the box.
- **Cost.** In a freshly launched browser the kit's first pass is slower than the DOM's in Chromium (about 49-57
  against 43-46 µs per message) and in Firefox (about 80-104 against 47-54 µs); in Firefox it stays slower for new
  text after warm-up too (29.1 against 20.0 µs, DOM at devicePixelRatio 2). `prepareLabel` costs 0.1-0.3 ms per
  label. Prepare once and reuse; the kit wins on re-layout, not on first sight.

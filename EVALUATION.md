# pretext-kit: evaluation

What is claimed, how it was tested, what the tests found, how sensitive they are, what it costs, and what could make
the results wrong. Every number names the file it comes from and the command that regenerates that file. Dated
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
text that visibly overflow their box in Chromium and Firefox (§8). Everything was measured on macOS 14 only.

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
| C6 | `truncateMiddle(label, W, keepEnd)` | The whole label exactly when its natural width fits W; otherwise start + `…` + end, cut only between graphemes, which paints within W + 1/64, where one more grapheme of the start would not fit, and whose end holds everything from `keepEnd.from` whenever that end, `…` and the first grapheme fit. The start keeps at least one grapheme, so where W is narrower than that grapheme and `…`, the result paints past W. | browser sweep |
| C7 | `fontFromStyle(getComputedStyle(el))` | Returns a Canvas font string that Canvas parses to the same font as the element's weight, style, size and family, with `letterSpacing` and `lineHeight` in px. Tested at the pinned style (weight 400, normal, no letter spacing) at 16px and 8-48px, and three single-property variants at 16px only: weight 700, italic, 0.5px letter spacing; not a cross of them (§4 explains why the variants were added). Indirectly, every other case's font comes from it. | browser sweep |
| C8 | `pretext-kit/headless` | In Node, for code points the registered fonts cover: `measureText` widths within 0.02px of Chromium's Canvas, and Pretext's line counts equal Pretext's inside Chromium; `HeadlessCoverageError` thrown on exactly the cases a fixed coverage rule puts out of scope. Chromium's rules, macOS, registered fonts only. | headless parity sweep |
| C9 | `watchFonts` | On each `loadingdone` event with at least one face, calls Pretext's `clearCache()` and then the callback; never after unsubscribing. | unit tests only (stand-in `FontFaceSet`) |
| C10 | `stack`, `findIndexAt`, `anchorDelta`; `shrinkwrapRich`, `balanceRich` | Arithmetic over heights and tops; the rich twins are C1/C2 over `measureRichInlineStats`. | unit tests only; **not browser-swept** |

C9 and C10 rest on `npm test` alone (148 tests on a stand-in Canvas, §6), not on a browser.

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
loaded by `@font-face` from the same files. Widths: 54 strings × 4 families × weights 400/600/700 × 12/14/16/20px ×
letter spacing 0/0.5px = 5,184, less 24 string × family × weight pairs (192 cases) out of scope = 4,992 cases. The
624 string × family × weight units are not 624 distinct faces: Inter and Roboto have one face, so their 600 and 700
(synthesised by Chromium) measure the 400 face, and Shantell Sans 600 takes its 700 face. Counted by distinct face,
they are 261 string × face pairs (Inter TTF 53, Inter WOFF2 53, Roboto 49, Shantell Sans 2 × 53), for which 0
misses bound the rate at 1.45% (Wilson; printed by `node verify/stats.ts`, which derives the faces from
HEADLESS_RESULTS.md). Line counts: 298 text × font pairs
(Latin, German and French from the corpora,
168 with soft hyphens, plus special characters) × 241 widths (71,818 cases). The scope rule was fixed before the first
run, from the font files' cmaps, not from the stand-in.

**Statistics** (`node verify/stats.ts`). It reads `verify/RESULTS.md`, `verify/results/latest.json.gz`,
`verify/baseline.json`, `verify/HEADLESS_RESULTS.md` and `verify/corpora.ts`, checks that they agree (case counts
recomputed from the corpora, non-pass counts from the listing), and prints the tables in §3. Bounds are two-sided 95%
intervals' upper ends, i.e. one-sided 97.5%: Wilson score (≈ 3.84/n at 0 failures for large n) and, beside it, exact
Clopper-Pearson (≈ 3.69/n at 0; the "3.7/n" often quoted is this one). "Judged against the painting" counts every
case that is neither pretext-gap nor unreliable, so it includes the 12,931 platform cases as judged and not failing.
Logic tests: `npm test`, 148 tests (`node --test`).

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
| widths within 0.02px of Chromium's Canvas | case | 4992 | 0 | 0.077% | 0.074% |
| widths within 0.02px of Chromium's Canvas | string × family × weight (8 cases each) | 624 | 0 | 0.612% | 0.589% |
| widths within 0.02px of Chromium's Canvas | string × distinct face | 261 | 0 | 1.45% | 1.40% |
| line count equal to Pretext in Chromium (judged: not pretext-gap or unreliable) | case | 71642 | 0 | 0.0054% | 0.0051% |
| line count equal to Pretext in Chromium | text × font (241 widths each) | 298 | 0 | 1.27% | 1.23% |

Both runs also record findings that are not kit-mismatches: 21,978 pretext-gap cases in 1,893 distinct findings
(RESULTS.md, "pretext-gap cases"), and 176 headless pretext-gap cases (HEADLESS_RESULTS.md). Their counts per helper
are in the table above; their causes are in §6 and §8.

## 4. Sensitivity (mutation testing)

`node verify/mutants.ts` plants each bug below, one at a time, in `src/` of a throwaway detached worktree of HEAD
(this checkout's `src` is never edited; the worktree is removed at the end), and runs `npm test` and a reduced sweep:
Chromium at factor 1, the affected helpers only (`node verify/run.ts --only=chromium --factors=1 --helpers=…`, which
writes no RESULTS.md and never touches the baseline). An unmutated control run comes first and must have no
kit-mismatch. Its output, run at 18db330, is committed as `verify/results/mutants.txt`; the control gave every
helper's tally as in RESULTS.md and `npm test` passing. The rows from 18db330 predate the four labels added below, so
their truncateMiddle counts are over 56,496 cases, not 61,632.

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
| cuts at code points, not grapheme clusters (subtle), rerun at 43a53af | clamp | 808080 | 43 | 807460 | fails (1 failing) |
| cuts at code points, not grapheme clusters (subtle), rerun at 43a53af | truncateMiddle | 61632 | 128 | 61501 | fails (1 failing) |
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
  kit-mismatch); and four such labels joined the path corpus (`verify/corpora.ts`). Rerun at 43a53af, the mutant is
  caught by 128 truncateMiddle cases and the new unit test; the rows above are that run's
  (`verify/results/mutants.txt` notes the replaced ones). The full sweep was rerun with the four labels (§3).
- **The new labels found a kit bug.** In WebKit 26.5 the Hangul jamo label in Georgia and Times New Roman at
  80-84px (18 cases over the three factors) came back as `한….txt`, 84.30 and 84.84px wide by Pretext's own
  measure: the end was measured alone, and joined to a start already down to its one grapheme and the ellipsis it
  overran. truncateMiddle now shortens the end until the result fits (a regression test reproduces it with the
  stand-in's kerning font); every truncateMiddle case then passed in all three browsers, and §3 is the full sweep
  rerun with the fix.
- **fontFromStyle dropping italic, or letter spacing**, is caught by the variant cases (4 each), and only by them.

**One mutant escaped the sweep, and that was a defect.** A first round of the gross mutants, against the harness as
it stood at 9804f84 (a throwaway branch `mutants-tmp` in a separate worktree, since deleted), gave the same counts as
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
| drop kerning (`kern` off always) | 2868 | 1594 | yes |
| ignore weight (always the 400 face) | 848 | 2988 | yes |
| drop the U+0020 word cut | 96 | 0 | yes (widths only) |

Dropping the U+0020 word cut cannot change a Pretext line count (Pretext never hands Canvas a space beside other
text: 0 of 2,254 measured strings), so only the width sweep sees it (Ruling H-8 in the headless ledger).

What the mutants do not show: that the sweep would catch a bug confined to inputs it never runs (other fonts,
weights in the painted helpers, scripts beyond the corpora, `white-space: pre-wrap`, rich rows other than icon +
label), or bugs in the rich twins, `watchFonts` or the list helpers, which no browser case exercises.

## 5. Cost

From `verify/BENCH.md` (`npm run bench`, `verify/bench-run.ts`, `verify/bench.ts`), merged into kit-v1 at 18db330;
it was rendered at 8b21eaa from the same measurements as the reviewed 011be73 (the numbers are identical). BENCH.md
records its run as of 4854056 "with uncommitted changes". Machine: Apple M2, 8 cores, 16 GB, macOS 14.6.1; browser
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
| **One OS, one machine.** macOS 14.6.1 on an Apple M2; Core Text shaping and rasterisation only. | No claim for Windows (DirectWrite), Linux (FreeType, hinting), Android or iOS. | The same sweep on Windows and Linux runners; Pretext's own accuracy pages show those engines differ. |
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
| **Headless scope.** Chromium's rules, registered fonts, macOS, one Chromium build. | Nothing is claimed for WebKit or Gecko profiles, OS fallback fonts, Windows or Linux. | One measured check each on Windows and Linux Chrome before claiming them (the spec requires it). |
| **One-off probes.** The `box-decoration-break: slice` probe for fitFontSizeRich (RESULTS.md, "Painting") ran once and its "168 + 1 err small" figure cannot be recomputed from stored data. | Its numbers are anecdotal. | Make it a flagged sweep mode whose output is stored. |
| **Run-to-run determinism** is shown by repeats, not argued: the full three-browser sweep, rerun in this evaluation, reproduced every count and the non-pass listing byte for byte (§4); a reviewer reproduced the headless sweep byte for byte; §7's fresh clone reproduced Chromium at factor 1. All repeats were on this one machine. | A case that flips between runs, or between machines, would not have shown. | Rerun from a fresh clone on another Mac and diff RESULTS.md and the listing. |

## 7. Reproduction

```sh
verify/reproduce.sh                        # everything: about 25 minutes with the browsers cached
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
every step passes; every compared tally equals the committed RESULTS.md; `widths: 4992 cases, 3842 exact`,
`lines: 71818 cases, 0 headless-mismatch, 176 pretext-gap`; all three headless mutants caught. After a full run,
`git diff` in the clone should show in RESULTS.md only timings and the run date, and in HEADLESS_RESULTS.md the date
and Pretext's abbreviated hash, whose length git chooses per repository (the recorded run below showed exactly that
hash difference). Not checked by a full run: that claim, since only the Chromium factor-1 mode was run from a fresh
clone; the in-place full rerun in §4 changed nothing in RESULTS.md beyond timings and what this evaluation's harness
changes changed (the fontFromStyle cases and the overflow sentences).

**The one run made for this evaluation** used `--sweep=chromium@1` to bound its time, so it confirms the Chromium
factor-1 tallies, not WebKit's, Firefox's or the zoomed ones:

Run 2026-10-05 on the same Mac (macOS 14.6.1, Node 24.4.1, npm 11.4.2, Playwright's browsers already cached), into
a new directory under the session's scratch space: `verify/reproduce.sh --kit-commit=729410b --sweep=chromium@1`,
163 s wall time. Its output is committed as `verify/results/reproduce-chromium1.txt` (paths shortened to `<dir>`
and `<kit-repo>`; the per-step logs stayed in the scratch directory). An earlier run at 9f46f09 gave the same
results in 174 s. Every step passed:

- `npm test`: 83 + 65 tests, 0 failing; `npm run check` clean.
- The Chromium factor-1 sweep: 7 of 7 helper tallies equal RESULTS.md (for example clamp 808080 cases: 807503 pass,
  577 pretext-gap, 0 kit-mismatch).
- `npm run verify:headless`: `widths: 4992 cases, 3842 exact, max 0.000427px, 0 misses`;
  `lines: 71818 cases, 0 headless-mismatch, 176 pretext-gap, 0 unreliable`; the three mutants caught with the
  counts in §4. The HEADLESS_RESULTS.md it wrote differs from the committed one in one character: Pretext's
  abbreviated commit hash (`f10d888c` for `f10d888`, git's abbreviation length in a fresh clone).

The first attempt, at 8da68c5, failed at its first build step: Pretext's `npm install` no longer resolves (its dev
dependencies float without a lockfile, and an oxlint release now conflicts with a pinned peer), which also broke the
README's install line. Both now run Pretext's pinned `tsc` directly (9f46f09); the dist it builds is identical, file
for file, to the one the recorded runs used. Not reproduced from a fresh clone: WebKit, Firefox, the zoom factors,
and any other machine.

## 8. Known limitations

What a user of the kit should know, in order of how likely it is to matter.

- **macOS only, so far.** Everything above was measured on macOS 14. Windows and Linux text stacks were not tested;
  expect Pretext's own per-platform accuracy there, not more.
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
- **Headless** is Chromium's rules with registered fonts, on macOS: an uncovered code point throws
  `HeadlessCoverageError`; a weight with no registered face measures the nearest one.
- **Not browser-tested:** `shrinkwrapRich`, `balanceRich`, `watchFonts`, `stack`, `findIndexAt`, `anchorDelta`.
- **`watchFonts` in a worker**: by default it listens to `document.fonts`, which a worker lacks, so there it does
  nothing unless given the worker's `self.fonts` as its second argument.
- **Very narrow boxes.** clamp and truncateMiddle keep at least one grapheme, so below the width of one grapheme
  plus the ellipsis the result paints past the box.
- **Cost.** In a freshly launched browser the kit's first pass is slower than the DOM's in Chromium (about 49-57
  against 43-46 µs per message) and in Firefox (about 80-104 against 47-54 µs); in Firefox it stays slower for new
  text after warm-up too (29.1 against 20.0 µs, DOM at devicePixelRatio 2). `prepareLabel` costs 0.1-0.3 ms per
  label. Prepare once and reuse; the kit wins on re-layout, not on first sight.

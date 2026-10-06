# Label checker oracle sweep results

Run on 2026-10-06 by `npm run verify:check` (verify/check-labels.ts), pretext-kit f01bf83.

- Chromium 141.0.7390.37 (Playwright 1.61.0, headed on X display :99, executable /opt/pw-browsers/chromium from PW_CHROMIUM), `<html lang="en">`, each slot `lang` its label's locale
- Pretext 0.0.9 (../pretext f10d888); harfbuzzjs 1.6.2
- Node v22.22.0, Linux 6.18.44-fc-v70, x64
- checker: `checkLabels` in Node, `platforms: ['linux']` (this OS's), font Inter-Regular.ttf from test/fonts registered as "CK Inter"
- Chromium 213s; checker runs (control and 8 mutants, 4 at a time) 197s

## Method

Fonts: Inter-Regular.ttf (test/fonts), loaded in Chromium by `@font-face` from the same file as "CK Inter", and again as
"CK Inter tnum" with `font-feature-settings: "tnum" 1` for the kit's own measurements of tabular slots (Canvas has no
`font-variant-numeric`; the DOM itself sets `font-variant-numeric: tabular-nums` on the plain family), each checked
`loaded`. The checker registers the file under its own name and makes its tabular twin itself.

Each case is judged three ways. **Checker:** `checkLabels` in Node (the stand-in), its verdict the issue the report
holds for the label (none is a pass), and for shrinkTo the fitted size from its own `evaluateLabel` (a pass reports
none). **Reference:** the spec's rule recomputed in the page with the kit's helpers on Pretext with real canvas, from
the CSS the element gets: text scale multiplies font size, letter spacing, line height and the icon width,
zoom then everything; the box is the slot width less the icon. as-is and truncate middle: one line at the box
(`fitFontSize` at the one size, so with FIT_TOLERANCE; middle after `prepareLabel`'s white-space collapse); lines:
the same with 2 lines; truncate end: `clamp(…, 2).truncated`; the "(normal)" policies, a slot with `overflowWrap: 'normal'`:
first, each piece between two of Pretext's break opportunities (its segments; zero-width glue and controls join the
text around them), a piece that fails making lines (normal) `overflow` and truncate end (normal)
`truncated` (a piece fails when its natural width, which an unbroken word paints, or its line ending at its soft hyphen,
is past the box by more than FIT_TOLERANCE), then the rule without the suffix, laid out at the box plus FIT_TOLERANCE
when a word that passes is wider than the box (the browser shows it whole); shrinkTo: the largest of the slot size, every whole px
below it and the minimum that fits one line; rows: each stage's natural widths, icon reserves, icons and gaps, the
first stage within the row (plus FIT_TOLERANCE). **DOM:** a flex box of the slot width holding the icon and the text
element: as-is, shrinkTo and truncate middle `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`;
lines `overflow-wrap: break-word; hyphens: manual` (lines (normal) `overflow-wrap: normal`), line count from the tops of
`getClientRects()` of a range over the text (checked against height ÷ line height; a disagreement is `unreliable`);
truncate end `display: -webkit-box; -webkit-line-clamp: 2`, clamped when `scrollHeight > clientHeight` (truncate end (normal)
`overflow-wrap: normal`, cut when clamped or when a line is wider than the box, which `text-overflow: ellipsis` cuts on
any line of the clamp in Chromium); shrinkTo
rendered at the reference's size, which must fit, and at the next candidate size up, which must not (none at the
slot size); rows a flex line (`gap`, items `flex: none`) at the reference's stage, which must fit (overflow for
row-overflow), and at the stage before, which must not. Text scale is a font-size change in the fixed-width box, zoom
CSS `zoom` on the container. Overflow (nowrap policies, a line wider than the box, rows) is judged on fractional
widths: the bounding width of a range over the content past the element's box by more than 1/64 px (zoomed px).
`scrollWidth > clientWidth`, which Chromium snaps to whole pixels, is a cross-check: it disagrees in
51769 of 473736 cases (2142 of them pretext-gaps).

Outcome, in this order (EVALUATION §2): `excluded` when the checker cannot judge the text (`uncovered`); `check-mismatch`
when the checker's verdict (kind, shrinkTo size to 1/64 px, row stage) differs from the reference; `excluded` as
`unreliable` when the DOM's two line counts disagree; `pretext-gap` when the DOM contradicts the reference; else
`pass`. Pass bar: 0 check-mismatch.

**Near-miss family.** Its own slots and rows, run with `nearMiss: 2` in checkLabels calls of their own (the cases above run
without it, and a near-miss in their report fails the run). Each is first judged as above; then, on a pass (a row also
at a collapse stage), the slack: **checker** a `near-miss` issue and its `missing.px`; **reference** the box less what the
verdict fitted, recomputed in the page (as-is: the natural width; truncate middle: the collapsed text's; shrinkTo: the
natural width at the chosen size; lines and truncate end: Pretext's widest line at the box, and for the "(normal)"
policies at the width their lines are laid out at and no less than the widest word; rows: the stage's total), at least
0, a near-miss when, rounded to 1/64 px, it is under 2px; **DOM** the element's box less the text's width (nowrap
policies, shrinkTo at the chosen size; a range's bounding width) or its widest line (the rects of a range over the text
grouped by top, from the leftmost to the rightmost rect of each: a line's trailing space is not in them, a painted soft
hyphen is), rows the row box less its content, zoomed px. `check-mismatch` when the checker reports a near-miss on a failing
verdict, decides differently from the reference, or reports a slack more than 1/64 px from the reference's; then
`pretext-gap` when the DOM's slack is on the other side of 2px from the reference's, unless it is within 1/64 px of 2px.

Fractional font sizes: the checker measures 16 here (10.35, 11.7, 13.455, 13.8, 14.95, 15.21, 15.6, 16.9, 17.94, 18.4, 19.435, 20.28, 20.8, 21.97, 23.92, 27.04px; whole-pixel
shrinkTo candidates besides). On the 'linux' profile (this run: 'linux') the stand-in measures a fractional size with
Chromium on Linux's own rule (src/headless/canvas.ts sizedFor: the size in float32 hundredths, advances at it truncated to
26.6), exact for the first use of a size in a document (Chromium 141; test/headless/fractional-size.test.ts). Later in a
document Chromium can reuse the glyph metrics of a nearby fractional size measured before, in either direction, which
the stand-in does not model: a page using two fractional sizes within a few hundredths of a px can differ from it by one
1/64 px advance step. None of this sweep's nearby pairs (17.94 and 18, 27 and 27.04, 21.97 and 22, 16.9 and 17px)
shares a cache entry in Chromium 141. 'macos' and 'windows' measure at the size asked for.

shrinkTo's "next size": the checker searches the slot size, whole pixels and the minimum (`fitFontSize` takes whole
pixels), so the claim the DOM can test is that the chosen size fits and the next candidate up does not; sizes between
two whole pixels are not a claim the checker makes.

## Cases

Texts: 2317. latin 1498, german 269, french 490, German compounds 15, French 15, uppercase tabs 15, digits 15. Corpus texts are every
run of whole words of at most 40 characters (soft hyphens not counted; German and French keep the corpora's soft
hyphens), in locale en, de and fr; every other one has a 20px icon reserve (`corpus + icon`). The hand-written
labels: German compounds (button + icon: 16px, reserve 20), French (button + icon: 16px, reserve 20), uppercase tabs (uppercase tab: 13px, letter spacing 0.5px, uppercase), digits (tabular digits: 16px, tabular-nums).

Slots: each text in 7 policies (as-is; shrinkTo the size less 4px; lines 2; truncate end 2 lines;
truncate middle; lines and truncate end again with overflow-wrap: normal), and each text scale (1/1.15/1.3) its own slots, at 0.9/1/1.1 × the box where the policy changes its
verdict at that text scale (one line at the scaled size and letter spacing; one line at the scaled shrinkTo size; the
narrowest width in 2 lines; for the "(normal)" policies that or the widest unbreakable piece's natural width,
whichever is wider), and for the "(normal)" policies also at the widest unbreakable piece's own boundary w: w, w less
1/64 px and a hair rounded down to 1/64 px, and w less 0.25px, where the checker's word rule decides; plus the reserve grown with the text, rounded up to 1/64 px; measured by the kit on Pretext
in the page. A slot runs in its text scale's conditions, zoom 1 and 1.3 (zoom grows the box too, so the boundary
stays): 187674 slots run (3 not run, below). Line height 1.5 × the size. Conditions: text 100% · zoom 100%, text 115% · zoom 100%, text 130% · zoom 100%, text 100% · zoom 130%, text 115% · zoom 130%, text 130% · zoom 130%.
Rows: a five-item toolbar per locale (en, de, fr) and text scale, gap 8px, icon reserve 20px, collapsed icon
24px, 5 collapse stages, at each stage's total at that text scale, halfway to the next and 0.9 of the last:
108 rows: 375564 cases (375348 slot, 216 row).
Near-miss family: every 6th text (387) in every policy at each text scale, at the same boundary box plus
-0.5, +0, +1.2885, +1.7885, +1.75, +2.25px (below it; at it; 1/4 px either side of 2px ÷ 1.3 and of 2px, so the margin is
crossed at zoom 100% and at 130%), on the 1/64 px grid: 48762 slots run (0 not run, below); rows at each stage's total plus the same
offsets: 324 rows; 98172 cases (97524 slot, 648 row). **473736 cases** in all.

The checker's verdicts (control run) per policy and condition kind; the run fails if a cell has one verdict only:

| policy · condition kind | pass | fail | fail kinds |
|---|---:|---:|---|
| as-is · none | 4634 | 2317 | overflow 2317 |
| as-is · text scale | 9268 | 4634 | overflow 4634 |
| as-is · zoom | 4634 | 2317 | overflow 2317 |
| as-is · text scale + zoom | 9243 | 4659 | overflow 4659 |
| shrinkTo · none | 4634 | 2316 | below-min-size 2316 |
| shrinkTo · text scale | 9268 | 4632 | below-min-size 4632 |
| shrinkTo · zoom | 4634 | 2316 | below-min-size 2316 |
| shrinkTo · text scale + zoom | 8103 | 5797 | below-min-size 5797 |
| lines · none | 4634 | 2317 | too-many-lines 2317 |
| lines · text scale | 9268 | 4634 | too-many-lines 4634 |
| lines · zoom | 4634 | 2317 | too-many-lines 2317 |
| lines · text scale + zoom | 9243 | 4659 | too-many-lines 4659 |
| truncate end · none | 4675 | 2276 | truncated 2276 |
| truncate end · text scale | 9350 | 4552 | truncated 4552 |
| truncate end · zoom | 4675 | 2276 | truncated 2276 |
| truncate end · text scale + zoom | 9325 | 4577 | truncated 4577 |
| truncate middle · none | 4634 | 2317 | truncated 2317 |
| truncate middle · text scale | 9268 | 4634 | truncated 4634 |
| truncate middle · zoom | 4634 | 2317 | truncated 2317 |
| truncate middle · text scale + zoom | 9243 | 4659 | truncated 4659 |
| lines (normal) · none | 5353 | 8549 | overflow 5392, too-many-lines 3157 |
| lines (normal) · text scale | 10706 | 17098 | overflow 10784, too-many-lines 6314 |
| lines (normal) · zoom | 5426 | 8476 | overflow 5218, too-many-lines 3258 |
| lines (normal) · text scale + zoom | 11065 | 16739 | overflow 9595, too-many-lines 7144 |
| truncate end (normal) · none | 5353 | 8549 | truncated 8549 |
| truncate end (normal) · text scale | 10706 | 17098 | truncated 17098 |
| truncate end (normal) · zoom | 5426 | 8476 | truncated 8476 |
| truncate end (normal) · text scale + zoom | 11065 | 16739 | truncated 16739 |
| row · none | 3 | 33 | row-collapsed 30, row-overflow 3 |
| row · text scale | 6 | 66 | row-collapsed 60, row-overflow 6 |
| row · zoom | 3 | 33 | row-collapsed 30, row-overflow 3 |
| row · text scale + zoom | 6 | 66 | row-collapsed 60, row-overflow 6 |

The near-miss family's checker decisions (control run); the run fails if a cell lacks passes with or without a near-miss:

| policy · condition kind | near-miss | no near-miss | failing verdict |
|---|---:|---:|---:|
| as-is · none | 1548 | 387 | 387 |
| as-is · text scale | 3096 | 774 | 774 |
| as-is · zoom | 774 | 1161 | 387 |
| as-is · text scale + zoom | 1546 | 2322 | 776 |
| shrinkTo · none | 1573 | 362 | 387 |
| shrinkTo · text scale | 3399 | 471 | 774 |
| shrinkTo · zoom | 1090 | 845 | 387 |
| shrinkTo · text scale + zoom | 2289 | 1390 | 965 |
| lines · none | 1569 | 366 | 387 |
| lines · text scale | 3134 | 736 | 774 |
| lines · zoom | 825 | 1110 | 387 |
| lines · text scale + zoom | 1635 | 2233 | 776 |
| truncate end · none | 1579 | 366 | 377 |
| truncate end · text scale | 3154 | 736 | 754 |
| truncate end · zoom | 835 | 1110 | 377 |
| truncate end · text scale + zoom | 1655 | 2233 | 756 |
| truncate middle · none | 1548 | 387 | 387 |
| truncate middle · text scale | 3096 | 774 | 774 |
| truncate middle · zoom | 774 | 1161 | 387 |
| truncate middle · text scale + zoom | 1546 | 2322 | 776 |
| lines (normal) · none | 1558 | 377 | 387 |
| lines (normal) · text scale | 3113 | 757 | 774 |
| lines (normal) · zoom | 796 | 1139 | 387 |
| lines (normal) · text scale + zoom | 1580 | 2288 | 776 |
| truncate end (normal) · none | 1558 | 377 | 387 |
| truncate end (normal) · text scale | 3113 | 757 | 774 |
| truncate end (normal) · zoom | 796 | 1139 | 387 |
| truncate end (normal) · text scale + zoom | 1580 | 2288 | 776 |
| row · none | 72 | 33 | 3 |
| row · text scale | 144 | 66 | 6 |
| row · zoom | 36 | 69 | 3 |
| row · text scale + zoom | 72 | 138 | 6 |

## Agreement

**473736 cases: 0 check-mismatch, 10255 pretext-gap, 0 excluded, 463481 pass.**
Verdicts: 375564 cases, 0 check-mismatch, 7292 pretext-gap, 0 excluded, 368272 pass.
Near-miss family: 98172 cases, 0 check-mismatch, 2963 pretext-gap, 0 excluded, 95209 pass.

| policy · condition kind | cases | pass | check-mismatch | pretext-gap | excluded |
|---|---:|---:|---:|---:|---:|
| as-is · none | 6951 | 6820 | 0 | 131 | 0 |
| as-is · text scale | 13902 | 13640 | 0 | 262 | 0 |
| as-is · zoom | 6951 | 6820 | 0 | 131 | 0 |
| as-is · text scale + zoom | 13902 | 13645 | 0 | 257 | 0 |
| shrinkTo · none | 6950 | 6819 | 0 | 131 | 0 |
| shrinkTo · text scale | 13900 | 13638 | 0 | 262 | 0 |
| shrinkTo · zoom | 6950 | 6820 | 0 | 130 | 0 |
| shrinkTo · text scale + zoom | 13900 | 13065 | 0 | 835 | 0 |
| lines · none | 6951 | 6769 | 0 | 182 | 0 |
| lines · text scale | 13902 | 13490 | 0 | 412 | 0 |
| lines · zoom | 6951 | 6758 | 0 | 193 | 0 |
| lines · text scale + zoom | 13902 | 13525 | 0 | 377 | 0 |
| truncate end · none | 6951 | 6769 | 0 | 182 | 0 |
| truncate end · text scale | 13902 | 13490 | 0 | 412 | 0 |
| truncate end · zoom | 6951 | 6758 | 0 | 193 | 0 |
| truncate end · text scale + zoom | 13902 | 13525 | 0 | 377 | 0 |
| truncate middle · none | 6951 | 6820 | 0 | 131 | 0 |
| truncate middle · text scale | 13902 | 13640 | 0 | 262 | 0 |
| truncate middle · zoom | 6951 | 6820 | 0 | 131 | 0 |
| truncate middle · text scale + zoom | 13902 | 13645 | 0 | 257 | 0 |
| lines (normal) · none | 13902 | 13819 | 0 | 83 | 0 |
| lines (normal) · text scale | 27804 | 27595 | 0 | 209 | 0 |
| lines (normal) · zoom | 13902 | 13750 | 0 | 152 | 0 |
| lines (normal) · text scale + zoom | 27804 | 27232 | 0 | 572 | 0 |
| truncate end (normal) · none | 13902 | 13819 | 0 | 83 | 0 |
| truncate end (normal) · text scale | 27804 | 27595 | 0 | 209 | 0 |
| truncate end (normal) · zoom | 13902 | 13750 | 0 | 152 | 0 |
| truncate end (normal) · text scale + zoom | 27804 | 27232 | 0 | 572 | 0 |
| row · none | 36 | 33 | 0 | 3 | 0 |
| row · text scale | 72 | 63 | 0 | 9 | 0 |
| row · zoom | 36 | 36 | 0 | 0 | 0 |
| row · text scale + zoom | 72 | 72 | 0 | 0 | 0 |

Near-miss family:

| policy · condition kind | cases | pass | check-mismatch | pretext-gap | excluded |
|---|---:|---:|---:|---:|---:|
| as-is · none | 2322 | 2263 | 0 | 59 | 0 |
| as-is · text scale | 4644 | 4482 | 0 | 162 | 0 |
| as-is · zoom | 2322 | 2261 | 0 | 61 | 0 |
| as-is · text scale + zoom | 4644 | 4467 | 0 | 177 | 0 |
| shrinkTo · none | 2322 | 2277 | 0 | 45 | 0 |
| shrinkTo · text scale | 4644 | 4523 | 0 | 121 | 0 |
| shrinkTo · zoom | 2322 | 2265 | 0 | 57 | 0 |
| shrinkTo · text scale + zoom | 4644 | 4459 | 0 | 185 | 0 |
| lines · none | 2322 | 2249 | 0 | 73 | 0 |
| lines · text scale | 4644 | 4442 | 0 | 202 | 0 |
| lines · zoom | 2322 | 2236 | 0 | 86 | 0 |
| lines · text scale + zoom | 4644 | 4469 | 0 | 175 | 0 |
| truncate end · none | 2322 | 2249 | 0 | 73 | 0 |
| truncate end · text scale | 4644 | 4442 | 0 | 202 | 0 |
| truncate end · zoom | 2322 | 2236 | 0 | 86 | 0 |
| truncate end · text scale + zoom | 4644 | 4469 | 0 | 175 | 0 |
| truncate middle · none | 2322 | 2263 | 0 | 59 | 0 |
| truncate middle · text scale | 4644 | 4482 | 0 | 162 | 0 |
| truncate middle · zoom | 2322 | 2261 | 0 | 61 | 0 |
| truncate middle · text scale + zoom | 4644 | 4467 | 0 | 177 | 0 |
| lines (normal) · none | 2322 | 2292 | 0 | 30 | 0 |
| lines (normal) · text scale | 4644 | 4544 | 0 | 100 | 0 |
| lines (normal) · zoom | 2322 | 2277 | 0 | 45 | 0 |
| lines (normal) · text scale + zoom | 4644 | 4553 | 0 | 91 | 0 |
| truncate end (normal) · none | 2322 | 2292 | 0 | 30 | 0 |
| truncate end (normal) · text scale | 4644 | 4544 | 0 | 100 | 0 |
| truncate end (normal) · zoom | 2322 | 2277 | 0 | 45 | 0 |
| truncate end (normal) · text scale + zoom | 4644 | 4553 | 0 | 91 | 0 |
| row · none | 108 | 105 | 0 | 3 | 0 |
| row · text scale | 216 | 207 | 0 | 9 | 0 |
| row · zoom | 108 | 108 | 0 | 0 | 0 |
| row · text scale + zoom | 216 | 195 | 0 | 21 | 0 |

Statistics (PROTOCOL §4), one unit per label text (a text's slots, widths and conditions are one unit; each locale's
row is one): 2320 units, 0 with a check-mismatch, 95% upper bound on the rate Wilson 0.165%, Clopper-Pearson 0.159%
(quoted). Per case, naive: 473736 judged cases, 0 check-mismatch, Wilson 0.0008%, Clopper-Pearson 0.0008%.

### check-mismatch cases

None.

### pretext-gap cases, by cause

Each is the reference (the kit on Pretext in Chromium) against Chromium's painting with the checker agreeing with the
reference, so each is attributed to Pretext vs the DOM, not to the checker; for the "(normal)" policies the word model
(which text is one unbreakable piece, measured how) is the kit's, shared by checker and reference, so a gap there can
also be that model against the DOM.

Every case is listed in verify/dist/check-cases.md (not committed; CI uploads it with this file); below,
up to 10 per cause.

**truncate end: DOM clamps where Pretext does not** (1384):

- text 100% · zoom 100%: t1.truncate-end.1.1 "Just tried" (en, corpus + icon) @ 54.265625px
- text 100% · zoom 100%: t9.truncate-end.1.1 "tried the" (en, corpus + icon) @ 54.265625px
- text 100% · zoom 100%: t63.truncate-end.1.1 "better. The performance" (en, corpus + icon) @ 117.609375px
- text 100% · zoom 100%: t67.truncate-end.1.1 "The performance" (en, corpus + icon) @ 117.609375px
- text 100% · zoom 100%: t81.truncate-end.1.1 "are really noticeable," (en, corpus + icon) @ 103.21875px
- text 100% · zoom 100%: t85.truncate-end.1.1 "really noticeable," (en, corpus + icon) @ 103.21875px
- text 100% · zoom 100%: t89.truncate-end.1.1 "noticeable," (en, corpus + icon) @ 65.921875px
- text 100% · zoom 100%: t90.truncate-end.1.1 "noticeable, especially" (en, corpus) @ 83.21875px
- text 100% · zoom 100%: t94.truncate-end.1.1 "especially" (en, corpus) @ 38.75px
- text 100% · zoom 100%: t96.truncate-end.1.1 "especially on older" (en, corpus) @ 75.640625px
- … and 1374 more in verify/dist/check-cases.md

**lines: DOM 3 lines, Pretext 2** (1378):

- text 100% · zoom 100%: t1.lines.1.1 "Just tried" (en, corpus + icon) @ 54.265625px (DOM text 32.2813 in 34.2656, zoomed px; scrollWidth 34, clientWidth 34)
- text 100% · zoom 100%: t9.lines.1.1 "tried the" (en, corpus + icon) @ 54.265625px (DOM text 24.625 in 34.2656, zoomed px; scrollWidth 34, clientWidth 34)
- text 100% · zoom 100%: t63.lines.1.1 "better. The performance" (en, corpus + icon) @ 117.609375px (DOM text 88.3125 in 97.6094, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 100%: t67.lines.1.1 "The performance" (en, corpus + icon) @ 117.609375px (DOM text 88.3125 in 97.6094, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 100%: t81.lines.1.1 "are really noticeable," (en, corpus + icon) @ 103.21875px (DOM text 78.7656 in 83.2188, zoomed px; scrollWidth 83, clientWidth 83)
- text 100% · zoom 100%: t85.lines.1.1 "really noticeable," (en, corpus + icon) @ 103.21875px (DOM text 78.7656 in 83.2188, zoomed px; scrollWidth 83, clientWidth 83)
- text 100% · zoom 100%: t89.lines.1.1 "noticeable," (en, corpus + icon) @ 65.921875px (DOM text 41.4688 in 45.9219, zoomed px; scrollWidth 46, clientWidth 46)
- text 100% · zoom 100%: t90.lines.1.1 "noticeable, especially" (en, corpus) @ 83.21875px (DOM text 78.7656 in 83.2188, zoomed px; scrollWidth 83, clientWidth 83)
- text 100% · zoom 100%: t94.lines.1.1 "especially" (en, corpus) @ 38.75px (DOM text 36.9063 in 38.75, zoomed px; scrollWidth 39, clientWidth 39)
- text 100% · zoom 100%: t96.lines.1.1 "especially on older" (en, corpus) @ 75.640625px (DOM text 66.6563 in 75.6406, zoomed px; scrollWidth 76, clientWidth 76)
- … and 1368 more in verify/dist/check-cases.md

**as-is: DOM overflows where Pretext fits** (925):

- text 100% · zoom 100%: t1564.as-is.1.1 "noch ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 276.484375px (DOM text 276.6406 in 276.4844, zoomed px; scrollWidth 277, clientWidth 276)
- text 100% · zoom 100%: t1568.as-is.1.1 "ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 234.328125px (DOM text 234.4844 in 234.3281, zoomed px; scrollWidth 234, clientWidth 234)
- text 100% · zoom 100%: t1571.as-is.1.1 "mit der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 200.296875px (DOM text 180.4531 in 180.2969, zoomed px; scrollWidth 180, clientWidth 180)
- text 100% · zoom 100%: t1572.as-is.1.1 "mit der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 276.625px (DOM text 276.7813 in 276.625, zoomed px; scrollWidth 277, clientWidth 277)
- text 100% · zoom 100%: t1573.as-is.1.1 "der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 172.671875px (DOM text 152.8281 in 152.6719, zoomed px; scrollWidth 153, clientWidth 153)
- text 100% · zoom 100%: t1574.as-is.1.1 "der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 249px (DOM text 249.1563 in 249, zoomed px; scrollWidth 249, clientWidth 249)
- text 100% · zoom 100%: t1575.as-is.1.1 "Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 143.03125px (DOM text 123.1875 in 123.0313, zoomed px; scrollWidth 123, clientWidth 123)
- text 100% · zoom 100%: t1576.as-is.1.1 "Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 219.34375px (DOM text 219.5 in 219.3438, zoomed px; scrollWidth 220, clientWidth 219)
- text 100% · zoom 100%: t1584.as-is.1.1 "ver­langt" (de, corpus) @ 61.390625px (DOM text 61.6406 in 61.3906, zoomed px; scrollWidth 62, clientWidth 61)
- text 100% · zoom 100%: t1585.as-is.1.1 "ver­langt eine" (de, corpus + icon) @ 117.875px (DOM text 98.125 in 97.875, zoomed px; scrollWidth 98, clientWidth 98)
- … and 915 more in verify/dist/check-cases.md

**truncate middle: DOM overflows where Pretext fits** (925):

- text 100% · zoom 100%: t1564.truncate-middle.1.1 "noch ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 276.484375px (DOM text 276.6406 in 276.4844, zoomed px; scrollWidth 277, clientWidth 276)
- text 100% · zoom 100%: t1568.truncate-middle.1.1 "ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 234.328125px (DOM text 234.4844 in 234.3281, zoomed px; scrollWidth 234, clientWidth 234)
- text 100% · zoom 100%: t1571.truncate-middle.1.1 "mit der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 200.296875px (DOM text 180.4531 in 180.2969, zoomed px; scrollWidth 180, clientWidth 180)
- text 100% · zoom 100%: t1572.truncate-middle.1.1 "mit der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 276.625px (DOM text 276.7813 in 276.625, zoomed px; scrollWidth 277, clientWidth 277)
- text 100% · zoom 100%: t1573.truncate-middle.1.1 "der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 172.671875px (DOM text 152.8281 in 152.6719, zoomed px; scrollWidth 153, clientWidth 153)
- text 100% · zoom 100%: t1574.truncate-middle.1.1 "der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 249px (DOM text 249.1563 in 249, zoomed px; scrollWidth 249, clientWidth 249)
- text 100% · zoom 100%: t1575.truncate-middle.1.1 "Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 143.03125px (DOM text 123.1875 in 123.0313, zoomed px; scrollWidth 123, clientWidth 123)
- text 100% · zoom 100%: t1576.truncate-middle.1.1 "Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 219.34375px (DOM text 219.5 in 219.3438, zoomed px; scrollWidth 220, clientWidth 219)
- text 100% · zoom 100%: t1584.truncate-middle.1.1 "ver­langt" (de, corpus) @ 61.390625px (DOM text 61.6406 in 61.3906, zoomed px; scrollWidth 62, clientWidth 61)
- text 100% · zoom 100%: t1585.truncate-middle.1.1 "ver­langt eine" (de, corpus + icon) @ 117.875px (DOM text 98.125 in 97.875, zoomed px; scrollWidth 98, clientWidth 98)
- … and 915 more in verify/dist/check-cases.md

**shrinkTo: DOM overflows at the fitted size** (889):

- text 100% · zoom 100%: t1564.shrinkTo.1.1 "noch ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 207.359375px (DOM text 207.4844 in 207.3594, next size 224.7656, zoomed px; scrollWidth 207, clientWidth 207)
- text 100% · zoom 100%: t1568.shrinkTo.1.1 "ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 175.75px (DOM text 175.875 in 175.75, next size 190.5313, zoomed px; scrollWidth 176, clientWidth 176)
- text 100% · zoom 100%: t1571.shrinkTo.1.1 "mit der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 155.234375px (DOM text 135.3438 in 135.2344, next size 146.625, zoomed px; scrollWidth 135, clientWidth 135)
- text 100% · zoom 100%: t1572.shrinkTo.1.1 "mit der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 207.46875px (DOM text 207.5938 in 207.4688, next size 224.8906, zoomed px; scrollWidth 208, clientWidth 207)
- text 100% · zoom 100%: t1573.shrinkTo.1.1 "der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 134.515625px (DOM text 114.625 in 114.5156, next size 124.1875, zoomed px; scrollWidth 115, clientWidth 115)
- text 100% · zoom 100%: t1574.shrinkTo.1.1 "der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 186.75px (DOM text 186.875 in 186.75, next size 202.4375, zoomed px; scrollWidth 187, clientWidth 187)
- text 100% · zoom 100%: t1575.shrinkTo.1.1 "Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 112.28125px (DOM text 92.3906 in 92.2813, next size 100.0938, zoomed px; scrollWidth 92, clientWidth 92)
- text 100% · zoom 100%: t1576.shrinkTo.1.1 "Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 164.515625px (DOM text 164.625 in 164.5156, next size 178.3438, zoomed px; scrollWidth 165, clientWidth 165)
- text 100% · zoom 100%: t1584.shrinkTo.1.1 "ver­langt" (de, corpus) @ 46.046875px (DOM text 46.2344 in 46.0469, next size 50.0938, zoomed px; scrollWidth 46, clientWidth 46)
- text 100% · zoom 100%: t1585.shrinkTo.1.1 "ver­langt eine" (de, corpus + icon) @ 93.40625px (DOM text 73.5938 in 73.4063, next size 79.7344, zoomed px; scrollWidth 74, clientWidth 73)
- … and 879 more in verify/dist/check-cases.md

**shrinkTo: DOM fits at the minimum where Pretext overflows** (694):

- text 115% · zoom 130%: t5.shrinkTo.1.15.1 "Just tried the new update and" (en, corpus + icon) @ 217.4375px (DOM text 252.7813 in 252.7656, zoomed px; scrollWidth 194, clientWidth 194)
- text 115% · zoom 130%: t7.shrinkTo.1.15.1 "Just tried the new update and it's so" (en, corpus + icon) @ 260.03125px (DOM text 308.1563 in 308.1406, zoomed px; scrollWidth 237, clientWidth 237)
- text 115% · zoom 130%: t10.shrinkTo.1.15.1 "tried the new" (en, corpus) @ 85.390625px (DOM text 111.0156 in 111, zoomed px; scrollWidth 85, clientWidth 85)
- text 115% · zoom 130%: t11.shrinkTo.1.15.1 "tried the new update" (en, corpus + icon) @ 157.5px (DOM text 174.8594 in 174.8594, zoomed px; scrollWidth 135, clientWidth 135)
- text 115% · zoom 130%: t18.shrinkTo.1.15.1 "the new update" (en, corpus) @ 100.9375px (DOM text 131.2344 in 131.2188, zoomed px; scrollWidth 101, clientWidth 101)
- text 115% · zoom 130%: t23.shrinkTo.1.15.1 "the new update and it's so much better." (en, corpus + icon) @ 280.546875px (DOM text 334.8281 in 334.8125, zoomed px; scrollWidth 258, clientWidth 258)
- text 115% · zoom 130%: t29.shrinkTo.1.15.1 "new update and it's so much" (en, corpus + icon) @ 210.328125px (DOM text 243.5469 in 243.5313, zoomed px; scrollWidth 187, clientWidth 187)
- text 115% · zoom 130%: t33.shrinkTo.1.15.1 "update and" (en, corpus + icon) @ 96.453125px (DOM text 95.5 in 95.4844, zoomed px; scrollWidth 73, clientWidth 73)
- text 115% · zoom 130%: t37.shrinkTo.1.15.1 "update and it's so much better." (en, corpus + icon) @ 224.828125px (DOM text 262.3906 in 262.375, zoomed px; scrollWidth 202, clientWidth 202)
- text 115% · zoom 130%: t41.shrinkTo.1.15.1 "and it's so" (en, corpus + icon) @ 89.9375px (DOM text 87.0313 in 87.0156, zoomed px; scrollWidth 67, clientWidth 67)
- … and 684 more in verify/dist/check-cases.md

**lines (normal): DOM 3 lines, Pretext 2** (665):

- text 100% · zoom 100%: t1530.lines-normal.1.1 "Pro­jekt­ord­ner." (de, corpus) @ 58.375px (DOM text 57.9531 in 58.375, zoomed px; scrollWidth 58, clientWidth 58)
- text 100% · zoom 100%: t1568.lines-normal.1.1 "ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 123.03125px (DOM text 110.3594 in 123.0313, zoomed px; scrollWidth 123, clientWidth 123)
- text 100% · zoom 100%: t1571.lines-normal.1.1 "mit der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 123.640625px (DOM text 90.9688 in 103.6406, zoomed px; scrollWidth 104, clientWidth 104)
- text 100% · zoom 100%: t1572.lines-normal.1.1 "mit der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 143.609375px (DOM text 136.0938 in 143.6094, zoomed px; scrollWidth 144, clientWidth 144)
- text 100% · zoom 100%: t1575.lines-normal.1.1 "Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 85.578125px (DOM text 48.1406 in 65.5781, zoomed px; scrollWidth 66, clientWidth 66)
- text 100% · zoom 100%: t1583.lines-normal.1.1 "Da­ten­schutz­grund­ver­ord­nung ver­langt eine" (de, corpus + icon) @ 188.78125px (DOM text 153.2344 in 168.7813, zoomed px; scrollWidth 169, clientWidth 169)
- text 100% · zoom 100%: t1585.lines-normal.1.1 "ver­langt eine" (de, corpus + icon) @ 81.390625px (DOM text 37.3594 in 61.3906, zoomed px; scrollWidth 61, clientWidth 61)
- text 100% · zoom 100%: t1592.lines-normal.1.1 "Ein­wil­li­gungs­ver­wal­tung für" (de, corpus) @ 109.859375px (DOM text 104.2656 in 109.8594, zoomed px; scrollWidth 110, clientWidth 110)
- text 100% · zoom 100%: t1596.lines-normal.1.1 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 104.046875px (DOM text 82 in 104.0469, zoomed px; scrollWidth 104, clientWidth 104)
- text 100% · zoom 100%: t1623.lines-normal.1.1 "Haft­pflicht­ver­si­che­rungs­be­din­gun­gen" (de, corpus + icon) @ 168.8125px (DOM text 147.8438 in 148.8125, zoomed px; scrollWidth 149, clientWidth 149)
- … and 655 more in verify/dist/check-cases.md

**truncate end (normal): DOM clamps where Pretext does not** (665):

- text 100% · zoom 100%: t1530.truncate-end-normal.1.1 "Pro­jekt­ord­ner." (de, corpus) @ 58.375px (DOM text 57.9531 in 58.375, zoomed px; scrollWidth 58, clientWidth 58)
- text 100% · zoom 100%: t1568.truncate-end-normal.1.1 "ein­mal mit der Re­gie­as­sis­ten­tin" (de, corpus) @ 123.03125px (DOM text 110.3594 in 123.0313, zoomed px; scrollWidth 123, clientWidth 123)
- text 100% · zoom 100%: t1571.truncate-end-normal.1.1 "mit der Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 123.640625px (DOM text 90.9688 in 103.6406, zoomed px; scrollWidth 104, clientWidth 104)
- text 100% · zoom 100%: t1572.truncate-end-normal.1.1 "mit der Re­gie­as­sis­ten­tin durch­hö­ren." (de, corpus) @ 143.609375px (DOM text 136.0938 in 143.6094, zoomed px; scrollWidth 144, clientWidth 144)
- text 100% · zoom 100%: t1575.truncate-end-normal.1.1 "Re­gie­as­sis­ten­tin" (de, corpus + icon) @ 85.578125px (DOM text 48.1406 in 65.5781, zoomed px; scrollWidth 66, clientWidth 66)
- text 100% · zoom 100%: t1583.truncate-end-normal.1.1 "Da­ten­schutz­grund­ver­ord­nung ver­langt eine" (de, corpus + icon) @ 188.78125px (DOM text 153.2344 in 168.7813, zoomed px; scrollWidth 169, clientWidth 169)
- text 100% · zoom 100%: t1585.truncate-end-normal.1.1 "ver­langt eine" (de, corpus + icon) @ 81.390625px (DOM text 37.3594 in 61.3906, zoomed px; scrollWidth 61, clientWidth 61)
- text 100% · zoom 100%: t1592.truncate-end-normal.1.1 "Ein­wil­li­gungs­ver­wal­tung für" (de, corpus) @ 109.859375px (DOM text 104.2656 in 109.8594, zoomed px; scrollWidth 110, clientWidth 110)
- text 100% · zoom 100%: t1596.truncate-end-normal.1.1 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 104.046875px (DOM text 82 in 104.0469, zoomed px; scrollWidth 104, clientWidth 104)
- text 100% · zoom 100%: t1623.truncate-end-normal.1.1 "Haft­pflicht­ver­si­che­rungs­be­din­gun­gen" (de, corpus + icon) @ 168.8125px (DOM text 147.8438 in 148.8125, zoomed px; scrollWidth 149, clientWidth 149)
- … and 655 more in verify/dist/check-cases.md

**truncate end (normal): DOM does not cut where Pretext cuts** (377):

- text 115% · zoom 130%: t81.truncate-end-normal.1.15.word-tol "are really noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t85.truncate-end-normal.1.15.word-tol "really noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t89.truncate-end-normal.1.15.word-tol "noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t119.truncate-end-normal.1.15.word-tol "know" (en, corpus + icon) @ 69.6875px (DOM text 60.7188 in 60.7031, zoomed px; scrollWidth 47, clientWidth 47)
- text 115% · zoom 130%: t147.truncate-end-normal.1.15.word-tol "with" (en, corpus + icon) @ 59.375px (DOM text 47.3125 in 47.2969, zoomed px; scrollWidth 36, clientWidth 36)
- text 115% · zoom 130%: t351.truncate-end-normal.1.15.word-tol "can cache" (en, corpus + icon) @ 76.09375px (DOM text 69.0469 in 69.0313, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t355.truncate-end-normal.1.15.word-tol "cache" (en, corpus + icon) @ 76.09375px (DOM text 69.0469 in 69.0313, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t389.truncate-end-normal.1.15.word-tol "results. This" (en, corpus + icon) @ 86.46875px (DOM text 82.5313 in 82.5156, zoomed px; scrollWidth 63, clientWidth 63)
- text 115% · zoom 130%: t415.truncate-end-normal.1.15.word-tol "the best" (en, corpus + icon) @ 60.6875px (DOM text 49.0156 in 49, zoomed px; scrollWidth 38, clientWidth 38)
- text 115% · zoom 130%: t419.truncate-end-normal.1.15.word-tol "best" (en, corpus + icon) @ 60.6875px (DOM text 49.0156 in 49, zoomed px; scrollWidth 38, clientWidth 38)
- … and 367 more in verify/dist/check-cases.md

**near-miss lines: DOM at or over the 2px margin where Pretext is under it** (179):

- text 100% · zoom 100%: t252.lines.1.near+1.7885 "for." (en, corpus) @ 17.3125px (DOM 2.2656px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t252.lines.1.near+1.75 "for." (en, corpus) @ 17.265625px (DOM 2.2188px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t318.lines.1.near+1.7885 "key" (en, corpus) @ 19.90625px (DOM 2.1563px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t318.lines.1.near+1.75 "key" (en, corpus) @ 19.859375px (DOM 2.1094px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t360.lines.1.near+1.7885 "word" (en, corpus) @ 24.484375px (DOM 2.0781px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t360.lines.1.near+1.75 "word" (en, corpus) @ 24.4375px (DOM 2.0313px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t450.lines.1.near+1.7885 "for" (en, corpus) @ 17.3125px (DOM 2.2656px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t450.lines.1.near+1.75 "for" (en, corpus) @ 17.265625px (DOM 2.2188px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t768.lines.1.near+1.7885 "over in" (en, corpus) @ 29.71875px (DOM 2.4219px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t768.lines.1.near+1.75 "over in" (en, corpus) @ 29.671875px (DOM 2.375px to spare, Pretext 1.7578, zoomed px)
- … and 169 more in verify/dist/check-cases.md

**near-miss truncate end: DOM at or over the 2px margin where Pretext is under it** (179):

- text 100% · zoom 100%: t252.truncate-end.1.near+1.7885 "for." (en, corpus) @ 17.3125px (DOM 2.2656px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t252.truncate-end.1.near+1.75 "for." (en, corpus) @ 17.265625px (DOM 2.2188px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t318.truncate-end.1.near+1.7885 "key" (en, corpus) @ 19.90625px (DOM 2.1563px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t318.truncate-end.1.near+1.75 "key" (en, corpus) @ 19.859375px (DOM 2.1094px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t360.truncate-end.1.near+1.7885 "word" (en, corpus) @ 24.484375px (DOM 2.0781px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t360.truncate-end.1.near+1.75 "word" (en, corpus) @ 24.4375px (DOM 2.0313px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t450.truncate-end.1.near+1.7885 "for" (en, corpus) @ 17.3125px (DOM 2.2656px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t450.truncate-end.1.near+1.75 "for" (en, corpus) @ 17.265625px (DOM 2.2188px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t768.truncate-end.1.near+1.7885 "over in" (en, corpus) @ 29.71875px (DOM 2.4219px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t768.truncate-end.1.near+1.75 "over in" (en, corpus) @ 29.671875px (DOM 2.375px to spare, Pretext 1.7578, zoomed px)
- … and 169 more in verify/dist/check-cases.md

**near-miss as-is: DOM at or over the 2px margin where Pretext is under it** (153):

- text 100% · zoom 100%: t1542.as-is.1.near+1.2885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.28125px (DOM 2.4688px to spare, Pretext 1.2969, zoomed px)
- text 100% · zoom 100%: t1542.as-is.1.near+1.7885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.78125px (DOM 2.9688px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1542.as-is.1.near+1.75 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.734375px (DOM 2.9219px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t1662.as-is.1.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 264.609375px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1668.as-is.1.near+1.7885 "wer­den." (de, corpus) @ 63.140625px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1716.as-is.1.near+1.2885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.046875px (DOM 2.1719px to spare, Pretext 1.2891, zoomed px)
- text 100% · zoom 100%: t1716.as-is.1.near+1.7885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.546875px (DOM 2.6719px to spare, Pretext 1.7891, zoomed px)
- text 100% · zoom 100%: t1716.as-is.1.near+1.75 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.515625px (DOM 2.6406px to spare, Pretext 1.7578, zoomed px)
- text 100% · zoom 100%: t1896.as-is.1.near+1.7885 "Té­lé­char­ger l’in­té­gra­li­té" (fr, corpus + icon) @ 199.4375px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1944.as-is.1.near+1.7885 "en­vi­ron­ne­men­tale" (fr, corpus + icon) @ 157.328125px (DOM 2.0313px to spare, Pretext 1.7969, zoomed px)
- … and 143 more in verify/dist/check-cases.md

**near-miss truncate middle: DOM at or over the 2px margin where Pretext is under it** (153):

- text 100% · zoom 100%: t1542.truncate-middle.1.near+1.2885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.28125px (DOM 2.4688px to spare, Pretext 1.2969, zoomed px)
- text 100% · zoom 100%: t1542.truncate-middle.1.near+1.7885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.78125px (DOM 2.9688px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1542.truncate-middle.1.near+1.75 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 203.734375px (DOM 2.9219px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t1662.truncate-middle.1.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 264.609375px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1668.truncate-middle.1.near+1.7885 "wer­den." (de, corpus) @ 63.140625px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1716.truncate-middle.1.near+1.2885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.046875px (DOM 2.1719px to spare, Pretext 1.2891, zoomed px)
- text 100% · zoom 100%: t1716.truncate-middle.1.near+1.7885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.546875px (DOM 2.6719px to spare, Pretext 1.7891, zoomed px)
- text 100% · zoom 100%: t1716.truncate-middle.1.near+1.75 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 262.515625px (DOM 2.6406px to spare, Pretext 1.7578, zoomed px)
- text 100% · zoom 100%: t1896.truncate-middle.1.near+1.7885 "Té­lé­char­ger l’in­té­gra­li­té" (fr, corpus + icon) @ 199.4375px (DOM 2.0625px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1944.truncate-middle.1.near+1.7885 "en­vi­ron­ne­men­tale" (fr, corpus + icon) @ 157.328125px (DOM 2.0313px to spare, Pretext 1.7969, zoomed px)
- … and 143 more in verify/dist/check-cases.md

**lines (normal): DOM 2 lines, Pretext 3 (and a line past the box, or more than 2)** (144):

- text 115% · zoom 130%: t415.lines-normal.1.15.word-tol "the best" (en, corpus + icon) @ 60.6875px (DOM text 49.0156 in 49, zoomed px; scrollWidth 38, clientWidth 38)
- text 115% · zoom 130%: t785.lines-normal.1.15.word-tol "ever since." (en, corpus + icon) @ 74.53125px (DOM text 67.0156 in 67, zoomed px; scrollWidth 52, clientWidth 52)
- text 115% · zoom 130%: t965.lines-normal.1.15.word-tol "all judgements," (en, corpus + icon) @ 130.109375px (DOM text 139.2656 in 139.25, zoomed px; scrollWidth 107, clientWidth 107)
- text 115% · zoom 130%: t1099.lines-normal.1.15.word-tol "the victim" (en, corpus + icon) @ 74.859375px (DOM text 67.4375 in 67.4219, zoomed px; scrollWidth 52, clientWidth 52)
- text 115% · zoom 130%: t1113.lines-normal.1.15.word-tol "of not" (en, corpus + icon) @ 50.890625px (DOM text 36.2813 in 36.2656, zoomed px; scrollWidth 28, clientWidth 28)
- text 115% · zoom 130%: t1165.lines-normal.1.15.word-tol "Most of the confidences" (en, corpus + icon) @ 130.421875px (DOM text 139.6719 in 139.6563, zoomed px; scrollWidth 107, clientWidth 107)
- text 115% · zoom 130%: t1199.lines-normal.1.15.word-tol "feigned sleep, preoccupation," (en, corpus + icon) @ 153.921875px (DOM text 170.2188 in 170.2031, zoomed px; scrollWidth 131, clientWidth 131)
- text 115% · zoom 130%: t1203.lines-normal.1.15.word-tol "sleep, preoccupation," (en, corpus + icon) @ 153.921875px (DOM text 170.2188 in 170.2031, zoomed px; scrollWidth 131, clientWidth 131)
- text 115% · zoom 130%: t1978.lines-normal.1.15.word-tol "ap­pels" (fr, corpus + icon) @ 59.125px (DOM text 46.9844 in 46.9688, zoomed px; scrollWidth 36, clientWidth 36)
- text 115% · zoom 130%: t2088.lines-normal.1.15.word-tol "don­nées" (fr, corpus + icon) @ 65px (DOM text 54.625 in 54.6094, zoomed px; scrollWidth 42, clientWidth 42)
- … and 134 more in verify/dist/check-cases.md

**near-miss as-is: DOM under the 2px margin where Pretext is at or over it** (135):

- text 100% · zoom 100%: t1650.as-is.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 280.59375px (DOM 1.625px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t1692.as-is.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 213.625px (DOM 1.9219px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t1764.as-is.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 178.59375px (DOM 1.4219px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t2118.as-is.1.near+2.25 "de passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 308.828125px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2124.as-is.1.near+2.25 "passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 285.203125px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2130.as-is.1.near+2.25 ": un cour­riel de confir­ma­tion vous" (fr, corpus + icon) @ 276.21875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t2136.as-is.1.near+2.25 "un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 226.4375px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2142.as-is.1.near+2.25 "cour­riel de confir­ma­tion" (fr, corpus + icon) @ 203.015625px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1584.as-is.1.15.near+2.25 "ver­langt" (de, corpus) @ 72.828125px (DOM 1.9688px to spare, Pretext 2.265, zoomed px)
- text 115% · zoom 100%: t1596.as-is.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 209.5px (DOM 1.9531px to spare, Pretext 2.2557, zoomed px)
- … and 125 more in verify/dist/check-cases.md

**near-miss truncate middle: DOM under the 2px margin where Pretext is at or over it** (135):

- text 100% · zoom 100%: t1650.truncate-middle.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 280.59375px (DOM 1.625px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t1692.truncate-middle.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 213.625px (DOM 1.9219px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t1764.truncate-middle.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 178.59375px (DOM 1.4219px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t2118.truncate-middle.1.near+2.25 "de passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 308.828125px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2124.truncate-middle.1.near+2.25 "passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 285.203125px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2130.truncate-middle.1.near+2.25 ": un cour­riel de confir­ma­tion vous" (fr, corpus + icon) @ 276.21875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 100% · zoom 100%: t2136.truncate-middle.1.near+2.25 "un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 226.4375px (DOM 1.75px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2142.truncate-middle.1.near+2.25 "cour­riel de confir­ma­tion" (fr, corpus + icon) @ 203.015625px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1584.truncate-middle.1.15.near+2.25 "ver­langt" (de, corpus) @ 72.828125px (DOM 1.9688px to spare, Pretext 2.265, zoomed px)
- text 115% · zoom 100%: t1596.truncate-middle.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 209.5px (DOM 1.9531px to spare, Pretext 2.2557, zoomed px)
- … and 125 more in verify/dist/check-cases.md

**lines (normal): DOM 1 lines, Pretext 2 (and a line past the box, or more than 2)** (128):

- text 115% · zoom 130%: t119.lines-normal.1.15.word-tol "know" (en, corpus + icon) @ 69.6875px (DOM text 60.7188 in 60.7031, zoomed px; scrollWidth 47, clientWidth 47)
- text 115% · zoom 130%: t147.lines-normal.1.15.word-tol "with" (en, corpus + icon) @ 59.375px (DOM text 47.3125 in 47.2969, zoomed px; scrollWidth 36, clientWidth 36)
- text 115% · zoom 130%: t419.lines-normal.1.15.word-tol "best" (en, corpus + icon) @ 60.6875px (DOM text 49.0156 in 49, zoomed px; scrollWidth 38, clientWidth 38)
- text 115% · zoom 130%: t551.lines-normal.1.15.word-tol "not" (en, corpus + icon) @ 50.890625px (DOM text 36.2813 in 36.2656, zoomed px; scrollWidth 28, clientWidth 28)
- text 115% · zoom 130%: t631.lines-normal.1.15.word-tol "hyphenation." (en, corpus + icon) @ 135.625px (DOM text 146.4375 in 146.4219, zoomed px; scrollWidth 113, clientWidth 113)
- text 115% · zoom 130%: t951.lines-normal.1.15.word-tol "to" (en, corpus + icon) @ 39.84375px (DOM text 21.9219 in 21.9063, zoomed px; scrollWidth 17, clientWidth 17)
- text 115% · zoom 130%: t971.lines-normal.1.15.word-tol "judgements," (en, corpus + icon) @ 130.109375px (DOM text 139.2656 in 139.25, zoomed px; scrollWidth 107, clientWidth 107)
- text 115% · zoom 130%: t1125.lines-normal.1.15.word-tol "few" (en, corpus + icon) @ 54.6875px (DOM text 41.2188 in 41.2031, zoomed px; scrollWidth 32, clientWidth 32)
- text 115% · zoom 130%: t1173.lines-normal.1.15.word-tol "confidences" (en, corpus + icon) @ 130.421875px (DOM text 139.6719 in 139.6563, zoomed px; scrollWidth 107, clientWidth 107)
- text 115% · zoom 130%: t1207.lines-normal.1.15.word-tol "preoccupation," (en, corpus + icon) @ 153.921875px (DOM text 170.2188 in 170.2031, zoomed px; scrollWidth 131, clientWidth 131)
- … and 118 more in verify/dist/check-cases.md

**near-miss lines: DOM under the 2px margin where Pretext is at or over it** (95):

- text 100% · zoom 100%: t1650.lines.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 146.25px (DOM 1.875px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1692.lines.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 113.609375px (DOM 1.9219px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1764.lines.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 93.875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1596.lines.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 121.84375px (DOM 1.9688px to spare, Pretext 2.2602, zoomed px)
- text 115% · zoom 100%: t1650.lines.1.15.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 167.765625px (DOM 1.8125px to spare, Pretext 2.2589, zoomed px)
- text 115% · zoom 100%: t1692.lines.1.15.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 130.234375px (DOM 1.8594px to spare, Pretext 2.2454, zoomed px)
- text 115% · zoom 100%: t1764.lines.1.15.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 107.5625px (DOM 1.6719px to spare, Pretext 2.2475, zoomed px)
- text 115% · zoom 100%: t1836.lines.1.15.near+2.25 ": vé­ri­fiez votre connexion in­ter­net et" (fr, corpus + icon) @ 208.703125px (DOM 1.9531px to spare, Pretext 2.2551, zoomed px)
- text 115% · zoom 100%: t1848.lines.1.15.near+2.25 "connexion in­ter­net" (fr, corpus + icon) @ 107.703125px (DOM 1.9688px to spare, Pretext 2.2597, zoomed px)
- text 115% · zoom 100%: t1926.lines.1.15.near+2.25 "au­to­ri­sa­tions d’ac­cès aux ré­per­toires" (fr, corpus + icon) @ 192.390625px (DOM 1.9688px to spare, Pretext 2.259, zoomed px)
- … and 85 more in verify/dist/check-cases.md

**near-miss truncate end: DOM under the 2px margin where Pretext is at or over it** (95):

- text 100% · zoom 100%: t1650.truncate-end.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 146.25px (DOM 1.875px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1692.truncate-end.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 113.609375px (DOM 1.9219px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1764.truncate-end.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 93.875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1596.truncate-end.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 121.84375px (DOM 1.9688px to spare, Pretext 2.2602, zoomed px)
- text 115% · zoom 100%: t1650.truncate-end.1.15.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 167.765625px (DOM 1.8125px to spare, Pretext 2.2589, zoomed px)
- text 115% · zoom 100%: t1692.truncate-end.1.15.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 130.234375px (DOM 1.8594px to spare, Pretext 2.2454, zoomed px)
- text 115% · zoom 100%: t1764.truncate-end.1.15.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 107.5625px (DOM 1.6719px to spare, Pretext 2.2475, zoomed px)
- text 115% · zoom 100%: t1836.truncate-end.1.15.near+2.25 ": vé­ri­fiez votre connexion in­ter­net et" (fr, corpus + icon) @ 208.703125px (DOM 1.9531px to spare, Pretext 2.2551, zoomed px)
- text 115% · zoom 100%: t1848.truncate-end.1.15.near+2.25 "connexion in­ter­net" (fr, corpus + icon) @ 107.703125px (DOM 1.9688px to spare, Pretext 2.2597, zoomed px)
- text 115% · zoom 100%: t1926.truncate-end.1.15.near+2.25 "au­to­ri­sa­tions d’ac­cès aux ré­per­toires" (fr, corpus + icon) @ 192.390625px (DOM 1.9688px to spare, Pretext 2.259, zoomed px)
- … and 85 more in verify/dist/check-cases.md

**truncate end (normal): DOM cuts a line at the box where Pretext does not** (95):

- text 100% · zoom 130%: t369.truncate-end-normal.1.word-tol "separately" (en, corpus + icon) @ 99.046875px (DOM text 102.7813 in 102.75, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t370.truncate-end-normal.1.word-tol "separately from" (en, corpus) @ 79.046875px (DOM text 102.7813 in 102.75, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t429.truncate-end-normal.1.word-tol "Performance" (en, corpus + icon) @ 117.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t430.truncate-end-normal.1.word-tol "Performance is" (en, corpus) @ 97.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t431.truncate-end-normal.1.word-tol "Performance is critical" (en, corpus + icon) @ 117.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t432.truncate-end-normal.1.word-tol "Performance is critical for" (en, corpus) @ 97.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t561.truncate-end-normal.1.word-tol "for real applications." (en, corpus + icon) @ 115.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t563.truncate-end-normal.1.word-tol "real applications." (en, corpus + icon) @ 115.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t564.truncate-end-normal.1.word-tol "applications." (en, corpus) @ 95.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t626.truncate-end-normal.1.word-tol "handle hyphenation." (en, corpus) @ 97.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- … and 85 more in verify/dist/check-cases.md

**near-miss lines (normal): DOM under the 2px margin where Pretext is at or over it** (90):

- text 100% · zoom 100%: t1650.lines-normal.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 146.25px (DOM 1.875px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1692.lines-normal.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 113.609375px (DOM 1.9219px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1764.lines-normal.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 93.875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1596.lines-normal.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 121.84375px (DOM 1.9688px to spare, Pretext 2.2602, zoomed px)
- text 115% · zoom 100%: t1650.lines-normal.1.15.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 167.765625px (DOM 1.8125px to spare, Pretext 2.2589, zoomed px)
- text 115% · zoom 100%: t1692.lines-normal.1.15.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 130.234375px (DOM 1.8594px to spare, Pretext 2.2454, zoomed px)
- text 115% · zoom 100%: t1764.lines-normal.1.15.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 107.5625px (DOM 1.6719px to spare, Pretext 2.2475, zoomed px)
- text 115% · zoom 100%: t1836.lines-normal.1.15.near+2.25 ": vé­ri­fiez votre connexion in­ter­net et" (fr, corpus + icon) @ 208.703125px (DOM 1.9531px to spare, Pretext 2.2551, zoomed px)
- text 115% · zoom 100%: t1926.lines-normal.1.15.near+2.25 "au­to­ri­sa­tions d’ac­cès aux ré­per­toires" (fr, corpus + icon) @ 192.390625px (DOM 1.9688px to spare, Pretext 2.259, zoomed px)
- text 115% · zoom 100%: t1932.lines-normal.1.15.near+2.25 "aux ré­per­toires" (fr, corpus + icon) @ 102.53125px (DOM 1.9688px to spare, Pretext 2.2603, zoomed px)
- … and 80 more in verify/dist/check-cases.md

**near-miss truncate end (normal): DOM under the 2px margin where Pretext is at or over it** (90):

- text 100% · zoom 100%: t1650.truncate-end-normal.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 146.25px (DOM 1.875px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1692.truncate-end-normal.1.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 113.609375px (DOM 1.9219px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1764.truncate-end-normal.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 93.875px (DOM 1.75px to spare, Pretext 2.25, zoomed px)
- text 115% · zoom 100%: t1596.truncate-end-normal.1.15.near+2.25 "für alle Be­nut­zer­kon­ten." (de, corpus) @ 121.84375px (DOM 1.9688px to spare, Pretext 2.2602, zoomed px)
- text 115% · zoom 100%: t1650.truncate-end-normal.1.15.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 167.765625px (DOM 1.8125px to spare, Pretext 2.2589, zoomed px)
- text 115% · zoom 100%: t1692.truncate-end-normal.1.15.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 130.234375px (DOM 1.8594px to spare, Pretext 2.2454, zoomed px)
- text 115% · zoom 100%: t1764.truncate-end-normal.1.15.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 107.5625px (DOM 1.6719px to spare, Pretext 2.2475, zoomed px)
- text 115% · zoom 100%: t1836.truncate-end-normal.1.15.near+2.25 ": vé­ri­fiez votre connexion in­ter­net et" (fr, corpus + icon) @ 208.703125px (DOM 1.9531px to spare, Pretext 2.2551, zoomed px)
- text 115% · zoom 100%: t1926.truncate-end-normal.1.15.near+2.25 "au­to­ri­sa­tions d’ac­cès aux ré­per­toires" (fr, corpus + icon) @ 192.390625px (DOM 1.9688px to spare, Pretext 2.259, zoomed px)
- text 115% · zoom 100%: t1932.truncate-end-normal.1.15.near+2.25 "aux ré­per­toires" (fr, corpus + icon) @ 102.53125px (DOM 1.9688px to spare, Pretext 2.2603, zoomed px)
- … and 80 more in verify/dist/check-cases.md

**lines (normal): DOM 2 lines, Pretext 2 (and a line past the box, or more than 2)** (88):

- text 115% · zoom 130%: t81.lines-normal.1.15.word-tol "are really noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t85.lines-normal.1.15.word-tol "really noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t351.lines-normal.1.15.word-tol "can cache" (en, corpus + icon) @ 76.09375px (DOM text 69.0469 in 69.0313, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t389.lines-normal.1.15.word-tol "results. This" (en, corpus + icon) @ 86.46875px (DOM text 82.5313 in 82.5156, zoomed px; scrollWidth 63, clientWidth 63)
- text 115% · zoom 130%: t557.lines-normal.1.15.word-tol "useful for" (en, corpus + icon) @ 76.421875px (DOM text 69.4688 in 69.4531, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t633.lines-normal.1.15.word-tol "hyphenation. Is that" (en, corpus + icon) @ 135.625px (DOM text 146.4375 in 146.4219, zoomed px; scrollWidth 113, clientWidth 113)
- text 115% · zoom 130%: t753.lines-normal.1.15.word-tol "been turning" (en, corpus + icon) @ 84.546875px (DOM text 80.0313 in 80.0156, zoomed px; scrollWidth 62, clientWidth 62)
- text 115% · zoom 130%: t761.lines-normal.1.15.word-tol "turning over" (en, corpus + icon) @ 84.546875px (DOM text 80.0313 in 80.0156, zoomed px; scrollWidth 62, clientWidth 62)
- text 115% · zoom 130%: t911.lines-normal.1.15.word-tol "had the advantages" (en, corpus + icon) @ 124.234375px (DOM text 131.625 in 131.6094, zoomed px; scrollWidth 101, clientWidth 101)
- text 115% · zoom 130%: t915.lines-normal.1.15.word-tol "the advantages" (en, corpus + icon) @ 124.234375px (DOM text 131.625 in 131.6094, zoomed px; scrollWidth 101, clientWidth 101)
- … and 78 more in verify/dist/check-cases.md

**near-miss shrinkTo: DOM at or over the 2px margin where Pretext is under it** (70):

- text 100% · zoom 100%: t1542.shrinkTo.1.near+1.2885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 152.78125px (DOM 2.1719px to spare, Pretext 1.293, zoomed px)
- text 100% · zoom 100%: t1542.shrinkTo.1.near+1.7885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 153.28125px (DOM 2.6719px to spare, Pretext 1.793, zoomed px)
- text 100% · zoom 100%: t1542.shrinkTo.1.near+1.75 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 153.25px (DOM 2.6406px to spare, Pretext 1.7617, zoomed px)
- text 100% · zoom 100%: t1716.shrinkTo.1.near+1.7885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 197.359375px (DOM 2.4531px to spare, Pretext 1.791, zoomed px)
- text 100% · zoom 100%: t1716.shrinkTo.1.near+1.75 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 197.328125px (DOM 2.4219px to spare, Pretext 1.7598, zoomed px)
- text 100% · zoom 100%: t1962.shrinkTo.1.near+1.7885 "de­ve­nue" (fr, corpus + icon) @ 70.828125px (DOM 2.0313px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t2268.shrinkTo.1.near+1.2885 "Nebenrollen-Takes" (de, button + icon) @ 128.953125px (DOM 2.1719px to spare, Pretext 1.2988, zoomed px)
- text 100% · zoom 100%: t2268.shrinkTo.1.near+1.7885 "Nebenrollen-Takes" (de, button + icon) @ 129.453125px (DOM 2.6719px to spare, Pretext 1.7988, zoomed px)
- text 100% · zoom 100%: t2268.shrinkTo.1.near+1.75 "Nebenrollen-Takes" (de, button + icon) @ 129.40625px (DOM 2.625px to spare, Pretext 1.752, zoomed px)
- text 115% · zoom 100%: t1542.shrinkTo.1.15.near+1.2885 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 175.46875px (DOM 2.3125px to spare, Pretext 1.297, zoomed px)
- … and 60 more in verify/dist/check-cases.md

**near-miss shrinkTo: DOM under the 2px margin where Pretext is at or over it** (66):

- text 100% · zoom 100%: t1650.shrinkTo.1.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 211.015625px (DOM 1.7813px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t1764.shrinkTo.1.near+2.25 "du im Mit­ar­bei­ter­por­tal." (de, corpus) @ 134.515625px (DOM 1.625px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2118.shrinkTo.1.near+2.25 "de passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 237.1875px (DOM 1.875px to spare, Pretext 2.2598, zoomed px)
- text 100% · zoom 100%: t2124.shrinkTo.1.near+2.25 "passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 219.46875px (DOM 1.875px to spare, Pretext 2.2598, zoomed px)
- text 100% · zoom 100%: t2130.shrinkTo.1.near+2.25 ": un cour­riel de confir­ma­tion vous" (fr, corpus + icon) @ 212.734375px (DOM 1.875px to spare, Pretext 2.2578, zoomed px)
- text 100% · zoom 100%: t2136.shrinkTo.1.near+2.25 "un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 175.390625px (DOM 1.875px to spare, Pretext 2.2559, zoomed px)
- text 100% · zoom 100%: t2142.shrinkTo.1.near+2.25 "cour­riel de confir­ma­tion" (fr, corpus + icon) @ 157.828125px (DOM 1.875px to spare, Pretext 2.2539, zoomed px)
- text 115% · zoom 100%: t1650.shrinkTo.1.15.near+2.25 "an­hal­ten­der Hoch­was­ser­war­nun­gen." (de, corpus) @ 242.28125px (DOM 1.7188px to spare, Pretext 2.2641, zoomed px)
- text 115% · zoom 100%: t1692.shrinkTo.1.15.near+2.25 "wäh­rend der Nacht­ar­bei­ten." (de, corpus) @ 184.53125px (DOM 1.9688px to spare, Pretext 2.2616, zoomed px)
- text 115% · zoom 100%: t2118.shrinkTo.1.15.near+2.25 "de passe : un cour­riel de confir­ma­tion" (fr, corpus + icon) @ 272.375px (DOM 1.8281px to spare, Pretext 2.264, zoomed px)
- … and 56 more in verify/dist/check-cases.md

**near-miss lines (normal): DOM at or over the 2px margin where Pretext is under it** (55):

- text 100% · zoom 100%: t1662.lines-normal.1.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 138.53125px (DOM 2.0625px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t1716.lines-normal.1.near+1.7885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 144.765625px (DOM 2.4219px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1716.lines-normal.1.near+1.75 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 144.71875px (DOM 2.375px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t1896.lines-normal.1.near+1.7885 "Té­lé­char­ger l’in­té­gra­li­té" (fr, corpus + icon) @ 112.1875px (DOM 2.0625px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t1962.lines-normal.1.near+2.25 "de­ve­nue" (fr, corpus + icon) @ 64.8125px (DOM 2.25px to spare, Pretext 1.9453, zoomed px)
- text 100% · zoom 100%: t2034.lines-normal.1.near+1.7885 "a été sou­le­vée" (fr, corpus + icon) @ 89.84375px (DOM 2.1094px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t2034.lines-normal.1.near+1.75 "a été sou­le­vée" (fr, corpus + icon) @ 89.796875px (DOM 2.0625px to spare, Pretext 1.7578, zoomed px)
- text 100% · zoom 100%: t2160.lines-normal.1.near+1.7885 "a été en­voyé." (fr, corpus + icon) @ 81.15625px (DOM 2.0313px to spare, Pretext 1.7969, zoomed px)
- text 115% · zoom 100%: t1590.lines-normal.1.15.near+2.25 "nach­voll­zieh­ba­re Ein­wil­li­gungs­ver­wal­tung" (de, corpus) @ 187.921875px (DOM 2.25px to spare, Pretext 1.9864, zoomed px)
- text 115% · zoom 100%: t1662.lines-normal.1.15.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 158.953125px (DOM 2.0938px to spare, Pretext 1.7977, zoomed px)
- … and 45 more in verify/dist/check-cases.md

**near-miss truncate end (normal): DOM at or over the 2px margin where Pretext is under it** (55):

- text 100% · zoom 100%: t1662.truncate-end-normal.1.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 138.53125px (DOM 2.0625px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t1716.truncate-end-normal.1.near+1.7885 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 144.765625px (DOM 2.4219px to spare, Pretext 1.7969, zoomed px)
- text 100% · zoom 100%: t1716.truncate-end-normal.1.near+1.75 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 144.71875px (DOM 2.375px to spare, Pretext 1.75, zoomed px)
- text 100% · zoom 100%: t1896.truncate-end-normal.1.near+1.7885 "Té­lé­char­ger l’in­té­gra­li­té" (fr, corpus + icon) @ 112.1875px (DOM 2.0625px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t1962.truncate-end-normal.1.near+2.25 "de­ve­nue" (fr, corpus + icon) @ 64.8125px (DOM 2.25px to spare, Pretext 1.9453, zoomed px)
- text 100% · zoom 100%: t2034.truncate-end-normal.1.near+1.7885 "a été sou­le­vée" (fr, corpus + icon) @ 89.84375px (DOM 2.1094px to spare, Pretext 1.8047, zoomed px)
- text 100% · zoom 100%: t2034.truncate-end-normal.1.near+1.75 "a été sou­le­vée" (fr, corpus + icon) @ 89.796875px (DOM 2.0625px to spare, Pretext 1.7578, zoomed px)
- text 100% · zoom 100%: t2160.truncate-end-normal.1.near+1.7885 "a été en­voyé." (fr, corpus + icon) @ 81.15625px (DOM 2.0313px to spare, Pretext 1.7969, zoomed px)
- text 115% · zoom 100%: t1590.truncate-end-normal.1.15.near+2.25 "nach­voll­zieh­ba­re Ein­wil­li­gungs­ver­wal­tung" (de, corpus) @ 187.921875px (DOM 2.25px to spare, Pretext 1.9864, zoomed px)
- text 115% · zoom 100%: t1662.truncate-end-normal.1.15.near+1.7885 "konn­ten nicht ge­spei­chert wer­den." (de, corpus) @ 158.953125px (DOM 2.0938px to spare, Pretext 1.7977, zoomed px)
- … and 45 more in verify/dist/check-cases.md

**lines (normal): DOM 2 lines, one wider than the box, Pretext 2** (51):

- text 100% · zoom 130%: t370.lines-normal.1.word-tol "separately from" (en, corpus) @ 79.046875px (DOM text 102.7813 in 102.75, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t430.lines-normal.1.word-tol "Performance is" (en, corpus) @ 97.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t431.lines-normal.1.word-tol "Performance is critical" (en, corpus + icon) @ 117.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t561.lines-normal.1.word-tol "for real applications." (en, corpus + icon) @ 115.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t563.lines-normal.1.word-tol "real applications." (en, corpus + icon) @ 115.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t632.lines-normal.1.word-tol "hyphenation. Is" (en, corpus) @ 97.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t633.lines-normal.1.word-tol "hyphenation. Is that" (en, corpus + icon) @ 117.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t634.lines-normal.1.word-tol "hyphenation. Is that on" (en, corpus) @ 97.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t682.lines-normal.1.word-tol "vulnerable years" (en, corpus) @ 79.09375px (DOM text 102.8438 in 102.8125, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t788.lines-normal.1.word-tol "“Whenever you" (en, corpus) @ 84.078125px (DOM text 109.3281 in 109.2969, zoomed px; scrollWidth 84, clientWidth 84)
- … and 41 more in verify/dist/check-cases.md

**shrinkTo: DOM also fits at the next size** (47):

- text 115% · zoom 130%: t1533.shrinkTo.1.15.1 "Bit­te die Ne­ben­rol­len-Ta­kes" (de, corpus + icon) @ 203.6875px (DOM text 233.5781 in 234.8906, next size 234.3906, zoomed px; scrollWidth 181, clientWidth 181)
- text 115% · zoom 130%: t1537.shrinkTo.1.15.1 "die Ne­ben­rol­len-Ta­kes" (de, corpus + icon) @ 170.5px (DOM text 190.4375 in 191.75, next size 191.0938, zoomed px; scrollWidth 148, clientWidth 148)
- text 115% · zoom 130%: t1540.shrinkTo.1.15.1 "Ne­ben­rol­len-Ta­kes" (de, corpus) @ 123.78125px (DOM text 159.6094 in 160.9063, next size 160.1563, zoomed px; scrollWidth 124, clientWidth 124)
- text 115% · zoom 130%: t1668.shrinkTo.1.15.1 "wer­den." (de, corpus) @ 52.90625px (DOM text 68.4844 in 68.7656, next size 68.7188, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t1717.shrinkTo.1.15.1 "in­be­grif­fen." (de, corpus + icon) @ 98.109375px (DOM text 96.9375 in 97.6406, next size 97.2813, zoomed px; scrollWidth 75, clientWidth 75)
- text 115% · zoom 130%: t1804.shrinkTo.1.15.1 "?" (fr, corpus + icon) @ 30.0625px (DOM text 9.1719 in 9.1875, next size 9.2031, zoomed px; scrollWidth 7, clientWidth 7)
- text 115% · zoom 130%: t1962.shrinkTo.1.15.1 "de­ve­nue" (fr, corpus + icon) @ 79.375px (DOM text 72.9531 in 73.2969, next size 73.2031, zoomed px; scrollWidth 56, clientWidth 56)
- text 115% · zoom 130%: t2041.shrinkTo.1.15.1 "sou­le­vée" (fr, corpus) @ 58.671875px (DOM text 75.9375 in 76.2656, next size 76.2031, zoomed px; scrollWidth 59, clientWidth 59)
- text 115% · zoom 130%: t2162.shrinkTo.1.15.1 "en­voyé." (fr, corpus + icon) @ 74.1875px (DOM text 66.2969 in 66.5469, next size 66.5156, zoomed px; scrollWidth 51, clientWidth 51)
- text 115% · zoom 130%: t2268.shrinkTo.1.15.1 "Nebenrollen-Takes" (de, button + icon) @ 146.78125px (DOM text 159.6094 in 160.9219, next size 160.1563, zoomed px; scrollWidth 124, clientWidth 124)
- … and 37 more in verify/dist/check-cases.md

**lines: DOM 2 lines, Pretext 3 (and a line past the box, or more than 2)** (42):

- text 115% · zoom 130%: t1327.lines.1.15.1 "still" (en, corpus + icon) @ 38.71875px (DOM text 20.4531 in 20.4375, zoomed px; scrollWidth 16, clientWidth 16)
- text 115% · zoom 130%: t1611.lines.1.15.1 "bis" (de, corpus + icon) @ 37.15625px (DOM text 18.4219 in 18.4063, zoomed px; scrollWidth 14, clientWidth 14)
- text 115% · zoom 130%: t2300.lines.1.15.1 "Notifications" (en, uppercase tab) @ 63.65625px (DOM text 82.7656 in 82.75, zoomed px; scrollWidth 64, clientWidth 64)
- text 130% · zoom 130%: t2299.lines.1.3.1 "Billing" (en, uppercase tab) @ 37.296875px (DOM text 48.5 in 48.4844, zoomed px; scrollWidth 37, clientWidth 37)
- text 100% · zoom 100%: t768.lines.1.near-0.5 "over in" (en, corpus) @ 27.421875px (DOM text 27.2969 in 27.4219, zoomed px; scrollWidth 27, clientWidth 27)
- text 100% · zoom 100%: t816.lines.1.near-0.5 "anyone,” he" (en, corpus) @ 45.984375px (DOM text 45.9375 in 45.9844, zoomed px; scrollWidth 46, clientWidth 46)
- text 100% · zoom 100%: t1716.lines.1.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 142.46875px (DOM text 142.3438 in 142.4688, zoomed px; scrollWidth 142, clientWidth 142)
- text 100% · zoom 100%: t1980.lines.1.near-0.5 "d’offres." (fr, corpus + icon) @ 53.828125px (DOM text 33.7813 in 33.8281, zoomed px; scrollWidth 34, clientWidth 34)
- text 115% · zoom 100%: t252.lines.1.15.near-0.5 "for." (en, corpus) @ 17.34375px (DOM text 17.2969 in 17.3438, zoomed px; scrollWidth 17, clientWidth 17)
- text 115% · zoom 100%: t450.lines.1.15.near-0.5 "for" (en, corpus) @ 17.34375px (DOM text 17.2969 in 17.3438, zoomed px; scrollWidth 17, clientWidth 17)
- … and 32 more in verify/dist/check-cases.md

**truncate end: DOM does not clamp where Pretext cuts** (42):

- text 115% · zoom 130%: t1327.truncate-end.1.15.1 "still" (en, corpus + icon) @ 38.71875px
- text 115% · zoom 130%: t1611.truncate-end.1.15.1 "bis" (de, corpus + icon) @ 37.15625px
- text 115% · zoom 130%: t2300.truncate-end.1.15.1 "Notifications" (en, uppercase tab) @ 63.65625px
- text 130% · zoom 130%: t2299.truncate-end.1.3.1 "Billing" (en, uppercase tab) @ 37.296875px
- text 100% · zoom 100%: t768.truncate-end.1.near-0.5 "over in" (en, corpus) @ 27.421875px
- text 100% · zoom 100%: t816.truncate-end.1.near-0.5 "anyone,” he" (en, corpus) @ 45.984375px
- text 100% · zoom 100%: t1716.truncate-end.1.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 142.46875px
- text 100% · zoom 100%: t1980.truncate-end.1.near-0.5 "d’offres." (fr, corpus + icon) @ 53.828125px
- text 115% · zoom 100%: t252.truncate-end.1.15.near-0.5 "for." (en, corpus) @ 17.34375px
- text 115% · zoom 100%: t450.truncate-end.1.15.near-0.5 "for" (en, corpus) @ 17.34375px
- … and 32 more in verify/dist/check-cases.md

**as-is: DOM fits where Pretext overflows** (27):

- text 115% · zoom 130%: t2288.as-is.1.15.1 "Straße" (de, uppercase tab) @ 71.25px (DOM text 92.6406 in 92.625, zoomed px; scrollWidth 71, clientWidth 71)
- text 115% · zoom 130%: t2290.as-is.1.15.1 "Größe" (de, uppercase tab) @ 63.78125px (DOM text 82.9219 in 82.9063, zoomed px; scrollWidth 64, clientWidth 64)
- text 115% · zoom 130%: t2296.as-is.1.15.1 "Équipe" (fr, uppercase tab) @ 57.5px (DOM text 74.7656 in 74.75, zoomed px; scrollWidth 58, clientWidth 58)
- text 100% · zoom 100%: t1542.as-is.1.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 201.484375px (DOM text 200.8125 in 201.4844, zoomed px; scrollWidth 201, clientWidth 201)
- text 100% · zoom 100%: t1716.as-is.1.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 260.265625px (DOM text 259.875 in 260.2656, zoomed px; scrollWidth 260, clientWidth 260)
- text 100% · zoom 100%: t2268.as-is.1.near-0.5 "Nebenrollen-Takes" (de, button + icon) @ 163.046875px (DOM text 142.3594 in 143.0469, zoomed px; scrollWidth 143, clientWidth 143)
- text 115% · zoom 100%: t1542.as-is.1.15.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 231.671875px (DOM text 230.8125 in 231.6719, zoomed px; scrollWidth 232, clientWidth 232)
- text 115% · zoom 100%: t1716.as-is.1.15.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 299.21875px (DOM text 298.7031 in 299.2188, zoomed px; scrollWidth 299, clientWidth 299)
- text 115% · zoom 100%: t2268.as-is.1.15.near-0.5 "Nebenrollen-Takes" (de, button + icon) @ 187.5px (DOM text 163.6406 in 164.5, zoomed px; scrollWidth 165, clientWidth 165)
- text 130% · zoom 100%: t1542.as-is.1.3.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 262.046875px (DOM text 261.0156 in 262.0469, zoomed px; scrollWidth 262, clientWidth 262)
- … and 17 more in verify/dist/check-cases.md

**truncate middle: DOM fits where Pretext overflows** (27):

- text 115% · zoom 130%: t2288.truncate-middle.1.15.1 "Straße" (de, uppercase tab) @ 71.25px (DOM text 92.6406 in 92.625, zoomed px; scrollWidth 71, clientWidth 71)
- text 115% · zoom 130%: t2290.truncate-middle.1.15.1 "Größe" (de, uppercase tab) @ 63.78125px (DOM text 82.9219 in 82.9063, zoomed px; scrollWidth 64, clientWidth 64)
- text 115% · zoom 130%: t2296.truncate-middle.1.15.1 "Équipe" (fr, uppercase tab) @ 57.5px (DOM text 74.7656 in 74.75, zoomed px; scrollWidth 58, clientWidth 58)
- text 100% · zoom 100%: t1542.truncate-middle.1.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 201.484375px (DOM text 200.8125 in 201.4844, zoomed px; scrollWidth 201, clientWidth 201)
- text 100% · zoom 100%: t1716.truncate-middle.1.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 260.265625px (DOM text 259.875 in 260.2656, zoomed px; scrollWidth 260, clientWidth 260)
- text 100% · zoom 100%: t2268.truncate-middle.1.near-0.5 "Nebenrollen-Takes" (de, button + icon) @ 163.046875px (DOM text 142.3594 in 143.0469, zoomed px; scrollWidth 143, clientWidth 143)
- text 115% · zoom 100%: t1542.truncate-middle.1.15.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 231.671875px (DOM text 230.8125 in 231.6719, zoomed px; scrollWidth 232, clientWidth 232)
- text 115% · zoom 100%: t1716.truncate-middle.1.15.near-0.5 "Über­gangs­re­ge­lun­gen in­be­grif­fen." (de, corpus) @ 299.21875px (DOM text 298.7031 in 299.2188, zoomed px; scrollWidth 299, clientWidth 299)
- text 115% · zoom 100%: t2268.truncate-middle.1.15.near-0.5 "Nebenrollen-Takes" (de, button + icon) @ 187.5px (DOM text 163.6406 in 164.5, zoomed px; scrollWidth 165, clientWidth 165)
- text 130% · zoom 100%: t1542.truncate-middle.1.3.near-0.5 "Ne­ben­rol­len-Ta­kes vor der" (de, corpus) @ 262.046875px (DOM text 261.0156 in 262.0469, zoomed px; scrollWidth 262, clientWidth 262)
- … and 17 more in verify/dist/check-cases.md

**lines (normal): DOM 1 lines, one wider than the box, Pretext 2** (23):

- text 100% · zoom 130%: t429.lines-normal.1.word-tol "Performance" (en, corpus + icon) @ 117.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t631.lines-normal.1.word-tol "hyphenation." (en, corpus + icon) @ 117.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t681.lines-normal.1.word-tol "vulnerable" (en, corpus + icon) @ 99.09375px (DOM text 102.8438 in 102.8125, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t787.lines-normal.1.word-tol "“Whenever" (en, corpus + icon) @ 104.078125px (DOM text 109.3281 in 109.2969, zoomed px; scrollWidth 84, clientWidth 84)
- text 100% · zoom 130%: t1173.lines-normal.1.word-tol "confidences" (en, corpus + icon) @ 113.453125px (DOM text 121.5156 in 121.4844, zoomed px; scrollWidth 93, clientWidth 93)
- text 100% · zoom 130%: t1418.lines-normal.1.word-tol "suggested," (en, corpus) @ 84.09375px (DOM text 109.3438 in 109.3125, zoomed px; scrollWidth 84, clientWidth 84)
- text 100% · zoom 130%: t2266.lines-normal.1.word-tol "Freigabeeinstellungen" (de, button + icon) @ 186.59375px (DOM text 216.5938 in 216.5625, zoomed px; scrollWidth 167, clientWidth 167)
- text 100% · zoom 130%: t2267.lines-normal.1.word-tol "Projektübersicht" (de, button + icon) @ 143.53125px (DOM text 160.6094 in 160.5781, zoomed px; scrollWidth 124, clientWidth 124)
- text 100% · zoom 130%: t2272.lines-normal.1.word-tol "Enregistrer" (fr, button + icon) @ 102.609375px (DOM text 107.4219 in 107.3906, zoomed px; scrollWidth 83, clientWidth 83)
- text 100% · zoom 130%: t2279.lines-normal.1.word-tol "Télécharger" (fr, button + icon) @ 110.09375px (DOM text 117.1406 in 117.1094, zoomed px; scrollWidth 90, clientWidth 90)
- … and 13 more in verify/dist/check-cases.md

**lines (normal): DOM 1 lines, Pretext 1 (and a line past the box, or more than 2)** (16):

- text 115% · zoom 130%: t89.lines-normal.1.15.word-tol "noticeable," (en, corpus + icon) @ 118.8125px (DOM text 124.5781 in 124.5625, zoomed px; scrollWidth 96, clientWidth 96)
- text 115% · zoom 130%: t355.lines-normal.1.15.word-tol "cache" (en, corpus + icon) @ 76.09375px (DOM text 69.0469 in 69.0313, zoomed px; scrollWidth 53, clientWidth 53)
- text 115% · zoom 130%: t919.lines-normal.1.15.word-tol "advantages" (en, corpus + icon) @ 124.234375px (DOM text 131.625 in 131.6094, zoomed px; scrollWidth 101, clientWidth 101)
- text 115% · zoom 130%: t1131.lines-normal.1.15.word-tol "Reserving" (en, corpus + icon) @ 109.84375px (DOM text 112.9219 in 112.9063, zoomed px; scrollWidth 87, clientWidth 87)
- text 130% · zoom 130%: t8.lines-normal.1.3.word-tol "tried" (en, corpus) @ 44.703125px (DOM text 58.1094 in 58.1094, zoomed px; scrollWidth 45, clientWidth 45)
- text 130% · zoom 130%: t265.lines-normal.1.3.word-tol "clean," (en, corpus + icon) @ 85.171875px (DOM text 76.9063 in 76.9219, zoomed px; scrollWidth 59, clientWidth 59)
- text 130% · zoom 130%: t443.lines-normal.1.3.word-tol "critical" (en, corpus + icon) @ 91.5625px (DOM text 85.2031 in 85.2188, zoomed px; scrollWidth 66, clientWidth 66)
- text 130% · zoom 130%: t494.lines-normal.1.3.word-tol "can't" (en, corpus) @ 49.0625px (DOM text 63.7813 in 63.7656, zoomed px; scrollWidth 49, clientWidth 49)
- text 130% · zoom 130%: t614.lines-normal.1.3.word-tol "algorithm" (en, corpus) @ 92.296875px (DOM text 119.9375 in 119.9844, zoomed px; scrollWidth 92, clientWidth 92)
- text 130% · zoom 130%: t730.lines-normal.1.3.word-tol "advice" (en, corpus) @ 65.21875px (DOM text 84.7656 in 84.7813, zoomed px; scrollWidth 65, clientWidth 65)
- … and 6 more in verify/dist/check-cases.md

**lines (normal): DOM 2 lines, one wider than the box, Pretext 3** (16):

- text 100% · zoom 130%: t432.lines-normal.1.word-tol "Performance is critical for" (en, corpus) @ 97.953125px (DOM text 127.3594 in 127.3281, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t626.lines-normal.1.word-tol "handle hyphenation." (en, corpus) @ 97.984375px (DOM text 127.4063 in 127.375, zoomed px; scrollWidth 98, clientWidth 98)
- text 100% · zoom 130%: t669.lines-normal.1.word-tol "and more vulnerable" (en, corpus + icon) @ 99.09375px (DOM text 102.8438 in 102.8125, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t675.lines-normal.1.word-tol "more vulnerable" (en, corpus + icon) @ 99.09375px (DOM text 102.8438 in 102.8125, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t683.lines-normal.1.word-tol "vulnerable years my" (en, corpus + icon) @ 99.09375px (DOM text 102.8438 in 102.8125, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t1165.lines-normal.1.word-tol "Most of the confidences" (en, corpus + icon) @ 113.453125px (DOM text 121.5156 in 121.4844, zoomed px; scrollWidth 93, clientWidth 93)
- text 100% · zoom 130%: t1168.lines-normal.1.word-tol "of the confidences" (en, corpus) @ 93.453125px (DOM text 121.5156 in 121.4844, zoomed px; scrollWidth 93, clientWidth 93)
- text 100% · zoom 130%: t1170.lines-normal.1.word-tol "the confidences" (en, corpus) @ 93.453125px (DOM text 121.5156 in 121.4844, zoomed px; scrollWidth 93, clientWidth 93)
- text 100% · zoom 130%: t1414.lines-normal.1.word-tol "snobbishly suggested," (en, corpus) @ 84.09375px (DOM text 109.3438 in 109.3125, zoomed px; scrollWidth 84, clientWidth 84)
- text 100% · zoom 130%: t2264.lines-normal.1.word-tol "Lesezeichen hinzufügen" (de, button + icon) @ 115.078125px (DOM text 123.625 in 123.5938, zoomed px; scrollWidth 95, clientWidth 95)
- … and 6 more in verify/dist/check-cases.md

**near-miss row: DOM at or over the 2px margin where Pretext is under it** (15):

- text 130% · zoom 130%: near-row.en.1.3.2 @ 791.046875px (DOM 2.3438px to spare, Pretext 1.8347, zoomed px)
- text 130% · zoom 130%: near-row.en.1.3.8 @ 716.109375px (DOM 2.2656px to spare, Pretext 1.8081, zoomed px)
- text 130% · zoom 130%: near-row.en.1.3.14 @ 641.1875px (DOM 2.1719px to spare, Pretext 1.7908, zoomed px)
- text 130% · zoom 130%: near-row.en.1.3.20 @ 582.375px (DOM 2.1406px to spare, Pretext 1.7803, zoomed px)
- text 130% · zoom 130%: near-row.en.1.3.26 @ 465.96875px (DOM 2.0313px to spare, Pretext 1.7483, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.2 @ 1040.34375px (DOM 2.5469px to spare, Pretext 1.8889, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.8 @ 914.1875px (DOM 2.4375px to spare, Pretext 1.8528, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.14 @ 832.40625px (DOM 2.375px to spare, Pretext 1.8406, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.20 @ 724.53125px (DOM 2.2656px to spare, Pretext 1.8123, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.26 @ 573.109375px (DOM 2.1406px to spare, Pretext 1.7826, zoomed px)
- … and 5 more in verify/dist/check-cases.md

**row: DOM overflows at stage 0** (14):

- text 100% · zoom 100%: row.en.1.0 @ 614.953125px (DOM content 614.9844 in 614.9531, zoomed px)
- text 100% · zoom 100%: row.fr.1.0 @ 722.234375px (DOM content 722.2656 in 722.2344, zoomed px)
- text 115% · zoom 100%: row.en.1.15.0 @ 702.125px (DOM content 702.1719 in 702.125, zoomed px)
- text 115% · zoom 100%: row.de.1.15.0 @ 922.578125px (DOM content 922.6094 in 922.5781, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.0 @ 825.4375px (DOM content 825.4688 in 825.4375, zoomed px)
- text 130% · zoom 100%: row.en.1.3.0 @ 789.75px (DOM content 789.7813 in 789.75, zoomed px)
- text 130% · zoom 100%: row.de.1.3.0 @ 1039.046875px (DOM content 1039.0781 in 1039.0469, zoomed px)
- text 100% · zoom 100%: near-row.en.1.1 @ 614.953125px (DOM content 614.9844 in 614.9531, zoomed px)
- text 100% · zoom 100%: near-row.fr.1.1 @ 722.234375px (DOM content 722.2656 in 722.2344, zoomed px)
- text 115% · zoom 100%: near-row.en.1.15.1 @ 702.125px (DOM content 702.1719 in 702.125, zoomed px)
- … and 4 more in verify/dist/check-cases.md

**lines: DOM 4 lines, Pretext 2** (6):

- text 100% · zoom 100%: t1521.lines.1.1 "ges­tern" (de, corpus + icon) @ 50.046875px (DOM text 20.4375 in 30.0469, zoomed px; scrollWidth 30, clientWidth 30)
- text 115% · zoom 100%: t1521.lines.1.15.1 "ges­tern" (de, corpus + icon) @ 57.53125px (DOM text 23.4844 in 34.5313, zoomed px; scrollWidth 35, clientWidth 35)
- text 130% · zoom 100%: t1521.lines.1.3.1 "ges­tern" (de, corpus + icon) @ 65.046875px (DOM text 26.5625 in 39.0469, zoomed px; scrollWidth 39, clientWidth 39)
- text 100% · zoom 130%: t1521.lines.1.1 "ges­tern" (de, corpus + icon) @ 50.046875px (DOM text 26.5625 in 39.0469, zoomed px; scrollWidth 30, clientWidth 30)
- text 115% · zoom 130%: t1521.lines.1.15.1 "ges­tern" (de, corpus + icon) @ 57.53125px (DOM text 30.5313 in 44.8906, zoomed px; scrollWidth 35, clientWidth 35)
- text 130% · zoom 130%: t1521.lines.1.3.1 "ges­tern" (de, corpus + icon) @ 65.046875px (DOM text 34.5 in 50.75, zoomed px; scrollWidth 39, clientWidth 39)

**row: DOM fits at the stage before** (6):

- text 130% · zoom 130%: near-row.en.1.3.0 @ 789.25px (DOM content 928.6719 in 1026.0156, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.0 @ 1038.546875px (DOM content 1186 in 1350.1094, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.6 @ 912.40625px (DOM content 1079.75 in 1186.125, zoomed px)
- text 130% · zoom 130%: near-row.de.1.3.12 @ 830.609375px (DOM content 939.6094 in 1079.7813, zoomed px)
- text 130% · zoom 130%: near-row.fr.1.3.0 @ 928.703125px (DOM content 1068.1719 in 1207.3125, zoomed px)
- text 130% · zoom 130%: near-row.fr.1.3.6 @ 821.703125px (DOM content 968.5781 in 1068.2031, zoomed px)

**row: DOM overflows at stage 1** (6):

- text 115% · zoom 100%: row.en.1.15.2 @ 635.859375px (DOM content 635.8906 in 635.8594, zoomed px)
- text 115% · zoom 100%: row.de.1.15.2 @ 811.015625px (DOM content 811.0469 in 811.0156, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.2 @ 730.8125px (DOM content 730.8438 in 730.8125, zoomed px)
- text 115% · zoom 100%: near-row.en.1.15.7 @ 635.859375px (DOM content 635.8906 in 635.8594, zoomed px)
- text 115% · zoom 100%: near-row.de.1.15.7 @ 811.015625px (DOM content 811.0469 in 811.0156, zoomed px)
- text 115% · zoom 100%: near-row.fr.1.15.7 @ 730.8125px (DOM content 730.8438 in 730.8125, zoomed px)

**lines (normal): DOM 1 lines, one wider than the box, Pretext 1** (5):

- text 100% · zoom 130%: t369.lines-normal.1.word-tol "separately" (en, corpus + icon) @ 99.046875px (DOM text 102.7813 in 102.75, zoomed px; scrollWidth 79, clientWidth 79)
- text 100% · zoom 130%: t564.lines-normal.1.word-tol "applications." (en, corpus) @ 95.796875px (DOM text 124.5625 in 124.5313, zoomed px; scrollWidth 96, clientWidth 96)
- text 100% · zoom 130%: t1467.lines-normal.1.word-tol "fundamental" (en, corpus + icon) @ 114.5625px (DOM text 122.9531 in 122.9219, zoomed px; scrollWidth 95, clientWidth 95)
- text 100% · zoom 130%: t2263.lines-normal.1.word-tol "Wiederherstellen" (de, button + icon) @ 148.53125px (DOM text 167.1094 in 167.0781, zoomed px; scrollWidth 129, clientWidth 129)
- text 115% · zoom 130%: t94.lines-normal.1.15.word-tol "especially" (en, corpus) @ 87.015625px (DOM text 113.1406 in 113.1094, zoomed px; scrollWidth 87, clientWidth 87)

**row: DOM overflows at stage 2** (4):

- text 100% · zoom 100%: row.fr.1.4 @ 580.921875px (DOM content 580.9531 in 580.9219, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.4 @ 663px (DOM content 663.0313 in 663, zoomed px)
- text 100% · zoom 100%: near-row.fr.1.13 @ 580.921875px (DOM content 580.9531 in 580.9219, zoomed px)
- text 115% · zoom 100%: near-row.fr.1.15.13 @ 663px (DOM content 663.0313 in 663, zoomed px)

**lines (normal): DOM 2 lines, Pretext 4 (and a line past the box, or more than 2)** (1):

- text 130% · zoom 130%: t1400.lines-normal.1.3.word-tol "as my father" (en, corpus) @ 58.078125px (DOM text 75.4844 in 75.5, zoomed px; scrollWidth 58, clientWidth 58)

### Excluded cases, by cause

None.

**Not run: slots with no box left beside the icon grown with the text scale and 1.3× zoom, as the zoom mutant grows it
without the box** (3 slots, 0 of them near-miss family, so 6 cases; the checker rejects a slot with no box with a RangeError):

- t1804.shrinkTo.1.0.9 "?" (fr, corpus + icon) @ 25.53125px: less the icon grown 1.3× leaves -0.4688px
- t1804.shrinkTo.1.15.0.9 "?" (fr, corpus + icon) @ 29.359375px: less the icon grown 1.49× leaves -0.5406px
- t1804.shrinkTo.1.3.0.9 "?" (fr, corpus + icon) @ 33.1875px: less the icon grown 1.69× leaves -0.6125px

## Mutants

Each mutant is a copy of src under verify/dist/mutants with the edits below (each must match exactly once, or the
harness fails), run as the checker side of the same sweep against the same Chromium data. Caught: at least one
check-mismatch of its own (a case the control does not already mismatch; the counts below leave those out).

| mutant | edits | check-mismatch | of them near-miss family | by policy | caught |
|---|---|---:|---:|---|---|
| ignore reserve | check/conditions.ts: `const box = width * zoom - (merged.reserve ?? 0) * scale` → `const box = width * zoom`; check/conditions.ts: `reserve: (merged.reserve ?? 0) * scale,` → `reserve: 0,` | 93562 | 16472 | as-is 6666, shrinkTo 23094, lines 9121, truncate end 9019, truncate middle 6666, lines (normal) 23067, truncate end (normal) 15281, row 648 | yes |
| treat zoom as textScale | check/conditions.ts: `const box = width * zoom - (merged.reserve ?? 0) * scale` → `const box = width - (merged.reserve ?? 0) * scale`; check/rows.ts: `const box = rowWidth * zoom` → `const box = rowWidth`; check/rows.ts: `const gap = row.gap * zoom` → `const gap = row.gap` | 148617 | 40796 | as-is 19680, shrinkTo 18351, lines 19680, truncate end 19437, truncate middle 19680, lines (normal) 29093, truncate end (normal) 22294, row 402 | yes |
| ignore textTransform | check/evaluate.ts: `const transformed = transformText(text, slot.textTransform, locale)` → `const transformed = text` | 1634 | 360 | as-is 157, shrinkTo 336, lines 159, truncate end 159, truncate middle 157, lines (normal) 333, truncate end (normal) 333 | yes |
| lines off by one (< for <=) | check/evaluate.ts: `fitFontSize(sizes, { width, maxLines: max }, noHeight)` → `fitFontSize(sizes, { width, maxLines: max - 1 }, noHeight)` | 76753 | 21898 | lines 39297, lines (normal) 37456 | yes |
| skip the last collapse stage | check/rows.ts: `for (let k = 0; k < steps.length; k++) {` → `for (let k = 0; k < steps.length - 1; k++) {` | 144 | 108 | row 144 | yes |
| tabular ignored (alias not used) | check/run.ts: `else merged.font = font` → `` | 1041 | 547 | as-is 96, shrinkTo 125, lines 110, truncate end 110, truncate middle 96, lines (normal) 267, truncate end (normal) 237 | yes |
| ignore overflowWrap | check/conditions.ts: `overflowWrap: merged.overflowWrap ?? 'break-word',` → `overflowWrap: 'break-word',` | 39898 | 1108 | lines (normal) 31796, truncate end (normal) 8102 | yes |
| ignore nearMiss | check/run.ts: `const nearMiss = input.nearMiss` → `const nearMiss: number \| undefined = undefined` | 51083 | 51083 | as-is 6964, shrinkTo 8351, lines 7163, truncate end 7223, truncate middle 6964, lines (normal) 7047, truncate end (normal) 7047, row 324 | yes |

- ignore reserve, e.g. text 100% · zoom 100%: t1.as-is.1.0.9 "Just tried" (en, corpus + icon) @ 84.078125px: checker pass, reference overflow
- treat zoom as textScale, e.g. text 100% · zoom 130%: t0.as-is.1.1 "Just" (en, corpus) @ 32.28125px: checker overflow, reference pass
- ignore textTransform, e.g. text 100% · zoom 100%: t2287.as-is.1.0.9 "Übersicht" (de, uppercase tab) @ 70.421875px: checker pass, reference overflow
- lines off by one (< for <=), e.g. text 100% · zoom 100%: t0.lines.1.1 "Just" (en, corpus) @ 18.59375px: checker too-many-lines, reference pass
- skip the last collapse stage, e.g. text 100% · zoom 100%: row.en.1.9 @ 313.796875px: checker row-overflow stage 5, reference row-collapsed stage 5
- tabular ignored (alias not used), e.g. text 100% · zoom 100%: t2302.lines-normal.1.0.9 "1.234.567,89 €" (de, tabular digits) @ 95.640625px: checker pass, reference overflow
- ignore overflowWrap, e.g. text 100% · zoom 100%: t0.lines-normal.1.0.9 "Just" (en, corpus) @ 29.046875px: checker pass, reference overflow
- ignore nearMiss, e.g. text 100% · zoom 100%: t0.as-is.1.near+0 "Just" (en, corpus) @ 32.28125px: near-miss: checker no near-miss, reference near-miss (0.0078px to spare)

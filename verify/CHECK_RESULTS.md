# Label checker oracle sweep results

Run on 2026-10-06 by `npm run verify:check` (verify/check-labels.ts), pretext-kit 43d01a5.

- Chromium 141.0.7390.37 (Playwright 1.61.0, headed on X display :99, executable /opt/pw-browsers/chromium from PW_CHROMIUM), `<html lang="en">`, each slot `lang` its label's locale
- Pretext 0.0.9 (../pretext f10d888); harfbuzzjs 1.6.2
- Node v22.22.0, Linux 6.18.44-fc-v70, x64
- checker: `checkLabels` in Node, `platforms: ['linux']` (this OS's), font Inter-Regular.ttf from test/fonts registered as "CK Inter"
- Chromium 89s; checker runs (control and 6 mutants, 4 at a time) 83s

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
the same with 2 lines; truncate end: `clamp(…, 2).truncated`; shrinkTo: the largest of the slot size, every whole px
below it and the minimum that fits one line; rows: each stage's natural widths, icon reserves, icons and gaps, the
first stage within the row (plus FIT_TOLERANCE). **DOM:** a flex box of the slot width holding the icon and the text
element: as-is, shrinkTo and truncate middle `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`;
lines `overflow-wrap: break-word; hyphens: manual`, line count from the tops of
`getClientRects()` of a range over the text (checked against height ÷ line height; a disagreement is `unreliable`);
truncate end `display: -webkit-box; -webkit-line-clamp: 2`, clamped when `scrollHeight > clientHeight`; shrinkTo
rendered at the reference's size, which must fit, and at the next candidate size up, which must not (none at the
slot size); rows a flex line (`gap`, items `flex: none`) at the reference's stage, which must fit (overflow for
row-overflow), and at the stage before, which must not. Text scale is a font-size change in the fixed-width box, zoom
CSS `zoom` on the container. Overflow (nowrap policies, a line wider than the box, rows) is judged on fractional
widths: the bounding width of a range over the content past the element's box by more than 1/64 px (zoomed px).
`scrollWidth > clientWidth`, which Chromium snaps to whole pixels, is a cross-check: it disagrees in
3426 of 208740 cases (1632 of them pretext-gaps).

Outcome, in this order (EVALUATION §2): `excluded` when the checker cannot judge the text (`uncovered`); `check-mismatch`
when the checker's verdict (kind, shrinkTo size to 1/64 px, row stage) differs from the reference; `excluded` as
`unreliable` when the DOM's two line counts disagree; `pretext-gap` when the DOM contradicts the reference; else
`pass`. Pass bar: 0 check-mismatch.

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

Slots: each text in 5 policies (as-is; shrinkTo the size less 4px; lines 2; truncate end 2 lines;
truncate middle), and each text scale (1/1.15/1.3) its own slots, at 0.9/1/1.1 × the box where the policy changes its
verdict at that text scale (one line at the scaled size and letter spacing; one line at the scaled shrinkTo size; the
narrowest width in 2 lines), plus the reserve grown with the text, rounded up to 1/64 px; measured by the kit on Pretext
in the page. A slot runs in its text scale's conditions, zoom 1 and 1.3 (zoom grows the box too, so the boundary
stays): 104262 slots run (3 not run, below). Line height 1.5 × the size. Conditions: text 100% · zoom 100%, text 115% · zoom 100%, text 130% · zoom 100%, text 100% · zoom 130%, text 115% · zoom 130%, text 130% · zoom 130%.
Rows: a five-item toolbar per locale (en, de, fr) and text scale, gap 8px, icon reserve 20px, collapsed icon
24px, 5 collapse stages, at each stage's total at that text scale, halfway to the next and 0.9 of the last:
108 rows. **208740 cases** (208524 slot, 216 row).

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
| row · none | 3 | 33 | row-collapsed 30, row-overflow 3 |
| row · text scale | 6 | 66 | row-collapsed 60, row-overflow 6 |
| row · zoom | 3 | 33 | row-collapsed 30, row-overflow 3 |
| row · text scale + zoom | 6 | 66 | row-collapsed 60, row-overflow 6 |

## Agreement

**208740 cases: 0 check-mismatch, 5260 pretext-gap, 0 excluded, 203480 pass.**

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
| row · none | 36 | 33 | 0 | 3 | 0 |
| row · text scale | 72 | 63 | 0 | 9 | 0 |
| row · zoom | 36 | 36 | 0 | 0 | 0 |
| row · text scale + zoom | 72 | 72 | 0 | 0 | 0 |

Statistics (PROTOCOL §4), one unit per label text (a text's slots, widths and conditions are one unit; each locale's
row is one): 2320 units, 0 with a check-mismatch, 95% upper bound on the rate Wilson 0.165%, Clopper-Pearson 0.159%
(quoted). Per case, naive: 208740 judged cases, 0 check-mismatch, Wilson 0.0018%, Clopper-Pearson 0.0018%.

### check-mismatch cases

None.

### pretext-gap cases, by cause

Each is the reference (the kit on Pretext in Chromium) against Chromium's painting with the checker agreeing with the
reference, so each is attributed to Pretext vs the DOM, not to the checker.

Every case is listed in verify/dist/check-cases.md (not committed; CI uploads it with this file); below,
up to 10 per cause.

**truncate end: DOM clamps where Pretext does not** (1160):

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
- … and 1150 more in verify/dist/check-cases.md

**lines: DOM 3 lines, Pretext 2** (1154):

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
- … and 1144 more in verify/dist/check-cases.md

**as-is: DOM overflows where Pretext fits** (778):

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
- … and 768 more in verify/dist/check-cases.md

**truncate middle: DOM overflows where Pretext fits** (778):

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
- … and 768 more in verify/dist/check-cases.md

**shrinkTo: DOM overflows at the fitted size** (741):

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
- … and 731 more in verify/dist/check-cases.md

**shrinkTo: DOM fits at the minimum where Pretext overflows** (607):

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
- … and 597 more in verify/dist/check-cases.md

**shrinkTo: DOM also fits at the next size** (10):

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

**row: DOM overflows at stage 0** (7):

- text 100% · zoom 100%: row.en.1.0 @ 614.953125px (DOM content 614.9844 in 614.9531, zoomed px)
- text 100% · zoom 100%: row.fr.1.0 @ 722.234375px (DOM content 722.2656 in 722.2344, zoomed px)
- text 115% · zoom 100%: row.en.1.15.0 @ 702.125px (DOM content 702.1719 in 702.125, zoomed px)
- text 115% · zoom 100%: row.de.1.15.0 @ 922.578125px (DOM content 922.6094 in 922.5781, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.0 @ 825.4375px (DOM content 825.4688 in 825.4375, zoomed px)
- text 130% · zoom 100%: row.en.1.3.0 @ 789.75px (DOM content 789.7813 in 789.75, zoomed px)
- text 130% · zoom 100%: row.de.1.3.0 @ 1039.046875px (DOM content 1039.0781 in 1039.0469, zoomed px)

**lines: DOM 4 lines, Pretext 2** (6):

- text 100% · zoom 100%: t1521.lines.1.1 "ges­tern" (de, corpus + icon) @ 50.046875px (DOM text 20.4375 in 30.0469, zoomed px; scrollWidth 30, clientWidth 30)
- text 115% · zoom 100%: t1521.lines.1.15.1 "ges­tern" (de, corpus + icon) @ 57.53125px (DOM text 23.4844 in 34.5313, zoomed px; scrollWidth 35, clientWidth 35)
- text 130% · zoom 100%: t1521.lines.1.3.1 "ges­tern" (de, corpus + icon) @ 65.046875px (DOM text 26.5625 in 39.0469, zoomed px; scrollWidth 39, clientWidth 39)
- text 100% · zoom 130%: t1521.lines.1.1 "ges­tern" (de, corpus + icon) @ 50.046875px (DOM text 26.5625 in 39.0469, zoomed px; scrollWidth 30, clientWidth 30)
- text 115% · zoom 130%: t1521.lines.1.15.1 "ges­tern" (de, corpus + icon) @ 57.53125px (DOM text 30.5313 in 44.8906, zoomed px; scrollWidth 35, clientWidth 35)
- text 130% · zoom 130%: t1521.lines.1.3.1 "ges­tern" (de, corpus + icon) @ 65.046875px (DOM text 34.5 in 50.75, zoomed px; scrollWidth 39, clientWidth 39)

**lines: DOM 2 lines, Pretext 3 (and a line past the box, or more than 2)** (4):

- text 115% · zoom 130%: t1327.lines.1.15.1 "still" (en, corpus + icon) @ 38.71875px (DOM text 20.4531 in 20.4375, zoomed px; scrollWidth 16, clientWidth 16)
- text 115% · zoom 130%: t1611.lines.1.15.1 "bis" (de, corpus + icon) @ 37.15625px (DOM text 18.4219 in 18.4063, zoomed px; scrollWidth 14, clientWidth 14)
- text 115% · zoom 130%: t2300.lines.1.15.1 "Notifications" (en, uppercase tab) @ 63.65625px (DOM text 82.7656 in 82.75, zoomed px; scrollWidth 64, clientWidth 64)
- text 130% · zoom 130%: t2299.lines.1.3.1 "Billing" (en, uppercase tab) @ 37.296875px (DOM text 48.5 in 48.4844, zoomed px; scrollWidth 37, clientWidth 37)

**truncate end: DOM does not clamp where Pretext cuts** (4):

- text 115% · zoom 130%: t1327.truncate-end.1.15.1 "still" (en, corpus + icon) @ 38.71875px
- text 115% · zoom 130%: t1611.truncate-end.1.15.1 "bis" (de, corpus + icon) @ 37.15625px
- text 115% · zoom 130%: t2300.truncate-end.1.15.1 "Notifications" (en, uppercase tab) @ 63.65625px
- text 130% · zoom 130%: t2299.truncate-end.1.3.1 "Billing" (en, uppercase tab) @ 37.296875px

**as-is: DOM fits where Pretext overflows** (3):

- text 115% · zoom 130%: t2288.as-is.1.15.1 "Straße" (de, uppercase tab) @ 71.25px (DOM text 92.6406 in 92.625, zoomed px; scrollWidth 71, clientWidth 71)
- text 115% · zoom 130%: t2290.as-is.1.15.1 "Größe" (de, uppercase tab) @ 63.78125px (DOM text 82.9219 in 82.9063, zoomed px; scrollWidth 64, clientWidth 64)
- text 115% · zoom 130%: t2296.as-is.1.15.1 "Équipe" (fr, uppercase tab) @ 57.5px (DOM text 74.7656 in 74.75, zoomed px; scrollWidth 58, clientWidth 58)

**row: DOM overflows at stage 1** (3):

- text 115% · zoom 100%: row.en.1.15.2 @ 635.859375px (DOM content 635.8906 in 635.8594, zoomed px)
- text 115% · zoom 100%: row.de.1.15.2 @ 811.015625px (DOM content 811.0469 in 811.0156, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.2 @ 730.8125px (DOM content 730.8438 in 730.8125, zoomed px)

**truncate middle: DOM fits where Pretext overflows** (3):

- text 115% · zoom 130%: t2288.truncate-middle.1.15.1 "Straße" (de, uppercase tab) @ 71.25px (DOM text 92.6406 in 92.625, zoomed px; scrollWidth 71, clientWidth 71)
- text 115% · zoom 130%: t2290.truncate-middle.1.15.1 "Größe" (de, uppercase tab) @ 63.78125px (DOM text 82.9219 in 82.9063, zoomed px; scrollWidth 64, clientWidth 64)
- text 115% · zoom 130%: t2296.truncate-middle.1.15.1 "Équipe" (fr, uppercase tab) @ 57.5px (DOM text 74.7656 in 74.75, zoomed px; scrollWidth 58, clientWidth 58)

**row: DOM overflows at stage 2** (2):

- text 100% · zoom 100%: row.fr.1.4 @ 580.921875px (DOM content 580.9531 in 580.9219, zoomed px)
- text 115% · zoom 100%: row.fr.1.15.4 @ 663px (DOM content 663.0313 in 663, zoomed px)

### Excluded cases, by cause

None.

**Not run: slots with no box left beside the icon grown with the text scale and 1.3× zoom, as the zoom mutant grows it
without the box** (3 slots, so 6 cases; the checker rejects a slot with no box with a RangeError):

- t1804.shrinkTo.1.0.9 "?" (fr, corpus + icon) @ 25.53125px: less the icon grown 1.3× leaves -0.4688px
- t1804.shrinkTo.1.15.0.9 "?" (fr, corpus + icon) @ 29.359375px: less the icon grown 1.49× leaves -0.5406px
- t1804.shrinkTo.1.3.0.9 "?" (fr, corpus + icon) @ 33.1875px: less the icon grown 1.69× leaves -0.6125px

## Mutants

Each mutant is a copy of src under verify/dist/mutants with the edits below (each must match exactly once, or the
harness fails), run as the checker side of the same sweep against the same Chromium data. Caught: at least one
check-mismatch of its own (a case the control does not already mismatch; the counts below leave those out).

| mutant | edits | check-mismatch | by policy | caught |
|---|---|---:|---|---|
| ignore reserve | check/conditions.ts: `const box = width * zoom - (merged.reserve ?? 0) * scale` → `const box = width * zoom`; check/conditions.ts: `reserve: (merged.reserve ?? 0) * scale,` → `reserve: 0,` | 43024 | as-is 4578, shrinkTo 19962, lines 6944, truncate end 6842, truncate middle 4578, row 120 | yes |
| treat zoom as textScale | check/conditions.ts: `const box = width * zoom - (merged.reserve ?? 0) * scale` → `const box = width - (merged.reserve ?? 0) * scale`; check/rows.ts: `const box = rowWidth * zoom` → `const box = rowWidth`; check/rows.ts: `const gap = row.gap * zoom` → `const gap = row.gap` | 68122 | as-is 13877, shrinkTo 12737, lines 13877, truncate end 13658, truncate middle 13877, row 96 | yes |
| ignore textTransform | check/evaluate.ts: `const transformed = transformText(text, slot.textTransform, locale)` → `const transformed = text` | 704 | as-is 109, shrinkTo 264, lines 111, truncate end 111, truncate middle 109 | yes |
| lines off by one (< for <=) | check/evaluate.ts: `fitFontSize(sizes, { width, maxLines: max }, noHeight)` → `fitFontSize(sizes, { width, maxLines: max - 1 }, noHeight)` | 27719 | lines 27719 | yes |
| skip the last collapse stage | check/rows.ts: `for (let k = 0; k < steps.length; k++) {` → `for (let k = 0; k < steps.length - 1; k++) {` | 36 | row 36 | yes |
| tabular ignored (alias not used) | check/run.ts: `else merged.font = font` → `` | 134 | as-is 24, shrinkTo 26, lines 30, truncate end 30, truncate middle 24 | yes |

- ignore reserve, e.g. text 100% · zoom 100%: t1.as-is.1.0.9 "Just tried" (en, corpus + icon) @ 84.078125px: checker pass, reference overflow
- treat zoom as textScale, e.g. text 100% · zoom 130%: t0.as-is.1.1 "Just" (en, corpus) @ 32.28125px: checker overflow, reference pass
- ignore textTransform, e.g. text 100% · zoom 100%: t2287.as-is.1.0.9 "Übersicht" (de, uppercase tab) @ 70.421875px: checker pass, reference overflow
- lines off by one (< for <=), e.g. text 100% · zoom 100%: t0.lines.1.1 "Just" (en, corpus) @ 18.59375px: checker too-many-lines, reference pass
- skip the last collapse stage, e.g. text 100% · zoom 100%: row.en.1.9 @ 313.796875px: checker row-overflow stage 5, reference row-collapsed stage 5
- tabular ignored (alias not used), e.g. text 100% · zoom 100%: t2305.as-is.1.0.9 "2026-10-06" (en, tabular digits) @ 93.375px: checker pass, reference overflow

# Browser sweep results

Run on 2026-10-05 by `npm run verify`, headed, `<html lang="en">`.
Widths 120-600px (truncateMiddle 80-400px), at Playwright deviceScaleFactor 1, 1.25, 2.
Width step per helper at factor 1: shrinkwrap 1, balance 1, fitFontSize 1, fitFontSizeRich 1, clamp 1, truncateMiddle 1.
Width step per helper at factor 1.25: shrinkwrap 4, balance 4, fitFontSize 4, fitFontSizeRich 4, clamp 4, truncateMiddle 4.
Width step per helper at factor 2: shrinkwrap 4, balance 4, fitFontSize 4, fitFontSizeRich 4, clamp 4, truncateMiddle 4.
fontFromStyle cases are one per font stack and pinned size (16px/24px, then 8-48px at 1.5 line height), plus
weight 700, italic and 0.5px letter spacing at 16px/24px; their "width" column is the font size, their corpus the variant.

A `pretext-gap` case is one where Pretext's own line count differs from the browser's at a width (or, for
fitFontSize, a size) the judgement needs, so the kit cannot be judged there. A `kit-mismatch` is the kit
answering wrongly where Pretext was right. A `platform` case is a kit-mismatch whose cause is proven, case by
case, to be a browser painting something its CSS does not say; only the cause below is recognised. An
`unreliable` case painted a height that is no whole number of lines, so lines could not be counted.

Each kit answer is judged against Pretext's own numbers first, and any failure there is a kit-mismatch whatever
the browser paints: shrinkwrap and balance must fit the box with Pretext's line count at the box width and at their
own width, shrinkwrap must equal Pretext's widest line rounded up (one pixel less exactly when Pretext lays out the
same lines there), balance one pixel narrower must cost Pretext a line (unless a piece no width breaks, a
grapheme, is wider than that, which balance then contains), and fitFontSize must fit by Pretext at its size and
not at the next. fitFontSize's step-1 "fits" predicate mirrors the kit's own (no line overflows: every line within
the width, or no unbreakable piece wider than it, since Pretext keeps some lines it reports wider than they
paint), so step 1 checks the search, not the criterion; the painting is what tests the criterion: the painted
height and scrollWidth, and, where Pretext reports a line past the width, the widest painted line to the fraction.
Only then is the painting compared, where a disagreement is a pretext-gap: line counts at
each width probed, shrinkwrap's width against the ceiling of the widest painted line (measured per line from the
text's non-white-space fragments; one pixel less passes only if the browser paints the identical layout there,
since engines let a line overshoot by up to 1/64 px), and balance one pixel narrower painting more lines.

In 23 cases the browser paints more lines at fitFontSize's own answer than Pretext lays out there: Kapitän 6 (Helvetica Neue/Arial; chromium, firefox); Synchroniser 11 (Helvetica Neue; chromium, firefox); Responsabilité 6, 2 over the box (Helvetica Neue; chromium, firefox). In 19 of them the painted lines × the size's line height exceed the 96px box: a visible overflow. In the other 4 the extra line still fits the box. They are pretext-gaps, since Pretext's own line count is the cause and the kit agreed with it, but the overflows are ones a user sees.

clamp runs at maxLines 1-5 with the tail `measureTail('…', font)`. By Pretext: the tail must match Pretext's
widths of `…` and a no-break space; the line count must be min(Pretext's, maxLines) and truncated exactly when
Pretext lays out more; clampStats must agree; every line but a cut one must be Pretext's line at the same cursor;
a cut last line must keep a grapheme, be the whole line when that line and `…` measured as one text fit, else a
prefix of it whose text with `…`, measured as one text, fits W + 1/64 (unless it is one grapheme) while one more
grapheme (with any white space before it; a soft hyphen's hyphen is none) would not. Then the
painting, in a `display: -webkit-box; -webkit-line-clamp: N` box: truncation (scrollHeight > clientHeight) and
clamped height must match, and every line painted in a `white-space: pre` span (the cut one followed by `…`) must
be no wider than W + 1/64.

fitFontSizeRich sizes an icon and its label as one row, at 8-32px with line height round(1.5·px): an
`inline-block; vertical-align: top` icon round(1.25·px) wide and px tall, then the label with
`margin-left: round(0.5·px)px` (the row's `extraWidth`, and `box-decoration-break: clone`, since Pretext charges
a wrapped item's extraWidth on every line), in a `white-space: normal; overflow-wrap: break-word` box of width W,
with the boxes { width: W, maxLines: 1 } and { width: W, height: 72 }. The height is three lines of the sweep's base
16px/24px text, fixed across the sizes searched as a real box is; three times each size's own line height would
make the height box the same test as maxLines 3. Corpora: latin, german,
french, emoji-chat and ui-labels (real labels such as "Zahlungspflichtig abonnieren", not hyphenated). By Pretext,
computed in the harness from `prepareRichInline` and `measureRichInlineStats` (never the kit): the handle and
lineCount must match Pretext's count at W, the size must fit (no line past W + 1/64 unless no unbreakable piece,
the row at width 0, is wider than that; the count within maxLines or count × line height within the height) and
the next size must not; null only when 8px does not fit. Then the painting: at the answer and the next size, the
painted line count must match Pretext's (else pretext-gap), and the answer must fit the box (lines or height,
scrollWidth ≤ W and, where Pretext reports a line past W, the widest painted line, from the box's left edge to
the rightmost icon or text fragment on it, within W + 1/64) while the next size must not.

In 66 cases the browser paints more lines at fitFontSizeRich's own answer than Pretext lays out there: Kapitän 8 (Helvetica Neue; chromium, firefox); Nebenrollen 30 (Georgia/Times New Roman; chromium); Synchroniser 12 (Helvetica Neue; chromium, firefox); Responsabilité 13 (Helvetica Neue; chromium, firefox); Anticonstitutionnalité 3 (Arial; chromium). In all 66, the painted lines exceed the box (more than maxLines, or lines × line height over 72px): a visible overflow. They are pretext-gaps, since Pretext's own line count is the cause and the kit agreed with it, but the overflows are ones a user sees.

A next-size gap where the browser paints more lines than Pretext, such as "Speichern" (Helvetica Neue, 25px in a
126px box), is harmless: the answer fits. Pretext's README (the extraWidth note) warns that a padded span the
browser wraps itself can break elsewhere, with `clone` too.

**Painting.** A one-off probe, not part of the gated tallies: fitFontSizeRich in Chromium 149 at factor 1, the
same 203,944 cases, with the label painted as a plain `margin-left` (the default `box-decoration-break: slice`,
which pads only the first line). Checked at the kit's answer: browser lines > maxLines, height > 72,
scrollWidth > W, or (where Pretext reports a line past W) the widest painted line > W + 1/64. With slice, 11
answers overflow, all on painted lines or height and none on scrollWidth: Nebenrollen (Georgia, height) 5,
Responsabilité 3, Kapitän 1, Synchroniser 1, Anticonstitutionnalité 1, the same soft-hyphen texts as above.
11,253 answers fit where the next size also does, and 24 nulls where 8px fits, so they err small. With clone the
same probe gives 32 overflows (the Chromium factor-1 cases counted above) and 168 + 1 that err small. So slice
painting mostly errs small, by up to the margin Pretext charges on later lines, but it does not remove the
soft-hyphen overflows.

truncateMiddle runs on path labels, and on the German and French corpora, at widths 80-400px, with
keepEnd from the last `/` where there is one. By Pretext: the whole label exactly when its natural width fits;
otherwise a start of the label, `…` and an end of it (compared without soft hyphens, which Pretext's line text
leaves out), cut only between graphemes (an independent Intl.Segmenter), measuring no more than W + 1/64 as one
text, where one more grapheme of the start would not fit;
and the end must hold the file name when the name,
`…` and the first grapheme, measured as one text, fit. Then the painting: the result in a `white-space: pre`
span no wider than W + 1/64, and the name kept wherever the painted name, `…` and first grapheme fit.

The german and french corpora carry soft hyphens (U+00AD) put in once by the `hyphen` package (hyphen/de, which
is de-1996, and hyphen/fr; TeX hyph-utf8 patterns under the MIT licence; the package itself ISC) and are painted
with `hyphens: manual`. Every helper sweeps them.

`npm run verify` fails on any kit-mismatch, on a pinned font family that is absent, on a devicePixelRatio
other than the factor asked for, and when a browser×factor×helper's pretext-gap or unreliable count exceeds
`verify/baseline.json` by more than max(5, 5%).

The clamp paint check paints each line in a `white-space: pre` span on its own, which is an upper bound on what
the clamped paragraph paints: Blink trims CJK punctuation at a line's edges (text-spacing-trim) in the paragraph,
but not in an unconstrained span. So CJK clamp gaps such as "Zhufu quotes" (a line Pretext fits at 368px painting
376px in the span) are false positives of the span, never missed ones; their details give Pretext's own line
width for full lines and the joined width for a cut line with its `…`.

Zoom is Playwright's deviceScaleFactor emulation on macOS: it shows that a finer device grid changes nothing
here, not that Windows (DirectWrite) or Linux (FreeType hinting) measure alike, nor exactly what a user's page
zoom does (which also changes CSS px per device pixel through the layout viewport).

Every non-pass case is in `verify/results/latest.json.gz` (gzipped JSON: browser, factor and the case); below,
findings are grouped by text and pattern.

Playwright is pinned to 1.61.0: on macOS 14 Playwright ships a frozen WebKit build
(webkit_mac14_arm64_special-2251), and Playwright 1.62 and later send it a protocol setting it rejects
(`Page.overrideSetting`: "Unknown setting: PushAPIEnabled"), so no WebKit page opens.

**`webkit-26-line-height-floor`.** WebKit 26 lays line boxes out at whole pixels, so a fractional
`line-height` paints as its floor (16.5px paints 16px lines) while `getComputedStyle` still reports 16.5px;
Pretext's `PLATFORM_BUGS.md` ("Engine rules Pretext models") records that Safari 27 moved line boxes to the
1/64 px grid where Safari 26 did not. fitFontSize, given the CSS line height, then models a taller box than
WebKit paints and can answer one size below the largest that fits; it never answers a size that overflows. A case
gets this cause only in WebKit, and only if its line height is fractional, the contradicting painting is exactly
lines × the floored line height, and the same judgement passes when the kit is rerun with floored line heights.
For exact fits in Safari 26, use whole-px line heights.

## chromium 149.0.7827.55 (chromium-1228) at deviceScaleFactor 1

Measured devicePixelRatio 1; 2.3 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (14s) | 161616 | 156575 | 5041 | 0 | 0 | 0 |
| balance (13s) | 161616 | 156946 | 4670 | 0 | 0 | 0 |
| fitFontSize (21s) | 161616 | 161312 | 304 | 0 | 0 | 0 |
| fitFontSizeRich (20s) | 203944 | 203723 | 221 | 0 | 0 | 0 |
| clamp (65s) | 808080 | 807503 | 577 | 0 | 0 | 0 |
| truncateMiddle (6s) | 61632 | 61629 | 3 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 230880 | 230840 | 40 | 0 | 0 | 0 |
| cjk | 184704 | 182243 | 2461 | 0 | 0 | 0 |
| arabic | 184704 | 183243 | 1461 | 0 | 0 | 0 |
| emoji-chat | 230880 | 230180 | 700 | 0 | 0 | 0 |
| urls | 184704 | 180866 | 3838 | 0 | 0 | 0 |
| german | 246288 | 245536 | 752 | 0 | 0 | 0 |
| french | 246288 | 244727 | 1561 | 0 | 0 | 0 |
| ui-labels | 19240 | 19239 | 1 | 0 | 0 | 0 |
| labels | 30816 | 30814 | 2 | 0 | 0 | 0 |

## chromium 149.0.7827.55 (chromium-1228) at deviceScaleFactor 1.25

Measured devicePixelRatio 1.25; 0.7 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (5s) | 40656 | 39384 | 1272 | 0 | 0 | 0 |
| balance (4s) | 40656 | 39483 | 1173 | 0 | 0 | 0 |
| fitFontSize (7s) | 40656 | 40585 | 71 | 0 | 0 | 0 |
| fitFontSizeRich (6s) | 51304 | 51244 | 60 | 0 | 0 | 0 |
| clamp (17s) | 203280 | 203132 | 148 | 0 | 0 | 0 |
| truncateMiddle (2s) | 15552 | 15551 | 1 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 58065 | 15 | 0 | 0 | 0 |
| cjk | 46464 | 45856 | 608 | 0 | 0 | 0 |
| arabic | 46464 | 46090 | 374 | 0 | 0 | 0 |
| emoji-chat | 58080 | 57909 | 171 | 0 | 0 | 0 |
| urls | 46464 | 45501 | 963 | 0 | 0 | 0 |
| german | 61968 | 61762 | 206 | 0 | 0 | 0 |
| french | 61968 | 61580 | 388 | 0 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## chromium 149.0.7827.55 (chromium-1228) at deviceScaleFactor 2

Measured devicePixelRatio 2; 0.7 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (5s) | 40656 | 39384 | 1272 | 0 | 0 | 0 |
| balance (4s) | 40656 | 39483 | 1173 | 0 | 0 | 0 |
| fitFontSize (7s) | 40656 | 40585 | 71 | 0 | 0 | 0 |
| fitFontSizeRich (6s) | 51304 | 51244 | 60 | 0 | 0 | 0 |
| clamp (16s) | 203280 | 203132 | 148 | 0 | 0 | 0 |
| truncateMiddle (2s) | 15552 | 15551 | 1 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 58065 | 15 | 0 | 0 | 0 |
| cjk | 46464 | 45856 | 608 | 0 | 0 | 0 |
| arabic | 46464 | 46090 | 374 | 0 | 0 | 0 |
| emoji-chat | 58080 | 57909 | 171 | 0 | 0 | 0 |
| urls | 46464 | 45501 | 963 | 0 | 0 | 0 |
| german | 61968 | 61762 | 206 | 0 | 0 | 0 |
| french | 61968 | 61580 | 388 | 0 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## webkit 26.5 (webkit_mac14_arm64_special-2251) at deviceScaleFactor 1

Measured devicePixelRatio 1; 5.0 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (77s) | 161616 | 160601 | 1015 | 0 | 0 | 0 |
| balance (40s) | 161616 | 161616 | 0 | 0 | 0 | 0 |
| fitFontSize (45s) | 161616 | 153057 | 0 | 8559 | 0 | 0 |
| fitFontSizeRich (34s) | 203944 | 203944 | 0 | 0 | 0 | 0 |
| clamp (96s) | 808080 | 807997 | 83 | 0 | 0 | 0 |
| truncateMiddle (7s) | 61632 | 61632 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 230880 | 228513 | 0 | 2367 | 0 | 0 |
| cjk | 184704 | 183915 | 0 | 789 | 0 | 0 |
| arabic | 184704 | 183852 | 0 | 852 | 0 | 0 |
| emoji-chat | 230880 | 230760 | 11 | 109 | 0 | 0 |
| urls | 184704 | 182193 | 81 | 2430 | 0 | 0 |
| german | 246288 | 244530 | 470 | 1288 | 0 | 0 |
| french | 246288 | 245028 | 536 | 724 | 0 | 0 |
| ui-labels | 19240 | 19240 | 0 | 0 | 0 | 0 |
| labels | 30816 | 30816 | 0 | 0 | 0 | 0 |

## webkit 26.5 (webkit_mac14_arm64_special-2251) at deviceScaleFactor 1.25

Measured devicePixelRatio 1.25; 1.5 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (22s) | 40656 | 40396 | 260 | 0 | 0 | 0 |
| balance (12s) | 40656 | 40656 | 0 | 0 | 0 | 0 |
| fitFontSize (15s) | 40656 | 38470 | 0 | 2186 | 0 | 0 |
| fitFontSizeRich (10s) | 51304 | 51304 | 0 | 0 | 0 | 0 |
| clamp (26s) | 203280 | 203255 | 25 | 0 | 0 | 0 |
| truncateMiddle (3s) | 15552 | 15552 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 57482 | 0 | 598 | 0 | 0 |
| cjk | 46464 | 46253 | 0 | 211 | 0 | 0 |
| arabic | 46464 | 46242 | 0 | 222 | 0 | 0 |
| emoji-chat | 58080 | 58040 | 8 | 32 | 0 | 0 |
| urls | 46464 | 45838 | 18 | 608 | 0 | 0 |
| german | 61968 | 61524 | 121 | 323 | 0 | 0 |
| french | 61968 | 61638 | 138 | 192 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## webkit 26.5 (webkit_mac14_arm64_special-2251) at deviceScaleFactor 2

Measured devicePixelRatio 2; 1.4 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (21s) | 40656 | 40396 | 260 | 0 | 0 | 0 |
| balance (12s) | 40656 | 40656 | 0 | 0 | 0 | 0 |
| fitFontSize (14s) | 40656 | 38470 | 0 | 2186 | 0 | 0 |
| fitFontSizeRich (9s) | 51304 | 51304 | 0 | 0 | 0 | 0 |
| clamp (25s) | 203280 | 203255 | 25 | 0 | 0 | 0 |
| truncateMiddle (3s) | 15552 | 15552 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 57482 | 0 | 598 | 0 | 0 |
| cjk | 46464 | 46253 | 0 | 211 | 0 | 0 |
| arabic | 46464 | 46242 | 0 | 222 | 0 | 0 |
| emoji-chat | 58080 | 58040 | 8 | 32 | 0 | 0 |
| urls | 46464 | 45838 | 18 | 608 | 0 | 0 |
| german | 61968 | 61524 | 121 | 323 | 0 | 0 |
| french | 61968 | 61638 | 138 | 192 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## firefox 151.0 (firefox-1532) at deviceScaleFactor 1

Measured devicePixelRatio 1; 3.4 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (23s) | 161616 | 160303 | 1313 | 0 | 0 | 0 |
| balance (24s) | 161616 | 160603 | 1013 | 0 | 0 | 0 |
| fitFontSize (28s) | 161616 | 161565 | 51 | 0 | 0 | 0 |
| fitFontSizeRich (28s) | 203944 | 203718 | 226 | 0 | 0 | 0 |
| clamp (89s) | 808080 | 807991 | 89 | 0 | 0 | 0 |
| truncateMiddle (9s) | 61632 | 61632 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 230880 | 230880 | 0 | 0 | 0 | 0 |
| cjk | 184704 | 184704 | 0 | 0 | 0 | 0 |
| arabic | 184704 | 184704 | 0 | 0 | 0 | 0 |
| emoji-chat | 230880 | 230727 | 153 | 0 | 0 | 0 |
| urls | 184704 | 184378 | 326 | 0 | 0 | 0 |
| german | 246288 | 245306 | 982 | 0 | 0 | 0 |
| french | 246288 | 245057 | 1231 | 0 | 0 | 0 |
| ui-labels | 19240 | 19240 | 0 | 0 | 0 | 0 |
| labels | 30816 | 30816 | 0 | 0 | 0 | 0 |

## firefox 151.0 (firefox-1532) at deviceScaleFactor 1.25

Measured devicePixelRatio 1.25; 1.0 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (7s) | 40656 | 40326 | 330 | 0 | 0 | 0 |
| balance (7s) | 40656 | 40401 | 255 | 0 | 0 | 0 |
| fitFontSize (9s) | 40656 | 40644 | 12 | 0 | 0 | 0 |
| fitFontSizeRich (7s) | 51304 | 51247 | 57 | 0 | 0 | 0 |
| clamp (25s) | 203280 | 203258 | 22 | 0 | 0 | 0 |
| truncateMiddle (3s) | 15552 | 15552 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 58080 | 0 | 0 | 0 | 0 |
| cjk | 46464 | 46464 | 0 | 0 | 0 | 0 |
| arabic | 46464 | 46464 | 0 | 0 | 0 | 0 |
| emoji-chat | 58080 | 58041 | 39 | 0 | 0 | 0 |
| urls | 46464 | 46383 | 81 | 0 | 0 | 0 |
| german | 61968 | 61717 | 251 | 0 | 0 | 0 |
| french | 61968 | 61663 | 305 | 0 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## firefox 151.0 (firefox-1532) at deviceScaleFactor 2

Measured devicePixelRatio 2; 1.0 min. Fonts: Helvetica Neue present, PingFang SC present, Geeza Pro present, Arial present, Georgia present, Hiragino Mincho ProN present, Times New Roman present, Songti SC present.

By helper:

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| fontFromStyle (0s) | 180 | 180 | 0 | 0 | 0 | 0 |
| shrinkwrap (7s) | 40656 | 40326 | 330 | 0 | 0 | 0 |
| balance (7s) | 40656 | 40401 | 255 | 0 | 0 | 0 |
| fitFontSize (8s) | 40656 | 40644 | 12 | 0 | 0 | 0 |
| fitFontSizeRich (7s) | 51304 | 51247 | 57 | 0 | 0 | 0 |
| clamp (25s) | 203280 | 203258 | 22 | 0 | 0 | 0 |
| truncateMiddle (3s) | 15552 | 15552 | 0 | 0 | 0 | 0 |

By corpus (sweep helpers):

| | cases | pass | pretext-gap | platform | unreliable | kit-mismatch |
|---|---:|---:|---:|---:|---:|---:|
| latin | 58080 | 58080 | 0 | 0 | 0 | 0 |
| cjk | 46464 | 46464 | 0 | 0 | 0 | 0 |
| arabic | 46464 | 46464 | 0 | 0 | 0 | 0 |
| emoji-chat | 58080 | 58041 | 39 | 0 | 0 | 0 |
| urls | 46464 | 46383 | 81 | 0 | 0 | 0 |
| german | 61968 | 61717 | 251 | 0 | 0 | 0 |
| french | 61968 | 61663 | 305 | 0 | 0 | 0 |
| ui-labels | 4840 | 4840 | 0 | 0 | 0 | 0 |
| labels | 7776 | 7776 | 0 | 0 | 0 | 0 |

## kit-mismatch cases

None.

## unreliable cases

None.

## platform cases

12931 cases in 85 distinct findings, grouped by text and pattern, with the cases per browser@factor.

- fitFontSize latin: [webkitN-line-height-floor] Latin update: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 229, webkit@1.25 60, webkit@2 60; Helvetica Neue, Arial, Georgia, Times New Roman; 120-205px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Latin update: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Latin compatibility: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 126, webkit@1.25 31, webkit@2 31; Helvetica Neue, Arial, Georgia, Times New Roman; 125-172px). E.g. webkit@1 Helvetica Neue @ 141px: [webkit-26-line-height-floor] Latin compatibility: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize latin: [webkitN-line-height-floor] Latin short: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 61, webkit@1.25 17, webkit@2 17; Helvetica Neue, Arial, Georgia, Times New Roman; 120-137px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Latin short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize latin: [webkitN-line-height-floor] Latin caching: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 207, webkit@1.25 53, webkit@2 53; Helvetica Neue, Arial, Georgia, Times New Roman; 120-202px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Latin caching: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Latin punctuation: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 206, webkit@1.25 53, webkit@2 53; Helvetica Neue, Arial, Georgia, Times New Roman; 120-202px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Latin punctuation: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Latin hyphenation: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 120, webkit@1.25 31, webkit@2 31; Helvetica Neue, Arial, Georgia, Times New Roman; 120-164px). E.g. webkit@1 Helvetica Neue @ 132px: [webkit-26-line-height-floor] Latin hyphenation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize latin: [webkitN-line-height-floor] Gatsby advice: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 226, webkit@1.25 57, webkit@2 57; Helvetica Neue, Arial, Georgia, Times New Roman; 120-203px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Gatsby advice: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Gatsby criticizing: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 235, webkit@1.25 58, webkit@2 58; Helvetica Neue, Arial, Georgia, Times New Roman; 120-223px). E.g. webkit@1 Helvetica Neue @ 137px: [webkit-26-line-height-floor] Gatsby criticizing: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Gatsby reserve: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 295, webkit@1.25 75, webkit@2 75; Helvetica Neue, Arial, Georgia, Times New Roman; 128-250px). E.g. webkit@1 Helvetica Neue @ 142px: [webkit-26-line-height-floor] Gatsby reserve: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Gatsby levity: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 289, webkit@1.25 71, webkit@2 71; Helvetica Neue, Arial, Georgia, Times New Roman; 173-307px). E.g. webkit@1 Helvetica Neue @ 192px: [webkit-26-line-height-floor] Gatsby levity: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize latin: [webkitN-line-height-floor] Gatsby decencies: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 373, webkit@1.25 92, webkit@2 92; Helvetica Neue, Arial, Georgia, Times New Roman; 147-298px). E.g. webkit@1 Helvetica Neue @ 159px: [webkit-26-line-height-floor] Gatsby decencies: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Chinese: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 40, webkit@1.25 12, webkit@2 12; Helvetica Neue, Arial, Georgia, Times New Roman; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Chinese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Japanese: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 104, webkit@1.25 24, webkit@2 24; Helvetica Neue, Arial, Georgia, Times New Roman; 130-155px). E.g. webkit@1 Helvetica Neue @ 130px: [webkit-26-line-height-floor] Japanese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Japanese short: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 105, webkit@1.25 24, webkit@2 24; Helvetica Neue, Arial, Georgia, Times New Roman; 129-155px). E.g. webkit@1 Helvetica Neue @ 130px: [webkit-26-line-height-floor] Japanese short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Guxiang winter: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 244, webkit@1.25 64, webkit@2 64; Helvetica Neue, Arial, Georgia, Times New Roman; 132-220px). E.g. webkit@1 Helvetica Neue @ 132px: [webkit-26-line-height-floor] Guxiang winter: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Guxiang memory: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 40, webkit@1.25 12, webkit@2 12; Helvetica Neue, Arial, Georgia, Times New Roman; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Guxiang memory: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Zhufu year end: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 40, webkit@1.25 12, webkit@2 12; Helvetica Neue, Arial, Georgia, Times New Roman; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Zhufu year end: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Rashomon gate: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 108, webkit@1.25 32, webkit@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 120-168px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Rashomon gate: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize cjk: [webkitN-line-height-floor] Kumo no ito: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 108, webkit@1.25 31, webkit@2 31; Helvetica Neue, Arial, Georgia, Times New Roman; 120-168px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Kumo no ito: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Mixed en+ar: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 85, webkit@1.25 23, webkit@2 23; Helvetica Neue, Arial, Georgia, Times New Roman; 120-148px). E.g. webkit@1 Helvetica Neue @ 126px: [webkit-26-line-height-floor] Mixed en+ar: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Mixed report: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 86, webkit@1.25 23, webkit@2 23; Helvetica Neue, Arial, Georgia, Times New Roman; 123-160px). E.g. webkit@1 Helvetica Neue @ 136px: [webkit-26-line-height-floor] Mixed report: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Numbers+RTL: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 11, webkit@1.25 4, webkit@2 4; Helvetica Neue, Arial, Georgia; 120-125px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Numbers+RTL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Long mixed: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 335, webkit@1.25 85, webkit@2 85; Helvetica Neue, Arial, Georgia, Times New Roman; 131-268px). E.g. webkit@1 Helvetica Neue @ 148px: [webkit-26-line-height-floor] Long mixed: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Bukhala book: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 95, webkit@1.25 24, webkit@2 24; Helvetica Neue, Arial, Georgia, Times New Roman; 127-160px). E.g. webkit@1 Helvetica Neue @ 135px: [webkit-26-line-height-floor] Bukhala book: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Bukhala names: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 79, webkit@1.25 21, webkit@2 21; Helvetica Neue, Arial, Georgia, Times New Roman; 120-141px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Bukhala names: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Ghufran waves: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 7, webkit@1.25 2, webkit@2 2; Helvetica Neue, Georgia; 120-123px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Ghufran waves: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Ghufran tree: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 117, webkit@1.25 29, webkit@2 29; Helvetica Neue, Arial, Georgia, Times New Roman; 128-169px). E.g. webkit@1 Helvetica Neue @ 139px: [webkit-26-line-height-floor] Ghufran tree: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize arabic: [webkitN-line-height-floor] Support thread: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 37, webkit@1.25 11, webkit@2 11; Helvetica Neue, Arial, Georgia, Times New Roman; 120-133px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Support thread: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize emoji-chat: [webkitN-line-height-floor] Emoji mixed: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 26, webkit@1.25 7, webkit@2 7; Helvetica Neue, Arial, Georgia; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Emoji mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize emoji-chat: [webkitN-line-height-floor] Status emoji: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 27, webkit@1.25 8, webkit@2 8; Helvetica Neue, Arial, Georgia; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Status emoji: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize emoji-chat: [webkitN-line-height-floor] Ship it: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 35, webkit@1.25 11, webkit@2 11; Helvetica Neue, Arial, Georgia, Times New Roman; 120-132px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Ship it: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize emoji-chat: [webkitN-line-height-floor] Flags: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 21, webkit@1.25 6, webkit@2 6; Helvetica Neue, Arial, Georgia; 120-127px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Flags: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize urls: [webkitN-line-height-floor] Backup URL: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 130, webkit@1.25 33, webkit@2 33; Helvetica Neue, Arial, Georgia, Times New Roman; 120-179px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Backup URL: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] Query string: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 93, webkit@1.25 23, webkit@2 23; Helvetica Neue, Arial, Georgia, Times New Roman; 147-222px). E.g. webkit@1 Helvetica Neue @ 167px: [webkit-26-line-height-floor] Query string: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] Unix path: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 130, webkit@1.25 32, webkit@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 120-163px). E.g. webkit@1 Helvetica Neue @ 127px: [webkit-26-line-height-floor] Unix path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize urls: [webkitN-line-height-floor] Windows path: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 188, webkit@1.25 49, webkit@2 49; Helvetica Neue, Arial, Georgia, Times New Roman; 120-195px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Windows path: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] macOS path: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 234, webkit@1.25 58, webkit@2 58; Helvetica Neue, Arial, Georgia, Times New Roman; 120-194px). E.g. webkit@1 Helvetica Neue @ 133px: [webkit-26-line-height-floor] macOS path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize urls: [webkitN-line-height-floor] Hash: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 482, webkit@1.25 121, webkit@2 121; Helvetica Neue, Arial, Georgia, Times New Roman; 120-283px). E.g. webkit@1 Helvetica Neue @ 124px: [webkit-26-line-height-floor] Hash: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] Data URI: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 284, webkit@1.25 70, webkit@2 70; Helvetica Neue, Arial, Georgia, Times New Roman; 130-233px). E.g. webkit@1 Helvetica Neue @ 132px: [webkit-26-line-height-floor] Data URI: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] npm scope: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 135, webkit@1.25 34, webkit@2 34; Helvetica Neue, Arial, Georgia, Times New Roman; 125-176px). E.g. webkit@1 Helvetica Neue @ 141px: [webkit-26-line-height-floor] npm scope: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize urls: [webkitN-line-height-floor] Email list: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 280, webkit@1.25 71, webkit@2 71; Helvetica Neue, Arial, Georgia, Times New Roman; 120-217px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Email list: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] Snake case: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 382, webkit@1.25 94, webkit@2 94; Helvetica Neue, Arial, Georgia, Times New Roman; 141-288px). E.g. webkit@1 Helvetica Neue @ 141px: [webkit-26-line-height-floor] Snake case: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize urls: [webkitN-line-height-floor] Path with spaces: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 92, webkit@1.25 23, webkit@2 23; Helvetica Neue, Arial, Georgia, Times New Roman; 121-157px). E.g. webkit@1 Helvetica Neue @ 130px: [webkit-26-line-height-floor] Path with spaces: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Tagesabschluss: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 108, webkit@1.25 27, webkit@2 27; Helvetica Neue, Arial, Georgia, Times New Roman; 120-156px). E.g. webkit@1 Helvetica Neue @ 127px: [webkit-26-line-height-floor] Tagesabschluss: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Nebenrollen: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 123, webkit@1.25 31, webkit@2 31; Helvetica Neue, Arial, Georgia, Times New Roman; 120-159px). E.g. webkit@1 Helvetica Neue @ 127px: [webkit-26-line-height-floor] Nebenrollen: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Datenschutz: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 126, webkit@1.25 32, webkit@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 120-173px). E.g. webkit@1 Helvetica Neue @ 139px: [webkit-26-line-height-floor] Datenschutz: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Umfrage: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 115, webkit@1.25 29, webkit@2 29; Helvetica Neue, Arial, Georgia, Times New Roman; 121-164px). E.g. webkit@1 Helvetica Neue @ 134px: [webkit-26-line-height-floor] Umfrage: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Versicherung: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 127, webkit@1.25 32, webkit@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 120-164px). E.g. webkit@1 Helvetica Neue @ 131px: [webkit-26-line-height-floor] Versicherung: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Kapitän: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 128, webkit@1.25 32, webkit@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 125-170px). E.g. webkit@1 Helvetica Neue @ 136px: [webkit-26-line-height-floor] Kapitän: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Fehlermeldung: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 22, webkit@1.25 6, webkit@2 6; Helvetica Neue, Arial, Georgia; 120-127px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Fehlermeldung: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Baustellen: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 117, webkit@1.25 29, webkit@2 29; Helvetica Neue, Arial, Georgia, Times New Roman; 124-168px). E.g. webkit@1 Helvetica Neue @ 139px: [webkit-26-line-height-floor] Baustellen: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Förderung: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 149, webkit@1.25 36, webkit@2 36; Helvetica Neue, Arial, Georgia, Times New Roman; 125-175px). E.g. webkit@1 Helvetica Neue @ 137px: [webkit-26-line-height-floor] Förderung: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Produktion: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 116, webkit@1.25 29, webkit@2 29; Helvetica Neue, Arial, Georgia, Times New Roman; 123-163px). E.g. webkit@1 Helvetica Neue @ 131px: [webkit-26-line-height-floor] Produktion: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] One word: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 6, webkit@1.25 3, webkit@2 3; Helvetica Neue, Arial, Georgia; 120-122px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] One word: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize german: [webkitN-line-height-floor] Portal: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 151, webkit@1.25 37, webkit@2 37; Helvetica Neue, Arial, Georgia, Times New Roman; 125-175px). E.g. webkit@1 Helvetica Neue @ 136px: [webkit-26-line-height-floor] Portal: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Synchroniser: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 61, webkit@1.25 17, webkit@2 17; Helvetica Neue, Arial, Georgia, Times New Roman; 120-137px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Synchroniser: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Rappels: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 84, webkit@1.25 22, webkit@2 22; Helvetica Neue, Arial, Georgia, Times New Roman; 120-148px). E.g. webkit@1 Helvetica Neue @ 122px: [webkit-26-line-height-floor] Rappels: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Responsabilité: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 173, webkit@1.25 45, webkit@2 45; Helvetica Neue, Arial, Georgia, Times New Roman; 120-187px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Responsabilité: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- fitFontSize french: [webkitN-line-height-floor] Syndicats: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 110, webkit@1.25 27, webkit@2 27; Helvetica Neue, Arial, Georgia, Times New Roman; 120-157px). E.g. webkit@1 Helvetica Neue @ 127px: [webkit-26-line-height-floor] Syndicats: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Anticonstitutionnalité: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 84, webkit@1.25 23, webkit@2 23; Helvetica Neue, Arial, Georgia, Times New Roman; 120-146px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Anticonstitutionnalité: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Conditions: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 38, webkit@1.25 10, webkit@2 10; Helvetica Neue, Arial, Georgia; 120-134px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Conditions: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Mot de passe: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 27, webkit@1.25 8, webkit@2 8; Helvetica Neue, Arial, Georgia; 120-129px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Mot de passe: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- fitFontSize french: [webkitN-line-height-floor] Récit: returned Npx, but Npx paints N lines × N (CSS line-height N) = N and fits (webkit@1 147, webkit@1.25 40, webkit@2 40; Helvetica Neue, Arial, Georgia, Times New Roman; 120-185px). E.g. webkit@1 Helvetica Neue @ 120px: [webkit-26-line-height-floor] Récit: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits

## pretext-gap cases

21978 cases in 1893 distinct findings, grouped by text and pattern, with the cases per browser@factor.

- shrinkwrap latin "Gatsby decencies": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Helvetica Neue; 375-375px). E.g. chromium@1 Helvetica Neue @ 375px: widest line: DOM 375.0078125px (wants 375), Pretext 367.6477355957031px (gave 368)
- shrinkwrap latin "Latin compatibility": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 317-317px). E.g. chromium@1 Arial @ 317px: widest line: DOM 317.0078125px (wants 317), Pretext 283.6875px (gave 284)
- shrinkwrap latin "Latin punctuation": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 394-394px). E.g. chromium@1 Arial @ 394px: widest line: DOM 394.0078125px (wants 394), Pretext 369.8359375px (gave 370)
- shrinkwrap latin "Gatsby reserve": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1; Georgia; 142-592px). E.g. chromium@1 Georgia @ 142px: baseline: DOM 9 lines, Pretext 10
- shrinkwrap cjk "Japanese": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 400, chromium@1.25 100, chromium@2 100; Georgia; 127-600px). E.g. chromium@1 Georgia @ 127px: widest line: DOM 126.7265625px (wants 127), Pretext 125.91999816894531px (gave 126)
- shrinkwrap cjk "Japanese": baseline: DOM N lines, Pretext N (chromium@1 4; Georgia; 159-381px). E.g. chromium@1 Georgia @ 159px: baseline: DOM 5 lines, Pretext 6
- shrinkwrap cjk "Japanese short": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 253, chromium@1.25 63, chromium@2 63; Georgia; 143-600px). E.g. chromium@1 Georgia @ 143px: widest line: DOM 142.2421875px (wants 143), Pretext 141.9199981689453px (gave 142)
- shrinkwrap cjk "Japanese short": baseline: DOM N lines, Pretext N (chromium@1 2; Georgia; 191-381px). E.g. chromium@1 Georgia @ 191px: baseline: DOM 4 lines, Pretext 5
- shrinkwrap cjk "Kumo no ito": baseline: DOM N lines, Pretext N (chromium@1 6; Georgia; 127-415px). E.g. chromium@1 Georgia @ 127px: baseline: DOM 7 lines, Pretext 8
- shrinkwrap cjk "Kumo no ito": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 376, chromium@1.25 99, chromium@2 99; Georgia; 159-600px). E.g. chromium@1 Georgia @ 159px: widest line: DOM 158.8828125px (wants 159), Pretext 157.9199981689453px (gave 158)
- shrinkwrap arabic "Ghufran tree": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 4, chromium@1.25 1, chromium@2 1; Helvetica Neue, Arial, Times New Roman; 131-490px). E.g. chromium@1 Helvetica Neue @ 131px: widest line: DOM 131.0078125px (wants 131), Pretext 128.79415893554688px (gave 129)
- shrinkwrap arabic "Numbers+RTL": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 251-251px). E.g. chromium@1 Arial @ 251px: baseline: DOM 2 lines, Pretext 3
- shrinkwrap arabic "Long mixed": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 54, chromium@1.25 13, chromium@2 13; Arial, Times New Roman; 151-526px). E.g. chromium@1 Arial @ 493px: widest line: DOM 492.796875px (wants 493), Pretext 467.625px (gave 468)
- shrinkwrap arabic "Support thread": baseline: DOM N lines, Pretext N (chromium@1 5, chromium@1.25 3, chromium@2 3; Arial, Times New Roman; 124-590px). E.g. chromium@1 Arial @ 135px: baseline: DOM 5 lines, Pretext 6
- shrinkwrap arabic "Support thread": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 618, chromium@1.25 156, chromium@2 156; Arial, Times New Roman; 125-600px). E.g. chromium@1 Arial @ 136px: widest line: DOM 134.296875px (wants 135), Pretext 135.1796875px (gave 136)
- shrinkwrap arabic "Long mixed": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 294-294px). E.g. chromium@1 Times New Roman @ 294px: baseline: DOM 4 lines, Pretext 5
- shrinkwrap emoji-chat "Emoji mixed": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 450-450px). E.g. chromium@1 Arial @ 450px: widest line: DOM 450.0078125px (wants 450), Pretext 432.21875px (gave 433)
- shrinkwrap emoji-chat "Flags": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 198-198px). E.g. chromium@1 Arial @ 198px: widest line: DOM 198.0078125px (wants 198), Pretext 177.5625px (gave 178)
- shrinkwrap emoji-chat "Flags": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 535-535px). E.g. chromium@1 Arial @ 535px: baseline: DOM 1 lines, Pretext 2
- shrinkwrap emoji-chat "Keycaps": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 41, chromium@1.25 10, chromium@2 10; Arial, Times New Roman; 345-385px). E.g. chromium@1 Arial @ 365px: widest line: DOM 364.8828125px (wants 365), Pretext 338.203125px (gave 339)
- shrinkwrap emoji-chat "ZWJ family": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 257-257px). E.g. chromium@1 Arial @ 257px: baseline: DOM 2 lines, Pretext 3
- shrinkwrap emoji-chat "Weather report": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 206-206px). E.g. chromium@1 Times New Roman @ 206px: baseline: DOM 2 lines, Pretext 3
- shrinkwrap urls "Backup URL": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 11, chromium@1.25 4, chromium@2 4; Helvetica Neue, Georgia; 140-236px). E.g. chromium@1 Helvetica Neue @ 186px: widest line: DOM 185.828125px (wants 186), Pretext 176.92784118652344px (gave 177)
- shrinkwrap urls "Bare URL": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 57, chromium@1.25 13, chromium@2 13; Helvetica Neue, Georgia; 126-399px). E.g. chromium@1 Helvetica Neue @ 126px: widest line: DOM 125.9375px (wants 126), Pretext 118.84788513183594px (gave 119)
- shrinkwrap urls "Bare URL": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue, Arial; 177-274px). E.g. chromium@1 Helvetica Neue @ 274px: baseline: DOM 2 lines, Pretext 3
- shrinkwrap urls "Query string": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue; 125-246px). E.g. chromium@1 Helvetica Neue @ 125px: baseline: DOM 10 lines, Pretext 11
- shrinkwrap urls "Query string": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 269, chromium@1.25 68, chromium@2 68, webkit@1 1, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 125-600px). E.g. chromium@1 Helvetica Neue @ 130px: widest line: DOM 128.7265625px (wants 129), Pretext 129.00787353515625px (gave 130)
- shrinkwrap urls "Unix path": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Helvetica Neue; 355-355px). E.g. chromium@1 Helvetica Neue @ 355px: widest line: DOM 355.0078125px (wants 355), Pretext 346.1116638183594px (gave 347)
- shrinkwrap urls "Windows path": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 277, chromium@1.25 70, chromium@2 70, firefox@1 6, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial, Times New Roman; 134-565px). E.g. chromium@1 Helvetica Neue @ 151px: widest line: DOM 150.7890625px (wants 151), Pretext 149.63185119628906px (gave 150)
- shrinkwrap urls "Data URI": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 692, chromium@1.25 181, chromium@2 181, webkit@1 42, webkit@1.25 11, webkit@2 11, firefox@1 83, firefox@1.25 21, firefox@2 21; Helvetica Neue, Arial, Georgia, Times New Roman; 120-600px). E.g. chromium@1 Helvetica Neue @ 121px: widest line: DOM 118.5625px (wants 119), Pretext 120.5599365234375px (gave 121)
- shrinkwrap urls "Data URI": baseline: DOM N lines, Pretext N (chromium@1 24, chromium@1.25 7, chromium@2 7, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 127-570px). E.g. chromium@1 Helvetica Neue @ 144px: baseline: DOM 8 lines, Pretext 9
- shrinkwrap urls "npm scope": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 46, chromium@1.25 13, chromium@2 13; Helvetica Neue, Times New Roman; 129-568px). E.g. chromium@1 Helvetica Neue @ 129px: widest line: DOM 128.9609375px (wants 129), Pretext 126.81587219238281px (gave 127)
- shrinkwrap urls "npm scope": baseline: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 245-245px). E.g. chromium@1 Helvetica Neue @ 245px: baseline: DOM 3 lines, Pretext 4
- shrinkwrap urls "Snake case": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 791, chromium@1.25 198, chromium@2 198, firefox@1 31, firefox@1.25 7, firefox@2 7; Helvetica Neue, Arial, Georgia, Times New Roman; 120-590px). E.g. chromium@1 Helvetica Neue @ 126px: widest line: DOM 125.6484375px (wants 126), Pretext 124.76789855957031px (gave 125)
- shrinkwrap urls "Path with spaces": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 10, chromium@1.25 2, chromium@2 2; Helvetica Neue; 162-171px). E.g. chromium@1 Helvetica Neue @ 162px: widest line: DOM 161.84375px (wants 162), Pretext 160.01583862304688px (gave 161)
- shrinkwrap urls "Unix path": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 153-153px). E.g. chromium@1 Arial @ 153px: baseline: DOM 5 lines, Pretext 6
- shrinkwrap urls "macOS path": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 145-145px). E.g. chromium@1 Arial @ 145px: widest line: DOM 145.0078125px (wants 145), Pretext 142.2890625px (gave 143)
- shrinkwrap urls "Hash": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Arial; 234-234px). E.g. chromium@1 Arial @ 234px: widest line: DOM 234.0078125px (wants 234), Pretext 225.109375px (gave 226)
- shrinkwrap urls "Snake case": baseline: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1; Arial, Times New Roman; 129-303px). E.g. chromium@1 Arial @ 129px: baseline: DOM 9 lines, Pretext 10
- shrinkwrap german "Nebenrollen": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 26, chromium@1.25 8, chromium@2 8; Helvetica Neue, Arial, Georgia, Times New Roman; 159-265px). E.g. chromium@1 Helvetica Neue @ 172px: widest line: DOM 170.453125px (wants 171), Pretext 178.0958251953125px (gave 172)
- shrinkwrap german "Datenschutz": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 15, chromium@1.25 2, chromium@2 2, webkit@1 42, webkit@1.25 10, webkit@2 10, firefox@1 75, firefox@1.25 19, firefox@2 19; Helvetica Neue, Arial, Times New Roman; 170-585px). E.g. chromium@1 Helvetica Neue @ 177px: widest line: DOM 176.9296875px (wants 177), Pretext 170.9278106689453px (gave 171)
- shrinkwrap german "Fehlermeldung": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 2, firefox@2 2; Helvetica Neue; 128-594px). E.g. chromium@1 Helvetica Neue @ 212px: baseline: DOM 3 lines, Pretext 4
- shrinkwrap german "Fehlermeldung": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1, webkit@1 1, firefox@1 17, firefox@1.25 4, firefox@2 4; Helvetica Neue; 129-600px). E.g. chromium@1 Helvetica Neue @ 213px: widest line: DOM 211.890625px (wants 212), Pretext 212.1758270263672px (gave 213)
- shrinkwrap german "Förderung": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 163, chromium@1.25 40, chromium@2 40, webkit@1 203, webkit@1.25 51, webkit@2 51, firefox@1 178, firefox@1.25 44, firefox@2 44; Helvetica Neue, Arial, Times New Roman; 142-600px). E.g. chromium@1 Helvetica Neue @ 158px: widest line: DOM 157.796875px (wants 158), Pretext 152.31985473632812px (gave 153)
- shrinkwrap german "One word": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 30, chromium@1.25 7, chromium@2 7, firefox@1 62, firefox@1.25 16, firefox@2 16; Helvetica Neue, Georgia; 329-600px). E.g. chromium@1 Helvetica Neue @ 509px: widest line: DOM 507.9609375px (wants 508), Pretext 508.2395935058594px (gave 509)
- shrinkwrap german "Umfrage": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 3; Arial, Georgia, Times New Roman; 201-363px). E.g. chromium@1 Arial @ 201px: widest line: DOM 201.0078125px (wants 201), Pretext 195.671875px (gave 196)
- shrinkwrap german "Kapitän": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 1; Arial, Helvetica Neue; 164-262px). E.g. chromium@1 Arial @ 164px: baseline: DOM 6 lines, Pretext 5
- shrinkwrap german "Kapitän": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 179, chromium@1.25 47, chromium@2 47, webkit@1 202, webkit@1.25 54, webkit@2 54, firefox@1 201, firefox@1.25 52, firefox@2 52; Arial, Times New Roman; 148-557px). E.g. chromium@1 Arial @ 222px: widest line: DOM 220.8515625px (wants 221), Pretext 221.140625px (gave 222)
- shrinkwrap german "Baustellen": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 3, chromium@1.25 1, chromium@2 1; Arial, Georgia; 153-427px). E.g. chromium@1 Arial @ 153px: widest line: DOM 153.0078125px (wants 153), Pretext 147.625px (gave 148)
- shrinkwrap german "Tagesabschluss": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 1; Georgia; 453-453px). E.g. chromium@1 Georgia @ 453px: widest line: DOM 453.0078125px (wants 453), Pretext 424.2890625px (gave 425)
- shrinkwrap french "Synchroniser": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 1, firefox@2 1; Helvetica Neue; 121-231px). E.g. chromium@1 Helvetica Neue @ 140px: baseline: DOM 6 lines, Pretext 5
- shrinkwrap french "Synchroniser": at returned Npx: DOM N lines, Pretext N (chromium@1 25, chromium@1.25 6, chromium@2 6, firefox@1 29, firefox@1.25 7, firefox@2 7; Helvetica Neue; 122-254px). E.g. chromium@1 Helvetica Neue @ 141px: at returned 140px: DOM 6 lines, Pretext 5
- shrinkwrap french "Synchroniser": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 26, chromium@1.25 6, chromium@2 6, webkit@1 19, webkit@1.25 5, webkit@2 5, firefox@1 51, firefox@1.25 12, firefox@2 12; Helvetica Neue, Times New Roman; 171-593px). E.g. chromium@1 Helvetica Neue @ 285px: widest line: DOM 272.0703125px (wants 273), Pretext 284.7677764892578px (gave 285)
- shrinkwrap french "Justificatifs": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 252, chromium@1.25 63, chromium@2 63, webkit@1 237, webkit@1.25 59, webkit@2 59, firefox@1 265, firefox@1.25 67, firefox@2 67; Helvetica Neue, Times New Roman; 130-450px). E.g. chromium@1 Helvetica Neue @ 130px: widest line: DOM 128.7421875px (wants 129), Pretext 129.18386840820312px (gave 130)
- shrinkwrap french "Responsabilité": baseline: DOM N lines, Pretext N (chromium@1 2, firefox@1 2; Helvetica Neue; 178-286px). E.g. chromium@1 Helvetica Neue @ 178px: baseline: DOM 6 lines, Pretext 5
- shrinkwrap french "Responsabilité": at returned Npx: DOM N lines, Pretext N (chromium@1 22, chromium@1.25 6, chromium@2 6, firefox@1 22, firefox@1.25 6, firefox@2 6; Helvetica Neue; 179-302px). E.g. chromium@1 Helvetica Neue @ 179px: at returned 178px: DOM 6 lines, Pretext 5
- shrinkwrap french "Responsabilité": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 106, chromium@1.25 26, chromium@2 26, webkit@1 1, firefox@1 54, firefox@1.25 13, firefox@2 13; Helvetica Neue, Times New Roman; 134-590px). E.g. chromium@1 Helvetica Neue @ 196px: widest line: DOM 188.5px (wants 189), Pretext 195.88784790039062px (gave 196)
- shrinkwrap french "Syndicats": baseline: DOM N lines, Pretext N (chromium@1 16, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 134-155px). E.g. chromium@1 Helvetica Neue @ 150px: baseline: DOM 6 lines, Pretext 5
- shrinkwrap french "Syndicats": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 30, chromium@1.25 7, chromium@2 7, webkit@1 8, webkit@1.25 2, webkit@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 131-458px). E.g. chromium@1 Helvetica Neue @ 422px: widest line: DOM 397.734375px (wants 398), Pretext 427.66371154785156px (gave 422)
- shrinkwrap french "Récit": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 169, chromium@1.25 43, chromium@2 43, webkit@1 166, webkit@1.25 43, webkit@2 43, firefox@1 204, firefox@1.25 52, firefox@2 52; Helvetica Neue, Times New Roman; 219-600px). E.g. chromium@1 Helvetica Neue @ 271px: widest line: DOM 269.734375px (wants 270), Pretext 270.0157928466797px (gave 271)
- shrinkwrap french "Récit": baseline: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 302-302px). E.g. chromium@1 Helvetica Neue @ 302px: baseline: DOM 3 lines, Pretext 4
- shrinkwrap french "Anticonstitutionnalité": widest line: DOM Npx (wants N), Pretext Npx (gave N) (chromium@1 2, webkit@1 11, webkit@1.25 3, webkit@2 3; Arial, Georgia, Times New Roman; 361-595px). E.g. chromium@1 Arial @ 595px: widest line: DOM 595.0078125px (wants 595), Pretext 568.3359375px (gave 569)
- balance latin "Gatsby reserve": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1; Georgia; 142-592px). E.g. chromium@1 Georgia @ 142px: baseline: DOM 9 lines, Pretext 10
- balance latin "Gatsby reserve": at Npx: DOM N lines, Pretext N (chromium@1 19, chromium@1.25 5, chromium@2 5; Georgia; 143-600px). E.g. chromium@1 Georgia @ 143px: at 142px: DOM 9 lines, Pretext 10
- balance cjk "Japanese": baseline: DOM N lines, Pretext N (chromium@1 4; Georgia; 159-381px). E.g. chromium@1 Georgia @ 159px: baseline: DOM 5 lines, Pretext 6
- balance cjk "Japanese": at Npx: DOM N lines, Pretext N (chromium@1 438, chromium@1.25 111, chromium@2 111; Georgia; 160-600px). E.g. chromium@1 Georgia @ 160px: at 159px: DOM 5 lines, Pretext 6
- balance cjk "Japanese short": baseline: DOM N lines, Pretext N (chromium@1 2; Georgia; 191-381px). E.g. chromium@1 Georgia @ 191px: baseline: DOM 4 lines, Pretext 5
- balance cjk "Japanese short": at Npx: DOM N lines, Pretext N (chromium@1 281, chromium@1.25 71, chromium@2 71; Georgia; 192-600px). E.g. chromium@1 Georgia @ 192px: at 191px: DOM 4 lines, Pretext 5
- balance cjk "Kumo no ito": at Npx: DOM N lines, Pretext N (chromium@1 442, chromium@1.25 113, chromium@2 113; Georgia; 120-600px). E.g. chromium@1 Georgia @ 120px: at 111px: DOM 8 lines, Pretext 9
- balance cjk "Kumo no ito": baseline: DOM N lines, Pretext N (chromium@1 6; Georgia; 127-415px). E.g. chromium@1 Georgia @ 127px: baseline: DOM 7 lines, Pretext 8
- balance arabic "Numbers+RTL": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 251-251px). E.g. chromium@1 Arial @ 251px: baseline: DOM 2 lines, Pretext 3
- balance arabic "Numbers+RTL": at Npx: DOM N lines, Pretext N (chromium@1 249, chromium@1.25 63, chromium@2 63; Arial; 252-500px). E.g. chromium@1 Arial @ 252px: at 251px: DOM 2 lines, Pretext 3
- balance arabic "Support thread": baseline: DOM N lines, Pretext N (chromium@1 5, chromium@1.25 3, chromium@2 3; Arial, Times New Roman; 124-590px). E.g. chromium@1 Arial @ 135px: baseline: DOM 5 lines, Pretext 6
- balance arabic "Support thread": at Npx: DOM N lines, Pretext N (chromium@1 370, chromium@1.25 92, chromium@2 92; Arial, Times New Roman; 125-600px). E.g. chromium@1 Arial @ 136px: at 135px: DOM 5 lines, Pretext 6
- balance arabic "Long mixed": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 294-294px). E.g. chromium@1 Times New Roman @ 294px: baseline: DOM 4 lines, Pretext 5
- balance arabic "Long mixed": at Npx: DOM N lines, Pretext N (chromium@1 83, chromium@1.25 21, chromium@2 21; Times New Roman; 295-377px). E.g. chromium@1 Times New Roman @ 295px: at 294px: DOM 4 lines, Pretext 5
- balance emoji-chat "Flags": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 535-535px). E.g. chromium@1 Arial @ 535px: baseline: DOM 1 lines, Pretext 2
- balance emoji-chat "Flags": at Npx: DOM N lines, Pretext N (chromium@1 65, chromium@1.25 17, chromium@2 17; Arial; 536-600px). E.g. chromium@1 Arial @ 536px: at 535px: DOM 1 lines, Pretext 2
- balance emoji-chat "ZWJ family": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 257-257px). E.g. chromium@1 Arial @ 257px: baseline: DOM 2 lines, Pretext 3
- balance emoji-chat "ZWJ family": at Npx: DOM N lines, Pretext N (chromium@1 240, chromium@1.25 60, chromium@2 60; Arial; 258-497px). E.g. chromium@1 Arial @ 258px: at 257px: DOM 2 lines, Pretext 3
- balance emoji-chat "Weather report": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 206-206px). E.g. chromium@1 Times New Roman @ 206px: baseline: DOM 2 lines, Pretext 3
- balance emoji-chat "Weather report": at Npx: DOM N lines, Pretext N (chromium@1 206, chromium@1.25 52, chromium@2 52; Times New Roman; 207-412px). E.g. chromium@1 Times New Roman @ 207px: at 206px: DOM 2 lines, Pretext 3
- balance urls "Bare URL": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue, Arial; 177-274px). E.g. chromium@1 Helvetica Neue @ 274px: baseline: DOM 2 lines, Pretext 3
- balance urls "Bare URL": at Npx: DOM N lines, Pretext N (chromium@1 354, chromium@1.25 88, chromium@2 88; Helvetica Neue, Arial; 178-542px). E.g. chromium@1 Helvetica Neue @ 275px: at 274px: DOM 2 lines, Pretext 3
- balance urls "Query string": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue; 125-246px). E.g. chromium@1 Helvetica Neue @ 125px: baseline: DOM 10 lines, Pretext 11
- balance urls "Query string": at Npx: DOM N lines, Pretext N (chromium@1 30, chromium@1.25 8, chromium@2 8; Helvetica Neue; 126-273px). E.g. chromium@1 Helvetica Neue @ 126px: at 125px: DOM 10 lines, Pretext 11
- balance urls "Data URI": baseline: DOM N lines, Pretext N (chromium@1 24, chromium@1.25 7, chromium@2 7, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 127-570px). E.g. chromium@1 Helvetica Neue @ 144px: baseline: DOM 8 lines, Pretext 9
- balance urls "Data URI": at Npx: DOM N lines, Pretext N (chromium@1 697, chromium@1.25 175, chromium@2 175, firefox@1 173, firefox@1.25 44, firefox@2 44; Helvetica Neue, Arial, Times New Roman; 128-600px). E.g. chromium@1 Helvetica Neue @ 146px: at 145px: DOM 8 lines, Pretext 9
- balance urls "npm scope": baseline: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 245-245px). E.g. chromium@1 Helvetica Neue @ 245px: baseline: DOM 3 lines, Pretext 4
- balance urls "npm scope": at Npx: DOM N lines, Pretext N (chromium@1 242, chromium@1.25 60, chromium@2 60; Helvetica Neue; 246-487px). E.g. chromium@1 Helvetica Neue @ 246px: at 245px: DOM 3 lines, Pretext 4
- balance urls "Unix path": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 153-153px). E.g. chromium@1 Arial @ 153px: baseline: DOM 5 lines, Pretext 6
- balance urls "Unix path": at Npx: DOM N lines, Pretext N (chromium@1 42, chromium@1.25 10, chromium@2 10; Arial; 154-195px). E.g. chromium@1 Arial @ 154px: at 153px: DOM 5 lines, Pretext 6
- balance urls "Snake case": baseline: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1; Arial, Times New Roman; 129-303px). E.g. chromium@1 Arial @ 129px: baseline: DOM 9 lines, Pretext 10
- balance urls "Snake case": at Npx: DOM N lines, Pretext N (chromium@1 73, chromium@1.25 18, chromium@2 18; Arial, Times New Roman; 130-330px). E.g. chromium@1 Arial @ 130px: at 129px: DOM 9 lines, Pretext 10
- balance german "Fehlermeldung": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 2, firefox@2 2; Helvetica Neue; 128-594px). E.g. chromium@1 Helvetica Neue @ 212px: baseline: DOM 3 lines, Pretext 4
- balance german "Fehlermeldung": at Npx: DOM N lines, Pretext N (chromium@1 88, chromium@1.25 22, chromium@2 22, firefox@1 123, firefox@1.25 31, firefox@2 31; Helvetica Neue; 129-600px). E.g. chromium@1 Helvetica Neue @ 213px: at 212px: DOM 3 lines, Pretext 4
- balance german "Kapitän": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 1; Arial, Helvetica Neue; 164-262px). E.g. chromium@1 Arial @ 164px: baseline: DOM 6 lines, Pretext 5
- balance german "Kapitän": at returned Npx: DOM N lines, Pretext N (chromium@1 39, chromium@1.25 9, chromium@2 9, firefox@1 141, firefox@1.25 35, firefox@2 35; Arial, Helvetica Neue; 165-403px). E.g. chromium@1 Arial @ 165px: at returned 164px: DOM 6 lines, Pretext 5
- balance french "Synchroniser": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 1, firefox@2 1; Helvetica Neue; 121-231px). E.g. chromium@1 Helvetica Neue @ 140px: baseline: DOM 6 lines, Pretext 5
- balance french "Synchroniser": at returned Npx: DOM N lines, Pretext N (chromium@1 122, chromium@1.25 31, chromium@2 31, firefox@1 140, firefox@1.25 35, firefox@2 35; Helvetica Neue; 122-325px). E.g. chromium@1 Helvetica Neue @ 141px: at returned 140px: DOM 6 lines, Pretext 5
- balance french "Responsabilité": baseline: DOM N lines, Pretext N (chromium@1 2, firefox@1 2; Helvetica Neue; 178-286px). E.g. chromium@1 Helvetica Neue @ 178px: baseline: DOM 6 lines, Pretext 5
- balance french "Responsabilité": at returned Npx: DOM N lines, Pretext N (chromium@1 203, chromium@1.25 51, chromium@2 51, firefox@1 203, firefox@1.25 51, firefox@2 51; Helvetica Neue; 179-437px). E.g. chromium@1 Helvetica Neue @ 179px: at returned 178px: DOM 6 lines, Pretext 5
- balance french "Syndicats": baseline: DOM N lines, Pretext N (chromium@1 16, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 134-155px). E.g. chromium@1 Helvetica Neue @ 150px: baseline: DOM 6 lines, Pretext 5
- balance french "Syndicats": at returned Npx: DOM N lines, Pretext N (chromium@1 147, chromium@1.25 37, chromium@2 37; Helvetica Neue, Arial, Georgia, Times New Roman; 136-193px). E.g. chromium@1 Helvetica Neue @ 156px: at returned 150px: DOM 6 lines, Pretext 5
- balance french "Récit": at Npx: DOM N lines, Pretext N (chromium@1 159, chromium@1.25 40, chromium@2 40, firefox@1 159, firefox@1.25 40, firefox@2 40; Helvetica Neue; 120-455px). E.g. chromium@1 Helvetica Neue @ 120px: at 113px: DOM 9 lines, Pretext 10
- balance french "Récit": baseline: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 302-302px). E.g. chromium@1 Helvetica Neue @ 302px: baseline: DOM 3 lines, Pretext 4
- fitFontSize latin "Gatsby reserve": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1; Georgia; 142-592px). E.g. chromium@1 Georgia @ 142px: baseline: DOM 9 lines, Pretext 10
- fitFontSize latin "Gatsby reserve": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 143-143px). E.g. chromium@1 Times New Roman @ 143px: returned 10px, at 10px: DOM 5 lines, Pretext 6
- fitFontSize latin "Gatsby decencies": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1; Times New Roman; 516-516px). E.g. chromium@1 Times New Roman @ 516px: returned 19px, at 20px: DOM 3 lines, Pretext 4
- fitFontSize cjk "Japanese": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 26, chromium@1.25 5, chromium@2 5; Georgia; 129-596px). E.g. chromium@1 Georgia @ 129px: returned 12px, at 13px: DOM 5 lines, Pretext 6
- fitFontSize cjk "Japanese": baseline: DOM N lines, Pretext N (chromium@1 4; Georgia; 159-381px). E.g. chromium@1 Georgia @ 159px: baseline: DOM 5 lines, Pretext 6
- fitFontSize cjk "Japanese short": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 19, chromium@1.25 5, chromium@2 5; Georgia; 143-596px). E.g. chromium@1 Georgia @ 143px: returned 12px, at 12px: DOM 4 lines, Pretext 5
- fitFontSize cjk "Japanese short": baseline: DOM N lines, Pretext N (chromium@1 2; Georgia; 191-381px). E.g. chromium@1 Georgia @ 191px: baseline: DOM 4 lines, Pretext 5
- fitFontSize cjk "Kumo no ito": baseline: DOM N lines, Pretext N (chromium@1 6; Georgia; 127-415px). E.g. chromium@1 Georgia @ 127px: baseline: DOM 7 lines, Pretext 8
- fitFontSize cjk "Kumo no ito": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 17, chromium@1.25 5, chromium@2 5; Georgia; 194-597px). E.g. chromium@1 Georgia @ 194px: returned 14px, at 15px: DOM 4 lines, Pretext 5
- fitFontSize arabic "Bukhala names": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 305-305px). E.g. chromium@1 Helvetica Neue @ 305px: returned 19px, at 20px: DOM 3 lines, Pretext 4
- fitFontSize arabic "Numbers+RTL": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 251-251px). E.g. chromium@1 Arial @ 251px: baseline: DOM 2 lines, Pretext 3
- fitFontSize arabic "Support thread": baseline: DOM N lines, Pretext N (chromium@1 5, chromium@1.25 3, chromium@2 3; Arial, Times New Roman; 124-590px). E.g. chromium@1 Arial @ 135px: baseline: DOM 5 lines, Pretext 6
- fitFontSize arabic "Support thread": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 35, chromium@1.25 8, chromium@2 8; Arial, Times New Roman; 373-592px). E.g. chromium@1 Arial @ 401px: returned 21px, at 21px: DOM 2 lines, Pretext 3
- fitFontSize arabic "Long mixed": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 294-294px). E.g. chromium@1 Times New Roman @ 294px: baseline: DOM 4 lines, Pretext 5
- fitFontSize arabic "Long mixed": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 3, chromium@1.25 1, chromium@2 1; Times New Roman; 401-519px). E.g. chromium@1 Times New Roman @ 401px: returned 16px, at 17px: DOM 3 lines, Pretext 4
- fitFontSize emoji-chat "Flags": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 535-535px). E.g. chromium@1 Arial @ 535px: baseline: DOM 1 lines, Pretext 2
- fitFontSize emoji-chat "ZWJ family": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 257-257px). E.g. chromium@1 Arial @ 257px: baseline: DOM 2 lines, Pretext 3
- fitFontSize emoji-chat "Weather report": baseline: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 206-206px). E.g. chromium@1 Times New Roman @ 206px: baseline: DOM 2 lines, Pretext 3
- fitFontSize urls "Bare URL": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue, Arial; 177-274px). E.g. chromium@1 Helvetica Neue @ 274px: baseline: DOM 2 lines, Pretext 3
- fitFontSize urls "Bare URL": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 7, chromium@1.25 2, chromium@2 2; Helvetica Neue; 394-565px). E.g. chromium@1 Helvetica Neue @ 394px: returned 22px, at 23px: DOM 2 lines, Pretext 3
- fitFontSize urls "Query string": baseline: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue; 125-246px). E.g. chromium@1 Helvetica Neue @ 125px: baseline: DOM 10 lines, Pretext 11
- fitFontSize urls "Query string": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 5; Helvetica Neue, Arial; 169-467px). E.g. chromium@1 Helvetica Neue @ 169px: returned 10px, at 11px: DOM 5 lines, Pretext 6
- fitFontSize urls "Data URI": baseline: DOM N lines, Pretext N (chromium@1 24, chromium@1.25 7, chromium@2 7, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 127-570px). E.g. chromium@1 Helvetica Neue @ 144px: baseline: DOM 8 lines, Pretext 9
- fitFontSize urls "Data URI": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 49, chromium@1.25 12, chromium@2 12; Helvetica Neue, Arial, Georgia, Times New Roman; 158-522px). E.g. chromium@1 Helvetica Neue @ 158px: returned 10px, at 11px: DOM 5 lines, Pretext 6
- fitFontSize urls "npm scope": baseline: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 245-245px). E.g. chromium@1 Helvetica Neue @ 245px: baseline: DOM 3 lines, Pretext 4
- fitFontSize urls "npm scope": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 3; Helvetica Neue, Times New Roman; 145-337px). E.g. chromium@1 Helvetica Neue @ 291px: returned 18px, at 19px: DOM 3 lines, Pretext 4
- fitFontSize urls "Unix path": baseline: DOM N lines, Pretext N (chromium@1 1; Arial; 153-153px). E.g. chromium@1 Arial @ 153px: baseline: DOM 5 lines, Pretext 6
- fitFontSize urls "Snake case": baseline: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1; Arial, Times New Roman; 129-303px). E.g. chromium@1 Arial @ 129px: baseline: DOM 9 lines, Pretext 10
- fitFontSize urls "Snake case": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1; Times New Roman; 189-246px). E.g. chromium@1 Times New Roman @ 189px: returned 10px, at 10px: DOM 5 lines, Pretext 6
- fitFontSize urls "Path with spaces": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Times New Roman; 490-490px). E.g. chromium@1 Times New Roman @ 490px: returned 23px, at 24px: DOM 2 lines, Pretext 3
- fitFontSize german "Datenschutz": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1; Helvetica Neue, Arial; 368-589px). E.g. chromium@1 Helvetica Neue @ 589px: returned 22px, at 23px: DOM 2 lines, Pretext 3
- fitFontSize german "Kapitän": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1, firefox@1 4, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial; 123-360px). E.g. chromium@1 Helvetica Neue @ 278px: returned 17px, at 17px: DOM 4 lines, Pretext 3
- fitFontSize german "Fehlermeldung": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 2, firefox@2 2; Helvetica Neue; 128-594px). E.g. chromium@1 Helvetica Neue @ 212px: baseline: DOM 3 lines, Pretext 4
- fitFontSize german "Fehlermeldung": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 265-265px). E.g. chromium@1 Helvetica Neue @ 265px: returned 19px, at 20px: DOM 3 lines, Pretext 4
- fitFontSize german "One word": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 7, chromium@1.25 2, chromium@2 2, firefox@1 10, firefox@1.25 2, firefox@2 2; Helvetica Neue; 367-577px). E.g. chromium@1 Helvetica Neue @ 367px: returned 21px, at 21px: DOM 2 lines, Pretext 3
- fitFontSize german "Kapitän": baseline: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 1; Arial, Helvetica Neue; 164-262px). E.g. chromium@1 Arial @ 164px: baseline: DOM 6 lines, Pretext 5
- fitFontSize french "Enregistrer": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue, Georgia; 311-322px). E.g. chromium@1 Helvetica Neue @ 311px: returned 22px, at 23px: DOM 2 lines, Pretext 3
- fitFontSize french "Synchroniser": baseline: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 1, firefox@2 1; Helvetica Neue; 121-231px). E.g. chromium@1 Helvetica Neue @ 140px: baseline: DOM 6 lines, Pretext 5
- fitFontSize french "Synchroniser": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 1, firefox@2 1; Helvetica Neue; 303-570px). E.g. chromium@1 Helvetica Neue @ 303px: returned 21px, at 21px: DOM 4 lines, Pretext 3
- fitFontSize french "Justificatifs": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 10, chromium@1.25 2, chromium@2 2, firefox@1 14, firefox@1.25 4, firefox@2 4; Helvetica Neue, Times New Roman; 294-512px). E.g. chromium@1 Helvetica Neue @ 326px: returned 21px, at 21px: DOM 2 lines, Pretext 3
- fitFontSize french "Responsabilité": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 5, firefox@1 4; Helvetica Neue; 173-574px). E.g. chromium@1 Helvetica Neue @ 173px: returned 12px, at 12px: DOM 5 lines, Pretext 4
- fitFontSize french "Responsabilité": baseline: DOM N lines, Pretext N (chromium@1 2, firefox@1 2; Helvetica Neue; 178-286px). E.g. chromium@1 Helvetica Neue @ 178px: baseline: DOM 6 lines, Pretext 5
- fitFontSize french "Syndicats": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 15, chromium@1.25 5, chromium@2 5, firefox@1 2, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial, Georgia; 120-592px). E.g. chromium@1 Helvetica Neue @ 122px: returned 12px, at 13px: DOM 6 lines, Pretext 5
- fitFontSize french "Syndicats": baseline: DOM N lines, Pretext N (chromium@1 16, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 134-155px). E.g. chromium@1 Helvetica Neue @ 150px: baseline: DOM 6 lines, Pretext 5
- fitFontSize french "Récit": baseline: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 302-302px). E.g. chromium@1 Helvetica Neue @ 302px: baseline: DOM 3 lines, Pretext 4
- fitFontSize french "Récit": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 415-415px). E.g. chromium@1 Helvetica Neue @ 415px: returned 21px, at 22px: DOM 3 lines, Pretext 4
- fitFontSizeRich latin "Latin short": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 2; Helvetica Neue; 395-526px). E.g. chromium@1 Helvetica Neue @ 395px box height 72: returned 17px, at 18px: DOM 2 lines, Pretext 3
- fitFontSizeRich latin "Latin punctuation": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 259-259px). E.g. chromium@1 Helvetica Neue @ 259px box height 72: returned 12px, at 12px: DOM 3 lines, Pretext 4
- fitFontSizeRich latin "Gatsby reserve": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1; Times New Roman; 148-148px). E.g. chromium@1 Times New Roman @ 148px box height 72: returned 9px, at 10px: DOM 5 lines, Pretext 6
- fitFontSizeRich emoji-chat "Emoji mixed": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 8, chromium@1.25 2, chromium@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 330-361px). E.g. chromium@1 Helvetica Neue @ 360px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Emoji dense": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 11, chromium@1.25 2, chromium@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 287-311px). E.g. chromium@1 Helvetica Neue @ 310px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Status emoji": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 7, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 320-398px). E.g. chromium@1 Helvetica Neue @ 352px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Lunch plans": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 6, chromium@1.25 2, chromium@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 203-222px). E.g. chromium@1 Helvetica Neue @ 221px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Ship it": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 8, chromium@1.25 1, chromium@2 1; Helvetica Neue, Arial, Georgia, Times New Roman; 321-349px). E.g. chromium@1 Helvetica Neue @ 348px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Reactions only": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 24, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 153-158px). E.g. chromium@1 Helvetica Neue @ 153px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Skin tones": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 8, chromium@1.25 1, chromium@2 1; Helvetica Neue, Arial, Georgia, Times New Roman; 209-227px). E.g. chromium@1 Helvetica Neue @ 226px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Flags": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 18, chromium@1.25 5, chromium@2 5; Helvetica Neue, Arial, Georgia, Times New Roman; 192-563px). E.g. chromium@1 Helvetica Neue @ 333px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Keycaps": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 8, chromium@1.25 2, chromium@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 227-243px). E.g. chromium@1 Helvetica Neue @ 241px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "ZWJ family": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 9, chromium@1.25 2, chromium@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 284-307px). E.g. chromium@1 Helvetica Neue @ 306px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Glued emoji": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 8, chromium@1.25 3, chromium@2 3; Helvetica Neue, Arial, Georgia, Times New Roman; 195-212px). E.g. chromium@1 Helvetica Neue @ 211px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Weather report": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 9, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 256-272px). E.g. chromium@1 Helvetica Neue @ 268px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Datenschutz": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 2, chromium@2 2, firefox@1 2, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial; 190-524px). E.g. chromium@1 Helvetica Neue @ 524px box maxLines 1: returned 9px, at 10px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Kapitän": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 7, chromium@1.25 2, chromium@2 2, firefox@1 6, firefox@1.25 3, firefox@2 3; Helvetica Neue, Arial, Times New Roman; 244-595px). E.g. chromium@1 Helvetica Neue @ 455px box maxLines 1: returned 9px, at 9px: DOM 2 lines, Pretext 1
- fitFontSizeRich german "Fehlermeldung": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 1, firefox@2 1; Helvetica Neue; 165-389px). E.g. chromium@1 Helvetica Neue @ 350px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Förderung": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 26, chromium@1.25 6, chromium@2 6, firefox@1 27, firefox@1.25 6, firefox@2 6; Helvetica Neue, Arial, Times New Roman; 219-587px). E.g. chromium@1 Helvetica Neue @ 463px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "One word": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 3, chromium@1.25 1, chromium@2 1, firefox@1 3; Helvetica Neue; 354-566px). E.g. chromium@1 Helvetica Neue @ 354px box maxLines 1: returned 9px, at 10px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Portal": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Arial; 418-418px). E.g. chromium@1 Arial @ 418px box height 72: returned 16px, at 16px: DOM 2 lines, Pretext 3
- fitFontSizeRich german "Nebenrollen": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 25, chromium@1.25 8, chromium@2 8; Georgia, Times New Roman; 120-169px). E.g. chromium@1 Georgia @ 128px box height 72: returned 10px, at 10px: DOM 5 lines, Pretext 4
- fitFontSizeRich french "Synchroniser": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 7, chromium@1.25 1, chromium@2 1, firefox@1 7, firefox@1.25 1, firefox@2 1; Helvetica Neue; 209-593px). E.g. chromium@1 Helvetica Neue @ 593px box maxLines 1: returned 14px, at 14px: DOM 2 lines, Pretext 1
- fitFontSizeRich french "Justificatifs": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 5, chromium@1.25 1, chromium@2 1, firefox@1 7, firefox@1.25 2, firefox@2 2; Helvetica Neue, Times New Roman; 284-432px). E.g. chromium@1 Helvetica Neue @ 294px box height 72: returned 16px, at 17px: DOM 2 lines, Pretext 3
- fitFontSizeRich french "Responsabilité": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 1, chromium@2 1, firefox@1 5, firefox@1.25 1, firefox@2 1; Helvetica Neue; 179-568px). E.g. chromium@1 Helvetica Neue @ 554px box maxLines 1: returned 10px, at 10px: DOM 2 lines, Pretext 1
- fitFontSizeRich french "Syndicats": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 4, chromium@1.25 2, chromium@2 2, firefox@1 5, firefox@1.25 2, firefox@2 2; Helvetica Neue; 396-554px). E.g. chromium@1 Helvetica Neue @ 462px box maxLines 1: returned 9px, at 10px: DOM 1 lines, Pretext 2
- fitFontSizeRich french "Récit": null, at Npx: DOM N lines, Pretext N (chromium@1 1, firefox@1 1; Helvetica Neue; 455-455px). E.g. chromium@1 Helvetica Neue @ 455px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich french "Récit": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 2, chromium@1.25 1, chromium@2 1, firefox@1 2, firefox@1.25 1, firefox@2 1; Helvetica Neue; 203-512px). E.g. chromium@1 Helvetica Neue @ 512px box maxLines 1: returned 8px, at 9px: DOM 1 lines, Pretext 2
- fitFontSizeRich french "Anticonstitutionnalité": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1, chromium@1.25 1, chromium@2 1; Arial; 208-208px). E.g. chromium@1 Arial @ 208px box height 72: returned 13px, at 13px: DOM 4 lines, Pretext 3
- fitFontSizeRich ui-labels "Speichern": returned Npx, at Npx: DOM N lines, Pretext N (chromium@1 1; Helvetica Neue; 126-126px). E.g. chromium@1 Helvetica Neue @ 126px box height 72: returned 24px, at 25px: DOM 3 lines, Pretext 2
- clamp latin "Latin update": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 1; Helvetica Neue; 462-462px). E.g. chromium@1 Helvetica Neue @ 462px maxLines 2: line 2 "performance improvements are really noticeable, especially on…" paints 462.0234375px, Pretext 462.015625px, box 462px
- clamp latin "Latin hyphenation": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 1, chromium@1.25 1, chromium@2 1; Helvetica Neue; 492-492px). E.g. chromium@1 Helvetica Neue @ 492px maxLines 1: line 1 "One thing I noticed is that the line breaking algorithm doesn't hand…" paints 492.0234375px, Pretext 492.0155792236328px, box 492px
- clamp latin "Gatsby reserve": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1, chromium@1.25 1, chromium@2 1; Georgia; 592-592px). E.g. chromium@1 Georgia @ 592px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp latin "Gatsby reserve": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 3, chromium@1.25 3, chromium@2 3; Georgia; 592-592px). E.g. chromium@1 Georgia @ 592px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp cjk "Zhufu quotes": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 144, chromium@1.25 36, chromium@2 36; Helvetica Neue, Arial, Georgia; 128-375px). E.g. chromium@1 Helvetica Neue @ 368px maxLines 2: line 1 "一見面是寒暄，寒暄之後說我「胖了」，說我「胖了」" paints 376px, Pretext 368px, box 368px
- clamp cjk "Japanese": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 4; Georgia; 159-381px). E.g. chromium@1 Georgia @ 381px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp cjk "Japanese": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 6; Georgia; 191-381px). E.g. chromium@1 Georgia @ 381px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp cjk "Japanese short": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 2; Georgia; 191-381px). E.g. chromium@1 Georgia @ 381px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp cjk "Japanese short": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 4; Georgia; 191-381px). E.g. chromium@1 Georgia @ 381px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp cjk "Kumo no ito": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 4; Georgia; 207-415px). E.g. chromium@1 Georgia @ 414px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp cjk "Kumo no ito": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 9; Georgia; 207-415px). E.g. chromium@1 Georgia @ 414px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp arabic "Support thread": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 1; Helvetica Neue; 183-183px). E.g. chromium@1 Helvetica Neue @ 183px maxLines 2: line 2 "thread said: \"هذا جيد، ولك…" paints 183.0234375px, Pretext 183.01214599609375px, box 183px
- clamp arabic "Numbers+RTL": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Arial; 251-251px). E.g. chromium@1 Arial @ 251px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp arabic "Numbers+RTL": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 3; Arial; 251-251px). E.g. chromium@1 Arial @ 251px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp arabic "Support thread": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 5, chromium@1.25 3, chromium@2 3; Arial, Times New Roman; 124-590px). E.g. chromium@1 Arial @ 590px maxLines 1: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 1 (truncated true; 2 unclamped)
- clamp arabic "Support thread": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 11, chromium@1.25 7, chromium@2 7; Arial, Times New Roman; 284-590px). E.g. chromium@1 Arial @ 590px maxLines 2: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 2 (truncated false; 2 unclamped)
- clamp arabic "Long mixed": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Times New Roman; 294-294px). E.g. chromium@1 Times New Roman @ 294px maxLines 4: DOM clamps to 4 lines (truncated false: scrollHeight 96, clientHeight 96; 4 unclamped), Pretext 4 (truncated true; 5 unclamped)
- clamp arabic "Long mixed": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 1; Times New Roman; 294-294px). E.g. chromium@1 Times New Roman @ 294px maxLines 5: DOM clamps to 4 lines (truncated false: scrollHeight 96, clientHeight 96; 4 unclamped), Pretext 5 (truncated false; 5 unclamped)
- clamp emoji-chat "Flags": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Arial; 535-535px). E.g. chromium@1 Arial @ 535px maxLines 1: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 1 (truncated true; 2 unclamped)
- clamp emoji-chat "Flags": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 4; Arial; 535-535px). E.g. chromium@1 Arial @ 535px maxLines 2: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 2 (truncated false; 2 unclamped)
- clamp emoji-chat "ZWJ family": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Arial; 257-257px). E.g. chromium@1 Arial @ 257px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp emoji-chat "ZWJ family": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 3; Arial; 257-257px). E.g. chromium@1 Arial @ 257px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp emoji-chat "Weather report": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Times New Roman; 206-206px). E.g. chromium@1 Times New Roman @ 206px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp emoji-chat "Weather report": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 3; Times New Roman; 206-206px). E.g. chromium@1 Times New Roman @ 206px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp urls "Bare URL": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 2; Helvetica Neue, Arial; 177-274px). E.g. chromium@1 Helvetica Neue @ 274px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp urls "Bare URL": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 5; Helvetica Neue, Arial; 177-274px). E.g. chromium@1 Helvetica Neue @ 274px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp urls "Query string": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Helvetica Neue; 246-246px). E.g. chromium@1 Helvetica Neue @ 246px maxLines 5: DOM clamps to 5 lines (truncated false: scrollHeight 120, clientHeight 120; 5 unclamped), Pretext 5 (truncated true; 6 unclamped)
- clamp urls "Data URI": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 19, chromium@1.25 5, chromium@2 5, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 230-570px). E.g. chromium@1 Helvetica Neue @ 563px maxLines 2: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 2 (truncated true; 3 unclamped)
- clamp urls "Data URI": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 40, chromium@1.25 11, chromium@2 11, firefox@1 1; Helvetica Neue, Arial, Times New Roman; 286-570px). E.g. chromium@1 Helvetica Neue @ 563px maxLines 3: DOM clamps to 2 lines (truncated false: scrollHeight 48, clientHeight 48; 2 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp urls "npm scope": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Helvetica Neue; 245-245px). E.g. chromium@1 Helvetica Neue @ 245px maxLines 3: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 3 (truncated true; 4 unclamped)
- clamp urls "npm scope": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2; Helvetica Neue; 245-245px). E.g. chromium@1 Helvetica Neue @ 245px maxLines 4: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 4 (truncated false; 4 unclamped)
- clamp urls "Unix path": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1; Arial; 153-153px). E.g. chromium@1 Arial @ 153px maxLines 5: DOM clamps to 5 lines (truncated false: scrollHeight 120, clientHeight 120; 5 unclamped), Pretext 5 (truncated true; 6 unclamped)
- clamp urls "Snake case": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 2; Times New Roman; 302-303px). E.g. chromium@1 Times New Roman @ 302px maxLines 5: DOM clamps to 5 lines (truncated false: scrollHeight 120, clientHeight 120; 5 unclamped), Pretext 5 (truncated true; 6 unclamped)
- clamp german "Nebenrollen": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 100, chromium@1.25 32, chromium@2 32; Helvetica Neue, Arial, Georgia, Times New Roman; 159-180px). E.g. chromium@1 Helvetica Neue @ 172px maxLines 2: line 1 "Bitte die Nebenrollen-Ta-" paints 178.1015625px, Pretext 178.0958251953125px, box 172px
- clamp german "Datenschutz": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 1; Helvetica Neue; 402-402px). E.g. chromium@1 Helvetica Neue @ 402px maxLines 2: line 2 "vollziehbare Einwilligungsverwaltung für alle Benutzer-…" paints 402.0234375px, Pretext 402.0155944824219px, box 402px
- clamp german "Fehlermeldung": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 3, firefox@1.25 2, firefox@2 2; Helvetica Neue; 128-594px). E.g. chromium@1 Helvetica Neue @ 212px maxLines 3: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 3 (truncated true; 4 unclamped)
- clamp german "Fehlermeldung": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, chromium@1.25 2, chromium@2 2, firefox@1 6, firefox@1.25 2, firefox@2 2; Helvetica Neue; 212-594px). E.g. chromium@1 Helvetica Neue @ 212px maxLines 4: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 4 (truncated false; 4 unclamped)
- clamp german "Förderung": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 7, firefox@1 5; Helvetica Neue, Arial, Times New Roman; 263-362px). E.g. chromium@1 Helvetica Neue @ 265px maxLines 4: line 3 "Kraft, Übergangsregelungen inbegrif-" paints 265.0625px, Pretext 265.5037536621094px, box 265px
- clamp german "Kapitän": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 3, chromium@1.25 3, chromium@2 3, firefox@1 4, firefox@1.25 4, firefox@2 4; Arial; 164-164px). E.g. chromium@1 Arial @ 164px maxLines 2: line 1 "Der Donaudampfschiff-" paints 164.2265625px, Pretext 164.2265625px, box 164px
- clamp german "Kapitän": DOM clamps to N lines (truncated true: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 1, chromium@1.25 1, chromium@2 1, firefox@1 1; Arial, Helvetica Neue; 164-262px). E.g. chromium@1 Arial @ 164px maxLines 5: DOM clamps to 5 lines (truncated true: scrollHeight 144, clientHeight 120; 6 unclamped), Pretext 5 (truncated false; 5 unclamped)
- clamp french "Synchroniser": DOM clamps to N lines (truncated true: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, chromium@1.25 1, chromium@2 1, firefox@1 2, firefox@1.25 1, firefox@2 1; Helvetica Neue; 140-231px). E.g. chromium@1 Helvetica Neue @ 231px maxLines 3: DOM clamps to 3 lines (truncated true: scrollHeight 96, clientHeight 72; 4 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp french "Synchroniser": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 6, webkit@1 10, webkit@1.25 1, webkit@2 1, firefox@1 10; Helvetica Neue; 140-569px). E.g. chromium@1 Helvetica Neue @ 285px maxLines 3: line 2 "ments : vérifiez votre connexion internet" paints 285.0625px, Pretext 284.7677764892578px, box 285px
- clamp french "Synchroniser": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, firefox@1 2; Helvetica Neue; 231-231px). E.g. chromium@1 Helvetica Neue @ 231px maxLines 4: DOM clamps to 4 lines (truncated false: scrollHeight 96, clientHeight 96; 4 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp french "Responsabilité": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 21, chromium@1.25 9, chromium@2 9, webkit@1 24, webkit@1.25 9, webkit@2 9, firefox@1 13, firefox@1.25 5, firefox@2 5; Helvetica Neue; 178-567px). E.g. chromium@1 Helvetica Neue @ 454px maxLines 1: line 1 "La responsabilité environnementale des entreprises internatio…" paints 454.0234375px, Pretext 454.015625px, box 454px
- clamp french "Responsabilité": DOM clamps to N lines (truncated true: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, firefox@1 2; Helvetica Neue; 178-286px). E.g. chromium@1 Helvetica Neue @ 286px maxLines 3: DOM clamps to 3 lines (truncated true: scrollHeight 96, clientHeight 72; 4 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp french "Responsabilité": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, firefox@1 2; Helvetica Neue; 286-286px). E.g. chromium@1 Helvetica Neue @ 286px maxLines 4: DOM clamps to 4 lines (truncated false: scrollHeight 96, clientHeight 96; 4 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp french "Syndicats": line N "…" paints Npx, Pretext Npx, box Npx (chromium@1 120, chromium@1.25 28, chromium@2 28; Helvetica Neue, Arial, Georgia, Times New Roman; 131-427px). E.g. chromium@1 Helvetica Neue @ 422px maxLines 2: line 1 "Les représentantes syndicales ont présenté une contre-pro-" paints 427.6640625px, Pretext 427.66371154785156px, box 422px
- clamp french "Syndicats": DOM clamps to N lines (truncated true: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 16, chromium@1.25 4, chromium@2 4; Helvetica Neue, Arial, Georgia, Times New Roman; 134-155px). E.g. chromium@1 Helvetica Neue @ 150px maxLines 5: DOM clamps to 5 lines (truncated true: scrollHeight 144, clientHeight 120; 6 unclamped), Pretext 5 (truncated false; 5 unclamped)
- clamp french "Récit": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (chromium@1 1, firefox@1 1; Helvetica Neue; 302-302px). E.g. chromium@1 Helvetica Neue @ 302px maxLines 3: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 3 (truncated true; 4 unclamped)
- clamp french "Récit": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (chromium@1 2, firefox@1 2; Helvetica Neue; 302-302px). E.g. chromium@1 Helvetica Neue @ 302px maxLines 4: DOM clamps to 3 lines (truncated false: scrollHeight 72, clientHeight 72; 3 unclamped), Pretext 4 (truncated false; 4 unclamped)
- truncateMiddle labels "Deep": returned "…" paints Npx, Pretext Npx, box Npx (chromium@1 2; Helvetica Neue; 354-362px). E.g. chromium@1 Helvetica Neue @ 354px: returned "a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/…/index.ts" paints 354.0234375px, Pretext 354.0155029296875px, box 354px
- truncateMiddle german "Portal": returned "…" paints Npx, Pretext Npx, box Npx (chromium@1 1, chromium@1.25 1, chromium@2 1; Helvetica Neue; 376-376px). E.g. chromium@1 Helvetica Neue @ 376px: returned "Arbeitszeiterfassung, Urla…t du im Mitarbeiterportal." paints 376.0234375px, Pretext 376.015625px, box 376px
- shrinkwrap german "Versicherung": widest line: DOM Npx (wants N), Pretext Npx (gave N) (webkit@1 15, webkit@1.25 4, webkit@2 4; Times New Roman; 139-496px). E.g. webkit@1 Times New Roman @ 139px: widest line: DOM 138px (wants 138), Pretext 138.1796875px (gave 139)
- shrinkwrap german "Portal": widest line: DOM Npx (wants N), Pretext Npx (gave N) (webkit@1 7, webkit@1.25 2, webkit@2 2; Times New Roman; 188-194px). E.g. webkit@1 Times New Roman @ 188px: widest line: DOM 187px (wants 187), Pretext 187.0625px (gave 188)
- shrinkwrap french "Autorisations": widest line: DOM Npx (wants N), Pretext Npx (gave N) (webkit@1 41, webkit@1.25 11, webkit@2 11; Times New Roman; 315-385px). E.g. webkit@1 Times New Roman @ 315px: widest line: DOM 314px (wants 314), Pretext 314.09375px (gave 315)
- shrinkwrap french "Mot de passe": widest line: DOM Npx (wants N), Pretext Npx (gave N) (webkit@1 19, webkit@1.25 5, webkit@2 5; Times New Roman; 354-372px). E.g. webkit@1 Times New Roman @ 354px: widest line: DOM 353px (wants 353), Pretext 353.2421875px (gave 354)
- clamp emoji-chat "Keycaps": line N "…" paints Npx, Pretext Npx, box Npx (webkit@1 11, webkit@1.25 8, webkit@2 8; Arial, Times New Roman; 193-380px). E.g. webkit@1 Arial @ 380px maxLines 2: line 1 "Vote: 1️⃣ ship Friday, 2️⃣ ship Monday, 3️⃣ wait for QA" paints 380.765625px, Pretext 379.8828125px, box 380px
- clamp urls "Windows path": line N "…" paints Npx, Pretext Npx, box Npx (webkit@1 2; Helvetica Neue; 321-321px). E.g. webkit@1 Helvetica Neue @ 321px maxLines 4: line 3 "osoft\\Windows\\INetCache\\IE\\settings.ini and" paints 321.171875px, Pretext 320.88002014160156px, box 321px
- clamp urls "Data URI": line N "…" paints Npx, Pretext Npx, box Npx (webkit@1 35, webkit@1.25 7, webkit@2 7, firefox@1 25, firefox@1.25 8, firefox@2 8; Helvetica Neue, Arial, Times New Roman; 175-542px). E.g. webkit@1 Helvetica Neue @ 531px maxLines 3: line 2 "YAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5E" paints 531.5625px, Pretext 530.3680019378662px, box 531px
- clamp urls "Snake case": line N "…" paints Npx, Pretext Npx, box Npx (webkit@1 1, firefox@1 1; Helvetica Neue; 182-182px). E.g. webkit@1 Helvetica Neue @ 182px maxLines 5: line 4 "TION_JOBS_PER_WORK" paints 182.546875px, Pretext 181.07199096679688px, box 182px
- shrinkwrap german "Kapitän": at returned Npx: DOM N lines, Pretext N (firefox@1 22, firefox@1.25 6, firefox@2 6; Helvetica Neue; 263-284px). E.g. firefox@1 Helvetica Neue @ 263px: at returned 262px: DOM 4 lines, Pretext 3
- shrinkwrap german "One word": baseline: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 538-538px). E.g. firefox@1 Helvetica Neue @ 538px: baseline: DOM 1 lines, Pretext 2
- balance german "One word": baseline: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 538-538px). E.g. firefox@1 Helvetica Neue @ 538px: baseline: DOM 1 lines, Pretext 2
- balance german "One word": at Npx: DOM N lines, Pretext N (firefox@1 62, firefox@1.25 16, firefox@2 16; Helvetica Neue; 539-600px). E.g. firefox@1 Helvetica Neue @ 539px: at 538px: DOM 1 lines, Pretext 2
- fitFontSize german "One word": baseline: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 538-538px). E.g. firefox@1 Helvetica Neue @ 538px: baseline: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Emoji mixed": null, at Npx: DOM N lines, Pretext N (firefox@1 13, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial, Georgia, Times New Roman; 120-326px). E.g. firefox@1 Helvetica Neue @ 120px box maxLines 1: null, at 8px: DOM 3 lines, Pretext 4
- fitFontSizeRich emoji-chat "Emoji dense": null, at Npx: DOM N lines, Pretext N (firefox@1 16, firefox@1.25 2, firefox@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 136-283px). E.g. firefox@1 Helvetica Neue @ 142px box maxLines 1: null, at 8px: DOM 2 lines, Pretext 3
- fitFontSizeRich emoji-chat "Status emoji": null, at Npx: DOM N lines, Pretext N (firefox@1 11, firefox@1.25 5, firefox@2 5; Helvetica Neue, Arial, Georgia, Times New Roman; 123-317px). E.g. firefox@1 Helvetica Neue @ 123px box maxLines 1: null, at 8px: DOM 3 lines, Pretext 4
- fitFontSizeRich emoji-chat "Lunch plans": null, at Npx: DOM N lines, Pretext N (firefox@1 5, firefox@1.25 3, firefox@2 3; Helvetica Neue, Arial, Georgia, Times New Roman; 184-201px). E.g. firefox@1 Helvetica Neue @ 200px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Ship it": null, at Npx: DOM N lines, Pretext N (firefox@1 12, firefox@1.25 3, firefox@2 3; Helvetica Neue, Arial, Georgia, Times New Roman; 153-315px). E.g. firefox@1 Helvetica Neue @ 166px box maxLines 1: null, at 8px: DOM 2 lines, Pretext 3
- fitFontSizeRich emoji-chat "Reactions only": null, at Npx: DOM N lines, Pretext N (firefox@1 24, firefox@1.25 8, firefox@2 8; Helvetica Neue, Arial, Georgia, Times New Roman; 151-156px). E.g. firefox@1 Helvetica Neue @ 151px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Skin tones": null, at Npx: DOM N lines, Pretext N (firefox@1 8, firefox@1.25 1, firefox@2 1; Helvetica Neue, Arial, Georgia, Times New Roman; 190-206px). E.g. firefox@1 Helvetica Neue @ 205px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Flags": null, at Npx: DOM N lines, Pretext N (firefox@1 26, firefox@1.25 6, firefox@2 6; Helvetica Neue, Arial, Georgia, Times New Roman; 148-308px). E.g. firefox@1 Helvetica Neue @ 158px box maxLines 1: null, at 8px: DOM 2 lines, Pretext 3
- fitFontSizeRich emoji-chat "Keycaps": null, at Npx: DOM N lines, Pretext N (firefox@1 8, firefox@1.25 3, firefox@2 3; Helvetica Neue, Arial, Georgia, Times New Roman; 207-220px). E.g. firefox@1 Helvetica Neue @ 219px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "ZWJ family": null, at Npx: DOM N lines, Pretext N (firefox@1 10, firefox@1.25 2, firefox@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 258-279px). E.g. firefox@1 Helvetica Neue @ 277px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Glued emoji": null, at Npx: DOM N lines, Pretext N (firefox@1 7, firefox@1.25 2, firefox@2 2; Helvetica Neue, Arial, Georgia, Times New Roman; 177-192px). E.g. firefox@1 Helvetica Neue @ 191px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich emoji-chat "Weather report": null, at Npx: DOM N lines, Pretext N (firefox@1 13, firefox@1.25 3, firefox@2 3; Helvetica Neue, Arial, Georgia, Times New Roman; 121-248px). E.g. firefox@1 Helvetica Neue @ 126px box maxLines 1: null, at 8px: DOM 2 lines, Pretext 3
- fitFontSizeRich german "Datenschutz": null, at Npx: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 419-419px). E.g. firefox@1 Helvetica Neue @ 419px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Fehlermeldung": null, at Npx: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 311-311px). E.g. firefox@1 Helvetica Neue @ 311px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich german "Förderung": null, at Npx: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 147-147px). E.g. firefox@1 Helvetica Neue @ 147px box maxLines 1: null, at 8px: DOM 3 lines, Pretext 4
- fitFontSizeRich german "One word": null, at Npx: DOM N lines, Pretext N (firefox@1 1; Helvetica Neue; 283-283px). E.g. firefox@1 Helvetica Neue @ 283px box maxLines 1: null, at 8px: DOM 1 lines, Pretext 2
- fitFontSizeRich french "Justificatifs": null, at Npx: DOM N lines, Pretext N (firefox@1 1; Times New Roman; 126-126px). E.g. firefox@1 Times New Roman @ 126px box maxLines 1: null, at 8px: DOM 2 lines, Pretext 3
- clamp urls "Query string": line N "…" paints Npx, Pretext Npx, box Npx (firefox@1 1; Helvetica Neue; 213-213px). E.g. firefox@1 Helvetica Neue @ 213px maxLines 5: line 4 "elevance&page=3&utm_sourc" paints 213.28334045410156px, Pretext 212.9833221435547px, box 213px
- clamp german "Kapitän": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (firefox@1 2; Helvetica Neue; 262-262px). E.g. firefox@1 Helvetica Neue @ 262px maxLines 4: DOM clamps to 4 lines (truncated false: scrollHeight 96, clientHeight 96; 4 unclamped), Pretext 3 (truncated false; 3 unclamped)
- clamp german "One word": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated true; N unclamped) (firefox@1 1; Helvetica Neue; 538-538px). E.g. firefox@1 Helvetica Neue @ 538px maxLines 1: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 1 (truncated true; 2 unclamped)
- clamp german "One word": DOM clamps to N lines (truncated false: scrollHeight N, clientHeight N; N unclamped), Pretext N (truncated false; N unclamped) (firefox@1 4; Helvetica Neue; 538-538px). E.g. firefox@1 Helvetica Neue @ 538px maxLines 2: DOM clamps to 1 lines (truncated false: scrollHeight 24, clientHeight 24; 1 unclamped), Pretext 2 (truncated false; 2 unclamped)

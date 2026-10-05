# Browser sweep results

Run on 2026-10-05 by `npm run verify` (headed, deviceScaleFactor 1, `<html lang="en">`).
Widths 120-600px, step per helper: shrinkwrap 1, balance 1, fitFontSize 1.
A `pretext-gap` case is one where Pretext's own line count differs from the browser's at the width (or, for
fitFontSize, at a size) the judgement needs, so the kit cannot be judged there. A `kit-mismatch` is the kit
answering wrongly where Pretext was right. A `platform` case is a kit-mismatch whose cause is proven, case by
case, to be a browser painting something its CSS does not say; only the cause below is recognised.

Playwright is pinned to 1.61.0: on macOS 14 Playwright ships a frozen WebKit build
(webkit_mac14_arm64_special-2251), and Playwright 1.62 and later send it a protocol setting it rejects
(`Page.overrideSetting`: "Unknown setting: PushAPIEnabled"), so no WebKit page opens.

**`webkit-26-line-height-floor`.** WebKit 26 lays line boxes out at whole pixels, so a fractional
`line-height` paints as its floor (16.5px paints 16px lines) while `getComputedStyle` still reports 16.5px;
Pretext's `PLATFORM_BUGS.md` ("Engine rules Pretext models") records that Safari 27 moved line boxes to the
1/64 px grid where Safari 26 did not. fitFontSize, given the CSS line height, then models a taller box than
WebKit paints and can answer one size below the largest that fits; it never answers a size that overflows. A case
gets this cause only if its line height is fractional, the contradicting painting is exactly lines × the floored
line height, and the same judgement passes when the kit is rerun with floored line heights. For exact fits in
Safari 26, use whole-px line heights.

## chromium 149.0.7827.55 (chromium-1228)

By helper:

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| shrinkwrap (7s) | 115440 | 115382 | 58 | 0 | 0 |
| balance (7s) | 115440 | 115382 | 58 | 0 | 0 |
| fitFontSize (14s) | 115440 | 115210 | 230 | 0 | 0 |

By corpus (all helpers):

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| latin | 69264 | 69256 | 8 | 0 | 0 |
| cjk | 69264 | 69166 | 98 | 0 | 0 |
| arabic | 69264 | 69204 | 60 | 0 | 0 |
| emoji-chat | 69264 | 69255 | 9 | 0 | 0 |
| urls | 69264 | 69093 | 171 | 0 | 0 |

Pretext gaps by text (count of cases):

- fitFontSize / cjk / Georgia / Japanese: 30
- fitFontSize / urls / Times New Roman / Data URI: 30
- fitFontSize / cjk / Georgia / Kumo no ito: 23
- fitFontSize / arabic / Times New Roman / Support thread: 23
- fitFontSize / urls / Helvetica Neue / Data URI: 23
- fitFontSize / cjk / Georgia / Japanese short: 21
- fitFontSize / urls / Arial / Data URI: 19
- fitFontSize / arabic / Arial / Support thread: 17
- shrinkwrap / urls / Helvetica Neue / Data URI: 9
- balance / urls / Helvetica Neue / Data URI: 9
- shrinkwrap / urls / Times New Roman / Data URI: 8
- balance / urls / Times New Roman / Data URI: 8
- fitFontSize / urls / Helvetica Neue / Bare URL: 8
- shrinkwrap / urls / Arial / Data URI: 7
- balance / urls / Arial / Data URI: 7
- fitFontSize / urls / Times New Roman / Snake case: 7
- shrinkwrap / cjk / Georgia / Kumo no ito: 6
- balance / cjk / Georgia / Kumo no ito: 6
- fitFontSize / urls / Helvetica Neue / Query string: 5
- shrinkwrap / cjk / Georgia / Japanese: 4
- balance / cjk / Georgia / Japanese: 4
- fitFontSize / arabic / Times New Roman / Long mixed: 4
- shrinkwrap / arabic / Times New Roman / Support thread: 3
- shrinkwrap / urls / Times New Roman / Snake case: 3
- balance / arabic / Times New Roman / Support thread: 3
- balance / urls / Times New Roman / Snake case: 3
- fitFontSize / urls / Helvetica Neue / npm scope: 3
- shrinkwrap / latin / Georgia / Gatsby reserve: 2
- shrinkwrap / cjk / Georgia / Japanese short: 2
- shrinkwrap / arabic / Arial / Support thread: 2
- shrinkwrap / urls / Helvetica Neue / Query string: 2
- balance / latin / Georgia / Gatsby reserve: 2
- balance / cjk / Georgia / Japanese short: 2
- balance / arabic / Arial / Support thread: 2
- balance / urls / Helvetica Neue / Query string: 2
- fitFontSize / latin / Georgia / Gatsby reserve: 2
- fitFontSize / urls / Arial / Query string: 2
- shrinkwrap / arabic / Arial / Numbers+RTL: 1
- shrinkwrap / arabic / Times New Roman / Long mixed: 1
- shrinkwrap / emoji-chat / Arial / Flags: 1
- shrinkwrap / emoji-chat / Arial / ZWJ family: 1
- shrinkwrap / emoji-chat / Times New Roman / Weather report: 1
- shrinkwrap / urls / Helvetica Neue / Bare URL: 1
- shrinkwrap / urls / Helvetica Neue / npm scope: 1
- shrinkwrap / urls / Arial / Bare URL: 1
- shrinkwrap / urls / Arial / Unix path: 1
- shrinkwrap / urls / Arial / Snake case: 1
- balance / arabic / Arial / Numbers+RTL: 1
- balance / arabic / Times New Roman / Long mixed: 1
- balance / emoji-chat / Arial / Flags: 1
- balance / emoji-chat / Arial / ZWJ family: 1
- balance / emoji-chat / Times New Roman / Weather report: 1
- balance / urls / Helvetica Neue / Bare URL: 1
- balance / urls / Helvetica Neue / npm scope: 1
- balance / urls / Arial / Bare URL: 1
- balance / urls / Arial / Unix path: 1
- balance / urls / Arial / Snake case: 1
- fitFontSize / latin / Times New Roman / Gatsby reserve: 1
- fitFontSize / latin / Times New Roman / Gatsby decencies: 1
- fitFontSize / arabic / Helvetica Neue / Bukhala names: 1
- fitFontSize / arabic / Arial / Numbers+RTL: 1
- fitFontSize / emoji-chat / Arial / Flags: 1
- fitFontSize / emoji-chat / Arial / ZWJ family: 1
- fitFontSize / emoji-chat / Times New Roman / Weather report: 1
- fitFontSize / urls / Arial / Bare URL: 1
- fitFontSize / urls / Arial / Unix path: 1
- fitFontSize / urls / Arial / Snake case: 1
- fitFontSize / urls / Georgia / Data URI: 1
- fitFontSize / urls / Times New Roman / npm scope: 1
- fitFontSize / urls / Times New Roman / Path with spaces: 1

## webkit 26.5 (webkit_mac14_arm64_special-2251)

By helper:

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| shrinkwrap (23s) | 115440 | 115440 | 0 | 0 | 0 |
| balance (24s) | 115440 | 115440 | 0 | 0 | 0 |
| fitFontSize (36s) | 115440 | 108893 | 0 | 6547 | 0 |

By corpus (all helpers):

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| latin | 69264 | 66897 | 0 | 2367 | 0 |
| cjk | 69264 | 68475 | 0 | 789 | 0 |
| arabic | 69264 | 68412 | 0 | 852 | 0 |
| emoji-chat | 69264 | 69155 | 0 | 109 | 0 |
| urls | 69264 | 66834 | 0 | 2430 | 0 |

## firefox 151.0 (firefox-1532)

By helper:

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| shrinkwrap (12s) | 115440 | 115439 | 1 | 0 | 0 |
| balance (12s) | 115440 | 115439 | 1 | 0 | 0 |
| fitFontSize (18s) | 115440 | 115439 | 1 | 0 | 0 |

By corpus (all helpers):

| | cases | pass | pretext-gap | platform | kit-mismatch |
|---|---:|---:|---:|---:|---:|
| latin | 69264 | 69264 | 0 | 0 | 0 |
| cjk | 69264 | 69264 | 0 | 0 | 0 |
| arabic | 69264 | 69264 | 0 | 0 | 0 |
| emoji-chat | 69264 | 69264 | 0 | 0 | 0 |
| urls | 69264 | 69261 | 3 | 0 | 0 |

Pretext gaps by text (count of cases):

- shrinkwrap / urls / Helvetica Neue / Data URI: 1
- balance / urls / Helvetica Neue / Data URI: 1
- fitFontSize / urls / Helvetica Neue / Data URI: 1

## kit-mismatch cases

None.

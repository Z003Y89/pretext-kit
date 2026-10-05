# Browser sweep results

Run on 2026-10-05 by `npm run verify` (headed, deviceScaleFactor 1, `<html lang="en">`).
Widths 120-600px, step per helper: shrinkwrap 1, balance 1, fitFontSize 1.
A `pretext-gap` case is one where Pretext's own line count differs from the browser's at the width (or, for
fitFontSize, at a size) the judgement needs, so the kit cannot be judged there. A `kit-mismatch` is the kit
answering wrongly where Pretext was right.

## chromium 149.0.7827.55 (chromium-1228)

By helper:

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| shrinkwrap (7s) | 115440 | 115382 | 58 | 0 |
| balance (7s) | 115440 | 115382 | 58 | 0 |
| fitFontSize (17s) | 115440 | 115210 | 230 | 0 |

By corpus (all helpers):

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| latin | 69264 | 69256 | 8 | 0 |
| cjk | 69264 | 69166 | 98 | 0 |
| arabic | 69264 | 69204 | 60 | 0 |
| emoji-chat | 69264 | 69255 | 9 | 0 |
| urls | 69264 | 69093 | 171 | 0 |

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

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| shrinkwrap (26s) | 115440 | 115440 | 0 | 0 |
| balance (26s) | 115440 | 115440 | 0 | 0 |
| fitFontSize (37s) | 115440 | 108893 | 0 | 6547 |

By corpus (all helpers):

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| latin | 69264 | 66897 | 0 | 2367 |
| cjk | 69264 | 68475 | 0 | 789 |
| arabic | 69264 | 68412 | 0 | 852 |
| emoji-chat | 69264 | 69155 | 0 | 109 |
| urls | 69264 | 66834 | 0 | 2430 |

## firefox 151.0 (firefox-1532)

By helper:

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| shrinkwrap (12s) | 115440 | 115439 | 1 | 0 |
| balance (12s) | 115440 | 115439 | 1 | 0 |
| fitFontSize (18s) | 115440 | 115439 | 1 | 0 |

By corpus (all helpers):

| | cases | pass | pretext-gap | kit-mismatch |
|---|---:|---:|---:|---:|
| latin | 69264 | 69264 | 0 | 0 |
| cjk | 69264 | 69264 | 0 | 0 |
| arabic | 69264 | 69264 | 0 | 0 |
| emoji-chat | 69264 | 69264 | 0 | 0 |
| urls | 69264 | 69261 | 3 | 0 |

Pretext gaps by text (count of cases):

- shrinkwrap / urls / Helvetica Neue / Data URI: 1
- balance / urls / Helvetica Neue / Data URI: 1
- fitFontSize / urls / Helvetica Neue / Data URI: 1

## kit-mismatch cases

6547 cases; consecutive widths with the same finding share a line.

- webkit fitFontSize latin / Helvetica Neue @ 120-136px: Latin update: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 162-205px: Latin update: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 141-172px: Latin compatibility: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 120-137px: Latin short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 120-145px: Latin caching: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 173-202px: Latin caching: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 120-143px: Latin punctuation: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 170-201px: Latin punctuation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 132-164px: Latin hyphenation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 120-129px: Gatsby advice: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 153-203px: Gatsby advice: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 137-162px: Gatsby criticizing: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 192-223px: Gatsby criticizing: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 142-180px: Gatsby reserve: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 213-250px: Gatsby reserve: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 192-230px: Gatsby levity: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 272-307px: Gatsby levity: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Helvetica Neue @ 159-211px: Gatsby decencies: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Helvetica Neue @ 250-298px: Gatsby decencies: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 120-134px: Latin update: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 160-205px: Latin update: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 140-169px: Latin compatibility: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 120-136px: Latin short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 120-145px: Latin caching: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 172-201px: Latin caching: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 120-139px: Latin punctuation: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 166-197px: Latin punctuation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 131-162px: Latin hyphenation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 120-129px: Gatsby advice: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 154-201px: Gatsby advice: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 136-159px: Gatsby criticizing: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 189-220px: Gatsby criticizing: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 140-179px: Gatsby reserve: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 212-249px: Gatsby reserve: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 190-228px: Gatsby levity: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 270-303px: Gatsby levity: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Arial @ 159-209px: Gatsby decencies: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Arial @ 248-294px: Gatsby decencies: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 120-135px: Latin update: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 160-205px: Latin update: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 138-170px: Latin compatibility: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 120-137px: Latin short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 120-145px: Latin caching: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 173-201px: Latin caching: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 120-140px: Latin punctuation: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 167-202px: Latin punctuation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 133-162px: Latin hyphenation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 120-129px: Gatsby advice: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 153-202px: Gatsby advice: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 132-156px: Gatsby criticizing: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 186-223px: Gatsby criticizing: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 140-175px: Gatsby reserve: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 208-245px: Gatsby reserve: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 189-226px: Gatsby levity: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 268-302px: Gatsby levity: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Georgia @ 161-213px: Gatsby decencies: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Georgia @ 253-290px: Gatsby decencies: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-121px: Latin update: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 144-186px: Latin update: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 125-155px: Latin compatibility: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-127px: Latin short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-134px: Latin caching: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 159-183px: Latin caching: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-127px: Latin punctuation: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 152-184px: Latin punctuation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-144px: Latin hyphenation: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 139-185px: Gatsby advice: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 120-143px: Gatsby criticizing: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 170-203px: Gatsby criticizing: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 128-157px: Gatsby reserve: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 186-221px: Gatsby reserve: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 173-206px: Gatsby levity: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 245-278px: Gatsby levity: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize latin / Times New Roman @ 147-195px: Gatsby decencies: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize latin / Times New Roman @ 231-263px: Gatsby decencies: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 120-129px: Chinese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 130-155px: Japanese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 130-155px: Japanese short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 132-153px: Guxiang winter: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 182-220px: Guxiang winter: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 120-129px: Guxiang memory: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 120-129px: Zhufu year end: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 120px: Rashomon gate: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 143-168px: Rashomon gate: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 120px: Kumo no ito: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Helvetica Neue @ 143-168px: Kumo no ito: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 120-129px: Chinese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 130-155px: Japanese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 130-155px: Japanese short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 132-153px: Guxiang winter: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Arial @ 182-220px: Guxiang winter: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 120-129px: Guxiang memory: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 120-129px: Zhufu year end: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 120px: Rashomon gate: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Arial @ 143-168px: Rashomon gate: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Arial @ 120px: Kumo no ito: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Arial @ 143-168px: Kumo no ito: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 120-129px: Chinese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 130-155px: Japanese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 129-155px: Japanese short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 132-153px: Guxiang winter: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Georgia @ 182-220px: Guxiang winter: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 120-129px: Guxiang memory: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 120-129px: Zhufu year end: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 120px: Rashomon gate: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Georgia @ 143-168px: Rashomon gate: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Georgia @ 142-168px: Kumo no ito: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 120-129px: Chinese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 130-155px: Japanese: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 130-155px: Japanese short: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 132-153px: Guxiang winter: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Times New Roman @ 182-220px: Guxiang winter: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 120-129px: Guxiang memory: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 120-129px: Zhufu year end: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 120px: Rashomon gate: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Times New Roman @ 143-168px: Rashomon gate: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize cjk / Times New Roman @ 120px: Kumo no ito: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize cjk / Times New Roman @ 143-168px: Kumo no ito: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 126-148px: Mixed en+ar: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 136-160px: Mixed report: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 120-123px: Numbers+RTL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 148-180px: Long mixed: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 214-268px: Long mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 135-160px: Bukhala book: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 120-141px: Bukhala names: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 120-123px: Ghufran waves: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 139-169px: Ghufran tree: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Helvetica Neue @ 120-133px: Support thread: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 120-148px: Mixed en+ar: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 134-152px: Mixed report: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 120px: Numbers+RTL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 144-176px: Long mixed: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize arabic / Arial @ 209-257px: Long mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 129-149px: Bukhala book: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 120-138px: Bukhala names: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 129-157px: Ghufran tree: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Arial @ 120-124px: Support thread: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 126-145px: Mixed en+ar: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 135-157px: Mixed report: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 120-125px: Numbers+RTL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 144-181px: Long mixed: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize arabic / Georgia @ 214-262px: Long mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 133-158px: Bukhala book: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 120-139px: Bukhala names: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 120-122px: Ghufran waves: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 137-166px: Ghufran tree: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Georgia @ 120-133px: Support thread: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 120-132px: Mixed en+ar: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 123-141px: Mixed report: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 131-162px: Long mixed: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize arabic / Times New Roman @ 193-238px: Long mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 127-148px: Bukhala book: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 120-137px: Bukhala names: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 128-154px: Ghufran tree: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize arabic / Times New Roman @ 120-123px: Support thread: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Helvetica Neue @ 120-129px: Emoji mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Helvetica Neue @ 120-129px: Status emoji: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Helvetica Neue @ 120-132px: Ship it: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Helvetica Neue @ 120-126px: Flags: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Arial @ 120-127px: Emoji mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Arial @ 120-126px: Status emoji: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Arial @ 120-130px: Ship it: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Arial @ 120-125px: Flags: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Georgia @ 120-127px: Emoji mixed: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Georgia @ 120-129px: Status emoji: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Georgia @ 120-128px: Ship it: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Georgia @ 120-127px: Flags: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize emoji-chat / Times New Roman @ 120-121px: Ship it: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 120-127px: Backup URL: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 152-178px: Backup URL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 167-168px: Query string: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 200-222px: Query string: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 127-163px: Unix path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 120-121px: Windows path: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 144-189px: Windows path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 133-194px: macOS path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 124-182px: Hash: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 216-283px: Hash: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 132-157px: Data URI: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 187-230px: Data URI: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 141-171px: npm scope: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 120-129px: Email list: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 154-217px: Email list: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 141-210px: Snake case: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Helvetica Neue @ 249-272px: Snake case: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Helvetica Neue @ 130-153px: Path with spaces: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 120-125px: Backup URL: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 149-177px: Backup URL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 163-167px: Query string: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 199-218px: Query string: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 125-158px: Unix path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 141-184px: Windows path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 131-189px: macOS path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 122-181px: Hash: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 215-280px: Hash: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 133-159px: Data URI: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 189-232px: Data URI: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 140-172px: npm scope: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 120-126px: Email list: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 150-216px: Email list: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 145-215px: Snake case: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Arial @ 255-279px: Snake case: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Arial @ 131-154px: Path with spaces: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 120-131px: Backup URL: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 156-179px: Backup URL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 168-171px: Query string: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 203-221px: Query string: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 129-162px: Unix path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 120-124px: Windows path: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 148-195px: Windows path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 130-191px: macOS path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 122-178px: Hash: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 212-281px: Hash: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 133-159px: Data URI: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 189-233px: Data URI: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 139-176px: npm scope: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 120-132px: Email list: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 157-217px: Email list: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 147-216px: Snake case: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Georgia @ 257-288px: Snake case: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Georgia @ 135-157px: Path with spaces: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 137-160px: Backup URL: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 147-155px: Query string: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Times New Roman @ 185-195px: Query string: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 120-144px: Unix path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 130-172px: Windows path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 120-170px: macOS path: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 120-163px: Hash: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Times New Roman @ 193-250px: Hash: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 130-153px: Data URI: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Times New Roman @ 182-228px: Data URI: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 125-157px: npm scope: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 141-198px: Email list: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 141-207px: Snake case: returned 10px, but 11px paints 6 lines × 16 (CSS line-height 16.5) = 96 and fits
- webkit fitFontSize urls / Times New Roman @ 246-268px: Snake case: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits
- webkit fitFontSize urls / Times New Roman @ 121-141px: Path with spaces: returned 12px, but 13px paints 5 lines × 19 (CSS line-height 19.5) = 95 and fits

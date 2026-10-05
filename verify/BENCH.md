# Cost bench

Run on 2026-10-05 by `npm run bench` (verify/bench-run.ts, verify/bench.ts), kit at 63598ca 2026-10-05,
Pretext 0.0.9 at f10d888 2026-10-05, Playwright 1.61.0.
Machine: Apple M2, 8 cores, 16 GB RAM; macOS 14.6.1 (23G93), Darwin 23.6.0.

Each browser ran 3 sessions, one after another and never side by side, each in a newly launched headed
browser in the foreground (Playwright's `bringToFront`), serving `bench.html` cross-origin isolated from 127.0.0.1.
A session runs 3 discarded warm-up rounds (the first sizes every operation's repetitions) and 20 timed
rounds; a round runs every operation once, in an order shuffled per round, each sample after a MessageChannel
yield. A sample repeats its operation until it takes the target time (25 ms, or 100 timer steps where the timer is
coarser), so timer coarsening and single GC pauses cannot decide it; the tables give µs per unit (per message,
label, row or call) as the median and p95 over all 60 samples of the sessions, with each session's
median beside them, since sessions drift apart (Pretext, RESEARCH.md, Evaluation Traps, Timing). Samples taken
while the page was hidden or unfocused are dropped and counted. These numbers are reported, not targeted.

## Workload

- **Messages**: 1000 distinct chat-like messages cut at word boundaries from the sweep's corpora
  (verify/corpora.ts), one corpus a message: urls 135, emoji-chat 146, arabic 148, french 150, german 148, latin 130, cjk 143.
  Lengths follow Pretext's bench: 173 under 20 UTF-16 units, 534 of 20-100, 293 over 100
  (median 64); a fifth end with an emoji. Font `400 16px "Helvetica Neue", "PingFang SC", "Geeza Pro", sans-serif`, line height 24px, from
  `fontFromStyle` on a styled element (Helvetica Neue was present in every browser).
- **Resize**: every helper is timed at 399 px on handles last used at 400 px. None keeps state per width except
  fitFontSize's PreparedSizes, so for the others the call at 399 is the resize; fitFontSize and fitFontSizeRich
  get a warm row (a second call, 400 then 399, on the same PreparedSizes) and cold rows (a new PreparedSizes).
- **clamp**: `clamp(prepared, 399, 3, measureTail('…', font))`.
- **truncateMiddle**: 200 distinct path labels recombined from the sweep's labels' directories and file names,
  `keepEnd` from the last `/`, at 399 and at 200 px (where more of them are cut); `prepareLabel` timed apart.
- **fitFontSize**: the messages in a { width: 399, height: 96 } box, sizes 8-48, line height round(1.5 × px).
- **fitFontSizeRich**: 200 icon-and-label rows (the sweep's UI labels and 8-40 unit runs of its Latin, German,
  French and emoji corpora): an icon round(1.25 × px) wide, then the label with extraWidth round(0.5 × px), in a
  { width: 399, height: 72 } box, sizes 8-32.
- **List**: `stack` over 10,000 heights (the messages' heights at 399, repeated), and `findIndexAt` for 1,000
  random offsets into those 10,000 tops; µs per call.

**First sight.** The cold prepare row clears Pretext's caches (`clearCache()`) before each batch and prepares 1,000
new message strings. The corpora are small, so new strings are not new words: the browser's own shaping and
font caches (shared by canvas and the DOM in every engine) have seen these words in earlier batches, and short
messages recur across batches. The row is therefore Pretext's full first-sight work over warm browser caches. The
"first pass in a fresh browser" table is the coldest case there is: the first 1,000 messages a newly launched
browser measures, one sample per session, including the first canvas and font load. The "new strings, Pretext
caches warm" row is the steady state of a chat receiving messages: words mostly seen, strings new.

**DOM baselines**, written as a competent implementation would: `dom.resize` sets the width of a box holding the
1,000 message divs (already laid out at the other width) and then reads every height, so a resize costs one
reflow and no read forces another; `dom.first` creates and appends 1,000 new message divs and reads their heights
(again one reflow). For fitting, the common loop binary-searches each message in one fixed-size box,
`overflow: hidden`, reading `scrollHeight` and `scrollWidth` after each size (a reflow per size tried, as most
code does), and the lockstep variant searches all 1,000 boxes at once, writing every box's next size and then
reading them all, a reflow per search step for all boxes. Neither includes paint, which the kit also avoids;
both include the style recalculation a font-size change costs. The kit and the DOM must answer alike for the
comparison to hold; the agreement table says how often they did.

## Machine state

Pretext's guidance is a quiet machine, and this one is shared with other agents' browser runs. Before each
browser's measured run the bench waited (polling every 60 s, up to 30 min) until no Playwright browser process it
had not started was running, then polled every 10 s during the run; a run that saw one was thrown away and the
browser run again (up to 3 attempts). "Quiet" below means none was seen at the start or in any poll. Other
load (apps, system daemons) is not controlled: the load averages (`sysctl -n vm.loadavg`, 1, 5 and 15 min) at the
start and end of each measured run, and the busiest processes when the bench started, are recorded so the numbers
can be read as what they are: on a loaded machine, upper bounds.

| browser | quiet (no other Playwright browser) | attempts | waited before measuring | polls | load at start | load at end |
|---|---|---:|---:|---:|---|---|
| chromium | yes | 1 | 0 s | 21 | 3.80 4.53 4.58 | 4.03 4.38 4.50 |
| webkit | yes | 1 | 0 s | 28 | 4.03 4.38 4.50 | 3.52 3.90 4.26 |
| firefox | yes | 1 | 0 s | 26 | 3.40 3.87 4.24 | 3.76 3.75 4.08 |

Busiest processes when the bench started (%CPU, command):

```
97.1 node
 88.1 /usr/libexec/replayd
 21.4 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT
 20.0 /Users/zooey/Library/Application Support/Claude/scratch-workspaces/8b4febb8-ddae-4f92-bbec-1042df959934/6d51590f-1dc4-419c-88e9-b48b7ecabed3/scratch-2026-10-05-0027b4/pretext-kit-bench/node_modules/@esbuild/darwin-arm64/bin/esbuild
 19.1 /Users/zooey/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService
```

## Browsers and timers

| browser | build | cross-origin isolated | timer step (ms) | target per sample (ms) | 1-min load before → after each session | dropped samples |
|---|---|---|---:|---:|---|---:|
| chromium | 149.0.7827.55 (chromium-1228) | true | 0.005 | 25 | 3.7→3.6, 3.6→5.4, 5.4→4.0 | 0 |
| webkit | 26.5 (webkit_mac14_arm64_special-2251) | true | 0.02 | 25 | 4.0→4.2, 4.2→3.6, 3.8→3.5 | 0 |
| firefox | 151.0 (firefox-1532) | true | 0.02 | 25 | 3.4→4.0, 4.0→3.4, 3.4→3.3 | 0 |

The timer step is the smallest nonzero difference between two `performance.now()` readings in 1,000 tries.
Browsers coarsen the timer and add jitter (Firefox and WebKit more than Chromium), so the sample length, not the
step, sets the resolution: a sample is at least 25 ms, or 100 steps.

## chromium 149.0.7827.55 (chromium-1228)

| operation | per | median µs | p95 µs | session medians µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 13.1 | 15.5 | 13.3, 13.6, 12.7 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 11.0 | 12.5 | 11.2, 11.4, 10.6 | 60 |
| prepareWithSegments, the same strings again | message | 10.7 | 13.1 | 10.8, 10.9, 10.1 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.217 | 0.262 | 0.224, 0.214, 0.214 | 60 |
| layout() at 399 (resize) | message | 0.218 | 0.264 | 0.234, 0.218, 0.214 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.233 | 0.259 | 0.244, 0.231, 0.225 | 60 |
| balance at 399 | message | 4.06 | 4.63 | 4.17, 4.10, 3.90 | 60 |
| clamp(…, 399, 3, measureTail('…')) | message | 7.65 | 10.2 | 8.38, 7.53, 7.39 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 293 | 381 | 329, 286, 283 | 60 |
| truncateMiddle at 399, keepEnd at the last / | label | 12.8 | 15.3 | 13.0, 12.7, 12.3 | 60 |
| truncateMiddle at 200, keepEnd at the last / | label | 23.8 | 31.1 | 26.8, 23.3, 22.4 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 115 | 141 | 118, 116, 111 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 73.8 | 90.6 | 75.2, 74.0, 70.0 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 3.31 | 3.79 | 3.40, 3.14, 3.35 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 51.9 | 68.8 | 53.3, 54.7, 47.9 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 25.7 | 39.8 | 25.7, 26.8, 23.7 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 1.63 | 2.00 | 1.63, 1.82, 1.49 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | 70.7 | 79.3 | 75.3, 71.1, 11.6 | 60 |
| findIndexAt over 10,000 tops | call | 0.078 | 0.088 | 0.078, 0.081, 0.073 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 28.4 | 33.3 | 30.5, 27.9, 27.9 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 3.40 | 4.14 | 3.63, 3.38, 3.33 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 243 | 272 | 258, 239, 240 | 60 |
| DOM fitFontSize: all boxes searched in lockstep (a reflow per step) | message | 199 | 227 | 208, 198, 193 | 60 |

## webkit 26.5 (webkit_mac14_arm64_special-2251)

| operation | per | median µs | p95 µs | session medians µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 24.7 | 26.5 | 24.9, 24.7, 24.3 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 10.4 | 11.6 | 10.2, 10.9, 10.4 | 60 |
| prepareWithSegments, the same strings again | message | 8.89 | 9.57 | 8.78, 8.91, 8.77 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.218 | 0.231 | 0.216, 0.219, 0.214 | 60 |
| layout() at 399 (resize) | message | 0.205 | 0.218 | 0.203, 0.210, 0.202 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.241 | 0.265 | 0.241, 0.249, 0.239 | 60 |
| balance at 399 | message | 3.92 | 4.27 | 3.89, 4.00, 3.93 | 60 |
| clamp(…, 399, 3, measureTail('…')) | message | 9.89 | 11.1 | 10.1, 9.54, 9.89 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 254 | 356 | 236, 246, 300 | 60 |
| truncateMiddle at 399, keepEnd at the last / | label | 18.5 | 21.3 | 18.5, 19.0, 17.5 | 60 |
| truncateMiddle at 200, keepEnd at the last / | label | 27.9 | 32.2 | 27.9, 27.4, 27.7 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 301 | 314 | 301, 302, 298 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 76.7 | 82.1 | 75.6, 77.4, 76.9 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 3.19 | 3.33 | 3.19, 3.21, 3.15 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 109 | 116 | 109, 109, 108 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 29.7 | 32.3 | 29.7, 29.9, 29.1 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 1.16 | 1.22 | 1.17, 1.15, 1.13 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | 10.2 | 10.7 | 10.2, 10.6, 10.2 | 60 |
| findIndexAt over 10,000 tops | call | 0.057 | 0.064 | 0.058, 0.058, 0.056 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 68.2 | 74.0 | 65.5, 69.9, 67.5 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 18.6 | 19.3 | 18.4, 18.9, 18.5 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 570 | 590 | 569, 572, 569 | 60 |
| DOM fitFontSize: all boxes searched in lockstep (a reflow per step) | message | 439 | 472 | 439, 450, 434 | 60 |

## firefox 151.0 (firefox-1532)

| operation | per | median µs | p95 µs | session medians µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 28.5 | 37.4 | 28.9, 28.3, 28.4 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 20.4 | 28.8 | 21.1, 20.0, 19.9 | 60 |
| prepareWithSegments, the same strings again | message | 18.8 | 24.6 | 19.1, 18.5, 19.0 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.449 | 0.465 | 0.454, 0.448, 0.446 | 60 |
| layout() at 399 (resize) | message | 0.454 | 0.468 | 0.457, 0.453, 0.450 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.573 | 0.649 | 0.583, 0.573, 0.571 | 60 |
| balance at 399 | message | 9.28 | 9.61 | 9.33, 9.22, 9.21 | 60 |
| clamp(…, 399, 3, measureTail('…')) | message | 21.8 | 27.3 | 22.1, 21.6, 21.8 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 107 | 140 | 112, 105, 105 | 60 |
| truncateMiddle at 399, keepEnd at the last / | label | 31.5 | 39.2 | 31.5, 31.1, 31.7 | 60 |
| truncateMiddle at 200, keepEnd at the last / | label | 58.9 | 74.6 | 59.9, 57.9, 58.9 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 275 | 291 | 280, 271, 275 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 140 | 149 | 140, 139, 137 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 6.51 | 8.57 | 6.48, 6.51, 6.59 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 125 | 152 | 127, 123, 124 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 54.9 | 64.5 | 54.0, 55.1, 54.1 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 3.42 | 4.23 | 3.48, 3.34, 3.30 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | 10.4 | 10.8 | 10.7, 10.3, 10.3 | 60 |
| findIndexAt over 10,000 tops | call | 0.072 | 0.078 | 0.071, 0.072, 0.073 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 20.1 | 21.1 | 20.2, 19.7, 19.9 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 6.35 | 6.52 | 6.39, 6.30, 6.33 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 539 | 557 | 545, 533, 542 | 60 |
| DOM fitFontSize: all boxes searched in lockstep (a reflow per step) | message | 157 | 166 | 159, 156, 156 | 60 |

## First pass in a fresh browser

The first 1,000 messages each newly launched browser prepares and lays out (at 399), before it has measured any text; one sample per session, µs per message.

| browser | prepareWithSegments per session | layout() per session |
|---|---|---|
| chromium | 53.0, 47.8, 51.8 | 2.97, 3.42, 3.36 |
| webkit | 67.8, 64.3, 69.4 | 6.98, 3.80, 4.54 |
| firefox | 74.5, 77.6, 83.7 | 4.76, 6.24, 5.62 |

## Structural counts

Pretext calls per kit call, from the count bundle, in which `@chenglou/pretext` and its rich-inline entry resolve
to counting wrappers (verify/bench-count-pretext.ts, verify/bench-count-rich.ts) for the kit's own imports; src/ is
not touched and the counted bundle is never timed. Mean (min–max) over the workload at 399. The spec's bound:
balance costs about log2(maxWidth) walks (log2 399 = 8.64, plus the target count, the widest piece and the
check), and fitFontSize about log2(max − min) + 1 probes (6.32 for 8-48; 5.58 for the rich rows' 8-32), each a
walk and, cold, a prepare; the answer is walked once more to report its line count.

| browser | balance: measureLineStats walks | shrinkwrap walks | fitFontSize cold: prepares / walks | fitFontSize warm: prepares / walks | fitFontSizeRich cold: prepares / walks | fitFontSizeRich warm: prepares / walks |
|---|---|---|---|---|---|---|
| chromium | 8.09 (2–13) | 1.01 (1–2) | 6.78 (6–7) / 7.79 (7–9) | 0.03 (0–5) / 7.79 (7–9) | 5.96 (5–6) / 6.96 (6–7) | 0.01 (0–2) / 6.96 (6–7) |
| webkit | 8.09 (2–13) | 1.01 (1–2) | 6.77 (1–7) / 7.77 (1–8) | 0.03 (0–5) / 7.77 (1–8) | 5.96 (5–6) / 6.96 (6–7) | 0.01 (0–2) / 6.96 (6–7) |
| firefox | 8.12 (2–13) | 1.00 (1–2) | 6.76 (1–7) / 7.77 (1–9) | 0.03 (0–5) / 7.77 (1–9) | 5.96 (5–6) / 6.96 (6–7) | 0.00 (0–0) / 6.96 (6–7) |

Prepares per call at resize time, where the kit measures a cut text joined to its ellipsis as one prepared text (src/cut.ts):

| browser | clamp(…, 399, 3) | truncateMiddle at 399 | truncateMiddle at 200 |
|---|---|---|---|
| chromium | 1.32 (0–9) | 2.73 (0–10) | 6.66 (0–14) |
| webkit | 1.32 (0–9) | 2.74 (0–10) | 6.66 (0–14) |
| firefox | 1.42 (0–10) | 2.73 (0–10) | 6.66 (0–14) |

## Kit and DOM agreement on this workload

From each browser's first session, at 399. Not a correctness gate (that is `npm run verify`); it says the
timed DOM baselines did the same job.

| browser | heights equal (kit layout vs DOM) | fitFontSize px equal (kit vs DOM lockstep) | DOM loop equals DOM lockstep | clamp truncated | truncateMiddle cut at 399 / 200 |
|---|---|---|---|---|---|
| chromium | 1000/1000 | 1000/1000 | 1000/1000 | 239/1000 | 66/200 / 157/200 |
| webkit | 1000/1000 | 1000/1000 | 1000/1000 | 245/1000 | 66/200 / 157/200 |
| firefox | 1000/1000 | 1000/1000 | 1000/1000 | 243/1000 | 66/200 / 157/200 |

## Reading the numbers

- **chromium.** On a resize Pretext's layout(), which gives a kit-built list its heights, is 15.6× faster than the batched DOM read of the same heights
  (layout() 0.218 µs against 3.40 µs per message); shrinkwrap costs 0.233 µs, balance 4.06 µs
  (19× layout()), clamp 7.65 µs. At first sight, Pretext's cold prepare plus layout
  (13.3 µs per message) is 2.1× faster than creating, appending and reading the same number of new DOM
  messages (28.4 µs); with Pretext's caches warm, new strings cost 11.3 µs. fitFontSize is
  60.1× faster than the lockstep DOM search warm (3.31 against 199 µs),
  2.7× faster than it with a new PreparedSizes (73.8 µs) and 1.7× faster than it
  with Pretext's caches cleared too (115 µs); the common per-box DOM loop costs 243 µs.
- **webkit.** On a resize Pretext's layout(), which gives a kit-built list its heights, is 90.6× faster than the batched DOM read of the same heights
  (layout() 0.205 µs against 18.6 µs per message); shrinkwrap costs 0.241 µs, balance 3.92 µs
  (19× layout()), clamp 9.89 µs. At first sight, Pretext's cold prepare plus layout
  (24.9 µs per message) is 2.7× faster than creating, appending and reading the same number of new DOM
  messages (68.2 µs); with Pretext's caches warm, new strings cost 10.6 µs. fitFontSize is
  137.6× faster than the lockstep DOM search warm (3.19 against 439 µs),
  5.7× faster than it with a new PreparedSizes (76.7 µs) and 1.5× faster than it
  with Pretext's caches cleared too (301 µs); the common per-box DOM loop costs 570 µs.
- **firefox.** On a resize Pretext's layout(), which gives a kit-built list its heights, is 14.0× faster than the batched DOM read of the same heights
  (layout() 0.454 µs against 6.35 µs per message); shrinkwrap costs 0.573 µs, balance 9.28 µs
  (20× layout()), clamp 21.8 µs. At first sight, Pretext's cold prepare plus layout
  (29.0 µs per message) is 1.4× slower than creating, appending and reading the same number of new DOM
  messages (20.1 µs); with Pretext's caches warm, new strings cost 20.9 µs. fitFontSize is
  24.0× faster than the lockstep DOM search warm (6.51 against 157 µs),
  1.1× faster than it with a new PreparedSizes (140 µs) and 1.8× slower than it
  with Pretext's caches cleared too (275 µs); the common per-box DOM loop costs 539 µs.

**What dominates.**

- **chromium.** The costliest calls are ones that prepare: prepareLabel 293 µs, fitFontSize with Pretext's caches cleared 115 µs, fitFontSize with a new PreparedSizes 73.8 µs. A cold prepare is 60× a layout() of the same message.
  At resize time the helpers cost 0.233 µs (shrinkwrap) to 23.8 µs (truncateMiddle at 200), against
  layout()'s 0.218 µs. A first pass in a fresh browser prepared at 51.8 µs per message (median of the
  sessions), 4.0× the cleared-cache row, whose batches find most words in the browser's caches.
- **webkit.** The costliest calls are ones that prepare: fitFontSize with Pretext's caches cleared 301 µs, prepareLabel 254 µs, fitFontSizeRich with Pretext's caches cleared 109 µs. A cold prepare is 120× a layout() of the same message.
  At resize time the helpers cost 0.241 µs (shrinkwrap) to 27.9 µs (truncateMiddle at 200), against
  layout()'s 0.205 µs. A first pass in a fresh browser prepared at 67.8 µs per message (median of the
  sessions), 2.7× the cleared-cache row, whose batches find most words in the browser's caches.
- **firefox.** The costliest calls are ones that prepare: fitFontSize with Pretext's caches cleared 275 µs, fitFontSize with a new PreparedSizes 140 µs, fitFontSizeRich with Pretext's caches cleared 125 µs. A cold prepare is 63× a layout() of the same message.
  At resize time the helpers cost 0.573 µs (shrinkwrap) to 58.9 µs (truncateMiddle at 200), against
  layout()'s 0.454 µs. A first pass in a fresh browser prepared at 77.6 µs per message (median of the
  sessions), 2.7× the cleared-cache row, whose batches find most words in the browser's caches.

First-sight preparation is the cost the kit inherits from Pretext. A cold fitFontSize prepares the text at each
size its search probes (the structural counts), so it is several first-sight prepares, not one; warm, the same
search is a few walks over cached handles, and the counts show the warm call at 399 prepares almost nothing. balance
is a binary search of walks, so it costs about as many layouts as its count. clamp and truncateMiddle find a cut by
bisection, measuring each candidate joined to the ellipsis as one prepared text (src/cut.ts), so a truncated row
pays several small prepares at resize time (the prepares table); prepareLabel lays the label out at width 0 to find
every cut point and measures the ellipsis, once per label.
The list helpers cost nanoseconds per row.

**Where the DOM is the better tool.** The DOM numbers here are for an app that would lay these elements out
anyway: a DOM read after a width change measures many boxes in one reflow, and the first-sight comparison charges
the DOM for creating elements an app may already have. Where the DOM row is faster, the kit's case is that it
answers without the elements existing (virtualised lists, a worker, before first paint) and without forcing
reflow mid-frame, not raw speed. A DOM measurement also includes text the kit does not model (it is exact only
within what Pretext models; see RESULTS.md).

**Caveats.** One machine, one OS, one font stack; Windows and Linux text stacks were not timed. Sessions differ
(see the session medians); compare rows within a session or a run, never across machines. On a loaded machine the
numbers are upper bounds. A row whose session medians split far apart (one session several times the others)
shows a speed one compiled copy of the code kept for a whole document, as Pretext's RESEARCH.md (Timing, "A copy
keeps a speed for a document") records; its pooled median is then one of two speeds, not a typical one.

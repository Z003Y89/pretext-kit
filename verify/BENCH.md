# Cost bench

> **Measured on a loaded machine; every timing here is an upper bound.** Screen recording (replayd) and a UI-driving agent service (computer use) were running, other agents' sessions were
> active (their Playwright browsers were waited out and polled for; see Machine state), and the 1-min load average
> ran 3.0-4.1 on 8 cores across the sessions. A fixed arithmetic probe took 21.0-23.6 ms
> (fastest of 7) before and after the sessions. To reproduce on a quiet machine: quit other apps, stop screen
> recording, run `npm install && npx playwright install chromium webkit firefox && npm run bench` from the
> repository root, and leave the Mac untouched for about 15 minutes (this run's length).

Run on 2026-10-05 by `npm run bench` (verify/bench-run.ts, verify/bench.ts), kit at 4854056 2026-10-05 with uncommitted changes,
Pretext 0.0.9 at f10d888 2026-10-05, Playwright 1.61.0.
Machine: Apple M2, 8 cores, 16 GB RAM; macOS 14.6.1 (23G93), Darwin 23.6.0.

Each browser ran 3 sessions, one after another and never side by side, each in a newly launched headed
browser serving `bench.html` cross-origin isolated from 127.0.0.1.
A session runs 3 discarded warm-up rounds (the first sizes every operation's repetitions) and 20 timed
rounds; a round runs every operation once, in an order shuffled per round, each sample after a MessageChannel
yield. A sample repeats its operation until it takes the target time (25 ms, or 100 timer steps where the timer is
coarser), so timer coarsening and single GC pauses cannot decide it. Each sample is therefore a **mean per
message** (or label, row or call); the tables give the **median and p95 of those sample means** over the
60 samples of the sessions (sample to sample, not call to call; the per-call table gives calls), with
each session's median beside them, since sessions drift apart (Pretext, RESEARCH.md, Evaluation Traps, Timing). A row
whose session medians differ by more than 1.25× is flagged, and its headline is the range of the session medians.
These numbers are reported, not targeted.

## Workload

- **Messages**: 1000 distinct chat-like messages cut at word boundaries from the sweep's corpora
  (verify/corpora.ts), one corpus a message: urls 135, emoji-chat 146, arabic 148, french 150, german 148, latin 130, cjk 143.
  Lengths follow Pretext's bench: 173 under 20 UTF-16 units, 534 of 20-100, 293 over 100
  (median 64); a fifth end with an emoji. Font `400 16px "Helvetica Neue", "PingFang SC", "Geeza Pro", sans-serif`, line height 24px, from
  `fontFromStyle` on a styled element (Helvetica Neue was present in every browser, probed after the first pass).
- **Resize**: `layout()`, shrinkwrap and balance are timed at 399 px on handles prepared once. They keep no state
  per width and measure nothing new (they walk cached widths), so repeating 399 is the resize. clamp and
  truncateMiddle measure their cut texts through Pretext, whose caches would hold a width's cuts after one
  repetition, so each repetition takes a width the session has not used, stepping down a pixel from 399 (or 200),
  1/64 px lower on each pass through 100 (or 50) px; nearby widths can still cut the same text, as during a drag.
  fitFontSize and fitFontSizeRich get a warm row (a second call, 400 then 399, on the same PreparedSizes) and cold
  rows (a new PreparedSizes, with Pretext's caches warm or cleared).
- **clamp**: `clamp(prepared, w, 3, measureTail('…', font))`.
- **truncateMiddle**: 200 distinct path labels recombined from the sweep's labels' directories and file names,
  `keepEnd` from the last `/`; `prepareLabel` timed apart.
- **fitFontSize**: the messages in a { width: 399, height: 96 } box, sizes 8-48, line height round(1.5 × px).
- **fitFontSizeRich**: 200 icon-and-label rows (the sweep's UI labels and 8-40 unit runs of its Latin, German,
  French and emoji corpora): an icon round(1.25 × px) wide, then the label with extraWidth round(0.5 × px), in a
  { width: 399, height: 72 } box, sizes 8-32.
- **List**: `stack` over 10,000 heights (the messages' heights at 399, repeated), and `findIndexAt` for 1,000
  random offsets into those 10,000 tops; µs per call.
- **Pretext's caches**: Pretext keeps every segment width it measures, per font, until `clearCache()`. In the rows
  marked "caches warm" they hold every word of the workload at every size a search has probed; that memory grows
  with the distinct words and sizes an app measures, and it was not measured here.

**First sight.** The cold prepare row clears Pretext's caches (`clearCache()`) before each batch and prepares 1,000
new message strings. The corpora are small, so new strings are not new words, and short messages recur across
batches; the browser's own caches are as earlier batches left them. The "first pass in a fresh browser" table
times the first 1,000 messages a newly launched browser measures, and, as a control, a second new batch right
after it with Pretext's caches cleared again; the DOM gets the same in a browser launched for it alone.

**DOM baselines**, written as a competent implementation would: `dom.resize` sets the width of a box holding the
1,000 message divs (already laid out at the other width) and then reads every height, so a resize costs one
reflow and no read forces another; `dom.first` creates and appends 1,000 new message divs and reads their heights
(again one reflow). For fitting, the common loop binary-searches each message in one fixed-size box,
`overflow: hidden`, reading `scrollHeight` and `scrollWidth` after each size (a reflow per size tried, as most
code does); the lockstep variant searches all 1,000 boxes at once from scratch, writing every box's next size and
then reading them all, a reflow per search step for all boxes; and the warm-started variant, the fair comparison
for a resize, sets the boxes from 400 to 399 px and has each try the size it had at 400, then one pixel larger, and
bisect only where that does not settle it. None includes paint, which the kit also avoids; all include the style
recalculation a font-size change costs. The kit and the DOM must answer alike for the comparison to hold; the
agreement table says how often they did.

## Machine state

Pretext's guidance is a quiet machine; this one was shared with other agents. Before each browser's measured run
the bench waited (polling every 60 s, up to 30 min) until no Playwright browser it had not started was running, then
polled every 10 s during the run; a run that saw one was thrown away and the browser run again (up to
3 attempts). The column "no other Playwright browser" says whether none was seen at the start or in any poll.
Other load (apps, system daemons, other agents' non-browser work) was not controlled: the load averages
(`sysctl -n vm.loadavg`, 1, 5 and 15 min) at the start and end of each browser's measured run, the busiest other
processes just before it, and the arithmetic probe (a fixed 20M-step integer loop in the runner, fastest of 7)
before and after each session are recorded so the numbers can be read as what they are: upper bounds.

Focus: Playwright emulates page focus, so the page's own focus checks prove nothing. The runner instead polled the
OS's frontmost app (`lsappinfo visibleProcessList`) every 10 s; the tallies are below. A browser that was not
frontmost may have been throttled by the OS; the bench does not drop samples for it.

| browser | no other Playwright browser | attempts | waited | polls | load at start | load at end | probe ms per session (before → after) | frontmost app at polls |
|---|---|---:|---:|---:|---|---|---|---|
| chromium | yes | 1 | 60 s | 24 | 2.97 2.88 3.22 | 3.93 3.37 3.34 | 23.6 → 22.0, 21.5 → 23.5, 21.6 → 22.0 | Claude 14, Google Chrome for Testing 8 |
| webkit | yes | 1 | 0 s | 34 | 4.10 3.41 3.35 | 3.77 3.65 3.48 | 23.5 → 22.9, 22.0 → 23.1, 22.6 → 21.6 | Claude 32 |
| firefox | yes | 1 | 0 s | 28 | 3.77 3.65 3.48 | 3.67 3.61 3.50 | 21.7 → 21.8, 21.1 → 21.7, 21.0 → 21.7 | Nightly 14, Claude 12 |

Busiest other processes before chromium (%CPU, name): 93.2% replayd; 21.0% ChatGPT; 20.3% Claude Helper (Renderer); 19.3% SkyComputerUseService; 18.7% WindowServer; 16.7% Claude Helper.

Busiest other processes before webkit (%CPU, name): 85.3% replayd; 27.3% WindowServer; 22.5% ChatGPT; 19.9% SkyComputerUseService; 9.9% Claude Helper; 5.2% launchservicesd.

Busiest other processes before firefox (%CPU, name): 79.5% replayd; 20.6% ChatGPT; 19.7% WindowServer; 18.5% SkyComputerUseService; 11.6% Claude Helper; 5.5% launchservicesd.

## Browsers and timers

| browser | build | cross-origin isolated | devicePixelRatio | timer step (ms) | target per sample (ms) | 1-min load before → after each session |
|---|---|---|---:|---:|---:|---|
| chromium | 149.0.7827.55 (chromium-1228) | true | 1 | 0.005 | 25 | 3.0→3.4, 3.4→3.8, 3.8→3.9 |
| webkit | 26.5 (webkit_mac14_arm64_special-2251) | true | 1 | 0.02 | 25 | 4.1→3.7, 3.7→3.6, 3.6→3.8 |
| firefox | 151.0 (firefox-1532) | true | 2 | 0.02 | 25 | 3.8→4.1, 4.1→3.2, 3.3→3.6 |

The timer step is the smallest nonzero difference between two `performance.now()` readings in 1,000 tries.
Browsers coarsen the timer and add jitter, so the sample length, not the step, sets the resolution of the tables.

## chromium 149.0.7827.55 (chromium-1228)

| operation | per | median of sample means, µs | p95 of sample means, µs | session medians, µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 14.6 | 19.9 | 14.2, 14.5, 14.7 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 12.1 | 13.0 | 11.6, 12.0, 12.2 | 60 |
| prepareWithSegments, the same strings again | message | 11.9 | 12.5 | 11.9, 11.7, 12.1 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.232 | 0.243 | 0.231, 0.233, 0.233 | 60 |
| layout() at 399 (resize) | message | 0.233 | 0.239 | 0.231, 0.234, 0.232 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.243 | 0.258 | 0.243, 0.242, 0.245 | 60 |
| balance at 399 | message | 4.22 | 4.42 | 4.21, 4.20, 4.31 | 60 |
| clamp(…, 3, measureTail('…')) at a new width each repetition, 399 down | message | 9.16 | 9.95 | 8.92, 8.99, 9.26 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 297 | 316 | 292, 296, 300 | 60 |
| truncateMiddle at a new width each repetition, 399 down; keepEnd at the last / | label | 17.8 | 22.5 | 17.8, 17.0, 18.0 | 60 |
| truncateMiddle at a new width each repetition, 200 down; keepEnd at the last / | label | 26.6 | 30.9 | 26.0, 26.1, 26.8 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 124 | 141 | 123, 124, 127 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 82.9 | 87.3 | 83.0, 82.0, 84.1 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 3.43 | 3.66 | 3.40, 3.44, 3.39 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 55.9 | 67.8 | 54.5, 55.6, 57.5 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 27.5 | 29.9 | 27.4, 27.4, 27.5 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 1.59 | 1.81 | 1.57, 1.50, 1.70 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | **12.6–78.2** (sessions disagree) | 78.4 | 78.2, 12.6, 12.8 | 60 |
| findIndexAt over 10,000 tops | call | 0.080 | 0.088 | 0.078, 0.082, 0.079 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 29.6 | 32.0 | 29.2, 29.7, 29.9 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 3.56 | 4.22 | 3.53, 3.55, 3.62 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 253 | 264 | 249, 252, 258 | 60 |
| DOM fitFontSize: all boxes searched in lockstep from scratch (a reflow per step) | message | 211 | 232 | 211, 205, 212 | 60 |
| DOM fitFontSize warm-started on a resize, 400 then 399: each box tries its previous size first | message | 55.9 | 61.4 | 55.7, 55.8, 57.8 | 60 |

## webkit 26.5 (webkit_mac14_arm64_special-2251)

| operation | per | median of sample means, µs | p95 of sample means, µs | session medians, µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 26.2 | 28.2 | 26.0, 26.9, 26.0 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 11.0 | 12.3 | 11.0, 11.1, 11.0 | 60 |
| prepareWithSegments, the same strings again | message | 9.39 | 9.97 | 9.32, 9.52, 9.33 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.225 | 0.244 | 0.225, 0.223, 0.224 | 60 |
| layout() at 399 (resize) | message | 0.217 | 0.237 | 0.216, 0.221, 0.214 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.257 | 0.273 | 0.256, 0.261, 0.250 | 60 |
| balance at 399 | message | 4.15 | 4.51 | 4.16, 4.19, 4.03 | 60 |
| clamp(…, 3, measureTail('…')) at a new width each repetition, 399 down | message | 11.3 | 12.3 | 11.4, 11.3, 10.6 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 268 | 377 | 289, 266, 252 | 60 |
| truncateMiddle at a new width each repetition, 399 down; keepEnd at the last / | label | 21.2 | 24.7 | 20.3, 21.7, 20.9 | 60 |
| truncateMiddle at a new width each repetition, 200 down; keepEnd at the last / | label | 30.0 | 35.0 | 30.1, 28.6, 30.9 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 318 | 334 | 318, 322, 312 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 80.5 | 84.4 | 80.5, 81.5, 77.9 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 3.32 | 3.57 | 3.32, 3.38, 3.28 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 117 | 123 | 120, 116, 112 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 31.3 | 34.3 | 31.9, 31.7, 30.8 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 1.23 | 1.31 | 1.23, 1.25, 1.23 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | 11.0 | 11.2 | 11.0, 11.0, 10.6 | 60 |
| findIndexAt over 10,000 tops | call | 0.059 | 0.066 | 0.059, 0.058, 0.058 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 72.3 | 77.1 | 72.8, 72.3, 69.7 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 19.7 | 20.6 | 19.8, 19.9, 19.3 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 589 | 632 | 588, 590, 591 | 60 |
| DOM fitFontSize: all boxes searched in lockstep from scratch (a reflow per step) | message | 464 | 486 | 465, 468, 455 | 60 |
| DOM fitFontSize warm-started on a resize, 400 then 399: each box tries its previous size first | message | 148 | 155 | 149, 149, 145 | 60 |

## firefox 151.0 (firefox-1532)

| operation | per | median of sample means, µs | p95 of sample means, µs | session medians, µs | samples |
|---|---|---:|---:|---|---:|
| **a) prepare** | | | | | |
| prepareWithSegments, first sight (Pretext caches cleared, new strings) | message | 28.6 | 36.6 | 28.8, 28.5, 27.7 | 60 |
| prepareWithSegments, new strings, Pretext caches warm | message | 20.2 | 23.3 | 21.0, 20.0, 19.1 | 60 |
| prepareWithSegments, the same strings again | message | 19.1 | 22.8 | 19.3, 19.4, 18.6 | 60 |
| **b) Pretext layout** | | | | | |
| layout() at 400 | message | 0.464 | 0.493 | 0.489, 0.464, 0.440 | 60 |
| layout() at 399 (resize) | message | 0.466 | 0.503 | 0.491, 0.461, 0.446 | 60 |
| **c) kit helpers** | | | | | |
| shrinkwrap at 399 | message | 0.584 | 0.661 | 0.584, 0.592, 0.563 | 60 |
| balance at 399 | message | 9.40 | 9.84 | 9.43, 9.44, 9.09 | 60 |
| clamp(…, 3, measureTail('…')) at a new width each repetition, 399 down | message | 21.9 | 28.8 | 21.6, 22.2, 21.5 | 60 |
| prepareLabel (path labels, Pretext caches warm) | label | 107 | 142 | 113, 108, 99.9 | 60 |
| truncateMiddle at a new width each repetition, 399 down; keepEnd at the last / | label | 37.7 | 46.5 | 41.0, 38.7, 36.2 | 60 |
| truncateMiddle at a new width each repetition, 200 down; keepEnd at the last / | label | 60.8 | 78.2 | 63.3, 60.8, 58.6 | 60 |
| fitFontSize, new PreparedSizes, Pretext caches cleared | message | 278 | 295 | 281, 278, 272 | 60 |
| fitFontSize, new PreparedSizes (cold), Pretext caches warm | message | 144 | 160 | 144, 142, 141 | 60 |
| fitFontSize, warm PreparedSizes: second call, 400 then 399 | message | 6.62 | 8.60 | 6.71, 6.68, 6.24 | 60 |
| fitFontSizeRich, new PreparedSizesRich, Pretext caches cleared | row | 127 | 162 | 128, 127, 124 | 60 |
| fitFontSizeRich, new PreparedSizesRich (cold), Pretext caches warm | row | 54.4 | 65.7 | 55.8, 54.1, 52.8 | 60 |
| fitFontSizeRich, warm: second call, 400 then 399 | row | 3.40 | 4.53 | 3.48, 3.41, 3.21 | 60 |
| **d) list helpers** | | | | | |
| stack over 10,000 heights | call | 10.5 | 10.8 | 10.7, 10.5, 10.3 | 60 |
| findIndexAt over 10,000 tops | call | 0.076 | 0.082 | 0.073, 0.080, 0.077 | 60 |
| **e) DOM baselines** | | | | | |
| DOM: create and append new message divs at 399, read every height | message | 20.0 | 21.4 | 20.2, 20.2, 19.5 | 60 |
| DOM: resize the box 400↔399, read every height (one reflow, batched reads) | message | 6.40 | 6.85 | 6.48, 6.45, 6.15 | 60 |
| DOM fitFontSize: the common loop, one box, a read per size tried | message | 565 | 584 | 566, 568, 547 | 60 |
| DOM fitFontSize: all boxes searched in lockstep from scratch (a reflow per step) | message | 164 | 173 | 165, 165, 158 | 60 |
| DOM fitFontSize warm-started on a resize, 400 then 399: each box tries its previous size first | message | 44.9 | 48.4 | 45.1, 45.6, 43.6 | 60 |

Rows whose session medians differ by more than 1.25×: chromium list.stack. Why they differ was not established; read their range, not a single number.

## Per call

Session 1 of each browser, outside the timed rounds: each call timed alone, at widths the session had not
used, in µs. Every reading is quantised to the timer step (above), and browsers add jitter to it (readings land on
multiples of the step, often several steps apart), so a call shorter than a few steps is not resolved: read the
tails (p95, max), which show the calls that pay prepares or a GC, not the typical call, which the tables above give.

| browser | call | calls | p50 | p95 | max |
|---|---|---:|---:|---:|---:|
| chromium | clamp | 3000 | < 5 (below the timer) | 45.0 | 95.0 |
| chromium | truncateMiddle ≈399 | 1000 | < 5 (below the timer) | 50.0 | 80.0 |
| chromium | truncateMiddle ≈200 | 1000 | 25.0 | 45.0 | 565 |
| chromium | fitFontSize, new PreparedSizes (Pretext caches warm) | 1000 | 50.0 | 255 | 1035 |
| chromium | fitFontSize, second call 400 then 399 | 1000 | < 5 (below the timer) | 10.00 | 85.0 |
| webkit | clamp | 3000 | < 20 (below the timer) | 40.0 | 280 |
| webkit | truncateMiddle ≈399 | 1000 | < 20 (below the timer) | 40.0 | 260 |
| webkit | truncateMiddle ≈200 | 1000 | 20.0 | 40.0 | 140 |
| webkit | fitFontSize, new PreparedSizes (Pretext caches warm) | 1000 | 60.0 | 220 | 420 |
| webkit | fitFontSize, second call 400 then 399 | 1000 | < 20 (below the timer) | 20.0 | 60.0 |
| firefox | clamp | 3000 | < 20 (below the timer) | 80.0 | 520 |
| firefox | truncateMiddle ≈399 | 1000 | < 20 (below the timer) | 100 | 1040 |
| firefox | truncateMiddle ≈200 | 1000 | 60.0 | 100 | 220 |
| firefox | fitFontSize, new PreparedSizes (Pretext caches warm) | 1000 | 100.0 | 380 | 1260 |
| firefox | fitFontSize, second call 400 then 399 | 1000 | < 20 (below the timer) | 20.0 | 120 |

## First pass in a fresh browser

µs per message, one value per session. The kit: the first 1,000 messages a newly launched browser prepares and lays
out (at 399), then a second batch of new strings right after with Pretext's caches cleared (the control). The DOM:
the first 1,000 new message divs another newly launched browser creates, appends and reads, then a second batch.
The gap between a first pass and its control is what an engine and browser warm on first use (JIT, the canvas, font
loading, shaping caches); this bench does not take it apart.

| browser | kit: first prepare | kit: first layout | kit: second prepare (control) | DOM: first pass | DOM: second pass (control) |
|---|---|---|---|---|---|
| chromium | 53.1, 46.6, 48.2 | 3.37, 2.78, 3.38 | 21.6, 16.5, 17.4 | 43.9, 45.5, 43.0 | 29.9, 29.2, 29.5 |
| webkit | 67.3, 65.9, 75.7 | 3.82, 3.30, 4.70 | 25.6, 26.0, 31.0 | 80.9, 103, 78.1 | 72.5, 71.5, 65.0 |
| firefox | 74.9, 84.3, 98.4 | 5.14, 5.32, 5.32 | 41.7, 50.9, 52.9 | 53.7, 53.2, 47.2 | 31.4, 29.0, 26.8 |

## Structural counts

Pretext calls per kit call, from the count bundle, in which `@chenglou/pretext` and its rich-inline entry resolve
to counting wrappers (verify/bench-count-pretext.ts, verify/bench-count-rich.ts) for the kit's own imports; src/ is
not touched and the counted bundle is never timed. Mean (min–max) over the workload at 399.

| browser | balance: measureLineStats walks | shrinkwrap walks | fitFontSize cold: prepares / walks | fitFontSize warm: prepares / walks | fitFontSizeRich cold: prepares / walks | fitFontSizeRich warm: prepares / walks |
|---|---|---|---|---|---|---|
| chromium | 8.09 (2–13) | 1.01 (1–2) | 6.78 (6–7) / 7.79 (7–9) | 0.03 (0–5) / 7.79 (7–9) | 5.96 (5–6) / 6.96 (6–7) | 0.01 (0–2) / 6.96 (6–7) |
| webkit | 8.09 (2–13) | 1.01 (1–2) | 6.77 (1–7) / 7.77 (1–8) | 0.03 (0–5) / 7.77 (1–8) | 5.96 (5–6) / 6.96 (6–7) | 0.01 (0–2) / 6.96 (6–7) |
| firefox | 8.12 (2–13) | 1.00 (1–2) | 6.76 (1–7) / 7.77 (1–9) | 0.03 (0–5) / 7.77 (1–9) | 5.96 (5–6) / 6.96 (6–7) | 0.00 (0–0) / 6.96 (6–7) |

Against the bounds the code gives (the spec's "about log2(maxWidth)" and "about log2(max − min) + 1"):

- chromium: balance at most 13 walks, within ceil(log2 399) + 4 = 13 (mean 8.09 against log2 399 = 8.64); fitFontSize cold at most 7 prepares, within 1 + ceil(log2 41) = 7; fitFontSizeRich cold at most 6, within 1 + ceil(log2 25) = 6.
- webkit: balance at most 13 walks, within ceil(log2 399) + 4 = 13 (mean 8.09 against log2 399 = 8.64); fitFontSize cold at most 7 prepares, within 1 + ceil(log2 41) = 7; fitFontSizeRich cold at most 6, within 1 + ceil(log2 25) = 6.
- firefox: balance at most 13 walks, within ceil(log2 399) + 4 = 13 (mean 8.12 against log2 399 = 8.64); fitFontSize cold at most 7 prepares, within 1 + ceil(log2 41) = 7; fitFontSizeRich cold at most 6, within 1 + ceil(log2 25) = 6.

Prepares per call at resize time, where the kit measures a cut text joined to its ellipsis as one prepared text (src/cut.ts):

| browser | clamp(…, 399, 3) | truncateMiddle at 399 | truncateMiddle at 200 |
|---|---|---|---|
| chromium | 1.32 (0–9) | 2.73 (0–10) | 6.66 (0–14) |
| webkit | 1.32 (0–9) | 2.74 (0–10) | 6.66 (0–14) |
| firefox | 1.42 (0–10) | 2.73 (0–10) | 6.66 (0–14) |

## Kit and DOM agreement on this workload

From each browser's first session, at 399. Not a correctness gate (that is `npm run verify`); it says the
timed DOM baselines did the same job.

| browser | heights equal (kit layout vs DOM) | fitFontSize px equal (kit vs DOM lockstep) | warm kit vs DOM lockstep | warm-started DOM vs DOM lockstep (reflow steps) | DOM loop vs DOM lockstep | clamp truncated | truncateMiddle cut at 399 / 200 |
|---|---|---|---|---|---|---|---|
| chromium | 1000/1000 | 1000/1000 | 1000/1000 | 1000/1000 (8) | 1000/1000 | 239/1000 | 66/200 / 157/200 |
| webkit | 1000/1000 | 1000/1000 | 1000/1000 | 1000/1000 (8) | 1000/1000 | 245/1000 | 66/200 / 157/200 |
| firefox | 1000/1000 | 1000/1000 | 1000/1000 | 1000/1000 (8) | 1000/1000 | 243/1000 | 66/200 / 157/200 |

## Reading the numbers

- **chromium.** On a resize, Pretext's layout() (what a kit-built list uses for its heights) is 15× faster than the batched
  DOM read of the same heights (0.233 µs against 3.56 µs per message); shrinkwrap costs 0.243 µs, balance
  4.22 µs (18× layout()), clamp 9.16 µs. At first sight, Pretext's cold prepare plus layout
  (14.8 µs per message) is 2× faster than creating, appending and reading as many new DOM messages
  (29.6 µs); with Pretext's caches warm, new strings cost 12.3 µs. On a resize, fitFontSize's second call at
  the new width (3.43 µs) is 16× faster than the warm-started DOM search (55.9 µs).
  For a new text, fitFontSize with a new PreparedSizes (82.9 µs) is 2.5× faster than the DOM lockstep search
  from scratch (211 µs), and 1.7× faster than it with Pretext's caches cleared too
  (124 µs); the common per-box DOM loop costs 253 µs.
- **webkit.** On a resize, Pretext's layout() (what a kit-built list uses for its heights) is 91× faster than the batched
  DOM read of the same heights (0.217 µs against 19.7 µs per message); shrinkwrap costs 0.257 µs, balance
  4.15 µs (19× layout()), clamp 11.3 µs. At first sight, Pretext's cold prepare plus layout
  (26.4 µs per message) is 2.7× faster than creating, appending and reading as many new DOM messages
  (72.3 µs); with Pretext's caches warm, new strings cost 11.3 µs. On a resize, fitFontSize's second call at
  the new width (3.32 µs) is 45× faster than the warm-started DOM search (148 µs).
  For a new text, fitFontSize with a new PreparedSizes (80.5 µs) is 5.8× faster than the DOM lockstep search
  from scratch (464 µs), and 1.5× faster than it with Pretext's caches cleared too
  (318 µs); the common per-box DOM loop costs 589 µs.
- **firefox.** On a resize, Pretext's layout() (what a kit-built list uses for its heights) is 14× faster than the batched
  DOM read of the same heights (0.466 µs against 6.40 µs per message); shrinkwrap costs 0.584 µs, balance
  9.40 µs (20× layout()), clamp 21.9 µs. At first sight, Pretext's cold prepare plus layout
  (29.1 µs per message) is 1.5× slower than creating, appending and reading as many new DOM messages
  (20.0 µs); with Pretext's caches warm, new strings cost 20.7 µs. On a resize, fitFontSize's second call at
  the new width (6.62 µs) is 6.8× faster than the warm-started DOM search (44.9 µs).
  For a new text, fitFontSize with a new PreparedSizes (144 µs) is 1.1× faster than the DOM lockstep search
  from scratch (164 µs), and 1.7× slower than it with Pretext's caches cleared too
  (278 µs); the common per-box DOM loop costs 565 µs.

**What dominates.**

- **chromium.** The costliest calls are ones that prepare: prepareLabel 297 µs, fitFontSize with Pretext's caches cleared 124 µs, fitFontSize with a new PreparedSizes 82.9 µs. A cold prepare is 63× a layout() of the same message.
  At resize time the helpers cost 0.243 µs (shrinkwrap) to 26.6 µs (truncateMiddle near 200), against
  layout()'s 0.233 µs. The first pass in a fresh browser prepared at 48.2 µs per message and the control batch right
  after it at 17.4 µs (medians of the sessions), against 14.6 µs for the cleared-cache row.
- **webkit.** The costliest calls are ones that prepare: fitFontSize with Pretext's caches cleared 318 µs, prepareLabel 268 µs, fitFontSizeRich with Pretext's caches cleared 117 µs. A cold prepare is 120× a layout() of the same message.
  At resize time the helpers cost 0.257 µs (shrinkwrap) to 30.0 µs (truncateMiddle near 200), against
  layout()'s 0.217 µs. The first pass in a fresh browser prepared at 67.3 µs per message and the control batch right
  after it at 26.0 µs (medians of the sessions), against 26.2 µs for the cleared-cache row.
- **firefox.** The costliest calls are ones that prepare: fitFontSize with Pretext's caches cleared 278 µs, fitFontSize with a new PreparedSizes 144 µs, fitFontSizeRich with Pretext's caches cleared 127 µs. A cold prepare is 61× a layout() of the same message.
  At resize time the helpers cost 0.584 µs (shrinkwrap) to 60.8 µs (truncateMiddle near 200), against
  layout()'s 0.466 µs. The first pass in a fresh browser prepared at 84.3 µs per message and the control batch right
  after it at 50.9 µs (medians of the sessions), against 28.6 µs for the cleared-cache row.

First-sight preparation is the cost the kit inherits from Pretext. A cold fitFontSize prepares the text at each
size its search probes (the structural counts), so it is several first-sight prepares, not one; its second call at
a new width is a few walks over the handles the first call left, and the counts show it prepares almost nothing.
balance is a binary search of walks, so it costs about as many layouts as its count. clamp and truncateMiddle find
a cut by bisection, measuring each candidate joined to the ellipsis as one prepared text (src/cut.ts), so a
truncated row pays several small prepares at resize time (the prepares table); prepareLabel lays the label out at
width 0 to find every cut point and measures the ellipsis, once per label. The list helpers cost nanoseconds per row.

**Where the DOM is the better tool.** The DOM numbers here are for an app that would lay these elements out
anyway: a DOM read after a width change measures many boxes in one reflow, and the first-sight comparison charges
the DOM for creating elements an app may already have. Where the DOM row is faster, the kit's case is that it
answers without the elements existing (virtualised lists, a worker, before first paint) and without forcing
reflow mid-frame, not raw speed. A DOM measurement also includes text the kit does not model (it is exact only
within what Pretext models; see RESULTS.md).

**Caveats.** One machine, one OS, one font stack; Windows and Linux text stacks were not timed. Sessions differ
(see the session medians); compare rows within a run, never across machines. On a loaded machine the numbers are
upper bounds.

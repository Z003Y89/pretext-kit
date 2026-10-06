# Changelog

## 0.1.1 (unreleased)

Packaging and platform coverage; no change to the helpers' behaviour.

- **Release tarballs.** Each GitHub release carries `pretext-kit-0.1.1.tgz` and
  `chenglou-pretext-0.0.10-main.f10d888.tgz`, installable by URL with `npm install` (README, Install). The Pretext
  tarball is an unofficial, labelled snapshot of chenglou/pretext `main` at f10d888, built with Pretext's pinned
  TypeScript, not a release by Pretext's authors. `verify/pack-release.sh` (`npm run pack:release`) builds both into
  `dist-release/`; `verify/consumer-smoke.mjs` installs them into a fresh project and runs the kit there through
  `pretext-kit/headless`.
- **`prepack` builds `dist`**, so `npm pack` always ships a fresh build.
- **Peer range** `@chenglou/pretext` `>=0.0.10-0 <0.0.11` (was `>=0.0.10 <0.0.11`): admits the snapshot
  `0.0.10-main.f10d888` and a future 0.0.10, and still rejects npm's 0.0.9.
- **Node 22.** `engines.node` is `>=22` (was `>=24`). The tests and the consumer smoke test pass on Node 22.
  Running the repository's own TypeScript tests needs Node 22.18 or later (type stripping on by default).
- **CI** (`.github/workflows/ci.yml`): tests and type check on Linux, Windows and macOS × Node 22 and 24; the
  headless parity sweep on Linux (headed, under xvfb) and Windows, with HEADLESS_RESULTS.md uploaded as
  `headless-results-<os>` and a headless-mismatch recorded rather than failing the run; the consumer smoke test
  against freshly packed tarballs on Linux × Node 22 and 24.
- **Headless: variable fonts away from the default instance.** HarfBuzz rounds a variable font's HVAR advance
  delta to whole font units; Chrome on macOS keeps the fraction. The stand-in now computes the unrounded advance
  (fvar, avar, hmtx, HVAR; the normalized coordinate as CoreText computes it) and hands it to HarfBuzz, and sums a
  run's advances in 1/65536 px as Blink does. Inter Variable at wght 300-800 measured up to 0.055px off before, with
  11 line-count mismatches in the parity sweep; now max 0.000092px and none. Default instances and static fonts
  measure as before.
- **Headless: a family split across files by unicode-range** (`registerFont(family, data, { unicodeRange })`, the
  `@font-face` descriptor's syntax), as Fontsource ships its families: files may share a family, weight and style when
  each has a range (overlaps resolve to the last registered, as in CSS) or their cmaps are disjoint.
- **`verify:headless`** runs off macOS (the results file names the OS it ran on) and takes `--headless` for
  machines with no display (Playwright's headless Chromium, named as such in the results file).

## 0.1.0 (2026-10-06)

First release (GitHub tag only; not on npm).

- Helpers on Pretext's prepared handles: `shrinkwrap`, `balance` and their rich forms, `clamp`, `clampStats`,
  `measureTail`, `prepareLabel` and `truncateMiddle`, `prepareSizes` and `fitFontSize`, `prepareSizesRich` and
  `fitFontSizeRich`, `fontFromStyle`, `watchFonts`, and the virtual-list pieces `stack`, `findIndexAt` and
  `anchorDelta`.
- `pretext-kit/headless`: an `OffscreenCanvas` stand-in backed by HarfBuzz and registered font files, so Pretext and
  the helpers run in Node, vitest and jest (jsdom too).
- Verified against Chromium, WebKit and Firefox on macOS 14 (verify/RESULTS.md) and, for the headless entry, against
  Chromium on macOS (verify/HEADLESS_RESULTS.md); EVALUATION.md states the claims, bounds, threats and limits.
- Built against Pretext `main` at f10d888; Node `>=24`.

# Changelog

## 0.1.2 (2026-10-06)

Headless variable fonts and split families; the browser-side helpers are unchanged.

Release assets (SHA-256 of the tarballs packed with Node 24.4.1 and npm 11.4.2; reproducible as described under 0.1.1 and in verify/RELEASING.md):

- `chenglou-pretext-0.0.10-main.f10d888.tgz`: `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`
- `pretext-kit-0.1.2.tgz`: `2721613d752a5b0a8af75e0be1fa0cba470288a4534a4776ca126cbcc39cff78`
- `pretext-kit-0.1.2.sbom.cdx.json`: no fixed sum, because the SBOM records a timestamp and a random serial number.

- **Headless: variable fonts away from the default instance.** HarfBuzz rounds a variable font's HVAR advance
  delta to whole font units; Chrome on macOS keeps the fraction. The stand-in now computes the unrounded advance
  (fvar, avar, hmtx, HVAR; the normalized coordinate as CoreText computes it) and hands it to HarfBuzz, and sums a
  run's advances in 1/65536 px as Blink does. In the headless parity sweep on macOS (Chromium 149), Inter Variable at
  wght 300-800 measured up to 0.055px off before (232 of 2,352 widths beyond 0.02px), with 11 line-count mismatches
  in 69,408; now max 0.000092px, 0 beyond 0.02px, and 0 mismatches (verify/HEADLESS_RESULTS.md). Default instances
  and static fonts measure as before.
- **Limits of the fix.** Verified against Chromium for Inter Variable's `wght` axis only, on macOS only (CI's Linux
  and Windows parity numbers are from 0.1.1's sweep, without the variable font). Beyond that, the unrounded advance is
  exact against fontTools 4.62.1 for what `npm run verify:hvar` covers: Inter Variable's latin `wght`, `opsz`+`wght`
  and standard files, 326 instances (50 distinct `wght` values in the `wght` file), 168,868 glyph × instance pairs; nothing committed covers `wdth`. A font with avar
  version 2, or without HVAR, keeps HarfBuzz's whole-unit advances: away from the default instance each glyph can be
  up to ½ font unit off Chrome on macOS.
- **Malformed HVAR falls back.** An HVAR table that fails its structural checks is ignored and the font keeps
  HarfBuzz's whole-unit advances, as above; it never makes `registerFont` or `measureText` throw.
- **Headless: a family split across files by unicode-range** (`registerFont(family, data, { unicodeRange })`, the
  `@font-face` descriptor's syntax), as Fontsource ships its families: files may share a family, weight and style when
  each has a range (overlaps resolve to the last registered, as in CSS) or their cmaps are disjoint (where only one
  has a range, within that range). The same file registered twice with the same range is an error, as before. An
  invalid `unicodeRange` throws a `RangeError`; an end past U+10FFFF is clamped to it, as in CSS.
- **`verify:hvar`** (verify/hvar-fonttools.py, verify/hvar-fonttools.ts): the HVAR advances against fontTools 4.62.1
  (`pip install fonttools==4.62.1 brotli`), on the Inter Variable files from the `@fontsource-variable/inter` 5.3.0
  devDependency, plus any font paths given on the command line.
- **Parity sweep** plants a fourth mutant, "round variable-font advances" (0.1.2's fix undone): caught, 232 widths
  beyond 0.02px and 11 line-count headless-mismatches, the pre-fix numbers.
- **Parity sweep** now includes Inter Variable at 300-800: 7,344 widths (6,126 bit-exact, max 0.000427px) and
  141,226 line counts, 0 headless-mismatch (verify/HEADLESS_RESULTS.md). `node verify/stats.ts` counts a variable file
  once in its clustered units (instances share the file, HVAR store and code path): 310 string × face units, Wilson
  upper 1.22%; 346 text × font units, 1.10%. `npm test`: 190 tests (90 + 100).

## 0.1.1 (2026-10-06)

Packaging and platform coverage; no change to the helpers' behaviour.

Release assets (SHA-256 of the tarballs packed with Node 24.4.1 and npm 11.4.2). `npm run pack:release` rebuilds them
with contents identical file for file on any machine, and with identical compressed bytes (and so sums) when the
same Node and npm versions pack them; gzip output differs across Node/zlib versions. See verify/RELEASING.md.

- `chenglou-pretext-0.0.10-main.f10d888.tgz`: `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`
- `pretext-kit-0.1.1.tgz`: `e3c85d131d683083f11dc5232b354903a9f10d53aa58e340c2703b9cd2312b45`
- `pretext-kit-0.1.1.sbom.cdx.json`: no fixed sum, because the SBOM records a timestamp and a random serial number.

- **Release tarballs.** Each GitHub release carries `pretext-kit-0.1.1.tgz` and
  `chenglou-pretext-0.0.10-main.f10d888.tgz`, installable by URL with `npm install` (README, Install). The Pretext
  tarball is an unofficial, labelled snapshot of chenglou/pretext `main` at f10d888, built with Pretext's pinned
  TypeScript, not a release by Pretext's authors. `verify/pack-release.sh` (`npm run pack:release`) builds both into
  `dist-release/`; `verify/consumer-smoke.mjs` installs them into a fresh project and runs the kit there through
  `pretext-kit/headless`.
- **`prepack` builds `dist`**, so `npm pack` always ships a fresh build. `build` clears `dist` with Node instead of
  `rm -rf`, so it also runs on Windows. The package also ships THIRD_PARTY_NOTICES.md.
- **Peer range** `@chenglou/pretext` `>=0.0.10-0 <0.0.11` (was `>=0.0.10 <0.0.11`): admits the snapshot
  `0.0.10-main.f10d888` and a future 0.0.10, and still rejects npm's 0.0.9.
- **Node 22.** `engines.node` is `>=22` (was `>=24`). The tests and the consumer smoke test pass on Node 22.
  Running the repository's own TypeScript tests needs Node 22.18 or later (type stripping on by default).
- **CI** (`.github/workflows/ci.yml`, on pushes to main and `v*` tags and on pull requests): tests and type check on Linux, Windows and macOS × Node 22 and 24; the
  headless parity sweep on Linux (headed, under xvfb) and Windows, with HEADLESS_RESULTS.md uploaded as
  `headless-results-<os>` and a headless-mismatch recorded rather than failing the run; the consumer smoke test
  against freshly packed tarballs on Linux × Node 22 and 24.
- **Licences and SBOM.** THIRD_PARTY_NOTICES.md lists what ships, what is needed at runtime and the test-only
  fonts (not shipped). `verify/pack-release.sh` also writes `pretext-kit-0.1.1.sbom.cdx.json`, a CycloneDX 1.5 SBOM
  of the packed package's runtime tree (`npm sbom --sbom-format cyclonedx --omit dev`).
- **Headless parity on Linux and Windows**, measured by CI run https://github.com/Z003Y89/pretext-kit/actions/runs/37407438278 with Chromium 149: Linux 3,720/4,992
  widths bit-exact, max 0.001862px, 0 headless-mismatch in 71,818 line counts; Windows 3,842/4,992, max 0.000427px,
  0 headless-mismatch. No whole-px rounding needed on either. An earlier independent Linux run on Chromium 141 gave
  the same tallies (EVALUATION §3).
- **Variable fonts: known limitation, not fixed.** A headless sweep of Inter Variable found only the default
  instance within the 0.02px bar (non-default instances up to 0.055px off, 11 line-count mismatches): the stand-in
  rounds interpolated advances to whole font units. Documented in README and EVALUATION §8; the sweep is held on the
  branch `v0.1.1-variable-font`; the fix is landing in 0.1.2.
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

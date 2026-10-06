# Changelog

## 0.1.1 (unreleased)

Packaging and platform coverage; no change to the helpers' behaviour.

Release assets (SHA-256; both tarballs rebuild byte for byte with `npm run pack:release`, see verify/RELEASING.md):

- `chenglou-pretext-0.0.10-main.f10d888.tgz`: `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`
- `pretext-kit-0.1.1.tgz`: `c0830cd21f08ecb3e8649739b86cf84dad3439084fed6886cb5c0f42e15e8824`
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
- **Linux headless parity, independently reported**: one run on Chromium 141 under Xvfb (not the pinned 149; raw
  data not in the repository) agreed with macOS (EVALUATION §3).
- **Variable fonts: known limitation, not fixed.** A headless sweep of Inter Variable found only the default
  instance within the 0.02px bar (non-default instances up to 0.055px off, 11 line-count mismatches): the stand-in
  rounds interpolated advances to whole font units. Documented in README and EVALUATION §8; the sweep is held on the
  branch `v0.1.1-variable-font`.
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

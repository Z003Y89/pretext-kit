# Changelog

## 0.2.0 — 2026-10-06

The label checker, and fractional-size models for the headless Linux and Windows profiles.

Release assets: to be recorded after the maintainer's pack (RELEASING.md step 3): the SHA-256 of `chenglou-pretext-0.0.10-main.f10d888.tgz` and `pretext-kit-0.2.0.tgz`, with the Node and npm versions that packed them. `pretext-kit-0.2.0.sbom.cdx.json` has no fixed sum, because the SBOM records a timestamp and a random serial number.

macOS: pending maintainer run (release gate rows 2 and 6).

- **`pretext-kit/check` and `pretext-kit/check/browser`.** `checkLabels` checks every UI label against the slot it is
  shown in, per language, text scale, zoom and platform, with each slot's own policy (as-is, `shrinkTo`, `lines`,
  `truncate`), rows with collapse stages, and a stable, diffable report (failures, warnings, notes, unchecked keys);
  `slotFromStyle` builds slots from computed styles and `conditionGrid` builds condition products. The Node entry runs
  on `pretext-kit/headless` (macOS, Windows and Linux profiles); the browser entry uses the page's own fonts and
  cannot check tabular digits (`unverifiable`). Oracle sweep on Linux, Chromium 141.0.7390.37: 473,736 cases (375,564
  verdict cases and 98,172 near-miss cases), 0 check-mismatch, 10,255 pretext-gap (7,292 and 2,963), 8 of 8 planted bugs
  caught (verify/CHECK_RESULTS.md); the same tallies on Linux in CI with Chromium 149 (run https://github.com/Z003Y89/pretext-kit/actions/runs/37493529824); on Windows in CI (Chromium
  149.0.7827.55, run https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670) 0 check-mismatch, 12,424
  pretext-gap, 8 of 8 caught. Not yet run on macOS.
  `pretext-kit/check` and the CLI need the optional peer `harfbuzzjs` (and `wawoff2` for WOFF2 fonts); the root entry and
  `pretext-kit/check/browser` do not. Placeholders are `{name}` and `{{name}}`. README "Label checker" lists the limits,
  among them one call at a time (a call wipes fonts registered through `pretext-kit/headless`) and the gap at a box
  exactly at the measured width (mostly, not only, soft-hyphenated text).
- **`overflowWrap` on a slot** (`'break-word'`, the default, or `'normal'`; overridable per condition). Under `'normal'`
  a word (the text between two break opportunities; one ending at a soft hyphen with the hyphen it paints) whose natural
  width is past the box by more than 1/64 px is the failure `overflow` under `lines`, with `missing.px` and the word in `detail`, and makes `truncate: 'end'`
  `truncated`, as Chromium cuts it with an ellipsis on its line of the clamp. `slotFromStyle` reads `overflow-wrap` and
  `word-break` from the computed style, so a slot it builds from plain CSS is `'normal'`, while a hand-written slot defaults to
  `'break-word'`.
- **`nearMiss` margin** (px, off by default; `--near-miss <px>` on the command line, a plain decimal). A label or row that passes with
  less slack than the margin is the warning `near-miss` (so `--strict` fails on it), with `missing.px` the slack to
  spare: the box less the natural width (as-is, truncate middle), the width at the fitted size (shrinkTo), the widest
  line and, under `overflowWrap: 'normal'`, the widest word (lines, truncate end when not cut), or the row's total at
  the stage it fits at. A pass only within the fit tolerance (Pretext's 0.005 px on one line; 1/64 px for `overflowWrap` words and rows) has 0px to spare; a label checked with a missing sample gets none. Off, reports are unchanged. Asked
  for by CueFlow ('Buchungen' fitting with 0.1px to spare).
- **`check-labels` command** (`bin`, `npx pretext-kit check-labels [--config] [--json] [--strict] [--platform] [--near-miss] [--help]`):
  exit 0, 1 on failures (or warnings with `--strict`), 2 on a usage or config error, including unusable `labels`, a
  missing harfbuzzjs and a run where no key matched a slot or row; label files by its own minimal glob.
- **Headless: `featureSettings` on `registerFont`**, the `@font-face` descriptor (`"tnum" 1`), so tabular digits can be
  measured; the checker uses it for slots with `numeric: 'tabular'`.
- **Headless: the `'linux'` profile models Chromium on Linux's fractional font sizes** (the size in float32 hundredths,
  advances at it truncated to 1/64 px; `src/headless/canvas.ts`, `test/headless/fractional-size.test.ts`). Derived and
  measured on Chromium 141, exact for the first use of a size in a page; Chromium's reuse of glyph metrics between
  nearby fractional sizes later in a page is not modelled. Confirmed with Chromium 149 in CI (run https://github.com/Z003Y89/pretext-kit/actions/runs/37500166670, `ubuntu-latest`: 1,464 of 1,464 widths exact).
- **Headless: the `'windows'` profile models Chromium on Windows's fractional font sizes** (the size in float32
  hundredths, as on Linux, by which HarfBuzz scales kerning; each glyph advance its font units times float32(size /
  upem), multiplied in float32 and truncated to 1/65536 px; `src/headless/canvas.ts`,
  `test/headless/fractional-size-windows.test.ts` with a fixture of recorded Windows widths). Fitted to `verify:fractional`
  on `windows-latest`, Chromium 149.0.7827.55: 1,464 of 1,464 widths exact (488 sizes × 3 strings; 411 before), static
  Inter (upem 2048), first use of a size in a page. The kerning part rests on one string; the advance formula is pinned
  only for power-of-two upem; whole sizes keep HarfBuzz's rounding, byte-identical to 0.1.2; variable fonts at
  fractional sizes and in-page metric reuse on Windows are unmeasured. It took the first Windows `verify:check` run's 472
  check-mismatches (fractional text-scale sizes, widths within a few thousandths of a px of the box) to 0.
  `'macos'` is unchanged and still measures at the size asked for (no macOS data).
- **`verify:fractional`** (verify/fractional-probe.ts): canvas `measureText` of three strings in Inter Regular at 488
  sizes (fractional and whole), each size in a fresh browser context, against the stand-in's three profiles, as JSON
  lines and per-profile exact-match counts; a diagnostic that exits 0. CI runs it in the `parity` job on Linux and
  Windows and uploads its log and `fractional.jsonl`.
- **`verify:check` prints diagnostics to its log:** on check-mismatches, counts by policy, condition kind and platform
  and up to 60 examples spread across groups (checker, reference and DOM measurements); the pretext-gap groups as a
  table. CHECK_RESULTS.md is unchanged by it.
- **`verify:check`** (verify/check-labels.ts) in CI on Linux and Windows, uploading CHECK_RESULTS.md as
  `check-results-<os>` without failing the build on a check-mismatch, as for the parity sweep.

## 0.1.2 (2026-10-06)

Headless variable fonts and split families; the browser-side helpers are unchanged.

Release assets (SHA-256 of the tarballs packed with Node 24.4.1 and npm 11.4.2; reproducible as described under 0.1.1 and in verify/RELEASING.md):

- `chenglou-pretext-0.0.10-main.f10d888.tgz`: `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`
- `pretext-kit-0.1.2.tgz`: `a97145e3812abd095e66770bc3e09de64355e9c38161c0b14da5452c0cc70330`
- `pretext-kit-0.1.2.sbom.cdx.json`: no fixed sum, because the SBOM records a timestamp and a random serial number.

- **Headless: variable fonts away from the default instance.** HarfBuzz rounds a variable font's HVAR advance
  delta to whole font units; Chrome on macOS keeps the fraction. The stand-in now computes the unrounded advance
  (fvar, avar, hmtx, HVAR; the normalized coordinate as CoreText computes it) and hands it to HarfBuzz, and sums a
  run's advances in 1/65536 px as Blink does. In the headless parity sweep on macOS (Chromium 149), Inter Variable at
  wght 300-800 measured up to 0.055px off before (232 of 2,352 widths beyond 0.02px), with 11 line-count mismatches
  in 69,408; now max 0.000092px, 0 beyond 0.02px, and 0 mismatches (verify/HEADLESS_RESULTS.md). Default instances
  and static fonts measure as before.
- **Headless: `install({ platform: 'macos' | 'windows' | 'linux' })`, default `'macos'`.** Chromium 149 on Linux and
  Windows rounds a variable font's HVAR advance delta to whole font units, as HarfBuzz does; macOS keeps the
  fraction. CI run 37410732972 measured it: with the unrounded advances the stand-in was off on both by exactly the
  pre-fix macOS numbers (232 widths beyond 0.02px, max 0.055115px, 11 line-count headless-mismatches; the default
  instance exact), i.e. Chromium there equals HarfBuzz's rounding. `'macos'` keeps the unrounded advances above;
  `'windows'` and `'linux'` shape with HarfBuzz's own. The default is fixed, not `process.platform`, so tests give the
  same widths on any machine. Static fonts and default instances measure the same under all three; the option is
  independent of `rounding`; a value outside the three throws a `RangeError`; like the other options, a later
  `install()` sets it again. `verify:headless` installs the platform of the OS it runs on and prints it in
  HEADLESS_RESULTS.md. Confirmed by CI run https://github.com/Z003Y89/pretext-kit/actions/runs/37412616029: with the option, Inter Variable is bit-exact on Linux and Windows (2,352/2,352 widths, 0 line-count headless-mismatches of 69,408), and the planted "unround variable-font advances" mutant is caught there (232 widths beyond 0.02px, 11 headless-mismatches).
- **Limits of the fix.** Unrounded advances verified against Chromium for Inter Variable's `wght` axis only, on macOS
  only; Linux and Windows measured equal to HarfBuzz's rounding by CI run 37410732972. Beyond that, the unrounded advance is
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
  beyond 0.02px and 11 line-count headless-mismatches, the pre-fix numbers. On Linux and Windows, where the stand-in
  rounds, the mutant is its inverse, "unround variable-font advances" (`platform: 'macos'`'s advances forced).
- **Parity sweep** now includes Inter Variable at 300-800: 7,344 widths (6,126 bit-exact, max 0.000427px) and
  141,226 line counts, 0 headless-mismatch (verify/HEADLESS_RESULTS.md). `node verify/stats.ts` counts a variable file
  once in its clustered units (instances share the file, HVAR store and code path): 310 string × face units, Wilson
  upper 1.22%; 346 text × font units, 1.10%. `npm test`: 194 tests (90 + 104).

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

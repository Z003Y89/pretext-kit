# pretext-kit/check (label checker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `checkLabels()` and `npx pretext-kit check-labels`: every UI label checked against its slot's policy in
every locale, condition and Chrome platform, with a stable report of what fails and what would make it fit.

**Architecture:** Pure label/slot normalisation (`labels.ts`, `conditions.ts`), a per-label evaluator over the kit's
existing helpers (`evaluate.ts`), row collapse stages (`rows.ts`), and a runner (`run.ts`) that loops platforms and
assembles the report. Two entries: `pretext-kit/check` (Node, through `pretext-kit/headless`) and
`pretext-kit/check/browser` (the page's own canvas and fonts). A CLI (`cli.ts`) loads a config module.

**Tech Stack:** TypeScript 6 (type stripping), Node ≥ 22, `@chenglou/pretext` f10d888, harfbuzzjs 1.6.2 (headless),
Playwright 1.61.0 (verify only), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-06-label-checker-design.md` (read it first; it is the authority).
Evaluation rules: `PROTOCOL.md`.

## Global Constraints

- `engines.node` stays `>=22`; no new runtime dependencies (globbing uses `fs.promises.glob` from `node:fs`).
- `harfbuzzjs`/`wawoff2` are imported only under `src/headless/`; `src/check/browser.ts` must not import
  `src/headless/` (directly or through another module). `src/index.ts` does not import `src/check/`.
- Plain functions and fixed-shape objects; match the surrounding style (no semicolons, `type` aliases, comments only
  where the code can't say it).
- A misconfigured input (unknown slot name, box ≤ 0, `truncate: 'middle'` with `lines > 1`, non-positive scale or
  zoom) throws `RangeError` naming the slot/row/condition; a label that can't be checked becomes an Issue, never a
  throw.
- Numbers in the report are rounded to 1/64 px (`Math.round(x * 64) / 64`); font sizes to 1/64 px too.
- Default condition `{ name: 'default' }` (textScale 1, zoom 1, viewport 1440); default platforms
  `['macos', 'windows', 'linux']`; in the browser entry the single platform is `'browser'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test fonts: `test/fonts/Inter-Regular.ttf` (static), `node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2` (variable).

## Review Focus

1. **A label with a character no registered font covers** (an emoji in "Fertig ✅"): an `uncovered` failure naming
   the code point, not a thrown `HeadlessCoverageError`. → Task 3 test `uncovered character is an issue`.
2. **Empty or whitespace-only label text** (`''`, `'  '`): passes every policy, `measured.width` 0, no throw.
   → Task 3 test `empty label passes`.
3. **A key matched by two `uses` patterns** (`'toolbar.*'` and `'*.save'`): checked in both slots, each verdict
   reported under its slot. → Task 2 test `key in two slots`.
4. **Slot width not larger than its reserve** (`width: 20, reserve: 24`): `RangeError` naming the slot and the
   condition where it happens (a viewport function can make it so only at 1024px). → Task 3 test `box ≤ 0 throws`.
5. **Locale-sensitive casing under `textTransform: 'uppercase'`** (de `'Straße'` → `'STRASSE'`, tr `'iptal'` →
   `'İPTAL'`): measured text uses `toLocaleUpperCase(locale)`. → Task 2 test `uppercase uses the locale`.

---

### Task 1: Font feature settings in headless

**Files:** Modify `src/headless/fonts.ts` (`FaceOptions`, `FontFace`), `src/headless/canvas.ts` (shaping features);
Test `test/headless/features.test.ts`.

**Interfaces:**
- Produces: `FaceOptions.featureSettings?: string` — the CSS `@font-face` `font-feature-settings` descriptor
  (`'"tnum" 1, "ss01"'`; a bare tag means 1; `'normal'` means none). Parsed into `FontFace.features: { tag: string,
  value: number }[]`; invalid syntax throws `RangeError`. Canvas appends them to the run's features after its own
  (`kern`/`liga` switches), as Blink applies @font-face features beneath the context's.
- Registering the same file twice under different families with different `featureSettings` is allowed (different
  family), which is how Task 5 makes tabular aliases.

- [ ] **Step 1: Tests** (Inter Regular, 16px, headless installed):
  - `measureText('1111').width` with family `'Inter TNUM'` registered with `featureSettings: '"tnum" 1'` equals
    `measureText('0000').width` in that family, and differs from `'1111'` in plain `'Inter'`.
  - `'"tnum"'` (bare) behaves as `'"tnum" 1'`; `'normal'` measures like no option.
  - `featureSettings: 'tnum'` (unquoted) throws `RangeError`.
- [ ] **Step 2:** Run `node --test test/headless/features.test.ts`; expect failures.
- [ ] **Step 3:** Implement `parseFeatureSettings(value: string): { tag: string, value: number }[]` in `fonts.ts`
  (exported for tests only through the module, not from `src/headless/index.ts`) and apply in `canvas.ts`.
- [ ] **Step 4:** `npm test && npm run check`; pass.
- [ ] **Step 5:** Commit `feat(headless): @font-face font-feature-settings on registerFont`.

### Task 2: Types, label sources and text preparation

**Files:** Create `src/check/types.ts`, `src/check/labels.ts`; Test `test/check/labels.test.ts`.

**Interfaces:**
- Produces in `types.ts`: exactly the spec's `CheckInput`, `LabelSource`, `Label`, `Slot`, `Condition`, `Row`,
  `RowItem`, `Report`, `Issue` (with `platforms: CheckPlatform[]`, `CheckPlatform = Platform | 'browser'`,
  `Platform = 'macos' | 'windows' | 'linux'`), plus `FontSource = { family: string, data?: Uint8Array, path?: string,
  weight?: number | [number, number], style?: 'normal' | 'italic', unicodeRange?: string, featureSettings?: string }`.
- Produces in `labels.ts`:
  - `normalizeLabels(source: Exclude<LabelSource, Function>, slots: Record<string, Slot>): { labels: Label[],
    unchecked: string[] }` — i18n maps are flattened with `.` (nested objects), each key matched against every
    slot's `uses` patterns (`*` matches any run of characters including `.`), one `Label` per (key, matching slot);
    keys matching none go to `unchecked` (sorted, de-duplicated, as `locale:key`). Arrays pass through; a `Label`
    whose `slot` is not in `slots` throws `RangeError`.
  - `fillSamples(label: Label, samples: CheckInput['samples']): { text: string, issues: Issue['kind'][] }[]` — every
    sample for the key yields one text; `{name}` placeholders with no sample stay as written and add
    `'missing-sample'`; an ICU `{x, plural|select|selectordinal, …}` yields no text and `'unsupported-message'`.
  - `transformText(text: string, transform: Slot['textTransform'], locale: string): string` — `toLocaleUpperCase`
    / `toLocaleLowerCase` with the locale (`'und'` → `undefined`); `capitalize` upper-cases the first grapheme of each
    word (`Intl.Segmenter` words, `isWordLike`).

- [ ] **Step 1: Tests:**
  - nested `{ de: { toolbar: { save: 'Speichern' } } }` with slot `uses: ['toolbar.*']` → one Label `{ key:
    'toolbar.save', locale: 'de', slot }`.
  - `key in two slots`: patterns `'toolbar.*'` and `'*.save'` on two slots → two Labels for `toolbar.save`.
  - unmatched `menu.open` → `unchecked: ['de:menu.open']`.
  - Label array with an unknown slot → `RangeError` mentioning the slot name.
  - samples `{ 'cart.items': [{ count: 9999 }, { count: 1 }] }` on `'{count} Artikel'` → texts `'9999 Artikel'`,
    `'1 Artikel'`; no sample → `'{count} Artikel'` + `'missing-sample'`; `'{n, plural, one {#} other {#}}'` → no
    texts + `'unsupported-message'`.
  - `uppercase uses the locale`: de `'Straße'` → `'STRASSE'`; tr `'iptal'` → `'İPTAL'`; capitalize en `'save all
    changes'` → `'Save All Changes'`.
- [ ] **Step 2:** run, expect failures. **Step 3:** implement. **Step 4:** `npm test && npm run check`.
- [ ] **Step 5:** Commit `feat(check): label sources, samples and text-transform`.

### Task 3: Conditions and per-label evaluation

**Files:** Create `src/check/conditions.ts`, `src/check/evaluate.ts`; Test `test/check/evaluate.test.ts`.

**Interfaces:**
- Consumes: Task 2 types and `transformText`; kit helpers `fitFontSize`, `prepareSizes`, `clamp`, `measureTail`,
  `prepareLabel`, `truncateMiddle` from `src/index.ts`; Pretext `prepareWithSegments`, `measureLineStats`,
  `measureNaturalWidth`.
- Produces in `conditions.ts`:
  - `resolveSlot(name: string, slot: Slot, condition: Condition): ResolvedSlot` where `ResolvedSlot = { name: string,
    box: number, fontAt: (px: number) => string, sizePx: number, letterSpacing: number, lineHeight: number | null,
    whiteSpace: 'normal' | 'pre-wrap', numeric: 'proportional' | 'tabular', textTransform: NonNullable<Slot['textTransform']>,
    policy: Slot['policy'] }`. Rules: apply `condition.slots[name]` overrides first; width = number or
    `width(viewport ?? 1440)`; `textScale` multiplies font size, letterSpacing, lineHeight and reserve; `zoom`
    multiplies all of those and the width; box = width − reserve, `RangeError` if ≤ 0 (message names slot and
    condition). `fontAt(px)` rewrites the size in `slot.font` (the first `<number>px` token; `RangeError` if the font
    has no px size); `shrinkTo` is scaled by textScale × zoom.
  - `conditionGrid(axes: { textScale?: number[], zoom?: number[], viewport?: number[] }): Condition[]` — the product,
    names like `'text 130% · zoom 100% · 1024px'` (omit axes not given).
- Produces in `evaluate.ts`: `evaluateLabel(text: string, slot: ResolvedSlot, locale: string): Verdict` where
  `Verdict = { kind: Issue['kind'] | 'pass', measured: Issue['measured'], missing?: Issue['missing'] }`.
  Policies exactly as the spec's "Per-label evaluation"; `missing.px` for `'as-is'` = natural width − box; for
  `shrinkTo` = width at `shrinkTo` − box and `fitsAtPx` = the largest size ≥ 1px that fits (fitFontSize with min 1);
  for `lines` = the narrowest width (binary search to 1/64 px between box and natural width) giving ≤ n lines, minus
  box. Text is `transformText`-ed first; `setLocale(locale)` before preparing (`'und'` → `setLocale()`).
  `HeadlessCoverageError` → `{ kind: 'uncovered' }` with the code point in `missing` omitted and the message's code
  point kept in a `detail` string field of Verdict (added to `Issue` as `detail?: string`).

- [ ] **Step 1: Tests** (headless, Inter Regular as `'Inter'`; each policy at ±1px of its boundary — compute the
  natural width in the test with `measureNaturalWidth` and set `width` to it and to it − 1):
  - `as-is` passes at natural width, `overflow` with `missing.px` ≈ 1 at natural − 1.
  - `shrinkTo` passes by shrinking (measured.fontPx < sizePx), `below-min-size` when even `shrinkTo` overflows, with
    `fitsAtPx` < `shrinkTo`.
  - `lines: 2` pass and `too-many-lines`.
  - `truncate: 'end'` → `truncated` warning; `truncate: 'middle'` with `lines: 2` → `RangeError` from `resolveSlot`.
  - `reserve` subtracts; `textScale: 1.3` keeps box and grows text (a label passing at 1 fails at 1.3); `zoom: 1.3`
    grows both (the same label passes); viewport function `(vw) => vw / 10` gives box 102.4 at 1024.
  - `uncovered character is an issue`: `'Fertig ✅'` → kind `uncovered`, detail mentions `U+2705`.
  - `empty label passes`: `''` and `'  '` pass every policy, width 0.
  - `box ≤ 0 throws`: `{ width: 20, reserve: 24 }` → `RangeError` mentioning the slot and condition names.
  - `conditionGrid({ textScale: [1, 1.3], viewport: [1024, 1440] })` → 4 conditions with distinct names.
- [ ] **Step 2–4:** run (fail), implement, `npm test && npm run check`.
- [ ] **Step 5:** Commit `feat(check): conditions and per-label policies`.

### Task 4: Rows and collapse stages

**Files:** Create `src/check/rows.ts`; Test `test/check/rows.test.ts`.

**Interfaces:**
- Consumes: `resolveSlot`, `evaluateLabel`'s measuring (export a helper `naturalWidth(text, slot: ResolvedSlot,
  locale): number` from `evaluate.ts` for this).
- Produces: `evaluateRow(row: Row, rowName: string, texts: Map<string, string>, slots: Record<string, Slot>,
  condition: Condition, locale: string): { kind: 'pass' | 'row-collapsed' | 'row-overflow', stage: number, width:
  number, box: number }`. Item width = natural width of its text in its slot + the slot's reserve (scaled); gaps
  between items; row box = row width (viewport/zoom applied like slots; `textScale` does not change the row box or
  gaps, `zoom` does). Steps: items with `collapse` sorted by `order` (ties by item index); each contributes a
  `shortKey` step (if given) then an icon step (width = `iconWidth`, scaled like reserve). Stage k = first k steps
  applied. Result `pass` at stage 0, `row-collapsed` at the first k > 0 that fits, `row-overflow` (stage = last) if
  none does. A missing text for an item key in the locale → that item is skipped and noted by the caller as
  `unchecked`.

- [ ] **Step 1: Tests:** a five-item row that fits → `pass` stage 0; narrowed by 30px → `row-collapsed` at the stage
  whose collapsed item frees ≥ 30px; `shortKey` is tried before the icon; too narrow even with every icon →
  `row-overflow`; `textScale: 1.3` collapses earlier than 1, `zoom: 1.3` does not.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(check): rows with collapse stages`.

### Task 5: Runner, report and entries

**Files:** Create `src/check/run.ts`, `src/check/index.ts` (Node entry), `src/check/browser.ts` (browser entry),
`src/check/style.ts`; Modify `package.json` (`exports` `./check`, `./check/browser`), `tsconfig.build.json` if it
lists entries; Test `test/check/run.test.ts`, `test/check/style.test.ts`, `test/check/browser-entry.test.ts`.

**Interfaces:**
- `run.ts`: `runCheck(input: CheckInput, env: { platforms: CheckPlatform[], select: (p: CheckPlatform) => void,
  tabularFamily: (family: string) => string | null }): Promise<Report>` — resolves `labels`/`slots` functions,
  loops conditions × platforms × labels × sample texts, calls `env.select(platform)` before each platform's pass
  (Node: `install({ platform })` then Pretext `clearCache()`), rewrites the font family for `numeric: 'tabular'`
  slots through `env.tabularFamily` (null → the issue `unverifiable`, not evaluated, not counted). Merges issues
  that differ only in platform; sorts failures/warnings/notes by (slot or row, condition, locale, key, platform
  order macos/windows/linux/browser); rounds numbers; `checked` counts evaluated verdicts. Failures: overflow,
  too-many-lines, below-min-size, row-overflow, uncovered. Warnings: truncated, missing-sample,
  unsupported-message, unverifiable. Notes: row-collapsed.
- `index.ts` (Node): `checkLabels(input: CheckInput): Promise<Report>` — reads `fonts[].path` when `data` is absent,
  registers each font with `registerFont`, and for every family used by a tabular slot registers the same data
  again as `${family} __tnum` with `featureSettings: '"tnum" 1'`; installs headless with the first platform; calls
  `runCheck`. Re-exports `slotFromStyle`, `conditionGrid`, the types.
- `browser.ts`: the same `checkLabels` signature; `fonts` must be absent (`RangeError` otherwise: "the browser entry
  uses the page's fonts"); platforms `['browser']`; `tabularFamily` returns null; re-exports `slotFromStyle`,
  `conditionGrid`, types. Must not import `src/headless/`.
- `style.ts`: `slotFromStyle(style: StyleInput & Pick<CSSStyleDeclaration, 'fontVariantNumeric' | 'textTransform' |
  'whiteSpace'>, rect: { width: number }, policy: Slot['policy'], extra?: { reserve?: number, uses?: string[] }): Slot`
  via `fontFromStyle`; `fontVariantNumeric` containing `tabular-nums` → `'tabular'`; `whiteSpace` `pre-wrap` kept,
  everything else `'normal'`; `lineHeight` from `fontFromStyle`.

- [ ] **Step 1: Tests:**
  - `run.test.ts`: two locales × two conditions × three platforms with Inter Regular: a static font gives each issue
    once with `platforms: ['macos','windows','linux']`; with the variable Inter registered at weight 500 a label at
    its macOS/Linux boundary gives per-platform issues (pick the label in the test by measuring both platforms);
    report order is stable (run twice, `assert.deepEqual` of `JSON.stringify`); a tabular slot measures `'1111'`
    and `'0000'` equally; `checked` excludes `unverifiable`.
  - `style.test.ts`: a fixture style object → expected Slot, including `textTransform: 'uppercase'`, `'tabular'` and
    `letterSpacing`.
  - `browser-entry.test.ts`: the static import graph of `src/check/browser.ts` (walk imports with a regex over
    files) contains no file under `src/headless/` and no `harfbuzzjs`; calling it with `fonts` throws `RangeError`;
    in Node with the headless canvas installed by the test, a tabular slot yields `unverifiable`.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(check): runner, report, Node and browser entries`.

### Task 6: CLI

**Files:** Create `src/check/cli.ts`, `bin/pretext-kit.mjs` (a two-line shim importing `../dist/check/cli.js`),
`test/check/cli.test.ts`, `test/check/fixtures/` (config, two locale JSON files, golden `report.txt` and
`report.json`); Modify `package.json` (`bin: { "pretext-kit": "bin/pretext-kit.mjs" }`, `files` += `bin`).

**Interfaces:**
- `main(argv: string[], io: { stdout: (s: string) => void, stderr: (s: string) => void, cwd: string }):
  Promise<number>` (exit code). Command `check-labels`; flags `--config <path>` (default `labels.config.mjs` in
  cwd), `--json`, `--strict`, `--platform a,b`. The config default-exports a `CheckInput` where `labels` may also be
  `{ files: string, locale?: (path: string) => string }` (glob relative to the config file; default locale = file
  basename without `.json`) and `fonts[].path` is relative to the config file.
- Text output: failures, then warnings, then notes; grouped under `slot · condition` headings; one line per issue:
  `  <locale> <key>  "<text>"  <kind>: <what's missing>  [platforms if not all]`; a final summary line
  `N checked, F failures, W warnings`. Exit 1 if F > 0 or (`--strict` and W > 0), 2 on a config error (message on
  stderr), else 0.

- [ ] **Step 1: Tests:** fixture run → stdout equals `report.txt`, `--json` equals `report.json` (both committed;
  regenerate only deliberately); exit codes 0/1/2 including `--strict`; unknown command → 2 with usage.
- [ ] **Step 2–4.** Then `npm run build && node bin/pretext-kit.mjs check-labels --config test/check/fixtures/labels.config.mjs`
  prints the golden text.
- [ ] **Step 5:** Commit `feat(check): check-labels CLI`.

### Task 7: Oracle sweep against Chromium and mutants

**Files:** Create `verify/check-labels.ts`, `verify/check-labels-cases.ts`, `verify/CHECK_RESULTS.md` (generated);
Modify `package.json` (script `verify:check`), `.github/workflows/ci.yml` (run `verify:check` beside
`verify:headless` on Linux and Windows, upload `check-results-<os>`, recorded not failing — as the headless step).

**Interfaces:**
- Cases: the German, French and Latin corpora's short lines (≤ 40 characters) from `verify/corpora.ts` plus 60
  hand-written toolbar/tab labels (German compounds, French, uppercase tabs, digits) — about 2,000 texts; each in
  four slots (one per policy) at text scales 1/1.15/1.3 and zoom 1/1.3, widths chosen per text so that each policy
  sits near its boundary (natural width × {0.9, 1.0, 1.1}); one five-item row family with collapse.
- Browser side (Playwright Chromium, headed as verify:headless is, fonts by `@font-face` from the same files):
  render each slot as an element with the slot's CSS (`white-space: nowrap` for as-is/shrinkTo, `-webkit-line-clamp`
  for truncate end, `text-overflow: ellipsis`), text scale as font-size change in a fixed-width box, zoom as CSS
  `zoom` on the container; read `scrollWidth > clientWidth` (overflow), line count from `getClientRects` of a range,
  truncation from the clamp; for `shrinkTo` set the checker's fitted size and check it fits and +1/64 px does not
  (or is the slot size). Rows as a flex line with the checker's chosen stage applied, checking fit, and the previous
  stage checked not to fit.
- Attribution as EVALUATION §2: compare with Pretext-in-Chromium first (`check-mismatch` when the checker disagrees
  with the kit's own helpers in the page), then the DOM (`pretext-gap`). Pass bar: 0 check-mismatch.
- Mutants (copies under `verify/dist/mutants`, as `verify/headless.ts` does): ignore `reserve`; treat `zoom` as
  `textScale`; ignore `textTransform`; `lines` off by one (`<` for `≤`); skip the last collapse stage; tabular
  ignored (alias not used). Each must produce check-mismatches.
- `CHECK_RESULTS.md`: builds, OS, platform, date, case counts, verdict agreement table per policy × condition kind,
  gaps listed by cause, mutant table. Exit 1 on any check-mismatch.

- [ ] **Step 1:** Write the sweep; run `npm run verify:check` on this Mac; 0 check-mismatch; every mutant caught.
- [ ] **Step 2:** Commit `test(check): verdicts against Chromium's DOM, with mutants` with CHECK_RESULTS.md.

### Task 8: Docs and evaluation

**Files:** Modify `README.md` (a "Label checker" section: function, browser entry, CLI, config example from the
fixture, the policies, conditions incl. zoom vs text size, rows, what is unverifiable where, limits), `CHANGELOG.md`
(`## 0.2.0 — unreleased`), `EVALUATION.md` (claim C9 for `pretext-kit/check`, its results from CHECK_RESULTS.md,
clustered bound per PROTOCOL §4 with one unit per label text, threats, reproduction), `PROTOCOL.md` §8 (gate row: if
`src/check/` changed, `verify:check` 0 check-mismatch and every check mutant caught), `verify/reproduce.sh` (run
`verify:check`), `package.json` version stays 0.1.2 until release.

- [ ] **Step 1:** Write; every number cites CHECK_RESULTS.md; `node verify/stats.ts` extended for the check sweep
  if its bound is quoted.
- [ ] **Step 2:** `npm test && npm run check && npm run build`; commit `docs: label checker`.

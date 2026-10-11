# pretext-kit: handover for adopting it in an app

Written for the person or agent who wires pretext-kit into an application. It is a map, not a second manual: the
[README](README.md) is the reference (API, policies, report), [EVALUATION.md](EVALUATION.md) holds the evidence, this file
says what to take, in which order, and what not to trust. Status as of **v0.2.1, 2026-10-11**.

## 1. What it is

- **Text measurement helpers** built on [Pretext](https://github.com/chenglou/pretext) (`prepare` once, then arithmetic
  per resize): `shrinkwrap`, `balance`, `clamp`, `truncateMiddle`, `fitFontSize` and rich-inline forms. Root entry
  `pretext-kit`; no Node-only dependencies; runs in the browser.
- **A headless stand-in for Canvas** (`pretext-kit/headless`): Pretext in Node with HarfBuzz and your font files, with
  per-platform profiles `'macos' | 'windows' | 'linux'`.
- **A label checker** (`pretext-kit/check`, `pretext-kit/check/browser`, CLI `npx pretext-kit check-labels`): for a whole
  catalogue of UI strings, per language, text scale, zoom and platform, does each label fit the slot it is shown in, under
  that slot's own policy. It is a **test-time / CI check**, not something that ships to users.
- It is not a layout engine, not a CSS parser, and not proof that a label fits on a given device (section 6).

## 2. What to install, and from where

pretext-kit is **not on npm**. A GitHub release carries the files; install by URL or, better, vendor the tarballs.

Release: https://github.com/Z003Y89/pretext-kit/releases/tag/v0.2.1

| file | SHA-256 |
|---|---|
| `chenglou-pretext-0.0.10-main.c6a7bee.tgz` (an unofficial, labelled snapshot of Pretext `main` at c6a7bee; not a release by Pretext's authors) | `c585f7c8e44cecc17b87a662e39e6da9ad50f50164703e30fe3262cb7c1144ab` |
| `pretext-kit-0.2.1.tgz` | `61224e4ed657544a240b45f76e407d61fde3a2abab699d40f1e9e72b0f37ce67` |
| `pretext-kit-0.2.1.sbom.cdx.json` | none (it records a timestamp) |

```sh
# by URL
npm install https://github.com/Z003Y89/pretext-kit/releases/download/v0.2.1/chenglou-pretext-0.0.10-main.c6a7bee.tgz \
            https://github.com/Z003Y89/pretext-kit/releases/download/v0.2.1/pretext-kit-0.2.1.tgz
# optional peers, needed for pretext-kit/headless, pretext-kit/check and the CLI (not for the root entry or check/browser)
npm i -D harfbuzzjs@1.6.2          # add wawoff2@2.0.1 only if you register WOFF2 fonts
```

**Recommended for an app with a lockfile and a review process: vendor the two tarballs** (for example in
`vendor/pretext-kit/`), check their sums against the table above before committing, and reference them as
`file:` dependencies. A URL install depends on GitHub being reachable and the release staying put.

- Node `>=22` (running the repository's own TypeScript tests needs 22.18+; using the package does not).
- `@chenglou/pretext` is a **peer dependency** with the range `>=0.0.10-0 <0.0.11`. The snapshot above satisfies it; npm's
  `@chenglou/pretext@0.0.9` does **not**, and is older than the line breakers the kit is verified against. Your app and the
  kit must share one Pretext (one cache), so the app imports Pretext from the same copy.
- Check the licences of what you add (`THIRD_PARTY_NOTICES.md` lists them: Pretext MIT, harfbuzzjs, wawoff2). pretext-kit
  itself is MIT (`LICENSE`).

## 3. Adoption in order

### Step 1: use the helpers (runtime, optional)
Only if you need to fit/clamp text in the browser. Import from `pretext-kit`, follow README "Helpers" and "Recipes". Fonts
are Canvas font strings; `fontFromStyle(getComputedStyle(el))` builds one from an element, `watchFonts` re-runs when web
fonts load. Layout in the browser does not need harfbuzzjs.

### Step 2: add the label check to CI (the main use)
1. **Inventory slots.** For every place a translated string is shown, record: content box `width` (px at zoom 1), `reserve`
   (icon + gap, scales with text size), `font` (CSS shorthand at scale 1, e.g. `500 15px Inter`), `whiteSpace`,
   `overflowWrap`, `textTransform`, `numeric: 'tabular'` where tabular figures are used, and **the policy the design has**
   for too-long text: `'as-is'`, `{ shrinkTo: 12 }`, `{ lines: 2 }`, `{ truncate: 'end', lines: 1 }` or
   `{ truncate: 'middle' }` (README "Policies"). Bind keys to slots with `uses: ['button.*']`.
2. **Do not hand-copy CSS** if you can avoid it: in a browser test, `slotFromStyle(getComputedStyle(el),
   el.getBoundingClientRect(), policy, { reserve, uses })` builds a slot from the real element. Caution: it returns
   `overflowWrap: 'normal'` unless the CSS says `overflow-wrap: break-word`/`anywhere` or `word-break: break-all|break-word`,
   so a `{ lines: 2 }` slot with a long German compound can then **fail where a hand-written slot passes**. That is the
   browser's behaviour, reproduced, not a bug.
3. **Feed the labels.** `labels` is parsed i18n data: `{ locale: { key: text } }` (nested objects flatten to dotted keys), a
   list `{ key, text, slot, locale? }`, or a function returning one. Placeholders are `{name}` and `{{name}}`; give
   `samples` (`{ 'cart.items': [{ count: 1 }, { count: 12345 }] }`) so the longest realistic value is checked. A placeholder
   without a sample is the warning `missing-sample`. ICU `plural`/`select` messages are **not expanded**: they give
   `unsupported-message` and are not checked, so expand plural forms yourself into separate labels if they matter.
   **Typed dictionaries (`de.ts`, `en.ts`):** the CLI config is a JS module (`labels.config.mjs`) and `labels` must end up
   as plain data; import the dictionaries there (or export them to JSON in a build step) and pass the object. Whether your
   Node version can import `.ts` directly from the `.mjs` is for you to confirm in your app; it was not tested here.
4. **Fonts.** Pass the same font files the app ships (`{ family, path, weight?, style?, featureSettings? }`), one entry per
   weight/style used. A code point the font does not cover is the failure `uncovered`, never a crash.
5. **Conditions.** `conditionGrid({ textScale: [1, 1.15, 1.3], zoom: [1, 1.3], viewport: [1024, 1440] })`. Text scale and
   zoom are different things (README "Conditions"); do not model one as the other.
6. **Platforms.** Default is all three profiles; limit with `platforms` / `--platform`.
7. **Run it.** Either the API (`checkLabels(input)` returns a `Report`) or the CLI:
   ```sh
   npx pretext-kit check-labels --config labels.config.mjs [--json] [--strict] [--platform macos,windows,linux] [--near-miss 0.5]
   ```
   Exit codes: `0` no failures (with `--strict`: no warnings either), `1` failures, `2` usage/config error (including "nothing
   was checked because no key matched a slot or row", harfbuzzjs missing). Wire exit `1` and `2` to a failing CI step.
8. **Turn on `nearMiss`** (px, e.g. `0.5`) once the first run is clean: a label that fits with almost no spare room becomes
   the warning `near-miss` before the next font or translation change breaks it. A pass within the fit tolerance has 0 px
   to spare and is always a near-miss when it is on.
9. **Snapshot the report.** `--json` output is stable (sorted, rounded to 1/64 px, no timestamps or paths); commit it or
   diff it between runs to see what a font or copy change did.
10. **Add a negative test.** Keep one fixture with a deliberately too-small slot so the suite fails if the checker silently
    stops checking (as CueFlow did with its old layout).

### Step 3 (optional): the browser entry
`pretext-kit/check/browser` runs the same check inside Playwright or the app's own browser test runner with the page's own
fonts and canvas (`fonts` must be absent). One platform, `'browser'`. It cannot check tabular figures: such a slot gives
the warning `unverifiable` and is not counted.

## 4. Gotchas

- **One `checkLabels` call at a time (Node).** The font registry and install options are process-global; a call starts
  from an empty registry (fonts registered earlier through `pretext-kit/headless` are wiped). Two concurrent calls with the
  same font files fail with "already registered". Await each call; do not use `Promise.all` over catalogues.
- A **failure** is the browser overflowing; a **warning** (`truncated`, `near-miss`, `missing-sample`, `unsupported-message`,
  `unverifiable`) is information; a **note** (`row-collapsed`) is a row using its designed collapse stage.
- **Rows** (a toolbar) are checked at the first collapse stage that fits; only if none fits is it `row-overflow`.
- The checker reproduces what Pretext + HarfBuzz compute; Pretext itself deviates from Chromium in rare shapes, see below.

## 5. Evidence (what was measured, and where)

Sweep `verify:check`: 473,736 cases (labels × slots × conditions × policies, plus the near-miss family) compared against
real Chromium layout, with 8 planted bugs that the sweep must catch.

| platform (Chromium 149 in CI) | check-mismatch | pretext-gap | planted bugs caught |
|---|---:|---:|---:|
| Linux | 0 | 9,505 | 8 / 8 |
| Windows | 0 | 11,718 | 8 / 8 |
| macOS | 0 | 11,718 | 8 / 8 |

- **check-mismatch** = the checker disagrees with what its own model should say: the bar is **0**.
- **pretext-gap** = real Chromium disagrees with Pretext itself (not the checker). The checker cannot see those; they are
  mostly soft-hyphenated text and boxes exactly at the measured width. Counts are per case, not per label.
- Fractional font sizes (text scales like 115 %) are modelled per platform and matched to Chromium at **488 of 488** sizes
  in a probe with static Inter.
- Runs, per-platform tables and method: EVALUATION.md (C11, "Per platform"), `verify/CHECK_RESULTS.md`, the Actions runs
  linked there.

## 6. What not to trust (limits)

- All platform numbers come from **CI runners**, not from real devices, other OS versions or other browsers' text stacks.
  Safari/Firefox are not covered by the checker; Firefox/WebKit differ from Chromium in places.
- **Variable fonts at fractional sizes on Windows and macOS are unmeasured.** If the app uses a variable font (for example
  `Inter Variable`), run its own comparison before relying on 115 %/130 % verdicts there.
- The kerning part of the Windows/macOS size rule rests on one string; the advance formula is pinned for power-of-two
  units-per-em fonts only.
- Zoom effects beyond the modelled box scaling, system font replacement and user font-size changes outside the text scale
  you list are not modelled. The checker verdict is as good as the slot data you give it.
- Near-miss resolution is about 1/4 px. Pretext's rich-inline `extraWidth` handling differs from Chrome on a line that ends
  inside a padded span (a known, unfixed Pretext gap): `fitFontSizeRich` can report one line too many there.
- The checker is only as current as the Pretext it is pinned to (below).

## 7. Maintenance of the kit itself (for whoever owns it)

- **Pin:** Pretext `main` at `c6a7bee014bf2960ebe5c1a75fc164528f228537` (2026-10-06, the merge of chenglou/pretext#446).
  It is before Pretext's one-paragraph rich-inline rewrite (#460); the drift of that rewrite is listed in
  chenglou/pretext#464. Moving the pin means: rebuild the snapshot, rerun `verify:check`/`verify:fractional`/`verify:headless`
  on Linux, Windows and macOS, update the tables, and release again.
- **Release:** merge to `main`, then run the *Release* workflow (`workflow_dispatch`, input `tag`, for example `v0.2.2`).
  It creates the tag if missing, packs with Node 24.4.1 and npm 11.4.2, smoke-tests on Node 24 and 22, publishes the GitHub
  release with the sums in the notes, downloads the assets, checks their sums and README's install line. The CHANGELOG
  entry (dated heading `## <version> — <date>`) is copied into the release notes. A release is never overwritten.
  A tag cannot be pushed from some sandboxes (the git proxy answers 403): the dispatch is the way around that.
- **Cost:** the `macOS parity` workflow costs about ten times a Linux run. It runs on pull requests that change
  `src/headless/**` or the sweeps' `.ts` files, or by dispatch; documents do not start it.
- **Checks before a push:** `npm test`, `npm run check`, `npm run build`; for headless/checker changes also
  `npm run verify:check` (needs a Chromium; `PW_CHROMIUM=<path>` picks one). Details: `verify/RELEASING.md`, `PROTOCOL.md` §8.
- **Upstream:** issues filed from this work: chenglou/pretext#433 (fixed by #446). Other known Pretext gaps are in
  Pretext's `ENGINE_FOLLOWUPS.md`.

## 8. Quick decision guide

| you want | do |
|---|---|
| to know if translations fit their UI slots, in CI | step 2, CLI, `--strict` once clean, `nearMiss` on |
| a label's longest realistic value (numbers, names) | `samples` |
| the app to fit text at runtime | step 1 helpers |
| to check in the real browser | step 3, accept the tabular-figures gap |
| to check Safari/Firefox | not covered; use real browsers |
| a variable font at 115 %+ on Windows/macOS | measure it yourself first (section 6) |

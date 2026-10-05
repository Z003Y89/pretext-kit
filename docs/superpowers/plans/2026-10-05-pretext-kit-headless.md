# pretext-kit/headless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An `OffscreenCanvas` stand-in backed by HarfBuzz and the app's own font files, so Pretext and pretext-kit
run in Node/vitest/jest/CI with Chrome-equal widths for registered fonts.

**Architecture:** Four small files under `src/headless/` behind the `pretext-kit/headless` entry. A font registry
(parse, decompress), a CSS font-shorthand parser, the Canvas/context stand-in reproducing Blink Canvas behaviour,
and `registerFont`/`install`. Parity is checked by measuring the same strings in Node and in Playwright Chromium.

**Tech Stack:** TypeScript 6, Node 24, harfbuzzjs 1.6.2, wawoff2 2.0.1 (optional peers), Playwright 1.61.0 (verify only).

**Spec:** `docs/superpowers/specs/2026-10-05-pretext-kit-headless-design.md`; evidence: `docs/research/2026-10-05-headless-harfbuzz.md`.

## Global Constraints

- `harfbuzzjs` and `wawoff2` are imported only under `src/headless/`. The main entry (`src/index.ts`) never imports them.
- Plain functions and fixed-shape objects in `src/`. The Canvas/context stand-in may be a class only if Pretext needs `new OffscreenCanvas(w, h)`; say why in a comment.
- Widths: `setScale(round(size × 65536))`; width = Σ xAdvance / 65536, accumulated through `Math.fround`.
- An uncovered code point throws `HeadlessCoverageError` (exported) unless `onMissingGlyph: 'notdef'` is set.
- `install()` sets the desktop Chrome UA `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` before Pretext loads, and throws if `globalThis.OffscreenCanvas` is already a non-headless implementation.
- Test font: Inter (OFL) copied from `../pretext/harness/fonts`, with its OFL licence file next to it in `test/fonts/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A font family with quotes and fallbacks** (`600 16px "Inter Display", Inter, sans-serif`): each character uses the first registered family that covers it; unregistered names are skipped. → H1.
2. **WOFF2 given as raw bytes**: it must be decompressed, never silently shaped as garbage. → H2 test with a WOFF2 Inter that measures equal to the TTF.
3. **Soft hyphens** (`Zahlungs\u00ADpflichtig`): Pretext probes generic `monospace`/`serif` to choose a hyphen glyph, and that probe must never throw. The stand-in steers it to Chrome's choice. → H3 (amended, Ruling H-2).
4. **Letter spacing round trip** (`ctx.letterSpacing = '0.5px'` reads back `'0.5px'`, `parseFloat` equal): Pretext turns spacing support off otherwise. → H3.
5. **jsdom present** (`document.body` exists): emoji measured within size + 0.5 never trigger Pretext's DOM correction; an uncovered emoji throws the coverage error. → H4.

---

### Task H1: Shorthand parser

**Files:** Create `src/headless/shorthand.ts`, `test/headless/shorthand.test.ts`.
**Produces:** `parseFont(font: string): { style: 'normal' | 'italic' | 'oblique', weight: number, stretch: number, sizePx: number, families: string[] }`. Throws `RangeError` on a missing size or family. `pt` is converted ×4/3; `bold` is 700 and `normal` 400; a `/line-height` is ignored; families are unquoted and kept in order.
- [ ] Tests:
  - `'16px Inter'` → `{ style: 'normal', weight: 400, stretch: 100, sizePx: 16, families: ['Inter'] }`
  - `'italic 600 condensed 12pt "Inter Display", Inter, sans-serif'` → italic, 600, 75, 16, `['Inter Display', 'Inter', 'sans-serif']`
  - `'bold 16px/24px Inter'` → weight 700, sizePx 16
  - `'Inter'` throws `RangeError`
- [ ] Implement, `npm test && npm run check`, commit `feat(headless): CSS font shorthand parser`.

### Task H2: Font registry

**Files:** Create `src/headless/fonts.ts`, `test/headless/fonts.test.ts`, `test/fonts/Inter-Regular.ttf`, `test/fonts/Inter-Regular.woff2` (made once with wawoff2's `compress` and committed), `test/fonts/OFL.txt`. Modify `package.json` (optional peers and devDeps `harfbuzzjs@1.6.2`, `wawoff2@2.0.1`; `exports["./headless"]`).
**Produces:**
- `registerFont(family, data: Uint8Array, face?: { weight?: number | [number, number], style?: 'normal' | 'italic' }): Promise<void>`, which detects the format by signature: `wOF2` → wawoff2, `wOFF` → node:zlib per table, otherwise sfnt/ttc;
- `findFace(family, weight, style): Face | undefined`, using CSS weight matching: an exact match or a range containing the weight; otherwise for weights 400–500 try 500 then lighter then heavier, for weights under 400 lighter first, over 500 heavier first;
- `clearFonts()` (tests only).

Registering the same family/weight/style twice throws.
- [ ] Tests:
  - the TTF and the WOFF2 give the same glyph advance for `'A'` at upem;
  - weight matching picks 700 for 650 when 400 and 700 are registered, and 400 for 450;
  - a duplicate registration throws.
- [ ] Implement, test, commit `feat(headless): font registry with WOFF/WOFF2`.

### Task H3: Canvas stand-in and install

**Files:** Create `src/headless/canvas.ts`, `src/headless/index.ts`, `test/headless/canvas.test.ts`.
**Produces:**
- `install(options?: { onMissingGlyph?: 'throw' | 'notdef', rounding?: 'none' | 'whole-px' }): void`;
- `HeadlessCoverageError`;
- the context: `font`, `measureText`, `letterSpacing`, `fontKerning` and `lang`, with the Blink behaviour the spec lists (runs split at U+0020; U+2028 shaped as a space; ligatures off under letter spacing; spacing added per grapheme; `kern` off when `fontKerning` is `'none'`; `wght` and `opsz` axes).
- [ ] Tests, using the registered Inter and widths pinned from the research (16px Inter `'Speichern'` = 76.921875):
  - `measureText('Speichern').width === 76.921875`;
  - `'AV'` is kerned (narrower than `A` + `V` measured apart);
  - `'A V'` is not kerned across the space (it equals `A` + space + `V`);
  - under `letterSpacing = '0.5px'`, `'fi'` equals `f` + `i` + 2×0.5;
  - the letter-spacing string round-trips;
  - `'中'` throws `HeadlessCoverageError`, and with `'notdef'` it returns a number;
  - `install()` then `prepareWithSegments('Zahlungspflichtig abonnieren', '600 16px Inter')` gives `measureLineStats(…, 160).lineCount === 2` and 1 at 260 (pin the actual numbers from Chromium in H5 if these differ, and record that);
  - calling `install()` twice is idempotent; calling it after a foreign `OffscreenCanvas` is set throws.
- [ ] Implement, test, commit `feat(headless): OffscreenCanvas stand-in and install()`.

### Task H4: jsdom and vitest usage

**Files:** Create `test/headless/jsdom.test.ts` (devDependency `jsdom`), `examples/vitest-label-fit.test.ts`. Modify `README.md` (a Headless section).
- [ ] Under jsdom with `document.body` present: emoji coverage throws; a covered string measures the same as without jsdom.
- [ ] The example: register Inter, `install()`, and assert that German labels fit 160px buttons with the kit's `fitFontSize`/`measureLineStats`, as an app would write it.
- [ ] The README section covers setup, the claim and its limits (registered fonts only, Chromium rules, macOS parity), and the coverage error. Commit `docs(headless): jsdom and vitest usage`.

### Task H5: Parity sweep against Chromium

**Files:** Create `verify/headless.ts`, `verify/HEADLESS_RESULTS.md`; Modify `package.json` (script `verify:headless`).
- [ ] Measure in Node (the stand-in) and in Playwright Chromium (Canvas `measureText` with `@font-face` loading the same Inter files): 40 strings (German compounds, French, digits, punctuation, kerning pairs, ligatures) × weights 400/600/700 × sizes 12/14/16/20 × letter spacing 0/0.5px. Pass bar: |Δ| ≤ 0.02px.
- [ ] Line counts: the v1 Latin, German (with its soft hyphens) and French corpora (covered text only) at widths 120–600 step 2, laid out by Pretext in Node and compared with Chromium's painted DOM. Use v1's attribution order: first Pretext-in-Chromium vs Node, where a difference is a `headless-mismatch`; then Pretext vs DOM, where a difference is a `pretext-gap`.
- [ ] Mutants: drop kerning; ignore the weight. Each must produce headless-mismatches; revert both.
- [ ] Write `HEADLESS_RESULTS.md` with builds, OS and date. Exit 1 on any headless-mismatch. Commit `test(headless): parity sweep against Chromium`.

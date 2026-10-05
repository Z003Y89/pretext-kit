# HarfBuzz-backed OffscreenCanvas stand-in for Pretext: feasibility

Research for sub-project 2 (measuring without a browser). Date 2026-10-05; macOS (Darwin 23.6.0), Node 24.4.1;
reference Chrome 154.0.8037.95 headless via CDP; harfbuzzjs 1.6.2 (HarfBuzz 14.5.0); Pretext main (f10d888) dist.
Prototype and raw data were in /private/tmp/claude-501/hb-research (session scratch, not kept).

## Verdict: feasible with limits

For the app's own Latin fonts (TTF or WOFF2, static or variable), a HarfBuzz stand-in reproduces Chrome Canvas
`measureText`: 320 of 352 string × font measurements bit-exact, the rest one variable instance (SF Pro wght 600)
off by at most 0.019px; mean 0.0006px. Pretext in Node on the stand-in matched Chrome's DOM line count in 2,021 of
2,024 cases — every case Pretext matched when running inside Chrome, except one missing-glyph case.

Limits: code points the registered fonts lack (CJK, emoji, Arabic, symbols such as `ẞ` or `→`) fall back to OS fonts
in Chrome, so they don't match (up to 5px off). Only macOS Chrome was measured; Windows (DirectWrite) and Linux
(FreeType, whole-px advances without subpixel positioning) need one check each.

## What a stand-in must implement

- `new OffscreenCanvas(1,1).getContext('2d')`; one context per preparation language.
- Context: `font` (writes include `16px monospace` and `16px "Fam", serif` probes); `measureText(t).width`;
  `actualBoundingBoxLeft/Right` (Han kerning of CJK punctuation only); `letterSpacing` as a string that round-trips
  through `parseFloat` (Pretext writes `'0.000001px'` for ligature-free shaping); `fontKerning` `'none'`/`'auto'`;
  `lang` optional.
- Blink Canvas behaviour: shape each run between U+0020 alone (no kerning across spaces); U+2028 drawn with the space
  glyph without a cut; under non-zero letter spacing turn off `liga`/`clig`/`calt` and add spacing per grapheme;
  `fontKerning 'none'` turns off `kern`; accumulate widths as float32.
- Font shorthand `[style] [variant] [weight] [stretch] size[/lh] family-list`, per-character fallback across the list;
  generic names resolve only if registered.
- Globals: set a desktop Chrome `navigator.userAgent` before the first `prepare()` (Node's and jsdom's UAs pick Blink
  but not desktop); language from `document.documentElement.lang`, else `Intl` locale, or `setLocale()`.
- Emoji hazard: if 😀 measures wider than size + 0.5 and `document.body` exists (jsdom), Pretext corrects via a span's
  `getBoundingClientRect()`, which jsdom returns as 0 — emoji then measure 0px. Keep emoji ≤ size + 0.5 or stub it.

## HarfBuzz details

- `import * as hb from 'harfbuzzjs'` (top-level await, then synchronous calls). Blob → Face → Font;
  `setScale(round(size * 65536))` and width = Σ xAdvance / 65536 is exact (16px Inter "Speichern" 76.921875 in both).
- Variable fonts: `wght` = requested weight clamped to the axis; `opsz` = size in px (Chrome applies
  `font-optical-sizing: auto` to Canvas).
- WOFF2 must be decompressed first (raw WOFF2 fails silently): `wawoff2` 2.0.1 `decompress()` (async registration,
  sync measuring). WOFF1 could use `node:zlib`.
- Licences/sizes: harfbuzzjs 1.6.2 MIT (~198 KB gzip at runtime), wawoff2 2.0.1 MIT (~133 KB gzip); ~330 KB gzip,
  ~2.5 MB unpacked, test-only.
- Speed: ~17 µs per `measureText`; 15 ms to prepare 2,000 distinct labels cold.

## Measurements (Chrome 154 Canvas vs stand-in, 33 strings: German compounds, umlauts, digits, punctuation, kerning pairs, ligatures)

| font | max abs Δ px | mean abs Δ px | exact / 33 |
|---|---|---|---|
| 16px Inter ttf | 0 | 0 | 33 |
| 16px Inter woff2 | 0 | 0 | 33 |
| 16px / 13px Roboto | 3.77* / 3.07* | 0.114* / 0.093* | 32 |
| 16px / 14px Arial, 700 16px Arial | ≤1.13* | ≤0.034* | 32 |
| 16px Georgia | 5.13* | 0.156* | 32 |
| 16px SF Pro variable wght 400 | 0 | 0 | 33 |
| 600 16px SF Pro variable | 0.019 | 0.0070 | 0 |
| 700 16px Inter (synthetic bold) | 0 | 0 | 33 |
| 16px Inter, letterSpacing 0.5px | 0 | 0 | 33 |

\* All error from one string `ÄÖÜ äöü ß ẞ`: these fonts lack U+1E9E, Chrome falls back, the stand-in measures .notdef.

Missing glyphs in 16px Inter (Chrome vs stand-in): 😀 20.00 vs 10.50; 中文字体 64.00 vs 42.00; こんにちは 80.00 vs 52.50;
한국어 41.52 vs 31.50; مرحبا 31.34 vs 52.50. Apple Color Emoji through HarfBuzz gives 16px where Chrome gives 20px.

Line counts vs Chrome DOM: 22 German/English labels × 8 widths (60–240px) × 9 fonts = 1,584 cases, 1,582 match
(both misses are Pretext layout gaps that also miss inside Chrome: 700 16px Arial); 8 paragraphs × 11 widths × 5 fonts
= 440 cases, 439 match (miss: 15px Roboto lacks `→`).

## Recommendation for sub-project 2

A test-only `OffscreenCanvas` stand-in (`pretext-kit/headless` or a sibling package), ~200–300 lines with WOFF1,
`font-stretch` → `wdth`, a hard warning or error on any code point no registered font covers, and a Linux rounding
mode. Apps register the same font files their CSS loads and call `install()` before the first `prepare()`. Claim
parity only for registered fonts on macOS Chrome until Windows and Linux are measured once; keep CJK/emoji checks in
browser tests.

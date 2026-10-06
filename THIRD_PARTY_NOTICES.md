# Third-party notices

What ships in, or is needed at runtime by, pretext-kit 0.2.0, and what the repository uses only for testing. A
machine-readable CycloneDX SBOM of the packed package's runtime tree, `pretext-kit-0.2.0.sbom.cdx.json`, is built
beside the tarballs by `verify/pack-release.sh` and attached to the release. The SBOM is not byte-reproducible: it
records a timestamp and a random serial number.

pretext-kit itself is [MIT](https://github.com/Z003Y89/pretext-kit/blob/main/LICENSE), copyright 2026 pretext-kit contributors. It has no `dependencies`.

## Shipped in the pretext-kit tarball

| component | licence | how |
|---|---|---|
| Pretext (`pages/demos/ellipsis.model.ts`, https://github.com/chenglou/pretext) | MIT, copyright 2026 Pretext contributors | `src/clamp.ts`, `src/middle.ts` and `src/cut.ts` (and their `dist` output) derive from it; its full MIT notice is reproduced in [LICENSE](https://github.com/Z003Y89/pretext-kit/blob/main/LICENSE), which the tarball includes. |

## Required at runtime (peer dependency, installed by the app)

| package | version | licence | notes |
|---|---|---|---|
| `@chenglou/pretext` | `>=0.0.10-0 <0.0.11`; the release's snapshot is `0.0.10-main.f10d888` | MIT, copyright 2026 Pretext contributors | The snapshot tarball is an unofficial build of chenglou/pretext `main` at f10d888, not a release by Pretext's authors. It carries Pretext's own LICENSE and README unchanged. |

## Optional at runtime (optional peers, loaded only by `pretext-kit/headless`)

| package | version verified | licence | notes |
|---|---|---|---|
| `harfbuzzjs` | 1.6.2 | MIT, copyright 2019-2026 the harfbuzzjs project authors | Bundles HarfBuzz compiled to WebAssembly (HarfBuzz: "Old MIT" licence). |
| `wawoff2` | 2.0.1 | MIT, copyright 2013-2017 the WOFF2 Authors | Loaded only when a WOFF2 font is registered. Bundles Google's woff2 and Brotli (both MIT) compiled to WebAssembly. |
| `argparse` (dependency of `wawoff2`) | 2.0.1 | Python-2.0 | Used by wawoff2's command-line tools, not by pretext-kit; installed with wawoff2. |

## Test and example assets: not shipped

None of these is in the npm tarball (`files` is `dist`, `bin` and this file, plus npm's README, LICENSE and package.json); they are in the repository, or installed as
devDependencies, for the tests, the parity sweeps and the examples.

| asset | licence | where |
|---|---|---|
| Inter (Regular TTF and WOFF2, and a subset without U+2010) | SIL OFL 1.1, copyright 2016 The Inter Project Authors | `test/fonts`, [OFL.txt](https://github.com/Z003Y89/pretext-kit/blob/main/test/fonts/OFL.txt); the examples bundle Inter too ([inter-OFL.txt](https://github.com/Z003Y89/pretext-kit/blob/main/examples/fonts/inter-OFL.txt)). Not shipped. |
| Roboto Regular | Apache-2.0 | `test/fonts`, [Roboto-LICENSE.txt](https://github.com/Z003Y89/pretext-kit/blob/main/test/fonts/Roboto-LICENSE.txt). Not shipped. |
| Shantell Sans (Regular, Bold) | SIL OFL 1.1, copyright 2022 The Shantell Sans Project Authors | `test/fonts`, [ShantellSans-OFL.txt](https://github.com/Z003Y89/pretext-kit/blob/main/test/fonts/ShantellSans-OFL.txt). Not shipped. |
| Inter Variable (`@fontsource-variable/inter` 5.3.0) | SIL OFL 1.1, copyright 2016 The Inter Project Authors | devDependency since 0.1.2, for the variable-font tests, the headless parity sweep and `npm run verify:hvar`. Not shipped. |
| `hyphen` 1.14.1 | ISC (its TeX hyph-utf8 patterns: MIT) | devDependency; the examples ship strings hyphenated at build time. Not shipped in the package. |

Other devDependencies (TypeScript, esbuild, Playwright, jsdom, type packages) are build and test tools only and are
not shipped.
`npm run verify:hvar` also needs fontTools 4.62.1 (MIT) and brotli (MIT), installed with pip, not npm; test tools
only, not shipped.

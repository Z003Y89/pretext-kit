# pretext-kit: evaluation protocol

The standard a change must meet before pretext-kit claims anything about it, and before a release is tagged.
[EVALUATION.md](EVALUATION.md) records what the protocol found for the current release; this file says what it
requires. The rules come from what went wrong while building 0.1.0 to 0.1.2, and each names the failure it prevents.

## 1. Claims

- **A claim names its scope and its evidence.** Every accuracy statement in README.md says which helper, which
  browser or platform, which fonts, and which file and command produced the number. What was not measured is not
  claimed, and is listed under limits instead. *(0.1.2's first draft said "as Chrome on macOS has them" for every
  variable font, after checking one axis of one font.)*
- **Platforms are claimed one at a time.** A result measured on macOS is not extended to Linux or Windows until that
  platform has been measured. *(Variable-font advances matched Chrome on macOS and were wrong on Linux and Windows,
  found only by measuring there.)*
- **Limits are written down where the claim is.** README, CHANGELOG and EVALUATION §8 carry the same limits.

## 2. The oracle

- **The kit is judged against Pretext's own numbers first,** then against what the browser paints, then by known
  platform causes (EVALUATION §2). A check that only compares the kit with itself does not count. *(The first
  harness passed kit bugs because it checked self-consistency and pooled them with Pretext's own gaps.)*
- **Headless widths are judged against the same browser's Canvas** with the same font files, and line counts
  against Pretext running inside that browser. Pass bar: |Δ| ≤ 0.02px for widths, and no headless-mismatch.
- **Independent references where one exists:** variable-font advances against fontTools (`npm run verify:hvar`),
  pinned version, max difference 0 font units.

## 3. Sensitivity

- **Every check that guards a claim has a planted bug it must catch.** `verify/mutants.ts` (helpers) and the
  headless sweep's mutants (kerning, weight, variable-font rounding, per platform) each have to fail the sweep. A
  new claim adds its mutant in the same change. A check whose mutant is not caught does not count.
- **Pinned unit tests** guard what the sweeps can't run on every commit (for example, the Chromium widths in
  `test/headless/variable.test.ts`), and must fail when the code they guard is reverted.

## 4. Statistics

- **Report zero-failure results as an upper bound,** never as "100%": the 95% Wilson and Clopper-Pearson upper
  bounds, quoting the larger (`verify/stats.ts`).
- **Count independent units, not cases.** One unit per text, or per text × font *file*; instances of one variable
  font file, zoom factors and widths of one text are one unit, since one bug hits them together. Report both the
  clustered bound and the naive one, and quote the clustered one. *(0.1.2 briefly counted each variable-font weight
  as its own font, which overstated confidence nearly 2×.)*
- **Timings from a loaded machine are upper bounds** and labelled so (verify/BENCH.md).

## 5. Robustness

- **Parsing font bytes never throws or allocates without bound.** Malformed or hostile tables fall back to
  HarfBuzz's behaviour; work is bounded by the table's size. Each parser change gets a malformed-input test and a
  byte-flip fuzz run before release. *(A corrupted HVAR made `measureText` throw; a 504 KB crafted font allocated
  17 GB.)*
- **Out-of-scope input is reported, not guessed:** an uncovered code point throws `HeadlessCoverageError` unless the
  app opts in to `.notdef`.

## 6. Review

- Each change is reviewed by someone (or an agent) that did not write it, against the spec and for quality; findings
  are fixed and re-reviewed.
- Before a release, the whole branch against the last release gets one more review, on the most capable reviewer
  available, which also checks that the docs' numbers match the results files.

## 7. Reproduction

- `verify/reproduce.sh` reruns everything from a fresh clone; its expected tallies are in EVALUATION §7 and are
  updated in the same change that changes them.
- At least one major claim per release is rerun on a machine other than the author's (CI counts for Linux and
  Windows; the browser sweep's macOS fonts keep it on macOS).

## 8. Release gate

A release is tagged only when all of these hold on the exact commit being tagged:

| # | requirement | evidence |
|---|---|---|
| 1 | `npm test`, `npm run check`, `npm run build` pass on Linux, Windows, macOS × Node 22 and 24 | CI run, green |
| 2 | Headless parity: 0 headless-mismatch, widths within 0.02px, on macOS (local) and Linux and Windows (CI), each under its own `platform` | HEADLESS_RESULTS.md, CI artifacts `headless-results-<os>` |
| 3 | Every headless mutant caught on every platform | HEADLESS_RESULTS.md mutant table |
| 4 | If helpers changed: the browser sweep, 0 kit-mismatch, and every helper mutant caught | verify/RESULTS.md, verify/results/mutants.txt |
| 5 | If `src/headless/hvar.ts` changed: `npm run verify:hvar`, max difference 0 | HEADLESS_RESULTS.md |
| 6 | If a parser changed: malformed-input tests and a fuzz run with no throw | the review's report |
| 7 | README, CHANGELOG and EVALUATION carry the same numbers and limits as the results files | whole-branch review |
| 8 | Tarballs packed, sums recorded, consumer smoke on Node 22 and 24, SBOM and notices current | verify/RELEASING.md steps 2–4 |
| 9 | After upload: assets downloaded, sums match, consumer smoke and README's install line pass | verify/RELEASING.md step 6 |

"Waiting for CI" is not green: a document edit after a green run needs its own run before the tag (RELEASING.md).

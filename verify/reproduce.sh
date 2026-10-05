#!/usr/bin/env bash
# Rebuilds the evaluation's evidence from fresh clones: clones pretext-kit and Pretext at pinned commits side by
# side, builds Pretext, installs the kit's locked dependencies and Playwright's pinned browsers, then runs the logic
# tests, the type check, the browser sweep and the headless parity sweep, and compares the sweep's tallies with the
# committed verify/RESULTS.md. It does not rerun the bench, the mutation tests (node verify/mutants.ts) or
# verify/stats.ts's bounds, and it can only reproduce on a Mac like the one the results were recorded on.
#
#   verify/reproduce.sh [--dir=DIR] [--kit-repo=PATH_OR_URL] [--kit-commit=SHA] [--sweep=chromium@1]
#
#   --dir         where to clone (default: a new temporary directory); must not hold pretext/ or pretext-kit/
#   --kit-repo    the pretext-kit repository (default: the one this script is in)
#   --kit-commit  the commit to check out (default: that repository's HEAD)
#   --sweep=chromium@1
#                 run the browser sweep in Chromium at deviceScaleFactor 1 only (about 3 minutes rather
#                 than about 20); the comparison then covers only that browser × factor
#
# Needs macOS 14 (the recorded run's OS; the sweep's pinned fonts are macOS fonts), git, Node 24 and npm,
# and network access for npm and, unless they are cached, Playwright's browser downloads.
# Prints each step's outcome and, at the end, the tallies; exits non-zero if any step failed.
set -uo pipefail

PRETEXT_REPO=https://github.com/chenglou/pretext.git
PRETEXT_COMMIT=f10d888c0f3dfc5877fbca5e4570ee04111e7001
here="$(cd "$(dirname "$0")" && pwd)"
DIR=""
KIT_REPO="$(git -C "$here" rev-parse --show-toplevel)"
KIT_COMMIT=""
SWEEP=all
for arg in "$@"; do
  case "$arg" in
    --dir=*) DIR="${arg#--dir=}" ;;
    --kit-repo=*) KIT_REPO="${arg#--kit-repo=}" ;;
    --kit-commit=*) KIT_COMMIT="${arg#--kit-commit=}" ;;
    --sweep=chromium@1) SWEEP=chromium@1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$KIT_COMMIT" ] || KIT_COMMIT="$(git -C "$KIT_REPO" rev-parse HEAD)"
[ -n "$DIR" ] || DIR="$(mktemp -d)"
mkdir -p "$DIR"
if [ -e "$DIR/pretext" ] || [ -e "$DIR/pretext-kit" ]; then echo "$DIR already holds pretext/ or pretext-kit/" >&2; exit 2; fi
LOGS="$DIR/logs"
mkdir -p "$LOGS"
failed=()
step() { # step NAME COMMAND...: runs COMMAND, logging to $LOGS/NAME.log, and records a failure
  local name="$1"; shift
  echo "== $name: $*"
  if "$@" > "$LOGS/$name.log" 2>&1; then echo "   ok ($LOGS/$name.log)"; else echo "   FAILED ($LOGS/$name.log)"; failed+=("$name"); fi
}

echo "pretext-kit $KIT_COMMIT from $KIT_REPO; Pretext $PRETEXT_COMMIT; into $DIR; sweep: $SWEEP"
echo "$(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null) $(uname -m), node $(node --version), npm $(npm --version)"

step pretext-clone git clone --quiet "$PRETEXT_REPO" "$DIR/pretext"
step pretext-checkout git -C "$DIR/pretext" checkout --quiet "$PRETEXT_COMMIT"
# Pretext's build (`npm run build:package`) is tsc alone, pinned in its devDependencies to typescript 6.0.2. Its
# other dev dependencies float (it has no npm lockfile) and on 2026-10-05 no longer resolve with `npm install`
# (an oxlint peer conflict), so tsc is run directly; the dist it writes is identical to the recorded runs'.
step pretext-build bash -c "cd '$DIR/pretext' && npx -y -p typescript@6.0.2 tsc -p tsconfig.build.json"
step kit-clone git clone --quiet "$KIT_REPO" "$DIR/pretext-kit"
step kit-checkout git -C "$DIR/pretext-kit" checkout --quiet "$KIT_COMMIT"
cd "$DIR/pretext-kit" || exit 1
step npm-ci npm ci --no-audit --no-fund
# The browser builds Playwright 1.61.0 pins (Chromium 149, WebKit 26.5, Firefox 151); cached ones are reused.
step browsers npx playwright install chromium webkit firefox
step test npm test
step check npm run check
# A full sweep rewrites verify/RESULTS.md, so the tallies are compared with the committed copy.
git show HEAD:verify/RESULTS.md > "$LOGS/RESULTS.committed.md"
if [ "$SWEEP" = chromium@1 ]; then
  step verify node verify/run.ts --only=chromium --factors=1
else
  step verify npm run verify
fi
step compare node verify/stats.ts --compare-log="$LOGS/verify.log" --results="$LOGS/RESULTS.committed.md"
step verify-headless npm run verify:headless

echo
echo "== tallies"
grep -E '^ℹ (tests|pass|fail) ' "$LOGS/test.log" | paste -sd' ' - | sed 's/^/npm test: /'
grep -E '^(chromium|webkit|firefox)@[0-9.]+ \w+: [0-9]+ cases' "$LOGS/verify.log"
grep -E '^(FAIL|kit-mismatch) ' "$LOGS/verify.log" | head -20
tail -n 1 "$LOGS/compare.log"
grep -E '^(widths|lines): |^mutant |^FAIL' "$LOGS/verify-headless.log"
if [ "$SWEEP" = all ]; then
  echo "RESULTS.md written by this run differs from the committed one in:"; git diff --stat -- verify/RESULTS.md verify/results verify/baseline.json
fi
echo "HEADLESS_RESULTS.md written by this run differs from the committed one in:"; git diff --stat -- verify/HEADLESS_RESULTS.md
echo
if [ ${#failed[@]} -gt 0 ]; then echo "failed steps: ${failed[*]}"; exit 1; fi
echo "all steps passed"

#!/usr/bin/env bash
# Builds the two release tarballs into dist-release/ (git-ignored):
#
#   chenglou-pretext-0.0.10-main.f10d888.tgz  an UNOFFICIAL, labelled snapshot of chenglou/pretext main at f10d888,
#                                             built for pretext-kit; not a release by Pretext's authors
#   pretext-kit-<version>.tgz                 this package, `npm pack` (prepack rebuilds dist)
#
#   verify/pack-release.sh [--pretext=DIR] [--out=DIR]
#
#   --pretext  a git clone of chenglou/pretext holding commit f10d888 (default: ../pretext beside this repository).
#              It is never modified: the commit is exported with `git archive` into a temporary directory and built
#              there with Pretext's pinned TypeScript, the way its own build:package does.
#   --out      where to write the tarballs (default: dist-release/ in this repository)
#
# Needs git, Node and npm; network access for `npx -p typescript@6.0.2` unless it is cached.
set -euo pipefail

PRETEXT_COMMIT=f10d888c0f3dfc5877fbca5e4570ee04111e7001
SNAPSHOT_VERSION=0.0.10-main.f10d888
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
PRETEXT="$root/../pretext"
OUT="$root/dist-release"
for arg in "$@"; do
  case "$arg" in
    --pretext=*) PRETEXT="${arg#--pretext=}" ;;
    --out=*) OUT="${arg#--out=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "== Pretext snapshot $SNAPSHOT_VERSION from $PRETEXT at $PRETEXT_COMMIT"
mkdir "$work/pretext"
git -C "$PRETEXT" archive --format=tar "$PRETEXT_COMMIT" | tar -x -C "$work/pretext"
(cd "$work/pretext" && npx -y -p typescript@6.0.2 tsc -p tsconfig.build.json)
node - "$work/pretext/package.json" "$SNAPSHOT_VERSION" <<'EOF'
const fs = require('node:fs')
const [path, version] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'))
pkg.version = version
pkg.description = `${pkg.description}. NOTE: Unofficial snapshot of chenglou/pretext main at f10d888, built for pretext-kit; not a release by Pretext's authors`
// No script may run when the tarball is packed or installed.
const lifecycle = ['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare',
  'prepublishOnly', 'prepack', 'postpack', 'publish', 'postpublish', 'dependencies']
for (const name of lifecycle) delete pkg.scripts?.[name]
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
EOF
(cd "$work/pretext" && npm pack --ignore-scripts --pack-destination "$OUT")

echo "== pretext-kit"
(cd "$root" && npm pack --pack-destination "$OUT")

ls -l "$OUT"

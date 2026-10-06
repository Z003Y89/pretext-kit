# Releasing pretext-kit

How a release `v<version>` is cut (the steps are the same for every version). Nothing goes to the npm registry: the
assets are attached to a GitHub release and installed by URL.

**The release is cut by GitHub Actions.** Pushing the tag `v<version>` runs `.github/workflows/release.yml`, which does
steps 2–4 and 6 below on `ubuntu-latest` and step 5's `gh release create`: it checks that the tag is `v` + the
package.json version and that CHANGELOG.md has a dated `## <version> — <date>` heading, runs `npm test`, `npm run check`
and `npm run build`, packs with Node 24.4.1 and npm 11.4.2 (so the sums are reproducible), records the SHA-256 sums,
smoke-tests the local tarballs on Node 24.4.1 and Node 22, writes the release notes (the CHANGELOG.md entry, the sums
with the Node and npm versions, and the unofficial-snapshot sentence of step 5), creates the release (it fails, and
overwrites nothing, if one exists for the tag), then downloads the three assets, checks their sums against the ones
recorded before upload, smoke-tests the downloads and runs README's install line in an empty project. The run's
summary lists the sums, and the release notes carry them, so the CHANGELOG.md entry needs no later commit. Its `workflow_dispatch` (input `tag`) re-runs it for a pushed tag. The macOS rows of the
release gate (PROTOCOL.md §8 rows 2 and 6) come from `.github/workflows/macos-parity.yml` on a `macos-latest` runner
(artifact `macos-parity-results`; the job log carries every summary). The steps below are what the workflow does, and
remain the manual fallback when it cannot run.

1. **Prepare the commit.** Every row of the release gate in PROTOCOL.md §8 holds on it. `npm test`, `npm run check` and `npm run build` pass, CI is green on the commit, `version` in
   package.json is the new version, and CHANGELOG.md has its dated entry.
2. **Pack.** With `../pretext` holding chenglou/pretext at f10d888:

   ```sh
   npm run pack:release      # dist-release/: the Pretext snapshot, pretext-kit-<version>.tgz, the CycloneDX SBOM
   ```

3. **Verify the hashes.** For a release already cut, `shasum -a 256 dist-release/*.tgz` must equal the sums in that
   version's CHANGELOG.md entry when packed with the Node and npm versions the entry names. With other versions the
   sums differ, since gzip output differs across Node/zlib versions, but the contents are identical file for file:
   compare `tar -xzf` of both instead. For a new release, record the sums the pack gave (and the Node and npm
   versions) in its CHANGELOG.md entry and the release notes. Example, 0.1.1 (Node 24.4.1, npm 11.4.2):
   `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`  chenglou-pretext-0.0.10-main.f10d888.tgz and
   `e3c85d131d683083f11dc5232b354903a9f10d53aa58e340c2703b9cd2312b45`  pretext-kit-0.1.1.tgz; the Pretext snapshot's
   sum is the same in every release packed with those versions. The kit's sum lives in CHANGELOG.md and the
   release notes, not in README.md, because README.md ships inside the tarball and so cannot hold its own hash; edit
   README.md (its install line names `v<version>`) and THIRD_PARTY_NOTICES.md first, then pack, then record the sum.
   CHANGELOG.md is not in the tarball (`npm pack --dry-run` lists what is), so recording the sum there does not change
   it. The SBOM has no fixed sum, because it records a timestamp and a random serial number.
4. **Smoke-test the local tarballs** on Node 22 and 24:

   ```sh
   node verify/consumer-smoke.mjs dist-release/chenglou-pretext-0.0.10-main.f10d888.tgz dist-release/pretext-kit-<version>.tgz
   ```

5. **Tag and publish.** Pushing the tag starts `release.yml`, which publishes. Manual fallback (as Z003Y89):

   ```sh
   git tag -a v<version> -m "pretext-kit v<version>" && git push origin main v<version>
   gh release create v<version> --title "pretext-kit v<version>" --notes-file <notes with the SHA-256 sums> \
     dist-release/chenglou-pretext-0.0.10-main.f10d888.tgz \
     dist-release/pretext-kit-<version>.tgz \
     dist-release/pretext-kit-<version>.sbom.cdx.json
   ```

   The notes say that the Pretext tarball is an unofficial, labelled snapshot, not a release by Pretext's authors.
6. **Smoke-test the uploaded assets.** `verify/consumer-smoke.mjs` takes local paths, so download the assets, check
   their sums, and run the smoke test on the downloads. Then run README's own install line in a scratch project:

   ```sh
   base=https://github.com/Z003Y89/pretext-kit/releases/download/v<version>
   curl -fsSLO "$base/chenglou-pretext-0.0.10-main.f10d888.tgz" -fsSLO "$base/pretext-kit-<version>.tgz"
   shasum -a 256 *.tgz
   node <kit>/verify/consumer-smoke.mjs chenglou-pretext-0.0.10-main.f10d888.tgz pretext-kit-<version>.tgz
   npm install "$base/chenglou-pretext-0.0.10-main.f10d888.tgz" "$base/pretext-kit-<version>.tgz"   # in an empty project
   ```

# Releasing pretext-kit

How a release (here, v0.1.1) is cut. Nothing goes to the npm registry: the assets are attached to a GitHub release
and installed by URL.

1. **Prepare the commit.** `npm test`, `npm run check` and `npm run build` pass, CI is green on the commit, `version` in
   package.json is the new version, and CHANGELOG.md has its dated entry.
2. **Pack.** With `../pretext` holding chenglou/pretext at f10d888:

   ```sh
   npm run pack:release      # dist-release/: the Pretext snapshot, pretext-kit-<version>.tgz, the CycloneDX SBOM
   ```

3. **Verify the hashes.** `shasum -a 256 dist-release/*.tgz` must equal the sums in CHANGELOG.md when packed with the
   Node and npm versions CHANGELOG names (0.1.1: Node 24.4.1, npm 11.4.2). With other versions the sums differ, since
   gzip output differs across Node/zlib versions, but the contents are identical file for file: compare
   `tar -xzf` of both instead. For 0.1.1:
   `9feccf2eeacf941cd6704e8f462c170c0c4bcb1d7d82cefa97e2c95b06e4b4c7`  chenglou-pretext-0.0.10-main.f10d888.tgz and
   `e3c85d131d683083f11dc5232b354903a9f10d53aa58e340c2703b9cd2312b45`  pretext-kit-0.1.1.tgz. The kit's sum lives in CHANGELOG.md and the
   release notes, not in README.md, because README.md ships inside the tarball and so cannot hold its own hash; edit
   README.md first, then pack, then record the sum. The SBOM has no fixed sum, because it records a timestamp and a
   random serial number.
4. **Smoke-test the local tarballs** on Node 22 and 24:

   ```sh
   node verify/consumer-smoke.mjs dist-release/chenglou-pretext-0.0.10-main.f10d888.tgz dist-release/pretext-kit-<version>.tgz
   ```

5. **Tag and publish** (as Z003Y89):

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

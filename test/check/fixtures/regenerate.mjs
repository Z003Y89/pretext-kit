import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { main } from '../../../dist/check/cli.js'

const here = fileURLToPath(new URL('.', import.meta.url))
for (const [file, flags] of [['report.txt', []], ['report.json', ['--json']]]) {
  let out = ''
  await main(['check-labels', '--config', `${here}labels.config.mjs`, ...flags], { stdout: (s) => (out += s), stderr: () => {}, cwd: here })
  writeFileSync(`${here}${file}`, out)
}

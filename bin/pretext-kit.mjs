import { main } from '../dist/check/cli.js'
process.exitCode = await main(process.argv.slice(2), { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s), cwd: process.cwd() })

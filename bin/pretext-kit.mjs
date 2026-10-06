#!/usr/bin/env node
import { launch } from '../dist/check/launch.js'
const io = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s), cwd: process.cwd() }
process.exitCode = await launch(process.argv.slice(2), io, () => import('../dist/check/cli.js'))

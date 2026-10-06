import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkLabels } from './index.ts'
import type { CheckInput, Issue, LabelSource, Platform, Report } from './types.ts'

export type Io = { stdout: (s: string) => void; stderr: (s: string) => void; cwd: string }

type FileLabels = { files: string; locale?: (path: string) => string }
type Config = Omit<CheckInput, 'labels'> & { labels: LabelSource | FileLabels }
type Options = { config: string | undefined; json: boolean; strict: boolean; platforms: Platform[] | undefined }

const USAGE = `usage: pretext-kit check-labels [--config <path>] [--json] [--strict] [--platform macos,windows,linux] [--help]\n`
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux']

function platformList(value: string): Platform[] {
  const names = value.split(',')
  for (const name of names) {
    if (!PLATFORMS.includes(name as Platform)) throw new RangeError(`--platform: "${name}" is not one of ${PLATFORMS.join(', ')}`)
  }
  return names as Platform[]
}

function parse(args: string[]): Options {
  const options: Options = { config: undefined, json: false, strict: false, platforms: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--json') options.json = true
    else if (arg === '--strict') options.strict = true
    else if (/^--(?:config|platform)(?:=|$)/.test(arg)) {
      const eq = arg.indexOf('=')
      const flag = eq < 0 ? arg : arg.slice(0, eq)
      let value = eq < 0 ? args[++i] : arg.slice(eq + 1)
      if (value === undefined || (eq < 0 && value.startsWith('--'))) value = ''
      if (value === '' && flag === '--config') throw new RangeError('--config needs a value')
      if (flag === '--config') options.config = value
      else if (value === '') throw new RangeError('--platform needs a value')
      else options.platforms = platformList(value)
    } else throw new RangeError(`unknown option "${arg}"`)
  }
  return options
}

function globPattern(glob: string): RegExp {
  let body = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!
    if (ch === '*' && glob[i + 1] === '*') {
      i++
      if (glob[i + 1] === '/') {
        i++
        body += '(?:.*/)?'
      } else body += '.*'
    } else if (ch === '*') body += '[^/]*'
    else if (ch === '?') body += '[^/]'
    else body += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${body}$`)
}

function listFiles(dir: string, prefix: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const path = prefix + entry.name
    if (entry.isDirectory()) listFiles(`${dir}/${entry.name}`, `${path}/`, out)
    else out.push(path)
  }
}

// Paths come back relative to base with '/' separators, sorted.
export function glob(base: string, pattern: string): string[] {
  const normal = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
  const fixed = normal.split('/').slice(0, -1).filter((_, i, parts) => !parts.slice(0, i + 1).some((p) => /[*?]/.test(p)))
  const start = fixed.join('/')
  const all: string[] = []
  try {
    listFiles(start === '' ? base : resolve(base, start), start === '' ? '' : `${start}/`, all)
  } catch {
    return []
  }
  const matcher = globPattern(normal)
  return all.filter((p) => matcher.test(p)).sort()
}

function merge(target: Record<string, unknown>, value: unknown, where: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RangeError(`${where}: a locale file must be a JSON object`)
  for (const [key, entry] of Object.entries(value)) {
    if (Object.hasOwn(target, key)) throw new RangeError(`${where}: top-level key "${key}" is already defined by another file of the same locale`)
    target[key] = entry
  }
}

function loadLabels(labels: Config['labels'], configDir: string): LabelSource {
  if (typeof labels === 'function' || Array.isArray(labels)) return labels
  if (typeof (labels as FileLabels).files !== 'string') return labels as LabelSource
  const { files, locale } = labels as FileLabels
  const paths = glob(configDir, files)
  if (paths.length === 0) throw new RangeError(`labels.files "${files}" matches no files`)
  const out: Record<string, Record<string, unknown>> = {}
  for (const path of paths) {
    const name = locale === undefined ? basename(path).replace(/\.json$/, '') : locale(path)
    if (typeof name !== 'string' || name === '') throw new RangeError(`labels.locale returned no locale name for ${path}`)
    let data: unknown
    try {
      data = JSON.parse(readFileSync(resolve(configDir, path), 'utf8'))
    } catch (error) {
      throw new RangeError(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
    out[name] ??= {}
    merge(out[name]!, data, path)
  }
  return out
}

async function loadConfig(path: string): Promise<CheckInput> {
  const absolute = resolve(path)
  let module: { default?: unknown }
  try {
    module = await import(pathToFileURL(absolute).href)
  } catch (error) {
    throw new RangeError(`cannot load config ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const config = module.default as Config | undefined
  if (typeof config !== 'object' || config === null) throw new RangeError(`config ${path} must default-export a CheckInput object`)
  const bad = (what: string): never => {
    throw new RangeError(`config ${path}: ${what}`)
  }
  if (config.labels === undefined || config.labels === null) bad('labels is required')
  if (typeof config.labels !== 'object' && typeof config.labels !== 'function') {
    bad(`labels must be an object of locales, an array of labels or a function, not ${typeof config.labels}; to read locale files use { files: 'locales/*.json' }`)
  }
  if (!Array.isArray(config.fonts)) bad('fonts must be an array')
  for (const font of config.fonts) {
    if (typeof font !== 'object' || font === null || typeof font.family !== 'string' || (font.path === undefined && font.data === undefined)) {
      bad('each font needs a family and a path or data')
    }
  }
  if (config.slots === undefined || config.slots === null) bad('slots is required')
  const dir = dirname(absolute)
  return {
    ...config,
    labels: loadLabels(config.labels, dir),
    fonts: config.fonts.map((font) => (font.path === undefined ? font : { ...font, path: resolve(dir, font.path) })),
  }
}

function missing(issue: Issue): string {
  const { measured, missing: gap } = issue
  const parts: string[] = []
  if (issue.kind === 'too-many-lines') parts.push(`${measured.lines} lines in a box of ${measured.box}px`)
  if (issue.kind === 'below-min-size' && gap?.fitsAtPx !== undefined) parts.push(`fits at ${gap.fitsAtPx}px`)
  if (issue.kind === 'truncated') parts.push(`cut at ${measured.box}px`)
  if (issue.kind === 'row-overflow') parts.push(`${measured.width}px in ${measured.box}px`)
  if (issue.kind === 'row-collapsed') parts.push(`stage ${measured.stage ?? 0}`)
  if (gap?.px !== undefined && issue.kind !== 'row-overflow') parts.push(issue.kind === 'below-min-size' ? `needs ${gap.px}px more` : `${gap.px}px too wide`)
  if (issue.detail !== undefined) parts.push(issue.detail)
  return parts.length === 0 ? issue.kind : `${issue.kind}: ${parts.join('; ')}`
}

function section(issues: Issue[], run: string[], lines: string[]): void {
  let heading = ''
  for (const issue of issues) {
    const next = `${issue.slot} · ${issue.condition}`
    if (next !== heading) {
      if (lines.length > 0) lines.push('')
      lines.push(next)
      heading = next
    }
    const all = run.every((p) => issue.platforms.includes(p as Issue['platforms'][number]))
    const where = all && !issue.platforms.includes('browser') ? '' : `  [${issue.platforms.join(', ')}]`
    lines.push(`  ${issue.locale} ${issue.key}  ${JSON.stringify(issue.text)}  ${missing(issue)}${where}`)
  }
}

export function formatReport(report: Report, platforms: string[]): string {
  const lines: string[] = []
  for (const issues of [report.failures, report.warnings, report.notes]) section(issues, platforms, lines)
  if (lines.length > 0) lines.push('')
  lines.push(`${report.checked} checked, ${report.failures.length} failures, ${report.warnings.length} warnings`)
  if (report.unchecked.length > 0) lines.push(`${report.unchecked.length} keys matched no slot or row`)
  return `${lines.join('\n')}\n`
}

export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  if (argv.some((a) => a === '--help' || a === '-h')) {
    io.stdout(USAGE)
    return 0
  }
  if (command !== 'check-labels') {
    io.stderr(command === undefined ? USAGE : `unknown command "${command}"\n${USAGE}`)
    return 2
  }
  let options: Options
  try {
    options = parse(rest)
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`)
    return 2
  }
  try {
    const input = await loadConfig(resolve(io.cwd, options.config ?? 'labels.config.mjs'))
    if (options.platforms !== undefined) input.platforms = options.platforms
    const report = await checkLabels(input)
    const platforms = input.platforms ?? PLATFORMS
    io.stdout(options.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report, platforms))
    if (report.checked === 0 && report.failures.length === 0 && report.warnings.length === 0 && report.unchecked.length > 0) {
      io.stderr(`nothing was checked: ${report.unchecked.length} keys matched no slot or row; check the slots' uses patterns and the labels\n`)
      return 2
    }
    return report.failures.length > 0 || (options.strict && report.warnings.length > 0) ? 1 : 0
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
}

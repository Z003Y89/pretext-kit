import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkLabels } from './index.ts'
import type { CheckInput, Issue, LabelSource, Platform, Report } from './types.ts'

export type Io = { stdout: (s: string) => void; stderr: (s: string) => void; cwd: string }

type FileLabels = { files: string; locale?: (path: string) => string }
type Config = Omit<CheckInput, 'labels'> & { labels: LabelSource | FileLabels }
type Options = { config: string | undefined; json: boolean; strict: boolean; platforms: Platform[] | undefined }

const USAGE = `usage: pretext-kit check-labels [--config <path>] [--json] [--strict] [--platform macos,windows,linux]\n`
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux']

function parse(args: string[]): Options {
  const options: Options = { config: undefined, json: false, strict: false, platforms: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--json') options.json = true
    else if (arg === '--strict') options.strict = true
    else if (arg === '--config' || arg === '--platform') {
      const value = args[++i]
      if (value === undefined) throw new RangeError(`${arg} needs a value`)
      if (arg === '--config') options.config = value
      else {
        const names = value.split(',')
        for (const name of names) {
          if (!PLATFORMS.includes(name as Platform)) throw new RangeError(`--platform: "${name}" is not one of ${PLATFORMS.join(', ')}`)
        }
        options.platforms = names as Platform[]
      }
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

function nest(target: Record<string, unknown>, value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RangeError('a locale file must be a JSON object')
  Object.assign(target, value)
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
    let data: unknown
    try {
      data = JSON.parse(readFileSync(resolve(configDir, path), 'utf8'))
    } catch (error) {
      throw new RangeError(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
    out[name] ??= {}
    nest(out[name]!, data)
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
  if (!Array.isArray(config.fonts)) throw new RangeError(`config ${path}: fonts must be an array`)
  const dir = dirname(absolute)
  return {
    ...config,
    labels: loadLabels(config.labels, dir),
    fonts: config.fonts.map((font) => (font.path === undefined ? font : { ...font, path: resolve(dir, font.path) })),
  }
}

function missing(issue: Issue): string {
  const parts: string[] = []
  if (issue.missing?.px !== undefined) parts.push(`${issue.missing.px}px too wide`)
  if (issue.missing?.fitsAtPx !== undefined) parts.push(`fits at ${issue.missing.fitsAtPx}px`)
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
  return `${lines.join('\n')}\n`
}

export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  if (command !== 'check-labels') {
    io.stderr(command === undefined ? USAGE : `unknown command "${command}"\n${USAGE}`)
    return 2
  }
  try {
    const options = parse(rest)
    const input = await loadConfig(resolve(io.cwd, options.config ?? 'labels.config.mjs'))
    if (options.platforms !== undefined) input.platforms = options.platforms
    const report = await checkLabels(input)
    const platforms = input.platforms ?? PLATFORMS
    io.stdout(options.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report, platforms))
    return report.failures.length > 0 || (options.strict && report.warnings.length > 0) ? 1 : 0
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
}

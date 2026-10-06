import type { Io } from './cli.ts'

const NEEDS = 'check-labels needs harfbuzzjs (and wawoff2 for WOFF2 fonts): npm i -D harfbuzzjs@1.6.2'

export function importFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: unknown } | null)?.code
  return code === 'ERR_MODULE_NOT_FOUND' && /['"]harfbuzzjs['"]/.test(message) ? NEEDS : message
}

// The bin shim imports this module alone: it must not pull in harfbuzzjs, so a missing install is
// reported here instead of as a stack trace.
export async function launch(argv: string[], io: Io, load: () => Promise<{ main: (argv: string[], io: Io) => Promise<number> }>): Promise<number> {
  let cli
  try {
    cli = await load()
  } catch (error) {
    io.stderr(`${importFailure(error)}\n`)
    return 2
  }
  return cli.main(argv, io)
}

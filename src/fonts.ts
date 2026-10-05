import { clearCache } from '@chenglou/pretext'

type FontsEvent = Event & { fontfaces?: readonly unknown[] }

export function watchFonts(onChange: () => void, fonts?: FontFaceSet): () => void {
  // Looked up through globalThis so Node and workers, which lack document, don't throw.
  const target = fonts ?? (globalThis as { document?: { fonts?: FontFaceSet } }).document?.fonts
  if (target === undefined) return () => {}

  const handle = (event: Event): void => {
    // loadingdone also fires for loads that finished nothing, which changed no widths.
    if (((event as FontsEvent).fontfaces?.length ?? 0) === 0) return
    // Prepared handles keep their old widths, so the cache must go before the app re-prepares.
    clearCache()
    onChange()
  }
  target.addEventListener('loadingdone', handle)
  return () => target.removeEventListener('loadingdone', handle)
}

import { layout, layoutNextLine, layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor, PreparedTextWithSegments } from '@chenglou/pretext'
import { FIT_TOLERANCE } from './fit.ts'

export type Tail = { width: number, spaceWidth: number }
export type ClampedLine = { text: string, width: number }
export type Clamped = { truncated: boolean, lineCount: number, lines: ClampedLine[] }

const START: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const NO_TAIL: Tail = { width: 0, spaceWidth: 0 }

// Browsers draw a clamp's ellipsis in the paragraph's first font, or three periods where
// that font has none, so the tail is measured in the paragraph's font. A lone space
// collapses to nothing, so a no-break space stands in for the space between words.
export function measureTail(text: string, font: string): Tail {
  return {
    width: measureNaturalWidth(prepareWithSegments(text, font)),
    spaceWidth: measureNaturalWidth(prepareWithSegments('\u00A0', font)),
  }
}

function trimEndSpace(text: string): string {
  return text.endsWith(' ') ? text.slice(0, -1) : text
}

// The start of the line at `start` that fits in `room`, cut between any two graphemes.
// Pretext's line stream ends a line only where the browser wraps, so the line is taken in
// pieces: each call takes the words that fit the room left, and once not even one word fits,
// the call breaks inside it, as overflow-wrap: break-word does. A piece's width leaves out
// the space it ended at, so that space is counted here.
export function fillLine(prepared: PreparedTextWithSegments, start: LayoutCursor, room: number, spaceWidth: number): ClampedLine {
  let text = ''
  let cursor = start
  let x = 0
  for (;;) {
    const piece = layoutNextLine(prepared, cursor, room - x)
    if (piece === null) return { text, width: x }
    if (piece.width > room - x + FIT_TOLERANCE) {
      // Blink's LineTruncator keeps one character whatever the room, so a cut that
      // would be empty keeps the first grapheme rather than showing a bare tail.
      // The width is what is painted, so a kept trailing space counts.
      if (text !== '') return { text, width: x }
      return { text: piece.text, width: piece.width + (piece.text.endsWith(' ') ? spaceWidth : 0) }
    }
    x += piece.width
    if (piece.text.endsWith(' ')) {
      if (x + spaceWidth > room) {
        const cut = text + piece.text.slice(0, -1)
        // A line that is only this space would be empty: keep it, as for a grapheme.
        return cut === '' ? { text: piece.text, width: x + spaceWidth } : { text: cut, width: x }
      }
      x += spaceWidth
    }
    text += piece.text
    cursor = piece.end
  }
}

// The first `maxLines` lines of a paragraph at `width`. When text is left over, the last
// line leaves `tail.width` free for an ellipsis or a link, the way browsers end a
// -webkit-line-clamp box (Blink's line_truncator.cc): the line breaks where it would
// without the clamp, the tail follows it if both fit, and otherwise the line is cut after
// the last grapheme that leaves the tail room.
export function clamp(prepared: PreparedTextWithSegments, width: number, maxLines: number, tail: Tail = NO_TAIL): Clamped {
  if (!(maxLines >= 1)) throw new RangeError('maxLines must be at least 1')
  const lines: ClampedLine[] = []
  let cursor = START
  let lastStart = START
  for (let i = 0; i < maxLines; i++) {
    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) return { truncated: false, lineCount: lines.length, lines }
    lines.push({ text: line.text, width: line.width })
    lastStart = cursor
    cursor = line.end
  }
  if (layoutNextLineRange(prepared, cursor, width) === null) return { truncated: false, lineCount: lines.length, lines }
  const last = lines.length - 1
  const line = lines[last]!
  // Same slack as Pretext's own line fit, or a line it just accepted is cut here.
  if (line.width + tail.width > width + FIT_TOLERANCE) lines[last] = fillLine(prepared, lastStart, width - tail.width, tail.spaceWidth)
  else lines[last] = { text: trimEndSpace(line.text), width: line.width }
  return { truncated: true, lineCount: lines.length, lines }
}

// layout() alone gives a clamped paragraph's line count and whether it is truncated, with no
// line built: all a list needs for the rows it doesn't paint.
export function clampStats(prepared: PreparedTextWithSegments, width: number, maxLines: number): { truncated: boolean, lineCount: number } {
  const total = layout(prepared, width, 1).lineCount
  return { truncated: total > maxLines, lineCount: Math.min(total, maxLines) }
}

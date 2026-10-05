import { layoutNextLine, layoutNextLineRange, layoutWithLines, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor, PreparedTextWithSegments } from '@chenglou/pretext'
import { fillLine } from './clamp.ts'
import { FIT_TOLERANCE } from './fit.ts'

export type PreparedLabel = {
  text: string
  prepared: PreparedTextWithSegments
  starts: LayoutCursor[]
  offsets: number[]
  ellipsisWidth: number
  spaceWidth: number
}

const START: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const ELLIPSIS = '…'
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Code-unit offset of a cursor in the source text. Pretext's cursors count graphemes
// inside segments, but callers hold string indexes, so the two are bridged here.
function offsetOf(segments: string[], cursor: LayoutCursor): number {
  let offset = 0
  for (let i = 0; i < cursor.segmentIndex; i++) offset += segments[i]!.length
  if (cursor.graphemeIndex === 0) return offset
  let seen = 0
  for (const part of graphemeSegmenter.segment(segments[cursor.segmentIndex]!)) {
    if (seen === cursor.graphemeIndex) break
    offset += part.segment.length
    seen++
  }
  return offset
}

export function prepareLabel(text: string, font: string): PreparedLabel {
  const prepared = prepareWithSegments(text, font)
  // A line no wider than 0 holds one grapheme, as under overflow-wrap: break-word, so the
  // lines' starts are every place the text can be cut.
  const graphemes = layoutWithLines(prepared, 0, 1).lines
  const starts: LayoutCursor[] = []
  const offsets: number[] = []
  for (let i = 0; i < graphemes.length; i++) {
    starts.push(graphemes[i]!.start)
    offsets.push(offsetOf(prepared.segments, graphemes[i]!.start))
  }
  return {
    text,
    prepared,
    starts,
    offsets,
    // A lone space collapses to nothing, so a no-break space stands in for it, as in measureTail.
    ellipsisWidth: measureNaturalWidth(prepareWithSegments(ELLIPSIS, font)),
    spaceWidth: measureNaturalWidth(prepareWithSegments(' ', font)),
  }
}

// One line that keeps a label's start and end around an ellipsis. With keepEnd, the end is
// everything from the grapheme at keepEnd.from (a path's file name with its slash) where the
// room holds it, so the cut never falls inside the name; otherwise the end is the longest
// run of graphemes that fits half the room. The start fills what is left. The stream only
// walks forward, so each candidate end is measured as the line from its first grapheme.
export function truncateMiddle(label: PreparedLabel, width: number, keepEnd?: { from: number }): string {
  const { prepared, starts, offsets } = label
  const whole = layoutNextLineRange(prepared, START, Number.POSITIVE_INFINITY)
  if (whole === null || whole.width <= width) return label.text
  const room = width - label.ellipsisWidth
  let nameStart = 0
  if (keepEnd !== undefined) {
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i]! <= keepEnd.from) nameStart = i
      else break
    }
  }
  if (nameStart > 0) {
    const name = layoutNextLine(prepared, starts[nameStart]!, Number.POSITIVE_INFINITY)
    if (name !== null && name.width <= room) {
      const head = fillLine(prepared, START, room - name.width, label.spaceWidth)
      // fillLine keeps one grapheme whatever the room, so with the name filling the room the
      // result would overrun the width; the half-room end below always leaves the start room.
      if (head.width + label.ellipsisWidth + name.width <= width + FIT_TOLERANCE) return head.text + ELLIPSIS + name.text
    }
  }
  let end = ''
  let endWidth = 0
  for (let i = starts.length - 1; i > 0; i--) {
    const rest = layoutNextLine(prepared, starts[i]!, Number.POSITIVE_INFINITY)
    if (rest === null || rest.width > room / 2) break
    end = rest.text
    endWidth = rest.width
  }
  return fillLine(prepared, START, room - endWidth, label.spaceWidth).text + ELLIPSIS + end
}

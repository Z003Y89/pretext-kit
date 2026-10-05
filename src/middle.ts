import { layoutNextLine, layoutNextLineRange, layoutWithLines, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor, PreparedTextWithSegments } from '@chenglou/pretext'
import { fillLine, measureTail } from './clamp.ts'
import { FIT_TOLERANCE } from './fit.ts'

export type PreparedLabel = {
  text: string
  font: string
  prepared: PreparedTextWithSegments
  starts: LayoutCursor[]
  offsets: number[]
  ellipsisWidth: number
  spaceWidth: number
  hyphenWidth: number
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
  // lines' starts are the places the text can be cut. WebKit keeps punctuation such as `/` on
  // the line of an overflowing first character in text above U+00FF, so a line there can hold
  // more; the graphemes after its first are cut points too, in the same segment.
  const lines = layoutWithLines(prepared, 0, 1).lines
  const starts: LayoutCursor[] = []
  const offsets: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const { start, end, text: lineText } = lines[i]!
    const inSegment = graphemeCount(prepared.segments[start.segmentIndex]!)
    let k = 0
    for (const _ of graphemeSegmenter.segment(lineText)) {
      const at = { segmentIndex: start.segmentIndex, graphemeIndex: start.graphemeIndex + k }
      const inLine = k === 0 || (at.graphemeIndex < inSegment && (end.segmentIndex > at.segmentIndex || end.graphemeIndex > at.graphemeIndex))
      if (!inLine) break
      starts.push(at)
      offsets.push(offsetOf(prepared.segments, at))
      k++
    }
  }
  const tail = measureTail(ELLIPSIS, font)
  return {
    text,
    font,
    prepared,
    starts,
    offsets,
    ellipsisWidth: tail.width,
    spaceWidth: tail.spaceWidth,
    hyphenWidth: tail.hyphenWidth,
  }
}

// The start that fills the room `end` leaves, around an ellipsis, checked against the whole
// result as Pretext measures it painted: the pieces were measured apart, and the joined text
// kerns and shapes across its seams, so where it comes out wider the start gives up the excess
// and is cut again. `fits` is false only when the start is down to the one grapheme it keeps.
function withStart(label: PreparedLabel, end: string, endWidth: number, width: number): { text: string, fits: boolean } {
  let room = width - label.ellipsisWidth - endWidth
  for (;;) {
    const head = fillLine(label.prepared, START, room, label)
    const text = head.text + ELLIPSIS + end
    const painted = measureNaturalWidth(prepareWithSegments(text, label.font))
    if (painted <= width + FIT_TOLERANCE) return { text, fits: true }
    if (graphemeCount(head.text) <= 1) return { text, fits: false }
    // Below the start's own width, so each round cuts at least one grapheme.
    room = head.width - (painted - width)
  }
}

function graphemeCount(text: string): number {
  let n = 0
  for (const _ of graphemeSegmenter.segment(text)) n++
  return n
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
    // The name is painted as text of its own after the ellipsis, so it is measured that way:
    // the line from inside the label's segment sums its graphemes one by one, and fonts kern.
    const nameWidth = name === null ? 0 : measureNaturalWidth(prepareWithSegments(label.text.slice(offsets[nameStart]), label.font))
    if (name !== null && nameWidth <= room) {
      // The start keeps one grapheme whatever the room, so with the name filling the room the
      // result would overrun the width; the half-room end below always leaves the start room.
      const kept = withStart(label, name.text, nameWidth, width)
      if (kept.fits) return kept.text
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
  return withStart(label, end, endWidth, width).text
}

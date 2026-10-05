// Derived from Pretext's pages/demos/ellipsis.model.ts (clampLines), MIT licence, Copyright (c) 2026
// Pretext contributors; see LICENSE. Its constants became parameters, and the cut is measured joined
// with the tail (src/cut.ts).

import { layout, layoutNextLine, layoutNextLineRange, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor, PrepareOptions, PreparedTextWithSegments } from '@chenglou/pretext'
import { graphemeEnds, longestPrefix, measureText, paintedWidth, trimCut } from './cut.ts'
import { FIT_TOLERANCE } from './fit.ts'

// The text painted after a clamped paragraph's last line (an ellipsis, "… more"), with the font
// and prepare options of the paragraph, so the cut can be measured joined to it.
export type Tail = { text: string, font: string, options?: PrepareOptions | undefined, width: number, spaceWidth: number }
export type ClampedLine = { text: string, width: number }
export type Clamped = { truncated: boolean, lineCount: number, lines: ClampedLine[] }

const START: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const NO_TAIL: Tail = { text: '', font: '', width: 0, spaceWidth: 0 }

// Browsers draw a clamp's ellipsis in the paragraph's first font, or three periods where
// that font has none, so the tail is measured in the paragraph's font, with the options the
// paragraph was prepared with. A lone space collapses to nothing, so a no-break space stands
// in for the space between words.
export function measureTail(text: string, font: string, options?: PrepareOptions): Tail {
  return {
    text,
    font,
    options,
    width: measureNaturalWidth(prepareWithSegments(text, font, options)),
    spaceWidth: measureNaturalWidth(prepareWithSegments('\u00A0', font, options)),
  }
}

// The first `maxLines` lines of a paragraph at `width`. When text is left over, the last
// line leaves room for the tail, the way browsers end a -webkit-line-clamp box (Blink's
// line_truncator.cc): the line breaks where it would without the clamp, the tail follows it if
// both fit, and otherwise the line is cut after the last grapheme that leaves the tail room,
// keeping one grapheme whatever the room, as Blink's LineTruncator keeps one character. The
// cut and the tail are measured as one text prepared alone (kerning applies within its segments,
// not across them), so the cut fits however its graphemes shape, and the next grapheme would
// overrun: it is locally the longest cut, not necessarily globally. A line Pretext ended at a
// soft hyphen paints a hyphen there; a cut runs on past it and paints none, since a browser
// cuts a truncated line between graphemes without hyphenating it.
export function clamp(prepared: PreparedTextWithSegments, width: number, maxLines: number, tail: Tail = NO_TAIL): Clamped {
  if (!(maxLines >= 1)) throw new RangeError('maxLines must be at least 1')
  const lines: ClampedLine[] = []
  let cursor = START
  for (let i = 0; i < maxLines; i++) {
    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) return { truncated: false, lineCount: lines.length, lines }
    lines.push({ text: line.text, width: line.width })
    cursor = line.end
  }
  if (layoutNextLineRange(prepared, cursor, width) === null) return { truncated: false, lineCount: lines.length, lines }
  const last = lines.length - 1
  const line = lines[last]!
  // White space the line ends with goes, unless it is all the line holds (a pre-wrap line of
  // spaces): the last line keeps at least one grapheme.
  const whole = trimCut(line.text)
  if (tail.text === '') {
    lines[last] = { text: whole, width: line.width }
    return { truncated: true, lineCount: lines.length, lines }
  }
  if (measureText(tail, whole + tail.text) <= width + FIT_TOLERANCE) {
    lines[last] = { text: whole, width: paintedWidth(tail, whole) }
    return { truncated: true, lineCount: lines.length, lines }
  }
  // The whole line does not fit with the tail, so the search never returns all of it; a line
  // ending at a soft hyphen loses its hyphen with its last grapheme.
  const cut = trimCut(longestPrefix(tail, whole, graphemeEnds(whole), width, prefix => prefix + tail.text))
  lines[last] = { text: cut, width: paintedWidth(tail, cut) }
  return { truncated: true, lineCount: lines.length, lines }
}

// layout() alone gives a clamped paragraph's line count and whether it is truncated, with no
// line built: all a list needs for the rows it doesn't paint.
export function clampStats(prepared: PreparedTextWithSegments, width: number, maxLines: number): { truncated: boolean, lineCount: number } {
  const total = layout(prepared, width, 1).lineCount
  return { truncated: total > maxLines, lineCount: Math.min(total, maxLines) }
}

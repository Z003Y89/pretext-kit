// Writes into a caller-owned buffer so repeated relayouts of a long list allocate nothing.
export function stack(heights: ArrayLike<number>, gap: number, tops: Float64Array): number {
  const count = heights.length
  let y = 0
  for (let i = 0; i < count; i++) {
    tops[i] = y
    y += heights[i]! + gap
  }
  // The trailing gap belongs to no row, so the total excludes it.
  return count === 0 ? 0 : y - gap
}

// Binary search rather than a scan: scroll handlers call this every frame on lists of thousands.
export function findIndexAt(tops: Float64Array, count: number, y: number): number {
  let lo = 0
  let hi = count - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (tops[mid]! <= y) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  // A y above the first row still belongs to row 0: callers use the result as a render start index.
  return found < 0 && count > 0 ? 0 : found
}

// Scroll offset to add after a relayout so the anchor row stays where the reader sees it.
export function anchorDelta(oldTops: Float64Array, newTops: Float64Array, anchor: number): number {
  return newTops[anchor]! - oldTops[anchor]!
}

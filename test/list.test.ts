import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stack, findIndexAt, anchorDelta } from '../src/list.ts'

// Deterministic generator so a failure reproduces.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function linearFind(tops: Float64Array, count: number, y: number): number {
  let found = -1
  for (let i = 0; i < count; i++) {
    if (tops[i]! <= y) found = i
    else break
  }
  // Above the first top clamps to row 0; only an empty list yields -1.
  return found < 0 && count > 0 ? 0 : found
}

test('stack fills tops with gaps and returns the total', () => {
  const tops = new Float64Array(3)
  assert.equal(stack([10, 20, 30], 4, tops), 68)
  assert.deepEqual([...tops], [0, 14, 38])
})

test('stack of nothing is 0', () => assert.equal(stack([], 4, new Float64Array(0)), 0))

test('findIndexAt is the last row whose top is at or above y', () => {
  const next = rng(1234)
  const count = 500
  const heights = new Float64Array(count)
  for (let i = 0; i < count; i++) heights[i] = 1 + Math.floor(next() * 50)
  const tops = new Float64Array(count)
  const total = stack(heights, 3, tops)
  for (let n = 0; n < 2000; n++) {
    const y = -10 + next() * (total + 20)
    assert.equal(findIndexAt(tops, count, y), linearFind(tops, count, y), `y=${y}`)
  }
  assert.equal(findIndexAt(tops, count, -5), 0)
  assert.equal(findIndexAt(tops, count, tops[7]!), 7)
  assert.equal(findIndexAt(tops, 0, 5), -1)
  // Entries past count are stale data and must never be returned.
  assert.equal(findIndexAt(tops, 10, total + 100), 9)
})

test('anchorDelta keeps the anchor row still', () => {
  assert.equal(anchorDelta(Float64Array.of(0, 14, 38), Float64Array.of(0, 30, 70), 1), 16)
})

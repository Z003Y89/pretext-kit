// Pretext accepts a line whose width exceeds the container by up to this much, to absorb float
// error in summed segment widths. Helpers that compare a measured width to a limit themselves
// (rather than asking Pretext to lay out) must use the same slack or they disagree with layout.
export const FIT_TOLERANCE = 1 / 64

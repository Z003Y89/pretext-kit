// The largest overshoot any engine paints (WebKit 1/64); Pretext's own layout slack is 0.005 on
// Blink/Gecko (measurement.ts lineFitEpsilon). Helpers that compare a measured width to a limit
// themselves (rather than asking Pretext to lay out) allow this much, so they never reject a width
// some engine's layout accepts. Internal: not exported from the package entry.
export const FIT_TOLERANCE = 1 / 64

// 95% upper bounds on a failure rate, as EVALUATION.md quotes them (PROTOCOL §4): used by verify/stats.ts and
// verify/check-labels.ts.
const Z = 1.959963984540054 // two-sided 95%

// Wilson score interval, upper end.
export function wilsonUpper(x: number, n: number): number {
  if (n === 0) return 1
  const p = x / n
  const z2 = Z * Z
  return (p + z2 / (2 * n) + Z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n)
}

// Exact (Clopper-Pearson) two-sided 95% interval, upper end: the p at which P(X <= x) = 0.025.
function binomCdf(x: number, n: number, p: number): number {
  let logTerm = n * Math.log1p(-p) // k = 0
  let sum = Math.exp(logTerm)
  for (let k = 1; k <= x; k++) {
    logTerm += Math.log(n - k + 1) - Math.log(k) + Math.log(p) - Math.log1p(-p)
    sum += Math.exp(logTerm)
  }
  return sum
}
export function clopperPearsonUpper(x: number, n: number): number {
  if (n === 0 || x >= n) return 1
  if (x === 0) return 1 - Math.pow(0.025, 1 / n)
  let lo = x / n
  let hi = 1
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (binomCdf(x, n, mid) > 0.025) lo = mid
    else hi = mid
  }
  return hi
}

export const pct = (v: number): string => v >= 0.01 ? `${(v * 100).toFixed(2)}%` : v >= 0.0001 ? `${(v * 100).toFixed(3)}%` : `${(v * 100).toFixed(4)}%`

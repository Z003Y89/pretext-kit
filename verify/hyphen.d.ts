// hyphen ships no types; only what corpora.ts and headless-cases.ts use is declared.
declare module 'hyphen/de/index.js' {
  const patterns: { hyphenateSync: (text: string) => string }
  export default patterns
}
declare module 'hyphen/fr/index.js' {
  const patterns: { hyphenateSync: (text: string) => string }
  export default patterns
}

// hyphen ships no types; only what corpora.ts uses is declared.
declare module 'hyphen/de/index.js' {
  const patterns: { hyphenateSync: (text: string) => string }
  export default patterns
}
declare module 'hyphen/fr/index.js' {
  const patterns: { hyphenateSync: (text: string) => string }
  export default patterns
}

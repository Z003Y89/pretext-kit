// hyphen ships no types; verify/hyphen.d.ts declares de and fr, this adds en-us for examples/build.ts.
declare module 'hyphen/en-us/index.js' {
  const patterns: { hyphenateSync: (text: string) => string }
  export default patterns
}

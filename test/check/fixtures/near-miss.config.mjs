// "Buchungen" fits its tab with 6/64 px to spare (CueFlow's report: it breaks with the next font change), and the
// config asks for a 2px margin.
export default {
  fonts: [{ family: 'Inter', path: '../../fonts/Inter-Regular.ttf' }],
  labels: { de: { tab: { bookings: 'Buchungen', home: 'Start' } } },
  slots: { tab: { width: 86.1328125, font: '16px Inter', policy: 'as-is', uses: ['tab.*'] } },
  nearMiss: 2,
}

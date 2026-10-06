export default {
  fonts: [{ family: 'Inter', path: '../../fonts/Inter-Regular.ttf' }],
  labels: { files: 'locales/*.json' },
  slots: {
    button: { width: 90, font: '16px Inter', policy: 'as-is', uses: ['button.*'] },
    title: { width: 200, font: '16px Inter', policy: { truncate: 'end', lines: 1 }, uses: ['title.*'] },
    tool: { width: 100, font: '16px Inter', policy: 'as-is' },
  },
  rows: {
    toolbar: {
      width: 220,
      gap: 8,
      items: [
        { key: 'toolbar.save', slot: 'tool' },
        { key: 'toolbar.share', slot: 'tool', collapse: { order: 1, iconWidth: 20 } },
      ],
    },
  },
  conditions: [{ name: 'default' }],
}

// A menu slot without overflow-wrap: break-word, where a long German word cannot break; the same slot with it,
// and a condition that turns it on for the menu.
export default {
  fonts: [{ family: 'Inter', path: '../../fonts/Inter-Regular.ttf' }],
  labels: { de: { menu: { notifications: 'Benachrichtigungen' }, wrap: { notifications: 'Benachrichtigungen' } } },
  slots: {
    menu: { width: 120, font: '16px Inter', policy: { lines: 2 }, overflowWrap: 'normal', uses: ['menu.*'] },
    wrap: { width: 120, font: '16px Inter', policy: { lines: 2 }, uses: ['wrap.*'] },
  },
  conditions: [{ name: 'default' }, { name: 'break-words', slots: { menu: { overflowWrap: 'break-word' } } }],
}

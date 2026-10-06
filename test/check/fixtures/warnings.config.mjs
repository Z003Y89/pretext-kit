import config from './labels.config.mjs'

export default { ...config, labels: { files: 'locales/*.json' }, slots: { title: config.slots.title }, rows: {} }

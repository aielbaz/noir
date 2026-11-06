const plugin = require('tailwindcss/plugin')

// Chromium 79 (webOS 6) has no flexbox `gap` (added in 84). main.tsx tags <html>
// with `no-flex-gap` when that's the case, and these rules reproduce gap-* on
// flex containers with sibling margins. Grid gaps work natively.
const flexGapFallback = plugin(({ addBase, theme }) => {
  const rules = {}
  for (const [key, value] of Object.entries(theme('gap') ?? {})) {
    const cls = `.gap-${key.replace('.', '\\.')}`
    rules[`.no-flex-gap .flex${cls} > * + *`] = { marginLeft: value }
    rules[`.no-flex-gap .flex.flex-col${cls} > * + *`] = { marginLeft: '0', marginTop: value }
  }
  addBase(rules)
})

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Figtree Variable'", 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@vidstack/react/tailwind.cjs'), flexGapFallback],
}

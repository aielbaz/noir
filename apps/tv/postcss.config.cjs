// Chromium 79 does not understand the `inset` shorthand (Chrome 87+), which
// Tailwind emits for inset-0 and friends. Expand it to the four sides.
const expandInset = () => ({
  postcssPlugin: 'expand-inset',
  Declaration: {
    inset(decl) {
      const parts = decl.value.trim().split(/\s+/)
      const [top, right = top, bottom = top, left = right] = parts
      decl.cloneBefore({ prop: 'top', value: top })
      decl.cloneBefore({ prop: 'right', value: right })
      decl.cloneBefore({ prop: 'bottom', value: bottom })
      decl.cloneBefore({ prop: 'left', value: left })
      decl.remove()
    },
  },
})
expandInset.postcss = true

module.exports = {
  plugins: [require('tailwindcss'), require('autoprefixer'), expandInset()],
}

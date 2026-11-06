// Chromium 79 (webOS 6) lacks many newer built-ins that libraries assume.
import './polyfills'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { init } from '@noriginmedia/norigin-spatial-navigation'

import './index.css'
import App from './App.tsx'
import { hoverToFocus } from './components/focusable.tsx'
import { wheelToScroll } from './utils/wheel-scroll.ts'
import { queryClient, persister, CACHE_MAX_AGE } from './react-query/client.ts'

// Flexbox `gap` arrived in Chromium 84. Detect it so the CSS fallback in
// tailwind.config.cjs can take over on older TVs.
{
  const probe = document.createElement('div')
  probe.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden'
  probe.innerHTML = '<div style="height:1px"></div><div style="height:1px"></div>'
  document.body.appendChild(probe)
  if (probe.scrollHeight !== 3) document.documentElement.classList.add('no-flex-gap')
  probe.remove()
}

// Real DOM focus follows the spatial-navigation focus, so :focus styles,
// scrollIntoView and the webOS on-screen keyboard all work as expected.
init({ shouldFocusDOMNode: true, useGetBoundingClientRect: true })

wheelToScroll()
hoverToFocus()

// focus() scrolls on its own, and this Chromium centres an element that is wholly out of
// view: stepping onto the next card past a row's edge would jump the row by several cards.
// Focusables scroll themselves into view (see `reveal` in components/focusable.tsx), with
// just the movement needed, so the browser's own scroll is switched off.
const nativeFocus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function (options?: FocusOptions) {
  nativeFocus.call(this, { ...options, preventScroll: true })
}

// The font ships inside the app (see index.css). Start loading it now and hold the
// first render until it is ready (or 2 s have passed), so no text ever appears in
// the fallback font and then jumps.
const fontReady = Promise.race([
  document.fonts.load('400 16px "Figtree Variable"').catch(() => undefined),
  new Promise(resolve => setTimeout(resolve, 2000)),
])

fontReady.then(() => createRoot(document.getElementById('root')!).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: "v2",
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist === true,
      },
    }}>
    <App />
  </PersistQueryClientProvider>,
))

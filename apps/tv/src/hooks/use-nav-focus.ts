import { useSyncExternalStore } from 'react'

// Whether focus is in the navigation rail (anything marked `data-nav`). Read straight from the document,
// so it needs no state of its own.
const subscribe = (notify: () => void) => {
  document.addEventListener('focusin', notify)
  document.addEventListener('focusout', notify)
  return () => {
    document.removeEventListener('focusin', notify)
    document.removeEventListener('focusout', notify)
  }
}
const inNav = () => !!document.activeElement?.closest('[data-nav]')

export const useNavFocus = () => useSyncExternalStore(subscribe, inNav)

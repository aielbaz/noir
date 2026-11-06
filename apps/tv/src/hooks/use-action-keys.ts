import { useRef, type KeyboardEvent, type MouseEvent } from 'react'

const LONG_PRESS_MS = 600
const KEY_YELLOW = 405

// Remote-friendly "press" vs "hold" on one element:
//   tap OK  -> onPress        hold OK / yellow button -> onLongPress
// Mouse (Magic Remote pointer) clicks always call onPress.
export function useActionKeys(onPress: () => void, onLongPress?: () => void) {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  // A press only counts if OK went down on this element. Otherwise pressing OK on
  // something that navigates here (e.g. the rail) would "click" whatever gets
  // focus first on the new page when the key is released.
  const armed = useRef(false)

  return {
    onKeyDown(e: KeyboardEvent) {
      if (e.keyCode === KEY_YELLOW && onLongPress) {
        e.preventDefault()
        onLongPress()
      } else if (e.key === 'Enter') {
        e.preventDefault() // stop the browser's own click so we can time the press
        if (e.repeat) return
        armed.current = true
        fired.current = false
        if (onLongPress) {
          timer.current = window.setTimeout(() => {
            fired.current = true
            onLongPress()
          }, LONG_PRESS_MS)
        }
      }
    },
    onKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Enter' || !armed.current) return
      armed.current = false
      window.clearTimeout(timer.current)
      if (!fired.current) onPress()
    },
    onClick(e: MouseEvent) {
      // detail is 0 for keyboard-synthesised clicks (e.g. Space), which we ignore.
      if (e.detail > 0) onPress()
    },
  }
}

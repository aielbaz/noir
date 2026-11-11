import { useEffect, useRef, useState } from 'react'
import { useBackHandler } from './use-back-handler'

const NOTICE_MS = 2500 // how long "Back again to exit" waits for the second press

// The first Back only asks "press again to exit"; a second one while the notice is up leaves.
// `disabled` lets Back mean just Back (a menu or an error screen is up). Returns whether to show the notice.
export function useExitNotice(disabled: boolean) {
  const [shown, setShown] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useBackHandler(() => {
    if (disabled || shown) return false
    setShown(true)
    timer.current = window.setTimeout(() => setShown(false), NOTICE_MS)
    return true
  }, 1)
  return shown
}

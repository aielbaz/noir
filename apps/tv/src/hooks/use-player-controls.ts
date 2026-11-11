import { useCallback, useEffect, useRef, useState } from 'react'

const HIDE_AFTER_MS = 4000

// What has focus in the controls: the progress bar (Left/Right seek), the time label, or a button.
export const BAR = -1
export const TIME_LABEL = -3 // the elapsed/remaining time, which toggles on OK
export const PLAY_BUTTON = 1
export const BUTTON_COUNT = 5 // back 10s, play/pause, forward 10s, speed, audio & subtitles

// The controls fade in on activity and out after a few seconds. They stay up while paused, while a seek is
// staged or a menu / the error screen is up (`held`), unless the user put them away. Focus is kept across
// hiding; which key brings them back decides what is focused then (Up or Down: the play button).
export function usePlayerControls({ paused, held }: { paused: boolean; held: boolean }) {
  const [awake, setAwake] = useState(true)
  const awakeRef = useRef(true)
  useEffect(() => { awakeRef.current = awake })
  // Put away by the user (Up from the bar, Down from the buttons): stays hidden even while paused, until the next key.
  const [dismissed, setDismissed] = useState(false)
  const timer = useRef(0)
  const [focus, setFocus] = useState(BAR)
  const focusRef = useRef(BAR)

  const visible = awake || (paused && !dismissed) || held
  const visibleRef = useRef(true)
  useEffect(() => { visibleRef.current = visible })

  const wake = useCallback(() => {
    setDismissed(false)
    setAwake(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAwake(false), HIDE_AFTER_MS)
  }, [])

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setDismissed(true)
    setAwake(false)
  }, [])

  const moveFocus = useCallback((index: number) => {
    focusRef.current = index
    setFocus(index)
  }, [])

  // Opening the player shows the controls; every timer is dropped on the way out.
  useEffect(() => {
    wake() // eslint-disable-line react-hooks/set-state-in-effect -- opening the player shows the controls
    return () => window.clearTimeout(timer.current)
  }, [wake])

  // For key handlers, which must see the latest values without re-subscribing.
  const isVisible = useCallback(() => visibleRef.current, [])
  const isAwake = useCallback(() => awakeRef.current, [])
  const focused = useCallback(() => focusRef.current, [])

  return { visible, focus, wake, hide, moveFocus, isVisible, isAwake, focused }
}

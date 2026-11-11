import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { useBackHandler } from './use-back-handler'

// Seeking never touches the video while keys are down: presses and holds only move a "scrub" position
// (shown on the bar), and one real seek happens once the user has had time to change their mind, so the
// stream loads once, not per step. Until then Back cancels it and OK confirms it at once.
//
// Press: one 10s step. Held: after a short pause, the position moves in small, frequent steps whose speed
// grows the longer the key stays down (10s per quarter second -> ~50s after 3s -> ~270s after 5s). Each step
// covers the time since the last one, so the speed doesn't depend on how fast a remote repeats keys.
const COMMIT_DELAY_MS = 1200 // long enough to change your mind
const LANDING_MS = 8000 // give up waiting for a confirmed jump to land after this long
const END_MARGIN = 5 // seconds: seeking never lands closer than this to the end, which would end the film
const HOLD_DELAY_MS = 450
const HOLD_INTERVAL_MS = 60 // at most one step per this long
const TAP_STEP = 10

// Distance per quarter second after holding for `heldMs`.
const holdStep = (heldMs: number, duration: number) => {
  const step = TAP_STEP * Math.pow(1.75, heldMs / 1000)
  return Math.min(step, Math.max(120, duration / 15))
}

export function useSeek(player: RefObject<MediaPlayerInstance | null>, { enabled, canSeek }: {
  enabled: boolean // false for live TV
  canSeek: () => boolean // false until a saved position has been applied: the resume would land on top of the seek
}) {
  // The target while the user scrubs; null when nothing is staged.
  const [scrub, setScrub] = useState<number | null>(null)
  // Where playback was when the scrub began.
  const [scrubFrom, setScrubFrom] = useState<number | null>(null)
  // The jump has been sent: too late to cancel. (The ref is for key handlers, the state for the screen.)
  const [sent, setSent] = useState(false)
  const sentRef = useRef(false)
  // Counts finished seeks, so the bar can re-place its knob on each.
  const [ended, setEnded] = useState(0)
  const targetRef = useRef<number | null>(null)
  const timer = useRef(0)
  const hold = useRef({ since: 0, last: 0 })

  const end = useCallback(() => {
    window.clearTimeout(timer.current)
    setEnded(n => n + 1)
    sentRef.current = false
    setSent(false)
    targetRef.current = null
    setScrub(null)
    setScrubFrom(null)
  }, [])

  const stage = useCallback((delta: number) => {
    const p = player.current
    if (!p || !enabled || !canSeek()) return
    window.clearTimeout(timer.current)
    sentRef.current = false // a new press makes it something that can be cancelled again
    setSent(false)
    if (targetRef.current == null) setScrubFrom(p.currentTime)
    const base = targetRef.current ?? p.currentTime
    // A jump to the very end would end the film (and autoplay the next episode): stop just short of it,
    // unless playback is already past that point, where a forward press mustn't go backwards.
    const limit = Number.isFinite(p.duration) ? Math.max(p.duration - END_MARGIN, base) : Infinity
    targetRef.current = Math.min(limit, Math.max(0, base + delta))
    setScrub(targetRef.current)
  }, [player, enabled, canSeek])

  // `delay` 0 jumps now: OK on the bar confirms a staged seek without waiting.
  const commit = useCallback((delay = COMMIT_DELAY_MS) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const p = player.current
      const target = targetRef.current
      if (!p || target == null) return
      p.currentTime = target
      sentRef.current = true
      setSent(true)
      // Keep showing the target until the seek lands (or give up if it never does).
      timer.current = window.setTimeout(end, LANDING_MS)
    }, delay)
  }, [player, end])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Back while a seek is still waiting to be confirmed drops it and stays on the same spot,
  // instead of leaving the player. Once the jump has been sent, Back works as usual.
  useBackHandler(() => {
    if (targetRef.current == null || sentRef.current) return false
    end()
    return true
  }, 3)

  // Buttons and the rewind / fast-forward keys: the same staged jump as the arrows.
  const by = useCallback((delta: number) => { stage(delta); commit() }, [stage, commit])

  // A click on the bar.
  const to = useCallback((target: number) => {
    const p = player.current
    if (!p || !enabled || !Number.isFinite(p.duration)) return
    stage(target - (targetRef.current ?? p.currentTime))
    commit()
  }, [player, enabled, stage, commit])

  // An arrow pressed or auto-repeating.
  const holdKey = useCallback((direction: 1 | -1, e: KeyboardEvent) => {
    const p = player.current
    if (!p) return
    const now = performance.now()
    const h = hold.current
    if (!e.repeat) {
      hold.current = { since: now, last: now }
      return stage(direction * TAP_STEP)
    }
    const heldFor = now - h.since
    if (heldFor < HOLD_DELAY_MS || now - h.last < HOLD_INTERVAL_MS) return
    // holdStep is the distance per quarter second; scale it to the time since the last step.
    const step = holdStep(heldFor, p.duration || 0) * Math.min(now - h.last, 250) / 250
    h.last = now
    stage(direction * step)
  }, [player, stage])

  // A key let go. Letting go of an arrow ends the hold and starts the wait for confirming. Other keys (OK
  // confirming it, say) must not start that wait again, and a seek already sent is left alone.
  const release = useCallback((arrow: boolean) => {
    hold.current = { since: 0, last: 0 }
    if (arrow && targetRef.current != null && !sentRef.current) commit()
  }, [commit])

  // OK on the bar: jump now instead of waiting.
  const confirmNow = useCallback(() => { if (targetRef.current != null) commit(0) }, [commit])

  // The video reports that a seek finished: if it is the one we sent, the scrub is over.
  const landed = useCallback(() => {
    const p = player.current
    if (targetRef.current != null && p && Math.abs(p.currentTime - targetRef.current) < 3) end()
  }, [player, end])

  return { scrub, scrubFrom, sent, ended, by, to, hold: holdKey, release, confirmNow, landed }
}

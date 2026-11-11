import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { getProgress } from '../utils/progress'

const MIN_RESUME = 5 // seconds: less than this isn't worth jumping to
const GIVE_UP_MS = 15000

// Opening a film part-way in: jump to the saved position as soon as the stream can be sought. The TV only
// reports seekable ranges after canplay, and a seek before then is silently dropped, so wait for the range
// instead of seeking on canplay.
export function useResume(player: RefObject<MediaPlayerInstance | null>, id: string | undefined, attempt: number) {
  const [resumeAt, setResumeAt] = useState(() => getProgress(id)?.position ?? 0)
  const resumed = useRef(false)
  // The bar glides between ticks of the clock, but never while a film opens part-way in: it stays still
  // until the stream has loaded and the clock is at the saved position (see `reached`), however long
  // that takes. It is switched off again if the stream has to reconnect and jump back.
  const [glides, setGlides] = useState(() => resumeAt <= MIN_RESUME)
  const armed = useRef(false)

  useEffect(() => {
    if (resumeAt <= MIN_RESUME) { resumed.current = true; return }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const video = document.querySelector('video')
      // Never trap the user: if the position can't be applied in a while, let seeking through.
      if (!resumed.current && Date.now() - startedAt > GIVE_UP_MS) resumed.current = true
      if (resumed.current || !video || !player.current || video.seekable.length === 0) return
      if (video.seekable.end(video.seekable.length - 1) <= resumeAt) return
      player.current.currentTime = resumeAt
      resumed.current = true
    }, 200)
    return () => window.clearInterval(timer)
  }, [player, resumeAt, attempt])

  // False until the saved position has been applied: until then the clock is still near 0, so nothing
  // should be saved from it or seeked from it.
  const settled = useCallback(() => !(resumeAt > MIN_RESUME && !resumed.current), [resumeAt])

  // Called as the clock moves (once settled): gliding starts when the stream has loaded around the saved position and the clock is there.
  const reached = useCallback((currentTime: number) => {
    if (armed.current || currentTime < resumeAt - 3) return
    const video = document.querySelector('video')
    if (video && video.readyState >= 3 && video.buffered.length > 0 && video.buffered.end(video.buffered.length - 1) >= currentTime) {
      armed.current = true
      window.setTimeout(() => setGlides(true), 400) // lets the buffered range settle too
    }
  }, [resumeAt])

  // The stream dropped: pick up from `at` again once it is back.
  const restartAt = useCallback((at: number) => {
    if (at <= MIN_RESUME) return
    resumed.current = false
    armed.current = false
    setGlides(false)
    setResumeAt(at)
  }, [])

  return { settled, glides, reached, restartAt }
}

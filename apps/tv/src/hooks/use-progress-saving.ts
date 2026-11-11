import { useCallback, useEffect, useRef } from 'react'
import { saveProgress } from '../utils/progress'

const SAVE_EVERY_MS = 5000

// Remembers where the user is in a film or episode, so it can be resumed and shown under Continue Watching.
export function useProgressSaving({ id, group, name, image, type, streamUrl }: {
  id?: string
  group?: string
  name?: string
  image?: string
  type?: string
  streamUrl: string
}) {
  const latest = useRef({ position: 0, duration: 0 })
  const lastSaved = useRef(0)
  const trackable = type !== 'live' && !!id && !!group && (type === 'movie' || type === 'episode')

  const persist = useCallback(() => {
    if (!trackable) return
    const { position, duration } = latest.current
    saveProgress({ id: id!, group: group!, kind: type as 'movie' | 'episode', name: name ?? 'Untitled', image, streamUrl, position, duration })
  }, [trackable, id, group, type, name, image, streamUrl])

  // Save on the way out (Back key, zapping, next episode) as well as periodically.
  useEffect(() => persist, [persist])

  // The TV can kill the app from the Home button without unmounting anything.
  useEffect(() => {
    const onHide = () => persist()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [persist])

  // Called as the clock moves.
  const record = useCallback((position: number, duration: number) => {
    latest.current = { position, duration }
    if (Date.now() - lastSaved.current > SAVE_EVERY_MS) {
      lastSaved.current = Date.now()
      persist()
    }
  }, [persist])
  const position = useCallback(() => latest.current.position, [])

  return { persist, record, position }
}

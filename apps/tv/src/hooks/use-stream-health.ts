import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECONNECTS = 3
const START_TIMEOUT_MS = 6000

// True once the stream has delivered anything (HLS can buffer before the TV marks it ready).
export function hasData() {
  const video = document.querySelector('video')
  return !!video && (video.readyState >= 2 || video.currentTime > 0 || (video.buffered.length > 0 && video.buffered.end(0) > 0))
}

// Streams drop often: reconnect a few times before giving up and showing the error screen. A movie picks up
// where it broke instead of starting over (`beforeReconnect` records the position). The TV's media pipeline
// doesn't always report a dead stream (no error, just an endless spinner), so a start that takes too long
// counts as one. `reload` makes the player start the stream again.
export function useStreamHealth({ isLive, attempt, streamUrl, reload, beforeReconnect }: {
  isLive: boolean
  attempt: number
  streamUrl: string
  reload: () => void
  beforeReconnect: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [retries, setRetries] = useState(0)
  const reconnects = useRef(0)
  const before = useRef(beforeReconnect)
  useEffect(() => { before.current = beforeReconnect })

  const fail = useCallback((message: string) => {
    if (reconnects.current < MAX_RECONNECTS) {
      reconnects.current += 1
      setRetries(reconnects.current)
      before.current()
      setReconnecting(true)
      window.setTimeout(reload, 500)
      return
    }
    setReconnecting(false)
    setError(message || 'This stream could not be played.')
  }, [reload])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasData()) fail('The stream took too long to start.')
    }, isLive ? START_TIMEOUT_MS * 3 : START_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [attempt, streamUrl, isLive, fail])

  // The player says it can play (vidstack can report that for a source that never loaded: checked here).
  const playable = useCallback(() => {
    if (!hasData()) return
    setError(null)
    setReconnecting(false)
    reconnects.current = 0
    setRetries(0)
  }, [])

  // Retry on the error screen.
  const retry = useCallback(() => {
    setError(null)
    reconnects.current = 0
    setRetries(0)
    before.current()
    reload()
  }, [reload])

  return { error, reconnecting, retries, fail, playable, retry, maxRetries: MAX_RECONNECTS }
}

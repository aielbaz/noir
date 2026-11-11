import { useCallback, useEffect, useRef, useState } from 'react'

const START_LAG = 30 // seconds a fresh HLS start sits behind the newest segment
const DRIFT_MIN = 8 // seconds of extra delay before we call it "behind"

// The TV doesn't report the live edge (its seekable range is stale), so estimate how far behind live the
// picture is: a stream starts about START_LAG behind, and every second the clock stops while real time
// keeps going (pause, buffering) adds to it. `reload` brings the stream back at the live edge.
export function useLiveDelay(isLive: boolean, streamKey: unknown, reload: () => void) {
  const [behind, setBehind] = useState(0)
  const behindRef = useRef(0)
  useEffect(() => { behindRef.current = behind })
  const base = useRef<{ wall: number; media: number } | null>(null)

  useEffect(() => {
    base.current = null
    if (!isLive) return
    const t = window.setInterval(() => {
      const video = document.querySelector('video')
      if (!video || video.currentTime <= 0) return
      const b = base.current ??= { wall: Date.now(), media: video.currentTime }
      const drift = (Date.now() - b.wall) / 1000 - (video.currentTime - b.media)
      setBehind(drift > DRIFT_MIN ? Math.round((START_LAG + drift) / 5) * 5 : 0)
    }, 1000)
    return () => window.clearInterval(t)
  }, [isLive, streamKey])

  const catchUp = useCallback(() => {
    base.current = null
    setBehind(0)
    reload()
  }, [reload])
  const isBehind = useCallback(() => behindRef.current > 0, [])

  return { behind, isBehind, catchUp }
}

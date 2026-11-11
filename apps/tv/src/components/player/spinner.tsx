import { useEffect, useEffectEvent, useState } from 'react'
import { cn } from '../../utils/cn'
import { MAX_RECONNECTS } from '../../hooks/use-stream-health'

// A frozen picture that nothing reports: after this long without the clock moving
// and without anything new arriving the stream is treated as dropped and reconnected.
const STALL_MS = 25_000

export default function Spinner({ reconnecting, retry, onStall }: { reconnecting: boolean; retry: number; onStall: () => void }) {
  // The TV's media pipeline leaves canPlay/waiting/seeking stale, so judge from
  // the video element itself: loading is shown exactly while the clock isn't
  // advancing (and the video isn't paused or finished). Data buffering ahead
  // doesn't count against it: measured on the TV, a slow start sits at
  // readyState 2 with the buffer growing while nothing plays.
  const [stuck, setStuck] = useState(true)
  const stalled = useEffectEvent(onStall)
  useEffect(() => {
    let last = 0
    let lastMove = Date.now()
    let lastBuffered = 0
    let stuckSince = 0
    const t = window.setInterval(() => {
      const video = document.querySelector('video')
      const now = video?.currentTime ?? 0
      if (now !== last) { last = now; lastMove = Date.now() }
      const buffered = video && video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0
      const idle = !!video && (video.paused || video.ended)
      const frozen = !idle && Date.now() - lastMove >= 1500
      setStuck(frozen || !video)
      // Still downloading is slow, not dead: only a frozen clock with a frozen buffer counts.
      if (buffered > lastBuffered + 0.1) stuckSince = 0
      lastBuffered = buffered
      if (!frozen) { stuckSince = 0; return }
      stuckSince ||= Date.now()
      if (Date.now() - stuckSince > STALL_MS) { stuckSince = 0; stalled() }
    }, 500)
    return () => window.clearInterval(t)
  }, [])
  const show = reconnecting || stuck

  // Plain loading stays wordless; only a dropped connection explains itself.
  return (
    <div className={cn('pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300', show ? 'opacity-100' : 'opacity-0')}>
      <div className="size-16 animate-spin rounded-full border-4 border-white/15 border-t-white/90" />
      {reconnecting && (
        <>
          <p className="mt-6 text-2xl font-medium text-white">Connection lost — reconnecting…</p>
          <p className="mt-2 text-lg text-white/60">Attempt {retry} of {MAX_RECONNECTS}</p>
        </>
      )}
    </div>
  )
}


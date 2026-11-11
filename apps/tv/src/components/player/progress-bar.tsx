import { useMediaState } from '@vidstack/react'
import { cn } from '../../utils/cn'
import { clamp, formatTime } from './format'

// While seeking, the target moves in steps; sliding each one linearly makes them run into each other
// instead of stopping and starting (an ease-out would pause at every step).
const SCRUB_GLIDE = 'transition-[width,left] duration-150 ease-linear'

// Not filled until the duration is known: before metadata arrives time is 0/0,
// which would otherwise read as 100%.
// While scrubbing it shows three things at once: where playback is now (a tick), where the
// jump will land (the knob and a bubble with its time), and the stretch between.
export default function ProgressBar({ onSeek, focused, scrub, from, glide, seekEnds }: {
  glide: boolean
  seekEnds: number
  onSeek: (fraction: number) => void
  focused: boolean
  scrub: number | null
  from: number | null
}) {
  const mediaTime = useMediaState('currentTime')
  const duration = useMediaState('duration')
  const bufferedEnd = useMediaState('bufferedEnd')
  const ready = Number.isFinite(duration) && duration > 0
  const scrubbing = scrub !== null && from !== null && ready
  const currentTime = scrub ?? mediaTime
  const pct = ready ? clamp((currentTime / duration) * 100) : 0
  const fromPct = scrubbing ? clamp((from / duration) * 100) : 0
  const lo = Math.min(pct, fromPct)
  const hi = Math.max(pct, fromPct)

  return (
    <div
      className="group relative flex h-8 w-full cursor-pointer items-center"
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
      }}
    >
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150', focused || scrubbing ? 'h-3' : 'h-2')}>
        <div className={cn('absolute inset-0 origin-left bg-white/30', glide && 'transition-transform duration-500 ease-linear')} style={{ transform: `scaleX(${ready ? clamp((bufferedEnd / duration) * 100) / 100 : 0})` }} />
        {scrubbing ? (
          <>
            {/* Played up to the nearer of the two points; the stretch being jumped over is tinted. */}
            <div className={cn('absolute inset-y-0 left-0 bg-white', SCRUB_GLIDE)} style={{ width: `${lo}%` }} />
            <div className={cn('absolute inset-y-0 bg-[#1a98ff]', SCRUB_GLIDE)} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          </>
        ) : (
          <div className={cn('absolute inset-0 origin-left bg-white', glide && 'transition-transform duration-300 ease-linear')} style={{ transform: `scaleX(${pct / 100})` }} />
        )}
      </div>

      {scrubbing && (
        <>
          {/* Where playback is until the jump happens. */}
          <div className="pointer-events-none absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${fromPct}%` }} />
          <div className={cn('pointer-events-none absolute bottom-full z-10 mb-1 transition-[left,transform] duration-150 ease-linear')} style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}>
            <div className="flex flex-col items-center rounded-xl bg-[#111418] px-5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
              <span className="text-3xl font-semibold tabular-nums text-white">{formatTime(scrub)}</span>
            </div>
          </div>
        </>
      )}
      {/* The knob shows where the playhead is, and grows when the bar has focus or is being scrubbed. */}
      {ready && (
        <div
          // A new element each time a seek ends: the fill snaps back to the playing position (a cancelled
          // seek, say), so the knob must be placed there too instead of gliding back on its own.
          key={seekEnds}
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(0,0,0,0.35)]',
            focused || scrubbing ? 'size-6' : 'size-4',
          )}
          // Position and size have their own timing: the position follows the fill under it (so they never
          // drift apart), while the size change is a short quick one that doesn't depend on how it is moving.
          style={{
            left: `${pct}%`,
            transition: `left ${scrubbing ? 150 : glide ? 300 : 0}ms linear, width 150ms ease-out, height 150ms ease-out`,
          }}
        />
      )}
    </div>
  )
}


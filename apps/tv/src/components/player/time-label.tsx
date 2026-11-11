import { useMediaState } from '@vidstack/react'
import { cn } from '../../utils/cn'
import { useClock } from '../../hooks/use-clock'
import { formatTime } from './format'

const finishClock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Always the real playing time: while seeking, the target lives in the bubble on the bar and this
// only changes once the jump has actually happened.
export default function TimeLabel({ className, remaining, focused, onToggle }: {
  className?: string
  remaining: boolean
  focused: boolean
  onToggle: () => void
}) {
  const currentTime = useMediaState('currentTime')
  const duration = useMediaState('duration')
  const rate = useMediaState('playbackRate')
  const ready = Number.isFinite(duration) && duration > 0
  // While paused nothing else re-renders, but the finish time keeps moving: the shared clock refreshes it.
  const now = useClock()
  const left = ready ? Math.max(0, duration - currentTime) : 0
  const endsAt = ready ? now + (left / (rate || 1)) * 1000 : 0

  return (
    <div className={cn('flex items-center font-medium tabular-nums', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={remaining ? 'Showing time remaining' : 'Showing time elapsed'}
        className={cn('-ml-3 rounded-lg px-3 py-1 transition-colors duration-150', focused ? 'bg-white' : 'hover:bg-white/10')}
      >
        <span className={cn('text-4xl', focused ? 'text-black' : 'text-white')}>
          {ready ? (remaining ? `-${formatTime(left)}` : formatTime(currentTime)) : formatTime(0)}
        </span>
        <span className={cn('mx-3 text-3xl', focused ? 'text-black/40' : 'text-white/30')}>/</span>
        <span className={cn('text-3xl', focused ? 'text-black/70' : 'text-white/60')}>{ready ? formatTime(duration) : '--:--'}</span>
      </button>
      {ready && <span className="ml-5 flex-none text-xl text-white/50">Ends {finishClock(endsAt)}</span>}
    </div>
  )
}


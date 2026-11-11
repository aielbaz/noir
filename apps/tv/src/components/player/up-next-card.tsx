import { useEffect, useState } from 'react'
import { useMediaState } from '@vidstack/react'
import { useBackHandler } from '../../hooks/use-back-handler'
import { cn } from '../../utils/cn'
import { PlayIcon } from '../icons'
import Ratio, { WIDE } from '../ratio'
import { KEY } from './keys'

const UP_NEXT_SECONDS = 60 // the card shows in the last minute

// "Up next": the next episode's picture and name, what the keys do, and (with autoplay on) how long
// until it starts, which is when the current episode ends. It decides for itself when to show (the last
// minute), and Back hides it for the rest of this episode. OK plays the next episode now.
export default function UpNextCard({ episode, enabled, autoplay, raised, onPlay }: {
  episode: { name: string; image?: string }
  enabled: boolean
  autoplay: boolean
  raised: boolean // the controls are up: sit above them, or drop to the corner when they are away
  onPlay: () => void
}) {
  const currentTime = useMediaState('currentTime')
  const duration = useMediaState('duration')
  const [dismissed, setDismissed] = useState(false)
  const [broken, setBroken] = useState(false)
  const left = duration - currentTime
  const showing = enabled && !dismissed && duration > 0 && left < UP_NEXT_SECONDS

  useBackHandler(() => {
    if (!showing) return false
    setDismissed(true)
    return true
  }, 2)

  useEffect(() => {
    if (!showing) return
    // Capture phase, so OK plays the next episode before anything else treats it as play/pause.
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== KEY.enter) return
      e.preventDefault()
      e.stopImmediatePropagation()
      onPlay()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showing, onPlay])

  if (!showing) return null
  const key = 'rounded-md bg-white/15 px-2 py-0.5 text-sm font-semibold text-white'
  return (
    <div className={cn('absolute right-16 z-20 w-[32rem] overflow-hidden rounded-2xl bg-[#111418]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-[bottom] duration-300', raised ? 'bottom-[17rem]' : 'bottom-12')}>
      <div className="flex">
        <Ratio ratio={WIDE} className="w-52 flex-none bg-[#1b2026]" innerClassName="flex items-center justify-center">
          {/* Providers' pictures often fail to load: a play mark stands in for them. */}
          {episode.image && !broken
            ? <img src={episode.image} alt="" decoding="async" onError={() => setBroken(true)} className="size-full object-cover" />
            : <PlayIcon className="size-12 text-white/50" />}
        </Ratio>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Up next{autoplay && left > 0 && <span className="normal-case tracking-normal"> · starts in {Math.ceil(left)}s</span>}
          </p>
          <p className="mt-1 line-clamp-2 text-xl font-semibold text-white">{episode.name}</p>
          <div className="mt-3 flex items-center gap-5 text-sm text-white/60">
            <span className="flex items-center gap-2"><span className={key}>OK</span>Play now</span>
            <span className="flex items-center gap-2"><span className={key}>Back</span>Hide</span>
          </div>
        </div>
      </div>
    </div>
  )
}


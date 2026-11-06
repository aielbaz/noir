import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { cn } from '../utils/cn'

// Artwork already shown this session. The provider's images carry no real cache
// lifetime, so the browser keeps re-checking them; remembering them here lets a
// remounted card show its picture at once instead of blanking and fading in again.
const shown = new Set<string>()

// A list being scrolled through at speed (a key held down) mounts hundreds of cards
// that are gone a moment later. Their pictures aren't requested while that lasts,
// so when it stops the network is free for the ones actually on screen.
let scrolling = false
const listeners = new Set<() => void>()
export function setFastScrolling(value: boolean) {
  if (scrolling === value) return
  scrolling = value
  listeners.forEach(l => l())
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

const PRELOAD_DELAY = 600 // cards near the screen (not on it) load a moment after the visible ones

// Image that fades in once decoded and falls back to the title if it fails.
// Providers' artwork is slow and often broken, so both states matter.
export default function Poster({ src, title, contain = false, className }: {
  src?: string
  title: string
  contain?: boolean
  className?: string
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(src ? (shown.has(src) ? 'ready' : 'loading') : 'error')
  // Cached pictures show at once; the rest start loading when they are on screen (or soon after, if just near it).
  const [requested, setRequested] = useState(() => !!src && shown.has(src))
  const fast = useSyncExternalStore(subscribe, () => scrolling)
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const el = ref.current
    if (requested || fast || !el) return
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) setRequested(true) })
    observer.observe(el)
    const timer = window.setTimeout(() => setRequested(true), PRELOAD_DELAY)
    return () => { observer.disconnect(); window.clearTimeout(timer) }
  }, [requested, fast])

  if (state === 'error') {
    return <span className="p-4 text-center text-sm text-[#667684]">{title}</span>
  }

  return (
    <img
      ref={ref}
      src={requested ? src : undefined}
      alt=""
      decoding="async"
      onLoad={() => { if (src) shown.add(src); setState('ready') }}
      onError={() => setState('error')}
      className={cn(
        'transition-opacity duration-300',
        state === 'ready' ? 'opacity-100' : 'opacity-0',
        contain ? 'size-[80%] object-contain' : 'size-full rounded-lg object-cover',
        className,
      )}
    />
  )
}

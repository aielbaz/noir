import { createLazyFileRoute, useRouter, useRouterState } from '@tanstack/react-router'
import type { PlayerSearch } from './player'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MediaPlayer,
  MediaProvider,
  isHLSProvider,
  useAudioOptions,
  useCaptionOptions,
  useMediaState,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
} from '@vidstack/react'
import '@vidstack/react/player/styles/base.css'

import { useApp } from '../context/app-provider'
import { useEpg } from '../hooks/use-epg'
import { formatSize, useStreamSize } from '../hooks/use-stream-size'
import { getProgress, saveProgress } from '../utils/progress'
import { SPEEDS, getSettings, useSettings } from '../utils/settings'
import { getChannelList, getEpisodeQueue } from '../utils/playback-context'
import { addRecentChannel } from '../utils/recents'
import { streamUrl as buildStreamUrl } from '../utils/xtream'
import { cn } from '../utils/cn'
import { buttonClass } from '../components/button'
import { BackIcon, CaptionsIcon, Forward10Icon, PauseIcon, PlayIcon, Replay10Icon, RetryIcon } from '../components/icons'


const CONTROLS_TIMEOUT = 4000
const SEEK_STEP = 10
const CONTROL_COUNT = 5 // back 10s, play/pause, forward 10s, speed, audio & subtitles
type PanelKind = 'speed' | 'tracks'
const PLAY_BUTTON = 1
const BACK_BUTTON = -2
const BAR = -1
const TIME_LABEL = -3 // the elapsed/remaining time, which toggles on OK
const REMAINING_KEY = 'streambox_time_remaining'
const UP_NEXT_SECONDS = 25
const MAX_RECONNECTS = 3
const LIVE_START_LAG = 30 // seconds a fresh HLS start sits behind the newest segment
const LIVE_DRIFT_MIN = 8 // seconds of extra delay before we call it "behind"
const START_TIMEOUT_MS = 6000

// Key codes: standard keyboard plus the LG remote's media/channel keys.
const KEY = {
  enter: 13, space: 32, left: 37, up: 38, right: 39, down: 40,
  pageUp: 33, pageDown: 34, playPause: 179,
  rewind: 412, stop: 413, play: 415, fastForward: 417, pause: 19,
  channelUp: 427, channelDown: 428,
} as const

// Providers usually serve live streams as .ts but also expose HLS at .m3u8,
// which is what browsers can actually play.
const processUrl = (url: string, isLive: boolean) =>
  isLive && url.endsWith('.ts') ? url.replace(/\.ts$/, '.m3u8') : url

const getType = (url: string) =>
  url.endsWith('.m3u8') ? ('application/x-mpegurl' as const) : ('video/mp4' as const)

// hls.js ships next to the app as its own file (see vite.config.ts) and is only
// fetched if the player really needs it: the TV plays HLS natively, so the main
// script stays half the size. Not pulled from a CDN, which the TV may block.
function onProviderChange(provider: MediaProviderAdapter | null) {
  if (isHLSProvider(provider)) {
    provider.library = './hls.min.js' // vidstack loads it as a script and reads window.Hls
  }
}

// Seeking never touches the video while keys are down: presses and holds only
// move a "scrub" position (shown on the bar and clock), and one real seek happens
// shortly after the last key is released, so the stream loads once, not per step.
// Press: one 10s step. Held: after a short pause, a step every 250ms that
// multiplies the longer the key stays down (10s -> ~50s after 3s -> ~270s after 5s).
// Driven by elapsed time, not key-repeat events, whose rate varies by remote.
const HOLD_DELAY_MS = 450
const HOLD_INTERVAL_MS = 250
const COMMIT_DELAY_MS = 350
const holdStep = (heldMs: number, duration: number) => {
  const step = 10 * Math.pow(1.75, heldMs / 1000)
  return Math.min(step, Math.max(120, duration / 15))
}

const clock = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })


// Remounted per stream, so zapping channels or advancing episodes starts every
// piece of per-stream state (resume point, retries, progress) from scratch.
export const Route = createLazyFileRoute('/player')({ component: RouteComponent })

function RouteComponent() {
  const search = Route.useSearch()
  return search.streamUrl ? <PlayerView key={search.streamUrl} search={search} /> : <NoStream />
}

function NoStream() {
  const { stopPlay } = useApp()
  useEffect(() => stopPlay(), [stopPlay])
  return null
}

function PlayerView({ search }: { search: PlayerSearch }) {
  const { creds, stopPlay, play } = useApp()
  const player = useRef<MediaPlayerInstance>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const lastPointer = useRef({ x: 0, y: 0 })
  const [awake, setAwake] = useState(true)
  const awakeRef = useRef(true)
  awakeRef.current = awake
  // Live only: how far the picture has fallen behind the live edge.
  const [behind, setBehind] = useState(0)
  const behindRef = useRef(0)
  behindRef.current = behind
  const [paused, setPaused] = useState(false)
  // Focus: -2 back button, -1 progress bar (Left/Right seek), 0..3 control buttons.
  const focusRef = useRef(-1)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const settings = useSettings()
  const [rate, setRate] = useState(() => getSettings().defaultSpeed)
  const router = useRouter()
  // The audio & subtitles panel lives in the history stack (as location state),
  // so the TV's Back key closes it first instead of leaving the player.
  const panel = useRouterState({ select: s => (s.location.state as { panel?: PanelKind } | undefined)?.panel })
  const panelOpen = !!panel
  const [upNext, setUpNext] = useState(false)

  const [resumeAt, setResumeAt] = useState(() => getProgress(search.id)?.position ?? 0)
  const resumed = useRef(false)
  const reconnects = useRef(0)
  const hold = useRef({ since: 0, last: 0 })
  const latest = useRef({ position: 0, duration: 0 })
  const lastSaved = useRef(0)
  const panelOpenRef = useRef(false)
  panelOpenRef.current = panelOpen

  const openPanel = useCallback((kind: PanelKind = 'tracks') => {
    if (!panelOpenRef.current) router.history.push(router.state.location.href, { panel: kind })
  }, [router])
  const closePanel = useCallback(() => {
    if (panelOpenRef.current) router.history.back()
  }, [router])

  const { id, group, name, image, type, streamUrl: currentUrl = '' } = search
  const streamSize = useStreamSize(type, id, group)
  // Elapsed or remaining time on the left of the bar: a viewing habit, so it is remembered.
  const [showRemaining, setShowRemaining] = useState(() => localStorage.getItem(REMAINING_KEY) === '1')
  const toggleRemaining = useCallback(() => {
    setShowRemaining(v => {
      try { localStorage.setItem(REMAINING_KEY, v ? '0' : '1') } catch { /* storage full: just this session */ }
      return !v
    })
  }, [])
  const isLive = type === 'live'
  const liveId = isLive && id?.startsWith('live:') ? Number(id.slice(5)) : undefined
  const epg = useEpg(liveId)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is module state that only changes with the channel
  const channels = useMemo(() => (isLive ? getChannelList() : []), [isLive, id])
  const channelIndex = channels.findIndex(c => c.stream_id === liveId)

  const queue = !isLive ? getEpisodeQueue() : []
  const queueIndex = queue.findIndex(q => q.id === id)
  const nextEpisode = queueIndex >= 0 ? queue[queueIndex + 1] : undefined

  // Jump to the saved position as soon as the stream can be sought. The TV only
  // reports seekable ranges after canplay, and a seek before then is silently
  // dropped, so wait for the range instead of seeking on canplay.
  useEffect(() => {
    if (resumeAt <= 5) { resumed.current = true; return }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const video = document.querySelector('video')
      // Never trap the user: if the position can't be applied in a while, let seeking through.
      if (!resumed.current && Date.now() - startedAt > 15000) resumed.current = true
      if (resumed.current || !video || !player.current || video.seekable.length === 0) return
      if (video.seekable.end(video.seekable.length - 1) <= resumeAt) return
      player.current.currentTime = resumeAt
      resumed.current = true
    }, 200)
    return () => window.clearInterval(timer)
  }, [resumeAt, attempt])

  const trackable = !isLive && !!id && !!group && (type === 'movie' || type === 'episode')

  const persist = useCallback(() => {
    if (!trackable) return
    const { position, duration } = latest.current
    saveProgress({ id: id!, group: group!, kind: type as 'movie' | 'episode', name: name ?? 'Untitled', image, streamUrl: currentUrl, position, duration })
  }, [trackable, id, group, type, name, image, currentUrl])

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

  const wake = useCallback(() => {
    setAwake(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      setAwake(false)
      focusRef.current = -1 // hidden controls: Left/Right go back to plain seeking
      setFocusIndex(-1)
    }, CONTROLS_TIMEOUT)
  }, [])

  const moveFocus = useCallback((index: number) => {
    focusRef.current = index
    setFocusIndex(index)
  }, [])

  // Pending target while the user scrubs; null when the clock should show real time.
  const [scrub, setScrub] = useState<number | null>(null)
  const scrubRef = useRef<number | null>(null)
  const commitTimer = useRef<number | undefined>(undefined)
  const stageSeek = useCallback((delta: number) => {
    const p = player.current
    // Ignore seeking until the saved position has been applied, otherwise the
    // resume would land on top of (or be replaced by) what the user just did.
    if (!p || isLive || (resumeAt > 5 && !resumed.current)) return
    window.clearTimeout(commitTimer.current)
    const base = scrubRef.current ?? p.currentTime
    scrubRef.current = Math.min(p.duration || Infinity, Math.max(0, base + delta))
    setScrub(scrubRef.current)
  }, [isLive, resumeAt])
  const commitSeek = useCallback(() => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => {
      const p = player.current
      const target = scrubRef.current
      if (!p || target == null) return
      p.currentTime = target
      // Keep showing the target until the seek lands (or give up if it never does).
      commitTimer.current = window.setTimeout(() => { scrubRef.current = null; setScrub(null) }, 4000)
    }, COMMIT_DELAY_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(commitTimer.current), [])

  const seekBy = useCallback((delta: number) => {
    const p = player.current
    if (!p || isLive || (resumeAt > 5 && !resumed.current)) return
    p.currentTime = Math.min(p.duration || Infinity, Math.max(0, p.currentTime + delta))
  }, [isLive, resumeAt])

  const togglePlay = useCallback(() => {
    const p = player.current
    if (!p) return
    if (p.paused) p.play(); else p.pause()
  }, [])

  // Pointer remotes jitter constantly; only a real movement counts as activity.
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const { x, y } = lastPointer.current
    if (Math.hypot(e.clientX - x, e.clientY - y) < 12) return
    lastPointer.current = { x: e.clientX, y: e.clientY }
    wake()
  }, [wake])

  const zap = useCallback((delta: number) => {
    if (!creds || channels.length < 2 || channelIndex < 0) return
    const target = channels[(channelIndex + delta + channels.length) % channels.length]
    addRecentChannel(target)
    play({
      name: target.name,
      type: 'live',
      streamUrl: buildStreamUrl(creds, 'live', target.stream_id!),
      id: `live:${target.stream_id}`,
      image: target.stream_icon || undefined,
    }, { replace: true })
  }, [creds, channels, channelIndex, play])

  const playNextEpisode = useCallback(() => {
    if (!nextEpisode) return
    play({
      name: nextEpisode.name,
      type: 'episode',
      streamUrl: nextEpisode.streamUrl,
      id: nextEpisode.id,
      group: nextEpisode.group,
      image: nextEpisode.image,
    }, { replace: true })
  }, [nextEpisode, play])

  // Show the controls when playback opens, and drop every timer on the way out.
  // (Kept apart from the key handler below: that effect re-subscribes whenever
  // its callbacks change, and must not re-show the controls each time.)
  useEffect(() => {
    wake() // eslint-disable-line react-hooks/set-state-in-effect -- opening the player shows the controls
    return () => {
      window.clearTimeout(hideTimer.current)
    }
  }, [wake])

  // The TV doesn't report the live edge (its seekable range is stale), so estimate:
  // a stream starts about LIVE_START_LAG behind, and every second the clock stops
  // while real time keeps going (pause, buffering) adds to it.
  const liveBase = useRef<{ wall: number; media: number } | null>(null)
  useEffect(() => {
    liveBase.current = null
    if (!isLive) return
    const t = window.setInterval(() => {
      const video = document.querySelector('video')
      if (!video || video.currentTime <= 0) return
      const base = liveBase.current ??= { wall: Date.now(), media: video.currentTime }
      const drift = (Date.now() - base.wall) / 1000 - (video.currentTime - base.media)
      setBehind(drift > LIVE_DRIFT_MIN ? Math.round((LIVE_START_LAG + drift) / 5) * 5 : 0)
    }, 1000)
    return () => window.clearInterval(t)
  }, [isLive, attempt, currentUrl])

  // Reload the stream: it comes back at the live edge.
  const goLive = useCallback(() => {
    liveBase.current = null
    setBehind(0)
    setAttempt(a => a + 1)
  }, [])

  // Remote control.
  useEffect(() => {
    const seek = seekBy
    // OK on a focused control button.
    const activate = (index: number) => {
      if (index === 0) seekBy(-SEEK_STEP)
      else if (index === PLAY_BUTTON) togglePlay()
      else if (index === 2) seekBy(SEEK_STEP)
      else openPanel(index === 3 ? 'speed' : 'tracks')
    }
    // Press: one 10s jump. Held: paced, accelerating jumps (see holdStep).
    const seekHeld = (direction: 1 | -1, e: KeyboardEvent) => {
      const p = player.current
      if (!p) return
      const now = performance.now()
      const h = hold.current
      if (!e.repeat) {
        hold.current = { since: now, last: now }
        return stageSeek(direction * 10)
      }
      const heldFor = now - h.since
      if (heldFor < HOLD_DELAY_MS || now - h.last < HOLD_INTERVAL_MS) return
      const step = holdStep(heldFor, p.duration || 0)
      h.last = now
      stageSeek(direction * step)
    }
    const onKeyUp = () => {
      hold.current = { since: 0, last: 0 }
      if (scrubRef.current != null) commitSeek()
    }
    const onKey = (e: KeyboardEvent) => {
      if (panelOpenRef.current) return
      // Focused buttons (error overlay): the spatial-navigation library swallows
      // OK before the browser can click them, so click them here.
      if (e.target instanceof HTMLButtonElement) {
        if (e.keyCode === KEY.enter) e.target.click()
        // Nothing else moves DOM focus here, so step between sibling buttons ourselves.
        else if (e.keyCode === KEY.left || e.keyCode === KEY.right) {
          const next = e.keyCode === KEY.left ? e.target.previousElementSibling : e.target.nextElementSibling
          if (next instanceof HTMLButtonElement) { e.preventDefault(); next.focus() }
        }
        return
      }
      const p = player.current
      if (!p) return
      let handled = true
      switch (e.keyCode) {
        case KEY.enter:
          if (upNext) playNextEpisode()
          else if (isLive) { if (awakeRef.current || p.paused) togglePlay() } // hidden overlay: OK only brings it up (every handled key does)
          else if (focusRef.current === BACK_BUTTON) stopPlay()
          else if (focusRef.current === TIME_LABEL) toggleRemaining()
          else if (focusRef.current >= 0) activate(focusRef.current)
          else togglePlay()
          break
        case KEY.space: case KEY.playPause: togglePlay(); break
        case KEY.play: p.play(); break
        case KEY.pause: p.pause(); break
        case KEY.stop: stopPlay(); break
        case KEY.left:
          if (isLive || focusRef.current === BACK_BUTTON || focusRef.current === TIME_LABEL) break
          else if (focusRef.current === 0) moveFocus(TIME_LABEL)
          else if (focusRef.current >= 0) moveFocus(focusRef.current - 1)
          else seekHeld(-1, e)
          break
        case KEY.right:
          if (isLive) { if (behindRef.current) goLive(); break } // Right = catch up to live
          if (focusRef.current === BACK_BUTTON) break
          if (focusRef.current === TIME_LABEL) moveFocus(0)
          else if (focusRef.current >= 0) moveFocus(Math.min(CONTROL_COUNT - 1, focusRef.current + 1))
          else seekHeld(1, e)
          break
        case KEY.rewind: seek(-30); break
        case KEY.fastForward: if (isLive) { if (behindRef.current) goLive() } else seek(30); break
        // On live TV the arrows only wake the overlay (too easy to zap by accident);
        // channels change with the remote's CH keys.
        case KEY.channelUp: case KEY.pageUp: if (isLive && !e.repeat) zap(-1); break
        case KEY.up:
          if (isLive) break
          else if (focusRef.current >= 0 || focusRef.current === TIME_LABEL) moveFocus(BAR)
          else if (focusRef.current === BAR) moveFocus(BACK_BUTTON)
          break
        case KEY.down:
          if (isLive) break
          else if (focusRef.current === BACK_BUTTON) moveFocus(BAR)
          else if (focusRef.current === BAR) moveFocus(PLAY_BUTTON)
          break
        case KEY.channelDown: case KEY.pageDown: if (isLive && !e.repeat) zap(1); break
        default: handled = false
      }
      if (handled) {
        e.preventDefault()
        wake()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isLive, upNext, stopPlay, wake, seekBy, stageSeek, commitSeek, togglePlay, toggleRemaining, moveFocus, openPanel, zap, playNextEpisode, goLive])

  // Error screen: Left/Right/OK pick between Retry and Back. Capture phase, so the
  // spatial-navigation library (which listens first and swallows keys) can't eat them.
  useEffect(() => {
    if (!error) return
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== KEY.left && e.keyCode !== KEY.right && e.keyCode !== KEY.enter) return
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-error-actions] button'))
      if (!buttons.length) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (e.keyCode === KEY.enter) (buttons[current] ?? buttons[0]).click()
      else buttons[e.keyCode === KEY.left ? Math.max(0, current - 1) : Math.min(buttons.length - 1, current + 1)].focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [error])

  function resumeFromLatest() {
    const at = latest.current.position
    if (isLive || at <= 5) return
    resumed.current = false
    setResumeAt(at)
  }

  // The TV's media pipeline doesn't always report a dead stream (no error,
  // just an endless spinner), so a start that takes too long counts as one.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasData()) handleError('The stream took too long to start.')
    }, isLive ? START_TIMEOUT_MS * 3 : START_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, currentUrl])

  function handleError(message: string) {
    // Streams drop often; reconnect a few times before giving up. A movie
    // picks up where it broke instead of starting over.
    if (reconnects.current < MAX_RECONNECTS) {
      reconnects.current += 1
      resumeFromLatest()
      setReconnecting(true)
      window.setTimeout(() => setAttempt(a => a + 1), 500)
      return
    }
    setReconnecting(false)
    setError(message || 'This stream could not be played.')
  }

  const src = { src: processUrl(currentUrl, isLive), type: getType(processUrl(currentUrl, isLive)) }
  // Controls and title stay up while paused (VOD), otherwise they time out.
  const visible = awake || paused || !!error || panelOpen
  const now = Date.now() / 1000
  const epgProgress = epg.current ? Math.min(100, Math.max(0, ((now - epg.current.start) / (epg.current.end - epg.current.start)) * 100)) : 0

  return (
    <main
      className={cn('relative flex h-screen w-full items-center justify-center overflow-hidden bg-black', !visible && 'cursor-none')}
      onPointerMove={onPointerMove}
      onPointerDown={wake}
    >
      <MediaPlayer
        key={attempt}
        ref={player}
        src={src}
        autoPlay
        // The TV plays HLS natively and quickly; through hls.js its MSE never reports
        // the appended data, so live streams sat frozen for ~40 s.
        preferNativeHLS
        playbackRate={isLive ? 1 : rate}
        playsInline
        streamType={isLive ? 'live' : 'on-demand'}
        className="h-full w-full bg-black font-sans"
        onProviderChange={onProviderChange}
        onCanPlay={() => {
          // Vidstack can report canplay for a source that never loaded.
          if (!hasData()) return
          setError(null)
          setReconnecting(false)
          reconnects.current = 0
        }}
        onSeeked={() => {
          const p = player.current
          if (scrubRef.current != null && p && Math.abs(p.currentTime - scrubRef.current) < 3) {
            window.clearTimeout(commitTimer.current)
            scrubRef.current = null
            setScrub(null)
          }
        }}
        onPlay={() => setPaused(false)}
        onPause={() => { setPaused(true); persist() }}
        onTimeUpdate={({ currentTime }) => {
          // Until the saved position is applied the clock is still near 0; saving
          // that would overwrite where the user actually was.
          if (resumeAt > 5 && !resumed.current) return
          const duration = player.current?.duration ?? 0
          latest.current = { position: currentTime, duration }
          if (Date.now() - lastSaved.current > 5000) {
            lastSaved.current = Date.now()
            persist()
          }
          const soon = settings.upNextCard && !!nextEpisode && duration > 0 && duration - currentTime < UP_NEXT_SECONDS
          if (soon !== upNext) setUpNext(soon)
        }}
        onEnded={() => { persist(); if (nextEpisode && settings.autoplayNext) playNextEpisode(); else stopPlay() }}
        onError={e => handleError(e.message)}
      >
        <MediaProvider className="size-full [&>video]:size-full [&>video]:object-contain" />

        {!error && <Spinner reconnecting={reconnecting} retry={reconnects.current} onStall={() => handleError('Playback stalled.')} />}

        {/* Title + controls: one layer that fades in on activity and out after a few seconds. */}
        <div className={cn('absolute inset-0 transition-opacity duration-300', visible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26rem] bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

          <button
            onClick={stopPlay}
            aria-label="Back"
            className={cn(
              'absolute left-12 top-10 flex size-14 items-center justify-center rounded-full transition duration-150',
              focusIndex === BACK_BUTTON ? 'scale-110 bg-white text-black' : 'bg-white/10 text-white hover:bg-white/25',
            )}
          >
            <BackIcon className="size-7" />
          </button>

          <div className="absolute inset-x-0 bottom-0 px-16 pb-12">
            {streamSize && (
              <span className="mb-3 inline-block rounded-md bg-white px-3 py-0.5 text-sm font-semibold text-black">{formatSize(streamSize)}</span>
            )}
            <div className="mb-6 flex items-center gap-4">
              {isLive && (
                <span className={cn('flex items-center rounded-md px-3 py-1.5 text-sm font-semibold tracking-wider text-white', behind || paused ? 'bg-white/20' : 'bg-red-600')}>
                  <span className={cn('mr-2.5 size-2 rounded-full bg-white', !behind && !paused && 'animate-pulse')} />
                  {behind ? `~${behind}s BEHIND` : paused ? 'PAUSED' : 'LIVE'}
                </span>
              )}
              <h1 dir="auto" className="truncate text-4xl font-semibold text-white">{name}</h1>
              {isLive && channelIndex >= 0 && <span className="text-2xl text-white/50">CH {channelIndex + 1}</span>}
              {search.channelGroup && <span className="truncate text-xl text-white/50">{search.channelGroup}</span>}
              {isLive && behind > 0 && (
                <div className="flex flex-1 justify-end">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={goLive}
                    className="tv-focus flex items-center rounded-full bg-white py-3 pl-6 pr-5 text-xl font-semibold text-black"
                  >
                    <span className="mr-3 size-2.5 rounded-full bg-red-600" />
                    Go live
                    <svg viewBox="0 0 24 24" className="ml-2 size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </div>
              )}
            </div>

            {isLive ? (
              <div className="max-w-4xl space-y-3">
                {epg.current ? (
                  <>
                    <p className="text-2xl text-white">
                      {epg.current.title}
                      <span className="ml-4 text-lg text-white/50">{clock(epg.current.start)} – {clock(epg.current.end)}</span>
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: `${epgProgress}%` }} />
                    </div>
                    {epg.next && <p className="text-lg text-white/50">Next · {epg.next.title} · {clock(epg.next.start)}</p>}
                  </>
                ) : (
                  <p className="text-lg text-white/40">No programme information</p>
                )}
              </div>
            ) : (
              <>
                <ProgressBar scrub={scrub} focused={focusIndex === BAR} onSeek={fraction => {
                  const p = player.current
                  if (p && Number.isFinite(p.duration)) p.currentTime = fraction * p.duration
                }} />
                {/* Three equal-width zones keep the buttons exactly centred. */}
                <div className="mt-5 flex items-center">
                  <div className="flex-1">
                    <TimeLabel scrub={scrub} remaining={showRemaining} focused={focusIndex === TIME_LABEL} onToggle={toggleRemaining} />
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <RoundButton label="Back 10 seconds" focused={focusIndex === 0} onClick={() => seekBy(-SEEK_STEP)}><Replay10Icon className="size-9" /></RoundButton>
                    <RoundButton label={paused ? 'Play' : 'Pause'} focused={focusIndex === 1} onClick={togglePlay} large>
                      {paused ? <PlayIcon className="size-9" /> : <PauseIcon className="size-9" />}
                    </RoundButton>
                    <RoundButton label="Forward 10 seconds" focused={focusIndex === 2} onClick={() => seekBy(SEEK_STEP)}><Forward10Icon className="size-9" /></RoundButton>
                  </div>
                  <div className="flex flex-1 items-center justify-end gap-3">
                    <RoundButton label="Playback speed" focused={focusIndex === 3} onClick={() => openPanel('speed')}><span className="text-xl font-bold">{rate}×</span></RoundButton>
                    <RoundButton label="Audio and subtitles" focused={focusIndex === 4} onClick={() => openPanel('tracks')}><CaptionsIcon className="size-9" /></RoundButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {upNext && nextEpisode && (
          <div className="absolute bottom-80 right-16 z-20 w-80 rounded-lg bg-[#111418] p-5 shadow-xl">
            <p className="text-sm text-white/50">Up next</p>
            <p className="mt-1 line-clamp-2 text-lg font-semibold text-white">{nextEpisode.name}</p>
            <p className="mt-3 text-sm text-[#1a98ff]">Press OK to play now</p>
          </div>
        )}

        {panel === 'speed' && <SpeedMenu onClose={closePanel} rate={rate} onRate={setRate} />}
        {panel === 'tracks' && <TrackMenu onClose={closePanel} />}

        {error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black text-center">
            <p className="text-2xl text-white">Couldn't play this stream</p>
            <p className="max-w-xl text-base text-white/50">{error}</p>
            <div data-error-actions className="flex gap-4">
              <button autoFocus onClick={() => { setError(null); reconnects.current = 0; resumeFromLatest(); setAttempt(a => a + 1) }} className={cn(buttonClass('primary'), 'focus:ring-4 focus:ring-[#1a98ff]')}>
                <RetryIcon className="mr-3 size-6" />
                Retry
              </button>
              <button onClick={stopPlay} className={cn(buttonClass('secondary'), 'focus:ring-4 focus:ring-[#1a98ff]')}>
                <BackIcon className="mr-3 size-6" />
                Back
              </button>
            </div>
          </div>
        )}
      </MediaPlayer>
    </main>
  )
}

const clamp = (n: number) => Math.min(100, Math.max(0, n))

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Not filled until the duration is known: before metadata arrives time is 0/0,
// which would otherwise read as 100%.
function ProgressBar({ onSeek, focused, scrub }: { onSeek: (fraction: number) => void; focused: boolean; scrub: number | null }) {
  const mediaTime = useMediaState('currentTime')
  const currentTime = scrub ?? mediaTime
  const duration = useMediaState('duration')
  const bufferedEnd = useMediaState('bufferedEnd')
  const ready = Number.isFinite(duration) && duration > 0

  return (
    <div
      className="group relative flex h-8 w-full cursor-pointer items-center"
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
      }}
    >
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150', focused ? 'h-3' : 'h-2')}>
        <div className="absolute inset-0 origin-left bg-white/30 transition-transform duration-500 ease-linear" style={{ transform: `scaleX(${ready ? clamp((bufferedEnd / duration) * 100) / 100 : 0})` }} />
        <div className="absolute inset-0 origin-left bg-white transition-transform duration-300 ease-linear" style={{ transform: `scaleX(${ready ? clamp((currentTime / duration) * 100) / 100 : 0})` }} />
      </div>
    </div>
  )
}

// Read at render time on purpose: the finish time is wall clock plus what is left.
const wallClock = () => Date.now()
const finishClock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function TimeLabel({ className, scrub, remaining, focused, onToggle }: {
  className?: string
  scrub?: number | null
  remaining: boolean
  focused: boolean
  onToggle: () => void
}) {
  const mediaTime = useMediaState('currentTime')
  const currentTime = scrub ?? mediaTime
  const duration = useMediaState('duration')
  const rate = useMediaState('playbackRate')
  const ready = Number.isFinite(duration) && duration > 0
  // While paused nothing re-renders, but the finish time keeps moving: refresh it now and then.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => tick(n => n + 1), 20_000)
    return () => window.clearInterval(t)
  }, [])
  const left = ready ? Math.max(0, duration - currentTime) : 0
  const endsAt = ready ? wallClock() + (left / (rate || 1)) * 1000 : 0

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

// True once the stream has delivered anything (HLS can buffer before the TV marks it ready).
function hasData() {
  const video = document.querySelector('video')
  return !!video && (video.readyState >= 2 || video.currentTime > 0 || (video.buffered.length > 0 && video.buffered.end(0) > 0))
}

// A frozen picture that nothing reports: after this long without the clock moving
// and without anything new arriving the stream is treated as dropped and reconnected.
const STALL_MS = 25_000

function Spinner({ reconnecting, retry, onStall }: { reconnecting: boolean; retry: number; onStall: () => void }) {
  // The TV's media pipeline leaves canPlay/waiting/seeking stale, so judge from
  // the video element itself: loading is shown exactly while the clock isn't
  // advancing (and the video isn't paused or finished). Data buffering ahead
  // doesn't count against it: measured on the TV, a slow start sits at
  // readyState 2 with the buffer growing while nothing plays.
  const [stuck, setStuck] = useState(true)
  const stallRef = useRef(onStall)
  useEffect(() => { stallRef.current = onStall })
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
      if (Date.now() - stuckSince > STALL_MS) { stuckSince = 0; stallRef.current() }
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

function RoundButton({ label, onClick, large, focused, children }: { label: string; onClick: () => void; large?: boolean; focused?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full transition duration-150 active:scale-95',
        large ? 'size-20' : 'size-16',
        focused ? 'scale-110 bg-white text-black' : cn('text-white hover:bg-white/20', large && 'bg-white/15'),
      )}
    >
      {children}
    </button>
  )
}

const MENU = 'absolute bottom-56 right-16 z-20 rounded-xl bg-[#111418]/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.6)]'

// Keys while a menu is open: arrows move, OK picks, anything else closes.
function useMenuKeys(count: number, start: number, vertical: boolean, onPick: (i: number) => void, onClose: () => void) {
  const [index, setIndex] = useState(start)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const prev = vertical ? KEY.up : KEY.left
      const next = vertical ? KEY.down : KEY.right
      if (e.keyCode === prev) setIndex(i => Math.max(0, i - 1))
      else if (e.keyCode === next) setIndex(i => Math.min(count - 1, i + 1))
      else if (e.keyCode === KEY.enter && count) { onPick(index); onClose() }
      else if (e.keyCode !== KEY.enter) onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [count, index, vertical, onPick, onClose])
  return index
}

function SpeedMenu({ onClose, rate, onRate }: { onClose: () => void; rate: number; onRate: (rate: number) => void }) {
  const index = useMenuKeys(SPEEDS.length, Math.max(0, SPEEDS.indexOf(rate)), false, i => onRate(SPEEDS[i]), onClose)
  return (
    <div className={cn(MENU, 'flex')}>
      {SPEEDS.map((r, i) => (
        <div key={r} className={cn(
          'rounded-full px-5 py-3 text-lg font-semibold',
          i > 0 && 'ml-1',
          i === index ? 'bg-white text-black' : r === rate ? 'text-[#1a98ff]' : 'text-white/80',
        )}>{r}×</div>
      ))}
    </div>
  )
}

// Language names for the three- and two-letter codes MKV files use.
const LANGUAGES: Record<string, string> = {
  ara: 'Arabic', ar: 'Arabic', eng: 'English', en: 'English', ger: 'German', deu: 'German', de: 'German',
  fre: 'French', fra: 'French', fr: 'French', spa: 'Spanish', es: 'Spanish', ita: 'Italian', it: 'Italian',
  rus: 'Russian', ru: 'Russian', tur: 'Turkish', tr: 'Turkish', fin: 'Finnish', fi: 'Finnish', swe: 'Swedish', sv: 'Swedish',
  por: 'Portuguese', pt: 'Portuguese', hin: 'Hindi', hi: 'Hindi', kor: 'Korean', ko: 'Korean', jpn: 'Japanese', ja: 'Japanese',
  chi: 'Chinese', zho: 'Chinese', zh: 'Chinese', dut: 'Dutch', nld: 'Dutch', nl: 'Dutch', pol: 'Polish', pl: 'Polish',
  per: 'Persian', fas: 'Persian', fa: 'Persian', heb: 'Hebrew', he: 'Hebrew', und: 'Unknown',
}

// A plain file (an MKV, say) isn't reported through the player's own track list, but this TV's
// browser lists its audio tracks on the video element itself.
type NativeAudioTrack = { label?: string; language?: string; enabled: boolean }
type NativeAudioTracks = EventTarget & { length: number; [index: number]: NativeAudioTrack }

function useNativeAudio() {
  const [, bump] = useState(0)
  // audioTracks is missing from the DOM typings but present in this TV's browser.
  const tracks = (document.querySelector('video') as (HTMLVideoElement & { audioTracks?: NativeAudioTracks }) | null)?.audioTracks
  useEffect(() => {
    if (!tracks) return
    const update = () => bump(n => n + 1)
    tracks.addEventListener('change', update)
    return () => tracks.removeEventListener('change', update)
  }, [tracks])
  if (!tracks) return []
  return Array.from({ length: tracks.length }, (_, i) => {
    const t = tracks[i]
    const language = LANGUAGES[(t.language || '').toLowerCase()] ?? (t.language || '')
    return {
      label: [t.label || language || `Track ${i + 1}`, t.label && language && !t.label.includes(language) ? `· ${language}` : ''].filter(Boolean).join(' '),
      selected: t.enabled,
      select: () => { for (let k = 0; k < tracks.length; k++) tracks[k].enabled = k === i },
    }
  })
}

// HLS streams (all live, some VOD) report audio/subtitle tracks through the player; for a plain
// file the audio comes from the video element. Subtitles inside a plain file can't be read here.
function TrackMenu({ onClose }: { onClose: () => void }) {
  const playerAudio = useAudioOptions()
  const nativeAudio = useNativeAudio()
  const audio = playerAudio.length > 1 ? playerAudio : nativeAudio
  const captions = useCaptionOptions()
  const rows = [
    ...(audio.length > 1 ? audio.map(option => ({ section: 'Audio', option })) : []),
    ...(captions.length > 1 ? captions.map(option => ({ section: 'Subtitles', option })) : []),
  ]
  const index = useMenuKeys(rows.length, Math.max(0, rows.findIndex(r => r.option.selected)), true, i => rows[i].option.select(), onClose)

  return (
    <div className={cn(MENU, 'w-96')}>
      {rows.length === 0 && <p className="px-4 py-3 text-base text-white/50">No alternative audio or subtitles for this stream.</p>}
      {captions.length <= 1 && rows.length > 0 && <p className="mt-3 px-4 text-sm text-white/40">Subtitles inside this file can’t be read on this TV.</p>}
      {rows.map(({ section, option }, i) => (
        <div key={`${section}:${option.label}:${i}`}>
          {(i === 0 || rows[i - 1].section !== section) && (
            <p className={cn('mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-white/40', i > 0 ? 'mt-3' : 'mt-1')}>{section}</p>
          )}
          <div className={cn(
            'flex items-center justify-between rounded-full px-5 py-3 text-lg',
            i === index ? 'bg-white font-semibold text-black' : option.selected ? 'text-[#1a98ff]' : 'text-white/80',
          )}>
            <span className="truncate">{option.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

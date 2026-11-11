import { createLazyFileRoute } from '@tanstack/react-router'
import type { PlayerSearch } from './player'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MediaPlayer,
  MediaProvider,
  isHLSProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
} from '@vidstack/react'
import '@vidstack/react/player/styles/base.css'

import { useApp } from '../context/app-provider'
import { useEpg } from '../hooks/use-epg'
import { formatSize, useStreamSize } from '../hooks/use-stream-size'
import { getSettings, useSettings } from '../utils/settings'
import { getChannelList, getEpisodeQueue } from '../utils/playback-context'
import { addRecentChannel } from '../utils/recents'
import { streamUrl as buildStreamUrl } from '../utils/xtream'
import { cn } from '../utils/cn'
import { useExitNotice } from '../hooks/use-exit-notice'
import { useSeek } from '../hooks/use-seek'
import { usePlayerPanel } from '../hooks/use-player-panel'
import { useProgressSaving } from '../hooks/use-progress-saving'
import { useResume } from '../hooks/use-resume'
import { useStreamHealth } from '../hooks/use-stream-health'
import { useLiveDelay } from '../hooks/use-live-delay'
import { useClock } from '../hooks/use-clock'
import { usePlayerControls, BAR, TIME_LABEL, PLAY_BUTTON, BUTTON_COUNT } from '../hooks/use-player-controls'
import { buttonClass } from '../components/button'
import { BackIcon, CaptionsIcon, Forward10Icon, PauseIcon, PlayIcon, Replay10Icon, RetryIcon } from '../components/icons'
import { KEY } from '../components/player/keys'
import ProgressBar from '../components/player/progress-bar'
import RoundButton from '../components/player/round-button'
import SeekOverlay from '../components/player/seek-overlay'
import { SpeedMenu, TrackMenu } from '../components/player/menus'
import Spinner from '../components/player/spinner'
import TimeLabel from '../components/player/time-label'
import UpNextCard from '../components/player/up-next-card'


const SEEK_STEP = 10
const REMAINING_KEY = 'streambox_time_remaining'

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
  const lastPointer = useRef({ x: 0, y: 0 })
  const settings = useSettings()
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(() => getSettings().defaultSpeed)
  // Bumped to make the player start the stream again (a reconnect, a retry, "go live").
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt(a => a + 1), [])

  const { id, group, name, image, type, streamUrl: currentUrl = '' } = search
  const isLive = type === 'live'

  const panel = usePlayerPanel()
  const progress = useProgressSaving({ id, group, name, image, type, streamUrl: currentUrl })
  const resume = useResume(player, id, attempt)
  const health = useStreamHealth({
    isLive, attempt, streamUrl: currentUrl, reload,
    beforeReconnect: () => { if (!isLive) resume.restartAt(progress.position()) }, // a movie picks up where it broke
  })
  const live = useLiveDelay(isLive, `${attempt}:${currentUrl}`, reload)
  const seek = useSeek(player, { enabled: !isLive, canSeek: resume.settled })
  const controls = usePlayerControls({ paused, held: !!health.error || !!panel.panel || seek.scrub !== null })
  // The first Back only asks "again to exit". (Not while a menu or the error screen is up.)
  const exitNotice = useExitNotice(!!panel.panel || !!health.error)

  const streamSize = useStreamSize(type, id, group)
  // Elapsed or remaining time on the left of the bar: a viewing habit, so it is remembered.
  const [showRemaining, setShowRemaining] = useState(() => localStorage.getItem(REMAINING_KEY) === '1')
  const toggleRemaining = useCallback(() => {
    setShowRemaining(v => {
      try { localStorage.setItem(REMAINING_KEY, v ? '0' : '1') } catch { /* storage full: just this session */ }
      return !v
    })
  }, [])
  const liveId = isLive && id?.startsWith('live:') ? Number(id.slice(5)) : undefined
  const epg = useEpg(liveId)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is module state that only changes with the channel
  const channels = useMemo(() => (isLive ? getChannelList() : []), [isLive, id])
  const channelIndex = channels.findIndex(c => c.stream_id === liveId)

  const queue = !isLive ? getEpisodeQueue() : []
  const queueIndex = queue.findIndex(q => q.id === id)
  const nextEpisode = queueIndex >= 0 ? queue[queueIndex + 1] : undefined

  const togglePlay = useCallback(() => {
    const p = player.current
    if (!p) return
    if (p.paused) p.play(); else p.pause()
  }, [])

  // Pointer remotes jitter constantly; only a real movement counts as activity.
  const { wake } = controls
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

  // Remote control.
  const { moveFocus, hide, focused, isVisible, isAwake } = controls
  const { by: seekBy, hold: seekHold, release, confirmNow } = seek
  const { isOpen: isPanelOpen, open: openPanel } = panel
  const { isBehind, catchUp } = live
  useEffect(() => {
    // OK on a focused control button.
    const activate = (index: number) => {
      if (index === 0) seekBy(-SEEK_STEP)
      else if (index === PLAY_BUTTON) togglePlay()
      else if (index === 2) seekBy(SEEK_STEP)
      else openPanel(index === 3 ? 'speed' : 'tracks')
    }
    const onKeyUp = (e: KeyboardEvent) => release(e.keyCode === KEY.left || e.keyCode === KEY.right)
    const onKey = (e: KeyboardEvent) => {
      if (isPanelOpen()) return
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
      const focus = focused()
      let handled = true
      switch (e.keyCode) {
        case KEY.enter:
          if (isLive) { if (isAwake() || p.paused) togglePlay() } // hidden overlay: OK only brings it up (every handled key does)
          // Controls away: OK plays or pauses, and the controls that come up have the play button focused.
          else if (!isVisible()) { togglePlay(); moveFocus(PLAY_BUTTON) }
          // With the controls showing, OK does what the focused control does; on the bar, nothing.
          else if (focus === TIME_LABEL) toggleRemaining()
          else if (focus >= 0) activate(focus)
          else confirmNow() // on the bar, OK confirms a seek in progress right away
          break
        case KEY.space: case KEY.playPause: togglePlay(); break
        case KEY.play: p.play(); break
        case KEY.pause: p.pause(); break
        case KEY.stop: stopPlay(); break
        case KEY.left:
          if (isLive) break
          else if (!isVisible()) { moveFocus(BAR); seekHold(-1, e) } // hidden controls: the arrows seek, and the bar takes focus so the next press seeks too
          else if (focus === TIME_LABEL) break
          else if (focus === 0) moveFocus(TIME_LABEL)
          else if (focus >= 0) moveFocus(focus - 1)
          else seekHold(-1, e)
          break
        case KEY.right:
          if (isLive) { if (isBehind()) catchUp(); break } // Right = catch up to live
          if (!isVisible()) { moveFocus(BAR); seekHold(1, e) }
          else if (focus === TIME_LABEL) moveFocus(0)
          else if (focus >= 0) moveFocus(Math.min(BUTTON_COUNT - 1, focus + 1))
          else seekHold(1, e)
          break
        case KEY.rewind: seekBy(-30); break
        case KEY.fastForward: if (isLive) { if (isBehind()) catchUp() } else seekBy(30); break
        // On live TV the arrows only wake the overlay (too easy to zap by accident);
        // channels change with the remote's CH keys.
        case KEY.channelUp: case KEY.pageUp: if (isLive && !e.repeat) zap(-1); break
        case KEY.up:
          if (isLive) break
          else if (!isVisible()) moveFocus(PLAY_BUTTON) // hidden: Up or Down brings the controls up (handled keys do) with the play button focused
          else if (focus >= 0 || focus === TIME_LABEL) moveFocus(BAR)
          else { hide(); return e.preventDefault() } // nothing above the bar: Up puts the controls away
          break
        case KEY.down:
          if (isLive) break
          else if (!isVisible()) moveFocus(PLAY_BUTTON)
          else if (focus === BAR) moveFocus(PLAY_BUTTON)
          else { hide(); return e.preventDefault() } // nothing below the buttons: Down puts the controls away
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
  }, [isLive, stopPlay, wake, seekBy, seekHold, release, confirmNow, togglePlay, toggleRemaining, moveFocus, hide, focused, isVisible, isAwake, isPanelOpen, openPanel, isBehind, catchUp, zap])

  // Error screen: Left/Right/OK pick between Retry and Back. Capture phase, so the
  // spatial-navigation library (which listens first and swallows keys) can't eat them.
  useEffect(() => {
    if (!health.error) return
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
  }, [health.error])

  const src = { src: processUrl(currentUrl, isLive), type: getType(processUrl(currentUrl, isLive)) }
  // Controls and title stay up while paused (VOD), otherwise they time out.
  const visible = controls.visible
  const now = useClock() / 1000
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
        onCanPlay={health.playable}
        onSeeked={seek.landed}
        onPlay={() => setPaused(false)}
        onPause={() => { setPaused(true); progress.persist() }}
        onTimeUpdate={({ currentTime }) => {
          // Until the saved position is applied the clock is still near 0; saving that would
          // overwrite where the user actually was.
          if (!resume.settled()) return
          resume.reached(currentTime)
          progress.record(currentTime, player.current?.duration ?? 0)
        }}
        onEnded={() => { progress.persist(); if (nextEpisode && settings.autoplayNext) playNextEpisode(); else stopPlay() }}
        onError={e => health.fail(e.message)}
      >
        <MediaProvider className="size-full [&>video]:size-full [&>video]:object-contain" />

        {!health.error && <Spinner reconnecting={health.reconnecting} retry={health.retries} onStall={() => health.fail('Playback stalled.')} />}

        {/* Title + controls: one layer that fades in on activity and out after a few seconds. */}
        <div className={cn('absolute inset-0 transition-opacity duration-300', visible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26rem] bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 px-16 pb-12">
            {streamSize && (
              <span className="mb-3 inline-block rounded-md bg-white px-3 py-0.5 text-sm font-semibold text-black">{formatSize(streamSize)}</span>
            )}
            <div className={cn('mb-6 flex items-center gap-4 transition-opacity duration-150', seek.scrub !== null && 'opacity-30')}>
              {isLive && (
                <span className={cn('flex items-center rounded-md px-3 py-1.5 text-sm font-semibold tracking-wider text-white', live.behind || paused ? 'bg-white/20' : 'bg-red-600')}>
                  <span className={cn('mr-2.5 size-2 rounded-full bg-white', !live.behind && !paused && 'animate-pulse')} />
                  {live.behind ? `~${live.behind}s BEHIND` : paused ? 'PAUSED' : 'LIVE'}
                </span>
              )}
              <h1 dir="auto" className="truncate text-4xl font-semibold text-white">{name}</h1>
              {isLive && channelIndex >= 0 && <span className="text-2xl text-white/50">CH {channelIndex + 1}</span>}
              {search.channelGroup && <span className="truncate text-xl text-white/50">{search.channelGroup}</span>}
              {isLive && live.behind > 0 && (
                <div className="flex flex-1 justify-end">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={live.catchUp}
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
                <ProgressBar glide={resume.glides} seekEnds={seek.ended} scrub={seek.scrub} from={seek.scrubFrom} focused={controls.focus === BAR} onSeek={fraction => {
                  const p = player.current
                  if (p && Number.isFinite(p.duration)) seek.to(fraction * p.duration)
                }} />
                {/* Three equal-width zones keep the buttons exactly centred. */}
                <div className="mt-5 flex items-center">
                  <div className="flex-1">
                    <TimeLabel remaining={showRemaining} focused={controls.focus === TIME_LABEL} onToggle={toggleRemaining} />
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <RoundButton label="Back 10 seconds" focused={controls.focus === 0} onClick={() => seek.by(-SEEK_STEP)}><Replay10Icon className="size-9" /></RoundButton>
                    <RoundButton label={paused ? 'Play' : 'Pause'} focused={controls.focus === 1} onClick={togglePlay} large>
                      {paused ? <PlayIcon className="size-9" /> : <PauseIcon className="size-9" />}
                    </RoundButton>
                    <RoundButton label="Forward 10 seconds" focused={controls.focus === 2} onClick={() => seek.by(SEEK_STEP)}><Forward10Icon className="size-9" /></RoundButton>
                  </div>
                  <div className="flex flex-1 items-center justify-end gap-3">
                    <RoundButton label="Playback speed" focused={controls.focus === 3} onClick={() => panel.open('speed')}><span className="text-xl font-bold">{rate}×</span></RoundButton>
                    <RoundButton label="Audio and subtitles" focused={controls.focus === 4} onClick={() => panel.open('tracks')}><CaptionsIcon className="size-9" /></RoundButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <SeekOverlay scrub={seek.scrub} from={seek.scrubFrom} sent={seek.sent} okWorks={controls.focus === BAR} jumped={seek.jumped} />

        {exitNotice && (
          <div className="pointer-events-none absolute left-1/2 top-12 z-30 -translate-x-1/2 rounded-full bg-black/70 px-7 py-3 text-2xl font-medium text-white">
            Press <span className="font-semibold">Back</span> again to exit
          </div>
        )}

        {nextEpisode && <UpNextCard episode={nextEpisode} enabled={settings.upNextCard} autoplay={settings.autoplayNext} raised={visible} onPlay={playNextEpisode} />}

        {panel.panel === 'speed' && <SpeedMenu onClose={panel.close} rate={rate} onRate={setRate} />}
        {panel.panel === 'tracks' && <TrackMenu onClose={panel.close} />}

        {health.error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black text-center">
            <p className="text-2xl text-white">Couldn't play this stream</p>
            <p className="max-w-xl text-base text-white/50">{health.error}</p>
            <div data-error-actions className="flex gap-4">
              <button autoFocus onClick={health.retry} className={cn(buttonClass('primary'), 'focus:ring-4 focus:ring-[#1a98ff]')}>
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

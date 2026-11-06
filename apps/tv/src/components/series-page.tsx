import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { firstImageUrl, getSeriesInfo, streamUrl, type Episode } from '../utils/xtream'
import { useApp } from '../context/app-provider'
import { cn } from '../utils/cn'
import CatalogPage from './catalog-page'
import { FocusButton, FocusScope } from './focusable'
import { CheckIcon, HeartIcon, PlayIcon, RetryIcon } from './icons'
import ActionButton from './button'
import MetaLine from './meta-line'
import Poster from './poster'
import Ratio, { POSTER, WIDE } from './ratio'
import { favoriteKey, toggleFavorite, useFavorites } from '../utils/favorites'
import { getProgress, useContinueWatching, useWatched } from '../utils/progress'
import { useSettings } from '../utils/settings'
import { setEpisodeQueue } from '../utils/playback-context'

const route = getRouteApi('/(app)/series')

export default function SeriesPage() {
  const { id } = route.useSearch()
  // The detail view lives in the URL, so the remote's Back key returns to the list.
  return id ? <SeriesDetail id={id} /> : <CatalogPage kind="series" />
}

function runtimeLabel(duration?: string) {
  const m = duration?.match(/^(\d+):(\d+):(\d+)$/)
  if (!m) return duration && duration !== '00:00:00' ? duration : ''
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return minutes ? `${minutes} min` : ''
}

function SeriesDetail({ id }: { id: string }) {
  const { creds, play } = useApp()
  const [pickedSeason, setPickedSeason] = useState<string | null>(null)
  const watched = useWatched()
  const { watchedBadge } = useSettings()
  const continueList = useContinueWatching()
  const favorites = useFavorites()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['seriesInfo', id],
    queryFn: ({ signal }) => getSeriesInfo(creds!, id, { signal }),
    enabled: !!creds,
  })

  const info = data?.info
  const episodesBySeason: Record<string, Episode[]> = Array.isArray(data?.episodes)
    ? { '1': data.episodes }
    : data?.episodes ?? {}
  const seasonKeys = Object.keys(episodesBySeason).sort((a, b) => Number(a) - Number(b))

  // Resume point: the episode in progress, else the one after the last watched.
  const allEpisodes = seasonKeys.flatMap(key => episodesBySeason[key].map(ep => ({ ep, season: key })))
  const inProgress = continueList.find(e => e.group === `series:${id}`)
  let lastWatched = -1
  allEpisodes.forEach((e, i) => { if (watched.includes(`episode:${e.ep.id}`)) lastWatched = i })
  const target = inProgress
    ? allEpisodes.find(e => `episode:${e.ep.id}` === inProgress.id)
    : allEpisodes[Math.min(allEpisodes.length - 1, lastWatched + 1)]

  const season = pickedSeason && episodesBySeason[pickedSeason] ? pickedSeason : target?.season ?? seasonKeys[0]
  const episodes = season ? episodesBySeason[season] : []

  const numberOf = (ep: Episode, seasonKey: string) =>
    ep.episode_num ?? episodesBySeason[seasonKey].findIndex(e => e.id === ep.id) + 1

  function playEpisode(ep: Episode, epSeason: string, number: number | string) {
    // Everything after this episode (across seasons) feeds "Up next".
    const startAt = allEpisodes.findIndex(e => e.ep.id === ep.id)
    setEpisodeQueue(allEpisodes.slice(startAt).map(({ ep: e, season: sn }, i) => ({
      id: `episode:${e.id}`,
      group: `series:${id}`,
      name: `${info?.name ?? 'Episode'} · S${sn} E${i === 0 ? number : e.episode_num ?? '?'}`,
      streamUrl: streamUrl(creds!, 'episode', e.id, e.container_extension),
      image: e.info?.movie_image || info?.cover || undefined,
    })))
    play({
      name: `${info?.name ?? 'Episode'} · S${epSeason} E${number}`,
      type: 'episode',
      streamUrl: streamUrl(creds!, 'episode', ep.id, ep.container_extension),
      id: `episode:${ep.id}`,
      group: `series:${id}`,
      image: ep.info?.movie_image || info?.cover || undefined,
    })
  }

  const backdrop = firstImageUrl(info?.backdrop_path)
  const poster = info?.cover || undefined
  const rating = Number(info?.rating)
  const year = (info?.releaseDate || info?.release_date || '').slice(0, 4)
  const episodeCount = allEpisodes.length
  const parts = [
    year,
    seasonKeys.length > 0 && `${seasonKeys.length} ${seasonKeys.length === 1 ? 'season' : 'seasons'}`,
    info?.genre,
  ]

  const item = { name: info?.name ?? '', series_id: Number(id), cover: poster, rating: info?.rating }
  const favorite = favorites.some(f => f.key === favoriteKey('series', item))

  const playLabel = !target
    ? 'Play'
    : `${inProgress ? 'Resume' : lastWatched >= 0 ? 'Continue' : 'Play'} S${target.season} E${numberOf(target.ep, target.season)}`

  return (
    <FocusScope focusWhen={!isLoading} preferredChildFocusKey={target && target.season === season ? `ep-${target.ep.id}` : 'play'} className="relative -ml-28 min-h-screen bg-[#050607]">
      {/* Fixed, so the artwork stays put while the episode list scrolls. Kept dim:
          it is atmosphere, the content is the point. */}
      <div aria-hidden className="fixed inset-0">
        {backdrop ? (
          <img src={backdrop} alt="" className="size-full object-cover object-top opacity-25" />
        ) : (
          poster && <img src={poster} alt="" className="size-full scale-125 object-cover object-top opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050607] via-[#050607]/85 to-[#050607]/70" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050607] to-transparent" />
      </div>

      <div className="relative flex flex-row-reverse">
        {/* Details on the right; they stay in view while you move through the episodes. */}
        <aside className="sticky top-0 flex h-screen w-[42rem] shrink-0 flex-col justify-center pl-10 pr-16">
          {isError ? (
            <div className="text-xl text-gray-400">
              Couldn’t load this show.
              <ActionButton variant="primary" icon={<RetryIcon />} className="mt-6" onClick={() => refetch()}>Retry</ActionButton>
            </div>
          ) : isLoading ? (
            <div aria-hidden className="space-y-5">
              <div className="h-12 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-6 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-28 w-full animate-pulse rounded bg-white/10" />
            </div>
          ) : (
            <>
              {poster && (
                <div className="mb-7 w-52">
                  <Ratio ratio={POSTER} className="overflow-hidden rounded-lg bg-[#111418]">
                    <Poster src={poster} title={info?.name ?? ''} />
                  </Ratio>
                </div>
              )}
              <h1 dir="auto" className="line-clamp-2 text-5xl font-bold leading-tight text-white">{info?.name ?? 'Series'}</h1>
              <div className="mt-5"><MetaLine rating={rating} parts={parts} /></div>
              {info?.plot && <p dir="auto" className="mt-5 line-clamp-4 text-xl leading-relaxed text-gray-300">{info.plot}</p>}

              <div className="mt-8 flex items-center gap-4">
                {target && (
                  <ActionButton
                    focusKey="play"
                    variant="primary"
                    icon={<PlayIcon />}
                    onClick={() => playEpisode(target.ep, target.season, numberOf(target.ep, target.season))}
                  >
                    {playLabel}
                  </ActionButton>
                )}
                <ActionButton
                  focusKey={target ? undefined : 'play'}
                  icon={<HeartIcon filled={favorite} />}
                  onClick={() => toggleFavorite('series', item)}
                >
                  {favorite ? 'In My list' : 'My list'}
                </ActionButton>
              </div>
            </>
          )}
        </aside>

        <section className="min-w-0 flex-1 pb-24 pl-28 pr-4 pt-16">
          {!isError && (
            <>
              <div className="no-scrollbar -ml-3 flex overflow-x-auto scroll-px-6 px-4 py-2">
                {seasonKeys.map(key => (
                  <FocusButton
                    key={key}
                    onClick={() => setPickedSeason(key)}
                    className={cn(
                      'mr-3 shrink-0 rounded-full px-6 py-2.5 text-lg font-medium',
                      key === season ? 'tv-ring-gap bg-white text-black' : 'bg-white/10 text-[#d0d8df]',
                    )}
                  >
                    Season {key}
                  </FocusButton>
                ))}
              </div>
              {!isLoading && <p className="mt-3 text-base text-[#8b95a1]">{episodes.length} episodes{episodeCount !== episodes.length ? ` · ${episodeCount} in total` : ''}</p>}

              <div className="-ml-2 mt-4 px-2">
                {isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                    <div key={i} aria-hidden className="mb-4 flex items-center py-3 pl-3">
                      <div className="w-64 shrink-0"><Ratio ratio={WIDE} className="animate-pulse rounded-lg bg-white/5" /></div>
                      <div className="ml-7 flex-1 space-y-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
                        <div className="h-7 w-2/3 animate-pulse rounded bg-white/5" />
                      </div>
                    </div>
                  ))
                  : episodes.map(ep => (
                    <EpisodeRow
                      key={ep.id}
                      ep={ep}
                      number={numberOf(ep, season)}
                      cover={poster}
                      isNext={target?.ep.id === ep.id}
                      isWatched={watchedBadge && watched.includes(`episode:${ep.id}`)}
                      onPlay={() => playEpisode(ep, season, numberOf(ep, season))}
                    />
                  ))}
              </div>
            </>
          )}
        </section>
      </div>
    </FocusScope>
  )
}

function EpisodeRow({ ep, number, cover, isNext, isWatched, onPlay }: {
  ep: Episode
  number: number | string
  cover?: string
  isNext: boolean
  isWatched: boolean
  onPlay: () => void
}) {
  const saved = getProgress(`episode:${ep.id}`)
  const progress = saved && saved.duration > 0 ? Math.min(100, (saved.position / saved.duration) * 100) : 0
  const length = runtimeLabel(ep.info?.duration)
  const image = ep.info?.movie_image || cover

  // Flat on the page: no card. Focus lifts the thumbnail with a white ring and
  // brightens the text, the same language as the poster cards.
  return (
    <FocusButton
      plain
      focusKey={`ep-${ep.id}`}
      onClick={onPlay}
      className="group relative mb-4 flex w-full scroll-my-28 items-center py-3 pl-3 pr-2 text-left"
    >
      <div className={cn('w-64 shrink-0', isWatched && 'opacity-50 transition-opacity duration-200 group-focus:opacity-100')}>
        <Ratio
          ratio={WIDE}
          className="rounded-lg bg-[#111418] transition-transform duration-200 ease-out group-focus:scale-[1.04] group-focus:ring-4 group-focus:ring-white"
        >
          <Poster src={image} title={ep.title || `Episode ${number}`} />
          {progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-b-lg bg-white/25"><div className="h-full bg-white" style={{ width: `${progress}%` }} /></div>
          )}
        </Ratio>
      </div>

      <div className={cn('ml-7 min-w-0 flex-1', isWatched && 'opacity-50 transition-opacity duration-200 group-focus:opacity-100')}>
        <p className="text-base font-semibold text-[#667684]">
          Episode {number}
        </p>
        <p dir="auto" className="mt-1 truncate text-2xl font-medium text-[#aab8c2] transition-colors duration-200 group-focus:text-white">{ep.title || `Episode ${number}`}</p>
        <p dir="auto" className="mt-1.5 line-clamp-2 text-base text-[#667684]">
          {[length, ep.info?.plot].filter(Boolean).join(' · ')}
        </p>
      </div>

      {(isNext || isWatched) && (
        <div className="absolute right-3 top-3 flex items-center">
          {isNext && <span className="rounded-md bg-white px-3 py-0.5 text-sm font-semibold text-black">{saved ? 'Resume' : 'Up next'}</span>}
          {isWatched && (
            <span className={cn('flex items-center rounded-md bg-white/15 px-3 py-0.5 text-sm font-semibold text-white', isNext && 'ml-2')}>
              <CheckIcon className="mr-1.5 size-4" />Watched
            </span>
          )}
        </div>
      )}
    </FocusButton>
  )
}

import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { firstImageUrl, getVodInfo, streamUrl, vodArt } from '../utils/xtream'
import { useApp } from '../context/app-provider'
import { favoriteKey, toggleFavorite, useFavorites } from '../utils/favorites'
import { getProgress, removeProgress, useContinueWatching } from '../utils/progress'
import { FocusScope } from './focusable'
import ActionButton from './button'
import { HeartIcon, PlayIcon, RestartIcon, RetryIcon } from './icons'
import MetaLine from './meta-line'
import Poster from './poster'
import Ratio, { POSTER } from './ratio'

const route = getRouteApi('/(app)/movie')

function formatRuntime(info: { duration?: string; duration_secs?: string | number } | undefined) {
  const secs = Number(info?.duration_secs)
  if (!secs) return info?.duration && info.duration !== '00:00:00' ? info.duration : ''
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export default function MoviePage() {
  const { id } = route.useSearch()
  const { creds, play } = useApp()
  const favorites = useFavorites()
  useContinueWatching() // re-render when progress changes

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vodInfo', id],
    queryFn: ({ signal }) => getVodInfo(creds!, id!, { signal }),
    enabled: !!creds && !!id,
  })

  const info = data?.info
  const movie = data?.movie_data
  const name = movie?.name || info?.name || ''
  const progressId = `movie:${id}`
  const saved = getProgress(progressId)
  const resumable = !!saved && saved.duration > 0 && saved.position > 10

  const backdrop = firstImageUrl(info?.backdrop_path)
  const poster = info?.movie_image || undefined
  const rating = Number(info?.rating)
  const year = (info?.releasedate ?? '').slice(0, 4)
  const runtime = formatRuntime(info)

  const item = { name, stream_id: Number(id), stream_icon: poster, rating: info?.rating, container_extension: movie?.container_extension }
  const favorite = favorites.some(f => f.key === favoriteKey('movie', item))

  function start(fromBeginning: boolean) {
    if (!creds || !id) return
    if (fromBeginning) removeProgress(progressId) // the player resumes from saved progress
    play({
      name,
      type: 'movie',
      streamUrl: streamUrl(creds, 'movie', id, movie?.container_extension),
      id: progressId,
      group: progressId,
      image: vodArt(data),
    })
  }

  const minutesLeft = saved ? Math.max(1, Math.round((saved.duration - saved.position) / 60)) : 0

  return (
    <FocusScope focusWhen={!isLoading} preferredChildFocusKey="play" className="relative -ml-28 min-h-screen overflow-hidden bg-[#050607]">
      {backdrop ? (
        <img src={backdrop} alt="" className="absolute inset-0 size-full object-cover object-top" />
      ) : (
        // No backdrop from the provider: the poster, enlarged and dimmed, fills in.
        poster && <img src={poster} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover object-top opacity-35" />
      )}
      {(backdrop || poster) && (
        <>
          {/* Lighter scrim for the poster fallback: it has no detail to protect, only colour to show. */}
          <div className={backdrop ? 'absolute inset-0 bg-gradient-to-r from-[#050607] via-[#050607]/85 to-[#050607]/40' : 'absolute inset-0 bg-gradient-to-r from-[#050607]/90 via-[#050607]/65 to-[#050607]/45'} />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050607] to-transparent" />
        </>
      )}

      <div className="relative flex min-h-screen items-center justify-between pl-28 pr-28 py-16">
        {isError ? (
          <div className="text-xl text-gray-400">
            Couldn’t load this movie.
            <ActionButton variant="primary" icon={<RetryIcon />} className="ml-6 inline-flex" onClick={() => refetch()}>Retry</ActionButton>
          </div>
        ) : isLoading ? (
          <div aria-hidden className="w-full max-w-2xl space-y-5">
            <div className="h-12 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded bg-white/10" />
            <div className="h-14 w-44 animate-pulse rounded-lg bg-white/15" />
          </div>
        ) : (
          <>
            <div className="min-w-0 max-w-2xl flex-1">
              <h1 dir="auto" className="text-6xl font-bold leading-tight text-white">{name}</h1>

              <div className="mt-6"><MetaLine rating={rating} parts={[year, runtime, info?.genre]} /></div>

              {info?.plot && <p dir="auto" className="mt-6 line-clamp-5 text-xl leading-relaxed text-gray-300">{info.plot}</p>}

              <div className="mt-10 flex items-center gap-4">
                <ActionButton focusKey="play" variant="primary" icon={<PlayIcon />} onClick={() => start(false)}>
                  {resumable ? `Resume · ${minutesLeft} min left` : 'Play'}
                </ActionButton>
                {resumable && (
                  <ActionButton icon={<RestartIcon />} onClick={() => start(true)}>Start over</ActionButton>
                )}
                <ActionButton icon={<HeartIcon filled={favorite} />} onClick={() => toggleFavorite('movie', item)}>
                  {favorite ? 'In My list' : 'My list'}
                </ActionButton>
              </div>

              <dl className="mt-10 space-y-2 text-base text-[#8b95a1]">
                {info?.director && <div dir="auto"><dt className="inline text-[#667684]">Director </dt><dd className="inline">{info.director}</dd></div>}
                {info?.cast && <div dir="auto" className="line-clamp-2"><dt className="inline text-[#667684]">Cast </dt><dd className="inline">{info.cast}</dd></div>}
              </dl>
            </div>

            {poster && (
              <div className="ml-16 w-96 flex-none">
                <Ratio ratio={POSTER} className="overflow-hidden rounded-lg bg-[#111418]">
                  <Poster src={poster} title={name} />
                </Ratio>
              </div>
            )}
          </>
        )}
      </div>
    </FocusScope>
  )
}

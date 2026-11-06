import { useEffect } from 'react'
import { useIsRestoring, useQuery } from '@tanstack/react-query'
import { useApp } from '../context/app-provider'
import { useCategorySelection } from './use-category-selection'
import { queryClient } from '../react-query/client'
import { savedNewest, syncList } from '../utils/lists-client'
import { firstImageUrl, getVodInfo, type Item, type Kind } from '../utils/xtream'

// A hero slide: a movie or a show, with what the hero draws (backdrop, plot, genre, rating).
export type HeroItem = Item & { heroKind: Kind }

export const heroId = (h: HeroItem) => `${h.heroKind}:${h.series_id ?? h.stream_id}`

const SLIDES = 10

// Whether a details response is for the title in the list. Only judged when both names are in the
// Latin alphabet (an Arabic list name against an English details name proves nothing), and the
// list name's year suffix is ignored.
const plain = (name: string) => name.toLowerCase().replace(/\b(19|20)\d{2}\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
function sameTitle(listName: string, infoName?: string) {
  if (!infoName) return true
  const a = plain(listName)
  const b = plain(infoName)
  if (!a || !b || /[^ -\u024f\s]/.test(listName + infoName)) return true
  // One contains the other and they are of similar length: "who" inside "ali g who iz i" is a different film.
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return long.includes(short) && short.length >= long.length * 0.6
}

// What the banner draws from: the chosen categories, or until then the first movie category and the first show category.
let oldBannersRemoved = false

export const useHeroSelection = () => useCategorySelection('heroSelection', 1)

// The newest additions across movies and shows, alternating between the two. They come from the lists saved on
// the device. Shows already carry their backdrop; a movie's list entry doesn't, so the newest
// movies each fetch their small details (the same ones the movie page uses, so they are reused).
// Fails until both lists are saved (and starts downloading what is missing); it runs again when they arrive.
// There is one saved banner per account, not one per choice of categories: it remembers which choice
// it was built for, and a different choice rebuilds it (the old one would only take up space).
export function useNewestHero(selection: string[] | undefined) {
  const { creds } = useApp()
  const wanted = selection?.join(',')
  const restoring = useIsRestoring()
  // Banners saved by earlier versions, one per choice, are no longer used: removed once per launch.
  useEffect(() => {
    if (restoring || oldBannersRemoved) return
    oldBannersRemoved = true
    queryClient.removeQueries({ predicate: q => q.queryKey[0] === 'hero' && q.queryKey[1] !== 'v8' })
  }, [restoring])

  const query = useQuery({
    queryKey: ['hero', 'v8', creds?.base, creds?.username],
    enabled: !!creds && !!selection,
    meta: { persist: true },
    retry: 2, // movie details can fail while the home screen is busy; the lists' own sync also re-runs this
    retryDelay: 3000,
    queryFn: async (): Promise<{ selection: string; items: HeroItem[] }> => {
      // Only the chosen categories; a kind with none chosen isn't included at all.
      const movieCategories = selection!.filter(k => k.startsWith('movie:')).map(k => k.slice(6))
      const showCategories = selection!.filter(k => k.startsWith('series:')).map(k => k.slice(7))
      const wantMovies = movieCategories.length > 0
      const wantShows = showCategories.length > 0
      const [movies, shows] = await Promise.all([
        wantMovies ? savedNewest(creds!, 'movie', 24, movieCategories).catch(() => null) : [],
        wantShows ? savedNewest(creds!, 'series', 12, showCategories).catch(() => null) : [],
      ])
      if (!movies || !shows) {
        // The hero is built from the saved lists it shows: start downloading whichever is missing now.
        // Each re-runs this query when it lands (a half-built hero would show only one kind).
        if (!movies) syncList(creds!, 'movie').catch(() => undefined)
        if (!shows) syncList(creds!, 'series').catch(() => undefined)
        throw new Error('Saved lists not ready yet')
      }

      // One at a time: this provider allows a single connection, and the home screen is loading rows
      // at the same moment, so a burst of parallel requests can leave some of them failing.
      // Of ten slides, movies and shows alternate starting with a movie (five movies); only movies means ten.
      const movieTarget = wantShows ? SLIDES / 2 : SLIDES
      const movieSlides: HeroItem[] = []
      for (const m of movies.slice(0, 24)) {
        if (movieSlides.length >= movieTarget) break
        try {
          const detail = await queryClient.fetchQuery({
            queryKey: ['vodInfo', String(m.stream_id)],
            queryFn: ({ signal }) => getVodInfo(creds!, String(m.stream_id), { signal }),
            staleTime: Infinity,
          })
          const backdrop = firstImageUrl(detail.info?.backdrop_path)
          // Some entries carry another film's metadata (checked: "WHO 2026" returned the details of
          // "Ali G: Who Iz I?"), which would pair a title with the wrong backdrop and plot. Skip those.
          if (backdrop && sameTitle(m.name, detail.info?.name)) {
            movieSlides.push({ ...m, plot: detail.info?.plot, genre: detail.info?.genre, backdrop_path: [backdrop], heroKind: 'movie' })
          }
        } catch { /* skip this one */ }
      }
      // Too few movies means their details didn't load, not that there are no new movies: try again
      // rather than saving a hero that is nearly all shows.
      if (movieSlides.length < 2 && movies.length >= 2) throw new Error('Movie details unavailable')
      const showSlides: HeroItem[] = shows.map(s => ({ ...s, heroKind: 'series' }))

      // Shows' dates are their last update (a new episode), which is nearly always more recent than a
      // movie's added date, so sorting them together would crowd the movies out: alternate instead,
      // each list newest first, starting with a movie.
      const byNewest = (a: HeroItem, b: HeroItem) => Number(b.added) - Number(a.added)
      const newMovies = movieSlides.sort(byNewest)
      const newShows = showSlides.sort(byNewest)
      const mixed: HeroItem[] = []
      for (let i = 0; mixed.length < SLIDES && (i < newMovies.length || i < newShows.length); i++) {
        if (newMovies[i]) mixed.push(newMovies[i])
        if (newShows[i] && mixed.length < SLIDES) mixed.push(newShows[i])
      }
      return { selection: wanted!, items: mixed }
    },
  })

  // Saved for other categories: rebuild it, and don't hand out its slides meanwhile.
  // `wanted` is undefined until the categories are known (a first login has no saved copy), and so is `data`: that is not a match.
  const matches = !!query.data && query.data.selection === wanted
  const outdated = !!query.data && !matches
  useEffect(() => {
    if (outdated && wanted !== undefined) queryClient.invalidateQueries({ queryKey: ['hero'] })
  }, [outdated, wanted])
  return { data: matches ? query.data!.items : undefined, isSuccess: query.isSuccess && matches }
}

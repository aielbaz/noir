import { startTransition, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useIsRestoring, useQuery } from '@tanstack/react-query'
import { useApp } from '../context/app-provider'
import { useCategorySelection } from './use-category-selection'
import { queryClient } from '../react-query/client'
import { savedNewest, syncListLater } from '../utils/lists-client'
import { pickNewest, slimShow } from '../utils/newest'
import { msSinceKeyPress } from '../utils/remote-activity'
import { firstImageUrl, getItems, getVodInfo, type Creds, type Item, type Kind } from '../utils/xtream'

// A hero slide: a movie or a show, with what the hero draws (backdrop, plot, genre, rating).
export type HeroItem = Item & { heroKind: Kind }

export const heroId = (h: HeroItem) => `${h.heroKind}:${h.series_id ?? h.stream_id}`

const SLIDES = 10
const NO_SLIDES: HeroItem[] = []
const QUIET_MS = 1500 // a new banner waits this long after the last key press

// Backdrops already decoded this session: a banner showing one of them can appear at once.
export const decodedBackdrops = new Set<string>()

// The banner is also saved on the device, one per account, with the choice of categories it was built
// for, so the next launch shows it at once while the real one is rebuilt.
const savedHeroKey = (creds: Creds) => `streambox_hero4:${creds.base}:${creds.username}`

// Banners saved by earlier versions, one per choice of categories: removed once per launch.
let oldBannersRemoved = false
function removeOldBanners() {
  if (oldBannersRemoved) return
  oldBannersRemoved = true
  for (const k of Object.keys(localStorage)) if (k.startsWith('streambox_hero') && !k.startsWith('streambox_hero4:')) localStorage.removeItem(k)
}

function readSavedHero(key: string, selection: string): HeroItem[] {
  removeOldBanners()
  try {
    const saved = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null
    return saved?.selection === selection && Array.isArray(saved.items) ? saved.items : []
  } catch { return [] }
}

function saveHero(creds: Creds, selection: string, items: HeroItem[]) {
  if (!items.length) return
  try { localStorage.setItem(savedHeroKey(creds), JSON.stringify({ selection, items })) } catch { /* storage full: next launch just waits */ }
}

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

// A list entry without its position in the response it came in: that differs between a category's
// own list and the full one, and would make two identical banners look different.
function unnumbered(item: Item): Item {
  const copy: Item & { num?: number } = { ...item }
  delete copy.num
  return copy
}

// The newest titles of the chosen categories: from the full list saved on the device, or, while that
// is still downloading (a first launch: it is tens of megabytes), from the categories' own small
// requests. Those are the requests the Home rows make, so a row and the banner share one.
async function newestOf(creds: Creds, kind: Kind, count: number, categoryIds: string[]) {
  const saved = await savedNewest(creds, kind, count, categoryIds).catch(() => null)
  if (saved) return saved
  syncListLater(creds, kind)
  const all: Item[] = []
  // One at a time: this provider allows a single connection.
  for (const id of categoryIds) {
    const items = await queryClient.fetchQuery({
      queryKey: ['items', kind, id],
      queryFn: ({ signal }) => getItems(creds, kind, id, { signal }),
      staleTime: 5 * 60_000,
      structuralSharing: false,
    })
    all.push(...(kind === 'series' ? items.map(slimShow) : items))
  }
  return pickNewest(all, kind, count, categoryIds)
}

// The banner while it is being built (see useNewestHero): shown only when there is nothing better,
// and never saved. One at a time, for the account and choice of categories it is being built for.
let draft: { key: string; items: HeroItem[] } = { key: '', items: [] }
const draftListeners = new Set<() => void>()
const draftKeyOf = (creds: Creds, selection: string) => `${creds.base}:${creds.username}:${selection}`
function setDraft(key: string, items: HeroItem[]) {
  draft = { key, items }
  draftListeners.forEach(notify => notify())
}
const subscribeDraft = (notify: () => void) => { draftListeners.add(notify); return () => { draftListeners.delete(notify) } }

// What the banner draws from: the chosen categories, or until then the first movie category and the first show category.
let oldHeroQueriesRemoved = false

export const useHeroSelection = () => useCategorySelection('heroSelection', 1)

// The newest additions across movies and shows, alternating between the two (see newestOf for where
// they come from). Shows already carry their backdrop; a movie's list entry doesn't, so the newest
// movies each fetch their small details (the same ones the movie page uses, so they are reused).
// There is one saved banner per account, not one per choice of categories: it remembers which choice
// it was built for, and a different choice rebuilds it (the old one would only take up space).
export function useNewestHero(selection: string[] | undefined) {
  const { creds } = useApp()
  const wanted = selection?.join(',')
  const restoring = useIsRestoring()
  // Banners saved by earlier versions, one per choice, are no longer used: removed once per launch.
  useEffect(() => {
    if (restoring || oldHeroQueriesRemoved) return
    oldHeroQueriesRemoved = true
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
      const movies = wantMovies ? await newestOf(creds!, 'movie', 24, movieCategories) : []
      const shows = wantShows ? await newestOf(creds!, 'series', 12, showCategories) : []

      // Shows' dates are their last update (a new episode), which is nearly always more recent than a
      // movie's added date, so sorting them together would crowd the movies out: alternate instead,
      // each list newest first, starting with a movie.
      // Of ten slides, movies and shows alternate (five movies); only movies means ten.
      const movieTarget = wantShows ? SLIDES / 2 : SLIDES
      const showSlides: HeroItem[] = shows.map(s => ({ ...s, heroKind: 'series' }))
      const mix = (movieSlides: HeroItem[]) => {
        const mixed: HeroItem[] = []
        for (let i = 0; mixed.length < SLIDES && (i < movieSlides.length || i < showSlides.length); i++) {
          if (movieSlides[i]) mixed.push(movieSlides[i])
          if (showSlides[i] && mixed.length < SLIDES) mixed.push(showSlides[i])
        }
        return mixed
      }

      // A movie's details arrive one at a time (this provider allows a single connection, and the home
      // screen is loading rows at the same moment, so a burst of parallel requests can leave some of them
      // failing). Until its own arrive, a movie is shown with what its list entry has: the poster in
      // place of the backdrop, and no plot. It stays that way when its details have no backdrop (the
      // newest films often don't yet), so the banner never swaps one title for another while it is built.
      const slides: HeroItem[] = movies.slice(0, movieTarget)
        .map(m => ({ ...unnumbered(m), backdrop_path: m.stream_icon ? [m.stream_icon] : undefined, heroKind: 'movie' }))
      const draftKey = draftKeyOf(creds!, wanted!)
      setDraft(draftKey, mix(slides))
      let failed = 0
      for (let i = 0; i < slides.length; i++) {
        const m = slides[i]
        try {
          const detail = await queryClient.fetchQuery({
            queryKey: ['vodInfo', String(m.stream_id)],
            queryFn: ({ signal }) => getVodInfo(creds!, String(m.stream_id), { signal }),
            staleTime: Infinity,
          })
          // Some entries carry another film's metadata (checked: "WHO 2026" returned the details of
          // "Ali G: Who Iz I?"), which would pair a title with the wrong backdrop and plot: not used.
          if (!sameTitle(m.name, detail.info?.name)) continue
          const backdrop = firstImageUrl(detail.info?.backdrop_path)
          slides[i] = { ...m, plot: detail.info?.plot, genre: detail.info?.genre, backdrop_path: backdrop ? [backdrop] : m.backdrop_path }
          setDraft(draftKey, mix(slides))
        } catch { failed++ }
      }
      // No details at all means they didn't load, not that the films have none: try again rather
      // than saving a banner of bare posters.
      if (slides.length >= 2 && failed === slides.length) throw new Error('Movie details unavailable')
      const mixed = mix(slides)
      saveHero(creds!, wanted!, mixed) // for the next launch's first paint
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
  const building = useSyncExternalStore(subscribeDraft, () => draft)
  const draftItems = creds && wanted !== undefined && building.key === draftKeyOf(creds, wanted) ? building.items : NO_SLIDES
  return { data: matches ? query.data!.items : undefined, draft: draftItems, isSuccess: query.isSuccess && matches }
}

// A new banner replaces the one on screen only after its first backdrop (up to 4K) has been downloaded and
// decoded, and while the remote is quiet: painting it cold would stall the next key press. With nothing
// on screen yet there is nothing to protect, so the first banner is taken as it comes.
function useSettledHero(wanted: HeroItem[]) {
  const [shown, setShown] = useState(wanted)
  if (!shown.length && wanted.length) setShown(wanted)
  useEffect(() => {
    if (wanted === shown || !shown.length) return
    const url = firstImageUrl(wanted[0]?.backdrop_path)
    let cancelled = false
    let timer = 0
    const apply = () => {
      if (cancelled) return
      const wait = QUIET_MS - msSinceKeyPress()
      if (wait > 0) { timer = window.setTimeout(apply, wait); return }
      startTransition(() => setShown(wanted))
    }
    if (url) {
      const img = new Image()
      img.src = url
      img.decode().then(() => { decodedBackdrops.add(url); apply() }, apply) // a failed image shouldn't keep the old banner forever
    } else {
      timer = window.setTimeout(apply, 0)
    }
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [wanted, shown])
  return shown
}

// Everything Home needs for its banner: what to show now, and whether there is nothing to show at all.
export function useHomeHero() {
  const { creds } = useApp()
  const selection = useHeroSelection()
  const newest = useNewestHero(selection)
  const selectionKey = selection?.join(',') ?? ''
  const savedKey = creds && selection ? savedHeroKey(creds) : ''
  // Last launch's banner shows at once while the real one is rebuilt; it is only replaced if the new one differs
  // (keeping the same array then means nothing on screen is touched).
  const saved = useMemo(() => readSavedHero(savedKey, selectionKey), [savedKey, selectionKey])
  const fresh = newest.data ?? NO_SLIDES
  const wanted = useMemo(() => {
    // Nothing built yet: last launch's banner, or failing that the one being built.
    if (!fresh.length) return saved.length ? saved : newest.draft
    // Compared whole, not by title alone: a film that had only its poster can gain a backdrop and a plot.
    return JSON.stringify(fresh) === JSON.stringify(saved) ? saved : fresh
  }, [fresh, saved, newest.draft])
  return { items: useSettledHero(wanted), none: newest.isSuccess && newest.data?.length === 0 }
}

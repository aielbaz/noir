import { startTransition, useEffect, useMemo, useState } from 'react'
import { useIsRestoring } from '@tanstack/react-query'
import { useCategories, useCategoryItems } from '../hooks/use-catalog'
import { useHomeLists } from '../hooks/use-home-lists'
import { decodedBackdrops, heroId, useHomeHero, type HeroItem } from '../hooks/use-hero'
import { useInView } from '../hooks/use-in-view'
import { useNavFocus } from '../hooks/use-nav-focus'
import { msSinceKeyPress } from '../utils/remote-activity'
import { usePlayItem } from '../hooks/use-play'
import { describeError } from '../utils/http'
import { readRow, writeRow } from '../utils/row-cache'
import { getSettings } from '../utils/settings'
import { useApp } from '../context/app-provider'
import { useFavorites } from '../utils/favorites'
import { firstImageUrl, type Category, type Item, type Kind } from '../utils/xtream'
import ContentRow, { type Entry } from './content-row'
import ContinueRow from './continue-row'
import { FocusButton, FocusScope } from './focusable'
import ActionButton from './button'
import { ChevronRightIcon, PlayIcon, StarIcon } from './icons'
import Ratio, { POSTER } from './ratio'

const ROW_SIZE = 20
const SHELVES: { kind: Kind; label: string }[] = [
  { kind: 'movie', label: 'Movies' },
  { kind: 'series', label: 'TV Shows' },
]

export default function HomePage() {
  const onSelect = usePlayItem()
  const movies = useCategories('movie')
  const series = useCategories('series')
  const favorites = useFavorites()
  const favoriteEntries = useMemo(() => favorites.slice(0, ROW_SIZE), [favorites])

  // The banner shows the newest additions (movies and shows) of the chosen categories.
  const homeLists = useHomeLists()
  const { items: heroItems, none: noBanner } = useHomeHero()

  const categoriesByKind: Partial<Record<Kind, Category[]>> = {
    movie: movies.data, series: series.data,
  }
  // Before the persisted cache is restored no query reports `isLoading`, which
  // would let the synchronous rows (Continue Watching) render alone at the top.
  const restoring = useIsRestoring()
  const failure = (!movies.data && movies.error) || (!series.data && series.error) || null
  // A retry after a failure goes back to the skeleton instead of keeping the error on screen.
  const retrying = !!failure && (movies.isFetching || series.isFetching)
  const loading = restoring || movies.isLoading || series.isLoading || retrying
  const retry = () => { movies.refetch(); series.refetch() }
  // Nothing to show up there: the chosen categories have no titles, or the whole page is empty.
  const empty = !loading && SHELVES.every(s => !categoriesByKind[s.kind]?.length)
  const noHero = noBanner || empty

  // Full-width page (-ml-28 cancels the layout's rail gutter) so the hero can run
  // behind the pill; rows and hero text add the gutter back as padding.
  return (
    // Last launch's banner is on screen before the lists are: focus its button then, not a second later.
    <FocusScope focusWhen={!loading || heroItems.length > 0} className="-ml-28 min-h-screen overflow-x-hidden pb-20">
      {heroItems.length > 0 ? <Hero key={heroId(heroItems[0])} items={heroItems} onSelect={onSelect} /> : !noHero && <HeroSkeleton />}

      <div className="space-y-2" style={{ paddingTop: heroItems.length || !noHero ? 16 : 40 }}>
        {!empty && (
          <>
            <ContinueRow />
            <ContentRow title="My list" entries={favoriteEntries} onSelect={onSelect} />
          </>
        )}
        {loading && <RowSkeletons />}
        {empty && (
          <div className="flex flex-col items-center gap-6 py-24 pl-28 text-center">
            <p className="max-w-xl text-lg text-gray-400">
              {failure ? describeError(failure) : 'No content available. Check your credentials.'}
            </p>
            <ActionButton focusKey="home-retry" variant="primary" onClick={retry}>Retry</ActionButton>
          </div>
        )}
        {SHELVES.map(({ kind, label }) =>
          categoriesByKind[kind]?.filter(cat => homeLists?.includes(`${kind}:${cat.category_id}`)).map(cat => (
            <Shelf key={`${kind}:${cat.category_id}`} kind={kind} label={label} category={cat} onSelect={onSelect} />
          )),
        )}
      </div>
    </FocusScope>
  )
}

// One row of Home: a category's first titles.
function Shelf({ kind, label, category, onSelect }: {
  kind: Kind
  label: string
  category: Category
  onSelect: (kind: Kind, item: Item) => void
}) {
  // Only fetches its category once it scrolls near the viewport.
  const [ref, near] = useInView<HTMLDivElement>({ rootMargin: '600px 0px', once: true })

  // Saved copy of this row: shown straight away, and the fetch is skipped while it is newer than the refresh interval.
  const { creds } = useApp()
  const rowKey = `${creds?.base}:${creds?.username}:${kind}:${category.category_id}`
  const [{ saved, due }] = useState(() => {
    const row = readRow(rowKey)
    const minutes = getSettings().refreshMinutes
    return { saved: row, due: !row || (minutes !== 0 && Date.now() - row.t > minutes * 60_000) }
  }) // read once, when the row appears; the initializer is where React lets a component read the clock

  const { data } = useCategoryItems(kind, near && due ? category.category_id : null)
  useEffect(() => {
    if (data?.length) writeRow(rowKey, data.slice(0, ROW_SIZE))
  }, [data, rowKey])
  const source = data ?? saved?.items
  const items = useMemo<Entry[]>(() => (source ?? []).slice(0, ROW_SIZE).map(item => ({ kind, item })), [source, kind])

  // Placeholder keeps scroll height stable until the row has loaded.
  if (items.length === 0) return <div ref={ref} className={source ? 'hidden' : undefined}>{!source && <RowSkeleton />}</div>

  return (
    <div ref={ref}>
      <ContentRow title={`${label} · ${category.category_name}`} entries={items} onSelect={onSelect} />
    </div>
  )
}

const HERO_BOX = 'h-[64vh] min-h-[420px]'
const MAX_SLIDES = 10
const QUIET_MS = 2500 // the banner waits this long after the last key press before changing
// A movie slide whose backdrop is its own poster (its details have none, or haven't arrived yet).
const posterOnly = (slide: HeroItem) => !!slide.stream_icon && firstImageUrl(slide.backdrop_path) === slide.stream_icon
const PREFETCH_AHEAD = 2 // slides whose artwork is requested before it is needed (only the next one is mounted)

// Same footprint as the real hero, so nothing jumps when it arrives.
function HeroSkeleton() {
  return (
    <div className={`relative ${HERO_BOX} overflow-hidden bg-[#111418]`} aria-hidden>
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#050607] to-transparent" />
      <div className="absolute bottom-16 left-28 w-full max-w-2xl space-y-4">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="h-14 w-4/5 rounded bg-white/10" />
        <div className="h-4 w-3/5 rounded bg-white/10" />
        <div className="h-12 w-44 rounded-lg bg-white/15" />
      </div>
    </div>
  )
}

// Mirrors ContentRow and ContentCard box for box (heading, padding, poster ratio,
// title and meta lines), so a row swaps in without moving anything.
function RowSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mb-2 h-7 pl-28"><div className="mt-1.5 h-5 w-48 rounded bg-white/10" /></div>
      <div className="no-scrollbar flex gap-4 overflow-hidden py-5 pl-[7.5rem] pr-12">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="w-60 flex-none">
            <Ratio ratio={POSTER} className="overflow-hidden rounded-lg bg-[#111418]" />
            <div className="mt-3 px-1">
              <div className="flex h-7 items-center"><div className="h-4 w-3/4 rounded bg-white/10" /></div>
              <div className="mt-0.5 flex h-5 items-center"><div className="h-3 w-1/3 rounded bg-white/10" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RowSkeletons() {
  return <><RowSkeleton /><RowSkeleton /></>
}

// Remounted (by `key`) whenever the banner's first title changes, so a new banner starts from its first slide.
function Hero({ items, onSelect }: { items: HeroItem[]; onSelect: (kind: Kind, item: Item) => void }) {
  const slides = useMemo(() => items.slice(0, MAX_SLIDES), [items])
  // A banner still being built can lose a slide: stay inside it.
  const [at, setIndex] = useState(0)
  const index = Math.min(at, slides.length - 1)
  // The slow crossfade is for the automatic change; a press of the arrow should answer at once.
  const [quick, setQuick] = useState(false)
  // Text and buttons show straight away; only the artwork waits to be decoded, then fades in.
  // Backdrops already decoded this session show at once when the page is revisited. The first backdrop
  // gates the reveal (the others would only slow it down): its own <img> tells us when it has loaded.
  const firstUrl = firstImageUrl(slides[0].backdrop_path)
  const [ready, setReady] = useState(() => !firstUrl || decodedBackdrops.has(firstUrl))
  const reveal = () => {
    if (firstUrl) decodedBackdrops.add(firstUrl)
    setReady(true)
  }

  // Rotate only while the hero is actually on screen (not scrolled past, not in the background).
  // Only while it is on screen do its backdrops get their own layers: measured on the TV, that
  // takes the crossfade from ~25 to ~55 frames per second, and off screen it would just hold memory.
  const [box, onScreen] = useInView<HTMLDivElement>({ threshold: 0.2 })
  // The banner holds still while the menu has focus: nobody is watching it then, and the menu's
  // own animation gets the whole frame budget.
  const inMenu = useNavFocus()
  // One timeout per slide: it restarts whenever the slide changes, by itself or by the arrow button.
  useEffect(() => {
    if (!onScreen || inMenu || slides.length < 2) return
    let timer = 0
    const arm = (ms: number) => {
      timer = window.setTimeout(() => {
        const wait = QUIET_MS - msSinceKeyPress()
        if (wait > 0) return arm(wait)
        // Low priority: React can drop it for a pending key press.
        startTransition(() => { setQuick(false); setIndex(i => (i + 1) % slides.length) })
      }, ms)
    }
    arm(9000)
    return () => window.clearTimeout(timer)
  }, [onScreen, inMenu, index, slides.length])

  // The next backdrop is kept at 1% instead of 0 so the browser has already painted and uploaded it
  // (they are up to 4K) when the arrow asks for it.
  // Ten full-size backdrops would be a lot of decoded bitmaps, so only the slide on show, the one
  // before it (still fading out) and the next ones are mounted; those next ones are requested early
  // so a slide change never fades in from blank.
  // Requested when the browser is idle, so they don't compete with the rows' posters.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300))
    const handle = idle(() => {
      for (let k = 1; k <= PREFETCH_AHEAD; k++) {
        const url = firstImageUrl(slides[(index + k) % slides.length].backdrop_path)
        if (url) new Image().src = url
      }
    })
    return () => { if (window.cancelIdleCallback) window.cancelIdleCallback(handle) }
  }, [index, slides])
  const isNear = (i: number) => {
    const ahead = (i - index + slides.length) % slides.length
    return ahead <= 1 || ahead === slides.length - 1
  }

  const fade = (i: number) => `transition-opacity ${quick ? 'duration-150' : 'duration-1000'} ${onScreen ? 'will-change-[opacity]' : ''} ${ready && i === index ? 'opacity-100' : i === (index + 1) % slides.length ? 'opacity-[0.01]' : 'opacity-0'}`

  const hero = slides[index]
  const rating = Number(hero.rating)

  return (
    <FocusScope focusWhen={false} preferredChildFocusKey="hero-watch" rememberChild={false}>
    <div ref={box} className={`relative ${HERO_BOX} overflow-hidden bg-[#111418]`}>
      {/* Each slide is one layer that fades as a whole: its picture, the fade at its foot and, for a film
          with no backdrop, its poster. Such a film has the poster stretched across the banner, which shows
          only a soft strip of it, so the poster itself also stands in the middle of the space right of the
          text, a little taller than the banner (its foot is cut off). It sits over the bottom fade, which
          would hide a third of it, and under the side one; a shorter fade of its own covers where it is cut. */}
      {slides.map((slide, i) => isNear(i) && (
        <div key={heroId(slide)} className={`absolute inset-0 ${fade(i)}`}>
          <img
            src={firstImageUrl(slide.backdrop_path)}
            alt=""
            // A failed picture shouldn't leave the first one waiting forever; a loaded one is decoded before it fades in.
            onLoad={i === 0 ? e => { e.currentTarget.decode().then(reveal, reveal) } : undefined}
            onError={i === 0 ? reveal : undefined}
            className="absolute inset-0 size-full object-cover object-top"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050607] to-transparent" />
          {posterOnly(slide) && (
            <>
              <img src={slide.stream_icon} alt="" className="absolute left-[72%] top-0 h-[118%] w-auto max-w-none -translate-x-1/2" />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#050607] to-transparent" />
            </>
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050607] via-[#050607]/60 to-black/25" />

      <div className="absolute bottom-16 left-28 max-w-2xl">
        <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-gray-200">
          {rating > 0 && <span className="flex items-center text-amber-400"><StarIcon className="mr-1 size-4" />{rating.toFixed(1)}</span>}
          {hero.genre && <span>{hero.genre}</span>}
        </div>
        <h1 dir="auto" className="mb-4 line-clamp-2 text-6xl font-bold leading-tight text-white">{hero.name}</h1>
        {hero.plot && <p dir="auto" className="mb-7 line-clamp-3 max-w-xl text-lg text-gray-200">{hero.plot}</p>}
        <div className="flex items-center gap-6">
          <ActionButton focusKey="hero-watch" variant="primary" icon={<PlayIcon />} onClick={() => onSelect(hero.heroKind, hero)}>
            Watch now
          </ActionButton>
        </div>
      </div>

      {/* Level with the Watch now button, so Right from it lands here. */}
      {slides.length > 1 && (
        <FocusButton
          aria-label="Next title"
          onClick={() => { setQuick(true); setIndex(i => (i + 1) % slides.length) }}
          className="absolute bottom-16 right-12 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <ChevronRightIcon className="size-7" />
        </FocusButton>
      )}
    </div>
    </FocusScope>
  )
}

import { describeError } from '../utils/http'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useCategories, useCategoryItems, usePaged } from '../hooks/use-catalog'
import { useSearchItems } from '../hooks/use-search'
import { SORTS, sorters, type SortId } from '../utils/sort'
import { getSettings } from '../utils/settings'
import { nextOf } from '../utils/cycle'
import { useEpg } from '../hooks/use-epg'
import { usePlayItem } from '../hooks/use-play'
import { recallView, rememberView } from '../utils/view-memory'
import type { Item, Kind } from '../utils/xtream'
import { cn } from '../utils/cn'
import ContentCard from './content-card'
import Ratio, { POSTER, SQUARE } from './ratio'
import InfiniteGrid from './infinite-grid'
import { FocusButton, FocusInput, FocusScope, sendFocus } from './focusable'
import ActionButton from './button'
import { RetryIcon, SortIcon } from './icons'

const TITLES: Record<Kind, string> = { live: 'Live TV', movie: 'Movies', series: 'TV Shows' }
const SEARCH_NOUN: Record<Kind, string> = { live: 'channels', movie: 'movies', series: 'TV shows' }
const MIN_SEARCH = 2

const GRID: Record<Kind, string> = {
  live: 'grid-cols-4',
  movie: 'grid-cols-4',
  series: 'grid-cols-4',
}

export const categoryFocusKey = (kind: Kind, id: string) => `cat-${kind}-${id}`

export const cardFocusKey = (kind: Kind, item: Item) => `card-${kind}-${item.stream_id ?? item.series_id}`

export default function CatalogPage({ kind }: { kind: Kind }) {
  const onSelect = usePlayItem()
  const categoriesQuery = useCategories(kind)
  const saved = useRef(recallView(kind)).current
  const [pickedCat, setPickedCat] = useState<string | null>(saved?.category ?? null)
  const [search, setSearch] = useState(saved?.search ?? '')
  const [sort, setSort] = useState<SortId>((saved?.sort as SortId) ?? getSettings().defaultSort)
  const [infoId, setInfoId] = useState<number>()
  const infoTimer = useRef<number | undefined>(undefined)
  const [term, setTerm] = useState((saved?.search ?? '').trim().toLowerCase())

  // Typing with a remote is slow, and a search may mean loading a whole section,
  // so wait for a pause before acting on the text.
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(search.trim().toLowerCase()), 350)
    return () => window.clearTimeout(t)
  }, [search])
  const searching = term.length >= MIN_SEARCH

  // An active search owns one history entry, so the TV's Back key clears it
  // instead of leaving the page.
  const router = useRouter()
  const entryState = useRouterState({ select: s => s.location.state as { search?: boolean; rail?: boolean } | undefined })
  const searchEntry = !!entryState?.search
  const railOpen = !!entryState?.rail
  const entryPushed = useRef(false)
  const hasSearch = search.length > 0
  useEffect(() => {
    if (hasSearch && !entryPushed.current) {
      entryPushed.current = true
      if (!searchEntry) router.history.push(router.state.location.href, { search: true })
    } else if (!hasSearch && entryPushed.current) {
      entryPushed.current = false
      if ((router.state.location.state as { search?: boolean } | undefined)?.search) router.history.back()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearch])
  useEffect(() => {
    if (entryPushed.current && !searchEntry && !railOpen) {
      entryPushed.current = false
      setSearch('')
      setTerm('')
    }
  }, [searchEntry, railOpen])

  const categories = categoriesQuery.data
  // No "All" tab: loading every title at once is exactly what froze the TV.
  const activeCat = (pickedCat && categories?.some(c => c.category_id === pickedCat) ? pickedCat : null)
    ?? categories?.[0]?.category_id ?? null
  const categoryQuery = useCategoryItems(kind, activeCat)
  const searchQuery = useSearchItems(kind, term, sort, searching)
  // Searching looks through the whole section; browsing stays one category at a time.
  const itemsQuery = searching ? searchQuery : categoryQuery

  const filtered = useMemo(() => {
    let items = itemsQuery.data ?? []
    // A whole-section search is already filtered and sorted by the worker.
    if (searching) return items
    if (term) items = items.filter(i => i.name?.toLowerCase().includes(term))
    const compare = sorters[sort]
    return compare ? [...items].sort(compare) : items
  }, [itemsQuery.data, term, sort, searching])

  const restoring = !!saved && saved.search.trim().toLowerCase() === term && (searching || saved.category === activeCat)
  const viewKey = `${kind}:${searching ? 'all' : activeCat}:${term}:${sort}`
  const lastCard = useRef<{ view: string; key: string }>(undefined)
  const paged = usePaged(filtered, viewKey, 60, restoring ? saved.index + 60 : 60)
  // A different category, search or sort is a new list: show it from its top.
  const shownView = useRef(viewKey)
  useEffect(() => {
    if (shownView.current === viewKey) return
    shownView.current = viewKey
    window.scrollTo(0, 0)
  }, [viewKey])
  const loading = categoriesQuery.isLoading || itemsQuery.isLoading
  const failed = categoriesQuery.isError || itemsQuery.isError
  const reason = describeError(categoriesQuery.error ?? itemsQuery.error)

  function onFocusItem(_: Kind, item: Item) {
    lastCard.current = { view: viewKey, key: cardFocusKey(kind, item) }
    rememberView(kind, { category: activeCat ?? '', focusKey: cardFocusKey(kind, item), index: Math.max(0, filtered.indexOf(item)), search, sort })
    if (kind === 'live') {
      window.clearTimeout(infoTimer.current)
      infoTimer.current = window.setTimeout(() => setInfoId(item.stream_id), 400)
    }
  }

  // Arrow navigation between the two panes should land on a predictable spot, not
  // whichever element happens to sit beside the cursor: Right enters the grid at
  // its first title, Left from the grid's first column returns to the selected category.
  const navRef = useRef<HTMLElement>(null)
  const firstKey = paged.visible[0] ? cardFocusKey(kind, paged.visible[0]) : undefined
  const homeCategory = categories?.find(c => !searching && c.category_id === activeCat) ?? categories?.[0]
  const homeKey = homeCategory ? categoryFocusKey(kind, homeCategory.category_id) : undefined
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (!(el instanceof HTMLElement)) return
      // The ends of the category list are ends: Up on the first or Down on the last category stays put
      // (the spatial search would otherwise jump to the nearest control in the grid).
      if ((e.keyCode === 38 || e.keyCode === 40) && navRef.current?.contains(el)) {
        const buttons = navRef.current.querySelectorAll('button')
        if (el === buttons[e.keyCode === 38 ? 0 : buttons.length - 1]) { e.preventDefault(); e.stopImmediatePropagation(); return }
      }
      // Coming back from the category list resumes where you were in this list, not at its top.
      const last = lastCard.current
      const resume = last && last.view === viewKey && paged.visible.some(i => cardFocusKey(kind, i) === last.key) ? last.key : undefined
      const target = resume ?? firstKey ?? (failed ? RETRY_KEY : undefined)
      if (e.keyCode === 39 && target && navRef.current?.contains(el)) {
        e.preventDefault(); e.stopPropagation(); sendFocus(target)
      } else if (e.keyCode === 39 && el.closest('[data-grid]')) {
        // Right at the end of a row continues at the start of the next one.
        const grid = el.closest('[data-grid]')!
        const cells = Array.from(grid.children)
        const at = cells.indexOf(el.closest('[data-grid] > *')!) + Number((grid as HTMLElement).dataset.start ?? 0)
        const next = cells[at + 1 - Number((grid as HTMLElement).dataset.start ?? 0)]
        const following = paged.visible[at + 1]
        if (cells.length && next && following && next.getBoundingClientRect().top > el.getBoundingClientRect().top + 8) {
          e.preventDefault(); e.stopPropagation(); sendFocus(cardFocusKey(kind, following))
        }
      } else if (e.keyCode === 38 && el.closest('[data-grid]')) {
        // Up from the top row goes to the sort button. Left to the spatial search, a scrolled
        // category list puts some category nearer than the header and focus lands there.
        const grid = el.closest<HTMLElement>('[data-grid]')!
        const first = grid.firstElementChild
        if (first && Number(grid.dataset.start ?? 0) === 0 && el.getBoundingClientRect().top <= first.getBoundingClientRect().top + 8) {
          e.preventDefault(); e.stopPropagation(); sendFocus(SORT_KEY)
        }
      } else if (e.keyCode === 37 && homeKey && el.textContent?.trim() === 'Retry') {
        e.preventDefault(); e.stopPropagation(); sendFocus(homeKey)
      } else if (e.keyCode === 37 && homeKey && el.closest('[data-grid]')) {
        const first = document.querySelector<HTMLElement>('[data-grid] > *')
        if (first && el.getBoundingClientRect().left <= first.getBoundingClientRect().left + 8) {
          e.preventDefault(); e.stopPropagation(); sendFocus(homeKey)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [firstKey, homeKey, failed, paged.visible, kind, viewKey])

  const retry = () => { categoriesQuery.refetch(); itemsQuery.refetch() }
  const heading = searching ? `Results for “${search.trim()}”` : categories?.find(c => c.category_id === activeCat)?.category_name ?? TITLES[kind]
  const sortLabel = SORTS.find(s => s.id === sort)!.label
  const count = searching ? searchQuery.total ?? filtered.length : filtered.length
  const subtitle = loading || failed || filtered.length === 0
    ? ''
    : `${count.toLocaleString()} ${count === 1 ? 'title' : 'titles'}${searching ? ` in all ${SEARCH_NOUN[kind]}` : ''} · Hold OK on a title to add it to My list`

  return (
    <FocusScope
      focusWhen={!!categories && !categoryQuery.isLoading}
      restoreKey={restoring ? saved.focusKey : undefined}
      className="flex min-h-screen"
    >
      {/* Vertical list: Up/Down walks the categories, Left from the grid lands here. */}
      <nav ref={navRef} aria-label="Categories" className="sticky top-0 -ml-3 h-screen w-[18.75rem] shrink-0 py-8 pl-3 pr-4">
        <div className="flex h-full flex-col">
          <h2 className="px-8 pb-3 text-sm font-semibold uppercase tracking-wider text-[#667684]">Categories</h2>
          <div className="no-scrollbar min-h-0 flex-1 scroll-py-10 overflow-y-auto px-3 py-3">
            {categories?.map(cat => {
              const selected = !searching && cat.category_id === activeCat
              return (
                <FocusButton
                  key={cat.category_id}
                  focusKey={categoryFocusKey(kind, cat.category_id)}
                  onClick={() => { setSearch(''); setTerm(''); setPickedCat(cat.category_id) }}
                  title={cat.category_name}
                  className={cn(
                    'mb-1 flex h-12 w-full items-center rounded-full px-5 text-left text-base focus:!transform-none', // ring only, no scale-up
                    selected ? 'tv-ring-gap bg-white font-semibold text-black' : 'text-[#aab8c2]',
                  )}
                >
                  <span className="truncate">{cat.category_name}</span>
                </FocusButton>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="min-w-0 flex-1 pr-12">
        {/* Fixed instead of sticky: it stays out of the scrolling layer, so it isn't repainted with every scroll. The spacer keeps its place in the flow. */}
        <div aria-hidden className={kind === 'live' ? 'h-[8.75rem]' : 'h-[6.75rem]'} />
        <div className="fixed left-[25rem] right-0 top-0 z-30 bg-[#050607] pb-3 pr-12 pt-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold">{heading}</h1>
              <p className="mt-1 min-h-[1.5rem] truncate text-base text-[#667684]">{subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ActionButton
                size="sm"
                focusKey={SORT_KEY}
                icon={<SortIcon />}
                onClick={() => setSort(nextOf(SORTS.map(s => s.id), sort))}
              >
                {sortLabel}
              </ActionButton>
              <FocusInput
                className="h-12 w-64 rounded-lg bg-white/15 px-5 text-lg text-white placeholder-[#8b95a1]"
                placeholder={`Search all ${SEARCH_NOUN[kind]}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          {kind === 'live' && <ChannelInfo streamId={infoId} />}
        </div>

        <div className="pb-16 pt-2">
          {failed ? (
            <Message action={{ label: 'Retry', onClick: retry }}>{`Couldn't load this list. ${reason}`}</Message>
          ) : loading ? (
            // Same grid and card structure as the real thing (poster, title line, meta line).
            <div aria-hidden className={cn('grid animate-pulse items-start gap-x-6 gap-y-8 px-1 py-2', GRID[kind])}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>
                  <Ratio ratio={kind === 'live' ? SQUARE : POSTER} className="overflow-hidden rounded-lg bg-[#111418]" />
                  <div className="mt-3 px-1">
                    <div className="flex h-7 items-center"><div className="h-4 w-3/4 rounded bg-white/10" /></div>
                    {kind !== 'live' && <div className="mt-0.5 flex h-5 items-center"><div className="h-3 w-1/3 rounded bg-white/10" /></div>}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Message>{searching ? `No ${SEARCH_NOUN[kind]} match “${search.trim()}”.` : term ? `No matches for “${search.trim()}” in this category.` : 'Nothing in this category.'}</Message>
          ) : (
            <>
              <InfiniteGrid
                className={cn('grid items-start gap-x-6 gap-y-8 px-1 py-2', GRID[kind])}
                total={paged.visible.length}
                resetKey={viewKey}
                ensureIndex={restoring ? saved.index : undefined}
                focusKeyOf={i => cardFocusKey(kind, paged.visible[i])}
                hasMore={paged.hasMore}
                loadMore={paged.loadMore}
                renderItem={i => {
                  const item = paged.visible[i]
                  return (
                    <ContentCard
                      key={item.stream_id ?? item.series_id ?? i}
                      focusKey={cardFocusKey(kind, item)}
                      item={item}
                      kind={kind}
                      onFocusItem={onFocusItem}
                      onSelect={(k, it) => onSelect(k, it, filtered)}
                    />
                  )
                }}
              />
            </>
          )}
        </div>
      </div>
    </FocusScope>
  )
}

function ChannelInfo({ streamId }: { streamId: number | undefined }) {
  const { current, next } = useEpg(streamId)
  return (
    <p className="mt-2 h-6 truncate text-base text-[#aab8c2]">
      {current ? <><span className="text-white">Now</span> {current.title}</> : streamId ? 'No guide data for this channel' : 'Focus a channel to see what’s on'}
      {next && <span className="text-[#667684]"> · Next {next.title}</span>}
    </p>
  )
}

const RETRY_KEY = 'catalog-retry'
const SORT_KEY = 'catalog-sort'

export function Message({ children, action }: { children: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-5 text-center text-lg text-gray-500">
      {children}
      {action && (
        <ActionButton focusKey={RETRY_KEY} variant="primary" icon={<RetryIcon />} onClick={action.onClick}>
          {action.label}
        </ActionButton>
      )}
    </div>
  )
}

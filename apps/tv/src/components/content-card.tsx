import { cn } from '../utils/cn'
import { favoriteKey, toggleFavorite, useFavorites } from '../utils/favorites'
import { useActionKeys } from '../hooks/use-action-keys'
import { FocusButton } from './focusable'
import { useWatched } from '../utils/progress'
import { useSettings } from '../utils/settings'
import { CheckIcon, HeartIcon, StarIcon } from './icons'
import Poster from './poster'
import Ratio, { POSTER, SQUARE } from './ratio'
import type { Item, Kind } from '../utils/xtream'

type Props = {
  item: Item
  kind: Kind
  onSelect: (kind: Kind, item: Item) => void
  onFocusItem?: (kind: Kind, item: Item) => void
  focusKey?: string
  wide?: boolean
}

export default function ContentCard({ item, kind, onSelect, onFocusItem, focusKey, wide = kind === 'live' }: Props) {
  const favorite = useFavorites().some(f => f.key === favoriteKey(kind, item))
  const watched = useWatched()
  const { watchedBadge } = useSettings()
  const isWatched = watchedBadge && kind === 'movie' && watched.includes(`movie:${item.stream_id}`)
  const keys = useActionKeys(() => onSelect(kind, item), () => toggleFavorite(kind, item))

  const rating = Number(item.rating)
  const year = (item.year || item.releaseDate || '').slice(0, 4)
  const hasMeta = kind !== 'live' && (rating > 0 || !!year)

  return (
    <FocusButton
      plain
      focusKey={focusKey}
      aria-label={item.name}
      onFocus={() => onFocusItem?.(kind, item)}
      className="group block w-full scroll-my-28 text-left"
      {...keys}
    >
      {/* Only the poster reacts to focus: it lifts and gets a clean white ring. */}
      <Ratio
        ratio={wide ? SQUARE : POSTER}
        className="rounded-lg bg-[#111418] transition-transform duration-200 ease-out group-focus:scale-[1.06] group-focus:ring-4 group-focus:ring-white"
        innerClassName="flex items-center justify-center"
      >
        <Poster src={item.stream_icon || item.cover} title={item.name} contain={wide} />

        {isWatched && (
          <div className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white">
            <CheckIcon className="size-4" aria-label="Watched" />
          </div>
        )}

        {favorite && (
          <div className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white">
            <HeartIcon className="size-4" filled />
          </div>
        )}
      </Ratio>

      <div className={cn('mt-3 px-1', kind !== 'live' && 'min-h-[3.125rem]')}>
        <p dir="auto" className="truncate text-lg font-medium text-[#d3dbe2] transition-colors duration-200 group-focus:text-white">
          {item.name}
        </p>
        {hasMeta && (
          <p className="mt-0.5 flex items-center text-sm text-[#9aa8b3]">
            {rating > 0 && (
              <>
                <StarIcon className="mr-1 size-3.5 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </>
            )}
            {rating > 0 && year && <span className="mx-2">·</span>}
            {year && <span>{year}</span>}
          </p>
        )}
      </div>
    </FocusButton>
  )
}

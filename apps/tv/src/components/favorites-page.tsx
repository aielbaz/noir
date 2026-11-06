import { useFavorites } from '../utils/favorites'
import { usePaged } from '../hooks/use-catalog'
import { usePlayItem } from '../hooks/use-play'
import ContentCard from './content-card'
import InfiniteGrid from './infinite-grid'
import { FocusScope } from './focusable'

export default function FavoritesPage() {
  const onSelect = usePlayItem()
  const favorites = useFavorites()
  const paged = usePaged(favorites, 'favorites')

  return (
    <FocusScope className="min-h-screen pr-12 pb-16 pt-10">
      <h1 className="mb-1 text-3xl font-bold">My list</h1>
      <p className="mb-6 text-sm text-[#667684]">Hold OK on any title to add it here, or hold it again to remove it.</p>

      {favorites.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-lg text-gray-500">Nothing saved yet.</div>
      ) : (
        <InfiniteGrid
          className="grid grid-cols-3 items-start gap-x-6 gap-y-8 px-1 py-2 md:grid-cols-4 xl:grid-cols-6"
          total={paged.visible.length}
          resetKey={`favorites:${favorites.length}`}
          hasMore={paged.hasMore}
          loadMore={paged.loadMore}
          renderItem={i => {
            const { key, kind, item } = paged.visible[i]
            return <ContentCard key={key} item={item} kind={kind} onSelect={onSelect} />
          }}
        />
      )}
    </FocusScope>
  )
}

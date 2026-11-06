import { createListStore } from './list-store'
import type { Item, Kind } from './xtream'

export type Favorite = { key: string; kind: Kind; item: Item }

const store = createListStore<Favorite>('streambox_favorites', 500)

export const favoriteKey = (kind: Kind, item: Item) =>
  `${kind}:${kind === 'series' ? item.series_id : item.stream_id}`

// Keep only what cards need so hundreds of favorites stay small.
const slim = (item: Item): Item => ({
  name: item.name,
  stream_id: item.stream_id,
  series_id: item.series_id,
  stream_icon: item.stream_icon,
  cover: item.cover,
  rating: item.rating,
  container_extension: item.container_extension,
})

export function toggleFavorite(kind: Kind, item: Item) {
  const key = favoriteKey(kind, item)
  const list = store.get()
  store.set(list.some(f => f.key === key)
    ? list.filter(f => f.key !== key)
    : [{ key, kind, item: slim(item) }, ...list])
}

export const useFavorites = store.useList
export const clearFavorites = store.clear

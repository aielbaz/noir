import type { Item } from './xtream'

export const SORTS = [
  { id: 'default', label: 'Provider order' },
  { id: 'name', label: 'A–Z' },
  { id: 'rating', label: 'Top rated' },
  { id: 'added', label: 'Recently added' },
] as const
export type SortId = (typeof SORTS)[number]['id']

export const sorters: Record<SortId, ((a: Item, b: Item) => number) | null> = {
  default: null,
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
  added: (a, b) => (Number(b.added) || 0) - (Number(a.added) || 0),
}

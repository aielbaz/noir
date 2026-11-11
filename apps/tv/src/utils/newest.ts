import type { Item, Kind } from './xtream'

// What the app keeps of a show's list entry. The provider sends the full plot, cast, director and
// every backdrop (~1.5 KB each); the grids and the home banner need a fraction of that, and the
// show page loads the rest itself.
export function slimShow(s: Item): Item {
  return {
    series_id: s.series_id,
    name: s.name,
    cover: s.cover,
    rating: s.rating,
    releaseDate: s.releaseDate,
    category_id: s.category_id,
    genre: s.genre,
    plot: s.plot ? s.plot.slice(0, 300) : s.plot,
    // the banner shows only the first backdrop
    backdrop_path: Array.isArray(s.backdrop_path) ? s.backdrop_path.slice(0, 1) : s.backdrop_path,
    // series carry no `added`; their last update drives "Recently added"
    added: (s as Item & { last_modified?: string }).last_modified ?? s.added,
  }
}

// The most recently added titles, from the chosen categories (or from everything). Shows need a
// backdrop. With no categories chosen a rating is also required, which keeps out entries with no
// metadata at all; an explicit choice is trusted.
export function pickNewest(items: Item[], kind: Kind, count: number, categoryIds?: string[]) {
  const chosen = categoryIds && categoryIds.length ? new Set(categoryIds) : null
  return items
    .filter(i => (chosen ? chosen.has(String(i.category_id)) : Number(i.rating) > 0)
      && Number(i.added) > 0
      && (kind !== 'series' || (Array.isArray(i.backdrop_path) ? i.backdrop_path.length > 0 : !!i.backdrop_path)))
    .sort((a, b) => Number(b.added) - Number(a.added))
    .slice(0, count)
}

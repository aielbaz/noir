import type { Kind } from './xtream'

// Remembers where the user was on each catalog page so coming back from the
// player (or another screen) lands on the same card instead of the top.
export type CatalogView = { category: string; focusKey: string; index: number; search: string; sort: string }

const views = new Map<Kind, CatalogView>()

export const rememberView = (kind: Kind, view: CatalogView) => { views.set(kind, view) }
export const recallView = (kind: Kind) => views.get(kind)
export const forgetViews = () => views.clear()

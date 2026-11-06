import { useSyncExternalStore } from 'react'
import { SORTS, type SortId } from './sort'

// User preferences. One small object in localStorage, exposed as an external
// store so every screen sees a change immediately.

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export const REFRESH_OPTIONS = [15, 60, 360, 720, 1440, 0] // minutes; 0 = only when asked

export const refreshLabel = (m: number) => (m === 0 ? 'Manual' : m < 60 ? `${m} min` : m === 60 ? '1 hour' : m === 1440 ? 'Daily' : `${m / 60} hours`)

export type Settings = {
  // Categories the Home banner draws from, as `movie:<id>` / `series:<id>`. null: not chosen, so the first movie category and the first show category.
  heroSelection: string[] | null
  // Categories shown as rows on Home, as `movie:<id>` / `series:<id>`. null: the first two movie
  // categories and the first two show categories.
  homeLists: string[] | null
  defaultSort: SortId // how Movies, TV Shows and Live TV lists start out (a SortId)
  refreshMinutes: number // lists older than this refresh in the background; 0 = manual only
  autoplayNext: boolean // start the next episode when one ends
  upNextCard: boolean // show the "Up next" card near the end of an episode
  watchedBadge: boolean // tick on movies and episodes that were watched
  defaultSpeed: number // playback speed for movies and episodes
}

const DEFAULTS: Settings = { refreshMinutes: 360, heroSelection: null, homeLists: null, defaultSort: 'default', autoplayNext: true, upNextCard: true, watchedBadge: true, defaultSpeed: 1 }
const KEY = 'streambox_settings'

function read(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const merged = { ...DEFAULTS, ...saved }
    if (!SPEEDS.includes(merged.defaultSpeed)) merged.defaultSpeed = 1
    if (!REFRESH_OPTIONS.includes(merged.refreshMinutes)) merged.refreshMinutes = 360
    if (!Array.isArray(merged.heroSelection) || !merged.heroSelection.length) merged.heroSelection = null
    if (!Array.isArray(merged.homeLists) || !merged.homeLists.length) merged.homeLists = null
    if (!SORTS.some(s => s.id === merged.defaultSort)) merged.defaultSort = 'default'
    return merged
  } catch {
    return DEFAULTS
  }
}

let current = read()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* storage full: keep in memory */ }
  listeners.forEach(l => l())
}

export function subscribeSettings(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useSettings() {
  return useSyncExternalStore(
    subscribeSettings,
    () => current,
  )
}

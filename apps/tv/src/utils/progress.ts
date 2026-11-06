import { useSyncExternalStore } from 'react'
import { createListStore } from './list-store'

// Continue-watching store. Lives in localStorage (tiny, synchronous) and is
// exposed as an external store so Home updates after returning from the player.

export type WatchEntry = {
  id: string // unique per playable (movie or episode)
  group: string // one shelf entry per movie / series; the latest episode wins
  kind: 'movie' | 'episode'
  name: string
  image?: string
  streamUrl: string
  position: number
  duration: number
  updatedAt: number
}

const KEY = 'streambox_progress'
const MAX_ENTRIES = 20
const MIN_POSITION = 10 // seconds before something counts as "started"
const FINISHED_RATIO = 0.95
const FINISHED_TAIL = 45 // seconds left

function read(): WatchEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

let entries = read()
const listeners = new Set<() => void>()

function commit(next: WatchEntry[]) {
  entries = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* storage full or unavailable: keep in-memory state */ }
  listeners.forEach(l => l())
}

export function getProgress(id: string | undefined) {
  return id ? entries.find(e => e.id === id) : undefined
}

// Episodes/movies that were played to the end (or close to it).
const watchedStore = createListStore<string>('streambox_watched', 3000)
export const useWatched = watchedStore.useList
export function markWatched(id: string) {
  const list = watchedStore.get()
  if (!list.includes(id)) watchedStore.set([id, ...list])
}

export function saveProgress(entry: Omit<WatchEntry, 'updatedAt'>) {
  const finished = entry.duration > 0 &&
    (entry.position / entry.duration >= FINISHED_RATIO || entry.duration - entry.position < FINISHED_TAIL)
  const others = entries.filter(e => e.group !== entry.group)
  if (finished) {
    markWatched(entry.id)
    return commit(others)
  }
  if (entry.position < MIN_POSITION) return
  commit([{ ...entry, updatedAt: Date.now() }, ...others].slice(0, MAX_ENTRIES))
}

export function removeProgress(group: string) {
  commit(entries.filter(e => e.group !== group))
}

export function clearProgress() {
  commit([])
}

export function useContinueWatching() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => entries,
  )
}

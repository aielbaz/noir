import { useSyncExternalStore } from 'react'

// Tiny localStorage-backed list exposed as an external store, so components
// re-render when it changes anywhere in the app.
export function createListStore<T>(key: string, max: number) {
  const read = (): T[] => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  }

  let list = read()
  const listeners = new Set<() => void>()
  const subscribe = (cb: () => void) => {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }

  function set(next: T[]) {
    list = next.slice(0, max)
    try {
      localStorage.setItem(key, JSON.stringify(list))
    } catch { /* storage full: keep the in-memory copy */ }
    listeners.forEach(l => l())
  }

  return {
    get: () => list,
    set,
    clear: () => set([]),
    useList: () => useSyncExternalStore(subscribe, () => list),
  }
}

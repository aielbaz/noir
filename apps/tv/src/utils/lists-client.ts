import ListsWorker from '../workers/lists.worker?worker&inline'
import { HttpError, RedirectError, TimeoutError } from './http'
import { itemsUrl, type Creds, type Item, type Kind } from './xtream'
import { getSettings } from './settings'
import type { SortId } from './sort'
import { queryClient } from '../react-query/client'

// Page-side handle to the lists worker (see workers/lists.worker.ts).
let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, { resolve: (value: never) => void; reject: (error: Error) => void }>()

function toError(message: string): Error {
  if (message === 'redirect') return new RedirectError()
  if (message === 'timeout') return new TimeoutError()
  if (message.startsWith('http:')) return new HttpError(Number(message.slice(5)))
  return new Error(message)
}

function call<T>(message: Record<string, unknown>): Promise<T> {
  if (!worker) {
    worker = new ListsWorker()
    worker.onmessage = (e: MessageEvent<{ id: number; error?: string }>) => {
      const job = pending.get(e.data.id)
      if (!job) return
      pending.delete(e.data.id)
      if (e.data.error) job.reject(toError(e.data.error))
      else job.resolve(e.data as never)
    }
  }
  const id = ++nextId
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject })
    worker!.postMessage({ id, ...message })
  })
}

const keyOf = (creds: Creds, kind: Kind) => `${creds.base}|${creds.username}|${kind}`

// The saved full list's slice for one category; null when no list is saved yet.
export async function savedCategory(creds: Creds, kind: Kind, categoryId: string) {
  const r = await call<{ items: Item[] | null }>({ op: 'category', key: keyOf(creds, kind), categoryId })
  return r.items
}

// The newest titles of a section from the saved list; null when no list is saved yet.
export async function savedNewest(creds: Creds, kind: Kind, count: number, categoryIds?: string[]) {
  const r = await call<{ items: Item[] | null }>({ op: 'newest', key: keyOf(creds, kind), count, categoryIds })
  return r.items
}

export async function searchSaved(creds: Creds, kind: Kind, term: string, sort: SortId) {
  return call<{ items: Item[]; total: number }>({ op: 'search', key: keyOf(creds, kind), url: itemsUrl(creds, kind, null), term, sort })
}

// Refreshes the saved full list when it is older than the refresh interval (or on demand),
// then lets every open list know. Fire and forget: errors just leave the old copy in place.
const lastCheck = new Map<string, number>()
export async function syncList(creds: Creds, kind: Kind, force = false) {
  const minutes = getSettings().refreshMinutes
  const maxAge = minutes === 0 ? Infinity : minutes * 60_000
  const key = keyOf(creds, kind)
  if (!force && Date.now() - (lastCheck.get(key) ?? 0) < 5 * 60_000) return
  lastCheck.set(key, Date.now())
  const r = await call<{ refreshed: boolean }>({ op: 'sync', key, url: itemsUrl(creds, kind, null), maxAge, force })
  if (r.refreshed) {
    await queryClient.invalidateQueries({ queryKey: ['items', kind] })
    queryClient.invalidateQueries({ queryKey: ['hero'] }) // the newest titles may have changed
  }
}

export function syncListLater(creds: Creds, kind: Kind) {
  // Let what is on screen load first; this is a big background download.
  window.setTimeout(() => { syncList(creds, kind).catch(() => lastCheck.delete(keyOf(creds, kind))) }, 4000)
}

export async function clearLists() {
  lastCheck.clear()
  await call({ op: 'clear', key: '' }).catch(() => undefined)
}

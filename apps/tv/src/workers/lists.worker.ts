// Owns each section's full title list (tens of thousands of entries, ~13 MB of
// JSON). Downloading, parsing, saving to IndexedDB and filtering all happen here,
// off the main thread; the page only ever receives the slice it asks for
// (one category, or the matches of a search).
import { sorters, type SortId } from '../utils/sort'
import { pickNewest, slimShow } from '../utils/newest'
import type { Item, Kind } from '../utils/xtream'

const MAX_RESULTS = 1000
const KEEP_MS = 10 * 60_000 // drop the in-memory copy once idle; the saved one stays

type Entry = { updatedAt: number; items: Item[]; v?: number }

// Saved lists keep only what the app reads from them (see slimShow; the series section is 22 MB
// as sent). Bump when the kept fields change: older saved copies are slimmed on load.
const LIST_VERSION = 2
const kindOf = (key: string) => key.split('|').pop()

const slim = (key: string, items: Item[]): Item[] => (kindOf(key) === 'series' ? items.map(slimShow) : items)
type Request = {
  id: number
  op: 'category' | 'sync' | 'search' | 'newest' | 'clear'
  key: string // account + section
  url?: string
  categoryId?: string
  maxAge?: number
  force?: boolean
  term?: string
  sort?: SortId
  count?: number
  categoryIds?: string[]
}

// ---- saved copy (IndexedDB) ----
let dbPromise: Promise<IDBDatabase> | undefined
const db = () => (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
  const open = indexedDB.open('streambox-lists', 1)
  open.onupgradeneeded = () => open.result.createObjectStore('lists')
  open.onsuccess = () => resolve(open.result)
  open.onerror = () => reject(open.error)
}))

async function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const d = await db()
  return new Promise<T>((resolve, reject) => {
    const request = run(d.transaction('lists', mode).objectStore('lists'))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---- in-memory copy ----
const memory = new Map<string, Entry>()
let dropTimer: ReturnType<typeof setTimeout> | undefined
const touch = () => {
  clearTimeout(dropTimer)
  dropTimer = setTimeout(() => memory.clear(), KEEP_MS)
}

async function have(key: string) {
  let entry = memory.get(key)
  if (!entry) {
    entry = (await store<Entry | undefined>('readonly', s => s.get(key)).catch(() => undefined)) ?? undefined
    if (entry && entry.v !== LIST_VERSION) {
      entry = { ...entry, items: slim(key, entry.items), v: LIST_VERSION }
      store('readwrite', st => st.put(entry!, key)).catch(() => undefined)
    }
    if (entry) memory.set(key, entry)
  }
  return entry
}

async function download(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    if (response.type === 'opaqueredirect') throw new Error('redirect')
    if (!response.ok) throw new Error(`http:${response.status}`)
    const data = await response.json()
    return Array.isArray(data) ? (data as Item[]) : []
  } catch (error) {
    if (controller.signal.aborted) throw new Error('timeout', { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const inflight = new Map<string, Promise<Entry>>()

// Makes sure a copy exists and is newer than maxAge; downloads only when it isn't.
async function sync(key: string, url: string, maxAge: number, force: boolean) {
  const current = await have(key)
  if (current && !force && Date.now() - current.updatedAt < maxAge) return { updatedAt: current.updatedAt, refreshed: false }
  let job = inflight.get(key)
  if (!job) {
    job = download(url).then(async items => {
      const entry: Entry = { updatedAt: Date.now(), items: slim(key, items), v: LIST_VERSION }
      memory.set(key, entry)
      await store('readwrite', s => s.put(entry, key)).catch(() => undefined)
      return entry
    }).finally(() => inflight.delete(key))
    inflight.set(key, job)
  }
  const entry = await job
  return { updatedAt: entry.updatedAt, refreshed: true }
}

const reply = (message: unknown) => (self as unknown as Worker).postMessage(message)

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, op, key, url, categoryId, maxAge, force, term, sort, count, categoryIds } = event.data
  try {
    touch()
    if (op === 'clear') {
      memory.clear()
      await store('readwrite', s => s.clear()).catch(() => undefined)
      reply({ id })
    } else if (op === 'sync') {
      reply({ id, ...(await sync(key, url!, maxAge ?? 0, !!force)) })
    } else if (op === 'newest') {
      const entry = await have(key)
      const picked = entry ? pickNewest(entry.items, kindOf(key) as Kind, count ?? 8, categoryIds) : null
      reply({ id, items: picked })
    } else if (op === 'category') {
      // Only what is already on hand: no download, so the page can fall back to the small per-category request.
      const entry = await have(key)
      reply({ id, items: entry ? entry.items.filter(i => String(i.category_id) === categoryId) : null })
    } else {
      await sync(key, url!, Infinity, false)
      const list = (await have(key))?.items ?? []
      const matches = list.filter(item => item.name?.toLowerCase().includes(term!))
      const compare = sorters[sort!]
      if (compare) matches.sort(compare)
      reply({ id, items: matches.slice(0, MAX_RESULTS), total: matches.length })
    }
  } catch (error) {
    reply({ id, error: error instanceof Error ? error.message : 'network' })
  }
}

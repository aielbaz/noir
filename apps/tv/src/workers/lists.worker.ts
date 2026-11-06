// Owns each section's full title list (tens of thousands of entries, ~13 MB of
// JSON). Downloading, parsing, saving to IndexedDB and filtering all happen here,
// off the main thread; the page only ever receives the slice it asks for
// (one category, or the matches of a search).
import { sorters, type SortId } from '../utils/sort'
import type { Item } from '../utils/xtream'

const MAX_RESULTS = 1000
const KEEP_MS = 10 * 60_000 // drop the in-memory copy once idle; the saved one stays

type Entry = { updatedAt: number; items: Item[]; v?: number }

// Saved lists keep only what the app reads from them. Series entries carry the full
// plot, cast, director and every backdrop (~1.5 KB each, 22 MB for the section); the
// grids and the home hero need a fraction of that, and the show page loads the rest
// itself. Bump when the kept fields change: older saved copies are slimmed on load.
const LIST_VERSION = 2
const kindOf = (key: string) => key.split('|').pop()

function slim(key: string, items: Item[]): Item[] {
  if (kindOf(key) !== 'series') return items
  return items.map(s => ({
    series_id: s.series_id,
    name: s.name,
    cover: s.cover,
    rating: s.rating,
    releaseDate: s.releaseDate,
    category_id: s.category_id,
    genre: s.genre,
    plot: s.plot ? s.plot.slice(0, 300) : s.plot,
    // the hero shows only the first backdrop
    backdrop_path: Array.isArray(s.backdrop_path) ? s.backdrop_path.slice(0, 1) : s.backdrop_path,
    // series carry no `added`; their last update drives "Recently added"
    added: (s as Item & { last_modified?: string }).last_modified ?? s.added,
  }))
}
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
      // The most recently added titles, from the chosen categories (or from everything). Shows need a
      // backdrop. With no categories chosen a rating is also required, which keeps out entries with no
      // metadata at all; an explicit choice is trusted.
      const entry = await have(key)
      const chosen = categoryIds && categoryIds.length ? new Set(categoryIds) : null
      const picked = entry
        ? entry.items
          .filter(i => (chosen ? chosen.has(String(i.category_id)) : Number(i.rating) > 0)
            && Number(i.added) > 0
            && (kindOf(key) !== 'series' || (Array.isArray(i.backdrop_path) ? i.backdrop_path.length > 0 : !!i.backdrop_path)))
          .sort((a, b) => Number(b.added) - Number(a.added))
          .slice(0, count ?? 8)
        : null
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

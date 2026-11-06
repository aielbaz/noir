import type { Item } from './xtream'

// Home rows show only the first few titles of a category, so those are saved on
// their own (the full lists are too big to persist). A launch then paints rows
// straight away and only refetches once they are older than the refresh interval.
const PREFIX = 'streambox_row:'

type Saved = { t: number; items: Item[] }

export function readRow(key: string): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null')
    return saved && Array.isArray(saved.items) ? saved : null
  } catch { return null }
}

export function writeRow(key: string, items: Item[]) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), items })) } catch { /* storage full: rows just load fresh */ }
}

function eachKey(fn: (key: string) => void) {
  Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(fn)
}

// Keeps the rows on screen but makes them due for a refresh.
export function expireRows(kind?: string) {
  eachKey(k => {
    // Row keys look like `<server>:<user>:<kind>:<category>`.
    if (kind && !k.includes(`:${kind}:`)) return
    try {
      const saved = JSON.parse(localStorage.getItem(k) ?? 'null')
      if (saved) localStorage.setItem(k, JSON.stringify({ ...saved, t: 0 }))
    } catch { /* ignore unreadable entry */ }
  })
}

export const clearRows = () => eachKey(k => localStorage.removeItem(k))

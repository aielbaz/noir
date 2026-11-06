import { useCallback, useEffect, useState } from 'react'
import { searchSaved } from '../utils/lists-client'
import type { Item, Kind } from '../utils/xtream'
import type { SortId } from '../utils/sort'
import { useApp } from '../context/app-provider'

// Search across a whole section. The full list lives in the lists worker (saved on
// the device after the first download), so only the matches come back to the page.
export function useSearchItems(kind: Kind, term: string, sort: SortId, enabled: boolean) {
  const { creds } = useApp()
  const [state, setState] = useState<{ key: string; items?: Item[]; total?: number; error?: Error }>({ key: '' })
  const [attempt, setAttempt] = useState(0)
  const key = `${kind}|${term}|${sort}|${attempt}`

  useEffect(() => {
    if (!enabled || !creds) return
    let cancelled = false
    searchSaved(creds, kind, term, sort).then(
      r => { if (!cancelled) setState({ key, items: r.items, total: r.total }) },
      error => { if (!cancelled) setState({ key, error }) },
    )
    return () => { cancelled = true }
  }, [enabled, creds, kind, term, sort, key])

  const refetch = useCallback(() => setAttempt(a => a + 1), [])
  const current = enabled && state.key === key
  return {
    data: current ? state.items : undefined,
    total: current ? state.total : undefined,
    error: current ? state.error : null,
    isLoading: enabled && !current,
    isError: current && !!state.error,
    refetch,
  }
}

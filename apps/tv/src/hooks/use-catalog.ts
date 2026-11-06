import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCategories, getItems, type Kind } from '../utils/xtream'
import { savedCategory, syncListLater } from '../utils/lists-client'
import { useApp } from '../context/app-provider'

// Category lists are small and cheap to persist. Item lists can be tens of
// thousands of entries, so they stay in memory only (`meta.persist` unset) and
// are dropped quickly once unused.
export function useCategories(kind: Kind) {
  const { creds } = useApp()
  return useQuery({
    queryKey: ['categories', kind],
    queryFn: ({ signal }) => getCategories(creds!, kind, { signal }),
    enabled: !!creds,
    meta: { persist: true },
  })
}

export function useCategoryItems(kind: Kind, categoryId: string | null | undefined) {
  const { creds } = useApp()
  return useQuery({
    queryKey: ['items', kind, categoryId],
    queryFn: async ({ signal }) => {
      // The full list is saved on the device once downloaded: a category is then just a slice of it.
      const saved = categoryId != null ? await savedCategory(creds!, kind, categoryId).catch(() => null) : null
      if (saved) { syncListLater(creds!, kind); return saved }
      // Not saved yet: fetch just this category (small and quick) and fill the full list in the background.
      const items = await getItems(creds!, kind, categoryId ?? null, { signal })
      syncListLater(creds!, kind)
      return items
    },
    enabled: !!creds && categoryId != null,
    // Long enough to watch a film and come back to the same list without a reload.
    gcTime: 1000 * 60 * 45,
  })
}

// Grows the rendered slice of an already-loaded list page by page.
export function usePaged<T>(items: T[], resetKey: string, pageSize = 60, initialCount = pageSize) {
  const [state, setState] = useState({ key: resetKey, count: Math.max(pageSize, initialCount) })
  const count = state.key === resetKey ? state.count : pageSize

  const loadMore = useCallback(() => {
    setState(s => ({ key: resetKey, count: (s.key === resetKey ? s.count : pageSize) + pageSize }))
  }, [resetKey, pageSize])

  return {
    visible: items.length > count ? items.slice(0, count) : items,
    count,
    hasMore: count < items.length,
    loadMore,
  }
}

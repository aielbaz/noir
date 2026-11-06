import { QueryClient } from "@tanstack/react-query"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { getSettings, subscribeSettings } from "../utils/settings"
import { RedirectError } from "../utils/http"
import localforage from "localforage"

localforage.config({
  name: "iptv-player",
  storeName: "react_query",
  description: "React Query cache storage",
})

const localForageStorage = {
  async getItem(key: string) {
    const value = await localforage.getItem<string>(key)
    return value ?? null
  },
  async setItem(key: string, value: string) {
    await localforage.setItem(key, value)
  },
  async removeItem(key: string) {
    await localforage.removeItem(key)
  },
}

// Saved lists are kept for weeks and never thrown away just for being old:
// they show instantly while a fresh copy loads in the background. Must stay under
// ~24.8 days: gcTime goes through setTimeout, which overflows past 2^31 ms and
// then fires at once, dropping the cache the moment a screen is left.
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 20

function staleTime() {
  const m = getSettings().refreshMinutes
  return m === 0 ? Infinity : m * 60_000
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: staleTime(),
      gcTime: CACHE_MAX_AGE, // persisted queries must outlive maxAge checks
      // The provider and the TV's Wi-Fi both hiccup now and then; a quiet retry beats an error screen.
      // A redirect won't fix itself in a second, so don't make the user wait through retries.
      retry: (count: number, error: unknown) => count < 2 && !(error instanceof RedirectError),
      retryDelay: 1000,
      // Cached data always shows first; a list older than the refresh interval then reloads quietly.
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: localForageStorage,
  key: "query_cache",
})

subscribeSettings(() => {
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, staleTime: staleTime() } })
})

import { useQuery } from '@tanstack/react-query'
import { searchSaved } from '../utils/lists-client'
import type { Kind } from '../utils/xtream'
import type { SortId } from '../utils/sort'
import { useApp } from '../context/app-provider'

// Search across a whole section. The full list lives in the lists worker (saved on
// the device after the first download), so only the matches come back to the page.
// Results are not kept in the persisted cache: the worker answers from its own saved copy.
export function useSearchItems(kind: Kind, term: string, sort: SortId, enabled: boolean) {
  const { creds } = useApp()
  const query = useQuery({
    queryKey: ['search', creds?.base, creds?.username, kind, term, sort],
    queryFn: () => searchSaved(creds!, kind, term, sort),
    enabled: enabled && !!creds,
    staleTime: 0,
    gcTime: 30_000,
  })
  return {
    data: query.data?.items,
    total: query.data?.total,
    error: query.error,
    isLoading: enabled && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

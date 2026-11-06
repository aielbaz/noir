import { useQuery } from '@tanstack/react-query'
import { getShortEpg } from '../utils/xtream'
import { useApp } from '../context/app-provider'

// "Now / Next" for one live channel. Lists are tiny but providers often have
// no guide at all, so an empty result is normal and not an error.
export function useEpg(streamId: number | string | undefined) {
  const { creds } = useApp()
  const query = useQuery({
    queryKey: ['epg', streamId],
    queryFn: ({ signal }) => getShortEpg(creds!, streamId!, { signal }),
    enabled: !!creds && streamId != null,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
  })

  // eslint-disable-next-line react-hooks/purity -- "now" is the point: the listing for the current minute
  const now = Date.now() / 1000
  const listings = query.data ?? []
  const current = listings.find(l => l.start <= now && now < l.end)
  const next = listings.find(l => l.start >= (current?.end ?? now))
  return { current, next, isLoading: query.isLoading }
}

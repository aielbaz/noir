import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { streamUrl, type Item, type Kind } from '../utils/xtream'
import { useApp } from '../context/app-provider'
import { setChannelList } from '../utils/playback-context'
import { addRecentChannel } from '../utils/recents'

// `siblings` is the list the item was picked from; live playback uses it for
// channel up/down. Live starts playing; movies and series open a details page.
export function usePlayItem() {
  const { creds, play } = useApp()
  const navigate = useNavigate()

  return useCallback((kind: Kind, item: Item, siblings?: Item[]) => {
    if (!creds) return
    if (kind === 'series') {
      navigate({ to: '/series', search: { id: String(item.series_id) } })
    } else if (kind === 'live') {
      setChannelList(siblings?.length ? siblings : [item])
      addRecentChannel(item)
      play({
        name: item.name,
        type: 'live',
        streamUrl: streamUrl(creds, 'live', item.stream_id!),
        id: `live:${item.stream_id}`,
        image: item.stream_icon || undefined,
      })
    } else {
      // Movies open their details page first; Play lives there.
      navigate({ to: '/movie', search: { id: String(item.stream_id) } })
    }
  }, [creds, play, navigate])
}

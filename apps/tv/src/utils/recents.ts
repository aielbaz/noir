import { createListStore } from './list-store'
import type { Item } from './xtream'

const store = createListStore<Item>('streambox_recent_channels', 15)

export function addRecentChannel(item: Item) {
  const slim: Item = { name: item.name, stream_id: item.stream_id, stream_icon: item.stream_icon }
  store.set([slim, ...store.get().filter(c => c.stream_id !== item.stream_id)])
}

// The channel watched before the current one (for "last channel").
export const getPreviousChannel = (currentId: number | undefined) =>
  store.get().find(c => c.stream_id !== currentId)

export const useRecentChannels = store.useList
export const clearRecentChannels = store.clear

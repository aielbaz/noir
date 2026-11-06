import type { Item } from './xtream'

// What the player may step through. Set by whoever starts playback.

export type QueueEntry = { id: string; name: string; streamUrl: string; image?: string; group: string }

let channels: Item[] = []
let episodes: QueueEntry[] = []

export const setChannelList = (list: Item[]) => { channels = list }
export const getChannelList = () => channels

export const setEpisodeQueue = (list: QueueEntry[]) => { episodes = list }
export const getEpisodeQueue = () => episodes

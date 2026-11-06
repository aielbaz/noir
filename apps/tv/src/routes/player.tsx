import { createFileRoute } from '@tanstack/react-router'

// The player (vidstack + hls.js, over half the app) lives in player.lazy.tsx so
// it only loads and runs when something is actually played.
export type PlayerSearch = {
  name?: string
  type?: string
  streamUrl?: string
  channelGroup?: string
  id?: string
  group?: string
  image?: string
}

export const Route = createFileRoute('/player')({
  validateSearch: (search: Record<string, unknown>): PlayerSearch => {
    const str = (v: unknown) => (v != null ? String(v) : undefined)
    return {
      name: str(search.name),
      type: str(search.type),
      streamUrl: str(search.streamUrl),
      channelGroup: str(search.channelGroup),
      id: str(search.id),
      group: str(search.group),
      image: str(search.image),
    }
  },
})

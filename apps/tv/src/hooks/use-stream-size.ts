import { useQuery } from '@tanstack/react-query'
import { useApp } from '../context/app-provider'
import { getSeriesInfo, getVodInfo, type Episode } from '../utils/xtream'

// The provider gives no file size, but it does give each title's bitrate (kbps) and
// duration, and size = bitrate × duration. On a movie checked against the real file
// (a ranged request for its Content-Length) this was within 0.02%.
// Reuses the details pages' queries, so it is usually already cached; otherwise it is
// one small request. It never touches the stream itself (the provider allows one connection).
export function useStreamSize(type: string | undefined, id: string | undefined, group: string | undefined) {
  const { creds } = useApp()
  const vodId = type === 'movie' ? id?.replace('movie:', '') : undefined
  const seriesId = type === 'episode' ? group?.replace('series:', '') : undefined
  const episodeId = type === 'episode' ? id?.replace('episode:', '') : undefined

  const vod = useQuery({
    queryKey: ['vodInfo', vodId],
    queryFn: ({ signal }) => getVodInfo(creds!, vodId!, { signal }),
    enabled: !!creds && !!vodId,
  })
  const show = useQuery({
    queryKey: ['seriesInfo', seriesId],
    queryFn: ({ signal }) => getSeriesInfo(creds!, seriesId!, { signal }),
    enabled: !!creds && !!seriesId,
  })

  let info: { bitrate?: string | number; duration_secs?: string | number } | undefined
  if (vodId) info = vod.data?.info
  else if (episodeId && show.data?.episodes) {
    const all: Episode[] = Array.isArray(show.data.episodes) ? show.data.episodes : Object.values(show.data.episodes).flat()
    info = all.find(e => String(e.id) === episodeId)?.info
  }
  const bytes = (Number(info?.bitrate) * 1000 / 8) * Number(info?.duration_secs)
  return Number.isFinite(bytes) && bytes > 0 ? bytes : undefined
}

// "346 MB" below a gigabyte, "1.87 GB" from there up.
export function formatSize(bytes: number) {
  return bytes < 1e9 ? `${Math.round(bytes / 1e6).toLocaleString('en-US')} MB` : `${(bytes / 1e9).toFixed(2)} GB`
}

// Xtream Codes API utility.
//
// The Xtream player_api has no page/offset parameters. The only server-side
// way to split a catalog is `category_id`, so the app fetches one category at
// a time and pages through it on the client (see hooks/use-paged.ts).

import { getJson } from './http'

export type Kind = 'live' | 'movie' | 'series'

export type Creds = { base: string; username: string; password: string }

export type Category = { category_id: string; category_name: string; parent_id?: number }

export type Item = {
  name: string
  category_id?: string
  stream_id?: number
  series_id?: number
  stream_icon?: string
  cover?: string
  backdrop_path?: string[] | string
  cast?: string
  director?: string
  release_date?: string
  episode_run_time?: string | number
  rating?: string | number
  rating_5based?: string | number
  year?: string
  releaseDate?: string
  plot?: string
  genre?: string
  container_extension?: string
  added?: string
}

export type Episode = {
  id: string
  title?: string
  episode_num?: number | string
  container_extension?: string
  info?: { movie_image?: string; duration?: string; plot?: string; duration_secs?: string | number; bitrate?: string | number }
}

export type VodInfo = {
  info?: {
    name?: string
    movie_image?: string
    backdrop_path?: string[] | string
    plot?: string
    genre?: string
    cast?: string
    director?: string
    rating?: string | number
    releasedate?: string
    duration?: string
    duration_secs?: string | number
    bitrate?: string | number // kbps
  }
  movie_data?: { stream_id?: number; name?: string; container_extension?: string }
}

// Landscape artwork suits the wide Continue Watching cards; fall back to the poster.
const isUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)

// Providers send backdrop_path as a list, a JSON string like "[]", or a plain URL.
export function firstImageUrl(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.find(isUrl)
  if (isUrl(value)) return value
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { return firstImageUrl(JSON.parse(value)) } catch { return undefined }
  }
  return undefined
}

export const hasImage = isUrl

export function vodArt(data: VodInfo | undefined) {
  return firstImageUrl(data?.info?.backdrop_path) || (isUrl(data?.info?.movie_image) ? data?.info?.movie_image : undefined)
}

export type SeriesInfo = {
  info?: Item
  seasons?: { season_number: number; name?: string }[]
  episodes?: Record<string, Episode[]> | Episode[]
}

type RequestOptions = { signal?: AbortSignal }

const ACTIONS: Record<Kind, { categories: string; items: string }> = {
  live: { categories: 'get_live_categories', items: 'get_live_streams' },
  movie: { categories: 'get_vod_categories', items: 'get_vod_streams' },
  series: { categories: 'get_series_categories', items: 'get_series' },
}

export function buildUrl(server: string, username: string, password: string): Creds {
  let base = server.trim()
  if (!/^https?:\/\//i.test(base)) base = 'http://' + base
  return { base: base.replace(/\/+$/, ''), username, password }
}

function api<T>(creds: Creds, action: string | null, params: Record<string, string> = {}, options: RequestOptions = {}) {
  const qs = new URLSearchParams({ username: creds.username, password: creds.password })
  if (action) qs.set('action', action)
  for (const [k, v] of Object.entries(params)) qs.set(k, v)
  return getJson<T>(`${creds.base}/player_api.php?${qs}`, options)
}

// Some panels answer `false`, `null` or an object instead of [] for empty lists.
const asList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export async function authenticate(server: string, username: string, password: string, options: RequestOptions = {}) {
  const creds = buildUrl(server, username, password)
  const data = await api<{ user_info?: { auth?: number | string } }>(creds, null, {}, options)
  if (!data.user_info || Number(data.user_info.auth) === 0) throw new Error('Invalid credentials')
  return data
}

export type AccountInfo = {
  status?: string
  exp_date?: string | number | null
  is_trial?: string | number
  active_cons?: string | number
  max_connections?: string | number
  created_at?: string | number
}

// The provider's own view of this account (the login response, fetched again).
export async function getAccountInfo(creds: Creds, options: RequestOptions = {}) {
  const data = await api<{ user_info?: AccountInfo }>(creds, null, {}, options)
  return data.user_info ?? {}
}

export async function getCategories(creds: Creds, kind: Kind, options: RequestOptions = {}) {
  return asList<Category>(await api(creds, ACTIONS[kind].categories, {}, options))
}

export function itemsUrl(creds: Creds, kind: Kind, categoryId: string | null) {
  const qs = new URLSearchParams({ username: creds.username, password: creds.password, action: ACTIONS[kind].items })
  if (categoryId) qs.set('category_id', categoryId)
  return `${creds.base}/player_api.php?${qs}`
}

export async function getItems(creds: Creds, kind: Kind, categoryId: string | null, options: RequestOptions = {}) {
  const params: Record<string, string> = categoryId ? { category_id: categoryId } : {}
  return asList<Item>(await api(creds, ACTIONS[kind].items, params, options))
}

export function getVodInfo(creds: Creds, vodId: string, options: RequestOptions = {}) {
  return api<VodInfo>(creds, 'get_vod_info', { vod_id: vodId }, options)
}

export function getSeriesInfo(creds: Creds, seriesId: string, options: RequestOptions = {}) {
  return api<SeriesInfo>(creds, 'get_series_info', { series_id: seriesId }, options)
}

export function streamUrl(creds: Creds, kind: Exclude<Kind, 'series'> | 'episode', id: string | number, ext?: string) {
  const { base, username, password } = creds
  const path = { live: 'live', movie: 'movie', episode: 'series' }[kind]
  const extension = ext || (kind === 'live' ? 'ts' : 'mp4')
  return `${base}/${path}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${id}.${extension}`
}

export type EpgListing = { title: string; description: string; start: number; end: number }

// EPG text arrives base64-encoded (UTF-8).
function decodeEpg(value?: string) {
  if (!value) return ''
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)))
  } catch {
    return value
  }
}

export async function getShortEpg(creds: Creds, streamId: number | string, options: RequestOptions = {}) {
  const data = await api<{ epg_listings?: Record<string, string>[] }>(
    creds, 'get_short_epg', { stream_id: String(streamId), limit: '4' }, options,
  )
  return asList<Record<string, string>>(data?.epg_listings)
    .map((l): EpgListing => ({
      title: decodeEpg(l.title),
      description: decodeEpg(l.description),
      start: Number(l.start_timestamp),
      end: Number(l.stop_timestamp),
    }))
    .filter(l => l.title && l.end > l.start)
    .sort((a, b) => a.start - b.start)
}

// Noir demo server: an Xtream Codes compatible API with an invented catalogue, as a Cloudflare Worker.
// No video is hosted here: stream URLs redirect to public, open-licensed test files and test streams.
// Login for reviewers: user "demo", password "demo".
import data from './data.json'

const USER = 'demo'
const PASS = 'demo'

// Open-licensed sample clips (Blender Foundation, CC BY 3.0), played by every movie and episode.
const VIDEOS = [
  // Sintel trailer (52 s), Blender Foundation, CC BY 3.0
  'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',
  // Big Buck Bunny (about 10 min), Blender Foundation, CC BY 3.0, via the Internet Archive
  'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
]
// Public HLS test streams for live channels (both allow cross-origin requests).
const LIVE = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://test-streams.mux.dev/test_001/stream.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
]

const b64 = s => btoa(unescape(encodeURIComponent(s)))
const hhmmss = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`

function seriesInfo(s) {
  const episodes = {}
  const seasons = []
  for (let season = 1; season <= s._seasons; season++) {
    seasons.push({ season_number: season, name: `Season ${season}`, episode_count: 8 })
    episodes[season] = Array.from({ length: 8 }, (_, i) => ({
      id: String(s.series_id * 100 + season * 10 + i), episode_num: i + 1, title: `${s.name} S${season}E${i + 1}`,
      container_extension: 'mp4', season,
      info: { movie_image: s.cover, plot: s.plot, duration: '00:45:00', duration_secs: 2700, bitrate: 3200 },
    }))
  }
  const { _seasons, ...info } = s
  return { info, seasons, episodes }
}

function vodInfo(m) {
  const i = m._info
  return {
    info: {
      name: m.name, movie_image: m.stream_icon, backdrop_path: [i.backdrop], plot: i.plot, genre: i.genre, cast: i.cast,
      director: i.director, rating: m.rating, releasedate: `${i.year}-03-14`, duration: hhmmss(i.mins), duration_secs: i.mins * 60, bitrate: i.bitrate,
    },
    movie_data: { stream_id: m.stream_id, name: m.name, container_extension: m.container_extension },
  }
}

function epg(id) {
  const t = Math.floor(Date.now() / 1000)
  const slot = 3600
  const start = t - (t % slot)
  const shows = ['Morning Edition', 'The Long Table', 'Evening Report', 'Studio Sessions', 'Late Review']
  return {
    epg_listings: Array.from({ length: 4 }, (_, k) => ({
      title: b64(shows[(id + k) % shows.length]), description: b64('An invented programme for the Noir demo.'),
      start_timestamp: String(start + k * slot), stop_timestamp: String(start + (k + 1) * slot),
    })),
  }
}

const strip = ({ _info, _seasons, ...rest }) => rest
const byCat = (list, cat) => (cat ? list.filter(x => x.category_id === cat) : list)

function api(q, origin) {
  switch (q.get('action')) {
    case null:
      return {
        user_info: { username: USER, password: PASS, auth: 1, status: 'Active', exp_date: '1893456000', is_trial: '0', active_cons: '0', created_at: '1700000000', max_connections: '1', allowed_output_formats: ['m3u8', 'ts'] },
        server_info: { url: new URL(origin).hostname, port: '443', server_protocol: 'https', timezone: 'UTC' },
      }
    case 'get_live_categories': return data.live_cats
    case 'get_vod_categories': return data.movie_cats
    case 'get_series_categories': return data.series_cats
    case 'get_live_streams': return byCat(data.live, q.get('category_id')).map(strip)
    case 'get_vod_streams': return byCat(data.movies, q.get('category_id')).map(strip)
    case 'get_series': return byCat(data.series, q.get('category_id')).map(strip)
    case 'get_vod_info': { const m = data.movies.find(x => String(x.stream_id) === q.get('vod_id')); return m ? vodInfo(m) : {} }
    case 'get_series_info': { const s = data.series.find(x => String(x.series_id) === q.get('series_id')); return s ? seriesInfo(s) : {} }
    case 'get_short_epg': return epg(Number(q.get('stream_id')) || 0)
    default: return []
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export default {
  fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname === '/player_api.php') {
      const q = url.searchParams
      if (q.get('username') !== USER || q.get('password') !== PASS) return json({ user_info: { auth: 0 } })
      // Artwork paths in the data point at ./public/art, served from this same host.
      const origin = `${url.protocol}//${request.headers.get('host') ?? url.host}`
      const body = JSON.stringify(api(q, origin)).replaceAll('@art/', `${origin}/art/`)
      return new Response(body, { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const m = url.pathname.match(/^\/(movie|series|live)\/([^/]+)\/([^/]+)\/(\d+)\.\w+$/)
    if (m) {
      if (decodeURIComponent(m[2]) !== USER || decodeURIComponent(m[3]) !== PASS) return new Response(null, { status: 401, headers: CORS })
      const list = m[1] === 'live' ? LIVE : VIDEOS
      return Response.redirect(list[Number(m[4]) % list.length], 302)
    }

    return new Response('Noir demo server', { status: 404, headers: CORS })
  },
}

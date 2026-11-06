// A tiny Xtream Codes compatible server with an invented catalogue, for demos, store review and screenshots.
// Run:  node server.mjs [port]      Login: server http://<this machine>:<port>, user demo, password demo
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.argv[2] || process.env.PORT || 8089)
const USER = process.env.DEMO_USER || 'demo'
const PASS = process.env.DEMO_PASS || 'demo'
const data = JSON.parse(fs.readFileSync(path.join(HERE, 'data.json'), 'utf8'))

// Movies and episodes all play the same short original clip (media/sample.mp4, made by make-sample.sh).
const SAMPLE = path.join(HERE, 'media', 'sample.mp4')
// Live channels use a public HLS test stream.
const LIVE_VIDEOS = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
]

// Serves the sample with Range support, which the player needs for seeking.
function sendSample(req, res) {
  const { size } = fs.statSync(SAMPLE)
  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Accept-Ranges', 'bytes')
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  if (!range) {
    res.setHeader('Content-Length', size)
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(SAMPLE).pipe(res)
  }
  const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1])
  const end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1)
  if (start > end || start >= size) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${size}`); return res.end() }
  res.statusCode = 206
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  res.setHeader('Content-Length', end - start + 1)
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(SAMPLE, { start, end }).pipe(res)
}

const b64 = s => Buffer.from(s, 'utf8').toString('base64')
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

const strip = o => { const { _info, _seasons, ...rest } = o; return rest }
const byCat = (list, cat) => (cat ? list.filter(x => x.category_id === cat) : list)

function api(q) {
  switch (q.get('action')) {
    case null:
      return { user_info: { username: USER, password: PASS, auth: 1, status: 'Active', exp_date: '1893456000', is_trial: '0', active_cons: '0', created_at: '1700000000', max_connections: '1', allowed_output_formats: ['m3u8', 'ts'] },
               server_info: { url: 'demo', port: String(PORT), server_protocol: 'http', timezone: 'UTC' } }
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

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png' }

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const origin = `http://${req.headers.host}`
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  if (url.pathname === '/player_api.php') {
    if (url.searchParams.get('username') !== USER || url.searchParams.get('password') !== PASS) {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ user_info: { auth: 0 } }))
    }
    const body = JSON.stringify(api(url.searchParams)).replaceAll('@art/', `${origin}/art/`)
    res.setHeader('Content-Type', 'application/json')
    return res.end(body)
  }

  if (url.pathname.startsWith('/art/')) {
    const file = path.join(HERE, 'art', path.basename(url.pathname))
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end() }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return fs.createReadStream(file).pipe(res)
  }

  const m = url.pathname.match(/^\/(movie|series|live)\/([^/]+)\/([^/]+)\/(\d+)\.\w+$/)
  if (m) {
    if (decodeURIComponent(m[2]) !== USER || decodeURIComponent(m[3]) !== PASS) { res.statusCode = 401; return res.end() }
    if (m[1] !== 'live') return sendSample(req, res)
    res.statusCode = 302
    res.setHeader('Location', LIVE_VIDEOS[Number(m[4]) % LIVE_VIDEOS.length])
    return res.end()
  }

  res.statusCode = 404
  res.end('Noir demo server')
}).listen(PORT, '0.0.0.0', () => console.log(`Noir demo server on http://0.0.0.0:${PORT}  (user ${USER} / password ${PASS})`))

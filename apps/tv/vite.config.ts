import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import {TanStackRouterVite} from '@tanstack/router-vite-plugin'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

function devStreamingProxy(): Plugin {
  return {
    name: 'dev-streaming-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use('/proxy', async (req, res) => {
        try {
          const requestUrl = new URL(req.url ?? '', 'http://localhost')
          const target = requestUrl.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('Missing url parameter')
            return
          }

          const targetUrl = new URL(target)
          if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
            res.statusCode = 400
            res.end('Unsupported protocol')
            return
          }

          const forwardedHeaders: Record<string, string> = {}
          for (const [key, value] of Object.entries(req.headers)) {
            if (!value) continue
            if (key === 'host' || key === 'origin' || key === 'referer') continue
            forwardedHeaders[key] = Array.isArray(value) ? value.join(',') : value
          }

          const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers: forwardedHeaders,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req
          })

          res.statusCode = proxyRes.status
          proxyRes.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })

          if (proxyRes.body) {
            Readable.fromWeb(proxyRes.body).pipe(res)
          } else {
            res.end()
          }
        } catch {
          res.statusCode = 502
          res.end('Proxy error')
        }
      })
    }
  }
}

// hls.js is not bundled into the app script; it is served/emitted as ./hls.min.js
// and loaded on demand by the player.
function hlsFile(): Plugin {
  const path = 'node_modules/hls.js/dist/hls.min.js'
  return {
    name: 'hls-file',
    configureServer(server) {
      server.middlewares.use('/hls.min.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.end(readFileSync(path))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'hls.min.js', source: readFileSync(path) })
    },
  }
}

// Turns the built index.html into one that works from file://: a deferred
// classic script and a CORS-free stylesheet link (no type=module/crossorigin).
function classicScripts(): Plugin {
  return {
    name: 'classic-scripts',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
        .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so the packaged webOS app loads from index.html.
  base: './',
  build: {
    // Older webOS TVs ship Chromium 79-94.
    target: 'chrome79',
    modulePreload: false,
    cssCodeSplit: false,
    rolldownOptions: {
      // The packaged app loads from file://, where Chromium refuses module
      // scripts. Emit one classic script with every dynamic import inlined.
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
  plugins: [
    TanStackRouterVite(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    devStreamingProxy(),
    classicScripts(),
    hlsFile(),
  ]
})

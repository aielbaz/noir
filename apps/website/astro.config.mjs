import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  site: 'https://noir.aielbaz.com',
  adapter: cloudflare({ imageService: 'compile' }),
  // Static marketing site: no per-visitor state, so no session storage (and no KV binding).
  session: false,
})

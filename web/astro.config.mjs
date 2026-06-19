import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import sitemap from '@astrojs/sitemap'

const SITE = process.env.SITE_URL ?? 'https://skanking-storks.com'
const API_PROXY = process.env.API_PROXY ?? 'http://localhost:80'

export default defineConfig({
  output: 'static',
  site: SITE,
  integrations: [vue(), sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pl'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    server: {
      proxy: {
        '/api': { target: API_PROXY, changeOrigin: true },
        '/storage': { target: API_PROXY, changeOrigin: true },
      },
    },
  },
})

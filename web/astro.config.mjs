import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import sitemap from '@astrojs/sitemap'
// Astro's own i18n config is a fourth place that would otherwise name the
// locales. It reads the registry so `getStaticPaths` can never emit a route for
// a locale Astro does not know about (which leaves Astro.currentLocale
// undefined on those pages).
import { LOCALES, DEFAULT_LOCALE } from './src/lib/locales.ts'

const SITE = process.env.SITE_URL ?? 'https://skanking-storks.com'
const API_PROXY = process.env.API_PROXY ?? 'http://localhost:80'

export default defineConfig({
  output: 'static',
  site: SITE,
  integrations: [vue(), sitemap()],
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: LOCALES,
    routing: { prefixDefaultLocale: true },
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

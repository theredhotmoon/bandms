import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import sitemap from '@astrojs/sitemap'
// Astro's own i18n config is a fourth place that would otherwise name the
// locales. It reads the registry so `getStaticPaths` can never emit a route for
// a locale Astro does not know about (which leaves Astro.currentLocale
// undefined on those pages).
import { LOCALES, DEFAULT_LOCALE } from './src/lib/locales.ts'
import { daysOnly, isInSitemap, sitemapItem, withoutDates } from './src/lib/sitemap.ts'

const SITE = process.env.SITE_URL ?? 'https://skankingstorks.band'
const API_PROXY = process.env.API_PROXY ?? 'http://localhost:80'

let outDir

/** A built page's HTML, or null. The sitemap is written after the pages are. */
function builtPage(url) {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '')
  try {
    return readFileSync(new URL(`${path ? `${path}/` : ''}index.html`, outDir), 'utf8')
  } catch (e) {
    // Never fatal: a failed build takes the whole site down. But not silent —
    // without the page, a noindex one is listed and an article loses its date.
    console.warn(`[sitemap] cannot read the built page of ${url}: ${e.message}`)
    return null
  }
}

/** Corrects the dates in what sitemap() wrote, so it must come after it. */
const sitemapDates = {
  name: 'sitemap-dates',
  hooks: {
    'astro:config:done': ({ config }) => { outDir = config.outDir },
    'astro:build:done': ({ dir }) => {
      for (const name of readdirSync(dir).filter(f => /^sitemap-.*\.xml$/.test(f))) {
        const file = new URL(name, dir)
        const xml = readFileSync(file, 'utf8')
        writeFileSync(file, name === 'sitemap-index.xml' ? withoutDates(xml) : daysOnly(xml))
      }
    },
  },
}

export default defineConfig({
  output: 'static',
  site: SITE,
  integrations: [
    vue(),
    sitemap({
      // Localised pages only — the rule and its reasons are in lib/sitemap.ts.
      filter: page => isInSitemap(page, LOCALES),
      serialize: item => {
        const html = builtPage(item.url)
        return html === null ? item : sitemapItem(item, html)
      },
    }),
    sitemapDates,
  ],
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
    ssr: {
      // @bandms/rider-core ships TypeScript and .vue source rather than a
      // build, so Vite has to transform it. Without this Astro externalises
      // the workspace dependency and Node is handed a .vue file it cannot
      // parse — which fails during the SSR pass, not in the browser, so the
      // error names astro build rather than the component.
      noExternal: ['@bandms/concert-core', '@bandms/rider-core', '@bandms/site-copy'],
    },
  },
})

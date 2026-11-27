/**
 * Whether a built page belongs in the sitemap: only a localised one, since a
 * canonical URL is always one of those.
 *
 * Everything outside /{locale}/ is one of: a legacy copy of a page under /en/
 * (or a redirect to the 404 page, when its module is off), a Stripe or token
 * page that is noindex, or the root redirect. Listing a URL whose canonical is
 * another one asks a crawler to index what the page itself says not to.
 *
 * Takes the locales as an argument rather than importing the registry, so that
 * astro.config.mjs can load this file before any bundler resolves imports.
 */
export function isInSitemap(url: string, locales: readonly string[]): boolean {
  const path = new URL(url).pathname
  const locale = locales.find(l => path.startsWith(`/${l}/`))
  if (!locale) return false

  const rest = path.slice(`/${locale}/`.length)
  // Draft previews: secret, noindex, and gone once the post is published.
  if (rest.startsWith('post-preview/')) return false
  // Built as ordinary routes (Astro can emit only one root 404.html) and marked
  // `internal` by nginx, so a crawler sent there gets a 404 on every crawl. The
  // integration's own exclusion only covers the root page: it reads its own
  // i18n option, not Astro's.
  return rest !== '404' && rest !== '404/'
}

/**
 * What a built page says about itself that the sitemap must agree with: whether
 * it may be indexed, and the day a news article last changed.
 *
 * Read from the page rather than worked out again, so the two cannot disagree.
 * The EPK is noindex and was listed all the same until Nov 2026. A page with no
 * article date gets no lastmod: the day of the build is not a change, and a
 * crawler that learns the dates are invented ignores all of them.
 */
export function pageSitemapData(html: string): { noindex: boolean; lastmod?: string } {
  const head = html.slice(0, html.indexOf('</head>') + 1 || undefined)
  const meta = (key: string) =>
    head.match(new RegExp(`<meta (?:name|property)="${key}"\\s+content="([^"]*)"`))?.[1]

  return {
    noindex: /\bnoindex\b/.test(meta('robots') ?? ''),
    lastmod: meta('article:modified_time') ?? meta('article:published_time'),
  }
}

/** One sitemap entry after its built page has had its say; undefined drops it. */
export function sitemapItem<T extends { url: string; lastmod?: string }>(item: T, html: string): T | undefined {
  const { noindex, lastmod } = pageSitemapData(html)
  if (noindex) return undefined
  return lastmod ? { ...item, lastmod } : item
}

/**
 * The written XML, with every date the day it is. The sitemap package expands a
 * day to midnight UTC, a time nobody entered.
 */
export function daysOnly(xml: string): string {
  return xml.replace(/(<lastmod>\d{4}-\d{2}-\d{2})T[^<]*(?=<\/lastmod>)/g, '$1')
}

/**
 * The index without the dates the package gives it: it stamps a whole sitemap
 * with its newest entry's date, and only articles have one. A show added after
 * the last article would sit in a file announced as unchanged since.
 */
export function withoutDates(xml: string): string {
  return xml.replace(/<lastmod>[^<]*<\/lastmod>/g, '')
}

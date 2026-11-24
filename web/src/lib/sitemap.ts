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

import { i18n } from '@/i18n'

/**
 * The `<title>` for a route (WCAG 2.4.2).
 *
 * Two things used to be wrong here, and they are the same bug the public
 * site's BaseLayout already documents: the page names were hardcoded English,
 * and the suffix was the literal "Skanking Storks" — in a product that serves
 * any band. It looked right for exactly the one band whose name matched.
 *
 * So the page part comes from the catalogue and the suffix from the loaded
 * profile. When no profile has loaded yet the suffix is simply dropped, which
 * is the same fail-open choice BaseLayout makes: a missing name costs the
 * suffix, never a wrong one.
 *
 * `router.afterEach` runs outside any component, which is why this is a
 * module-level value rather than a composable — and why it lives in utils,
 * where vitest's `node` environment can import it. See app/CLAUDE.md.
 */
let bandName = ''

/**
 * The document's own title, captured before anything overwrites it.
 *
 * Load-bearing: most admin routes have no entry below, and `bandName` is only
 * set once some view has mounted `useBandProfile`. Deep-link straight to
 * /admin/concerts and both parts are empty — which shipped an *empty* `<title>`
 * and so failed the very criterion this file exists to satisfy. The old code
 * always produced at least something. This is that something, and it comes
 * from index.html rather than a literal so it is not a second hardcoded name.
 */
const DEFAULT_TITLE = typeof document === 'undefined' ? '' : document.title

/** The last route applied, so a late-arriving band name can be re-applied. */
let lastRoute = ''

/**
 * Called once the band profile is in hand; safe to call repeatedly.
 *
 * Re-applies the title, because `router.afterEach` has already fired by the
 * time the query resolves. Without this the suffix was missing for the whole
 * life of whichever page loaded the profile — including the dashboard, the
 * first thing an admin sees after signing in — and appeared only on the next
 * navigation.
 */
export function setTitleBandName(name: string | null | undefined): void {
  const next = (name ?? '').trim()
  if (next === bandName) return
  bandName = next
  if (lastRoute && typeof document !== 'undefined') {
    document.title = routeTitle(lastRoute)
  }
}

/**
 * Catalogue key per named route. A route absent from here gets the band name
 * alone, and failing that the document's own title.
 */
const ROUTE_TITLE_KEYS: Record<string, string> = {
  'fan-account': 'shell.titles.fanAccount',
  'ticket-claim': 'shell.titles.ticketClaim',
  'tech-rider-preview': 'shell.titles.techRider',
  'tech-rider-preview-id': 'shell.titles.techRider',
  'admin-concert-tickets': 'shell.titles.concertTickets',
  'admin-fan-accounts': 'shell.titles.fanAccounts',
  'admin-door': 'shell.titles.doorCheck',
  'admin-website-modules': 'shell.titles.websiteModules',
  'admin-faqs': 'shell.titles.faqs',
  'admin-hero-images': 'shell.titles.heroImages',
}

/** `"Door Check — The Band"`, `"Door Check"`, `"The Band"`, or the default. */
export function routeTitle(routeName: string): string {
  lastRoute = routeName
  const key = ROUTE_TITLE_KEYS[routeName]
  const page = key ? String(i18n.global.t(key)) : ''
  if (page && bandName) return `${page} — ${bandName}`
  return page || bandName || DEFAULT_TITLE
}

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

/** Called once the band profile is in hand; safe to call repeatedly. */
export function setTitleBandName(name: string | null | undefined): void {
  bandName = (name ?? '').trim()
}

/**
 * Catalogue key per named route. A route absent from here gets the band name
 * alone, which is what the previous fallback did.
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

/** `"Door Check — The Band"`, `"Door Check"`, or `"The Band"`. */
export function routeTitle(routeName: string): string {
  const key = ROUTE_TITLE_KEYS[routeName]
  const page = key ? String(i18n.global.t(key)) : ''
  if (page && bandName) return `${page} — ${bandName}`
  return page || bandName
}

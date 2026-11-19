/**
 * Loads GA4's gtag.js — called only after a visitor accepts the cookie
 * banner (`grantConsent()` in `src/stores/consent.ts`), never on page load
 * for an undecided visitor.
 *
 * No Consent Mode `default`/`update` signals here: this project uses "no
 * request until accepted" rather than Advanced Consent Mode's "always load,
 * gate by signal" — simpler to reason about, and it keeps the JS payload at
 * zero for anyone who never accepts. See the plan's Part A3 for why.
 *
 * No `anonymize_ip` config param — that's a Universal Analytics relic; GA4
 * truncates/anonymizes IPs by default and doesn't recognise that key.
 */
export function loadGoogleAnalytics(measurementId: string): void {
  if (typeof document === 'undefined') return // SSR
  if (!measurementId) return

  // Undo disableGoogleAnalytics(). Nothing used to, so once the kill switch
  // was set the tag loaded, initialised and never sent a hit, with no error
  // anywhere — see docs/ga4-tracking-investigation.md.
  const wasDisabled = window[`ga-disable-${measurementId}`] === true
  window[`ga-disable-${measurementId}`] = false

  if (document.getElementById('ga4-tag')) {
    // Rejected and accepted again in one tab: the tag is still on the page,
    // but its cookies were cleared, so configure it again — that also counts
    // this page for the visitor who has just said yes.
    if (wasDisabled) gtag('config', measurementId)
    return
  }

  const script = document.createElement('script')
  script.id = 'ga4-tag'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)

  gtag('js', new Date())
  gtag('config', measurementId)
}

/**
 * Queues one command for gtag.js.
 *
 * `arguments`, not rest parameters — do not "modernise" this. gtag.js only
 * executes a queue entry that is an Arguments object; a real array (which is
 * what `...args` gives) is treated as plain data-layer data and ignored
 * without a word. This is why Google's own snippet still looks like 2010.
 */
function gtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

/**
 * Stops GA4 in the current tab and clears whatever it already set — called
 * whenever consent is denied or withdrawn (see `ConsentBanner.vue`),
 * including a visitor who accepted earlier, reopened "Cookie settings", and
 * rejected.
 *
 * `loadGoogleAnalytics()` alone isn't reversible: the `<script id="ga4-tag">`
 * it injects keeps running once loaded, and gtag.js's own cookies (`_ga`,
 * `_ga_*`) persist for up to ~2 years regardless of a later opt-out. Real
 * withdrawal needs both:
 *   1. `window['ga-disable-<id>'] = true` — GA's own documented kill switch;
 *      gtag.js checks it before sending any hit, including from a tag that's
 *      already loaded and running.
 *   2. Expiring every `_ga`-prefixed cookie so nothing already set survives.
 */
export function disableGoogleAnalytics(measurementId: string): void {
  if (typeof document === 'undefined') return // SSR

  if (measurementId) {
    window[`ga-disable-${measurementId}`] = true
  }

  const domains = cookieDomains(typeof location === 'undefined' ? '' : location.hostname)
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name?.startsWith('_ga')) continue
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;${domain}`
    }
  }
}

/**
 * Every `Domain` attribute a `_ga` cookie on this host may carry. A cookie is
 * only expired by a write naming the same domain it was set with, and gtag's
 * default (`cookie_domain: 'auto'`) sets it on the widest domain the browser
 * accepts — `.skankingstorks.band` for `www.skankingstorks.band` — not on the
 * host. A write without `Domain` clears only a host-only cookie, which is
 * what `localhost` gets. A domain the browser refuses is a no-op, so trying
 * each parent is safe.
 */
export function cookieDomains(hostname: string): string[] {
  const out = [''] // host-only
  const labels = hostname.split('.').filter(Boolean)
  for (let i = 0; i + 1 < labels.length; i++) {
    out.push(` domain=.${labels.slice(i).join('.')};`)
  }
  return out
}

declare global {
  interface Window {
    dataLayer: ArrayLike<unknown>[]
    [key: `ga-disable-${string}`]: boolean | undefined
  }
}

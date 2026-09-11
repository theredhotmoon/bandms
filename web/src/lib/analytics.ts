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
  if (typeof document === 'undefined') return // SSR — ConsentBanner's watcher also runs server-side
  if (!measurementId || document.getElementById('ga4-tag')) return

  const script = document.createElement('script')
  script.id = 'ga4-tag'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
  gtag('js', new Date())
  gtag('config', measurementId)
}

/**
 * Stops GA4 in the current tab and clears whatever it already set — called
 * whenever consent is denied or withdrawn (see `ConsentBanner.vue`'s watcher
 * on `consentStatus`), including a visitor who accepted earlier, reopened
 * "Cookie settings", and rejected.
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
  if (typeof document === 'undefined') return // SSR — the immediate watcher fires on the server too

  if (measurementId) {
    window[`ga-disable-${measurementId}`] = true
  }

  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (name?.startsWith('_ga')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  }
}

declare global {
  interface Window {
    dataLayer: unknown[][]
    [key: `ga-disable-${string}`]: boolean | undefined
  }
}

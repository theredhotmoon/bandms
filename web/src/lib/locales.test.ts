import { describe, it, expect } from 'vitest'
import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  localeChain,
  resolveTranslation,
  dateLocale,
  nativeName,
  canonicalUrl,
  hreflangLinks,
} from './locales'

describe('registry', () => {
  it('lists the supported locales in declaration order', () => {
    expect(LOCALES).toEqual(['en', 'pl'])
  })

  it('names a default that is itself a supported locale', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(LOCALES).toContain(DEFAULT_LOCALE)
  })

  it('narrows an arbitrary string to a Locale', () => {
    expect(isLocale('pl')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale('EN')).toBe(false)
  })
})

// Mirrors api/config/locales.php. The public site and the API must agree on
// the chain or a half-translated field renders differently depending on which
// side flattened it.
describe('localeChain', () => {
  it('walks a locale through its own declared fallbacks', () => {
    expect(localeChain('pl')).toEqual(['pl', 'en'])
    expect(localeChain('en')).toEqual(['en', 'pl'])
  })

  it('never repeats a locale', () => {
    expect(localeChain('en')).toEqual([...new Set(localeChain('en'))])
  })
})

describe('resolveTranslation', () => {
  it('returns the requested locale when it has a value', () => {
    expect(resolveTranslation({ en: 'Bio', pl: 'Biografia' }, 'pl')).toBe('Biografia')
  })

  it('falls down the chain when the requested locale is empty', () => {
    expect(resolveTranslation({ en: 'English only' }, 'pl')).toBe('English only')
  })

  it('treats an empty or blank string as absent', () => {
    expect(resolveTranslation({ pl: '   ', en: 'Real' }, 'pl')).toBe('Real')
    expect(resolveTranslation({ pl: '', en: 'Real' }, 'pl')).toBe('Real')
  })

  it('returns null rather than undefined when nothing in the chain has a value', () => {
    expect(resolveTranslation({}, 'pl')).toBeNull()
    expect(resolveTranslation(null, 'pl')).toBeNull()
  })

  // An unregistered key must never be picked up: it is exactly the "German
  // visitor sees Polish" case the declared chain exists to prevent.
  it('ignores locales outside the chain', () => {
    expect(resolveTranslation({ de: 'Deutsch' } as never, 'pl')).toBeNull()
  })
})

describe('display metadata', () => {
  it('maps a locale to its Intl date locale', () => {
    expect(dateLocale('pl')).toBe('pl-PL')
    expect(dateLocale('en')).toBe('en-GB')
  })

  it('maps a locale to the name it calls itself', () => {
    expect(nativeName('pl')).toBe('Polski')
    expect(nativeName('en')).toBe('English')
  })
})

// ── hreflang ─────────────────────────────────────────────────────────────────
//
// The bug this replaces: BaseHead derived alternates from Astro.url alone,
// under a "/en is unprefixed" scheme the site had already stopped using. It
// emitted hreflang="pl" href="/pl/en/" on the English page and claimed
// hreflang="en" for /pl/ — wrong on every page, with a green build.
describe('hreflangLinks', () => {
  const site = 'https://example.com'
  const opts = { site, currentLocale: 'en' as const, currentPath: '/en/' }

  it('emits one absolute link per locale that has a path', () => {
    expect(hreflangLinks({ en: '/en/', pl: '/pl/' }, opts)).toEqual([
      { hreflang: 'en', href: 'https://example.com/en/' },
      { hreflang: 'pl', href: 'https://example.com/pl/' },
      { hreflang: 'x-default', href: 'https://example.com/en/' },
    ])
  })

  it('points x-default at the default locale, not at the current page', () => {
    const links = hreflangLinks(
      { en: '/en/o-nas', pl: '/pl/o-nas' },
      { site, currentLocale: 'pl', currentPath: '/pl/o-nas' },
    )
    expect(links.at(-1)).toEqual({ hreflang: 'x-default', href: 'https://example.com/en/o-nas/' })
  })

  // The regression itself, stated as an assertion: the Polish alternate is the
  // Polish path, never the current path with a prefix bolted on.
  it('never derives one locale href by prefixing another', () => {
    const links = hreflangLinks({ en: '/en/', pl: '/pl/' }, opts)
    expect(links.map(l => l.href)).not.toContain('https://example.com/pl/en/')
  })

  it('falls back to the current path for the current locale when unlisted', () => {
    const links = hreflangLinks({ pl: '/pl/releases' }, { ...opts, currentPath: '/releases/7' })
    expect(links).toContainEqual({ hreflang: 'en', href: 'https://example.com/releases/7/' })
  })

  it('skips a locale with no path rather than emitting a broken href', () => {
    const links = hreflangLinks({ en: '/en/' }, { ...opts, currentLocale: 'en' })
    expect(links.map(l => l.hreflang)).toEqual(['en', 'x-default'])
  })

  // Astro's default build.format is 'directory', so Astro.url.href -- and thus
  // BaseHead's canonical -- always ends in '/'. A self-referential alternate
  // that differs from the canonical by a slash is a broken hreflang cluster, so
  // every row is normalised to the same directory form.
  it('matches the canonical directory form by keeping a trailing slash', () => {
    const links = hreflangLinks({ en: '/en/contact', pl: '/pl/kontakt' }, opts)
    expect(links.map(l => l.href)).toEqual([
      'https://example.com/en/contact/',
      'https://example.com/pl/kontakt/',
      'https://example.com/en/contact/',
    ])
  })

  it('does not add a second slash to a path that already has one', () => {
    const links = hreflangLinks({ en: '/en/' }, opts)
    expect(links[0].href).toBe('https://example.com/en/')
  })

  it('does not append a slash to a path with a file extension', () => {
    const links = hreflangLinks({ en: '/feed.xml' }, opts)
    expect(links[0].href).toBe('https://example.com/feed.xml')
  })

  it('does not double the slash between site and path', () => {
    const links = hreflangLinks({ en: '/en/' }, { ...opts, site: 'https://example.com/' })
    expect(links[0].href).toBe('https://example.com/en/')
  })
})

// ── canonical ────────────────────────────────────────────────────────────────
//
// The legacy unlocalised routes (/posts/{id}, /concerts/{slug}, /about …) render
// the English page at a second URL. Each used to name itself canonical, so every
// English article was in the index twice, competing with its own /en/ twin.
describe('canonicalUrl', () => {
  const site = 'https://example.com'

  it('sends a legacy URL to its localised twin', () => {
    expect(canonicalUrl({ en: '/en/news/hello', pl: '/pl/aktualnosci/czesc' }, {
      site, currentLocale: 'en', currentPath: '/posts/2/',
    })).toBe('https://example.com/en/news/hello/')
  })

  it('is the page itself on a localised page', () => {
    expect(canonicalUrl({ en: '/en/news/hello', pl: '/pl/aktualnosci/czesc' }, {
      site, currentLocale: 'pl', currentPath: '/pl/aktualnosci/czesc/',
    })).toBe('https://example.com/pl/aktualnosci/czesc/')
  })

  it('is the page itself when the route passes no alternates', () => {
    expect(canonicalUrl({}, { site, currentLocale: 'en', currentPath: '/merch/success/' }))
      .toBe('https://example.com/merch/success/')
  })

  // Record slugs are stored as typed. Astro's own URL — and so the sitemap's —
  // ends these in a slash and percent-encodes them.
  it('keeps the slash on a slug with a dot', () => {
    expect(canonicalUrl({ en: '/en/news/vol.2' }, { site, currentLocale: 'en', currentPath: '/posts/2/' }))
      .toBe('https://example.com/en/news/vol.2/')
  })

  it('percent-encodes a slug, and never encodes one twice', () => {
    const opts = { site, currentLocale: 'en' as const, currentPath: '/posts/2/' }
    const encoded = 'https://example.com/en/news/m%C3%B3j%20koncert/'
    expect(canonicalUrl({ en: '/en/news/mój koncert' }, opts)).toBe(encoded)
    expect(canonicalUrl({ en: '/en/news/m%C3%B3j%20koncert/' }, opts)).toBe(encoded)
  })

  // A canonical and a self hreflang one character apart is a broken cluster.
  it('is exactly the hreflang row for the same locale', () => {
    const alternates = { en: '/en/about', pl: '/pl/o-nas' }
    const opts = { site, currentLocale: 'en' as const, currentPath: '/about/' }
    expect(hreflangLinks(alternates, opts)).toContainEqual({ hreflang: 'en', href: canonicalUrl(alternates, opts) })
  })
})

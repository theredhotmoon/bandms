import { describe, expect, it } from 'vitest'
import { daysOnly, isInSitemap, pageSitemapData, sitemapItem, withoutDates } from './sitemap'

const inMap = (path: string) => isInSitemap(`https://example.com${path}`, ['en', 'pl'])

describe('isInSitemap', () => {
  it.each(['/en/', '/pl/', '/en/news/', '/en/news/hello/', '/pl/aktualnosci/czesc/', '/en/privacy/'])(
    'lists the localised page %s',
    path => expect(inMap(path)).toBe(true),
  )

  // Each is a second URL for a page under /en/, whose canonical is the /en/ one —
  // or, when its module is off, a redirect to the 404 page.
  it.each(['/about/', '/posts/', '/posts/2/', '/concerts/el-so-ska-festival/', '/merch/', '/epk/'])(
    'leaves out the legacy page %s',
    path => expect(inMap(path)).toBe(false),
  )

  it.each(['/', '/merch/success/', '/merch/cancel/', '/newsletter/confirm/', '/newsletter/unsubscribe/', '/rider/'])(
    'leaves out the unlocalised page %s',
    path => expect(inMap(path)).toBe(false),
  )

  it.each(['/en/404/', '/pl/404', '/en/post-preview/abc123/', '/pl/post-preview/abc123/'])(
    'leaves out %s',
    path => expect(inMap(path)).toBe(false),
  )

  it('does not mistake a section starting with a locale code for a locale', () => {
    expect(inMap('/english-songs/')).toBe(false)
  })

  it('keeps an article whose slug merely starts with 404 or sits deeper', () => {
    expect(inMap('/en/404-tour/')).toBe(true)
    expect(inMap('/en/news/404/')).toBe(true)
  })
})

describe('pageSitemapData', () => {
  const page = (head: string, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

  it('reads a noindex page', () => {
    expect(pageSitemapData(page('<meta name="robots" content="noindex,nofollow">')).noindex).toBe(true)
    expect(pageSitemapData(page('<title>x</title>')).noindex).toBe(false)
  })

  it('dates an article by its edit, else by its publication', () => {
    const published = '<meta property="article:published_time" content="2026-04-01">'
    const modified = '<meta property="article:modified_time" content="2026-04-03">'
    expect(pageSitemapData(page(published)).lastmod).toBe('2026-04-01')
    expect(pageSitemapData(page(published + modified)).lastmod).toBe('2026-04-03')
  })

  it('dates nothing else', () => {
    expect(pageSitemapData(page('<meta property="og:type" content="website">')).lastmod).toBeUndefined()
  })

  it('reads the head only, not an article that quotes the tag', () => {
    expect(pageSitemapData(page('', '<meta name="robots" content="noindex">')).noindex).toBe(false)
  })
})

describe('sitemapItem', () => {
  const item = { url: 'https://example.com/en/epk/' }

  it('drops a page that asks not to be indexed', () => {
    expect(sitemapItem(item, '<head><meta name="robots" content="noindex,nofollow"></head>')).toBeUndefined()
  })

  it('dates an article and leaves any other page as it was', () => {
    expect(sitemapItem(item, '<head><meta property="article:published_time" content="2026-04-01"></head>'))
      .toEqual({ ...item, lastmod: '2026-04-01' })
    expect(sitemapItem(item, '<head></head>')).toEqual(item)
  })
})

describe('the written XML', () => {
  it('holds days, not times', () => {
    expect(daysOnly('<url><loc>x</loc><lastmod>2026-04-01T00:00:00.000Z</lastmod></url>'))
      .toBe('<url><loc>x</loc><lastmod>2026-04-01</lastmod></url>')
  })

  it('has an index that dates nothing', () => {
    expect(withoutDates('<sitemap><loc>x</loc><lastmod>2026-04-01T00:00:00.000Z</lastmod></sitemap>'))
      .toBe('<sitemap><loc>x</loc></sitemap>')
  })
})

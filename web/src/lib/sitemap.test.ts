import { describe, expect, it } from 'vitest'
import { isInSitemap } from './sitemap'

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

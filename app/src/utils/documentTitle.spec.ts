import { describe, it, expect, beforeEach } from 'vitest'
import { routeTitle, setTitleBandName } from './documentTitle'

/**
 * The two defects this replaced were both invisible to every guard: the page
 * names were hardcoded English, and the suffix was the literal band name of
 * the one band the product happened to be built for. Neither the string lint
 * nor the coverage guard reads `router.afterEach`.
 */
describe('routeTitle', () => {
  beforeEach(() => setTitleBandName(''))

  it('joins the page name and the band name', () => {
    setTitleBandName('The Test Band')
    expect(routeTitle('admin-door')).toBe('Door Check — The Test Band')
  })

  it('drops the suffix when no profile has loaded', () => {
    // Fail open, the same choice web/src/layouts/BaseLayout.astro makes: a
    // missing name costs the suffix, never prints a wrong one. This is the
    // state on first paint, before the profile query resolves.
    expect(routeTitle('admin-door')).toBe('Door Check')
  })

  it('falls back to the band name for an unmapped route', () => {
    setTitleBandName('The Test Band')
    expect(routeTitle('admin-something-new')).toBe('The Test Band')
    expect(routeTitle('')).toBe('The Test Band')
  })

  it('falls back to the document’s own title when neither is known', () => {
    // DEFAULT_TITLE is captured from index.html at module load. Under
    // vitest’s `node` environment there is no document, so it is '' here —
    // this pins the *order* of the fallbacks, not the browser value.
    expect(routeTitle('admin-something-new')).toBe('')
  })

  it('ignores a blank or whitespace band name', () => {
    setTitleBandName('   ')
    expect(routeTitle('admin-door')).toBe('Door Check')
  })

  it('never returns an empty title', () => {
    // Most admin routes have no entry in the map, and the band name is only
    // set once a view has mounted useBandProfile. Deep-linking to
    // /admin/concerts hit both gaps at once and assigned document.title = '',
    // failing the very WCAG criterion this file exists for. jsdom is absent
    // here (environment: 'node'), so DEFAULT_TITLE is '' — the assertion that
    // matters is that the *page* and *band* fallbacks are exhausted in order.
    setTitleBandName('The Test Band')
    expect(routeTitle('admin-concerts')).toBe('The Test Band')
  })

  it('re-applies the title when the band name arrives late', () => {
    // router.afterEach has already fired by the time the profile query
    // resolves, so setTitleBandName has to push the new value itself.
    // Without it the suffix was missing for the whole life of whichever page
    // loaded the profile — including the dashboard, the first page after
    // sign-in — and appeared only on the next navigation.
    const doc = { title: '' }
    ;(globalThis as { document?: unknown }).document = doc

    routeTitle('admin-door')
    setTitleBandName('Late Band')
    expect(doc.title).toBe('Door Check — Late Band')

    delete (globalThis as { document?: unknown }).document
  })

  it('does not re-apply when the name has not actually changed', () => {
    const doc = { title: 'untouched' }
    ;(globalThis as { document?: unknown }).document = doc

    setTitleBandName('Same')
    routeTitle('admin-door')
    doc.title = 'untouched'
    setTitleBandName('Same')
    expect(doc.title).toBe('untouched')

    delete (globalThis as { document?: unknown }).document
  })
})

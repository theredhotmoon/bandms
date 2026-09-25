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

  it('is empty when neither is known rather than printing a placeholder', () => {
    expect(routeTitle('admin-something-new')).toBe('')
  })

  it('ignores a blank or whitespace band name', () => {
    setTitleBandName('   ')
    expect(routeTitle('admin-door')).toBe('Door Check')
  })
})

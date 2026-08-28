import { expect, test } from '@playwright/test'

/**
 * Fail the current test if the page raised an uncaught error.
 *
 * The obvious spelling —
 *
 *   page.on('pageerror', (e) => { throw new Error(e.message) })
 *
 * does not work. The throw happens inside an EventEmitter callback, so it
 * surfaces as an unhandled exception in Playwright's internals rather than as a
 * test failure: the spec still reports green. Eight specs claimed to guard
 * against page errors this way and none of them did — which matters here,
 * because a hydration fault in one Astro island silently breaks another and
 * leaves no other trace.
 *
 * Call once inside a `test.describe`.
 */
export function failOnPageError() {
  const errors: string[] = []

  test.beforeEach(({ page }) => {
    errors.length = 0
    page.on('pageerror', (error) => errors.push(error.message))
  })

  test.afterEach(() => {
    expect(errors, 'the page raised uncaught errors').toEqual([])
  })
}

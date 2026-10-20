/**
 * The admin's Tailwind source configuration, on the shared reader in
 * packages/style-guards (css-sources.mjs there, with its spec). This file is
 * the one place the admin says which files Tailwind reads: what renders is a
 * source, and the specs beside the source are fixtures. check-css-sources.mjs
 * holds src/style.css to this list; check-admin-radius.mjs derives its own
 * skip from it (isFixture), so the two guards cannot disagree about which src
 * files Tailwind reads.
 */
import { fixtureTest } from '../../../packages/style-guards/src/css-sources.mjs'

export * from '../../../packages/style-guards/src/css-sources.mjs'

/** What src/style.css must declare — paths relative to the stylesheet, as Tailwind reads them. */
export const EXPECTED_SOURCES = [
  { path: '../src', not: false },
  { path: '../index.html', not: false },
  { path: '../src/**/*.spec.ts', not: true },
]

/** Whether a src-relative path is one Tailwind is told not to read. */
export const isFixture = fixtureTest(EXPECTED_SOURCES)

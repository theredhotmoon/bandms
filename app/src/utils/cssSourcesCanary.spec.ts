import { expect, it } from 'vitest'

/**
 * A canary for scripts/check-css-sources.mjs, not a test of anything here.
 *
 * src/style.css tells Tailwind to read src/ but not the specs beside the
 * source (`@source not "../src/**\/*.spec.ts"`). The guard reads that line
 * back, but a line that is present and ignored — a glob Tailwind stopped
 * understanding, a base it resolves differently — would leave the build
 * green, because no other spec under src/ holds a class the guard can
 * recognise as foreign. This one does, on purpose: both shapes the guard
 * fails on. If Tailwind ever reads this file, these become real rules in
 * dist/ and `pnpm build` goes red naming them.
 *
 * Nothing else may use these strings as classes. The radius guard already
 * forbids setting --radius-card from a class anywhere in src/, and `…` is
 * never a value.
 */
const CANARY_CLASSES = '[--radius-card:4px] bg-[#…]'

it('holds the two shapes check-css-sources.mjs recognises as foreign', () => {
  expect(CANARY_CLASSES).toContain('[--radius-card:')
  expect(CANARY_CLASSES).toContain('…]')
})

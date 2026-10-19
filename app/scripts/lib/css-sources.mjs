/**
 * Rules in the built stylesheet that could only have come from a file that is
 * not a source — shared by check-css-sources.mjs and its spec.
 *
 * Tailwind emits a utility for every class-shaped token it finds in the files
 * it reads, and left to itself it reads every file under app/ that git does
 * not ignore: the build guards and their specs, the Playwright specs, the
 * markdown. src/style.css narrows that to src/ minus its specs (`source(none)`
 * on the import, then `@source`). This judges the *output*, so the narrowing
 * cannot be lost quietly: two kinds of selector can only be produced by a
 * non-source, and either in dist/ means the sources have widened again.
 *
 *   - a selector holding `…` — the placeholder the docs write inside an
 *     example class (`bg-[#…]`); no component writes it, and Tailwind emits
 *     it as the literal value `#…`;
 *   - a selector that sets --radius-card from a class (`[--radius-card:4px]`),
 *     which check-admin-radius.mjs rejects in every src file — so one in the
 *     output was read from a spec's fixture or a doc's example.
 */

export const PLACEHOLDER = '…'
export const CARD_TOKEN_CLASS = /\\\[--radius-card\\:/

/** Every class selector in compiled CSS, with its offset — nested rules included. */
export function classSelectors(css) {
  const out = []
  for (const m of css.matchAll(/(?<=^|[{};])\s*((?:\.|:is\(\.|:where\(\.)[^{}]*?)\{/g)) {
    out.push({ selector: m[1].trim(), index: m.index })
  }
  return out
}

/** Why a selector cannot have come from src/, or null when it can. */
export function strayReason(selector) {
  if (selector.includes(PLACEHOLDER)) return `holds "${PLACEHOLDER}", a documentation placeholder — read from a .md file`
  if (CARD_TOKEN_CLASS.test(selector)) return 'sets --radius-card from a class, which no src file may do — read from a spec or a doc'
  return null
}

/** [{ selector, reason }] for every rule in `css` that came from outside the sources. */
export function strayRules(css) {
  const out = []
  for (const { selector } of classSelectors(css)) {
    const reason = strayReason(selector)
    if (reason) out.push({ selector, reason })
  }
  return out
}

/**
 * The DOM half of "Show more", shared by ShowMoreButton.vue (islands) and
 * ShowMore.astro (static lists). Kept apart from showMore.ts so the static
 * button's script does not pull Vue into its bundle.
 *
 * A held-back item carries `data-more-hidden` in both kinds of list, so one
 * CSS rule (base.css, under html.js) hides it — and none does for a visitor
 * without JS, who could never run the button.
 */

/** Items of the list `listId` still held back, in order. */
export function heldBack(listId: string): Element[] {
  return [...(document.getElementById(listId)?.querySelectorAll('[data-more-hidden]') ?? [])]
}

/**
 * Move focus to the first of `candidates` that is now revealed — onto the
 * item itself when it is a link or button, else onto the first one inside.
 * The button that had focus may be gone (the last batch removes it), and
 * focus would otherwise drop to <body>, back at the top of the page.
 */
export function focusFirstRevealed(candidates: Element[]): void {
  const first = candidates.find(el => !el.hasAttribute('data-more-hidden'))
  if (!first) return
  const target = first.matches('a, button') ? first : first.querySelector('a, button')
  ;(target as HTMLElement | null)?.focus()
}

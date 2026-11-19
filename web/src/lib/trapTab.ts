/**
 * Keeps Tab inside `container`, wherever focus happened to be (a click on a
 * backdrop leaves it on <body>). Shared by the welcome dialog and the consent
 * card; the caller decides what else a keydown means (Escape).
 */
export function trapTab(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return
  const items = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])'),
  )
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  const inside = container.contains(active) && active !== container
  if (!inside) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

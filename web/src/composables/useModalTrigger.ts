import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Open/close plumbing for a modal whose triggers live outside its island.
 *
 * The buttons that open these dialogs are static Astro markup, so no handler can
 * be passed in. Instead every trigger carries a data attribute and this
 * delegates from `document` — one listener, works for triggers anywhere on the
 * page, and needs nothing shared across the island boundary.
 *
 * The island must hydrate with `client:idle`, not `client:visible`: a modal
 * renders nothing until opened, so a visibility trigger would never fire and
 * this listener would never attach.
 */
export function useModalTrigger(attribute: string) {
  const isOpen = ref(false)

  function open() {
    isOpen.value = true
    // Stop the page behind the dialog from scrolling.
    document.body.style.overflow = 'hidden'
  }

  function close() {
    isOpen.value = false
    document.body.style.overflow = ''
  }

  function onDocumentClick(event: MouseEvent) {
    const trigger = (event.target as HTMLElement | null)?.closest(`[${attribute}]`)
    if (!trigger) return
    event.preventDefault()
    open()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen.value) close()
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
    // Never leave the page unscrollable if the island is torn down while open.
    document.body.style.overflow = ''
  })

  return { isOpen, open, close }
}

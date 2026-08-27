import CheckerStrip from './CheckerStrip.astro'
import CheckerOverlay from './CheckerOverlay.astro'
import CheckerSquare from './CheckerSquare.astro'

/**
 * Ornament this theme fills into the base layout's slots.
 *
 * Slots take props and never children. A slot that accepted children would be a
 * component override in disguise, and overrides were rejected: each one is a
 * fork that stops receiving base improvements. If a design needs something no
 * slot can express, the element belongs in the base layout — unstyled, where
 * every band gets it — not in a wider slot contract.
 */
export const slots = {
  'section-divider': CheckerStrip,
  'hero-backdrop': CheckerOverlay,
  'card-mark': CheckerSquare,
} as const

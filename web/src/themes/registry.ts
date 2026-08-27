import { slots as baseSlots } from './base/slots'
import { slots as skankingStorksSlots } from './skanking-storks/slots'

type SlotMap = Record<string, unknown>

const REGISTRY: Record<string, SlotMap> = {
  base: baseSlots,
  'skanking-storks': skankingStorksSlots,
}

/**
 * Ornament components for a theme.
 *
 * An unknown theme name resolves to the base (empty) map rather than throwing.
 * The Astro build is all-or-nothing — one page that throws kills all 35 — so a
 * typo in a theme name must degrade to an unornamented page, not a dead site.
 */
export function slotsFor(theme: string): SlotMap {
  return REGISTRY[theme] ?? REGISTRY.base
}

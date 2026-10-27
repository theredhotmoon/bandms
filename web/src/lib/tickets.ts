import type { Concert } from '@/types/concert'

/**
 * Where a concert's tickets are sold: an external shop (`ticket_url`), our own
 * ticket types, both, or neither. One rule for every surface that links to
 * tickets — the show page, the Shows list and a news post's concert dialog —
 * so they cannot send a visitor to different places.
 */
export type TicketMode = 'external' | 'own' | 'both' | 'none'

export function ticketMode(concert: Pick<Concert, 'ticket_url' | 'ticket_types_count'>): TicketMode {
  // An API that predates the count says nothing about our own tickets; treat
  // them as present rather than hide a ticket section that may be selling.
  const own = concert.ticket_types_count === undefined ? true : concert.ticket_types_count > 0
  const external = !!concert.ticket_url
  if (external && own) return 'both'
  if (external) return 'external'
  if (own) return 'own'
  return 'none'
}

/**
 * The href a "Tickets" link elsewhere on the site should use. Off-site only
 * when the external shop is the only seller; otherwise the show page, where
 * our ticket list lives — and where, with both, the visitor chooses.
 * Null when nothing is sold, or when the show page is not built.
 */
export function ticketLink(
  concert: Pick<Concert, 'ticket_url' | 'ticket_types_count'>,
  showPage: string | null,
): { href: string; external: boolean } | null {
  const mode = ticketMode(concert)
  if (mode === 'external') return { href: concert.ticket_url!, external: true }
  if (!showPage || mode === 'none') return null
  return { href: mode === 'own' ? `${showPage}#tickets-section` : showPage, external: false }
}

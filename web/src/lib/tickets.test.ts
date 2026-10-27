import { describe, expect, it } from 'vitest'
import { ticketLink, ticketMode } from './tickets'

const PAGE = '/en/concerts/show'

describe('ticketMode', () => {
  it('reads both sellers', () => {
    expect(ticketMode({ ticket_url: 'https://x', ticket_types_count: 2 })).toBe('both')
    expect(ticketMode({ ticket_url: 'https://x', ticket_types_count: 0 })).toBe('external')
    expect(ticketMode({ ticket_url: null, ticket_types_count: 1 })).toBe('own')
    expect(ticketMode({ ticket_url: null, ticket_types_count: 0 })).toBe('none')
  })

  it('assumes our own tickets when the API sends no count', () => {
    expect(ticketMode({ ticket_url: null })).toBe('own')
  })
})

describe('ticketLink', () => {
  it('goes off-site only when the external shop is the only seller', () => {
    expect(ticketLink({ ticket_url: 'https://x', ticket_types_count: 0 }, PAGE)).toEqual({ href: 'https://x', external: true })
  })

  it('lands on our ticket list when only we sell', () => {
    expect(ticketLink({ ticket_url: null, ticket_types_count: 1 }, PAGE)).toEqual({ href: `${PAGE}#tickets-section`, external: false })
  })

  it('goes to the show page, where the visitor chooses, when both sell', () => {
    expect(ticketLink({ ticket_url: 'https://x', ticket_types_count: 1 }, PAGE)).toEqual({ href: PAGE, external: false })
  })

  it('is null when nothing is sold, or our tickets have no built page', () => {
    expect(ticketLink({ ticket_url: null, ticket_types_count: 0 }, PAGE)).toBeNull()
    expect(ticketLink({ ticket_url: null, ticket_types_count: 1 }, null)).toBeNull()
    // The external shop needs no page of ours.
    expect(ticketLink({ ticket_url: 'https://x', ticket_types_count: 0 }, null)).toEqual({ href: 'https://x', external: true })
  })
})

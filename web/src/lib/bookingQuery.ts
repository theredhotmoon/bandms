import type { BookingRequest } from '@/stores/booking'

/**
 * A picked date carried across pages in the URL.
 *
 * The availability calendar hands a date to the contact form through a
 * nanostore, which only works when both islands are on one page. On a page
 * with no form (concerts, home) the calendar navigates to the contact page
 * instead, and this is the format it travels in.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function bookingQuery(request: BookingRequest): string {
  const params = new URLSearchParams({ booking: request.date })
  if (request.unavailable) params.set('unavailable', '1')
  return `?${params}`
}

/** The request in a query string, or null — a malformed date is ignored, not trusted. */
export function bookingFromQuery(search: string): BookingRequest | null {
  const params = new URLSearchParams(search)
  const date = params.get('booking')
  if (!date || !DATE.test(date) || !isRealDate(date)) return null
  return { date, unavailable: params.get('unavailable') === '1' }
}

/**
 * A day that exists. Date.parse alone is not enough: it rolls 2026-02-31
 * over to 3 March, and the form would then offer a date nobody picked.
 */
function isRealDate(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

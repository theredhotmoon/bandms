import type { Localized } from './website-module'

/**
 * One FAQ entry, in the admin shape (both locales).
 *
 * `module_slug` is the subpage this question answers for and mirrors
 * website_modules.slug — the FAQ categories deliberately track the site's
 * sections rather than forming a second taxonomy.
 */
export interface Faq {
  id: number
  module_slug: string
  question: Localized
  answer: Localized
  sort_order: number
  is_published: boolean
  updated_at: string
}

/**
 * Fields accepted by POST/PUT /api/admin/faqs.
 *
 * Translations merge per locale on the server: omitting a locale leaves it
 * untouched, and an explicit null clears just that one.
 */
export interface FaqPayload {
  module_slug?: string
  question?: Localized
  answer?: Localized
  sort_order?: number
  is_published?: boolean
}

export interface FaqsResponse {
  data: Faq[]
}

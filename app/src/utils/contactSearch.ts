import { contactLanguageName, countryName } from '@/utils/contactCodes'
import type { AuthorSummary } from '@/types/author'

type SearchableContact = Pick<AuthorSummary, 'name' | 'email' | 'phone' | 'country' | 'contact_language'>

/**
 * Whether a contact matches the band form's contact-picker search.
 *
 * Name, email and phone match anywhere. Country and language match by the
 * start of their name in the admin's language, or by their exact code — a
 * substring would let "ana" pull in every contact in Ghana or Panama.
 * `query` is expected trimmed and lower-cased.
 */
export function matchesContactQuery(a: SearchableContact, query: string, uiLang: string): boolean {
  if (!query) return true
  if (
    a.name.toLowerCase().includes(query) ||
    (a.email ?? '').toLowerCase().includes(query) ||
    (a.phone ?? '').toLowerCase().includes(query)
  ) return true

  const country  = (countryName(a.country, uiLang) ?? '').toLowerCase()
  const language = (contactLanguageName(a.contact_language, uiLang) ?? '').toLowerCase()
  return (
    country.startsWith(query) || language.startsWith(query) ||
    a.country?.toLowerCase() === query || a.contact_language === query
  )
}

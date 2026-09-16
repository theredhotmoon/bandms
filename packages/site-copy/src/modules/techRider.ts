import { defineCopy } from '../resolve'

/**
 * The public rider link's page shell — title and the not-found state. The
 * rider sheet itself (@bandms/rider-core RiderSheet.vue) is the document a
 * venue crew prints and is deliberately not in this registry: it is fixed
 * English by design, the same way it is styled with fixed values rather than
 * theme tokens.
 */
export const TECH_RIDER_COPY = defineCopy([
  {
    key: 'title', label: 'Browser tab title', group: 'Rider page', maxLength: 60,
    defaults: { en: 'Technical Rider', pl: 'Rider techniczny' },
  },
  {
    key: 'notFound', label: 'Link invalid or expired', group: 'Rider page', maxLength: 160,
    help: 'Shown when the token in the URL matches no published rider.',
    defaults: { en: 'Rider not found, or the link has expired.', pl: 'Nie znaleziono ridera lub link wygasł.' },
  },
  {
    key: 'contact', label: '"Contact us" link', group: 'Rider page', maxLength: 40,
    help: 'Under the not-found message. Hidden when the Contact module is off.',
    defaults: { en: 'Contact us', pl: 'Skontaktuj się z nami' },
  },
])

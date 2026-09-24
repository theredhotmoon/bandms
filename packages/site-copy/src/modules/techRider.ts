import { defineCopy } from '../resolve'

/**
 * The public rider link's page shell — title, and the two states where no
 * sheet renders at all.
 *
 * The sheet itself (@bandms/rider-core RiderSheet.vue) is deliberately not in
 * this registry, and no longer because it is English: it takes its ~150
 * strings as a prop from the package's own locale bundles. They are document
 * vocabulary — "Ch", "Mic / DI", "STAGE BACK" — that no band will ever edit,
 * and listing them here would bury these three fields behind a wall of inputs
 * in the admin while duplicating the whole sheet into a second registry.
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
    key: 'invalidLink', label: 'Malformed link', group: 'Rider page', maxLength: 160,
    help: 'Shown when the URL carries no usable token at all — a truncated paste, not an expired rider.',
    defaults: { en: 'Invalid rider link.', pl: 'Nieprawidłowy link do ridera.' },
  },
  {
    key: 'contact', label: '"Contact us" link', group: 'Rider page', maxLength: 40,
    help: 'Under the not-found message. Hidden when the Contact module is off.',
    defaults: { en: 'Contact us', pl: 'Skontaktuj się z nami' },
  },
])

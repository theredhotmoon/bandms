import { defineCopy } from '../resolve'

/**
 * The site footer. Chrome, not a page — no route, no slug.
 *
 * Defaults are empty where the migration that created the `footer` row seeded
 * the band's own values (tagline, headings, blurb, rights): the row carries the
 * text, and the base theme a new band starts from prints nothing it has not
 * written.
 */
export const FOOTER_COPY = defineCopy([
  {
    key: 'tagline', label: 'Tagline', group: 'Brand column', maxLength: 120,
    help: 'Sits under the band name in the footer’s first column. Empty hides it.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'booking_title', label: 'Booking column heading', group: 'Booking column', maxLength: 60,
    help: 'Empty hides the heading; the column still shows the booking email.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'booking_text', label: 'Booking blurb', group: 'Booking column', type: 'textarea', maxLength: 300,
    help: 'Shown above the booking email, which comes from the band profile.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'follow_title', label: 'Links column heading', group: 'Links column', maxLength: 60,
    defaults: { en: '', pl: '' },
  },
  {
    key: 'newsletterLink', label: 'Newsletter link', group: 'Links column', maxLength: 40,
    help: 'The one link in the column that is not a module page.',
    defaults: { en: 'Newsletter', pl: 'Newsletter' },
  },
  {
    key: 'rights', label: 'Rights line', group: 'Bottom bar', maxLength: 120,
    help: 'Right-hand side of the bottom bar. The copyright and year are automatic.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'cookieSettings', label: '"Cookie settings" button', group: 'Bottom bar', maxLength: 40,
    help: 'Reopens the cookie banner. Only shown when analytics are configured.',
    defaults: { en: 'Cookie settings', pl: 'Ustawienia cookies' },
  },
])

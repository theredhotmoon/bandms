import { defineCopy } from '../resolve'

/**
 * The homepage. Its route is fixed (`/{lang}`), so the row has no slug — it
 * exists so this copy is editable, the same reason `footer` is a row.
 */
export const HOME_COPY = defineCopy([
  {
    key: 'estPrefix', label: '"Est." before the formation year', group: 'Hero', maxLength: 20,
    help: 'Shown as "{hometown} · Est. {year}" under the band name.',
    defaults: { en: 'Est.', pl: 'od' },
  },
  {
    key: 'ctaShows', label: '"See shows" button', group: 'Hero', maxLength: 30,
    defaults: { en: 'See shows', pl: 'Zobacz koncerty' },
  },
  {
    key: 'ctaMusic', label: '"Our music" button', group: 'Hero', maxLength: 30,
    defaults: { en: 'Our music', pl: 'Nasza muzyka' },
  },
  {
    key: 'ctaBook', label: '"Book us" button', group: 'Hero', maxLength: 30,
    help: 'Only shown when the profile has a booking email and the Contact module is on.',
    defaults: { en: 'Book us', pl: 'Zarezerwuj nas' },
  },
  {
    key: 'showsTitle', label: 'Heading', group: 'Upcoming shows', maxLength: 60,
    defaults: { en: 'Upcoming shows', pl: 'Nadchodzące koncerty' },
  },
  {
    key: 'showsAll', label: '"All shows" link', group: 'Upcoming shows', maxLength: 40,
    defaults: { en: 'All shows →', pl: 'Wszystkie koncerty →' },
  },
  {
    key: 'musicTitle', label: 'Heading', group: 'Latest music', maxLength: 60,
    defaults: { en: 'Music', pl: 'Muzyka' },
  },
  {
    key: 'musicAll', label: '"Discography" link', group: 'Latest music', maxLength: 40,
    defaults: { en: 'Discography →', pl: 'Dyskografia →' },
  },
  {
    key: 'newsTitle', label: 'Heading', group: 'Latest news', maxLength: 60,
    defaults: { en: 'News', pl: 'Aktualności' },
  },
  {
    key: 'newsAll', label: '"All posts" link', group: 'Latest news', maxLength: 40,
    defaults: { en: 'All posts →', pl: 'Wszystkie wpisy →' },
  },
  {
    key: 'nlKicker', label: 'Kicker', group: 'Newsletter box', maxLength: 40,
    defaults: { en: 'Stay in the loop', pl: 'Bądź na bieżąco' },
  },
  {
    key: 'nlTitle', label: 'Heading', group: 'Newsletter box', maxLength: 60,
    defaults: { en: 'Get the news first', pl: 'Dowiedz się pierwszy' },
  },
  {
    key: 'nlSub', label: 'Text', group: 'Newsletter box', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'New shows, releases, and behind-the-scenes — straight to your inbox. No spam.',
      pl: 'Nowe koncerty, wydawnictwa i kulisy — prosto na maila. Bez spamu.',
    },
  },
])

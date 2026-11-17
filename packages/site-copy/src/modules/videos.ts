import { defineCopy } from '../resolve'

/** The Videos page. */
export const VIDEOS_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Videos', pl: 'Wideo' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Official videos, live sets and what our fans filmed from the crowd.',
      pl: 'Oficjalne teledyski, koncerty i to, co nagrali nasi fani spod sceny.',
    },
  },
  {
    key: 'heading', label: 'Gallery heading', group: 'Gallery', maxLength: 60,
    defaults: { en: 'All videos', pl: 'Wszystkie nagrania' },
  },
  {
    key: 'empty', label: 'No videos yet', group: 'Gallery', maxLength: 120,
    defaults: { en: 'No videos yet — check back soon.', pl: 'Brak nagrań — wkrótce.' },
  },
  {
    key: 'views', label: '"views" count unit', group: 'Gallery', maxLength: 30,
    defaults: { en: 'views', pl: 'wyświetleń' },
  },
  {
    key: 'watch', label: '"Watch on YouTube" link', group: 'Gallery', maxLength: 40,
    defaults: { en: 'Watch on YouTube', pl: 'Zobacz na YouTube' },
  },
  {
    key: 'close', label: '"Close" button', group: 'Gallery', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },
])

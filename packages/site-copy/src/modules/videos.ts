import { defineCopy } from '../resolve'

/** The Videos page. */
export const VIDEOS_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Videos', pl: 'Teledyski' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Live sets, official videos and clips from the road.',
      pl: 'Koncerty, oficjalne teledyski i klipy z trasy.',
    },
  },
  {
    key: 'heading', label: 'Gallery heading', group: 'Gallery', maxLength: 60,
    defaults: { en: 'Music videos', pl: 'Teledyski' },
  },
  {
    key: 'empty', label: 'No videos yet', group: 'Gallery', maxLength: 120,
    defaults: { en: 'No videos yet — check back soon.', pl: 'Brak teledysków — wkrótce.' },
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

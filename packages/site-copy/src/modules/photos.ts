import { defineCopy } from '../resolve'

/** The Gallery page and its album browser / lightbox island. */
export const PHOTOS_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Gallery', pl: 'Galeria' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Brass in the air, feet off the floor. Live shots, backstage moments and studio days.',
      pl: 'Dęciaki w powietrzu, stopy w górze. Zdjęcia z koncertów, backstage’u i studia.',
    },
  },
  {
    key: 'none', label: 'No photos yet', group: 'Page header', maxLength: 120,
    defaults: { en: 'No photos yet — check back soon.', pl: 'Brak zdjęć — wkrótce.' },
  },
  {
    key: 'all', label: '"All" category', group: 'Albums', maxLength: 30,
    defaults: { en: 'All', pl: 'Wszystkie' },
  },
  {
    key: 'photos', label: '"photos" count unit', group: 'Albums', maxLength: 30,
    defaults: { en: 'photos', pl: 'zdjęć' },
  },
  {
    key: 'pressReady', label: '"Press-ready" badge', group: 'Albums', maxLength: 30,
    defaults: { en: 'Press-ready', pl: 'Do prasy' },
  },
  {
    key: 'shotAt', label: '"Shot at" label', group: 'Albums', maxLength: 30,
    help: 'Before the venue or place an album was taken at.',
    defaults: { en: 'Shot at', pl: 'Zdjęcia z' },
  },
  {
    key: 'empty', label: 'Empty category', group: 'Albums', maxLength: 120,
    defaults: { en: 'Nothing in this category yet.', pl: 'Brak zdjęć w tej kategorii.' },
  },
  {
    key: 'close', label: '"Close" button', group: 'Lightbox', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },
  {
    key: 'prev', label: '"Previous photo" button', group: 'Lightbox', maxLength: 40,
    defaults: { en: 'Previous photo', pl: 'Poprzednie zdjęcie' },
  },
  {
    key: 'next', label: '"Next photo" button', group: 'Lightbox', maxLength: 40,
    defaults: { en: 'Next photo', pl: 'Następne zdjęcie' },
  },
])

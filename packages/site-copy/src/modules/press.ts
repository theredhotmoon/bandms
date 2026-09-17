import { defineCopy } from '../resolve'

/** The Press page. */
export const PRESS_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Press', pl: 'Prasa' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'What the papers, blogs and radio have said about us.',
      pl: 'Co pisały o nas gazety, blogi i radio.',
    },
  },
  {
    key: 'empty', label: 'No coverage yet', group: 'Page header', maxLength: 120,
    defaults: { en: 'No press coverage yet.', pl: 'Brak publikacji prasowych.' },
  },
  {
    key: 'featured', label: '"Featured" heading', group: 'Coverage', maxLength: 60,
    defaults: { en: 'Featured', pl: 'Wyróżnione' },
  },
  {
    key: 'coverage', label: '"Coverage" heading', group: 'Coverage', maxLength: 60,
    defaults: { en: 'Coverage', pl: 'Publikacje' },
  },
  {
    key: 'read', label: '"Read" link', group: 'Coverage', maxLength: 30,
    defaults: { en: 'Read', pl: 'Czytaj' },
  },
])

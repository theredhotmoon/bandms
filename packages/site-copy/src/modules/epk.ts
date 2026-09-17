import { defineCopy } from '../resolve'

/** The public electronic press kit page. */
export const EPK_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header. Empty shows the band name.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'tabTitle', label: 'Browser tab title', group: 'Page header', maxLength: 60,
    help: 'The document title only — the H1 shows the band name unless "Page title" is set.',
    defaults: { en: 'EPK', pl: 'EPK' },
  },
  {
    key: 'kicker', label: 'Kicker', group: 'Page header', maxLength: 60,
    help: 'Small line above the page title.',
    defaults: { en: 'ELECTRONIC PRESS KIT', pl: 'ELECTRONIC PRESS KIT' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Everything press and promoters need, on one page.',
      pl: 'Wszystko, czego potrzebuje prasa i organizatorzy — na jednej stronie.',
    },
  },
  {
    key: 'formed', label: 'Fact: formed', group: 'Page header', maxLength: 30,
    defaults: { en: 'Formed', pl: 'Powstali' },
  },
  {
    key: 'based', label: 'Fact: based in', group: 'Page header', maxLength: 30,
    defaults: { en: 'Based in', pl: 'Z miasta' },
  },
  {
    key: 'genres', label: 'Fact: genres', group: 'Page header', maxLength: 30,
    defaults: { en: 'Genres', pl: 'Gatunki' },
  },
  {
    key: 'bio', label: 'Biography heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Biography', pl: 'Biografia' },
  },
  {
    key: 'audience', label: 'Audience heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Audience', pl: 'Publiczność' },
  },
  {
    key: 'release', label: 'Featured release heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Featured release', pl: 'Wyróżnione wydawnictwo' },
  },
  {
    key: 'tracklist', label: '"Tracklist" label', group: 'Sections', maxLength: 40,
    defaults: { en: 'Tracklist', pl: 'Lista utworów' },
  },
  {
    key: 'shows', label: 'Upcoming shows heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Upcoming shows', pl: 'Nadchodzące koncerty' },
  },
  {
    key: 'photos', label: 'Press photos heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Press photos', pl: 'Zdjęcia prasowe' },
  },
  {
    key: 'download', label: '"Download" button', group: 'Sections', maxLength: 30,
    defaults: { en: 'Download', pl: 'Pobierz' },
  },
  {
    key: 'quotes', label: 'Quotes heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'What people say', pl: 'Co o nas mówią' },
  },
  {
    key: 'contact', label: 'Contact heading', group: 'Sections', maxLength: 60,
    defaults: { en: 'Get in touch', pl: 'Kontakt' },
  },
  {
    key: 'booking', label: 'Booking email label', group: 'Sections', maxLength: 30,
    defaults: { en: 'Booking', pl: 'Booking' },
  },
  {
    key: 'press', label: 'Press email label', group: 'Sections', maxLength: 30,
    defaults: { en: 'Press', pl: 'Prasa' },
  },
  {
    key: 'monthly', label: 'Stat: monthly listeners', group: 'Audience stats', maxLength: 40,
    defaults: { en: 'Monthly listeners', pl: 'Słuchaczy mies.' },
  },
  {
    key: 'instagram', label: 'Stat: Instagram', group: 'Audience stats', maxLength: 40,
    defaults: { en: 'Instagram', pl: 'Instagram' },
  },
  {
    key: 'youtube', label: 'Stat: YouTube', group: 'Audience stats', maxLength: 40,
    defaults: { en: 'YouTube', pl: 'YouTube' },
  },
  {
    key: 'tiktok', label: 'Stat: TikTok', group: 'Audience stats', maxLength: 40,
    defaults: { en: 'TikTok', pl: 'TikTok' },
  },
  {
    key: 'facebook', label: 'Stat: Facebook', group: 'Audience stats', maxLength: 40,
    defaults: { en: 'Facebook', pl: 'Facebook' },
  },
])

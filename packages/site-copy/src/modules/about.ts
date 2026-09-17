import { defineCopy } from '../resolve'

/** The About page: bio column, stats band, line-up grid and press & booking. */
export const ABOUT_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'About', pl: 'O nas' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header.',
    defaults: {
      en: 'Six players, one upbeat. The story behind the band — and the people who make the room move.',
      pl: 'Sześciu muzyków, jeden upbeat. Historia zespołu — i ludzie, którzy rozruszają każdą salę.',
    },
  },

  // ── Bio ─────────────────────────────────────────────────────────────
  {
    key: 'formed', label: '"Formed" label', group: 'Biography', maxLength: 30,
    help: 'Before the formation year.',
    defaults: { en: 'Formed', pl: 'Powstali' },
  },
  {
    key: 'based', label: '"Based in" label', group: 'Biography', maxLength: 30,
    help: 'Before the hometown.',
    defaults: { en: 'Based in', pl: 'Z miasta' },
  },
  {
    key: 'forFans', label: '"For fans of" heading', group: 'Biography', maxLength: 40,
    help: 'Above the list of comparable artists.',
    defaults: { en: 'For fans of', pl: 'Dla fanów' },
  },
  {
    key: 'noBio', label: 'No biography yet', group: 'Biography', maxLength: 80,
    defaults: { en: 'Biography coming soon.', pl: 'Biografia wkrótce.' },
  },

  // ── Stats ───────────────────────────────────────────────────────────
  {
    key: 'stats', label: 'Heading', group: 'Band in numbers', maxLength: 60,
    defaults: { en: 'By the numbers', pl: 'W liczbach' },
  },
  {
    key: 'statMonthly', label: 'Monthly listeners label', group: 'Band in numbers', maxLength: 40,
    defaults: { en: 'Monthly listeners', pl: 'Słuchaczy mies.' },
  },
  {
    key: 'statInsta', label: 'Instagram label', group: 'Band in numbers', maxLength: 40,
    defaults: { en: 'Instagram', pl: 'Instagram' },
  },
  {
    key: 'statYoutube', label: 'YouTube label', group: 'Band in numbers', maxLength: 40,
    defaults: { en: 'YouTube', pl: 'YouTube' },
  },
  {
    key: 'statShows', label: 'Shows played label', group: 'Band in numbers', maxLength: 40,
    defaults: { en: 'Shows played', pl: 'Zagranych koncertów' },
  },
  {
    key: 'statYears', label: 'Years on stage label', group: 'Band in numbers', maxLength: 40,
    defaults: { en: 'Years on stage', pl: 'Lat na scenie' },
  },

  // ── Members ─────────────────────────────────────────────────────────
  {
    key: 'members', label: 'Heading', group: 'Band members', maxLength: 60,
    defaults: { en: 'The line-up', pl: 'Skład' },
  },
  {
    key: 'membersSub', label: 'Subtitle', group: 'Band members', maxLength: 200,
    defaults: { en: 'Tap a player to read their story.', pl: 'Kliknij muzyka, by poznać jego historię.' },
  },
  {
    key: 'membersEmpty', label: 'No members yet', group: 'Band members', maxLength: 80,
    defaults: { en: 'Line-up coming soon.', pl: 'Skład wkrótce.' },
  },
  {
    key: 'former', label: '"Past members" heading', group: 'Band members', maxLength: 40,
    defaults: { en: 'Past members', pl: 'Byli członkowie' },
  },
  {
    key: 'plays', label: '"Plays" label', group: 'Band members', maxLength: 30,
    help: 'Before the list of instruments in a member card.',
    defaults: { en: 'Plays', pl: 'Gra na' },
  },
  {
    key: 'view', label: '"View" button', group: 'Band members', maxLength: 30,
    defaults: { en: 'View', pl: 'Zobacz' },
  },
  {
    key: 'close', label: '"Close" button', group: 'Band members', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },

  // ── Press & booking ─────────────────────────────────────────────────
  {
    key: 'press', label: 'Heading', group: 'Press & booking', maxLength: 60,
    defaults: { en: 'Press & booking', pl: 'Prasa i booking' },
  },
  {
    key: 'pressSub', label: 'Subtitle', group: 'Press & booking', maxLength: 200,
    defaults: {
      en: 'Everything press and promoters need — in one place.',
      pl: 'Wszystko, czego potrzebuje prasa i organizatorzy — w jednym miejscu.',
    },
  },
  {
    key: 'epk', label: 'EPK card: title', group: 'Press & booking', maxLength: 60,
    defaults: { en: 'Press kit (EPK)', pl: 'Press kit (EPK)' },
  },
  {
    key: 'epkSub', label: 'EPK card: subtitle', group: 'Press & booking', maxLength: 100,
    defaults: { en: 'Bio, photos, stats & logos', pl: 'Bio, zdjęcia, statystyki i loga' },
  },
  {
    key: 'photos', label: 'Photos card: title', group: 'Press & booking', maxLength: 60,
    defaults: { en: 'Press photos', pl: 'Zdjęcia prasowe' },
  },
  {
    key: 'photosSub', label: 'Photos card: subtitle', group: 'Press & booking', maxLength: 100,
    defaults: { en: 'Hi-res, print-ready', pl: 'Hi-res, gotowe do druku' },
  },
  {
    key: 'rider', label: 'Rider card: title', group: 'Press & booking', maxLength: 60,
    defaults: { en: 'Tech rider', pl: 'Rider techniczny' },
  },
  {
    key: 'riderSub', label: 'Rider card: subtitle', group: 'Press & booking', maxLength: 100,
    defaults: { en: 'Stage plan & input list (PDF)', pl: 'Plan sceny i lista wejść (PDF)' },
  },
  {
    key: 'stagePlot', label: 'Stage plot card: title', group: 'Press & booking', maxLength: 60,
    defaults: { en: 'Stage plot', pl: 'Plan sceny' },
  },
  {
    key: 'stagePlotSub', label: 'Stage plot card: subtitle', group: 'Press & booking', maxLength: 100,
    defaults: { en: 'Backline & positions', pl: 'Backline i pozycje' },
  },
  {
    key: 'open', label: '"Open" button', group: 'Press & booking', maxLength: 30,
    defaults: { en: 'Open', pl: 'Otwórz' },
  },
  {
    key: 'download', label: '"Download" button', group: 'Press & booking', maxLength: 30,
    defaults: { en: 'Download', pl: 'Pobierz' },
  },
  {
    key: 'booking', label: 'Booking email label', group: 'Press & booking', maxLength: 30,
    defaults: { en: 'Booking', pl: 'Booking' },
  },
  {
    key: 'pressLabel', label: 'Press email label', group: 'Press & booking', maxLength: 30,
    defaults: { en: 'Press', pl: 'Prasa' },
  },
])

import { defineCopy } from '../resolve'

/** The Music page and each release's own page. */
export const RELEASES_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Music', pl: 'Muzyka' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Brass-fuelled skank, dub-soaked rocksteady and ska-jazz heat — every release, every video, in one place.',
      pl: 'Dęciaki na full, dubowe rocksteady i ska-jazzowy żar — wszystkie wydawnictwa i teledyski w jednym miejscu.',
    },
  },
  {
    key: 'empty', label: 'No releases yet', group: 'Page header', maxLength: 120,
    defaults: { en: 'No releases yet — watch this space.', pl: 'Brak wydawnictw — wkrótce.' },
  },

  // ── Featured ────────────────────────────────────────────────────────
  {
    key: 'featured', label: 'Heading', group: 'Featured release', maxLength: 60,
    defaults: { en: 'Featured release', pl: 'Wyróżnione wydawnictwo' },
  },
  {
    key: 'tracklist', label: '"Tracklist" label', group: 'Featured release', maxLength: 40,
    help: 'Also used on each release page.',
    defaults: { en: 'Tracklist', pl: 'Lista utworów' },
  },
  {
    key: 'outNow', label: '"Out now" stamp', group: 'Featured release', maxLength: 30,
    defaults: { en: 'Out now', pl: 'Już dostępne' },
  },
  {
    key: 'presave', label: '"Pre-save" stamp and button', group: 'Featured release', maxLength: 30,
    defaults: { en: 'Pre-save', pl: 'Pre-save' },
  },
  {
    key: 'listen', label: '"Listen" button', group: 'Featured release', maxLength: 30,
    defaults: { en: 'Listen', pl: 'Posłuchaj' },
  },
  {
    key: 'viewLyrics', label: '"Lyrics" link on a track', group: 'Featured release', maxLength: 30,
    defaults: { en: 'Lyrics', pl: 'Tekst' },
  },

  // ── Where to listen ─────────────────────────────────────────────────
  {
    key: 'where', label: 'Heading', group: 'Where to listen', maxLength: 60,
    defaults: { en: 'Where to listen', pl: 'Gdzie słuchać' },
  },
  {
    key: 'whereSub', label: 'Subtitle', group: 'Where to listen', maxLength: 200,
    defaults: {
      en: "Pick your poison — we're on every platform that spins.",
      pl: 'Wybierz swoje — jesteśmy na każdej platformie, która gra.',
    },
  },

  // ── Discography ─────────────────────────────────────────────────────
  {
    key: 'disco', label: 'Heading', group: 'Discography', maxLength: 60,
    defaults: { en: 'Discography', pl: 'Dyskografia' },
  },
  {
    key: 'discoSub', label: 'Subtitle', group: 'Discography', maxLength: 200,
    defaults: {
      en: 'Singles, EPs and the records that built the skank. Open a release to see its tracklist.',
      pl: 'Single, EP-ki i płyty, które zbudowały skank. Kliknij wydawnictwo, by zobaczyć listę utworów.',
    },
  },
  {
    key: 'tracks', label: '"tracks" count unit', group: 'Discography', maxLength: 30,
    defaults: { en: 'tracks', pl: 'utworów' },
  },
  {
    key: 'detail', label: '"Release page" link', group: 'Discography', maxLength: 40,
    defaults: { en: 'Release page', pl: 'Strona wydawnictwa' },
  },
  {
    key: 'typeAlbum', label: 'Release type: album', group: 'Discography', maxLength: 30,
    defaults: { en: 'Album', pl: 'Album' },
  },
  {
    key: 'typeEp', label: 'Release type: EP', group: 'Discography', maxLength: 30,
    defaults: { en: 'EP', pl: 'EP' },
  },
  {
    key: 'typeSingle', label: 'Release type: single', group: 'Discography', maxLength: 30,
    defaults: { en: 'Single', pl: 'Singiel' },
  },
  {
    key: 'typeCompilation', label: 'Release type: compilation', group: 'Discography', maxLength: 30,
    defaults: { en: 'Compilation', pl: 'Kompilacja' },
  },

  // ── Videos ──────────────────────────────────────────────────────────
  {
    key: 'videos', label: 'Heading', group: 'Music videos', maxLength: 60,
    defaults: { en: 'Music videos', pl: 'Teledyski' },
  },
  {
    key: 'views', label: '"views" count unit', group: 'Music videos', maxLength: 30,
    defaults: { en: 'views', pl: 'wyświetleń' },
  },
  {
    key: 'watch', label: '"Watch on YouTube" link', group: 'Music videos', maxLength: 40,
    defaults: { en: 'Watch on YouTube', pl: 'Zobacz na YouTube' },
  },
  {
    key: 'close', label: '"Close" button', group: 'Music videos', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },

  // ── Lyrics ──────────────────────────────────────────────────────────
  {
    key: 'lyrics', label: 'Heading', group: 'Lyrics', maxLength: 60,
    defaults: { en: 'Lyrics', pl: 'Teksty' },
  },
  {
    key: 'lyricsSub', label: 'Subtitle', group: 'Lyrics', maxLength: 200,
    defaults: { en: 'Sing along.', pl: 'Śpiewaj z nami.' },
  },
  {
    key: 'lyricsEmpty', label: 'No lyrics yet', group: 'Lyrics', maxLength: 80,
    defaults: { en: 'No lyrics published yet.', pl: 'Brak opublikowanych tekstów.' },
  },

  // ── Buy physical ────────────────────────────────────────────────────
  {
    key: 'buy', label: 'Heading', group: 'Buy physical', maxLength: 60,
    help: 'Also the heading of the physical-formats box on a release page.',
    defaults: { en: 'Buy physical', pl: 'Kup fizycznie' },
  },
  {
    key: 'buySub', label: 'Subtitle', group: 'Buy physical', maxLength: 200,
    defaults: { en: 'Wax, plastic and tape for the collectors.', pl: 'Winyl, plastik i taśma dla kolekcjonerów.' },
  },
  {
    key: 'buyCta', label: '"View" link on an item', group: 'Buy physical', maxLength: 30,
    defaults: { en: 'View', pl: 'Zobacz' },
  },

  // ── Release page ────────────────────────────────────────────────────
  {
    key: 'photos', label: 'Photos heading', group: 'Release page', maxLength: 60,
    defaults: { en: 'Photos', pl: 'Zdjęcia' },
  },
])

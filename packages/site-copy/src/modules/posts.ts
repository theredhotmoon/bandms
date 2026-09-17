import { defineCopy } from '../resolve'

/** The News list (with its tag filter and search) and the article page. */
export const POSTS_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'News', pl: 'Aktualności' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Studio updates, fresh dates and stories from the road.',
      pl: 'Wieści ze studia, nowe daty i historie z trasy.',
    },
  },

  // ── Filter ──────────────────────────────────────────────────────────
  {
    key: 'filterAll', label: '"All" tag', group: 'Filter & list', maxLength: 30,
    defaults: { en: 'All', pl: 'Wszystkie' },
  },
  {
    key: 'searchPlaceholder', label: 'Search placeholder', group: 'Filter & list', maxLength: 40,
    defaults: { en: 'Search posts…', pl: 'Szukaj wpisów…' },
  },
  {
    key: 'searchLabel', label: 'Search field label (screen readers)', group: 'Filter & list', maxLength: 40,
    defaults: { en: 'Search posts', pl: 'Szukaj wpisów' },
  },
  {
    key: 'noMatch', label: 'No posts match', group: 'Filter & list', maxLength: 120,
    defaults: { en: 'No posts match your search.', pl: 'Żaden wpis nie pasuje do wyszukiwania.' },
  },
  {
    key: 'featured', label: '"Featured" badge', group: 'Filter & list', maxLength: 30,
    defaults: { en: 'Featured', pl: 'Wyróżnione' },
  },
  {
    key: 'readFull', label: '"Read full story" link', group: 'Filter & list', maxLength: 40,
    defaults: { en: 'Read full story', pl: 'Czytaj całość' },
  },

  // ── Article ─────────────────────────────────────────────────────────
  {
    key: 'crumbHome', label: 'Breadcrumb: home', group: 'Article page', maxLength: 30,
    defaults: { en: 'Home', pl: 'Start' },
  },
  {
    key: 'articleFallback', label: 'Breadcrumb: untagged article', group: 'Article page', maxLength: 30,
    help: 'Used in place of a tag when the post has none.',
    defaults: { en: 'Article', pl: 'Artykuł' },
  },
  {
    key: 'event', label: '"Event" date label', group: 'Article page', maxLength: 30,
    defaults: { en: 'Event', pl: 'Wydarzenie' },
  },
  {
    key: 'share', label: '"Share" button', group: 'Article page', maxLength: 30,
    defaults: { en: 'Share', pl: 'Udostępnij' },
  },
  {
    key: 'shareCopied', label: '"Share" button after copying', group: 'Article page', maxLength: 30,
    defaults: { en: 'Copied', pl: 'Skopiowano' },
  },
  {
    key: 'backToList', label: '"Back to news" link', group: 'Article page', maxLength: 40,
    defaults: { en: 'Back to news', pl: 'Wróć do aktualności' },
  },
  {
    key: 'newer', label: '"Newer post" nav', group: 'Article page', maxLength: 30,
    defaults: { en: 'Newer post', pl: 'Nowszy wpis' },
  },
  {
    key: 'older', label: '"Older post" nav', group: 'Article page', maxLength: 30,
    defaults: { en: 'Older post', pl: 'Starszy wpis' },
  },
  {
    key: 'more', label: '"More from the blog" heading', group: 'Article page', maxLength: 60,
    defaults: { en: 'More from the blog', pl: 'Więcej z bloga' },
  },
])

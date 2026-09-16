import { defineCopy } from '../resolve'

/**
 * Strings that belong to no page: navigation labels read by screen readers,
 * the mobile menu, the FAQ block every section embeds, and the 404 page.
 * Chrome, like `footer` — no route, no slug.
 */
export const SITE_COPY = defineCopy([
  {
    key: 'navLabel', label: 'Main navigation (screen readers)', group: 'Navigation', maxLength: 40,
    defaults: { en: 'Main navigation', pl: 'Nawigacja główna' },
  },
  {
    key: 'menuOpen', label: '"Open menu" (screen readers)', group: 'Navigation', maxLength: 30,
    defaults: { en: 'Open menu', pl: 'Otwórz menu' },
  },
  {
    key: 'menuClose', label: '"Close menu" (screen readers)', group: 'Navigation', maxLength: 30,
    defaults: { en: 'Close menu', pl: 'Zamknij menu' },
  },
  {
    key: 'mobileNavLabel', label: 'Mobile navigation (screen readers)', group: 'Navigation', maxLength: 40,
    defaults: { en: 'Mobile navigation', pl: 'Nawigacja mobilna' },
  },
  {
    key: 'footerNavLabel', label: 'Footer navigation (screen readers)', group: 'Navigation', maxLength: 40,
    defaults: { en: 'Footer navigation', pl: 'Nawigacja w stopce' },
  },
  {
    key: 'languageLabel', label: 'Language selector (screen readers)', group: 'Navigation', maxLength: 40,
    defaults: { en: 'Language selector', pl: 'Wybór języka' },
  },
  {
    key: 'breadcrumbLabel', label: 'Breadcrumb (screen readers)', group: 'Navigation', maxLength: 40,
    defaults: { en: 'Breadcrumb', pl: 'Ścieżka nawigacji' },
  },
  {
    key: 'faqTitle', label: 'Heading', group: 'FAQ block', maxLength: 60,
    help: 'The FAQ accordion at the bottom of any page that has questions.',
    defaults: { en: 'Quick answers', pl: 'Szybkie odpowiedzi' },
  },
  {
    key: 'faqSub', label: 'Subtitle', group: 'FAQ block', maxLength: 160,
    defaults: {
      en: 'The things promoters and fans ask us most.',
      pl: 'To, o co najczęściej pytają organizatorzy i fani.',
    },
  },
  {
    key: 'notFoundTitle', label: 'Heading', group: '404 page', maxLength: 60,
    defaults: { en: 'Page not found', pl: 'Nie znaleziono strony' },
  },
  {
    key: 'notFoundDescription', label: 'Meta description', group: '404 page', maxLength: 160,
    defaults: { en: "The page you're looking for doesn't exist.", pl: 'Strona, której szukasz, nie istnieje.' },
  },
  {
    key: 'notFoundBody', label: 'Text', group: '404 page', maxLength: 200,
    defaults: {
      en: "The page you're looking for doesn't exist or has been moved.",
      pl: 'Strona, której szukasz, nie istnieje lub została przeniesiona.',
    },
  },
  {
    key: 'notFoundHome', label: '"Back to home" button', group: '404 page', maxLength: 40,
    defaults: { en: 'Back to home', pl: 'Wróć na stronę główną' },
  },
])

import { defineCopy } from '../resolve'

/**
 * The welcome screen: a one-time dialog that greets a visitor with upcoming
 * shows, news, a newsletter sign-up and a fan-account sign-in. It has no page
 * of its own, so the row has no slug.
 */
export const WELCOME_COPY = defineCopy([
  // ── Intro ───────────────────────────────────────────────────────────
  {
    key: 'heading', label: 'Heading', group: 'Intro', maxLength: 80,
    help: '{band} is filled in with the band name.',
    defaults: { en: 'Welcome to {band}', pl: 'Witaj u {band}' },
  },
  {
    key: 'intro', label: 'Introduction', group: 'Intro', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'Glad you dropped by. Here is what is happening right now.',
      pl: 'Fajnie, że wpadasz. Zobacz, co u nas słychać.',
    },
  },

  // ── Gigs ────────────────────────────────────────────────────────────
  {
    key: 'gigsTitle', label: 'Shows: heading', group: 'Gigs', maxLength: 60,
    defaults: { en: 'Catch us live', pl: 'Zobacz nas na żywo' },
  },
  {
    key: 'gigsNearTitle', label: 'Shows: heading near the visitor', group: 'Gigs', maxLength: 60,
    help: 'Used instead of the heading above when the shows were picked by the visitor’s location.',
    defaults: { en: 'Shows near you', pl: 'Koncerty w pobliżu' },
  },

  // ── News ────────────────────────────────────────────────────────────
  {
    key: 'newsTitle', label: 'News: heading', group: 'News', maxLength: 60,
    defaults: { en: 'Latest news', pl: 'Najnowsze wieści' },
  },

  // ── Newsletter ──────────────────────────────────────────────────────
  {
    key: 'newsletterTitle', label: 'Newsletter: heading', group: 'Newsletter', maxLength: 60,
    defaults: { en: 'Stay in the loop', pl: 'Bądź na bieżąco' },
  },
  {
    key: 'newsletterBody', label: 'Newsletter: text', group: 'Newsletter', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'New shows and tunes, straight to your inbox. No spam, unsubscribe any time.',
      pl: 'Nowe koncerty i kawałki prosto na maila. Bez spamu, wypisz się kiedy chcesz.',
    },
  },
  {
    key: 'newsletterPlaceholder', label: 'Newsletter: email placeholder', group: 'Newsletter', maxLength: 40,
    defaults: { en: 'Your email', pl: 'Twój e-mail' },
  },
  {
    key: 'newsletterSubmit', label: 'Newsletter: button', group: 'Newsletter', maxLength: 30,
    defaults: { en: 'Subscribe', pl: 'Zapisz mnie' },
  },
  {
    key: 'newsletterSending', label: 'Newsletter: button while sending', group: 'Newsletter', maxLength: 30,
    defaults: { en: 'Sending…', pl: 'Wysyłam…' },
  },
  {
    key: 'newsletterDone', label: 'Newsletter: success message', group: 'Newsletter', type: 'textarea', maxLength: 200,
    defaults: {
      en: 'Almost there. Check your inbox and confirm your address.',
      pl: 'Prawie gotowe. Sprawdź skrzynkę i potwierdź swój adres.',
    },
  },
  {
    key: 'newsletterError', label: 'Newsletter: error message', group: 'Newsletter', type: 'textarea', maxLength: 200,
    defaults: {
      en: 'Something went wrong. Please try again in a moment.',
      pl: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    },
  },

  // ── Account ─────────────────────────────────────────────────────────
  {
    key: 'accountTitle', label: 'Account: heading', group: 'Account', maxLength: 60,
    defaults: { en: 'Join the crew', pl: 'Dołącz do ekipy' },
  },
  {
    key: 'accountBody', label: 'Account: text', group: 'Account', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'Sign in with your email, no password needed, to comment on our news. We send you a one-time link.',
      pl: 'Zaloguj się e-mailem, bez hasła, żeby komentować nasze aktualności. Wyślemy ci jednorazowy link.',
    },
  },
  {
    key: 'accountPlaceholder', label: 'Account: email placeholder', group: 'Account', maxLength: 40,
    defaults: { en: 'Your email', pl: 'Twój e-mail' },
  },
  {
    key: 'accountSubmit', label: 'Account: button', group: 'Account', maxLength: 30,
    defaults: { en: 'Send me a link', pl: 'Wyślij mi link' },
  },
  {
    key: 'accountSending', label: 'Account: button while sending', group: 'Account', maxLength: 30,
    defaults: { en: 'Sending…', pl: 'Wysyłam…' },
  },
  {
    key: 'accountDone', label: 'Account: success message', group: 'Account', type: 'textarea', maxLength: 200,
    defaults: {
      en: 'Link sent. Check your inbox to sign in.',
      pl: 'Link wysłany. Sprawdź skrzynkę, żeby się zalogować.',
    },
  },
  {
    key: 'accountError', label: 'Account: error message', group: 'Account', type: 'textarea', maxLength: 200,
    defaults: {
      en: 'We could not send the link. Please try again in a moment.',
      pl: 'Nie udało się wysłać linku. Spróbuj ponownie za chwilę.',
    },
  },

  // ── Buttons ─────────────────────────────────────────────────────────
  {
    key: 'enter', label: '"Enter the site" button', group: 'Buttons', maxLength: 30,
    defaults: { en: 'Enter the site', pl: 'Wejdź na stronę' },
  },
  {
    key: 'close', label: 'Close button (accessible label)', group: 'Buttons', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },
])

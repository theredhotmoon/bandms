import { defineCopy } from '../resolve'

/**
 * The Newsletter page, the sign-up form it and other pages embed, and the
 * confirm / unsubscribe landing pages that the emails link to.
 */
export const NEWSLETTER_COPY = defineCopy([
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Newsletter', pl: 'Newsletter' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: 'Tour dates, new tunes and where to catch us live — straight to your inbox.',
      pl: 'Daty tras, nowe kawałki i gdzie nas złapać na żywo — prosto na maila.',
    },
  },
  {
    key: 'panelTitle', label: 'Panel heading', group: 'Sign-up panel', maxLength: 60,
    defaults: { en: 'Never miss a skank', pl: 'Nie przegap żadnego skanku' },
  },
  {
    key: 'panelSub', label: 'Panel text', group: 'Sign-up panel', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'New shows, releases and behind-the-scenes. No spam, unsubscribe any time.',
      pl: 'Nowe koncerty, wydawnictwa i kulisy. Bez spamu, wypisz się kiedy chcesz.',
    },
  },
  {
    key: 'confirmNote', label: 'Double opt-in note', group: 'Sign-up panel', maxLength: 200,
    defaults: {
      en: 'We send a confirmation link first — check your inbox to finish signing up.',
      pl: 'Najpierw wysyłamy link potwierdzający — sprawdź skrzynkę, by dokończyć zapis.',
    },
  },
  {
    key: 'placeholder', label: 'Email placeholder', group: 'Sign-up form', maxLength: 40,
    help: 'The same form is embedded on the homepage and the Shows page.',
    defaults: { en: 'your@email.com', pl: 'twoj@email.com' },
  },
  {
    key: 'submit', label: '"Join" button', group: 'Sign-up form', maxLength: 30,
    defaults: { en: 'Join the list', pl: 'Dołącz do listy' },
  },
  {
    key: 'sending', label: 'Button while sending', group: 'Sign-up form', maxLength: 30,
    defaults: { en: 'Subscribing…', pl: 'Zapisywanie…' },
  },
  {
    key: 'done', label: 'Success message', group: 'Sign-up form', maxLength: 80,
    defaults: { en: "You're on the list!", pl: 'Jesteś na liście!' },
  },
  {
    key: 'error', label: 'Error message', group: 'Sign-up form', maxLength: 120,
    defaults: { en: 'Something went wrong. Please try again.', pl: 'Coś poszło nie tak. Spróbuj ponownie.' },
  },
  {
    key: 'waiting', label: 'Loading text', group: 'Confirm & unsubscribe pages', maxLength: 40,
    defaults: { en: 'Please wait…', pl: 'Chwileczkę…' },
  },
  {
    key: 'confirmSuccess', label: 'Confirmed', group: 'Confirm & unsubscribe pages', maxLength: 120,
    defaults: {
      en: 'Your email has been confirmed. Welcome to the list!',
      pl: 'Adres potwierdzony. Witamy na liście!',
    },
  },
  {
    key: 'confirmError', label: 'Confirmation link invalid', group: 'Confirm & unsubscribe pages', maxLength: 120,
    defaults: {
      en: 'This confirmation link is invalid or has already been used.',
      pl: 'Ten link potwierdzający jest nieprawidłowy lub został już użyty.',
    },
  },
  {
    key: 'unsubscribeSuccess', label: 'Unsubscribed', group: 'Confirm & unsubscribe pages', maxLength: 120,
    defaults: { en: 'You have been successfully unsubscribed.', pl: 'Wypisaliśmy Cię z listy.' },
  },
  {
    key: 'unsubscribeError', label: 'Unsubscribe link invalid', group: 'Confirm & unsubscribe pages', maxLength: 120,
    defaults: {
      en: 'This unsubscribe link is invalid or has already been used.',
      pl: 'Ten link wypisujący jest nieprawidłowy lub został już użyty.',
    },
  },
  {
    key: 'networkError', label: 'Network error', group: 'Confirm & unsubscribe pages', maxLength: 120,
    defaults: { en: 'Network error. Please try again.', pl: 'Błąd sieci. Spróbuj ponownie.' },
  },
  {
    key: 'backHome', label: '"Back to home" link', group: 'Confirm & unsubscribe pages', maxLength: 40,
    defaults: { en: '← Back to home', pl: '← Wróć na stronę główną' },
  },
  {
    key: 'goToNewsletter', label: '"Go to newsletter page" link', group: 'Confirm & unsubscribe pages', maxLength: 40,
    defaults: { en: 'Go to newsletter page', pl: 'Przejdź do strony newslettera' },
  },
])

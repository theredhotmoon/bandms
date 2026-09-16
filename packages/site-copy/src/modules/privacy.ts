import { defineCopy } from '../resolve'

/**
 * The privacy policy page and the cookie-consent banner that links to it.
 * Fixed route (`/{lang}/privacy`), so the row has no slug.
 */
export const PRIVACY_COPY = defineCopy([
  // ── Cookie banner ───────────────────────────────────────────────────
  {
    key: 'bannerBody', label: 'Banner text', group: 'Cookie banner', type: 'textarea', maxLength: 300,
    help: 'Only shown when analytics are configured.',
    defaults: {
      en: 'We use cookies to understand how visitors use this site. Analytics only load if you accept.',
      pl: 'Używamy plików cookie, aby zrozumieć, jak odwiedzający korzystają z tej strony. Analityka ładuje się tylko po Twojej zgodzie.',
    },
  },
  {
    key: 'bannerAccept', label: '"Accept" button', group: 'Cookie banner', maxLength: 30,
    defaults: { en: 'Accept', pl: 'Akceptuję' },
  },
  {
    key: 'bannerReject', label: '"Reject" button', group: 'Cookie banner', maxLength: 30,
    defaults: { en: 'Reject', pl: 'Odrzucam' },
  },
  {
    key: 'bannerLink', label: 'Policy link', group: 'Cookie banner', maxLength: 40,
    defaults: { en: 'Privacy policy', pl: 'Polityka prywatności' },
  },

  // ── Policy page ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Policy page', maxLength: 60,
    defaults: { en: 'Privacy policy', pl: 'Polityka prywatności' },
  },
  {
    key: 'description', label: 'Meta description', group: 'Policy page', maxLength: 160,
    defaults: {
      en: 'How this site uses cookies and analytics.',
      pl: 'Jak ta strona wykorzystuje pliki cookie i analitykę.',
    },
  },
  {
    key: 'intro', label: 'Introduction', group: 'Policy page', type: 'textarea', maxLength: 400,
    help: '{band} is filled in with the band name.',
    defaults: {
      en: 'This page explains what {band} collects when you visit this website, and how to change your mind.',
      pl: 'Ta strona wyjaśnia, jakie dane zbiera {band} podczas odwiedzin tej witryny i jak zmienić swoją decyzję.',
    },
  },
  {
    key: 'cookiesHeading', label: 'Cookies: heading', group: 'Policy page', maxLength: 80,
    defaults: { en: 'Cookies and analytics', pl: 'Pliki cookie i analityka' },
  },
  {
    key: 'cookiesBody', label: 'Cookies: text', group: 'Policy page', type: 'textarea', maxLength: 1000,
    defaults: {
      en: 'We use Google Analytics 4 to understand how visitors use this site — which pages are popular, roughly where visitors come from, and whether the site works well. Google Analytics only starts once you accept the cookie banner; it never runs before that, and nothing is tracked if you reject it.',
      pl: 'Używamy Google Analytics 4, aby zrozumieć, jak odwiedzający korzystają z tej strony — które podstrony są popularne, w przybliżeniu skąd pochodzą odwiedzający i czy strona działa poprawnie. Google Analytics uruchamia się dopiero po zaakceptowaniu banera cookies; nigdy nie działa wcześniej, a odrzucenie oznacza brak jakiegokolwiek śledzenia.',
    },
  },
  {
    key: 'cookieName', label: 'Cookie table: name label', group: 'Policy page', maxLength: 30,
    defaults: { en: 'Cookie', pl: 'Plik cookie' },
  },
  {
    key: 'cookieNameValue', label: 'Cookie table: name value', group: 'Policy page', maxLength: 60,
    defaults: { en: '_ga, _ga_*', pl: '_ga, _ga_*' },
  },
  {
    key: 'cookiePurpose', label: 'Cookie table: purpose label', group: 'Policy page', maxLength: 30,
    defaults: { en: 'Purpose', pl: 'Cel' },
  },
  {
    key: 'cookiePurposeValue', label: 'Cookie table: purpose value', group: 'Policy page', maxLength: 160,
    defaults: {
      en: 'Distinguishes visitors for Google Analytics reporting',
      pl: 'Rozróżnianie odwiedzających na potrzeby raportów Google Analytics',
    },
  },
  {
    key: 'cookieDuration', label: 'Cookie table: duration label', group: 'Policy page', maxLength: 30,
    defaults: { en: 'Duration', pl: 'Czas przechowywania' },
  },
  {
    key: 'cookieDurationValue', label: 'Cookie table: duration value', group: 'Policy page', maxLength: 60,
    defaults: { en: 'Up to 14 months', pl: 'Do 14 miesięcy' },
  },
  {
    key: 'withdrawHeading', label: 'Changing your choice: heading', group: 'Policy page', maxLength: 80,
    defaults: { en: 'Changing your choice', pl: 'Zmiana decyzji' },
  },
  {
    key: 'withdrawBody', label: 'Changing your choice: text', group: 'Policy page', type: 'textarea', maxLength: 400,
    defaults: {
      en: 'You can accept or reject analytics cookies at any time from the "Cookie settings" link in the footer of any page.',
      pl: 'W każdej chwili możesz zaakceptować lub odrzucić pliki cookie analityczne, korzystając z linku "Ustawienia cookies" w stopce dowolnej podstrony.',
    },
  },
  {
    key: 'controllerHeading', label: 'Contact: heading', group: 'Policy page', maxLength: 80,
    defaults: { en: 'Who to contact', pl: 'Kontakt' },
  },
  {
    key: 'controllerBody', label: 'Contact: text (with email)', group: 'Policy page', type: 'textarea', maxLength: 400,
    help: 'Used when the profile has a booking email. {email} is filled in.',
    defaults: {
      en: 'Questions about this policy can be sent to {email}.',
      pl: 'Pytania dotyczące tej polityki można kierować na adres {email}.',
    },
  },
  {
    key: 'controllerBodyNoEmail', label: 'Contact: text (no email)', group: 'Policy page', type: 'textarea', maxLength: 400,
    help: 'Used when the profile has no booking email.',
    defaults: {
      en: 'Questions about this policy can be sent via the contact page.',
      pl: 'Pytania dotyczące tej polityki można kierować przez stronę kontaktową.',
    },
  },
  {
    key: 'googleHeading', label: 'Google: heading', group: 'Policy page', maxLength: 80,
    defaults: { en: 'Google’s own policy', pl: 'Polityka Google' },
  },
  {
    key: 'googleBody', label: 'Google: text', group: 'Policy page', type: 'textarea', maxLength: 400,
    defaults: {
      en: 'Google’s use of data is governed by its own privacy policy.',
      pl: 'Wykorzystanie danych przez Google podlega jego własnej polityce prywatności.',
    },
  },
  {
    key: 'googleLinkLabel', label: 'Google: link text', group: 'Policy page', maxLength: 60,
    defaults: { en: 'Google Privacy & Terms', pl: 'Prywatność i warunki Google' },
  },
])

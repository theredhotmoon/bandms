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
    key: 'tagsLabel', label: 'Tags: screen-reader label', group: 'Article page', maxLength: 40,
    help: 'Read out before the tag links under the article header.',
    defaults: { en: 'Tags', pl: 'Tagi' },
  },
  {
    key: 'concertKicker', label: 'Linked concert: card label', group: 'Article page', maxLength: 40,
    help: 'Above the concert card at the end of a post linked to a show.',
    defaults: { en: 'The show', pl: 'Koncert' },
  },
  {
    key: 'concertOpen', label: 'Linked concert: "Show details" button', group: 'Article page', maxLength: 40,
    defaults: { en: 'Show details', pl: 'Szczegóły' },
  },
  {
    key: 'concertOpenPage', label: 'Linked concert: "Concert page" link', group: 'Article page', maxLength: 40,
    defaults: { en: 'Go to the concert page', pl: 'Przejdź do strony koncertu' },
  },
  {
    key: 'concertClose', label: 'Linked concert: "Close" button', group: 'Article page', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
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

  // ── Comments (under an article; signed-in fans only) ────────────────
  {
    key: 'commentsTitle', label: 'Heading', group: 'Comments', maxLength: 60,
    defaults: { en: 'Comments', pl: 'Komentarze' },
  },
  {
    key: 'commentsEmpty', label: 'No comments yet', group: 'Comments', maxLength: 120,
    defaults: { en: 'No comments yet. Be the first.', pl: 'Nie ma jeszcze komentarzy. Napisz pierwszy.' },
  },
  {
    key: 'commentsSignInLead', label: 'Sign-in prompt', group: 'Comments', maxLength: 200,
    defaults: { en: 'Sign in with your email to comment. We will send you a link — no password needed.', pl: 'Zaloguj się e-mailem, aby skomentować. Wyślemy ci link — bez hasła.' },
  },
  {
    key: 'commentsEmailLabel', label: 'Email field label', group: 'Comments', maxLength: 40,
    defaults: { en: 'Your email', pl: 'Twój e-mail' },
  },
  {
    key: 'commentsSendLink', label: '"Send link" button', group: 'Comments', maxLength: 40,
    defaults: { en: 'Send me a sign-in link', pl: 'Wyślij mi link do logowania' },
  },
  {
    key: 'commentsLinkSent', label: 'After the link is sent', group: 'Comments', maxLength: 160,
    defaults: { en: 'Check your inbox — the link brings you back to this post.', pl: 'Sprawdź skrzynkę — link przeniesie cię z powrotem do tego wpisu.' },
  },
  {
    key: 'commentsNameLabel', label: 'Display name label', group: 'Comments', maxLength: 60,
    defaults: { en: 'Name shown with your comments', pl: 'Nazwa widoczna przy twoich komentarzach' },
  },
  {
    key: 'commentsBodyLabel', label: 'Comment field label', group: 'Comments', maxLength: 40,
    defaults: { en: 'Your comment', pl: 'Twój komentarz' },
  },
  {
    key: 'commentsSubmit', label: '"Post comment" button', group: 'Comments', maxLength: 40,
    defaults: { en: 'Post comment', pl: 'Dodaj komentarz' },
  },
  {
    key: 'commentsSignedInAs', label: '"Signed in as" line', group: 'Comments', maxLength: 60,
    help: '{email} is filled in with the fan\'s address.',
    defaults: { en: 'Signed in as {email}', pl: 'Zalogowano jako {email}' },
  },
  {
    key: 'commentsSignOut', label: '"Sign out" link', group: 'Comments', maxLength: 30,
    defaults: { en: 'Sign out', pl: 'Wyloguj' },
  },
  {
    key: 'commentsChangeName', label: '"Change name" link', group: 'Comments', maxLength: 30,
    defaults: { en: 'Change name', pl: 'Zmień nazwę' },
  },
  {
    key: 'commentsSaveName', label: '"Save name" button', group: 'Comments', maxLength: 30,
    defaults: { en: 'Save name', pl: 'Zapisz nazwę' },
  },
  {
    key: 'commentsDelete', label: '"Delete" link', group: 'Comments', maxLength: 30,
    defaults: { en: 'Delete', pl: 'Usuń' },
  },
  {
    key: 'commentsDeleteConfirm', label: '"Delete" link, second click', group: 'Comments', maxLength: 40,
    defaults: { en: 'Click again to delete', pl: 'Kliknij ponownie, aby usunąć' },
  },
  {
    key: 'commentsBlocked', label: 'Shown to a blocked fan', group: 'Comments', maxLength: 120,
    defaults: { en: "You can't comment on this site.", pl: 'Nie możesz komentować na tej stronie.' },
  },
  {
    key: 'commentsError', label: 'Generic error', group: 'Comments', maxLength: 120,
    defaults: { en: 'Something went wrong. Please try again.', pl: 'Coś poszło nie tak. Spróbuj ponownie.' },
  },
])

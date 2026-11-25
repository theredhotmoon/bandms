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
    key: 'previewBanner', label: 'Draft preview banner', group: 'Article page', maxLength: 120,
    help: "Across the top of a draft's preview page. Visitors never see it.",
    defaults: { en: 'Preview — this post is not published yet', pl: 'Podgląd — ten wpis nie jest jeszcze opublikowany' },
  },
  {
    key: 'clipsTitle', label: 'Videos heading', group: 'Article page', maxLength: 60,
    help: 'Above the videos linked at the end of a post. Hidden when the post links none.',
    defaults: { en: 'Videos', pl: 'Wideo' },
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
    defaults: { en: 'Sign in to comment — with a password, or let us email you a link.', pl: 'Zaloguj się, aby skomentować — hasłem albo linkiem wysłanym e-mailem.' },
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
    key: 'commentsSendingLink', label: '"Send link" button while working', group: 'Comments', maxLength: 40,
    defaults: { en: 'Sending…', pl: 'Wysyłanie…' },
  },
  {
    key: 'commentsLinkSent', label: 'After the link is sent', group: 'Comments', maxLength: 160,
    defaults: { en: 'Check your inbox — the link brings you back to this post.', pl: 'Sprawdź skrzynkę — link przeniesie cię z powrotem do tego wpisu.' },
  },
  {
    key: 'commentsPasswordLabel', label: 'Password field label', group: 'Comments', maxLength: 40,
    defaults: { en: 'Password', pl: 'Hasło' },
  },
  {
    key: 'commentsSignIn', label: '"Sign in" button', group: 'Comments', maxLength: 30,
    defaults: { en: 'Sign in', pl: 'Zaloguj się' },
  },
  {
    key: 'commentsSigningIn', label: '"Sign in" button while working', group: 'Comments', maxLength: 30,
    defaults: { en: 'Signing in…', pl: 'Logowanie…' },
  },
  {
    key: 'commentsCreateAccount', label: '"Create an account" link', group: 'Comments', maxLength: 40,
    defaults: { en: 'Create an account', pl: 'Załóż konto' },
  },
  {
    key: 'commentsCreateAccountSubmit', label: '"Create account" button', group: 'Comments', maxLength: 30,
    defaults: { en: 'Create account', pl: 'Utwórz konto' },
  },
  {
    key: 'commentsCreatingAccount', label: '"Create account" button while working', group: 'Comments', maxLength: 30,
    defaults: { en: 'Creating your account…', pl: 'Tworzenie konta…' },
  },
  {
    key: 'commentsBackToSignIn', label: '"Back to sign in" link', group: 'Comments', maxLength: 40,
    defaults: { en: 'I already have an account', pl: 'Mam już konto' },
  },
  {
    key: 'commentsRegisterSent', label: 'After creating an account', group: 'Comments', maxLength: 200,
    defaults: {
      en: 'Check your inbox and open the link to finish creating your account. It brings you back to this post.',
      pl: 'Sprawdź skrzynkę i otwórz link, aby dokończyć zakładanie konta. Przeniesie cię z powrotem do tego wpisu.',
    },
  },
  {
    key: 'commentsLoginFailed', label: 'Wrong email or password', group: 'Comments', maxLength: 200,
    defaults: {
      en: 'That email and password do not match. If you forgot your password, email yourself a sign-in link instead.',
      pl: 'Ten e-mail i hasło do siebie nie pasują. Jeśli zapomniałeś hasła, wyślij sobie link do logowania.',
    },
  },
  {
    key: 'commentsLoginLimit', label: 'Too many sign-in attempts', group: 'Comments', maxLength: 160,
    defaults: {
      en: 'Too many attempts. Wait a few minutes, or email yourself a sign-in link.',
      pl: 'Zbyt wiele prób. Poczekaj kilka minut albo wyślij sobie link do logowania.',
    },
  },
  {
    key: 'commentsPasswordHint', label: 'Password hint when creating an account', group: 'Comments', maxLength: 100,
    defaults: { en: 'At least 8 characters.', pl: 'Co najmniej 8 znaków.' },
  },
  {
    key: 'commentsSignInFailed', label: 'Generic sign-in error', group: 'Comments', maxLength: 120,
    defaults: { en: 'Could not sign you in. Please try again.', pl: 'Nie udało się zalogować. Spróbuj ponownie.' },
  },
  {
    key: 'commentsContinueWith', label: '"Continue with" button (Google, Facebook)', group: 'Comments', maxLength: 40,
    help: '{provider} is filled in with Google or Facebook. The buttons only appear once the band has set the provider up.',
    defaults: { en: 'Continue with {provider}', pl: 'Kontynuuj z {provider}' },
  },
  {
    key: 'commentsOrDivider', label: 'Divider under the provider buttons', group: 'Comments', maxLength: 20,
    defaults: { en: 'or', pl: 'lub' },
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

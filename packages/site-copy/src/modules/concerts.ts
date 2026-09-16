import { defineCopy } from '../resolve'

/**
 * Shows list page, the played-shows archive island, the map island, and the
 * single-show page including its ticket checkout modal.
 */
export const CONCERTS_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Shows', pl: 'Koncerty' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description.',
    defaults: {
      en: "Brass, bass and the upbeat — live. Every date we're playing next, and every floor we've already moved.",
      pl: 'Dęciaki, bas i upbeat — na żywo. Każdy nadchodzący termin i każdy parkiet, który już rozruszaliśmy.',
    },
  },
  {
    key: 'statUpcoming', label: '"Upcoming" counter label', group: 'Page header', maxLength: 40,
    help: 'Under the first number in the header stats.',
    defaults: { en: 'upcoming', pl: 'nadchodzących' },
  },
  {
    key: 'statPlayed', label: '"Shows played" counter label', group: 'Page header', maxLength: 40,
    defaults: { en: 'shows played', pl: 'zagranych' },
  },
  {
    key: 'statCities', label: '"Cities" counter label', group: 'Page header', maxLength: 40,
    defaults: { en: 'cities', pl: 'miast' },
  },

  // ── Map ─────────────────────────────────────────────────────────────
  {
    key: 'mapTitle', label: 'Heading', group: 'Where we play (map)', maxLength: 80,
    help: 'Only shown when at least one venue has coordinates.',
    defaults: { en: 'Where we play', pl: 'Gdzie gramy' },
  },
  {
    key: 'mapSub', label: 'Subtitle', group: 'Where we play (map)', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'Every dot is a gig. Teal = coming up, ink = already played. Tap a pin to open.',
      pl: 'Każda kropka to koncert. Zielone = nadchodzące, czarne = zagrane. Kliknij pinezkę, by otworzyć.',
    },
  },
  {
    key: 'mapLegendUpcoming', label: 'Legend: upcoming', group: 'Where we play (map)', maxLength: 40,
    defaults: { en: 'Upcoming', pl: 'Nadchodzące' },
  },
  {
    key: 'mapLegendPlayed', label: 'Legend: played', group: 'Where we play (map)', maxLength: 40,
    defaults: { en: 'Played', pl: 'Zagrane' },
  },
  {
    key: 'mapPopupCta', label: 'Pin popup: "View details" link', group: 'Where we play (map)', maxLength: 40,
    defaults: { en: 'View details →', pl: 'Zobacz szczegóły →' },
  },
  {
    key: 'showOnMap', label: '"Show on map" button', group: 'Where we play (map)', maxLength: 40,
    help: 'On every show row that has a pin, in the upcoming list and the archive.',
    defaults: { en: 'Show on map', pl: 'Pokaż na mapie' },
  },

  // ── Upcoming ────────────────────────────────────────────────────────
  {
    key: 'upcomingTitle', label: 'Heading', group: 'Upcoming shows', maxLength: 80,
    defaults: { en: 'Upcoming shows', pl: 'Nadchodzące koncerty' },
  },
  {
    key: 'upcomingSub', label: 'Subtitle', group: 'Upcoming shows', maxLength: 200,
    defaults: { en: 'Grab a ticket before the room fills up.', pl: 'Złap bilet, zanim sala się zapełni.' },
  },
  {
    key: 'details', label: '"Details" link', group: 'Upcoming shows', maxLength: 40,
    defaults: { en: 'Details', pl: 'Szczegóły' },
  },
  {
    key: 'tickets', label: '"Tickets" button', group: 'Upcoming shows', maxLength: 40,
    defaults: { en: 'Tickets', pl: 'Bilety' },
  },
  {
    key: 'typeFestival', label: '"Festival" badge', group: 'Upcoming shows', maxLength: 30,
    help: 'On a show tagged festival, in the list and the archive.',
    defaults: { en: 'Festival', pl: 'Festiwal' },
  },
  {
    key: 'typeSupport', label: '"Support" badge', group: 'Upcoming shows', maxLength: 30,
    defaults: { en: 'Support', pl: 'Support' },
  },
  {
    key: 'emptyTitle', label: 'Empty state: title', group: 'Upcoming shows', maxLength: 120,
    help: 'Shown when there are no upcoming shows.',
    defaults: { en: 'No upcoming shows announced yet.', pl: 'Nie ogłosiliśmy jeszcze kolejnych koncertów.' },
  },
  {
    key: 'emptySub', label: 'Empty state: subtitle', group: 'Upcoming shows', maxLength: 160,
    defaults: { en: 'Get on the list to be first to know.', pl: 'Zapisz się, by dowiedzieć się pierwszy.' },
  },
  {
    key: 'emptyLink', label: 'Empty state: newsletter link', group: 'Upcoming shows', maxLength: 60,
    defaults: { en: 'Join the newsletter →', pl: 'Dołącz do newslettera →' },
  },

  // ── Archive ─────────────────────────────────────────────────────────
  {
    key: 'archiveTitle', label: 'Heading', group: 'Played shows', maxLength: 80,
    defaults: { en: 'Played shows', pl: 'Zagrane koncerty' },
  },
  {
    key: 'archiveSub', label: 'Subtitle', group: 'Played shows', maxLength: 200,
    defaults: {
      en: 'The road so far — browse the back catalogue of gigs.',
      pl: 'Dotychczasowa trasa — przejrzyj archiwum koncertów.',
    },
  },
  {
    key: 'archiveAll', label: '"All years" filter', group: 'Played shows', maxLength: 30,
    defaults: { en: 'All', pl: 'Wszystkie' },
  },
  {
    key: 'archiveEmpty', label: 'No shows for the chosen year', group: 'Played shows', maxLength: 120,
    defaults: { en: 'No shows for this year.', pl: 'Brak koncertów w tym roku.' },
  },

  // ── Newsletter strip ────────────────────────────────────────────────
  {
    key: 'nlBadge', label: 'Badge', group: 'Newsletter box', maxLength: 30,
    defaults: { en: '★ SKA', pl: '★ SKA' },
  },
  {
    key: 'nlTitle', label: 'Heading', group: 'Newsletter box', maxLength: 80,
    defaults: { en: 'Never miss a skank', pl: 'Nie przegap żadnego skanku' },
  },
  {
    key: 'nlSub', label: 'Text', group: 'Newsletter box', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'Tour dates, new tunes and where to catch us live — straight to your inbox.',
      pl: 'Daty tras, nowe kawałki i gdzie nas złapać na żywo — prosto na maila.',
    },
  },

  // ── Show page ───────────────────────────────────────────────────────
  {
    key: 'crumbHome', label: 'Breadcrumb: home', group: 'Show page', maxLength: 30,
    defaults: { en: 'Home', pl: 'Start' },
  },
  {
    key: 'badgePast', label: 'Status badge: past', group: 'Show page', maxLength: 40,
    defaults: { en: 'Past show', pl: 'Zagrany' },
  },
  {
    key: 'badgeUpcoming', label: 'Status badge: upcoming', group: 'Show page', maxLength: 40,
    defaults: { en: 'Upcoming show', pl: 'Nadchodzący' },
  },
  {
    key: 'buyTickets', label: '"Buy tickets" button', group: 'Show page', maxLength: 40,
    defaults: { en: 'Buy tickets', pl: 'Kup bilety' },
  },
  {
    key: 'ticketsTba', label: '"Tickets TBA" button', group: 'Show page', maxLength: 40,
    help: 'Shown on an upcoming show with no ticket link and no ticket types.',
    defaults: { en: 'Tickets TBA', pl: 'Bilety wkrótce' },
  },
  {
    key: 'addToCalendar', label: '"Add to calendar" button', group: 'Show page', maxLength: 40,
    defaults: { en: 'Add to calendar', pl: 'Dodaj do kalendarza' },
  },
  {
    key: 'share', label: '"Share" button', group: 'Show page', maxLength: 30,
    defaults: { en: 'Share', pl: 'Udostępnij' },
  },
  {
    key: 'shareCopied', label: '"Share" button after copying', group: 'Show page', maxLength: 30,
    defaults: { en: 'Link copied', pl: 'Link skopiowany' },
  },
  {
    key: 'posterPending', label: 'Poster placeholder', group: 'Show page', maxLength: 60,
    defaults: { en: 'Poster coming soon', pl: 'Plakat wkrótce' },
  },
  {
    key: 'posterCaption', label: 'Poster caption', group: 'Show page', maxLength: 40,
    defaults: { en: 'Gig poster', pl: 'Plakat koncertu' },
  },
  {
    key: 'posterAlt', label: 'Poster alt text', group: 'Show page', maxLength: 120,
    help: 'Screen-reader description. {band} and {venue} are filled in.',
    defaults: { en: 'Poster for {band} at {venue}', pl: 'Plakat {band} w {venue}' },
  },
  {
    key: 'factDoors', label: 'Fact: doors', group: 'Show page', maxLength: 30,
    defaults: { en: 'Doors', pl: 'Drzwi' },
  },
  {
    key: 'factOnStage', label: 'Fact: on stage', group: 'Show page', maxLength: 30,
    defaults: { en: 'On stage', pl: 'Na scenie' },
  },
  {
    key: 'factSetLength', label: 'Fact: set length', group: 'Show page', maxLength: 30,
    defaults: { en: 'Set length', pl: 'Długość setu' },
  },
  {
    key: 'factCity', label: 'Fact: city', group: 'Show page', maxLength: 30,
    defaults: { en: 'City', pl: 'Miasto' },
  },
  {
    key: 'aboutTitle', label: '"About this show" heading', group: 'Show page', maxLength: 80,
    defaults: { en: 'About this show', pl: 'O koncercie' },
  },
  {
    key: 'lineupTitle', label: 'Line-up heading', group: 'Show page', maxLength: 80,
    defaults: { en: 'Line-up for the night', pl: 'Skład wieczoru' },
  },
  {
    key: 'headliner', label: 'Line-up: headliner', group: 'Show page', maxLength: 30,
    defaults: { en: 'Headliner', pl: 'Headliner' },
  },
  {
    key: 'support', label: 'Line-up: support', group: 'Show page', maxLength: 30,
    defaults: { en: 'Support', pl: 'Support' },
  },
  {
    key: 'setlistPast', label: 'Setlist heading (past show)', group: 'Show page', maxLength: 80,
    defaults: { en: 'What we played', pl: 'Co zagraliśmy' },
  },
  {
    key: 'setlistPlanned', label: 'Setlist heading (upcoming show)', group: 'Show page', maxLength: 80,
    defaults: { en: 'Planned set', pl: 'Planowany set' },
  },
  {
    key: 'songs', label: '"songs" count unit', group: 'Show page', maxLength: 30,
    help: 'After the number of songs in the setlist header.',
    defaults: { en: 'songs', pl: 'utworów' },
  },
  {
    key: 'encore', label: 'Encore label', group: 'Show page', maxLength: 30,
    defaults: { en: '★ Encore', pl: '★ Bis' },
  },
  {
    key: 'venueTitle', label: 'Venue heading', group: 'Show page', maxLength: 80,
    defaults: { en: 'Venue & getting there', pl: 'Miejsce i dojazd' },
  },
  {
    key: 'openInMaps', label: '"Open in maps" link', group: 'Show page', maxLength: 40,
    defaults: { en: 'Open in maps', pl: 'Otwórz w mapach' },
  },
  {
    key: 'gettingThere', label: '"Getting there" label', group: 'Show page', maxLength: 40,
    defaults: { en: 'Getting there', pl: 'Dojazd' },
  },
  {
    key: 'noTransportInfo', label: 'No transport info', group: 'Show page', maxLength: 80,
    defaults: { en: 'No transport info yet.', pl: 'Brak informacji o dojeździe.' },
  },
  {
    key: 'ticketsTitle', label: 'Tickets heading', group: 'Show page', maxLength: 60,
    defaults: { en: 'Tickets', pl: 'Bilety' },
  },
  {
    key: 'linksTitle', label: 'Links heading (past show)', group: 'Show page', maxLength: 60,
    defaults: { en: 'Links', pl: 'Linki' },
  },
  {
    key: 'ticketsLoading', label: 'Ticket availability loading', group: 'Show page', maxLength: 80,
    defaults: { en: 'Loading availability…', pl: 'Sprawdzamy dostępność…' },
  },
  {
    key: 'moreUpcoming', label: '"More upcoming shows" heading', group: 'Show page', maxLength: 80,
    defaults: { en: 'More upcoming shows', pl: 'Więcej nadchodzących koncertów' },
  },
  {
    key: 'morePast', label: '"More past shows" heading', group: 'Show page', maxLength: 80,
    defaults: { en: 'More past shows', pl: 'Więcej zagranych koncertów' },
  },
  {
    key: 'allShows', label: '"All shows" back link', group: 'Show page', maxLength: 40,
    defaults: { en: 'All shows', pl: 'Wszystkie koncerty' },
  },
  {
    key: 'previous', label: '"Previous" nav', group: 'Show page', maxLength: 30,
    defaults: { en: 'Previous', pl: 'Poprzedni' },
  },
  {
    key: 'next', label: '"Next" nav', group: 'Show page', maxLength: 30,
    defaults: { en: 'Next', pl: 'Następny' },
  },
  {
    key: 'navShow', label: 'Prev/next: "Show" caption', group: 'Show page', maxLength: 30,
    defaults: { en: 'Show', pl: 'Koncert' },
  },

  // ── Ticket checkout ─────────────────────────────────────────────────
  {
    key: 'tktStatusUnavailable', label: 'Ticket type: not available', group: 'Ticket checkout', maxLength: 60,
    defaults: { en: 'Not available', pl: 'Niedostępne' },
  },
  {
    key: 'tktStatusOnSaleFrom', label: 'Ticket type: on sale from', group: 'Ticket checkout', maxLength: 60,
    help: '{date} is filled in.',
    defaults: { en: 'On sale from {date}', pl: 'W sprzedaży od {date}' },
  },
  {
    key: 'tktRemaining', label: 'Ticket type: remaining count', group: 'Ticket checkout', maxLength: 40,
    help: '{n} is filled in.',
    defaults: { en: '{n} left', pl: 'Zostało: {n}' },
  },
  {
    key: 'tktAvailable', label: 'Ticket type: available', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Available', pl: 'Dostępne' },
  },
  {
    key: 'tktBuy', label: '"Buy" button', group: 'Ticket checkout', maxLength: 30,
    defaults: { en: 'Buy →', pl: 'Kup →' },
  },
  {
    key: 'tktModalTitle', label: 'Checkout modal title', group: 'Ticket checkout', maxLength: 60,
    defaults: { en: 'Your details', pl: 'Twoje dane' },
  },
  {
    key: 'tktModalSub', label: 'Checkout modal subtitle', group: 'Ticket checkout', maxLength: 160,
    defaults: {
      en: 'Your tickets will be emailed to you after payment.',
      pl: 'Bilety wyślemy mailem po opłaceniu.',
    },
  },
  {
    key: 'tktName', label: 'Full name label', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Full name', pl: 'Imię i nazwisko' },
  },
  {
    key: 'tktNamePh', label: 'Full name placeholder', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Jane Smith', pl: 'Anna Kowalska' },
  },
  {
    key: 'tktEmail', label: 'Email label', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Email address', pl: 'Adres e-mail' },
  },
  {
    key: 'tktEmailPh', label: 'Email placeholder', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'jane@example.com', pl: 'anna@przyklad.pl' },
  },
  {
    key: 'tktCancel', label: '"Cancel" button', group: 'Ticket checkout', maxLength: 30,
    defaults: { en: 'Cancel', pl: 'Anuluj' },
  },
  {
    key: 'tktSubmit', label: '"Proceed to payment" button', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Proceed to payment →', pl: 'Przejdź do płatności →' },
  },
  {
    key: 'tktProcessing', label: 'Button while processing', group: 'Ticket checkout', maxLength: 40,
    defaults: { en: 'Processing…', pl: 'Przetwarzanie…' },
  },
  {
    key: 'tktNone', label: 'No ticket types', group: 'Ticket checkout', maxLength: 120,
    defaults: { en: 'No tickets available for this event.', pl: 'Brak biletów na to wydarzenie.' },
  },
  {
    key: 'tktLoadError', label: 'Ticket info failed to load', group: 'Ticket checkout', maxLength: 120,
    defaults: { en: 'Could not load ticket info.', pl: 'Nie udało się wczytać informacji o biletach.' },
  },
  {
    key: 'tktQty', label: 'Quantity label', group: 'Ticket checkout', maxLength: 20,
    defaults: { en: 'Qty', pl: 'Ilość' },
  },
  {
    key: 'tktErrorCheckout', label: 'Checkout failed', group: 'Ticket checkout', maxLength: 160,
    defaults: { en: 'Checkout failed. Please try again.', pl: 'Płatność nie powiodła się. Spróbuj ponownie.' },
  },
  {
    key: 'tktErrorNetwork', label: 'Network error', group: 'Ticket checkout', maxLength: 160,
    defaults: { en: 'Network error. Please try again.', pl: 'Błąd sieci. Spróbuj ponownie.' },
  },
])

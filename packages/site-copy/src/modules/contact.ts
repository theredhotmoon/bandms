import { defineCopy } from '../resolve'

/**
 * The Contact page: hero, message form, direct channels, promoter cards, and
 * the two modals (press kit, availability calendar) the cards open.
 *
 * The snake_case keys predate this registry and are what the band's saved
 * overrides are stored under — see CopyField.key.
 */
export const CONTACT_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Contact', pl: 'Kontakt' },
  },
  {
    key: 'kicker', label: 'Kicker', group: 'Page header', maxLength: 60,
    help: 'Small line above the page title. Set in caps in the design. Empty hides it.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'lead', label: 'Lead paragraph', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the hero, and doubles as the page meta description. Empty hides it.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'reply_time_label', label: 'Reply-time badge', group: 'Page header', maxLength: 60,
    help: 'Shown as a hero pill and again beside the send button. Leave empty to hide both.',
    defaults: { en: '', pl: '' },
  },

  // ── Form ────────────────────────────────────────────────────────────
  {
    key: 'formTitle', label: 'Heading', group: 'Message form', maxLength: 60,
    help: 'Also the hero button that scrolls to the form.',
    defaults: { en: 'Send a message', pl: 'Napisz do nas' },
  },
  {
    key: 'formSub', label: 'Subtitle', group: 'Message form', maxLength: 200,
    defaults: {
      en: 'Fill in the form and hit send — it lands straight in our inbox.',
      pl: 'Wypełnij formularz i wyślij — trafi prosto na naszą skrzynkę.',
    },
  },
  {
    key: 'reasonLabel', label: 'Reason field label', group: 'Message form', maxLength: 60,
    defaults: { en: "What's this about?", pl: 'W jakiej sprawie?' },
  },
  {
    key: 'reasonGeneral', label: 'Reason: general', group: 'Message form', maxLength: 30,
    defaults: { en: 'Say hello', pl: 'Przywitaj się' },
  },
  {
    key: 'reasonBooking', label: 'Reason: booking', group: 'Message form', maxLength: 30,
    defaults: { en: 'Booking', pl: 'Booking' },
  },
  {
    key: 'reasonPress', label: 'Reason: press', group: 'Message form', maxLength: 30,
    defaults: { en: 'Press', pl: 'Prasa' },
  },
  {
    key: 'reasonOther', label: 'Reason: other', group: 'Message form', maxLength: 30,
    defaults: { en: 'Other', pl: 'Inne' },
  },
  {
    key: 'name', label: 'Name label', group: 'Message form', maxLength: 40,
    defaults: { en: 'Your name', pl: 'Imię i nazwisko' },
  },
  {
    key: 'namePh', label: 'Name placeholder', group: 'Message form', maxLength: 40,
    defaults: { en: 'Jane Skankowska', pl: 'Jan Skankowski' },
  },
  {
    key: 'email', label: 'Email label', group: 'Message form', maxLength: 40,
    defaults: { en: 'Email', pl: 'Email' },
  },
  {
    key: 'emailPh', label: 'Email placeholder', group: 'Message form', maxLength: 40,
    defaults: { en: 'you@email.com', pl: 'ty@email.com' },
  },
  {
    key: 'subject', label: 'Subject label', group: 'Message form', maxLength: 40,
    defaults: { en: 'Subject', pl: 'Temat' },
  },
  {
    key: 'subjectPh', label: 'Subject placeholder', group: 'Message form', maxLength: 60,
    defaults: { en: "What's on your mind?", pl: 'O czym chcesz napisać?' },
  },
  {
    key: 'message', label: 'Message label', group: 'Message form', maxLength: 40,
    defaults: { en: 'Message', pl: 'Wiadomość' },
  },
  {
    key: 'messagePh', label: 'Message placeholder', group: 'Message form', maxLength: 120,
    defaults: {
      en: 'Tell us everything — dates, venue, capacity, the lot.',
      pl: 'Napisz wszystko — daty, miejsce, pojemność sali, całość.',
    },
  },
  {
    key: 'send', label: '"Send" button', group: 'Message form', maxLength: 30,
    defaults: { en: 'Send message', pl: 'Wyślij wiadomość' },
  },
  {
    key: 'sending', label: 'Button while sending', group: 'Message form', maxLength: 30,
    defaults: { en: 'Sending…', pl: 'Wysyłanie…' },
  },
  {
    key: 'sent', label: 'Success message', group: 'Message form', maxLength: 160,
    defaults: {
      en: "Message sent — we'll be in touch within 48h. BIG UP!",
      pl: 'Wiadomość wysłana — odezwiemy się w 48h. BIG UP!',
    },
  },
  {
    key: 'sendAnother', label: '"Send another" button', group: 'Message form', maxLength: 30,
    defaults: { en: 'Send another', pl: 'Wyślij kolejną' },
  },
  {
    key: 'error', label: 'Validation error', group: 'Message form', maxLength: 160,
    defaults: {
      en: 'Please add your name, a valid email and a message.',
      pl: 'Podaj imię, poprawny email i treść wiadomości.',
    },
  },
  {
    key: 'bookingSubject', label: 'Subject prefilled from the calendar', group: 'Message form', maxLength: 80,
    help: '{date} is filled in with the chosen date.',
    defaults: { en: 'Booking request — {date}', pl: 'Zapytanie o termin — {date}' },
  },
  {
    key: 'bookingSubjectUnavailable', label: 'Subject prefilled for a taken date', group: 'Message form', maxLength: 120,
    help: '{date} is filled in with the chosen date.',
    defaults: {
      en: 'Booking request — {date} (we had this date marked busy)',
      pl: 'Zapytanie o termin — {date} (termin oznaczony jako zajęty)',
    },
  },

  // ── Direct channels ─────────────────────────────────────────────────
  {
    key: 'directTitle', label: 'Heading', group: 'Direct contact', maxLength: 60,
    defaults: { en: 'Reach us directly', pl: 'Napisz bezpośrednio' },
  },
  {
    key: 'booking', label: 'Booking label', group: 'Direct contact', maxLength: 30,
    defaults: { en: 'Booking', pl: 'Booking' },
  },
  {
    key: 'booking_note', label: 'Booking note', group: 'Direct contact', maxLength: 120,
    help: 'Caption under the booking email. Hidden if the profile has no booking address.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'press', label: 'Press label', group: 'Direct contact', maxLength: 30,
    defaults: { en: 'Press', pl: 'Prasa' },
  },
  {
    key: 'press_note', label: 'Press note', group: 'Direct contact', maxLength: 120,
    help: 'Caption under the press email.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'general', label: 'General label', group: 'Direct contact', maxLength: 30,
    defaults: { en: 'General', pl: 'Ogólny' },
  },
  {
    key: 'general_note', label: 'General note', group: 'Direct contact', maxLength: 120,
    help: 'Caption under the general contact email.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'follow', label: 'Social links label', group: 'Direct contact', maxLength: 40,
    defaults: { en: 'Or find us on', pl: 'Albo znajdź nas na' },
  },

  // ── Promoters & press ───────────────────────────────────────────────
  {
    key: 'promoTitle', label: 'Heading', group: 'Promoters & press', maxLength: 60,
    defaults: { en: 'Promoters & press', pl: 'Organizatorzy i prasa' },
  },
  {
    key: 'promoSub', label: 'Subtitle', group: 'Promoters & press', maxLength: 200,
    defaults: {
      en: 'Everything you need to put us on your stage — or your page.',
      pl: 'Wszystko, czego potrzebujesz, by zaprosić nas na scenę — lub na łamy.',
    },
  },
  {
    key: 'bookTitle', label: 'Book us: title', group: 'Promoters & press', maxLength: 60,
    help: 'Also the hero button that opens the availability calendar.',
    defaults: { en: 'Book us', pl: 'Zarezerwuj nas' },
  },
  {
    key: 'bookSub', label: 'Book us: subtitle', group: 'Promoters & press', maxLength: 120,
    defaults: { en: 'Check open dates and send a request.', pl: 'Sprawdź wolne terminy i wyślij zapytanie.' },
  },
  {
    key: 'bookCta', label: 'Book us: button', group: 'Promoters & press', maxLength: 40,
    defaults: { en: 'Check availability', pl: 'Sprawdź dostępność' },
  },
  {
    key: 'epkTitle', label: 'Press kit: title', group: 'Promoters & press', maxLength: 60,
    defaults: { en: 'Press kit (EPK)', pl: 'Press kit (EPK)' },
  },
  {
    key: 'epkSub', label: 'Press kit: subtitle', group: 'Promoters & press', maxLength: 120,
    defaults: {
      en: 'Bio, hi-res photos, logos & stats in one pack.',
      pl: 'Bio, zdjęcia hi-res, loga i statystyki w jednej paczce.',
    },
  },
  {
    key: 'epkCta', label: 'Press kit: button', group: 'Promoters & press', maxLength: 40,
    defaults: { en: 'Open EPK', pl: 'Otwórz EPK' },
  },
  {
    key: 'riderTitle', label: 'Tech rider: title', group: 'Promoters & press', maxLength: 60,
    defaults: { en: 'Tech rider', pl: 'Rider techniczny' },
  },
  {
    key: 'riderSub', label: 'Tech rider: subtitle', group: 'Promoters & press', maxLength: 120,
    defaults: {
      en: 'Stage plan, input list, monitors & hospitality.',
      pl: 'Plan sceny, lista wejść, monitory i hospitality.',
    },
  },
  {
    key: 'riderCta', label: 'Tech rider: button', group: 'Promoters & press', maxLength: 40,
    defaults: { en: 'View rider', pl: 'Podgląd ridera' },
  },
  {
    key: 'photosTitle', label: 'Press photos: title', group: 'Promoters & press', maxLength: 60,
    defaults: { en: 'Press photos', pl: 'Zdjęcia prasowe' },
  },
  {
    key: 'photosSub', label: 'Press photos: subtitle', group: 'Promoters & press', maxLength: 120,
    defaults: { en: 'Hi-res, print-ready shots in the gallery.', pl: 'Hi-res, gotowe do druku — w galerii.' },
  },
  {
    key: 'photosCta', label: 'Press photos: button', group: 'Promoters & press', maxLength: 40,
    defaults: { en: 'Open gallery', pl: 'Otwórz galerię' },
  },

  // ── Press kit modal ─────────────────────────────────────────────────
  {
    key: 'epkModalTitle', label: 'Title', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Press kit (EPK)', pl: 'Press kit (EPK)' },
  },
  {
    key: 'epkModalSubtitle', label: 'Subtitle', group: 'Press kit modal', maxLength: 160,
    defaults: {
      en: 'Everything press and promoters need, in one place.',
      pl: 'Wszystko, czego potrzebuje prasa i organizatorzy — w jednym miejscu.',
    },
  },
  {
    key: 'epkModalContents', label: '"What\'s inside" label', group: 'Press kit modal', maxLength: 40,
    defaults: { en: "What's inside", pl: 'Co w środku' },
  },
  {
    key: 'epkModalAll', label: '"Open the full press kit" link', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Open the full press kit', pl: 'Otwórz pełny press kit' },
  },
  {
    key: 'epkModalClose', label: '"Close" button', group: 'Press kit modal', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },
  {
    key: 'epkModalEmpty', label: 'Nothing published yet', group: 'Press kit modal', maxLength: 200,
    defaults: {
      en: "The press kit is still being put together — email us and we'll send what you need.",
      pl: 'Press kit jest w przygotowaniu — napisz do nas, a wyślemy, co potrzebujesz.',
    },
  },
  {
    key: 'epkBio', label: 'Bio row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Band bio', pl: 'Bio zespołu' },
  },
  {
    key: 'epkBioMeta', label: 'Bio row: caption', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Short, medium and long', pl: 'Krótkie, średnie i długie' },
  },
  {
    key: 'epkPhotos', label: 'Photos row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Press photos', pl: 'Zdjęcia prasowe' },
  },
  {
    key: 'epkPhotosMeta', label: 'Photos row: caption', group: 'Press kit modal', maxLength: 60,
    help: '{n} is filled in with the count.',
    defaults: { en: '{n} hi-res shots', pl: '{n} zdjęć hi-res' },
  },
  {
    key: 'epkLogo', label: 'Logo row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Logo', pl: 'Logo' },
  },
  {
    key: 'epkLogoMeta', label: 'Logo row: caption', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Full-colour, web and print', pl: 'Pełny kolor, web i druk' },
  },
  {
    key: 'epkStreaming', label: 'Streaming row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Streaming & stats', pl: 'Streaming i statystyki' },
  },
  {
    key: 'epkStreamingMeta', label: 'Streaming row: caption (platforms)', group: 'Press kit modal', maxLength: 60,
    help: '{n} is filled in with the platform count.',
    defaults: { en: '{n} platforms', pl: '{n} platform' },
  },
  {
    key: 'epkMonthlyMeta', label: 'Streaming row: caption (listeners)', group: 'Press kit modal', maxLength: 60,
    help: 'Used instead when monthly listeners are set. {n} is filled in.',
    defaults: { en: '{n} monthly listeners', pl: '{n} słuchaczy miesięcznie' },
  },
  {
    key: 'epkRider', label: 'Rider row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Tech rider', pl: 'Rider techniczny' },
  },
  {
    key: 'epkRiderMeta', label: 'Rider row: caption', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Stage plan & input list · PDF', pl: 'Plan sceny i lista wejść · PDF' },
  },
  {
    key: 'epkStagePlot', label: 'Stage plot row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Stage plot', pl: 'Plan sceny' },
  },
  {
    key: 'epkStagePlotMeta', label: 'Stage plot row: caption', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Backline & positions · PDF', pl: 'Backline i pozycje · PDF' },
  },

  // ── Availability modal ──────────────────────────────────────────────
  {
    key: 'calTitle', label: 'Title', group: 'Availability calendar', maxLength: 60,
    defaults: { en: 'Check our availability', pl: 'Sprawdź dostępność' },
  },
  {
    key: 'calSubtitle', label: 'Subtitle', group: 'Availability calendar', maxLength: 160,
    defaults: {
      en: "Pick a date and send a request — we'll reply within 48h.",
      pl: 'Wybierz termin i wyślij zapytanie — odpowiemy w 48h.',
    },
  },
  {
    key: 'calOpen', label: 'Legend: open', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'Open', pl: 'Wolne' },
  },
  {
    key: 'calBooked', label: 'Legend: booked', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'Booked', pl: 'Zajęte' },
  },
  {
    key: 'calHeld', label: 'Legend: on hold', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'On hold', pl: 'Rezerwacja' },
  },
  {
    key: 'calRequest', label: '"Request this date" button', group: 'Availability calendar', maxLength: 40,
    defaults: { en: 'Request this date', pl: 'Zapytaj o ten termin' },
  },
  {
    key: 'calPickPrompt', label: 'No date chosen yet', group: 'Availability calendar', maxLength: 40,
    defaults: { en: 'Select a date', pl: 'Wybierz termin' },
  },
  {
    key: 'calPrevMonth', label: '"Previous month" (screen readers)', group: 'Availability calendar', maxLength: 40,
    defaults: { en: 'Previous month', pl: 'Poprzedni miesiąc' },
  },
  {
    key: 'calNextMonth', label: '"Next month" (screen readers)', group: 'Availability calendar', maxLength: 40,
    defaults: { en: 'Next month', pl: 'Następny miesiąc' },
  },
  {
    key: 'calClose', label: '"Close" button', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'Close', pl: 'Zamknij' },
  },
  {
    key: 'calLoading', label: 'Loading text', group: 'Availability calendar', maxLength: 80,
    defaults: { en: 'Checking which dates are free…', pl: 'Sprawdzamy wolne terminy…' },
  },
  {
    key: 'calLoadError', label: 'Calendar failed to load', group: 'Availability calendar', type: 'textarea', maxLength: 300,
    defaults: {
      en: "We couldn't load the calendar just now — tell us your date in the contact form and we'll confirm by email.",
      pl: 'Nie udało się wczytać kalendarza — podaj termin w formularzu kontaktowym, a potwierdzimy mailem.',
    },
  },
  {
    key: 'calConfirmTitle', label: 'Taken date: title', group: 'Availability calendar', maxLength: 60,
    defaults: { en: 'That date looks taken', pl: 'Ten termin wygląda na zajęty' },
  },
  {
    key: 'calConfirmBody', label: 'Taken date: text', group: 'Availability calendar', type: 'textarea', maxLength: 300,
    help: '{date} is filled in.',
    defaults: {
      en: "We already have something on {date}. You're welcome to ask anyway — we'll reply either way, and plans do change.",
      pl: 'Mamy już coś zaplanowane na {date}. Możesz mimo to zapytać — odpowiemy tak czy inaczej, a plany czasem się zmieniają.',
    },
  },
  {
    key: 'calConfirmYes', label: 'Taken date: "ask anyway"', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'Ask anyway', pl: 'Zapytaj mimo to' },
  },
  {
    key: 'calConfirmNo', label: 'Taken date: "choose another"', group: 'Availability calendar', maxLength: 30,
    defaults: { en: 'Choose another', pl: 'Wybierz inny' },
  },
])

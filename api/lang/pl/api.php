<?php

return [
    'unauthenticated' => 'Nieuwierzytelniony.',
    'forbidden'       => 'Brak dostępu.',
    'not_found'       => 'Nie znaleziono.',
    'stale_admin'     => 'Panel administracyjny został zaktualizowany. Odśwież stronę i zapisz ponownie.',

    // A band member with no instrument and no role (BandMemberController).
    'member_needs_part' => 'Wybierz co najmniej jeden instrument albo wpisz rolę w zespole.',

    'highlight_draft' => 'Opublikuj wpis, zanim go wyróżnisz.',

    /* See the note in lang/en/api.php. */
    'fan' => [
        'ticket_not_active'      => 'Przekazać można tylko aktywne bilety.',
        'ticket_not_owned'       => 'Ten bilet nie należy do ciebie.',
        'transfer_to_self'       => 'Nie możesz przekazać biletu sobie.',
        'transfer_already_open'  => 'Ten bilet już czeka na odbiór przez inną osobę.',
        'session_expired'        => 'Twoja sesja wygasła. Zaloguj się ponownie.',
        'comments_disabled'      => 'Komentarze pod tym wpisem są wyłączone.',
        'comments_blocked'       => 'Nie możesz komentować na tej stronie.',
        'display_name_reserved'  => 'Ta nazwa jest zarezerwowana. Wybierz inną.',
        'comment_limit'          => 'Napisałeś dużo w krótkim czasie. Kolejny komentarz dodasz za minutę.|Napisałeś dużo w krótkim czasie. Kolejny komentarz dodasz za :count minuty.|Napisałeś dużo w krótkim czasie. Kolejny komentarz dodasz za :count minut.',
        'register_sent'         => 'Sprawdź skrzynkę: wysłaliśmy ci link kończący rejestrację.',
        'register_mail_failed'  => 'Nie udało się wysłać e-maila. Spróbuj ponownie.',
        'login_failed'           => 'Nieprawidłowy e-mail lub hasło.',
        'password_too_long'      => 'To hasło jest za długie. Użyj krótszego: najwyżej :max znaki, przy czym litery takie jak „ż” oraz emoji liczą się za dwa lub więcej.',
        'password_limit'         => 'Za dużo błędnych prób podania obecnego hasła. Spróbuj za kilka minut albo wyloguj się, zaloguj linkiem z e-maila i od razu ustaw nowe hasło.',
        'password_character'     => 'To hasło zawiera znak, którego nie można użyć.',
        'current_password_wrong' => 'Obecne hasło jest nieprawidłowe.',
        'password_mail_subject_set'     => 'Do twojego konta dodano hasło',
        'password_mail_subject_changed' => 'Twoje hasło zostało zmienione',
        'password_mail_set'     => 'Na twoim koncie fana ustawiono hasło, więc możesz logować się nim, a także linkiem z e-maila.',
        'password_mail_changed' => 'Hasło do twojego konta fana zostało zmienione.',
        'password_mail_unexpected' => 'Jeśli to nie ty, zaloguj się linkiem z e-maila, zmień hasło i daj znać zespołowi.',
        'login_limit'            => 'Za dużo nieudanych prób logowania. Spróbuj za kilka minut albo skorzystaj z linku w e-mailu.',
    ],
];

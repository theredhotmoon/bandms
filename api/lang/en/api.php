<?php

return [
    'unauthenticated' => 'Unauthenticated.',
    'forbidden'       => 'Forbidden.',
    'not_found'       => 'Not found.',

    /*
     * Messages a fan reads verbatim.
     *
     * The fan surfaces print `body.message` straight into the page, so an
     * English literal here is English on a Polish page. `SetLocale` resolves the
     * request locale from `?lang=` then `Accept-Language`, and the fan API now
     * sends the latter deliberately — so `__()` here is what that header buys.
     *
     * 409 "Already claimed." and 410 "Transfer expired." are deliberately not
     * listed: TicketClaimView maps those statuses to its own translated states
     * and never shows the server's text.
     */
    'fan' => [
        'ticket_not_active'      => 'Only active tickets can be transferred.',
        'ticket_not_owned'       => 'You do not own this ticket.',
        'transfer_to_self'       => 'You cannot transfer a ticket to yourself.',
        'transfer_already_open'  => 'A pending transfer already exists for this ticket.',
    ],
];

<?php

return [
    'unauthenticated' => 'Unauthenticated.',
    'forbidden'       => 'Forbidden.',
    'not_found'       => 'Not found.',

    // Shown by an admin tab still running a bundle older than the API it saves to.
    'stale_admin'     => 'The admin panel was updated. Reload the page and save again.',

    // A band member with no instrument and no role (BandMemberController).
    'member_needs_part' => "Pick at least one instrument or describe the member's role.",

    // A draft cannot be pinned to the top of the News page — it is not public.
    'highlight_draft' => 'Publish the post before highlighting it.',

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
        'session_expired'        => 'Your session has expired. Please sign in again.',
        'comments_disabled'      => 'Comments are closed for this post.',
        'comments_blocked'       => 'You cannot comment on this site.',
        'display_name_reserved'  => 'That name is reserved. Please choose another.',
        'comment_limit'          => 'You have posted a lot in a short time. You can comment again in a minute.|You have posted a lot in a short time. You can comment again in :count minutes.',
        'register_sent'         => 'Check your email: we sent you a link to finish signing up.',
        'register_mail_failed'  => 'We could not send the email. Please try again.',
        'login_failed'           => 'Email or password is incorrect.',
        'password_too_long'      => 'That password is too long. Use a shorter one: at most :max characters, where letters with accents and emoji count as two or more.',
        'password_limit'         => 'Too many wrong guesses at your current password. Try again in a few minutes, or sign out, sign in with an email link and set a new password right away.',
        'password_character'     => 'That password contains a character that cannot be used.',
        'current_password_wrong' => 'Your current password is incorrect.',
        'password_mail_subject_set'     => 'A password was added to your account',
        'password_mail_subject_changed' => 'Your password was changed',
        'password_mail_set'     => 'A password was set on your fan account, so you can now sign in with it as well as with an email link.',
        'password_mail_changed' => 'The password on your fan account was changed.',
        'password_mail_unexpected' => 'If this was not you, sign in with an email link and change your password, then tell the band.',
        'login_limit'            => 'Too many failed sign-in attempts. Try again in a few minutes, or use an email link.',
    ],
];

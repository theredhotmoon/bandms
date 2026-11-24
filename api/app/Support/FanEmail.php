<?php

namespace App\Support;

/**
 * The one definition of a fan's email address and of "the same address".
 *
 * MySQL is not it. `fan_accounts.email`, `orders.email` and
 * `tickets.holder_email` are utf8mb4_unicode_ci, where `á` equals `a` and a
 * control or zero-width character equals nothing — and `victim@gmáil.com` is
 * mailable to whoever owns that (punycode) domain. A fan session shows the
 * orders and tickets of its address, so a row the database calls equal counts
 * only when same() agrees.
 */
class FanEmail
{
    private const PRINTABLE_ASCII = '/^[\x21-\x7E]+$/D';

    /** For every route that takes an address to sign in with. */
    public static function rules(): array
    {
        return ['required', 'string', 'email', 'max:255', 'regex:' . self::PRINTABLE_ASCII];
    }

    /** Whether an account could have been made with this spelling (login asks this without a 422 of its own). */
    public static function isAllowed(string $email): bool
    {
        return preg_match(self::PRINTABLE_ASCII, $email) === 1;
    }

    /**
     * Trimmed and lowercased — ASCII letters only, deliberately not
     * mb_strtolower(): Unicode lowercasing folds the Kelvin sign into "k", and
     * two addresses that differ must stay different.
     */
    public static function normalise(string $email): string
    {
        return strtolower(trim($email));
    }

    /** Exactly the same address, whatever the capitals. A missing address is the same as nothing. */
    public static function same(?string $a, ?string $b): bool
    {
        if ($a === null || $b === null) {
            return false;
        }

        $a = self::normalise($a);

        return $a !== '' && $a === self::normalise($b);
    }
}

<?php

namespace App\Support;

use App\Models\FanAccount;
use Illuminate\Support\Str;

/**
 * The single-use sign-in token behind the emailed link: `fan_magic:{token}`.
 *
 * It holds a fan id and, for a registration, what must wait for the link to be
 * opened — the password hash and the hash of the browser's claim. A link mailed
 * before this existed holds a bare integer, which still reads as a plain link.
 */
class FanMagicToken
{
    public static function issue(FanAccount $fan, array $extra = [], int $minutes = 1440): string
    {
        $token = Str::random(64);

        cache()->put(self::key($token), [
            'fan_id'        => $fan->id,
            'method'        => $extra['method'] ?? 'link',
            'password_hash' => $extra['password_hash'] ?? null,
            'claim_hash'    => $extra['claim_hash'] ?? null,
            'identity'      => $extra['identity'] ?? null,
        ], now()->addMinutes($minutes));

        return $token;
    }

    /** Take the token's payload and delete it, so a second opening finds nothing. */
    public static function pull(string $token): ?array
    {
        $value = cache()->pull(self::key($token));

        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            $value = ['fan_id' => (int) $value];
        }
        if (! is_array($value) || ! isset($value['fan_id'])) {
            return null;
        }

        return [
            'fan_id'        => (int) $value['fan_id'],
            'method'        => $value['method'] ?? 'link',
            'password_hash' => $value['password_hash'] ?? null,
            'claim_hash'    => $value['claim_hash'] ?? null,
            'identity'      => $value['identity'] ?? null,
        ];
    }

    public static function forget(string $token): void
    {
        cache()->forget(self::key($token));
    }

    /** Whether the claim a browser presents is the one whose hash was sent with the registration. */
    public static function claimMatches(?string $claimHash, mixed $claim): bool
    {
        if ($claimHash === null || ! is_string($claim) || $claim === '') {
            return false;
        }

        return hash_equals($claimHash, hash('sha256', $claim));
    }

    private static function key(string $token): string
    {
        return "fan_magic:{$token}";
    }
}

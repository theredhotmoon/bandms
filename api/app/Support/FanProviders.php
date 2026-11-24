<?php

namespace App\Support;

/** Which social sign-in providers are switched on: those with both a client id and a secret. */
class FanProviders
{
    /** @return string[] in config order */
    public static function enabled(): array
    {
        return array_values(array_filter(
            array_keys(config('fan_auth.providers', [])),
            fn (string $p) => self::isEnabled($p),
        ));
    }

    public static function isEnabled(string $provider): bool
    {
        if (! array_key_exists($provider, config('fan_auth.providers', []))) {
            return false;
        }

        return self::filled(config("services.$provider.client_id"))
            && self::filled(config("services.$provider.client_secret"));
    }

    /** Whether the provider vouches for the address, so it may link to an existing account. */
    public static function trustsEmail(string $provider): bool
    {
        return (bool) config("fan_auth.providers.$provider.trust_email", false);
    }

    private static function filled(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}

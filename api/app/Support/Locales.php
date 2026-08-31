<?php

namespace App\Support;

/**
 * Read-only accessor over config/locales.php.
 *
 * Nothing outside this class should read `config('locales.*')` directly, so the
 * shape of that file stays changeable.
 */
final class Locales
{
    /** Registered locale codes, in declaration order. */
    public static function codes(): array
    {
        return array_keys(config('locales.supported', []));
    }

    public static function default(): string
    {
        return config('locales.default', 'en');
    }

    public static function isSupported(string $locale): bool
    {
        return in_array($locale, self::codes(), true);
    }

    /**
     * Ordered resolution chain for a locale: itself, then its declared
     * fallbacks. An unregistered locale starts from the default instead of
     * returning nothing, so a stray ?lang=de degrades to English rather than
     * baking a page of empty strings.
     */
    public static function chain(string $locale): array
    {
        $start = self::isSupported($locale) ? $locale : self::default();

        return array_values(array_unique(array_merge(
            [$start],
            config("locales.supported.{$start}.fallbacks", []),
        )));
    }

    /**
     * Flatten a {"en": ..., "pl": ...} bag to one string for a locale.
     *
     * Returns null when no locale in the chain has a value; callers that feed a
     * static build coerce that to '' themselves, so the choice stays visible at
     * the call site.
     */
    public static function resolve(array $translations, ?string $locale = null): ?string
    {
        foreach (self::chain($locale ?? app()->getLocale()) as $candidate) {
            if (filled($translations[$candidate] ?? null)) {
                return $translations[$candidate];
            }
        }

        return null;
    }

    /** Keys of a translation bag that are not registered locales. */
    public static function unsupportedKeys(array $bag): array
    {
        return array_values(array_diff(array_keys($bag), self::codes()));
    }

    /** Display metadata for every locale — the public shape served by site-config. */
    public static function all(): array
    {
        $default = self::default();

        return array_map(fn (string $code) => [
            'code'        => $code,
            'name'        => config("locales.supported.{$code}.name", $code),
            'native_name' => config("locales.supported.{$code}.native_name", $code),
            'html_lang'   => config("locales.supported.{$code}.html_lang", $code),
            'date_locale' => config("locales.supported.{$code}.date_locale", $code),
            'is_default'  => $code === $default,
        ], self::codes());
    }
}

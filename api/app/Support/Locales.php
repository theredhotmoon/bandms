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
    /**
     * Registered locale codes, in declaration order.
     *
     * Throws rather than degrading to []. An empty registry is silent and
     * expensive: WebsiteModuleController::update() generates its per-locale
     * rules from this list, so validate() would strip every custom_name,
     * custom_slug and settings key and each admin save would return 200 having
     * written nothing. Given the config-cache footgun in CLAUDE.md -- a stale
     * cache is exactly how this file goes missing at runtime -- a loud failure
     * is the safer default.
     */
    public static function codes(): array
    {
        $codes = array_keys(config('locales.supported', []));

        if ($codes === []) {
            throw new \LogicException(
                'No locales registered. config/locales.php is missing or empty '
                . '-- if it was just added, the container needs a rebuild, not a restart.',
            );
        }

        return $codes;
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

        // Fallbacks are filtered to registered locales, matching the TypeScript
        // mirror. A locale removed from `supported` but left behind in another
        // locale's `fallbacks` (or a typo) would otherwise resolve text stored
        // under that dead key -- exactly the "German visitor sees Polish" case
        // the declared chain exists to prevent -- and the two sides of the
        // mirror would then disagree about a half-translated field.
        $fallbacks = array_filter(
            config("locales.supported.{$start}.fallbacks", []),
            self::isSupported(...),
        );

        return array_values(array_unique(array_merge([$start], $fallbacks)));
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

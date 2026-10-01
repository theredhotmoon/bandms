<?php

namespace App\Support;

use App\Models\SiteSetting;

/**
 * The band's content-language order: which language they write in first.
 *
 * This is a different question from Locales::default(). The default locale is
 * what the public site serves at `x-default` and falls back to; the content
 * order is the band's authoring habit. A Polish band writes Polish and
 * translates to English, but may still want English as the site default for
 * foreign bookers -- so the two are deliberately separate settings.
 *
 * The order drives the admin only: field order in every translated input group,
 * which language's field is required, and which title a slug is generated from.
 * Nothing on the public site reads it, so changing it needs no rebuild.
 *
 * Stored as a JSON list in site_settings. Which languages EXIST is still the
 * registry's job; this only orders them.
 */
final class ContentLocales
{
    public const SETTING_KEY = 'content_locale_order';

    /**
     * Every registered locale, in the band's preferred order.
     *
     * Always a permutation of Locales::codes(), whatever the row holds:
     * a code no longer registered is dropped, and a code registered after the
     * order was saved is appended in registry order. Without the append, adding
     * a third language would leave it missing from every admin form until
     * someone re-saved the setting -- the form would simply have no input for it.
     */
    public static function order(): array
    {
        $stored = json_decode((string) SiteSetting::get(self::SETTING_KEY, '[]'), true);

        return self::normalise(is_array($stored) ? $stored : []);
    }

    /** The language a band writes in first -- the one whose fields are required. */
    public static function primary(): string
    {
        return self::order()[0];
    }

    /** @param  list<string>  $order  a permutation of Locales::codes() (validated by the caller) */
    public static function set(array $order): void
    {
        SiteSetting::set(self::SETTING_KEY, json_encode(array_values($order)));
    }

    /**
     * First non-blank value of a translation bag, walking the content order.
     *
     * Used where one string has to stand for the whole bag -- the source a slug
     * is generated from. It used to be `$bag['en'] ?? reset($bag)`, which for a
     * Polish-only title found `en => null`, fell through to reset() -- also that
     * null -- and generated the slug `post`, then `post-2`, `post-3`...
     *
     * `$prefer` is tried before the content order: the slug_en column should be
     * built from the English title whenever one exists, whichever language the
     * band writes first, and only borrow another language's title when English
     * is blank.
     */
    public static function firstFilled(array $bag, ?string $prefer = null): ?string
    {
        $chain = array_unique(array_merge($prefer !== null ? [$prefer] : [], self::order()));

        foreach ($chain as $code) {
            $value = $bag[$code] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return null;
    }

    /** @return list<string> */
    public static function normalise(array $stored): array
    {
        $codes = Locales::codes();

        $kept = array_values(array_unique(array_filter(
            $stored,
            fn ($code) => is_string($code) && in_array($code, $codes, true),
        )));

        return array_values(array_merge($kept, array_diff($codes, $kept)));
    }
}

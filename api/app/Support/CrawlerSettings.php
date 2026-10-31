<?php

namespace App\Support;

use App\Models\BandProfile;
use App\Models\SiteSetting;

/**
 * The crawler's settings: one JSON row in site_settings, normalised on every
 * read so a stale or partial value never breaks a run — unknown countries are
 * dropped, caps are held to each provider's free tier, a missing source is
 * filled from the defaults. Keys never live here; they stay in env
 * (config/services.php), and `keyMissing()` says which source lacks one.
 */
final class CrawlerSettings
{
    public const SETTING_KEY = 'assistant_crawler';

    /** The ska map the band chose (Oct 2026). */
    public const DEFAULT_COUNTRIES = ['PL', 'DE', 'CZ', 'SK', 'LT', 'GB', 'NL', 'ES', 'IT', 'US', 'MX', 'JP', 'BR'];

    /**
     * Each source: default on/off, default caps, and the ceiling a cap may be
     * raised to — the provider's free tier, so a typo cannot open a bill.
     * Days are Europe/Warsaw days (CapLedger).
     */
    public const SOURCES = [
        'google_cse' => ['enabled' => true,  'cap_day' => 80,  'max_day' => 100],
        'youtube'    => ['enabled' => true,  'cap_day' => 20,  'max_day' => 50],
        'setlistfm'  => ['enabled' => true,  'cap_day' => 40,  'max_day' => 1000],
        'places'     => ['enabled' => true,  'cap_day' => 30,  'max_day' => 100, 'cap_month' => 900, 'max_month' => 1000],
        'meta_own'   => ['enabled' => true,  'cap_day' => 5,   'max_day' => 50],
        'reddit'     => ['enabled' => false, 'cap_day' => 20,  'max_day' => 100],
        'rss'        => ['enabled' => true,  'cap_day' => 30,  'max_day' => 100],
    ];

    /** Which config keys each source needs; empty = needs none. */
    private const KEYS = [
        'google_cse' => ['services.google.api_key', 'services.google.cse_id'],
        'youtube'    => ['services.youtube.api_key'],
        'setlistfm'  => ['services.setlistfm.api_key'],
        'places'     => ['services.google.api_key'],
        'meta_own'   => ['services.facebook.page_access_token', 'services.facebook.page_id'],
        'reddit'     => ['services.reddit.client_id', 'services.reddit.client_secret'],
        'rss'        => [],
    ];

    /** @return array<string, mixed> */
    public static function get(): array
    {
        $stored = json_decode((string) SiteSetting::get(self::SETTING_KEY, '{}'), true);

        return self::normalise(is_array($stored) ? $stored : []);
    }

    /** Merge the given (already validated) input over the current settings and store. */
    public static function set(array $input): array
    {
        $next = self::normalise(array_replace(self::get(), $input));
        SiteSetting::set(self::SETTING_KEY, json_encode($next));

        return $next;
    }

    public static function keyMissing(string $source): bool
    {
        foreach (self::KEYS[$source] ?? [] as $key) {
            if ((string) config($key, '') === '') {
                return true;
            }
        }

        return false;
    }

    /** @return string[] ISO codes the crawler can search */
    public static function knownCountries(): array
    {
        return array_keys(config('countries', []));
    }

    /** @return array<string, mixed> */
    private static function normalise(array $s): array
    {
        $known = self::knownCountries();

        $countries = array_key_exists('countries', $s) && is_array($s['countries'])
            ? array_values(array_unique(array_filter(
                array_map(fn ($c) => is_string($c) ? $c : '', $s['countries']),
                fn ($c) => in_array($c, $known, true),
            )))
            : self::DEFAULT_COUNTRIES;

        $sources = [];
        foreach (self::SOURCES as $key => $def) {
            $given = is_array($s['sources'][$key] ?? null) ? $s['sources'][$key] : [];
            $entry = [
                'enabled' => (bool) ($given['enabled'] ?? $def['enabled']),
                'cap_day' => self::clamp($given['cap_day'] ?? $def['cap_day'], $def['max_day']),
            ];
            if (isset($def['cap_month'])) {
                $entry['cap_month'] = self::clamp($given['cap_month'] ?? $def['cap_month'], $def['max_month']);
            }
            $sources[$key] = $entry;
        }

        $strings = fn ($v, int $max) => is_array($v)
            ? array_values(array_slice(array_filter($v, fn ($x) => is_string($x) && trim($x) !== ''), 0, $max))
            : [];

        $cities = [];
        foreach ((is_array($s['cities_by_country'] ?? null) ? $s['cities_by_country'] : []) as $code => $list) {
            if (in_array($code, $known, true)) {
                $cities[$code] = $strings($list, 10);
            }
        }

        $bandName = BandProfile::query()->value('name');

        return [
            'keywords'          => $strings($s['keywords'] ?? null, 20) ?: array_values(array_filter([$bandName ?: null])),
            'countries'         => $countries,
            'cities_by_country' => $cities,
            'sources'           => $sources,
            'rss_feeds'         => $strings($s['rss_feeds'] ?? null, 20),
            'sibling_bands'     => array_values(array_filter(
                is_array($s['sibling_bands'] ?? null) ? $s['sibling_bands'] : [],
                fn ($b) => is_array($b) && is_string($b['mbid'] ?? null) && is_string($b['name'] ?? null),
            )),
            'digest_to'         => $strings($s['digest_to'] ?? null, 10),
        ];
    }

    private static function clamp(mixed $value, int $max): int
    {
        return max(0, min($max, (int) $value));
    }
}

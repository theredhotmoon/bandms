<?php

namespace App\Support;

use App\Models\SiteSetting;

/**
 * The welcome screen's configuration — one JSON row in site_settings, clamped
 * on every read so a hand-edited or stale row can never reach the build
 * out of bounds.
 *
 * `campaign` is a timestamp the admin stamps to make every visitor see the
 * screen again; it is never writable through save().
 */
final class WelcomeSettings
{
    public const SETTING_KEY = 'welcome_screen';

    public const BLOCKS = ['concerts', 'news', 'newsletter', 'account'];

    public const DEFAULTS = [
        'blocks'        => ['concerts', 'news', 'newsletter', 'account'],
        'concert_count' => 2,
        'frequency'     => 'interval',
        'reshow_days'   => 90,
        'campaign'      => 0,
        'geo'           => ['enabled' => false, 'radius_km' => 100, 'far_visitors' => 'hide_gigs'],
    ];

    public static function get(): array
    {
        $stored = json_decode((string) SiteSetting::get(self::SETTING_KEY, ''), true);

        return self::normalise(is_array($stored) ? $stored : []);
    }

    /** Same shape as get(); named for what the build reads. */
    public static function forBuild(): array
    {
        return self::get();
    }

    /** Saves everything but `campaign`, which only stampCampaign() moves. */
    public static function save(array $data): array
    {
        $data['campaign'] = self::get()['campaign'];
        self::store(self::normalise($data));

        return self::get();
    }

    public static function stampCampaign(): int
    {
        $settings = self::get();
        $settings['campaign'] = time();
        self::store($settings);

        return $settings['campaign'];
    }

    /**
     * Put the campaign back to a known value — for e2e:set-welcome-campaign
     * only, so a spec that stamped one leaves the row as it found it. The
     * admin has no route to this; PUT still never moves the campaign.
     */
    public static function setCampaign(int $campaign): int
    {
        $settings = self::get();
        $settings['campaign'] = max(0, $campaign);
        self::store($settings);

        return $settings['campaign'];
    }

    private static function store(array $settings): void
    {
        SiteSetting::set(self::SETTING_KEY, json_encode($settings));
    }

    private static function normalise(array $in): array
    {
        $d = self::DEFAULTS;
        $geo = is_array($in['geo'] ?? null) ? $in['geo'] : [];

        $blocks = array_key_exists('blocks', $in) && is_array($in['blocks'])
            ? array_values(array_unique(array_filter($in['blocks'], fn ($b) => is_string($b) && in_array($b, self::BLOCKS, true))))
            : $d['blocks'];

        return [
            'blocks'        => $blocks,
            'concert_count' => self::clamp($in['concert_count'] ?? null, 1, 3, $d['concert_count']),
            'frequency'     => in_array($in['frequency'] ?? null, ['interval', 'once'], true) ? $in['frequency'] : $d['frequency'],
            'reshow_days'   => self::clamp($in['reshow_days'] ?? null, 1, 365, $d['reshow_days']),
            'campaign'      => is_int($in['campaign'] ?? null) && $in['campaign'] >= 0 ? $in['campaign'] : 0,
            'geo'           => [
                'enabled'      => ($geo['enabled'] ?? null) === true,
                'radius_km'    => self::clamp($geo['radius_km'] ?? null, 10, 1000, $d['geo']['radius_km']),
                'far_visitors' => in_array($geo['far_visitors'] ?? null, ['hide_gigs', 'no_screen'], true)
                    ? $geo['far_visitors'] : $d['geo']['far_visitors'],
            ],
        ];
    }

    /** Out-of-range numbers clamp to the nearest bound; non-numbers take the default. */
    private static function clamp(mixed $value, int $min, int $max, int $default): int
    {
        return is_int($value) ? max($min, min($max, $value)) : $default;
    }
}

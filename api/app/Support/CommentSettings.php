<?php

namespace App\Support;

use App\Models\FanAccount;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\RateLimiter;

/**
 * How many comments one fan may post in a period — the band's own setting,
 * edited on the admin's Comments page and stored as one JSON row in
 * site_settings.
 *
 * Counted per fan account, not per IP: the route's `throttle` is keyed on the
 * visitor's address, which a shared connection trips for everyone and a
 * roaming phone walks around. Nothing on the public site is baked from this,
 * so changing it needs no rebuild.
 */
final class CommentSettings
{
    public const SETTING_KEY = 'comment_limit';

    public const MAX_COMMENTS = 100;
    public const MAX_MINUTES = 1440;

    /** @return array{max: int, minutes: int} always within bounds, whatever the row holds */
    public static function limit(): array
    {
        $stored = json_decode((string) SiteSetting::get(self::SETTING_KEY, ''), true);
        $default = config('comments.default_limit');

        return [
            'max'     => self::clamp($stored['max'] ?? null, $default['max'], self::MAX_COMMENTS),
            'minutes' => self::clamp($stored['minutes'] ?? null, $default['minutes'], self::MAX_MINUTES),
        ];
    }

    public static function setLimit(int $max, int $minutes): void
    {
        SiteSetting::set(self::SETTING_KEY, json_encode(['max' => $max, 'minutes' => $minutes]));
    }

    /** True when this fan has used up the period's allowance. */
    public static function exhausted(FanAccount $fan): bool
    {
        return RateLimiter::tooManyAttempts(self::key($fan), self::limit()['max']);
    }

    /** Counts one posted comment against the fan's allowance. */
    public static function count(FanAccount $fan): void
    {
        RateLimiter::hit(self::key($fan), self::limit()['minutes'] * 60);
    }

    /** Whole minutes until the fan may comment again, at least one. */
    public static function minutesLeft(FanAccount $fan): int
    {
        return max(1, (int) ceil(RateLimiter::availableIn(self::key($fan)) / 60));
    }

    private static function key(FanAccount $fan): string
    {
        return "fan-comments:{$fan->id}";
    }

    private static function clamp(mixed $value, int $default, int $ceiling): int
    {
        return is_int($value) && $value >= 1 && $value <= $ceiling ? $value : $default;
    }
}

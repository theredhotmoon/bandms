<?php

namespace App\Assistant\Crawler;

use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Support\Carbon;

/**
 * How many queries a source may still spend: its day cap minus what runs
 * spent today, and — for a source with a monthly free tier (Places) — its
 * month cap minus what runs spent this month, whichever is smaller. Days and
 * months are Pacific time's, because that is when Google's and YouTube's free
 * quotas reset: counted on the band's Warsaw clock, a run at 03:00 and a
 * manual one the evening before could fall in one Pacific day and spend the
 * cap twice. A manual run spends only what is left, never a fresh day.
 */
final class CapLedger
{
    public const TZ = 'America/Los_Angeles';

    public static function remaining(string $source): int
    {
        $settings = CrawlerSettings::get()['sources'][$source] ?? null;
        if ($settings === null) {
            return 0;
        }

        $now   = Carbon::now(self::TZ);
        $left  = $settings['cap_day'] - self::spentSince($source, $now->copy()->startOfDay());
        if (isset($settings['cap_month'])) {
            $left = min($left, $settings['cap_month'] - self::spentSince($source, $now->copy()->startOfMonth()));
        }

        return max(0, $left);
    }

    private static function spentSince(string $source, Carbon $since): int
    {
        return (int) AssistantRun::query()
            ->where('source', $source)
            ->where('started_at', '>=', $since->copy()->utc())
            ->sum('queries');
    }
}

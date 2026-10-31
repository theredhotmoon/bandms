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

    /** @param array|null $settings CrawlerSettings::get(), when the caller already has it */
    public static function remaining(string $source, ?array $settings = null): int
    {
        return self::remainingAll($settings, $source)[$source] ?? 0;
    }

    /**
     * Every source's remaining budget in two grouped reads — the status bar
     * asks for all of them at once, and per-source sums were ~5 queries each.
     *
     * @return array<string, int>
     */
    public static function remainingAll(?array $settings = null, ?string $only = null): array
    {
        $now     = Carbon::now(self::TZ);
        $today   = self::spentSince($now->copy()->startOfDay(), $only);
        $month   = self::spentSince($now->copy()->startOfMonth(), $only);
        $left    = [];
        $sources = ($settings ?? CrawlerSettings::get())['sources'];
        if ($only !== null) {
            $sources = array_intersect_key($sources, [$only => true]);
        }

        foreach ($sources as $source => $settings) {
            $budget = $settings['cap_day'] - ($today[$source] ?? 0);
            if (isset($settings['cap_month'])) {
                $budget = min($budget, $settings['cap_month'] - ($month[$source] ?? 0));
            }
            $left[$source] = max(0, $budget);
        }

        return $left;
    }

    /** @return array<string, int> queries spent per source since the given moment */
    private static function spentSince(Carbon $since, ?string $only = null): array
    {
        return AssistantRun::query()
            ->when($only, fn ($q) => $q->where('source', $only))
            ->where('started_at', '>=', $since->copy()->utc())
            ->selectRaw('source, sum(queries) as spent')->groupBy('source')
            ->pluck('spent', 'source')->map(fn ($n) => (int) $n)->all();
    }
}

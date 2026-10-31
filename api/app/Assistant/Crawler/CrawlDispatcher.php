<?php

namespace App\Assistant\Crawler;

use App\Models\AssistantRun;
use App\Support\CrawlerSettings;

/**
 * Queues one CrawlSourceJob per source that may run — enabled in the
 * settings and with its key in env. The nightly command and the inbox's
 * Run now both come through here; the jobs check the caps themselves, so
 * dispatching twice spends nothing twice.
 */
final class CrawlDispatcher
{
    public function __construct(private readonly SourceRegistry $registry) {}

    /**
     * @param  string|null  $only  one registered source key, or null for all
     * @return array{queued: list<string>, skipped: array<string, string>}
     */
    public function dispatch(?string $only = null): array
    {
        $all      = CrawlerSettings::get();
        $settings = $all['sources'];
        $queued   = [];
        $skipped  = [];

        foreach ($only !== null ? [$only] : $this->registry->keys() as $key) {
            if (!($settings[$key]['enabled'] ?? false)) {
                $skipped[$key] = 'disabled';
            } elseif (CrawlerSettings::keyMissing($key)) {
                $skipped[$key] = 'no key';
            } elseif (!$this->registry->get($key)?->enabled($all)) {
                $skipped[$key] = 'nothing to search'; // no cities, feeds or sibling bands yet
            } elseif ($this->running($key)) {
                $skipped[$key] = 'already running'; // the job's overlap lock would drop it silently
            } else {
                CrawlSourceJob::dispatch($key);
                $queued[] = $key;
            }
        }

        return ['queued' => $queued, 'skipped' => $skipped];
    }

    /** A run of this source started in the last 30 minutes and has not finished. */
    private function running(string $key): bool
    {
        return AssistantRun::query()
            ->where('source', $key)
            ->whereNull('finished_at')
            ->where('started_at', '>=', now()->subMinutes(30))
            ->exists();
    }
}

<?php

namespace App\Assistant\Crawler;

/**
 * One place the crawler looks — a named API or feed, never a scraper. Adding
 * a source is one class registered in SourceRegistry and one entry in
 * CrawlerSettings::SOURCES; the run job, caps and inbox need no change.
 */
interface Source
{
    /** Matches the key in CrawlerSettings::SOURCES and assistant_runs.source. */
    public function key(): string;

    /** Whether it can run at all with these settings (keys are checked by the job). */
    public function enabled(array $settings): bool;

    /**
     * The queries one run would ask, most valuable first — the day cap cuts
     * from the end.
     *
     * @return iterable<Query>
     */
    public function queries(array $settings): iterable;

    /**
     * One query's findings. Throws SourceCapped when the provider says its
     * quota is spent (the run ends `capped`); anything else ends it `failed`.
     *
     * @return Finding[]
     */
    public function fetch(Query $query): array;
}

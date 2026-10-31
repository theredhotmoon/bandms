<?php

namespace App\Console\Commands;

use App\Assistant\Crawler\CrawlSourceJob;
use App\Assistant\Crawler\SourceRegistry;
use App\Support\CrawlerSettings;
use Illuminate\Console\Command;

/**
 * Dispatches one CrawlSourceJob per enabled source with its key present — the
 * nightly schedule and the admin's "Run now" both come through here. The jobs
 * themselves check the day caps, so running this twice spends nothing twice.
 */
class AssistantCrawl extends Command
{
    protected $signature = 'assistant:crawl {--source= : Run only this source}';

    protected $description = "Crawl the assistant's sources for mentions, news and leads";

    public function handle(SourceRegistry $registry): int
    {
        $only = $this->option('source');
        if ($only !== null && !in_array($only, $registry->keys(), true)) {
            $this->error("Unknown source: {$only}. Known: " . implode(', ', $registry->keys()));

            return self::FAILURE;
        }

        $settings = CrawlerSettings::get()['sources'];
        foreach ($only !== null ? [$only] : $registry->keys() as $key) {
            if (!($settings[$key]['enabled'] ?? false)) {
                $this->line("skip {$key}: disabled");
                continue;
            }
            if (CrawlerSettings::keyMissing($key)) {
                $this->line("skip {$key}: no key configured");
                continue;
            }
            CrawlSourceJob::dispatch($key);
            $this->info("queued {$key}");
        }

        return self::SUCCESS;
    }
}

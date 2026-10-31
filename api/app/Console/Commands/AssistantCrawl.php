<?php

namespace App\Console\Commands;

use App\Assistant\Crawler\CrawlDispatcher;
use App\Assistant\Crawler\SourceRegistry;
use Illuminate\Console\Command;

/**
 * The nightly crawl (and `--source=` by hand): one CrawlSourceJob per source
 * that may run. The inbox's Run now goes through the same CrawlDispatcher.
 */
class AssistantCrawl extends Command
{
    protected $signature = 'assistant:crawl {--source= : Run only this source}';

    protected $description = "Crawl the assistant's sources for mentions, news and leads";

    public function handle(SourceRegistry $registry, CrawlDispatcher $dispatcher): int
    {
        $only = $this->option('source');
        if ($only !== null && !in_array($only, $registry->keys(), true)) {
            $this->error("Unknown source: {$only}. Known: " . implode(', ', $registry->keys()));

            return self::FAILURE;
        }

        $result = $dispatcher->dispatch($only);
        foreach ($result['skipped'] as $key => $why) {
            $this->line("skip {$key}: {$why}");
        }
        foreach ($result['queued'] as $key) {
            $this->info("queued {$key}");
        }

        return self::SUCCESS;
    }
}

<?php

namespace App\Assistant\Crawler;

use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;

/**
 * One source's crawl. Spends queries only while CapLedger allows, upserts
 * findings by (source, external_key) without touching their status, and
 * always leaves an assistant_runs row: ok, capped (cap reached, or the
 * provider said its quota is spent) or failed (with the error). A failure
 * keeps what was found before it — and is a row, never a silence.
 */
final class CrawlSourceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 2;
    // 80 queries at up to 15 s each is 20 minutes in the worst case; the
    // overlap lock outlives it, and failed() closes the run if the worker
    // kills the job anyway.
    public int $timeout = 1500;

    public function __construct(public readonly string $sourceKey) {}

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("assistant-crawl:{$this->sourceKey}"))->expireAfter(1800)->dontRelease()];
    }

    public function handle(SourceRegistry $registry): void
    {
        $source   = $registry->get($this->sourceKey);
        $settings = CrawlerSettings::get();
        if (!$source
            || !($settings['sources'][$this->sourceKey]['enabled'] ?? false)
            || CrawlerSettings::keyMissing($this->sourceKey)
            || !$source->enabled($settings)
        ) {
            return;
        }

        $run = AssistantRun::create(['source' => $this->sourceKey, 'started_at' => now(), 'status' => 'ok']);
        $budget = CapLedger::remaining($this->sourceKey);
        $queries = 0;
        $found = 0;
        $new = 0;

        try {
            foreach ($source->queries($settings) as $query) {
                if ($queries >= $budget) {
                    $run->status = 'capped';
                    break;
                }
                $queries++;
                $run->update(['queries' => $queries]); // the ledger counts spend as it happens

                try {
                    $findings = $source->fetch($query);
                } catch (SourceCapped $e) {
                    $run->status = 'capped';
                    $run->error  = mb_substr($e->getMessage(), 0, 500);
                    break;
                }

                foreach ($findings as $finding) {
                    $found++;
                    $new += $this->upsert($finding) ? 1 : 0;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('assistant.crawl.failed', ['source' => $this->sourceKey, 'error' => $e->getMessage()]);
            $run->status = 'failed';
            $run->error  = mb_substr($e::class . ': ' . $e->getMessage(), 0, 1000);
        }

        $run->fill(['queries' => $queries, 'found' => $found, 'new' => $new, 'finished_at' => now()])->save();
    }

    /**
     * The worker gave up (timeout, or an error outside handle()'s own catch):
     * close the run that was left open, so the status bar never shows a
     * killed crawl as ok.
     */
    public function failed(\Throwable $e): void
    {
        AssistantRun::query()
            ->where('source', $this->sourceKey)
            ->whereNull('finished_at')
            ->update([
                'status'      => 'failed',
                'finished_at' => now(),
                'error'       => mb_substr($e::class . ': ' . $e->getMessage(), 0, 1000),
            ]);
    }

    /** @return bool whether the finding is new */
    private function upsert(Finding $f): bool
    {
        $existing = AssistantFinding::query()
            ->where('source', $this->sourceKey)
            ->where('external_key', $f->externalKey)
            ->first();

        $text = [
            'url'     => $f->url,
            'title'   => mb_substr($f->title, 0, 500),
            'snippet' => mb_substr($f->snippet, 0, 500),
            'payload' => $f->payload,
        ];

        if ($existing) {
            // Only the text is refreshed. Status, score and triage are the
            // band's and triage's; kind stays what it was first found as (a
            // mention found again by a country query is still a mention); a
            // country or lead type is filled in only where it was unknown.
            $existing->update($text + array_filter([
                'country'   => $existing->country === null ? $f->country : null,
                'lead_type' => $existing->lead_type === null ? $f->leadType : null,
            ], fn ($v) => $v !== null));

            return false;
        }

        AssistantFinding::create($text + [
            'kind'         => $f->kind,
            'country'      => $f->country,
            'lead_type'    => $f->leadType,
            'source'       => $this->sourceKey,
            'external_key' => mb_substr($f->externalKey, 0, 255),
            'found_at'     => now(),
        ]);

        return true;
    }
}

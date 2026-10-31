<?php

use App\Assistant\Crawler\CrawlSourceJob;
use App\Assistant\Crawler\SourceRegistry;
use App\Support\CrawlerSettings;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Queue;

// The crawler runs on its own: a nightly crawl, triage after it, a Monday
// digest — on the band's clock, never two at once.

function scheduled(string $command): ?\Illuminate\Console\Scheduling\Event
{
    // bootstrap/app.php's withSchedule() runs when the console app starts.
    \Illuminate\Support\Facades\Artisan::all();

    return collect(app(Schedule::class)->events())
        ->first(fn ($e) => str_contains((string) $e->command, $command));
}

it('schedules the nightly crawl at 03:00 Warsaw time, without overlap', function () {
    $crawl = scheduled('assistant:crawl');

    expect($crawl)->not->toBeNull()
        ->and($crawl->timezone)->toBe('Europe/Warsaw')
        ->and($crawl->withoutOverlapping)->toBeTrue()
        ->and($crawl->expression)->toBe('0 3 * * *');
});

it('schedules triage after the crawl and the digest on Monday morning', function () {
    expect(scheduled('assistant:triage')->expression)->toBe('40 3 * * *')
        ->and(scheduled('assistant:digest')->expression)->toBe('0 8 * * 1')
        ->and(scheduled('assistant:digest')->timezone)->toBe('Europe/Warsaw');
});

it('dispatches one job per enabled source, or only the one asked for', function () {
    Queue::fake();
    config(['services.google.api_key' => 'g', 'services.google.cse_id' => 'c', 'services.youtube.api_key' => 'y']);

    $this->artisan('assistant:crawl')->assertSuccessful();
    $keys = collect(Queue::pushed(CrawlSourceJob::class))->map(fn ($j) => $j->sourceKey)->sort()->values()->all();
    expect($keys)->toContain('google_cse')->toContain('youtube');

    Queue::fake();
    $this->artisan('assistant:crawl', ['--source' => 'youtube'])->assertSuccessful();
    Queue::assertPushed(CrawlSourceJob::class, 1);
    Queue::assertPushed(CrawlSourceJob::class, fn ($j) => $j->sourceKey === 'youtube');
});

it('skips a disabled source and refuses an unknown one', function () {
    Queue::fake();
    CrawlerSettings::set(['sources' => ['youtube' => ['enabled' => false]]]);

    $this->artisan('assistant:crawl')->assertSuccessful();
    Queue::assertNotPushed(CrawlSourceJob::class, fn ($j) => $j->sourceKey === 'youtube');

    $this->artisan('assistant:crawl', ['--source' => 'myspace'])->assertFailed();
});

it('registers the slice-1 sources', function () {
    expect(app(SourceRegistry::class)->keys())->toContain('google_cse')->toContain('youtube');
});

it('does not crawl on a stack whose schedule is switched off', function () {
    config(['assistant.crawler_scheduled' => false]);

    expect(scheduled('assistant:crawl')->filtersPass(app()))->toBeFalse();

    config(['assistant.crawler_scheduled' => true]);
    expect(scheduled('assistant:crawl')->filtersPass(app()))->toBeTrue();
});

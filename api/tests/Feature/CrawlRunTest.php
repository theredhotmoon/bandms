<?php

use App\Assistant\Crawler\CapLedger;
use App\Assistant\Crawler\CrawlSourceJob;
use App\Assistant\Crawler\Finding;
use App\Assistant\Crawler\Query;
use App\Assistant\Crawler\Source;
use App\Assistant\Crawler\SourceCapped;
use App\Assistant\Crawler\SourceRegistry;
use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;

// One source's crawl: spend its queries under the day cap, upsert what it
// finds, and leave an assistant_runs row that says how it ended.

final class FakeSource implements Source
{
    /** @var array<string, Finding[]|\Throwable> query text => findings or error */
    public static array $answers = [];
    public static array $asked = [];

    public function key(): string { return 'rss'; }

    public function enabled(array $settings): bool { return true; }

    public function queries(array $settings): iterable
    {
        foreach (array_keys(self::$answers) as $text) {
            yield new Query($text);
        }
    }

    public function fetch(Query $q): array
    {
        self::$asked[] = $q->text;
        $a = self::$answers[$q->text];
        if ($a instanceof \Throwable) {
            throw $a;
        }

        return $a;
    }
}

function fakeFinding(string $key, string $kind = 'news'): Finding
{
    return new Finding(kind: $kind, externalKey: $key, url: "https://x.test/{$key}", title: "Title {$key}", snippet: 'Snippet', country: 'PL', leadType: null, payload: ['k' => $key]);
}

beforeEach(function () {
    FakeSource::$answers = [];
    FakeSource::$asked   = [];
    app()->instance(SourceRegistry::class, new SourceRegistry([new FakeSource()]));
});

it('upserts what a source finds and records an ok run', function () {
    FakeSource::$answers = ['q1' => [fakeFinding('a'), fakeFinding('b')], 'q2' => [fakeFinding('b'), fakeFinding('c')]];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    expect(AssistantFinding::count())->toBe(3);
    $run = AssistantRun::sole();
    expect($run)->status->toBe('ok')->queries->toBe(2)->found->toBe(4)->new->toBe(3)
        ->and($run->finished_at)->not->toBeNull();
});

it('keeps a dismissed finding dismissed when it is found again', function () {
    AssistantFinding::factory()->dismissed()->create(['source' => 'rss', 'external_key' => 'a', 'title' => 'Old']);
    FakeSource::$answers = ['q1' => [fakeFinding('a')]];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    $f = AssistantFinding::sole();
    expect($f->status)->toBe('dismissed')->and($f->title)->toBe('Title a');
});

it('stops at the day cap, records the run as capped, and a later run spends only the remainder', function () {
    CrawlerSettings::set(['sources' => ['rss' => ['enabled' => true, 'cap_day' => 3]]]);
    FakeSource::$answers = ['q1' => [], 'q2' => [], 'q3' => [], 'q4' => [], 'q5' => []];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));
    expect(FakeSource::$asked)->toBe(['q1', 'q2', 'q3'])
        ->and(AssistantRun::latest('id')->first()->status)->toBe('capped');

    FakeSource::$asked = [];
    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));
    expect(FakeSource::$asked)->toBe([])
        ->and(CapLedger::remaining('rss'))->toBe(0);
});

it('treats a provider saying "quota" as capped, not failed', function () {
    FakeSource::$answers = ['q1' => [fakeFinding('a')], 'q2' => new SourceCapped('daily limit'), 'q3' => [fakeFinding('c')]];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    expect(AssistantRun::sole()->status)->toBe('capped')
        ->and(FakeSource::$asked)->toBe(['q1', 'q2'])
        ->and(AssistantFinding::count())->toBe(1);
});

it('records a failure as a failed run with the error, keeping what it found before', function () {
    FakeSource::$answers = ['q1' => [fakeFinding('a')], 'q2' => new \RuntimeException('provider exploded')];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    $run = AssistantRun::sole();
    expect($run->status)->toBe('failed')
        ->and($run->error)->toContain('provider exploded')
        ->and(AssistantFinding::count())->toBe(1);
});

it('does nothing for a disabled source or one without its key', function () {
    CrawlerSettings::set(['sources' => ['rss' => ['enabled' => false]]]);
    FakeSource::$answers = ['q1' => [fakeFinding('a')]];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    expect(AssistantRun::count())->toBe(0)->and(FakeSource::$asked)->toBe([]);
});

it('counts a month cap across days', function () {
    CrawlerSettings::set(['sources' => ['places' => ['enabled' => true, 'cap_day' => 50, 'cap_month' => 10]]]);
    AssistantRun::create(['source' => 'places', 'started_at' => now(CapLedger::TZ)->startOfMonth()->addHour()->utc(), 'status' => 'ok', 'queries' => 8]);

    expect(CapLedger::remaining('places'))->toBe(2);
});

it('counts the day in Pacific time, when Google and YouTube reset their free quotas', function () {
    CrawlerSettings::set(['sources' => ['rss' => ['enabled' => true, 'cap_day' => 5]]]);
    // 15:30 on 1 Nov in California — and in Warsaw, 00:30 on 2 Nov: a new
    // Warsaw day, but the same quota day, so nothing is left.
    AssistantRun::create(['source' => 'rss', 'started_at' => \Carbon\Carbon::parse('2026-11-01 23:30', 'UTC'), 'status' => 'ok', 'queries' => 5]);

    $this->travelTo(\Carbon\Carbon::parse('2026-11-02 00:30', 'UTC'));
    expect(CapLedger::remaining('rss'))->toBe(0);

    $this->travelTo(\Carbon\Carbon::parse('2026-11-02 08:30', 'UTC')); // 00:30 on 2 Nov in California
    expect(CapLedger::remaining('rss'))->toBe(5);
});

it('keeps the kind, country and lead type a finding already has when it is found again', function () {
    AssistantFinding::factory()->create([
        'source' => 'rss', 'external_key' => 'a', 'kind' => 'mention', 'country' => null, 'lead_type' => 'venue',
    ]);
    FakeSource::$answers = ['q1' => [fakeFinding('a', 'lead')]];

    (new CrawlSourceJob('rss'))->handle(app(SourceRegistry::class));

    $f = AssistantFinding::sole();
    expect($f->kind)->toBe('mention')       // first seen as a mention: stays in Mentions
        ->and($f->lead_type)->toBe('venue') // triage's call, not reset to null
        ->and($f->country)->toBe('PL')      // was unknown: filled in
        ->and($f->title)->toBe('Title a');  // the text itself is refreshed
});

it('marks a run failed when the worker gives up on the job', function () {
    $run = AssistantRun::create(['source' => 'rss', 'started_at' => now(), 'status' => 'ok', 'queries' => 7]);

    (new CrawlSourceJob('rss'))->failed(new \RuntimeException('job timed out'));

    expect($run->fresh())->status->toBe('failed')->queries->toBe(7)
        ->and($run->fresh()->finished_at)->not->toBeNull()
        ->and($run->fresh()->error)->toContain('timed out');
});

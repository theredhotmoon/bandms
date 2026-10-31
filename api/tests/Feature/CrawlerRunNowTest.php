<?php

use App\Assistant\Crawler\CrawlSourceJob;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Support\Facades\Queue;

// "Run now" in the inbox, and what the status bar is told about each source:
// its last run, what is left of today's cap, and whether it keeps failing.

beforeEach(function () {
    Queue::fake();
    config(['services.google.api_key' => 'g', 'services.google.cse_id' => 'c', 'services.youtube.api_key' => 'y']);
});

it('queues one job per enabled source with its key, and says what it skipped', function () {
    $this->actingAsAdmin();

    $res = $this->postJson('/api/admin/assistant/run')->assertStatus(202);

    expect($res->json('data.queued'))->toContain('google_cse')->toContain('youtube')
        ->and($res->json('data.skipped.reddit'))->toBe('disabled')
        ->and($res->json('data.skipped.setlistfm'))->toBe('no key');
    Queue::assertPushed(CrawlSourceJob::class, fn ($j) => $j->sourceKey === 'youtube');
});

it('runs only the source asked for, and refuses an unknown one', function () {
    $this->actingAsAdmin();

    $this->postJson('/api/admin/assistant/run', ['source' => 'youtube'])->assertStatus(202)
        ->assertJsonPath('data.queued', ['youtube']);
    Queue::assertPushed(CrawlSourceJob::class, 1);

    $this->postJson('/api/admin/assistant/run', ['source' => 'myspace'])->assertStatus(422);
});

it('keeps Run now to admins and to two presses a minute', function () {
    $this->actingAsUser();
    $this->postJson('/api/admin/assistant/run')->assertForbidden();

    $this->actingAsAdmin();
    $this->postJson('/api/admin/assistant/run', ['source' => 'youtube'])->assertStatus(202);
    $this->postJson('/api/admin/assistant/run', ['source' => 'youtube'])->assertStatus(202);
    $this->postJson('/api/admin/assistant/run', ['source' => 'youtube'])->assertStatus(429);
});

it('reports what is left of today\'s cap and how many runs in a row failed', function () {
    $this->actingAsAdmin();
    CrawlerSettings::set(['sources' => ['youtube' => ['enabled' => true, 'cap_day' => 20]]]);
    AssistantRun::create(['source' => 'youtube', 'started_at' => now()->subDays(4), 'status' => 'ok', 'queries' => 1]);
    foreach ([3, 2, 1] as $d) {
        AssistantRun::create(['source' => 'youtube', 'started_at' => now()->subDays($d), 'status' => 'failed', 'error' => 'boom']);
    }
    AssistantRun::create(['source' => 'google_cse', 'started_at' => now()->subDay(), 'status' => 'failed']);
    AssistantRun::create(['source' => 'google_cse', 'started_at' => now(), 'status' => 'ok', 'queries' => 30]);

    $runs = collect($this->getJson('/api/admin/assistant/runs')->assertOk()->json('data'))->keyBy('source');

    expect($runs['youtube']['failing_runs'])->toBe(3)
        ->and($runs['youtube']['remaining'])->toBe(20)
        ->and($runs['google_cse']['failing_runs'])->toBe(0)
        ->and($runs['google_cse']['remaining'])->toBe(50);
});

it('skips a source with nothing to search, or one already running, instead of claiming it queued', function () {
    $this->actingAsAdmin();
    config(['services.setlistfm.api_key' => 's']);
    CrawlerSettings::set(['sibling_bands' => []]);
    AssistantRun::create(['source' => 'youtube', 'started_at' => now()->subMinutes(5), 'status' => 'ok']);

    $res = $this->postJson('/api/admin/assistant/run')->assertStatus(202);

    expect($res->json('data.skipped.setlistfm'))->toBe('nothing to search')
        ->and($res->json('data.skipped.youtube'))->toBe('already running')
        ->and($res->json('data.queued'))->toContain('google_cse');
});

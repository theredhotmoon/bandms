<?php

use App\Models\AssistantFinding;
use App\Models\AssistantRun;

// The dashboard widget's numbers: what is new in the inbox, when the crawler
// last finished, and how many sources failed their last run.

it('counts new findings by kind, the last finished run and failing sources', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->lead()->count(3)->create();
    AssistantFinding::factory()->create(['kind' => 'mention']);
    AssistantFinding::factory()->lead()->dismissed()->create();
    AssistantRun::create(['source' => 'youtube', 'started_at' => now()->subHours(3), 'finished_at' => now()->subHours(2), 'status' => 'ok']);
    AssistantRun::create(['source' => 'rss', 'started_at' => now()->subHour(), 'finished_at' => now()->subMinutes(50), 'status' => 'failed']);

    $data = $this->getJson('/api/admin/assistant/summary')->assertOk()->json('data');

    expect($data['new'])->toBe(['lead' => 3, 'mention' => 1, 'news' => 0])
        ->and($data['failing_sources'])->toBe(1)
        ->and($data['last_run_at'])->not->toBeNull();
});

it('answers zeros before the first crawl', function () {
    $this->actingAsAdmin();

    $data = $this->getJson('/api/admin/assistant/summary')->assertOk()->json('data');

    expect($data)->toBe(['new' => ['lead' => 0, 'mention' => 0, 'news' => 0], 'last_run_at' => null, 'failing_sources' => 0]);
});

it('keeps the summary to admins', function () {
    $this->actingAsUser();
    $this->getJson('/api/admin/assistant/summary')->assertForbidden();
});

it('leaves out what triage ruled out — known, duplicate or irrelevant', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->lead()->create(['triaged_at' => now(), 'score' => 60]);
    AssistantFinding::factory()->lead()->create();                                        // not triaged yet: counts
    AssistantFinding::factory()->lead()->create(['triaged_at' => now(), 'score' => 0]);  // ruled out

    expect($this->getJson('/api/admin/assistant/summary')->json('data.new.lead'))->toBe(2);
});

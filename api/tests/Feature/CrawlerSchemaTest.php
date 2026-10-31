<?php

use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Models\Author;
use App\Models\Band;
use App\Models\Venue;

// The crawler's tables and the lead columns it saves into. A worldwide
// crawler groups by country, so a saved venue or band must keep one.

it('stores a finding with its triage and payload as arrays', function () {
    $f = AssistantFinding::factory()->lead()->create([
        'triage'  => ['relevant' => true, 'summary' => 'A ska club'],
        'payload' => ['raw' => 1],
        'country' => 'DE',
    ]);

    expect($f->fresh())
        ->kind->toBe('lead')
        ->status->toBe('new')
        ->score->toBe(0)
        ->triage->toBe(['relevant' => true, 'summary' => 'A ska club'])
        ->payload->toBe(['raw' => 1]);
});

it('keeps one finding per source and external key', function () {
    AssistantFinding::factory()->create(['source' => 'google_cse', 'external_key' => 'abc']);

    expect(fn () => AssistantFinding::factory()->create(['source' => 'google_cse', 'external_key' => 'abc']))
        ->toThrow(\Illuminate\Database\QueryException::class);
});

it('filters findings by kind, country and status', function () {
    AssistantFinding::factory()->lead()->create(['country' => 'DE']);
    AssistantFinding::factory()->create(['kind' => 'news', 'country' => 'PL']);
    AssistantFinding::factory()->dismissed()->create(['kind' => 'lead', 'country' => 'DE']);

    expect(AssistantFinding::kind('lead')->country('DE')->status('new')->count())->toBe(1);
});

it('records a run per source', function () {
    $run = AssistantRun::create(['source' => 'youtube', 'started_at' => now(), 'status' => 'ok', 'queries' => 3, 'found' => 5, 'new' => 2]);

    expect($run->fresh())->queries->toBe(3)->status->toBe('ok');
});

it('gives venues, bands and authors a source marker and venues/bands a country', function () {
    $venue  = Venue::factory()->create(['country' => 'DE', 'website' => 'https://club.example', 'source' => 'assistant:1']);
    $band   = Band::create(['name' => 'Skatalites Tribute', 'kind' => 'festival', 'country' => 'JP', 'source' => 'assistant:2']);
    $author = Author::create(['first_name' => 'Ska Zine', 'source' => 'assistant:3']);

    expect($venue->fresh())->country->toBe('DE')->website->toBe('https://club.example')->source->toBe('assistant:1')
        ->and($band->fresh())->kind->toBe('festival')->country->toBe('JP')
        ->and($author->fresh()->source)->toBe('assistant:3');
});

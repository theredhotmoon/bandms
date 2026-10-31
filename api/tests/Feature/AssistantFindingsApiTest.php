<?php

use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Models\User;
use Laravel\Passport\Passport;

// The inbox: list, filter, dismiss. Admin-only — the findings name venues,
// people and outlets the band might contact.

it('refuses anonymous users and non-admins', function () {
    $this->getJson('/api/admin/assistant/findings')->assertUnauthorized();

    Passport::actingAs(User::factory()->create(['role' => 'member']));
    $this->getJson('/api/admin/assistant/findings')->assertForbidden();
});

it('lists new findings newest first, filtered by kind and country, with country counts', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->lead()->create(['country' => 'DE', 'title' => 'Old club', 'found_at' => now()->subDay()]);
    AssistantFinding::factory()->lead()->create(['country' => 'DE', 'title' => 'New club', 'found_at' => now()]);
    AssistantFinding::factory()->lead()->create(['country' => 'JP', 'title' => 'Tokyo club']);
    AssistantFinding::factory()->create(['kind' => 'news', 'country' => 'DE']);
    AssistantFinding::factory()->lead()->dismissed()->create(['country' => 'DE']);

    $res = $this->getJson('/api/admin/assistant/findings?kind=lead&country=DE')->assertOk();

    expect($res->json('data.*.title'))->toBe(['New club', 'Old club'])
        ->and($res->json('meta.countries'))->toBe(['DE' => 2, 'JP' => 1])
        ->and($res->json('meta.kinds'))->toMatchArray(['lead' => 2, 'news' => 1]); // within the country filter, like the list
});

it('shows dismissed findings only when asked', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->dismissed()->create(['title' => 'Gone']);

    expect($this->getJson('/api/admin/assistant/findings')->json('data'))->toBe([])
        ->and($this->getJson('/api/admin/assistant/findings?status=dismissed')->json('data.0.title'))->toBe('Gone');
});

it('searches the title and snippet', function () {
    $this->actingAsAdmin();
    AssistantFinding::factory()->create(['title' => 'Skanking Storks in Berlin']);
    AssistantFinding::factory()->create(['title' => 'Something else']);

    expect($this->getJson('/api/admin/assistant/findings?q=storks')->json('data.*.title'))->toBe(['Skanking Storks in Berlin']);
});

it('dismisses and restores a finding, and refuses any other status here', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create();

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed'])->assertOk()->assertJsonPath('data.status', 'dismissed');
    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'new'])->assertOk()->assertJsonPath('data.status', 'new');
    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'saved'])->assertStatus(422);
});

it('reports the last run of each source', function () {
    $this->actingAsAdmin();
    AssistantRun::create(['source' => 'youtube', 'started_at' => now()->subDay(), 'status' => 'ok', 'queries' => 1]);
    AssistantRun::create(['source' => 'youtube', 'started_at' => now(), 'status' => 'failed', 'error' => 'boom']);
    AssistantRun::create(['source' => 'google_cse', 'started_at' => now(), 'status' => 'capped', 'queries' => 80]);

    $runs = collect($this->getJson('/api/admin/assistant/runs')->assertOk()->json('data'))->keyBy('source');

    expect($runs['youtube']['status'])->toBe('failed')->and($runs['youtube']['error'])->toBe('boom')
        ->and($runs['google_cse']['status'])->toBe('capped');
});

it('refuses to move a saved finding by hand', function () {
    $this->actingAsAdmin();
    $f = AssistantFinding::factory()->create(['status' => 'saved', 'saved_type' => 'venue', 'saved_id' => 1]);

    $this->patchJson("/api/admin/assistant/findings/{$f->id}", ['status' => 'dismissed'])->assertStatus(422);
    expect($f->fresh()->status)->toBe('saved');
});

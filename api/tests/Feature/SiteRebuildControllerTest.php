<?php

use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('includes autoRebuild and pendingAreas in the status response', function () {
    Http::fake(['http://web:3001/status' => Http::response(['status' => 'idle'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);
    SiteDirtyArea::markDirty('concerts');

    $this->getJson('/api/admin/site/rebuild/status')
        ->assertOk()
        ->assertJsonPath('autoRebuild', true)
        ->assertJsonPath('pendingAreas.0.area', 'concerts');
});

it('includes autoRebuild and pendingAreas even when the status webhook is unreachable', function () {
    Http::fake(['http://web:3001/status' => Http::response(null, 500)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->getJson('/api/admin/site/rebuild/status')
        ->assertOk()
        ->assertJsonPath('status', 'unknown')
        ->assertJsonPath('autoRebuild', false)
        ->assertJsonPath('pendingAreas', []);
});

it('clears pending areas when a manual rebuild is triggered', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    $this->postJson('/api/admin/site/rebuild')->assertOk();

    expect(SiteDirtyArea::count())->toBe(0);
});

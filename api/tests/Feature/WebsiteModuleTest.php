<?php

use App\Models\SiteSetting;
use App\Models\User;
use App\Models\WebsiteModule;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ── site-config (public) ──────────────────────────────────────────────────────

it('returns enabled module map on site-config', function () {
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true,  'sort_order' => 1]);
    WebsiteModule::create(['slug' => 'videos',   'display_name' => 'Videos',   'enabled' => false, 'sort_order' => 2]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('modules.concerts', true)
        ->assertJsonPath('modules.videos', false);
});

it('returns empty modules map when no modules seeded', function () {
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('modules', []);
});

// ── admin/modules (auth required) ─────────────────────────────────────────────

it('requires auth to list modules', function () {
    $this->getJson('/api/admin/modules')->assertUnauthorized();
});

it('returns all modules and auto_rebuild for admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('auto_rebuild', false);
});

it('defaults auto_rebuild to false when setting missing', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonPath('auto_rebuild', false);
});

// ── PUT /api/admin/modules/{slug} ─────────────────────────────────────────────

it('requires auth to update a module', function () {
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertUnauthorized();
});

it('toggles a module enabled state', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])
        ->assertOk()
        ->assertJsonPath('data.slug', 'concerts')
        ->assertJsonPath('data.enabled', false);

    expect(WebsiteModule::where('slug', 'concerts')->value('enabled'))->toBeFalse();
});

it('returns 404 for unknown module slug', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->putJson('/api/admin/modules/nonexistent', ['enabled' => false])->assertNotFound();
});

it('triggers rebuild when auto_rebuild is true', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});

it('does not trigger rebuild when auto_rebuild is false', function () {
    Http::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    Http::assertNothingSent();
});

// ── PUT /api/admin/site/settings ──────────────────────────────────────────────

it('updates auto_rebuild setting', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->putJson('/api/admin/site/settings', ['auto_rebuild' => true])
        ->assertOk()
        ->assertJsonPath('auto_rebuild', true);

    expect(SiteSetting::get('auto_rebuild'))->toBe('true');
});

// ── POST /api/admin/site/rebuild ──────────────────────────────────────────────

it('triggers rebuild on demand', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->postJson('/api/admin/site/rebuild')
        ->assertOk()
        ->assertJsonPath('status', 'rebuild_started');

    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});

it('requires auth to trigger rebuild', function () {
    $this->postJson('/api/admin/site/rebuild')->assertUnauthorized();
});

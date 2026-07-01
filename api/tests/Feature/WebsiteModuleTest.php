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

it('returns module_order sorted by sort_order on site-config', function () {
    WebsiteModule::create(['slug' => 'releases', 'display_name' => 'Releases', 'enabled' => true, 'sort_order' => 0]);
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    WebsiteModule::create(['slug' => 'news',     'display_name' => 'News',     'enabled' => true, 'sort_order' => 2]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_order.0', 'releases')
        ->assertJsonPath('module_order.1', 'concerts')
        ->assertJsonPath('module_order.2', 'news');
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

// ── Role-authorization (non-admin authenticated users) ───────────────────────

it('forbids a non-admin from listing modules', function () {
    $member = User::factory()->create(['role' => 'member']);
    Passport::actingAs($member);

    $this->getJson('/api/admin/modules')->assertForbidden();
});

it('forbids a non-admin from updating a module', function () {
    $member = User::factory()->create(['role' => 'member']);
    Passport::actingAs($member);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertForbidden();
});

it('forbids a non-admin from triggering rebuild', function () {
    $member = User::factory()->create(['role' => 'member']);
    Passport::actingAs($member);

    $this->postJson('/api/admin/site/rebuild')->assertForbidden();
});

it('forbids a non-admin from reading rebuild status', function () {
    $member = User::factory()->create(['role' => 'member']);
    Passport::actingAs($member);

    $this->getJson('/api/admin/site/rebuild/status')->assertForbidden();
});

// ── GET /api/admin/site/rebuild/status ────────────────────────────────────────

it('returns rebuild status from webhook', function () {
    Http::fake(['http://web:3001/status' => Http::response(['status' => 'idle', 'startedAt' => null, 'finishedAt' => null], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->getJson('/api/admin/site/rebuild/status')
        ->assertOk()
        ->assertJsonPath('status', 'idle');
});

it('requires auth for rebuild status', function () {
    $this->getJson('/api/admin/site/rebuild/status')->assertUnauthorized();
});

// ── PUT /api/admin/modules/reorder ────────────────────────────────────────────

it('reorders modules by the given slug array', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 0]);
    WebsiteModule::create(['slug' => 'releases', 'display_name' => 'Releases', 'enabled' => true, 'sort_order' => 1]);
    WebsiteModule::create(['slug' => 'news',     'display_name' => 'News',     'enabled' => true, 'sort_order' => 2]);

    $this->putJson('/api/admin/modules/reorder', [
        'slugs' => ['news', 'concerts', 'releases'],
    ])->assertOk()
      ->assertJsonPath('data.0.slug', 'news')
      ->assertJsonPath('data.1.slug', 'concerts')
      ->assertJsonPath('data.2.slug', 'releases');

    $this->assertDatabaseHas('website_modules', ['slug' => 'news',     'sort_order' => 0]);
    $this->assertDatabaseHas('website_modules', ['slug' => 'concerts', 'sort_order' => 1]);
    $this->assertDatabaseHas('website_modules', ['slug' => 'releases', 'sort_order' => 2]);
});

it('requires auth to reorder modules', function () {
    $this->putJson('/api/admin/modules/reorder', ['slugs' => []])->assertUnauthorized();
});

it('forbids non-admin from reordering modules', function () {
    Passport::actingAs(User::factory()->create(['role' => 'member']));

    $this->putJson('/api/admin/modules/reorder', ['slugs' => []])->assertForbidden();
});

// ── custom_name + per_page ────────────────────────────────────────────────────

it('returns custom_name and per_page in admin module list', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1, 'per_page' => 12]);
    $module->setTranslations('custom_name', ['en' => 'Merch', 'pl' => 'Sklep']);
    $module->save();

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonPath('data.0.custom_name.en', 'Merch')
        ->assertJsonPath('data.0.custom_name.pl', 'Sklep')
        ->assertJsonPath('data.0.per_page', 12);
});

it('saves custom_name translations', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/shop', [
        'custom_name' => ['en' => 'Merch', 'pl' => 'Sklep'],
    ])
        ->assertOk()
        ->assertJsonPath('data.custom_name.en', 'Merch')
        ->assertJsonPath('data.custom_name.pl', 'Sklep');

    $module = WebsiteModule::where('slug', 'shop')->first();
    expect($module->getTranslation('custom_name', 'en'))->toBe('Merch');
    expect($module->getTranslation('custom_name', 'pl'))->toBe('Sklep');
});

it('saves per_page', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', ['per_page' => 12])
        ->assertOk()
        ->assertJsonPath('data.per_page', 12);

    expect(WebsiteModule::where('slug', 'news')->value('per_page'))->toBe(12);
});

it('clears per_page when null is sent', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1, 'per_page' => 10]);

    $this->putJson('/api/admin/modules/news', ['per_page' => null])
        ->assertOk()
        ->assertJsonPath('data.per_page', null);

    expect(WebsiteModule::where('slug', 'news')->value('per_page'))->toBeNull();
});

it('rejects invalid per_page value', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', ['per_page' => 7])->assertUnprocessable();
});

it('rejects custom_name.en exceeding 80 characters', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', [
        'custom_name' => ['en' => str_repeat('a', 81)],
    ])->assertUnprocessable();
});

it('allows enabled update alongside custom_name', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', [
        'enabled'     => false,
        'custom_name' => ['en' => 'Gigs'],
    ])
        ->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.custom_name.en', 'Gigs');
});

it('clears custom_name when null values sent', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_name', ['en' => 'Merch', 'pl' => 'Sklep']);
    $module->save();

    $this->putJson('/api/admin/modules/shop', [
        'custom_name' => ['en' => null, 'pl' => null],
    ])
        ->assertOk()
        ->assertJsonPath('data.custom_name.en', null)
        ->assertJsonPath('data.custom_name.pl', null);
});

// ── site-config module_config ─────────────────────────────────────────────────

it('returns module_config with label from custom_name', function () {
    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_name', ['en' => 'Merch']);
    $module->save();

    $this->getJson('/api/site-config?lang=en')
        ->assertOk()
        ->assertJsonPath('module_config.shop.label', 'Merch');
});

it('falls back to display_name when custom_name absent', function () {
    WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    $this->getJson('/api/site-config?lang=en')
        ->assertOk()
        ->assertJsonPath('module_config.shop.label', 'Shop');
});

it('returns per_page in module_config', function () {
    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1, 'per_page' => 12]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.news.per_page', 12);
});

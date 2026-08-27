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

// `contact` is registered by 2026_08_26_000001_add_contact_website_module, so it
// is present in every freshly migrated database — including this test one. Tests
// below that count rows have to account for that baseline, which as of
// 2026-08-27 is two rows: contact and about, both added by migration.
it('returns the baseline modules when nothing else is registered', function () {
    $this->getJson('/api/site-config')
        ->assertOk()
        // Keyed in sort_order, so contact (11) comes before about (12).
        ->assertJsonPath('modules', ['contact' => true, 'about' => true]);
});

it('registers contact as a configurable module with a Polish name', function () {
    $contact = WebsiteModule::where('slug', 'contact')->first();

    expect($contact)->not->toBeNull();
    expect($contact->display_name)->toBe('Contact');
    expect($contact->enabled)->toBeTrue();
    expect($contact->getTranslation('custom_name', 'pl'))->toBe('Kontakt');
});

it('reports contact as disabled on site-config once it is switched off', function () {
    WebsiteModule::where('slug', 'contact')->update(['enabled' => false]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('modules.contact', false);
});

it('exposes the contact label on site-config so the public slug can follow it', function () {
    $contact = WebsiteModule::where('slug', 'contact')->first();
    $contact->setTranslations('custom_name', ['en' => 'Get in touch', 'pl' => 'Kontakt']);
    $contact->save();

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.contact.label', 'Get in touch');
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

    // concerts, then the two migrated baseline modules in sort_order:
    // contact (11) before about (12).
    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.slug', 'concerts')
        ->assertJsonPath('data.1.slug', 'contact')
        ->assertJsonPath('data.2.slug', 'about')
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

    $fresh = WebsiteModule::where('slug', 'shop')->first();
    expect($fresh->getTranslation('custom_name', 'en', false))->toEqual('');
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

it('returns pl label when lang=pl requested', function () {
    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_name', ['en' => 'Merch', 'pl' => 'Sklep']);
    $module->save();

    $this->getJson('/api/site-config?lang=pl')
        ->assertOk()
        ->assertJsonPath('module_config.shop.label', 'Sklep');
});

it('returns per_page in module_config', function () {
    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1, 'per_page' => 12]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.news.per_page', 12);
});

// ── custom_slug (per-locale URL slugs) ───────────────────────────────────────

it('backfills a module slug from its label so no existing URL moves', function () {
    // Only migration-created rows exist here — seeder modules like merch are
    // absent — so contact carries this test. It is the right one to carry it:
    // its PL label "Kontakt" derives to "kontakt", which is what the live site
    // serves, and writing the module key instead would move /pl/kontakt.
    $contact = WebsiteModule::where('slug', 'contact')->first();

    expect($contact->getTranslation('custom_slug', 'en'))->toBe('contact');
    expect($contact->getTranslation('custom_slug', 'pl'))->toBe('kontakt');
});

it('exposes the per-locale slug on site-config', function () {
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.contact.slug', 'contact');

    $this->getJson('/api/site-config?lang=pl')
        ->assertOk()
        ->assertJsonPath('module_config.contact.slug', 'kontakt');
});

it('falls back to the module key when no slug is stored', function () {
    WebsiteModule::create(['slug' => 'videos', 'display_name' => 'Clips', 'enabled' => true, 'sort_order' => 3]);

    // Label is "Clips" but the slug must stay /videos — renaming no longer moves it.
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.videos.label', 'Clips')
        ->assertJsonPath('module_config.videos.slug', 'videos');
});

it('returns custom_slug in the admin module list', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonPath('data.0.custom_slug.en', 'contact')
        ->assertJsonPath('data.0.custom_slug.pl', 'kontakt');
});

it('saves per-locale slugs', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/merch', [
        'custom_slug' => ['en' => 'store', 'pl' => 'sklep'],
    ])
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', 'store')
        ->assertJsonPath('data.custom_slug.pl', 'sklep');

    $module = WebsiteModule::where('slug', 'merch')->first();
    expect($module->getTranslation('custom_slug', 'pl'))->toBe('sklep');
});

it('clears a slug back to the module key when null is sent', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $module = WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_slug', ['en' => 'store', 'pl' => 'sklep']);
    $module->save();

    $this->putJson('/api/admin/modules/merch', ['custom_slug' => ['en' => null, 'pl' => null]])
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', null);

    $this->getJson('/api/site-config')->assertJsonPath('module_config.merch.slug', 'merch');
});

it('rejects a slug that is not URL-safe', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    foreach (['Sklep', 'na sklep', 'sklep/', '-sklep', 'sklep-', 'skl--ep', 'sklép'] as $bad) {
        $this->putJson('/api/admin/modules/merch', ['custom_slug' => ['en' => $bad]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('custom_slug.en');
    }
});

it('rejects a slug already used by another module in the same locale', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $releases = WebsiteModule::create(['slug' => 'releases', 'display_name' => 'Releases', 'enabled' => true, 'sort_order' => 1]);
    $releases->setTranslations('custom_slug', ['en' => 'music']);
    $releases->save();

    WebsiteModule::create(['slug' => 'press', 'display_name' => 'Press', 'enabled' => true, 'sort_order' => 2]);

    $this->putJson('/api/admin/modules/press', ['custom_slug' => ['en' => 'music']])
        ->assertStatus(422)
        ->assertJsonValidationErrors('custom_slug.en');
});

it('rejects a slug colliding with another module key that has no slug of its own', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    // videos stores no slug, so it is served at /videos by fallback. Claiming
    // "videos" from another module would shadow it with nothing to warn you.
    WebsiteModule::create(['slug' => 'videos', 'display_name' => 'Videos', 'enabled' => true, 'sort_order' => 1]);
    WebsiteModule::create(['slug' => 'press',  'display_name' => 'Press',  'enabled' => true, 'sort_order' => 2]);

    $this->putJson('/api/admin/modules/press', ['custom_slug' => ['en' => 'videos']])
        ->assertStatus(422)
        ->assertJsonValidationErrors('custom_slug.en');
});

it('allows the same slug in different locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $releases = WebsiteModule::create(['slug' => 'releases', 'display_name' => 'Releases', 'enabled' => true, 'sort_order' => 1]);
    $releases->setTranslations('custom_slug', ['en' => 'music']);
    $releases->save();

    WebsiteModule::create(['slug' => 'press', 'display_name' => 'Press', 'enabled' => true, 'sort_order' => 2]);

    // "music" is taken in EN but free in PL.
    $this->putJson('/api/admin/modules/press', ['custom_slug' => ['pl' => 'music']])->assertOk();
});

it('lets a module keep its own slug on an unrelated update', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $merch = WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $merch->setTranslations('custom_slug', ['en' => 'shop']);
    $merch->save();

    // Re-sending its own slug must not trip the uniqueness rule against itself.
    $payload = ['custom_slug' => ['en' => 'shop'], 'enabled' => false];

    $this->putJson('/api/admin/modules/merch', $payload)
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', 'shop');
});

it('leaves the other locale alone when only one slug is sent', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $merch = WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $merch->setTranslations('custom_slug', ['en' => 'shop', 'pl' => 'sklep']);
    $merch->save();

    // A slug controls a live URL — an unmentioned locale must survive.
    $this->putJson('/api/admin/modules/merch', ['custom_slug' => ['en' => 'store']])
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', 'store')
        ->assertJsonPath('data.custom_slug.pl', 'sklep');
});

it('clears one locale when that locale is explicitly null', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $merch = WebsiteModule::create(['slug' => 'merch', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $merch->setTranslations('custom_slug', ['en' => 'shop', 'pl' => 'sklep']);
    $merch->save();

    $this->putJson('/api/admin/modules/merch', ['custom_slug' => ['en' => null]])
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', null)
        ->assertJsonPath('data.custom_slug.pl', 'sklep');

    $this->getJson('/api/site-config')->assertJsonPath('module_config.merch.slug', 'merch');
});

it('honours "0" as a slug rather than treating it as empty', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    WebsiteModule::create(['slug' => 'videos', 'display_name' => 'Videos', 'enabled' => true, 'sort_order' => 1]);

    // "0" passes the regex, so it must not be swallowed by a PHP falsiness
    // check and silently fall back to the module key.
    $this->putJson('/api/admin/modules/videos', ['custom_slug' => ['en' => '0']])
        ->assertOk()
        ->assertJsonPath('data.custom_slug.en', '0');

    $this->getJson('/api/site-config')->assertJsonPath('module_config.videos.slug', '0');
});

it('rejects a slug colliding with another module whose stored slug is "0"', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $videos = WebsiteModule::create(['slug' => 'videos', 'display_name' => 'Videos', 'enabled' => true, 'sort_order' => 1]);
    $videos->setTranslation('custom_slug', 'en', '0');
    $videos->save();

    WebsiteModule::create(['slug' => 'press', 'display_name' => 'Press', 'enabled' => true, 'sort_order' => 2]);

    $this->putJson('/api/admin/modules/press', ['custom_slug' => ['en' => '0']])
        ->assertStatus(422)
        ->assertJsonValidationErrors('custom_slug.en');
});

// ── module settings (editable page copy) ─────────────────────────────────────

it('serves module settings on site-config with the locale resolved', function () {
    $this->getJson('/api/site-config?lang=pl')
        ->assertOk()
        ->assertJsonPath('module_config.contact.settings.kicker', 'SKONTAKTUJ SIĘ');
});

it('falls back to the other locale rather than emitting an empty setting', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $module = WebsiteModule::where('slug', 'contact')->first();
    $module->settings = ['kicker' => ['en' => 'ENGLISH ONLY']];
    $module->save();

    $this->getJson('/api/site-config?lang=pl')
        ->assertJsonPath('module_config.contact.settings.kicker', 'ENGLISH ONLY');
});

it('returns an object, never null, when a module has no settings', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    WebsiteModule::create(['slug' => 'press', 'display_name' => 'Press', 'enabled' => true, 'sort_order' => 9]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.press.settings', []);
});

it('saves settings for both locales', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['kicker' => ['en' => 'HELLO', 'pl' => 'CZEŚĆ']],
    ])->assertOk()
      ->assertJsonPath('data.settings.kicker.en', 'HELLO')
      ->assertJsonPath('data.settings.kicker.pl', 'CZEŚĆ');
});

// The bag merges per field and per locale, for the same reason custom_slug
// does: a payload naming only English must not blank the Polish copy.
it('leaves the other locale alone on a partial settings update', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['kicker' => ['en' => 'ONLY ENGLISH']],
    ])->assertOk()
      ->assertJsonPath('data.settings.kicker.en', 'ONLY ENGLISH')
      ->assertJsonPath('data.settings.kicker.pl', 'SKONTAKTUJ SIĘ');
});

it('leaves untouched fields alone when one field is updated', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['kicker' => ['en' => 'CHANGED']],
    ])->assertOk()
      ->assertJsonPath('data.settings.reply_time_label.en', 'Replies within 48h');
});

it('clears one locale of one field when explicitly sent null', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['kicker' => ['pl' => null]],
    ])->assertOk()
      ->assertJsonPath('data.settings.kicker.en', 'GET IN TOUCH');

    expect(WebsiteModule::where('slug', 'contact')->first()->settings['kicker'])
        ->not->toHaveKey('pl');
});

it('drops a field entirely once both locales are cleared', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['kicker' => ['en' => null, 'pl' => null]],
    ])->assertOk();

    expect(WebsiteModule::where('slug', 'contact')->first()->settings)
        ->not->toHaveKey('kicker');
});

it('rejects a setting value over the length limit', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', [
        'settings' => ['lead' => ['en' => str_repeat('a', 2001)]],
    ])->assertStatus(422)
      ->assertJsonValidationErrors('settings.lead.en');
});

it('leaves settings untouched when the payload omits them', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/contact', ['custom_name' => ['en' => 'Say hi', 'pl' => null]])
        ->assertOk()
        ->assertJsonPath('data.settings.kicker.en', 'GET IN TOUCH');
});

// ── about module (added 2026-08-27) ──────────────────────────────────────────

it('registers about as a module the migration created', function () {
    $about = WebsiteModule::where('slug', 'about')->first();

    expect($about)->not->toBeNull()
        ->and($about->display_name)->toBe('About')
        ->and((bool) $about->enabled)->toBeTrue();
});

it('serves about under its own slug in each locale', function () {
    $this->getJson('/api/site-config?lang=en')
        ->assertOk()
        ->assertJsonPath('module_config.about.slug', 'about')
        ->assertJsonPath('module_config.about.label', 'About');

    $this->getJson('/api/site-config?lang=pl')
        ->assertOk()
        ->assertJsonPath('module_config.about.slug', 'o-nas')
        ->assertJsonPath('module_config.about.label', 'O nas');
});

it('includes about in the module order', function () {
    $order = $this->getJson('/api/site-config')->assertOk()->json('module_order');

    expect($order)->toContain('about');
});

// The whole risk of adding a module row is claiming a slug another module is
// already served under, which would shadow a live page.
it('does not collide with any existing module slug', function () {
    $effective = WebsiteModule::all()
        ->flatMap(function ($module) {
            return collect(['en', 'pl'])->map(function ($locale) use ($module) {
                $slug = $module->getTranslation('custom_slug', $locale, false);

                return $locale . ':' . ($slug === '' || $slug === null ? $module->slug : $slug);
            });
        })
        ->all();

    expect($effective)->toHaveCount(count(array_unique($effective)));
});

it('lets about be switched off like any other module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->putJson('/api/admin/modules/about', ['enabled' => false])->assertOk();

    $this->getJson('/api/site-config')->assertJsonPath('modules.about', false);
});

it('accepts an faq assigned to the about module', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'about',
        'question'    => ['en' => 'Who is in the band?'],
        'answer'      => ['en' => 'Six players and a sound tech.'],
    ])->assertCreated();

    $this->getJson('/api/faqs?module=about')->assertJsonCount(1, 'data');
});

<?php

use App\Models\SiteDirtyArea;
use Illuminate\Support\Carbon;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('upserts an area rather than appending a duplicate', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('concerts');

    expect(SiteDirtyArea::count())->toBe(1);
});

it('orders pending areas most-recently-changed first', function () {
    Carbon::setTestNow('2026-01-01 00:00:00');
    SiteDirtyArea::markDirty('concerts');

    Carbon::setTestNow('2026-01-01 00:01:00');
    SiteDirtyArea::markDirty('faqs');

    Carbon::setTestNow();

    $pending = SiteDirtyArea::pending();

    expect($pending)->toHaveCount(2);
    expect($pending[0]['area'])->toBe('faqs');
    expect($pending[1]['area'])->toBe('concerts');
});

it('clears every pending area', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    SiteDirtyArea::clearAll();

    expect(SiteDirtyArea::count())->toBe(0);
});

use App\Models\SiteSetting;
use App\Support\SiteRebuild;
use Illuminate\Support\Facades\Http;

it('records the area but does not rebuild when auto_rebuild is false', function () {
    Http::fake();
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    SiteRebuild::markDirty('concerts');

    expect(SiteDirtyArea::pending())->toHaveCount(1);
    Http::assertNothingSent();
});

it('rebuilds and clears pending immediately when auto_rebuild is true', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    SiteRebuild::markDirty('concerts');

    expect(SiteDirtyArea::pending())->toHaveCount(0);
    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});

use App\Models\HeroImage;
use App\Models\User;
use App\Models\WebsiteModule;
use Laravel\Passport\Passport;

// NOTE on deviations from the task-4 brief's example test bodies: the brief's
// own instructions say to check factory/payload conventions against existing
// feature tests when they differ from what it assumed, and they do differ
// here in three ways —
//   1. There is no HeroImage::factory(); every existing hero-image test
//      builds rows with HeroImage::create() (see tests/Feature/HeroImageTest.php).
//   2. The admin-posts endpoint is `POST /api/posts` (role:admin,publisher),
//      not `/api/admin/posts` — see routes/api.php and tests/Feature/PostTest.php,
//      which also shows `title` sent as a plain string, not a per-locale array.
//   3. `id` is not in BandProfile's $fillable, so `BandProfile::factory()->create(['id' => 1])`
//      cannot reliably seed the id=1 singleton BandProfileController::profile()
//      requires. tests/TestCase.php already provides `createProfile()` for
//      exactly this — a raw DB insert that guarantees id=1 regardless of
//      auto-increment state — and every other band-profile test uses it.
// The assertion in each test (SiteDirtyArea::where('area', '...')->exists())
// is unchanged from the brief.

it('marks band-profile dirty on a profile update', function () {
    Http::fake();
    $this->createProfile();
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->putJson('/api/band-profile', ['name' => 'New Name'])->assertOk();

    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeTrue();
});

it('marks hero-images dirty on a hero image reorder', function () {
    Http::fake();
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $image = HeroImage::create([
        'scope'    => 'main',
        'image'    => 'hero-images/a.jpg',
        'position' => 0,
    ]);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$image->id]])->assertOk();

    expect(SiteDirtyArea::where('area', 'hero-images')->exists())->toBeTrue();
});

it('marks posts dirty on a post creation', function () {
    Http::fake();
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/posts', ['title' => 'A post'])->assertCreated();

    expect(SiteDirtyArea::where('area', 'posts')->exists())->toBeTrue();
});

it('marks website-modules dirty on a module update', function () {
    Http::fake();
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    expect(SiteDirtyArea::where('area', 'website-modules')->exists())->toBeTrue();
});

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

use App\Models\Concert;
use App\Models\Setlist;
use App\Models\SetlistItem;
use App\Models\Song;
use App\Models\Venue;

// NOTE on deviations from the task-5 brief's example test bodies, following
// the same "verify against the real codebase" instruction task-2-4's report
// documents:
//   1. There is no `/api/admin/{concerts,venues,setlists}` prefix. All three
//      resources are registered directly under the `role:admin` group as
//      `/api/concerts`, `/api/venues`, `/api/setlists` (routes/api.php:300-413).
//   2. There is no `Setlist::factory()` or `Song::factory()`/`SetlistItem::factory()`
//      (`database/factories/` has only ConcertFactory and VenueFactory).
//      `tests/Feature/SetlistTest.php` builds these rows with plain
//      `Setlist::create(['name' => ...])`, `Song::create(['title' => ...])` and
//      `SetlistItem::create([...])` throughout, so the same convention is used
//      here. `Concert::factory()->create()` and `Venue::factory()` do exist and
//      are used as-is (ConcertFactory auto-supplies a `Venue::factory()` for
//      `venue_id`).
// The assertion in each test — SiteDirtyArea::where('area', '...')->exists() —
// is unchanged from the brief.

it('marks concerts dirty when a concert is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $concert = Concert::factory()->create();

    $this->deleteJson("/api/concerts/{$concert->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'concerts')->exists())->toBeTrue();
});

it('marks venues dirty when a venue is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/venues', ['name' => 'A New Venue'])->assertCreated();

    expect(SiteDirtyArea::where('area', 'venues')->exists())->toBeTrue();
});

it('marks setlists dirty when a setlist item is reordered', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $setlist = Setlist::create(['name' => 'Set']);
    $song = Song::create(['title' => 'Opening Track']);
    $item = SetlistItem::create(['setlist_id' => $setlist->id, 'song_id' => $song->id, 'position' => 1]);

    $this->putJson("/api/setlists/{$setlist->id}/items/reorder", ['order' => [$item->id]])->assertOk();

    expect(SiteDirtyArea::where('area', 'setlists')->exists())->toBeTrue();
});

use App\Models\Album;
use App\Models\MusicVideo;
use App\Models\PressRelease;
use App\Models\Release;

// NOTE on deviations from the task-6 brief's example test bodies, following the
// same "verify against the real codebase" instruction as tasks 4 and 5's
// reports document:
//   1. There is no `/api/admin/{releases,photos,music-videos,press-releases}`
//      prefix. All four are registered directly under the `role:admin` group as
//      `/api/releases`, `/api/photos`, `/api/music-videos`, `/api/press-releases`
//      (routes/api.php:349-372).
//   2. There is no `Album::factory()` or `MusicVideo::factory()`
//      (`database/factories/` has only ReleaseFactory and PressReleaseFactory).
//      `tests/Feature/AlbumTest.php` and `tests/Feature/PhotoTest.php` build
//      albums with plain `Album::create(['title' => ..., 'slug_en' => ...])`,
//      so the same convention is used here for the photo test.
//   3. `music_videos.profile_id` is a non-nullable FK to `band_profiles`
//      (`2026_05_09_000006_create_music_videos_table.php`), and
//      `MusicVideoController::store()` falls back to `BandProfile::value('id')
//      ?? 1` when no profile exists — which would violate the FK. Every
//      existing `tests/Feature/MusicVideoTest.php` case calls
//      `$this->createProfile()` in a `beforeEach` for exactly this reason, so
//      the music-videos test below does the same.
// The assertion in each test — SiteDirtyArea::where('area', '...')->exists() —
// is unchanged from the brief.

it('marks releases dirty when a release is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $release = Release::factory()->create();

    $this->deleteJson("/api/releases/{$release->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'releases')->exists())->toBeTrue();
});

it('marks photos dirty when a photo caption is updated', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $album = Album::create(['title' => 'Test Album', 'slug_en' => 'test-album']);
    $photo = $album->photos()->create(['image' => 'photos/a.jpg', 'sort_order' => 0]);

    $this->putJson("/api/photos/{$photo->id}", ['caption' => 'New caption'])->assertOk();

    expect(SiteDirtyArea::where('area', 'photos')->exists())->toBeTrue();
});

it('marks music-videos dirty when a music video is created', function () {
    $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/music-videos', ['title' => 'A Video', 'video_url' => 'https://youtube.com/watch?v=abc'])
        ->assertCreated();

    expect(SiteDirtyArea::where('area', 'music-videos')->exists())->toBeTrue();
});

it('marks press-releases dirty when a press release is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $pr = PressRelease::factory()->create();

    $this->deleteJson("/api/press-releases/{$pr->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'press-releases')->exists())->toBeTrue();
});

use App\Models\Faq;
use App\Models\ShopCategory;
use App\Models\ShopItem;

// NOTE on deviations from the task-7 brief's example test bodies, following the
// same "verify against the real codebase" instruction as tasks 4-6's reports
// document:
//   1. There is no `/api/admin/shop-items` or `/api/admin/shop-categories`
//      prefix. Both are registered directly under the `role:admin` group as
//      `/api/shop/{shopItem}` (DELETE) and `/api/shop-categories` (POST) —
//      see routes/api.php:420-437. `/api/admin/faqs` is correct as written;
//      the faqs routes really do carry that prefix (routes/api.php:468-472).
//   2. `ShopItem::factory()` and `ShopCategory` both have factories
//      (`database/factories/ShopItemFactory.php`,
//      `database/factories/ShopCategoryFactory.php`), so both are used as-is.
//   3. Both `shop_items.profile_id` and `shop_categories.profile_id` are
//      non-nullable FKs to `band_profiles`, and `ShopItemFactory`/
//      `ShopCategoryController::store()` both default to profile id 1 —
//      which violates the FK when no band profile exists. Same class of bug
//      task-6 hit with `music_videos.profile_id`; the fix there was
//      `$this->createProfile()` in a `beforeEach`/at the top of the test, so
//      both shop tests below do the same.
// The assertion in each test — SiteDirtyArea::where('area', '...')->exists() —
// is unchanged from the brief.

it('marks shop dirty when a shop item is deleted', function () {
    $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $item = ShopItem::factory()->create();

    $this->deleteJson("/api/shop/{$item->id}")->assertOk();

    expect(SiteDirtyArea::where('area', 'shop')->exists())->toBeTrue();
});

it('marks shop dirty when a shop category is created', function () {
    $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/shop-categories', ['name' => 'Apparel'])->assertCreated();

    expect(SiteDirtyArea::where('area', 'shop')->exists())->toBeTrue();
});

it('marks faqs dirty when a faq is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question' => ['en' => 'Q?'],
        'answer' => ['en' => 'A.'],
    ])->assertCreated();

    expect(SiteDirtyArea::where('area', 'faqs')->exists())->toBeTrue();
});

use App\Models\SocialLink;

// NOTE on deviations from the task-8 brief's example test bodies, following the
// same "verify against the real codebase" instruction as tasks 4-7's reports
// document:
//   1. There is no `/api/admin/band-members` or `/api/admin/social-links`
//      prefix. Both live directly under `/api/band-profile/...`
//      (routes/api.php:276, 295-298): `POST /api/band-profile/members`,
//      `PUT|DELETE /api/band-profile/social-links/{link}`.
//   2. `BandMemberController::profile()` and `SocialLinkController::profile()`
//      both do `BandProfile::findOrFail(1)`, so a band profile with id 1 must
//      exist first — same FK/singleton issue tasks 4-7 hit with
//      `BandProfile::factory()->create(['id' => 1])`. `$this->createProfile()`
//      is used here too, matching BandMemberTest.php/SocialLinkTest.php.
// The assertion in each test — SiteDirtyArea::where('area', '...')->exists() —
// is unchanged from the brief.

it('marks band-members dirty when a member is created', function () {
    $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/band-profile/members', ['first_name' => 'Jane', 'last_name' => 'Doe'])
        ->assertCreated();

    expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();
});

it('marks band-profile dirty when a profile-owned social link is deleted', function () {
    $profile = $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $link = SocialLink::create(['profile_id' => $profile->id, 'platform' => 'instagram', 'url' => 'https://instagram.com/x', 'position' => 0]);

    $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeTrue();
});

it('marks venues dirty when a venue-owned social link is deleted, not band-profile', function () {
    $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $venue = Venue::factory()->create();
    $link = SocialLink::create(['venue_id' => $venue->id, 'platform' => 'instagram', 'url' => 'https://instagram.com/x', 'position' => 0]);

    $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'venues')->exists())->toBeTrue();
    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeFalse();
});

it('marks band-members dirty when a member-owned social link is deleted, not band-profile', function () {
    $profile = $this->createProfile();
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $member = $profile->members()->create(['first_name' => 'Jane', 'last_name' => 'Doe']);
    // A member-owned link carries both member_id AND profile_id — see
    // BandMemberController::store()/update(), which explicitly pass
    // 'profile_id' => $profile->id when creating via $member->socialLinks()
    // (BandMember::socialLinks() is hasMany(SocialLink::class, 'member_id')).
    $link = SocialLink::create([
        'member_id'  => $member->id,
        'profile_id' => $profile->id,
        'platform'   => 'instagram',
        'url'        => 'https://instagram.com/x',
        'position'   => 0,
    ]);

    $this->deleteJson("/api/band-profile/social-links/{$link->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();
    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeFalse();
});

<?php

use App\Models\BandMember;
use App\Models\Concert;
use App\Models\Photo;
use App\Models\PressRelease;
use App\Models\SocialLink;
use App\Models\Tag;
use App\Models\Venue;
use App\Services\EpkSnapshotBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    DB::table('band_profiles')->insert([
        'id'         => 1,
        'name'       => 'Test Band',
        'created_at' => now()->toDateTimeString(),
        'updated_at' => now()->toDateTimeString(),
    ]);
});

// Shared helper: create a venue for concert tests (venue_id is NOT NULL)
function makeVenue(): Venue
{
    return Venue::factory()->create();
}

// ── Top-level keys ────────────────────────────────────────────────────────────

it('returns an array with all expected top-level keys', function () {
    $result = EpkSnapshotBuilder::build();

    expect($result)->toBeArray();

    foreach ([
        'name', 'bio_short', 'bio_medium', 'bio_long', 'formation_year',
        'hometown', 'genres', 'comparable_artists', 'booking_email',
        'press_email', 'stat_spotify_monthly', 'stat_instagram_followers',
        'stat_tiktok_followers', 'stat_youtube_subscribers', 'stat_facebook_followers',
        'tech_rider_url', 'stage_plot_url', 'social_links', 'music_videos',
        'featured_release', 'press_photos', 'press_articles', 'upcoming_concerts',
    ] as $key) {
        expect($result)->toHaveKey($key);
    }
});

it('returns empty arrays for optional sections when no related data exists', function () {
    $result = EpkSnapshotBuilder::build();

    expect($result['social_links'])->toBe([]);
    expect($result['music_videos'])->toBe([]);
    expect($result['featured_release'])->toBeNull();
    expect($result['press_photos'])->toBe([]);
    expect($result['press_articles'])->toBe([]);
    expect($result['upcoming_concerts'])->toBe([]);
});

it('returns the band name from the profile', function () {
    expect(EpkSnapshotBuilder::build()['name'])->toBe('Test Band');
});

it('returns null for rider URLs when paths are not set', function () {
    $result = EpkSnapshotBuilder::build();

    expect($result['tech_rider_url'])->toBeNull();
    expect($result['stage_plot_url'])->toBeNull();
});

it('returns storage-prefixed URLs when rider paths are set', function () {
    \App\Models\BandProfile::findOrFail(1)->update([
        'tech_rider_path' => 'riders/tech.pdf',
        'stage_plot_path' => 'riders/stage.pdf',
    ]);

    $result = EpkSnapshotBuilder::build();

    expect($result['tech_rider_url'])->toBe('/storage/riders/tech.pdf');
    expect($result['stage_plot_url'])->toBe('/storage/riders/stage.pdf');
});

// ── Social links ──────────────────────────────────────────────────────────────

it('includes social links when they exist', function () {
    SocialLink::create(['profile_id' => 1, 'member_id' => null, 'platform' => 'instagram', 'url' => 'https://instagram.com/testband']);

    $result = EpkSnapshotBuilder::build();

    expect($result['social_links'])->toHaveCount(1);
    expect($result['social_links'][0])->toMatchArray(['platform' => 'instagram', 'url' => 'https://instagram.com/testband']);
});

it('includes multiple social links with correct shape', function () {
    SocialLink::create(['profile_id' => 1, 'member_id' => null, 'platform' => 'instagram', 'url' => 'https://instagram.com/testband']);
    SocialLink::create(['profile_id' => 1, 'member_id' => null, 'platform' => 'facebook',  'url' => 'https://facebook.com/testband']);

    $result = EpkSnapshotBuilder::build();

    expect($result['social_links'])->toHaveCount(2);
    expect(array_column($result['social_links'], 'platform'))->toContain('instagram')->toContain('facebook');
});

it('excludes member social links from the band social links section', function () {
    // BandMember must exist for the FK on social_links.member_id
    $member = BandMember::create(['profile_id' => 1, 'first_name' => 'John', 'last_name' => 'Doe', 'can_login' => false]);

    SocialLink::create(['profile_id' => 1, 'member_id' => null,       'platform' => 'instagram', 'url' => 'https://instagram.com/testband']);
    SocialLink::create(['profile_id' => 1, 'member_id' => $member->id,'platform' => 'twitter',   'url' => 'https://twitter.com/member']);

    $result = EpkSnapshotBuilder::build();

    expect($result['social_links'])->toHaveCount(1);
    expect($result['social_links'][0]['platform'])->toBe('instagram');
});

// ── Press articles (featured filter) ─────────────────────────────────────────

it('includes only featured press articles', function () {
    PressRelease::create(['profile_id' => 1, 'url' => 'https://press.example.com/featured',     'og_title' => 'Featured Article',     'published_at' => now()->subDays(5), 'featured' => true]);
    PressRelease::create(['profile_id' => 1, 'url' => 'https://press.example.com/not-featured', 'og_title' => 'Non-Featured Article', 'published_at' => now()->subDays(3), 'featured' => false]);

    $result = EpkSnapshotBuilder::build();

    expect($result['press_articles'])->toHaveCount(1);
    expect($result['press_articles'][0]['og_title'])->toBe('Featured Article');
});

it('returns empty press_articles when no articles are featured', function () {
    PressRelease::create(['profile_id' => 1, 'url' => 'https://press.example.com/article', 'published_at' => now()->subDays(1), 'featured' => false]);

    expect(EpkSnapshotBuilder::build()['press_articles'])->toBe([]);
});

it('limits press articles to 3 most recent featured ones', function () {
    foreach (range(1, 4) as $i) {
        PressRelease::create(['profile_id' => 1, 'url' => "https://press.example.com/article-{$i}", 'og_title' => "Featured {$i}", 'published_at' => now()->subDays(10 - $i), 'featured' => true]);
    }

    expect(EpkSnapshotBuilder::build()['press_articles'])->toHaveCount(3);
});

it('orders featured press articles by published_at descending', function () {
    PressRelease::create(['profile_id' => 1, 'url' => 'https://press.example.com/older', 'og_title' => 'Older Article', 'published_at' => now()->subDays(10), 'featured' => true]);
    PressRelease::create(['profile_id' => 1, 'url' => 'https://press.example.com/newer', 'og_title' => 'Newer Article', 'published_at' => now()->subDays(2),  'featured' => true]);

    $result = EpkSnapshotBuilder::build();
    expect($result['press_articles'][0]['og_title'])->toBe('Newer Article');
    expect($result['press_articles'][1]['og_title'])->toBe('Older Article');
});

it('returns correct shape for press article entries', function () {
    PressRelease::create(['profile_id' => 1, 'url' => 'https://rolling-stone.com/review', 'og_title' => 'Best Ska Band', 'og_description' => 'A glowing review.', 'og_image' => 'https://cdn.example.com/image.jpg', 'og_site_name' => 'Rolling Stone', 'published_at' => '2025-04-01', 'featured' => true]);

    $article = EpkSnapshotBuilder::build()['press_articles'][0];
    expect($article)->toHaveKeys(['id', 'url', 'og_title', 'og_description', 'og_image', 'og_site_name', 'published_at', 'tags']);
    expect($article['og_site_name'])->toBe('Rolling Stone');
});

// ── Press photos (epk_featured filter) ───────────────────────────────────────

it('includes only epk_featured photos', function () {
    Photo::create(['image' => 'photos/featured.jpg',     'epk_featured' => true,  'sort_order' => 1]);
    Photo::create(['image' => 'photos/not-featured.jpg', 'epk_featured' => false, 'sort_order' => 2]);

    $result = EpkSnapshotBuilder::build();

    expect($result['press_photos'])->toHaveCount(1);
    expect($result['press_photos'][0]['image_url'])->toBe('/storage/photos/featured.jpg');
});

it('returns empty press_photos when no photos are epk_featured', function () {
    Photo::create(['image' => 'photos/regular.jpg', 'epk_featured' => false, 'sort_order' => 1]);

    expect(EpkSnapshotBuilder::build()['press_photos'])->toBe([]);
});

it('orders press photos by sort_order', function () {
    Photo::create(['image' => 'photos/second.jpg', 'epk_featured' => true, 'sort_order' => 2]);
    Photo::create(['image' => 'photos/first.jpg',  'epk_featured' => true, 'sort_order' => 1]);

    $result = EpkSnapshotBuilder::build();

    expect($result['press_photos'])->toHaveCount(2);
    expect($result['press_photos'][0]['image_url'])->toBe('/storage/photos/first.jpg');
});

it('returns correct shape for press photo entries', function () {
    Photo::create(['image' => 'photos/hero.jpg', 'caption' => 'Live at Tivoli', 'epk_featured' => true, 'sort_order' => 1]);

    $photo = EpkSnapshotBuilder::build()['press_photos'][0];
    expect($photo)->toHaveKeys(['id', 'image_url', 'caption']);
    expect($photo['caption'])->toBe('Live at Tivoli');
});

// ── Upcoming concerts ─────────────────────────────────────────────────────────

it('includes upcoming concerts ordered by date', function () {
    $venue = makeVenue();
    Concert::create(['venue_id' => $venue->id, 'date' => now()->addDays(5)->toDateString(), 'start_time' => '20:00']);
    Concert::create(['venue_id' => $venue->id, 'date' => now()->addDays(2)->toDateString(), 'start_time' => '19:00']);

    $result = EpkSnapshotBuilder::build();

    expect($result['upcoming_concerts'])->toHaveCount(2);
    expect($result['upcoming_concerts'][0]['date'])->toBeLessThan($result['upcoming_concerts'][1]['date']);
});

it('excludes past concerts', function () {
    $venue = makeVenue();
    Concert::create(['venue_id' => $venue->id, 'date' => now()->subDay()->toDateString(), 'start_time' => '20:00']);
    Concert::create(['venue_id' => $venue->id, 'date' => now()->addDay()->toDateString(), 'start_time' => '20:00']);

    expect(EpkSnapshotBuilder::build()['upcoming_concerts'])->toHaveCount(1);
});

it('limits upcoming concerts to 5', function () {
    $venue = makeVenue();
    foreach (range(1, 6) as $i) {
        Concert::create(['venue_id' => $venue->id, 'date' => now()->addDays($i)->toDateString(), 'start_time' => '20:00']);
    }

    expect(EpkSnapshotBuilder::build()['upcoming_concerts'])->toHaveCount(5);
});

it('includes venue details on upcoming concerts', function () {
    $venue = Venue::factory()->create(['name' => 'Jazz Club']);
    Concert::create(['venue_id' => $venue->id, 'date' => now()->addDay()->toDateString()]);

    $result = EpkSnapshotBuilder::build();

    expect($result['upcoming_concerts'])->toHaveCount(1);
    expect($result['upcoming_concerts'][0]['venue']['name'])->toBe('Jazz Club');
});

it('returns correct shape for upcoming concert entries', function () {
    $venue = makeVenue();
    Concert::create(['venue_id' => $venue->id, 'date' => now()->addDay()->toDateString(), 'start_time' => '21:30']);

    $concert = EpkSnapshotBuilder::build()['upcoming_concerts'][0];
    expect($concert)->toHaveKeys(['id', 'date', 'start_time', 'venue', 'links']);
    expect($concert['start_time'])->toBe('21:30');
    expect($concert['links'])->toBe([]);
});

<?php

use App\Models\HeroImage;
use App\Models\Photo;
use App\Models\User;
use App\Models\WebsiteModule;
use Laravel\Passport\Passport;

function heroPhoto(string $image = 'photos/a.jpg'): Photo
{
    return Photo::create(['image' => $image, 'sort_order' => 0]);
}

function heroAdmin(): void
{
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
}

it('orders a scope by position, not by id', function () {
    $first  = heroPhoto('photos/first.jpg');
    $second = heroPhoto('photos/second.jpg');

    // position deliberately inverted against id: a read that leans on the
    // auto-increment tiebreaker instead of the column passes without this.
    HeroImage::create(['photo_id' => $first->id,  'scope' => 'main', 'position' => 1]);
    HeroImage::create(['photo_id' => $second->id, 'scope' => 'main', 'position' => 0]);

    $ordered = HeroImage::where('scope', 'main')->orderBy('position')->pluck('photo_id');

    expect($ordered->all())->toBe([$second->id, $first->id]);
});

it('drops out of every scope when its photo is deleted', function () {
    $photo = heroPhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main',    'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'contact', 'position' => 0]);

    $photo->delete();

    expect(HeroImage::count())->toBe(0);
});

it('allows the same photo in several scopes', function () {
    $photo = heroPhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main', 'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'home', 'position' => 0]);

    expect(HeroImage::where('photo_id', $photo->id)->count())->toBe(2);
});

it('treats every live module slug plus main and home as a valid scope', function () {
    $allowed = HeroImage::allowedScopes();

    expect($allowed)->toContain('main')
        ->and($allowed)->toContain('home')
        ->and($allowed)->toContain('contact');
});

it('keeps a disabled module as a valid scope', function () {
    // Switching a section off must not make its pictures unsavable — the same
    // rule FAQ categories follow.
    //
    // The module is created here rather than disabling a seeded one: migrations
    // only insert contact, about and footer, and the rest arrive via a seeder
    // that does not run against the test database.
    WebsiteModule::create([
        'slug'         => 'photos',
        'display_name' => 'Gallery',
        'enabled'      => false,
    ]);

    expect(HeroImage::allowedScopes())->toContain('photos');
});

// ── admin endpoints ───────────────────────────────────────────────────────────

it('rejects hero image reads without auth', function () {
    $this->getJson('/api/admin/hero-images')->assertUnauthorized();
});

it('replaces a scope rather than appending to it', function () {
    heroAdmin();
    $a = heroPhoto('photos/a.jpg');
    $b = heroPhoto('photos/b.jpg');
    $c = heroPhoto('photos/c.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id, $b->id]])
        ->assertOk()
        ->assertJsonCount(2, 'data.main');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$c->id]])
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.photo_id', $c->id);

    expect(HeroImage::where('scope', 'main')->count())->toBe(1);
});

it('writes position from the payload order', function () {
    heroAdmin();
    $a = heroPhoto('photos/a.jpg');
    $b = heroPhoto('photos/b.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$b->id, $a->id]])
        ->assertOk()
        ->assertJsonPath('data.main.0.photo_id', $b->id)
        ->assertJsonPath('data.main.0.position', 0)
        ->assertJsonPath('data.main.1.photo_id', $a->id)
        ->assertJsonPath('data.main.1.position', 1);
});

it('clears a scope when given an empty list', function () {
    heroAdmin();
    $a = heroPhoto();
    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id]])->assertOk();

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => []])
        ->assertOk()
        ->assertJsonMissingPath('data.main');

    expect(HeroImage::where('scope', 'main')->count())->toBe(0);
});

it('leaves other scopes untouched when one is saved', function () {
    heroAdmin();
    $a = heroPhoto('photos/a.jpg');
    $b = heroPhoto('photos/b.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id]])->assertOk();
    $this->putJson('/api/admin/hero-images/contact', ['photo_ids' => [$b->id]])->assertOk();

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonCount(1, 'data.contact');
});

it('rejects an unknown scope', function () {
    heroAdmin();
    $a = heroPhoto();

    $this->putJson('/api/admin/hero-images/not-a-page', ['photo_ids' => [$a->id]])
        ->assertStatus(422);
});

it('accepts a disabled module as a scope', function () {
    heroAdmin();
    WebsiteModule::create([
        'slug'         => 'photos',
        'display_name' => 'Gallery',
        'enabled'      => false,
    ]);
    $a = heroPhoto();

    $this->putJson('/api/admin/hero-images/photos', ['photo_ids' => [$a->id]])
        ->assertOk()
        ->assertJsonCount(1, 'data.photos');
});

it('rejects a photo id that does not exist', function () {
    heroAdmin();

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [999999]])
        ->assertStatus(422);
});

// ── site-config ───────────────────────────────────────────────────────────────

it('serves hero images from site-config without auth', function () {
    $a = heroPhoto('photos/a.jpg');
    HeroImage::create(['photo_id' => $a->id, 'scope' => 'main', 'position' => 0]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonCount(1, 'hero_images.main')
        ->assertJsonPath('hero_images.main.0.id', $a->id)
        ->assertJsonPath('hero_images.main.0.url', '/storage/photos/a.jpg');
});

it('omits a hero row whose photo has no file', function () {
    // `url` is non-nullable on the public side; a null would render as the
    // literal string "null" inside a CSS url(). Filtered at the source instead.
    $broken = Photo::create(['image' => null, 'sort_order' => 0]);
    HeroImage::create(['photo_id' => $broken->id, 'scope' => 'main', 'position' => 0]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonMissingPath('hero_images.main');
});

it('serves an empty hero_images object rather than null when none are set', function () {
    // A null here throws during astro build, which takes down all 35 pages.
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('hero_images', []);
});

it('keeps hero images out of module_config so the slug map is unaffected', function () {
    $a = heroPhoto();
    HeroImage::create(['photo_id' => $a->id, 'scope' => 'home', 'position' => 0]);

    $response = $this->getJson('/api/site-config')->assertOk();

    expect(array_keys($response->json('module_config')))->not->toContain('home');
    expect($response->json('hero_images.home'))->toHaveCount(1);
});

it('serves an empty admin payload as an object, not an array', function () {
    // The payload is a map keyed by scope. PHP's empty array encodes as [],
    // which contradicts the client's Record<string, HeroImage[]> type.
    heroAdmin();

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonPath('data', []);

    expect($this->getJson('/api/admin/hero-images')->content())
        ->toContain('"data":{}');
});

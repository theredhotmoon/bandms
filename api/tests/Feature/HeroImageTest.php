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
